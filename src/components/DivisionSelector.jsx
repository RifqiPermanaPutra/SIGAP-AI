import React from 'react';
import { DivisionIcon, IconClose, IconArrowLeft } from './Icons.jsx';
import Stepper from './Stepper.jsx';

/**
 * Pemilihan layanan ICT — langkah 2 dari 2.
 *  - onBack  : kembali mengubah data pelapor (kontrol & kebebasan pengguna)
 *  - onClose : keluar ke beranda
 */
export default function DivisionSelector({ divisions, onSelect, onBack, onClose }) {
  return (
    <div className="division-overlay" onClick={onClose} id="division-overlay">
      <div
        className="division-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Pilih Layanan ICT"
      >
        {onClose && (
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Tutup dan kembali ke beranda"
            id="division-close"
          >
            <IconClose size={18} />
          </button>
        )}

        <Stepper current={2} />

        <h2 className="division-modal-title">Pilih Layanan yang Bermasalah</h2>
        <p className="division-modal-subtitle">
          Pilih satu kategori yang paling sesuai dengan kendala Anda.
        </p>

        <div className="division-grid" id="division-grid">
          {divisions.map((div) => (
            <button
              key={div.id}
              className="division-card"
              onClick={() => onSelect(div)}
              aria-label={`Pilih layanan ${div.name}`}
              id={`division-${div.id}`}
            >
              <span className="division-icon"><DivisionIcon id={div.id} size={20} /></span>
              <div>
                <div className="division-name">{div.name}</div>
                <div className="division-desc">{div.description}</div>
              </div>
            </button>
          ))}
        </div>

        {onBack && (
          <button type="button" className="division-back" onClick={onBack} id="division-back">
            <IconArrowLeft size={16} />
            Kembali ke data pelapor
          </button>
        )}
      </div>
    </div>
  );
}
