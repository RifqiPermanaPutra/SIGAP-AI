import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { chatRouter } from './server/routes/chat.js';
import { kbRouter } from './server/routes/knowledgebase.js';
import { initDatabase } from './server/database/init.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files (after build)
app.use(express.static(path.join(__dirname, 'dist')));

// API Routes
app.use('/api/chat', chatRouter);
app.use('/api/kb', kbRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'AI Helpdesk ICT - Pertamina EP',
    timestamp: new Date().toISOString()
  });
});

// Daftar divisi layanan ICT.
// Setiap divisi punya engineer penanggung jawab sendiri, sehingga nomor
// WhatsApp-nya diambil dari variabel lingkungan masing-masing. Bila belum
// diisi, eskalasi jatuh ke WHATSAPP_DEFAULT agar pengaduan tidak buntu.
const DIVISIONS = [
  { id: 'printer', name: 'Printer', description: 'Masalah printer, cetak dokumen', env: 'WHATSAPP_PRINTER' },
  { id: 'cctv', name: 'CCTV', description: 'Kamera pengawas, DVR/NVR', env: 'WHATSAPP_CCTV' },
  { id: 'telepon', name: 'Telepon', description: 'Telepon kantor, extension', env: 'WHATSAPP_TELEPON' },
  { id: 'radio', name: 'Radio Komunikasi', description: 'Radio HT, repeater', env: 'WHATSAPP_RADIO' },
  { id: 'windows', name: 'Windows', description: 'Laptop, PC, sistem operasi', env: 'WHATSAPP_WINDOWS' },
  { id: 'fttp', name: 'FTTP', description: 'Fiber to the premise, ONU', env: 'WHATSAPP_FTTP' },
  { id: 'lan', name: 'LAN', description: 'Jaringan lokal, kabel LAN', env: 'WHATSAPP_LAN' },
  { id: 'wan', name: 'WAN', description: 'Jaringan luas, koneksi antar site', env: 'WHATSAPP_WAN' }
];

/**
 * Normalkan nomor telepon ke format yang diterima wa.me.
 *
 * wa.me menuntut kode negara tanpa '+', sedangkan di lapangan nomor lazim
 * ditulis '0812-3456-789' atau '+62 812 3456 789'. Tanpa penyeragaman ini,
 * awalan '0' akan terkirim apa adanya dan tautan WhatsApp gagal dibuka.
 */
function normalkanNomor(input) {
  const digit = String(input || '').replace(/[^0-9]/g, '');
  if (!digit) return '';
  if (digit.startsWith('62')) return digit;      // sudah berkode negara
  if (digit.startsWith('0')) return '62' + digit.slice(1); // 08xx → 628xx
  if (digit.startsWith('8')) return '62' + digit;          // 8xx  → 628xx
  return digit;                                   // nomor luar negeri
}

/** Nomor WhatsApp engineer untuk sebuah divisi, dengan cadangan nomor umum */
function nomorEngineer(envKey) {
  const fallback = process.env.WHATSAPP_DEFAULT || process.env.WHATSAPP_NUMBER || '';
  return normalkanNomor((process.env[envKey] || '').trim() || fallback);
}

// Config endpoint (safe public config for frontend)
app.get('/api/config', (req, res) => {
  const divisions = DIVISIONS.map(({ id, name, description, env }) => ({
    id,
    name,
    description,
    whatsappNumber: nomorEngineer(env),
    // Menandai divisi yang belum punya nomor sendiri, berguna untuk audit
    usingFallback: !(process.env[env] || '').trim()
  }));

  res.json({
    whatsappNumber: nomorEngineer('WHATSAPP_DEFAULT'),
    divisions
  });
});

// SPA fallback — serve index.html for non-API routes
app.get('{*path}', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  }
});

// Initialize database and start server
async function start() {
  try {
    await initDatabase();
    console.log('✅ Database initialized');

    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════╗
║   AI Helpdesk ICT — Pertamina EP                ║
║   Asset 1 Regional 1 Field Lirik                ║
║                                                  ║
║   Server: http://localhost:${PORT}                  ║
║   Status: Running ✅                             ║
╚══════════════════════════════════════════════════╝
      `);

      // Eskalasi adalah jalur akhir pengaduan, jadi divisi yang belum punya
      // nomor engineer sendiri perlu terlihat jelas saat server dijalankan.
      const belumDiisi = DIVISIONS.filter(
        (d) => !(process.env[d.env] || '').trim()
      );

      if (belumDiisi.length > 0) {
        console.warn(
          `⚠️  ${belumDiisi.length} dari ${DIVISIONS.length} divisi belum punya nomor WhatsApp engineer sendiri.`
        );
        console.warn(
          `   Eskalasi divisi berikut diarahkan ke WHATSAPP_DEFAULT: ${belumDiisi.map((d) => d.name).join(', ')}`
        );
        console.warn('   Isi variabel terkait di berkas .env untuk mengarahkannya ke engineer masing-masing.\n');
      } else {
        console.log('✅ Seluruh divisi sudah punya nomor WhatsApp engineer sendiri.\n');
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

start();
