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
import { initDatabase, tandaiSesiTerbengkalai } from './server/database/init.js';
import { siapkanAkunAwal } from './server/services/authService.js';
import { DIVISIONS, nomorEngineer } from './server/config/divisi.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Batas diam sebelum sebuah sesi dianggap ditinggalkan penggunanya.
const MENIT_SESI_TERBENGKALAI = Number(process.env.MENIT_SESI_TERBENGKALAI || 30);

// Middleware
//
// Kompresi harus dipasang sebelum penyajian berkas statis. Tanpa ini, berkas
// JavaScript terkirim utuh sekitar 440 KB meskipun peramban meminta gzip;
// dengan kompresi, yang berpindah hanya sekitar 130 KB.
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Serve static frontend files (after build)
//
// Nama berkas hasil build memuat sidik jari isi (misalnya index-B8L8w8uq.js),
// sehingga aman disimpan peramban dalam jangka panjang. Berkas index.html
// tidak boleh ikut disimpan agar pengguna selalu memperoleh versi terbaru.
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'AI Helpdesk ICT - Pertamina EP',
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

    // Sesi yang ditinggalkan pengguna di tengah jalan tidak akan pernah
    // menutup dirinya sendiri. Tanpa penyapuan berkala, statusnya bertahan
    // 'aktif' selamanya dan seluruh perhitungan rekap ikut salah.
    const sapuSesi = () => {
      const jumlah = tandaiSesiTerbengkalai(MENIT_SESI_TERBENGKALAI);
      if (jumlah > 0) console.log(`🧹 ${jumlah} sesi ditandai ditinggalkan`);
    };
    sapuSesi();
    setInterval(sapuSesi, 5 * 60 * 1000).unref();

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
