/**
 * Membaca dan menulis berkas SOP berformat JSON.
 *
 * Menggantikan `sopParser.js` yang mengurai Markdown. Alasan penggantiannya
 * bukan selera format, melainkan tiga hal yang terbukti merepotkan:
 *
 *   1. Markdown menuntut PENGURAIAN, dan penguraian bisa meleset. Menyimpan
 *      satu masalah berarti menyusun ulang Markdown lalu menguraikannya
 *      kembali; bila keduanya tidak sepakat, SOP tersimpan rapi di berkas
 *      tetapi lenyap dari basis pengetahuan. Satu cacat seperti itu memang
 *      pernah terjadi — tujuh belas blok tertulis ulang dengan judul keliru.
 *
 *   2. Id masalah diturunkan dari judul, sehingga memperbaiki judul memutus
 *      rujukan `sesi.masalah_cocok` pada seluruh laporan lama. Karena itu
 *      penyunting mengunci judul sebagai baca-saja. Di sini id DISIMPAN,
 *      dan judul boleh diperbaiki kapan saja.
 *
 *   3. Bentuknya dapat diperiksa mesin. `scripts/periksa-kb.js` menolak
 *      berkas yang cacat sebelum sempat menghasilkan jawaban yang salah.
 *
 * Berkasnya tetap berada di `knowledge-base/`, satu berkas per layanan, dan
 * tetap menjadi SUMBER KEBENARAN. `server/data/knowledge-base.json` adalah
 * hasil bangunnya — boleh dihapus dan dibuat ulang kapan saja.
 */
import fs from 'fs';
import path from 'path';
import { SOP_DIR } from '../config/jalur.js';
import { DIVISI_ID, DIVISI_MAP } from '../config/divisi.js';

/** Jalur berkas SOP satu layanan. Tidak menjamin berkasnya ada. */
export function jalurSopDivisi(divisi) {
  if (!DIVISI_ID.includes(divisi)) return null;
  return path.join(SOP_DIR, `${divisi}.json`);
}

/**
 * Daftar layanan yang berkas SOP-nya benar-benar ada.
 *
 * Urut mengikuti `DIVISI_ID`, bukan urutan berkas di disk: urutan direktori
 * berbeda antar sistem berkas, dan basis pengetahuan yang isinya berpindah
 * urutan membuat setiap pembangunan ulang tampak seperti perubahan besar
 * pada riwayat Git.
 */
export function daftarBerkasSop() {
  return DIVISI_ID
    .map((divisi) => ({ divisi, jalur: jalurSopDivisi(divisi) }))
    .filter(({ jalur }) => jalur && fs.existsSync(jalur))
    .map(({ divisi, jalur }) => ({ divisi, berkas: path.basename(jalur), jalur }));
}

/**
 * Baca satu berkas SOP layanan.
 *
 * @returns {{divisi, nama, catatanKonfirmasi: string[], masalah: object[]}|null}
 */
export function bacaSopDivisi(divisi) {
  const jalur = jalurSopDivisi(divisi);
  if (!jalur || !fs.existsSync(jalur)) return null;

  const isi = JSON.parse(fs.readFileSync(jalur, 'utf-8'));

  // Bentuknya dirapikan di satu tempat supaya pemanggil tidak perlu memeriksa
  // medan yang mungkin hilang. Berkas yang benar-benar cacat ditangkap
  // `scripts/periksa-kb.js`, bukan disembunyikan di sini.
  return {
    divisi,
    nama: isi.nama || DIVISI_MAP.get(divisi)?.name || divisi,
    catatanKonfirmasi: Array.isArray(isi.catatanKonfirmasi) ? isi.catatanKonfirmasi : [],
    masalah: (Array.isArray(isi.masalah) ? isi.masalah : []).map(bentukMasalah)
  };
}

/** Satu masalah dengan seluruh medannya pasti ada */
function bentukMasalah(m) {
  const kategori = m.kategori === 'berat' ? 'berat' : 'ringan';
  return {
    id: String(m.id || '').trim(),
    judul: String(m.judul || '').trim(),
    gejala: String(m.gejala || '').trim(),
    kategori,
    penyebab: (Array.isArray(m.penyebab) ? m.penyebab : []).map((p) => String(p).trim()).filter(Boolean),
    // Masalah berat tidak boleh punya langkah mandiri — justru itu yang
    // membedakannya dari ringan.
    solusi: kategori === 'berat'
      ? []
      : (Array.isArray(m.solusi) ? m.solusi : []).map((s) => ({
          judul: String(s?.judul || '').trim(),
          pengantar: String(s?.pengantar || '').trim() || null,
          langkah: (Array.isArray(s?.langkah) ? s.langkah : []).map((l) => String(l).trim()).filter(Boolean)
        })),
    penanganan: kategori === 'berat' ? (String(m.penanganan || '').trim() || null) : null
  };
}

/**
 * Tulis satu berkas SOP layanan.
 *
 * Ditulis lewat berkas sementara lalu dipindahkan, bukan langsung ditimpa:
 * penulisan yang terputus di tengah meninggalkan JSON separuh jadi, dan JSON
 * separuh jadi membuat SELURUH layanan itu lenyap dari basis pengetahuan pada
 * pembangunan berikutnya.
 */
export function tulisSopDivisi(divisi, isi) {
  const jalur = jalurSopDivisi(divisi);
  if (!jalur) throw new Error(`Divisi tidak dikenal: ${divisi}`);

  const keluaran = {
    $schema: '../server/data/sop.schema.json',
    divisi,
    nama: isi.nama || DIVISI_MAP.get(divisi)?.name || divisi,
    catatanKonfirmasi: isi.catatanKonfirmasi || [],
    masalah: isi.masalah.map(bentukMasalah)
  };

  const sementara = `${jalur}.tmp`;
  fs.writeFileSync(sementara, JSON.stringify(keluaran, null, 2) + '\n', 'utf-8');
  fs.renameSync(sementara, jalur);
  return jalur;
}

/**
 * Susun id dari judul, untuk masalah yang belum punya id.
 *
 * Hanya dipakai saat MEMBUAT masalah baru. Masalah yang sudah ada memakai id
 * yang tersimpan, sehingga judulnya boleh berubah tanpa memutus rujukan.
 */
export function buatIdBaru(divisi, judul) {
  const potongan = String(judul)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join('-');
  return `${divisi}-${potongan}`;
}

/**
 * Periksa masukan penyunting sebelum apa pun ditulis ke berkas.
 * @returns {string[]} daftar galat; kosong berarti sah
 */
export function periksaMasalah(masukan) {
  const galat = [];
  const rapi = (t) => String(t || '').trim();

  if (!rapi(masukan.judul)) galat.push('Judul masalah wajib diisi');
  if (!['ringan', 'berat'].includes(masukan.kategori)) {
    galat.push('Kategori harus "ringan" atau "berat"');
  }
  if (masukan.penyebab && !Array.isArray(masukan.penyebab)) {
    galat.push('Penyebab harus berupa daftar');
  }

  if (masukan.kategori === 'berat') {
    if (!rapi(masukan.penanganan)) {
      galat.push('Masalah berat wajib punya keterangan penanganan');
    }
    return galat;
  }

  const solusi = Array.isArray(masukan.solusi) ? masukan.solusi : [];
  const terpakai = solusi.filter((s) => (s?.langkah || []).some((l) => rapi(l)));

  if (terpakai.length === 0) {
    galat.push('Masalah ringan wajib punya minimal satu solusi berisi langkah');
  }
  if (solusi.length > MAKS_SOLUSI) {
    galat.push(`Maksimal ${MAKS_SOLUSI} solusi per masalah`);
  }

  return galat;
}

/**
 * Batas jumlah solusi.
 *
 * Antarmuka menjanjikan tiga percobaan sebelum menyerah ke engineer, dan
 * `answerService.js` hanya pernah menawarkan sebanyak itu. Solusi keempat
 * akan tersimpan rapi lalu tidak pernah dibacakan kepada siapa pun.
 */
export const MAKS_SOLUSI = 3;
