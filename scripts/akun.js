/**
 * Pengelola akun halaman rekap.
 *
 * Sengaja berupa perkakas baris perintah, bukan halaman web: akunnya hanya
 * enam dan tetap, sehingga menyediakan halaman pendaftaran hanya menambah
 * pintu masuk tanpa manfaat.
 *
 * Penggunaan:
 *   npm run akun -- daftar
 *   npm run akun -- buat <nama-akun> "<Nama Lengkap>" <admin|engineer> <kata-sandi>
 *   npm run akun -- ganti <nama-akun> <kata-sandi-baru>
 *   npm run akun -- hapus <nama-akun>
 */
import 'dotenv/config';
import { initDatabase, tutupDatabase } from '../server/database/init.js';
import {
  daftarPengguna, buatPengguna, gantiSandi, hapusPengguna, cariPengguna
} from '../server/services/authService.js';

const [perintah, ...arg] = process.argv.slice(2);

function bantuan() {
  console.log(`
Pengelola akun SIGAP AI

  npm run akun -- daftar
      Tampilkan seluruh akun

  npm run akun -- buat <nama-akun> "<Nama Lengkap>" <admin|engineer> <kata-sandi>
      Buat akun baru. Kata sandi minimal 8 karakter.

  npm run akun -- ganti <nama-akun> <kata-sandi-baru>
      Ganti kata sandi sebuah akun

  npm run akun -- hapus <nama-akun>
      Hapus akun
`);
}

await initDatabase();

try {
  switch (perintah) {
    case 'daftar': {
      const semua = daftarPengguna();
      if (semua.length === 0) {
        console.log('Belum ada akun. Jalankan server sekali untuk membuat akun admin pertama.');
        break;
      }
      console.log(`\n${semua.length} akun terdaftar:\n`);
      console.log('  NAMA AKUN'.padEnd(20) + 'PERAN'.padEnd(12) + 'NAMA'.padEnd(26) + 'MASUK TERAKHIR');
      console.log('  ' + '─'.repeat(76));
      for (const p of semua) {
        console.log(
          '  ' + p.nama_akun.padEnd(18) +
          p.peran.padEnd(12) +
          p.nama.padEnd(26) +
          (p.masuk_terakhir ? p.masuk_terakhir.slice(0, 16).replace('T', ' ') : 'belum pernah')
        );
      }
      console.log('');
      break;
    }

    case 'buat': {
      const [namaAkun, nama, peran, sandi] = arg;
      if (!namaAkun || !nama || !peran || !sandi) {
        console.error('❌ Argumen kurang lengkap.');
        bantuan();
        process.exitCode = 1;
        break;
      }
      if (cariPengguna(namaAkun.toLowerCase())) {
        console.error(`❌ Akun "${namaAkun}" sudah ada.`);
        process.exitCode = 1;
        break;
      }
      buatPengguna({ namaAkun: namaAkun.toLowerCase(), nama, peran, sandi });
      console.log(`✅ Akun "${namaAkun}" (${peran}) dibuat.`);
      break;
    }

    case 'ganti': {
      const [namaAkun, sandiBaru] = arg;
      if (!namaAkun || !sandiBaru) {
        console.error('❌ Argumen kurang lengkap.');
        bantuan();
        process.exitCode = 1;
        break;
      }
      if (!gantiSandi(namaAkun.toLowerCase(), sandiBaru)) {
        console.error(`❌ Akun "${namaAkun}" tidak ditemukan.`);
        process.exitCode = 1;
        break;
      }
      console.log(`✅ Kata sandi "${namaAkun}" diganti.`);
      break;
    }

    case 'hapus': {
      const [namaAkun] = arg;
      if (!namaAkun) {
        console.error('❌ Nama akun wajib diisi.');
        process.exitCode = 1;
        break;
      }
      // Menghapus admin terakhir membuat halaman rekap tidak dapat dibuka
      // siapa pun, dan tidak ada jalur pemulihan selain menyunting basis data.
      const admin = daftarPengguna().filter((p) => p.peran === 'admin');
      if (admin.length === 1 && admin[0].nama_akun === namaAkun.toLowerCase()) {
        console.error('❌ Ini satu-satunya akun admin — buat admin lain sebelum menghapusnya.');
        process.exitCode = 1;
        break;
      }
      if (!hapusPengguna(namaAkun.toLowerCase())) {
        console.error(`❌ Akun "${namaAkun}" tidak ditemukan.`);
        process.exitCode = 1;
        break;
      }
      console.log(`✅ Akun "${namaAkun}" dihapus.`);
      break;
    }

    default:
      bantuan();
  }
} finally {
  tutupDatabase();
}
