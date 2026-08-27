/**
 * Ubah spesifikasi slide menjadi berkas PowerPoint.
 *
 * Membaca spek.mjs — sumber yang sama dengan penggambar HTML — sehingga
 * tata letak yang sudah diperiksa lewat pratinjau muncul sama di PowerPoint.
 */
import pptxgen from 'pptxgenjs';
import fs from 'fs';
import path from 'path';
import { slides, LEBAR, TINGGI, FONT } from './spek.mjs';

const AKAR = 'D:/KILAT/KILAT-Ketersediaan-Informasi-Layanan-ICT-Terpadu-main';
const KELUARAN = process.argv[2] || 'SIGAP-Presentasi-Kerja-Praktek.pptx';

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';           // 13,333 x 7,5 inci
pres.author = 'Teknik Informatika UIR';
pres.company = 'PT Pertamina EP Asset 1 Regional 1 Field Lirik';
pres.title = 'SIGAP — Sistem Informasi Gangguan dan Aduan Pelayanan';

/** Ukuran asli gambar, untuk menghitung pemotongan yang setara object-fit */
function ukuranGambar(jalur) {
  const b = fs.readFileSync(jalur);
  if (b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  }
  // JPEG: telusuri penanda SOFn
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const tanda = b[i + 1];
    if (tanda >= 0xc0 && tanda <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(tanda)) {
      return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    }
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error('ukuran gambar tidak terbaca: ' + jalur);
}

/**
 * Hitung pemotongan agar setara `object-fit: cover` pada penggambar HTML.
 * pptxgenjs memotong dengan persentase dari tiap sisi.
 */
function potongCover(asli, bingkai, arah) {
  const rAsli = asli.w / asli.h;
  const rBingkai = bingkai.w / bingkai.h;
  if (Math.abs(rAsli - rBingkai) < 0.005) return null;

  if (rAsli > rBingkai) {
    // Gambar lebih lebar: potong kiri dan kanan
    const simpan = rBingkai / rAsli;
    const buang = (1 - simpan) / 2;
    return { l: buang, r: buang, t: 0, b: 0 };
  }
  // Gambar lebih tinggi: potong atas dan bawah
  const simpan = rAsli / rBingkai;
  const buang = 1 - simpan;
  if (arah === 'atas') return { l: 0, r: 0, t: 0, b: buang };
  if (arah === 'bawah') return { l: 0, r: 0, t: buang, b: 0 };
  return { l: 0, r: 0, t: buang / 2, b: buang / 2 };
}

for (const s of slides) {
  const slide = pres.addSlide();
  slide.background = s.bg.includes('/')
    ? { path: path.join(AKAR, s.bg) }
    : { color: s.bg };

  for (const e of s.elemen) {
    if (e.t === 'kotak') {
      const opsi = {
        x: e.x, y: e.y, w: e.w, h: e.h,
        // transparency 0-100; alpha 1 berarti pekat
        fill: e.isi
          ? { color: e.isi, ...(e.alpha === undefined ? {} : { transparency: Math.round((1 - e.alpha) * 100) }) }
          : { type: 'none' },
        line: e.garis ? { color: e.garis, width: e.tebalGaris || 1 } : { type: 'none' }
      };
      if (e.radius) opsi.rectRadius = e.radius;
      // Bayangan disusun baru tiap kali: pptxgenjs mengubah objek opsi di tempat,
      // sehingga satu objek yang dipakai bersama akan rusak pada pemakaian kedua.
      if (e.bayangan) {
        opsi.shadow = { type: 'outer', color: '101725', opacity: 0.10, blur: 10, offset: 3, angle: 90 };
      }
      slide.addShape(e.radius ? pres.ShapeType.roundRect : pres.ShapeType.rect, opsi);
      continue;
    }

    if (e.t === 'gambar') {
      const penuh = path.join(AKAR, e.jalur);
      const opsi = { path: penuh, x: e.x, y: e.y, w: e.w, h: e.h };
      if (!e.muat) {
        const potong = potongCover(ukuranGambar(penuh), { w: e.w, h: e.h }, e.potong);
        if (potong) opsi.sizing = { type: 'crop', w: e.w, h: e.h, ...potong };
      }
      slide.addImage(opsi);
      continue;
    }

    // teks
    slide.addText(String(e.isi), {
      x: e.x, y: e.y, w: e.w, h: e.h,
      fontFace: e.font || FONT,
      fontSize: e.ukuran || 14,
      color: e.warna || '101725',
      bold: Boolean(e.tebal),
      italic: Boolean(e.miring),
      align: e.align || 'left',
      valign: e.valign === 'middle' ? 'middle' : e.valign === 'bottom' ? 'bottom' : 'top',
      margin: e.margin === 0 ? 0 : 3,
      charSpacing: e.spasiHuruf || 0,
      lineSpacing: e.spasiBaris || undefined,
      wrap: true
    });
  }

  if (s.catatan) slide.addNotes(s.catatan);
}

await pres.writeFile({ fileName: KELUARAN });
console.log(`${KELUARAN} — ${slides.length} slide, ` +
  `${(fs.statSync(KELUARAN).size / 1048576).toFixed(1)} MB`);
