import React, { useState } from 'react';
import { DivisionIcon, IconClose, IconHeadset } from './Icons.jsx';
import { LAYANAN_OTOMATIS } from '../data/layananOtomatis.js';

const END_USER_OPTIONS = [
  { id: 'laptop', name: 'Laptop', description: 'Kendala pada laptop yang digunakan', icon: '💻' },
  { id: 'pc', name: 'PC', description: 'Kendala pada komputer atau PC', icon: '🖥️' },
  { id: 'sistem-informasi', name: 'Sistem Informasi', description: 'Kendala pada sistem atau aplikasi internal', icon: '🗂️' },
  { id: 'hardware', name: 'Hardware', description: 'Kendala pada perangkat keras komputer', icon: '🔧' },
  { id: 'software', name: 'Software', description: 'Kendala pada aplikasi atau perangkat lunak', icon: '💿' }
];

export default function DivisionSelector({ divisions, onSelect, onClose }) {
  const [showEndUserCategories, setShowEndUserCategories] = useState(false);

  const handleSelect = (div) => {
    if (div.id === 'end-user') {
      setShowEndUserCategories(true);
      return;
    }
    onSelect(div);
  };

  const handleEndUserCategory = (category) => {
    const endUser = divisions.find((div) => div.id === 'end-user');
    if (!endUser) return;

    onSelect({
      ...endUser,
      categoryId: category.id,
      categoryName: category.name,
      name: `End User - ${category.name}`,
      description: category.description
    });
  };

  return (
    <div className="division-overlay" onClick={onClose} id="division-overlay">
      <div
        className="division-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Pilih Layanan IT"
      >
        {onClose && (
          <button type="button" className="modal-close" onClick={onClose}
            aria-label="Tutup dan kembali ke beranda" id="division-close">
            <IconClose size={18} />
          </button>
        )}

        {!showEndUserCategories ? (
          <>
            <h2 className="division-modal-title">Pilih Layanan yang Bermasalah</h2>
            <p className="division-modal-subtitle">
              Pilih satu kategori yang paling sesuai dengan kendala Anda.
            </p>

            <div className="division-grid" id="division-grid">
              {divisions.map((div) => (
                <button
                  key={div.id}
                  className="division-card"
                  onClick={() => handleSelect(div)}
                  aria-label={`Pilih layanan ${div.name}`}
                  id={`division-${div.id}`}
                >
                  <span className="division-icon"><DivisionIcon id={div.id} size={20} /></span>
                  <div>
                    <div className="division-name">
                      {div.name}
                      {div.mode === 'engineer' && (
                        <span className="division-tag">Langsung ke engineer</span>
                      )}
                    </div>
                    <div className="division-desc">{div.description}</div>
                  </div>
                </button>
              ))}
            </div>

            <button className="division-card division-card-auto"
              onClick={() => onSelect(LAYANAN_OTOMATIS)}
              aria-label="Saya tidak yakin layanan mana" id="division-auto">
              <span className="division-icon"><IconHeadset size={20} /></span>
              <div>
                <div className="division-name">{LAYANAN_OTOMATIS.name}</div>
                <div className="division-desc">{LAYANAN_OTOMATIS.description}</div>
              </div>
            </button>
          </>
        ) : (
          <>
            <button type="button" className="modal-back"
              onClick={() => setShowEndUserCategories(false)}>
              ← Kembali
            </button>

            <h2 className="division-modal-title">End User</h2>
            <p className="division-modal-subtitle">
              Pilih jenis perangkat atau layanan yang mengalami kendala.
            </p>

            <div className="division-grid" id="end-user-category-grid">
              {END_USER_OPTIONS.map((category) => (
                <button
                  key={category.id}
                  className="division-card"
                  onClick={() => handleEndUserCategory(category)}
                  id={`end-user-${category.id}`}
                  aria-label={`Pilih ${category.name}`}
                >
                  <span className="division-icon">
                    <span aria-hidden="true">{category.icon}</span>
                  </span>
                  <div>
                    <div className="division-name">{category.name}</div>
                    <div className="division-desc">{category.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
