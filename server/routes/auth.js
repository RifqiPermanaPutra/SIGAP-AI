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
  pasangKuki, hapusKuki, catatMasuk, catatAkses, divisiAkun
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

    const ingatSaya = req.body?.ingatSaya === true;

    penghitung.hapus(namaAkun, alamat);
    info('masuk-berhasil', { akun: namaAkun, peran: pengguna.peran, alamat, ingatSaya });
    catatMasuk(namaAkun);
    catatAkses(namaAkun, 'masuk', ingatSaya ? 'sesi panjang' : null);
    pasangKuki(res, buatToken(pengguna, ingatSaya), ingatSaya);

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
