/**
 * RAG Service
 * Orchestrates the Retrieval-Augmented Generation pipeline:
 * 1. Retrieve relevant knowledge chunks
 * 2. Construct system prompt with context
 * 3. Generate response via NVIDIA NIM (endpoint OpenAI-compatible)
 */
import OpenAI from 'openai';
import { search } from './knowledgeBaseService.js';
import { getChatMessages, addChatMessage } from '../database/init.js';

const client = new OpenAI({
  baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.NVIDIA_API_KEY
});

const CHAT_MODEL = process.env.NVIDIA_CHAT_MODEL || 'qwen/qwen3-next-80b-a3b-instruct';

// Model cadangan. Sebagian model di katalog NVIDIA — terutama varian 70B dense —
// tidak pernah membalas pada tier gratis: koneksi digantung sampai timeout tanpa
// pesan galat. Bila model utama diam, permintaan diulang ke model ini.
const FALLBACK_MODEL = process.env.NVIDIA_FALLBACK_MODEL || 'meta/llama-3.1-8b-instruct';

// Batas tunggu satu permintaan. Tanpa ini, permintaan yang digantung server
// akan membuat indikator "sedang mengetik" di antarmuka berputar selamanya.
const REQUEST_TIMEOUT_MS = Number(process.env.NVIDIA_TIMEOUT_MS || 45000);

/**
 * Kirim permintaan chat streaming dan kumpulkan seluruh token menjadi satu teks.
 *
 * Streaming dipakai bukan untuk efek ketik di layar, melainkan karena endpoint
 * gratis NVIDIA jauh lebih andal dengan stream=true; kontrak balikan ke frontend
 * tetap berupa satu respons utuh.
 *
 * @param {string} model - Nama model NIM
 * @param {Array<{role:string,content:string}>} messages - Riwayat percakapan
 * @returns {Promise<string>} - Teks jawaban lengkap
 */
async function streamChat(model, messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const stream = await client.chat.completions.create(
      {
        model,
        messages,
        temperature: 0.3, // Low temperature for consistent, factual responses
        top_p: 0.9,
        max_tokens: 1024,
        stream: true
      },
      { signal: controller.signal }
    );

    let text = '';
    for await (const chunk of stream) {
      text += chunk.choices?.[0]?.delta?.content || '';
    }

    if (!text.trim()) {
      // Model bertipe reasoning menaruh jawabannya di `reasoning_content`
      // sehingga `delta.content` selalu kosong — perlakukan sebagai gagal.
      throw new Error(`Model ${model} tidak mengembalikan teks pada delta.content`);
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
 * Build the system prompt for the AI Helpdesk
 * This encodes all business rules from the specification
 */
function buildSystemPrompt(division, contextChunks = []) {
  const divisionName = DIVISION_LABELS[division] || division;

  const contextSection = contextChunks.length > 0
    ? `\n\n## KNOWLEDGE BASE (Gunakan HANYA informasi berikut untuk menjawab):\n\n${contextChunks.map((c, i) => `[Dokumen ${i + 1}]\n${c.content}`).join('\n\n---\n\n')}`
    : '';

  return `Kamu adalah AI Helpdesk ICT Pertamina EP Asset 1 Regional 1 Field Lirik.

## IDENTITAS
- Kamu BUKAN engineer, BUKAN customer service umum, BUKAN AI serba-bisa.
- Kamu HANYA membantu permasalahan ICT pada divisi: ${divisionName}.
- Jika pertanyaan di luar ICT atau di luar divisi ${divisionName}, jawab:
  "Maaf, saya hanya dapat membantu permasalahan yang berkaitan dengan layanan ICT Pertamina EP Asset 1 Regional 1 Field Lirik."

## DIVISI SAAT INI: ${divisionName}
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
4. [langkah 4]
5. [langkah 5]

Apakah permasalahan sudah berhasil diselesaikan?

## FORMAT JAWABAN untuk MASALAH BERAT

"Permasalahan ini termasuk kategori yang memerlukan penanganan langsung oleh Engineer ICT. Silakan tekan tombol **Hubungi Engineer** untuk menghubungi engineer melalui WhatsApp."

## ATURAN KETAT
1. Maksimal 5 langkah penyelesaian untuk masalah ringan.
2. Bahasa Indonesia yang sopan, singkat, mudah dipahami, TIDAK teknis.
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

## GAYA BAHASA
- Sopan dan profesional
- Singkat, tidak bertele-tele
- Mudah dipahami, tidak terlalu teknis
- Seperti membantu rekan kerja tanpa latar belakang IT`;
}

/**
 * Build the greeting/welcome message
 */
export function getWelcomeMessage() {
  return `Selamat datang di **AI Helpdesk ICT** Pertamina EP Asset 1 Regional 1 Field Lirik.

Saya siap membantu Anda menyelesaikan permasalahan ICT. Silakan pilih **divisi layanan** yang ingin Anda tanyakan terlebih dahulu.`;
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
  // Check if user is responding to "solved?" question
  if (isUnresolved(userMessage, sessionId)) {
    return {
      response: `Permasalahan ini memerlukan penanganan lebih lanjut oleh Engineer ICT.\n\nSilakan tekan tombol **Hubungi Engineer** untuk menghubungi engineer melalui WhatsApp.`,
      shouldEscalate: true,
      isResolved: false
    };
  }

  if (isResolved(userMessage, sessionId)) {
    return {
      response: `Senang mendengar permasalahan sudah berhasil diselesaikan.\n\nJika ada permasalahan lain, jangan ragu untuk menghubungi kami kembali. Terima kasih telah menggunakan **AI Helpdesk ICT** Pertamina EP.`,
      shouldEscalate: false,
      isResolved: true
    };
  }

  // Step 1: Retrieve relevant knowledge chunks
  let contextChunks = [];
  try {
    contextChunks = await search(userMessage, division, 3);
  } catch (error) {
    console.warn('⚠️ Knowledge base search failed:', error.message);
  }

  // Step 2: Build system prompt with context
  const systemPrompt = buildSystemPrompt(division, contextChunks);

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

  // Step 4: Generate response via NVIDIA NIM
  try {
    if (!process.env.NVIDIA_API_KEY) {
      throw new Error('NVIDIA_API_KEY belum diisi di file .env');
    }

    let aiResponse;
    try {
      aiResponse = await streamChat(CHAT_MODEL, messages);
    } catch (primaryError) {
      console.warn(`⚠️ Model utama (${CHAT_MODEL}) gagal: ${primaryError.message}`);
      console.warn(`   Mencoba model cadangan: ${FALLBACK_MODEL}`);
      aiResponse = await streamChat(FALLBACK_MODEL, messages);
    }

    // Check if the AI itself suggests escalation
    const mentionsEngineer = aiResponse.toLowerCase().includes('hubungi engineer') ||
      aiResponse.toLowerCase().includes('engineer ict') ||
      aiResponse.toLowerCase().includes('masalah berat');

    return {
      response: aiResponse,
      shouldEscalate: mentionsEngineer,
      isResolved: false
    };
  } catch (error) {
    console.error('❌ NVIDIA chat error:', error.message);

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
