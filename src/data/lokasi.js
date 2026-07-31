/**
 * Daftar lokasi di PT Pertamina EP Field Lirik, dikelompokkan ke 3 area besar:
 * Buatan, Ukui, dan Lirik. Dipakai pada dropdown pemilihan lokasi pelapor.
 *
 * Sumber: data lokasi operasional Field Lirik.
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
      'HSSE Demo Room',
      'Produksi Lirik',
      'WS Lirik',
      'PE Lirik',
      'Finance Lirik',
      'HC Lirik',
      'RAM',
      'PO',
      'LR',
      'FM',
      'IT',
      'Fire',
      'Transport',
      'SCM',
      'Bengkel TOPSIP',
      'Bengkel Mekanik',
      'Bengkel Instrumen Umum dan Las',
      'Bengkel Listrik',
      'Security Kantor Besar',
      'Pos Camp 1',
      'Security Industrial',
      'Security Japura',
      'SP 2, 3, 4'
    ]
  }
];

// Daftar rata semua lokasi — berguna untuk validasi
export const LOKASI_ALL = LOKASI_GROUPS.flatMap((g) => g.items);
