/**
 * Rute percakapan.
 *
 * Selain melayani percakapan, rute ini juga merekam data rekap (Lapis 1 & 2
 * pada RANCANGAN-DATA.md). Pencatatan sengaja dilakukan di sini, bukan di
 * antarmuka, agar tetap terekam meski pengguna menutup peramban di tengah
 * jalan.
 */
import { Router } from 'express';
// Node menyediakan pembuat UUID bawaan sejak versi 14.17, sehingga paket
// pihak ketiga tidak diperlukan lagi untuk keperluan ini.
import { randomUUID } from 'crypto';
import {
  createChatSession,
  getChatSession,
  updateChatSession,
  addChatMessage,
  getChatMessages
} from '../database/init.js';
import { chat, getWelcomeMessage, getDivisionPrompt } from '../services/answerService.js';
import {
  DIVISI_ID, namaDivisi, modeDivisi, areaDariLokasi, engineerTujuan
} from '../config/divisi.js';

export const chatRouter = Router();

/**
 * POST /api/chat/new
 * Create a new chat session
 */
chatRouter.post('/new', (req, res) => {
  try {
    const sessionId = randomUUID();
    const session = createChatSession(sessionId);

    // Add welcome message
    const welcomeMsg = getWelcomeMessage();
    addChatMessage(sessionId, 'assistant', welcomeMsg);

    res.json({
      success: true,
      sessionId: session.id,
      nomorTiket: session.nomor_tiket,
      message: welcomeMsg,
      needsDivision: true
    });
  } catch (error) {
    console.error('Error creating chat session:', error);
    res.status(500).json({ success: false, error: 'Gagal membuat sesi baru' });
  }
});

/** Tingkat urgensi yang diakui — harus sama dengan src/data/urgensi.js */
const URGENSI_VALID = ['Rendah', 'Sedang', 'Tinggi', 'Kritis'];

/**
 * POST /api/chat/reporter
 * Simpan data pelapor (nama, fungsi/divisi, lokasi, tingkat urgensi) pada sesi.
 * Diisi lewat formulir pelaporan saat kendala diteruskan kepada Engineer ICT.
 */
chatRouter.post('/reporter', (req, res) => {
  try {
    const { sessionId, reporter } = req.body;

    if (!sessionId || !reporter) {
      return res.status(400).json({
        success: false,
        error: 'sessionId dan data pelapor wajib diisi'
      });
    }

    const nama = (reporter.nama || '').trim();
    const fungsi = (reporter.fungsi || '').trim();
    const lokasi = (reporter.lokasi || '').trim();
    const urgensi = (reporter.urgensi || '').trim();

    if (!nama || !fungsi || !lokasi || !urgensi) {
      return res.status(400).json({
        success: false,
        error: 'Nama, fungsi/divisi, lokasi, dan tingkat urgensi wajib diisi'
      });
    }

    if (!URGENSI_VALID.includes(urgensi)) {
      return res.status(400).json({
        success: false,
        error: `Tingkat urgensi tidak valid. Pilihan: ${URGENSI_VALID.join(', ')}`
      });
    }

    const session = getChatSession(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Sesi tidak ditemukan' });
    }

    const data = { nama, fungsi, lokasi, urgensi };

    // Area diturunkan dari lokasi, tidak ditanyakan ulang kepada pengguna.
    updateChatSession(sessionId, { reporter: data, area: areaDariLokasi(lokasi) });

    res.json({ success: true, reporter: data });
  } catch (error) {
    console.error('Error saving reporter:', error);
    res.status(500).json({ success: false, error: 'Gagal menyimpan data pelapor' });
  }
});

/**
 * POST /api/chat/division
 * Select a division for the current session
 */
chatRouter.post('/division', (req, res) => {
  try {
    const { sessionId, division } = req.body;

    if (!sessionId || !division) {
      return res.status(400).json({
        success: false,
        error: 'sessionId dan division wajib diisi'
      });
    }

    if (!DIVISI_ID.includes(division)) {
      return res.status(400).json({
        success: false,
        error: 'Divisi tidak valid'
      });
    }

    const session = getChatSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sesi tidak ditemukan'
      });
    }

    const mode = modeDivisi(division);
    updateChatSession(sessionId, { divisi_id: division, mode_divisi: mode });

    // Sapa dengan nama depan pelapor bila tersedia (keramahan + konteks nyata)
    const namaDepan = session.reporter?.nama?.trim().split(/\s+/)[0];
    const sapaan = namaDepan ? `Baik, ${namaDepan}. ` : 'Baik. ';

    // Divisi mode engineer tidak memiliki langkah SOP yang dapat dipandu
    // sendiri, sehingga harapan pengguna diluruskan sejak kalimat pembuka —
    // lebih baik daripada memberi kesan sistem akan menawarkan solusi.
    const responseMsg = mode === 'engineer'
      ? `${sapaan}Anda memilih layanan **${namaDivisi(division)}**.\n\n` +
        'Kendala pada layanan ini memerlukan pemeriksaan langsung oleh Engineer ICT, ' +
        'sehingga akan kami teruskan kepada engineer yang menangani.\n\n' +
        'Silakan uraikan kendala Anda terlebih dahulu agar engineer memperoleh gambaran yang jelas sebelum menindaklanjuti.'
      : `${sapaan}Anda memilih layanan **${namaDivisi(division)}**.\n\n` +
        'Silakan uraikan kendala yang Anda alami. Semakin lengkap keterangannya, semakin cepat kami dapat membantu.';

    addChatMessage(sessionId, 'assistant', responseMsg);

    res.json({
      success: true,
      message: responseMsg,
      division,
      mode
    });
  } catch (error) {
    console.error('Error selecting division:', error);
    res.status(500).json({ success: false, error: 'Gagal memilih divisi' });
  }
});

/**
 * POST /api/chat
 * Send a message and get a response from the knowledge base
 */
chatRouter.post('/', async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({
        success: false,
        error: 'sessionId dan message wajib diisi'
      });
    }

    if (message.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Pesan terlalu panjang (maksimal 500 karakter)'
      });
    }

    const session = getChatSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sesi tidak ditemukan'
      });
    }

    // Check if division is selected
    if (!session.divisi_id) {
      const divPrompt = getDivisionPrompt();
      addChatMessage(sessionId, 'user', message);
      addChatMessage(sessionId, 'assistant', `Sebelum saya dapat membantu, silakan pilih **divisi layanan** terlebih dahulu.\n\n${divPrompt}`);

      return res.json({
        success: true,
        response: `Sebelum saya dapat membantu, silakan pilih **divisi layanan** terlebih dahulu.\n\n${divPrompt}`,
        needsDivision: true,
        shouldEscalate: false
      });
    }

    // Save user message
    addChatMessage(sessionId, 'user', message);

    // Keluhan pertama disimpan tersendiri sebagai kolom rekap. Inilah sumber
    // utama perbaikan basis pengetahuan: dari sinilah diketahui kata apa yang
    // belum dikenali penyeragam bahasa.
    if (!session.keluhan) {
      updateChatSession(sessionId, { keluhan: message.trim() });
    }

    // Divisi mode engineer tidak melalui pencocokan SOP sama sekali.
    if (session.mode_divisi === 'engineer') {
      const balasan =
        `Terima kasih, keterangan Anda sudah kami catat dengan nomor tiket **${session.nomor_tiket}**.\n\n` +
        `Kendala **${namaDivisi(session.divisi_id)}** memerlukan penanganan langsung oleh Engineer ICT.\n\n` +
        'Silakan tekan tombol **Hubungi Engineer** dan lengkapi data pelaporan agar engineer dapat menindaklanjuti.';

      addChatMessage(sessionId, 'assistant', balasan);

      return res.json({
        success: true,
        response: balasan,
        shouldEscalate: true,
        isResolved: false,
        needsDivision: false
      });
    }

    // Process through knowledge base
    const result = await chat(sessionId, session.divisi_id, message);

    // Save response
    addChatMessage(sessionId, 'assistant', result.response);

    // Hasil pencocokan disimpan untuk rekap. Nilai `undefined` dilewati oleh
    // updateChatSession, sehingga catatan lama tidak tertimpa kosong.
    updateChatSession(sessionId, {
      masalah_cocok: result.masalahCocok,
      skor_cocok: result.skorCocok,
      solusi_terakhir: result.solusiTerakhir
    });

    // Update session status if resolved or escalated
    if (result.isResolved) {
      updateChatSession(sessionId, { status: 'selesai' });
    } else if (result.shouldEscalate) {
      updateChatSession(sessionId, { status: 'diteruskan' });
    }

    res.json({
      success: true,
      response: result.response,
      shouldEscalate: result.shouldEscalate,
      isResolved: result.isResolved,
      needsDivision: false
    });
  } catch (error) {
    console.error('Error processing chat:', error);
    res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan saat memproses pesan'
    });
  }
});

/**
 * POST /api/chat/escalate
 * Mark session as escalated
 */
chatRouter.post('/escalate', (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId wajib diisi' });
    }

    const session = getChatSession(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Sesi tidak ditemukan' });
    }

    updateChatSession(sessionId, {
      status: 'diteruskan',
      engineer_tujuan: engineerTujuan(session.divisi_id)
    });
    addChatMessage(sessionId, 'system', 'Pengguna menghubungi Engineer melalui WhatsApp.');

    res.json({ success: true, message: 'Sesi ditandai sebagai eskalasi', nomorTiket: session.nomor_tiket });
  } catch (error) {
    console.error('Error escalating:', error);
    res.status(500).json({ success: false, error: 'Gagal melakukan eskalasi' });
  }
});

/**
 * GET /api/chat/history/:sessionId
 * Get chat history for a session
 */
chatRouter.get('/history/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const messages = getChatMessages(sessionId);
    const session = getChatSession(sessionId);

    res.json({
      success: true,
      session,
      messages
    });
  } catch (error) {
    console.error('Error getting history:', error);
    res.status(500).json({ success: false, error: 'Gagal mengambil riwayat chat' });
  }
});
