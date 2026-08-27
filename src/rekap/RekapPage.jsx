import React, { useState, useEffect, useCallback } from 'react';
import { GrafikPeriode, BatangSebaran } from './Grafik.jsx';
import {
  DivisionIcon, IconChart, IconDownload, IconPrint, IconLogout, IconAlert,
  IconClock, IconInbox, IconChevronDown, IconCheck, IconWhatsapp, IconWrench,
  IconFilter, IconLock
} from '../components/Icons.jsx';
import Markdown from '../components/Markdown.jsx';
import Masuk from '../components/Masuk.jsx';
import GantiSandi from '../components/GantiSandi.jsx';
import './rekap.css';

const API = '/api';

/* ────────────────────────────────────────────────────────────────
   Bantuan tanggal & penyajian
   ──────────────────────────────────────────────────────────────── */

const WIB_MS = 7 * 60 * 60 * 1000;

/** Tanggal hari ini menurut WIB, bentuk 'YYYY-MM-DD' */
function hariIniWIB(geserHari = 0) {
  return new Date(Date.now() + WIB_MS - geserHari * 86400000).toISOString().slice(0, 10);
}

const awalBulanWIB = () => hariIniWIB().slice(0, 8) + '01';

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

/**
 * Tanggal DAN jam menurut WIB dari satu timestamp UTC.
 *
 * Tanggalnya wajib ikut digeser ke WIB, bukan diambil dari sepuluh huruf
 * pertama ISO-nya: penanganan pukul 01.00 WIB tercatat sebagai hari sebelumnya
 * dalam UTC, sehingga tanggalnya akan mundur sehari sementara jamnya benar.
 */
function tanggalJamWIB(iso) {
  if (!iso) return '—';
  const d = new Date(new Date(iso).getTime() + WIB_MS);
  const tanggal = [
    String(d.getUTCDate()).padStart(2, '0'),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    d.getUTCFullYear()
  ].join('/');
  return `${tanggal} ${jamWIB(iso)}`;
}

function durasi(detik) {
  if (detik === null || detik === undefined || detik < 0) return '—';
  if (detik < 60) return `${detik} dtk`;
  const menit = Math.round(detik / 60);
  if (menit < 60) return `${menit} mnt`;
  return `${Math.floor(menit / 60)}j ${menit % 60}m`;
}

/**
 * Keadaan yang dibaca manusia pada kolom "Status".
 *
 * `status` di basis data berhenti di 'diteruskan' begitu laporan berpindah
 * tangan dan tidak pernah berubah lagi — benar sebagai catatan, salah sebagai
 * bacaan. Tiket yang sudah engineer tuntaskan tetap tertulis "Diteruskan"
 * seolah tidak ada yang mengerjakannya. Keadaannya diturunkan server (kolom
 * `keadaan`), sehingga tabel, berkas Excel, dan saringan mustahil berbeda.
 *
 * Kata "Selesai" sengaja tidak berdiri sendiri. Dua hal yang sangat berbeda
 * sama-sama berakhir tuntas — beres lewat panduan tanpa melibatkan siapa pun,
 * dan ditangani engineer di lokasi — dan seluruh nilai "Selesai mandiri" pada
 * ringkasan di atas bergantung pada perbedaan itu.
 */
const LABEL_KEADAAN = {
  aktif: 'Aktif',
  selesai: 'Selesai mandiri',
  'belum-dikerjakan': 'Belum dikerjakan',
  dikerjakan: 'Sedang dikerjakan',
  'selesai-engineer': 'Selesai ditangani',
  ditinggalkan: 'Ditinggalkan',
  diteruskan: 'Diteruskan'
};

/** Pilihan saringan — urut mengikuti perjalanan sebuah laporan */
const SARINGAN_KEADAAN = [
  'aktif', 'selesai', 'belum-dikerjakan', 'dikerjakan', 'selesai-engineer', 'ditinggalkan'
];

/* ────────────────────────────────────────────────────────────────
   Kepala berjenama — meniru navbar halaman pelapor
   ──────────────────────────────────────────────────────────────── */

/**
 * Logo Pertamina EP adalah varian untuk LATAR GELAP: wordmark "PERTAMINA"
 * digambar putih. Karena itu bidangnya wajib biru, sama seperti navbar
 * halaman pelapor. Menaruhnya di atas putih membuat tulisannya lenyap.
 */
function Merek() {
  return (
    <div className="rk-merek">
      <img
        src="/logo-sigap.png"
        alt="SATU-IT SIGAP"
        className="rk-merek-logo-unit"
      />
      <span className="rk-merek-garis" aria-hidden="true" />
      <span className="rk-merek-teks">
        <strong>SIGAP</strong>
        <small>LAPORAN REKAP · FIELD LIRIK</small>
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Kotak angka ringkasan
   ──────────────────────────────────────────────────────────────── */

function Kotak({ ikon, label, nilai, satuan, keterangan, nada }) {
  return (
    <div className={`rk-kotak ${nada || ''}`}>
      <span className="rk-kotak-ikon" aria-hidden="true">{ikon}</span>
      <span className="rk-kotak-label">{label}</span>
      <span className="rk-kotak-nilai">
        {nilai}{satuan && <small>{satuan}</small>}
      </span>
      {keterangan && <span className="rk-kotak-ket">{keterangan}</span>}
    </div>
  );
}

/** Rangka abu-abu selagi data dimuat — lebih tenang daripada tulisan "Memuat…" */
function Rangka({ tinggi = 96, jumlah = 1 }) {
  return (
    <>
      {Array.from({ length: jumlah }, (_, i) => (
        <div key={i} className="rk-rangka" style={{ height: tinggi }} aria-hidden="true" />
      ))}
    </>
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
  const [tandai, setTandai] = useState(null);
  const [galatTandai, setGalatTandai] = useState('');
  const [batal, setBatal] = useState(null);
  const [barisTerbuka, setBarisTerbuka] = useState(null);
  const [riwayat, setRiwayat] = useState({});           // id sesi → daftar pesan

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

  /* Saringan selain rentang tanggal terlipat di ponsel.
     Sebelumnya delapan kendali terbuka sekaligus menempati hampir seluruh
     layar pertama, sehingga "Total laporan" — angka yang justru dicari
     orang saat membuka halaman ini — baru muncul setelah digulir. */
  const [saringanTerbuka, setSaringanTerbuka] = useState(false);

  // Berapa saringan yang sedang membatasi hasil. Ditampilkan pada tombol
  // pelipat supaya keadaan yang tersembunyi tetap terlihat — panel tertutup
  // yang diam-diam menyaring data adalah cara termudah membuat orang salah
  // membaca angkanya.
  const jumlahSaringanAktif = [f.divisi, f.status, f.area, f.urgensi, f.cari]
    .filter(Boolean).length;

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

  const presetAktif = (dari, sampai) => f.dari === dari && f.sampai === sampai;

  const unduhExcel = () => {
    const q = new URLSearchParams(f);
    for (const [k, v] of [...q]) if (!v) q.delete(k);
    window.location.href = `${API}/rekap/excel?${q}`;
  };

  const cetak = async () => {
    try {
      await fetch(`${API}/rekap/catat-cetak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periode: `${f.dari} s/d ${f.sampai}` })
      });
    } catch { /* pencetakan tetap boleh berjalan */ }
    setWaktuSusun(new Date());
    setTimeout(() => window.print(), 0);
  };

  const kirimBatal = async () => {
    try {
      const res = await fetch(`${API}/tugas/batal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomorTiket: batal.nomor_tiket })
      });
      const d = await res.json();
      if (!d.success) { setGalat(d.error); return; }
      setBatal(null);
      ambil();
    } catch {
      setGalat('Gagal membatalkan penandaan.');
    }
  };

  const kirimTandai = async (catatan) => {
    setGalatTandai('');
    try {
      const res = await fetch(`${API}/rekap/tandai-selesai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomorTiket: tandai.nomor_tiket, catatan })
      });
      const d = await res.json();

      // Galat ditampilkan DI DALAM dialog. Sebelumnya ia dikirim ke pesan galat
      // tingkat halaman, yang berada di belakang lapisan gelap dialog dan kerap
      // sudah tergulir jauh ke atas — sehingga penolakan server terlihat sama
      // persis dengan tombol yang tidak berfungsi.
      if (!d.success) { setGalatTandai(d.error || 'Gagal menandai tiket.'); return; }

      setTandai(null);
      ambil();
    } catch {
      setGalatTandai('Tidak dapat terhubung ke server.');
    }
  };

  /**
   * Buka atau tutup rincian satu laporan.
   *
   * Percakapannya diambil sekali lalu disimpan: engineer kerap membuka
   * beberapa tiket bergantian, dan mengambil ulang tiap kali membuatnya
   * terasa lambat tanpa alasan.
   */
  const bukaBaris = async (laporan) => {
    if (barisTerbuka === laporan.nomor_tiket) {
      setBarisTerbuka(null);
      return;
    }
    setBarisTerbuka(laporan.nomor_tiket);

    if (riwayat[laporan.id]) return;
    try {
      const r = await fetch(`${API}/chat/history/${laporan.id}`);
      const d = await r.json();
      if (d.success) setRiwayat((v) => ({ ...v, [laporan.id]: d.messages }));
    } catch { /* rincian lain tetap tampil */ }
  };

  /** Saring cepat dengan mengklik batang sebaran */
  const saringDari = (kolom, label) => {
    if (kolom === 'divisi') {
      const d = data?.pilihan.divisi.find((x) => x.name === label);
      if (d) setF((v) => ({ ...v, divisi: v.divisi === d.id ? '' : d.id }));
      return;
    }
    setF((v) => ({ ...v, [kolom]: v[kolom] === label ? '' : label }));
  };

  if (pengguna === undefined) {
    return <div className="rk-tunggu">Memuat…</div>;
  }
  if (pengguna === null) {
    return (
      <Masuk
        judul="Laporan Rekap"
        sub="LAPORAN REKAP · FIELD LIRIK"
        onBerhasil={setPengguna}
      />
    );
  }

  const r = data?.ringkasan;

  /**
   * Nama lengkap dari nama akun. Yang tersimpan pada laporan tetap nama akun —
   * itulah identitas yang dapat dipertanggungjawabkan — sedangkan nama lengkap
   * hanya cara menampilkannya. Bila akunnya sudah dihapus, nama akun itu
   * sendiri yang ditampilkan; laporan lama tidak boleh kehilangan penandanya.
   */
  const namaAkun = (akun) => data?.engineer?.nama?.[akun] || akun;

  /** Engineer yang menangani sebuah layanan, untuk tiket yang masih menunggu */
  const penanggungJawab = (divisiId) => {
    const daftar = data?.engineer?.perDivisi?.[divisiId];
    if (!daftar || daftar.length === 0) return null;
    return daftar.map((e) => e.nama).join(', ');
  };

  return (
    <div className="rk-halaman">
      {/* ── Kepala berjenama ───────────────────────── */}
      <header className="rk-navbar rk-sembunyi-cetak">
        <Merek />
        <div className="rk-navbar-kanan">
          <span className="rk-pengguna">
            <strong>{pengguna.nama}</strong>
            <em>{pengguna.peran}</em>
          </span>
          <GantiSandi namaAkun={pengguna.namaAkun} kelasTombol="rk-tombol-navbar" />
          <button className="rk-tombol-navbar" onClick={keluar}>
            <IconLogout size={16} /> Keluar
          </button>
        </div>
      </header>

      <div className="rk">
        <div className="rk-judul-cetak">
          <h1>Laporan Rekap SIGAP</h1>
          <p>Pertamina EP Asset 1 Regional 1 Field Lirik</p>
          <p>Periode {tanggalID(f.dari)} – {tanggalID(f.sampai)}</p>
        </div>

        {/* Angka yang dibatasi diam-diam lebih berbahaya daripada angka yang
            ditolak: engineer Printer yang membaca "Total laporan 4" tanpa
            keterangan akan menyimpulkan seluruh Field Lirik hanya punya empat
            laporan bulan ini. Batasnya harus tertulis di tempat angkanya
            dibaca — sama seperti pada halaman /tugas. */}
        {pengguna.divisi && (
          <p className="rk-batas-wewenang">
            <IconLock size={14} />
            <span>
              Hanya layanan yang Anda tangani yang ditampilkan
              {data?.pilihan?.divisi?.length > 0 && (
                <> — <strong>{data.pilihan.divisi.map((d) => d.name).join(', ')}</strong></>
              )}.
            </span>
          </p>
        )}

        {/* ── Saringan ── */}
        <section className="rk-saringan rk-sembunyi-cetak" aria-label="Saringan laporan">
          <div className="rk-preset">
            {[
              ['Hari ini', hariIniWIB(), hariIniWIB(), 'hari'],
              ['7 hari', hariIniWIB(6), hariIniWIB(), 'hari'],
              ['30 hari', hariIniWIB(29), hariIniWIB(), 'hari'],
              ['Bulan ini', awalBulanWIB(), hariIniWIB(), 'hari'],
              ['1 tahun', hariIniWIB(364), hariIniWIB(), 'bulan']
            ].map(([label, dari, sampai, s]) => (
              <button
                key={label}
                className={presetAktif(dari, sampai) ? 'aktif' : ''}
                onClick={() => setPreset(dari, sampai, s)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Rentang tanggal TIDAK ikut terlipat. Ia yang paling sering
              disesuaikan, dan nilainya perlu terbaca sekilas untuk tahu
              angka di bawah sedang mewakili periode apa. */}
          <div className="rk-tanggal">
            <label>Dari
              <input type="date" value={f.dari} onChange={(e) => setF({ ...f, dari: e.target.value })} />
            </label>
            <label>Sampai
              <input type="date" value={f.sampai} onChange={(e) => setF({ ...f, sampai: e.target.value })} />
            </label>
          </div>

          {/* Tombol pelipat hanya tampil di ponsel — lihat rekap.css.
              Di layar lebar seluruh saringan tetap terbuka karena ruangnya
              memang ada, dan melipatnya justru menambah satu ketukan. */}
          <button
            type="button"
            className="rk-lipat"
            aria-expanded={saringanTerbuka}
            aria-controls="rk-saringan-lain"
            onClick={() => setSaringanTerbuka((v) => !v)}
          >
            <IconFilter size={16} />
            <span>Saringan lain</span>
            {jumlahSaringanAktif > 0 && (
              <span className="rk-lipat-jumlah">{jumlahSaringanAktif} aktif</span>
            )}
            <IconChevronDown
              size={16}
              className={`rk-lipat-panah${saringanTerbuka ? ' rk-terbuka' : ''}`}
            />
          </button>

          <div
            id="rk-saringan-lain"
            className={`rk-kolom-saringan${saringanTerbuka ? ' rk-terbuka' : ''}`}
          >
            <label>Layanan
              <select value={f.divisi} onChange={(e) => setF({ ...f, divisi: e.target.value })}>
                <option value="">Semua</option>
                {data?.pilihan.divisi.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label>Status
              <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                <option value="">Semua</option>
                {SARINGAN_KEADAAN.map((k) => <option key={k} value={k}>{LABEL_KEADAAN[k]}</option>)}
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

          {/* Berkas unduhan mengikuti wewenang akun, jadi tombolnya tidak
              perlu disembunyikan dari engineer. Menyembunyikannya dulu tidak
              menjaga apa pun — tombol "Cetak / Simpan PDF" di sebelahnya
              menghasilkan kolom yang praktis sama. */}
          <div className="rk-aksi">
            <button className="rk-tombol-utama" onClick={unduhExcel}>
              <IconDownload size={17} /> Unduh Excel
            </button>
            <button className="rk-tombol-samar" onClick={cetak}>
              <IconPrint size={17} /> Cetak / Simpan PDF
            </button>
          </div>
        </section>

        {galat && <p className="rk-galat" role="alert">{galat}</p>}

        {memuat && !data && (
          <div className="rk-kotak-baris"><Rangka jumlah={6} tinggi={104} /></div>
        )}

        {r && (
          <>
            {/* ── Angka ringkasan ── */}
            <section className="rk-kotak-baris" aria-label="Ringkasan periode">
              <Kotak
                ikon={<IconInbox size={17} />}
                label="Total laporan" nilai={r.total}
              />
              <Kotak
                ikon={<IconCheck size={17} />}
                label="Selesai mandiri" nilai={r.persen_mandiri} satuan="%" nada="sorot"
                keterangan={`${r.selesai} dari ${r.selesai + r.diteruskan} laporan tuntas`}
              />
              <Kotak
                ikon={<IconWhatsapp size={16} />}
                label="Diteruskan ke engineer" nilai={r.diteruskan} nada="jingga"
                keterangan={r.ditangani > 0
                  ? `${r.ditangani} sudah ditandai selesai`
                  : 'belum ada yang ditandai selesai'}
              />
              {/* Sudah dipegang engineer tetapi belum ditutup. Keadaan inilah
                  yang paling perlu diawasi: tiket yang tampak sedang ditangani
                  padahal mungkin sudah terlupakan sejak minggu lalu — dan
                  justru karena tampak sedang ditangani, tidak ada yang
                  menanyakannya. */}
              <Kotak
                ikon={<IconWrench size={17} />}
                label="Sedang dikerjakan" nilai={r.sedang_dikerjakan}
                keterangan="sudah dipegang engineer, belum ditutup"
              />
              <Kotak
                ikon={<IconChart size={17} />}
                label="Ditinggalkan" nilai={r.ditinggalkan}
                keterangan="pengguna pergi di tengah jalan"
              />
              {/* Kelompok yang paling tidak terlihat: sistem gagal menolong
                  mereka DAN mereka tidak melapor ke siapa pun, sehingga
                  kendalanya tidak muncul di mana pun kecuali angka ini. */}
              <Kotak
                ikon={<IconAlert size={17} />}
                label="Tidak lanjut ke engineer" nilai={r.ditawari_pergi}
                keterangan="sudah ditawari bantuan, tapi tidak diteruskan"
              />
              <Kotak
                ikon={<IconClock size={17} />}
                label="Rata-rata durasi" nilai={durasi(r.rata_durasi)}
              />
              <Kotak
                ikon={<IconClock size={17} />}
                label="Rata-rata waktu tanggap" nilai={durasi(r.rata_tanggap)}
                keterangan="diteruskan → ditandai selesai"
              />
            </section>

            {/* ── Grafik periode ── */}
            <section className="rk-panel">
              <div className="rk-panel-atas">
                <div>
                  <span className="rk-eyebrow"><IconChart size={13} /> VOLUME LAPORAN</span>
                  <h2>Laporan masuk per {satuan}</h2>
                </div>
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
                <p className="rk-panel-ket rk-sembunyi-cetak">Klik salah satu untuk menyaring.</p>
                <BatangSebaran data={data.sebaranDivisi}
                               onPilih={(l) => saringDari('divisi', l)}
                               terpilih={data.pilihan.divisi.find((d) => d.id === f.divisi)?.name} />
              </div>
              <div className="rk-panel">
                <h2>Tingkat urgensi</h2>
                <p className="rk-panel-ket rk-sembunyi-cetak">Klik salah satu untuk menyaring.</p>
                <BatangSebaran data={data.sebaranUrgensi} terpilih={f.urgensi}
                               onPilih={(l) => saringDari('urgensi', l)}
                               kosong="Belum ada laporan yang diteruskan." />
              </div>
              <div className="rk-panel">
                <h2>Sebaran per area</h2>
                <p className="rk-panel-ket rk-sembunyi-cetak">Klik salah satu untuk menyaring.</p>
                <BatangSebaran data={data.sebaranArea} terpilih={f.area}
                               onPilih={(l) => saringDari('area', l)}
                               kosong="Belum ada laporan yang diteruskan." />
              </div>
              <div className="rk-panel">
                <h2>Sebaran per fungsi</h2>
                <BatangSebaran data={data.sebaranFungsi}
                               kosong="Belum ada laporan yang diteruskan." />
              </div>
            </section>

            {/* ── Keefektifan tiap solusi ── */}
            {data.keefektifan?.perSolusi.some((s) => s.ditawarkan > 0) && (
              <section className="rk-panel">
                <span className="rk-eyebrow">MUTU LANGKAH SOP</span>
                <h2>Seberapa sering tiap solusi menuntaskan</h2>
                <p className="rk-panel-ket">
                  Dibaca sebagai corong: yang sampai ke Solusi Ketiga pasti sudah
                  mencoba yang pertama dan kedua. Solusi yang sering ditawarkan
                  tetapi jarang menuntaskan adalah langkah yang perlu ditulis
                  ulang — dan tanpa angka ini ia dapat bertahan bertahun-tahun
                  tanpa ada yang mempertanyakannya.
                </p>

                <ul className="rk-corong">
                  {data.keefektifan.perSolusi.map((s) => (
                    <li key={s.nomor}>
                      <span className="rk-corong-label">Solusi ke-{s.nomor}</span>
                      <span className="rk-batang-jalur">
                        <span
                          className="rk-batang-isi"
                          style={{ width: `${s.persen ?? 0}%` }}
                        />
                      </span>
                      <span className="rk-corong-nilai">
                        {s.ditawarkan === 0
                          ? '—'
                          : <><strong>{s.persen}%</strong> <em>{s.tuntas} dari {s.ditawarkan}</em></>}
                      </span>
                    </li>
                  ))}
                </ul>

                {data.keefektifan.perMasalah.length > 0 && (
                  <>
                    <h3 className="rk-sub">Masalah yang SOP-nya paling sering gagal</h3>
                    <p className="rk-panel-ket">
                      Hanya masalah dengan minimal tiga laporan — di bawah itu
                      angkanya belum berarti apa-apa.
                    </p>
                    <div className="rk-gulir">
                      <table className="rk-tabel">
                        <thead>
                          <tr>
                            <th>Masalah</th><th className="rk-angka">Laporan</th>
                            <th className="rk-angka">Tuntas</th><th className="rk-angka">Persen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.keefektifan.perMasalah.map((m) => (
                            <tr key={m.masalah}>
                              <td className="rk-keluhan">{m.masalah}</td>
                              <td className="rk-angka">{m.total}</td>
                              <td className="rk-angka">{m.tuntas}</td>
                              <td className="rk-angka">
                                <span className={`rk-skor ${m.persen >= 50 ? 'dekat' : ''}`}>
                                  {m.persen}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            )}

            {/* ── Keluhan belum dikenali ── */}
            {data.takDikenali.length > 0 && (
              <section className="rk-panel">
                <span className="rk-eyebrow">BAHAN PERBAIKAN SOP</span>
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
                          <td className="rk-angka">
                            <span className={`rk-skor ${(k.skor_cocok ?? 0) >= 0.2 ? 'dekat' : ''}`}>
                              {(k.skor_cocok ?? 0).toFixed(2)}
                            </span>
                          </td>
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
                <div>
                  <span className="rk-eyebrow">RINCIAN</span>
                  <h2>Daftar laporan</h2>
                </div>
                <span className="rk-panel-ket">
                  {data.jumlah} laporan
                  {data.jumlah > data.laporan.length && ` · menampilkan ${data.laporan.length} terbaru`}
                </span>
              </div>
              <p className="rk-panel-ket rk-sembunyi-cetak">
                Klik baris untuk melihat percakapan lengkapnya.
              </p>

              <div className="rk-gulir">
                <table className="rk-tabel rk-tabel-klik">
                  <thead>
                    <tr>
                      <th className="rk-sembunyi-cetak" aria-label="Buka rincian" />
                      <th>Tiket</th><th>Tanggal</th><th>Mulai</th><th>Berakhir</th><th>Durasi</th>
                      <th>Layanan</th><th>Keluhan</th><th>Pelapor</th><th>Fungsi</th>
                      <th>Lokasi</th><th>Urgensi</th><th>Tanggap</th><th>Status</th>
                      <th className="rk-sembunyi-cetak">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.laporan.map((l) => (
                      <React.Fragment key={l.nomor_tiket}>
                        <tr
                          className={barisTerbuka === l.nomor_tiket ? 'terbuka' : ''}
                          onClick={() => bukaBaris(l)}
                        >
                          <td className="rk-sembunyi-cetak rk-sel-buka">
                            <IconChevronDown size={15} />
                          </td>
                          <td className="rk-tiket">{l.nomor_tiket}</td>
                          <td>{tanggalID(l.tanggal_wib)}</td>
                          <td>{jamWIB(l.dibuat_pada)}</td>
                          <td>{jamWIB(l.berakhir_pada)}</td>
                          <td>{durasi(l.durasi_detik)}</td>
                          <td>
                            <span className="rk-layanan">
                              {l.divisi_id && <DivisionIcon id={l.divisi_id} size={15} />}
                              {l.divisi_nama || '—'}
                            </span>
                          </td>
                          <td className="rk-keluhan">{l.keluhan || '—'}</td>
                          <td>{l.nama || '—'}</td>
                          <td>{l.fungsi || '—'}</td>
                          <td>{l.lokasi || '—'}</td>
                          <td>
                            {l.urgensi
                              ? <span className={`rk-urgensi u-${l.urgensi.toLowerCase()}`}>{l.urgensi}</span>
                              : '—'}
                          </td>
                          <td>{durasi(l.waktu_tanggap)}</td>
                          <td>
                            <span className={`rk-status rk-status-${l.keadaan}`}>
                              {LABEL_KEADAAN[l.keadaan] || l.keadaan}
                            </span>
                          </td>
                          <td className="rk-sembunyi-cetak">
                            {l.status === 'diteruskan' && !l.ditangani_pada ? (
                              <>
                                {/* Tiket yang sudah dipegang engineer. Tanpa
                                    keterangan ini halaman rekap menjadi jalan
                                    buntu: tombolnya ditekan, formulirnya diisi,
                                    lalu server menolak dan menyuruh "ambil alih
                                    dahulu" — padahal halaman ini tidak punya
                                    tombol itu. Yang berhak menutupnya cukup
                                    melihat tombolnya; yang tidak, tahu sebabnya
                                    sebelum mencoba. */}
                                {l.dikerjakan_oleh && (
                                  <span
                                    className="rk-dikerjakan"
                                    title={`Mulai dikerjakan ${tanggalJamWIB(l.mulai_dikerjakan_pada)}`}
                                  >
                                    <IconWrench size={12} /> {namaAkun(l.dikerjakan_oleh)}
                                  </span>
                                )}

                                {(!l.dikerjakan_oleh
                                  || l.dikerjakan_oleh === pengguna.namaAkun
                                  || pengguna.peran === 'admin') && (
                                  <button
                                    className="rk-tombol-kecil"
                                    onClick={(e) => { e.stopPropagation(); setTandai(l); }}
                                  >
                                    Tandai selesai
                                  </button>
                                )}

                                {/* Siapa yang harus ditagih. Dengan delapan
                                    layanan dan engineer berbeda-beda, admin
                                    tidak seharusnya mengingatnya sendiri.
                                    Tidak perlu lagi bila tiketnya sudah
                                    dipegang orang — namanya sudah tertulis. */}
                                {!l.dikerjakan_oleh && penanggungJawab(l.divisi_id) && (
                                  <span className="rk-penanggung">
                                    {penanggungJawab(l.divisi_id)}
                                  </span>
                                )}
                              </>
                            ) : l.ditangani_pada ? (
                              <span className="rk-selesai-oleh" title={l.catatan || ''}>
                                <IconCheck size={13} /> {namaAkun(l.ditangani_oleh)}
                                {/* Salah tekan di layar ponsel bukan kejadian
                                    langka, dan tanpa jalan kembali satu ketukan
                                    keliru merusak waktu tanggap selamanya. */}
                                {pengguna.peran === 'admin' && (
                                  <button
                                    className="rk-batal"
                                    title="Batalkan penandaan — tiket kembali ke daftar tugas"
                                    onClick={(e) => { e.stopPropagation(); setBatal(l); }}
                                  >
                                    batalkan
                                  </button>
                                )}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>

                        {barisTerbuka === l.nomor_tiket && (
                          <tr className="rk-baris-rincian rk-sembunyi-cetak">
                            <td colSpan={15}>
                              <RincianLaporan laporan={l} pesan={riwayat[l.id]} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {data.laporan.length === 0 && (
                <p className="rk-kosong">Tidak ada laporan pada saringan ini.</p>
              )}
            </section>

            {/* ── Jejak akses ── */}
            {pengguna.peran === 'admin' && <JejakAkses />}

            <footer className="rk-kaki">
              Dokumen internal — memuat data pegawai.
              Disusun {waktuSusun.toLocaleString('id-ID')} oleh {pengguna.nama} ({pengguna.namaAkun}).
              <br />
              Status <em>diteruskan</em> berarti laporan berpindah tangan ke engineer,
              bukan bahwa kendalanya sudah tuntas.
            </footer>
          </>
        )}
      </div>

      {tandai && (
        <DialogTandai
          tiket={tandai}
          galat={galatTandai}
          onBatal={() => { setTandai(null); setGalatTandai(''); }}
          onKirim={kirimTandai}
        />
      )}

      {batal && (
        <div className="rk-dialog-latar" onClick={() => setBatal(null)}>
          <div className="rk-dialog" role="dialog" aria-modal="true"
               aria-label="Batalkan penandaan selesai" onClick={(e) => e.stopPropagation()}>
            <h3>Batalkan penandaan selesai?</h3>
            <p className="rk-dialog-tiket">{batal.nomor_tiket} · {batal.divisi_nama}</p>
            <p className="rk-dialog-keluhan">
              Tiket ini akan kembali ke daftar tugas engineer. Catatan penanganan
              dan waktu tanggapnya ikut dikosongkan.
              <br /><br />
              Ditandai selesai oleh <strong>{batal.ditangani_oleh}</strong>.
              Riwayat siapa menandai dan siapa membatalkan tetap tersimpan pada
              jejak akses.
            </p>
            <div className="rk-dialog-aksi">
              <button className="rk-tombol-samar" onClick={() => setBatal(null)}>Tidak jadi</button>
              <button className="rk-tombol-utama" onClick={kirimBatal}>Ya, batalkan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Jejak akses
   ──────────────────────────────────────────────────────────────── */

const LABEL_TINDAKAN = {
  masuk: 'Masuk',
  lihat: 'Membuka rekap',
  'unduh-excel': 'Mengunduh Excel',
  cetak: 'Mencetak PDF',
  'mulai-kerjakan': 'Mulai mengerjakan',
  'ambil-alih': 'Mengambil alih tugas',
  'lepas-tugas': 'Melepas tugas',
  'tandai-selesai': 'Menandai selesai',
  'batal-tandai-selesai': 'Membatalkan penandaan',
  'sop-dibuka': 'Membuka SOP',
  'sop-disunting': 'Menyunting SOP'
};

/**
 * Siapa membuka, mengunduh, dan mengubah apa.
 *
 * Pencatatannya sudah berjalan sejak awal (RANCANGAN-DATA.md §10), tetapi
 * selama ini tidak ada satu pun halaman yang menampilkannya — sehingga
 * alasan pencatatannya, *"bila dipertanyakan siapa yang menyebarkan daftar
 * tersebut, jawabannya tersedia"*, baru benar-benar terpenuhi sekarang.
 *
 * Dimuat hanya saat dibuka: isinya jarang diperlukan, dan menariknya di setiap
 * pemuatan halaman berarti 200 baris tambahan yang hampir selalu terbuang.
 */
function JejakAkses() {
  const [akses, setAkses] = useState(null);
  const [terbuka, setTerbuka] = useState(false);

  const buka = async () => {
    const baru = !terbuka;
    setTerbuka(baru);
    if (!baru || akses) return;
    try {
      const r = await fetch(`${API}/rekap/akses`);
      const d = await r.json();
      if (d.success) setAkses(d.akses);
    } catch {
      setAkses([]);
    }
  };

  return (
    <section className="rk-panel rk-sembunyi-cetak">
      <button type="button" className="rk-jejak-buka" onClick={buka} aria-expanded={terbuka}>
        <span>
          <span className="rk-eyebrow">JEJAK AKSES</span>
          <h2>Siapa membuka dan mengubah apa</h2>
        </span>
        <IconChevronDown size={18} className={terbuka ? 'terbuka' : ''} />
      </button>

      {terbuka && (
        <>
          <p className="rk-panel-ket">
            Halaman ini memuat nama pegawai asli. Bila suatu saat dipertanyakan
            siapa yang menyebarkan daftarnya, jawabannya ada di sini. Menampilkan
            200 tindakan terakhir.
          </p>

          {!akses && <p className="rk-kosong">Memuat…</p>}
          {akses && akses.length === 0 && <p className="rk-kosong">Belum ada tindakan tercatat.</p>}

          {akses && akses.length > 0 && (
            <div className="rk-gulir">
              <table className="rk-tabel">
                <thead>
                  <tr><th>Waktu</th><th>Akun</th><th>Tindakan</th><th>Keterangan</th></tr>
                </thead>
                <tbody>
                  {akses.map((a) => (
                    <tr key={a.id}>
                      <td>{tanggalJamWIB(a.dibuat_pada)}</td>
                      <td className="rk-tiket">{a.nama_akun}</td>
                      <td>{LABEL_TINDAKAN[a.tindakan] || a.tindakan}</td>
                      <td className="rk-keluhan">{a.keterangan || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   Rincian satu laporan
   ──────────────────────────────────────────────────────────────── */

/**
 * Percakapan lengkap sebuah laporan.
 *
 * Inilah yang paling menghemat waktu engineer: sebelum menelepon pelapor, ia
 * dapat melihat langkah apa saja yang sudah dicoba. Tanpa ini, percakapan
 * selalu dimulai dari "sudah coba dimatikan lalu dinyalakan lagi belum?"
 */
function RincianLaporan({ laporan, pesan }) {
  return (
    <div className="rk-rincian">
      <div className="rk-rincian-ringkas">
        {[
          ['Masalah terdeteksi', laporan.masalah_cocok || 'tidak dikenali'],
          ['Skor pencocokan', (laporan.skor_cocok ?? 0).toFixed(2)],
          ['Solusi diberikan', laporan.solusi_terakhir ? `sampai ke-${laporan.solusi_terakhir}` : '—'],
          ['Mode layanan', laporan.mode_divisi || '—'],
          ['Engineer tujuan', laporan.engineer_tujuan || '—'],
          // Dua tahap penanganan, dan keduanya ditampilkan terpisah. Jarak
          // "diteruskan → mulai dikerjakan" mengukur kesigapan merespons,
          // sedangkan "mulai dikerjakan → ditangani" mengukur sulitnya
          // kendala. Digabung menjadi satu waktu tanggap, keduanya tak terbaca.
          ['Mulai dikerjakan', tanggalJamWIB(laporan.mulai_dikerjakan_pada)],
          // Untuk tiket yang diteruskan, INILAH jam kendalanya benar-benar
          // beres. Kolom "Berakhir" pada tabel berarti jam laporan berpindah
          // tangan ke engineer, bukan jam masalahnya selesai
          // (RANCANGAN-DATA.md §8).
          ['Ditangani engineer', tanggalJamWIB(laporan.ditangani_pada)],
          ['Catatan penanganan', laporan.catatan || '—']
        ].map(([k, v]) => (
          <div key={k}>
            <span>{k}</span>
            <strong>{v}</strong>
          </div>
        ))}
      </div>

      <div className="rk-rincian-percakapan">
        <span className="rk-eyebrow">PERCAKAPAN</span>
        {!pesan && <p className="rk-kosong">Memuat percakapan…</p>}
        {pesan && pesan.length === 0 && <p className="rk-kosong">Tidak ada pesan tersimpan.</p>}
        {pesan && pesan.map((m) => (
          <div key={m.id} className={`rk-pesan ${m.role}`}>
            <span className="rk-pesan-peran">
              {m.role === 'user' ? 'Pelapor' : m.role === 'assistant' ? 'SIGAP' : 'Sistem'}
            </span>
            {/* Jawaban SIGAP memakai penanda Markdown. Ditampilkan mentah,
                engineer membaca "**Solusi Pertama**" berikut bintangnya. */}
            {m.role === 'assistant' ? <Markdown>{m.content}</Markdown> : <p>{m.content}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Dialog penandaan selesai
   ──────────────────────────────────────────────────────────────── */

function DialogTandai({ tiket, galat, onBatal, onKirim }) {
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

        {galat && (
          <p className="rk-dialog-galat" role="alert">
            <IconAlert size={15} /> {galat}
          </p>
        )}

        <div className="rk-dialog-aksi">
          <button className="rk-tombol-samar" onClick={onBatal}>Batal</button>
          <button className="rk-tombol-utama" onClick={() => onKirim(catatan)}>
            <IconCheck size={16} /> Tandai selesai
          </button>
        </div>
      </div>
    </div>
  );
}
