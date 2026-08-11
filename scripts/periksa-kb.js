/**
 * Periksa server/data/knowledge-base.json terhadap kontraknya.
 *
 * KENAPA ADA
 * Berkas JSON itu satu-satunya sumber jawaban saat server berjalan. Bila
 * isinya cacat, sistem TETAP MENYALA dan terlihat sehat — yang berubah hanya
 * jawabannya: masalah yang rusak tidak pernah tercocokkan, dan pengguna
 * diteruskan ke engineer tanpa penjelasan. Tidak ada pesan galat pada rantai
 * itu, dan itulah sebabnya pemeriksaan ini perlu dijalankan sengaja.
 *
 * Aturan yang diperiksa berasal dari kode yang benar-benar membacanya, bukan
 * dari selera:
 *
 *   answerService.js   MAKS_SOLUSI = 3, AMBANG_COCOK = 0,4
 *   divisi.js          delapan id layanan yang sah
 *   sopJson.js         bentuk berkas sumber dan aturan medannya
 *   RANCANGAN-DATA.md  masalah_cocok merujuk id — id tidak boleh kembar
 *
 * Sengaja TANPA pustaka JSON Schema. Menambah dependensi hanya untuk
 * memeriksa satu berkas melanggar batas empat dependensi proyek ini, dan
 * aturannya cukup sedikit untuk ditulis langsung.
 *
 * PEMAKAIAN
 *   node scripts/periksa-kb.js
 *   node scripts/periksa-kb.js --diam     # hanya keluar dengan kode status
 *
 * Keluar dengan status 1 bila ada yang cacat, sehingga dapat dipakai sebagai
 * penjaga sebelum menyebarkan.
 */
import fs from 'fs';
import { KB_FILE } from '../server/config/jalur.js';
import { DIVISI_ID } from '../server/config/divisi.js';

const DIAM = process.argv.includes('--diam');
const MAKS_SOLUSI = 3;
const AWALAN_SOLUSI = ['Solusi Pertama', 'Solusi Kedua', 'Solusi Ketiga'];
const JUDUL_TUNGGAL = 'Langkah Penyelesaian';

const cacat = [];
const peringatan = [];

const salah = (id, pesan) => cacat.push({ id, pesan });
const ingatkan = (id, pesan) => peringatan.push({ id, pesan });

/* ── Muat ──────────────────────────────────────────────────────── */

if (!fs.existsSync(KB_FILE)) {
  console.error(`❌ Berkas tidak ada: ${KB_FILE}`);
  console.error('   Jalankan: npm run build:kb');
  process.exit(1);
}

let kb;
try {
  kb = JSON.parse(fs.readFileSync(KB_FILE, 'utf-8'));
} catch (e) {
  console.error(`❌ JSON tidak dapat diurai: ${e.message}`);
  process.exit(1);
}

if (!Array.isArray(kb.masalah)) {
  console.error('❌ Medan "masalah" tidak ada atau bukan larik.');
  process.exit(1);
}

/* ── Periksa tiap masalah ──────────────────────────────────────── */

const idTerlihat = new Map();

for (const [i, m] of kb.masalah.entries()) {
  const nama = m.id || `(masalah ke-${i + 1} tanpa id)`;

  // Id — dipakai kolom sesi.masalah_cocok, jadi kembar berarti dua laporan
  // merujuk hal yang berbeda dengan nama yang sama.
  if (!m.id) salah(nama, 'tidak punya id');
  else if (idTerlihat.has(m.id)) salah(m.id, `id kembar dengan masalah ke-${idTerlihat.get(m.id) + 1}`);
  else idTerlihat.set(m.id, i);

  if (m.id && m.divisi && !m.id.startsWith(`${m.divisi}-`)) {
    salah(nama, `id tidak berawalan "${m.divisi}-" — pencocokan menyaring per layanan`);
  }

  // Layanan
  if (!DIVISI_ID.includes(m.divisi)) {
    salah(nama, `divisi "${m.divisi}" tidak dikenal. Pilihan: ${DIVISI_ID.join(', ')}`);
  }

  // Teks yang menentukan pencocokan
  if (!String(m.judul || '').trim()) salah(nama, 'judul kosong — bobot pencocokan terberat (3×)');
  if (!String(m.gejala || '').trim()) ingatkan(nama, 'gejala kosong — bobot 2×, paling menentukan setelah judul');
  if (!Array.isArray(m.penyebab)) salah(nama, 'penyebab bukan larik');

  // Kategori dan konsekuensinya
  if (!['ringan', 'berat'].includes(m.kategori)) {
    salah(nama, `kategori "${m.kategori}" tidak sah — hanya "ringan" atau "berat"`);
  }

  const solusi = Array.isArray(m.solusi) ? m.solusi : null;
  if (!solusi) salah(nama, 'solusi bukan larik');

  if (m.kategori === 'ringan') {
    if (solusi && solusi.length === 0) {
      salah(nama, 'masalah RINGAN tanpa solusi — ditawarkan ke pengguna lalu tidak memberi langkah apa pun');
    }
    if (m.penanganan) ingatkan(nama, 'masalah ringan tidak memakai medan penanganan');
    if (solusi && solusi.length > MAKS_SOLUSI) {
      salah(nama, `${solusi.length} solusi, maksimal ${MAKS_SOLUSI} — antarmuka menjanjikan tiga percobaan`);
    }
  }

  if (m.kategori === 'berat') {
    if (solusi && solusi.length > 0) {
      salah(nama, 'masalah BERAT tidak boleh punya solusi mandiri');
    }
    if (!String(m.penanganan || '').trim()) {
      salah(nama, 'masalah BERAT tanpa penanganan — pengguna tidak diberi keterangan apa pun');
    }
  }

  // Bentuk tiap solusi
  for (const [n, s] of (solusi || []).entries()) {
    const label = `${nama} → solusi ${n + 1}`;
    if (!String(s?.judul || '').trim()) salah(label, 'judul solusi kosong');
    if (!Array.isArray(s?.langkah) || s.langkah.length === 0) {
      salah(label, 'tanpa satu pun langkah');
    } else if (s.langkah.some((l) => !String(l || '').trim())) {
      salah(label, 'ada langkah yang kosong');
    }

    // Awalan judul dibaca ulang oleh pengurai saat menyusun Markdown kembali.
    if (solusi.length === 1 && s.judul !== JUDUL_TUNGGAL) {
      ingatkan(label, `solusi tunggal biasanya berjudul "${JUDUL_TUNGGAL}"`);
    }
    if (solusi.length > 1 && !AWALAN_SOLUSI.some((a) => String(s.judul || '').startsWith(a))) {
      ingatkan(label, `judul tidak berawalan "${AWALAN_SOLUSI[n] || 'Solusi ...'}: "`);
    }
  }

  // Kata kunci dibangun otomatis; kosong berarti masalah ini mustahil ditemukan
  if (!Array.isArray(m.kataKunci) || m.kataKunci.length === 0) {
    salah(nama, 'kataKunci kosong — masalah ini tidak akan pernah tercocokkan. Jalankan npm run build:kb');
  }
}

/* ── Ringkasan per layanan ─────────────────────────────────────── */

const per = {};
for (const m of kb.masalah) {
  per[m.divisi] ??= { ringan: 0, berat: 0, 'solusi<3': 0 };
  if (m.kategori === 'ringan' || m.kategori === 'berat') per[m.divisi][m.kategori]++;
  if (m.kategori === 'ringan' && (m.solusi || []).length < MAKS_SOLUSI) per[m.divisi]['solusi<3']++;
}

/* ── Laporan ───────────────────────────────────────────────────── */

if (!DIAM) {
  console.log('');
  console.log('════════════════════════════════════════════════════════════');
  console.log(' Pemeriksaan basis pengetahuan');
  console.log('════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Berkas  : ${KB_FILE}`);
  console.log(`  Dibangun: ${kb.dibuatPada || '(tidak tercatat)'}`);
  console.log(`  Masalah : ${kb.masalah.length}`);
  console.log('');
  console.table(per);

  if (peringatan.length > 0) {
    console.log(`\n⚠️  ${peringatan.length} peringatan (tidak menggagalkan):`);
    for (const p of peringatan) console.log(`   · ${p.id}\n     ${p.pesan}`);
  }

  if (cacat.length > 0) {
    console.log(`\n❌ ${cacat.length} cacat:`);
    for (const c of cacat) console.log(`   · ${c.id}\n     ${c.pesan}`);
    console.log('');
  } else {
    console.log('\n✅ Basis pengetahuan sah — seluruh aturan kontrak terpenuhi.');
    console.log('   Kontraknya: server/data/knowledge-base.schema.json\n');
  }
}

process.exit(cacat.length > 0 ? 1 : 0);
