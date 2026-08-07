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
import {
  uraiBerkas, susunBerkas, susunBlok, uraiBlok,
  berpemisah, bentukUntukPenyunting
} from '../server/services/sopParser.js';

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
cek('awalan "Solusi Pertama:" dilepas dari judul solusi',
  !/^Solusi (Pertama|Kedua|Ketiga)/i.test(macet.solusi[0].judul), macet.solusi[0].judul);

const berat = printer.masalah.find((m) => m.kategori === 'berat');
cek('masalah berat memakai penanganan, bukan daftar solusi',
  berat.solusi.length === 0 && Boolean(berat.penanganan), berat.penanganan);

cek('catatan [KONFIRMASI] terbaca terpisah', printer.catatan.butir.length > 0, printer.catatan);
cek('penanda [KONFIRMASI] tidak bocor ke dalam blok masalah',
  !JSON.stringify(printer.masalah).includes('[KONFIRMASI]'), 'ada yang bocor');
catatan(`${printer.catatan.butir.length} penanda [KONFIRMASI] pada SOP printer`);

bagian('3. Markdown hasil penyunting dapat diurai ulang');

let blokDiperiksa = 0;
let blokGagal = 0;
let berkasGagal = 0;

for (const folder of fs.readdirSync(SOP_DIR)) {
  const dir = path.join(SOP_DIR, folder);
  if (!fs.statSync(dir).isDirectory()) continue;
  const divisi = folder === 'radio-komunikasi' ? 'radio' : folder;

  for (const berkas of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const isi = fs.readFileSync(path.join(dir, berkas), 'utf-8');
    const dokumen = uraiBerkas(divisi, isi);

    if (susunBerkas(dokumen) !== isi) berkasGagal++;

    for (const b of dokumen.blok) {
      if (!b.masalah) continue;
      blokDiperiksa++;
      const markdownBaru = susunBlok(bentukUntukPenyunting(b.masalah), berpemisah(b.mentah));
      if (JSON.stringify(uraiBlok(divisi, markdownBaru)) !== JSON.stringify(b.masalah)) {
        blokGagal++;
      }
    }
  }
}

cek('urai lalu susun menghasilkan berkas yang identik', berkasGagal === 0, `${berkasGagal} berkas berbeda`);
cek('setiap blok masalah bertahan bolak-balik tanpa berubah', blokGagal === 0, `${blokGagal} blok berubah`);
catatan(`${blokDiperiksa} blok masalah diperiksa bolak-balik`);

bagian('4. Menyimpan suntingan');

// Kata yang belum pernah muncul di SOP printer mana pun. Bila setelah disimpan
// keluhan yang memuatnya langsung dijawab, berarti basis pengetahuan di memori
// benar-benar dimuat ulang — bukan sekadar berkasnya yang berubah.
const KATA_BARU = 'zebra';
const KELUHAN_UJI = `printer muncul tulisan ${KATA_BARU}`;

const sebelum = await uji(adm, KELUHAN_UJI);
cek('sebelum disunting, keluhan itu belum dikenali', sebelum.dijawab === false, sebelum);

const asli = JSON.parse(JSON.stringify(macet));
const disunting = {
  ...asli,
  // Judul sengaja diubah untuk memastikan server MENGABAIKANNYA: judul
  // menentukan id, dan id yang berubah diam-diam memutus rujukan rekap.
  judul: 'Judul Yang Tidak Boleh Ikut Berubah',
  gejala: `${asli.gejala} Pada layar printer muncul tulisan ${KATA_BARU}.`
};

const simpan = await kirim(`/sop/printer/${asli.id}`, adm, 'PUT', disunting).then((r) => r.json());
cek('admin dapat menyimpan suntingan', simpan.success === true, simpan);
cek('id masalah tidak ikut berubah', simpan.masalah.id === asli.id, simpan.masalah?.id);
cek('judul tidak dapat diubah lewat penyunting',
  simpan.masalah.judul === asli.judul, simpan.masalah?.judul);
cek('cadangan dibuat sebelum menimpa', Boolean(simpan.cadangan), simpan.cadangan);
cek('basis pengetahuan dibangun ulang', simpan.kb.masalah === 44, simpan.kb);

const berkasSop = path.join(SOP_DIR, 'printer', 'sop-printer.md');
const isiBaru = fs.readFileSync(berkasSop, 'utf-8');
cek('berkas Markdown benar-benar berubah', isiBaru.includes(KATA_BARU), 'kata baru tidak ada');
cek('berkas tetap dapat diurai pengurai build-kb',
  uraiBerkas('printer', isiBaru).blok.filter((b) => b.masalah).length === 6,
  uraiBerkas('printer', isiBaru).blok.filter((b) => b.masalah).length);
cek('blok lain tidak ikut diformat ulang',
  isiBaru.includes('### Solusi Ketiga: Hapus Printer lalu Tambahkan Kembali'),
  'blok tetangga berubah');

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

// SOP Printer & Windows yang sudah lengkap tiga solusi per masalah ringan
// tidak boleh rusak oleh seluruh rangkaian penyuntingan di atas.
const akhir = JSON.parse(fs.readFileSync(process.env.KB_FILE, 'utf-8'));
const swalayan = akhir.masalah.filter(
  (m) => ['printer', 'windows'].includes(m.divisi) && m.kategori === 'ringan'
);
cek('seluruh masalah ringan divisi swalayan tetap punya tiga solusi',
  swalayan.every((m) => m.solusi.length === 3), swalayan.filter((m) => m.solusi.length !== 3).map((m) => m.id));
cek('jumlah masalah tetap 44', akhir.masalah.length === 44, akhir.masalah.length);

selesai('sop');
