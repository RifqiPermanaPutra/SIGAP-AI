/**
 * Log aplikasi yang bertahan.
 *
 * Sebelumnya seluruh keterangan hanya ditulis ke `console`, sehingga hilang
 * begitu jendela server ditutup. Untuk sistem yang dipakai sehari-hari, galat
 * yang tidak meninggalkan jejak berarti tidak dapat ditelusuri sama sekali —
 * pelapor mengeluh "kemarin error", dan tidak ada yang bisa diperiksa.
 *
 * Sengaja sederhana: berkas teks satu baris per kejadian, dipisah per hari,
 * dibuang setelah beberapa waktu. Tidak memakai pustaka apa pun.
 */
import fs from 'fs';
import path from 'path';
import { jalurBasisData } from '../database/init.js';

const HARI_SIMPAN = Number(process.env.HARI_SIMPAN_LOG || 30);
const WIB_MS = 7 * 60 * 60 * 1000;

/** Tanggal WIB 'YYYY-MM-DD' — sama dengan yang dipakai penomoran tiket */
function tanggalWIB(ms = Date.now()) {
  return new Date(ms + WIB_MS).toISOString().slice(0, 10);
}

function folderLog() {
  return path.join(path.dirname(jalurBasisData()), 'log');
}

/**
 * Tulis satu baris log.
 *
 * Kegagalan penulisan sengaja ditelan: log adalah alat bantu, tidak boleh
 * menjatuhkan permintaan yang sedang dilayani hanya karena diska penuh.
 *
 * @param {'INFO'|'PERINGATAN'|'GALAT'} tingkat
 * @param {string} peristiwa Nama pendek, contoh 'sesi-baru' atau 'rekap-unduh'
 * @param {object} [rinci]   Keterangan tambahan
 */
export function catat(tingkat, peristiwa, rinci = {}) {
  try {
    const dir = folderLog();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const isi = Object.entries(rinci)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}=${String(v).replace(/\s+/g, ' ').slice(0, 300)}`)
      .join(' ');

    const baris = `${new Date().toISOString()} ${tingkat.padEnd(10)} ${peristiwa}${isi ? ' ' + isi : ''}\n`;
    fs.appendFileSync(path.join(dir, `sigap-${tanggalWIB()}.log`), baris, 'utf-8');
  } catch {
    /* log tidak boleh menjatuhkan permintaan */
  }
}

export const info = (peristiwa, rinci) => catat('INFO', peristiwa, rinci);
export const peringatan = (peristiwa, rinci) => catat('PERINGATAN', peristiwa, rinci);

/**
 * Catat galat sekaligus menampilkannya di konsol.
 * @param {string} peristiwa
 * @param {Error|unknown} galat
 * @param {object} [rinci]
 */
export function galat(peristiwa, galatObj, rinci = {}) {
  const pesan = galatObj instanceof Error ? galatObj.message : String(galatObj);
  console.error(`❌ ${peristiwa}:`, pesan);
  catat('GALAT', peristiwa, { ...rinci, pesan });
}

/** Buang berkas log yang lebih tua dari batas simpan */
export function bersihkanLogLama() {
  try {
    const dir = folderLog();
    if (!fs.existsSync(dir)) return 0;

    const batas = tanggalWIB(Date.now() - HARI_SIMPAN * 86400000);
    let dibuang = 0;

    for (const berkas of fs.readdirSync(dir)) {
      const cocok = berkas.match(/^sigap-(\d{4}-\d{2}-\d{2})\.log$/);
      // Perbandingan teks cukup karena bentuk tanggalnya YYYY-MM-DD
      if (cocok && cocok[1] < batas) {
        fs.unlinkSync(path.join(dir, berkas));
        dibuang++;
      }
    }
    return dibuang;
  } catch {
    return 0;
  }
}
