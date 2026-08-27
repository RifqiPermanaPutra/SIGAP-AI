import { spawn } from 'child_process';
import fs from 'fs';
const CHROME='C:\Program Files\Google\Chrome\Application\chrome.exe';
const PORT=9346, ASAL='http://localhost:3010';
const tunggu=(ms)=>new Promise(r=>setTimeout(r,ms));
const chrome=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\chrome-ambil2`,'--no-first-run','--disable-gpu','--hide-scrollbars','about:blank'],{stdio:'ignore'});
async function ws(){for(let i=0;i<60;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const t=(await r.json()).find(x=>x.type==='page'); if(t?.webSocketDebuggerUrl) return t.webSocketDebuggerUrl;}catch{} await tunggu(300);} throw new Error('chrome');}
const s=new WebSocket(await ws()); await new Promise((r,j)=>{s.onopen=r;s.onerror=j;});
let id=1; const tunda=new Map();
s.onmessage=(e)=>{const p=JSON.parse(e.data); if(p.id&&tunda.has(p.id)){const{res,rej}=tunda.get(p.id);tunda.delete(p.id);p.error?rej(new Error(p.error.message)):res(p.result);}};
const cdp=(m,p={})=>new Promise((res,rej)=>{const i=id++;const j=setTimeout(()=>{tunda.delete(i);rej(new Error(m));},25000);
  tunda.set(i,{res:v=>{clearTimeout(j);res(v);},rej:e=>{clearTimeout(j);rej(e);}}); s.send(JSON.stringify({id:i,method:m,params:p}));});
const js=(k)=>cdp('Runtime.evaluate',{expression:`(async()=>{${k}})()`,awaitPromise:true,returnByValue:true});
await cdp('Page.enable'); await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:2,mobile:false});
async function potret(nama){
  await js(`document.getAnimations?.().forEach(a=>{try{a.finish()}catch{}}); const s=document.createElement('style');
    s.textContent='*,*::before,*::after{animation:none!important;transition:none!important}'; document.head.appendChild(s); return 1;`);
  await tunggu(400);
  const r=await cdp('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync('dokumentasi/tangkapan-layar/'+nama+'.png',Buffer.from(r.data,'base64'));
  console.log('  '+nama);
}
await cdp('Page.navigate',{url:ASAL+'/'}); await tunggu(2600);
await potret('02-beranda-layar-pertama');
await js(`document.getElementById('hero-start-btn')?.click(); await new Promise(r=>setTimeout(r,1300)); return 1;`);
await potret('03-modal-pilih-layanan');
s.close(); chrome.kill(); process.exit(0);
