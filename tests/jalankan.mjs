/**
 * Penjalan pengujian — `npm test`.
 *
 * Menyiapkan basis data sementara, menjalankan server uji pada porta
 * tersendiri, menjalankan seluruh berkas uji, lalu membereskan semuanya.
 * Basis data dan berkas nyata tidak pernah disentuh.
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AKAR = path.join(__dirname, '..');

const PORT = process.env.UJI_PORT || 3999;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sigap-uji-'));
const DB = path.join(tmp, 'uji.db');

/**
 * Berkas SOP disalin ke folder sementara sebelum pengujian dimulai.
 *
 * Pengujian penyunting SOP benar-benar MENULIS ke berkas Markdown — itulah
 * yang diuji. Membiarkannya menulis ke `knowledge-base/` sungguhan berarti
 * `npm test` menyunting dokumen sumber milik pengembang, dan kegagalan di
 * tengah jalan meninggalkannya dalam keadaan setengah berubah.
 */
const SOP_UJI = path.join(tmp, 'knowledge-base');
const KB_UJI = path.join(tmp, 'knowledge-base.json');
fs.cpSync(path.join(AKAR, 'knowledge-base'), SOP_UJI, { recursive: true });

const LINGKUNGAN = {
  ...process.env,
  DB_PATH: DB,
  SOP_DIR: SOP_UJI,
  KB_FILE: KB_UJI,
  PORT: String(PORT),
  UJI_PORT: String(PORT),
  // Rahasia tetap supaya sesi tidak putus di tengah pengujian
  SESSION_SECRET: 'rahasia-pengujian-tetap',
  // Nomor WhatsApp semu agar peringatan divisi tanpa nomor tidak muncul
  WHATSAPP_DEFAULT: '628123456789'
};

let server = null;

function bersihkan() {
  if (server && !server.killed) server.kill();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* biarkan */ }
}
process.on('exit', bersihkan);
process.on('SIGINT', () => { bersihkan(); process.exit(130); });

/** Jalankan satu berkas uji, kembalikan kode keluarnya */
function jalankanBerkas(berkas) {
  return new Promise((selesaikan) => {
    const anak = spawn(process.execPath, [path.join(__dirname, berkas)], {
      cwd: AKAR, env: LINGKUNGAN, stdio: 'inherit'
    });
    anak.on('exit', (kode) => selesaikan(kode ?? 1));
  });
}

/** Tunggu server menjawab, maksimal 15 detik */
async function tungguServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/api/health`);
      if (r.ok) return true;
    } catch { /* belum siap */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

/**
 * Pastikan tidak ada server lain yang sudah memakai porta uji.
 *
 * Tanpa pemeriksaan ini, server uji gagal mengikat porta tetapi penjalan tetap
 * menemukan jawaban dari server yang sudah ada, lalu menjalankan seluruh
 * pengujian terhadap basis data yang keliru. Hasilnya sekumpulan kegagalan yang
 * menyesatkan — tampak seperti kerusakan kode, padahal salah sasaran.
 */
async function portaTerpakai() {
  try {
    const r = await fetch(`http://localhost:${PORT}/api/health`, {
      signal: AbortSignal.timeout(1500)
    });
    return r.ok;
  } catch {
    return false;
  }
}

/* ──────────────────────────────────────────────────────────── */

console.log('═══ Pengujian SIGAP ═══');
console.log(`Basis data sementara: ${DB}`);

if (await portaTerpakai()) {
  console.error(`\n❌ Porta ${PORT} sudah dipakai server lain.`);
  console.error('   Pengujian dibatalkan agar tidak menghantam basis data yang keliru.');
  console.error(`   Hentikan server tersebut, atau jalankan: UJI_PORT=4100 npm test\n`);
  process.exit(1);
}

// Basis pengetahuan sementara dibangun dari salinan SOP di atas. Pengujian
// akurasi membacanya langsung, jadi ia harus sudah ada sebelum berkas uji
// pertama dijalankan.
await new Promise((selesaikan) => {
  spawn(process.execPath, [path.join(AKAR, 'scripts', 'build-kb.js')], {
    cwd: AKAR, env: LINGKUNGAN, stdio: 'ignore'
  }).on('exit', selesaikan);
});

if (!fs.existsSync(KB_UJI)) {
  console.error('\n❌ Basis pengetahuan sementara gagal dibangun.');
  process.exit(1);
}
console.log(`Salinan SOP sementara : ${SOP_UJI}`);

let kodeAkhir = 0;

// 1. Lapisan penyimpanan — berdiri sendiri, tidak perlu server
kodeAkhir |= await jalankanBerkas('basisdata.test.mjs');

// 2. Akurasi pencocokan — membaca basis pengetahuan langsung, tanpa server
kodeAkhir |= await jalankanBerkas('akurasi.test.mjs');

// 3. Data contoh untuk pengujian lewat HTTP
process.env.DB_PATH = DB;
const { isiDataContoh } = await import('./benih.mjs');
const jumlah = await isiDataContoh();
console.log(`\n📦 ${jumlah} laporan contoh disiapkan`);

// 4. Server uji
server = spawn(process.execPath, [path.join(AKAR, 'server.js')], {
  cwd: AKAR, env: LINGKUNGAN, stdio: ['ignore', 'ignore', 'inherit']
});

if (!(await tungguServer())) {
  console.error(`\n❌ Server uji tidak menyala pada porta ${PORT}.`);
  console.error('   Pastikan porta tersebut tidak sedang dipakai, atau setel UJI_PORT.');
  process.exit(1);
}

kodeAkhir |= await jalankanBerkas('api.test.mjs');

// 5. Penyunting SOP — menulis ke salinan SOP sementara, bukan berkas nyata
kodeAkhir |= await jalankanBerkas('sop.test.mjs');

// 6. Daftar tugas engineer & makna status 'diteruskan'
kodeAkhir |= await jalankanBerkas('tugas.test.mjs');

server.kill();

console.log(kodeAkhir === 0
  ? '═══ ✅ SELURUH PENGUJIAN LULUS ═══\n'
  : '═══ ❌ ADA PENGUJIAN YANG GAGAL ═══\n');

process.exit(kodeAkhir === 0 ? 0 : 1);
