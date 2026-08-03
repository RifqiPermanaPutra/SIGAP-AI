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
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'crypto';
import { wajibSiap } from '../database/init.js';

const SCRYPT_N = 16384;
const PANJANG_KUNCI = 64;
const UMUR_SESI_JAM = 12;

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

/** Terbitkan token sesi untuk satu pengguna */
export function buatToken(pengguna) {
  const isi = b64(JSON.stringify({
    akun: pengguna.nama_akun,
    peran: pengguna.peran,
    exp: Date.now() + UMUR_SESI_JAM * 60 * 60 * 1000
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

export function pasangKuki(res, token) {
  const bagian = [
    `${NAMA_KUKI}=${token}`,
    'HttpOnly',                                   // tidak terbaca JavaScript
    'Path=/',
    'SameSite=Lax',                               // menahan pengiriman lintas situs
    `Max-Age=${UMUR_SESI_JAM * 60 * 60}`
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
 * @param {...string} peranDiizinkan
 */
export function wajibMasuk(...peranDiizinkan) {
  return (req, res, next) => {
    const data = bacaToken(bacaKuki(req));
    if (!data) {
      return res.status(401).json({ success: false, error: 'Silakan masuk terlebih dahulu' });
    }
    if (peranDiizinkan.length > 0 && !peranDiizinkan.includes(data.peran)) {
      return res.status(403).json({ success: false, error: 'Akun Anda tidak memiliki wewenang untuk tindakan ini' });
    }
    req.pengguna = data;
    next();
  };
}

/* ────────────────────────────────────────────────────────────────
   Akun
   ──────────────────────────────────────────────────────────────── */

export function cariPengguna(namaAkun) {
  return wajibSiap().prepare('SELECT * FROM pengguna WHERE nama_akun = ?').get(namaAkun);
}

export function daftarPengguna() {
  return wajibSiap()
    .prepare('SELECT id, nama_akun, nama, peran, dibuat_pada, masuk_terakhir FROM pengguna ORDER BY id')
    .all();
}

/**
 * Buat akun baru.
 * @param {{namaAkun: string, nama: string, peran: 'admin'|'engineer', sandi: string}} data
 */
export function buatPengguna({ namaAkun, nama, peran, sandi }) {
  if (!['admin', 'engineer'].includes(peran)) {
    throw new Error(`Peran tidak dikenal: ${peran}. Pilihan: admin, engineer`);
  }
  if (String(sandi || '').length < 8) {
    throw new Error('Kata sandi minimal 8 karakter');
  }
  wajibSiap().prepare(`
    INSERT INTO pengguna (nama_akun, nama, peran, sandi_hash, dibuat_pada)
    VALUES (?, ?, ?, ?, ?)
  `).run(namaAkun, nama, peran, hashSandi(sandi), new Date().toISOString());
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
 * Siapkan akun admin pertama bila basis data masih kosong.
 *
 * Kata sandinya diacak dan ditampilkan sekali di konsol, bukan ditanam di
 * dalam kode. Kata sandi bawaan yang tertulis di repositori adalah pintu
 * masuk yang tidak pernah ditutup siapa pun.
 */
export async function siapkanAkunAwal() {
  const { jumlah } = wajibSiap().prepare('SELECT COUNT(*) AS jumlah FROM pengguna').get();
  if (jumlah > 0) return null;

  const sandi = randomBytes(9).toString('base64url'); // 12 karakter
  buatPengguna({ namaAkun: 'admin', nama: 'Administrator', peran: 'admin', sandi });

  console.log('\n┌─────────────────────────────────────────────────────────┐');
  console.log('│  AKUN ADMIN PERTAMA DIBUAT                              │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log(`│  Nama akun  : admin`.padEnd(58) + '│');
  console.log(`│  Kata sandi : ${sandi}`.padEnd(58) + '│');
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
