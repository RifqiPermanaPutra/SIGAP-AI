/**
 * Perbaiki status laporan lama yang terlanjur tertulis 'diteruskan'.
 *
 * LATAR BELAKANG
 * Sebelum perbaikan pada `server/routes/chat.js`, status 'diteruskan' disetel
 * begitu sistem MENAWARKAN bantuan engineer — bukan saat laporan benar-benar
 * berpindah tangan. Akibatnya basis data memuat baris berstatus 'diteruskan'
 * yang tidak punya nama pelapor, fungsi, lokasi, area, maupun engineer tujuan,
 * karena formulirnya memang tidak pernah dikirim.
 *
 * Baris seperti itu merugikan tiga kali:
 *   - muncul di halaman /tugas sebagai tiket yang tidak dapat ditangani wajar
 *   - mengecilkan persentase selesai mandiri, karena penyebutnya ikut
 *     menghitung pengguna yang tidak pernah menghubungi siapa pun
 *   - tampil di rekap sebagai baris dengan Pelapor, Lokasi, dan Area kosong
 *
 * YANG DILAKUKAN
 * Baris yang cocok dikembalikan menjadi 'ditinggalkan' — yang memang terjadi:
 * pengguna ditawari bantuan engineer lalu pergi. Waktu penawarannya
 * dipindahkan ke `eskalasi_ditawarkan_pada` supaya tidak hilang, dan
 * `diteruskan_pada` dikosongkan karena peristiwa itu tidak pernah terjadi.
 * `berakhir_pada` dibiarkan: untuk status 'ditinggalkan' artinya "jam aktivitas
 * terakhir", dan itu memang jam yang tersimpan di sana.
 *
 * PENANDA YANG DIPAKAI
 * `nama IS NULL AND engineer_tujuan IS NULL`. Eskalasi yang sungguhan selalu
 * melewati POST /api/chat/reporter lalu /escalate, sehingga keduanya terisi.
 *
 * PEMAKAIAN
 *   node scripts/perbaiki-status-diteruskan.js              # hanya melihat
 *   node scripts/perbaiki-status-diteruskan.js --terapkan   # benar-benar mengubah
 *
 * Sengaja TIDAK dijalankan otomatis saat server menyala. Menulis ulang status
 * laporan yang sudah tersimpan adalah tindakan yang harus terlihat dan
 * disengaja, bukan efek samping dari memutakhirkan kode.
 */
import 'dotenv/config';
import { initDatabase, wajibSiap, tutupDatabase } from '../server/database/init.js';

const TERAPKAN = process.argv.includes('--terapkan');

const PENANDA = `
  status = 'diteruskan'
  AND ditangani_pada IS NULL
  AND nama IS NULL
  AND engineer_tujuan IS NULL
`;

await initDatabase();

const calon = wajibSiap().prepare(`
  SELECT nomor_tiket, tanggal_wib, divisi_id, diteruskan_pada, substr(keluhan, 1, 60) AS keluhan
  FROM sesi WHERE ${PENANDA}
  ORDER BY dibuat_pada
`).all();

console.log('');
console.log('════════════════════════════════════════════════════════════');
console.log(' Perbaikan status laporan "diteruskan" tanpa data pelapor');
console.log('════════════════════════════════════════════════════════════');
console.log('');

if (calon.length === 0) {
  console.log('✅ Tidak ada baris yang perlu diperbaiki.');
  console.log('');
  tutupDatabase();
  process.exit(0);
}

console.log(`Ditemukan ${calon.length} baris:`);
console.log('');
for (const c of calon) {
  console.log(`  ${c.nomor_tiket}  ${c.tanggal_wib}  ${String(c.divisi_id || '—').padEnd(8)} ${JSON.stringify(c.keluhan)}`);
}
console.log('');
console.log('Akan diubah menjadi: status = ditinggalkan');
console.log('                     eskalasi_ditawarkan_pada ← diteruskan_pada');
console.log('                     diteruskan_pada ← kosong');
console.log('');

if (!TERAPKAN) {
  console.log('ℹ️  Mode melihat saja — belum ada yang diubah.');
  console.log('   Jalankan ulang dengan --terapkan untuk benar-benar mengubahnya.');
  console.log('');
  tutupDatabase();
  process.exit(0);
}

// Waktu penawaran diambil dari diteruskan_pada, yang di kode lama memang
// disetel pada saat penawaran itu terjadi.
const { changes } = wajibSiap().prepare(`
  UPDATE sesi
  SET status = 'ditinggalkan',
      eskalasi_ditawarkan_pada = COALESCE(eskalasi_ditawarkan_pada, diteruskan_pada),
      diteruskan_pada = NULL
  WHERE ${PENANDA}
`).run();

console.log(`✅ ${changes} baris diperbaiki.`);
console.log('');
console.log('   Muat ulang halaman /rekap dan /tugas untuk melihat hasilnya.');
console.log('');

tutupDatabase();
