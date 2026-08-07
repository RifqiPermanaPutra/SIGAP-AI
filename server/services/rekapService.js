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

  // Nama lengkap penandanya sengaja TIDAK diambil lewat JOIN ke tabel pengguna.
  // Tabel `sesi` dan `pengguna` sama-sama punya kolom `nama` — yang pertama
  // nama pelapor, yang kedua nama engineer — sehingga menyambungkan keduanya
  // membuat `nama LIKE ?` pada penyaring pencarian menjadi ambigu, dan
  // penyaring itu dipakai bersama oleh enam fungsi lain di berkas ini.
  // Penerjemahan akun menjadi nama dikerjakan di lapisan rute, di mana daftar
  // akunnya berjumlah enam dan sudah ada di memori.
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
      -- Ditawari bantuan engineer, lalu pergi tanpa mengambilnya. Inilah
      -- kelompok yang paling tidak terlihat: sistem gagal menolong mereka DAN
      -- mereka tidak melapor ke siapa pun, sehingga kendalanya tidak muncul di
      -- mana pun kecuali angka ini.
      SUM(CASE WHEN eskalasi_ditawarkan_pada IS NOT NULL AND status != 'diteruskan'
          THEN 1 ELSE 0 END)                                           AS ditawari_pergi,
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
    ditawari_pergi: r.ditawari_pergi || 0,
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
 *
 * @param {string} nomorTiket
 * @param {string} namaAkun
 * @param {{catatan?: string|null, selesaiPada?: string|null,
 *          divisiDiizinkan?: string[]|null}} [opsi]
 *   `divisiDiizinkan` berisi daftar divisi yang boleh ditangani pemanggil;
 *   `null` berarti tanpa batas. Pemeriksaannya diletakkan DI SINI, bukan di
 *   rute, karena ada dua jalan menuju penandaan selesai — halaman tugas dan
 *   halaman rekap. Menaruhnya di salah satu rute berarti pembatasannya dapat
 *   dilewati hanya dengan berpindah halaman.
 */
export function tandaiDitangani(nomorTiket, namaAkun, opsi = {}) {
  const { catatan = null, selesaiPada = null, divisiDiizinkan = null } = opsi;

  const sesi = wajibSiap().prepare('SELECT * FROM sesi WHERE nomor_tiket = ?').get(nomorTiket);
  if (!sesi) return { ok: false, alasan: 'Tiket tidak ditemukan' };

  if (divisiDiizinkan && !divisiDiizinkan.includes(String(sesi.divisi_id || '').toLowerCase())) {
    return {
      ok: false,
      status: 403,
      alasan: `Akun Anda tidak menangani layanan ${namaDivisi(sesi.divisi_id)}`
    };
  }

  if (sesi.status !== 'diteruskan') {
    return { ok: false, alasan: 'Hanya tiket berstatus "diteruskan" yang dapat ditandai selesai' };
  }
  if (sesi.ditangani_pada) return { ok: false, alasan: 'Tiket ini sudah ditandai selesai sebelumnya' };

  // Waktu selesai boleh disebutkan sendiri oleh engineer.
  //
  // Yang diukur `waktu_tanggap` adalah lama penanganan, bukan lama keterlambatan
  // mengisi formulir. Engineer yang baru sempat menandai tiga hari kemudian
  // akan tercatat menanggapi dalam tiga hari — padahal kendalanya beres pada
  // jam yang sama ia datang. Angka yang berlebihan seperti itu membuat seluruh
  // laporan waktu tanggap tidak dipercaya, dan yang tidak dipercaya tidak
  // dipakai.
  let waktu = new Date();
  if (selesaiPada) {
    const diminta = new Date(selesaiPada);
    if (Number.isNaN(diminta.getTime())) {
      return { ok: false, alasan: 'Waktu selesai tidak dapat dibaca' };
    }
    // Toleransi satu menit untuk selisih jam antar perangkat
    if (diminta.getTime() > Date.now() + 60_000) {
      return { ok: false, alasan: 'Waktu selesai tidak boleh berada di masa depan' };
    }
    if (sesi.diteruskan_pada && diminta < new Date(sesi.diteruskan_pada)) {
      return { ok: false, alasan: 'Waktu selesai mendahului saat laporan diteruskan' };
    }
    waktu = diminta;
  }

  // `berakhir_pada` SENGAJA tidak disentuh. Untuk tiket berstatus 'diteruskan'
  // kolom itu berarti "jam laporan berpindah tangan ke engineer"
  // (RANCANGAN-DATA.md §8) — bukan jam kendalanya beres. Menimpanya akan
  // mencampur dua makna berbeda di dalam satu kolom, dan `rata_durasi`
  // yang membacanya berubah arti tanpa ada yang menyadarinya.
  wajibSiap().prepare(`
    UPDATE sesi SET ditangani_pada = ?, ditangani_oleh = ?, catatan = ? WHERE nomor_tiket = ?
  `).run(waktu.toISOString(), namaAkun, catatan, nomorTiket);

  return { ok: true, ditanganiPada: waktu.toISOString() };
}

/**
 * Tiket yang menunggu ditangani engineer — isi halaman `/tugas`.
 *
 * Hanya yang benar-benar berpindah tangan (`diteruskan`) dan belum ditandai
 * selesai. Terlama di atas: tiket yang paling lama menganggur adalah yang
 * paling perlu dilihat, bukan yang paling baru masuk.
 *
 * @param {string} [divisi] Saringan yang dipilih pengguna, satu layanan
 * @param {string[]|null} [divisiDiizinkan] Batas wewenang akun; null = seluruhnya.
 *   Berbeda dari `divisi` di atas: yang ini BUKAN saringan yang boleh
 *   dimatikan pengguna, melainkan batas yang selalu berlaku.
 */
export function daftarTugas(divisi = null, divisiDiizinkan = null) {
  // Akun engineer yang belum diberi layanan apa pun. Dijawab lebih dulu karena
  // `divisi_id IN ()` bukan SQL yang sah — dan karena jawabannya memang kosong.
  if (Array.isArray(divisiDiizinkan) && divisiDiizinkan.length === 0) return [];

  const syarat = [];
  const nilai = [];

  if (divisi) {
    syarat.push('divisi_id = ?');
    nilai.push(divisi);
  }

  if (divisiDiizinkan) {
    // Daftar disusun dari nilai tetap di dalam kode, tetapi tetap diikat
    // sebagai parameter — jumlah tanda tanyanya saja yang dirangkai.
    syarat.push(`divisi_id IN (${divisiDiizinkan.map(() => '?').join(', ')})`);
    nilai.push(...divisiDiizinkan);
  }

  const where = syarat.length > 0 ? `AND ${syarat.join(' AND ')}` : '';

  return wajibSiap().prepare(`
    SELECT nomor_tiket, tanggal_wib, dibuat_pada, diteruskan_pada, divisi_id,
           keluhan, nama, fungsi, lokasi, area, urgensi, masalah_cocok, solusi_terakhir
    FROM sesi
    WHERE status = 'diteruskan' AND ditangani_pada IS NULL ${where}
    ORDER BY diteruskan_pada ASC
  `).all(...nilai).map((r) => ({ ...r, divisi_nama: namaDivisi(r.divisi_id) }));
}

/**
 * Batalkan penandaan selesai sebuah tiket.
 *
 * Tanpa ini, satu penandaan yang keliru bersifat permanen: tiketnya hilang
 * dari daftar tugas, `waktu_tanggap` terlanjur terhitung, dan tidak ada jalan
 * kembali selain menyunting basis data langsung. Salah tekan pada layar ponsel
 * bukan kejadian langka, dan ini juga satu-satunya pemulihan bila ada yang
 * menandai tiket orang lain dengan sengaja.
 *
 * Catatan penanganan ikut dikosongkan — ketiganya satu kesatuan. Yang TIDAK
 * hilang adalah jejaknya: `log_akses` menyimpan siapa menandai dan siapa
 * membatalkan, beserta waktunya.
 *
 * Khusus admin. Membiarkan engineer membatalkan penandaan engineer lain
 * berarti membuka kembali celah yang hendak ditutup.
 */
export function batalkanPenandaan(nomorTiket) {
  const sesi = wajibSiap()
    .prepare('SELECT nomor_tiket, ditangani_pada FROM sesi WHERE nomor_tiket = ?')
    .get(nomorTiket);

  if (!sesi) return { ok: false, alasan: 'Tiket tidak ditemukan' };
  if (!sesi.ditangani_pada) {
    return { ok: false, alasan: 'Tiket ini memang belum pernah ditandai selesai' };
  }

  wajibSiap().prepare(`
    UPDATE sesi SET ditangani_pada = NULL, ditangani_oleh = NULL, catatan = NULL
    WHERE nomor_tiket = ?
  `).run(nomorTiket);

  return { ok: true, sebelumnya: sesi.ditangani_pada };
}

/**
 * Seberapa sering tiap solusi benar-benar menuntaskan kendala.
 *
 * Datanya sudah tersimpan sejak awal pada `solusi_terakhir`, tetapi tidak
 * pernah dihitung. Padahal inilah satu-satunya ukuran yang menjawab pertanyaan
 * yang paling menentukan mutu SOP: **apakah langkah yang kita tulis benar-benar
 * menolong orang?**
 *
 * Cara bacanya berupa corong. Pengguna yang sampai ke solusi ke-3 pasti sudah
 * melewati solusi ke-1 dan ke-2, sehingga:
 *
 *   ditawarkan(n) = banyaknya pengguna yang sampai melihat solusi ke-n
 *   tuntas(n)     = yang menyatakan berhasil TEPAT setelah solusi ke-n
 *
 * Solusi yang sering ditawarkan tetapi hampir tidak pernah menuntaskan adalah
 * langkah yang perlu ditulis ulang — dan tanpa angka ini, ia akan bertahan
 * bertahun-tahun tanpa ada yang mempertanyakannya.
 *
 * Hanya divisi mode `swalayan` yang dihitung; divisi mode engineer memang
 * tidak pernah menawarkan langkah apa pun.
 */
export function keefektifanSolusi(f = {}) {
  // Saringan STATUS sengaja diabaikan di sini, tidak seperti pada panel lain.
  //
  // Penyebut corong ini adalah "berapa orang sampai melihat solusi ke-n", dan
  // itu harus menghitung semua orang — yang tuntas maupun yang menyerah. Bila
  // saringan status ikut berlaku, memilih "status: selesai" membuat penyebutnya
  // hanya berisi yang tuntas, sehingga tiap solusi tampak menuntaskan 100%.
  // Angka yang menyesatkan pada laporan resmi lebih buruk daripada tidak ada
  // angka sama sekali.
  const { status, ...tanpaStatus } = f;
  const { where, nilai } = bangunSaringan(tanpaStatus);
  const sambung = where ? 'AND' : 'WHERE';
  const dasar = `FROM sesi ${where} ${sambung} mode_divisi = 'swalayan' AND solusi_terakhir IS NOT NULL`;

  const corong = wajibSiap().prepare(`
    SELECT
      solusi_terakhir AS nomor,
      COUNT(*) AS sampai,
      SUM(CASE WHEN status = 'selesai' THEN 1 ELSE 0 END) AS tuntas
    ${dasar}
    GROUP BY solusi_terakhir
    ORDER BY solusi_terakhir
  `).all(...nilai);

  // "Sampai ke solusi n" bersifat kumulatif ke atas: yang berhenti di solusi 3
  // ikut terhitung pernah melihat solusi 1 dan 2.
  const MAKS = 3;
  const perSolusi = [];
  for (let n = 1; n <= MAKS; n++) {
    const ditawarkan = corong
      .filter((c) => c.nomor >= n)
      .reduce((t, c) => t + c.sampai, 0);
    const tuntas = corong.find((c) => c.nomor === n)?.tuntas || 0;

    perSolusi.push({
      nomor: n,
      ditawarkan,
      tuntas,
      persen: ditawarkan > 0 ? Math.round((tuntas / ditawarkan) * 100) : null
    });
  }

  // Masalah yang langkahnya paling jarang menolong. Yang dicari bukan masalah
  // tersering, melainkan masalah yang SOP-nya paling sering gagal.
  const perMasalah = wajibSiap().prepare(`
    SELECT
      masalah_cocok AS masalah,
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'selesai' THEN 1 ELSE 0 END) AS tuntas
    ${dasar} AND masalah_cocok IS NOT NULL
    GROUP BY masalah_cocok
    HAVING total >= 3
    ORDER BY (CAST(tuntas AS REAL) / total) ASC, total DESC
    LIMIT 8
  `).all(...nilai).map((r) => ({
    ...r,
    persen: Math.round((r.tuntas / r.total) * 100)
  }));

  return { perSolusi, perMasalah };
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
