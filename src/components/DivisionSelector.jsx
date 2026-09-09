import React from 'react';
import { DivisionIcon, IconClose, IconHeadset } from './Icons.jsx';
import { LAYANAN_OTOMATIS } from '../data/layananOtomatis.js';

export default function DivisionSelector({
  divisions,
  onSelect,
  onClose
}) {
  const handleSelect = (div) => {
    // Semua divisi, termasuk End User, langsung masuk ke chat.
    // Tidak ada lagi pilihan Laptop / PC / Hardware / Software.
    onSelect(div);
  };

  return (
    <div
      className="division-overlay"
      onClick={onClose}
      id="division-overlay"
    >
      <div
        className="division-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Pilih Layanan IT"
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

        <h2 className="division-modal-title">
          Pilih Layanan yang Bermasalah
        </h2>

        <p className="division-modal-subtitle">
          Pilih satu kategori yang paling sesuai dengan kendala Anda.
          Layanan bertanda <strong>Langsung ke engineer</strong> memerlukan
          pemeriksaan di lokasi.
        </p>

        <div className="division-grid" id="division-grid">
          {divisions.map((div) => (
            <button
              key={div.id}
              type="button"
              className="division-card"
              onClick={() => handleSelect(div)}
              aria-label={`Pilih layanan ${div.name}`}
              id={`division-${div.id}`}
            >
              <span className="division-icon">
                <DivisionIcon id={div.id} size={20} />
              </span>

              <div>
                <div className="division-name">
                  {div.name}

                  {div.mode === 'engineer' && (
                    <span className="division-tag">
                      Langsung ke engineer
                    </span>
                  )}
                </div>

                <div className="division-desc">
                  {div.description}
                </div>
              </div>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="division-card division-card-auto"
          onClick={() => onSelect(LAYANAN_OTOMATIS)}
          aria-label="Saya tidak yakin layanan mana"
          id="division-auto"
        >
          <span className="division-icon">
            <IconHeadset size={20} />
          </span>

          <div>
            <div className="division-name">
              {LAYANAN_OTOMATIS.name}
            </div>

            <div className="division-desc">
              {LAYANAN_OTOMATIS.description}
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}