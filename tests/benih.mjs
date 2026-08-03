/**
 * Pengisi data contoh untuk pengujian.
 *
 * Menghasilkan laporan yang menyerupai keadaan sebenarnya — akhir pekan lebih
 * sepi, divisi swalayan lebih ramai, sebagian tiket ditandai selesai dan
 * sebagian tidak. Angka acaknya memakai benih tetap, sehingga hasil uji sama
 * setiap kali dijalankan.
 *
 * HANYA untuk basis data sementara. `DB_PATH` wajib sudah diarahkan ke sana
 * sebelum berkas ini dimuat.
 */
import { initDatabase, wajibSiap, tutupDatabase, tanggalWIB } from '../server/database/init.js';
import { buatPengguna, cariPengguna } from '../server/services/authService.js';
import { areaDariLokasi } from '../server/config/divisi.js';

export const AKUN_UJI = {
  admin: { namaAkun: 'admin', sandi: 'ujicoba123' },
  engineer: { namaAkun: 'eka', sandi: 'ujicoba123' }
};

const KELUHAN = {
  printer: [
    ['kertas nyangkut di printer', 'Kertas Macet di Dalam Printer', 0.78],
    ['printer gabisa ngeprint sama sekali', 'Printer Tidak Dapat Mencetak', 0.61],
    ['hasil cetakan bergaris garis', 'Hasil Cetak Bergaris', 0.72],
    ['printer warnanya jadi ungu semua', null, 0.19]
  ],
  windows: [
    ['laptop saya lemot banget', 'Komputer Lambat', 0.69],
    ['gabisa connect wifi kantor', 'Tidak Dapat Terhubung WiFi', 0.58],
    ['layar biru terus restart sendiri', 'Blue Screen', 0.81],
    ['file di desktop hilang semua', null, 0.24]
  ],
  cctv: [['kamera gudang mati', null, 0], ['cctv area parkir buram', null, 0]],
  lan: [['internet mati di ruangan saya', null, 0], ['kabel lan lepas kayaknya', null, 0]],
  telepon: [['telepon ga ada nada', null, 0]],
  radio: [['ht saya ga bisa nyala', null, 0]],
  fttp: [['lampu los merah di onu', null, 0]],
  wan: [['koneksi ke ukui putus', null, 0]]
};

const NAMA = ['Budi Santoso', 'Siti Rahayu', 'Ahmad Fauzi', 'Dewi Lestari', 'Rudi Hartono',
  'Nur Aisyah', 'Rina Marlina', 'Agus Salim', 'Fitri Handayani'];
const FUNGSI = ['FM', 'HC & Plan Eval', 'PE & WO/WS', 'Finance', 'R.A.M', 'Legal & Relation', 'PO'];
const LOKASI = ['Produksi Lirik', 'WS Lirik', 'Finance Lirik', 'HC Lirik', 'RAM', 'IT', 'Fire',
  'Bengkel Listrik', 'Kantor Besar Buatan', 'Pumper UKUI', 'Klinik UKUI', 'SP 2, 3, 4'];
const URGENSI = ['Rendah', 'Sedang', 'Tinggi', 'Kritis'];
const SWALAYAN = ['printer', 'windows'];

/** Nomor tiket baris cacat yang sengaja ditanam — lihat keterangan di bawah */
export const TIKET_CACAT = 'SGP-CACAT-0001';

/**
 * Isi basis data dengan laporan contoh.
 * @param {number} [hari=44] Berapa hari ke belakang yang diisi
 * @returns {Promise<number>} Banyaknya laporan yang dibuat
 */
export async function isiDataContoh(hari = 44) {
  await initDatabase();
  const db = wajibSiap();

  for (const [peran, akun] of Object.entries(AKUN_UJI)) {
    if (!cariPengguna(akun.namaAkun)) {
      buatPengguna({
        namaAkun: akun.namaAkun,
        nama: peran === 'admin' ? 'Administrator' : 'Eka Maulana',
        peran,
        sandi: akun.sandi
      });
    }
  }

  // Pembangkit acak berbenih tetap — hasil uji harus dapat diulang
  let benih = 20260731;
  const rnd = () => { benih = (benih * 1103515245 + 12345) % 2147483648; return benih / 2147483648; };
  const pilih = (a) => a[Math.floor(rnd() * a.length)];

  const sisip = db.prepare(`
    INSERT INTO sesi (id, nomor_tiket, tanggal_wib, dibuat_pada, diperbarui_pada, berakhir_pada,
      status, divisi_id, mode_divisi, keluhan, masalah_cocok, skor_cocok, solusi_terakhir,
      nama, fungsi, lokasi, area, urgensi, engineer_tujuan, diteruskan_pada,
      ditangani_pada, ditangani_oleh, catatan)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const sisipPesan = db.prepare('INSERT INTO pesan (sesi_id, peran, isi, dibuat_pada) VALUES (?,?,?,?)');

  const perHari = new Map();
  let dibuat = 0;

  for (let hariLalu = hari; hariLalu >= 0; hariLalu--) {
    const tgl = new Date(Date.now() - hariLalu * 86400000);
    const akhirPekan = [0, 6].includes(tgl.getUTCDay());
    const jumlah = akhirPekan ? Math.floor(rnd() * 2) : 2 + Math.floor(rnd() * 6);

    for (let n = 0; n < jumlah; n++) {
      const divisi = rnd() < 0.55 ? pilih(SWALAYAN) : pilih(Object.keys(KELUHAN));
      const mode = SWALAYAN.includes(divisi) ? 'swalayan' : 'engineer';
      const [keluhan, masalah, skor] = pilih(KELUHAN[divisi]);

      // Jangan melampaui waktu sekarang — stempel waktu di masa depan
      // membuat durasi dan waktu tanggap terhitung mundur.
      const jam = 7 + Math.floor(rnd() * 10);
      const kasar = Date.UTC(tgl.getUTCFullYear(), tgl.getUTCMonth(), tgl.getUTCDate(), jam - 7, Math.floor(rnd() * 60));
      const mulai = new Date(Math.min(kasar, Date.now() - 3600 * 1000));
      const tanggal = tanggalWIB(mulai.toISOString());
      const lama = mode === 'engineer' ? 60 + Math.floor(rnd() * 180) : 180 + Math.floor(rnd() * 900);
      const akhir = new Date(mulai.getTime() + lama * 1000);

      let status;
      if (mode === 'engineer') status = rnd() < 0.9 ? 'diteruskan' : 'ditinggalkan';
      else if (skor >= 0.5) status = rnd() < 0.72 ? 'selesai' : 'diteruskan';
      else status = rnd() < 0.35 ? 'ditinggalkan' : 'diteruskan';

      const nomor = (perHari.get(tanggal) || 0) + 1;
      perHari.set(tanggal, nomor);
      const id = `benih-${dibuat}`;
      const diteruskan = status === 'diteruskan';
      const lokasi = diteruskan ? pilih(LOKASI) : null;
      const ditangani = diteruskan && rnd() < 0.4
        ? new Date(akhir.getTime() + (600 + rnd() * 20000) * 1000).toISOString() : null;

      sisip.run(
        id, `SGP-${tanggal.replace(/-/g, '')}-${String(nomor).padStart(4, '0')}`, tanggal,
        mulai.toISOString(), akhir.toISOString(), akhir.toISOString(),
        status, divisi, mode, keluhan, masalah, skor || 0,
        mode === 'swalayan' ? 1 + Math.floor(rnd() * 3) : null,
        diteruskan ? pilih(NAMA) : null,
        diteruskan ? pilih(FUNGSI) : null,
        lokasi,
        lokasi ? areaDariLokasi(lokasi) : null,
        diteruskan ? pilih(URGENSI) : null,
        diteruskan ? `Engineer ···${1000 + Math.floor(rnd() * 5) * 1111}` : null,
        diteruskan ? akhir.toISOString() : null,
        ditangani, ditangani ? 'eka' : null, ditangani ? 'Sudah ditangani di lokasi.' : null
      );

      sisipPesan.run(id, 'user', keluhan, mulai.toISOString());
      sisipPesan.run(id, 'assistant', masalah || 'Diteruskan ke Engineer ICT.', akhir.toISOString());
      dibuat++;
    }
  }

  // Satu baris sengaja dibuat cacat: ditandai selesai SEBELUM diteruskan.
  // Meniru jam server yang pernah mundur. Dipakai menguji bahwa laporan
  // mengosongkan selisih mustahil, bukan menampilkannya sebagai angka negatif.
  const akhir = new Date(Date.now() - 3600 * 1000);
  sisip.run(
    'benih-cacat', TIKET_CACAT, tanggalWIB(akhir.toISOString()),
    new Date(akhir.getTime() - 600000).toISOString(), akhir.toISOString(), akhir.toISOString(),
    'diteruskan', 'lan', 'engineer', 'uji stempel waktu mundur', null, 0, null,
    'Uji Cacat', 'FM', 'IT', 'Lirik', 'Rendah', 'Engineer ···0000',
    akhir.toISOString(), new Date(akhir.getTime() - 7200000).toISOString(), 'eka', 'baris uji'
  );
  dibuat++;

  tutupDatabase();
  return dibuat;
}
