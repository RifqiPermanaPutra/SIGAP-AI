/**
 * Rute laporan rekap.
 *
 * Seluruh rute di berkas ini wajib melalui autentikasi — isinya memuat nama
 * pegawai asli. Unduhan dibatasi pada peran admin, dan setiap pembukaan
 * maupun pengunduhan dicatat pada jejak akses.
 */
import { Router } from 'express';
import {
  cariLaporan, jumlahLaporan, ringkasan, deretWaktu, sebaran,
  keluhanTakDikenali, nilaiUnik, tandaiDitangani, keefektifanSolusi
} from '../services/rekapService.js';
import {
  wajibMasuk, catatAkses, daftarAkses, daftarPengguna, divisiAkun
} from '../services/authService.js';
import { buatXlsx } from '../services/xlsxUtil.js';
import { DIVISIONS } from '../config/divisi.js';

export const rekapRouter = Router();

/* ────────────────────────────────────────────────────────────────
   Penyaji nilai
   ──────────────────────────────────────────────────────────────── */

/**
 * Peta akun → nama, dan layanan → penanggung jawabnya.
 *
 * Disusun di sini, bukan lewat JOIN pada kueri laporan: tabel `sesi` dan
 * `pengguna` sama-sama memiliki kolom `nama`, sehingga menyambungkan keduanya
 * membuat penyaring pencarian menjadi ambigu. Akunnya hanya enam dan sudah
 * berada di memori, jadi menerjemahkannya di sini jauh lebih murah daripada
 * merumitkan kueri yang dipakai bersama.
 */
function petaEngineer() {
  const akun = daftarPengguna();

  const nama = {};
  const perDivisi = {};

  for (const p of akun) {
    nama[p.nama_akun] = p.nama;
    if (p.peran !== 'engineer') continue;

    for (const d of divisiAkun(p) || DIVISIONS.map((x) => x.id)) {
      (perDivisi[d] ||= []).push({ akun: p.nama_akun, nama: p.nama });
    }
  }

  return { nama, perDivisi };
}

const WIB_MS = 7 * 60 * 60 * 1000;

/** Jam WIB dari timestamp UTC, contoh '08.14' */
function jamWIB(iso) {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + WIB_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}.${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** Tanggal Indonesia dari 'YYYY-MM-DD' menjadi 'DD/MM/YYYY' */
function tanggalID(tanggal) {
  if (!tanggal) return '';
  const [t, b, h] = tanggal.split('-');
  return `${h}/${b}/${t}`;
}

/** Durasi detik menjadi bentuk terbaca, contoh '9 mnt' atau '1j 20m' */
function durasi(detik) {
  if (detik === null || detik === undefined || detik < 0) return '';
  if (detik < 60) return `${detik} dtk`;
  const menit = Math.round(detik / 60);
  if (menit < 60) return `${menit} mnt`;
  return `${Math.floor(menit / 60)}j ${menit % 60}m`;
}

const LABEL_STATUS = {
  aktif: 'Aktif',
  selesai: 'Selesai',
  diteruskan: 'Diteruskan',
  ditinggalkan: 'Ditinggalkan'
};

/** Ambil saringan dari query string */
function saringan(req) {
  const { dari, sampai, divisi, status, area, urgensi, fungsi, cari } = req.query;
  return { dari, sampai, divisi, status, area, urgensi, fungsi, cari };
}

/* ────────────────────────────────────────────────────────────────
   Rute
   ──────────────────────────────────────────────────────────────── */

/**
 * GET /api/rekap
 * Data lengkap satu halaman rekap: ringkasan, grafik, sebaran, dan tabel.
 */
rekapRouter.get('/', wajibMasuk(), (req, res) => {
  try {
    const f = saringan(req);
    const satuan = ['hari', 'minggu', 'bulan'].includes(req.query.satuan) ? req.query.satuan : 'hari';

    catatAkses(req.pengguna.akun, 'lihat', `${f.dari || '—'} s/d ${f.sampai || '—'}`);

    res.json({
      success: true,
      ringkasan: ringkasan(f),
      deret: deretWaktu(f, satuan),
      satuan,
      sebaranDivisi: sebaran(f, 'divisi_id'),
      sebaranUrgensi: sebaran(f, 'urgensi'),
      sebaranArea: sebaran(f, 'area'),
      sebaranFungsi: sebaran(f, 'fungsi'),
      takDikenali: keluhanTakDikenali(f, 30),
      keefektifan: keefektifanSolusi(f),
      laporan: cariLaporan(f, 500),
      jumlah: jumlahLaporan(f),
      // Siapa yang menangani apa. Dipakai halaman rekap untuk dua hal:
      // menerjemahkan nama akun penanda menjadi nama lengkap, dan menyebutkan
      // penanggung jawab pada tiket yang masih menunggu — supaya "siapa yang
      // harus ditagih" tidak perlu diingat sendiri oleh admin.
      engineer: petaEngineer(),
      pilihan: {
        divisi: DIVISIONS.map(({ id, name }) => ({ id, name })),
        area: nilaiUnik('area'),
        urgensi: ['Rendah', 'Sedang', 'Tinggi', 'Kritis'],
        fungsi: nilaiUnik('fungsi')
      }
    });
  } catch (error) {
    console.error('Error rekap:', error);
    res.status(500).json({ success: false, error: 'Gagal menyusun rekap' });
  }
});

/** Judul dan lebar kolom berkas Excel — urutannya mengikuti RANCANGAN-DATA.md §9a */
const KOLOM_EXCEL = [
  ['Nomor Tiket', 18], ['Tanggal', 12], ['Jam Mulai', 10], ['Jam Berakhir', 12],
  ['Durasi', 10], ['Divisi', 16], ['Keluhan', 46], ['Masalah Terdeteksi', 30],
  ['Nama Pelapor', 22], ['Fungsi', 18], ['Lokasi', 22], ['Area', 10],
  ['Urgensi', 10], ['Engineer', 18], ['Waktu Tanggap', 14], ['Status', 14]
];

/**
 * GET /api/rekap/excel
 * Unduh data rinci sebagai .xlsx. Terbatas untuk admin.
 */
rekapRouter.get('/excel', wajibMasuk('admin'), (req, res) => {
  try {
    const f = saringan(req);

    // Tanpa batas baris: berkas ekspor harus memuat seluruh periode terpilih,
    // bukan hanya 500 baris pertama seperti tampilan tabel.
    const baris = cariLaporan(f, 0).map((r) => [
      r.nomor_tiket,
      tanggalID(r.tanggal_wib),
      jamWIB(r.dibuat_pada),
      jamWIB(r.berakhir_pada),
      durasi(r.durasi_detik),
      r.divisi_nama,
      r.keluhan,
      r.masalah_cocok,
      r.nama,
      r.fungsi,
      r.lokasi,
      r.area,
      r.urgensi,
      r.engineer_tujuan,
      durasi(r.waktu_tanggap),
      LABEL_STATUS[r.status] || r.status
    ]);

    const berkas = buatXlsx({
      judul: KOLOM_EXCEL.map(([j]) => j),
      lebar: KOLOM_EXCEL.map(([, w]) => w),
      baris,
      namaLembar: 'Rekap SIGAP'
    });

    catatAkses(req.pengguna.akun, 'unduh-excel', `${baris.length} baris`);

    const namaBerkas = `rekap-sigap-${f.dari || 'awal'}-sd-${f.sampai || 'kini'}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${namaBerkas}"`);
    res.send(berkas);
  } catch (error) {
    console.error('Error ekspor Excel:', error);
    res.status(500).json({ success: false, error: 'Gagal menyusun berkas Excel' });
  }
});

/**
 * POST /api/rekap/tandai-selesai
 * Engineer menandai sebuah tiket sudah ditangani (Lapis 4).
 */
rekapRouter.post('/tandai-selesai', wajibMasuk('admin', 'engineer'), (req, res) => {
  try {
    const nomorTiket = String(req.body?.nomorTiket || '').trim();
    const catatan = String(req.body?.catatan || '').trim() || null;

    if (!nomorTiket) {
      return res.status(400).json({ success: false, error: 'Nomor tiket wajib diisi' });
    }

    // `selesaiPada` boleh dikosongkan — artinya sekarang, sama seperti sebelumnya.
    // Batas wewenang per divisi diberlakukan sama seperti pada halaman tugas;
    // bila hanya salah satunya dijaga, yang lain menjadi pintu belakang.
    const hasil = tandaiDitangani(nomorTiket, req.pengguna.akun, {
      catatan,
      selesaiPada: req.body?.selesaiPada || null,
      divisiDiizinkan: req.pengguna.divisi
    });
    if (!hasil.ok) return res.status(hasil.status || 400).json({ success: false, error: hasil.alasan });

    catatAkses(req.pengguna.akun, 'tandai-selesai', nomorTiket);
    res.json({ success: true, ditanganiPada: hasil.ditanganiPada });
  } catch (error) {
    console.error('Error tandai selesai:', error);
    res.status(500).json({ success: false, error: 'Gagal menandai tiket' });
  }
});

/** POST /api/rekap/catat-cetak — dipanggil sebelum jendela cetak PDF dibuka */
rekapRouter.post('/catat-cetak', wajibMasuk(), (req, res) => {
  catatAkses(req.pengguna.akun, 'cetak', String(req.body?.periode || ''));
  res.json({ success: true });
});

/** GET /api/rekap/akses — jejak akses, hanya admin */
rekapRouter.get('/akses', wajibMasuk('admin'), (req, res) => {
  res.json({ success: true, akses: daftarAkses(200) });
});
