/**
 * Pembatas laju permintaan — tanpa dependensi.
 *
 * Penghitung disimpan di memori, bukan di basis data. Setelah server
 * dijalankan ulang penghitungnya wajar dimulai dari nol, dan menuliskan setiap
 * permintaan ke disk justru menciptakan beban yang hendak dicegah.
 *
 * Ditujukan untuk pemakaian jaringan internal: menahan penyalahgunaan yang
 * tidak disengaja dan percobaan iseng, bukan serangan terdistribusi.
 */
import { peringatan } from './logUtil.js';

/**
 * Buat middleware pembatas.
 *
 * @param {object} opsi
 * @param {string} opsi.nama          Nama pembatas, dipakai pada log
 * @param {number} opsi.maks          Banyak permintaan yang diizinkan
 * @param {number} opsi.jendelaDetik  Panjang jendela pengamatan
 * @param {string} [opsi.pesan]       Pesan yang dikirim saat batas terlampaui
 */
export function batasiLaju({ nama, maks, jendelaDetik, pesan }) {
  const jendelaMs = jendelaDetik * 1000;
  /** @type {Map<string, number[]>} alamat → daftar waktu permintaan */
  const catatan = new Map();

  // Bersihkan berkala agar peta tidak tumbuh mengikuti jumlah alamat yang
  // pernah singgah. Tanpa ini, memakai Map sebagai penghitung berarti
  // kebocoran memori yang tumbuh perlahan.
  setInterval(() => {
    const batas = Date.now() - jendelaMs;
    for (const [kunci, waktu] of catatan) {
      const tersisa = waktu.filter((t) => t > batas);
      if (tersisa.length === 0) catatan.delete(kunci);
      else catatan.set(kunci, tersisa);
    }
  }, jendelaMs).unref();

  return (req, res, next) => {
    const alamat = req.ip || req.socket?.remoteAddress || 'tidak-diketahui';
    const sekarang = Date.now();
    const batas = sekarang - jendelaMs;

    const waktu = (catatan.get(alamat) || []).filter((t) => t > batas);

    if (waktu.length >= maks) {
      const sisaDetik = Math.ceil((waktu[0] + jendelaMs - sekarang) / 1000);
      peringatan('laju-terlampaui', { pembatas: nama, alamat, jumlah: waktu.length });
      res.setHeader('Retry-After', String(sisaDetik));
      return res.status(429).json({
        success: false,
        error: pesan || `Terlalu banyak permintaan. Coba lagi dalam ${Math.ceil(sisaDetik / 60)} menit.`
      });
    }

    waktu.push(sekarang);
    catatan.set(alamat, waktu);
    next();
  };
}

/**
 * Penghitung kegagalan masuk.
 *
 * Dikunci menurut **pasangan akun dan alamat**, bukan nama akun saja.
 * Mengunci berdasarkan nama akun membuat siapa pun yang mengetahui nama akun
 * seorang engineer dapat sengaja salah beberapa kali dan menguncinya — korban
 * penguncian justru orang yang berhak. Dengan pasangan akun-alamat, yang
 * terkunci hanyalah penyerangnya sendiri.
 *
 * Sebagai lapis kedua, satu alamat yang gagal terlalu sering pada akun mana
 * pun ikut ditahan, sehingga penelusuran akun satu per satu tidak berguna.
 */
export function buatPenghitungMasuk({ maksPerAkun = 5, maksPerAlamat = 15, jedaMenit = 15 } = {}) {
  const jedaMs = jedaMenit * 60 * 1000;
  const perPasangan = new Map();
  const perAlamat = new Map();

  const bersih = (peta) => {
    const sekarang = Date.now();
    for (const [k, v] of peta) if (v.sampai < sekarang) peta.delete(k);
  };
  setInterval(() => { bersih(perPasangan); bersih(perAlamat); }, jedaMs).unref();

  const sisaMenit = (catatan, maks) => {
    if (!catatan || catatan.gagal < maks) return 0;
    if (Date.now() > catatan.sampai) return 0;
    return Math.ceil((catatan.sampai - Date.now()) / 60000);
  };

  return {
    /** @returns {number} sisa menit penguncian; 0 bila tidak terkunci */
    terkunci(akun, alamat) {
      return Math.max(
        sisaMenit(perPasangan.get(`${akun}|${alamat}`), maksPerAkun),
        sisaMenit(perAlamat.get(alamat), maksPerAlamat)
      );
    },

    catatGagal(akun, alamat) {
      for (const [peta, kunci] of [[perPasangan, `${akun}|${alamat}`], [perAlamat, alamat]]) {
        const catatan = peta.get(kunci);
        const masihBerlaku = catatan && Date.now() < catatan.sampai;
        const gagal = masihBerlaku ? catatan.gagal + 1 : 1;
        peta.set(kunci, { gagal, sampai: Date.now() + jedaMs });
      }
    },

    hapus(akun, alamat) {
      perPasangan.delete(`${akun}|${alamat}`);
    }
  };
}
