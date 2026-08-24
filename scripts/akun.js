import 'dotenv/config';
import { initDatabase, tutupDatabase } from '../server/database/init.js';
import {
  daftarPengguna, buatPengguna, gantiSandi, hapusPengguna, cariPengguna, aturDivisi,
  SELURUH_DIVISI
} from '../server/services/authService.js';
import { DIVISI_ID } from '../server/config/divisi.js';

const [perintah, ...arg] = process.argv.slice(2);

function bantuan() {
  console.log(`
Pengelola akun SIGAP

  npm run akun -- daftar
      Tampilkan seluruh akun

  npm run akun -- buat <nama-akun> "<Nama Lengkap>" admin <kata-sandi>
  npm run akun -- buat <nama-akun> "<Nama Lengkap>" engineer <kata-sandi> <divisi,divisi>
      Buat akun baru. Kata sandi minimal 8 karakter.
      Akun engineer WAJIB menyebutkan layanan yang ditanganinya — tulis
      "semua" hanya bila memang berwenang atas seluruh layanan.

  npm run akun -- ganti <nama-akun> <kata-sandi-baru>
      Ganti kata sandi sebuah akun

  npm run akun -- divisi <nama-akun> <divisi,divisi,...>
      Batasi layanan yang boleh ditangani akun tersebut.
      Contoh: npm run akun -- divisi eka printer,windows
      Tulis "semua" untuk membuka seluruh layanan kembali.
      Pilihan: ${DIVISI_ID.join(', ')}

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
      console.log('  NAMA AKUN'.padEnd(20) + 'PERAN'.padEnd(11) + 'NAMA'.padEnd(24) + 'LAYANAN'.padEnd(22) + 'MASUK TERAKHIR');
      console.log('  ' + '─'.repeat(94));
      for (const p of semua) {
        const layanan = p.peran === 'admin'
          ? 'seluruhnya (admin)'
          : p.divisi === SELURUH_DIVISI ? 'SELURUHNYA'
          : (p.divisi || '⚠ belum diberi');
        console.log(
          '  ' + p.nama_akun.padEnd(18) +
          p.peran.padEnd(11) +
          p.nama.padEnd(24) +
          layanan.padEnd(22) +
          (p.masuk_terakhir ? p.masuk_terakhir.slice(0, 16).replace('T', ' ') : 'belum pernah')
        );
      }
      console.log('');
      break;
    }

    case 'buat': {
      const [namaAkun, nama, peran, sandi, daftarDivisi] = arg;
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

      // Akun engineer WAJIB menyebutkan layanannya sejak awal. Membiarkannya
      // ditetapkan belakangan berarti ada jeda ketika akun itu berwenang lebih
      // dari seharusnya — dan jeda itu berakhir hanya bila ada yang ingat.
      let divisi = [];
      if (peran === 'engineer') {
        if (!daftarDivisi) {
          console.error('❌ Akun engineer wajib menyebutkan layanan yang ditanganinya.');
          console.error('');
          console.error(`   npm run akun -- buat ${namaAkun} "${nama}" engineer <sandi> printer,windows`);
          console.error(`   npm run akun -- buat ${namaAkun} "${nama}" engineer <sandi> semua`);
          console.error('');
          console.error(`   Pilihan: ${DIVISI_ID.join(', ')}`);
          process.exitCode = 1;
          break;
        }

        divisi = daftarDivisi.toLowerCase() === 'semua'
          ? [SELURUH_DIVISI]
          : daftarDivisi.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);

        const asing = divisi.filter((d) => d !== SELURUH_DIVISI && !DIVISI_ID.includes(d));
        if (asing.length > 0) {
          console.error(`❌ Divisi tidak dikenal: ${asing.join(', ')}`);
          console.error(`   Pilihan: ${DIVISI_ID.join(', ')}`);
          process.exitCode = 1;
          break;
        }
      }

      buatPengguna({ namaAkun: namaAkun.toLowerCase(), nama, peran, sandi, divisi });

      const ket = peran === 'admin'
        ? 'seluruh layanan (admin)'
        : (divisi.includes(SELURUH_DIVISI) ? 'SELURUH layanan' : divisi.join(', '));
      console.log(`✅ Akun "${namaAkun}" (${peran}) dibuat — menangani ${ket}.`);
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

    case 'divisi': {
      const [namaAkun, ...daftarDivisi] = arg;
      if (!namaAkun) {
        console.error('❌ Nama akun wajib diisi.');
        bantuan();
        process.exitCode = 1;
        break;
      }

      const pengguna = cariPengguna(namaAkun.toLowerCase());
      if (!pengguna) {
        console.error(`❌ Akun "${namaAkun}" tidak ditemukan.`);
        process.exitCode = 1;
        break;
      }

      // Satu argumen "semua" lebih jelas daripada memakai daftar kosong,
      // yang mudah tertulis tanpa sengaja saat argumennya lupa diketik.
      const semua = daftarDivisi.length === 1 && daftarDivisi[0].toLowerCase() === 'semua';
      const diminta = semua
        ? [SELURUH_DIVISI]
        : daftarDivisi.flatMap((d) => d.split(',')).map((d) => d.trim().toLowerCase()).filter(Boolean);

      const asing = diminta.filter((d) => d !== SELURUH_DIVISI && !DIVISI_ID.includes(d));
      if (asing.length > 0) {
        console.error(`❌ Divisi tidak dikenal: ${asing.join(', ')}`);
        console.error(`   Pilihan: ${DIVISI_ID.join(', ')}`);
        process.exitCode = 1;
        break;
      }

      if (!semua && diminta.length === 0) {
        console.error('❌ Sebutkan daftar divisi, atau tulis "semua" untuk membuka seluruhnya.');
        process.exitCode = 1;
        break;
      }

      if (pengguna.peran === 'admin') {
        console.warn('⚠️  Akun admin tidak dibatasi per divisi — ia yang menutup tiket');
        console.warn('   saat engineer berhalangan. Pengaturan ini tidak berpengaruh baginya.');
      }

      aturDivisi(namaAkun.toLowerCase(), diminta);
      console.log(semua
        ? `✅ Akun "${namaAkun}" kini menangani SELURUH layanan.`
        : `✅ Akun "${namaAkun}" kini menangani: ${diminta.join(', ')}`);
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
