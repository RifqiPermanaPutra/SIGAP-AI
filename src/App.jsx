import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import ChatInput from './components/ChatInput.jsx';
import DivisionSelector from './components/DivisionSelector.jsx';
import IntakeForm from './components/IntakeForm.jsx';
import Landing from './components/Landing.jsx';

const API_BASE = '/api';

export default function App() {
  const [view, setView] = useState('landing');
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [division, setDivision] = useState(null);
  const [reporter, setReporter] = useState(null);
  const [showIntake, setShowIntake] = useState(false);
  const [showDivisionSelector, setShowDivisionSelector] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showEngineerBtn, setShowEngineerBtn] = useState(false);
  const [config, setConfig] = useState(null);

  // Divisi yang dipilih dari kartu landing sebelum data pelapor terisi;
  // diterapkan setelah formulir pendataan dikirim.
  const pendingDivisionRef = useRef(null);

  // Load config on mount
  useEffect(() => {
    fetch(`${API_BASE}/config`)
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(() => {
        // Fallback config
        setConfig({
          whatsappNumber: '6281234567890',
          divisions: [
            { id: 'printer', name: 'Printer', description: 'Masalah printer, cetak dokumen' },
            { id: 'cctv', name: 'CCTV', description: 'Kamera pengawas, DVR/NVR' },
            { id: 'telepon', name: 'Telepon', description: 'Telepon kantor, extension' },
            { id: 'radio', name: 'Radio Komunikasi', description: 'Radio HT, repeater' },
            { id: 'windows', name: 'Windows', description: 'Laptop, PC, sistem operasi' },
            { id: 'fttp', name: 'FTTP', description: 'Fiber to the premise, ONU' },
            { id: 'lan', name: 'LAN', description: 'Jaringan lokal, kabel LAN' },
            { id: 'wan', name: 'WAN', description: 'Jaringan luas, koneksi antar site' }
          ]
        });
      });
  }, []);

  // Start a new chat session
  const startNewSession = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/chat/new`, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        setSessionId(data.sessionId);
        setMessages([{
          role: 'assistant',
          content: data.message,
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        }]);
        setDivision(null);
        setShowEngineerBtn(false);
        setShowDivisionSelector(true);
      }
    } catch (error) {
      console.error('Failed to start session:', error);
      // Offline mode - create local session
      setSessionId('local-' + Date.now());
      setMessages([{
        role: 'assistant',
        content: `Selamat datang di **AI Helpdesk ICT** Pertamina EP Asset 1 Regional 1 Field Lirik.\n\nSaya siap membantu Anda menyelesaikan permasalahan ICT. Silakan pilih **divisi layanan** yang ingin Anda tanyakan terlebih dahulu.`,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      }]);
      setDivision(null);
      setShowEngineerBtn(false);
      setShowDivisionSelector(true);
    }
  }, []);

  // Init on mount
  useEffect(() => {
    startNewSession();
  }, [startNewSession]);

  // Kunci scroll body saat berada di tampilan chat
  useEffect(() => {
    document.body.classList.toggle('mode-chat', view === 'chat');
  }, [view]);

  // Handle division selection
  const handleDivisionSelect = async (selectedDivision) => {
    setShowDivisionSelector(false);
    setDivision(selectedDivision);

    try {
      const res = await fetch(`${API_BASE}/chat/division`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, division: selectedDivision.id })
      });
      const data = await res.json();

      if (data.success) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.message,
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        }]);
      }
    } catch (error) {
      // Fallback offline — tetap ramah dan personal
      const namaDepan = reporter?.nama?.trim().split(/\s+/)[0];
      const sapaan = namaDepan ? `Baik, ${namaDepan}. ` : 'Baik. ';
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `${sapaan}Anda memilih layanan **${selectedDivision.name}**.\n\nSilakan ceritakan kendala yang Anda alami — sedetail mungkin akan lebih membantu. Saya siap memandu langkah demi langkah. 😊`,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      }]);
    }
  };

  // Masuk ke tampilan chat dari landing.
  // Data pelapor didahulukan; pemilihan divisi baru terbuka setelahnya.
  const handleStart = () => {
    setView('chat');
    if (!reporter) {
      setShowIntake(true);
    } else if (!division) {
      setShowDivisionSelector(true);
    }
  };

  // Pilih divisi langsung dari kartu layanan di landing.
  // Bila data pelapor belum ada, tahan pilihan itu sampai formulir terisi.
  const handleLandingDivision = (selectedDivision) => {
    setView('chat');
    if (!reporter) {
      pendingDivisionRef.current = selectedDivision;
      setShowIntake(true);
    } else {
      handleDivisionSelect(selectedDivision);
    }
  };

  // Kirim data pelapor dari formulir pendataan
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
      } catch (e) {
        // Silent fail — data pelapor tetap tersimpan di sisi klien
      }
    }

    const pending = pendingDivisionRef.current;
    pendingDivisionRef.current = null;

    if (pending) {
      handleDivisionSelect(pending);
    } else {
      setShowDivisionSelector(true);
    }
  };

  // Tutup formulir pendataan (tombol silang) → batal, kembali ke beranda
  const handleIntakeClose = () => {
    setShowIntake(false);
    pendingDivisionRef.current = null;
    setView('landing');
  };

  // Tutup pemilihan divisi (tombol silang). Bila belum ada divisi terpilih,
  // keluar ke beranda; bila sudah ada, cukup menutup dan tetap di percakapan.
  const handleDivisionClose = () => {
    setShowDivisionSelector(false);
    if (!division) setView('landing');
  };

  // Kembali dari pemilihan layanan ke formulir data (untuk mengoreksi isian)
  const handleDivisionBack = () => {
    setShowDivisionSelector(false);
    setShowIntake(true);
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

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message })
      });
      const data = await res.json();

      if (data.success) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.response,
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        }]);

        if (data.shouldEscalate) {
          setShowEngineerBtn(true);
        }

        if (data.isResolved) {
          setShowEngineerBtn(false);
        }
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Maaf, terjadi kesalahan saat memproses pesan Anda. Silakan coba lagi.',
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Maaf, tidak dapat terhubung ke server. Pastikan server backend sedang berjalan.',
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle new chat
  const handleNewChat = () => {
    startNewSession();
  };

  // Handle engineer contact
  const handleEngineerContact = async () => {
    if (sessionId) {
      try {
        await fetch(`${API_BASE}/chat/escalate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });
      } catch (e) {
        // Silent fail
      }
    }

    // Setiap divisi punya engineer sendiri. Nomor divisi diutamakan; nomor
    // umum hanya dipakai bila divisi tersebut belum didaftarkan nomornya.
    const waNumber = division?.whatsappNumber || config?.whatsappNumber;

    if (!waNumber) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Maaf, nomor WhatsApp engineer untuk divisi ini belum terdaftar. Silakan laporkan ke Fungsi ICT agar nomor engineer divisi ditambahkan.',
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      }]);
      return;
    }

    // Keluhan pertama pengguna disertakan agar engineer langsung paham
    // konteksnya tanpa perlu menanyakan ulang dari awal.
    const keluhan = messages.find(m => m.role === 'user')?.content?.trim();

    const waMessage = encodeURIComponent(
      [
        `Halo Engineer ${division?.name || 'ICT'}, saya membutuhkan bantuan lanjutan.`,
        '',
        reporter?.nama ? `Nama: ${reporter.nama}` : null,
        reporter?.fungsi ? `Fungsi/Divisi: ${reporter.fungsi}` : null,
        reporter?.lokasi ? `Lokasi: ${reporter.lokasi}` : null,
        `Layanan: ${division?.name || 'ICT'}`,
        keluhan ? `Keluhan: ${keluhan}` : null,
        '',
        'Permasalahan ini belum dapat diselesaikan melalui AI Helpdesk ICT.'
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
      />

      <ChatInput
        onSend={handleSendMessage}
        isLoading={isLoading}
        disabled={!division}
        placeholder={
          !division
            ? 'Pilih divisi layanan terlebih dahulu...'
            : 'Ketik permasalahan Anda di sini...'
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
          onBack={reporter ? handleDivisionBack : undefined}
          onClose={handleDivisionClose}
        />
      )}
    </div>
  );
}
