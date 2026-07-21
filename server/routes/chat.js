/**
 * Chat API Routes
 * Handles chat sessions, messages, and division selection
 */
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  createChatSession,
  getChatSession,
  updateChatSession,
  addChatMessage,
  getChatMessages
} from '../database/init.js';
import { chat, getWelcomeMessage, getDivisionPrompt } from '../services/ragService.js';

export const chatRouter = Router();

/**
 * POST /api/chat/new
 * Create a new chat session
 */
chatRouter.post('/new', (req, res) => {
  try {
    const sessionId = uuidv4();
    const session = createChatSession(sessionId);

    // Add welcome message
    const welcomeMsg = getWelcomeMessage();
    addChatMessage(sessionId, 'assistant', welcomeMsg);

    res.json({
      success: true,
      sessionId: session.id,
      message: welcomeMsg,
      needsDivision: true
    });
  } catch (error) {
    console.error('Error creating chat session:', error);
    res.status(500).json({ success: false, error: 'Gagal membuat sesi baru' });
  }
});

/**
 * POST /api/chat/reporter
 * Simpan data pelapor (nama, fungsi/divisi, lokasi) pada sesi.
 * Diisi lewat formulir pendataan sebelum pemilihan divisi layanan.
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

    if (!nama || !fungsi || !lokasi) {
      return res.status(400).json({
        success: false,
        error: 'Nama, fungsi/divisi, dan lokasi wajib diisi'
      });
    }

    const session = getChatSession(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Sesi tidak ditemukan' });
    }

    updateChatSession(sessionId, { reporter: { nama, fungsi, lokasi } });

    res.json({ success: true, reporter: { nama, fungsi, lokasi } });
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

    const validDivisions = ['printer', 'cctv', 'telepon', 'radio', 'windows', 'fttp', 'lan', 'wan'];
    if (!validDivisions.includes(division)) {
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

    // Update session with selected division
    updateChatSession(sessionId, { selectedDivision: division });

    const divisionNames = {
      printer: 'Printer', cctv: 'CCTV', telepon: 'Telepon',
      radio: 'Radio Komunikasi', windows: 'Windows',
      fttp: 'FTTP', lan: 'LAN', wan: 'WAN'
    };

    // Sapa dengan nama depan pelapor bila tersedia (keramahan + konteks nyata)
    const namaDepan = session.reporter?.nama?.trim().split(/\s+/)[0];
    const sapaan = namaDepan ? `Baik, ${namaDepan}. ` : 'Baik. ';

    const responseMsg = `${sapaan}Anda memilih layanan **${divisionNames[division]}**.\n\nSilakan ceritakan kendala yang Anda alami — sedetail mungkin akan lebih membantu. Saya siap memandu langkah demi langkah. 😊`;

    addChatMessage(sessionId, 'assistant', responseMsg);

    res.json({
      success: true,
      message: responseMsg,
      division
    });
  } catch (error) {
    console.error('Error selecting division:', error);
    res.status(500).json({ success: false, error: 'Gagal memilih divisi' });
  }
});

/**
 * POST /api/chat
 * Send a message and get AI response
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
    if (!session.selectedDivision) {
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

    // Process through RAG pipeline
    const result = await chat(sessionId, session.selectedDivision, message);

    // Save AI response
    addChatMessage(sessionId, 'assistant', result.response);

    // Update session status if resolved or escalated
    if (result.isResolved) {
      updateChatSession(sessionId, { status: 'resolved' });
    } else if (result.shouldEscalate) {
      updateChatSession(sessionId, { status: 'escalated' });
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

    updateChatSession(sessionId, { status: 'escalated' });
    addChatMessage(sessionId, 'system', 'Pengguna menghubungi Engineer melalui WhatsApp.');

    res.json({ success: true, message: 'Sesi ditandai sebagai eskalasi' });
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
