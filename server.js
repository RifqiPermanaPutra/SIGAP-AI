import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { chatRouter } from './server/routes/chat.js';
import { kbRouter } from './server/routes/knowledgebase.js';
import { authRouter } from './server/routes/auth.js';
import { rekapRouter } from './server/routes/rekap.js';
import { sopRouter } from './server/routes/sop.js';
import { tiketRouter } from './server/routes/tiket.js';
import { tugasRouter } from './server/routes/tugas.js';
import { initDatabase } from './server/database/init.js';
import { siapkanAkunAwal } from './server/services/authService.js';
import { mulaiPemeliharaan } from './server/services/pemeliharaan.js';
import { DIVISIONS, nomorEngineer } from './server/config/divisi.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Bila aplikasi disajikan di belakang reverse proxy (nginx, IIS), alamat asli
// pengunjung berada pada header X-Forwarded-For. Tanpa pengaturan ini seluruh
// permintaan tampak berasal dari alamat proxy, sehingga pembatas laju akan
// menahan semua orang sekaligus begitu satu pengguna melampaui batas.
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use(
  express.static(path.join(__dirname, 'dist'), {
    maxAge: '1y',
    etag: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  })
);

// API Routes
app.use('/api/chat', chatRouter);
app.use('/api/kb', kbRouter);
app.use('/api/auth', authRouter);
app.use('/api/rekap', rekapRouter);
app.use('/api/sop', sopRouter);
// Terbuka tanpa masuk — isinya sengaja tanpa data pribadi, lihat routes/tiket.js
app.use('/api/tiket', tiketRouter);
app.use('/api/tugas', tugasRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SIGAP — Layanan Bantuan ICT Pertamina EP',
    timestamp: new Date().toISOString()
  });
});

// Config endpoint (safe public config for frontend)
app.get('/api/config', (req, res) => {
  const divisions = DIVISIONS.map(({ id, name, description, env, mode }) => ({
    id,
    name,
    description,
    // Menentukan alur di antarmuka: 'swalayan' melewati langkah SOP lebih
    // dulu, 'engineer' langsung menuju formulir pelapor.
    mode,
    whatsappNumber: nomorEngineer(env),
    // Menandai divisi yang belum punya nomor sendiri, berguna untuk audit
    usingFallback: !(process.env[env] || '').trim()
  }));

  res.json({
    whatsappNumber: nomorEngineer('WHATSAPP_DEFAULT'),
    // Alamat yang dapat dibuka dari LUAR mesin ini. Dipakai menyusun tautan
    // "Tandai Selesai" di dalam pesan WhatsApp: engineer membukanya dari
    // ponsel, dan di sana `localhost` menunjuk ke ponselnya sendiri.
    // Dikosongkan bila belum diatur — tautannya cukup tidak disertakan,
    // daripada mengirim tautan yang pasti gagal dibuka.
    alamatPublik: (process.env.ALAMAT_PUBLIK || '').trim().replace(/\/+$/, ''),
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

    await siapkanAkunAwal();

    // Pencadangan harian, retensi data, penyapuan sesi yang ditinggalkan, dan
    // pembersihan berkas lama — seluruhnya di server/services/pemeliharaan.js
    mulaiPemeliharaan();

    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════╗
║   SIGAP — Layanan Bantuan ICT                    ║
║   Pertamina EP Asset 1 Regional 1 Field Lirik    ║
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
