/**
 * Pemeliharaan berkala: pencadangan, retensi data, penyapuan sesi, dan
 * pembersihan log.
 *
 * Dikumpulkan di satu berkas supaya jelas apa saja yang berjalan sendiri di
 * latar belakang. Sebelumnya penyapuan sesi tersebar di server.js sementara
 * kebijakan retensi hanya berupa fungsi yang tidak pernah dipanggil siapa pun.
 */
import fs from 'fs';
import path from 'path';
import { jalurBasisData, wajibSiap, tandaiSesiTerbengkalai } from '../database/init.js';
import { anonimkanLama, pangkasIsiLama } from './rekapService.js';
import { info, peringatan, galat, bersihkanLogLama } from './logUtil.js';

const HARI_CADANGAN = Number(process.env.HARI_SIMPAN_CADANGAN || 14);
const TAHUN_RETENSI = Number(process.env.TAHUN_RETENSI || 2);
const MENIT_TERBENGKALAI = Number(process.env.MENIT_SESI_TERBENGKALAI || 30);

/**
 * Tujuan cadangan di LUAR mesin — folder jaringan, OneDrive, atau flashdisk.
 *
 * Cadangan yang berada satu disk dengan basis datanya hanya melindungi dari
 * salah hapus dan berkas rusak. Ia TIDAK melindungi dari disk yang mati:
 * basis data dan seluruh cadangannya hilang bersamaan. Karena itu salinan
 * kedua di tempat terpisah bukan kemewahan, melainkan syarat.
 */
const CADANGAN_LUAR = (process.env.CADANGAN_LUAR || '').trim();

/** Batas hari sebelum cadangan luar yang gagal dianggap perlu diperingatkan */
const HARI_PERINGATAN_LUAR = Number(process.env.HARI_PERINGATAN_CADANGAN_LUAR || 3);

/** Waktu terakhir salinan ke luar mesin berhasil; null bila belum pernah */
let terakhirBerhasilKeLuar = null;

const WIB_MS = 7 * 60 * 60 * 1000;
const tanggalWIB = (ms = Date.now()) => new Date(ms + WIB_MS).toISOString().slice(0, 10);

function folderCadangan() {
  return path.join(path.dirname(jalurBasisData()), 'cadangan');
}

/* ────────────────────────────────────────────────────────────────
   Pencadangan
   ──────────────────────────────────────────────────────────────── */

/**
 * Salin basis data ke berkas cadangan bertanggal.
 *
 * Memakai `VACUUM INTO`, bukan menyalin berkasnya begitu saja. Menyalin
 * berkas SQLite yang sedang dipakai menghasilkan salinan rusak: sebagian
 * perubahan masih berada di berkas WAL yang terpisah. `VACUUM INTO` menuliskan
 * potret yang utuh dan konsisten tanpa menghentikan layanan.
 *
 * @returns {string|null} Jalur berkas cadangan, atau null bila gagal
 */
export function cadangkanBasisData() {
  try {
    const dir = folderCadangan();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const tujuan = path.join(dir, `sigap-${tanggalWIB()}.db`);

    // Cadangan hari yang sama ditimpa, bukan ditumpuk — satu potret per hari
    // sudah memadai, dan menumpuknya hanya menghabiskan ruang.
    if (fs.existsSync(tujuan)) fs.unlinkSync(tujuan);

    // Jalur disisipkan sebagai literal SQL: `VACUUM INTO` tidak menerima
    // parameter terikat. Nilainya berasal dari konfigurasi server, bukan dari
    // masukan pengguna, dan tanda kutip tunggal tetap digandakan.
    wajibSiap().exec(`VACUUM INTO '${tujuan.replace(/'/g, "''")}'`);

    const ukuranKb = Math.round(fs.statSync(tujuan).size / 1024);
    info('cadangan-dibuat', { berkas: path.basename(tujuan), kb: ukuranKb });
    return tujuan;
  } catch (e) {
    galat('cadangan-gagal', e);
    return null;
  }
}

/** Buang cadangan yang lebih tua dari batas simpan pada satu folder */
function buangCadanganLama(dir, penanda) {
  try {
    if (!fs.existsSync(dir)) return 0;

    const batas = tanggalWIB(Date.now() - HARI_CADANGAN * 86400000);
    let dibuang = 0;

    for (const berkas of fs.readdirSync(dir)) {
      const cocok = berkas.match(/^sigap-(\d{4}-\d{2}-\d{2})\.db$/);
      if (cocok && cocok[1] < batas) {
        fs.unlinkSync(path.join(dir, berkas));
        dibuang++;
      }
    }
    if (dibuang > 0) info('cadangan-lama-dibuang', { tempat: penanda, jumlah: dibuang });
    return dibuang;
  } catch (e) {
    galat('bersih-cadangan-gagal', e, { tempat: penanda });
    return 0;
  }
}

export function bersihkanCadanganLama() {
  return buangCadanganLama(folderCadangan(), 'lokal');
}

/**
 * Salin cadangan ke tempat di luar mesin.
 *
 * Menyalin berkas biasa, BUKAN menjalankan `VACUUM INTO` langsung ke tujuan.
 * Berkas lokal sudah berupa potret yang utuh, sedangkan menulis basis data
 * SQLite melalui berbagi jaringan lambat dan rawan terputus di tengah jalan.
 *
 * Kegagalan tidak pernah menjatuhkan server: folder jaringan wajar sedang
 * tidak terhubung, atau flashdisk sedang dicabut. Yang terjadi hanya
 * peringatan — dan peringatan itu mengeras bila kegagalannya berlarut.
 *
 * @param {string} berkasLokal Jalur cadangan yang baru dibuat
 * @returns {boolean} true bila salinan berhasil dan terverifikasi
 */
export function salinCadanganKeLuar(berkasLokal) {
  if (!CADANGAN_LUAR) return false;

  const tujuan = path.join(CADANGAN_LUAR, path.basename(berkasLokal));

  try {
    if (!fs.existsSync(CADANGAN_LUAR)) fs.mkdirSync(CADANGAN_LUAR, { recursive: true });

    fs.copyFileSync(berkasLokal, tujuan);

    // Salinan yang terpotong di tengah jalan tetap menghasilkan berkas, dan
    // berkas cacat itu jauh lebih berbahaya daripada tidak ada cadangan sama
    // sekali — orang merasa aman padahal tidak. Ukurannya dibandingkan agar
    // pemotongan seperti itu langsung ketahuan.
    const asal = fs.statSync(berkasLokal).size;
    const salinan = fs.statSync(tujuan).size;

    if (asal !== salinan) {
      fs.unlinkSync(tujuan);
      throw new Error(`ukuran tidak cocok: ${asal} bita menjadi ${salinan} bita`);
    }

    terakhirBerhasilKeLuar = Date.now();
    info('cadangan-luar-berhasil', { tujuan, kb: Math.round(salinan / 1024) });
    buangCadanganLama(CADANGAN_LUAR, 'luar');
    return true;
  } catch (e) {
    const hariTertinggal = terakhirBerhasilKeLuar
      ? Math.floor((Date.now() - terakhirBerhasilKeLuar) / 86400000)
      : null;

    galat('cadangan-luar-gagal', e, { tujuan, hariTertinggal });

    // Sekali gagal itu biasa. Berhari-hari gagal berarti cadangan luar sudah
    // tidak ada, dan itu harus terlihat oleh yang menjaga sistem.
    if (hariTertinggal === null || hariTertinggal >= HARI_PERINGATAN_LUAR) {
      console.warn(
        `⚠️  Cadangan ke luar mesin gagal${hariTertinggal !== null ? ` — terakhir berhasil ${hariTertinggal} hari lalu` : ' dan belum pernah berhasil'}.`
      );
      console.warn(`   Periksa apakah ${CADANGAN_LUAR} masih terhubung.`);
    }
    return false;
  }
}

/* ────────────────────────────────────────────────────────────────
   Penjadwalan
   ──────────────────────────────────────────────────────────────── */

/**
 * Pekerjaan harian: cadangkan, berlakukan retensi, bersihkan berkas lama.
 */
export function pemeliharaanHarian() {
  const cadangan = cadangkanBasisData();
  if (cadangan) salinCadanganKeLuar(cadangan);
  bersihkanCadanganLama();
  bersihkanLogLama();

  // Kebijakan retensi RANCANGAN-DATA.md §11: setelah dua tahun, nama pelapor
  // dikosongkan sedangkan barisnya tetap disimpan. Baris itu masih berguna
  // untuk membandingkan tren antar tahun; namanya tidak lagi berguna bagi
  // siapa pun.
  const dianonimkan = anonimkanLama(TAHUN_RETENSI);
  if (dianonimkan > 0) {
    info('retensi-dijalankan', { baris: dianonimkan, tahun: TAHUN_RETENSI });
    console.log(`🔒 ${dianonimkan} laporan lama dianonimkan (retensi ${TAHUN_RETENSI} tahun)`);
  }

  // Isi percakapan dan jejak akses tidak dapat dianonimkan sebagian — keduanya
  // teks bebas. Sebelumnya keduanya menumpuk tanpa pernah dibuang sama sekali,
  // sementara baris sesinya sudah dianonimkan bertahun-tahun lalu.
  const dipangkas = pangkasIsiLama(TAHUN_RETENSI);
  if (dipangkas.pesan > 0 || dipangkas.akses > 0) {
    info('retensi-pangkas', { ...dipangkas, tahun: TAHUN_RETENSI });
    console.log(
      `🔒 ${dipangkas.pesan} pesan dan ${dipangkas.akses} jejak akses lama dibuang ` +
      `(retensi ${TAHUN_RETENSI} tahun)`
    );
  }
}

/** Penyapuan sesi yang ditinggalkan penggunanya */
export function sapuSesi() {
  const jumlah = tandaiSesiTerbengkalai(MENIT_TERBENGKALAI);
  if (jumlah > 0) {
    info('sesi-ditinggalkan', { jumlah });
    console.log(`🧹 ${jumlah} sesi ditandai ditinggalkan`);
  }
  return jumlah;
}

/**
 * Nyalakan seluruh pekerjaan latar belakang.
 *
 * Seluruh pewaktu memakai `unref()` agar tidak menahan proses tetap hidup saat
 * server dimatikan — tanpa itu, `npm test` dan penghentian biasa menggantung.
 */
export function mulaiPemeliharaan() {
  sapuSesi();
  setInterval(sapuSesi, 5 * 60 * 1000).unref();

  // Dijalankan sekali saat menyala, lalu tiap 24 jam. Bila server sering
  // dimatikan malam hari, cadangan tetap terbuat setiap kali dinyalakan.
  pemeliharaanHarian();
  setInterval(pemeliharaanHarian, 24 * 60 * 60 * 1000).unref();

  console.log(`💾 Pencadangan harian aktif → ${folderCadangan()} (disimpan ${HARI_CADANGAN} hari)`);

  if (CADANGAN_LUAR) {
    console.log(`   Salinan luar mesin  → ${CADANGAN_LUAR}`);
  } else {
    // Diperingatkan setiap kali menyala, bukan sekali saja. Cadangan yang
    // seluruhnya berada di satu disk adalah risiko yang mudah dilupakan
    // justru karena pencadangannya sendiri terlihat berjalan lancar.
    console.warn('⚠️  CADANGAN_LUAR belum diisi — seluruh cadangan berada di disk yang sama');
    console.warn('   dengan basis datanya. Bila disk rusak, keduanya hilang bersamaan.');
    console.warn('   Isi CADANGAN_LUAR di .env dengan folder jaringan, OneDrive, atau flashdisk.');
    peringatan('cadangan-luar-belum-diatur');
  }

  if (!process.env.SESSION_SECRET) {
    peringatan('session-secret-kosong');
  }
}
