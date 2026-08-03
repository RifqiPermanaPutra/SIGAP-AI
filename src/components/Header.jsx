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

      <div className="header-logo-container" id="logo-container" aria-label="Pertamina EP dan SATU-IT SIGAP">
        <img src="/logo-pertamina-ep.svg" alt="Pertamina EP" className="pertamina-logo-img" />
        {/* Disembunyikan otomatis bila berkas logonya belum tersedia */}
        <img
          src="/logo-satu-it-sigap.png"
          alt="SATU-IT SIGAP"
          className="satu-it-logo-img"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      </div>

      <div className="header-info">
        <h1 className="header-title">
          SIGAP AI
          {division && (
            <span className="division-badge">
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
