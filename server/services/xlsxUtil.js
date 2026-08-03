/**
 * Penulis berkas .xlsx sederhana — tanpa dependensi.
 *
 * Berkas .xlsx sebenarnya adalah arsip ZIP berisi beberapa berkas XML, jadi
 * dapat disusun sendiri memakai modul bawaan Node saja. Ini menghindari
 * penambahan pustaka besar hanya untuk satu tabel ekspor, sejalan dengan
 * proyek ini yang sengaja berdependensi sedikit.
 *
 * Sengaja TIDAK memakai CSV. Excel versi Indonesia lazim memakai titik-koma
 * sebagai pemisah kolom, sehingga berkas CSV bertanda koma terbaca menumpuk
 * dalam satu kolom; ditambah huruf beraksen yang rusak tanpa BOM UTF-8.
 *
 * Cakupan sengaja dibatasi pada yang dibutuhkan laporan: satu lembar, teks
 * dan angka, baris judul tebal, lebar kolom. Tidak ada rumus, tidak ada
 * penggabungan sel.
 */
import { deflateRawSync } from 'zlib';

/* ────────────────────────────────────────────────────────────────
   ZIP
   ──────────────────────────────────────────────────────────────── */

const TABEL_CRC = (() => {
  const tabel = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabel[i] = c;
  }
  return tabel;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABEL_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/**
 * Susun arsip ZIP dari daftar berkas.
 * @param {Array<{nama: string, isi: Buffer}>} berkas
 */
function buatZip(berkas) {
  const lokal = [];
  const pusat = [];
  let offset = 0;

  // Stempel waktu DOS. Nilainya tidak dipakai siapa pun di sini, tetapi
  // field-nya wajib ada, jadi dipakai waktu sekarang.
  const kini = new Date();
  const waktuDos = ((kini.getHours() << 11) | (kini.getMinutes() << 5) | (kini.getSeconds() / 2)) & 0xffff;
  const tanggalDos = (((kini.getFullYear() - 1980) << 9) | ((kini.getMonth() + 1) << 5) | kini.getDate()) & 0xffff;

  for (const { nama, isi } of berkas) {
    const namaBuf = Buffer.from(nama, 'utf8');
    const mentah = crc32(isi);
    const padat = deflateRawSync(isi, { level: 9 });

    const kepalaLokal = Buffer.alloc(30);
    kepalaLokal.writeUInt32LE(0x04034b50, 0);   // tanda kepala lokal
    kepalaLokal.writeUInt16LE(20, 4);           // versi minimum
    kepalaLokal.writeUInt16LE(0, 6);            // bendera
    kepalaLokal.writeUInt16LE(8, 8);            // metode: deflate
    kepalaLokal.writeUInt16LE(waktuDos, 10);
    kepalaLokal.writeUInt16LE(tanggalDos, 12);
    kepalaLokal.writeUInt32LE(mentah, 14);
    kepalaLokal.writeUInt32LE(padat.length, 18);
    kepalaLokal.writeUInt32LE(isi.length, 22);
    kepalaLokal.writeUInt16LE(namaBuf.length, 26);
    kepalaLokal.writeUInt16LE(0, 28);

    lokal.push(kepalaLokal, namaBuf, padat);

    const kepalaPusat = Buffer.alloc(46);
    kepalaPusat.writeUInt32LE(0x02014b50, 0);   // tanda direktori pusat
    kepalaPusat.writeUInt16LE(20, 4);
    kepalaPusat.writeUInt16LE(20, 6);
    kepalaPusat.writeUInt16LE(0, 8);
    kepalaPusat.writeUInt16LE(8, 10);
    kepalaPusat.writeUInt16LE(waktuDos, 12);
    kepalaPusat.writeUInt16LE(tanggalDos, 14);
    kepalaPusat.writeUInt32LE(mentah, 16);
    kepalaPusat.writeUInt32LE(padat.length, 20);
    kepalaPusat.writeUInt32LE(isi.length, 24);
    kepalaPusat.writeUInt16LE(namaBuf.length, 28);
    kepalaPusat.writeUInt32LE(offset, 42);

    pusat.push(kepalaPusat, namaBuf);
    offset += kepalaLokal.length + namaBuf.length + padat.length;
  }

  const isiPusat = Buffer.concat(pusat);
  const penutup = Buffer.alloc(22);
  penutup.writeUInt32LE(0x06054b50, 0);
  penutup.writeUInt16LE(berkas.length, 8);
  penutup.writeUInt16LE(berkas.length, 10);
  penutup.writeUInt32LE(isiPusat.length, 12);
  penutup.writeUInt32LE(offset, 16);

  return Buffer.concat([...lokal, isiPusat, penutup]);
}

/* ────────────────────────────────────────────────────────────────
   XML
   ──────────────────────────────────────────────────────────────── */

function amanXml(teks) {
  return String(teks)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Karakter kendali tidak sah di XML 1.0 dan membuat Excel menolak berkas.
    // Keluhan diketik pengguna, jadi kemungkinannya nyata.
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
}

/** Nomor kolom (1-basis) menjadi huruf: 1→A, 27→AA */
function hurufKolom(n) {
  let hasil = '';
  while (n > 0) {
    const sisa = (n - 1) % 26;
    hasil = String.fromCharCode(65 + sisa) + hasil;
    n = Math.floor((n - 1) / 26);
  }
  return hasil;
}

function sel(alamat, nilai, tebal) {
  const gaya = tebal ? ' s="1"' : '';

  if (typeof nilai === 'number' && Number.isFinite(nilai)) {
    return `<c r="${alamat}"${gaya}><v>${nilai}</v></c>`;
  }
  if (nilai === null || nilai === undefined || nilai === '') {
    return `<c r="${alamat}"${gaya}/>`;
  }
  // Teks ditulis sebaris (inlineStr) agar tidak perlu tabel sharedStrings
  return `<c r="${alamat}"${gaya} t="inlineStr"><is><t xml:space="preserve">${amanXml(nilai)}</t></is></c>`;
}

/* ────────────────────────────────────────────────────────────────
   Berkas penyusun
   ──────────────────────────────────────────────────────────────── */

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const RELS_WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

// Dua gaya sel: 0 biasa, 1 tebal (dipakai baris judul)
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function workbookXml(namaLembar) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${amanXml(namaLembar)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
}

/* ────────────────────────────────────────────────────────────────
   Antarmuka
   ──────────────────────────────────────────────────────────────── */

/**
 * Susun berkas .xlsx berisi satu lembar.
 *
 * @param {object} opsi
 * @param {string[]} opsi.judul     Baris judul kolom
 * @param {Array<Array<string|number|null>>} opsi.baris Isi tabel
 * @param {number[]} [opsi.lebar]   Lebar tiap kolom dalam satuan karakter
 * @param {string} [opsi.namaLembar]
 * @returns {Buffer} Isi berkas .xlsx
 */
export function buatXlsx({ judul, baris, lebar = [], namaLembar = 'Laporan' }) {
  const semua = [judul, ...baris];

  const barisXml = semua.map((isiBaris, i) => {
    const nomor = i + 1;
    const sel2 = isiBaris
      .map((nilai, k) => sel(`${hurufKolom(k + 1)}${nomor}`, nilai, i === 0))
      .join('');
    return `<row r="${nomor}">${sel2}</row>`;
  }).join('');

  const kolomXml = lebar.length
    ? `<cols>${lebar.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : '';

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${kolomXml}
<sheetData>${barisXml}</sheetData>
</worksheet>`;

  const b = (teks) => Buffer.from(teks, 'utf8');

  return buatZip([
    { nama: '[Content_Types].xml', isi: b(CONTENT_TYPES) },
    { nama: '_rels/.rels', isi: b(RELS) },
    { nama: 'xl/workbook.xml', isi: b(workbookXml(namaLembar)) },
    { nama: 'xl/_rels/workbook.xml.rels', isi: b(RELS_WORKBOOK) },
    { nama: 'xl/styles.xml', isi: b(STYLES) },
    { nama: 'xl/worksheets/sheet1.xml', isi: b(sheet) }
  ]);
}
