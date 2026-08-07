/**
 * Rute daftar tugas engineer.
 *
 * Halaman rekap sudah punya tombol "Tandai Selesai" sejak awal, dan selama
 * dipakai TIDAK PERNAH SEKALI PUN ditekan. Sebabnya bukan tombolnya, melainkan
 * jalan menuju ke sana: engineer harus membuka halaman rekap di ponsel, masuk,
 * lalu mencari satu baris di dalam tabel enam belas kolom — sementara nomor
 * tiketnya sendiri tidak pernah ikut terkirim lewat WhatsApp.
 *
 * Rute ini menyediakan bentuk yang jauh lebih sempit: hanya tiket yang benar-
 * benar menunggu, tanpa saringan, tanpa grafik, tanpa tabel.
 */
import { Router } from 'express';
import { wajibMasuk, catatAkses } from '../services/authService.js';
import {
  daftarTugas, tandaiDitangani, batalkanPenandaan,
  mulaiMengerjakan, lepaskanTugas
} from '../services/rekapService.js';
import { DIVISI_ID, DIVISIONS, namaDivisi } from '../config/divisi.js';

export const tugasRouter = Router();

// Menandai tiket selesai adalah pekerjaan engineer; admin ikut diizinkan
// karena ia pula yang menutup tiket saat engineer berhalangan.
tugasRouter.use(wajibMasuk('admin', 'engineer'));

/**
 * GET /api/tugas
 * Tiket yang menunggu ditangani, terlama di atas.
 *
 * Yang dikirim hanya tiket dari layanan yang memang ditangani akun ini.
 * Penyaringannya dikerjakan basis data, bukan disembunyikan di antarmuka —
 * menyembunyikan baris di sisi peramban bukan pembatasan, hanya penyamaran.
 */
tugasRouter.get('/', (req, res) => {
  const { divisi } = req.query;

  if (divisi && !DIVISI_ID.includes(divisi)) {
    return res.status(400).json({ success: false, error: 'Divisi tidak valid' });
  }

  const diizinkan = req.pengguna.divisi;

  // Saringan yang menunjuk ke luar wewenang tidak perlu diperlakukan sebagai
  // galat — cukup tidak menghasilkan apa-apa, sama seperti saringan lain yang
  // kebetulan kosong.
  if (divisi && diizinkan && !diizinkan.includes(divisi)) {
    return res.status(403).json({
      success: false,
      error: `Akun Anda tidak menangani layanan ${namaDivisi(divisi)}`
    });
  }

  const tugas = daftarTugas(divisi || null, diizinkan);

  res.json({
    success: true,
    jumlah: tugas.length,
    tugas,
    // Pilihan saringan mengikuti wewenang: engineer Printer tidak perlu
    // melihat tombol saringan CCTV yang selalu kosong baginya.
    pilihanDivisi: DIVISIONS
      .filter((d) => !diizinkan || diizinkan.includes(d.id))
      .map((d) => ({ id: d.id, nama: d.name })),
    seluruhDivisi: !diizinkan,
    // Akun engineer yang belum diberi layanan apa pun. Daftarnya kosong bukan
    // karena tidak ada tiket, melainkan karena akunnya belum berwenang atas
    // apa pun — dua keadaan yang sangat berbeda dan tidak boleh terlihat sama.
    tanpaLayanan: Array.isArray(diizinkan) && diizinkan.length === 0,
    sekarang: new Date().toISOString()
  });
});

/**
 * POST /api/tugas/mulai
 * Engineer menyatakan tiket ini sedang ia kerjakan.
 *
 * `ambilAlih` wajib disertakan bila tiketnya sudah dipegang orang lain.
 * Tanpa itu permintaan dijawab 409 beserta nama pemegangnya, sehingga
 * antarmuka dapat menanyakannya lebih dulu alih-alih memindahkan tiket
 * seseorang diam-diam.
 */
tugasRouter.post('/mulai', (req, res) => {
  const { nomorTiket, ambilAlih } = req.body || {};

  if (!nomorTiket) {
    return res.status(400).json({ success: false, error: 'nomorTiket wajib diisi' });
  }

  const hasil = mulaiMengerjakan(nomorTiket, req.pengguna.akun, {
    divisiDiizinkan: req.pengguna.divisi,
    ambilAlih: ambilAlih === true
  });

  if (!hasil.ok) {
    return res.status(hasil.status || 400).json({
      success: false,
      error: hasil.alasan,
      // Antarmuka memerlukannya untuk menyusun pertanyaan pengambilalihan
      pemegang: hasil.pemegangNama || null
    });
  }

  catatAkses(
    req.pengguna.akun,
    hasil.diambilAlihDari ? 'ambil-alih' : 'mulai-kerjakan',
    hasil.diambilAlihDari ? `${nomorTiket} (dari ${hasil.diambilAlihDari})` : nomorTiket
  );

  res.json({
    success: true,
    message: hasil.diambilAlihDari
      ? `Tiket ${nomorTiket} diambil alih dari ${hasil.diambilAlihDariNama}`
      : `Tiket ${nomorTiket} ditandai sedang Anda kerjakan`,
    mulaiPada: hasil.mulaiPada
  });
});

/**
 * POST /api/tugas/lepas
 * Kembalikan tiket ke antrean tanpa menandainya selesai.
 *
 * Kesediaan menandai bergantung pada adanya jalan mundur: engineer yang tahu
 * satu ketukan keliru mengunci tiket atas namanya sampai ada admin yang
 * membetulkan, akan memilih tidak menandai sama sekali.
 */
tugasRouter.post('/lepas', (req, res) => {
  const nomorTiket = String(req.body?.nomorTiket || '').trim();

  if (!nomorTiket) {
    return res.status(400).json({ success: false, error: 'nomorTiket wajib diisi' });
  }

  const hasil = lepaskanTugas(nomorTiket, req.pengguna.akun, {
    divisiDiizinkan: req.pengguna.divisi,
    // Admin dapat melepaskan tiket engineer yang berhalangan. Tanpa itu, satu
    // orang yang cuti berarti tiketnya terkunci sampai ia kembali.
    paksa: req.pengguna.peran === 'admin'
  });

  if (!hasil.ok) {
    return res.status(hasil.status || 400).json({ success: false, error: hasil.alasan });
  }

  catatAkses(req.pengguna.akun, 'lepas-tugas', `${nomorTiket} (sebelumnya ${hasil.sebelumnya})`);

  res.json({ success: true, message: `Tiket ${nomorTiket} kembali ke daftar tugas` });
});

/**
 * POST /api/tugas/selesai
 * Tandai satu tiket sudah ditangani.
 *
 * `selesaiPada` boleh dikosongkan — artinya sekarang. Diisi bila engineer baru
 * sempat membuka halaman ini beberapa jam setelah kendalanya benar-benar beres.
 */
tugasRouter.post('/selesai', (req, res) => {
  const { nomorTiket, catatan, selesaiPada } = req.body || {};

  if (!nomorTiket) {
    return res.status(400).json({ success: false, error: 'nomorTiket wajib diisi' });
  }

  const hasil = tandaiDitangani(nomorTiket, req.pengguna.akun, {
    catatan: (catatan || '').trim() || null,
    selesaiPada: selesaiPada || null,
    divisiDiizinkan: req.pengguna.divisi,
    // Admin memang bertugas menutup tiket saat engineernya berhalangan,
    // sehingga tidak perlu mengambil alih lebih dulu.
    abaikanPemegang: req.pengguna.peran === 'admin'
  });

  if (!hasil.ok) {
    return res.status(hasil.status || 400).json({
      success: false,
      error: hasil.alasan,
      pemegang: hasil.pemegangNama || null
    });
  }

  catatAkses(req.pengguna.akun, 'tandai-selesai', nomorTiket);

  res.json({
    success: true,
    message: `Tiket ${nomorTiket} ditandai selesai`,
    ditanganiPada: hasil.ditanganiPada
  });
});

/**
 * POST /api/tugas/batal
 * Batalkan penandaan selesai sebuah tiket. Khusus admin.
 *
 * Salah tekan pada layar ponsel bukan kejadian langka, dan tanpa jalan kembali
 * satu ketukan keliru merusak `waktu_tanggap` untuk selamanya. Dibatasi pada
 * admin: membiarkan engineer membatalkan penandaan engineer lain berarti
 * membuka kembali celah yang baru saja ditutup.
 */
tugasRouter.post('/batal', wajibMasuk('admin'), (req, res) => {
  const nomorTiket = String(req.body?.nomorTiket || '').trim();

  if (!nomorTiket) {
    return res.status(400).json({ success: false, error: 'nomorTiket wajib diisi' });
  }

  const hasil = batalkanPenandaan(nomorTiket);
  if (!hasil.ok) {
    return res.status(400).json({ success: false, error: hasil.alasan });
  }

  // Penandaan DAN pembatalannya sama-sama tercatat. Yang dihapus hanya kolom
  // pada laporan, bukan riwayat siapa melakukan apa.
  catatAkses(req.pengguna.akun, 'batal-tandai-selesai', `${nomorTiket} (sebelumnya ${hasil.sebelumnya})`);

  res.json({
    success: true,
    message: `Penandaan tiket ${nomorTiket} dibatalkan — tiket kembali ke daftar tugas`
  });
});
