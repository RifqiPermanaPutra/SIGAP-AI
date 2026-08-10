/**
 * Buang baris sesi yang terbentuk hanya karena halaman dibuka.
 *
 * LATAR BELAKANG
 * Sampai perbaikan pada `src/App.jsx`, sesi dibuat saat komponen dimuat —
 * bahkan sementara pengguna masih berada di beranda dan belum menekan apa pun.
 * Setiap pembukaan halaman karenanya menyisipkan satu baris ke `sesi`, membakar
 * satu nomor tiket, dan menulis satu pesan sambutan ke `pesan`.
 *
 * Pada basis data nyata, 69 dari 83 baris terbentuk seperti itu. Akibatnya:
 *   - "Total laporan" pada rekap menghitung KUNJUNGAN, bukan laporan
 *   - "Ditinggalkan" nyaris tidak bermakna, karena didominasi baris kosong
 *   - nomor tiket terbakar: laporan sungguhan ketiga pada satu hari bisa
 *     bernomor SGP-…-0047, terbaca seolah terjadi 47 gangguan hari itu
 *
 * PENANDA YANG DIPAKAI
 * Sengaja ketat berlapis — sebuah baris hanya dibuang bila TIDAK ADA jejak
 * manusia sama sekali padanya:
 *
 *   keluhan kosong          pengguna tidak pernah mengetik apa pun
 *   divisi_id kosong        layanan tidak pernah dipilih
 *   nama kosong             formulir pelapor tidak pernah diisi
 *   diteruskan_pada kosong  tidak pernah berpindah tangan ke engineer
 *   ditangani_pada kosong   tidak pernah disentuh engineer
 *   tanpa pesan 'user'      tidak ada satu pun kalimat dari pengguna
 *
 * Pemeriksaan terakhir itu yang paling menentukan: selama ada satu saja pesan
 * berperan 'user', barisnya dipertahankan meski kolom lain kosong.
 *
 * Baris `pesan` miliknya ikut terbuang lewat ON DELETE CASCADE, dan itulah
 * sebabnya `PRAGMA foreign_keys = ON` pada init.js penting di sini.
 *
 * PEMAKAIAN
 *   node scripts/bersihkan-sesi-kosong.js              # hanya melihat
 *   node scripts/bersihkan-sesi-kosong.js --terapkan   # benar-benar menghapus
 *
 * Sengaja TIDAK dijalankan otomatis saat server menyala. Menghapus baris
 * adalah tindakan yang tidak dapat dibatalkan; ia harus terlihat dan
 * disengaja, bukan efek samping dari memutakhirkan kode.
 *
 * Cadangkan lebih dulu: `npm run cadangkan`.
 */
import 'dotenv/config';
import { initDatabase, wajibSiap, tutupDatabase } from '../server/database/init.js';

const TERAPKAN = process.argv.includes('--terapkan');

const PENANDA = `
  keluhan IS NULL
  AND divisi_id IS NULL
  AND nama IS NULL
  AND diteruskan_pada IS NULL
  AND ditangani_pada IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM pesan p WHERE p.sesi_id = sesi.id AND p.peran = 'user'
  )
`;

await initDatabase();
const db = wajibSiap();

const calon = db.prepare(`
  SELECT tanggal_wib, COUNT(*) AS jumlah
  FROM sesi WHERE ${PENANDA}
  GROUP BY tanggal_wib ORDER BY tanggal_wib
`).all();

const total = calon.reduce((n, b) => n + b.jumlah, 0);
const seluruhnya = db.prepare('SELECT COUNT(*) AS n FROM sesi').get().n;

console.log('');
console.log('════════════════════════════════════════════════════════════');
console.log(' Pembersihan sesi yang terbentuk tanpa jejak manusia');
console.log('════════════════════════════════════════════════════════════');
console.log('');

if (total === 0) {
  console.log('✅ Tidak ada baris seperti itu — basis data sudah bersih.');
  console.log('');
  tutupDatabase();
  process.exit(0);
}

console.log(`Ditemukan ${total} dari ${seluruhnya} baris (${Math.round((total / seluruhnya) * 100)}%):`);
console.log('');
for (const b of calon) {
  console.log(`  ${b.tanggal_wib}   ${String(b.jumlah).padStart(3)} baris`);
}

const pesanIkut = db.prepare(`
  SELECT COUNT(*) AS n FROM pesan
  WHERE sesi_id IN (SELECT id FROM sesi WHERE ${PENANDA})
`).get().n;

console.log('');
console.log(`Ikut terbuang: ${pesanIkut} baris pesan (sambutan otomatis).`);
console.log('');
console.log('Yang TETAP disimpan: setiap baris yang punya keluhan, layanan,');
console.log('nama pelapor, jejak eskalasi, atau satu saja pesan dari pengguna.');
console.log('');

if (!TERAPKAN) {
  console.log('ℹ️  Mode melihat saja — belum ada yang dihapus.');
  console.log('   Cadangkan dulu:  npm run cadangkan');
  console.log('   Lalu jalankan:   node scripts/bersihkan-sesi-kosong.js --terapkan');
  console.log('');
  tutupDatabase();
  process.exit(0);
}

// Satu transaksi: bila terputus di tengah, tidak ada yang setengah terhapus.
db.exec('BEGIN IMMEDIATE');
let dibuang = 0;
try {
  dibuang = db.prepare(`DELETE FROM sesi WHERE ${PENANDA}`).run().changes;
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}

const tersisa = db.prepare('SELECT COUNT(*) AS n FROM sesi').get().n;

console.log(`✅ ${dibuang} baris dihapus — tersisa ${tersisa} laporan sungguhan.`);
console.log('');
console.log('   Nomor tiket baru melanjutkan hitungan harian yang sudah ada,');
console.log('   jadi nomor lama TIDAK dipakai ulang.');
console.log('   Muat ulang halaman /rekap untuk melihat angkanya.');
console.log('');

tutupDatabase();
