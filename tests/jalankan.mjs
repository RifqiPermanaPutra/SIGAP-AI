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

const LINGKUNGAN = {
  ...process.env,
  DB_PATH: DB,
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

/* ──────────────────────────────────────────────────────────── */

console.log('═══ Pengujian SIGAP AI ═══');
console.log(`Basis data sementara: ${DB}`);

let kodeAkhir = 0;

// 1. Lapisan penyimpanan — berdiri sendiri, tidak perlu server
kodeAkhir |= await jalankanBerkas('basisdata.test.mjs');

// 2. Data contoh untuk pengujian lewat HTTP
process.env.DB_PATH = DB;
const { isiDataContoh } = await import('./benih.mjs');
const jumlah = await isiDataContoh();
console.log(`\n📦 ${jumlah} laporan contoh disiapkan`);

// 3. Server uji
server = spawn(process.execPath, [path.join(AKAR, 'server.js')], {
  cwd: AKAR, env: LINGKUNGAN, stdio: ['ignore', 'ignore', 'inherit']
});

if (!(await tungguServer())) {
  console.error(`\n❌ Server uji tidak menyala pada porta ${PORT}.`);
  console.error('   Pastikan porta tersebut tidak sedang dipakai, atau setel UJI_PORT.');
  process.exit(1);
}

kodeAkhir |= await jalankanBerkas('api.test.mjs');

server.kill();

console.log(kodeAkhir === 0
  ? '═══ ✅ SELURUH PENGUJIAN LULUS ═══\n'
  : '═══ ❌ ADA PENGUJIAN YANG GAGAL ═══\n');

process.exit(kodeAkhir === 0 ? 0 : 1);
