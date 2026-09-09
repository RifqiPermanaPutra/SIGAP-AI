import React from 'react';

/**
 * Saran kendala singkat yang paling sering dilaporkan.
 * End User dibagi lagi berdasarkan kategori yang dipilih pengguna.
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
  endUser: {
    laptop: [
      'Laptop tidak bisa menyala',
      'Laptop tidak bisa login',
      'Laptop terasa sangat lambat'
    ],
    pc: [
      'PC tidak bisa menyala',
      'Monitor PC tidak menampilkan gambar',
      'PC terasa sangat lambat'
    ],
    'sistem-informasi': [
      'Sistem Informasi tidak bisa login',
      'Sistem Informasi tidak bisa dibuka',
      'Data pada Sistem Informasi tidak tampil'
    ],
    hardware: [
      'Keyboard atau mouse tidak berfungsi',
      'Perangkat USB tidak terdeteksi',
      'Monitor tidak menampilkan gambar'
    ],
    software: [
      'Aplikasi tidak bisa dibuka',
      'Aplikasi sering error',
      'Software tidak bisa diinstal'
    ]
  },
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

export default function QuickReplies({ divisionId, categoryId, onPick, disabled }) {
  const items = divisionId === 'end-user'
    ? SUGGESTIONS.endUser[categoryId]
    : SUGGESTIONS[divisionId];

  if (!items || items.length === 0) return null;

  return (
    <div className="quick-replies" id="quick-replies">
      <p className="quick-replies-label">Kendala yang sering dilaporkan</p>
      <div className="quick-replies-list">
        {items.map((text) => (
          <button key={text} type="button" className="quick-reply"
            onClick={() => onPick(text)} disabled={disabled}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
