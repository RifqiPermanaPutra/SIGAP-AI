/**
 * Daftar lokasi di PT Pertamina EP Field Lirik, dikelompokkan ke 3 area besar:
 * Buatan, Ukui, dan Lirik. Dipakai pada dropdown pemilihan lokasi pelapor.
 *
 * Sumber: data lokasi operasional Field Lirik.
 *
 * Seluruh lokasi pada kelompok Lirik diakhiri kata "Lirik" supaya asal
 * areanya terbaca sendiri — nama seperti "RAM" atau "FM" saja tidak
 * memberitahu pembacanya area mana yang dimaksud, dan nama itu ikut terbawa
 * ke pesan WhatsApp engineer serta tabel rekap yang lepas dari pengelompokan
 * dropdown ini.
 */
export const LOKASI_GROUPS = [
  {
    area: 'Buatan',
    items: [
      'Kantor Besar Buatan',
      'Operator Buatan'
    ]
  },
  {
    area: 'Ukui',
    items: [
      'Pumper UKUI',
      'P3 Operator UKUI',
      'SP 5, 6, 7 UKUI',
      'Klinik UKUI'
    ]
  },
  {
    area: 'Lirik',
    items: [
      'HSSE Demo Room Lirik',
      'Produksi Lirik',
      'WS Lirik',
      'PE Lirik',
      'Finance Lirik',
      'HC Lirik',
      'RAM Lirik',
      'PO Lirik',
      'LR Lirik',
      'FM Lirik',
      'IT Lirik',
      'Fire Lirik',
      'Transport Lirik',
      'SCM Lirik',
      'Bengkel TOPSIP Lirik',
      'Bengkel Mekanik Lirik',
      'Bengkel Instrumen Umum dan Las Lirik',
      'Bengkel Listrik Lirik',
      'Security Kantor Besar Lirik',
      'Pos Camp 1 Lirik',
      'Security Industrial Lirik',
      'Security Japura Lirik',
      'SP 2, 3, 4 Lirik'
    ]
  }
];

// Daftar rata semua lokasi — berguna untuk validasi
export const LOKASI_ALL = LOKASI_GROUPS.flatMap((g) => g.items);
