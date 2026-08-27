/**
 * Gambarkan spesifikasi slide sebagai HTML, lalu potret tiap slide.
 *
 * LibreOffice tidak terpasang, jadi berkas .pptx tidak dapat dirender untuk
 * diperiksa. Penggambar ini membaca spesifikasi YANG SAMA dengan pembuat
 * .pptx dan memakai satuan yang sama, sehingga cacat tata letak — tulisan
 * meluber, bentuk bertindihan, jarak tidak rata — tetap terlihat sebelum
 * berkasnya diserahkan.
 *
 * 1 inci = 96 piksel; 1 poin = 4/3 piksel.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { slides, LEBAR, TINGGI, FONT } from './spek.mjs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9350;
const AKAR = 'D:/KILAT/KILAT-Ketersediaan-Informasi-Layanan-ICT-Terpadu-main';
const KELUAR = process.argv[2] || 'pratinjau';
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

const PX = 96;
const pt = (v) => v * 4 / 3;

/** Gambar disematkan sebagai data URI supaya tidak terganjal aturan berkas lokal */
const dataUri = (jalur) => {
  const p = path.join(AKAR, jalur);
  const jenis = p.endsWith('.jpg') ? 'jpeg' : 'png';
  return `data:image/${jenis};base64,` + fs.readFileSync(p).toString('base64');
};

/** Ubah warna heksa menjadi rgba supaya bentuk dapat dibuat tembus pandang */
const rgba = (hex, a) => `rgba(${parseInt(hex.slice(0, 2), 16)},` +
  `${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)},${a})`;

function bentukHtml(e) {
  const dasar = `position:absolute;left:${e.x * PX}px;top:${e.y * PX}px;` +
    `width:${e.w * PX}px;height:${e.h * PX}px;`;

  if (e.t === 'kotak') {
    const isi = e.isi
      ? (e.alpha === undefined ? '#' + e.isi : rgba(e.isi, e.alpha))
      : 'transparent';
    return `<div style="${dasar}background:${isi};` +
      (e.garis ? `border:${e.tebalGaris || 1}px solid #${e.garis};box-sizing:border-box;` : '') +
      (e.radius ? `border-radius:${e.radius * PX}px;` : '') +
      (e.bayangan ? 'box-shadow:0 1px 3px rgba(16,23,37,.07),0 6px 18px -8px rgba(16,23,37,.10);' : '') +
      '"></div>';
  }

  if (e.t === 'gambar') {
    const muat = e.muat ? 'contain' : 'cover';
    const posisi = e.potong === 'atas' ? 'top center' : e.potong === 'bawah' ? 'bottom center' : 'center';
    return `<div style="${dasar}overflow:hidden;` +
      (e.radius ? `border-radius:${e.radius * PX}px;` : '') +
      '"><img src="' + dataUri(e.jalur) + '" style="width:100%;height:100%;' +
      `object-fit:${muat};object-position:${posisi};display:block"></div>`;
  }

  // teks
  const rata = e.valign === 'middle' ? 'center' : e.valign === 'bottom' ? 'flex-end' : 'flex-start';
  const isi = String(e.isi).split('\n').map((b) => b || '&nbsp;').join('<br>');
  return `<div style="${dasar}display:flex;flex-direction:column;justify-content:${rata};` +
    `font-family:'${e.font || FONT}',sans-serif;font-size:${pt(e.ukuran || 14)}px;` +
    `color:#${e.warna || '101725'};` +
    (e.tebal ? 'font-weight:700;' : '') +
    (e.miring ? 'font-style:italic;' : '') +
    (e.align ? `text-align:${e.align};` : '') +
    (e.spasiHuruf ? `letter-spacing:${pt(e.spasiHuruf) / 10}px;` : '') +
    `line-height:${e.spasiBaris ? pt(e.spasiBaris) + 'px' : '1.22'};` +
    `padding:${e.margin === 0 ? 0 : '0.05in'};box-sizing:border-box;` +
    `overflow-wrap:break-word;">${isi}</div>`;
}

const halaman = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0}
  body{background:#8894a4}
  .slide{position:relative;width:${LEBAR * PX}px;height:${TINGGI * PX}px;overflow:hidden;
         background-size:cover;background-position:center}
  .tepi{position:absolute;inset:0;border:1px dashed rgba(255,0,0,.28);pointer-events:none;
        margin:${0.5 * PX}px}
</style></head><body>
${slides.map((s, i) => `<div class="slide" id="s${i + 1}" style="${
  s.bg.includes('/') ? `background-image:url('${dataUri(s.bg)}')` : `background:#${s.bg}`}">
  ${s.elemen.map(bentukHtml).join('\n  ')}
  <div class="tepi"></div>
</div>`).join('\n')}
</body></html>`;

/* ── Potret tiap slide ─────────────────────────────────────────────── */

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\chrome-ppt-pratinjau`,
  '--no-first-run', '--disable-gpu', '--hide-scrollbars', 'about:blank'
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const t = (await r.json()).find((x) => x.type === 'page');
      if (t?.webSocketDebuggerUrl) return t.webSocketDebuggerUrl;
    } catch { /* belum siap */ }
    await tunggu(300);
  }
  throw new Error('chrome tidak siap');
}

const ws = new WebSocket(await wsUrl());
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

let id = 1; const tunda = new Map();
ws.onmessage = (e) => {
  const p = JSON.parse(e.data);
  if (p.id && tunda.has(p.id)) {
    const { res, rej } = tunda.get(p.id); tunda.delete(p.id);
    p.error ? rej(new Error(p.error.message)) : res(p.result);
  }
};
const cdp = (m, p = {}) => new Promise((res, rej) => {
  const i = id++;
  const jam = setTimeout(() => { tunda.delete(i); rej(new Error(`${m} timeout`)); }, 90000);
  tunda.set(i, { res: (v) => { clearTimeout(jam); res(v); }, rej: (e) => { clearTimeout(jam); rej(e); } });
  ws.send(JSON.stringify({ id: i, method: m, params: p }));
});

await cdp('Page.enable'); await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride',
  { width: Math.round(LEBAR * PX), height: Math.round(TINGGI * PX), deviceScaleFactor: 1, mobile: false });

const berkasHtml = path.join(process.env.TEMP, 'pratinjau-ppt.html');
fs.writeFileSync(berkasHtml, halaman, 'utf8');
await cdp('Page.navigate', { url: 'file:///' + berkasHtml.replace(/\\/g, '/') });
await tunggu(3500);

fs.mkdirSync(KELUAR, { recursive: true });
for (const f of fs.readdirSync(KELUAR)) if (f.endsWith('.png')) fs.unlinkSync(path.join(KELUAR, f));

for (let i = 1; i <= slides.length; i++) {
  const kotak = await cdp('Runtime.evaluate', {
    expression: `(() => { const el = document.getElementById('s${i}');
      const r = el.getBoundingClientRect();
      return JSON.stringify({ x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }); })()`,
    returnByValue: true
  });
  const k = JSON.parse(kotak.result.value);
  const r = await cdp('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: k.x, y: k.y, width: k.w, height: k.h, scale: 1 }
  });
  fs.writeFileSync(path.join(KELUAR, `slide-${String(i).padStart(2, '0')}.png`),
    Buffer.from(r.data, 'base64'));
}

console.log(`${slides.length} slide digambar ke ${KELUAR}/`);
fs.unlinkSync(berkasHtml);
ws.close(); chrome.kill();
process.exit(0);
