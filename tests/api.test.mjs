/**
 * Uji ujung-ke-ujung lewat HTTP: autentikasi, wewenang peran, rekap,
 * ekspor Excel, penandaan selesai, dan kedua mode divisi.
 *
 * Menuntut server sudah berjalan dengan basis data contoh. Dijalankan oleh
 * `tests/jalankan.mjs`, bukan langsung.
 */
import { bagian, cek, catatan, selesai } from './bantu.mjs';
import { AKUN_UJI, TIKET_CACAT } from './benih.mjs';

const PORT = process.env.UJI_PORT || 3999;
const API = `http://localhost:${PORT}/api`;

async function masuk({ namaAkun, sandi }) {
  const r = await fetch(`${API}/auth/masuk`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ namaAkun, sandi })
  });
  return { data: await r.json(), kuki: r.headers.get('set-cookie')?.split(';')[0] || '' };
}

const ambil = (jalur, kuki, opsi = {}) =>
  fetch(API + jalur, { ...opsi, headers: { ...(opsi.headers || {}), Cookie: kuki } });

const json = (jalur, kuki) => ambil(jalur, kuki).then((r) => r.json());

const post = (jalur, badan) => fetch(API + jalur, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(badan)
}).then((r) => r.json());

/* ──────────────────────────────────────────────────────────── */

bagian('1. Autentikasi');
cek('tanpa kuki ditolak', (await fetch(`${API}/rekap`)).status === 401, 'tidak 401');

const salah = await masuk({ namaAkun: 'admin', sandi: 'sandisalah' });
cek('kata sandi salah ditolak', salah.data.success === false, salah.data);
cek('pesan galat tidak membocorkan akun mana yang ada',
  /nama akun atau kata sandi salah/i.test(salah.data.error), salah.data.error);

const adm = await masuk(AKUN_UJI.admin);
const eng = await masuk(AKUN_UJI.engineer);
cek('admin berhasil masuk', adm.data.success && adm.data.pengguna.peran === 'admin', adm.data);
cek('engineer berhasil masuk', eng.data.success && eng.data.pengguna.peran === 'engineer', eng.data);
cek('kuki sesi terpasang', adm.kuki.startsWith('sigap_sesi='), adm.kuki);

bagian('2. Wewenang peran');
cek('engineer TIDAK boleh mengunduh Excel', (await ambil('/rekap/excel', eng.kuki)).status === 403, 'bukan 403');
cek('admin boleh mengunduh Excel', (await ambil('/rekap/excel', adm.kuki)).status === 200, 'bukan 200');
cek('engineer boleh melihat rekap', (await ambil('/rekap', eng.kuki)).status === 200, 'bukan 200');
cek('engineer TIDAK boleh melihat jejak akses', (await ambil('/rekap/akses', eng.kuki)).status === 403, 'bukan 403');

bagian('3. Berkas Excel');
const xl = await ambil('/rekap/excel?dari=2020-01-01', adm.kuki);
const buf = Buffer.from(await xl.arrayBuffer());
cek('tipe konten xlsx', /spreadsheetml\.sheet/.test(xl.headers.get('content-type')), xl.headers.get('content-type'));
cek('dikirim sebagai unduhan', /attachment; filename=/.test(xl.headers.get('content-disposition')), xl.headers.get('content-disposition'));
cek('tanda arsip ZIP benar', buf.subarray(0, 4).toString('hex') === '504b0304', buf.subarray(0, 4).toString('hex'));
cek('berisi lebih dari sekadar kerangka', buf.length > 3000, buf.length);
catatan(`${buf.length} bita`);

bagian('4. Saringan rekap');
const semua = await json('/rekap?dari=2020-01-01', adm.kuki);
const cctv = await json('/rekap?dari=2020-01-01&divisi=cctv', adm.kuki);
cek('saringan divisi mengecilkan hasil', cctv.jumlah > 0 && cctv.jumlah < semua.jumlah, [cctv.jumlah, semua.jumlah]);
cek('seluruh hasil sesuai divisi', cctv.laporan.every((l) => l.divisi_id === 'cctv'), cctv.laporan[0]?.divisi_id);

const sel = await json('/rekap?dari=2020-01-01&status=selesai', adm.kuki);
cek('saringan status bekerja', sel.laporan.length > 0 && sel.laporan.every((l) => l.status === 'selesai'), sel.laporan[0]?.status);

const cari = await json('/rekap?dari=2020-01-01&cari=nyangkut', adm.kuki);
cek('pencarian teks bekerja', cari.jumlah > 0 && cari.laporan.every((l) => /nyangkut/i.test(l.keluhan)), cari.jumlah);

const bulan = await json('/rekap?dari=2020-01-01&satuan=bulan', adm.kuki);
cek('kelompok harian berbentuk YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(semua.deret[0]?.periode), semua.deret[0]?.periode);
cek('kelompok bulanan berbentuk YYYY-MM', /^\d{4}-\d{2}$/.test(bulan.deret[0]?.periode), bulan.deret[0]?.periode);
cek('ringkasan menghitung persen mandiri', semua.ringkasan.persen_mandiri >= 0 && semua.ringkasan.persen_mandiri <= 100, semua.ringkasan.persen_mandiri);
cek('keluhan tak dikenali terkumpul', semua.takDikenali.length > 0, semua.takDikenali.length);

bagian('5. Penandaan selesai oleh engineer');
const kandidat = semua.laporan.find((l) => l.status === 'diteruskan' && !l.ditangani_pada);
const kirimTandai = (nomorTiket, catatanIsi) => ambil('/rekap/tandai-selesai', eng.kuki, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ nomorTiket, catatan: catatanIsi })
}).then((r) => r.json());

cek('engineer dapat menandai tiket', (await kirimTandai(kandidat.nomor_tiket, 'Kabel diganti.')).success === true, 'gagal');
cek('tiket yang sama tidak bisa ditandai dua kali', (await kirimTandai(kandidat.nomor_tiket)).success === false, 'bisa dua kali');

const tiketSelesai = semua.laporan.find((l) => l.status === 'selesai');
cek('tiket non-diteruskan ditolak', (await kirimTandai(tiketSelesai.nomor_tiket)).success === false, 'diterima');

const sesudah = await json('/rekap?dari=2020-01-01', adm.kuki);
const ditandai = sesudah.laporan.find((l) => l.nomor_tiket === kandidat.nomor_tiket);
cek('waktu tanggap terhitung positif', ditandai.waktu_tanggap > 0, ditandai.waktu_tanggap);
cek('penanda tercatat', ditandai.ditangani_oleh === AKUN_UJI.engineer.namaAkun, ditandai.ditangani_oleh);

const cacat = sesudah.laporan.find((l) => l.nomor_tiket === TIKET_CACAT);
cek('baris cacat tersedia untuk diuji', Boolean(cacat), 'tidak ada');
cek('selisih waktu mustahil dikosongkan, bukan negatif', cacat?.waktu_tanggap === null, cacat?.waktu_tanggap);
catatan('durasi "-3j 43m" pada laporan resmi terbaca sebagai kesalahan sistem');

bagian('6. Jejak akses');
const akses = await json('/rekap/akses', adm.kuki);
const tindakan = new Set(akses.akses.map((a) => a.tindakan));
cek('kegiatan masuk tercatat', tindakan.has('masuk'), [...tindakan]);
cek('pengunduhan tercatat', tindakan.has('unduh-excel'), [...tindakan]);
cek('penandaan tercatat', tindakan.has('tandai-selesai'), [...tindakan]);

bagian('6b. Daftar layanan cadangan tidak boleh menyimpang');
// Daftar di src/data/divisiCadangan.js adalah salinan, dipakai saat /api/config
// tidak terjawab. Salinan yang menyimpang baru ketahuan justru ketika server
// sedang bermasalah — saat pengguna paling tidak punya cara lain.
const { DIVISI_CADANGAN } = await import('../src/data/divisiCadangan.js');
const cfg = await fetch(`${API}/config`).then((r) => r.json());
const ringkas = (d) => `${d.id}|${d.name}|${d.mode}`;
cek('id, nama, dan mode layanan cadangan sama dengan server',
  DIVISI_CADANGAN.map(ringkas).join(' · ') === cfg.divisions.map(ringkas).join(' · '),
  { cadangan: DIVISI_CADANGAN.map((d) => d.id), server: cfg.divisions.map((d) => d.id) });

bagian('7. Percakapan — divisi mode engineer');
const sesiA = await post('/chat/new', {});
cek('sesi baru membawa nomor tiket', /^SGP-\d{8}-\d{4}$/.test(sesiA.nomorTiket), sesiA.nomorTiket);

const divCctv = await post('/chat/division', { sessionId: sesiA.sessionId, division: 'cctv' });
cek('mode engineer dilaporkan', divCctv.mode === 'engineer', divCctv.mode);
cek('kalimat pembuka meluruskan harapan',
  /penanganan langsung|pemeriksaan langsung/i.test(divCctv.message), divCctv.message?.slice(0, 120));

const jwbA = await post('/chat', { sessionId: sesiA.sessionId, message: 'kamera gudang mati total' });
cek('langsung dieskalasi', jwbA.shouldEscalate === true, jwbA.shouldEscalate);
cek('tidak menawarkan langkah SOP', !/^\s*1\./m.test(jwbA.response), jwbA.response?.slice(0, 120));
cek('nomor tiket disebutkan ke pengguna', /SGP-\d{8}-\d{4}/.test(jwbA.response), jwbA.response?.slice(0, 160));

bagian('8. Percakapan — divisi swalayan');
const sesiB = await post('/chat/new', {});
const divPrn = await post('/chat/division', { sessionId: sesiB.sessionId, division: 'printer' });
cek('mode swalayan dilaporkan', divPrn.mode === 'swalayan', divPrn.mode);

const j1 = await post('/chat', { sessionId: sesiB.sessionId, message: 'kertas nyangkut di printer' });
cek('memberi langkah penyelesaian', /^\s*1\./m.test(j1.response), j1.response?.slice(0, 100));
cek('belum dieskalasi', j1.shouldEscalate === false, j1.shouldEscalate);

const j2 = await post('/chat', { sessionId: sesiB.sessionId, message: 'belum berhasil' });
cek('"belum berhasil" memberi solusi berikutnya', j2.response !== j1.response, 'jawaban sama');
cek('"belum berhasil" TIDAK dianggap selesai', j2.isResolved !== true, j2.isResolved);
catatan('kalimat "belum berhasil" memuat kata "berhasil" — urutan pemeriksaan tidak boleh dibalik');

// Antarmuka menjanjikan tiga percobaan sebelum menyerah ke engineer. Janji itu
// hanya dapat ditepati bila datanya memang memuat tiga solusi — pernah tidak,
// sehingga sistem menyerah setelah percobaan pertama.
const j3 = await post('/chat', { sessionId: sesiB.sessionId, message: 'masih belum bisa' });
cek('solusi ketiga tersedia', j3.response !== j2.response && j3.response !== j1.response, 'jawaban berulang');
cek('belum menyerah pada percobaan kedua', j3.shouldEscalate === false, j3.shouldEscalate);
cek('ketiga jawaban memuat langkah bernomor',
  [j1, j2, j3].every((j) => /^\s*1\./m.test(j.response) && /^\s*2\./m.test(j.response)), 'ada yang tanpa langkah');

const j4 = await post('/chat', { sessionId: sesiB.sessionId, message: 'tetap tidak bisa' });
cek('menyerah setelah tiga solusi habis', j4.shouldEscalate === true, j4.shouldEscalate);
catatan('tiga solusi ditawarkan, baru kemudian diteruskan ke engineer');

// Penanda ini yang memunculkan tombol "Sudah / Belum berhasil" di antarmuka
cek('tiap solusi menandai sedang menunggu konfirmasi',
  [j1, j2, j3].every((j) => j.menungguKonfirmasi === true),
  [j1, j2, j3].map((j) => j.menungguKonfirmasi));
cek('tidak menunggu konfirmasi setelah menyerah', j4.menungguKonfirmasi === false, j4.menungguKonfirmasi);
cek('divisi mode engineer tidak menunggu konfirmasi', jwbA.menungguKonfirmasi === false, jwbA.menungguKonfirmasi);

// Tombol mengirim frasa yang sama persis dengan yang dikenali pengenal jawaban
const sesiC = await post('/chat/new', {});
await post('/chat/division', { sessionId: sesiC.sessionId, division: 'printer' });
await post('/chat', { sessionId: sesiC.sessionId, message: 'kertas nyangkut di printer' });
const tombolBerhasil = await post('/chat', { sessionId: sesiC.sessionId, message: 'sudah berhasil' });
cek('tombol "sudah berhasil" menutup percakapan', tombolBerhasil.isResolved === true, tombolBerhasil.isResolved);
cek('tombol "sudah berhasil" tidak mengeskalasi', tombolBerhasil.shouldEscalate === false, tombolBerhasil.shouldEscalate);
catatan('frasa tombol harus tetap cocok dengan FRASA_SUDAH / FRASA_BELUM di answerService');

bagian('8b. Kelengkapan data divisi swalayan');
const { readFileSync } = await import('fs');
const kb = JSON.parse(readFileSync('server/data/knowledge-base.json', 'utf8'));
for (const divisi of ['printer', 'windows']) {
  const ringan = kb.masalah.filter((m) => m.divisi === divisi && m.kategori !== 'berat');
  const kurang = ringan.filter((m) => (m.solusi || []).length < 3);
  cek(`${divisi}: semua masalah ringan punya 3 solusi`,
    ringan.length > 0 && kurang.length === 0, kurang.map((m) => `${m.judul} (${m.solusi.length})`));
}
catatan('divisi mode engineer sengaja tidak dituntut lengkap — datanya menunggu engineer');

bagian('8c. Setiap jalan menuju engineer membawa tautan cek status');
// Ada tiga jalan menuju engineer, dan sebelumnya hanya satu — jalur SOP habis —
// yang menyebut halaman cek status. Enam layanan mode engineer tidak pernah
// memberitahu pelapornya bahwa laporan itu dapat dipantau sama sekali.
const POLA_TAUTAN_TIKET = /\[Cek Status Laporan\]\(\/tiket\?nomor=SGP-\d{8}-\d{4}\)/;

cek('mode engineer menautkan halaman cek status',
  POLA_TAUTAN_TIKET.test(jwbA.response), jwbA.response?.slice(-160));
cek('nomor pada tautan adalah nomor sesi itu sendiri',
  jwbA.response.includes(`/tiket?nomor=${sesiA.nomorTiket}`), sesiA.nomorTiket);

cek('jalur SOP habis menautkan halaman cek status',
  POLA_TAUTAN_TIKET.test(j4.response), j4.response?.slice(-160));

// Keluhan yang tidak terkenali sama sekali oleh penentu layanan otomatis
const sesiAuto = await post('/chat/new', {});
await post('/chat/division', { sessionId: sesiAuto.sessionId, division: 'auto' });
const jwbAuto = await post('/chat', { sessionId: sesiAuto.sessionId, message: 'qwrtyp zxcvbn asdfgh' });
cek('keluhan tak dikenali tetap dieskalasi', jwbAuto.shouldEscalate === true, jwbAuto.response?.slice(0, 120));
cek('jalur tak dikenali menautkan halaman cek status',
  POLA_TAUTAN_TIKET.test(jwbAuto.response), jwbAuto.response?.slice(-160));

// Selama masih ada langkah untuk dicoba, penutup itu justru mengganggu:
// pelapor diminta memantau laporan yang belum diteruskan ke siapa pun.
cek('jawaban yang masih menawarkan solusi tidak memuat tautan',
  !POLA_TAUTAN_TIKET.test(j1.response) && !POLA_TAUTAN_TIKET.test(j2.response),
  'tautan muncul terlalu awal');

// Tanpa penyaringan tujuan di Markdown.jsx, satu baris SOP dapat menjalankan
// skrip di halaman pelapor. Penjagaan sebenarnya ada di antarmuka; ini menjaga
// agar server tidak pernah menjadi sumbernya.
cek('server tidak pernah memancarkan tautan berskema skrip',
  ![jwbA, j4, jwbAuto].some((j) => /\]\(\s*(javascript|data|vbscript):/i.test(j.response)), 'ada skema berbahaya');

await post('/chat/reporter', {
  sessionId: sesiB.sessionId,
  reporter: { nama: 'Uji Coba', fungsi: 'FM (Field Manager)', lokasi: 'Pumper UKUI', urgensi: 'Tinggi' }
});
const repSalah = await post('/chat/reporter', {
  sessionId: sesiB.sessionId,
  reporter: { nama: 'A', fungsi: 'FM (Field Manager)', lokasi: 'Pumper UKUI', urgensi: 'Darurat' }
});
cek('tingkat urgensi di luar daftar ditolak', repSalah.success === false, repSalah);

// Pilihan saringan pada halaman rekap disusun dari nilai DISTINCT yang
// tersimpan, sehingga satu kiriman ngawur menetap selamanya di dropdown admin.
// Memeriksanya hanya di antarmuka berarti tidak memeriksanya sama sekali.
const sah = { nama: 'Uji Coba', fungsi: 'FM (Field Manager)', lokasi: 'Pumper UKUI', urgensi: 'Tinggi' };
const kirimPelapor = (ubah) =>
  post('/chat/reporter', { sessionId: sesiB.sessionId, reporter: { ...sah, ...ubah } });

cek('fungsi di luar daftar ditolak',
  (await kirimPelapor({ fungsi: 'Fungsi Karangan' })).success === false, 'diterima');
cek('lokasi di luar daftar ditolak',
  (await kirimPelapor({ lokasi: 'Kantor Antah Berantah' })).success === false, 'diterima');
cek('nama terlalu panjang ditolak',
  (await kirimPelapor({ nama: 'a'.repeat(200) })).success === false, 'diterima');
cek('kiriman yang sah tetap diterima', (await kirimPelapor({})).success === true, 'ditolak');

await post('/chat/escalate', { sessionId: sesiB.sessionId });

// Riwayat memuat data pelapor, sehingga tidak boleh terbuka bebas
cek('riwayat sesi ditolak tanpa masuk',
  (await fetch(`${API}/chat/history/${sesiB.sessionId}`)).status === 401, 'bukan 401');

const riwayat = await json(`/chat/history/${sesiB.sessionId}`, adm.kuki);
cek('keluhan pertama tercatat utuh', riwayat.session.keluhan === 'kertas nyangkut di printer', riwayat.session.keluhan);
cek('masalah cocok tercatat', Boolean(riwayat.session.masalah_cocok), riwayat.session.masalah_cocok);
cek('skor cocok tercatat', riwayat.session.skor_cocok > 0, riwayat.session.skor_cocok);
cek('solusi terakhir tercatat', riwayat.session.solusi_terakhir >= 1, riwayat.session.solusi_terakhir);
cek('area diturunkan dari lokasi', riwayat.session.area === 'Ukui', riwayat.session.area);
cek('engineer tujuan tercatat', Boolean(riwayat.session.engineer_tujuan), riwayat.session.engineer_tujuan);
cek('mode divisi tercatat', riwayat.session.mode_divisi === 'swalayan', riwayat.session.mode_divisi);

bagian('9. Rute yang mengubah keadaan wajib berwenang');
cek('muat ulang basis pengetahuan ditolak tanpa masuk',
  (await fetch(`${API}/kb/reload`, { method: 'POST' })).status === 401, 'bukan 401');
cek('muat ulang ditolak untuk engineer',
  (await ambil('/kb/reload', eng.kuki, { method: 'POST' })).status === 403, 'bukan 403');
cek('muat ulang diizinkan untuk admin',
  (await ambil('/kb/reload', adm.kuki, { method: 'POST' })).status === 200, 'bukan 200');

bagian('10. Sesi yang ditinggalkan lalu dilanjutkan');
// Basis data yang sama dibuka dari proses uji — SQLite mode WAL mengizinkannya.
const dbUji = await import('../server/database/init.js');
await dbUji.initDatabase();

const sesiD = await post('/chat/new', {});
await post('/chat/division', { sessionId: sesiD.sessionId, division: 'printer' });
await post('/chat', { sessionId: sesiD.sessionId, message: 'kertas nyangkut di printer' });

// Paksa sesi tampak ditinggalkan 45 menit, lalu jalankan penyapunya
dbUji.wajibSiap().prepare('UPDATE sesi SET diperbarui_pada = ? WHERE id = ?')
  .run(new Date(Date.now() - 45 * 60 * 1000).toISOString(), sesiD.sessionId);
cek('penyapu menandai sesi yang diam', dbUji.tandaiSesiTerbengkalai(30) >= 1, 'tidak tersapu');
cek('status menjadi ditinggalkan',
  dbUji.getChatSession(sesiD.sessionId).status === 'ditinggalkan',
  dbUji.getChatSession(sesiD.sessionId).status);

// Pengguna kembali dan melanjutkan
await post('/chat', { sessionId: sesiD.sessionId, message: 'sudah berhasil' });
const sesiHidup = dbUji.getChatSession(sesiD.sessionId);
cek('sesi hidup kembali dan tercatat selesai', sesiHidup.status === 'selesai', sesiHidup.status);

const selisihMenit = (Date.now() - new Date(sesiHidup.berakhir_pada).getTime()) / 60000;
cek('berakhir_pada memakai waktu penyelesaian, bukan waktu ditinggalkan',
  selisihMenit < 5, `tertinggal ${Math.round(selisihMenit)} menit`);
catatan('tanpa ini durasi pada laporan terpotong sepanjang waktu pengguna pergi');

dbUji.tutupDatabase();

selesai('api');
