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
// Pengurai dipakai bersama dengan API penyunting SOP (server/routes/sop.js).
// Dua pengurai untuk satu format berarti dua tafsiran yang dapat bergeser
// sendiri-sendiri: SOP yang tampak benar di penyunting akan terurai berbeda
// saat dibangun, dan tidak ada yang menyadarinya sampai pengguna menerima
// langkah yang keliru.
import { FOLDER_KE_DIVISI, uraiBlok } from '../server/services/sopParser.js';
import { SOP_DIR as KB_DIR, KB_FILE as OUT_FILE } from '../server/config/jalur.js';

const __filename = fileURLToPath(import.meta.url);

/**
 * Bangun berkas basis pengetahuan dari seluruh berkas SOP.
 *
 * Diekspor karena penyunting SOP lewat peramban wajib memanggilnya sendiri
 * setelah menyimpan (`server/services/sopBerkas.js`). Meminta admin membuka
 * terminal untuk menjalankan `npm run build:kb` sesudah menyunting sama saja
 * dengan tidak punya penyunting: suntingannya tersimpan di berkas Markdown
 * tetapi tidak pernah sampai ke pengguna.
 *
 * @param {boolean} diam Tanpa keluaran konsol — dipakai saat dipanggil server
 * @returns {{masalah: number, solusi: number}}
 */
export function bangun(diam = false) {
  const catat = diam ? () => {} : console.log;
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
      catat(`  ${divisi.padEnd(9)} ${String(jumlah).padStart(2)} masalah  (${berkas})`);
    }
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(hasil, null, 2), 'utf-8');

  const ukuran = (fs.statSync(OUT_FILE).size / 1024).toFixed(0);
  catat('');
  catat(`Total : ${hasil.masalah.length} masalah, ${totalSolusi} solusi`);
  catat(`Berkas: ${path.relative(process.cwd(), OUT_FILE)} (${ukuran} KB)`);

  return { masalah: hasil.masalah.length, solusi: totalSolusi };
}

// Hanya berjalan sendiri saat dipanggil sebagai perintah (`npm run build:kb`).
// Tanpa penjaga ini, sekadar meng-import modulnya dari server akan menulis
// ulang berkas basis pengetahuan sebagai efek samping.
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  console.log('Membangun basis pengetahuan dari berkas SOP...\n');
  bangun();
}
