/**
 * Layanan Jawaban — pengganti pipeline AI.
 *
 * Keluhan pengguna dicocokkan dengan basis pengetahuan memakai kata kunci,
 * lalu jawabannya disusun langsung dari data SOP. Tidak ada model bahasa yang
 * dipanggil, sehingga:
 *   - jawaban selalu sama untuk keluhan yang sama
 *   - tidak mungkin mengarang di luar isi SOP
 *   - berjalan tanpa internet dan tanpa API key
 *   - waktu jawab di bawah sepersepuluh detik
 */
import fs from 'fs';
import { tokenisasi } from './teksUtil.js';
import { getChatMessages, getChatSession } from '../database/init.js';
import { KB_FILE } from '../config/jalur.js';

/** @type {{masalah: Array<object>}} */
let KB = { masalah: [] };

/**
 * Bobot kekhasan kata per divisi: makin sering sebuah kata muncul lintas
 * masalah, makin kecil bobotnya. "printer" ada di mana-mana pada divisi
 * Printer dan tidak membedakan apa pun; "macet" hanya pada satu masalah.
 *
 * @type {Map<string, Map<string, number>>} divisi -> kata -> bobot
 */
const BOBOT_KATA = new Map();

function hitungBobotKata() {
  BOBOT_KATA.clear();

  const perDivisi = new Map();
  for (const m of KB.masalah) {
    if (!perDivisi.has(m.divisi)) perDivisi.set(m.divisi, []);
    perDivisi.get(m.divisi).push(m);
  }

  for (const [divisi, daftar] of perDivisi) {
    const frekuensi = new Map();

    for (const m of daftar) {
      const unik = new Set([
        ...tokenisasi(m.judul),
        ...tokenisasi(m.gejala),
        ...tokenisasi(m.penyebab.join(' '))
      ]);
      for (const kata of unik) frekuensi.set(kata, (frekuensi.get(kata) || 0) + 1);
    }

    const bobot = new Map();
    for (const [kata, jumlah] of frekuensi) {
      bobot.set(kata, Math.log((daftar.length + 1) / (jumlah + 0.5)));
    }
    BOBOT_KATA.set(divisi, bobot);
  }
}

export function muatBasisPengetahuan() {
  if (!fs.existsSync(KB_FILE)) {
    console.warn('⚠️ Basis pengetahuan belum dibangun. Jalankan: npm run build:kb');
    return 0;
  }
  KB = JSON.parse(fs.readFileSync(KB_FILE, 'utf-8'));
  hitungBobotKata();
  return KB.masalah.length;
}
muatBasisPengetahuan();

const DIVISION_LABELS = {
  printer: 'Printer', cctv: 'CCTV', telepon: 'Telepon', radio: 'Radio Komunikasi',
  windows: 'Windows', ftth: 'FTTH', lan: 'LAN', wan: 'WAN'
};

/* Ambang dan penjaga pencocokan.
   Seluruh angka di bawah berasal dari tolok ukur di tests/akurasi.test.mjs —
   mengubahnya tanpa menjalankan berkas itu berarti menebak. */

// Skor minimum agar sebuah masalah dianggap cocok. Sengaja tinggi: mengaku
// tidak tahu lebih baik daripada memberi langkah yang keliru.
// Diekspor agar penyunting SOP menampilkan ambang yang sama dengan yang dipakai.
export const AMBANG_COCOK = 0.4;

// Kekhasan minimum yang harus dimiliki setidaknya satu kata yang cocok, agar
// kecocokan tidak bertumpu seluruhnya pada kata umum sedivisi.
const KEKHASAN_MINIMUM = 0.4;

// Kata yang tidak pernah muncul di basis pengetahuan divisi ini.
const BOBOT_KATA_ASING = 1.2;

/* SELURUH kata yang tidak menjelaskan masalah ini dihitung sekali saja, bukan
   satu per satu — yang menjadi petunjuk adalah ADANYA kata semacam itu, bukan
   banyaknya. Kata semacam itu datang dari dua sumber berlawanan: keluhan di
   luar cakupan, dan keterangan tempat atau waktu yang justru menolong
   ("ruang admin", "lantai 2", "pagi tadi").

   Dulu tiap kata menambah penyebut, sehingga keluhan yang sama merosot hanya
   karena diterangkan lebih lengkap: 1,000 → 0,502 → 0,402 → 0,217.

   PERLUASAN — dulu keringanan ini hanya berlaku bagi kata ASING. Kata yang
   dikenal divisinya tetapi milik masalah LAIN masih didenda penuh, dan denda
   itu membesar seiring basis pengetahuan bertambah: makin banyak masalah per
   divisi, makin tinggi bobot tiap kata langka. Akibatnya penambahan SOP diam-
   diam menjatuhkan pencocokan yang sebelumnya benar — "kertas nyangkut di
   printer ruang admin lantai 2 gedung utama pagi tadi" merosot ke 0,250 hanya
   karena kata "utama" kebetulan ada pada penyebab masalah printer yang lain.

   Sekarang keduanya diperlakukan sama: yang menentukan hanyalah apakah sebuah
   kata menjelaskan masalah ini atau tidak. Penjaga terhadap kecocokan asal
   tetap ada pada COCOK_MINIMUM, BUKTI_MINIMUM, dan KEKHASAN_MINIMUM. */
const BATAS_KATA_TAK_MENJELASKAN = 1;

// Jumlah bobot kata yang cocok — mengukur apakah yang ditulis CUKUP untuk
// disimpulkan. Tanpa ini keluhan berisi kata "printer" saja berskor 1,000.
const BUKTI_MINIMUM = 1.0;

/* Satu kata yang kebetulan kena bukan bukti; dua kata yang sepakat baru bukti.
   "kursi kantor saya RUSAK" menyentuh kata "rusak" pada judul masalah di empat
   divisi sekaligus — tanpa aturan ini laporan itu sampai ke engineer CCTV. */
const COCOK_MINIMUM = 2;

// Dikecualikan: bila pelapor hanya menulis "bluescreen", satu kata itulah
// seluruh keterangan yang ada.
const KELUHAN_PENDEK = 2;

// Batas bawah untuk menawarkan kemungkinan. Di bawah ambang cocok tetapi masih
// di atas nilai ini, keluhan dianggap bermakna ganda dan pengguna diminta
// memilih sendiri, bukan langsung ditolak.
const AMBANG_SARAN = 0.2;

// Banyaknya solusi berbeda yang ditawarkan sebelum diteruskan ke engineer
const MAKS_SOLUSI = 3;

const PERTANYAAN_PENUTUP = 'Apakah permasalahan sudah berhasil diselesaikan?';

/* ────────────────────────────────────────────────────────────────
   Pencocokan keluhan
   ──────────────────────────────────────────────────────────────── */

/**
 * Hitung kemiripan keluhan dengan satu masalah.
 *
 * Bobot dibedakan menurut letak kata: kata yang muncul pada judul masalah
 * jauh lebih menentukan daripada kata yang muncul pada daftar penyebab.
 *
 * @returns {number} skor 0..1
 */
function hitungSkor(kataKeluhan, masalah) {
  if (kataKeluhan.length === 0) return 0;

  const kataJudul = new Set(tokenisasi(masalah.judul));
  const kataGejala = new Set(tokenisasi(masalah.gejala));
  const kataPenyebab = new Set(tokenisasi(masalah.penyebab.join(' ')));
  const bobotDivisi = BOBOT_KATA.get(masalah.divisi);

  let diperoleh = 0;
  let maksimum = 0;
  let kekhasanTertinggi = 0;
  let bukti = 0;
  let jumlahCocok = 0;
  let dendaTakMenjelaskan = 0;

  for (const kata of kataKeluhan) {
    const dikenal = Boolean(bobotDivisi?.has(kata));
    const khas = dikenal ? bobotDivisi.get(kata) : BOBOT_KATA_ASING;

    const cocok = kataJudul.has(kata) ? 3 : kataGejala.has(kata) ? 2 : kataPenyebab.has(kata) ? 1 : 0;

    if (cocok > 0) {
      maksimum += khas * 3;
      diperoleh += khas * cocok;
      bukti += khas;
      jumlahCocok++;
      if (khas > kekhasanTertinggi) kekhasanTertinggi = khas;
    } else if (khas > dendaTakMenjelaskan) {
      // Kata yang TIDAK menjelaskan masalah ini hanya dicatat yang terberat —
      // lihat BATAS_KATA_TAK_MENJELASKAN.
      dendaTakMenjelaskan = khas;
    }
  }

  maksimum += dendaTakMenjelaskan * 3;

  // Kecocokan yang seluruhnya bertumpu pada kata umum tidak dapat dipercaya.
  if (kekhasanTertinggi < KEKHASAN_MINIMUM) return 0;

  // Cukup relevan belum berarti cukup banyak — lihat BUKTI_MINIMUM.
  if (bukti < BUKTI_MINIMUM) return 0;

  // Satu kata yang kebetulan cocok dari keluhan panjang bukan bukti.
  if (jumlahCocok < COCOK_MINIMUM && kataKeluhan.length > KELUHAN_PENDEK) return 0;

  return maksimum === 0 ? 0 : Math.min(diperoleh / maksimum, 1);
}

/**
 * Masalah dengan skor tertinggi, TANPA memberlakukan ambang.
 *
 * Dipakai untuk dua hal berbeda: penentuan jawaban (lewat `cariMasalah`, yang
 * menerapkan ambang) dan pencatatan rekap. Rekap sengaja menyimpan skor apa
 * adanya — termasuk yang di bawah ambang — karena keluhan berskor 0,2–0,4
 * itulah yang paling murah diperbaiki: nyaris dikenali, hanya kurang satu-dua
 * kata kunci pada SOP.
 *
 * @returns {{masalah: object, skor: number}|null}
 */
export function kandidatTeratas(keluhan, divisi) {
  const kata = tokenisasi(keluhan);
  if (kata.length === 0) return null;

  const kandidat = KB.masalah
    .filter((m) => m.divisi === divisi)
    .map((m) => ({ masalah: m, skor: hitungSkor(kata, m) }))
    .sort((a, b) => b.skor - a.skor);

  return kandidat[0] || null;
}

/**
 * Cari masalah yang paling sesuai dengan keluhan pengguna.
 * @param {string} keluhan - Kalimat keluhan
 * @param {string} divisi - Divisi layanan yang dipilih
 * @returns {{masalah: object, skor: number}|null}
 */
export function cariMasalah(keluhan, divisi) {
  const teratas = kandidatTeratas(keluhan, divisi);
  if (!teratas || teratas.skor < AMBANG_COCOK) return null;
  return teratas;
}

/**
 * Kemungkinan terdekat ketika skor tertinggi di bawah ambang — pengguna
 * ditawari beberapa pilihan alih-alih ditolak mentah.
 */
export function saranTerdekat(keluhan, divisi, maks = 3) {
  const kata = tokenisasi(keluhan);
  if (kata.length === 0) return [];

  return KB.masalah
    .filter((m) => m.divisi === divisi)
    .map((m) => ({ masalah: m, skor: hitungSkor(kata, m) }))
    .filter((k) => k.skor >= AMBANG_SARAN)
    .sort((a, b) => b.skor - a.skor)
    .slice(0, maks);
}

/* ────────────────────────────────────────────────────────────────
   Penebak divisi
   ──────────────────────────────────────────────────────────────── */

/**
 * Peringkat divisi yang paling mungkin sesuai sebuah keluhan — dipakai saat
 * pelapor memilih "Saya tidak yakin". Memakai mesin skor yang sama, hanya
 * dijalankan lintas divisi.
 *
 * @returns {Array<{divisi: string, masalah: object, skor: number}>} urut menurun
 */
export function tebakDivisi(keluhan) {
  const kata = tokenisasi(keluhan);
  if (kata.length === 0) return [];

  const terbaik = new Map();
  for (const m of KB.masalah) {
    const skor = hitungSkor(kata, m);
    const kini = terbaik.get(m.divisi);
    if (!kini || skor > kini.skor) terbaik.set(m.divisi, { masalah: m, skor });
  }

  return [...terbaik.entries()]
    .map(([divisi, v]) => ({ divisi, ...v }))
    .filter((x) => x.skor > 0)
    .sort((a, b) => b.skor - a.skor);
}

/* Lebih ketat daripada AMBANG_COCOK. Skor di sini diambil dari delapan divisi
   sekaligus, dan mengambil maksimum dari banyak kandidat menaikkan puncaknya
   secara semu. Salah tebak juga lebih mahal: laporannya sampai ke WhatsApp
   engineer yang keliru, bukan sekadar langkah yang tidak tepat. */
const AMBANG_DIVISI_PASTI = 0.5;
const AMBANG_DIVISI_RAGU = 0.4;

/** Jarak minimum dari kandidat kedua sebelum sebuah divisi diputuskan sendiri */
const JARAK_MEYAKINKAN = 0.12;

/**
 * Putuskan divisi dari sebuah keluhan.
 *
 * @returns {{hasil: 'pasti'|'ragu'|'tidak-dikenali', divisi?: string,
 *            skor?: number, pilihan: Array<{divisi: string, skor: number}>}}
 */
export function pilihDivisiOtomatis(keluhan) {
  const peringkat = tebakDivisi(keluhan);
  if (peringkat.length === 0) return { hasil: 'tidak-dikenali', pilihan: [] };

  const teratas = peringkat[0];
  const kedua = peringkat[1]?.skor ?? 0;

  // Tinggi saja tidak cukup — harus unggul jelas dari kandidat kedua. Dua
  // divisi berskor setara berarti keluhannya memang bermakna ganda.
  if (teratas.skor >= AMBANG_DIVISI_PASTI && teratas.skor - kedua >= JARAK_MEYAKINKAN) {
    return { hasil: 'pasti', divisi: teratas.divisi, skor: teratas.skor, pilihan: [] };
  }

  const dekat = peringkat.filter((p) => p.skor >= AMBANG_DIVISI_RAGU).slice(0, 3);
  if (dekat.length > 0) {
    return {
      hasil: 'ragu',
      pilihan: dekat.map((p) => ({ divisi: p.divisi, skor: Number(p.skor.toFixed(3)) }))
    };
  }

  return { hasil: 'tidak-dikenali', pilihan: [] };
}

/** Beberapa masalah teratas pada satu divisi — dipakai untuk saran pilihan */
export function daftarMasalahDivisi(divisi, maks = 6) {
  return KB.masalah
    .filter((m) => m.divisi === divisi)
    .slice(0, maks)
    .map((m) => ({ id: m.id, judul: m.judul }));
}

/* ────────────────────────────────────────────────────────────────
   Penyusun jawaban
   ──────────────────────────────────────────────────────────────── */

/** Susun jawaban untuk masalah kategori ringan pada solusi ke-n */
function susunJawabanRingan(masalah, nomorSolusi) {
  const solusi = masalah.solusi[nomorSolusi - 1];
  if (!solusi) return null;

  const bagian = [];

  if (nomorSolusi === 1) {
    bagian.push(`**${masalah.judul}**`);
    if (masalah.penyebab.length > 0) {
      bagian.push('');
      bagian.push('**Penyebab yang Mungkin Terjadi**');
      bagian.push(masalah.penyebab.map((p) => `- ${p}`).join('\n'));
    }
  } else {
    bagian.push('Baik, mari kita coba cara lain.');
  }

  bagian.push('');
  bagian.push(`**${solusi.judul}**`);
  if (solusi.pengantar) bagian.push(solusi.pengantar);
  bagian.push(solusi.langkah.map((l, i) => `${i + 1}. ${l}`).join('\n'));
  bagian.push('');
  bagian.push(PERTANYAAN_PENUTUP);

  return bagian.join('\n');
}

/** Susun jawaban untuk masalah kategori berat */
function susunJawabanBerat(masalah) {
  const bagian = [`**${masalah.judul}**`];

  if (masalah.penyebab.length > 0) {
    bagian.push('');
    bagian.push('**Penyebab yang Mungkin Terjadi**');
    bagian.push(masalah.penyebab.map((p) => `- ${p}`).join('\n'));
  }

  bagian.push('');
  bagian.push(
    masalah.penanganan ||
      'Masalah ini termasuk kategori BERAT dan memerlukan penanganan langsung oleh Engineer IT. Silakan tekan tombol **Hubungi Engineer**.'
  );

  return bagian.join('\n');
}

/**
 * Jawaban untuk keluhan yang tidak dikenali.
 *
 * Mengembalikan teks DAN daftar masalah terdekat sebagai data, karena
 * antarmuka menyajikannya sebagai tombol: meminta pelapor mengetik ulang
 * sementara tombol Hubungi Engineer tersedia satu ketukan di bawahnya berarti
 * praktis tidak ada yang mengetik ulang.
 *
 * @returns {{teks: string, saran: Array<{id: string, judul: string}>}}
 */
function jawabanTidakDikenali(keluhan, divisi) {
  const terdekat = saranTerdekat(keluhan, divisi, 3);

  if (terdekat.length > 0) {
    return {
      teks: [
        'Untuk memastikan, apakah ini yang Anda alami?',
        '',
        'Silakan pilih salah satu di bawah. Bila tidak ada yang sesuai, tekan **Hubungi Engineer** untuk dibantu langsung.'
      ].join('\n'),
      saran: terdekat.map((s) => ({ id: s.masalah.id, judul: s.masalah.judul }))
    };
  }

  // Tidak ada yang mendekati — yang ditawarkan kendala paling sering pada
  // layanan itu, tetap dapat ditekan.
  const contoh = daftarMasalahDivisi(divisi, 5);

  if (contoh.length === 0) {
    return {
      teks: 'Mohon maaf, keluhan Anda belum dapat kami kenali secara otomatis.\n\n' +
        'Silakan tekan tombol **Hubungi Engineer** untuk dibantu langsung.',
      saran: []
    };
  }

  return {
    teks: [
      'Mohon maaf, keluhan Anda belum dapat kami kenali secara otomatis.',
      '',
      'Berikut kendala yang paling sering dilaporkan pada layanan ini — silakan pilih bila ada yang sesuai, atau tekan **Hubungi Engineer**.'
    ].join('\n'),
    saran: contoh.map((c) => ({ id: c.id, judul: c.judul }))
  };
}

/* ────────────────────────────────────────────────────────────────
   Pengenal jawaban "sudah" / "belum"
   ──────────────────────────────────────────────────────────────── */

const FRASA_BELUM = [
  'belum berhasil', 'masih bermasalah', 'tetap tidak bisa', 'belum selesai',
  'masih error', 'belum bisa', 'tidak berhasil', 'masih sama', 'tetap error',
  'masih tidak bisa', 'belum teratasi', 'masih rusak', 'masih belum'
];
const FRASA_SUDAH = [
  'sudah berhasil', 'sudah bisa', 'sudah selesai', 'sudah teratasi',
  'berhasil diselesaikan', 'terima kasih', 'makasih', 'sudah beres'
];
const KATA_BELUM = ['belum', 'gagal', 'masih', 'tidak'];
const KATA_SUDAH = ['sudah', 'berhasil', 'beres', 'oke', 'ok', 'ya', 'mantap', 'siap'];

const MAKS_KATA_BALASAN_PENDEK = 4;

function memuatFrasa(teks, frasa) {
  const escaped = frasa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(teks);
}

/** Benar bila pesan terakhir asisten menanyakan konfirmasi penyelesaian */
function sedangMenungguKonfirmasi(sessionId) {
  const riwayat = getChatMessages(sessionId);
  for (let i = riwayat.length - 1; i >= 0; i--) {
    if (riwayat[i].role === 'assistant') {
      return (riwayat[i].content || '').toLowerCase().includes(PERTANYAAN_PENUTUP.toLowerCase());
    }
  }
  return false;
}

function balasanPendek(pesan) {
  return pesan.trim().split(/\s+/).length <= MAKS_KATA_BALASAN_PENDEK;
}

function menyatakanBelum(pesan, sessionId) {
  const t = pesan.toLowerCase().trim();
  if (FRASA_BELUM.some((f) => memuatFrasa(t, f))) return true;
  return sedangMenungguKonfirmasi(sessionId) && balasanPendek(t) && KATA_BELUM.some((k) => memuatFrasa(t, k));
}

function menyatakanSudah(pesan, sessionId) {
  const t = pesan.toLowerCase().trim();
  if (FRASA_SUDAH.some((f) => memuatFrasa(t, f))) return true;
  return sedangMenungguKonfirmasi(sessionId) && balasanPendek(t) && KATA_SUDAH.some((k) => memuatFrasa(t, k));
}

/** Hitung berapa kali asisten sudah memberikan langkah penyelesaian */
function jumlahSolusiDiberikan(sessionId) {
  return getChatMessages(sessionId).filter((m) => {
    if (m.role !== 'assistant') return false;
    const isi = m.content || '';
    return /^\s*1\./m.test(isi) && /^\s*2\./m.test(isi);
  }).length;
}

/**
 * Keluhan yang dipakai ulang saat pengguna menjawab "belum berhasil".
 *
 * Masalah yang terakhir benar-benar cocok didahulukan, bukan pesan pertama:
 * pelapor yang keluhan awalnya kabur lalu menekan saran akan dilempar balik ke
 * daftar saran itu juga, dan solusi berikutnya tidak pernah sampai.
 */
function keluhanPertama(sessionId) {
  const sesi = getChatSession(sessionId);
  if (sesi?.masalah_cocok) return sesi.masalah_cocok;

  const pesan = getChatMessages(sessionId).find((m) => m.role === 'user');
  return pesan?.content?.trim() || null;
}

/* ────────────────────────────────────────────────────────────────
   Fungsi utama
   ──────────────────────────────────────────────────────────────── */

/**
 * Proses satu pesan pengguna dan hasilkan jawaban dari basis pengetahuan.
 *
 * @param {string} sessionId
 * @param {string} divisi
 * @param {string} pesanPengguna
 * @returns {Promise<{response: string, shouldEscalate: boolean, isResolved: boolean}>}
 */
export async function chat(sessionId, divisi, pesanPengguna) {
  const sudahDiberikan = jumlahSolusiDiberikan(sessionId);
  const belum = menyatakanBelum(pesanPengguna, sessionId);

  const HABIS = {
    response:
      'Seluruh langkah penyelesaian yang tersedia sudah dicoba, namun kendala Anda belum teratasi.\n\n' +
      'Permasalahan ini memerlukan penanganan lebih lanjut oleh Engineer IT. Silakan tekan tombol **Hubungi Engineer**.',
    shouldEscalate: true,
    isResolved: false
  };

  // Pemeriksaan "belum" didahulukan: kalimat "belum berhasil" memuat kata
  // "berhasil", sehingga bila urutannya dibalik akan terbaca sebagai selesai.
  if (belum) {
    if (sudahDiberikan >= MAKS_SOLUSI) {
      return { ...HABIS, solusiTerakhir: sudahDiberikan };
    }
  } else if (menyatakanSudah(pesanPengguna, sessionId)) {
    return {
      response:
        'Terima kasih. Kami senang kendala Anda telah teratasi.\n\n' +
        'Apabila ada kendala lain di kemudian hari, jangan ragu menghubungi kami kembali melalui **SIGAP**.',
      shouldEscalate: false,
      isResolved: true,
      solusiTerakhir: sudahDiberikan
    };
  }

  // Balasan "belum" tidak memuat kata kunci, sehingga pencarian tetap memakai
  // keluhan awal agar masalah yang dirujuk tidak berpindah.
  const kueri = belum ? keluhanPertama(sessionId) || pesanPengguna : pesanPengguna;
  const cocok = cariMasalah(kueri, divisi);

  // Skor dicatat apa adanya untuk rekap, termasuk saat berada di bawah ambang.
  const teratas = cocok || kandidatTeratas(kueri, divisi);
  const telemetri = {
    masalahCocok: cocok ? cocok.masalah.judul : null,
    skorCocok: teratas ? Number(teratas.skor.toFixed(3)) : 0
  };

  if (!cocok) {
    const { teks, saran } = jawabanTidakDikenali(kueri, divisi);
    return {
      response: teks,
      // Tombol Hubungi Engineer tetap muncul bersama saran — menahannya
      // menjebak pelapor yang memang membutuhkan orang.
      shouldEscalate: true,
      isResolved: false,
      saranMasalah: saran,
      ...telemetri
    };
  }

  const { masalah } = cocok;

  if (masalah.kategori === 'berat') {
    return {
      response: susunJawabanBerat(masalah),
      shouldEscalate: true,
      isResolved: false,
      ...telemetri
    };
  }

  const nomorSolusi = belum ? sudahDiberikan + 1 : 1;
  const jawaban = susunJawabanRingan(masalah, nomorSolusi);

  // Solusi pada SOP sudah habis sebelum mencapai batas percobaan
  if (!jawaban) {
    return { ...HABIS, ...telemetri, solusiTerakhir: sudahDiberikan };
  }

  return {
    response: jawaban,
    shouldEscalate: false,
    isResolved: false,
    ...telemetri,
    solusiTerakhir: nomorSolusi,
    // Jawaban ini diakhiri PERTANYAAN_PENUTUP, sehingga antarmuka dapat
    // menawarkan tombol "Sudah / Belum berhasil". Penandanya dikirim dari sini
    // alih-alih dicari ulang dari isi teks di sisi antarmuka — mencocokkan
    // kalimat di dua tempat berarti dua tempat yang bisa bergeser sendiri.
    menungguKonfirmasi: true
  };
}

/** Pesan sambutan */
export function getWelcomeMessage() {
  return (
    'Selamat datang di **SIGAP**, layanan bantuan IT Pertamina EP Asset 1 Regional 1 Field Lirik.\n\n' +
    'Saya siap membantu menyelesaikan kendala IT Anda. Silakan pilih **layanan** yang ingin dilaporkan terlebih dahulu.'
  );
}

/** Daftar layanan, dipakai bila divisi belum dipilih */
export function getDivisionPrompt() {
  return (
    'Untuk memberikan bantuan yang tepat, silakan pilih salah satu **layanan** berikut:\n\n' +
    Object.values(DIVISION_LABELS).map((n, i) => `${i + 1}. **${n}**`).join('\n')
  );
}
