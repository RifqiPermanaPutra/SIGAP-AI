/**
 * Pengolah teks Bahasa Indonesia untuk pencocokan keluhan tanpa AI.
 *
 * Tugasnya menyeragamkan kalimat pengguna dan kalimat pada SOP agar keduanya
 * dapat dibandingkan secara adil. Tanpa penyeragaman ini, "printernya lemot"
 * dan "printer lambat" akan dianggap sama sekali berbeda.
 */

/** Kata umum yang tidak membedakan makna keluhan, dibuang sebelum dicocokkan */
export const STOPWORDS = new Set([
  'yang', 'dan', 'atau', 'di', 'ke', 'dari', 'pada', 'untuk', 'dengan', 'dalam',
  'ini', 'itu', 'saya', 'aku', 'kami', 'kita', 'anda', 'nya', 'sudah', 'belum',
  'akan', 'juga', 'saja', 'hanya', 'lagi', 'masih', 'tapi', 'tetapi', 'karena',
  'jika', 'kalau', 'bila', 'agar', 'supaya', 'oleh', 'sebagai', 'adalah', 'ada',
  'apa', 'apakah', 'bagaimana', 'kenapa', 'mengapa', 'gimana', 'mohon', 'tolong',
  'bantu', 'bantuan', 'terima', 'kasih', 'pak', 'bu', 'mas', 'mbak', 'ya', 'yah',
  'nih', 'sih', 'dong', 'deh', 'kok', 'jadi', 'terus', 'lalu', 'kemudian',
  'sangat', 'sekali', 'banget', 'agak', 'cukup', 'lebih', 'paling', 'semua',
  'setiap', 'saat', 'ketika', 'waktu', 'selalu', 'sering', 'kadang', 'pernah',
  'punya', 'milik', 'buat', 'bikin', 'coba', 'mau', 'ingin', 'perlu', 'harus'
]);

/**
 * Padanan kata agar ragam bahasa sehari-hari dikenali.
 * Kunci adalah bentuk yang mungkin diketik pengguna, nilainya bentuk baku
 * yang dipakai pada dokumen SOP.
 */
export const SINONIM = {
  // Bentuk tidak baku
  ga: 'tidak', gak: 'tidak', nggak: 'tidak', enggak: 'tidak', tak: 'tidak',
  gabisa: 'tidak bisa', gbs: 'tidak bisa', kaga: 'tidak',
  udah: 'sudah', udh: 'sudah', dah: 'sudah', blm: 'belum', blom: 'belum',

  // Istilah perangkat
  pc: 'komputer', laptop: 'komputer', notebook: 'komputer', kompi: 'komputer',
  printah: 'printer', prionter: 'printer',
  hp: 'telepon', telpon: 'telepon', telfon: 'telepon', tlp: 'telepon',
  ht: 'radio', handytalky: 'radio', 'handy-talky': 'radio',
  cam: 'kamera', camera: 'kamera', kamer: 'kamera',
  dvr: 'perekam', nvr: 'perekam',
  onu: 'onu', ont: 'onu', modem: 'onu',
  wifi: 'wifi', wireless: 'wifi', hotspot: 'wifi',
  kabel: 'kabel', utp: 'kabel', rj45: 'kabel',

  // Kondisi dan gejala
  lemot: 'lambat', lelet: 'lambat', lambat: 'lambat', berat: 'lambat',
  ngelag: 'lambat', lag: 'lambat', lola: 'lambat',
  mati: 'mati', padam: 'mati', off: 'mati', mampus: 'mati',
  nyala: 'menyala', hidup: 'menyala', on: 'menyala', idup: 'menyala',
  rusak: 'rusak', error: 'rusak', eror: 'rusak', bermasalah: 'rusak',
  hang: 'membeku', freeze: 'membeku', nge: 'membeku', macet: 'macet',
  nyangkut: 'macet', jam: 'macet', tersangkut: 'macet',
  putus: 'putus', terputus: 'putus', disconnect: 'putus',
  connect: 'terhubung', konek: 'terhubung', nyambung: 'terhubung',
  sambung: 'terhubung', tersambung: 'terhubung',
  offline: 'offline', ofline: 'offline',
  // SOP menulis "Tidak Terdeteksi", pengguna lazim menulis "gak kedeteksi"
  kedeteksi: 'terdeteksi', kedetek: 'terdeteksi', terdeteksi: 'terdeteksi',
  deteksi: 'terdeteksi', detect: 'terdeteksi', kebaca: 'terdeteksi',
  print: 'cetak', ngeprint: 'cetak', nyetak: 'cetak', cetakan: 'cetak',
  buram: 'buram', blur: 'buram', kabur: 'buram', samar: 'buram',
  bergaris: 'bergaris', garis: 'bergaris', belang: 'bergaris',
  login: 'login', masuk: 'login', signin: 'login',
  password: 'sandi', pass: 'sandi', pw: 'sandi', katasandi: 'sandi',
  internet: 'internet', inet: 'internet', jaringan: 'jaringan', network: 'jaringan',
  penuh: 'penuh', full: 'penuh',
  restart: 'restart', reboot: 'restart',

  // Istilah layar bermasalah. Dipetakan per kata karena pengguna menulisnya
  // terpisah ("blue screen") maupun menyatu ("bluescreen").
  blank: 'hitam', blue: 'biru', screen: 'layar', layar: 'layar',
  bluescreen: 'biru', bsod: 'biru', ngeblank: 'hitam',
  booting: 'boot', boot: 'boot',

  // Penyimpanan dan berkas
  memori: 'penyimpanan', memory: 'penyimpanan', storage: 'penyimpanan',
  disk: 'penyimpanan', harddisk: 'penyimpanan', hardisk: 'penyimpanan',
  file: 'berkas', dokumen: 'dokumen',

  // Suara dan sinyal
  suara: 'suara', audio: 'suara', sinyal: 'sinyal', signal: 'sinyal',
  rekaman: 'rekaman', record: 'rekaman', recording: 'rekaman',

  // Kemunculan pada layar — pengguna menyebut "muncul", SOP menulis "tampil"
  muncul: 'tampil', tampil: 'tampil', kelihatan: 'tampil', keliatan: 'tampil',
  monitor: 'layar', display: 'layar'
};

/** Akhiran umum yang dapat dilepas tanpa mengubah makna inti kata */
const AKHIRAN = ['nya', 'kah', 'lah', 'pun'];

/**
 * Seragamkan satu kata: huruf kecil, buang tanda baca, lepas akhiran,
 * lalu terjemahkan lewat daftar padanan.
 */
function normalisasiKata(kata) {
  let k = kata.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!k) return '';

  // Lepas akhiran hanya bila kata masih cukup panjang setelahnya, agar
  // kata pendek seperti "nya" sendiri tidak habis terpotong.
  for (const akhiran of AKHIRAN) {
    if (k.length > akhiran.length + 3 && k.endsWith(akhiran)) {
      k = k.slice(0, -akhiran.length);
      break;
    }
  }

  return SINONIM[k] || k;
}

/** Seragamkan satu kalimat utuh */
export function normalisasi(teks) {
  return String(teks || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pecah kalimat menjadi daftar kata bermakna yang siap dicocokkan.
 * Kata umum dibuang, ragam tidak baku diseragamkan.
 */
export function tokenisasi(teks) {
  const hasil = [];

  for (const potongan of normalisasi(teks).split(' ')) {
    if (!potongan) continue;

    const baku = normalisasiKata(potongan);
    if (!baku || baku.length < 3) continue;
    if (STOPWORDS.has(baku)) continue;

    // Padanan bisa menghasilkan dua kata, misalnya "gabisa" -> "tidak bisa"
    for (const bagian of baku.split(' ')) {
      if (bagian.length >= 3 && !STOPWORDS.has(bagian)) hasil.push(bagian);
    }
  }

  return hasil;
}

/**
 * Kata kunci sebuah masalah — inilah yang dicocokkan dengan kalimat keluhan.
 *
 * Diambil dari judul, gejala, dan penyebab; langkah penyelesaian SENGAJA tidak
 * ikut. Langkah berisi kata-kata tindakan ("tekan", "buka", "cabut") yang
 * muncul di hampir semua masalah, sehingga menyertakannya justru mengaburkan
 * pembeda antar masalah alih-alih mempertajamnya.
 *
 * Dipakai `scripts/build-kb.js` saat membangun basis pengetahuan. Hasilnya
 * TIDAK disimpan di berkas SOP: ia turunan, dan turunan yang ikut tersimpan
 * dapat bergeser diam-diam dari kalimat yang menurunkannya.
 */
export function kataKunciMasalah(masalah) {
  const sumber = [masalah.judul, masalah.gejala, ...(masalah.penyebab || [])].join(' ');
  return [...new Set(tokenisasi(sumber))];
}
