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
import path from 'path';
import { fileURLToPath } from 'url';
import { tokenisasi } from './teksUtil.js';
import { getChatMessages } from '../database/init.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KB_FILE = path.join(__dirname, '..', 'data', 'knowledge-base.json');

/** @type {{masalah: Array<object>}} */
let KB = { masalah: [] };

/**
 * Bobot kekhasan kata per divisi.
 *
 * Kata yang muncul di hampir semua masalah pada satu divisi hampir tidak
 * membedakan apa pun — pada divisi Printer, kata "printer" muncul di mana-mana,
 * sehingga keluhan "printer berwarna ungu" bisa keliru tercocokkan hanya karena
 * kata "printer". Sebaliknya kata seperti "macet" hanya muncul pada satu
 * masalah dan sangat menentukan.
 *
 * Bobot dihitung sekali saat basis pengetahuan dimuat.
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
      // Semakin sering sebuah kata muncul lintas masalah, semakin kecil bobotnya
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
  windows: 'Windows', fttp: 'FTTP', lan: 'LAN', wan: 'WAN'
};

// Ambang skor minimum agar sebuah masalah dianggap cocok. Di bawah ini,
// keluhan dianggap tidak dikenali dan diteruskan ke engineer — lebih baik
// mengaku tidak tahu daripada memberi langkah yang keliru.
// Ambang ini sengaja dipasang agak tinggi. Bagi layanan pengaduan, menjawab
// "belum dikenali" lalu menawarkan bantuan engineer jauh lebih baik daripada
// memberi langkah perbaikan untuk masalah yang keliru.
const AMBANG_COCOK = 0.4;

// Kekhasan minimum yang harus dimiliki setidaknya satu kata yang cocok.
// Nilainya menyesuaikan divisi terkecil (6 masalah), di mana kata yang muncul
// pada 4 dari 6 masalah bernilai sekitar 0,44 dan memang belum membedakan.
const KEKHASAN_MINIMUM = 0.4;

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

  for (const kata of kataKeluhan) {
    // Kata yang khas bernilai tinggi; kata umum sedivisi bernilai rendah.
    // Kata yang tak dikenal sama sekali tetap diperhitungkan sebagai penyebut
    // agar keluhan yang sebagian besar katanya asing tidak mudah lolos.
    const khas = bobotDivisi?.get(kata) ?? 1.2;
    maksimum += khas * 3;

    const cocok = kataJudul.has(kata) ? 3 : kataGejala.has(kata) ? 2 : kataPenyebab.has(kata) ? 1 : 0;
    if (cocok > 0) {
      diperoleh += khas * cocok;
      if (khas > kekhasanTertinggi) kekhasanTertinggi = khas;
    }
  }

  // Kecocokan yang seluruhnya bertumpu pada kata umum tidak dapat dipercaya.
  // Pada divisi Printer, keluhan "printer berwarna ungu" hanya menyentuh kata
  // "printer" yang muncul di hampir semua masalah — itu bukan petunjuk apa pun.
  if (kekhasanTertinggi < KEKHASAN_MINIMUM) return 0;

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
 * Kemungkinan terdekat untuk keluhan yang belum cukup meyakinkan.
 *
 * Dipakai ketika skor tertinggi berada di bawah ambang: alih-alih menolak
 * mentah, pengguna ditawari beberapa kemungkinan untuk dipilih. Ini menangani
 * keluhan bermakna ganda seperti "printernya tidak bisa ngeprint", yang
 * kata-katanya cocok dengan beberapa masalah sekaligus.
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
      'Masalah ini termasuk kategori BERAT dan memerlukan penanganan langsung oleh Engineer ICT. Silakan tekan tombol **Hubungi Engineer**.'
  );

  return bagian.join('\n');
}

/**
 * Jawaban saat keluhan belum cukup meyakinkan untuk dijawab langsung.
 * Bila ada kemungkinan yang mendekati, tawarkan agar pengguna memilih;
 * bila benar-benar tidak ada, tampilkan kendala yang paling sering dilaporkan.
 */
function jawabanTidakDikenali(keluhan, divisi) {
  const saran = saranTerdekat(keluhan, divisi, 3);

  if (saran.length > 0) {
    return [
      'Untuk memastikan, apakah kendala Anda termasuk salah satu berikut?',
      '',
      saran.map((s) => `- ${s.masalah.judul}`).join('\n'),
      '',
      'Silakan tuliskan kembali dengan kalimat yang lebih mendekati salah satu di atas. Bila tidak ada yang sesuai, tekan tombol **Hubungi Engineer** untuk dibantu langsung.'
    ].join('\n');
  }

  const contoh = daftarMasalahDivisi(divisi, 5);
  const bagian = ['Mohon maaf, keluhan Anda belum dapat kami kenali secara otomatis.', ''];

  if (contoh.length > 0) {
    bagian.push('Berikut kendala yang paling sering dilaporkan pada layanan ini:');
    bagian.push(contoh.map((c) => `- ${c.judul}`).join('\n'));
    bagian.push('');
    bagian.push('Silakan tuliskan kembali dengan kalimat lain, atau tekan tombol **Hubungi Engineer** untuk dibantu langsung.');
  } else {
    bagian.push('Silakan tekan tombol **Hubungi Engineer** untuk dibantu langsung.');
  }

  return bagian.join('\n');
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

/** Keluhan pertama pengguna pada sesi ini */
function keluhanPertama(sessionId) {
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
      'Permasalahan ini memerlukan penanganan lebih lanjut oleh Engineer ICT. Silakan tekan tombol **Hubungi Engineer**.',
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
        'Apabila ada kendala lain di kemudian hari, jangan ragu menghubungi kami kembali melalui **SIGAP AI**.',
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
    return {
      response: jawabanTidakDikenali(kueri, divisi),
      shouldEscalate: true,
      isResolved: false,
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
    solusiTerakhir: nomorSolusi
  };
}

/** Pesan sambutan */
export function getWelcomeMessage() {
  return (
    'Selamat datang di **SIGAP AI**, layanan bantuan ICT Pertamina EP Asset 1 Regional 1 Field Lirik.\n\n' +
    'Saya siap membantu menyelesaikan kendala ICT Anda. Silakan pilih **layanan** yang ingin dilaporkan terlebih dahulu.'
  );
}

/** Daftar layanan, dipakai bila divisi belum dipilih */
export function getDivisionPrompt() {
  return (
    'Untuk memberikan bantuan yang tepat, silakan pilih salah satu **layanan** berikut:\n\n' +
    Object.values(DIVISION_LABELS).map((n, i) => `${i + 1}. **${n}**`).join('\n')
  );
}
