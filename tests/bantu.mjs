/**
 * Perkakas pengujian sederhana — tanpa dependensi.
 *
 * Proyek ini sengaja berdependensi sedikit, sehingga memasang kerangka
 * pengujian sebesar Jest atau Vitest hanya untuk beberapa berkas uji tidak
 * sebanding. Node sudah menyediakan semua yang diperlukan.
 */

let gagal = 0;
let lulus = 0;

/** Judul bagian */
export function bagian(judul) {
  console.log(`\n${judul}`);
}

/**
 * Satu pemeriksaan.
 * @param {string} nama   Yang sedang diperiksa
 * @param {boolean} syarat Hasil pemeriksaan
 * @param {*} [dapat]     Nilai sebenarnya, ditampilkan bila gagal
 */
export function cek(nama, syarat, dapat) {
  if (syarat) {
    lulus++;
    console.log(`  ok    ${nama}`);
  } else {
    gagal++;
    const terlihat = JSON.stringify(dapat);
    console.log(`  GAGAL ${nama}${terlihat ? ` — dapat: ${terlihat.slice(0, 200)}` : ''}`);
  }
}

/** Catatan yang tidak dihitung sebagai pemeriksaan */
export function catatan(teks) {
  console.log(`        ${teks}`);
}

/** Tutup berkas uji dan tentukan kode keluarnya */
export function selesai(namaBerkas) {
  const total = lulus + gagal;
  console.log(
    gagal === 0
      ? `\n✅ ${namaBerkas}: ${total} pemeriksaan lulus\n`
      : `\n❌ ${namaBerkas}: ${gagal} dari ${total} pemeriksaan GAGAL\n`
  );
  process.exit(gagal === 0 ? 0 : 1);
}
