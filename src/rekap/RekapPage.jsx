import React, { useState, useEffect, useCallback } from 'react';
import { GrafikPeriode, BatangSebaran } from './Grafik.jsx';
import './rekap.css';

const API = '/api';

/* ────────────────────────────────────────────────────────────────
   Bantuan tanggal & penyajian
   ──────────────────────────────────────────────────────────────── */

const WIB_MS = 7 * 60 * 60 * 1000;

/** Tanggal hari ini menurut WIB, bentuk 'YYYY-MM-DD' */
function hariIniWIB(geserHari = 0) {
  const t = Date.now() + WIB_MS - geserHari * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

function awalBulanWIB() {
  return hariIniWIB().slice(0, 8) + '01';
}

function jamWIB(iso) {
  if (!iso) return '—';
  const d = new Date(new Date(iso).getTime() + WIB_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}.${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function tanggalID(t) {
  if (!t) return '—';
  const [th, bl, hr] = t.split('-');
  return `${hr}/${bl}/${th}`;
}

function durasi(detik) {
  if (detik === null || detik === undefined || detik < 0) return '—';
  if (detik < 60) return `${detik} dtk`;
  const menit = Math.round(detik / 60);
  if (menit < 60) return `${menit} mnt`;
  return `${Math.floor(menit / 60)}j ${menit % 60}m`;
}

const LABEL_STATUS = {
  aktif: 'Aktif',
  selesai: 'Selesai',
  diteruskan: 'Diteruskan',
  ditinggalkan: 'Ditinggalkan'
};

/* ────────────────────────────────────────────────────────────────
   Halaman masuk
   ──────────────────────────────────────────────────────────────── */

function Masuk({ onBerhasil }) {
  const [namaAkun, setNamaAkun] = useState('');
  const [sandi, setSandi] = useState('');
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const kirim = async (e) => {
    e.preventDefault();
    setGalat('');
    setSibuk(true);
    try {
      const res = await fetch(`${API}/auth/masuk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namaAkun, sandi })
      });
      const data = await res.json();
      if (data.success) onBerhasil(data.pengguna);
      else setGalat(data.error || 'Gagal masuk');
    } catch {
      setGalat('Tidak dapat terhubung ke server.');
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="rk-masuk-latar">
      <form className="rk-masuk" onSubmit={kirim}>
        <h1>Laporan Rekap SIGAP</h1>
        <p className="rk-masuk-sub">
          Halaman ini memuat data pelapor. Masuk dengan akun engineer atau admin.
        </p>

        <label htmlFor="rk-akun">Nama akun</label>
        <input id="rk-akun" value={namaAkun} autoComplete="username" autoFocus
               onChange={(e) => setNamaAkun(e.target.value)} />

        <label htmlFor="rk-sandi">Kata sandi</label>
        <input id="rk-sandi" type="password" value={sandi} autoComplete="current-password"
               onChange={(e) => setSandi(e.target.value)} />

        {galat && <p className="rk-galat" role="alert">{galat}</p>}

        <button type="submit" disabled={sibuk || !namaAkun || !sandi}>
          {sibuk ? 'Memeriksa…' : 'Masuk'}
        </button>
      </form>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Kotak angka ringkasan
   ──────────────────────────────────────────────────────────────── */

function Kotak({ label, nilai, satuan, keterangan, sorot }) {
  return (
    <div className={`rk-kotak ${sorot ? 'sorot' : ''}`}>
      <span className="rk-kotak-label">{label}</span>
      <span className="rk-kotak-nilai">
        {nilai}{satuan && <small>{satuan}</small>}
      </span>
      {keterangan && <span className="rk-kotak-ket">{keterangan}</span>}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Halaman utama
   ──────────────────────────────────────────────────────────────── */

export default function RekapPage() {
  const [pengguna, setPengguna] = useState(undefined);   // undefined = belum diperiksa
  const [data, setData] = useState(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');
  const [tandai, setTandai] = useState(null);            // tiket yang sedang ditandai

  // Waktu penyusunan laporan, dicetak pada catatan kaki. Diperbarui tepat
  // sebelum jendela cetak dibuka, supaya berkas PDF membawa jam cetaknya
  // sendiri — bukan jam halaman ini pertama kali dibuka berjam-jam sebelumnya.
  const [waktuSusun, setWaktuSusun] = useState(() => new Date());

  const [f, setF] = useState({
    dari: awalBulanWIB(),
    sampai: hariIniWIB(),
    divisi: '',
    status: '',
    area: '',
    urgensi: '',
    cari: ''
  });
  const [satuan, setSatuan] = useState('hari');

  // Periksa sesi yang mungkin masih berlaku
  useEffect(() => {
    fetch(`${API}/auth/saya`)
      .then((r) => r.json())
      .then((d) => setPengguna(d.pengguna))
      .catch(() => setPengguna(null));
  }, []);

  const ambil = useCallback(async () => {
    setMemuat(true);
    setGalat('');
    try {
      const q = new URLSearchParams({ ...f, satuan });
      for (const [k, v] of [...q]) if (!v) q.delete(k);

      const res = await fetch(`${API}/rekap?${q}`);
      if (res.status === 401) { setPengguna(null); return; }

      const d = await res.json();
      if (d.success) setData(d);
      else setGalat(d.error || 'Gagal memuat rekap');
    } catch {
      setGalat('Tidak dapat terhubung ke server.');
    } finally {
      setMemuat(false);
    }
  }, [f, satuan]);

  useEffect(() => { if (pengguna) ambil(); }, [pengguna, ambil]);

  const keluar = async () => {
    await fetch(`${API}/auth/keluar`, { method: 'POST' });
    setPengguna(null);
    setData(null);
  };

  const setPreset = (dari, sampai, satuanBaru) => {
    setF((v) => ({ ...v, dari, sampai }));
    if (satuanBaru) setSatuan(satuanBaru);
  };

  const unduhExcel = () => {
    const q = new URLSearchParams(f);
    for (const [k, v] of [...q]) if (!v) q.delete(k);
    window.location.href = `${API}/rekap/excel?${q}`;
  };

  const cetak = async () => {
    // Dicatat lebih dulu: berkas PDF hasil cetak keluar dari kendali sistem
    // begitu tersimpan, sehingga jejaknya perlu ada di sisi ini.
    try {
      await fetch(`${API}/rekap/catat-cetak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periode: `${f.dari} s/d ${f.sampai}` })
      });
    } catch { /* pencetakan tetap boleh berjalan */ }
    setWaktuSusun(new Date());
    // Tunggu satu putaran render agar catatan kaki sudah memuat jam terbaru
    // sebelum peramban mengambil cuplikan halamannya.
    setTimeout(() => window.print(), 0);
  };

  const kirimTandai = async (catatan) => {
    try {
      const res = await fetch(`${API}/rekap/tandai-selesai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomorTiket: tandai.nomor_tiket, catatan })
      });
      const d = await res.json();
      if (!d.success) { setGalat(d.error); return; }
      setTandai(null);
      ambil();
    } catch {
      setGalat('Gagal menandai tiket.');
    }
  };

  if (pengguna === undefined) return <div className="rk-tunggu">Memuat…</div>;
  if (pengguna === null) return <Masuk onBerhasil={setPengguna} />;

  const r = data?.ringkasan;

  return (
    <div className="rk">
      <header className="rk-atas">
        <div>
          <h1>Laporan Rekap SIGAP</h1>
          <p>Pertamina EP Asset 1 Regional 1 Field Lirik</p>
        </div>
        <div className="rk-atas-kanan rk-sembunyi-cetak">
          <span className="rk-pengguna">
            {pengguna.nama} · <em>{pengguna.peran}</em>
          </span>
          <button className="rk-tombol-samar" onClick={keluar}>Keluar</button>
        </div>
      </header>

      {/* ── Saringan ── */}
      <section className="rk-saringan rk-sembunyi-cetak" aria-label="Saringan laporan">
        <div className="rk-preset">
          <button onClick={() => setPreset(hariIniWIB(), hariIniWIB(), 'hari')}>Hari ini</button>
          <button onClick={() => setPreset(hariIniWIB(6), hariIniWIB(), 'hari')}>7 hari</button>
          <button onClick={() => setPreset(hariIniWIB(29), hariIniWIB(), 'hari')}>30 hari</button>
          <button onClick={() => setPreset(awalBulanWIB(), hariIniWIB(), 'hari')}>Bulan ini</button>
          <button onClick={() => setPreset(hariIniWIB(364), hariIniWIB(), 'bulan')}>1 tahun</button>
        </div>

        <div className="rk-kolom-saringan">
          <label>Dari
            <input type="date" value={f.dari} onChange={(e) => setF({ ...f, dari: e.target.value })} />
          </label>
          <label>Sampai
            <input type="date" value={f.sampai} onChange={(e) => setF({ ...f, sampai: e.target.value })} />
          </label>
          <label>Layanan
            <select value={f.divisi} onChange={(e) => setF({ ...f, divisi: e.target.value })}>
              <option value="">Semua</option>
              {data?.pilihan.divisi.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label>Status
            <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option value="">Semua</option>
              {Object.entries(LABEL_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>Area
            <select value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}>
              <option value="">Semua</option>
              {data?.pilihan.area.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label>Urgensi
            <select value={f.urgensi} onChange={(e) => setF({ ...f, urgensi: e.target.value })}>
              <option value="">Semua</option>
              {data?.pilihan.urgensi.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label className="rk-cari">Cari
            <input type="search" placeholder="tiket, nama, atau kata dalam keluhan"
                   value={f.cari} onChange={(e) => setF({ ...f, cari: e.target.value })} />
          </label>
        </div>

        <div className="rk-aksi">
          {pengguna.peran === 'admin' && (
            <button className="rk-tombol-utama" onClick={unduhExcel}>Unduh Excel</button>
          )}
          <button className="rk-tombol-samar" onClick={cetak}>Cetak / Simpan PDF</button>
        </div>
      </section>

      <p className="rk-periode-cetak">
        Periode {tanggalID(f.dari)} – {tanggalID(f.sampai)}
      </p>

      {galat && <p className="rk-galat" role="alert">{galat}</p>}
      {memuat && <p className="rk-tunggu">Memuat data…</p>}

      {r && (
        <>
          {/* ── Angka ringkasan ── */}
          <section className="rk-kotak-baris" aria-label="Ringkasan periode">
            <Kotak label="Total laporan" nilai={r.total} />
            <Kotak label="Selesai mandiri" nilai={r.persen_mandiri} satuan="%" sorot
                   keterangan={`${r.selesai} dari ${r.selesai + r.diteruskan} laporan tuntas`} />
            <Kotak label="Diteruskan ke engineer" nilai={r.diteruskan}
                   keterangan={r.ditangani > 0 ? `${r.ditangani} sudah ditandai selesai` : 'belum ada yang ditandai selesai'} />
            <Kotak label="Ditinggalkan" nilai={r.ditinggalkan}
                   keterangan="pengguna pergi di tengah jalan" />
            <Kotak label="Rata-rata durasi" nilai={durasi(r.rata_durasi)} />
            <Kotak label="Rata-rata waktu tanggap" nilai={durasi(r.rata_tanggap)}
                   keterangan="diteruskan → ditandai selesai" />
          </section>

          {/* ── Grafik periode ── */}
          <section className="rk-panel">
            <div className="rk-panel-atas">
              <h2>Laporan masuk per {satuan}</h2>
              <div className="rk-satuan rk-sembunyi-cetak">
                {['hari', 'minggu', 'bulan'].map((s) => (
                  <button key={s} className={satuan === s ? 'aktif' : ''}
                          onClick={() => setSatuan(s)}>{s}</button>
                ))}
              </div>
            </div>
            <GrafikPeriode deret={data.deret} satuan={satuan} />
          </section>

          {/* ── Sebaran ── */}
          <section className="rk-kisi">
            <div className="rk-panel">
              <h2>Sebaran per layanan</h2>
              <BatangSebaran data={data.sebaranDivisi} />
            </div>
            <div className="rk-panel">
              <h2>Tingkat urgensi</h2>
              <BatangSebaran data={data.sebaranUrgensi} kosong="Belum ada laporan yang diteruskan." />
            </div>
            <div className="rk-panel">
              <h2>Sebaran per area</h2>
              <BatangSebaran data={data.sebaranArea} kosong="Belum ada laporan yang diteruskan." />
            </div>
            <div className="rk-panel">
              <h2>Sebaran per fungsi</h2>
              <BatangSebaran data={data.sebaranFungsi} kosong="Belum ada laporan yang diteruskan." />
            </div>
          </section>

          {/* ── Keluhan belum dikenali ── */}
          {data.takDikenali.length > 0 && (
            <section className="rk-panel">
              <h2>Keluhan yang belum dikenali</h2>
              <p className="rk-panel-ket">
                Keluhan berskor mendekati 0,4 hanya kurang satu-dua kata kunci pada SOP —
                inilah daftar perbaikan basis pengetahuan yang paling murah.
              </p>
              <div className="rk-gulir">
                <table className="rk-tabel">
                  <thead>
                    <tr><th>Tanggal</th><th>Layanan</th><th>Keluhan</th><th>Skor</th><th>Terdekat</th></tr>
                  </thead>
                  <tbody>
                    {data.takDikenali.map((k) => (
                      <tr key={k.nomor_tiket}>
                        <td>{tanggalID(k.tanggal_wib)}</td>
                        <td>{k.divisi_nama}</td>
                        <td className="rk-keluhan">{k.keluhan}</td>
                        <td className="rk-angka">{(k.skor_cocok ?? 0).toFixed(2)}</td>
                        <td>{k.masalah_cocok || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Tabel rinci ── */}
          <section className="rk-panel">
            <div className="rk-panel-atas">
              <h2>Daftar laporan</h2>
              <span className="rk-panel-ket">
                {data.jumlah} laporan{data.jumlah > data.laporan.length && ` · menampilkan ${data.laporan.length} terbaru`}
              </span>
            </div>
            <div className="rk-gulir">
              <table className="rk-tabel">
                <thead>
                  <tr>
                    <th>Tiket</th><th>Tanggal</th><th>Mulai</th><th>Berakhir</th><th>Durasi</th>
                    <th>Layanan</th><th>Keluhan</th><th>Pelapor</th><th>Fungsi</th>
                    <th>Lokasi</th><th>Urgensi</th><th>Tanggap</th><th>Status</th>
                    <th className="rk-sembunyi-cetak">Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {data.laporan.map((l) => (
                    <tr key={l.nomor_tiket}>
                      <td className="rk-tiket">{l.nomor_tiket}</td>
                      <td>{tanggalID(l.tanggal_wib)}</td>
                      <td>{jamWIB(l.dibuat_pada)}</td>
                      <td>{jamWIB(l.berakhir_pada)}</td>
                      <td>{durasi(l.durasi_detik)}</td>
                      <td>{l.divisi_nama}</td>
                      <td className="rk-keluhan">{l.keluhan || '—'}</td>
                      <td>{l.nama || '—'}</td>
                      <td>{l.fungsi || '—'}</td>
                      <td>{l.lokasi || '—'}</td>
                      <td>{l.urgensi || '—'}</td>
                      <td>{durasi(l.waktu_tanggap)}</td>
                      <td>
                        <span className={`rk-status rk-status-${l.status}`}>
                          {LABEL_STATUS[l.status] || l.status}
                        </span>
                      </td>
                      <td className="rk-sembunyi-cetak">
                        {l.status === 'diteruskan' && !l.ditangani_pada ? (
                          <button className="rk-tombol-kecil" onClick={() => setTandai(l)}>
                            Tandai selesai
                          </button>
                        ) : l.ditangani_pada ? (
                          <span className="rk-selesai-oleh" title={l.catatan || ''}>
                            ✓ {l.ditangani_oleh}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="rk-kaki">
            Dokumen internal — memuat data pegawai.
            Disusun {waktuSusun.toLocaleString('id-ID')} oleh {pengguna.nama} ({pengguna.namaAkun}).
            <br />
            Status <em>diteruskan</em> berarti laporan berpindah tangan ke engineer,
            bukan bahwa kendalanya sudah tuntas.
          </footer>
        </>
      )}

      {tandai && <DialogTandai tiket={tandai} onBatal={() => setTandai(null)} onKirim={kirimTandai} />}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Dialog penandaan selesai
   ──────────────────────────────────────────────────────────────── */

function DialogTandai({ tiket, onBatal, onKirim }) {
  const [catatan, setCatatan] = useState('');

  return (
    <div className="rk-dialog-latar" onClick={onBatal}>
      <div className="rk-dialog" role="dialog" aria-modal="true"
           aria-label="Tandai tiket selesai" onClick={(e) => e.stopPropagation()}>
        <h3>Tandai tiket selesai</h3>
        <p className="rk-dialog-tiket">{tiket.nomor_tiket} · {tiket.divisi_nama}</p>
        <p className="rk-dialog-keluhan">{tiket.keluhan}</p>

        <label htmlFor="rk-catatan">Tindakan yang dilakukan <small>(boleh dikosongkan)</small></label>
        <textarea id="rk-catatan" rows="3" value={catatan} autoFocus
                  placeholder="Contoh: kabel LAN diganti, port switch dipindah"
                  onChange={(e) => setCatatan(e.target.value)} />

        <div className="rk-dialog-aksi">
          <button className="rk-tombol-samar" onClick={onBatal}>Batal</button>
          <button className="rk-tombol-utama" onClick={() => onKirim(catatan)}>Tandai selesai</button>
        </div>
      </div>
    </div>
  );
}
