/**
 * Spesifikasi slide presentasi SIGAP.
 *
 * SATU SUMBER, DUA KELUARAN. Berkas ini hanya menyimpan bentuk dan
 * kedudukannya; `buat-html.mjs` menggambarnya untuk diperiksa mata, dan
 * `buat-pptx.mjs` mengubahnya menjadi PowerPoint. Keduanya membaca angka yang
 * sama, sehingga yang terlihat saat pemeriksaan sama persis dengan yang jadi.
 *
 * Diperlukan karena LibreOffice tidak terpasang di mesin ini — tanpa
 * penggambar HTML itu, tata letak deck tidak dapat diperiksa sama sekali
 * sebelum diserahkan.
 *
 * RUPA. Susunan warnanya dibuat berirama, bukan seragam: slide gelap membuka
 * tiap bagian, lalu slide isi berganti-ganti antara terang, kebiruan, dan
 * kehijauan. Kartu diberi isian berwarna penuh — bukan putih bergaris tipis —
 * dan lingkaran besar tembus pandang dipakai sebagai motif berulang. Seluruh
 * warnanya tetap dari palet proyek: biru #006cb8, hijau #acc42a, merah #ed1b2f.
 *
 * Seluruh ukuran dalam INCI, ukuran huruf dalam POIN. Kanvas 13,333 x 7,5.
 */

export const W = {
  biruGelap: '002B47',
  biruTua: '00395E',
  biru: '006CB8',
  biruTerang: '3F9DE0',
  biruTeks: '005694',
  biruSoft: 'E1EFFA',
  biruKabut: 'BBD4E8',
  biruSamar: '8FB3CC',

  hijau: 'ACC42A',
  hijauTua: '8AA019',
  hijauTeks: '5C6A0D',
  hijauGelap: '3F4E10',
  hijauSoft: 'EEF4D9',

  merah: 'ED1B2F',
  merahTeks: 'C41022',
  merahSoft: 'FCE4E7',
  merahKabut: 'F6C9CE',

  ink: '0D1520',
  ink2: '38465A',
  ink3: '68768A',
  putih: 'FFFFFF'
};

export const FONT = 'Calibri';
export const LEBAR = 13.333;
export const TINGGI = 7.5;
const M = 0.66;
const LEBAR_ISI = LEBAR - M * 2;

const LATAR = 'dokumentasi/ppt/latar';
const ILUS = 'dokumentasi/ppt/ilustrasi';
const TL = 'dokumentasi/tangkapan-layar';
const DIA = 'dokumentasi/diagram';

/* ── Pembangun bentuk ──────────────────────────────────────────────── */

const kotak = (x, y, w, h, o = {}) => ({ t: 'kotak', x, y, w, h, ...o });
const teks = (x, y, w, h, isi, o = {}) => ({ t: 'teks', x, y, w, h, isi, ...o });
const gambar = (x, y, w, h, jalur, o = {}) => ({ t: 'gambar', x, y, w, h, jalur, ...o });

/** Lingkaran besar tembus pandang — motif yang diulang di seluruh deck */
const noda = (cx, cy, d, warna, alpha) =>
  kotak(cx - d / 2, cy - d / 2, d, d, { isi: warna, alpha, radius: d / 2 });

/** Lingkaran bernomor atau berlambang */
const bulat = (x, y, d, isi, o = {}) => [
  kotak(x, y, d, d, { isi: o.latar || W.biru, radius: d / 2 }),
  teks(x, y, d, d, isi, {
    ukuran: o.ukuran || 15, tebal: true, warna: o.warna || W.putih,
    align: 'center', valign: 'middle', margin: 0
  })
];

/** Kepala slide terang: titik berwarna, label kecil, lalu judul besar */
const kepala = (label, judul, o = {}) => [
  kotak(M, 0.52, 0.13, 0.13, { isi: o.warnaTitik || W.hijau, radius: 0.065 }),
  teks(M + 0.26, 0.44, LEBAR_ISI - 0.26, 0.28, label.toUpperCase(), {
    ukuran: 11.5, tebal: true, warna: o.warnaLabel || W.biruTeks, spasiHuruf: 1.8, margin: 0
  }),
  teks(M, 0.78, o.lebarJudul || LEBAR_ISI, 0.66, judul, {
    ukuran: o.ukuranJudul || 31, tebal: true, warna: W.ink, margin: 0, valign: 'top'
  })
];

/** Kartu berisian warna penuh */
const kartu = (x, y, w, h, o = {}) => kotak(x, y, w, h, {
  isi: o.isi || W.putih, alpha: o.alpha,
  radius: o.radius === undefined ? 0.16 : o.radius
});

/** Butir daftar */
const butir = (x, y, w, isi, o = {}) => [
  kotak(x, y + 0.075, 0.13, 0.13, { isi: o.penanda || W.hijau, radius: 0.065 }),
  teks(x + 0.28, y - 0.03, w - 0.28, o.tinggi || 0.34, isi, {
    ukuran: o.ukuran || 14, warna: o.warna || W.ink2, margin: 0, valign: 'top'
  })
];

export const slides = [];
const S = (bg, elemen, catatan) => slides.push({ bg, elemen: elemen.flat(), catatan });

/** Slide pembatas antar bagian — angka besar di kiri, judul di kanan */
const pembatas = (nomor, judul, ringkas, catatan) => S(`${LATAR}/gelap.jpg`, [
  noda(11.4, 1.5, 5.2, W.biru, 0.13),
  noda(1.4, 6.6, 3.6, W.hijau, 0.11),
  teks(M, 2.42, 3.0, 2.0, nomor, {
    ukuran: 120, tebal: true, warna: '2E5D7B', margin: 0, valign: 'top'
  }),
  kotak(3.5, 2.72, 0.05, 1.5, { isi: W.hijau }),
  teks(3.9, 2.68, 8.7, 1.0, judul, {
    ukuran: 42, tebal: true, warna: W.putih, margin: 0, valign: 'top'
  }),
  teks(3.9, 3.9, 8.3, 0.8, ringkas, {
    ukuran: 15.5, warna: W.biruKabut, margin: 0, valign: 'top', spasiBaris: 23
  })
], catatan);

/* ══════════════════════════ 1 — Judul ══════════════════════════ */
S(`${LATAR}/gelap.jpg`, [
  noda(12.2, 0.9, 4.4, W.hijau, 0.11),
  noda(0.4, 7.1, 3.2, W.biruTerang, 0.13),

  kotak(6.62, 0.97, 6.56, 3.74, { isi: W.hijau, radius: 0.22, alpha: 0.7 }),
  gambar(6.7, 1.05, 6.4, 3.58, `${ILUS}/1-hero.jpg`, { radius: 0.2 }),

  kotak(M, 1.16, 2.72, 0.34, { isi: W.hijau, radius: 0.17 }),
  teks(M, 1.16, 2.72, 0.34, 'LAPORAN KERJA PRAKTEK', {
    ukuran: 10.5, tebal: true, warna: W.biruGelap, spasiHuruf: 1.4,
    align: 'center', valign: 'middle', margin: 0
  }),
  teks(M, 1.72, 6.0, 1.5, 'SIGAP', {
    ukuran: 86, tebal: true, warna: W.putih, margin: 0, valign: 'top'
  }),
  teks(M, 3.2, 6.0, 0.9, 'Sistem Informasi Gangguan\ndan Aduan Pelayanan', {
    ukuran: 21, warna: W.biruKabut, margin: 0, valign: 'top', spasiBaris: 27
  }),
  kotak(M, 4.42, 5.5, 0.03, { isi: W.hijau }),
  teks(M, 4.66, 6.4, 0.6, 'Layanan Bantuan IT — PT Pertamina EP\nAsset 1 Regional 1 Field Lirik', {
    ukuran: 13.5, warna: W.biruSamar, margin: 0, valign: 'top', spasiBaris: 19
  }),

  kartu(M, 5.62, 7.3, 1.16, { isi: W.putih, alpha: 0.1, radius: 0.14 }),
  teks(M + 0.32, 5.78, 6.7, 0.24, 'DISUSUN OLEH', {
    ukuran: 9.5, tebal: true, warna: W.hijau, spasiHuruf: 1.5, margin: 0
  }),
  teks(M + 0.32, 6.04, 6.7, 0.7,
    'Andrino Syaddani · Eka Maulana Hidayat · Habib Hibatullmi’qaid\nRifqi Permana Putra · Sri Adinda', {
    ukuran: 12, warna: W.putih, margin: 0, valign: 'top', spasiBaris: 17
  }),
  teks(8.3, 6.06, 4.4, 0.7, 'Teknik Informatika · Fakultas Teknik\nUniversitas Islam Riau · 2026', {
    ukuran: 12, warna: W.biruSamar, margin: 0, valign: 'top', align: 'right', spasiBaris: 17
  })
], 'Selamat pagi. Kami dari Teknik Informatika UIR akan memaparkan hasil kerja praktek di Divisi IT Pertamina EP Field Lirik, berupa sistem bernama SIGAP.');

/* ══════════════════════════ 2 — Pembatas ══════════════════════════ */
pembatas('01', 'Masalah yang Dihadapi',
  'Bagaimana keluhan IT ditangani sebelum ada SIGAP, dan apa yang hilang di sepanjang jalannya.',
  'Kami mulai dari keadaan sebelum ada sistem — supaya jelas apa yang sebenarnya ingin diperbaiki.');

/* ══════════════════════════ 3 — Latar belakang ══════════════════════════ */
S(`${LATAR}/terang.jpg`, [
  kepala('Latar Belakang', 'Keluhan datang dari mana saja,\nlalu hilang begitu saja',
    { ukuranJudul: 28, lebarJudul: 7.0, warnaTitik: W.merah }),

  kotak(7.28, 1.88, 5.51, 3.15, { isi: W.merah, radius: 0.2, alpha: 0.76 }),
  gambar(7.35, 1.95, 5.35, 2.99, `${ILUS}/2-masalah.jpg`, { radius: 0.18 }),

  kartu(M, 2.06, 6.35, 0.96, { isi: W.biruSoft }),
  teks(M + 0.32, 2.24, 5.71, 0.62,
    'Setiap hari Divisi IT menerima keluhan lewat telepon, WhatsApp, ' +
    'atau pekerja yang datang langsung ke ruang IT.', {
    ukuran: 14.5, tebal: true, warna: W.biruTeks, margin: 0, valign: 'top', spasiBaris: 21
  }),

  ...[
    ['Satu engineer menangani banyak permintaan sekaligus, termasuk yang sebenarnya sederhana.', 3.32],
    ['Tidak ada catatan — jumlah dan jenis gangguan tidak pernah diketahui.', 3.9],
    ['Pelapor tidak tahu keluhannya sudah ditangani atau belum.', 4.48],
    ['Keluhan yang sama berulang tanpa panduan yang dapat diikuti sendiri.', 5.06]
  ].map(([t, y]) => butir(M, y, 6.35, t, { tinggi: 0.5, penanda: W.merah })),

  kartu(M, 5.78, 6.35, 0.86, { isi: W.hijauSoft }),
  teks(M + 0.32, 5.94, 5.71, 0.56,
    'Padahal sebagian besar keluhan berulang dan sudah ada prosedurnya.', {
    ukuran: 14, tebal: true, warna: W.hijauTeks, margin: 0, valign: 'top'
  }),

  kartu(7.28, 5.32, 5.42, 1.32, { isi: W.biruTua }),
  teks(7.6, 5.5, 4.78, 0.94,
    '“Percakapan tidak meninggalkan catatan — dan yang tidak tercatat tidak dapat dievaluasi.”', {
    ukuran: 14, warna: W.putih, margin: 0, valign: 'top', spasiBaris: 20, miring: true
  })
], 'Masalahnya bukan engineernya kurang cakap, tapi tidak ada saluran yang tertata. Semua masuk lewat percakapan, dan percakapan tidak meninggalkan catatan.');

/* ══════════════════════════ 4 — Empat masalah ══════════════════════════ */
S(`${LATAR}/biru.jpg`, [
  kepala('Rumusan Masalah', 'Empat hal yang ingin diperbaiki', { warnaTitik: W.biru }),
  ...[
    ['1', 'Beban engineer', 'Keluhan sederhana seperti kertas macet tetap harus ditangani engineer.',
      W.merahSoft, W.merah, W.merahTeks, W.ink2, W.putih],
    ['2', 'Tidak tercatat', 'Tidak ada data jumlah, jenis, maupun lama penanganan gangguan.',
      W.biruSoft, W.biru, W.biruTeks, W.ink2, W.putih],
    ['3', 'Status tidak jelas', 'Pelapor harus bertanya ulang untuk tahu perkembangan laporannya.',
      W.hijauSoft, W.hijauTua, W.hijauTeks, W.ink2, W.putih],
    ['4', 'Salah sasaran', 'Laporan kadang sampai ke engineer yang bukan bidangnya.',
      W.biruTua, W.hijau, W.putih, W.biruKabut, W.biruGelap]
  ].flatMap(([no, judul, isi, latar, bulatWarna, warnaJudul, warnaIsi, warnaAngka], i) => {
    const w = 2.94, x = M + i * (w + 0.17), y = 2.02;
    return [
      kartu(x, y, w, 2.72, { isi: latar, radius: 0.18 }),
      ...bulat(x + 0.36, y + 0.4, 0.56, no, { ukuran: 19, latar: bulatWarna, warna: warnaAngka }),
      teks(x + 0.36, y + 1.16, w - 0.72, 0.34, judul, {
        ukuran: 16.5, tebal: true, warna: warnaJudul, margin: 0, valign: 'top'
      }),
      teks(x + 0.36, y + 1.58, w - 0.72, 1.0, isi, {
        ukuran: 12.5, warna: warnaIsi, margin: 0, valign: 'top', spasiBaris: 17
      })
    ];
  }),
  kartu(M, 5.24, LEBAR_ISI, 1.0, { isi: W.biru, radius: 0.18 }),
  kotak(M + 0.42, 5.56, 0.36, 0.36, { isi: W.hijau, radius: 0.18 }),
  teks(M + 1.02, 5.24, LEBAR_ISI - 1.44, 1.0,
    'Keempatnya berpangkal pada satu hal yang sama: tidak ada tempat keluhan itu dicatat dan ditelusuri.', {
    ukuran: 15, tebal: true, warna: W.putih, margin: 0, valign: 'middle'
  })
], 'Keempat masalah ini kami rumuskan dari pengamatan langsung dan wawancara dengan engineer di lapangan.');

/* ══════════════════════════ 5 — Tujuan ══════════════════════════ */
S(`${LATAR}/terang.jpg`, [
  kepala('Tujuan', 'Tiga sasaran yang ingin dicapai'),
  ...[
    ['Meringankan engineer', 'Kendala umum dapat diselesaikan sendiri oleh pelapor melalui panduan berbasis SOP perusahaan.', 1.98, W.biru],
    ['Membuat laporan tercatat', 'Setiap keluhan memperoleh nomor tiket dan tersimpan sehingga dapat direkap dan dievaluasi.', 3.44, W.hijauTua],
    ['Mengarahkan ke engineer yang tepat', 'Keluhan yang memang perlu penanganan teknis diteruskan lengkap dengan identitas dan lokasinya.', 4.9, W.merah]
  ].flatMap(([judul, isi, y, warna], i) => [
    kartu(M, y - 0.12, 7.5, 1.26, { isi: W.putih, alpha: 0.66 }),
    ...bulat(M + 0.3, y + 0.06, 0.66, String(i + 1), { ukuran: 20, latar: warna }),
    teks(M + 1.2, y + 0.02, 6.0, 0.34, judul, {
      ukuran: 18, tebal: true, warna: W.ink, margin: 0, valign: 'top'
    }),
    teks(M + 1.2, y + 0.44, 6.0, 0.66, isi, {
      ukuran: 13, warna: W.ink3, margin: 0, valign: 'top', spasiBaris: 18
    })
  ]),
  kartu(8.62, 1.86, 4.08, 4.6, { isi: W.hijau, radius: 0.2 }),
  kotak(8.98, 2.2, 0.42, 0.42, { isi: W.biruGelap, radius: 0.21 }),
  teks(8.98, 2.82, 3.36, 0.44, 'Prinsip yang dipegang', {
    ukuran: 16, tebal: true, warna: W.biruGelap, margin: 0, valign: 'top'
  }),
  teks(8.98, 3.36, 3.36, 2.3,
    '“Menjawab bahwa kendala belum dapat dikenali, lalu mengarahkan ke engineer, ' +
    'jauh lebih baik daripada memberi langkah perbaikan untuk masalah yang keliru.”', {
    ukuran: 14, warna: '2E3A0A', margin: 0, valign: 'top', spasiBaris: 21, miring: true
  }),
  teks(8.98, 5.76, 3.36, 0.5, 'Prinsip ini menentukan seluruh keputusan rancangan sistem.', {
    ukuran: 11.5, tebal: true, warna: W.hijauGelap, margin: 0, valign: 'top', spasiBaris: 15
  })
], 'Tujuannya bukan menggantikan engineer, melainkan menyaring supaya yang sampai ke engineer benar-benar yang perlu.');

/* ══════════════════════════ 6 — Pembatas ══════════════════════════ */
pembatas('02', 'Sistem yang Dibangun',
  'Apa itu SIGAP, layanan apa saja yang dicakup, dan bagaimana alurnya berubah.',
  'Sekarang kami masuk ke sistemnya sendiri.');

/* ══════════════════════════ 7 — Apa itu SIGAP ══════════════════════════ */
S(`${LATAR}/terang.jpg`, [
  kepala('Solusi', 'SIGAP — pendamping, bukan pengganti engineer',
    { ukuranJudul: 29, warnaTitik: W.biru }),
  kotak(M - 0.07, 1.88, 6.19, 3.52, { isi: W.biru, radius: 0.2, alpha: 0.76 }),
  gambar(M, 1.95, 6.05, 3.38, `${ILUS}/1-hero.jpg`, { radius: 0.18 }),
  kartu(M, 5.52, 6.05, 1.1, { isi: W.biruTua }),
  teks(M + 0.3, 5.68, 5.45, 0.8,
    'Aplikasi web yang menuntun pekerja menyelesaikan kendala IT sendiri ' +
    'berdasarkan SOP perusahaan, dan meneruskan ke engineer bila memang perlu.', {
    ukuran: 13, warna: W.putih, margin: 0, valign: 'top', spasiBaris: 18
  }),
  ...[
    ['Tanpa pemasangan', 'Cukup dibuka lewat peramban, tidak perlu memasang aplikasi apa pun.', 1.9, W.biruSoft, W.biru, W.biruTeks],
    ['Tanpa akun bagi pelapor', 'Pekerja langsung melapor; akun hanya untuk admin dan engineer.', 3.09, W.hijauSoft, W.hijauTua, W.hijauTeks],
    ['Jawaban selalu sama', 'Seluruh langkah berasal dari SOP, bukan dikarang sistem.', 4.28, W.merahSoft, W.merah, W.merahTeks],
    ['Berjalan tanpa internet luar', 'Cukup jaringan kantor — tidak bergantung layanan pihak ketiga.', 5.47, W.biruSoft, W.biru, W.biruTeks]
  ].flatMap(([judul, isi, y, latar, bulatWarna, warnaJudul]) => [
    kartu(7.2, y, 5.5, 1.04, { isi: latar }),
    kotak(7.5, y + 0.3, 0.44, 0.44, { isi: bulatWarna, radius: 0.22 }),
    kotak(7.635, y + 0.435, 0.17, 0.17, { isi: W.putih, radius: 0.085 }),
    teks(8.12, y + 0.16, 4.3, 0.3, judul, {
      ukuran: 14.5, tebal: true, warna: warnaJudul, margin: 0, valign: 'top'
    }),
    teks(8.12, y + 0.5, 4.3, 0.44, isi, {
      ukuran: 12, warna: W.ink2, margin: 0, valign: 'top', spasiBaris: 16
    })
  ])
], 'SIGAP berbasis web, dibuka dari peramban. Pelapor tidak perlu akun — supaya tidak ada hambatan untuk melapor.');

/* ══════════════════════════ 8 — Delapan layanan ══════════════════════════ */
S(`${LATAR}/hijau.jpg`, [
  kepala('Cakupan', 'Delapan kategori layanan, dua mode penanganan',
    { warnaLabel: W.hijauTeks, warnaTitik: W.hijauTua }),

  kotak(M, 1.86, 0.13, 0.13, { isi: W.hijauTua, radius: 0.065 }),
  teks(M + 0.26, 1.78, 5.3, 0.3, 'PANDUAN MANDIRI', {
    ukuran: 11.5, tebal: true, warna: W.hijauTeks, spasiHuruf: 1.5, margin: 0
  }),
  ...[['Printer', 0], ['Windows', 1]].flatMap(([nama, i]) => {
    const x = M + i * 2.86;
    return [
      kartu(x, 2.2, 2.69, 1.42, { isi: W.hijau, radius: 0.18 }),
      teks(x, 2.5, 2.69, 0.46, nama, {
        ukuran: 21, tebal: true, warna: W.biruGelap, align: 'center', margin: 0
      }),
      teks(x, 3.0, 2.69, 0.32, '3 langkah bertahap', {
        ukuran: 11.5, tebal: true, warna: W.hijauGelap, align: 'center', margin: 0
      })
    ];
  }),
  kartu(M, 3.78, 5.55, 1.14, { isi: W.putih, alpha: 0.74 }),
  teks(M + 0.28, 3.94, 4.99, 0.86,
    'Keluhan dituntun langkah demi langkah. Bila ketiga langkah belum menuntaskan, ' +
    'barulah ditawarkan bantuan engineer.', {
    ukuran: 12.5, warna: W.ink2, margin: 0, valign: 'top', spasiBaris: 17
  }),

  kotak(6.62, 1.86, 0.13, 0.13, { isi: W.biru, radius: 0.065 }),
  teks(6.88, 1.78, 5.8, 0.3, 'LANGSUNG KE ENGINEER', {
    ukuran: 11.5, tebal: true, warna: W.biruTeks, spasiHuruf: 1.5, margin: 0
  }),
  ...[['CCTV', 0, 0], ['Telepon', 1, 0], ['Radio Komunikasi', 2, 0],
      ['FTTH', 0, 1], ['LAN', 1, 1], ['WAN', 2, 1]].flatMap(([nama, kol, bar]) => {
    const w = 1.96, x = 6.62 + kol * (w + 0.11), y = 2.2 + bar * 1.02;
    return [
      kartu(x, y, w, 0.9, { isi: W.biruTua }),
      teks(x + 0.08, y, w - 0.16, 0.9, nama, {
        ukuran: 14, tebal: true, warna: W.putih, align: 'center', valign: 'middle', margin: 0
      })
    ];
  }),
  kartu(6.62, 4.34, 6.08, 1.14, { isi: W.putih, alpha: 0.74 }),
  teks(6.9, 4.5, 5.52, 0.86,
    'Gangguan pada keenam layanan ini memerlukan pemeriksaan perangkat atau kondisi ' +
    'fisik di lapangan, sehingga langsung diteruskan tanpa panduan mandiri.', {
    ukuran: 12.5, warna: W.ink2, margin: 0, valign: 'top', spasiBaris: 17
  }),

  kartu(M, 5.68, LEBAR_ISI, 1.02, { isi: W.merah, radius: 0.18 }),
  kotak(M + 0.42, 6.01, 0.36, 0.36, { isi: W.putih, radius: 0.18 }),
  teks(M + 1.02, 5.68, LEBAR_ISI - 1.44, 1.02,
    'Pembagian ini keputusan Engineer IT lapangan — SOP keenam layanan itu sangat spesifik ' +
    'dan tidak boleh disusun dari sumber umum.', {
    ukuran: 14, tebal: true, warna: W.putih, margin: 0, valign: 'middle', spasiBaris: 19
  })
], 'Hanya printer dan Windows yang cukup umum untuk dipandu sendiri. Ini bukan keterbatasan teknis, melainkan keputusan engineer lapangan.');

/* ══════════════════════════ 9 — Alur ══════════════════════════ */
S(`${LATAR}/terang.jpg`, [
  kepala('Perubahan Alur', 'Yang berubah bukan medianya, tapi percabangannya',
    { ukuranJudul: 28, warnaTitik: W.biru }),
  kartu(1.5, 1.54, 10.33, 5.52, { isi: W.putih, alpha: 0.88, radius: 0.18 }),
  gambar(1.57, 1.6, 10.19, 5.4, `${DIA}/gambar-4-17-perbandingan-alur.png`, { radius: 0.12, muat: true })
], 'Sebelumnya alurnya lurus dan berhenti di kepala pihak IT. Sekarang pencocokan terjadi di dalam sistem, lalu alurnya bercabang.');

/* ══════════════════════════ 10 — Pembatas ══════════════════════════ */
pembatas('03', 'Cara Kerjanya',
  'Bagaimana keluhan berbahasa sehari-hari dicocokkan dengan prosedur, tanpa AI generatif.',
  'Bagian ini menjelaskan mesin di balik SIGAP.');

/* ══════════════════════════ 11 — Cara kerja ══════════════════════════ */
S(`${LATAR}/biru.jpg`, [
  kepala('Cara Kerja', 'Rule-based keyword matching — tanpa AI generatif',
    { ukuranJudul: 29, warnaTitik: W.biru }),
  kotak(7.43, 1.88, 5.32, 3.04, { isi: W.hijau, radius: 0.2, alpha: 0.74 }),
  gambar(7.5, 1.95, 5.18, 2.9, `${ILUS}/3-pencocokan.jpg`, { radius: 0.18 }),
  ...[
    ['Pelapor menulis keluhan', 'Dengan bahasa sehari-hari, termasuk singkatan.', 1.94, W.biru],
    ['Sistem mengurai kata kunci', 'Istilah tidak baku diseragamkan — “lemot” menjadi “lambat”.', 2.97, W.biruTerang],
    ['Dicocokkan dengan SOP', 'Kata dibandingkan dengan judul, gejala, dan penyebab tiap masalah.', 4.0, W.hijauTua],
    ['Panduan atau diteruskan', 'Bila skor melewati ambang 0,4 panduan ditampilkan; bila tidak, diteruskan.', 5.03, W.merah]
  ].flatMap(([judul, isi, y, warna], i) => [
    kartu(M, y - 0.1, 6.5, 0.98, { isi: W.putih, alpha: 0.74, radius: 0.14 }),
    ...bulat(M + 0.22, y + 0.06, 0.5, String(i + 1), { ukuran: 15, latar: warna }),
    teks(M + 0.9, y, 5.4, 0.3, judul, {
      ukuran: 15.5, tebal: true, warna: W.ink, margin: 0, valign: 'top'
    }),
    teks(M + 0.9, y + 0.34, 5.4, 0.5, isi, {
      ukuran: 12.5, warna: W.ink3, margin: 0, valign: 'top', spasiBaris: 17
    })
  ]),
  kartu(7.43, 5.18, 5.32, 1.4, { isi: W.biruTua, radius: 0.18 }),
  teks(7.75, 5.38, 4.68, 0.34, 'Kenapa bukan AI generatif?', {
    ukuran: 14.5, tebal: true, warna: W.hijau, margin: 0, valign: 'top'
  }),
  teks(7.75, 5.78, 4.68, 0.68,
    'Agar jawaban selalu sama, dapat dipertanggungjawabkan terhadap SOP, ' +
    'dan tidak mungkin mengarang langkah yang tidak ada.', {
    ukuran: 12, warna: W.biruKabut, margin: 0, valign: 'top', spasiBaris: 16
  })
], 'Sistem tidak memahami makna kalimat — ia membandingkan kata. Itu justru kelebihannya: jawabannya tidak pernah mengarang.');

/* ══════════════════════════ 12 — Bukti pencocokan ══════════════════════════ */
S(`${LATAR}/terang.jpg`, [
  kepala('Bukti', 'Pencocokan diuji langsung dari penyunting SOP', { warnaTitik: W.hijauTua }),
  kartu(M - 0.06, 1.79, 7.87, 4.67, { isi: W.putih, alpha: 0.88, radius: 0.18 }),
  gambar(M, 1.85, 7.75, 4.55, `${TL}/laporan/02-pencocokan-kata-kunci.png`, { radius: 0.12, potong: 'atas' }),

  kartu(8.66, 1.85, 4.04, 2.16, { isi: W.hijau, radius: 0.18 }),
  teks(8.98, 2.06, 3.4, 0.28, 'MASUKAN', {
    ukuran: 10.5, tebal: true, warna: W.hijauGelap, spasiHuruf: 1.4, margin: 0
  }),
  teks(8.98, 2.38, 3.4, 0.42, '“kertas nyangkut di printer”', {
    ukuran: 15, tebal: true, warna: W.biruGelap, margin: 0, valign: 'top', miring: true
  }),
  teks(8.98, 2.96, 3.4, 0.28, 'HASIL', {
    ukuran: 10.5, tebal: true, warna: W.hijauGelap, spasiHuruf: 1.4, margin: 0
  }),
  teks(8.98, 3.26, 3.4, 0.52, 'Kertas Macet di Dalam Printer', {
    ukuran: 14.5, tebal: true, warna: W.biruGelap, margin: 0, valign: 'top'
  }),

  kartu(8.66, 4.2, 1.94, 1.38, { isi: W.biru, radius: 0.18 }),
  teks(8.66, 4.4, 1.94, 0.56, '1.000', {
    ukuran: 30, tebal: true, warna: W.putih, align: 'center', margin: 0
  }),
  teks(8.66, 5.04, 1.94, 0.3, 'skor cocok', {
    ukuran: 11, warna: W.biruKabut, align: 'center', margin: 0
  }),
  kartu(10.76, 4.2, 1.94, 1.38, { isi: W.putih, alpha: 0.8, radius: 0.18 }),
  teks(10.76, 4.4, 1.94, 0.56, '0,4', {
    ukuran: 30, tebal: true, warna: W.ink3, align: 'center', margin: 0
  }),
  teks(10.76, 5.04, 1.94, 0.3, 'ambang minimum', {
    ukuran: 11, warna: W.ink3, align: 'center', margin: 0
  }),
  teks(8.66, 5.76, 4.04, 0.7,
    'Di bawah ambang, sistem menyatakan keluhan belum dikenali dan menawarkan engineer — ' +
    'tidak memaksakan jawaban.', {
    ukuran: 12, warna: W.ink2, margin: 0, valign: 'top', spasiBaris: 16
  })
], 'Admin dapat menguji kalimat keluhan langsung dari penyunting SOP dan melihat skornya, tanpa menunggu ada laporan masuk.');

/* ══════════════════════════ 13 — Panduan bertahap ══════════════════════════ */
S(`${LATAR}/hijau.jpg`, [
  kepala('Panduan Mandiri', 'Langkah yang dapat diikuti tanpa istilah teknis',
    { warnaLabel: W.hijauTeks, warnaTitik: W.hijauTua }),
  kartu(6.49, 1.79, 6.25, 4.72, { isi: W.putih, alpha: 0.92, radius: 0.18 }),
  gambar(6.55, 1.85, 6.13, 4.6, `${TL}/laporan/03-panduan-printer.png`, { radius: 0.12, potong: 'atas' }),

  kartu(M, 1.88, 5.55, 1.02, { isi: W.biruTua }),
  teks(M + 0.28, 2.04, 4.99, 0.74,
    'Panduan ditulis untuk pekerja yang tidak berlatar teknis — menyebutkan ' +
    'apa yang dilihat dan apa yang ditekan.', {
    ukuran: 13, warna: W.putih, margin: 0, valign: 'top', spasiBaris: 18
  }),
  ...[
    ['Penyebab disebutkan lebih dulu', 'Pelapor mengerti apa yang sedang terjadi, bukan sekadar menurut.', 3.08, W.biru],
    ['Tiga langkah bertahap', 'Bila langkah pertama belum menuntaskan, ditawarkan yang berikutnya.', 4.02, W.hijauTua],
    ['Berhenti sebelum berisiko', 'Begitu perlu izin administrator, langkah berhenti dan mengarahkan ke engineer.', 4.96, W.merah]
  ].flatMap(([judul, isi, y, warna]) => [
    kartu(M, y, 5.55, 0.86, { isi: W.putih, alpha: 0.76, radius: 0.14 }),
    kotak(M + 0.26, y + 0.29, 0.28, 0.28, { isi: warna, radius: 0.14 }),
    teks(M + 0.72, y + 0.1, 4.6, 0.28, judul, {
      ukuran: 14, tebal: true, warna: W.ink, margin: 0, valign: 'top'
    }),
    teks(M + 0.72, y + 0.4, 4.6, 0.42, isi, {
      ukuran: 12, warna: W.ink3, margin: 0, valign: 'top', spasiBaris: 16
    })
  ]),
  kartu(M, 5.94, 5.55, 0.72, { isi: W.hijau }),
  teks(M + 0.28, 5.94, 4.99, 0.72, '137 masalah dan 194 solusi tersusun di basis pengetahuan.', {
    ukuran: 13, tebal: true, warna: W.biruGelap, margin: 0, valign: 'middle'
  })
], 'Bahasanya sengaja dibuat sederhana. Kami hindari istilah teknis, karena penggunanya pekerja lapangan, bukan orang IT.');

/* ══════════════════════════ 14 — Nomor tiket ══════════════════════════ */
S(`${LATAR}/terang.jpg`, [
  kepala('Pencatatan', 'Setiap laporan bernomor dan dapat ditelusuri', { warnaTitik: W.biru }),
  kartu(6.64, 1.79, 6.1, 4.72, { isi: W.putih, alpha: 0.92, radius: 0.18 }),
  gambar(6.7, 1.85, 5.98, 4.6, `${TL}/laporan/05b-nomor-tiket-cek-status.png`, { radius: 0.12, potong: 'atas' }),

  kartu(M, 1.9, 5.7, 1.34, { isi: W.biruTua, radius: 0.18 }),
  teks(M, 2.14, 5.7, 0.56, 'SGP-20260824-0008', {
    ukuran: 26, tebal: true, warna: W.hijau, align: 'center', margin: 0, font: 'Consolas'
  }),
  teks(M, 2.76, 5.7, 0.3, 'awalan · tanggal WIB · urutan hari itu', {
    ukuran: 11.5, warna: W.biruKabut, align: 'center', margin: 0
  }),
  ...[
    ['Diberikan sejak awal', 'Nomor terbit begitu sesi dimulai, bukan menunggu eskalasi.', 3.5, W.biruSoft, W.biru, W.biruTeks],
    ['Dapat dicek sendiri', 'Pelapor memeriksa status kapan saja tanpa menghubungi siapa pun.', 4.52, W.hijauSoft, W.hijauTua, W.hijauTeks],
    ['Menjadi bahan rekap', 'Seluruh laporan terhimpun dan dapat disaring per hari, minggu, atau bulan.', 5.54, W.merahSoft, W.merah, W.merahTeks]
  ].flatMap(([judul, isi, y, latar, warna, warnaJudul]) => [
    kartu(M, y, 5.7, 0.92, { isi: latar }),
    kotak(M + 0.28, y + 0.32, 0.28, 0.28, { isi: warna, radius: 0.14 }),
    teks(M + 0.74, y + 0.12, 4.7, 0.28, judul, {
      ukuran: 14, tebal: true, warna: warnaJudul, margin: 0, valign: 'top'
    }),
    teks(M + 0.74, y + 0.44, 4.7, 0.42, isi, {
      ukuran: 12, warna: W.ink2, margin: 0, valign: 'top', spasiBaris: 16
    })
  ])
], 'Nomor tiket diberikan sejak sesi dimulai. Jadi walaupun pelapor berhenti di tengah, laporannya tetap tercatat untuk rekap.');

/* ══════════════════════════ 15 — Eskalasi ══════════════════════════ */
S(`${LATAR}/biru.jpg`, [
  kepala('Eskalasi', 'Diteruskan lengkap, bukan sekadar diteruskan',
    { ukuranJudul: 29, warnaTitik: W.merah }),
  kotak(M - 0.07, 1.83, 5.49, 3.13, { isi: W.merah, radius: 0.2, alpha: 0.74 }),
  gambar(M, 1.9, 5.35, 2.99, `${ILUS}/4-engineer.jpg`, { radius: 0.18 }),

  kartu(M, 5.06, 5.35, 1.6, { isi: W.putih, alpha: 0.76 }),
  ...[
    ['Nama, fungsi, dan lokasi pelapor', 5.24],
    ['Tingkat urgensi yang dipilih sendiri', 5.72],
    ['Isi keluhan dan solusi yang sudah dicoba', 6.2]
  ].map(([t, y]) => butir(M + 0.28, y, 4.99, t, { ukuran: 12.5, tinggi: 0.4, penanda: W.hijauTua })),

  kartu(6.34, 1.83, 6.4, 4.02, { isi: W.putih, alpha: 0.92, radius: 0.18 }),
  gambar(6.4, 1.9, 6.28, 3.9, `${TL}/laporan/06b-eskalasi-serah-terima-whatsapp.png`, { radius: 0.12, potong: 'bawah' }),
  kartu(6.34, 6.0, 6.4, 0.94, { isi: W.hijau }),
  teks(6.66, 6.14, 5.76, 0.66,
    'Engineer menerima laporan yang sudah lengkap — tidak perlu bertanya ulang ' +
    'siapa, di mana, dan sudah dicoba apa saja.', {
    ukuran: 12.5, tebal: true, warna: W.biruGelap, margin: 0, valign: 'top', spasiBaris: 17
  })
], 'Formulir identitas sengaja diletakkan di akhir, bukan di awal. Supaya pekerja tidak malas melapor hanya karena harus mengisi data dulu.');

/* ══════════════════════════ 16 — Rekap dan tugas ══════════════════════════ */
S(`${LATAR}/terang.jpg`, [
  kepala('Bagi Pengelola', 'Rekap untuk admin, daftar tugas untuk engineer', { warnaTitik: W.biru }),
  ...[
    ['HALAMAN REKAP', `${TL}/13-rekap-layar-pertama.png`,
     'Angka ringkasan, grafik harian, sebaran per layanan dan area, serta unduhan Excel dan cetak PDF.',
     M, 6.1, W.biru, W.biruTua],
    ['DAFTAR TUGAS ENGINEER', `${TL}/laporan/06-eskalasi-antrian-engineer.png`,
     'Tiket yang menunggu, siapa yang sedang mengerjakan, dan berapa lama sebuah laporan sudah menganggur.',
     7.06, 5.62, W.hijauTua, W.hijau]
  ].flatMap(([label, jalur, isi, x, w, warna, latarKaki]) => {
    const gelapKaki = latarKaki === W.biruTua;
    return [
      kotak(x, 1.86, 0.13, 0.13, { isi: warna, radius: 0.065 }),
      teks(x + 0.26, 1.78, w - 0.26, 0.3, label, {
        ukuran: 11.5, tebal: true, warna, spasiHuruf: 1.5, margin: 0
      }),
      kartu(x - 0.06, 2.14, w + 0.12, 3.66, { isi: W.putih, alpha: 0.9, radius: 0.18 }),
      gambar(x, 2.2, w, 3.54, jalur, { radius: 0.12, potong: 'atas' }),
      kartu(x, 5.94, w, 0.98, { isi: latarKaki }),
      teks(x + 0.28, 6.08, w - 0.56, 0.72, isi, {
        ukuran: 12, warna: gelapKaki ? W.putih : W.biruGelap, tebal: !gelapKaki,
        margin: 0, valign: 'top', spasiBaris: 16
      })
    ];
  })
], 'Admin melihat rekap untuk evaluasi, engineer melihat daftar tugas. Halaman tugas dibuat ringan karena dibuka dari ponsel di lapangan.');

/* ══════════════════════════ 17 — Pembatas ══════════════════════════ */
pembatas('04', 'Hasil dan Pengujian',
  'Teknologi yang dipakai, hasil pengujian black-box, lalu demonstrasi langsung.',
  'Bagian terakhir: apa yang dipakai membangunnya, dan apakah hasilnya benar-benar berjalan.');

/* ══════════════════════════ 18 — Teknologi ══════════════════════════ */
S(`${LATAR}/terang.jpg`, [
  kepala('Teknologi', 'Dipilih agar ringan dan mudah dirawat', { warnaTitik: W.biru }),
  ...[
    ['Node.js', 'PELADEN APLIKASI', 'Hanya empat pustaka luar — sisanya modul bawaan.', W.biru, W.putih, W.biruKabut],
    ['SQLite', 'BASIS DATA', 'Berupa satu berkas. Tanpa MySQL, tanpa XAMPP.', W.hijau, W.biruGelap, W.hijauGelap],
    ['React', 'ANTARMUKA', 'Halaman berat dimuat terpisah agar pelapor tidak ikut mengunduhnya.', W.biruTua, W.putih, W.biruKabut],
    ['Berkas JSON', 'BASIS PENGETAHUAN', 'SOP disunting lewat peramban, tanpa menyentuh kode.', W.merah, W.putih, W.merahKabut]
  ].flatMap(([nama, peran, isi, latar, warnaJudul, warnaIsi], i) => {
    const w = 2.94, x = M + i * (w + 0.17), y = 1.95;
    return [
      kartu(x, y, w, 2.6, { isi: latar, radius: 0.18 }),
      teks(x + 0.32, y + 0.34, w - 0.64, 0.44, nama, {
        ukuran: 21, tebal: true, warna: warnaJudul, margin: 0, valign: 'top'
      }),
      teks(x + 0.32, y + 0.86, w - 0.64, 0.28, peran, {
        ukuran: 9.5, tebal: true, warna: warnaIsi, spasiHuruf: 1.3, margin: 0
      }),
      teks(x + 0.32, y + 1.24, w - 0.64, 1.1, isi, {
        ukuran: 12.5, warna: warnaIsi, margin: 0, valign: 'top', spasiBaris: 17
      })
    ];
  }),
  kartu(M, 5.04, LEBAR_ISI, 1.5, { isi: W.putih, alpha: 0.76, radius: 0.18 }),
  teks(M + 0.44, 5.26, 5.6, 0.38, 'Tanpa AI, tanpa layanan berbayar', {
    ukuran: 18, tebal: true, warna: W.ink, margin: 0, valign: 'top'
  }),
  teks(M + 0.44, 5.72, 5.6, 0.6, 'Seluruh sistem berjalan di jaringan kantor sendiri.', {
    ukuran: 13, warna: W.ink3, margin: 0, valign: 'top'
  }),
  ...[['4', 'pustaka luar', W.biru], ['0', 'biaya langganan', W.merah], ['1', 'berkas basis data', W.hijauTua]]
    .flatMap(([angka, label, warna], i) => {
      const x = 7.6 + i * 1.78;
      return [
        teks(x, 5.24, 1.64, 0.56, angka, {
          ukuran: 34, tebal: true, warna, align: 'center', margin: 0
        }),
        teks(x, 5.9, 1.64, 0.44, label, {
          ukuran: 11, warna: W.ink3, align: 'center', margin: 0, spasiBaris: 14
        })
      ];
    })
], 'Kami sengaja menahan diri menambah pustaka. Makin sedikit yang dipasang, makin sedikit yang perlu dirawat Fungsi IT nanti.');

/* ══════════════════════════ 19 — Pengujian ══════════════════════════ */
S(`${LATAR}/biru.jpg`, [
  kepala('Pengujian', 'Diuji dengan metode black-box', { warnaTitik: W.hijauTua }),
  ...[
    ['7', 'fungsi utama diuji', 'Dari akses halaman utama sampai eskalasi engineer.', W.biru, W.putih, W.biruKabut],
    ['378', 'pemeriksaan otomatis', 'Dijalankan ulang setiap kali SOP atau kode berubah.', W.biruTua, W.hijau, W.biruKabut],
    ['100%', 'sesuai harapan', 'Seluruh keluaran cocok dengan hasil yang diharapkan.', W.hijau, W.biruGelap, W.hijauGelap]
  ].flatMap(([angka, label, isi, latar, warnaAngka, warnaIsi], i) => {
    const w = 3.96, x = M + i * (w + 0.18), y = 1.95;
    return [
      kartu(x, y, w, 2.34, { isi: latar, radius: 0.2 }),
      teks(x, y + 0.36, w, 0.9, angka, {
        ukuran: 54, tebal: true, warna: warnaAngka, align: 'center', margin: 0
      }),
      teks(x, y + 1.3, w, 0.3, label, {
        ukuran: 14, tebal: true, warna: warnaAngka, align: 'center', margin: 0
      }),
      teks(x + 0.3, y + 1.68, w - 0.6, 0.5, isi, {
        ukuran: 12, warna: warnaIsi, align: 'center', margin: 0, valign: 'top', spasiBaris: 16
      })
    ];
  }),
  kotak(M, 4.72, 0.13, 0.13, { isi: W.merah, radius: 0.065 }),
  teks(M + 0.26, 4.64, LEBAR_ISI - 0.26, 0.3, 'YANG JUGA DIJAGA', {
    ukuran: 11.5, tebal: true, warna: W.merahTeks, spasiHuruf: 1.5, margin: 0
  }),
  ...[
    ['Keluhan di luar cakupan harus ditolak', 'Sistem tidak boleh memaksakan jawaban untuk kendala yang bukan urusan IT.', 0],
    ['Keterangan tambahan tidak merusak pencocokan', 'Menyebut ruangan dan waktu tidak boleh menjatuhkan skor di bawah ambang.', 1]
  ].flatMap(([judul, isi, i]) => {
    const w = 6.04, x = M + i * (w + 0.29), y = 5.02;
    return [
      kartu(x, y, w, 1.42, { isi: W.putih, alpha: 0.82 }),
      teks(x + 0.32, y + 0.24, w - 0.64, 0.3, judul, {
        ukuran: 14, tebal: true, warna: W.ink, margin: 0, valign: 'top'
      }),
      teks(x + 0.32, y + 0.62, w - 0.64, 0.6, isi, {
        ukuran: 12, warna: W.ink2, margin: 0, valign: 'top', spasiBaris: 16
      })
    ];
  })
], 'Selain menguji yang harus berhasil, kami juga menguji yang harus GAGAL — supaya sistem tidak asal menjawab.');

/* ══════════════════════════ 20 — DEMO ══════════════════════════ */
S(`${LATAR}/gelap.jpg`, [
  noda(11.9, 6.9, 5.0, W.hijau, 0.11),
  noda(1.0, 0.7, 3.4, W.biruTerang, 0.13),
  kotak(6.47, 1.54, 6.36, 3.62, { isi: W.hijau, radius: 0.24, alpha: 0.68 }),
  gambar(6.55, 1.62, 6.2, 3.46, `${ILUS}/5-demo.jpg`, { radius: 0.22 }),

  kotak(M, 1.76, 2.36, 0.34, { isi: W.hijau, radius: 0.17 }),
  teks(M, 1.76, 2.36, 0.34, 'BAGIAN BERIKUTNYA', {
    ukuran: 10, tebal: true, warna: W.biruGelap, spasiHuruf: 1.4,
    align: 'center', valign: 'middle', margin: 0
  }),
  teks(M, 2.34, 5.7, 1.6, 'Demonstrasi\nLangsung', {
    ukuran: 54, tebal: true, warna: W.putih, margin: 0, valign: 'top', spasiBaris: 60
  }),
  kotak(M, 4.5, 4.6, 0.03, { isi: W.hijau }),
  teks(M, 4.76, 5.7, 0.5, 'Sistem dijalankan langsung dari laptop, bukan rekaman.', {
    ukuran: 15.5, warna: W.biruKabut, margin: 0, valign: 'top', spasiBaris: 22
  }),
  kartu(M, 5.4, 5.7, 1.6, { isi: W.putih, alpha: 0.1 }),
  ...[
    ['Melapor kendala printer sampai memperoleh panduan', 5.58],
    ['Eskalasi ke engineer beserta nomor tiketnya', 6.06],
    ['Halaman rekap dan daftar tugas engineer', 6.54]
  ].map(([t, y]) => butir(M + 0.3, y, 5.1, t, {
    ukuran: 12.5, warna: W.putih, penanda: W.hijau, tinggi: 0.4
  }))
], 'Sekarang kami tunjukkan langsung. Aplikasinya berjalan di laptop ini — bukan video, jadi Bapak/Ibu bisa meminta kami mencoba keluhan apa pun.');

/* ══════════════════════════ 21 — Keterbatasan ══════════════════════════ */
S(`${LATAR}/hijau.jpg`, [
  kepala('Keterbatasan', 'Yang belum tercakup, disampaikan apa adanya',
    { warnaLabel: W.hijauTeks, warnaTitik: W.merah }),
  ...[
    ['Panduan mandiri baru dua layanan', 'Enam layanan lain masih diarahkan ke engineer sampai SOP-nya divalidasi.', 0, 0, W.merah],
    ['Pencocokan bergantung kosakata', 'Keluhan dengan istilah yang jauh berbeda dapat tidak menemukan kecocokan.', 1, 0, W.biru],
    ['Tolok ukur belum dari keluhan nyata', 'Contoh uji disusun pengembang; ketepatan sebenarnya baru terukur setelah dipakai.', 0, 1, W.hijauTua],
    ['Bergantung WhatsApp dan satu mesin', 'Eskalasi lewat layanan pihak ketiga, dan belum ada cadangan berjalan.', 1, 1, W.biruTua]
  ].flatMap(([judul, isi, kol, bar, warna]) => {
    const w = 6.04, x = M + kol * (w + 0.29), y = 1.95 + bar * 1.5;
    return [
      kartu(x, y, w, 1.32, { isi: W.putih, alpha: 0.86 }),
      kotak(x + 0.3, y + 0.28, 0.3, 0.3, { isi: warna, radius: 0.15 }),
      teks(x + 0.78, y + 0.24, w - 1.1, 0.3, judul, {
        ukuran: 15, tebal: true, warna: W.ink, margin: 0, valign: 'top'
      }),
      teks(x + 0.78, y + 0.6, w - 1.1, 0.56, isi, {
        ukuran: 12.5, warna: W.ink3, margin: 0, valign: 'top', spasiBaris: 17
      })
    ];
  }),
  kartu(M, 5.16, LEBAR_ISI, 1.36, { isi: W.biruTua, radius: 0.18 }),
  kotak(M + 0.42, 5.5, 0.34, 0.34, { isi: W.hijau, radius: 0.17 }),
  teks(M + 0.98, 5.4, 3.3, 0.36, 'Pengembangan lanjutan', {
    ukuran: 15.5, tebal: true, warna: W.hijau, margin: 0, valign: 'top'
  }),
  teks(M + 0.98, 5.82, 10.6, 0.54,
    'Perluasan panduan mandiri untuk enam layanan lainnya, penambahan ragam kata kunci ' +
    'dari keluhan nyata yang terkumpul, dan peninjauan mekanisme respons.', {
    ukuran: 12.5, warna: W.biruKabut, margin: 0, valign: 'top', spasiBaris: 17
  })
], 'Kami sampaikan keterbatasannya terbuka, karena sistem ini akan diserahkan dan dirawat orang lain.');

/* ══════════════════════════ 22 — Penutup ══════════════════════════ */
S(`${LATAR}/gelap.jpg`, [
  noda(12.4, 1.0, 4.6, W.biru, 0.13),
  noda(0.6, 6.9, 3.4, W.hijau, 0.11),
  kotak(M, 1.52, 1.9, 0.34, { isi: W.hijau, radius: 0.17 }),
  teks(M, 1.52, 1.9, 0.34, 'KESIMPULAN', {
    ukuran: 10.5, tebal: true, warna: W.biruGelap, spasiHuruf: 1.5,
    align: 'center', valign: 'middle', margin: 0
  }),
  teks(M, 2.1, 11.4, 1.7,
    'SIGAP menyatukan pelaporan, pencatatan,\npanduan, dan eskalasi dalam satu alur.', {
    ukuran: 33, tebal: true, warna: W.putih, margin: 0, valign: 'top', spasiBaris: 44
  }),
  ...[
    ['Pelapor', 'Memperoleh panduan atau kepastian bahwa laporannya diteruskan.', W.biru, W.hijau, W.putih, undefined],
    ['Engineer', 'Menerima laporan lengkap, tanpa perlu bertanya ulang.', W.hijau, W.biruGelap, '2E3A0A', undefined],
    ['Fungsi IT', 'Memiliki data gangguan yang dapat direkap dan dievaluasi.', W.putih, W.biruTeks, W.ink2, 0.94]
  ].flatMap(([judul, isi, latar, warnaJudul, warnaIsi, alpha], i) => {
    const w = 3.96, x = M + i * (w + 0.18), y = 4.06;
    return [
      kartu(x, y, w, 1.6, { isi: latar, radius: 0.18, alpha }),
      teks(x + 0.34, y + 0.26, w - 0.68, 0.36, judul, {
        ukuran: 18, tebal: true, warna: warnaJudul, margin: 0, valign: 'top'
      }),
      teks(x + 0.34, y + 0.72, w - 0.68, 0.7, isi, {
        ukuran: 12.5, warna: warnaIsi, margin: 0, valign: 'top', spasiBaris: 17
      })
    ];
  }),
  teks(M, 6.16, 11.4, 0.4, 'Terima kasih atas perhatian Bapak dan Ibu.', {
    ukuran: 17, tebal: true, warna: W.putih, margin: 0, valign: 'top'
  }),
  teks(M, 6.64, 11.4, 0.34,
    'Teknik Informatika · Fakultas Teknik · Universitas Islam Riau · 2026', {
    ukuran: 12, warna: W.biruSamar, margin: 0, valign: 'top'
  })
], 'Terima kasih. Kami siap menerima pertanyaan dan masukan.');
