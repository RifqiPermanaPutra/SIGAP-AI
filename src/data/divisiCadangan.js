/**
 * Daftar layanan cadangan, dipakai HANYA bila `/api/config` tidak terjawab.
 *
 * Tanpa ini, pelapor yang membuka halaman saat server sedang tidak terjangkau
 * melihat beranda tanpa satu pun kartu layanan — tampak seperti aplikasi rusak,
 * bukan seperti gangguan sementara.
 *
 * Isinya WAJIB sama dengan `server/config/divisi.js`. Karena daftar ini
 * disalin, ia dapat menyimpang diam-diam. Perubahan id pada satu sisi saja
 * membuat layanan ditolak server sebagai "Divisi tidak valid", persis saat
 * pengguna paling tidak punya cara lain. Kesamaannya kini dijaga
 * `tests/api.test.mjs`.
 */
export const DIVISI_CADANGAN = [
  { id: 'printer', name: 'Printer', description: 'Masalah printer, cetak dokumen', mode: 'swalayan' },
  { id: 'windows', name: 'Windows', description: 'Laptop, PC, sistem operasi', mode: 'swalayan' },
  { id: 'cctv', name: 'CCTV', description: 'Kamera pengawas, DVR/NVR', mode: 'engineer' },
  { id: 'telepon', name: 'Telepon', description: 'Telepon kantor, extension', mode: 'engineer' },
  { id: 'radio', name: 'Radio Komunikasi', description: 'Radio HT, repeater', mode: 'engineer' },
  { id: 'ftth', name: 'FTTH', description: 'Fiber to the home, ONU/ONT', mode: 'engineer' },
  { id: 'lan', name: 'LAN', description: 'Jaringan lokal, kabel LAN', mode: 'engineer' },
  { id: 'wan', name: 'WAN', description: 'Jaringan luas, koneksi antar site', mode: 'engineer' }
];
