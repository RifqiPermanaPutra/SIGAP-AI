/**
 * Pemeriksaan status laporan oleh pelapor.
 *
 * Sampai sekarang pelapor menerima nomor tiket lalu tidak pernah tahu apa-apa
 * lagi: tidak ada pemberitahuan saat engineer menandai selesai, dan tidak ada
 * tempat untuk memeriksanya sendiri. Bagi layanan pengaduan, itu keluhan yang
 * paling cepat muncul.
 *
 * TERBUKA TANPA MASUK — dan justru karena itu isinya dibatasi keras.
 *
 * Nomor tiket berbentuk SGP-YYYYMMDD-NNNN, sehingga dapat ditebak berurutan.
 * Siapa pun di jaringan kantor bisa mencoba SGP-20260805-0001, -0002, dan
 * seterusnya. Karena itu yang dikembalikan hanya keadaan laporan — TANPA nama
 * pelapor, fungsi, lokasi, isi keluhan, maupun catatan penanganan. Yang bocor
 * dari penebakan berurutan paling jauh hanyalah "ada berapa laporan hari itu
 * dan sudah ditangani atau belum", dan itu bukan rahasia siapa pun.
 *
 * Rincian lengkap tetap hanya ada di `/rekap`, yang wajib masuk.
 */
import { Router } from 'express';
import { wajibSiap } from '../database/init.js';
import { namaDivisi } from '../config/divisi.js';
import { batasiLaju } from '../services/pembatasLaju.js';

export const tiketRouter = Router();

/**
 * Pembatas laju agak ketat: rute ini terbuka tanpa masuk, dan satu-satunya
 * cara menyalahgunakannya adalah menebak nomor secara berurutan. Pelapor yang
 * wajar memeriksa tiketnya beberapa kali sehari, bukan puluhan kali semenit.
 */
const batasCek = batasiLaju({
  nama: 'cek-tiket',
  maks: 40,
  jendelaDetik: 5 * 60,
  pesan: 'Terlalu banyak pemeriksaan tiket. Silakan tunggu beberapa menit.'
});

/** Penjelasan status dengan kata yang dipahami pelapor, bukan istilah sistem */
const PENJELASAN = {
  aktif: {
    label: 'Sedang berlangsung',
    arti: 'Percakapan Anda belum ditutup. Silakan lanjutkan bila kendalanya belum teratasi.'
  },
  selesai: {
    label: 'Selesai',
    arti: 'Kendala Anda dinyatakan teratasi melalui langkah panduan, tanpa perlu engineer.'
  },
  diteruskan: {
    label: 'Diteruskan ke engineer',
    arti: 'Laporan Anda sudah berpindah tangan ke Engineer ICT dan sedang menunggu ditangani.'
  },
  ditinggalkan: {
    label: 'Tidak dilanjutkan',
    arti: 'Percakapan berhenti tanpa penutup. Bila kendalanya masih ada, silakan buat laporan baru.'
  }
};

/**
 * GET /api/tiket/:nomor
 * Keadaan sebuah laporan. Terbuka, tetapi tanpa data pribadi apa pun.
 */
tiketRouter.get('/:nomor', batasCek, (req, res) => {
  const nomor = String(req.params.nomor || '').trim().toUpperCase();

  // Bentuknya diperiksa lebih dulu supaya masukan ngawur tidak pernah sampai
  // ke basis data, dan supaya pesan galatnya dapat lebih menolong.
  if (!/^SGP-\d{8}-\d{4}$/.test(nomor)) {
    return res.status(400).json({
      success: false,
      error: 'Nomor tiket tidak sesuai bentuknya. Contoh yang benar: SGP-20260805-0007'
    });
  }

  const sesi = wajibSiap().prepare(`
    SELECT nomor_tiket, tanggal_wib, divisi_id, status,
           dibuat_pada, diteruskan_pada, ditangani_pada
    FROM sesi WHERE nomor_tiket = ?
  `).get(nomor);

  if (!sesi) {
    return res.status(404).json({
      success: false,
      error: 'Nomor tiket tidak ditemukan. Periksa kembali penulisannya.'
    });
  }

  const penjelasan = PENJELASAN[sesi.status] || { label: sesi.status, arti: '' };

  res.json({
    success: true,
    tiket: {
      nomor: sesi.nomor_tiket,
      tanggal: sesi.tanggal_wib,
      layanan: sesi.divisi_id ? namaDivisi(sesi.divisi_id) : null,
      status: sesi.status,
      statusLabel: penjelasan.label,
      arti: penjelasan.arti,
      dibuatPada: sesi.dibuat_pada,
      diteruskanPada: sesi.diteruskan_pada,
      // Inilah yang paling ingin diketahui pelapor, dan satu-satunya alasan
      // halaman ini ada: kendalanya sudah ditangani atau belum.
      ditanganiPada: sesi.ditangani_pada,
      sudahDitangani: Boolean(sesi.ditangani_pada)
    }
  });
});
