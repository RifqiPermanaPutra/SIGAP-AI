import React from 'react';

/**
 * Saran kendala singkat yang paling sering dilaporkan.
 * Setiap divisi memiliki quick replies masing-masing.
 * End User langsung menggunakan 5 kendala umum tanpa kategori tambahan.
 */
const SUGGESTIONS = {
  printer: [
    'Printer statusnya offline',
    'Kertas nyangkut (paper jam)',
    'Hasil cetak buram atau bergaris'
  ],

  cctv: [
    'Kamera tidak tampil di monitor',
    'Rekaman CCTV tidak tersimpan',
    'Gambar kamera gelap'
  ],

  telepon: [
    'Telepon tidak ada nada sama sekali',
    'Tidak bisa telepon keluar',
    'Suara putus-putus saat bicara'
  ],

  radio: [
    'Radio HT tidak ada suara',
    'Sinyal radio lemah',
    'Baterai HT cepat habis'
  ],

  endUser: [
    'Laptop atau PC tidak bisa menyala',
    'Tidak bisa login ke laptop, PC, atau sistem',
    'Laptop atau PC terasa sangat lambat',
    'Aplikasi atau software tidak bisa dibuka',
    'Keyboard, mouse, atau perangkat lain tidak berfungsi'
  ],

  ftth: [
    'Lampu LOS pada ONU menyala merah',
    'ONU tidak menyala sama sekali',
    'Internet lambat dari ONU'
  ],

  lan: [
    'Tidak ada koneksi internet',
    'Kabel LAN terlepas atau longgar',
    'Lampu port switch tidak menyala'
  ],

  multimedia: [
    'Sound system tidak mengeluarkan suara',
    'Tinta printer habis atau tidak keluar',
    'Persiapan rapat bermasalah'
  ]
};

export default function QuickReplies({
  divisionId,
  categoryId,
  onPick,
  disabled
}) {
  // End User langsung menggunakan 5 kendala umum.
  // Tidak lagi bergantung pada categoryId.
  const items =
    divisionId === 'end-user'
      ? SUGGESTIONS.endUser
      : SUGGESTIONS[divisionId];

  if (!items || items.length === 0) return null;

  return (
    <div className="quick-replies" id="quick-replies">
      <p className="quick-replies-label">
        Kendala yang sering dilaporkan
      </p>

      <div className="quick-replies-list">
        {items.map((text) => (
          <button
            key={text}
            type="button"
            className="quick-reply"
            onClick={() => onPick(text)}
            disabled={disabled}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}