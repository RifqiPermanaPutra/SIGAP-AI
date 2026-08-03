/**
 * Pembangun Basis Pengetahuan (tanpa AI)
 *
 * Mengubah berkas SOP berformat Markdown menjadi satu berkas JSON terstruktur
 * yang dipakai langsung oleh aplikasi untuk menjawab keluhan pengguna.
 *
 * Tidak ada embedding maupun panggilan ke layanan AI. Pencocokan keluhan
 * dilakukan dengan kata kunci, sehingga jawaban selalu sama untuk pertanyaan
 * yang sama, dapat berjalan tanpa internet, dan tidak mungkin mengarang.
 *
 * Jalankan: npm run build:kb
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { STOPWORDS, SINONIM, normalisasi, tokenisasi } from '../server/services/teksUtil.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KB_DIR = path.join(__dirname, '..', 'knowledge-base');
const OUT_FILE = path.join(__dirname, '..', 'server', 'data', 'knowledge-base.json');

// Nama folder pada knowledge-base/ dipetakan ke id divisi yang dipakai aplikasi
const FOLDER_KE_DIVISI = {
  printer: 'printer',
  cctv: 'cctv',
  telepon: 'telepon',
  'radio-komunikasi': 'radio',
  windows: 'windows',
  fttp: 'fttp',
  lan: 'lan',
  wan: 'wan'
};

/** Ubah judul menjadi id yang aman dipakai, contoh "Printer Offline" -> "printer-offline" */
function buatId(divisi, judul) {
  const potongan = judul
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join('-');
  return `${divisi}-${potongan}`;
}

/**
 * Urai satu blok masalah (satu bagian yang diawali "## ") menjadi objek.
 * @returns {object|null} null bila blok bukan blok masalah
 */
function uraiBlok(divisi, blok) {
  const baris = blok.split('\n');
  const judul = baris[0].trim();

  // Blok catatan dan judul berkas bukan blok masalah
  if (!judul || /^Catatan Konfirmasi Engineer$/i.test(judul)) return null;

  const ambilBagian = (namaBagian) => {
    const pola = new RegExp(`###\\s*${namaBagian}[^\\n]*\\n([\\s\\S]*?)(?=\\n###|$)`, 'i');
    const cocok = blok.match(pola);
    return cocok ? cocok[1].trim() : '';
  };

  const gejala = ambilBagian('Gejala yang Dirasakan User');
  const penyebabTeks = ambilBagian('Penyebab yang Mungkin Terjadi');
  const kategoriTeks = ambilBagian('Kategori');
  const penanganan = ambilBagian('Penanganan');

  const penyebab = penyebabTeks
    .split('\n')
    .map((b) => b.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean);

  // Kumpulkan seluruh bagian "Solusi ..." berikut langkah-langkahnya
  const solusi = [];
  const polaSolusi = /###\s*(Solusi[^\n]*)\n([\s\S]*?)(?=\n###|$)/gi;
  let m;
  while ((m = polaSolusi.exec(blok)) !== null) {
    const judulSolusi = m[1].trim();
    const isi = m[2];

    const langkah = isi
      .split('\n')
      .map((b) => b.trim())
      .filter((b) => /^\d+[.)]\s+/.test(b))
      .map((b) => b.replace(/^\d+[.)]\s*/, '').trim());

    // Kalimat pengantar sebelum daftar langkah, bila ada
    const pengantar = isi
      .split('\n')
      .filter((b) => b.trim() && !/^\d+[.)]\s+/.test(b.trim()))
      .join(' ')
      .trim();

    if (langkah.length > 0) {
      solusi.push({ judul: judulSolusi, pengantar: pengantar || null, langkah });
    }
  }

  // Blok tanpa bagian "Solusi" memakai daftar langkah biasa, bila ada
  if (solusi.length === 0) {
    const langkahTeks = ambilBagian('Langkah Penyelesaian');
    const langkah = langkahTeks
      .split('\n')
      .map((b) => b.trim())
      .filter((b) => /^\d+[.)]\s+/.test(b))
      .map((b) => b.replace(/^\d+[.)]\s*/, '').trim());
    if (langkah.length > 0) {
      solusi.push({ judul: 'Langkah Penyelesaian', pengantar: null, langkah });
    }
  }

  const kategori = /berat/i.test(kategoriTeks) ? 'berat' : 'ringan';

  // Kata kunci diambil dari judul, gejala, dan penyebab. Bagian inilah yang
  // dicocokkan dengan kalimat keluhan pengguna.
  const sumberKunci = [judul, gejala, ...penyebab].join(' ');
  const kataKunci = [...new Set(tokenisasi(sumberKunci))];

  return {
    id: buatId(divisi, judul),
    divisi,
    judul,
    gejala,
    kategori,
    penyebab,
    solusi,
    penanganan: penanganan || null,
    kataKunci
  };
}

function bangun() {
  const hasil = { dibuatPada: new Date().toISOString(), masalah: [] };
  let totalSolusi = 0;

  for (const folder of fs.readdirSync(KB_DIR)) {
    const divisi = FOLDER_KE_DIVISI[folder];
    if (!divisi) continue; // lewati berkas template dan folder lain

    const dir = path.join(KB_DIR, folder);
    if (!fs.statSync(dir).isDirectory()) continue;

    for (const berkas of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      const isi = fs.readFileSync(path.join(dir, berkas), 'utf-8');
      // Bagian pertama adalah judul berkas, bukan blok masalah
      const blok = isi.split(/\n## /).slice(1);

      let jumlah = 0;
      for (const b of blok) {
        const masalah = uraiBlok(divisi, b);
        if (!masalah) continue;
        hasil.masalah.push(masalah);
        totalSolusi += masalah.solusi.length;
        jumlah++;
      }
      console.log(`  ${divisi.padEnd(9)} ${String(jumlah).padStart(2)} masalah  (${berkas})`);
    }
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(hasil, null, 2), 'utf-8');

  const ukuran = (fs.statSync(OUT_FILE).size / 1024).toFixed(0);
  console.log('');
  console.log(`Total : ${hasil.masalah.length} masalah, ${totalSolusi} solusi`);
  console.log(`Berkas: ${path.relative(process.cwd(), OUT_FILE)} (${ukuran} KB)`);
}

console.log('Membangun basis pengetahuan dari berkas SOP...\n');
bangun();
