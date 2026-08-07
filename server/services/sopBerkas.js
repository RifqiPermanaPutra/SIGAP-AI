/**
 * Membaca dan menulis berkas SOP dari penyunting web.
 *
 * Berkas Markdown di `knowledge-base/<divisi>/sop-*.md` tetap menjadi sumber
 * kebenaran — penyunting ini menulis ulang berkas yang sama, lalu membangun
 * ulang basis pengetahuan dan memuatnya ke memori. Tidak ada salinan data SOP
 * di dalam basis data.
 *
 * Urutan menyimpan sengaja dibuat begini:
 *   1. periksa masukan          (menolak lebih awal, sebelum apa pun berubah)
 *   2. cadangkan berkas lama    (suntingan yang salah harus dapat dibatalkan)
 *   3. tulis berkas baru
 *   4. bangun ulang + muat ulang
 *
 * Bila langkah 4 gagal, berkas Markdown sudah terlanjur berubah — karena itu
 * berkasnya dikembalikan dari cadangan yang baru saja dibuat pada langkah 2.
 * SOP yang tersimpan tetapi tidak dapat diurai jauh lebih berbahaya daripada
 * suntingan yang ditolak: pengguna menerima langkah yang keliru, disampaikan
 * dengan yakin.
 */
import fs from 'fs';
import path from 'path';
import {
  DIVISI_KE_FOLDER,
  uraiBerkas,
  susunBerkas,
  susunBlok,
  berpemisah,
  bentukUntukPenyunting,
  catatanKonfirmasi,
  periksaMasalah,
  uraiBlok
} from './sopParser.js';
import { muatBasisPengetahuan } from './answerService.js';
import { bangun } from '../../scripts/build-kb.js';
import { jalurBasisData } from '../database/init.js';
import { info, galat } from './logUtil.js';
import { SOP_DIR } from '../config/jalur.js';

/** Banyaknya cadangan yang disimpan per berkas SOP */
const SIMPAN_CADANGAN = Number(process.env.JUMLAH_CADANGAN_SOP || 20);

/* ────────────────────────────────────────────────────────────────
   Menemukan berkas
   ──────────────────────────────────────────────────────────────── */

/**
 * Jalur berkas SOP satu divisi.
 * @returns {string|null} null bila divisi tidak dikenal atau berkasnya tidak ada
 */
export function jalurSop(divisi) {
  const folder = DIVISI_KE_FOLDER[divisi];
  if (!folder) return null;

  const dir = path.join(SOP_DIR, folder);
  if (!fs.existsSync(dir)) return null;

  const berkas = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  return berkas.length > 0 ? path.join(dir, berkas[0]) : null;
}

/**
 * Baca satu berkas SOP dalam bentuk yang siap dipakai formulir penyunting.
 * @returns {{divisi, berkas, masalah: object[], catatan: object|null}|null}
 */
export function bacaSop(divisi) {
  const jalur = jalurSop(divisi);
  if (!jalur) return null;

  const dokumen = uraiBerkas(divisi, fs.readFileSync(jalur, 'utf-8'));

  return {
    divisi,
    berkas: path.relative(path.dirname(SOP_DIR), jalur).replace(/\\/g, '/'),
    masalah: dokumen.blok
      .filter((b) => b.masalah)
      .map((b) => bentukUntukPenyunting(b.masalah)),
    // Baca-saja. Penanda [KONFIRMASI] bukan langkah SOP melainkan hal yang
    // menunggu jawaban engineer lapangan, dan tetap disunting manual.
    catatan: catatanKonfirmasi(dokumen)
  };
}

/* ────────────────────────────────────────────────────────────────
   Pencadangan
   ──────────────────────────────────────────────────────────────── */

function folderCadangan() {
  return path.join(path.dirname(jalurBasisData()), 'cadangan-sop');
}

const capWaktu = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

/**
 * Salin berkas SOP ke cadangan bertanggal sebelum ditimpa.
 *
 * Berbeda dengan cadangan basis data yang cukup satu potret per hari, SOP
 * dapat disunting beberapa kali dalam satu hari — dan justru suntingan
 * berikutnya pada hari yang sama itulah yang paling sering ingin dibatalkan.
 * Karena itu capnya sampai ke detik, dan yang lama dibuang menurut jumlah.
 *
 * @returns {string|null} jalur berkas cadangan
 */
export function cadangkanSop(jalur) {
  try {
    const dir = folderCadangan();
    fs.mkdirSync(dir, { recursive: true });

    const nama = path.basename(jalur, '.md');
    const tujuan = path.join(dir, `${nama}-${capWaktu()}.md`);
    fs.copyFileSync(jalur, tujuan);

    buangCadanganLama(dir, nama);
    info('sop-dicadangkan', { berkas: path.basename(tujuan) });
    return tujuan;
  } catch (e) {
    galat('sop-cadangan-gagal', e, { jalur });
    return null;
  }
}

/** Sisakan hanya beberapa cadangan terakhir untuk satu berkas SOP */
function buangCadanganLama(dir, nama) {
  const milik = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(`${nama}-`) && f.endsWith('.md'))
    .sort();                                   // cap waktu ISO urut secara abjad

  for (const berkas of milik.slice(0, Math.max(0, milik.length - SIMPAN_CADANGAN))) {
    fs.unlinkSync(path.join(dir, berkas));
  }
}

/** Daftar cadangan yang tersedia untuk satu divisi, terbaru lebih dulu */
export function daftarCadanganSop(divisi) {
  const jalur = jalurSop(divisi);
  if (!jalur) return [];

  const dir = folderCadangan();
  if (!fs.existsSync(dir)) return [];

  const nama = path.basename(jalur, '.md');
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(`${nama}-`) && f.endsWith('.md'))
    .sort()
    .reverse()
    .map((f) => {
      const info = fs.statSync(path.join(dir, f));
      return { berkas: f, ukuran: info.size, dibuatPada: info.mtime.toISOString() };
    });
}

/* ────────────────────────────────────────────────────────────────
   Pratinjau
   ──────────────────────────────────────────────────────────────── */

/**
 * Susun Markdown dari masukan penyunting lalu urai kembali — TANPA menyentuh
 * berkas apa pun.
 *
 * Pratinjau sengaja melalui jalur yang sama persis dengan penyimpanan. Menyusun
 * pratinjau di sisi peramban dengan kode terpisah berarti admin menyetujui
 * sesuatu yang belum tentu sama dengan yang benar-benar ditulis ke berkas.
 *
 * @returns {{ok: true, markdown: string, hasil: object} | {ok: false, status, galat}}
 */
export function pratinjauMasalah(divisi, masalahId, masukan) {
  const jalur = jalurSop(divisi);
  if (!jalur) return { ok: false, status: 404, galat: ['Berkas SOP divisi ini tidak ditemukan'] };

  const cacat = periksaMasalah(masukan);
  if (cacat.length > 0) return { ok: false, status: 400, galat: cacat };

  const dokumen = uraiBerkas(divisi, fs.readFileSync(jalur, 'utf-8'));
  const lama = dokumen.blok.find((b) => b.masalah && b.masalah.id === masalahId);
  if (!lama) {
    return { ok: false, status: 404, galat: [`Masalah "${masalahId}" tidak ada pada SOP ${divisi}`] };
  }

  const markdown = susunBlok({ ...masukan, judul: lama.masalah.judul }, berpemisah(lama.mentah));
  const hasil = uraiBlok(divisi, markdown);

  if (!hasil) {
    return { ok: false, status: 400, galat: ['Markdown hasil susunan tidak dapat diurai kembali'] };
  }

  return { ok: true, markdown, hasil };
}

/* ────────────────────────────────────────────────────────────────
   Menyimpan
   ──────────────────────────────────────────────────────────────── */

/**
 * Perbarui satu blok masalah pada berkas SOP, lalu bangun ulang basis
 * pengetahuan dan muat ulang ke memori.
 *
 * @param {string} divisi
 * @param {string} masalahId Id blok yang diperbarui (dari `buatId`)
 * @param {object} masukan Bentuk formulir penyunting
 * @returns {{ok: true, masalah: object, kb: object, cadangan: string|null}
 *          | {ok: false, status: number, galat: string[]}}
 */
export function simpanMasalah(divisi, masalahId, masukan) {
  const jalur = jalurSop(divisi);
  if (!jalur) return { ok: false, status: 404, galat: ['Berkas SOP divisi ini tidak ditemukan'] };

  const cacat = periksaMasalah(masukan);
  if (cacat.length > 0) return { ok: false, status: 400, galat: cacat };

  const asli = fs.readFileSync(jalur, 'utf-8');
  const dokumen = uraiBerkas(divisi, asli);

  const indeks = dokumen.blok.findIndex((b) => b.masalah && b.masalah.id === masalahId);
  if (indeks === -1) {
    return { ok: false, status: 404, galat: [`Masalah "${masalahId}" tidak ada pada SOP ${divisi}`] };
  }

  // Judul menentukan id. Membiarkannya berubah diam-diam memutus rujukan
  // rekap ke masalah ini dan membuat penyunting kehilangan blok yang sedang
  // disuntingnya begitu disimpan.
  const blokBaru = susunBlok(
    { ...masukan, judul: dokumen.blok[indeks].masalah.judul },
    berpemisah(dokumen.blok[indeks].mentah)
  );

  // Diurai lebih dulu sebelum menyentuh berkas: bila hasil susunannya sendiri
  // tidak dapat dibaca ulang, tidak ada gunanya menulisnya ke disk.
  const ujiUrai = uraiBlok(divisi, blokBaru);
  if (!ujiUrai || ujiUrai.id !== masalahId) {
    return {
      ok: false,
      status: 400,
      galat: ['Markdown hasil susunan tidak dapat diurai kembali — suntingan dibatalkan']
    };
  }

  const cadangan = cadangkanSop(jalur);

  dokumen.blok[indeks] = { mentah: blokBaru, masalah: ujiUrai };
  fs.writeFileSync(jalur, susunBerkas(dokumen), 'utf-8');

  try {
    const ringkas = bangun(true);
    const jumlah = muatBasisPengetahuan();

    info('sop-disunting', { divisi, masalah: masalahId, totalMasalah: jumlah });

    return {
      ok: true,
      masalah: bentukUntukPenyunting(ujiUrai),
      kb: { ...ringkas, dimuat: jumlah },
      cadangan: cadangan ? path.basename(cadangan) : null
    };
  } catch (e) {
    // Berkas sudah berubah tetapi basis pengetahuannya gagal dibangun.
    // Dikembalikan seperti semula supaya sistem tidak ditinggalkan dalam
    // keadaan setengah jadi.
    fs.writeFileSync(jalur, asli, 'utf-8');
    try { bangun(true); muatBasisPengetahuan(); } catch { /* sudah dilaporkan */ }

    galat('sop-bangun-gagal', e, { divisi, masalah: masalahId });
    return {
      ok: false,
      status: 500,
      galat: ['Basis pengetahuan gagal dibangun ulang. Berkas SOP dikembalikan seperti semula.']
    };
  }
}
