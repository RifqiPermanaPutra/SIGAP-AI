import React from 'react';
import { DivisionIcon, IconPlus, IconArrowLeft } from './Icons.jsx';

export default function Header({ division, reporter, onNewChat, onBack }) {
  // Ringkas identitas pelapor untuk ditampilkan di subjudul header
  const subtitle = reporter
    ? [reporter.nama, reporter.fungsi, reporter.lokasi].filter(Boolean).join(' · ')
    : 'Pertamina EP Asset 1 Regional 1 Field Lirik';

  return (
    <header className="header" id="app-header">
      <button
        className="header-back"
        onClick={onBack}
        title="Kembali ke beranda"
        aria-label="Kembali ke beranda"
        id="back-btn"
      >
        <IconArrowLeft size={18} />
      </button>

      {/* Bilah logo sengaja TIDAK ada di sini.
          Logo Pertamina EP + ONE + SIGAP berasio 4,57:1 — pada tinggi 28px ia
          memakan 128px lebar, dan bersama tombol kembali serta tombol
          percakapan baru jumlahnya melampaui lebar ponsel 393px. Dulu ia
          dipaksa turun ke baris kedua, membuat kepala halaman setinggi ±90px
          di layar yang ruang vertikalnya justru paling langka.

          Merek sudah ditegaskan di beranda dan halaman masuk — dua pintu yang
          pasti dilewati sebelum sampai ke sini. Mengulanginya di tiap layar
          percakapan tidak menambah pengenalan, hanya mengurangi ruang baca. */}

      <div className="header-info">
        <h1 className="header-title">
          <span className="header-nama">SIGAP</span>
          {division && (
            <span className="division-badge" title={division.name}>
              <DivisionIcon id={division.id} size={14} />
              {division.name}
            </span>
          )}
        </h1>
        <p className="header-subtitle" title={subtitle}>{subtitle}</p>
      </div>

      <div className="header-status" id="status-indicator">
        <span className="status-dot" />
        Online
      </div>

      <button
        className="header-new-chat"
        onClick={onNewChat}
        title="Percakapan Baru"
        aria-label="Mulai percakapan baru"
        id="new-chat-btn"
      >
        <IconPlus size={18} />
      </button>
    </header>
  );
}
