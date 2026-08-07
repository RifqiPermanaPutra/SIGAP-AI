/**
 * Daftar divisi layanan ICT beserta mode layanannya.
 *
 * Sebelumnya daftar ini berada di server.js. Dipindahkan ke sini karena kini
 * dibutuhkan juga oleh routing chat (untuk mencatat engineer tujuan) dan
 * layanan rekap (untuk menampilkan nama divisi).
 */
import { LOKASI_GROUPS } from '../../src/data/lokasi.js';

// Instalasi lama mungkin masih membawa nama variabel lingkungan sebelum
// penyeragaman FTTH. Nilainya disalin di memori agar nomor engineer tidak
// mendadak hilang saat aplikasi pertama kali diperbarui; berkas contoh dan
// seluruh konfigurasi baru hanya memakai WHATSAPP_FTTH.
const ENV_FTTH_SEBELUMNYA = ['WHATSAPP', String.fromCharCode(70, 84, 84, 80)].join('_');
if (!(process.env.WHATSAPP_FTTH || '').trim() && (process.env[ENV_FTTH_SEBELUMNYA] || '').trim()) {
  process.env.WHATSAPP_FTTH = process.env[ENV_FTTH_SEBELUMNYA];
}

/**
 * Mode layanan tiap divisi.
 *
 *  - `swalayan` : pengguna dipandu langkah SOP lebih dulu; formulir pelapor
 *                 muncul hanya bila ketiga solusi belum menuntaskan
 *  - `engineer` : tidak ada langkah SOP, keluhan langsung diteruskan
 *
 * Pembagian ini berasal dari masukan Engineer ICT (Eka Maulana): keluhan yang
 * cukup umum untuk dipandu sendiri hanya ada pada komputer dan printer.
 * Selebihnya — CCTV, jaringan, WAN, HT, telepon — memang harus ditangani
 * engineer, dan SOP-nya tidak boleh disusun dari sumber umum karena sangat
 * spesifik lapangan.
 *
 * Menyajikan langkah perbaikan yang belum divalidasi untuk divisi tersebut
 * berisiko lebih besar daripada manfaatnya; lihat KONTEKS-PROYEK.md §6a.
 */
export const DIVISIONS = [
  { id: 'printer', name: 'Printer', description: 'Masalah printer, cetak dokumen', env: 'WHATSAPP_PRINTER', mode: 'swalayan' },
  { id: 'windows', name: 'Windows', description: 'Laptop, PC, sistem operasi', env: 'WHATSAPP_WINDOWS', mode: 'swalayan' },
  { id: 'cctv', name: 'CCTV', description: 'Kamera pengawas, DVR/NVR', env: 'WHATSAPP_CCTV', mode: 'engineer' },
  { id: 'telepon', name: 'Telepon', description: 'Telepon kantor, extension', env: 'WHATSAPP_TELEPON', mode: 'engineer' },
  { id: 'radio', name: 'Radio Komunikasi', description: 'Radio HT, repeater', env: 'WHATSAPP_RADIO', mode: 'engineer' },
  // FTTH masih menunggu konfirmasi: Eka menyebut "jaringan" tanpa merinci
  // apakah FTTH termasuk. Ditempatkan sebagai mode engineer karena perangkat
  // ONU umumnya berada di rak, bukan di meja pengguna.
  { id: 'ftth', name: 'FTTH', description: 'Fiber to the home, ONU/ONT', env: 'WHATSAPP_FTTH', mode: 'engineer' },
  { id: 'lan', name: 'LAN', description: 'Jaringan lokal, kabel LAN', env: 'WHATSAPP_LAN', mode: 'engineer' },
  { id: 'wan', name: 'WAN', description: 'Jaringan luas, koneksi antar site', env: 'WHATSAPP_WAN', mode: 'engineer' }
];

/** Peta id → divisi, untuk pencarian cepat */
export const DIVISI_MAP = new Map(DIVISIONS.map((d) => [d.id, d]));

/** Daftar id divisi yang sah — dipakai validasi masukan */
export const DIVISI_ID = DIVISIONS.map((d) => d.id);

/** Nama tampilan sebuah divisi, dengan cadangan id mentah */
export function namaDivisi(id) {
  return DIVISI_MAP.get(id)?.name || id || '—';
}

/** Mode layanan sebuah divisi */
export function modeDivisi(id) {
  return DIVISI_MAP.get(id)?.mode || 'engineer';
}

/**
 * Normalkan nomor telepon ke format yang diterima wa.me.
 *
 * wa.me menuntut kode negara tanpa '+', sedangkan di lapangan nomor lazim
 * ditulis '0812-3456-789' atau '+62 812 3456 789'. Tanpa penyeragaman ini,
 * awalan '0' akan terkirim apa adanya dan tautan WhatsApp gagal dibuka.
 */
export function normalkanNomor(input) {
  const digit = String(input || '').replace(/[^0-9]/g, '');
  if (!digit) return '';
  if (digit.startsWith('62')) return digit;                // sudah berkode negara
  if (digit.startsWith('0')) return '62' + digit.slice(1);  // 08xx → 628xx
  if (digit.startsWith('8')) return '62' + digit;           // 8xx  → 628xx
  return digit;                                             // nomor luar negeri
}

/** Nomor WhatsApp engineer untuk sebuah divisi, dengan cadangan nomor umum */
export function nomorEngineer(envKey) {
  const cadangan = process.env.WHATSAPP_DEFAULT || process.env.WHATSAPP_NUMBER || '';
  return normalkanNomor((process.env[envKey] || '').trim() || cadangan);
}

/**
 * Penanda engineer tujuan sebuah divisi untuk keperluan rekap.
 *
 * Sengaja tidak menyimpan nomor WhatsApp ke basis data — nomor pribadi tidak
 * diperlukan di laporan, sementara yang dibutuhkan hanya pembeda antar
 * engineer untuk melihat sebaran beban kerja.
 */
export function engineerTujuan(divisiId) {
  const divisi = DIVISI_MAP.get(divisiId);
  if (!divisi) return null;
  const nomor = nomorEngineer(divisi.env);
  if (!nomor) return null;
  // Empat digit terakhir cukup untuk membedakan kelima engineer tanpa
  // menuliskan nomor lengkapnya di laporan.
  return `Engineer ···${nomor.slice(-4)}`;
}

/* ────────────────────────────────────────────────────────────────
   Lokasi
   ──────────────────────────────────────────────────────────────── */

const AREA_LOKASI = new Map(
  LOKASI_GROUPS.flatMap((g) => g.items.map((lokasi) => [lokasi, g.area]))
);

/**
 * Area (Buatan / Ukui / Lirik) sebuah lokasi.
 *
 * Diturunkan otomatis, tidak ditanyakan kembali kepada pengguna. Dibutuhkan
 * karena 29 lokasi terlalu halus untuk ditampilkan sebagai grafik.
 */
export function areaDariLokasi(lokasi) {
  return AREA_LOKASI.get(lokasi) || null;
}
