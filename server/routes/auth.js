/**
 * Rute autentikasi halaman rekap.
 *
 * Tidak ada rute pendaftaran — akun dibuat lewat `npm run akun`. Untuk enam
 * pengguna tetap, membuka pintu pendaftaran hanya menambah risiko tanpa
 * manfaat (RANCANGAN-DATA.md §10).
 */
import { Router } from 'express';
import {
  cariPengguna, periksaSandi, buatToken, bacaToken,
  pasangKuki, hapusKuki, catatMasuk, catatAkses, divisiAkun,
  gantiSandi, PANJANG_SANDI_MINIMUM
} from '../services/authService.js';
import { buatPenghitungMasuk } from '../services/pembatasLaju.js';
import { info, peringatan } from '../services/logUtil.js';

export const authRouter = Router();

/* ────────────────────────────────────────────────────────────────
   Pembatas percobaan masuk
   ──────────────────────────────────────────────────────────────── */

const penghitung = buatPenghitungMasuk({
  maksPerAkun: 5,      // per pasangan akun + alamat
  maksPerAlamat: 15,   // lapis kedua: satu alamat, akun mana pun
  jedaMenit: 15
});

/* ────────────────────────────────────────────────────────────────
   Rute
   ──────────────────────────────────────────────────────────────── */

/** POST /api/auth/masuk */
authRouter.post('/masuk', (req, res) => {
  try {
    const namaAkun = String(req.body?.namaAkun || '').trim().toLowerCase();
    const sandi = String(req.body?.sandi || '');

    if (!namaAkun || !sandi) {
      return res.status(400).json({ success: false, error: 'Nama akun dan kata sandi wajib diisi' });
    }

    const alamat = req.ip || req.socket?.remoteAddress || 'tidak-diketahui';

    const sisaMenit = penghitung.terkunci(namaAkun, alamat);
    if (sisaMenit > 0) {
      peringatan('masuk-terkunci', { akun: namaAkun, alamat, sisaMenit });
      return res.status(429).json({
        success: false,
        error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${sisaMenit} menit.`
      });
    }

    const pengguna = cariPengguna(namaAkun);

    // Pesan galat sengaja sama untuk akun tidak dikenal maupun sandi keliru,
    // agar tidak dapat dipakai menebak nama akun mana yang benar-benar ada.
    if (!pengguna || !periksaSandi(sandi, pengguna.sandi_hash)) {
      penghitung.catatGagal(namaAkun, alamat);
      peringatan('masuk-gagal', { akun: namaAkun, alamat });
      return res.status(401).json({ success: false, error: 'Nama akun atau kata sandi salah' });
    }

    penghitung.hapus(namaAkun, alamat);
    info('masuk-berhasil', { akun: namaAkun, peran: pengguna.peran, alamat });
    catatMasuk(namaAkun);
    catatAkses(namaAkun, 'masuk');
    pasangKuki(res, buatToken(pengguna));

    // Bentuknya WAJIB sama persis dengan GET /auth/saya. Antarmuka menyimpan
    // keduanya ke keadaan yang sama: hasil masuk dipakai langsung, hasil /saya
    // dipakai saat halaman dimuat ulang. Bila salah satunya kekurangan kolom,
    // halaman berperilaku berbeda sebelum dan sesudah muat ulang — perbedaan
    // yang hampir mustahil ditemukan lewat pengujian manual.
    res.json({
      success: true,
      pengguna: {
        namaAkun: pengguna.nama_akun,
        nama: pengguna.nama,
        peran: pengguna.peran,
        divisi: divisiAkun(pengguna)
      }
    });
  } catch (error) {
    console.error('Error masuk:', error);
    res.status(500).json({ success: false, error: 'Gagal memproses permintaan masuk' });
  }
});

/** POST /api/auth/keluar */
authRouter.post('/keluar', (req, res) => {
  hapusKuki(res);
  res.json({ success: true });
});

/**
 * POST /api/auth/ganti-sandi
 *
 * Mengganti kata sandi sebuah akun. TIDAK menuntut sesi — yang membuktikan
 * kepemilikan adalah kata sandi lamanya, dan itu persis sekuat masuk. Karena
 * itu ia dapat dipanggil dari halaman masuk maupun dari navbar oleh orang yang
 * sudah masuk.
 *
 * Yang dilonggarkan hanya sesinya, bukan penjagaannya:
 *
 *   1. sandi lama     — satu-satunya bukti kepemilikan yang diterima
 *   2. pembatas laju  — penghitung yang SAMA dengan halaman masuk, sehingga
 *                       jalur ini tidak menjadi tempat menebak kata sandi tanpa
 *                       batas setelah halaman masuk dikunci
 *   3. galat samar    — "nama akun atau kata sandi salah", bentuk yang sama
 *                       dengan halaman masuk, agar tidak dapat dipakai menebak
 *                       nama akun mana yang benar-benar ada
 *   4. sesi diputus   — gantiSandi() menulis `sandi_diubah_pada`, sehingga
 *                       seluruh token lama ditolak. Tanpa ini, mengganti sandi
 *                       karena curiga sesi dicuri tidak mengusir siapa pun.
 *
 * TIDAK ADA "lupa kata sandi" di sini, dan itu bukan kelalaian: memulihkan akun
 * tanpa kata sandi lama menuntut jalur pengiriman terverifikasi — surel atau
 * SMS — dan sistem ini tidak punya keduanya. Server tidak pernah mengirim apa
 * pun sendiri; pesan WhatsApp pun dibuka peramban pelapor lewat wa.me. Yang
 * benar-benar lupa dibantu admin lewat `npm run akun -- ganti`.
 */
authRouter.post('/ganti-sandi', (req, res) => {
  try {
    const namaAkun = String(req.body?.namaAkun || '').trim().toLowerCase();
    const sandiLama = String(req.body?.sandiLama || '');
    const sandiBaru = String(req.body?.sandiBaru || '');
    const alamat = req.ip || req.socket?.remoteAddress || 'tidak-diketahui';

    if (!namaAkun || !sandiLama || !sandiBaru) {
      return res.status(400).json({
        success: false,
        error: 'Nama akun, kata sandi lama, dan kata sandi baru wajib diisi'
      });
    }
    if (sandiBaru.length < PANJANG_SANDI_MINIMUM) {
      return res.status(400).json({
        success: false,
        error: `Kata sandi baru minimal ${PANJANG_SANDI_MINIMUM} karakter`
      });
    }
    if (sandiBaru === sandiLama) {
      return res.status(400).json({ success: false, error: 'Kata sandi baru harus berbeda dari yang lama' });
    }

    // Pembatas yang sama dengan halaman masuk. Tanpa ini, jalur ini menjadi
    // tempat menebak kata sandi tanpa batas bagi siapa pun yang memegang sesi.
    const sisaMenit = penghitung.terkunci(namaAkun, alamat);
    if (sisaMenit > 0) {
      peringatan('ganti-sandi-terkunci', { akun: namaAkun, alamat, sisaMenit });
      return res.status(429).json({
        success: false,
        error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${sisaMenit} menit.`
      });
    }

    const pengguna = cariPengguna(namaAkun);

    // Pesan yang sama untuk akun tidak dikenal maupun sandi keliru — bentuknya
    // disamakan dengan halaman masuk. Membedakan keduanya membuat jalur ini
    // dapat dipakai memeriksa nama akun mana yang benar-benar ada.
    if (!pengguna || !periksaSandi(sandiLama, pengguna.sandi_hash)) {
      penghitung.catatGagal(namaAkun, alamat);
      peringatan('ganti-sandi-gagal', { akun: namaAkun, alamat });
      return res.status(401).json({ success: false, error: 'Nama akun atau kata sandi salah' });
    }

    gantiSandi(namaAkun, sandiBaru);
    penghitung.hapus(namaAkun, alamat);

    // Seluruh token lama kini ditolak. Yang mengganti diberi sesi baru supaya
    // tidak ikut terlempar keluar dari perangkat yang sedang ia pakai —
    // perangkat LAIN tetap harus masuk ulang, dan itu memang tujuannya.
    // Dipanggil dari halaman masuk, ini sekaligus memasukkannya langsung.
    pasangKuki(res, buatToken(cariPengguna(namaAkun)));

    catatAkses(namaAkun, 'ganti-sandi', 'diganti sendiri lewat antarmuka');
    info('ganti-sandi-berhasil', { akun: namaAkun });

    res.json({
      success: true,
      pesan: 'Kata sandi berhasil diganti. Perangkat lain yang masih masuk akan diminta masuk kembali.',
      pengguna: {
        namaAkun: pengguna.nama_akun,
        nama: pengguna.nama,
        peran: pengguna.peran,
        divisi: divisiAkun(pengguna)
      }
    });
  } catch (error) {
    console.error('Error ganti sandi:', error);
    res.status(500).json({ success: false, error: 'Gagal mengganti kata sandi' });
  }
});

/**
 * GET /api/auth/saya
 * Dipakai antarmuka untuk mengetahui apakah sesi masih berlaku.
 * Membalas 200 dengan `pengguna: null` — bukan 401 — agar halaman rekap dapat
 * menampilkan formulir masuk tanpa memunculkan galat di konsol peramban.
 */
authRouter.get('/saya', (req, res) => {
  const kuki = req.headers.cookie || '';
  const token = kuki.split(';').map((p) => p.trim())
    .find((p) => p.startsWith('sigap_sesi='))?.slice('sigap_sesi='.length);

  const data = bacaToken(token);
  if (!data) return res.json({ success: true, pengguna: null });

  const pengguna = cariPengguna(data.akun);
  if (!pengguna) return res.json({ success: true, pengguna: null });

  // Pemeriksaan yang sama dengan wajibMasuk(): token yang terbit sebelum kata
  // sandi terakhir diganti sudah tidak berlaku. Tanpa ini antarmuka mengira
  // sesinya masih hidup, lalu setiap permintaan berikutnya ditolak 401 tanpa
  // ada yang menjelaskan sebabnya.
  if (pengguna.sandi_diubah_pada &&
      (Number(data.iat) || 0) < Date.parse(pengguna.sandi_diubah_pada)) {
    return res.json({ success: true, pengguna: null });
  }

  res.json({
    success: true,
    pengguna: {
      namaAkun: pengguna.nama_akun,
      nama: pengguna.nama,
      peran: pengguna.peran,
      // Dipakai antarmuka untuk menjelaskan cakupan wewenang. Bukan penjaga:
      // pembatasan sesungguhnya berlaku di sisi server pada setiap permintaan.
      divisi: divisiAkun(pengguna)
    }
  });
});
