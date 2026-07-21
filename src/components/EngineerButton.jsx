import React from 'react';
import { IconWhatsapp } from './Icons.jsx';

export default function EngineerButton({ onClick }) {
  return (
    <div className="engineer-btn-wrapper">
      <button
        className="engineer-btn"
        onClick={onClick}
        aria-label="Hubungi Engineer melalui WhatsApp"
        id="engineer-btn"
      >
        <span className="engineer-btn-icon"><IconWhatsapp size={19} /></span>
        Hubungi Engineer
      </button>
    </div>
  );
}
