/**
 * Layanan Rekap — penyaringan dan peringkasan laporan.
 *
 * Seluruh penyaringan dan penghitungan dikerjakan SQLite, bukan dimuat ke
 * memori lebih dulu. Pengelompokan tanggal memakai kolom `tanggal_wib` yang
 * sudah dihitung saat sesi dibuat — lihat RANCANGAN-DATA.md §13b.
 */
import { wajibSiap } from '../database/init.js';
import { namaDivisi } from '../config/divisi.js';
// Hanya untuk menerjemahkan nama akun pemegang tiket menjadi nama orang di
// dalam pesan galat. Aman dari lingkar impor: authService tidak pernah memakai
// berkas ini — ia hanya mengenal crypto dan basis data.
import { cariPengguna } from './authService.js';

/** Satuan pengelompokan yang diakui pada grafik */
export const SATUAN = {
  hari: "tanggal_wib",
  // %Y-%W: tahun + nomor minggu, pekan dimulai Senin
  minggu: "strftime('%Y-M%W', tanggal_wib)",
  bulan: "substr(tanggal_wib, 1, 7)"
};

const STATUS_SAH = ['aktif', 'selesai', 'diteruskan', 'ditinggalkan'];

/**
 * Keadaan tampilan — apa yang dibaca manusia pada kolom "Status".
 *
 * DITURUNKAN, bukan disimpan: empat nilai `status` di basis data tetap utuh
 * (RANCANGAN-DATA.md §8), yang bertambah hanya cara membacanya.
 *
 *   diteruskan + belum disentuh        → belum-dikerjakan
 *   diteruskan + mulai_dikerjakan_pada → dikerjakan
 *   diteruskan + ditangani_pada        → selesai-engineer
 *   selainnya                          → nilai status apa adanya
 */
const KEADAAN_DITERUSKAN = {
  'belum-dikerjakan':
    "status = 'diteruskan' AND mulai_dikerjakan_pada IS NULL AND ditangani_pada IS NULL",
  dikerjakan:
    "status = 'diteruskan' AND mulai_dikerjakan_pada IS NOT NULL AND ditangani_pada IS NULL",
  'selesai-engineer':
    "status = 'diteruskan' AND ditangani_pada IS NOT NULL"
};

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

  // Saringan menerima kedua bentuk: nilai status mentah (dipakai API dan
  // pemanggil lama) maupun keadaan turunan yang tampil di layar. Tanpa yang
  // kedua, memilih "Sedang dikerjakan" pada saringan mustahil — padahal
  // kolomnya menampilkan tulisan itu, dan saringan yang tidak dapat memilih
  // apa yang tertulis di kolomnya sendiri adalah jebakan.
  if (f.status && STATUS_SAH.includes(f.status)) {
    syarat.push('status = ?');
    nilai.push(f.status);
  } else if (f.status && KEADAAN_DITERUSKAN[f.status]) {
    // Rangkaian tetap dari dalam kode, bukan dari masukan pengguna
    syarat.push(`(${KEADAAN_DITERUSKAN[f.status]})`);
  }

  if (f.cari) {
    syarat.push('(keluhan LIKE ? OR nama LIKE ? OR nomor_tiket LIKE ?)');
    const pola = `%${f.cari}%`;
    nilai.push(pola, pola, pola);
  }

  /* BATAS WEWENANG AKUN — bukan saringan yang dipilih pengguna.
   *
   * Berbeda dari `f.divisi` di atas dalam hal yang menentukan: `f.divisi`
   * datang dari query string dan boleh apa saja, sedangkan yang ini datang
   * dari sesi yang sudah diperiksa dan TIDAK PERNAH dari masukan pengguna.
   * Keduanya digabung dengan AND, jadi engineer yang menyaring layanan di
   * luar wewenangnya memperoleh nol baris — bukan baris milik orang lain.
   *
   * Dipasang di sini, di satu-satunya tempat seluruh kueri rekap membangun
   * klausa WHERE-nya, supaya ringkasan, grafik, sebaran, tabel, dan ekspor
   * Excel tidak mungkin terlewat satu pun.
   *
   * `null` berarti tanpa batas (admin, atau engineer bertanda `*`).
   */
  if (Array.isArray(f.divisiDiizinkan)) {
    if (f.divisiDiizinkan.length === 0) {
      // Belum diberi layanan apa pun berarti tidak boleh melihat apa pun.
      // Ditulis begini karena `divisi_id IN ()` bukan SQL yang sah — dan
      // karena jawabannya memang harus kosong, bukan seluruhnya.
      syarat.push('1 = 0');
    } else {
      syarat.push(`divisi_id IN (${f.divisiDiizinkan.map(() => '?').join(', ')})`);
      nilai.push(...f.divisiDiizinkan);
    }
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
  END AS waktu_tanggap,
  -- Sejak tiket melewati tahap "sedang dikerjakan", waktu_tanggap dapat
  -- dipecah menjadi dua hal yang selama ini tercampur di dalamnya: berapa lama
  -- engineer MERESPONS, dan berapa lama PENGERJAANNYA. Keduanya dinilai dengan
  -- cara yang sangat berbeda — yang pertama soal kesigapan, yang kedua soal
  -- sulitnya kendala — sehingga menggabungkannya membuat keduanya tak terbaca.
  CASE WHEN mulai_dikerjakan_pada >= diteruskan_pada
       THEN CAST((julianday(mulai_dikerjakan_pada) - julianday(diteruskan_pada)) * 86400 AS INTEGER)
  END AS waktu_respons,
  CASE WHEN ditangani_pada >= mulai_dikerjakan_pada
       THEN CAST((julianday(ditangani_pada) - julianday(mulai_dikerjakan_pada)) * 86400 AS INTEGER)
  END AS lama_kerja,
  -- Keadaan yang dibaca manusia. Diturunkan di sini, bukan disimpan, supaya
  -- tabel, berkas Excel, dan saringan mustahil berbeda pendapat.
  CASE
    WHEN status = 'diteruskan' AND ditangani_pada IS NOT NULL        THEN 'selesai-engineer'
    WHEN status = 'diteruskan' AND mulai_dikerjakan_pada IS NOT NULL THEN 'dikerjakan'
    WHEN status = 'diteruskan'                                       THEN 'belum-dikerjakan'
    ELSE status
  END AS keadaan
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
      -- Sudah dipegang engineer tetapi belum ditutup. Keadaan ini yang paling
      -- perlu diawasi: tiket yang tampak sedang ditangani padahal mungkin
      -- sudah terlupakan sejak minggu lalu — dan justru karena tampak sedang
      -- ditangani, tidak ada yang menanyakannya.
      SUM(CASE WHEN mulai_dikerjakan_pada IS NOT NULL AND ditangani_pada IS NULL
          THEN 1 ELSE 0 END)                                           AS sedang_dikerjakan,
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
    sedang_dikerjakan: r.sedang_dikerjakan || 0,
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

/** Nama orang di balik sebuah nama akun, dengan cadangan nama akunnya sendiri */
function namaOrang(namaAkun) {
  if (!namaAkun) return null;
  return cariPengguna(namaAkun)?.nama || namaAkun;
}

/**
 * Ambil satu tiket sekaligus periksa apakah pemanggil berwenang atasnya.
 *
 * Dipakai bersama oleh ketiga tindakan engineer — mulai, lepas, selesai —
 * supaya batas wewenangnya mustahil berbeda di antara ketiganya. Pemeriksaan
 * diletakkan di lapisan layanan, bukan di rute, karena ada dua halaman yang
 * menuju tindakan yang sama; menaruhnya di salah satu rute berarti
 * pembatasannya dapat dilewati hanya dengan berpindah halaman.
 *
 * @returns {{ok:true, sesi:object} | {ok:false, status:number, alasan:string}}
 */
function tiketDalamWewenang(nomorTiket, divisiDiizinkan) {
  const sesi = wajibSiap().prepare('SELECT * FROM sesi WHERE nomor_tiket = ?').get(nomorTiket);
  if (!sesi) return { ok: false, status: 404, alasan: 'Tiket tidak ditemukan' };

  if (divisiDiizinkan && !divisiDiizinkan.includes(String(sesi.divisi_id || '').toLowerCase())) {
    return {
      ok: false,
      status: 403,
      alasan: `Akun Anda tidak menangani layanan ${namaDivisi(sesi.divisi_id)}`
    };
  }

  return { ok: true, sesi };
}

/**
 * Engineer menyatakan tiket ini sedang ia kerjakan (Lapis 4, tahap pertama).
 *
 * Tanpa tahap ini tiket melompat dari 'diteruskan' langsung ke 'ditangani',
 * sehingga sepanjang engineer membaca WhatsApp, berangkat, dan memeriksa di
 * lokasi, tiketnya terlihat persis sama dengan tiket yang belum disentuh
 * siapa pun. Dua engineer dapat berangkat ke tempat yang sama, atau tidak
 * seorang pun berangkat karena masing-masing mengira yang lain sudah jalan.
 *
 * TIDAK mengubah `status`. Nilai status tetap empat sebagaimana
 * RANCANGAN-DATA.md §8 — menambah nilai kelima berarti `persen_mandiri`,
 * `deretWaktu`, dan seluruh saringan status ikut berubah arti diam-diam.
 * Keadaan "sedang dikerjakan" cukup diketahui dari terisinya kolom ini.
 *
 * @param {string} nomorTiket
 * @param {string} namaAkun
 * @param {{divisiDiizinkan?: string[]|null, ambilAlih?: boolean}} [opsi]
 */
export function mulaiMengerjakan(nomorTiket, namaAkun, opsi = {}) {
  const { divisiDiizinkan = null, ambilAlih = false } = opsi;

  const dapat = tiketDalamWewenang(nomorTiket, divisiDiizinkan);
  if (!dapat.ok) return dapat;
  const { sesi } = dapat;

  if (sesi.status !== 'diteruskan') {
    return { ok: false, alasan: 'Hanya tiket yang sudah diteruskan ke engineer yang dapat dikerjakan' };
  }
  if (sesi.ditangani_pada) {
    return { ok: false, alasan: 'Tiket ini sudah ditandai selesai' };
  }
  if (sesi.dikerjakan_oleh === namaAkun) {
    return { ok: false, alasan: 'Anda sudah menandai tiket ini sedang dikerjakan' };
  }

  // Sudah dipegang orang lain. Pengambilalihan diizinkan — engineer yang
  // dijadwalkan bisa berhalangan, dan tiket yang terkunci pada akun yang
  // sedang cuti lebih buruk daripada tiket yang berpindah tangan — tetapi
  // harus disengaja, bukan terjadi diam-diam karena dua orang menekan tombol
  // yang sama.
  if (sesi.dikerjakan_oleh && !ambilAlih) {
    return {
      ok: false,
      status: 409,
      alasan: `Tiket ini sedang dikerjakan oleh ${namaOrang(sesi.dikerjakan_oleh)}`,
      pemegang: sesi.dikerjakan_oleh,
      pemegangNama: namaOrang(sesi.dikerjakan_oleh)
    };
  }

  // Pada pengambilalihan, `mulai_dikerjakan_pada` SENGAJA dipertahankan.
  // Yang diukur kolom itu adalah berapa lama laporan menunggu sampai ada
  // engineer pertama yang bergerak; menyetelnya ulang membuat tiket yang
  // terlantar tiga jam lalu berpindah tangan tampak direspons seketika.
  const waktu = sesi.mulai_dikerjakan_pada || new Date().toISOString();

  wajibSiap().prepare(`
    UPDATE sesi SET mulai_dikerjakan_pada = ?, dikerjakan_oleh = ? WHERE nomor_tiket = ?
  `).run(waktu, namaAkun, nomorTiket);

  return {
    ok: true,
    mulaiPada: waktu,
    diambilAlihDari: sesi.dikerjakan_oleh || null,
    diambilAlihDariNama: namaOrang(sesi.dikerjakan_oleh)
  };
}

/**
 * Lepaskan tiket yang sedang dikerjakan, kembali ke antrean.
 *
 * Diperlukan karena kesediaan menandai bergantung pada adanya jalan mundur.
 * Engineer yang tahu satu ketukan keliru mengunci tiket atas namanya sampai
 * ada admin yang membetulkan, akan memilih tidak menandai sama sekali — dan
 * itu persis kebiasaan yang hendak diubah tahap ini.
 *
 * Hanya pemegangnya sendiri, atau admin (`paksa`).
 */
export function lepaskanTugas(nomorTiket, namaAkun, opsi = {}) {
  const { divisiDiizinkan = null, paksa = false } = opsi;

  const dapat = tiketDalamWewenang(nomorTiket, divisiDiizinkan);
  if (!dapat.ok) return dapat;
  const { sesi } = dapat;

  if (!sesi.dikerjakan_oleh) {
    return { ok: false, alasan: 'Tiket ini memang tidak sedang dikerjakan siapa pun' };
  }
  if (sesi.ditangani_pada) {
    return { ok: false, alasan: 'Tiket ini sudah ditandai selesai' };
  }
  if (sesi.dikerjakan_oleh !== namaAkun && !paksa) {
    return {
      ok: false,
      status: 403,
      alasan: `Tiket ini dipegang ${namaOrang(sesi.dikerjakan_oleh)}, bukan Anda`
    };
  }

  // Keduanya dikosongkan sekaligus. Menyisakan `mulai_dikerjakan_pada` berarti
  // tiket yang sudah dilepas tetap terhitung "sedang dikerjakan" pada ringkasan
  // selamanya, tanpa ada nama yang dapat ditanya.
  wajibSiap().prepare(`
    UPDATE sesi SET mulai_dikerjakan_pada = NULL, dikerjakan_oleh = NULL WHERE nomor_tiket = ?
  `).run(nomorTiket);

  return { ok: true, sebelumnya: sesi.dikerjakan_oleh };
}

/**
 * Tandai sebuah tiket sudah ditangani engineer (Lapis 4, tahap kedua).
 *
 * Bersifat opsional: bila engineer tidak pernah menandai, rekap tetap benar
 * dan hanya kolom waktu tanggap yang kosong. Sistem tidak boleh bergantung
 * pada kedisiplinan pengisian.
 *
 * Melewati tahap "sedang dikerjakan" TIDAK diwajibkan. Kendala yang beres
 * dalam dua menit tidak pantas menuntut dua ketukan; memaksakannya justru
 * membuat orang berhenti menandai sama sekali — penyakit yang baru saja
 * disembuhkan halaman ini.
 *
 * @param {string} nomorTiket
 * @param {string} namaAkun
 * @param {{catatan?: string|null, selesaiPada?: string|null,
 *          divisiDiizinkan?: string[]|null, abaikanPemegang?: boolean}} [opsi]
 *   `divisiDiizinkan` berisi daftar divisi yang boleh ditangani pemanggil;
 *   `null` berarti tanpa batas.
 */
export function tandaiDitangani(nomorTiket, namaAkun, opsi = {}) {
  const {
    catatan = null, selesaiPada = null,
    divisiDiizinkan = null, abaikanPemegang = false
  } = opsi;

  const dapat = tiketDalamWewenang(nomorTiket, divisiDiizinkan);
  if (!dapat.ok) {
    // Tiket yang tidak ada tetap dijawab 400 seperti sebelumnya: membedakan
    // "tidak ada" dari "bukan wewenang Anda" pada nomor yang mudah ditebak
    // sama saja dengan memberitahu nomor mana yang terpakai.
    return { ...dapat, status: dapat.status === 404 ? 400 : dapat.status };
  }
  const { sesi } = dapat;

  if (sesi.status !== 'diteruskan') {
    return { ok: false, alasan: 'Hanya tiket berstatus "diteruskan" yang dapat ditandai selesai' };
  }
  if (sesi.ditangani_pada) return { ok: false, alasan: 'Tiket ini sudah ditandai selesai sebelumnya' };

  // Menyelesaikan tiket yang sedang dipegang orang lain dihalangi, meski
  // layanannya memang wewenang pemanggil. Pembatasan per divisi saja tidak
  // cukup: dalam satu divisi masih ada beberapa engineer, dan yang berangkat
  // ke lokasi hanya satu. Menutup pekerjaan orang yang sedang di lapangan —
  // entah keliru tekan atau tidak — menghapus tiketnya dari daftar tugas orang
  // itu tanpa ia tahu. Pengambilalihan tetap mungkin, hanya harus disengaja.
  if (sesi.dikerjakan_oleh && sesi.dikerjakan_oleh !== namaAkun && !abaikanPemegang) {
    return {
      ok: false,
      status: 409,
      alasan: `Tiket ini sedang dikerjakan ${namaOrang(sesi.dikerjakan_oleh)}. Ambil alih dahulu bila Anda yang menyelesaikannya.`,
      pemegang: sesi.dikerjakan_oleh,
      pemegangNama: namaOrang(sesi.dikerjakan_oleh)
    };
  }

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
           keluhan, nama, fungsi, lokasi, area, urgensi, masalah_cocok, solusi_terakhir,
           mulai_dikerjakan_pada, dikerjakan_oleh
    FROM sesi
    WHERE status = 'diteruskan' AND ditangani_pada IS NULL ${where}
    -- Yang belum dipegang siapa pun didahulukan: tiket yang sudah ada
    -- engineernya bukan lagi pekerjaan yang menunggu diambil, dan menaruhnya
    -- bercampur di antara yang menganggur membuat antrean sebenarnya kabur.
    ORDER BY (dikerjakan_oleh IS NOT NULL) ASC, diteruskan_pada ASC
  `).all(...nilai).map((r) => ({
    ...r,
    divisi_nama: namaDivisi(r.divisi_id),
    dikerjakan_oleh_nama: namaOrang(r.dikerjakan_oleh)
  }));
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

/**
 * Buang isi yang tidak lagi berguna setelah masa retensi lewat.
 *
 * Melengkapi `anonimkanLama()`, yang hanya mengosongkan kolom `nama`. Dua hal
 * lain menumpuk tanpa pernah dibuang sama sekali, dan keduanya memuat teks
 * bebas yang tidak dapat dianonimkan sebagian:
 *
 *   `pesan`      isi percakapan lengkap. Pelapor kerap menyebut nama rekan,
 *                nomor ruangan, atau nama berkas di dalam kalimatnya. Setelah
 *                dua tahun, kalimat itu tidak lagi bernilai bagi siapa pun,
 *                sementara ringkasannya sudah tersimpan pada kolom `keluhan`,
 *                `masalah_cocok`, dan `solusi_terakhir` di baris sesinya.
 *
 *   `log_akses`  jejak siapa membuka dan mengunduh apa. Berguna justru ketika
 *                dipertanyakan — dan pertanyaan itu tidak datang dua tahun
 *                kemudian.
 *
 * BARIS SESI TIDAK PERNAH DIHAPUS. RANCANGAN-DATA.md §11 menetapkannya: fungsi,
 * lokasi, divisi, urgensi, dan durasinya masih dipakai membandingkan tren antar
 * tahun. Yang dibuang hanya isi yang sensitif.
 *
 * @returns {{pesan: number, akses: number}} banyaknya baris yang dibuang
 */
export function pangkasIsiLama(tahun = 2) {
  const batasTanggal = new Date(Date.now() - tahun * 365 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  const batasWaktu = `${batasTanggal}T00:00:00.000Z`;

  const pesan = wajibSiap().prepare(`
    DELETE FROM pesan
    WHERE sesi_id IN (SELECT id FROM sesi WHERE tanggal_wib < ?)
  `).run(batasTanggal).changes;

  const akses = wajibSiap()
    .prepare('DELETE FROM log_akses WHERE dibuat_pada < ?')
    .run(batasWaktu).changes;

  return { pesan, akses };
}

/**
 * Hapus sebuah laporan dari basis data. HANYA ADMIN — lihat rute /hapus.
 *
 * PENGHAPUSAN INI PERMANEN dan tidak dapat dibatalkan. Dipilih atas permintaan
 * pengguna agar laporan karangan benar-benar lenyap dari rekap, bukan sekadar
 * disembunyikan.
 *
 * Yang menjaganya tetap dapat dipertanggungjawabkan:
 *
 *   1. Barisnya DIBACA LEBIH DAHULU lalu dikembalikan kepada pemanggil, supaya
 *      rute dapat menuliskan nomor tiket, keluhan, dan alasannya ke `log_akses`.
 *      Setelah baris ini hilang, catatan itulah satu-satunya bukti yang
 *      tersisa — maka isinya harus cukup untuk meninjau ulang keputusannya.
 *
 *   2. Pesan dan sesinya dibuang dalam SATU transaksi. Bila salah satunya
 *      gagal, keduanya batal — tidak ada baris `pesan` yatim yang menunjuk
 *      sesi yang sudah tiada.
 *
 * @param {string} nomorTiket nomor tiket laporan
 * @returns {{nomor_tiket: string, keluhan: string|null, nama: string|null,           tanggal_wib: string, divisi_id: string|null, pesanTerhapus: number}|null}
 *          data laporan yang dihapus, atau `null` bila tiketnya tidak ada
 */
export function hapusLaporan(nomorTiket) {
  const db = wajibSiap();

  const baris = db.prepare(`
    SELECT id, nomor_tiket, tanggal_wib, divisi_id, nama, fungsi, lokasi, keluhan, status
      FROM sesi WHERE nomor_tiket = ?
  `).get(nomorTiket);

  // Tiket tak dikenal bukan galat, melainkan jawaban: tidak ada yang dihapus.
  if (!baris) return null;

  db.exec('BEGIN');
  try {
    // Dihapus tersurat meski ON DELETE CASCADE sudah aktif. Cascade bergantung
    // pada `PRAGMA foreign_keys = ON` yang disetel di tempat lain; menuliskannya
    // di sini membuat penghapusan tetap utuh bila pengaturan itu berubah.
    const pesanTerhapus = db.prepare('DELETE FROM pesan WHERE sesi_id = ?').run(baris.id).changes;
    db.prepare('DELETE FROM sesi WHERE id = ?').run(baris.id);
    db.exec('COMMIT');
    return { ...baris, pesanTerhapus };
  } catch (galat) {
    db.exec('ROLLBACK');
    throw galat;
  }
}
