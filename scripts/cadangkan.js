/**
 * Cadangkan basis data sekarang juga.
 *
 * Pencadangan sudah berjalan otomatis setiap hari selama server hidup, tetapi
 * ada saat orang ingin memastikan sendiri: sebelum memperbarui SOP, sebelum
 * menyalakan ulang komputer, atau sebelum menyerahkan sistem kepada orang lain.
 *
 * Aman dijalankan selagi server berjalan — `VACUUM INTO` menghasilkan potret
 * yang utuh tanpa mengunci layanan.
 *
 * Penggunaan:
 *   npm run cadangkan
 */
import 'dotenv/config';
import fs from 'fs';
import { initDatabase, tutupDatabase } from '../server/database/init.js';
import { cadangkanBasisData, salinCadanganKeLuar } from '../server/services/pemeliharaan.js';

await initDatabase();

const berkas = cadangkanBasisData();

if (!berkas) {
  console.error('\n❌ Pencadangan gagal. Periksa keterangan di atas.\n');
  tutupDatabase();
  process.exit(1);
}

const kb = Math.round(fs.statSync(berkas).size / 1024);
console.log(`\n✅ Cadangan dibuat: ${berkas} (${kb} KB)`);

if ((process.env.CADANGAN_LUAR || '').trim()) {
  console.log(`   Menyalin ke ${process.env.CADANGAN_LUAR} …`);
  if (salinCadanganKeLuar(berkas)) {
    console.log('✅ Salinan luar mesin berhasil.\n');
  } else {
    console.error('❌ Salinan luar mesin GAGAL — cadangan hanya ada di disk ini.\n');
    tutupDatabase();
    process.exit(1);
  }
} else {
  console.warn('\n⚠️  CADANGAN_LUAR belum diisi di .env.');
  console.warn('   Cadangan ini berada di disk yang sama dengan basis datanya,');
  console.warn('   sehingga tidak melindungi bila disknya rusak.\n');
}

tutupDatabase();
