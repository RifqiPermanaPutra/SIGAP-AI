/**
 * Layanan Rekap — penyaringan dan peringkasan laporan.
 *
 * Seluruh penyaringan dan penghitungan dikerjakan SQLite, bukan dimuat ke
 * memori lebih dulu. Inilah alasan utama perpindahan dari berkas JSON: rekap
 * per periode pada penyimpanan lama berarti membaca seluruh riwayat setiap
 * kali halaman dibuka.
 *
 * Pengelompokan tanggal memakai kolom `tanggal_wib` yang sudah dihitung saat
 * sesi dibuat, sehingga tidak ada perhitungan zona waktu di dalam kueri —
 * lihat RANCANGAN-DATA.md §13b.
 */
import { wajibSiap } from '../database/init.js';
import { namaDivisi } from '../config/divisi.js';

/** Satuan pengelompokan yang diakui pada grafik */
export const SATUAN = {
  hari: "tanggal_wib",
  // %Y-%W: tahun + nomor minggu, pekan dimulai Senin
  minggu: "strftime('%Y-M%W', tanggal_wib)",
  bulan: "substr(tanggal_wib, 1, 7)"
};

const STATUS_SAH = ['aktif', 'selesai', 'diteruskan', 'ditinggalkan'];

/**
 * Susun klausa WHERE dari saringan yang dikirim antarmuka.
 *
 * Seluruh nilai dipasang sebagai parameter terikat, tidak pernah disisipkan
 * ke dalam teks kueri.
 */
function bangunSaringan(f = {}) {
  const syarat = [];
  const nilai = [];

  if (f.dari)    { syarat.push('tanggal_wib >= ?'); nilai.push(f.dari); }
  if (f.sampai)  { syarat.push('tanggal_wib <= ?'); nilai.push(f.sampai); }
  if (f.divisi)  { syarat.push('divisi_id = ?');    nilai.push(f.divisi); }
  if (f.area)    { syarat.push('area = ?');         nilai.push(f.area); }
  if (f.urgensi) { syarat.push('urgensi = ?');      nilai.push(f.urgensi); }
  if (f.fungsi)  { syarat.push('fungsi = ?');       nilai.push(f.fungsi); }

  if (f.status && STATUS_SAH.includes(f.status)) {
    syarat.push('status = ?');
    nilai.push(f.status);
  }

  if (f.cari) {
    syarat.push('(keluhan LIKE ? OR nama LIKE ? OR nomor_tiket LIKE ?)');
    const pola = `%${f.cari}%`;
    nilai.push(pola, pola, pola);
  }

  return {
    where: syarat.length ? `WHERE ${syarat.join(' AND ')}` : '',
    nilai
  };
}

/**
 * Kolom turunan yang dihitung basis data, bukan di JavaScript.
 *
 * Selisih waktu hanya dihitung bila urutannya masuk akal. Bila stempel waktu
 * akhir mendahului awalnya — jam server pernah dimundurkan, data diimpor
 * keliru — hasilnya dikosongkan, bukan ditampilkan sebagai angka negatif.
 * Kolom bertanda "—" jujur mengaku tidak tahu; durasi "-3j 43m" pada laporan
 * resmi terbaca sebagai kesalahan sistem.
 */
const KOLOM_TURUNAN = `
  CASE WHEN berakhir_pada >= dibuat_pada
       THEN CAST((julianday(berakhir_pada) - julianday(dibuat_pada)) * 86400 AS INTEGER)
  END AS durasi_detik,
  CASE WHEN ditangani_pada >= diteruskan_pada
       THEN CAST((julianday(ditangani_pada) - julianday(diteruskan_pada)) * 86400 AS INTEGER)
  END AS waktu_tanggap
`;

/**
 * Daftar laporan sesuai saringan.
 * @param {object} f Saringan
 * @param {number} [batas] Batas jumlah baris; 0 berarti tanpa batas (dipakai ekspor)
 */
export function cariLaporan(f = {}, batas = 500) {
  const { where, nilai } = bangunSaringan(f);
  const limit = batas > 0 ? 'LIMIT ?' : '';
  const params = batas > 0 ? [...nilai, batas] : nilai;

  return wajibSiap().prepare(`
    SELECT *, ${KOLOM_TURUNAN}
    FROM sesi ${where}
    ORDER BY dibuat_pada DESC
    ${limit}
  `).all(...params).map((r) => ({ ...r, divisi_nama: namaDivisi(r.divisi_id) }));
}

/** Jumlah baris yang cocok dengan saringan */
export function jumlahLaporan(f = {}) {
  const { where, nilai } = bangunSaringan(f);
  return wajibSiap()
    .prepare(`SELECT COUNT(*) AS jumlah FROM sesi ${where}`)
    .get(...nilai).jumlah;
}

/**
 * Angka ringkasan periode.
 *
 * `persen_mandiri` dihitung terhadap laporan yang sudah berakhir saja —
 * sesi yang masih aktif atau ditinggalkan bukan kegagalan sistem, dan
 * memasukkannya akan menekan angka keberhasilan secara keliru.
 */
export function ringkasan(f = {}) {
  const { where, nilai } = bangunSaringan(f);

  const r = wajibSiap().prepare(`
    SELECT
      COUNT(*)                                                        AS total,
      SUM(CASE WHEN status = 'selesai'      THEN 1 ELSE 0 END)         AS selesai,
      SUM(CASE WHEN status = 'diteruskan'   THEN 1 ELSE 0 END)         AS diteruskan,
      SUM(CASE WHEN status = 'ditinggalkan' THEN 1 ELSE 0 END)         AS ditinggalkan,
      SUM(CASE WHEN status = 'aktif'        THEN 1 ELSE 0 END)         AS aktif,
      SUM(CASE WHEN ditangani_pada IS NOT NULL THEN 1 ELSE 0 END)      AS ditangani,
      AVG(CASE WHEN berakhir_pada >= dibuat_pada
          THEN (julianday(berakhir_pada) - julianday(dibuat_pada)) * 86400 END)      AS rata_durasi,
      AVG(CASE WHEN ditangani_pada >= diteruskan_pada
          THEN (julianday(ditangani_pada) - julianday(diteruskan_pada)) * 86400 END) AS rata_tanggap
    FROM sesi ${where}
  `).get(...nilai);

  const tuntas = (r.selesai || 0) + (r.diteruskan || 0);

  return {
    total: r.total || 0,
    selesai: r.selesai || 0,
    diteruskan: r.diteruskan || 0,
    ditinggalkan: r.ditinggalkan || 0,
    aktif: r.aktif || 0,
    ditangani: r.ditangani || 0,
    persen_mandiri: tuntas > 0 ? Math.round(((r.selesai || 0) / tuntas) * 100) : 0,
    rata_durasi: Math.round(r.rata_durasi || 0),
    rata_tanggap: Math.round(r.rata_tanggap || 0)
  };
}

/**
 * Deret waktu untuk grafik.
 * @param {object} f Saringan
 * @param {'hari'|'minggu'|'bulan'} satuan
 */
export function deretWaktu(f = {}, satuan = 'hari') {
  const ekspresi = SATUAN[satuan] || SATUAN.hari;
  const { where, nilai } = bangunSaringan(f);

  return wajibSiap().prepare(`
    SELECT
      ${ekspresi} AS periode,
      COUNT(*)                                                    AS total,
      SUM(CASE WHEN status = 'selesai'      THEN 1 ELSE 0 END)     AS selesai,
      SUM(CASE WHEN status = 'diteruskan'   THEN 1 ELSE 0 END)     AS diteruskan,
      SUM(CASE WHEN status IN ('ditinggalkan','aktif') THEN 1 ELSE 0 END) AS ditinggalkan
    FROM sesi ${where}
    GROUP BY periode
    ORDER BY periode
  `).all(...nilai);
}

/** Sebaran menurut satu kolom — dipakai grafik divisi, area, urgensi, fungsi */
export function sebaran(f = {}, kolom) {
  const DIIZINKAN = ['divisi_id', 'area', 'urgensi', 'fungsi', 'status', 'engineer_tujuan'];
  if (!DIIZINKAN.includes(kolom)) throw new Error(`Kolom sebaran tidak diizinkan: ${kolom}`);

  const { where, nilai } = bangunSaringan(f);

  return wajibSiap().prepare(`
    SELECT ${kolom} AS label, COUNT(*) AS jumlah
    FROM sesi ${where}
    ${where ? 'AND' : 'WHERE'} ${kolom} IS NOT NULL
    GROUP BY ${kolom}
    ORDER BY jumlah DESC
  `).all(...nilai).map((r) => ({
    ...r,
    label: kolom === 'divisi_id' ? namaDivisi(r.label) : r.label
  }));
}

/**
 * Keluhan yang belum dikenali sistem.
 *
 * Skor 0,2–0,4 berarti nyaris cocok — SOP-nya hanya kurang satu-dua kata
 * kunci. Inilah daftar perbaikan termurah untuk basis pengetahuan, dan alasan
 * `skor_cocok` disimpan meski tidak pernah diminta pembimbing.
 */
export function keluhanTakDikenali(f = {}, batas = 50) {
  const { where, nilai } = bangunSaringan(f);
  const sambung = where ? 'AND' : 'WHERE';

  return wajibSiap().prepare(`
    SELECT nomor_tiket, tanggal_wib, divisi_id, keluhan, skor_cocok, masalah_cocok
    FROM sesi ${where}
    ${sambung} keluhan IS NOT NULL AND (masalah_cocok IS NULL OR skor_cocok < 0.4)
    ORDER BY skor_cocok DESC, dibuat_pada DESC
    LIMIT ?
  `).all(...nilai, batas).map((r) => ({ ...r, divisi_nama: namaDivisi(r.divisi_id) }));
}

/** Nilai unik sebuah kolom — untuk mengisi pilihan saringan */
export function nilaiUnik(kolom) {
  const DIIZINKAN = ['area', 'urgensi', 'fungsi'];
  if (!DIIZINKAN.includes(kolom)) throw new Error(`Kolom tidak diizinkan: ${kolom}`);
  return wajibSiap()
    .prepare(`SELECT DISTINCT ${kolom} AS nilai FROM sesi WHERE ${kolom} IS NOT NULL ORDER BY ${kolom}`)
    .all().map((r) => r.nilai);
}

/**
 * Tandai sebuah tiket sudah ditangani engineer (Lapis 4).
 *
 * Bersifat opsional: bila engineer tidak pernah menandai, rekap tetap benar
 * dan hanya kolom waktu tanggap yang kosong. Sistem tidak boleh bergantung
 * pada kedisiplinan pengisian.
 */
export function tandaiDitangani(nomorTiket, namaAkun, catatan = null) {
  const sesi = wajibSiap().prepare('SELECT * FROM sesi WHERE nomor_tiket = ?').get(nomorTiket);
  if (!sesi) return { ok: false, alasan: 'Tiket tidak ditemukan' };
  if (sesi.status !== 'diteruskan') {
    return { ok: false, alasan: 'Hanya tiket berstatus "diteruskan" yang dapat ditandai selesai' };
  }
  if (sesi.ditangani_pada) return { ok: false, alasan: 'Tiket ini sudah ditandai selesai sebelumnya' };

  wajibSiap().prepare(`
    UPDATE sesi SET ditangani_pada = ?, ditangani_oleh = ?, catatan = ? WHERE nomor_tiket = ?
  `).run(new Date().toISOString(), namaAkun, catatan, nomorTiket);

  return { ok: true };
}

/**
 * Anonimkan laporan yang lebih tua dari batas retensi (RANCANGAN-DATA.md §11).
 *
 * Yang dihapus hanya nama pelapor, bukan barisnya: setelah dua tahun nama
 * seseorang tidak bernilai bagi siapa pun, sementara fungsi, lokasi, divisi,
 * dan durasinya masih berguna untuk membandingkan tren antar tahun.
 */
export function anonimkanLama(tahun = 2) {
  const batas = new Date(Date.now() - tahun * 365 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);

  const { changes } = wajibSiap().prepare(`
    UPDATE sesi SET nama = NULL WHERE tanggal_wib < ? AND nama IS NOT NULL
  `).run(batas);

  return changes;
}
