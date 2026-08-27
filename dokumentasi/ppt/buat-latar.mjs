/**
 * Buat gambar latar bergradasi untuk deck.
 *
 * pptxgenjs tidak mendukung isian bergradasi sama sekali — satu-satunya cara
 * memberi kedalaman warna pada slide adalah memakai gambar sebagai latar.
 * Digambar dengan Chrome supaya gradasinya halus, bukan bertingkat.
 *
 * Seluruh warna diambil dari palet proyek: biru #006cb8, hijau #acc42a,
 * merah #ed1b2f.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9352;
const KELUAR = 'D:/KILAT/KILAT-Ketersediaan-Informasi-Layanan-ICT-Terpadu-main/dokumentasi/ppt/latar';
const W = 1920, H = 1080;
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

/** Bintik halus supaya bidang warna besar tidak terlihat rata mati */
const BINTIK = `background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='.32'/%3E%3C/svg%3E");`;

const latar = {
  /* Gelap — untuk slide judul, pembatas, dan penutup */
  gelap: `
    background:
      radial-gradient(1100px 780px at 88% 6%, rgba(0,108,184,.55) 0%, rgba(0,108,184,0) 62%),
      radial-gradient(760px 620px at 6% 96%, rgba(172,196,42,.20) 0%, rgba(172,196,42,0) 60%),
      radial-gradient(620px 520px at 52% 52%, rgba(63,157,224,.16) 0%, rgba(63,157,224,0) 65%),
      linear-gradient(152deg, #002B47 0%, #00395E 44%, #004876 100%);`,

  /* Terang — slide isi utama */
  terang: `
    background:
      radial-gradient(900px 680px at 96% 2%, rgba(0,108,184,.13) 0%, rgba(0,108,184,0) 60%),
      radial-gradient(720px 560px at 2% 98%, rgba(172,196,42,.16) 0%, rgba(172,196,42,0) 58%),
      linear-gradient(168deg, #FFFFFF 0%, #F4F8FC 58%, #EAF2F9 100%);`,

  /* Hijau — untuk slide yang perlu dibedakan dari sekitarnya */
  hijau: `
    background:
      radial-gradient(880px 640px at 4% 4%, rgba(172,196,42,.30) 0%, rgba(172,196,42,0) 62%),
      radial-gradient(700px 540px at 98% 92%, rgba(0,108,184,.14) 0%, rgba(0,108,184,0) 60%),
      linear-gradient(160deg, #FCFDF6 0%, #F5F8E8 55%, #EEF3DC 100%);`,

  /* Biru muda — pergantian irama di tengah deck */
  biru: `
    background:
      radial-gradient(940px 700px at 2% 6%, rgba(0,108,184,.22) 0%, rgba(0,108,184,0) 62%),
      radial-gradient(680px 560px at 96% 94%, rgba(237,27,47,.09) 0%, rgba(237,27,47,0) 58%),
      linear-gradient(158deg, #F7FBFE 0%, #EAF3FA 56%, #DFEDF7 100%);`
};

const halaman = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0}
  body{background:#000}
  .l{position:relative;width:${W}px;height:${H}px;overflow:hidden}
  .l::after{content:'';position:absolute;inset:0;${BINTIK}
            mix-blend-mode:overlay;opacity:.055;pointer-events:none}
</style></head><body>
${Object.entries(latar).map(([nama, g]) =>
  `<div class="l" id="${nama}" style="${g.replace(/\s+/g, ' ')}"></div>`).join('\n')}
</body></html>`;

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\chrome-latar`,
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
  const jam = setTimeout(() => { tunda.delete(i); rej(new Error(`${m} timeout`)); }, 60000);
  tunda.set(i, { res: (v) => { clearTimeout(jam); res(v); }, rej: (e) => { clearTimeout(jam); rej(e); } });
  ws.send(JSON.stringify({ id: i, method: m, params: p }));
});

await cdp('Page.enable'); await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

const berkas = path.join(process.env.TEMP, 'latar-ppt.html');
fs.writeFileSync(berkas, halaman, 'utf8');
await cdp('Page.navigate', { url: 'file:///' + berkas.replace(/\\/g, '/') });
await tunggu(2500);

fs.mkdirSync(KELUAR, { recursive: true });
for (const nama of Object.keys(latar)) {
  const k = JSON.parse((await cdp('Runtime.evaluate', {
    expression: `(() => { const r = document.getElementById('${nama}').getBoundingClientRect();
      return JSON.stringify({ x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }); })()`,
    returnByValue: true
  })).result.value);
  const r = await cdp('Page.captureScreenshot', {
    format: 'jpeg', quality: 88, captureBeyondViewport: true,
    clip: { x: k.x, y: k.y, width: k.w, height: k.h, scale: 1 }
  });
  const p = path.join(KELUAR, `${nama}.jpg`);
  fs.writeFileSync(p, Buffer.from(r.data, 'base64'));
  console.log(`  ${nama.padEnd(8)} ${Math.round(fs.statSync(p).size / 1024)} KB`);
}

fs.unlinkSync(berkas);
ws.close(); chrome.kill();
process.exit(0);
