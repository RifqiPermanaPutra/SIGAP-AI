import React from 'react';
import { DivisionIcon, IconClose, IconHeadset } from './Icons.jsx';
import { LAYANAN_OTOMATIS } from '../data/layananOtomatis.js';

/**
 * Pemilihan layanan ICT — langkah pertama sebelum menyampaikan kendala.
 *  - onClose : keluar ke beranda
 */
export default function DivisionSelector({ divisions, onSelect, onClose }) {
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
                <div className="division-name">
                  {div.name}
                  {/* Sebagian layanan memang tidak memiliki langkah mandiri.
                      Ditandai sejak awal agar pengguna tidak menunggu panduan
                      perbaikan yang tidak akan muncul. */}
                  {div.mode === 'engineer' && (
                    <span className="division-tag">Langsung ke engineer</span>
                  )}
                </div>
                <div className="division-desc">{div.description}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Jalan keluar bagi yang tidak tahu kendalanya masuk layanan mana.
            Diletakkan setelah daftar, bukan di dalamnya: ini pilihan terakhir,
            bukan pilihan pertama. */}
        <button
          className="division-card division-card-auto"
          onClick={() => onSelect(LAYANAN_OTOMATIS)}
          aria-label="Saya tidak yakin layanan mana"
          id="division-auto"
        >
          <span className="division-icon"><IconHeadset size={20} /></span>
          <div>
            <div className="division-name">{LAYANAN_OTOMATIS.name}</div>
            <div className="division-desc">{LAYANAN_OTOMATIS.description}</div>
          </div>
        </button>

      </div>
    </div>
  );
}
