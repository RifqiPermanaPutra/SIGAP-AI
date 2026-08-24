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
import {
  chat, getWelcomeMessage, getDivisionPrompt, pilihDivisiOtomatis
} from '../services/answerService.js';
import {
  DIVISI_ID, namaDivisi, modeDivisi, areaDariLokasi, engineerTujuan
} from '../config/divisi.js';
import { wajibMasuk } from '../services/authService.js';
import { batasiLaju } from '../services/pembatasLaju.js';
// Daftar pilihan dipakai bersama antarmuka dan server. Memeriksanya hanya di
// antarmuka berarti tidak memeriksanya sama sekali — permintaan dapat dikirim
// langsung ke API tanpa melewati formulir.
import { FUNGSI_LIST } from '../../bersama/fungsi.js';
import { LOKASI_ALL } from '../../bersama/lokasi.js';
import { URGENSI_LIST } from '../../bersama/urgensi.js';

export const chatRouter = Router();

/**
 * Setiap sesi baru menulis satu baris ke basis data, sehingga rute ini adalah
 * satu-satunya yang dapat membuat berkas membengkak tanpa batas. Angkanya
 * dilonggarkan jauh di atas pemakaian wajar — satu orang biasanya membuka satu
 * sampai dua sesi per kunjungan — supaya beberapa pekerja yang berbagi satu
 * alamat NAT tidak ikut tertahan.
 */
const batasSesiBaru = batasiLaju({
  nama: 'sesi-baru',
  maks: 30,
  jendelaDetik: 10 * 60,
  pesan: 'Terlalu banyak sesi dibuat dari jaringan ini. Silakan tunggu beberapa menit.'
});

/** Pembatas percakapan, jauh lebih longgar karena ini pemakaian normal */
const batasPesan = batasiLaju({
  nama: 'pesan',
  maks: 120,
  jendelaDetik: 60,
  pesan: 'Terlalu banyak pesan terkirim. Silakan tunggu sejenak.'
});

/**
 * Penutup baku untuk setiap jawaban yang mengarahkan pengguna ke engineer.
 *
 * Dijadikan satu fungsi karena ada tiga jalan menuju engineer — layanan mode
 * engineer, keluhan yang tidak dikenali penentu layanan otomatis, dan langkah
 * SOP yang sudah habis — dan sebelumnya hanya jalur SOP yang menyebut halaman
 * cek status. Akibatnya pelapor Printer dan Windows tahu laporannya dapat
 * dipantau, sedangkan pelapor CCTV, LAN, dan lima layanan lainnya tidak.
 *
 * Alamatnya ditulis sebagai tautan Markdown, bukan sekadar disebut sebagai
 * teks '/tiket': yang disebut hanya dapat dibaca, yang ditautkan dapat ditekan.
 * Nomornya ikut dibawa pada alamat sehingga halaman tujuan langsung mencarinya
 * tanpa perlu diketik ulang dari layar sebelumnya.
 */
function penutupTiket(nomorTiket) {
  if (!nomorTiket) return '';
  return (
    `\n\nNomor tiket Anda: **${nomorTiket}**. Sebutkan nomor ini saat menghubungi engineer.` +
    `\n\nStatus laporan dapat diperiksa kapan saja di halaman ` +
    `[Cek Status Laporan](/tiket?nomor=${encodeURIComponent(nomorTiket)}).`
  );
}

/**
 * POST /api/chat/new
 * Create a new chat session
 */
chatRouter.post('/new', batasSesiBaru, (req, res) => {
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

/**
 * Tingkat urgensi yang diakui.
 *
 * Diturunkan dari daftar bersama, bukan dituliskan ulang. Sebelumnya keempat
 * nilainya disalin ke sini dengan komentar "harus sama dengan urgensi.js" —
 * dan komentar bukan penjaga: menambah satu tingkat di daftar bersama akan
 * membuat formulir menawarkannya sementara server menolaknya, tanpa ada yang
 * menyadarinya sampai ada pelapor yang gagal mengirim.
 */
const URGENSI_VALID = URGENSI_LIST.map((u) => u.nilai);

/**
 * POST /api/chat/reporter
 * Simpan data pelapor (nama, fungsi/divisi, lokasi, tingkat urgensi) pada sesi.
 * Diisi lewat formulir pelaporan saat kendala diteruskan kepada Engineer IT.
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

    // Fungsi dan lokasi ikut diperiksa terhadap daftarnya, sama seperti
    // urgensi. Sebelumnya keduanya diterima apa adanya, dan itu bukan sekadar
    // soal kerapian: pilihan saringan pada halaman rekap disusun dari nilai
    // DISTINCT yang tersimpan, sehingga satu kiriman ngawur akan menetap
    // selamanya di dalam dropdown yang dipakai admin.
    if (!FUNGSI_LIST.includes(fungsi)) {
      return res.status(400).json({ success: false, error: 'Fungsi/divisi tidak dikenali' });
    }

    // Lokasi menentukan area lewat areaDariLokasi(). Lokasi di luar daftar
    // menghasilkan area kosong, dan baris seperti itu hilang dari seluruh
    // sebaran per area tanpa jejak.
    if (!LOKASI_ALL.includes(lokasi)) {
      return res.status(400).json({ success: false, error: 'Lokasi tidak dikenali' });
    }

    // Nama satu-satunya isian bebas di sini. Dibatasi supaya satu kiriman
    // tidak dapat menanam ribuan karakter ke dalam kolom yang kelak dicetak
    // pada laporan.
    if (nama.length > 80) {
      return res.status(400).json({ success: false, error: 'Nama terlalu panjang (maksimal 80 karakter)' });
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

    // 'auto' bukan divisi sungguhan, melainkan pernyataan "saya tidak tahu
    // layanan mana". Divisinya ditentukan kemudian dari keluhan yang ditulis.
    if (division !== 'auto' && !DIVISI_ID.includes(division)) {
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

    // Sapa dengan nama depan pelapor bila tersedia (keramahan + konteks nyata)
    const namaDepan = session.reporter?.nama?.trim().split(/\s+/)[0];
    const sapaan = namaDepan ? `Baik, ${namaDepan}. ` : 'Baik. ';

    if (division === 'auto') {
      updateChatSession(sessionId, { divisi_id: null, mode_divisi: 'auto' });

      const pesanAuto =
        `${sapaan}Anda tidak perlu menentukan layanannya sendiri.\n\n` +
        'Ceritakan saja kendala yang Anda alami dengan bahasa sehari-hari — ' +
        'sebutkan perangkat atau hal yang bermasalah, misalnya *"printer di ruang admin tidak mau mencetak"* ' +
        'atau *"komputer saya tidak bisa masuk internet"*.\n\n' +
        'Kami yang akan menentukan layanan mana yang menanganinya.';

      addChatMessage(sessionId, 'assistant', pesanAuto);

      return res.json({
        success: true,
        message: pesanAuto,
        division: 'auto',
        mode: 'auto'
      });
    }

    const mode = modeDivisi(division);
    updateChatSession(sessionId, { divisi_id: division, mode_divisi: mode });

    // Divisi mode engineer tidak memiliki langkah SOP yang dapat dipandu
    // sendiri, sehingga harapan pengguna diluruskan sejak kalimat pembuka —
    // lebih baik daripada memberi kesan sistem akan menawarkan solusi.
    const responseMsg = mode === 'engineer'
      ? `${sapaan}Anda memilih layanan **${namaDivisi(division)}**.\n\n` +
        'Kendala pada layanan ini memerlukan pemeriksaan langsung oleh Engineer IT, ' +
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
chatRouter.post('/', batasPesan, async (req, res) => {
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

    // Belum memilih layanan dan tidak meminta penentuan otomatis
    if (!session.divisi_id && session.mode_divisi !== 'auto') {
      const divPrompt = getDivisionPrompt();
      addChatMessage(sessionId, 'user', message);
      addChatMessage(sessionId, 'assistant', `Sebelum saya dapat membantu, silakan pilih **divisi layanan** terlebih dahulu.\n\n${divPrompt}`);

      return res.json({
        success: true,
        response: `Sebelum saya dapat membantu, silakan pilih **divisi layanan** terlebih dahulu.\n\n${divPrompt}`,
        needsDivision: true,
        shouldEscalate: false,
        menungguKonfirmasi: false
      });
    }

    // Pengguna yang sempat pergi lebih dari batas diam sudah ditandai
    // 'ditinggalkan' oleh penyapu berkala. Bila ia kembali dan melanjutkan,
    // sesinya harus dihidupkan lagi — kalau tidak, `berakhir_pada` tetap
    // memuat jam ia pergi, sehingga durasi pada laporan terpotong dan
    // laporannya sempat terhitung ditinggalkan padahal berlanjut.
    if (session.status === 'ditinggalkan') {
      updateChatSession(sessionId, { status: 'aktif', berakhir_pada: null });
    }

    // Save user message
    addChatMessage(sessionId, 'user', message);

    // Keluhan pertama disimpan tersendiri sebagai kolom rekap. Inilah sumber
    // utama perbaikan basis pengetahuan: dari sinilah diketahui kata apa yang
    // belum dikenali penyeragam bahasa.
    if (!session.keluhan) {
      updateChatSession(sessionId, { keluhan: message.trim() });
    }

    /* ── Penentuan layanan otomatis ────────────────────────────────
       Pengguna memilih "Saya tidak yakin", sehingga layanannya ditebak dari
       keluhan yang baru saja ditulis. */
    let sesi = session;
    let pembuka = '';

    if (!sesi.divisi_id && sesi.mode_divisi === 'auto') {
      const tebakan = pilihDivisiOtomatis(message);

      if (tebakan.hasil === 'pasti') {
        // Cukup meyakinkan untuk diputuskan sendiri. Keputusannya tetap
        // diberitahukan — pengguna berhak tahu laporannya diarahkan ke mana.
        sesi = updateChatSession(sessionId, {
          divisi_id: tebakan.divisi,
          mode_divisi: modeDivisi(tebakan.divisi)
        });
        pembuka = `Kendala ini kami arahkan ke layanan **${namaDivisi(tebakan.divisi)}**.\n\n`;

      } else if (tebakan.hasil === 'ragu') {
        // Ada beberapa kemungkinan. Menebak di antaranya berisiko mengirim
        // laporan ke engineer yang salah, jadi pengguna yang menentukan.
        const daftar = tebakan.pilihan.map((p) => namaDivisi(p.divisi));
        const balasan =
          'Keluhan Anda bisa termasuk beberapa layanan berikut:\n\n' +
          daftar.map((n) => `- **${n}**`).join('\n') +
          '\n\nSilakan pilih salah satu agar laporan Anda sampai ke engineer yang tepat.';

        addChatMessage(sessionId, 'assistant', balasan);

        return res.json({
          success: true,
          response: balasan,
          saranDivisi: tebakan.pilihan.map((p) => ({ id: p.divisi, name: namaDivisi(p.divisi) })),
          shouldEscalate: false,
          isResolved: false,
          menungguKonfirmasi: false,
          needsDivision: false
        });

      } else {
        // Tidak dikenali sama sekali. Bantuan engineer DITAWARKAN — statusnya
        // belum berubah, karena pengguna belum tentu menerimanya.
        updateChatSession(sessionId, { eskalasi_ditawarkan_pada: new Date().toISOString() });
        const balasan =
          'Terima kasih, keterangan Anda sudah kami catat.\n\n' +
          'Kendala Anda belum dapat kami kenali secara otomatis, sehingga akan diteruskan kepada Engineer IT untuk ditinjau langsung.\n\n' +
          'Silakan tekan tombol **Hubungi Engineer** dan lengkapi data pelaporan.' +
          penutupTiket(sesi.nomor_tiket);

        addChatMessage(sessionId, 'assistant', balasan);

        return res.json({
          success: true,
          response: balasan,
          shouldEscalate: true,
          isResolved: false,
          menungguKonfirmasi: false,
          needsDivision: false
        });
      }
    }

    // Divisi mode engineer tidak melalui pencocokan SOP sama sekali.
    if (sesi.mode_divisi === 'engineer') {
      if (!sesi.eskalasi_ditawarkan_pada) {
        updateChatSession(sessionId, { eskalasi_ditawarkan_pada: new Date().toISOString() });
      }

      const balasan = pembuka +
        'Terima kasih, keterangan Anda sudah kami catat.\n\n' +
        `Kendala **${namaDivisi(sesi.divisi_id)}** memerlukan penanganan langsung oleh Engineer IT.\n\n` +
        'Silakan tekan tombol **Hubungi Engineer** dan lengkapi data pelaporan agar engineer dapat menindaklanjuti.' +
        penutupTiket(sesi.nomor_tiket);

      addChatMessage(sessionId, 'assistant', balasan);

      return res.json({
        success: true,
        response: balasan,
        // Layanan mungkin baru ditentukan otomatis pada permintaan ini
        division: sesi.divisi_id,
        mode: sesi.mode_divisi,
        shouldEscalate: true,
        isResolved: false,
        // Tidak ada langkah yang dapat dicoba, sehingga tidak ada hasil
        // yang perlu dikonfirmasi.
        menungguKonfirmasi: false,
        needsDivision: false
      });
    }

    // Process through knowledge base
    const result = await chat(sessionId, sesi.divisi_id, message);

    // Save response. `pembuka` terisi bila layanannya barusan ditentukan
    // otomatis — pengguna diberi tahu ke mana kendalanya diarahkan.
    const balasanAkhir = pembuka + result.response +
      (result.shouldEscalate ? penutupTiket(sesi.nomor_tiket) : '');
    addChatMessage(sessionId, 'assistant', balasanAkhir);

    // Hasil pencocokan disimpan untuk rekap. Nilai `undefined` dilewati oleh
    // updateChatSession, sehingga catatan lama tidak tertimpa kosong.
    updateChatSession(sessionId, {
      masalah_cocok: result.masalahCocok,
      skor_cocok: result.skorCocok,
      solusi_terakhir: result.solusiTerakhir
    });

    // Status 'diteruskan' berarti laporan BERPINDAH TANGAN ke engineer, dan
    // itu baru terjadi di POST /chat/escalate — setelah pengguna mengisi
    // formulir. Menyetelnya di sini, saat sistem baru MENAWARKAN bantuan
    // engineer, menghasilkan baris rekap tanpa nama, fungsi, lokasi, maupun
    // area, sekaligus mengecilkan persentase selesai mandiri karena
    // penyebutnya ikut menghitung pengguna yang tidak pernah menghubungi
    // siapa pun. Lihat RANCANGAN-DATA.md §8.
    if (result.isResolved) {
      updateChatSession(sessionId, { status: 'selesai' });
    } else if (result.shouldEscalate && !sesi.eskalasi_ditawarkan_pada) {
      updateChatSession(sessionId, { eskalasi_ditawarkan_pada: new Date().toISOString() });
    }

    res.json({
      success: true,
      response: balasanAkhir,
      // Layanan mungkin baru ditentukan otomatis pada permintaan ini, sehingga
      // antarmuka perlu tahu agar kepala percakapan ikut diperbarui.
      division: sesi.divisi_id,
      mode: sesi.mode_divisi,
      shouldEscalate: result.shouldEscalate,
      isResolved: result.isResolved,
      menungguKonfirmasi: result.menungguKonfirmasi === true,
      // Masalah terdekat saat keluhan belum dikenali. Disajikan antarmuka
      // sebagai tombol: satu ketukan jauh lebih mungkin dilakukan daripada
      // mengetik ulang keluhan di ponsel sambil berdiri di depan perangkat.
      saranMasalah: result.saranMasalah || [],
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
 *
 * Mengembalikan sesi beserta data pelapornya — nama, fungsi, lokasi — sehingga
 * WAJIB melalui autentikasi. Sebelumnya terbuka bagi siapa pun yang mengetahui
 * id sesi. Antarmuka pelapor tidak memakainya sama sekali; yang membutuhkannya
 * hanya penelusuran oleh engineer atau admin.
 */
chatRouter.get('/history/:sessionId', wajibMasuk('admin', 'engineer'), (req, res) => {
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
