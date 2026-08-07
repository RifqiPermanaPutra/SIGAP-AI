/**
 * Autentikasi halaman rekap.
 *
 * Halaman rekap memuat nama pegawai asli, sehingga autentikasi di sini bukan
 * pelengkap melainkan prasyarat (RANCANGAN-DATA.md §10).
 *
 * Seluruhnya memakai modul bawaan Node — `node:crypto` — tanpa dependensi
 * tambahan:
 *   - kata sandi di-hash dengan **scrypt**, bukan sekadar SHA. scrypt sengaja
 *     dibuat lambat dan boros memori sehingga penebakan massal tidak praktis.
 *   - sesi berupa **token bertanda tangan HMAC**, bukan penyimpanan sesi di
 *     memori server. Dengan begitu sesi tidak hilang saat server dijalankan
 *     ulang, dan tidak ada state yang perlu dibersihkan.
 */
import { randomBytes, randomInt, scryptSync, timingSafeEqual, createHmac } from 'crypto';
import { wajibSiap } from '../database/init.js';

const SCRYPT_N = 16384;
const PANJANG_KUNCI = 64;
const UMUR_SESI_JAM = 12;

/**
 * Umur sesi bagi yang mencentang "ingat saya".
 *
 * Dua belas jam masuk akal untuk admin yang membuka rekap dari komputer kantor.
 * Bagi engineer yang menandai tiket selesai dari ponsel di lapangan, itu berarti
 * memasukkan kata sandi hampir setiap kali — dan pekerjaan yang menuntut masuk
 * ulang setiap kali tidak akan dikerjakan. Bukti bahwa hambatan sekecil itu
 * sudah cukup: tombol "Tandai Selesai" ada sejak awal dan belum pernah ditekan.
 */
const UMUR_SESI_PANJANG_JAM = 30 * 24;

/* ────────────────────────────────────────────────────────────────
   Kata sandi
   ──────────────────────────────────────────────────────────────── */

/** Hash kata sandi: `scrypt$<garam heks>$<kunci heks>` */
export function hashSandi(sandi) {
  const garam = randomBytes(16);
  const kunci = scryptSync(sandi, garam, PANJANG_KUNCI, { N: SCRYPT_N });
  return `scrypt$${garam.toString('hex')}$${kunci.toString('hex')}`;
}

/**
 * Cocokkan kata sandi dengan hash tersimpan.
 * Perbandingan memakai `timingSafeEqual` agar lama pemeriksaan tidak
 * membocorkan seberapa banyak karakter yang sudah benar.
 */
export function periksaSandi(sandi, tersimpan) {
  try {
    const [algoritma, garamHex, kunciHex] = String(tersimpan).split('$');
    if (algoritma !== 'scrypt' || !garamHex || !kunciHex) return false;

    const diharapkan = Buffer.from(kunciHex, 'hex');
    const diperoleh = scryptSync(sandi, Buffer.from(garamHex, 'hex'), diharapkan.length, { N: SCRYPT_N });
    return timingSafeEqual(diharapkan, diperoleh);
  } catch {
    return false;
  }
}

/* ────────────────────────────────────────────────────────────────
   Token sesi
   ──────────────────────────────────────────────────────────────── */

let RAHASIA = process.env.SESSION_SECRET || '';
if (!RAHASIA) {
  // Tanpa rahasia tetap, token tidak dapat diverifikasi lagi setelah server
  // dijalankan ulang — semua pengguna harus masuk kembali. Dapat diterima,
  // tetapi harus terlihat agar tidak diam-diam terjadi di lingkungan nyata.
  RAHASIA = randomBytes(32).toString('hex');
  console.warn('⚠️  SESSION_SECRET belum diisi di .env — memakai rahasia acak.');
  console.warn('   Akibatnya semua sesi terputus setiap server dijalankan ulang.');
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');

function tandaTangan(data) {
  return createHmac('sha256', RAHASIA).update(data).digest('base64url');
}

/**
 * Terbitkan token sesi untuk satu pengguna.
 * @param {object} pengguna
 * @param {boolean} [ingatSaya] Pakai umur sesi panjang
 */
export function buatToken(pengguna, ingatSaya = false) {
  const jam = ingatSaya ? UMUR_SESI_PANJANG_JAM : UMUR_SESI_JAM;
  const isi = b64(JSON.stringify({
    akun: pengguna.nama_akun,
    peran: pengguna.peran,
    exp: Date.now() + jam * 60 * 60 * 1000
  }));
  return `${isi}.${tandaTangan(isi)}`;
}

/**
 * Baca dan verifikasi token.
 * @returns {{akun: string, peran: string, exp: number}|null}
 */
export function bacaToken(token) {
  if (!token || typeof token !== 'string') return null;

  const [isi, tanda] = token.split('.');
  if (!isi || !tanda) return null;

  const diharapkan = tandaTangan(isi);
  if (tanda.length !== diharapkan.length) return null;
  if (!timingSafeEqual(Buffer.from(tanda), Buffer.from(diharapkan))) return null;

  try {
    const data = JSON.parse(Buffer.from(isi, 'base64url').toString('utf8'));
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

/* ────────────────────────────────────────────────────────────────
   Kuki
   ──────────────────────────────────────────────────────────────── */

const NAMA_KUKI = 'sigap_sesi';

export function pasangKuki(res, token, ingatSaya = false) {
  // Umur kuki disamakan dengan umur token. Bila kukinya lebih pendek, pengguna
  // terlempar keluar meski tokennya masih sah; bila lebih panjang, ia mengirim
  // token kedaluwarsa lalu ditolak tanpa penjelasan.
  const jam = ingatSaya ? UMUR_SESI_PANJANG_JAM : UMUR_SESI_JAM;
  const bagian = [
    `${NAMA_KUKI}=${token}`,
    'HttpOnly',                                   // tidak terbaca JavaScript
    'Path=/',
    'SameSite=Lax',                               // menahan pengiriman lintas situs
    `Max-Age=${jam * 60 * 60}`
  ];
  if (process.env.COOKIE_SECURE === '1') bagian.push('Secure');
  res.setHeader('Set-Cookie', bagian.join('; '));
}

export function hapusKuki(res) {
  res.setHeader('Set-Cookie', `${NAMA_KUKI}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

function bacaKuki(req) {
  const mentah = req.headers.cookie;
  if (!mentah) return null;
  for (const potongan of mentah.split(';')) {
    const [nama, ...sisa] = potongan.trim().split('=');
    if (nama === NAMA_KUKI) return sisa.join('=');
  }
  return null;
}

/* ────────────────────────────────────────────────────────────────
   Penjaga rute
   ──────────────────────────────────────────────────────────────── */

/**
 * Middleware penjaga. Tanpa argumen, cukup sudah masuk; dengan argumen,
 * peran pengguna harus termasuk daftar yang diizinkan.
 *
 * Token yang sah TIDAK cukup. Akunnya diperiksa ulang ke basis data pada
 * setiap permintaan, dan peran yang dipakai adalah peran di basis data —
 * bukan peran yang tertulis di dalam token.
 *
 * Alasannya: token ini bertanda tangan HMAC dan tidak disimpan di server,
 * sehingga tidak ada daftar yang dapat dicabut. Tanpa pemeriksaan ulang,
 * akun yang sudah DIHAPUS atau yang perannya sudah DITURUNKAN tetap dapat
 * dipakai sampai tokennya kedaluwarsa dengan sendirinya. Sejak ada pilihan
 * "ingat saya", kedaluwarsa itu 30 hari — jauh terlalu lama untuk sebuah
 * akun yang sudah sengaja dicabut.
 *
 * Biayanya satu pencarian berindeks unik per permintaan, pada sistem yang
 * melayani beberapa puluh laporan sebulan.
 *
 * @param {...string} peranDiizinkan
 */
export function wajibMasuk(...peranDiizinkan) {
  return (req, res, next) => {
    const data = bacaToken(bacaKuki(req));
    if (!data) {
      return res.status(401).json({ success: false, error: 'Silakan masuk terlebih dahulu' });
    }

    const akun = cariPengguna(data.akun);
    if (!akun) {
      // Akun dihapus setelah tokennya terbit
      hapusKuki(res);
      return res.status(401).json({ success: false, error: 'Akun Anda sudah tidak berlaku. Silakan masuk kembali.' });
    }

    if (peranDiizinkan.length > 0 && !peranDiizinkan.includes(akun.peran)) {
      return res.status(403).json({ success: false, error: 'Akun Anda tidak memiliki wewenang untuk tindakan ini' });
    }

    req.pengguna = {
      akun: akun.nama_akun,
      nama: akun.nama,
      peran: akun.peran,
      divisi: divisiAkun(akun)
    };
    next();
  };
}

/* ────────────────────────────────────────────────────────────────
   Wewenang per divisi
   ──────────────────────────────────────────────────────────────── */

/**
 * Divisi yang boleh ditangani sebuah akun.
 *
 * @returns {string[]|null} daftar id divisi, atau `null` bila seluruh divisi
 */
/** Penanda "seluruh layanan", ditetapkan dengan sengaja — bukan karena kosong */
export const SELURUH_DIVISI = '*';

export function divisiAkun(akun) {
  // Admin menutup tiket saat engineer berhalangan, jadi ia tidak dibatasi.
  if (!akun || akun.peran === 'admin') return null;

  const mentah = String(akun.divisi || '').trim();

  // Tanpa batas HANYA bila ditetapkan begitu secara eksplisit.
  if (mentah === SELURUH_DIVISI) return null;

  // Kosong berarti BELUM DIBERI layanan apa pun — dan itu berarti tidak boleh
  // apa-apa, bukan boleh segalanya.
  //
  // Sebelumnya baris ini berbunyi `daftar.length > 0 ? daftar : null`, sehingga
  // kolom yang kosong dibaca sebagai "tanpa batas". Akibatnya setiap akun
  // engineer yang baru dibuat lahir berwenang atas kedelapan layanan, dan tetap
  // begitu sampai ada yang INGAT menjalankan `npm run akun -- divisi`.
  // Pengaman yang harus diingat untuk dinyalakan adalah pengaman yang akan
  // terlupa — dan kelalaian itu tidak menghasilkan pesan galat apa pun,
  // melainkan wewenang berlebih yang diam.
  return mentah
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

// Pemeriksaan "apakah akun ini berwenang atas divisi tersebut" TIDAK berada di
// sini, melainkan di dalam `tandaiDitangani` pada rekapService.js. Ada dua jalan
// menuju penandaan selesai — halaman tugas dan halaman rekap — sehingga
// meletakkannya di lapisan rute berarti menyediakan dua tempat untuk lupa.

/* ────────────────────────────────────────────────────────────────
   Akun
   ──────────────────────────────────────────────────────────────── */

export function cariPengguna(namaAkun) {
  return wajibSiap().prepare('SELECT * FROM pengguna WHERE nama_akun = ?').get(namaAkun);
}

export function daftarPengguna() {
  return wajibSiap()
    .prepare('SELECT id, nama_akun, nama, peran, divisi, dibuat_pada, masuk_terakhir FROM pengguna ORDER BY id')
    .all();
}

/**
 * Tetapkan divisi yang boleh ditangani sebuah akun.
 * @param {string} namaAkun
 * @param {string[]} divisi Kosongkan untuk membuka seluruh divisi
 */
export function aturDivisi(namaAkun, divisi = []) {
  const daftar = Array.isArray(divisi) ? divisi : [divisi];

  // `SELURUH_DIVISI` disimpan apa adanya. Membiarkan "tanpa batas" diwakili
  // oleh kolom kosong berarti tidak dapat membedakan "sengaja dibuka" dari
  // "belum sempat diisi", dan satu-satunya tafsiran yang aman bagi yang kedua
  // adalah menutup — yang berarti tafsiran itu juga menutup yang pertama.
  const nilai = daftar.includes(SELURUH_DIVISI)
    ? SELURUH_DIVISI
    : daftar.map((d) => String(d).trim().toLowerCase()).filter(Boolean).join(',');

  const { changes } = wajibSiap()
    .prepare('UPDATE pengguna SET divisi = ? WHERE nama_akun = ?')
    .run(nilai || null, namaAkun);
  return changes > 0;
}

/**
 * Buat akun baru.
 * @param {{namaAkun: string, nama: string, peran: 'admin'|'engineer', sandi: string}} data
 */
export function buatPengguna({ namaAkun, nama, peran, sandi, divisi = [] }) {
  if (!['admin', 'engineer'].includes(peran)) {
    throw new Error(`Peran tidak dikenal: ${peran}. Pilihan: admin, engineer`);
  }
  if (String(sandi || '').length < 8) {
    throw new Error('Kata sandi minimal 8 karakter');
  }

  // Layanan disimpan saat akun dibuat, bukan sebagai langkah kedua yang
  // terpisah. Wewenang yang ditetapkan belakangan adalah wewenang yang sempat
  // terlalu luas di antaranya — dan "sempat" itu tidak berbatas waktu.
  const daftar = Array.isArray(divisi) ? divisi : [divisi];
  const nilaiDivisi = daftar.includes(SELURUH_DIVISI)
    ? SELURUH_DIVISI
    : daftar.map((d) => String(d).trim().toLowerCase()).filter(Boolean).join(',');

  wajibSiap().prepare(`
    INSERT INTO pengguna (nama_akun, nama, peran, sandi_hash, divisi, dibuat_pada)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(namaAkun, nama, peran, hashSandi(sandi), nilaiDivisi || null, new Date().toISOString());

  return cariPengguna(namaAkun);
}

export function gantiSandi(namaAkun, sandiBaru) {
  if (String(sandiBaru || '').length < 8) throw new Error('Kata sandi minimal 8 karakter');
  const { changes } = wajibSiap()
    .prepare('UPDATE pengguna SET sandi_hash = ? WHERE nama_akun = ?')
    .run(hashSandi(sandiBaru), namaAkun);
  return changes > 0;
}

export function hapusPengguna(namaAkun) {
  return wajibSiap().prepare('DELETE FROM pengguna WHERE nama_akun = ?').run(namaAkun).changes > 0;
}

export function catatMasuk(namaAkun) {
  wajibSiap()
    .prepare('UPDATE pengguna SET masuk_terakhir = ? WHERE nama_akun = ?')
    .run(new Date().toISOString(), namaAkun);
}

/**
 * Abjad kata sandi tanpa huruf dan angka yang mudah tertukar saat dibaca.
 *
 * Dibuang: huruf besar I dan O, huruf kecil l, serta angka 0 dan 1.
 * Alasannya nyata — kata sandi acak pertama pernah keluar sebagai
 * "nDdJYaalO6ef", dan tidak ada yang dapat memastikan huruf keempat dari
 * belakang itu L kecil atau I besar, maupun apakah setelahnya huruf O atau
 * angka nol. Kata sandi yang harus disalin dari layar konsol wajib dapat
 * dibaca tanpa menebak.
 */
const ABJAD_SANDI = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/**
 * Kata sandi acak yang dikelompokkan agar mudah disalin, contoh `Kmr7-Xp9v-Tqb4`.
 *
 * `randomInt` dipakai, bukan sisa bagi dari byte acak: pembagian sisa membuat
 * sebagian huruf muncul lebih sering daripada yang lain.
 */
function sandiAcakTerbaca(kelompok = 3, panjangKelompok = 4) {
  const bagian = [];
  for (let i = 0; i < kelompok; i++) {
    let potongan = '';
    for (let j = 0; j < panjangKelompok; j++) {
      potongan += ABJAD_SANDI[randomInt(ABJAD_SANDI.length)];
    }
    bagian.push(potongan);
  }
  return bagian.join('-');
}

/**
 * Siapkan akun admin pertama bila basis data masih kosong.
 *
 * Kata sandinya diacak dan ditampilkan sekali di konsol, bukan ditanam di
 * dalam kode. Kata sandi bawaan yang tertulis di repositori adalah pintu
 * masuk yang tidak pernah ditutup siapa pun.
 */
export async function siapkanAkunAwal() {
  const { jumlah } = wajibSiap().prepare('SELECT COUNT(*) AS jumlah FROM pengguna').get();
  if (jumlah > 0) return null;

  const sandi = sandiAcakTerbaca();
  buatPengguna({ namaAkun: 'admin', nama: 'Administrator', peran: 'admin', sandi });

  console.log('\n┌─────────────────────────────────────────────────────────┐');
  console.log('│  AKUN ADMIN PERTAMA DIBUAT                              │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│  Nama akun  : admin'.padEnd(58) + '│');
  console.log(`│  Kata sandi : ${sandi}`.padEnd(58) + '│');
  console.log('│'.padEnd(58) + '│');
  console.log('│  Tanda hubung ikut diketik. Tanpa huruf I, O, l dan     │');
  console.log('│  angka 0, 1 supaya tidak tertukar saat disalin.         │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│  Catat sekarang — tidak ditampilkan lagi.               │');
  console.log('│  Ganti lewat: npm run akun -- ganti admin <sandi-baru>   │');
  console.log('└─────────────────────────────────────────────────────────┘\n');

  return sandi;
}

/* ────────────────────────────────────────────────────────────────
   Jejak akses
   ──────────────────────────────────────────────────────────────── */

/** Catat tindakan pada data yang memuat identitas pegawai */
export function catatAkses(namaAkun, tindakan, keterangan = null) {
  wajibSiap().prepare(`
    INSERT INTO log_akses (nama_akun, tindakan, keterangan, dibuat_pada) VALUES (?, ?, ?, ?)
  `).run(namaAkun, tindakan, keterangan, new Date().toISOString());
}

export function daftarAkses(batas = 200) {
  return wajibSiap()
    .prepare('SELECT * FROM log_akses ORDER BY id DESC LIMIT ?')
    .all(batas);
}
