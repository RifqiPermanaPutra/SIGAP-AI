/**
 * Tingkat urgensi kendala, diisi pelapor saat pengaduan diteruskan ke engineer.
 *
 * Keterangan sengaja dituliskan berdasarkan dampak nyata terhadap pekerjaan,
 * bukan istilah teknis, agar pelapor awam dapat memilih dengan tepat tanpa
 * cenderung selalu memilih tingkat tertinggi.
 */
export const URGENSI_LIST = [
  {
    nilai: 'Rendah',
    keterangan: 'Tidak mengganggu pekerjaan, masih bisa menunggu'
  },
  {
    nilai: 'Sedang',
    keterangan: 'Mengganggu sebagian pekerjaan, masih ada cara lain'
  },
  {
    nilai: 'Tinggi',
    keterangan: 'Pekerjaan terhenti, tidak ada cara lain'
  },
  {
    nilai: 'Kritis',
    keterangan: 'Berdampak pada operasi lapangan atau keselamatan kerja'
  }
];
