/**
 * Tolok ukur akurasi pencocokan keluhan.
 *
 * Menjalankan sekumpulan keluhan yang ditulis menyerupai bahasa pekerja
 * sehari-hari — termasuk singkatan, salah ketik, dan istilah tidak baku —
 * lalu memeriksa apakah masalah yang dikenali sesuai harapan.
 *
 * BATASAN YANG PERLU DISADARI: daftar ini disusun oleh pengembang, bukan
 * dikumpulkan dari laporan nyata. Karena itu ia mengukur **kestabilan**
 * pencocokan, bukan kebenarannya di lapangan. Nilainya baru menjadi ukuran
 * sesungguhnya setelah diganti dengan keluhan asli dari kolom `keluhan` pada
 * halaman rekap — dan itu memang cara berkas ini dimaksudkan berkembang.
 *
 * Kegunaan utamanya sekarang: menjaga agar penambahan atau penyuntingan SOP
 * tidak diam-diam merusak pencocokan yang sebelumnya sudah benar.
 *
 * Setengah bagian yang tidak kalah penting adalah kelompok "harus TIDAK
 * dikenali". Bagi layanan pengaduan, mengaku tidak tahu jauh lebih baik
 * daripada memberi langkah perbaikan untuk masalah yang keliru.
 */
import { bagian, cek, catatan, selesai } from './bantu.mjs';
import { cariMasalah, kandidatTeratas, pilihDivisiOtomatis } from '../server/services/answerService.js';

/** [keluhan, divisi, potongan judul masalah yang diharapkan] */
const HARUS_COCOK = [
  // ── Printer ──────────────────────────────────────────────────
  ['printernya offline terus', 'printer', 'Offline'],
  ['printer gak kedeteksi di laptop', 'printer', 'Offline'],
  ['kertas nyangkut di printer', 'printer', 'Kertas Macet'],
  ['printer macet kertasnya', 'printer', 'Kertas Macet'],
  ['kertas jam di dalam printer', 'printer', 'Kertas Macet'],
  ['udah klik print tapi ga keluar keluar', 'printer', 'Antrian'],
  ['dokumen numpuk di antrian cetak', 'printer', 'Antrian'],
  ['hasil ngeprint bergaris', 'printer', 'Bergaris'],
  ['cetakan buram gak jelas', 'printer', 'Bergaris'],
  ['hasil cetak ada noda hitam', 'printer', 'Kotor'],
  ['kertas hasil print kotor kena tinta', 'printer', 'Kotor'],

  // ── Windows ──────────────────────────────────────────────────
  ['gabisa login ke komputer', 'windows', 'Login'],
  ['password komputer saya ditolak terus', 'windows', 'Login'],
  ['laptop lemot banget', 'windows', 'Lambat'],
  ['komputer lambat sekali bukanya', 'windows', 'Lambat'],
  ['penyimpanan komputer penuh', 'windows', 'Penuh'],
  ['muncul peringatan low disk space', 'windows', 'Penuh'],
  ['aplikasi not responding terus', 'windows', 'Membeku'],
  ['excel saya nge-freeze', 'windows', 'Membeku'],
  ['gabisa ngeprint ke printer jaringan', 'windows', 'Printer Jaringan'],
  ['layar biru muncul lalu restart sendiri', 'windows', 'Layar Biru']
];

/** Keluhan di luar cakupan SOP — sistem harus mengaku tidak mengenalinya */
const HARUS_TIDAK_COCOK = [
  ['printer saya warnanya ungu', 'printer'],
  ['mau pesan printer baru untuk ruangan', 'printer'],
  ['tolong ajarkan cara pakai excel', 'windows'],
  ['kursi kantor saya rusak', 'windows'],
  ['minta tambah jatah kuota internet', 'windows']
];

/* ──────────────────────────────────────────────────────────── */

bagian('1. Keluhan yang harus dikenali');

const meleset = [];
for (const [keluhan, divisi, diharapkan] of HARUS_COCOK) {
  const hasil = cariMasalah(keluhan, divisi);
  const judul = hasil?.masalah?.judul || null;
  const benar = Boolean(judul && judul.toLowerCase().includes(diharapkan.toLowerCase()));
  if (!benar) {
    const teratas = kandidatTeratas(keluhan, divisi);
    meleset.push({
      keluhan,
      diharapkan,
      diperoleh: judul || '(tidak dikenali)',
      skor: teratas ? teratas.skor.toFixed(2) : '0.00'
    });
  }
}

const totalCocok = HARUS_COCOK.length;
const tepat = totalCocok - meleset.length;
const persen = Math.round((tepat / totalCocok) * 100);

catatan(`${tepat} dari ${totalCocok} keluhan dikenali dengan benar (${persen}%)`);
for (const m of meleset) {
  catatan(`meleset: "${m.keluhan}" → ${m.diperoleh} (skor ${m.skor}), diharapkan memuat "${m.diharapkan}"`);
}

// Ambang, bukan pemeriksaan satu per satu. Menuntut 100% berarti memaksa
// keluhan disesuaikan dengan sistemnya — kebalikan dari yang seharusnya.
const AMBANG_PERSEN = 85;
cek(`akurasi pencocokan minimal ${AMBANG_PERSEN}%`, persen >= AMBANG_PERSEN, `${persen}%`);

bagian('2. Keluhan di luar cakupan harus ditolak');

const salahTerima = [];
for (const [keluhan, divisi] of HARUS_TIDAK_COCOK) {
  const hasil = cariMasalah(keluhan, divisi);
  if (hasil) salahTerima.push(`"${keluhan}" → ${hasil.masalah.judul} (skor ${hasil.skor.toFixed(2)})`);
}

cek('tidak ada keluhan di luar cakupan yang dijawab keliru',
  salahTerima.length === 0, salahTerima);
catatan('menjawab "belum dikenali" lebih baik daripada memberi langkah yang keliru');

bagian('3. Penentuan layanan otomatis');
catatan('dipakai saat pelapor memilih "Saya tidak yakin"');

/** [keluhan, divisi yang diharapkan] */
const DIVISI_OTOMATIS = [
  ['kertas nyangkut di printer ruang admin', 'printer'],
  ['laptop saya lemot banget', 'windows'],
  ['layar biru muncul lalu restart sendiri', 'windows'],
  ['gabisa ngeprint ke printer jaringan', 'windows'],
  ['kamera gudang tidak tampil di monitor', 'cctv'],
  ['telepon saya tidak ada nada', 'telepon']
];

const salahArah = [];
for (const [keluhan, diharapkan] of DIVISI_OTOMATIS) {
  const h = pilihDivisiOtomatis(keluhan);
  if (h.hasil !== 'pasti' || h.divisi !== diharapkan) {
    salahArah.push(`"${keluhan}" → ${h.hasil}${h.divisi ? ' ' + h.divisi : ''}, diharapkan ${diharapkan}`);
  }
}
cek('keluhan jelas diarahkan ke layanan yang benar', salahArah.length === 0, salahArah);

/* Keluhan di luar urusan ICT TIDAK BOLEH ditawari layanan mana pun.
   Mengambil skor tertinggi dari delapan divisi menaikkan nilai puncak secara
   semu, sehingga "kursi kantor saya rusak" pernah mencapai 0,391 — nyaris
   menembus ambang. Salah arah di sini berarti laporan sampai ke WhatsApp
   engineer yang keliru. */
const DILUAR_CAKUPAN = [
  'kursi kantor saya rusak',
  'minta tambah kuota internet',
  'tolong ajarkan cara pakai excel',
  'kapan gajian bulan ini'
];

const salahTerimaDivisi = [];
for (const keluhan of DILUAR_CAKUPAN) {
  const h = pilihDivisiOtomatis(keluhan);
  if (h.hasil !== 'tidak-dikenali') {
    salahTerimaDivisi.push(`"${keluhan}" → ${h.hasil} ${h.divisi || h.pilihan.map((p) => p.divisi).join('/')}`);
  }
}
cek('keluhan di luar cakupan tidak diarahkan ke layanan mana pun',
  salahTerimaDivisi.length === 0, salahTerimaDivisi);

cek('keluhan kosong tidak menghasilkan tebakan',
  pilihDivisiOtomatis('').hasil === 'tidak-dikenali', pilihDivisiOtomatis('').hasil);

bagian('4. Keterangan tambahan tidak boleh merusak pencocokan');

/* Pelapor menyebut tempat, waktu, dan kata sopan. Skornya adalah rasio, dan
   dulu SETIAP kata menambah penyebutnya — sehingga keluhan yang sama persis
   merosot hanya karena diterangkan lebih lengkap:

     kertas nyangkut di printer                            1,000
     kertas nyangkut di printer ruang admin                0,502
     kertas nyangkut di printer ruang admin lantai 2       0,402
     + gedung utama pagi tadi                              0,217  → tidak dijawab

   Terjadi sungguhan: keluhan "kertas nyangkut di printer ruang admin" pada
   basis data berskor 0,346 dan diteruskan ke engineer, padahal SOP-nya ada.

   Sistem pengaduan yang menghukum orang karena menerangkan keadaannya
   mengajarkan mereka menulis sesingkat mungkin — kebalikan dari yang
   dibutuhkan engineer ketika laporannya akhirnya sampai. */

const BERKETERANGAN = [
  ['kertas nyangkut di printer ruang admin', 'printer', 'Kertas Macet'],
  ['kertas nyangkut di printer ruang admin lantai 2', 'printer', 'Kertas Macet'],
  ['kertas nyangkut di printer ruang admin lantai 2 gedung utama pagi tadi', 'printer', 'Kertas Macet'],
  ['mohon bantuannya pak printer di ruangan saya kertasnya macet terus dari kemarin', 'printer', 'Kertas Macet'],
  ['laptop saya lemot sekali sejak kemarin sore di ruangan produksi lantai dua', 'windows', 'Lambat']
];

const rusakOlehKeterangan = [];
for (const [keluhan, divisi, diharapkan] of BERKETERANGAN) {
  const hasil = cariMasalah(keluhan, divisi);
  if (!hasil || !hasil.masalah.judul.includes(diharapkan)) {
    rusakOlehKeterangan.push(`"${keluhan}" → ${hasil ? hasil.masalah.judul : 'tidak dikenali'}`);
  }
}
cek('keterangan tempat dan waktu tidak menjatuhkan skor di bawah ambang',
  rusakOlehKeterangan.length === 0, rusakOlehKeterangan);
catatan('seluruh kata asing dihitung sekali, bukan satu per satu — lihat BATAS_KATA_ASING');

/* Sisi sebaliknya, dan ia yang membuat perbaikan di atas tidak berubah menjadi
   kebocoran: melonggarkan penyebut membuat keluhan yang menyentuh SATU kata
   umum ikut naik. "kursi kantor saya rusak" menyentuh "rusak" pada empat judul
   masalah sekaligus di empat divisi berbeda. */
cek('satu kata yang kebetulan cocok tetap tidak cukup',
  cariMasalah('kursi kantor saya rusak', 'printer') === null, 'malah dijawab');
cek('keluhan berisi satu kata umum tidak dijawab yakin',
  cariMasalah('printer', 'printer') === null, 'malah dijawab');
catatan('sebelumnya keluhan "printer" saja berskor 1,000 — rasio sempurna dari satu kata');

// Pengecualian yang disengaja: bila hanya itu yang ditulis, kata itulah
// seluruh keterangan yang ada.
const pendek = cariMasalah('bluescreen', 'windows');
cek('keluhan satu kata yang khas tetap dikenali', pendek !== null, 'ditolak juga');

bagian('5. Ketahanan terhadap masukan aneh');
cek('teks kosong tidak dicocokkan', cariMasalah('', 'printer') === null, 'ada hasil');
cek('spasi saja tidak dicocokkan', cariMasalah('     ', 'printer') === null, 'ada hasil');
cek('tanda baca saja tidak dicocokkan', cariMasalah('???!!!', 'printer') === null, 'ada hasil');
cek('divisi tak dikenal tidak menghasilkan apa pun',
  cariMasalah('kertas nyangkut', 'divisi-entah') === null, 'ada hasil');

selesai('akurasi');
