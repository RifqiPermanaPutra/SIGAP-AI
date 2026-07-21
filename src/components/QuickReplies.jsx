import React from 'react';

/**
 * Saran keluhan yang paling sering muncul per divisi.
 * Diambil dari daftar "Masalah RINGAN" pada system prompt di ragService,
 * agar saran yang ditawarkan memang tercakup knowledge base.
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
  windows: [
    'Laptop tidak bisa login',
    'Komputer terasa sangat lambat',
    'Tidak bisa connect ke printer jaringan'
  ],
  fttp: [
    'Lampu LOS pada ONU menyala merah',
    'ONU tidak menyala sama sekali',
    'Internet lambat dari ONU'
  ],
  lan: [
    'Tidak ada koneksi internet',
    'Kabel LAN terlepas atau longgar',
    'Lampu port switch tidak menyala'
  ],
  wan: [
    'Koneksi antar site putus sesaat',
    'Akses ke kantor pusat lambat',
    'VPN tidak bisa tersambung'
  ]
};

export default function QuickReplies({ divisionId, onPick, disabled }) {
  const items = SUGGESTIONS[divisionId];
  if (!items || items.length === 0) return null;

  return (
    <div className="quick-replies" id="quick-replies">
      <p className="quick-replies-label">Keluhan yang sering ditanyakan</p>
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
