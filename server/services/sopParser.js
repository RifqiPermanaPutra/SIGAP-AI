/**
 * Pengurai dan penyusun berkas SOP Markdown.
 *
 * Berkas `knowledge-base/<divisi>/sop-*.md` adalah SUMBER KEBENARAN. Berkas
 * JSON di `server/data/` hanyalah hasil bangun yang dapat dibuang dan dibuat
 * ulang kapan saja. Karena itu penyunting SOP lewat peramban menulis ulang
 * berkas Markdown yang sama, bukan memindahkan datanya ke tabel basis data.
 *
 * Modul ini dipakai DUA pihak:
 *   1. `scripts/build-kb.js` — membangun basis pengetahuan saat `npm run build:kb`
 *   2. `server/routes/sop.js` — membaca dan menulis SOP dari penyunting web
 *
 * Sebelumnya `uraiBlok` hanya ada di dalam skrip build. Menyalinnya ke sisi API
 * berarti dua pengurai untuk satu format: begitu salah satunya bergeser, SOP
 * yang tampak benar di penyunting akan terurai berbeda saat dibangun — dan
 * tidak ada yang menyadarinya sampai pengguna menerima langkah yang keliru.
 *
 * ATURAN PALING PENTING di berkas ini: `susunBlok(uraiBlok(x))` wajib terurai
 * kembali menjadi objek yang sama persis. Dijaga oleh `tests/sop.test.mjs`.
 */
import { tokenisasi } from './teksUtil.js';

/** Nama folder pada knowledge-base/ dipetakan ke id divisi yang dipakai aplikasi */
export const FOLDER_KE_DIVISI = {
  printer: 'printer',
  cctv: 'cctv',
  telepon: 'telepon',
  'radio-komunikasi': 'radio',
  windows: 'windows',
  ftth: 'ftth',
  lan: 'lan',
  wan: 'wan'
};

/** Kebalikannya — dipakai API untuk menemukan folder dari id divisi */
export const DIVISI_KE_FOLDER = Object.fromEntries(
  Object.entries(FOLDER_KE_DIVISI).map(([folder, divisi]) => [divisi, folder])
);

/**
 * Awalan judul solusi menurut urutannya.
 *
 * Pengurai mensyaratkan judul bagian solusi diawali kata "Solusi" — lihat
 * `polaSolusi` di bawah. Penyunting web karena itu tidak pernah membiarkan
 * admin mengetik awalan ini sendiri: ia hanya mengetik nama solusinya, dan
 * awalan disusun ulang menurut posisi. Satu salah ketik pada kata "Solusi"
 * membuat seluruh langkahnya hilang dari basis pengetahuan tanpa pesan galat.
 */
export const AWALAN_SOLUSI = ['Solusi Pertama', 'Solusi Kedua', 'Solusi Ketiga'];

/** Banyaknya solusi yang dapat disimpan pada satu masalah — sama dengan MAKS_SOLUSI */
export const MAKS_SOLUSI = AWALAN_SOLUSI.length;

/** Judul yang dipakai bila blok memakai daftar langkah biasa, bukan bagian "Solusi" */
export const JUDUL_LANGKAH_TUNGGAL = 'Langkah Penyelesaian';

/** Ubah judul menjadi id yang aman dipakai, contoh "Printer Offline" -> "printer-offline" */
export function buatId(divisi, judul) {
  const potongan = judul
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join('-');
  return `${divisi}-${potongan}`;
}

/**
 * Urai satu blok masalah (satu bagian yang diawali "## ") menjadi objek.
 * @returns {object|null} null bila blok bukan blok masalah
 */
export function uraiBlok(divisi, blok) {
  const baris = blok.split('\n');
  const judul = baris[0].trim();

  // Blok catatan dan judul berkas bukan blok masalah
  if (!judul || /^Catatan Konfirmasi Engineer$/i.test(judul)) return null;

  const ambilBagian = (namaBagian) => {
    const pola = new RegExp(`###\\s*${namaBagian}[^\\n]*\\n([\\s\\S]*?)(?=\\n###|$)`, 'i');
    const cocok = blok.match(pola);
    return cocok ? cocok[1].trim() : '';
  };

  const gejala = ambilBagian('Gejala yang Dirasakan User');
  const penyebabTeks = ambilBagian('Penyebab yang Mungkin Terjadi');
  const kategoriTeks = ambilBagian('Kategori');
  const penanganan = ambilBagian('Penanganan');

  const penyebab = penyebabTeks
    .split('\n')
    .map((b) => b.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean);

  // Kumpulkan seluruh bagian "Solusi ..." berikut langkah-langkahnya
  const solusi = [];
  const polaSolusi = /###\s*(Solusi[^\n]*)\n([\s\S]*?)(?=\n###|$)/gi;
  let m;
  while ((m = polaSolusi.exec(blok)) !== null) {
    const judulSolusi = m[1].trim();
    const isi = m[2];

    const langkah = isi
      .split('\n')
      .map((b) => b.trim())
      .filter((b) => /^\d+[.)]\s+/.test(b))
      .map((b) => b.replace(/^\d+[.)]\s*/, '').trim());

    // Kalimat pengantar sebelum daftar langkah, bila ada
    const pengantar = isi
      .split('\n')
      .filter((b) => b.trim() && !/^\d+[.)]\s+/.test(b.trim()))
      .join(' ')
      .trim();

    if (langkah.length > 0) {
      solusi.push({ judul: judulSolusi, pengantar: pengantar || null, langkah });
    }
  }

  // Blok tanpa bagian "Solusi" memakai daftar langkah biasa, bila ada
  if (solusi.length === 0) {
    const langkahTeks = ambilBagian(JUDUL_LANGKAH_TUNGGAL);
    const langkah = langkahTeks
      .split('\n')
      .map((b) => b.trim())
      .filter((b) => /^\d+[.)]\s+/.test(b))
      .map((b) => b.replace(/^\d+[.)]\s*/, '').trim());
    if (langkah.length > 0) {
      solusi.push({ judul: JUDUL_LANGKAH_TUNGGAL, pengantar: null, langkah });
    }
  }

  const kategori = /berat/i.test(kategoriTeks) ? 'berat' : 'ringan';

  // Kata kunci diambil dari judul, gejala, dan penyebab. Bagian inilah yang
  // dicocokkan dengan kalimat keluhan pengguna.
  const sumberKunci = [judul, gejala, ...penyebab].join(' ');
  const kataKunci = [...new Set(tokenisasi(sumberKunci))];

  return {
    id: buatId(divisi, judul),
    divisi,
    judul,
    gejala,
    kategori,
    penyebab,
    solusi,
    penanganan: penanganan || null,
    kataKunci
  };
}

/* ────────────────────────────────────────────────────────────────
   Berkas utuh
   ──────────────────────────────────────────────────────────────── */

/**
 * Urai satu berkas SOP menjadi bagian-bagian yang dapat disusun ulang persis.
 *
 * Berkas dipecah dengan pemisah yang sama dengan `build-kb.js`, yaitu
 * `\n## `, sehingga menyambungnya kembali dengan pemisah itu juga
 * menghasilkan berkas yang identik bita demi bita. Blok yang tidak disunting
 * disimpan APA ADANYA dalam bentuk mentah dan ditulis kembali tanpa disentuh —
 * penyuntingan satu masalah tidak boleh memformat ulang enam masalah lain.
 *
 * @returns {{kepala: string, blok: Array<{mentah: string, masalah: object|null}>}}
 */
export function uraiBerkas(divisi, isi) {
  const bagian = isi.split(/\n## /);

  return {
    // Judul berkas dan catatan pembuka — bukan blok masalah
    kepala: bagian[0],
    blok: bagian.slice(1).map((mentah) => ({ mentah, masalah: uraiBlok(divisi, mentah) }))
  };
}

/** Kebalikan `uraiBerkas` — menyambung kembali menjadi berkas Markdown utuh */
export function susunBerkas(dokumen) {
  return [dokumen.kepala, ...dokumen.blok.map((b) => b.mentah)].join('\n## ');
}

/**
 * Blok "Catatan Konfirmasi Engineer" pada satu berkas, bila ada.
 *
 * Ditampilkan BACA-SAJA di penyunting. Penanda `[KONFIRMASI]` bukan langkah
 * SOP melainkan daftar hal yang hanya engineer lapangan yang tahu — merek
 * perangkat, nama WiFi, prosedur internal. Membiarkannya disunting sebagai
 * teks bebas lewat peramban menghapus perbedaan itu.
 *
 * @returns {{judul: string, butir: string[]}|null}
 */
export function catatanKonfirmasi(dokumen) {
  const blok = dokumen.blok.find(
    (b) => /^Catatan Konfirmasi Engineer\s*$/im.test(b.mentah.split('\n')[0])
  );
  if (!blok) return null;

  const butir = blok.mentah
    .split('\n')
    .map((b) => b.trim())
    .filter((b) => b.includes('[KONFIRMASI]'))
    .map((b) => b.replace(/^\s*[-*]\s*/, '').replace(/\[KONFIRMASI\]\s*/, '').trim());

  return { judul: 'Catatan Konfirmasi Engineer', butir };
}

/* ────────────────────────────────────────────────────────────────
   Penyusun Markdown
   ──────────────────────────────────────────────────────────────── */

/**
 * Lepaskan awalan "Solusi Pertama:" dari judul solusi agar penyunting hanya
 * menampilkan nama solusinya. Awalannya disusun ulang menurut posisi saat
 * disimpan, sehingga tidak mungkin salah ketik.
 */
export function tanpaAwalanSolusi(judulSolusi) {
  return String(judulSolusi || '')
    .replace(/^Solusi\s+(Pertama|Kedua|Ketiga|Keempat|Kelima)\s*:?\s*/i, '')
    .trim();
}

/** Susun judul bagian solusi ke-n (0-indeks) dari nama yang diketik admin */
function judulSolusiKe(indeks, nama) {
  const awalan = AWALAN_SOLUSI[indeks] || `Solusi ke-${indeks + 1}`;
  const bersih = String(nama || '').trim();
  // Tanpa nama, tanda titik dua akan menggantung tanpa isi
  return bersih ? `${awalan}: ${bersih}` : awalan;
}

const rapikanBaris = (t) => String(t == null ? '' : t).replace(/\r\n/g, '\n').trim();

/**
 * Susun satu blok masalah menjadi Markdown — kebalikan `uraiBlok`.
 *
 * Keluarannya adalah isi blok TANPA awalan `## `, sama seperti bentuk yang
 * diterima `uraiBlok`, sehingga hasilnya dapat langsung dimasukkan kembali ke
 * `dokumen.blok[i].mentah`.
 *
 * @param {object} masalah Bentuk yang dipakai penyunting (lihat `bentukUntukPenyunting`)
 * @param {boolean} pemisah Sertakan garis `---` di akhir blok
 */
export function susunBlok(masalah, pemisah = true) {
  const bagian = [rapikanBaris(masalah.judul), ''];

  const gejala = rapikanBaris(masalah.gejala);
  if (gejala) {
    bagian.push('### Gejala yang Dirasakan User', gejala, '');
  }

  const penyebab = (masalah.penyebab || []).map(rapikanBaris).filter(Boolean);
  if (penyebab.length > 0) {
    bagian.push('### Penyebab yang Mungkin Terjadi', ...penyebab.map((p) => `- ${p}`), '');
  }

  if (masalah.kategori === 'berat') {
    // Masalah berat tidak punya daftar solusi: yang ada hanyalah keterangan
    // penanganan, dan penanganannya memang bukan di sisi pengguna.
    const penanganan = rapikanBaris(masalah.penanganan);
    if (penanganan) bagian.push('### Penanganan', penanganan, '');
  } else {
    const daftar = (masalah.solusi || [])
      .map((s) => ({
        judul: rapikanBaris(s.judul),
        pengantar: rapikanBaris(s.pengantar),
        langkah: (s.langkah || []).map(rapikanBaris).filter(Boolean)
      }))
      // Solusi tanpa satu pun langkah tidak dikenali pengurai, jadi menuliskannya
      // hanya akan menghasilkan bagian yang lenyap diam-diam saat dibangun.
      .filter((s) => s.langkah.length > 0);

    // Sebagian besar berkas divisi mode engineer memakai satu daftar langkah
    // biasa berjudul "Langkah Penyelesaian", bukan bagian "Solusi Pertama"
    // dan seterusnya. Bentuk itu dipertahankan apa adanya selama solusinya
    // masih satu -- menulisnya ulang sebagai "Solusi Pertama: Langkah
    // Penyelesaian" mengubah judul yang sampai ke pengguna tanpa ada yang
    // memintanya. Begitu solusi kedua ditambahkan, barulah bentuknya berpindah
    // ke penomoran Solusi Pertama/Kedua/Ketiga.
    const langkahTunggal = daftar.length === 1 && daftar[0].judul === JUDUL_LANGKAH_TUNGGAL;

    daftar.forEach((s, i) => {
      bagian.push(`### ${langkahTunggal ? JUDUL_LANGKAH_TUNGGAL : judulSolusiKe(i, s.judul)}`);
      if (s.pengantar) bagian.push(s.pengantar);
      bagian.push(...s.langkah.map((l, n) => `${n + 1}. ${l}`), '');
    });
  }

  bagian.push(
    '### Kategori',
    masalah.kategori === 'berat' ? 'Masalah Berat - Eskalasi ke Engineer' : 'Masalah Ringan'
  );

  if (pemisah) bagian.push('', '---');

  // Setiap blok kecuali yang terakhir diakhiri baris kosong, karena
  // penyambungnya adalah "\n## " — bukan "\n\n## ".
  return bagian.join('\n') + '\n';
}

/**
 * Benar bila blok mentah diakhiri garis pemisah `---`.
 *
 * Hampir semua blok diakhiri pemisah, kecuali blok terakhir pada sebagian
 * berkas. Keberadaannya ditiru apa adanya supaya menyunting satu masalah tidak
 * menambah atau menghilangkan pemisah yang tidak ada urusannya dengan suntingan
 * itu.
 */
export function berpemisah(mentah) {
  return /\n---\s*$/.test(mentah);
}

/* ────────────────────────────────────────────────────────────────
   Bentuk untuk penyunting
   ──────────────────────────────────────────────────────────────── */

/**
 * Ubah hasil `uraiBlok` menjadi bentuk yang dipakai formulir penyunting.
 * Perbedaannya hanya pada judul solusi: awalannya dilepas supaya admin
 * mengetik nama solusinya saja.
 */
export function bentukUntukPenyunting(masalah) {
  return {
    id: masalah.id,
    divisi: masalah.divisi,
    judul: masalah.judul,
    gejala: masalah.gejala,
    kategori: masalah.kategori,
    penyebab: masalah.penyebab,
    penanganan: masalah.penanganan,
    solusi: masalah.solusi.map((s) => ({
      judul: s.judul === JUDUL_LANGKAH_TUNGGAL ? s.judul : tanpaAwalanSolusi(s.judul),
      pengantar: s.pengantar,
      langkah: s.langkah
    })),
    jumlahSolusi: masalah.solusi.length
  };
}

/**
 * Periksa masukan penyunting sebelum apa pun ditulis ke berkas.
 * @returns {string[]} daftar galat; kosong berarti sah
 */
export function periksaMasalah(masukan) {
  const galat = [];

  if (!rapikanBaris(masukan.judul)) galat.push('Judul masalah wajib diisi');
  if (!['ringan', 'berat'].includes(masukan.kategori)) {
    galat.push('Kategori harus "ringan" atau "berat"');
  }
  if (!Array.isArray(masukan.penyebab)) galat.push('Penyebab harus berupa daftar');

  if (masukan.kategori === 'berat') {
    if (!rapikanBaris(masukan.penanganan)) {
      galat.push('Masalah berat wajib punya keterangan penanganan');
    }
    return galat;
  }

  const solusi = Array.isArray(masukan.solusi) ? masukan.solusi : [];
  const terpakai = solusi.filter((s) => (s?.langkah || []).some((l) => rapikanBaris(l)));

  if (terpakai.length === 0) {
    galat.push('Masalah ringan wajib punya minimal satu solusi berisi langkah');
  }
  if (solusi.length > MAKS_SOLUSI) {
    galat.push(`Maksimal ${MAKS_SOLUSI} solusi per masalah`);
  }

  // Alur percakapan menjanjikan tiga solusi sebelum menyerah ke engineer.
  // Kekurangannya bukan galat -- SOP boleh disimpan bertahap -- tetapi
  // pengujian "Kelengkapan data divisi swalayan" menuntut tiga pada divisi
  // swalayan, jadi peringatannya disampaikan di sisi penyunting.

  return galat;
}
