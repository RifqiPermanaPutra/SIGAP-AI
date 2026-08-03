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
  pasangKuki, hapusKuki, catatMasuk, catatAkses
} from '../services/authService.js';

export const authRouter = Router();

/* ────────────────────────────────────────────────────────────────
   Pembatas percobaan masuk
   ──────────────────────────────────────────────────────────────── */

const MAKS_PERCOBAAN = 5;
const JEDA_MENIT = 15;

/**
 * Penghitung percobaan gagal per nama akun.
 *
 * Disimpan di memori, bukan di basis data: setelah server dijalankan ulang
 * penghitungnya wajar dimulai dari nol, dan menuliskannya ke disk setiap
 * percobaan gagal justru membuka jalan pembengkakan berkas.
 */
const percobaan = new Map();

function terkunci(akun) {
  const catatan = percobaan.get(akun);
  if (!catatan) return 0;
  if (Date.now() > catatan.sampai) {
    percobaan.delete(akun);
    return 0;
  }
  return catatan.gagal >= MAKS_PERCOBAAN ? Math.ceil((catatan.sampai - Date.now()) / 60000) : 0;
}

function catatGagal(akun) {
  const catatan = percobaan.get(akun) || { gagal: 0, sampai: 0 };
  catatan.gagal += 1;
  catatan.sampai = Date.now() + JEDA_MENIT * 60 * 1000;
  percobaan.set(akun, catatan);
}

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

    const sisaMenit = terkunci(namaAkun);
    if (sisaMenit > 0) {
      return res.status(429).json({
        success: false,
        error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${sisaMenit} menit.`
      });
    }

    const pengguna = cariPengguna(namaAkun);

    // Pesan galat sengaja sama untuk akun tidak dikenal maupun sandi keliru,
    // agar tidak dapat dipakai menebak nama akun mana yang benar-benar ada.
    if (!pengguna || !periksaSandi(sandi, pengguna.sandi_hash)) {
      catatGagal(namaAkun);
      return res.status(401).json({ success: false, error: 'Nama akun atau kata sandi salah' });
    }

    percobaan.delete(namaAkun);
    catatMasuk(namaAkun);
    catatAkses(namaAkun, 'masuk');
    pasangKuki(res, buatToken(pengguna));

    res.json({
      success: true,
      pengguna: { namaAkun: pengguna.nama_akun, nama: pengguna.nama, peran: pengguna.peran }
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
    pengguna: { namaAkun: pengguna.nama_akun, nama: pengguna.nama, peran: pengguna.peran }
  });
});
