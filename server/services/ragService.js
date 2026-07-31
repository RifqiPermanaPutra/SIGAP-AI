/**
 * RAG Service
 * Orchestrates the Retrieval-Augmented Generation pipeline:
 * 1. Retrieve relevant knowledge chunks
 * 2. Construct system prompt with context
 * 3. Generate response — dua penyedia berlapis:
 *      UTAMA    : layanan awan NVIDIA (cepat, mutu jawaban lebih baik)
 *      CADANGAN : Ollama di komputer sendiri (dipakai bila internet atau
 *                 layanan awan bermasalah, sehingga layanan tetap berjalan)
 *
 * Catatan penting: pencarian basis pengetahuan (embedding) TIDAK ikut
 * berpindah penyedia. Vektor pada basis data dibuat oleh satu model tertentu,
 * sehingga bila kueri di-embed memakai model berbeda, hasil pencariannya
 * menjadi kacau tanpa memunculkan galat. Embedding tetap lokal — lihat
 * embeddingService.js.
 */
import OpenAI from 'openai';
import { search } from './knowledgeBaseService.js';
import { getChatMessages, addChatMessage } from '../database/init.js';

/** Penyedia utama: layanan awan */
const PRIMARY = {
  nama: 'NVIDIA',
  model: process.env.PRIMARY_CHAT_MODEL || 'nvidia/nemotron-3-super-120b-a12b',
  timeout: Number(process.env.PRIMARY_TIMEOUT_MS || 60000),
  // Model bertipe reasoning memakai sebagian jatah token untuk menalar sebelum
  // menulis jawaban. Bila jatahnya terlalu kecil, jatah itu habis di tahap
  // penalaran dan yang terkirim ke pengguna justru catatan berpikir model
  // dalam bahasa Inggris, bukan jawabannya. Karena itu jatahnya dilebihkan.
  maxTokens: Number(process.env.PRIMARY_MAX_TOKENS || 3000),
  client: new OpenAI({
    baseURL: process.env.PRIMARY_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    apiKey: process.env.PRIMARY_API_KEY || 'kosong'
  })
};

/** Penyedia cadangan: Ollama lokal */
const FALLBACK = {
  nama: 'Ollama lokal',
  model: process.env.FALLBACK_CHAT_MODEL || 'qwen2.5:7b',
  // Pemrosesan lokal, terutama bila model tidak muat penuh di memori kartu
  // grafis, memerlukan waktu jauh lebih lama daripada layanan awan.
  timeout: Number(process.env.FALLBACK_TIMEOUT_MS || 180000),
  maxTokens: Number(process.env.FALLBACK_MAX_TOKENS || 1500),
  client: new OpenAI({
    baseURL: process.env.FALLBACK_BASE_URL || 'http://localhost:11434/v1',
    // Ollama tidak memeriksa kunci, tetapi SDK OpenAI menolak nilai kosong.
    apiKey: 'ollama'
  })
};

// Awalan khas catatan berpikir model yang bocor ke jawaban. Bila terdeteksi,
// jawaban dianggap gagal agar penyedia cadangan yang menangani.
const POLA_NALAR_BOCOR = /^\s*(okay|alright|let me|the user|first,|looking at|i need to|we need to|hmm)/i;

/**
 * Kirim permintaan chat streaming dan kumpulkan seluruh token menjadi satu teks.
 *
 * Streaming dipakai agar batas waktu dapat dikenali lebih cepat; kontrak
 * balikan ke frontend tetap berupa satu respons utuh.
 *
 * @param {object} penyedia - Salah satu dari PRIMARY atau FALLBACK
 * @param {Array<{role:string,content:string}>} messages - Riwayat percakapan
 * @returns {Promise<string>} - Teks jawaban lengkap
 */
async function streamChat(penyedia, messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), penyedia.timeout);

  try {
    const stream = await penyedia.client.chat.completions.create(
      {
        model: penyedia.model,
        messages,
        temperature: 0.3, // Low temperature for consistent, factual responses
        top_p: 0.9,
        max_tokens: penyedia.maxTokens,
        stream: true
      },
      { signal: controller.signal }
    );

    let text = '';
    for await (const chunk of stream) {
      text += chunk.choices?.[0]?.delta?.content || '';
    }

    if (!text.trim()) {
      // Sebagian model menaruh jawabannya pada `reasoning_content` sehingga
      // `delta.content` selalu kosong — perlakukan sebagai kegagalan.
      throw new Error(`Model ${penyedia.model} tidak mengembalikan teks pada delta.content`);
    }

    if (POLA_NALAR_BOCOR.test(text)) {
      // Jawaban berisi catatan berpikir model, bukan jawaban untuk pengguna.
      throw new Error(`Model ${penyedia.model} membocorkan catatan penalaran ke jawaban`);
    }

    return text;
  } finally {
    clearTimeout(timer);
  }
}

// Division labels
const DIVISION_LABELS = {
  printer: 'Printer',
  cctv: 'CCTV',
  telepon: 'Telepon',
  radio: 'Radio Komunikasi',
  windows: 'Windows',
  fttp: 'FTTP',
  lan: 'LAN',
  wan: 'WAN'
};

/**
 * Cakupan tiap divisi, ditulis memakai istilah yang biasa dipakai pengguna.
 *
 * Tanpa penjelasan ini model menafsirkan nama divisi secara harfiah dan
 * menolak keluhan yang sebenarnya termasuk cakupannya — misalnya menganggap
 * "WiFi" bukan bagian dari "LAN" karena secara teknis WiFi adalah WLAN.
 */
const DIVISION_SCOPE = {
  printer: 'printer, mesin cetak, hasil cetak, tinta, toner, kertas macet, antrian cetak, scanner',
  cctv: 'kamera pengawas, CCTV, DVR, NVR, rekaman kamera, monitor pemantauan',
  telepon: 'telepon kantor, pesawat telepon, extension, nada sambung, PABX',
  radio: 'radio komunikasi, HT, handy talky, repeater, kanal radio',
  windows: 'laptop, komputer, PC, sistem operasi Windows, aplikasi di komputer, login komputer, penyimpanan disk',
  fttp: 'perangkat ONU atau ONT, jaringan fiber optik, lampu LOS, lampu PON, internet dari fiber',
  lan: 'jaringan lokal kantor, kabel LAN, kabel UTP, port jaringan, switch, WiFi kantor, tidak ada internet, internet lambat',
  wan: 'jaringan antar lokasi, koneksi antar site, VPN, akses ke kantor pusat'
};

/**
 * Build the system prompt for the AI Helpdesk
 * This encodes all business rules from the specification
 */
function buildSystemPrompt(division, contextChunks = [], nomorSolusi = 1) {
  const divisionName = DIVISION_LABELS[division] || division;
  const divisionScope = DIVISION_SCOPE[division] || '';

  // Bila pengguna menyatakan solusi sebelumnya belum berhasil, asisten wajib
  // menawarkan cara yang BERBEDA, bukan mengulang langkah yang sama.
  const NAMA_SOLUSI = { 1: 'Solusi Pertama', 2: 'Solusi Kedua', 3: 'Solusi Ketiga' };
  const solusiDiminta = NAMA_SOLUSI[nomorSolusi] || 'Solusi Ketiga';

  const bagianSolusiLanjutan = nomorSolusi > 1
    ? `

## PENTING: BERIKAN TEPAT SATU BAGIAN, YAITU "${solusiDiminta}"
Pengguna sudah mencoba ${nomorSolusi - 1} cara sebelumnya dan BELUM berhasil.

- Cari bagian berjudul "${solusiDiminta}" pada KNOWLEDGE BASE di bawah.
- Salin HANYA langkah-langkah dari bagian "${solusiDiminta}" tersebut.
- DILARANG KERAS menyertakan langkah dari bagian solusi lain, baik sebelumnya
  maupun sesudahnya. Jawaban harus memuat satu rangkaian langkah saja.
- Awali jawaban dengan kalimat: "Baik, mari kita coba cara lain."
- Setelah kalimat pembuka, tulis judul bagian tersebut, lalu langkah-langkahnya.
- Bagian "Penyebab yang Mungkin Terjadi" TIDAK perlu diulang lagi.
- Bila bagian "${solusiDiminta}" tidak ada pada KNOWLEDGE BASE, jawab dengan
  format MASALAH BERAT dan arahkan pengguna menghubungi Engineer ICT.`
    : '';

  const contextSection = contextChunks.length > 0
    ? `\n\n## KNOWLEDGE BASE (Gunakan HANYA informasi berikut untuk menjawab):\n\n${contextChunks.map((c, i) => `[Dokumen ${i + 1}]\n${c.content}`).join('\n\n---\n\n')}`
    : '';

  return `Kamu adalah SIGAP AI, asisten layanan ICT Pertamina EP Asset 1 Regional 1 Field Lirik.

## GAYA BAHASA
- Gunakan Bahasa Indonesia yang formal, sopan, dan jelas.
- Selalu sapa pengguna dengan "Anda" (jangan gunakan "kamu").
- Jangan gunakan emoji.

## IDENTITAS
- Kamu BUKAN engineer, BUKAN customer service umum, BUKAN AI serba-bisa.
- Kamu HANYA membantu permasalahan ICT pada divisi: ${divisionName}.

## CAKUPAN DIVISI ${divisionName}
Divisi ini mencakup: ${divisionScope}.

Perlakukan seluruh istilah di atas sebagai bagian dari divisi ${divisionName},
termasuk bila pengguna memakai bahasa sehari-hari atau singkatan.

## KAPAN MENOLAK
- TOLAK hanya bila pertanyaan benar-benar di luar urusan ICT, misalnya menanyakan
  cuaca, resep masakan, hiburan, atau meminta dibuatkan puisi.
- JANGAN menolak hanya karena istilah yang dipakai pengguna berbeda dengan nama divisi.
- JANGAN menolak bila KNOWLEDGE BASE di bawah memuat informasi yang relevan.
  Bila ada dokumen yang relevan, WAJIB dijawab memakai dokumen tersebut.
- Kalimat penolakan (gunakan HANYA bila benar-benar di luar ICT):
  "Maaf, saya hanya dapat membantu permasalahan yang berkaitan dengan layanan ICT Pertamina EP Asset 1 Regional 1 Field Lirik."

## DIVISI SAAT INI: ${divisionName}
${bagianSolusiLanjutan}
${contextSection}

## KLASIFIKASI MASALAH

### Masalah RINGAN (bisa dipandu pengguna untuk mengecek sendiri):
- Printer: Offline, Paper Jam, Tidak Bisa Print, Buram
- CCTV: Kamera Tidak Tampil
- Telepon: Tidak Ada Nada
- Windows: Tidak Bisa Login, Laptop Lemot
- LAN: Tidak Ada Internet, Kabel Terlepas
- Radio: Tidak Ada Suara
- FTTP: ONU Belum Menyala, LOS Merah
- WAN: Putus Sesaat

### Masalah BERAT (JANGAN berikan troubleshooting panjang, LANGSUNG arahkan ke Engineer):
- Kerusakan perangkat/hardware (mainboard rusak, printer rusak, DVR rusak, switch rusak)
- Fiber optik putus
- CCTV mati total
- Windows gagal boot / Blue Screen berulang
- Gangguan server
- Konfigurasi jaringan/router
- Kerusakan perangkat radio
- Gangguan yang memerlukan hak administrator
- Gangguan yang memerlukan kunjungan engineer

## FORMAT JAWABAN untuk MASALAH RINGAN

Gunakan format berikut:

**Penyebab yang Mungkin Terjadi**
- [penyebab 1]
- [penyebab 2]
- [penyebab 3]

**Langkah Penyelesaian**
1. [langkah 1]
2. [langkah 2]
3. [langkah 3]
... (lanjutkan sesuai kebutuhan, sampai 10 langkah)

Apakah permasalahan sudah berhasil diselesaikan?

## FORMAT JAWABAN untuk MASALAH BERAT

"Permasalahan ini termasuk kategori yang memerlukan penanganan langsung oleh Engineer ICT. Silakan tekan tombol **Hubungi Engineer** untuk menghubungi engineer melalui WhatsApp."

## ATURAN KETAT
1. Tulis langkah selengkap yang dibutuhkan, maksimal 10 langkah. Jangan memampatkan
   beberapa tindakan ke dalam satu nomor — satu nomor berisi satu tindakan saja.
2. Bahasa Indonesia yang sopan, mudah dipahami, TIDAK teknis.
3. DILARANG mengarang informasi yang tidak ada di Knowledge Base.
4. DILARANG menebak penyebab tanpa dasar dari Knowledge Base.
5. DILARANG memberikan solusi di luar Knowledge Base.
6. DILARANG memberikan konfigurasi jaringan yang kompleks.
7. DILARANG memberikan script terminal.
8. DILARANG memberikan konfigurasi registry Windows.
9. DILARANG memberikan perintah administrator.
10. DILARANG memberikan solusi yang berpotensi merusak perangkat.
11. DILARANG menjawab topik selain ICT.
12. Jika informasi TIDAK ditemukan di Knowledge Base, jawab:
    "Maaf, saya belum memiliki informasi yang sesuai untuk permasalahan tersebut. Silakan tekan tombol **Hubungi Engineer** agar dapat dibantu lebih lanjut."
13. Selalu akhiri jawaban masalah ringan dengan: "Apakah permasalahan sudah berhasil diselesaikan?"

## SATU JAWABAN HANYA BERISI SATU SOLUSI (SANGAT PENTING)

Dokumen pada KNOWLEDGE BASE dapat memuat beberapa bagian solusi, misalnya
"Solusi Pertama", "Solusi Kedua", dan "Solusi Ketiga".

- Pada jawaban pertama, berikan HANYA isi bagian "Solusi Pertama".
- DILARANG menggabungkan dua bagian solusi ke dalam satu jawaban.
- DILARANG menyalin seluruh isi dokumen sekaligus.
- Bagian solusi berikutnya baru diberikan bila pengguna menyatakan cara
  sebelumnya belum berhasil.
- Bila dokumen tidak memiliki pembagian solusi, cukup berikan langkahnya sekali.

## CARA MENULIS LANGKAH (SANGAT PENTING)

Pengguna sistem ini adalah pekerja lapangan yang TIDAK memahami istilah teknologi.
Mereka hanya terbiasa memakai perangkat, bukan mengaturnya. Tulis setiap langkah
seolah sedang memandu orang yang baru pertama kali menyentuh komputer.

Aturan wajib untuk setiap langkah:
1. SEBUTKAN LETAKNYA. Jangan hanya menyebut nama menu, jelaskan posisinya di layar.
   Buruk : "Buka pengaturan jaringan"
   Baik  : "Lihat pojok kanan bawah layar, di sebelah jam. Klik ikon berbentuk
            gelombang sinyal atau layar komputer kecil"
2. JELASKAN BENTUKNYA. Sebutkan warna, bentuk, atau tulisan yang terlihat.
   Contoh: "tombol berwarna biru bertuliskan Connect", "lampu kecil berwarna hijau"
3. SEBUTKAN APA YANG AKAN TERJADI setelah langkah dilakukan, agar pengguna yakin
   sudah benar. Contoh: "akan muncul daftar nama WiFi di sisi kanan layar"
4. SATU LANGKAH SATU TINDAKAN. Jangan menggabungkan "buka lalu klik lalu pilih".
5. HINDARI ISTILAH TEKNIS. Bila terpaksa dipakai, jelaskan dengan bahasa awam.
   Contoh: "adaptor (kotak hitam kecil yang menyambung ke colokan listrik)"
6. SEBUTKAN WAKTU TUNGGU bila ada. Contoh: "tunggu sekitar 30 detik"
7. Untuk perangkat fisik, sebutkan bentuk dan letak fisiknya, bukan nama tekniknya.

## GAYA BAHASA
- Sopan dan profesional
- Jelas dan rinci, tetapi tidak berbelit
- Seperti memandu rekan kerja lewat telepon yang tidak paham teknologi`;
}

/**
 * Build the greeting/welcome message
 */
export function getWelcomeMessage() {
  return `Selamat datang di **SIGAP AI**, layanan bantuan ICT Pertamina EP Asset 1 Regional 1 Field Lirik.

Saya siap membantu menyelesaikan kendala ICT Anda. Silakan pilih **layanan** yang ingin dilaporkan terlebih dahulu.`;
}

/**
 * Build division selection prompt
 */
export function getDivisionPrompt() {
  return `Untuk memberikan bantuan yang tepat, silakan pilih salah satu **divisi layanan** berikut:

1. **Printer**
2. **CCTV**
3. **Telepon**
4. **Radio Komunikasi**
5. **Windows**
6. **FTTP**
7. **LAN**
8. **WAN**`;
}

/*
 * Deteksi jawaban tuntas / belum tuntas.
 *
 * Pencocokan substring polos berbahaya untuk Bahasa Indonesia:
 *  - kata "tidak" muncul di hampir semua keluhan ("printer tidak bisa print"),
 *    sehingga keluhan pertama pengguna langsung dieskalasi tanpa dibantu;
 *  - "ok" adalah substring dari "lokasi", sehingga "printer di lokasi gedung B"
 *    terbaca sebagai "masalah sudah selesai".
 *
 * Karena itu pencocokan memakai batas kata, dan kata tunggal yang ambigu
 * ("belum", "sudah", "ok") hanya berlaku ketika asisten memang baru saja
 * menanyakan konfirmasi DAN balasan penggunanya pendek.
 */

// Frasa yang maknanya jelas walau muncul di tengah kalimat panjang
const UNRESOLVED_PHRASES = [
  'belum berhasil', 'masih bermasalah', 'tetap tidak bisa', 'belum selesai',
  'masih error', 'belum bisa', 'tidak berhasil', 'masih sama', 'tetap error',
  'masih tidak bisa', 'belum teratasi', 'masih rusak', 'masih belum'
];

const RESOLVED_PHRASES = [
  'sudah berhasil', 'sudah bisa', 'sudah selesai', 'sudah teratasi',
  'berhasil diselesaikan', 'terima kasih', 'makasih', 'sudah beres'
];

// Kata tunggal ambigu — hanya dipakai sebagai jawaban atas pertanyaan konfirmasi
const UNRESOLVED_SHORT = ['belum', 'gagal', 'masih', 'tidak'];
const RESOLVED_SHORT = ['sudah', 'berhasil', 'beres', 'oke', 'ok', 'ya', 'mantap', 'siap'];

const CLOSING_QUESTION = 'apakah permasalahan sudah berhasil diselesaikan';
const SHORT_REPLY_MAX_WORDS = 4;

// Banyaknya solusi berbeda yang ditawarkan sebelum pengaduan diteruskan
// ke engineer. Basis pengetahuan menyediakan sampai tiga solusi per masalah.
const MAX_SOLUTION_ATTEMPTS = 3;

/**
 * Menghitung berapa kali asisten sudah memberikan langkah penyelesaian.
 *
 * Penanda yang dipakai adalah keberadaan daftar bernomor, bukan judul tertentu.
 * Judul jawaban berbeda-beda: solusi pertama memakai "Langkah Penyelesaian",
 * sedangkan solusi lanjutan diawali "Baik, mari kita coba cara lain". Bila
 * penghitungan bergantung pada judul, solusi lanjutan tidak ikut terhitung dan
 * sistem akan meminta solusi yang sama berulang kali.
 */
function countSolutionsGiven(sessionId) {
  return getChatMessages(sessionId).filter((m) => {
    if (m.role !== 'assistant') return false;
    const isi = m.content || '';
    return /^\s*1\./m.test(isi) && /^\s*2\./m.test(isi);
  }).length;
}

/** Keluhan pertama pengguna pada sesi ini, dipakai sebagai kueri pencarian */
function getFirstUserMessage(sessionId) {
  const pesan = getChatMessages(sessionId).find((m) => m.role === 'user');
  return pesan?.content?.trim() || null;
}

function containsPhrase(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text);
}

/** Benar bila asisten baru saja menanyakan apakah masalah sudah selesai */
function awaitingConfirmation(sessionId) {
  const history = getChatMessages(sessionId);
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'assistant') {
      return (history[i].content || '').toLowerCase().includes(CLOSING_QUESTION);
    }
  }
  return false;
}

function isShortReply(message) {
  return message.trim().split(/\s+/).length <= SHORT_REPLY_MAX_WORDS;
}

/**
 * Check if user's message indicates the problem is NOT resolved
 */
function isUnresolved(message, sessionId) {
  const lower = message.toLowerCase().trim();
  if (UNRESOLVED_PHRASES.some((p) => containsPhrase(lower, p))) return true;

  return (
    awaitingConfirmation(sessionId) &&
    isShortReply(lower) &&
    UNRESOLVED_SHORT.some((p) => containsPhrase(lower, p))
  );
}

/**
 * Check if user's message indicates the problem IS resolved
 */
function isResolved(message, sessionId) {
  const lower = message.toLowerCase().trim();
  if (RESOLVED_PHRASES.some((p) => containsPhrase(lower, p))) return true;

  return (
    awaitingConfirmation(sessionId) &&
    isShortReply(lower) &&
    RESOLVED_SHORT.some((p) => containsPhrase(lower, p))
  );
}

/**
 * Main chat function - processes user message through the RAG pipeline
 * @param {string} sessionId - Chat session ID
 * @param {string} division - Selected division
 * @param {string} userMessage - User's message
 * @returns {Promise<{response: string, shouldEscalate: boolean, isResolved: boolean}>}
 */
export async function chat(sessionId, division, userMessage) {
  // Urutan solusi: bila solusi pertama belum berhasil, tawarkan solusi
  // berikutnya lebih dulu. Eskalasi ke engineer hanya setelah seluruh
  // solusi pada basis pengetahuan dicoba.
  const percobaanSebelumnya = countSolutionsGiven(sessionId);
  const belumBerhasil = isUnresolved(userMessage, sessionId);

  // Pemeriksaan "belum berhasil" WAJIB didahulukan daripada "sudah berhasil".
  // Kalimat seperti "belum berhasil" memuat kata "berhasil", sehingga bila
  // urutannya dibalik, jawaban penolakan justru terbaca sebagai keberhasilan.
  if (belumBerhasil) {
    if (percobaanSebelumnya >= MAX_SOLUTION_ATTEMPTS) {
      return {
        response: `Seluruh langkah penyelesaian yang tersedia sudah dicoba, namun kendala Anda belum teratasi.\n\nPermasalahan ini memerlukan penanganan lebih lanjut oleh Engineer ICT. Silakan tekan tombol **Hubungi Engineer** untuk menghubungi engineer melalui WhatsApp.`,
        shouldEscalate: true,
        isResolved: false
      };
    }
    // Belum mencapai batas: lanjut ke bawah untuk menawarkan solusi berikutnya.
  } else if (isResolved(userMessage, sessionId)) {
    return {
      response: `Terima kasih. Kami senang kendala Anda telah teratasi.\n\nApabila ada kendala lain di kemudian hari, jangan ragu untuk menghubungi kami kembali melalui **SIGAP AI**.`,
      shouldEscalate: false,
      isResolved: true
    };
  }

  // Balasan "belum" tidak memuat kata kunci apa pun untuk dicari. Karena itu
  // pencarian tetap memakai keluhan awal pengguna agar dokumen yang diambil
  // tetap sesuai masalahnya.
  const keluhanAwal = getFirstUserMessage(sessionId) || userMessage;
  const kueriPencarian = belumBerhasil ? keluhanAwal : userMessage;

  // Step 1: Retrieve relevant knowledge chunks
  let contextChunks = [];
  try {
    contextChunks = await search(kueriPencarian, division, 3);
  } catch (error) {
    console.warn('⚠️ Knowledge base search failed:', error.message);
  }

  // Step 2: Build system prompt with context
  const nomorSolusi = belumBerhasil ? percobaanSebelumnya + 1 : 1;
  const systemPrompt = buildSystemPrompt(division, contextChunks, nomorSolusi);

  // Step 3: Get conversation history
  const history = getChatMessages(sessionId);
  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  // Add recent conversation history (last 10 messages to keep context manageable)
  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // Add current user message
  messages.push({ role: 'user', content: userMessage });

  // Step 4: Hasilkan jawaban — coba penyedia utama dahulu, lalu cadangan
  try {
    let aiResponse;
    try {
      aiResponse = await streamChat(PRIMARY, messages);
    } catch (galatUtama) {
      console.warn(`⚠️ Penyedia utama (${PRIMARY.nama} · ${PRIMARY.model}) gagal: ${galatUtama.message}`);
      console.warn(`   Beralih ke cadangan: ${FALLBACK.nama} · ${FALLBACK.model}`);
      aiResponse = await streamChat(FALLBACK, messages);
      console.warn('   Jawaban dihasilkan oleh penyedia cadangan.');
    }

    // Deteksi apakah jawaban ini benar-benar sebuah eskalasi.
    //
    // Sekadar menyebut "Engineer ICT" tidak cukup: hampir semua langkah
    // penyelesaian masalah RINGAN diakhiri saran cadangan seperti "bila masih
    // bermasalah, laporkan kepada Engineer ICT". Bila itu ikut dianggap
    // eskalasi, tombol Hubungi Engineer muncul pada hampir setiap jawaban dan
    // pengguna terdorong melewati langkah perbaikan yang sudah diberikan.
    //
    // Karena itu pencocokan dilakukan pada frasa khas jawaban kategori BERAT.
    const lower = aiResponse.toLowerCase();
    const isEscalation =
      lower.includes('kategori berat') ||
      lower.includes('masalah berat') ||
      lower.includes('memerlukan penanganan langsung oleh engineer') ||
      lower.includes('memerlukan penanganan lebih lanjut oleh engineer') ||
      lower.includes('silakan tekan tombol');

    return {
      response: aiResponse,
      shouldEscalate: isEscalation,
      isResolved: false
    };
  } catch (error) {
    console.error('❌ Ollama chat error:', error.message);

    // If the LLM is not available, try to give a basic response from KB
    if (contextChunks.length > 0) {
      return {
        response: `Berdasarkan informasi yang tersedia:\n\n${contextChunks[0].content}\n\nApakah permasalahan sudah berhasil diselesaikan?`,
        shouldEscalate: false,
        isResolved: false
      };
    }

    return {
      response: `Maaf, sistem AI sedang mengalami gangguan. Silakan tekan tombol **Hubungi Engineer** untuk mendapatkan bantuan langsung.`,
      shouldEscalate: true,
      isResolved: false
    };
  }
}
