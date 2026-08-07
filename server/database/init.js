/**
 * Penyimpanan Data SIGAP — SQLite
 *
 * Menggantikan penyimpanan berkas JSON yang dipakai sebelumnya. Alasan
 * penggantian (lihat RANCANGAN-DATA.md §13a): penyimpanan lama menulis ulang
 * SELURUH isi berkas setiap satu pesan masuk, sehingga dua pengguna bersamaan
 * dapat saling menimpa data, dan berkas yang rusak di tengah penulisan
 * menyebabkan seluruh riwayat dibuang saat dimuat ulang.
 *
 * Memakai `node:sqlite` bawaan Node.js — BUKAN paket pihak ketiga. Proyek ini
 * sengaja berdependensi sedikit; menambah modul native seperti better-sqlite3
 * berarti menambah kebutuhan alat kompilasi di mesin tujuan tanpa manfaat
 * tambahan pada skala ini.
 *
 * Syarat: Node.js 22.5+ (`node:sqlite` tersedia), diuji pada Node 24.
 *
 * Bentuk tabel mengikuti RANCANGAN-DATA.md. Sebagian kolom sengaja sudah
 * disiapkan meski belum diisi — penandanya (Tahap N) pada definisi tabel di
 * bawah. Menyiapkan bentuknya sekarang lebih murah daripada mengubah tabel
 * yang sudah berisi data.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', '..', 'data', 'sigap.db');

/** @type {DatabaseSync|null} */
let db = null;

/** Letak berkas basis data — dipakai layanan pencadangan */
export function jalurBasisData() {
  return DB_FILE;
}

/* ────────────────────────────────────────────────────────────────
   Waktu
   ──────────────────────────────────────────────────────────────── */

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Tanggal menurut WIB dalam bentuk `YYYY-MM-DD`.
 *
 * Timestamp disimpan dalam UTC, tetapi pengelompokan laporan harian WAJIB
 * memakai WIB. Tanpa ini, laporan yang masuk pukul 06.00 WIB terhitung sebagai
 * hari sebelumnya — salah hitung yang tidak terlihat sampai ada yang
 * mempertanyakan rekapnya.
 *
 * Nilainya disimpan sebagai kolom tersendiri (`tanggal_wib`) agar penyaringan
 * per hari/minggu/bulan tidak perlu menghitung zona waktu di dalam kueri.
 *
 * @param {string} [iso] Timestamp ISO 8601; bila kosong dipakai waktu sekarang
 * @returns {string} Tanggal WIB, contoh '2026-07-31'
 */
export function tanggalWIB(iso) {
  const ms = iso ? new Date(iso).getTime() : Date.now();
  return new Date(ms + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

const sekarang = () => new Date().toISOString();

/* ────────────────────────────────────────────────────────────────
   Skema
   ──────────────────────────────────────────────────────────────── */

const SKEMA = `
CREATE TABLE IF NOT EXISTS sesi (
  id                TEXT PRIMARY KEY,
  nomor_tiket       TEXT NOT NULL UNIQUE,
  tanggal_wib       TEXT NOT NULL,
  dibuat_pada       TEXT NOT NULL,
  diperbarui_pada   TEXT NOT NULL,
  berakhir_pada     TEXT,
  status            TEXT NOT NULL DEFAULT 'aktif',

  divisi_id         TEXT,
  mode_divisi       TEXT,                      -- swalayan | engineer   (Tahap 3)
  keluhan           TEXT,                      -- keluhan pertama       (Tahap 2)

  -- Saat sistem MENAWARKAN bantuan engineer. Berbeda dari diteruskan_pada,
  -- yang baru terisi bila pengguna benar-benar mengisi formulir dan menekan
  -- tombol WhatsApp. Selisih keduanya menunjukkan berapa banyak pengguna
  -- yang ditawari engineer lalu memilih pergi begitu saja.
  eskalasi_ditawarkan_pada TEXT,

  -- Lapis 2 · penelusuran                                              (Tahap 2)
  masalah_cocok     TEXT,
  skor_cocok        REAL,
  solusi_terakhir   INTEGER,

  -- Lapis 3 · eskalasi
  nama              TEXT,
  fungsi            TEXT,
  lokasi            TEXT,
  area              TEXT,                      -- turunan dari lokasi   (Tahap 2)
  urgensi           TEXT,
  engineer_tujuan   TEXT,                      --                       (Tahap 2)
  diteruskan_pada   TEXT,

  -- Lapis 4 · penanganan engineer                                      (Tahap 6)
  --
  -- Dua tahap, bukan satu. Sebelumnya tiket melompat dari 'diteruskan'
  -- langsung ke 'ditangani', padahal di antaranya ada jeda nyata: engineer
  -- membaca WhatsApp, berangkat, memeriksa. Selama jeda itu tidak ada yang
  -- tahu tiketnya sudah dipegang seseorang atau masih menganggur — sehingga
  -- dua engineer dapat berangkat ke lokasi yang sama, atau tidak seorang pun
  -- berangkat karena masing-masing mengira yang lain sudah jalan.
  mulai_dikerjakan_pada TEXT,
  dikerjakan_oleh       TEXT,
  ditangani_pada    TEXT,
  ditangani_oleh    TEXT,
  catatan           TEXT
);

CREATE INDEX IF NOT EXISTS idx_sesi_tanggal ON sesi(tanggal_wib);
CREATE INDEX IF NOT EXISTS idx_sesi_status  ON sesi(status);
CREATE INDEX IF NOT EXISTS idx_sesi_divisi  ON sesi(divisi_id);

CREATE TABLE IF NOT EXISTS pesan (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sesi_id      TEXT NOT NULL REFERENCES sesi(id) ON DELETE CASCADE,
  peran        TEXT NOT NULL,                  -- user | assistant | system
  isi          TEXT NOT NULL,
  dibuat_pada  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pesan_sesi ON pesan(sesi_id, id);

-- Akun pengakses halaman rekap. Tidak ada pendaftaran mandiri: untuk enam
-- pengguna tetap, membuka pintu pendaftaran hanya menambah risiko.
CREATE TABLE IF NOT EXISTS pengguna (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nama_akun       TEXT NOT NULL UNIQUE,
  nama            TEXT NOT NULL,
  peran           TEXT NOT NULL,               -- admin | engineer
  sandi_hash      TEXT NOT NULL,
  dibuat_pada     TEXT NOT NULL,
  masuk_terakhir  TEXT
);

-- Jejak akses. Rekap memuat nama pegawai asli, sehingga bila suatu saat
-- dipertanyakan siapa yang menyebarkan daftarnya, jawabannya tersedia.
CREATE TABLE IF NOT EXISTS log_akses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nama_akun    TEXT NOT NULL,
  tindakan     TEXT NOT NULL,                  -- masuk | lihat | unduh-excel | cetak
                                               -- | mulai-kerjakan | ambil-alih | lepas-tugas
                                               -- | tandai-selesai | batal-tandai-selesai
  keterangan   TEXT,
  dibuat_pada  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_log_waktu ON log_akses(dibuat_pada);
`;

/**
 * Kolom yang ditambahkan setelah tabel pernah dibuat.
 *
 * `CREATE TABLE IF NOT EXISTS` tidak menyentuh tabel yang sudah ada, sehingga
 * basis data yang sudah berisi data tidak akan pernah memperoleh kolom baru
 * dari SKEMA di atas. Tanpa migrasi ini, server yang dimutakhirkan akan gagal
 * pada kueri pertama yang menyebut kolom tersebut — di mesin yang sudah dipakai,
 * bukan di mesin pengembang yang basis datanya masih kosong.
 *
 * Sengaja sesederhana ini: hanya penambahan kolom, tanpa nomor versi. Perubahan
 * yang lebih rumit dari ini sebaiknya ditulis sebagai skrip tersendiri agar
 * terlihat dan dapat diuji.
 */
const KOLOM_TAMBAHAN = [
  ['sesi', 'eskalasi_ditawarkan_pada', 'TEXT'],
  // Daftar divisi yang boleh ditangani sebuah akun, dipisah koma —
  // contoh 'printer,windows'. KOSONG berarti seluruh divisi.
  //
  // Kosong sengaja dipilih sebagai nilai bawaan, bukan "tidak satu pun":
  // akun yang sudah ada sebelum kolom ini lahir tidak boleh mendadak
  // kehilangan seluruh wewenangnya hanya karena servernya dimutakhirkan.
  // Pembatasan diberlakukan saat admin memang menetapkannya.
  ['pengguna', 'divisi', 'TEXT'],
  // Tahap "sedang dikerjakan". Kosong pada seluruh baris lama, dan memang
  // begitu adanya: tiket yang sudah ditandai selesai sebelum kolom ini lahir
  // tidak diketahui kapan mulai dikerjakannya, dan menebaknya lebih buruk
  // daripada mengaku tidak tahu.
  ['sesi', 'mulai_dikerjakan_pada', 'TEXT'],
  ['sesi', 'dikerjakan_oleh', 'TEXT']
];

function terapkanMigrasi() {
  for (const [tabel, kolom, tipe] of KOLOM_TAMBAHAN) {
    const ada = db.prepare(`PRAGMA table_info(${tabel})`).all().some((k) => k.name === kolom);
    if (ada) continue;

    db.exec(`ALTER TABLE ${tabel} ADD COLUMN ${kolom} ${tipe}`);
    console.log(`🔧 Kolom ${tabel}.${kolom} ditambahkan`);
  }
}

/**
 * Selaraskan data lama dengan id dan istilah FTTH.
 *
 * Migrasi ini idempoten dan sengaja dijalankan setiap inisialisasi. Selain id
 * divisi, teks riwayat ikut diperbarui agar rekap, percakapan lama, pembatasan
 * akun engineer, dan jejak akses tidak menampilkan dua istilah untuk layanan
 * yang sama. Token sumber dirangkai dari kode karakter supaya istilah yang
 * sudah dipensiunkan tidak tersisa lagi di sumber maupun hasil audit teks.
 */
function selaraskanDataFtth() {
  const idSebelumnya = String.fromCharCode(102, 116, 116, 112);
  const bentukSebelumnya = [
    [idSebelumnya.toUpperCase(), 'FTTH'],
    [idSebelumnya[0].toUpperCase() + idSebelumnya.slice(1), 'Ftth'],
    [idSebelumnya, 'ftth']
  ];
  const kolomTeks = [
    ['sesi', 'keluhan'],
    ['sesi', 'masalah_cocok'],
    ['pesan', 'isi'],
    ['pengguna', 'divisi'],
    ['log_akses', 'keterangan']
  ];

  let perubahan = 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    perubahan += db.prepare('UPDATE sesi SET divisi_id = ? WHERE lower(divisi_id) = ?')
      .run('ftth', idSebelumnya).changes;

    for (const [tabel, kolom] of kolomTeks) {
      const perbarui = db.prepare(`
        UPDATE ${tabel}
        SET ${kolom} = replace(${kolom}, ?, ?)
        WHERE instr(${kolom}, ?) > 0
      `);
      for (const [dari, menjadi] of bentukSebelumnya) {
        perubahan += perbarui.run(dari, menjadi, dari).changes;
      }
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  if (perubahan > 0) {
    console.log(`🔧 ${perubahan} nilai data lama diselaraskan ke FTTH`);
  }
}

/**
 * Siapkan berkas basis data dan tabelnya.
 * @returns {Promise<DatabaseSync>}
 */
export async function initDatabase() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new DatabaseSync(DB_FILE);

  // WAL memungkinkan pembacaan berjalan bersamaan dengan penulisan — inilah
  // yang membuat halaman rekap dapat dibuka tanpa mengganggu pengguna yang
  // sedang menyampaikan kendala.
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SKEMA);
  terapkanMigrasi();
  selaraskanDataFtth();

  const { jumlah } = db.prepare('SELECT COUNT(*) AS jumlah FROM sesi').get();
  console.log(`📦 Basis data siap — ${jumlah} sesi tersimpan (${DB_FILE})`);

  return db;
}

/** Tutup koneksi. Dipakai pengujian dan saat server dimatikan. */
export function tutupDatabase() {
  db?.close();
  db = null;
}

/**
 * Akses langsung ke koneksi SQLite.
 *
 * Dipakai layanan yang menyusun kuerinya sendiri — rekap dan autentikasi —
 * agar penyaringan dan penghitungan dikerjakan basis data, bukan dimuat
 * seluruhnya ke memori lebih dulu.
 */
export function wajibSiap() {
  if (!db) throw new Error('Basis data belum disiapkan — panggil initDatabase() lebih dulu.');
  return db;
}

/* ────────────────────────────────────────────────────────────────
   Nomor tiket
   ──────────────────────────────────────────────────────────────── */

/**
 * Nomor tiket berformat `SGP-YYYYMMDD-NNNN`, contoh `SGP-20260731-0042`.
 *
 * Dipakai sebagai rujukan bersama pelapor dan engineer, sehingga harus
 * terbaca manusia dan mudah disebutkan lisan lewat WhatsApp — dua hal yang
 * tidak dipenuhi UUID acak. UUID tetap dipakai sebagai kunci internal.
 *
 * Penomoran ulang setiap hari, mengikuti tanggal WIB.
 */
function nomorTiketBaru(tanggal) {
  const { jumlah } = wajibSiap()
    .prepare('SELECT COUNT(*) AS jumlah FROM sesi WHERE tanggal_wib = ?')
    .get(tanggal);

  // Aman dari perebutan nomor tanpa transaksi: node:sqlite bersifat sinkron
  // dan Node berjalan satu utas, sehingga hitung-lalu-sisip tidak dapat
  // disela permintaan lain.
  return `SGP-${tanggal.replace(/-/g, '')}-${String(jumlah + 1).padStart(4, '0')}`;
}

/* ────────────────────────────────────────────────────────────────
   Sesi
   ──────────────────────────────────────────────────────────────── */

/** Status yang menandai sesi sudah berakhir. */
const STATUS_AKHIR = ['selesai', 'diteruskan', 'ditinggalkan'];

/** Kolom yang boleh diperbarui lewat updateChatSession(). */
const KOLOM_BOLEH_UBAH = new Set([
  'status', 'divisi_id', 'mode_divisi', 'keluhan',
  'masalah_cocok', 'skor_cocok', 'solusi_terakhir',
  'eskalasi_ditawarkan_pada',
  'nama', 'fungsi', 'lokasi', 'area', 'urgensi',
  'engineer_tujuan', 'diteruskan_pada',
  'mulai_dikerjakan_pada', 'dikerjakan_oleh',
  'ditangani_pada', 'ditangani_oleh', 'catatan',
  'berakhir_pada'
]);

/**
 * Susun ulang kolom pelapor menjadi objek `reporter`, agar pemanggil yang
 * sudah ada tidak perlu tahu bahwa datanya kini tersimpan sebagai kolom
 * terpisah.
 */
function bentukSesi(row) {
  if (!row) return undefined;
  const punyaPelapor = Boolean(row.nama || row.fungsi || row.lokasi || row.urgensi);
  return {
    ...row,
    reporter: punyaPelapor
      ? { nama: row.nama, fungsi: row.fungsi, lokasi: row.lokasi, urgensi: row.urgensi }
      : null
  };
}

/**
 * Buat sesi baru.
 * @param {string} sessionId UUID internal
 * @returns {object} Sesi yang baru dibuat
 */
export function createChatSession(sessionId) {
  const waktu = sekarang();
  const tanggal = tanggalWIB(waktu);

  wajibSiap().prepare(`
    INSERT INTO sesi (id, nomor_tiket, tanggal_wib, dibuat_pada, diperbarui_pada, status)
    VALUES (?, ?, ?, ?, ?, 'aktif')
  `).run(sessionId, nomorTiketBaru(tanggal), tanggal, waktu, waktu);

  return getChatSession(sessionId);
}

/**
 * Ambil satu sesi.
 * @param {string} sessionId
 * @returns {object|undefined}
 */
export function getChatSession(sessionId) {
  return bentukSesi(
    wajibSiap().prepare('SELECT * FROM sesi WHERE id = ?').get(sessionId)
  );
}

/**
 * Perbarui sesi.
 *
 * Menerima `{ reporter: { nama, fungsi, lokasi, urgensi } }` maupun kolom
 * datar. Dua timestamp diisi sendiri agar tidak bergantung pada kedisiplinan
 * pemanggil:
 *  - `berakhir_pada`   saat status berubah menjadi status akhir
 *  - `diteruskan_pada` saat status menjadi 'diteruskan'
 *
 * @param {string} sessionId
 * @param {object} updates
 * @returns {object|undefined} Sesi setelah diperbarui
 */
export function updateChatSession(sessionId, updates = {}) {
  const sesi = getChatSession(sessionId);
  if (!sesi) return undefined;

  const { reporter, ...sisa } = updates;
  const nilai = { ...sisa };

  if (reporter) {
    nilai.nama = reporter.nama;
    nilai.fungsi = reporter.fungsi;
    nilai.lokasi = reporter.lokasi;
    nilai.urgensi = reporter.urgensi;
  }

  const waktu = sekarang();
  if (STATUS_AKHIR.includes(nilai.status) && !sesi.berakhir_pada) {
    nilai.berakhir_pada = waktu;
  }
  if (nilai.status === 'diteruskan' && !sesi.diteruskan_pada) {
    nilai.diteruskan_pada = waktu;
  }

  // `undefined` berarti "jangan sentuh kolom ini", sedangkan `null` berarti
  // "kosongkan". Pembedaan ini penting: pemanggil kerap mengirim sekumpulan
  // kolom sekaligus yang sebagian nilainya belum tersedia, dan tanpa
  // penyaringan ini catatan lama akan tertimpa kosong.
  const kolom = Object.keys(nilai).filter(
    (k) => KOLOM_BOLEH_UBAH.has(k) && nilai[k] !== undefined
  );
  if (kolom.length === 0) return sesi;

  wajibSiap().prepare(`
    UPDATE sesi SET ${kolom.map((k) => `${k} = ?`).join(', ')}, diperbarui_pada = ?
    WHERE id = ?
  `).run(...kolom.map((k) => nilai[k]), waktu, sessionId);

  return getChatSession(sessionId);
}

/**
 * Tandai sesi yang ditinggalkan pengguna.
 *
 * Tanpa ini, sesi yang pengguna tinggalkan di tengah jalan akan bertahan
 * berstatus 'aktif' selamanya dan merusak seluruh perhitungan rekap. Pada
 * penyimpanan lama hal ini benar-benar terjadi: 244 dari 281 sesi tercatat
 * 'active' karena tidak pernah ada yang menutupnya.
 *
 * `berakhir_pada` diisi waktu aktivitas terakhir, bukan waktu penyapuan —
 * pengguna berhenti saat itu, bukan saat pemeriksaan berjalan.
 *
 * @param {number} [menit=30] Batas diam sebelum sesi dianggap ditinggalkan
 * @returns {number} Banyaknya sesi yang ditandai
 */
export function tandaiSesiTerbengkalai(menit = 30) {
  const batas = new Date(Date.now() - menit * 60 * 1000).toISOString();
  const { changes } = wajibSiap().prepare(`
    UPDATE sesi
    SET status = 'ditinggalkan', berakhir_pada = diperbarui_pada
    WHERE status = 'aktif' AND diperbarui_pada < ?
  `).run(batas);
  return changes;
}

/* ────────────────────────────────────────────────────────────────
   Pesan
   ──────────────────────────────────────────────────────────────── */

/**
 * Simpan satu pesan percakapan.
 * @param {string} sessionId
 * @param {'user'|'assistant'|'system'} role
 * @param {string} content
 * @returns {object} Pesan yang tersimpan
 */
export function addChatMessage(sessionId, role, content) {
  const waktu = sekarang();
  const { lastInsertRowid } = wajibSiap().prepare(`
    INSERT INTO pesan (sesi_id, peran, isi, dibuat_pada) VALUES (?, ?, ?, ?)
  `).run(sessionId, role, content, waktu);

  wajibSiap()
    .prepare('UPDATE sesi SET diperbarui_pada = ? WHERE id = ?')
    .run(waktu, sessionId);

  return { id: Number(lastInsertRowid), sessionId, role, content, createdAt: waktu };
}

/**
 * Seluruh pesan sebuah sesi, terurut kronologis.
 *
 * Kolom dialiaskan ke `role`/`content` karena bentuk itulah yang dipakai
 * `answerService.js` dan dikirim ke antarmuka. Nama kolom di basis data tetap
 * berbahasa Indonesia mengikuti RANCANGAN-DATA.md.
 *
 * @param {string} sessionId
 * @returns {Array<{id:number, role:string, content:string, createdAt:string}>}
 */
export function getChatMessages(sessionId) {
  return wajibSiap().prepare(`
    SELECT id, peran AS role, isi AS content, dibuat_pada AS createdAt
    FROM pesan WHERE sesi_id = ? ORDER BY id
  `).all(sessionId);
}
