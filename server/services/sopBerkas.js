/**
 * Membaca dan menulis berkas SOP dari penyunting web.
 *
 * Berkas JSON di `knowledge-base/<divisi>.json` tetap menjadi sumber
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
 * Bila langkah 4 gagal, berkas sumber sudah terlanjur berubah — karena itu
 * berkasnya dikembalikan dari cadangan yang baru saja dibuat pada langkah 2.
 * SOP yang tersimpan tetapi tidak dapat dibaca jauh lebih berbahaya daripada
 * suntingan yang ditolak: pengguna menerima langkah yang keliru, disampaikan
 * dengan yakin.
 *
 * Sejak sumbernya berupa JSON, satu kelas kesalahan hilang sepenuhnya: tidak
 * ada lagi penyusunan ulang Markdown yang harus dapat diurai kembali. Yang
 * ditulis adalah bentuk yang sama persis dengan yang dibaca.
 */
import fs from 'fs';
import path from 'path';
import {
  bacaSopDivisi,
  tulisSopDivisi,
  jalurSopDivisi,
  buatIdBaru,
  periksaMasalah,
  MAKS_SOLUSI
} from './sopJson.js';
import { kataKunciMasalah } from './teksUtil.js';
import { muatBasisPengetahuan } from './answerService.js';
import { bangun } from '../../scripts/build-kb.js';
import { jalurBasisData } from '../database/init.js';
import { modeDivisi } from '../config/divisi.js';
import { info, galat } from './logUtil.js';
import { SOP_DIR } from '../config/jalur.js';

/** Banyaknya cadangan yang disimpan per berkas SOP */
const SIMPAN_CADANGAN = Number(process.env.JUMLAH_CADANGAN_SOP || 20);

/**
 * Penanda masalah yang belum ada, dipakai pada jalur pratinjau.
 *
 * Id masalah selalu berbentuk `<divisi>-<slug>`, sehingga kata tunggal ini
 * mustahil bentrok dengan id sungguhan.
 */
export const PENANDA_BARU = 'baru';

export { MAKS_SOLUSI };

/* ────────────────────────────────────────────────────────────────
   Membaca
   ──────────────────────────────────────────────────────────────── */

/** Jalur berkas SOP satu divisi, atau null bila berkasnya tidak ada */
export function jalurSop(divisi) {
  const jalur = jalurSopDivisi(divisi);
  return jalur && fs.existsSync(jalur) ? jalur : null;
}

/**
 * Baca satu berkas SOP dalam bentuk yang siap dipakai formulir penyunting.
 * @returns {{divisi, berkas, masalah: object[], catatan: object|null}|null}
 */
export function bacaSop(divisi) {
  const jalur = jalurSop(divisi);
  if (!jalur) return null;

  const sop = bacaSopDivisi(divisi);
  if (!sop) return null;

  return {
    divisi,
    berkas: path.relative(path.dirname(SOP_DIR), jalur).replace(/\\/g, '/'),
    masalah: sop.masalah,
    // Baca-saja. Penanda [KONFIRMASI] bukan langkah SOP melainkan hal yang
    // menunggu jawaban engineer lapangan, dan tetap disunting langsung pada
    // berkas sumbernya.
    catatan: sop.catatanKonfirmasi.length > 0
      ? { judul: 'Catatan Konfirmasi Engineer', butir: sop.catatanKonfirmasi }
      : null
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

    const nama = path.basename(jalur, '.json');
    const tujuan = path.join(dir, `${nama}-${capWaktu()}.json`);
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
    .filter((f) => f.startsWith(`${nama}-`) && f.endsWith('.json'))
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

  const nama = path.basename(jalur, '.json');
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(`${nama}-`) && f.endsWith('.json'))
    .sort()
    .reverse()
    .map((f) => {
      const info = fs.statSync(path.join(dir, f));
      return { berkas: f, ukuran: info.size, dibuatPada: info.mtime.toISOString() };
    });
}

/* ────────────────────────────────────────────────────────────────
   Menulis
   ──────────────────────────────────────────────────────────────── */

/**
 * Tulis berkas SOP yang sudah diubah, lalu bangun ulang dan muat ulang.
 *
 * Dipakai bersama oleh penyuntingan, penambahan, dan penghapusan supaya
 * urutannya — cadangkan, tulis, bangun, kembalikan bila gagal — mustahil
 * berbeda di antara ketiganya.
 */
function tulisDanBangun(divisi, asli, sopBaru, jejak) {
  const jalur = jalurSop(divisi);
  const cadangan = cadangkanSop(jalur);

  tulisSopDivisi(divisi, sopBaru);

  try {
    const ringkas = bangun(true);
    const jumlah = muatBasisPengetahuan();

    info(jejak.peristiwa, { ...jejak.rincian, totalMasalah: jumlah });

    return {
      ok: true,
      kb: { ...ringkas, dimuat: jumlah },
      cadangan: cadangan ? path.basename(cadangan) : null
    };
  } catch (e) {
    // Berkas sudah berubah tetapi basis pengetahuannya gagal dibangun.
    // Dikembalikan seperti semula supaya sistem tidak ditinggalkan dalam
    // keadaan setengah jadi.
    tulisSopDivisi(divisi, asli);
    try { bangun(true); muatBasisPengetahuan(); } catch { /* sudah dilaporkan */ }

    galat('sop-bangun-gagal', e, jejak.rincian);
    return {
      ok: false,
      status: 500,
      galat: ['Basis pengetahuan gagal dibangun ulang. Berkas SOP dikembalikan seperti semula.']
    };
  }
}

/**
 * Susun pratinjau tanpa menyentuh berkas apa pun.
 *
 * Wajib dilihat admin sebelum menyimpan: yang menentukan apakah SOP ini akan
 * pernah ditemukan pengguna bukan bentuk formulirnya, melainkan kata kunci
 * yang terkumpul darinya.
 */
export function pratinjauMasalah(divisi, masalahId, masukan) {
  const sop = bacaSopDivisi(divisi);
  if (!sop) return { ok: false, status: 404, galat: ['Berkas SOP divisi ini tidak ditemukan'] };

  const cacat = periksaMasalah(masukan);
  if (cacat.length > 0) return { ok: false, status: 400, galat: cacat };

  const baru = masalahId === PENANDA_BARU;
  const lama = baru ? null : sop.masalah.find((m) => m.id === masalahId);

  if (!baru && !lama) {
    return { ok: false, status: 404, galat: [`Masalah "${masalahId}" tidak ada pada SOP ${divisi}`] };
  }

  const id = baru ? buatIdBaru(divisi, masukan.judul) : lama.id;

  if (baru && sop.masalah.some((m) => m.id === id)) {
    return {
      ok: false,
      status: 409,
      galat: [`Sudah ada masalah dengan judul serupa (id "${id}"). Pakai judul yang lebih khas.`]
    };
  }

  const hasil = susunMasalah(divisi, id, masukan);
  return { ok: true, hasil };
}

/** Bentuk akhir sebuah masalah, berikut kata kunci turunannya */
function susunMasalah(divisi, id, masukan) {
  const kategori = masukan.kategori === 'berat' ? 'berat' : 'ringan';
  const rapi = (t) => String(t || '').trim();

  const masalah = {
    id,
    judul: rapi(masukan.judul),
    gejala: rapi(masukan.gejala),
    kategori,
    penyebab: (masukan.penyebab || []).map(rapi).filter(Boolean),
    solusi: kategori === 'berat'
      ? []
      : (masukan.solusi || [])
          .map((s) => ({
            judul: rapi(s?.judul),
            pengantar: rapi(s?.pengantar) || null,
            langkah: (s?.langkah || []).map(rapi).filter(Boolean)
          }))
          .filter((s) => s.langkah.length > 0),
    penanganan: kategori === 'berat' ? (rapi(masukan.penanganan) || null) : null
  };

  // Kata kunci disusun dengan fungsi yang SAMA dengan yang dipakai
  // `build-kb.js`. Menghitungnya terpisah di sini berarti pratinjau dapat
  // menunjukkan kata kunci yang berbeda dari yang benar-benar tersimpan.
  return { ...masalah, divisi, kataKunci: kataKunciMasalah(masalah) };
}

/**
 * Perbarui satu masalah pada berkas SOP.
 *
 * Judul BOLEH berubah. Sejak id tersimpan di berkas sumber, judul tidak lagi
 * menentukan id, sehingga memperbaiki kalimat judul tidak memutus rujukan
 * `sesi.masalah_cocok` pada laporan lama.
 */
export function simpanMasalah(divisi, masalahId, masukan) {
  const sop = bacaSopDivisi(divisi);
  if (!sop) return { ok: false, status: 404, galat: ['Berkas SOP divisi ini tidak ditemukan'] };

  const cacat = periksaMasalah(masukan);
  if (cacat.length > 0) return { ok: false, status: 400, galat: cacat };

  const indeks = sop.masalah.findIndex((m) => m.id === masalahId);
  if (indeks === -1) {
    return { ok: false, status: 404, galat: [`Masalah "${masalahId}" tidak ada pada SOP ${divisi}`] };
  }

  const baru = susunMasalah(divisi, masalahId, masukan);
  const sopBaru = { ...sop, masalah: sop.masalah.map((m, i) => (i === indeks ? baru : m)) };

  const hasil = tulisDanBangun(divisi, sop, sopBaru, {
    peristiwa: 'sop-disunting',
    rincian: { divisi, masalah: masalahId }
  });
  if (!hasil.ok) return hasil;

  return { ...hasil, masalah: baru };
}

/**
 * Tambahkan satu masalah baru.
 *
 * Inilah yang menentukan umur sistem. Tanpa penambahan, penyunting hanya dapat
 * memperbaiki kalimat pada kendala yang sudah dikenal — sementara kendala baru
 * terus bermunculan.
 */
export function tambahMasalah(divisi, masukan) {
  const sop = bacaSopDivisi(divisi);
  if (!sop) return { ok: false, status: 404, galat: ['Berkas SOP divisi ini tidak ditemukan'] };

  const cacat = periksaMasalah(masukan);
  if (cacat.length > 0) return { ok: false, status: 400, galat: cacat };

  const id = buatIdBaru(divisi, masukan.judul);
  if (sop.masalah.some((m) => m.id === id)) {
    return {
      ok: false,
      status: 409,
      galat: [`Sudah ada masalah dengan judul serupa (id "${id}"). Pakai judul yang lebih khas.`]
    };
  }

  const baru = susunMasalah(divisi, id, masukan);
  const sopBaru = { ...sop, masalah: [...sop.masalah, baru] };

  const hasil = tulisDanBangun(divisi, sop, sopBaru, {
    peristiwa: 'sop-ditambah',
    rincian: { divisi, masalah: id }
  });
  if (!hasil.ok) return hasil;

  return { ...hasil, masalah: baru };
}

/**
 * Hapus satu masalah.
 *
 * Layanan mode `swalayan` TIDAK boleh kehabisan masalah. Printer dan Windows
 * adalah satu-satunya layanan yang menjanjikan panduan bertahap kepada
 * pengguna; bila daftarnya kosong, janji itu tetap ditampilkan sementara tidak
 * ada satu pun langkah yang dapat diberikan.
 */
export function hapusMasalah(divisi, masalahId) {
  const sop = bacaSopDivisi(divisi);
  if (!sop) return { ok: false, status: 404, galat: ['Berkas SOP divisi ini tidak ditemukan'] };

  const indeks = sop.masalah.findIndex((m) => m.id === masalahId);
  if (indeks === -1) {
    return { ok: false, status: 404, galat: [`Masalah "${masalahId}" tidak ada pada SOP ${divisi}`] };
  }

  const sisa = sop.masalah.length - 1;
  if (sisa === 0 && modeDivisi(divisi) === 'swalayan') {
    return {
      ok: false,
      status: 409,
      galat: [
        'Ini masalah terakhir pada layanan yang dipandu sendiri. Menghapusnya ' +
        'membuat pengguna tetap dijanjikan panduan yang tidak akan pernah muncul.'
      ]
    };
  }

  const judul = sop.masalah[indeks].judul;
  const sopBaru = { ...sop, masalah: sop.masalah.filter((_, i) => i !== indeks) };

  const hasil = tulisDanBangun(divisi, sop, sopBaru, {
    peristiwa: 'sop-dihapus',
    rincian: { divisi, masalah: masalahId }
  });
  if (!hasil.ok) return hasil;

  return { ...hasil, judul, sisa };
}
