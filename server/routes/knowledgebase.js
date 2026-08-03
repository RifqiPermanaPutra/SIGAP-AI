/**
 * Knowledge Base API Routes
 *
 * Basis pengetahuan berupa berkas JSON yang dibangun dari dokumen SOP melalui
 * perintah `npm run build:kb`. Tidak ada proses embedding maupun panggilan ke
 * layanan AI, sehingga rute di sini hanya untuk memeriksa isi dan memuat ulang
 * berkas tersebut setelah SOP diperbarui.
 */
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { muatBasisPengetahuan, daftarMasalahDivisi } from '../services/answerService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const KB_FILE = path.join(__dirname, '..', 'data', 'knowledge-base.json');

export const kbRouter = Router();

const DIVISI = ['printer', 'cctv', 'telepon', 'radio', 'windows', 'fttp', 'lan', 'wan'];

/**
 * GET /api/kb/stats
 * Ringkasan isi basis pengetahuan per divisi
 */
kbRouter.get('/stats', (req, res) => {
  try {
    if (!fs.existsSync(KB_FILE)) {
      return res.status(404).json({
        success: false,
        error: 'Basis pengetahuan belum dibangun. Jalankan: npm run build:kb'
      });
    }

    const kb = JSON.parse(fs.readFileSync(KB_FILE, 'utf-8'));

    const perDivisi = {};
    for (const divisi of DIVISI) {
      const masalah = kb.masalah.filter((m) => m.divisi === divisi);
      perDivisi[divisi] = {
        masalah: masalah.length,
        ringan: masalah.filter((m) => m.kategori === 'ringan').length,
        berat: masalah.filter((m) => m.kategori === 'berat').length,
        solusi: masalah.reduce((t, m) => t + m.solusi.length, 0)
      };
    }

    res.json({
      success: true,
      dibuatPada: kb.dibuatPada,
      totalMasalah: kb.masalah.length,
      totalSolusi: kb.masalah.reduce((t, m) => t + m.solusi.length, 0),
      perDivisi
    });
  } catch (error) {
    console.error('Error membaca basis pengetahuan:', error);
    res.status(500).json({ success: false, error: 'Gagal membaca basis pengetahuan' });
  }
});

/**
 * GET /api/kb/masalah/:divisi
 * Daftar judul masalah pada satu divisi
 */
kbRouter.get('/masalah/:divisi', (req, res) => {
  const { divisi } = req.params;

  if (!DIVISI.includes(divisi)) {
    return res.status(400).json({ success: false, error: 'Divisi tidak valid' });
  }

  res.json({ success: true, divisi, masalah: daftarMasalahDivisi(divisi, 100) });
});

/**
 * POST /api/kb/reload
 * Muat ulang berkas basis pengetahuan tanpa perlu menghidupkan ulang server.
 * Dipakai setelah menjalankan `npm run build:kb`.
 */
kbRouter.post('/reload', (req, res) => {
  try {
    const jumlah = muatBasisPengetahuan();
    res.json({
      success: true,
      message: `Basis pengetahuan dimuat ulang: ${jumlah} masalah`
    });
  } catch (error) {
    console.error('Error memuat ulang basis pengetahuan:', error);
    res.status(500).json({ success: false, error: 'Gagal memuat ulang basis pengetahuan' });
  }
});
