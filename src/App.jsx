import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import ChatInput from './components/ChatInput.jsx';
import DivisionSelector from './components/DivisionSelector.jsx';
import IntakeForm from './components/IntakeForm.jsx';
import Landing from './components/Landing.jsx';
import { DIVISI_CADANGAN } from './data/divisiCadangan.js';

const API_BASE = '/api';

const jam = () =>
  new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

/**
 * Sambutan pembuka.
 *
 * Ditampilkan dari sisi peramban, TIDAK diambil dari server — mengambilnya
 * berarti membuat sesi, dan sesi tidak boleh lahir hanya karena halaman
 * dibuka. Isinya wajib sama persis dengan `getWelcomeMessage()` di
 * `server/services/answerService.js`.
 */
const SAMBUTAN =
  'Selamat datang di **SIGAP**, layanan bantuan IT Pertamina EP Asset 1 Regional 1 Field Lirik.\n\n' +
  'Saya siap membantu menyelesaikan kendala IT Anda. Silakan pilih **layanan** yang ingin dilaporkan terlebih dahulu.';

const pesanSambutan = () => [{ role: 'assistant', content: SAMBUTAN, time: jam() }];

export default function App() {
  const [view, setView] = useState('landing');
  const [sessionId, setSessionId] = useState(null);
  // Nomor tiket dikirim server sejak sesi dibuat, tetapi sebelumnya dibuang
  // begitu saja. Akibatnya pesan WhatsApp ke engineer tidak memuat rujukan apa
  // pun, sehingga engineer tidak dapat menemukan tiketnya untuk ditandai
  // selesai — dan kolom waktu tanggap pada rekap tidak pernah terisi.
  const [nomorTiket, setNomorTiket] = useState(null);
  const [messages, setMessages] = useState(pesanSambutan);
  const [division, setDivision] = useState(null);
  const [reporter, setReporter] = useState(null);
  const [showIntake, setShowIntake] = useState(false);
  const [showDivisionSelector, setShowDivisionSelector] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showEngineerBtn, setShowEngineerBtn] = useState(false);
  // Benar bila jawaban terakhir diakhiri pertanyaan "sudah teratasi?", sehingga
  // tombol Sudah/Belum berhasil layak ditawarkan. Ditentukan server, bukan
  // ditebak dari isi teks di sini.
  const [menungguKonfirmasi, setMenungguKonfirmasi] = useState(false);
  // Berisi pilihan layanan bila penentuan otomatis belum cukup meyakinkan.
  // Menebak di antaranya berisiko mengirim laporan ke engineer yang salah.
  const [saranDivisi, setSaranDivisi] = useState(null);

  // Masalah terdekat saat keluhan belum dikenali. Disajikan sebagai tombol,
  // bukan butir teks: pelapor memakai ini dari ponsel sambil berdiri di depan
  // perangkat, dan di situ satu ketukan jauh lebih mungkin dilakukan daripada
  // mengetik ulang keluhannya "dengan kalimat yang lebih mendekati".
  const [saranMasalah, setSaranMasalah] = useState(null);
  const [config, setConfig] = useState(null);


  // Load config on mount
  useEffect(() => {
    fetch(`${API_BASE}/config`)
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(() => {
        // Server tidak terjangkau. Nomor WhatsApp sengaja dikosongkan, bukan
        // diisi contoh: mengirim pelapor ke nomor yang tidak dikenal lebih
        // buruk daripada mengatakan terus terang bahwa nomornya belum ada.
        setConfig({ whatsappNumber: '', divisions: DIVISI_CADANGAN });
      });
  }, []);

  /**
   * Alamat yang dapat dibuka dari ponsel engineer.
   *
   * Pelapor sudah membuka halaman ini dari suatu alamat, dan bila ia berada di
   * jaringan kantor maka alamat itu justru sudah tepat — engineer berada di
   * jaringan yang sama. Karena itu `ALAMAT_PUBLIK` di `.env` hanya perlu diisi
   * bila alamatnya memang berbeda, misalnya di belakang reverse proxy.
   *
   * Kecuali localhost: bila pelapornya kebetulan duduk di komputer server,
   * `localhost` menunjuk ke ponsel engineer itu sendiri. Lebih baik tidak
   * mengirim tautan sama sekali daripada mengirim tautan yang pasti gagal.
   */
  const alamatUntukEngineer = () => {
    if (config?.alamatPublik) return config.alamatPublik;
    const { origin, hostname } = window.location;
    const lokal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);
    return lokal ? null : origin;
  };

  /**
   * Buka sesi percakapan baru di server.
   *
   * Dipanggil MALAS — hanya ketika pengguna benar-benar bertindak: memilih
   * layanan atau mengirim pesan pertama. Sebelumnya ini dijalankan saat
   * komponen dimuat, bahkan sementara pengguna masih di beranda, sehingga
   * setiap pembukaan halaman menyisipkan satu baris laporan dan membakar satu
   * nomor tiket. Pada data nyata 69 dari 83 sesi terbentuk seperti itu:
   * "Total laporan" pada rekap menghitung kunjungan, bukan laporan, dan sebuah
   * laporan sungguhan bisa bernomor SGP-…-0047 pada hari dengan tiga kejadian.
   *
   * TIDAK menyentuh daftar pesan. Pemanggilnya kerap sudah menambahkan pesan
   * pengguna sebelum ini dijalankan, dan menyetel ulang daftar akan menghapus
   * kalimat yang baru saja diketik orang itu.
   *
   * Mengembalikan id sesinya, bukan sekadar menyimpannya ke state: pemanggil
   * memerlukan id itu pada baris berikutnya, sedangkan pembaruan state React
   * belum terlihat sampai penggambaran ulang.
   *
   * @returns {Promise<string|null>} id sesi, atau null bila server menolak
   */
  const mulaiSesi = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/chat/new`, { method: 'POST' });
      const data = await res.json();

      // Server menjawab tetapi menolak — misalnya pembatas laju terlampaui.
      if (!data.success) {
        console.error('Server menolak pembuatan sesi:', data.error);
        return null;
      }

      setSessionId(data.sessionId);
      setNomorTiket(data.nomorTiket || null);
      return data.sessionId;
    } catch (error) {
      // Luring. TIDAK dibuatkan id palsu: id palsu membuat setiap permintaan
      // berikutnya ditolak server dengan galat yang membingungkan.
      console.error('Failed to start session:', error);
      return null;
    }
  }, []);

  // Kunci scroll body saat berada di tampilan chat
  useEffect(() => {
    document.body.classList.toggle('mode-chat', view === 'chat');
  }, [view]);

  // Handle division selection
  const handleDivisionSelect = async (selectedDivision) => {
    setShowDivisionSelector(false);
    setDivision(selectedDivision);
    setShowEngineerBtn(false);
    setMenungguKonfirmasi(false);

    // Cadangan bila server tidak dapat dihubungi. Sengaja tidak menjanjikan
    // panduan bertahap untuk layanan mode engineer, karena memang tidak ada.
    const sapaLokal = () => {
      const namaDepan = reporter?.nama?.trim().split(/\s+/)[0];
      const sapaan = namaDepan ? `Baik, ${namaDepan}. ` : 'Baik. ';
      const lanjutan = selectedDivision.mode === 'engineer'
        ? 'Kendala pada layanan ini memerlukan pemeriksaan langsung oleh Engineer IT. Silakan uraikan kendala Anda terlebih dahulu.'
        : 'Silakan uraikan kendala yang Anda alami. Semakin lengkap keterangannya, semakin cepat kami dapat membantu.';
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `${sapaan}Anda memilih layanan **${selectedDivision.name}**.\n\n${lanjutan}`,
        time: jam()
      }]);
    };

    // Layanan dapat dipilih langsung dari kartu di beranda, kadang sebelum
    // sesi selesai dibuat. Tanpa sesi, permintaan ditolak server dan layar
    // diam tanpa penjelasan apa pun.
    const sid = sessionId || (await mulaiSesi());
    if (!sid) {
      sapaLokal();
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/chat/division`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, division: selectedDivision.id })
      });
      const data = await res.json();

      if (data.success) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.message,
          time: jam()
        }]);
      } else {
        // Server menjawab tetapi menolak — sebelumnya cabang ini kosong,
        // sehingga pengguna memilih layanan lalu tidak terjadi apa-apa.
        console.error('Server menolak pemilihan layanan:', data.error);
        sapaLokal();
      }
    } catch (error) {
      sapaLokal();
    }
  };

  // Masuk ke tampilan chat dari landing, langsung ke pemilihan layanan.
  // Data pelapor tidak diminta di sini, melainkan nanti saat kendala benar-benar
  // perlu diteruskan ke engineer.
  const handleStart = () => {
    setView('chat');
    if (!division) setShowDivisionSelector(true);
  };

  // Pilih layanan langsung dari kartu di landing
  const handleLandingDivision = (selectedDivision) => {
    setView('chat');
    handleDivisionSelect(selectedDivision);
  };

  // Kirim formulir pelaporan, lalu buka WhatsApp engineer
  const handleIntakeSubmit = async (data) => {
    setReporter(data);
    setShowIntake(false);

    // Simpan ke sesi di server (diam-diam; alur tetap jalan bila gagal)
    if (sessionId) {
      try {
        await fetch(`${API_BASE}/chat/reporter`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, reporter: data })
        });
        await fetch(`${API_BASE}/chat/escalate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });
      } catch (e) {
        // Silent fail — pengaduan tetap dapat diteruskan lewat WhatsApp
      }
    }

    bukaWhatsApp(data);
  };

  // Batalkan pelaporan — kembali ke percakapan, bukan ke beranda,
  // agar pengguna tidak kehilangan riwayat percakapannya.
  const handleIntakeClose = () => {
    setShowIntake(false);
  };

  // Tutup pemilihan layanan. Bila belum ada layanan terpilih, keluar ke beranda;
  // bila sudah ada, cukup menutup dan tetap di percakapan.
  const handleDivisionClose = () => {
    setShowDivisionSelector(false);
    if (!division) setView('landing');
  };

  // Send message
  const handleSendMessage = async (message) => {
    if (!message.trim() || isLoading) return;

    // If no division selected, show selector
    if (!division) {
      setShowDivisionSelector(true);
      return;
    }

    const userMsg = {
      role: 'user',
      content: message,
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    // Pertanyaan sebelumnya sudah dijawab — tombolnya disembunyikan sampai
    // jawaban berikutnya menentukan apakah perlu ditawarkan lagi.
    setMenungguKonfirmasi(false);
    setSaranDivisi(null);
    setSaranMasalah(null);

    try {
      // Sesi bisa saja belum terbentuk bila server sempat tidak terjangkau
      // saat halaman dibuka. Dicoba sekali lagi di sini alih-alih membalas
      // dengan galat yang tidak menjelaskan apa pun.
      const sid = sessionId || (await mulaiSesi());
      if (!sid) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Maaf, sambungan ke server belum tersedia sehingga kendala Anda belum dapat diproses.\n\nSilakan coba lagi sebentar, atau tekan tombol **Hubungi Engineer** untuk melaporkan langsung.',
          time: jam()
        }]);
        setShowEngineerBtn(true);
        return;
      }

      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, message })
      });
      const data = await res.json();

      if (data.success) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.response,
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        }]);

        setMenungguKonfirmasi(data.menungguKonfirmasi === true);
        setSaranDivisi(data.saranDivisi?.length ? data.saranDivisi : null);
        setSaranMasalah(data.saranMasalah?.length ? data.saranMasalah : null);

        // Layanan dapat baru ditentukan server pada balasan ini (pilihan
        // "Saya tidak yakin"). Keadaan di sini disamakan supaya kepala
        // percakapan dan nomor WhatsApp tujuan ikut benar.
        if (data.division && data.division !== division?.id) {
          const cocok = config?.divisions?.find((d) => d.id === data.division);
          if (cocok) setDivision(cocok);
        }

        if (data.shouldEscalate) {
          setShowEngineerBtn(true);
        }

        if (data.isResolved) {
          setShowEngineerBtn(false);
        }
      } else {
        // Kegagalan sistem tidak boleh menutup jalan ke engineer. Tanpa tombol
        // ini pengguna terjebak pada pesan galat tanpa cara melanjutkan —
        // padahal kendala IT-nya masih ada dan justru itu tujuannya datang.
        console.error('Server menolak pesan:', data.error);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Maaf, kendala Anda belum dapat diproses saat ini.\n\nSilakan coba kirim ulang, atau tekan tombol **Hubungi Engineer** agar laporan Anda diteruskan langsung.',
          time: jam()
        }]);
        setShowEngineerBtn(true);
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Maaf, sambungan ke server terputus sehingga kendala Anda belum dapat diproses.\n\nSilakan coba lagi, atau tekan tombol **Hubungi Engineer** untuk melaporkan langsung melalui WhatsApp.',
        time: jam()
      }]);
      setShowEngineerBtn(true);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Mulai percakapan baru.
   *
   * Dikosongkan di peramban saja — TIDAK memanggil server. Menekan "chat baru"
   * belum berarti ada kendala yang hendak dilaporkan; sesinya lahir nanti,
   * begitu layanan dipilih. Sesi lama dibiarkan apa adanya: penyapu berkala
   * akan menandainya ditinggalkan bila memang tidak dilanjutkan.
   */
  const handleNewChat = () => {
    setSessionId(null);
    setNomorTiket(null);
    setMessages(pesanSambutan());
    setDivision(null);
    setReporter(null);
    setShowEngineerBtn(false);
    setMenungguKonfirmasi(false);
    setSaranDivisi(null);
    setSaranMasalah(null);
    setShowDivisionSelector(true);
  };

  // Tombol "Hubungi Engineer" kini membuka formulir pelaporan terlebih dahulu.
  // Data pelapor baru diminta pada titik ini, saat memang dibutuhkan engineer.
  const handleEngineerContact = () => {
    setShowIntake(true);
  };

  /**
   * Susun pesan WhatsApp dan buka aplikasinya.
   * @param {{nama:string, fungsi:string, lokasi:string, urgensi:string}} data
   */
  const bukaWhatsApp = (data) => {
    // Setiap divisi punya engineer sendiri. Nomor divisi diutamakan; nomor
    // umum hanya dipakai bila divisi tersebut belum didaftarkan nomornya.
    const waNumber = division?.whatsappNumber || config?.whatsappNumber;

    if (!waNumber) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Maaf, nomor WhatsApp engineer untuk layanan ini belum terdaftar. Silakan laporkan ke Fungsi IT agar nomor engineer ditambahkan.',
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      }]);
      return;
    }

    // Keluhan pertama pengguna disertakan agar engineer langsung paham
    // konteksnya tanpa perlu menanyakan ulang dari awal.
    const keluhan = messages.find(m => m.role === 'user')?.content?.trim();

    // Tautan langsung ke tiket ini pada halaman tugas engineer. Tanpa tautan,
    // menandai tiket selesai berarti membuka halaman rekap di ponsel lalu
    // mencari satu baris di dalam tabel enam belas kolom — hambatan yang
    // terbukti cukup untuk membuat pekerjaan itu tidak pernah dilakukan.
    const alamat = alamatUntukEngineer();
    const tautanSelesai = alamat && nomorTiket
      ? `${alamat}/tugas?tiket=${encodeURIComponent(nomorTiket)}`
      : null;

    const waMessage = encodeURIComponent(
      [
        `Halo Engineer ${division?.name || 'IT'}, saya membutuhkan bantuan lanjutan.`,
        '',
        // Nomor tiket paling atas: inilah rujukan bersama pelapor dan engineer,
        // dan satu-satunya cara engineer menemukan laporan ini pada rekap.
        nomorTiket ? `Nomor Tiket: ${nomorTiket}` : null,
        data?.nama ? `Nama: ${data.nama}` : null,
        data?.fungsi ? `Fungsi/Divisi: ${data.fungsi}` : null,
        data?.lokasi ? `Lokasi: ${data.lokasi}` : null,
        `Layanan: ${division?.name || 'IT'}`,
        data?.urgensi ? `Tingkat Urgensi: ${data.urgensi}` : null,
        keluhan ? `Keluhan: ${keluhan}` : null,
        '',
        'Kendala ini belum dapat diselesaikan melalui SIGAP.',
        tautanSelesai ? '' : null,
        tautanSelesai ? `Engineer: tandai selesai di ${tautanSelesai}` : null
      // Hanya buang baris null (data kosong); string kosong sengaja
      // dipertahankan sebagai baris pemisah agar pesan mudah dibaca.
      ].filter((baris) => baris !== null).join('\n')
    );

    window.open(`https://wa.me/${waNumber}?text=${waMessage}`, '_blank');
  };

  if (view === 'landing') {
    return (
      <Landing
        divisions={config?.divisions || []}
        onStart={handleStart}
        onPickDivision={handleLandingDivision}
      />
    );
  }

  return (
    <div className="app-container">
      <Header
        division={division}
        reporter={reporter}
        onNewChat={handleNewChat}
        onBack={() => setView('landing')}
      />

      <ChatWindow
        messages={messages}
        isLoading={isLoading}
        showEngineerBtn={showEngineerBtn}
        onEngineerContact={handleEngineerContact}
        division={division}
        onQuickReply={handleSendMessage}
        menungguKonfirmasi={menungguKonfirmasi}
        saranDivisi={saranDivisi}
        onPilihDivisi={(id) => {
          const cocok = config?.divisions?.find((d) => d.id === id);
          if (cocok) { setSaranDivisi(null); handleDivisionSelect(cocok); }
        }}
        saranMasalah={saranMasalah}
        // Judulnya dikirim sebagai pesan biasa. Judul berbobot 3× pada
        // pencocokan, sehingga mengirimnya utuh dipastikan mengenai masalah
        // yang dimaksud — tanpa perlu jalur khusus "pilih menurut id" yang
        // harus dijaga terpisah di sisi server.
        onPilihMasalah={(judul) => { setSaranMasalah(null); handleSendMessage(judul); }}
      />

      <ChatInput
        onSend={handleSendMessage}
        isLoading={isLoading}
        disabled={!division}
        placeholder={
          !division
            ? 'Silakan pilih layanan terlebih dahulu…'
            : 'Tuliskan kendala Anda di sini…'
        }
      />

      {showIntake && (
        <IntakeForm
          initial={reporter}
          onSubmit={handleIntakeSubmit}
          onClose={handleIntakeClose}
        />
      )}

      {!showIntake && showDivisionSelector && config && (
        <DivisionSelector
          divisions={config.divisions}
          onSelect={handleDivisionSelect}
          onClose={handleDivisionClose}
        />
      )}
    </div>
  );
}
