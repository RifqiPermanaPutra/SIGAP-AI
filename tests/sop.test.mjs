/**
 * Uji penyunting SOP lewat peramban.
 *
 * Yang dijaga di sini bukan sekadar "tombol simpan berfungsi", melainkan tiga
 * hal yang bila rusak akan merusak diam-diam:
 *
 *   1. Markdown yang dihasilkan penyunting WAJIB dapat diurai kembali oleh
 *      pengurai yang sama dengan yang dipakai `npm run build:kb`. Bila tidak,
 *      SOP tersimpan rapi di berkas tetapi lenyap dari basis pengetahuan.
 *   2. Basis pengetahuan di MEMORI benar-benar dimuat ulang setelah simpan.
 *      Bila tidak, admin melihat suntingannya tersimpan sementara pengguna
 *      masih menerima langkah yang lama sampai server dijalankan ulang.
 *   3. Suntingan yang ditolak tidak boleh meninggalkan jejak apa pun pada
 *      berkas SOP.
 *
 * Menuntut server sudah berjalan. Dijalankan oleh `tests/jalankan.mjs`.
 * Berkas SOP yang disentuh adalah SALINAN sementara — lihat SOP_DIR di sana.
 */
import fs from 'fs';
import path from 'path';
import { bagian, cek, catatan, selesai } from './bantu.mjs';
import { AKUN_UJI } from './benih.mjs';

const PORT = process.env.UJI_PORT || 3999;
const API = `http://localhost:${PORT}/api`;
const SOP_DIR = process.env.SOP_DIR;

async function masuk({ namaAkun, sandi }) {
  const r = await fetch(`${API}/auth/masuk`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ namaAkun, sandi })
  });
  await r.json();
  return r.headers.get('set-cookie')?.split(';')[0] || '';
}

const ambil = (jalur, kuki, opsi = {}) =>
  fetch(API + jalur, { ...opsi, headers: { ...(opsi.headers || {}), Cookie: kuki } });

const json = (jalur, kuki) => ambil(jalur, kuki).then((r) => r.json());

const kirim = (jalur, kuki, metode, badan) =>
  ambil(jalur, kuki, {
    method: metode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(badan)
  });

const uji = (kuki, keluhan, divisi = 'printer') =>
  kirim('/sop/uji', kuki, 'POST', { keluhan, divisi }).then((r) => r.json());

const adm = await masuk(AKUN_UJI.admin);
const eng = await masuk(AKUN_UJI.engineer);

/* ──────────────────────────────────────────────────────────── */

bagian('1. Penyunting SOP wajib admin');

cek('tanpa masuk ditolak', (await fetch(`${API}/sop/printer`)).status === 401, 'bukan 401');
cek('engineer TIDAK boleh membaca SOP',
  (await ambil('/sop/printer', eng)).status === 403, 'bukan 403');
cek('engineer TIDAK boleh menyunting SOP',
  (await kirim('/sop/printer/apa-saja', eng, 'PUT', {})).status === 403, 'bukan 403');
cek('engineer TIDAK boleh memakai alat uji keluhan',
  (await kirim('/sop/uji', eng, 'POST', { keluhan: 'a', divisi: 'printer' })).status === 403, 'bukan 403');
cek('admin boleh membaca SOP', (await ambil('/sop/printer', adm)).status === 200, 'bukan 200');

bagian('2. Membaca SOP');

const daftar = await json('/sop', adm);
cek('seluruh delapan divisi terdaftar', daftar.divisi.length === 8, daftar.divisi.length);
cek('divisi swalayan ditandai disajikan ke pengguna',
  daftar.divisi.filter((d) => d.disajikan).map((d) => d.id).join(',') === 'printer,windows',
  daftar.divisi.filter((d) => d.disajikan).map((d) => d.id));

const printer = await json('/sop/printer', adm);
cek('enam masalah printer terbaca', printer.masalah.length === 6, printer.masalah.length);
cek('ambang pencocokan ikut dikirim', printer.ambangCocok === 0.4, printer.ambangCocok);

const macet = printer.masalah.find((m) => /Kertas Macet/i.test(m.judul));
cek('masalah ringan punya tiga solusi', macet.solusi.length === 3, macet.solusi.length);
// Sejak sumbernya JSON, judul solusi tersimpan apa adanya — yang dilihat
// penyunting sama persis dengan yang tersimpan. Dulu awalan "Solusi Pertama:"
// dilepas saat mengurai lalu ditambahkan kembali saat menyimpan; dua tafsiran
// atas satu teks yang dapat bergeser sendiri-sendiri, dan sempat benar-benar
// bergeser — tujuh belas blok tertulis ulang dengan judul keliru.
cek('judul solusi tersimpan apa adanya, tanpa penguraian',
  typeof macet.solusi[0].judul === 'string' && macet.solusi[0].judul.trim().length > 0,
  macet.solusi[0].judul);

const berat = printer.masalah.find((m) => m.kategori === 'berat');
cek('masalah berat memakai penanganan, bukan daftar solusi',
  berat.solusi.length === 0 && Boolean(berat.penanganan), berat.penanganan);

cek('catatan [KONFIRMASI] terbaca terpisah', printer.catatan.butir.length > 0, printer.catatan);
cek('penanda [KONFIRMASI] tidak bocor ke dalam blok masalah',
  !JSON.stringify(printer.masalah).includes('[KONFIRMASI]'), 'ada yang bocor');
catatan(`${printer.catatan.butir.length} penanda [KONFIRMASI] pada SOP printer`);

bagian('3. Seluruh berkas sumber sah dan lengkap');

// Dulu bagian ini menguji perjalanan bolak-balik Markdown: urai lalu susun
// kembali harus menghasilkan berkas yang identik. Perjalanan itu tidak ada
// lagi — yang ditulis adalah bentuk yang sama persis dengan yang dibaca.
// Yang tersisa untuk dijaga: setiap berkas sumber benar-benar sah dan tidak
// kehilangan medan yang dibutuhkan pembangun basis pengetahuan.

let berkasDiperiksa = 0;
let masalahDiperiksa = 0;
const cacatSumber = [];

for (const berkas of fs.readdirSync(SOP_DIR).filter((f) => f.endsWith('.json'))) {
  const divisi = path.basename(berkas, '.json');
  let isi;
  try {
    isi = JSON.parse(fs.readFileSync(path.join(SOP_DIR, berkas), 'utf-8'));
  } catch (e) {
    cacatSumber.push(`${berkas}: JSON tidak dapat diurai — ${e.message}`);
    continue;
  }
  berkasDiperiksa++;

  if (isi.divisi !== divisi) cacatSumber.push(`${berkas}: medan divisi "${isi.divisi}" tidak cocok nama berkas`);
  if (!Array.isArray(isi.masalah)) { cacatSumber.push(`${berkas}: medan masalah bukan larik`); continue; }

  for (const m of isi.masalah) {
    masalahDiperiksa++;
    if (!m.id) cacatSumber.push(`${berkas}: ada masalah tanpa id`);
    else if (!m.id.startsWith(`${divisi}-`)) cacatSumber.push(`${m.id}: id tidak berawalan "${divisi}-"`);
    if (!m.judul) cacatSumber.push(`${m.id}: judul kosong`);
    if (!['ringan', 'berat'].includes(m.kategori)) cacatSumber.push(`${m.id}: kategori "${m.kategori}" tidak sah`);
    if (m.kategori === 'ringan' && (m.solusi || []).length === 0) cacatSumber.push(`${m.id}: ringan tanpa solusi`);
    if (m.kategori === 'berat' && (m.solusi || []).length > 0) cacatSumber.push(`${m.id}: berat tidak boleh punya solusi`);
    if (m.kategori === 'berat' && !m.penanganan) cacatSumber.push(`${m.id}: berat tanpa penanganan`);
  }
}

cek('kedelapan berkas sumber terbaca', berkasDiperiksa === 8, berkasDiperiksa);
cek('seluruh masalah pada berkas sumber sah', cacatSumber.length === 0, cacatSumber.slice(0, 5));
catatan(`${masalahDiperiksa} masalah diperiksa pada ${berkasDiperiksa} berkas sumber JSON`);

bagian('4. Menyimpan suntingan');

// Kata yang belum pernah muncul di SOP printer mana pun. Bila setelah disimpan
// keluhan yang memuatnya langsung dijawab, berarti basis pengetahuan di memori
// benar-benar dimuat ulang — bukan sekadar berkasnya yang berubah.
const KATA_BARU = 'zebra';
const KELUHAN_UJI = `printer muncul tulisan ${KATA_BARU}`;

const sebelum = await uji(adm, KELUHAN_UJI);
cek('sebelum disunting, keluhan itu belum dikenali', sebelum.dijawab === false, sebelum);

const asli = JSON.parse(JSON.stringify(macet));
const JUDUL_DIPERBAIKI = 'Kertas Macet di Dalam Printer (diperbaiki)';
const disunting = {
  ...asli,
  // Judul sengaja diubah. Dulu server mengabaikannya karena judul menentukan
  // id, sehingga memperbaiki satu kata memutus rujukan sesi.masalah_cocok pada
  // seluruh laporan lama. Sejak id tersimpan di berkas sumber, judul boleh
  // diperbaiki — dan justru itu yang membuat SOP dapat dirawat.
  judul: JUDUL_DIPERBAIKI,
  gejala: `${asli.gejala} Pada layar printer muncul tulisan ${KATA_BARU}.`
};

const simpan = await kirim(`/sop/printer/${asli.id}`, adm, 'PUT', disunting).then((r) => r.json());
cek('admin dapat menyimpan suntingan', simpan.success === true, simpan);
cek('id masalah TIDAK ikut berubah meski judul diperbaiki',
  simpan.masalah.id === asli.id, simpan.masalah?.id);
cek('judul kini boleh diperbaiki',
  simpan.masalah.judul === JUDUL_DIPERBAIKI, simpan.masalah?.judul);
catatan('id tersimpan di berkas sumber — rujukan rekap tidak lagi bergantung pada judul');
cek('cadangan dibuat sebelum menimpa', Boolean(simpan.cadangan), simpan.cadangan);
cek('basis pengetahuan dibangun ulang', simpan.kb.masalah === 44, simpan.kb);

const berkasSop = path.join(SOP_DIR, 'printer.json');
const isiBaru = fs.readFileSync(berkasSop, 'utf-8');
cek('berkas sumber JSON benar-benar berubah', isiBaru.includes(KATA_BARU), 'kata baru tidak ada');
cek('berkas sumber tetap JSON yang sah',
  JSON.parse(isiBaru).masalah.length === 6, 'jumlah masalah berubah atau JSON rusak');
cek('masalah lain tidak ikut tersentuh',
  JSON.parse(isiBaru).masalah.filter((m) => m.id !== asli.id).every((m) => !JSON.stringify(m).includes(KATA_BARU)),
  'masalah tetangga ikut berubah');

const kbBaru = JSON.parse(fs.readFileSync(process.env.KB_FILE, 'utf-8'));
cek('hasil bangun ikut diperbarui',
  kbBaru.masalah.find((m) => m.id === asli.id).gejala.includes(KATA_BARU), 'json belum berubah');

const sesudah = await uji(adm, KELUHAN_UJI);
cek('basis pengetahuan di memori termuat ulang tanpa server dijalankan ulang',
  sesudah.dijawab === true && sesudah.masalah.id === asli.id, sesudah);
cek('skor pencocokan naik melewati ambang', sesudah.skor > sebelum.skor, [sebelum.skor, sesudah.skor]);
catatan(`skor ${sebelum.skor} → ${sesudah.skor} (ambang ${sesudah.ambang})`);

const daftarCadangan = await json('/sop/printer', adm);
cek('cadangan terdaftar dan dapat dilihat', daftarCadangan.cadangan.length > 0, daftarCadangan.cadangan);

bagian('5. Suntingan cacat ditolak tanpa merusak berkas');

const sebelumTolak = fs.readFileSync(berkasSop, 'utf-8');

const tanpaSolusi = await kirim(`/sop/printer/${asli.id}`, adm, 'PUT',
  { ...asli, solusi: [] });
cek('masalah ringan tanpa solusi ditolak', tanpaSolusi.status === 400, tanpaSolusi.status);

const kategoriNgawur = await kirim(`/sop/printer/${asli.id}`, adm, 'PUT',
  { ...asli, kategori: 'sedang' });
cek('kategori di luar ringan/berat ditolak', kategoriNgawur.status === 400, kategoriNgawur.status);

const beratTanpaPenanganan = await kirim(`/sop/printer/${berat.id}`, adm, 'PUT',
  { ...berat, penanganan: '   ' });
cek('masalah berat tanpa penanganan ditolak', beratTanpaPenanganan.status === 400, beratTanpaPenanganan.status);

const tidakAda = await kirim('/sop/printer/printer-masalah-yang-tidak-ada', adm, 'PUT', asli);
cek('masalah yang tidak ada menghasilkan 404', tidakAda.status === 404, tidakAda.status);

const divisiNgawur = await kirim('/sop/bukan-divisi/apa-saja', adm, 'PUT', asli);
cek('divisi tidak dikenal ditolak', divisiNgawur.status === 400, divisiNgawur.status);

const ujiKosong = await kirim('/sop/uji', adm, 'POST', { keluhan: '  ', divisi: 'printer' });
cek('alat uji menolak keluhan kosong', ujiKosong.status === 400, ujiKosong.status);

cek('berkas SOP tidak tersentuh oleh suntingan yang ditolak',
  fs.readFileSync(berkasSop, 'utf-8') === sebelumTolak, 'berkas berubah padahal ditolak');

bagian('6. Suntingan dapat dikembalikan');

const pulih = await kirim(`/sop/printer/${asli.id}`, adm, 'PUT', asli).then((r) => r.json());
cek('suntingan dapat dikembalikan ke isi semula', pulih.success === true, pulih);
cek('berkas kembali seperti sebelum disunting',
  !fs.readFileSync(berkasSop, 'utf-8').includes(KATA_BARU), 'kata baru masih tertinggal');

const setelahPulih = await uji(adm, KELUHAN_UJI);
cek('pencocokan ikut kembali seperti semula', setelahPulih.dijawab === false, setelahPulih);

bagian('7. Menambah dan menghapus masalah');

// Tanpa keduanya, penyunting hanya dapat memperbaiki kalimat pada kendala yang
// sudah dikenal — sementara kendala baru terus bermunculan. SOP yang tidak
// dapat tumbuh akan usang sendiri, dan sistem terus menjawab dengan langkah
// yang tidak lagi cocok.
const MASALAH_BARU = {
  judul: 'Printer Ngadat Saat Mencetak Amplop',
  kategori: 'ringan',
  gejala: 'Printer berhenti dan berkedip ketika mencetak amplop tebal',
  penyebab: ['Amplop terlalu tebal untuk baki utama', 'Pengaturan jenis kertas belum diubah'],
  solusi: [
    { judul: 'Pindahkan ke baki manual', langkah: ['Buka baki manual di depan', 'Masukkan amplop satu per satu'] },
    { judul: 'Ubah jenis kertas', langkah: ['Buka Printing Preferences', 'Pilih jenis kertas Envelope'] },
    { judul: 'Bersihkan roller penarik', langkah: ['Matikan printer', 'Lap roller dengan kain lembap'] }
  ]
};

cek('tanpa masuk tidak dapat menambah masalah',
  (await fetch(`${API}/sop/printer`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(MASALAH_BARU)
  })).status === 401, 'bukan 401');
cek('engineer tidak dapat menambah masalah',
  (await kirim('/sop/printer', eng, 'POST', MASALAH_BARU)).status === 403, 'bukan 403');

const jumlahSblm = (await json('/sop/printer', adm)).masalah.length;
const ditambah = await kirim('/sop/printer', adm, 'POST', MASALAH_BARU);
const isiTambah = await ditambah.json();

cek('admin dapat menambah masalah baru', ditambah.status === 201, [ditambah.status, isiTambah.error]);
cek('id diturunkan dari judulnya',
  isiTambah.masalah?.id === 'printer-printer-ngadat-saat-mencetak-amplop', isiTambah.masalah?.id);
cek('jumlah masalah bertambah satu',
  (await json('/sop/printer', adm)).masalah.length === jumlahSblm + 1, 'tidak bertambah');

// Inilah pemeriksaan yang sesungguhnya: tersimpan di berkas belum tentu
// terbaca oleh pengurai, dan yang tidak terbaca tidak akan pernah ditemukan
// pengguna.
const kbTambah = JSON.parse(fs.readFileSync(process.env.KB_FILE, 'utf-8'));
cek('masalah baru benar-benar masuk basis pengetahuan',
  kbTambah.masalah.some((m) => m.id === isiTambah.masalah.id), isiTambah.masalah.id);

// Keluhannya sengaja memakai kata yang KHAS bagi masalah baru itu. "printer
// macet" akan tertarik ke "Kertas Macet di Dalam Printer" yang sudah ada, dan
// itu perilaku yang benar — pembobotan kekhasan kata memang bekerja begitu.
const KELUHAN_BARU = 'amplop tebal tidak bisa dicetak';
const cocokBaru = await uji(adm, KELUHAN_BARU);
cek('keluhan yang sesuai langsung terjawab masalah baru itu',
  cocokBaru.masalah?.id === isiTambah.masalah.id, cocokBaru);
cek('skornya menembus ambang, bukan sekadar peringkat teratas',
  cocokBaru.dijawab === true, cocokBaru.skor);
catatan('tersimpan di berkas belum berarti terbaca — pencocokan yang membuktikannya');

const kembar = await kirim('/sop/printer', adm, 'POST', MASALAH_BARU);
cek('judul yang menghasilkan id kembar ditolak', kembar.status === 409, kembar.status);

const baruTanpaSolusi = await kirim('/sop/printer', adm, 'POST',
  { ...MASALAH_BARU, judul: 'Judul Lain Sekali', solusi: [] });
cek('masalah baru yang ringan tanpa solusi ditolak',
  baruTanpaSolusi.status === 400, baruTanpaSolusi.status);

// ── Penghapusan ───────────────────────────────────────────────
cek('engineer tidak dapat menghapus masalah',
  (await kirim(`/sop/printer/${isiTambah.masalah.id}`, eng, 'DELETE')).status === 403, 'bukan 403');
cek('masalah yang tidak ada menghasilkan 404',
  (await kirim('/sop/printer/printer-entah-apa', adm, 'DELETE')).status === 404, 'bukan 404');

const dihapus = await kirim(`/sop/printer/${isiTambah.masalah.id}`, adm, 'DELETE');
cek('admin dapat menghapus masalah', dihapus.status === 200, dihapus.status);
cek('jumlah masalah kembali seperti semula',
  (await json('/sop/printer', adm)).masalah.length === jumlahSblm, 'tidak kembali');
cek('masalah yang dihapus ikut hilang dari basis pengetahuan',
  !JSON.parse(fs.readFileSync(process.env.KB_FILE, 'utf-8'))
    .masalah.some((m) => m.id === isiTambah.masalah.id), 'masih ada');

const setelahHapus = await uji(adm, KELUHAN_BARU);
cek('pencocokan ikut melupakannya', setelahHapus.masalah?.id !== isiTambah.masalah.id, setelahHapus);

// SOP Printer & Windows yang sudah lengkap tiga solusi per masalah ringan
// tidak boleh rusak oleh seluruh rangkaian penyuntingan di atas.
const akhir = JSON.parse(fs.readFileSync(process.env.KB_FILE, 'utf-8'));
const swalayan = akhir.masalah.filter(
  (m) => ['printer', 'windows'].includes(m.divisi) && m.kategori === 'ringan'
);
cek('seluruh masalah ringan divisi swalayan tetap punya tiga solusi',
  swalayan.every((m) => m.solusi.length === 3), swalayan.filter((m) => m.solusi.length !== 3).map((m) => m.id));
cek('jumlah masalah tetap 44', akhir.masalah.length === 44, akhir.masalah.length);

bagian('8. Layanan swalayan tidak boleh kehabisan masalah');

// SENGAJA paling akhir: pemeriksaan ini menghabiskan isi SOP Printer, sehingga
// menaruhnya lebih dulu akan merusak seluruh pemeriksaan keutuhan di atas.
// Berkas yang disentuh adalah SALINAN sementara, bukan knowledge-base asli.
//
// Layanan yang kehabisan masalah tetap menjanjikan panduan bertahap kepada
// pengguna, sementara tidak ada satu pun langkah yang dapat diberikan — janji
// yang tidak pernah ditepati, disampaikan dengan yakin.
const semuaPrinter = (await json('/sop/printer', adm)).masalah;
for (const m of semuaPrinter.slice(0, -1)) {
  await kirim(`/sop/printer/${m.id}`, adm, 'DELETE');
}

const terakhir = (await json('/sop/printer', adm)).masalah;
cek('tersisa tepat satu masalah', terakhir.length === 1, terakhir.length);

const hapusTerakhir = await kirim(`/sop/printer/${terakhir[0].id}`, adm, 'DELETE');
cek('masalah TERAKHIR pada layanan swalayan menolak dihapus',
  hapusTerakhir.status === 409, hapusTerakhir.status);
cek('masalahnya benar-benar masih ada setelah penolakan',
  (await json('/sop/printer', adm)).masalah.length === 1, 'ikut terhapus');
catatan('layanan tanpa SOP tetap berjanji memandu, lalu tidak memberi apa pun');

selesai('sop');
