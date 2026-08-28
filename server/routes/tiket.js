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
import { kabarTiket } from '../services/rekapService.js';
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
    arti: 'Laporan Anda sudah berpindah tangan ke Engineer IT dan sedang menunggu ditangani.'
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

  // `dikerjakan_oleh` sengaja TIDAK diambil. Bahwa laporannya sudah dipegang
  // seseorang adalah kabar baik yang berhak diketahui pelapor; siapa orangnya
  // bukan urusan halaman yang terbuka tanpa masuk — dan menyebut namanya
  // berarti nomor tiket yang mudah ditebak menjadi cara memetakan jadwal kerja
  // seluruh engineer.
  const sesi = wajibSiap().prepare(`
    SELECT nomor_tiket, tanggal_wib, divisi_id, status,
           dibuat_pada, diteruskan_pada, mulai_dikerjakan_pada, ditangani_pada
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
      // Tahap antara: laporannya bukan lagi sekadar masuk antrean, sudah ada
      // engineer yang memegangnya. Bagi pelapor inilah beda antara "belum
      // ditangani" yang membuat gelisah dan "sedang dikerjakan" yang membuat
      // tenang — dua keadaan yang sebelumnya terlihat persis sama.
      mulaiDikerjakanPada: sesi.mulai_dikerjakan_pada,
      sedangDikerjakan: Boolean(sesi.mulai_dikerjakan_pada) && !sesi.ditangani_pada,
      // Inilah yang paling ingin diketahui pelapor, dan satu-satunya alasan
      // halaman ini ada: kendalanya sudah ditangani atau belum.
      ditanganiPada: sesi.ditangani_pada,
      sudahDitangani: Boolean(sesi.ditangani_pada),

      // Kabar engineer selama tiket berjalan — inilah yang membedakan
      // perbaikan yang sedang menunggu barang datang dari tiket yang
      // terlupakan. Keduanya tampak sama bila pelapor hanya melihat status.
      //
      // `oleh` SENGAJA DIBUANG, dengan alasan yang sama seperti
      // `dikerjakan_oleh` di atas: halaman ini terbuka dan nomornya dapat
      // ditebak berurutan, sehingga menyebut nama penulisnya berarti
      // menjadikannya cara memetakan siapa mengerjakan apa.
      kabar: kabarTiket(nomor).map(({ isi, dibuat_pada }) => ({ isi, dibuatPada: dibuat_pada }))
    }
  });
});
