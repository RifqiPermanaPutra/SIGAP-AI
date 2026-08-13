/**
 * Set ikon garis (stroke) untuk seluruh antarmuka.
 * Semua ikon mewarisi warna teks induknya lewat `currentColor`,
 * sehingga tidak perlu varian warna terpisah.
 */
import React from 'react';

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false
};

const Svg = ({ size = 24, children, ...rest }) => (
  <svg {...base} width={size} height={size} {...rest}>{children}</svg>
);

/* ── Divisi layanan ─────────────────────────────── */

export const IconPrinter = (p) => (
  <Svg {...p}>
    <path d="M7 9V4h10v5" />
    <rect x="3" y="9" width="18" height="8" rx="2" />
    <path d="M7 14h10v6H7z" />
    <path d="M17.5 12.5h.01" />
  </Svg>
);

export const IconCctv = (p) => (
  <Svg {...p}>
    <path d="M3 8.4 16.4 4l1.8 5.9L4.8 14.3z" />
    <path d="M7.4 13.6v2.2a3.1 3.1 0 0 0 6.2 0" />
    <path d="m18.2 9.9 2.9-.9" />
    <path d="M4 21h7" />
  </Svg>
);

export const IconPhone = (p) => (
  <Svg {...p}>
    <path d="M21.5 16.9v2.8a2 2 0 0 1-2.2 2 19.6 19.6 0 0 1-8.5-3 19.3 19.3 0 0 1-6-6 19.6 19.6 0 0 1-3-8.6A2 2 0 0 1 3.8 2h2.8a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L7.7 9.7a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2.1z" />
  </Svg>
);

export const IconRadio = (p) => (
  <Svg {...p}>
    <rect x="6" y="8" width="12" height="13" rx="2" />
    <path d="M10 8V5.5a2 2 0 0 1 4 0V8" />
    <path d="m17 4.5 2.5-1.5" />
    <path d="M9.5 12.5h5" />
    <path d="M9.5 16h5" />
  </Svg>
);

export const IconWindows = (p) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M2 20h20" />
    <path d="M10 16h4" />
  </Svg>
);

export const IconFtth = (p) => (
  <Svg {...p}>
    <rect x="3" y="14" width="18" height="6" rx="2" />
    <path d="M7 17h.01" />
    <path d="M10.5 17h.01" />
    <path d="M8.6 9.9a5 5 0 0 1 6.8 0" />
    <path d="M5.8 6.8a9 9 0 0 1 12.4 0" />
  </Svg>
);

export const IconLan = (p) => (
  <Svg {...p}>
    <rect x="3" y="11" width="18" height="9" rx="2" />
    <path d="M7 11V6.5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2V11" />
    <path d="M8.5 15v2.2" />
    <path d="M12 15v2.2" />
    <path d="M15.5 15v2.2" />
  </Svg>
);

export const IconWan = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a13.5 13.5 0 0 1 0 18 13.5 13.5 0 0 1 0-18z" />
  </Svg>
);

/* ── Antarmuka umum ─────────────────────────────── */

export const IconUser = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </Svg>
);

export const IconHeadset = (p) => (
  <Svg {...p}>
    <path d="M4 13.5v-1.2a8 8 0 0 1 16 0v1.2" />
    <rect x="2.5" y="13" width="4.5" height="7" rx="2" />
    <rect x="17" y="13" width="4.5" height="7" rx="2" />
    <path d="M19.2 20v.6a3 3 0 0 1-3 3h-2.4" />
  </Svg>
);

export const IconPlus = (p) => (
  <Svg {...p}><path d="M12 5.5v13" /><path d="M5.5 12h13" /></Svg>
);

export const IconArrowLeft = (p) => (
  <Svg {...p}><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></Svg>
);

export const IconArrowRight = (p) => (
  <Svg {...p}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></Svg>
);

export const IconArrowDown = (p) => (
  <Svg {...p}><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></Svg>
);

export const IconMenu = (p) => (
  <Svg {...p}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></Svg>
);

export const IconClose = (p) => (
  <Svg {...p}><path d="M6 6l12 12" /><path d="M18 6 6 18" /></Svg>
);

export const IconSend = (p) => (
  <Svg {...p}><path d="M21 3 10.5 13.5" /><path d="M21 3l-6.8 18-3.7-7.5L3 9.8z" /></Svg>
);

export const IconCheck = (p) => (
  <Svg {...p}><path d="m20 6.5-10.5 11L4 12" /></Svg>
);

export const IconAlert = (p) => (
  <Svg {...p}>
    <path d="M10.3 3.9 1.9 18.2A2 2 0 0 0 3.6 21h16.8a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9.5v4" />
    <path d="M12 17.2h.01" />
  </Svg>
);

/* ── Halaman laporan rekap ──────────────────────── */

export const IconChart = (p) => (
  <Svg {...p}>
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <path d="M7 15v-3" />
    <path d="M12 15V7" />
    <path d="M17 15v-6" />
  </Svg>
);

export const IconDownload = (p) => (
  <Svg {...p}>
    <path d="M12 3v12" />
    <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
    <path d="M4 20h16" />
  </Svg>
);

export const IconPrint = (p) => (
  <Svg {...p}>
    <path d="M7 8V3h10v5" />
    <rect x="3" y="8" width="18" height="8" rx="2" />
    <path d="M7 14h10v7H7z" />
  </Svg>
);

export const IconLogout = (p) => (
  <Svg {...p}>
    <path d="M14 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8" />
    <path d="m16 15 4-3-4-3" />
    <path d="M20 12H10" />
  </Svg>
);

export const IconClock = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.5l3.5 2" />
  </Svg>
);

export const IconInbox = (p) => (
  <Svg {...p}>
    <path d="M3 13h4.5l1.5 3h6l1.5-3H21" />
    <path d="M5.4 5.5 3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5l-2.4-7.5A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.9 1.5z" />
  </Svg>
);

export const IconChevronDown = (p) => (
  <Svg {...p}><path d="m6 9.5 6 6 6-6" /></Svg>
);

/* Corong — penanda saringan tambahan yang dapat dibuka-tutup */
export const IconFilter = (p) => (
  <Svg {...p}><path d="M3 5h18l-7 8v5.5l-4 2V13z" /></Svg>
);

/* Mata — kata sandi sedang tersembunyi, tekan untuk menampilkannya */
export const IconMata = (p) => (
  <Svg {...p}>
    <path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

/* Mata tercoret — kata sandi sedang terlihat, tekan untuk menyembunyikannya */
export const IconMataTutup = (p) => (
  <Svg {...p}>
    <path d="M10.7 6.2A9.9 9.9 0 0 1 12 5.5c6.2 0 10 6.5 10 6.5a18 18 0 0 1-3 3.8" />
    <path d="M6.5 7.9A17.6 17.6 0 0 0 2 12s3.8 6.5 10 6.5a9.9 9.9 0 0 0 4-.8" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="M3 3l18 18" />
  </Svg>
);

/* Kunci pas — "sedang dikerjakan", tahap sebelum tiket ditandai selesai */
export const IconWrench = (p) => (
  <Svg {...p}>
    <path d="M15.2 5.2a4.5 4.5 0 0 0 5.6 5.9L11 21a2.1 2.1 0 0 1-3-3l9.9-9.8a4.5 4.5 0 0 0-2.7-3z" />
  </Svg>
);

/* Membuang — penghapusan yang harus terlihat berbeda dari "batal" */
export const IconTrash = (p) => (
  <Svg {...p}>
    <path d="M4 7h16" />
    <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
    <path d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
    <path d="M10 11.5v5M14 11.5v5" />
  </Svg>
);

/* Melepaskan tugas — kembali ke antrean */
export const IconUndo = (p) => (
  <Svg {...p}>
    <path d="M4 9h11a5 5 0 0 1 0 10h-5" />
    <path d="m8 5-4 4 4 4" />
  </Svg>
);

export const IconLock = (p) => (
  <Svg {...p}>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Svg>
);

/* WhatsApp memakai glyph resmi (solid), bukan garis */
export const IconWhatsapp = ({ size = 24, ...rest }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    <path d="M17.47 14.38c-.3-.15-1.74-.86-2-.96-.27-.1-.47-.15-.66.15-.2.29-.76.95-.93 1.15-.17.2-.34.22-.63.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.04-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.66-1.6-.9-2.19-.24-.57-.48-.5-.66-.5h-.57c-.2 0-.52.07-.79.37-.27.29-1.03 1-1.03 2.45s1.06 2.84 1.2 3.04c.15.2 2.08 3.18 5.04 4.46.7.3 1.25.48 1.68.62.71.22 1.35.19 1.86.12.57-.09 1.74-.71 1.99-1.4.24-.69.24-1.28.17-1.4-.07-.13-.27-.2-.56-.35z" />
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.44 9.91-9.9A9.86 9.86 0 0 0 12.04 2zm5.8 15.71a8.2 8.2 0 0 1-5.8 2.4h-.01a8.22 8.22 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23a8.19 8.19 0 0 1 8.23 8.24 8.2 8.2 0 0 1-2.42 5.83z" />
  </svg>
);

/* ── Pemetaan id divisi → ikon ──────────────────── */

const DIVISION_ICONS = {
  printer: IconPrinter,
  cctv: IconCctv,
  telepon: IconPhone,
  radio: IconRadio,
  windows: IconWindows,
  ftth: IconFtth,
  lan: IconLan,
  wan: IconWan
};

/**
 * Ikon untuk sebuah divisi. Jatuh ke ikon headset bila id tidak dikenal,
 * sehingga penambahan divisi baru di server tidak membuat tampilan kosong.
 */
export function DivisionIcon({ id, size = 24, ...rest }) {
  const Cmp = DIVISION_ICONS[id] || IconHeadset;
  return <Cmp size={size} {...rest} />;
}
