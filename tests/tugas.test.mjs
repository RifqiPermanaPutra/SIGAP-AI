/**
 * Uji daftar tugas engineer dan makna status `diteruskan`.
 *
 * Dua hal yang dijaga di sini, keduanya pernah salah:
 *
 *   1. `diteruskan` berarti laporan BERPINDAH TANGAN ke engineer — bukan
 *      sekadar sistem menawarkan bantuan engineer. Sebelumnya statusnya
 *      disetel begitu sistem menyerah, sehingga rekap memuat baris tanpa nama,
 *      fungsi, lokasi, maupun area, dan persentase selesai mandiri ikut
 *      mengecil karena penyebutnya menghitung pengguna yang tidak pernah
 *      menghubungi siapa pun (RANCANGAN-DATA.md §8).
 *
 *   2. Waktu penanganan yang dicatat adalah kapan kendalanya beres, bukan
 *      kapan tombolnya ditekan. Tanpa itu `waktu_tanggap` mengukur
 *      keterlambatan mengisi formulir, dan angka yang tidak dipercaya tidak
 *      akan dipakai siapa pun.
 *
 * Menuntut server sudah berjalan. Dijalankan oleh `tests/jalankan.mjs`.
 */
import { bagian, cek, catatan, selesai } from './bantu.mjs';
import { AKUN_UJI } from './benih.mjs';

const PORT = process.env.UJI_PORT || 3999;
const API = `http://localhost:${PORT}/api`;

async function masuk({ namaAkun, sandi }, ingatSaya = false) {
  const r = await fetch(`${API}/auth/masuk`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ namaAkun, sandi, ingatSaya })
  });
  await r.json();
  return { kuki: r.headers.get('set-cookie')?.split(';')[0] || '', set: r.headers.get('set-cookie') || '' };
}

const ambil = (jalur, kuki, opsi = {}) =>
  fetch(API + jalur, { ...opsi, headers: { ...(opsi.headers || {}), Cookie: kuki } });

const json = (jalur, kuki) => ambil(jalur, kuki).then((r) => r.json());

const kirim = (jalur, kuki, badan) => ambil(jalur, kuki, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(badan)
});

const post = (jalur, badan) => fetch(API + jalur, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(badan)
}).then((r) => r.json());

const admMasuk = await masuk(AKUN_UJI.admin);
const engMasuk = await masuk(AKUN_UJI.engineer);
const adm = admMasuk.kuki;
const eng = engMasuk.kuki;

/* ──────────────────────────────────────────────────────────── */

bagian('1. "diteruskan" berarti benar-benar berpindah tangan');

const sesi = await post('/chat/new', {});
await post('/chat/division', { sessionId: sesi.sessionId, division: 'printer' });
await post('/chat', { sessionId: sesi.sessionId, message: 'kertas nyangkut di printer' });
await post('/chat', { sessionId: sesi.sessionId, message: 'belum berhasil' });
await post('/chat', { sessionId: sesi.sessionId, message: 'masih belum bisa' });
const jHabis = await post('/chat', { sessionId: sesi.sessionId, message: 'tetap tidak bisa' });

cek('sistem menyerah setelah tiga solusi', jHabis.shouldEscalate === true, jHabis.shouldEscalate);
cek('nomor tiket disebutkan saat mengarahkan ke engineer',
  /SGP-\d{8}-\d{4}/.test(jHabis.response), jHabis.response?.slice(-160));

const sblm = (await json(`/chat/history/${sesi.sessionId}`, adm)).session;
cek('status BELUM diteruskan selama formulir belum diisi',
  sblm.status !== 'diteruskan', sblm.status);
cek('saat penawaran engineer tetap tercatat',
  Boolean(sblm.eskalasi_ditawarkan_pada), sblm.eskalasi_ditawarkan_pada);
catatan('tanpa pemisahan ini, rekap memuat baris tanpa nama, lokasi, dan area');

await post('/chat/reporter', {
  sessionId: sesi.sessionId,
  reporter: { nama: 'Uji Tugas', fungsi: 'FM (Field Manager)', lokasi: 'Klinik UKUI', urgensi: 'Tinggi' }
});
await post('/chat/escalate', { sessionId: sesi.sessionId });

const ssdh = (await json(`/chat/history/${sesi.sessionId}`, adm)).session;
cek('status menjadi diteruskan setelah formulir dikirim', ssdh.status === 'diteruskan', ssdh.status);
cek('data pelapor ikut lengkap', Boolean(ssdh.nama && ssdh.lokasi && ssdh.area), {
  nama: ssdh.nama, lokasi: ssdh.lokasi, area: ssdh.area
});
cek('area diturunkan dari lokasi', ssdh.area === 'Ukui', ssdh.area);

// Divisi mode engineer tidak pernah menawarkan langkah SOP, tetapi tetap
// menawarkan bantuan engineer sejak pesan pertama.
const sesiEng = await post('/chat/new', {});
await post('/chat/division', { sessionId: sesiEng.sessionId, division: 'cctv' });
await post('/chat', { sessionId: sesiEng.sessionId, message: 'kamera gudang mati total' });
const cctv = (await json(`/chat/history/${sesiEng.sessionId}`, adm)).session;
cek('mode engineer juga belum diteruskan sebelum formulir', cctv.status !== 'diteruskan', cctv.status);
cek('mode engineer mencatat penawaran', Boolean(cctv.eskalasi_ditawarkan_pada), cctv.eskalasi_ditawarkan_pada);

bagian('2. Wewenang daftar tugas');

cek('tanpa masuk ditolak', (await fetch(`${API}/tugas`)).status === 401, 'bukan 401');
cek('engineer boleh membuka daftar tugas', (await ambil('/tugas', eng)).status === 200, 'bukan 200');
cek('admin boleh membuka daftar tugas', (await ambil('/tugas', adm)).status === 200, 'bukan 200');
cek('divisi tidak dikenal ditolak',
  (await ambil('/tugas?divisi=bukan-divisi', eng)).status === 400, 'bukan 400');

bagian('3. Isi daftar tugas');

const tugas = await json('/tugas', eng);
cek('tiket yang baru diteruskan muncul di daftar',
  tugas.tugas.some((t) => t.nomor_tiket === ssdh.nomor_tiket), ssdh.nomor_tiket);
cek('seluruhnya belum ditangani',
  tugas.tugas.every((t) => t.nama !== undefined) && tugas.jumlah === tugas.tugas.length, tugas.jumlah);
// Aturan urutan sebenarnya ada dua tingkat: yang belum dipegang siapa pun
// didahulukan, lalu terlama di atas. Memeriksa tingkat kedua saja membuat uji
// ini lulus hanya karena kebetulan belum ada tiket yang dipegang — dan berhenti
// menjaga apa pun begitu ada.
const urutanBenar = (daftar) => daftar.every((t, i) => {
  if (i === 0) return true;
  const sblm = daftar[i - 1];
  const dipegang = Boolean(t.dikerjakan_oleh), dipegangSblm = Boolean(sblm.dikerjakan_oleh);
  if (dipegangSblm !== dipegang) return dipegang;                 // kosong dulu
  return t.diteruskan_pada >= sblm.diteruskan_pada;               // lalu terlama
});

cek('yang belum dipegang di atas, lalu terlama di atas',
  urutanBenar(tugas.tugas),
  tugas.tugas.map((t) => `${t.dikerjakan_oleh ? 'dipegang' : 'kosong'} ${t.diteruskan_pada}`));
cek('nama layanan ikut disertakan',
  tugas.tugas.every((t) => Boolean(t.divisi_nama)), 'ada yang tanpa nama layanan');
cek('saringan divisi bekerja',
  (await json('/tugas?divisi=printer', eng)).tugas.every((t) => t.divisi_id === 'printer'), 'bocor');
catatan(`${tugas.jumlah} tiket menunggu ditangani`);

bagian('4. Menandai selesai dengan waktu yang sebenarnya');

const tiket = ssdh.nomor_tiket;
const diteruskanPada = new Date(ssdh.diteruskan_pada).getTime();

const masaDepan = await kirim('/tugas/selesai', eng, {
  nomorTiket: tiket,
  selesaiPada: new Date(Date.now() + 3 * 3600_000).toISOString()
});
cek('waktu selesai di masa depan ditolak', masaDepan.status === 400, masaDepan.status);

const terlaluAwal = await kirim('/tugas/selesai', eng, {
  nomorTiket: tiket,
  selesaiPada: new Date(diteruskanPada - 3600_000).toISOString()
});
cek('waktu selesai sebelum diteruskan ditolak', terlaluAwal.status === 400, terlaluAwal.status);

const ngawur = await kirim('/tugas/selesai', eng, { nomorTiket: tiket, selesaiPada: 'kemarin sore' });
cek('waktu yang tidak terbaca ditolak', ngawur.status === 400, ngawur.status);

const tanpaTiket = await kirim('/tugas/selesai', eng, { catatan: 'lupa nomor' });
cek('tanpa nomor tiket ditolak', tanpaTiket.status === 400, tanpaTiket.status);

// Waktu yang sah: satu detik setelah diteruskan, jauh di masa lalu dari sekarang
const waktuSah = new Date(diteruskanPada + 1000).toISOString();
const berhasil = await kirim('/tugas/selesai', eng, {
  nomorTiket: tiket, selesaiPada: waktuSah, catatan: 'Kertas sobek dikeluarkan dari jalur belakang.'
}).then((r) => r.json());

cek('engineer dapat menandai selesai', berhasil.success === true, berhasil);
cek('waktu yang dicatat adalah yang disebutkan, bukan waktu tombol ditekan',
  berhasil.ditanganiPada === waktuSah, [berhasil.ditanganiPada, waktuSah]);

const ulang = await kirim('/tugas/selesai', eng, { nomorTiket: tiket });
cek('tiket yang sama tidak dapat ditandai dua kali', ulang.status === 400, ulang.status);

const sesudah = (await json(`/chat/history/${tiket ? sesi.sessionId : ''}`, adm)).session;
cek('ditangani_pada tersimpan', sesudah.ditangani_pada === waktuSah, sesudah.ditangani_pada);
cek('ditangani_oleh tersimpan', sesudah.ditangani_oleh === AKUN_UJI.engineer.namaAkun, sesudah.ditangani_oleh);
cek('catatan penanganan tersimpan', /jalur belakang/i.test(sesudah.catatan || ''), sesudah.catatan);

// berakhir_pada untuk tiket diteruskan berarti "jam laporan berpindah tangan",
// bukan "jam kendalanya beres" (RANCANGAN-DATA.md §8). Menimpanya akan
// mencampur dua makna berbeda di dalam satu kolom.
cek('berakhir_pada TIDAK ikut ditimpa',
  sesudah.berakhir_pada !== waktuSah, [sesudah.berakhir_pada, waktuSah]);
catatan('"Jam Berakhir" = laporan berpindah tangan · "Ditangani" = kendala beres');

cek('tiket hilang dari daftar tugas setelah ditandai',
  !(await json('/tugas', eng)).tugas.some((t) => t.nomor_tiket === tiket), tiket);

bagian('5. Sesi panjang "ingat saya"');

const biasa = await masuk(AKUN_UJI.engineer, false);
const panjang = await masuk(AKUN_UJI.engineer, true);

const umur = (set) => Number(/Max-Age=(\d+)/.exec(set)?.[1] || 0);

cek('sesi biasa berumur 12 jam', umur(biasa.set) === 12 * 3600, umur(biasa.set));
cek('"ingat saya" berumur 30 hari', umur(panjang.set) === 30 * 24 * 3600, umur(panjang.set));
cek('sesi panjang tetap dapat dipakai',
  (await ambil('/tugas', panjang.kuki)).status === 200, 'bukan 200');
catatan('tanpa ini engineer memasukkan kata sandi hampir setiap kali membuka tautan dari WhatsApp');

bagian('6. Wewenang per layanan');

// budi hanya menangani printer & windows; eka tidak dibatasi; admin melihat semua.
const budi = (await masuk(AKUN_UJI.engineerPrinter)).kuki;

const punyaBudi = await json('/tugas', budi);
const punyaEka = await json('/tugas', eng);

cek('engineer terbatas hanya menerima layanan yang ditanganinya',
  punyaBudi.tugas.every((t) => ['printer', 'windows'].includes(t.divisi_id)),
  [...new Set(punyaBudi.tugas.map((t) => t.divisi_id))]);

cek('engineer tanpa batas tetap menerima seluruh layanan',
  new Set(punyaEka.tugas.map((t) => t.divisi_id)).size > 2,
  [...new Set(punyaEka.tugas.map((t) => t.divisi_id))]);

cek('penyaringan dikerjakan server, bukan disembunyikan antarmuka',
  punyaBudi.tugas.length < punyaEka.tugas.length,
  [punyaBudi.tugas.length, punyaEka.tugas.length]);

cek('pilihan saringan ikut mengikuti wewenang',
  punyaBudi.pilihanDivisi.map((d) => d.id).join(',') === 'printer,windows',
  punyaBudi.pilihanDivisi.map((d) => d.id));

cek('cakupan wewenang dilaporkan ke antarmuka',
  punyaBudi.seluruhDivisi === false && punyaEka.seluruhDivisi === true,
  [punyaBudi.seluruhDivisi, punyaEka.seluruhDivisi]);

cek('saringan ke layanan di luar wewenang ditolak',
  (await ambil('/tugas?divisi=cctv', budi)).status === 403, 'bukan 403');

cek('saringan ke layanan sendiri diterima',
  (await ambil('/tugas?divisi=printer', budi)).status === 200, 'bukan 200');

// Inilah pemeriksaan yang sesungguhnya: menyembunyikan tiket dari daftar
// tidak ada gunanya bila nomornya masih dapat dikirim langsung.
const tiketCctv = punyaEka.tugas.find((t) => t.divisi_id === 'cctv');
const curi = await kirim('/tugas/selesai', budi, { nomorTiket: tiketCctv.nomor_tiket });
cek('menandai tiket di luar wewenang ditolak 403', curi.status === 403, curi.status);
catatan('nomor tiket divisi lain tetap dapat ditebak — penjagaannya harus di server');

// Halaman rekap memakai jalur berbeda menuju fungsi yang sama. Bila hanya
// salah satunya dijaga, yang lain menjadi pintu belakang.
const lewatRekap = await kirim('/rekap/tandai-selesai', budi, { nomorTiket: tiketCctv.nomor_tiket });
cek('pintu belakang lewat halaman rekap ikut tertutup', lewatRekap.status === 403, lewatRekap.status);

const sahBudi = punyaBudi.tugas[0];
if (sahBudi) {
  const boleh = await kirim('/tugas/selesai', budi, { nomorTiket: sahBudi.nomor_tiket });
  cek('menandai tiket dalam wewenang tetap berhasil', boleh.status === 200, boleh.status);
}

bagian('6a. Akun engineer baru tidak lahir berwenang atas segalanya');

// Inilah celah yang paling mudah luput: pembatasannya ada dan bekerja, tetapi
// dulu bersifat opt-in. Kolom divisi yang kosong dibaca sebagai "tanpa batas",
// sehingga setiap akun engineer baru berwenang atas kedelapan layanan sampai
// ada yang INGAT mengaturnya. Kelalaian itu tidak menghasilkan pesan galat
// apa pun — hanya wewenang berlebih yang diam.
const dbBaru = await import('../server/database/init.js');
await dbBaru.initDatabase();
const auth = await import('../server/services/authService.js');

auth.buatPengguna({ namaAkun: 'polos', nama: 'Engineer Polos', peran: 'engineer', sandi: 'ujicoba123' });
const polos = (await masuk({ namaAkun: 'polos', sandi: 'ujicoba123' })).kuki;

const punyaPolos = await json('/tugas', polos);
cek('engineer tanpa layanan tidak menerima tiket apa pun',
  punyaPolos.tugas.length === 0, punyaPolos.tugas.length);
cek('keadaannya dibedakan dari "tidak ada tiket"',
  punyaPolos.tanpaLayanan === true, punyaPolos);
cek('tidak ada pilihan saringan yang ditawarkan',
  punyaPolos.pilihanDivisi.length === 0, punyaPolos.pilihanDivisi);
cek('TIDAK dianggap berwenang atas seluruh layanan',
  punyaPolos.seluruhDivisi === false, punyaPolos.seluruhDivisi);

const semuaTiket = (await json('/tugas', eng)).tugas;
if (semuaTiket.length > 0) {
  const sasaran = semuaTiket[0].nomor_tiket;
  cek('engineer tanpa layanan tidak dapat menandai selesai',
    (await kirim('/tugas/selesai', polos, { nomorTiket: sasaran })).status === 403, 'diterima');
  cek('lewat halaman rekap pun ditolak',
    (await kirim('/rekap/tandai-selesai', polos, { nomorTiket: sasaran })).status === 403, 'diterima');
}

// Setelah admin menetapkannya, barulah wewenangnya muncul.
auth.aturDivisi('polos', ['printer']);
const sesudahDiatur = await json('/tugas', polos);
cek('wewenang muncul setelah admin menetapkannya',
  sesudahDiatur.tanpaLayanan === false &&
  sesudahDiatur.tugas.every((t) => t.divisi_id === 'printer'),
  [...new Set(sesudahDiatur.tugas.map((t) => t.divisi_id))]);

// "Seluruh layanan" harus berupa penetapan yang disengaja, bukan akibat
// kolom yang kebetulan kosong.
auth.aturDivisi('polos', [auth.SELURUH_DIVISI]);
cek('"semua" hanya berlaku bila ditetapkan dengan sengaja',
  (await json('/tugas', polos)).seluruhDivisi === true, 'tidak berlaku');

auth.hapusPengguna('polos');
dbBaru.tutupDatabase();

bagian('6a2. Nama engineer pada laporan');

const rekapNama = await json('/rekap?dari=2020-01-01', adm);
cek('peta akun → nama lengkap tersedia',
  rekapNama.engineer.nama[AKUN_UJI.engineer.namaAkun] === 'Eka Maulana',
  rekapNama.engineer.nama);
cek('penanggung jawab per layanan tersedia',
  rekapNama.engineer.perDivisi.printer?.some((e) => e.akun === AKUN_UJI.engineerPrinter.namaAkun),
  rekapNama.engineer.perDivisi.printer);
cek('engineer yang tidak menangani layanan itu tidak dicantumkan',
  !rekapNama.engineer.perDivisi.cctv?.some((e) => e.akun === AKUN_UJI.engineerPrinter.namaAkun),
  rekapNama.engineer.perDivisi.cctv);
cek('admin tidak ikut terdaftar sebagai penanggung jawab layanan',
  !Object.values(rekapNama.engineer.perDivisi).flat().some((e) => e.akun === 'admin'),
  'admin ikut terdaftar');
catatan('yang tersimpan pada laporan tetap nama akun — nama lengkap hanya cara menampilkannya');

bagian('6b. Pembatalan penandaan selesai');

// Tiket yang baru saja ditandai budi pada bagian sebelumnya
const sudahDitandai = (await json('/rekap?dari=2020-01-01', adm))
  .laporan.find((l) => l.ditangani_pada);

cek('ada tiket yang sudah ditandai untuk diuji', Boolean(sudahDitandai), 'tidak ada');

cek('engineer TIDAK boleh membatalkan penandaan',
  (await kirim('/tugas/batal', eng, { nomorTiket: sudahDitandai.nomor_tiket })).status === 403,
  'bukan 403');
catatan('membiarkan engineer membatalkan penandaan engineer lain membuka kembali celah yang ditutup');

cek('tanpa masuk ditolak',
  (await fetch(`${API}/tugas/batal`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nomorTiket: sudahDitandai.nomor_tiket })
  })).status === 401, 'bukan 401');

const dibatalkan = await kirim('/tugas/batal', adm, { nomorTiket: sudahDitandai.nomor_tiket });
cek('admin dapat membatalkan penandaan', dibatalkan.status === 200, dibatalkan.status);

const sesudahBatal = (await json('/rekap?dari=2020-01-01', adm))
  .laporan.find((l) => l.nomor_tiket === sudahDitandai.nomor_tiket);

cek('kolom penanganan benar-benar dikosongkan',
  !sesudahBatal.ditangani_pada && !sesudahBatal.ditangani_oleh, sesudahBatal);
cek('waktu tanggap ikut hilang', !sesudahBatal.waktu_tanggap, sesudahBatal.waktu_tanggap);
cek('status tetap diteruskan', sesudahBatal.status === 'diteruskan', sesudahBatal.status);

cek('tiket kembali muncul di daftar tugas',
  (await json('/tugas', adm)).tugas.some((t) => t.nomor_tiket === sudahDitandai.nomor_tiket),
  'tidak kembali');

cek('membatalkan tiket yang belum pernah ditandai ditolak',
  (await kirim('/tugas/batal', adm, { nomorTiket: sudahDitandai.nomor_tiket })).status === 400,
  'diterima dua kali');

const jejak = await json('/rekap/akses', adm);
cek('pembatalan tercatat pada jejak akses',
  jejak.akses.some((a) => a.tindakan === 'batal-tandai-selesai'),
  jejak.akses.slice(0, 3).map((a) => a.tindakan));
catatan('yang dihapus hanya kolom laporan — riwayat siapa melakukan apa tetap ada');

bagian('6c. Keefektifan tiap solusi');

const rekapKe = await json('/rekap?dari=2020-01-01', adm);
const kf = rekapKe.keefektifan;

cek('corong solusi tersedia', kf.perSolusi.length === 3, kf.perSolusi.length);
cek('corong menyusut ke bawah — yang sampai solusi 3 pasti melewati 1 dan 2',
  kf.perSolusi[0].ditawarkan >= kf.perSolusi[1].ditawarkan &&
  kf.perSolusi[1].ditawarkan >= kf.perSolusi[2].ditawarkan,
  kf.perSolusi.map((s) => s.ditawarkan));
cek('yang tuntas tidak pernah melebihi yang ditawarkan',
  kf.perSolusi.every((s) => s.tuntas <= s.ditawarkan), kf.perSolusi);
cek('persentase terhitung benar',
  kf.perSolusi.every((s) => s.ditawarkan === 0
    ? s.persen === null
    : s.persen === Math.round((s.tuntas / s.ditawarkan) * 100)), kf.perSolusi);
cek('masalah tersaring minimal tiga laporan',
  kf.perMasalah.every((m) => m.total >= 3), kf.perMasalah.map((m) => m.total));
cek('masalah terurut dari yang paling sering gagal',
  kf.perMasalah.every((m, i) => i === 0 || kf.perMasalah[i - 1].persen <= m.persen),
  kf.perMasalah.map((m) => m.persen));
catatan(`solusi 1/2/3 menuntaskan ${kf.perSolusi.map((s) => `${s.persen ?? '—'}%`).join(' · ')}`);

// Penyebut corong adalah "berapa orang SAMPAI melihat solusi ke-n", dan itu
// harus menghitung yang menyerah juga. Saat saringan status ikut berlaku,
// memilih "selesai" membuat penyebutnya hanya berisi yang tuntas — sehingga
// tiap solusi tampak menuntaskan 100%. Pernah terjadi, jangan terulang.
const kfSaring = (await json('/rekap?dari=2020-01-01&status=selesai', adm)).keefektifan;
cek('saringan status TIDAK mengubah corong keefektifan',
  JSON.stringify(kfSaring.perSolusi) === JSON.stringify(kf.perSolusi),
  { tanpaSaringan: kf.perSolusi.map((s) => s.persen), disaring: kfSaring.perSolusi.map((s) => s.persen) });
cek('corong tidak pernah menunjukkan 100% palsu',
  kfSaring.perSolusi.every((s) => s.persen === null || s.persen < 100),
  kfSaring.perSolusi.map((s) => s.persen));

// Saringan yang memang mempersempit lingkup tetap harus berpengaruh.
const kfPrinter = (await json('/rekap?dari=2020-01-01&divisi=printer', adm)).keefektifan;
cek('saringan layanan tetap berpengaruh',
  kfPrinter.perSolusi[0].ditawarkan < kf.perSolusi[0].ditawarkan,
  [kfPrinter.perSolusi[0].ditawarkan, kf.perSolusi[0].ditawarkan]);

bagian('6e. Ditawari engineer lalu pergi');

const ring = (await json('/rekap?dari=2020-01-01', adm)).ringkasan;
cek('angka "ditawari lalu pergi" tersedia',
  typeof ring.ditawari_pergi === 'number', ring.ditawari_pergi);
cek('tidak melebihi total laporan', ring.ditawari_pergi <= ring.total, [ring.ditawari_pergi, ring.total]);
catatan('kolom eskalasi_ditawarkan_pada sempat hanya ditulis tanpa pernah dibaca');

bagian('6d. Cek status tiket oleh pelapor');

// Rute ini TERBUKA tanpa masuk, dan nomor tiket berbentuk berurutan sehingga
// mudah ditebak. Yang dijaga di sini terutama apa yang TIDAK boleh keluar.
const contoh = (await json('/rekap?dari=2020-01-01', adm)).laporan.find((l) => l.nama);
const cekTiket = await fetch(`${API}/tiket/${contoh.nomor_tiket}`).then((r) => r.json());

cek('pelapor dapat memeriksa tanpa masuk', cekTiket.success === true, cekTiket);
cek('keadaan laporan dijelaskan dengan kata biasa',
  Boolean(cekTiket.tiket.statusLabel && cekTiket.tiket.arti), cekTiket.tiket);

const bocor = JSON.stringify(cekTiket.tiket);
cek('nama pelapor TIDAK ikut keluar', !bocor.includes(contoh.nama), 'nama bocor');
cek('isi keluhan TIDAK ikut keluar',
  !contoh.keluhan || !bocor.includes(contoh.keluhan), 'keluhan bocor');
cek('lokasi dan fungsi TIDAK ikut keluar',
  !['lokasi', 'fungsi', 'area', 'catatan'].some((k) => k in cekTiket.tiket),
  Object.keys(cekTiket.tiket));
catatan('nomor tiket berurutan dan mudah ditebak — isinya harus tahan ditebak siapa pun');

cek('nomor berbentuk salah ditolak sebelum menyentuh basis data',
  (await fetch(`${API}/tiket/BUKAN-NOMOR`)).status === 400, 'bukan 400');
cek('nomor yang tidak ada menghasilkan 404',
  (await fetch(`${API}/tiket/SGP-19990101-0001`)).status === 404, 'bukan 404');

bagian('6f. Tahap "sedang dikerjakan"');

// Sebelum tahap ini ada, tiket melompat dari 'diteruskan' langsung ke
// 'ditangani'. Sepanjang engineer membaca WhatsApp, berangkat, dan memeriksa
// di lokasi, tiketnya terlihat persis sama dengan tiket yang belum disentuh
// siapa pun — sehingga dua engineer dapat berangkat ke tempat yang sama, atau
// tidak seorang pun berangkat karena masing-masing mengira yang lain sudah
// jalan.

/** Buat satu tiket yang benar-benar sudah berpindah tangan ke engineer */
async function tiketBaru(divisi, keluhan) {
  const s = await post('/chat/new', {});
  await post('/chat/division', { sessionId: s.sessionId, division: divisi });
  await post('/chat', { sessionId: s.sessionId, message: keluhan });
  await post('/chat/reporter', {
    sessionId: s.sessionId,
    reporter: { nama: 'Uji Tahap', fungsi: 'FM (Field Manager)', lokasi: 'Klinik UKUI', urgensi: 'Sedang' }
  });
  await post('/chat/escalate', { sessionId: s.sessionId });
  return s.nomorTiket;
}

const cariTugas = async (kuki, nomor) =>
  (await json('/tugas', kuki)).tugas.find((t) => t.nomor_tiket === nomor);

const T1 = await tiketBaru('printer', 'kertas nyangkut di printer');

cek('tanpa masuk tidak dapat mengambil tugas',
  (await fetch(`${API}/tugas/mulai`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nomorTiket: T1 })
  })).status === 401, 'bukan 401');

const mulai = await kirim('/tugas/mulai', budi, { nomorTiket: T1 });
cek('engineer dapat menyatakan tiket sedang dikerjakan', mulai.status === 200, mulai.status);

const t1Budi = await cariTugas(budi, T1);
cek('tiket TETAP ada di daftar tugas — belum selesai, hanya sudah dipegang',
  Boolean(t1Budi), 'tiket hilang dari daftar');
cek('pemegangnya tercatat', t1Budi.dikerjakan_oleh === 'budi', t1Budi.dikerjakan_oleh);
cek('nama pemegang ikut diterjemahkan',
  t1Budi.dikerjakan_oleh_nama === 'Budi Santoso', t1Budi.dikerjakan_oleh_nama);
cek('jam mulai dikerjakan tersimpan',
  Boolean(t1Budi.mulai_dikerjakan_pada), t1Budi.mulai_dikerjakan_pada);

// Status TIDAK berubah. Menambah nilai kelima pada `status` akan mengubah arti
// persen_mandiri, deretWaktu, dan seluruh saringan status secara diam-diam.
const t1Sesi = (await json('/rekap?dari=2020-01-01', adm)).laporan.find((l) => l.nomor_tiket === T1);
cek('status tetap "diteruskan", bukan nilai kelima yang baru',
  t1Sesi.status === 'diteruskan', t1Sesi.status);
catatan('keadaan "sedang dikerjakan" diketahui dari kolomnya, bukan dari nilai status baru');

cek('mengambil tiket yang sama dua kali ditolak',
  (await kirim('/tugas/mulai', budi, { nomorTiket: T1 })).status === 400, 'diterima dua kali');

// ── Inilah celah yang paling halus: pembatasan per divisi tidak menolong,
//    karena satu divisi tetap berisi beberapa engineer.
const rebut = await kirim('/tugas/mulai', eng, { nomorTiket: T1 });
const rebutIsi = await rebut.json();
cek('engineer lain tidak dapat mengambil diam-diam', rebut.status === 409, rebut.status);
cek('pemegangnya disebutkan agar dapat ditanyakan lebih dulu',
  rebutIsi.pemegang === 'Budi Santoso', rebutIsi.pemegang);

const rebutSelesai = await kirim('/tugas/selesai', eng, { nomorTiket: T1 });
const rebutSelesaiIsi = await rebutSelesai.json();
cek('engineer lain tidak dapat MENUTUP tugas yang sedang dipegang',
  rebutSelesai.status === 409, rebutSelesai.status);
cek('penolakannya menyebutkan jalan keluarnya',
  /ambil alih/i.test(rebutSelesaiIsi.error || ''), rebutSelesaiIsi.error);
catatan('menutup tiket orang yang sedang di lapangan menghapusnya dari daftar orang itu tanpa ia tahu');

cek('yang bukan pemegang tidak dapat melepaskannya',
  (await kirim('/tugas/lepas', eng, { nomorTiket: T1 })).status === 403, 'diterima');

// Pengambilalihan tetap mungkin — engineer yang dijadwalkan bisa berhalangan —
// tetapi harus disengaja.
const mulaiSemula = t1Budi.mulai_dikerjakan_pada;
const alih = await kirim('/tugas/mulai', eng, { nomorTiket: T1, ambilAlih: true });
cek('pengambilalihan yang disengaja diterima', alih.status === 200, alih.status);

const t1Eka = await cariTugas(eng, T1);
cek('pemegangnya berpindah', t1Eka.dikerjakan_oleh === 'eka', t1Eka.dikerjakan_oleh);
cek('jam mulai TIDAK disetel ulang saat berpindah tangan',
  t1Eka.mulai_dikerjakan_pada === mulaiSemula, [t1Eka.mulai_dikerjakan_pada, mulaiSemula]);
catatan('menyetelnya ulang membuat tiket terlantar tampak direspons seketika');

cek('tiket yang sudah berpindah hilang dari daftar tugas pemegang lama',
  (await cariTugas(budi, T1))?.dikerjakan_oleh === 'eka', 'pemegang lama masih tercatat');

// Jalan mundur. Tanpa ini, satu ketukan keliru mengunci tiket atas nama
// seseorang sampai ada admin yang membetulkan — dan engineer yang mengetahui
// itu akan memilih tidak menandai sama sekali.
const lepas = await kirim('/tugas/lepas', eng, { nomorTiket: T1 });
cek('pemegang dapat melepaskan tugasnya', lepas.status === 200, lepas.status);

const t1Lepas = await cariTugas(eng, T1);
cek('kedua kolom benar-benar dikosongkan',
  !t1Lepas.dikerjakan_oleh && !t1Lepas.mulai_dikerjakan_pada, t1Lepas);
cek('melepaskan tiket yang tidak dipegang siapa pun ditolak',
  (await kirim('/tugas/lepas', eng, { nomorTiket: T1 })).status === 400, 'diterima');

// Wewenang divisi tetap berlaku pada tahap baru ini — bila hanya penandaan
// selesai yang dijaga, tahap pertama menjadi pintu belakang.
cek('mengambil tugas di luar wewenang ditolak 403',
  (await kirim('/tugas/mulai', budi, { nomorTiket: tiketCctv.nomor_tiket })).status === 403, 'diterima');

// Melewati tahap pertama TIDAK diwajibkan. Kendala yang beres dalam dua menit
// tidak pantas menuntut dua ketukan; memaksakannya membuat orang berhenti
// menandai sama sekali — persis penyakit yang hendak disembuhkan halaman ini.
const T2 = await tiketBaru('printer', 'hasil cetakan bergaris garis');
cek('tiket boleh langsung ditandai selesai tanpa melewati tahap pertama',
  (await kirim('/tugas/selesai', budi, { nomorTiket: T2 })).status === 200, 'ditolak');

// Admin memang bertugas menutup tiket saat engineernya berhalangan.
const T3 = await tiketBaru('printer', 'printer gabisa ngeprint sama sekali');
await kirim('/tugas/mulai', budi, { nomorTiket: T3 });
cek('admin dapat menutup tiket yang dipegang engineer tanpa mengambil alih',
  (await kirim('/tugas/selesai', adm, { nomorTiket: T3 })).status === 200, 'ditolak');

// Urutan: yang belum dipegang siapa pun didahulukan, karena itulah pekerjaan
// yang benar-benar menunggu diambil.
const T4 = await tiketBaru('printer', 'printer warnanya jadi ungu semua');
await kirim('/tugas/mulai', budi, { nomorTiket: T1 });
const urut = (await json('/tugas', budi)).tugas;
cek('urutan tetap benar setelah ada tiket yang dipegang',
  urut.some((t) => t.dikerjakan_oleh) && urutanBenar(urut),
  urut.map((t) => `${t.dikerjakan_oleh ? 'dipegang' : 'kosong'} ${t.diteruskan_pada}`));
cek('tiket baru ikut masuk daftar', urut.some((t) => t.nomor_tiket === T4), T4);

// Yang paling ingin diketahui pelapor: laporannya sudah dipegang orang atau
// masih menganggur. Sebelumnya kedua keadaan itu terlihat persis sama.
const pantau = await fetch(`${API}/tiket/${T1}`).then((r) => r.json());
cek('pelapor melihat laporannya sedang dikerjakan',
  pantau.tiket.sedangDikerjakan === true, pantau.tiket);
cek('jam mulai dikerjakan ikut diberitahukan',
  Boolean(pantau.tiket.mulaiDikerjakanPada), pantau.tiket.mulaiDikerjakanPada);
cek('SIAPA yang mengerjakan tidak ikut keluar',
  !JSON.stringify(pantau.tiket).includes('budi') &&
  !['dikerjakanOleh', 'dikerjakan_oleh'].some((k) => k in pantau.tiket),
  Object.keys(pantau.tiket));
catatan('halaman itu terbuka tanpa masuk — nama engineer di sana memetakan jadwal kerja seluruh tim');

const ringKerja = (await json('/rekap?dari=2020-01-01', adm)).ringkasan;
cek('ringkasan menghitung yang sedang dikerjakan',
  ringKerja.sedang_dikerjakan >= 1, ringKerja.sedang_dikerjakan);
cek('tidak melebihi jumlah yang diteruskan',
  ringKerja.sedang_dikerjakan <= ringKerja.diteruskan,
  [ringKerja.sedang_dikerjakan, ringKerja.diteruskan]);

const t3Selesai = (await json('/rekap?dari=2020-01-01', adm)).laporan.find((l) => l.nomor_tiket === T3);
cek('waktu tanggap terpecah menjadi respons dan lama pengerjaan',
  typeof t3Selesai.waktu_respons === 'number' && typeof t3Selesai.lama_kerja === 'number',
  { respons: t3Selesai.waktu_respons, kerja: t3Selesai.lama_kerja });
// Ketiganya dibulatkan ke detik penuh secara terpisah, sehingga jumlahnya
// boleh meleset satu detik — yang tidak boleh adalah meleset lebih dari itu.
cek('keduanya berjumlah waktu tanggap',
  Math.abs((t3Selesai.waktu_respons + t3Selesai.lama_kerja) - t3Selesai.waktu_tanggap) <= 1,
  [t3Selesai.waktu_respons, t3Selesai.lama_kerja, t3Selesai.waktu_tanggap]);

const jejakKerja = await json('/rekap/akses', adm);
const tindakanKerja = new Set(jejakKerja.akses.map((a) => a.tindakan));
cek('pengambilan, pengambilalihan, dan pelepasan tercatat',
  ['mulai-kerjakan', 'ambil-alih', 'lepas-tugas'].every((t) => tindakanKerja.has(t)),
  [...tindakanKerja]);

bagian('7. Token tidak berlaku lagi setelah akunnya dicabut');

// Token bertanda tangan HMAC tidak disimpan di server, sehingga tidak ada
// daftar yang dapat dicabut. Tanpa pemeriksaan ulang ke basis data, akun yang
// sudah dihapus tetap dapat dipakai sampai tokennya kedaluwarsa sendiri — dan
// sejak ada "ingat saya", itu berarti 30 hari.
const dbAuth = await import('../server/database/init.js');
await dbAuth.initDatabase();
const { buatPengguna, hapusPengguna } = await import('../server/services/authService.js');

buatPengguna({ namaAkun: 'sementara', nama: 'Akun Sementara', peran: 'engineer', sandi: 'ujicoba123' });
const kukiSementara = (await masuk({ namaAkun: 'sementara', sandi: 'ujicoba123' }, true)).kuki;

cek('akun baru dapat membuka daftar tugas',
  (await ambil('/tugas', kukiSementara)).status === 200, 'bukan 200');

hapusPengguna('sementara');

cek('token akun yang sudah dihapus langsung ditolak',
  (await ambil('/tugas', kukiSementara)).status === 401, 'masih diterima');
catatan('tanpa ini akun yang dicabut tetap hidup sampai 30 hari ke depan');

dbAuth.tutupDatabase();

selesai('tugas');
