/**
 * Pembangun Basis Pengetahuan (tanpa AI)
 *
 * Menggabungkan berkas SOP per layanan (`knowledge-base/<divisi>.json`)
 * menjadi satu berkas yang dipakai langsung aplikasi untuk menjawab keluhan:
 * `server/data/knowledge-base.json`.
 *
 * Tidak ada embedding maupun panggilan ke layanan AI. Pencocokan keluhan
 * dilakukan dengan kata kunci, sehingga jawaban selalu sama untuk pertanyaan
 * yang sama, dapat berjalan tanpa internet, dan tidak mungkin mengarang.
 *
 * YANG DIKERJAKAN DI SINI, DAN HANYA DI SINI
 * Sumbernya sudah berupa JSON, jadi tidak ada lagi penguraian format. Yang
 * tersisa dua hal, dan keduanya turunan — tidak boleh disimpan di sumber:
 *
 *   `divisi`     disalin dari kepala berkas ke setiap masalah, supaya
 *                answerService dapat menyaring tanpa menelusuri induknya
 *   `kataKunci`  hasil penyeragaman bahasa atas judul, gejala, dan penyebab.
 *                Menyimpannya di sumber berarti menyimpan sesuatu yang dapat
 *                bergeser diam-diam dari kalimat yang menurunkannya.
 *
 * Jalankan: npm run build:kb
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { bacaSopDivisi, daftarBerkasSop } from '../server/services/sopJson.js';
import { kataKunciMasalah } from '../server/services/teksUtil.js';
import { KB_FILE as OUT_FILE } from '../server/config/jalur.js';

const __filename = fileURLToPath(import.meta.url);

/**
 * Bangun berkas basis pengetahuan dari seluruh berkas SOP.
 *
 * Diekspor karena penyunting SOP lewat peramban wajib memanggilnya sendiri
 * setelah menyimpan (`server/services/sopBerkas.js`). Meminta admin membuka
 * terminal untuk menjalankan `npm run build:kb` sesudah menyunting sama saja
 * dengan tidak punya penyunting: suntingannya tersimpan di berkas sumber
 * tetapi tidak pernah sampai ke pengguna.
 *
 * @param {boolean} diam Tanpa keluaran konsol — dipakai saat dipanggil server
 * @returns {{masalah: number, solusi: number}}
 */
export function bangun(diam = false) {
  const catat = diam ? () => {} : console.log;
  const hasil = { dibuatPada: new Date().toISOString(), masalah: [] };
  let totalSolusi = 0;

  for (const { divisi, berkas } of daftarBerkasSop()) {
    const sop = bacaSopDivisi(divisi);
    if (!sop) continue;

    for (const m of sop.masalah) {
      hasil.masalah.push({
        id: m.id,
        divisi,
        judul: m.judul,
        gejala: m.gejala,
        kategori: m.kategori,
        penyebab: m.penyebab,
        solusi: m.solusi,
        penanganan: m.penanganan,
        kataKunci: kataKunciMasalah(m)
      });
      totalSolusi += m.solusi.length;
    }

    catat(`  ${divisi.padEnd(9)} ${String(sop.masalah.length).padStart(2)} masalah  (${berkas})`);
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
