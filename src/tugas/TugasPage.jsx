import React, { useState, useEffect, useCallback } from 'react';
import { DivisionIcon, IconCheck, IconLogout, IconChart, IconClock, IconInbox, IconAlert } from '../components/Icons.jsx';
import Masuk from '../components/Masuk.jsx';
import './tugas.css';

/**
 * Daftar tugas engineer.
 *
 * Halaman rekap sudah punya tombol "Tandai Selesai" sejak awal, dan selama
 * dipakai tidak pernah sekali pun ditekan. Yang menghambat bukan tombolnya:
 * engineer harus membuka rekap di ponsel, masuk, lalu mencari satu baris di
 * dalam tabel enam belas kolom — sementara nomor tiketnya tidak pernah ikut
 * terkirim lewat WhatsApp.
 *
 * Halaman ini sengaja dibuat sesempit mungkin: hanya tiket yang benar-benar
 * menunggu, terlama di atas, satu tombol besar per tiket. Tanpa saringan,
 * tanpa grafik, tanpa tabel.
 */

const API = '/api';

const WIB_MS = 7 * 60 * 60 * 1000;

/** Jarak waktu yang terbaca manusia, contoh "3 jam lalu" */
function sejak(iso, sekarang) {
  if (!iso) return '—';
  const detik = Math.max(0, Math.floor((new Date(sekarang) - new Date(iso)) / 1000));
  if (detik < 3600) return `${Math.max(1, Math.round(detik / 60))} menit lalu`;
  if (detik < 86400) return `${Math.round(detik / 3600)} jam lalu`;
  return `${Math.round(detik / 86400)} hari lalu`;
}

/** Nilai untuk <input type="datetime-local"> menurut WIB */
function untukInput(ms) {
  return new Date(ms + WIB_MS).toISOString().slice(0, 16);
}

/** Kebalikannya — dari nilai WIB yang diketik kembali menjadi ISO UTC */
function keISO(nilaiLokal) {
  return new Date(new Date(`${nilaiLokal}:00Z`).getTime() - WIB_MS).toISOString();
}

/** Tiket yang menganggur terlalu lama perlu terlihat berbeda */
function tingkatTunggu(diteruskanPada, sekarang) {
  const jam = (new Date(sekarang) - new Date(diteruskanPada)) / 3600000;
  if (jam >= 48) return 'lama';
  if (jam >= 8) return 'sedang';
  return '';
}

/* ────────────────────────────────────────────────────────────────
   Dialog penyelesaian
   ──────────────────────────────────────────────────────────────── */

function DialogSelesai({ tugas, sekarang, onBatal, onKirim, sibuk, galat }) {
  // Bawaan "sekarang". Yang mengubahnya hanya engineer yang baru sempat
  // membuka halaman ini beberapa jam setelah kendalanya benar-benar beres.
  const [kapan, setKapan] = useState(() => untukInput(Date.now()));
  const [catatan, setCatatan] = useState('');

  const pintasan = (jamLalu) => setKapan(untukInput(Date.now() - jamLalu * 3600000));

  const batasBawah = tugas.diteruskan_pada
    ? untukInput(new Date(tugas.diteruskan_pada).getTime())
    : undefined;

  return (
    <div className="tg-dialog-latar" onClick={onBatal}>
      <div className="tg-dialog" role="dialog" aria-modal="true"
           aria-label={`Tandai ${tugas.nomor_tiket} selesai`}
           onClick={(e) => e.stopPropagation()}>
        <h3>Tandai selesai</h3>
        <p className="tg-dialog-tiket">{tugas.nomor_tiket} · {tugas.divisi_nama}</p>
        <p className="tg-dialog-keluhan">{tugas.keluhan}</p>

        <label htmlFor="tg-kapan">Kapan kendalanya beres?</label>
        {/* Yang diukur waktu tanggap adalah lama penanganan, bukan lama
            keterlambatan mengisi. Engineer yang baru sempat menandai tiga hari
            kemudian akan tercatat menanggapi dalam tiga hari — angka seperti
            itu membuat seluruh laporan waktu tanggap tidak dipercaya. */}
        <input
          id="tg-kapan"
          type="datetime-local"
          value={kapan}
          min={batasBawah}
          max={untukInput(Date.now())}
          onChange={(e) => setKapan(e.target.value)}
        />

        <div className="tg-pintasan">
          <button type="button" onClick={() => pintasan(0)}>Baru saja</button>
          <button type="button" onClick={() => pintasan(1)}>1 jam lalu</button>
          <button type="button" onClick={() => pintasan(3)}>3 jam lalu</button>
          <button type="button" onClick={() => pintasan(24)}>Kemarin</button>
        </div>

        <label htmlFor="tg-catatan">
          Tindakan yang dilakukan <small>(boleh dikosongkan)</small>
        </label>
        <textarea
          id="tg-catatan" rows="3" value={catatan}
          placeholder="Contoh: kabel LAN diganti, port switch dipindah"
          onChange={(e) => setCatatan(e.target.value)}
        />

        {galat && <p className="tg-galat" role="alert">{galat}</p>}

        <div className="tg-dialog-aksi">
          <button type="button" className="tg-tombol-samar" onClick={onBatal}>Batal</button>
          <button type="button" className="tg-tombol-utama" disabled={sibuk}
                  onClick={() => onKirim({ selesaiPada: keISO(kapan), catatan })}>
            <IconCheck size={16} /> {sibuk ? 'Menyimpan…' : 'Tandai selesai'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Halaman utama
   ──────────────────────────────────────────────────────────────── */

export default function TugasPage() {
  const [pengguna, setPengguna] = useState(undefined);
  const [data, setData] = useState(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');
  const [kabar, setKabar] = useState('');
  const [dipilih, setDipilih] = useState(null);
  const [sibuk, setSibuk] = useState(false);
  const [galatDialog, setGalatDialog] = useState('');
  const [divisi, setDivisi] = useState('');

  // Tautan dari WhatsApp membawa nomor tiketnya, sehingga engineer tidak perlu
  // mencari apa pun — dialognya langsung terbuka pada tiket yang dimaksud.
  const tiketDiminta = new URLSearchParams(window.location.search).get('tiket');

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
      // Saringan dikirim ke server, bukan diterapkan pada hasil yang sudah
      // diterima. Menyaring di peramban berarti tiket divisi lain tetap
      // terkirim ke perangkat ini — hanya tidak digambar.
      const r = await fetch(`${API}/tugas${divisi ? `?divisi=${encodeURIComponent(divisi)}` : ''}`);
      if (r.status === 401) { setPengguna(null); return; }

      const d = await r.json();
      if (d.success) setData(d);
      else setGalat(d.error || 'Gagal memuat daftar tugas');
    } catch {
      setGalat('Tidak dapat terhubung ke server.');
    } finally {
      setMemuat(false);
    }
  }, [divisi]);

  useEffect(() => { if (pengguna) ambil(); }, [pengguna, ambil]);

  // Buka dialog sendiri bila datang lewat tautan WhatsApp
  useEffect(() => {
    if (!data || !tiketDiminta || dipilih) return;
    const cocok = data.tugas.find((t) => t.nomor_tiket === tiketDiminta);
    if (cocok) setDipilih(cocok);
  }, [data, tiketDiminta, dipilih]);

  const keluar = async () => {
    await fetch(`${API}/auth/keluar`, { method: 'POST' });
    setPengguna(null);
    setData(null);
  };

  const kirimSelesai = async ({ selesaiPada, catatan }) => {
    setSibuk(true);
    setGalatDialog('');
    try {
      const r = await fetch(`${API}/tugas/selesai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomorTiket: dipilih.nomor_tiket, selesaiPada, catatan })
      });
      const d = await r.json();
      if (d.success) {
        setKabar(d.message);
        setDipilih(null);
        await ambil();
      } else {
        setGalatDialog(d.error || 'Gagal menandai tiket');
      }
    } catch {
      setGalatDialog('Tidak dapat terhubung ke server.');
    } finally {
      setSibuk(false);
    }
  };

  if (pengguna === undefined) return <div className="tg-tunggu">Memuat…</div>;

  if (pengguna === null) {
    return (
      <Masuk
        judul="Tugas Engineer"
        sub="TUGAS ENGINEER · FIELD LIRIK"
        label="AKSES TERBATAS"
        kaki={<>Laporan lengkap ada di <a href="/rekap">/rekap</a>. Pelapor tidak perlu masuk.</>}
        onBerhasil={setPengguna}
      />
    );
  }

  return (
    <div className="tg-halaman">
      <header className="tg-navbar">
        <div className="tg-merek">
          <img src="/logo-pertamina-ep.svg" alt="Pertamina EP" className="tg-merek-logo" />
          <span className="tg-merek-garis" aria-hidden="true" />
          <span className="tg-merek-teks">
            <strong>SIGAP</strong>
            <small>TUGAS ENGINEER</small>
          </span>
        </div>
        <div className="tg-navbar-kanan">
          <a className="tg-tombol-navbar" href="/rekap"><IconChart size={15} /> Rekap</a>
          <button className="tg-tombol-navbar" onClick={keluar}>
            <IconLogout size={15} /> Keluar
          </button>
        </div>
      </header>

      <div className="tg">
        <div className="tg-judul">
          <h1>Menunggu ditangani</h1>
          <p className="tg-ket">
            Laporan yang sudah diteruskan kepada engineer dan belum ditandai
            selesai. Terlama berada di atas.
            {data && !data.seluruhDivisi && (
              <> Hanya layanan yang Anda tangani yang ditampilkan.</>
            )}
          </p>
        </div>

        {/* Saringan layanan. Pilihannya datang dari server dan sudah mengikuti
            wewenang akun — engineer Printer tidak melihat tombol CCTV yang
            baginya selalu kosong. */}
        {data && data.pilihanDivisi.length > 1 && (
          <nav className="tg-saringan" aria-label="Saring menurut layanan">
            <button className={divisi === '' ? 'aktif' : ''} onClick={() => setDivisi('')}>
              Semua
              <span className="tg-jumlah">{divisi === '' ? data.jumlah : ''}</span>
            </button>
            {data.pilihanDivisi.map((d) => (
              <button
                key={d.id}
                className={divisi === d.id ? 'aktif' : ''}
                onClick={() => setDivisi(d.id)}
              >
                <DivisionIcon id={d.id} size={14} />
                {d.nama}
              </button>
            ))}
          </nav>
        )}

        {/* Penandaan per kartu saja tidak cukup: engineer yang membuka halaman
            ini lewat tautan WhatsApp datang untuk SATU tiket, dan tidak akan
            menggulir sampai bawah untuk menyadari ada empat lainnya yang sudah
            menunggu dua hari. */}
        {data && (() => {
          const lama = data.tugas.filter(
            (t) => tingkatTunggu(t.diteruskan_pada, data.sekarang) === 'lama'
          ).length;
          return lama > 0 ? (
            <p className="tg-peringatan" role="status">
              <IconClock size={15} />
              <span><strong>{lama} tiket</strong> sudah menunggu lebih dari dua hari.</span>
            </p>
          ) : null;
        })()}

        {galat && <p className="tg-galat" role="alert">{galat}</p>}
        {kabar && <p className="tg-kabar" role="status"><IconCheck size={15} /> {kabar}</p>}
        {memuat && !data && <p className="tg-ket">Memuat…</p>}

        {tiketDiminta && data && !data.tugas.some((t) => t.nomor_tiket === tiketDiminta) && (
          <p className="tg-kabar" role="status">
            Tiket <strong>{tiketDiminta}</strong> tidak ada dalam daftar — kemungkinan
            sudah ditandai selesai sebelumnya.
          </p>
        )}

        {/* "Belum diberi layanan" dan "tidak ada tiket" sama-sama menghasilkan
            daftar kosong, tetapi artinya jauh berbeda. Engineer yang akunnya
            belum diatur perlu tahu bahwa yang salah bukan pekerjaannya. */}
        {data && data.tanpaLayanan ? (
          <div className="tg-kosong">
            <IconAlert size={30} />
            <h2>Akun Anda belum diberi layanan</h2>
            <p>
              Akun <strong>{pengguna.nama}</strong> belum ditetapkan menangani
              layanan apa pun, sehingga belum ada tiket yang dapat Anda tandai
              selesai. Hubungi admin untuk mengaturnya.
            </p>
          </div>
        ) : data && data.tugas.length === 0 && (
          <div className="tg-kosong">
            <IconInbox size={30} />
            <h2>Tidak ada tugas menunggu</h2>
            <p>
              {divisi
                ? 'Tidak ada laporan menunggu pada layanan ini.'
                : 'Semua laporan yang diteruskan sudah ditandai selesai.'}
            </p>
          </div>
        )}

        {data && data.tugas.length > 0 && (
          <>
            <p className="tg-hitung">{data.jumlah} tiket menunggu</p>

            <ul className="tg-daftar">
              {data.tugas.map((t) => (
                <li key={t.nomor_tiket}
                    className={`tg-kartu ${tingkatTunggu(t.diteruskan_pada, data.sekarang)}`}>
                  <div className="tg-kartu-atas">
                    <span className="tg-tiket">{t.nomor_tiket}</span>
                    {t.urgensi && (
                      <span className={`tg-urgensi u-${t.urgensi.toLowerCase()}`}>{t.urgensi}</span>
                    )}
                  </div>

                  <p className="tg-keluhan">{t.keluhan || '—'}</p>

                  <dl className="tg-rinci">
                    <div>
                      <dt>Layanan</dt>
                      <dd className="tg-layanan">
                        {t.divisi_id && <DivisionIcon id={t.divisi_id} size={14} />}
                        {t.divisi_nama}
                      </dd>
                    </div>
                    <div><dt>Pelapor</dt><dd>{t.nama || '—'}</dd></div>
                    <div><dt>Lokasi</dt><dd>{t.lokasi || '—'}</dd></div>
                    <div><dt>Fungsi</dt><dd>{t.fungsi || '—'}</dd></div>
                  </dl>

                  <div className="tg-kartu-bawah">
                    <span className="tg-menunggu">
                      <IconClock size={13} /> diteruskan {sejak(t.diteruskan_pada, data.sekarang)}
                    </span>
                    <button type="button" className="tg-tombol-utama"
                            onClick={() => { setGalatDialog(''); setDipilih(t); }}>
                      <IconCheck size={16} /> Selesai
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {dipilih && (
        <DialogSelesai
          tugas={dipilih}
          sekarang={data.sekarang}
          sibuk={sibuk}
          galat={galatDialog}
          onBatal={() => setDipilih(null)}
          onKirim={kirimSelesai}
        />
      )}
    </div>
  );
}
