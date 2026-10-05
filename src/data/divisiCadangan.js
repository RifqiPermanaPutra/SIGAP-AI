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
  { id: 'printer', name: 'Printer', description: 'Masalah Printer, Cetak Dokumen', mode: 'swalayan' },
  { id: 'end-user', name: 'End User', description: 'Laptop, PC, Sistem Informasi, Hardware, Software', mode: 'swalayan' },
  { id: 'cctv', name: 'CCTV', description: 'Kamera pengawas, DVR/NVR', mode: 'engineer' },
  { id: 'telepon', name: 'Radio HT', description: 'Radio HT, Radio Mobile', mode: 'engineer' },
  { id: 'ftth', name: 'FTTH', description: 'Fiber to the home, ONU/ONT', mode: 'engineer' },
  { id: 'lan', name: 'LAN', description: 'Jaringan lokal, WIFI Kantor, Kabel LAN', mode: 'engineer' },
  { id: 'multimedia', name: 'Multimedia', description: 'Sound system, Persiapan Rapat', mode: 'engineer' }
];
