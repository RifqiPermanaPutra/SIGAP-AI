import React, { useState, useEffect, useCallback } from 'react';
import {
  DivisionIcon, IconCheck, IconLogout, IconChart, IconClock, IconInbox,
  IconAlert, IconWrench, IconUndo, IconUser
} from '../components/Icons.jsx';
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

/**
 * Tingkat perhatian sebuah kartu.
 *
 * Tiket yang sudah dipegang engineer diukur dari kapan ia MULAI dikerjakan,
 * bukan dari kapan diteruskan. Bila diukur dari diteruskan, tiket yang baru
 * saja diambil tetap tampil merah hanya karena laporannya masuk kemarin —
 * padahal justru itu tiket yang sedang ditangani dengan benar. Sebaliknya,
 * tiket yang dipegang lalu didiamkan berhari-hari adalah keadaan terburuk:
 * terlihat sedang ditangani padahal tidak.
 */
function tingkatTunggu(tugas, sekarang) {
  const acuan = tugas.mulai_dikerjakan_pada || tugas.diteruskan_pada;
  const jam = (new Date(sekarang) - new Date(acuan)) / 3600000;
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
  // Nomor tiket yang tombolnya sedang menunggu jawaban server — supaya ketukan
  // kedua pada tombol yang sama tidak mengirim permintaan kembar.
  const [sedangKirim, setSedangKirim] = useState('');
  // Terisi bila tiket yang hendak diambil ternyata sudah dipegang orang lain.
  const [ambilAlih, setAmbilAlih] = useState(null);

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

  /**
   * Tindakan satu ketukan pada sebuah kartu — mulai mengerjakan, mengambil
   * alih, atau melepaskan. Ketiganya berbagi penanganan yang sama karena
   * ketiganya sama-sama satu permintaan tanpa formulir.
   */
  const tindakan = async (jalur, tugas, tambahan = {}) => {
    setSedangKirim(tugas.nomor_tiket);
    setGalat('');
    setKabar('');
    try {
      const r = await fetch(`${API}/tugas/${jalur}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomorTiket: tugas.nomor_tiket, ...tambahan })
      });
      const d = await r.json();

      // 409 = tiketnya sudah dipegang orang lain. Bukan kegagalan, melainkan
      // pertanyaan: yakin hendak mengambilnya? Karena itu ditampilkan sebagai
      // dialog, bukan sebagai galat merah.
      if (r.status === 409 && d.pemegang) {
        setAmbilAlih({ tugas, pemegang: d.pemegang });
        return false;
      }

      if (d.success) {
        setKabar(d.message);
        await ambil();
        return true;
      }
      setGalat(d.error || 'Tindakan gagal');
      return false;
    } catch {
      setGalat('Tidak dapat terhubung ke server.');
      return false;
    } finally {
      setSedangKirim('');
    }
  };

  /**
   * Pengambilalihan yang sudah dijawab "ya".
   *
   * Bila permintaan yang tertahan tadi sebenarnya "tandai selesai", dialog
   * penyelesaiannya dibuka kembali setelah tiketnya berpindah tangan —
   * engineer tidak perlu mencari kartunya lagi dan menekan tombol yang sama
   * untuk kedua kalinya.
   */
  const konfirmasiAmbilAlih = async () => {
    const { tugas, lanjutSelesai } = ambilAlih;
    setAmbilAlih(null);
    const berhasil = await tindakan('mulai', tugas, { ambilAlih: true });
    if (berhasil && lanjutSelesai) {
      setGalatDialog('');
      setDipilih(tugas);
    }
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

      // Tiket ini ternyata sedang dipegang engineer lain. Pertanyaannya
      // dipindahkan ke dialog pengambilalihan, dan bila dijawab "ya" dialog
      // penyelesaian ini terbuka kembali dengan sendirinya.
      if (r.status === 409 && d.pemegang) {
        const tugas = dipilih;
        setDipilih(null);
        setAmbilAlih({ tugas, pemegang: d.pemegang, lanjutSelesai: true });
        return;
      }

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
          <img
            src="/logo-satu-it-sigap-dark.png"
            alt="Pertamina ONE dan SATU-IT SIGAP"
            className="tg-merek-logo-unit"
          />
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
            selesai. Yang belum dipegang siapa pun berada di atas.
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
          const lama = data.tugas.filter((t) => tingkatTunggu(t, data.sekarang) === 'lama');
          if (lama.length === 0) return null;

          // Dua kelompok yang terlihat sama pada daftar tetapi sangat berbeda
          // artinya. Tiket yang belum diambil siapa pun masih jujur mengaku
          // menganggur; tiket yang dipegang lalu didiamkan dua hari terlihat
          // seperti sedang ditangani, dan justru karena itu tidak ada yang
          // menanyakannya.
          const mandek = lama.filter((t) => t.dikerjakan_oleh).length;
          const nganggur = lama.length - mandek;

          return (
            <p className="tg-peringatan" role="status">
              <IconClock size={15} />
              <span>
                {nganggur > 0 && (
                  <><strong>{nganggur} tiket</strong> sudah menunggu lebih dari dua hari.{' '}</>
                )}
                {mandek > 0 && (
                  <><strong>{mandek} tiket</strong> sudah dipegang lebih dari dua hari tanpa ditutup.</>
                )}
              </span>
            </p>
          );
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
            {(() => {
              const dikerjakan = data.tugas.filter((t) => t.dikerjakan_oleh).length;
              return (
                <p className="tg-hitung">
                  {data.jumlah - dikerjakan} belum dipegang
                  {dikerjakan > 0 && <> · {dikerjakan} sedang dikerjakan</>}
                </p>
              );
            })()}

            <ul className="tg-daftar">
              {data.tugas.map((t) => {
                const saya = t.dikerjakan_oleh === pengguna.namaAkun;
                const orangLain = Boolean(t.dikerjakan_oleh) && !saya;
                const menunggu = sedangKirim === t.nomor_tiket;

                return (
                <li key={t.nomor_tiket}
                    className={`tg-kartu ${tingkatTunggu(t, data.sekarang)}${t.dikerjakan_oleh ? ' dikerjakan' : ''}`}>
                  <div className="tg-kartu-atas">
                    <span className="tg-tiket">{t.nomor_tiket}</span>
                    {t.urgensi && (
                      <span className={`tg-urgensi u-${t.urgensi.toLowerCase()}`}>{t.urgensi}</span>
                    )}
                  </div>

                  {/* Siapa yang sedang memegang tiket ini. Inilah keterangan
                      yang membuat dua engineer tidak berangkat ke lokasi yang
                      sama — dan yang membuat tiket terlantar dapat dikenali,
                      karena "dikerjakan sejak dua hari lalu" terbaca berbeda
                      dari "menunggu dua hari". */}
                  {t.dikerjakan_oleh && (
                    <p className={`tg-pemegang${saya ? ' saya' : ''}`}>
                      <IconWrench size={14} />
                      <span>
                        {saya ? 'Anda kerjakan' : `Dikerjakan ${t.dikerjakan_oleh_nama}`}
                        {' · sejak '}{sejak(t.mulai_dikerjakan_pada, data.sekarang)}
                      </span>
                    </p>
                  )}

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

                    {/* Dua tahap, tetapi tahap pertama TIDAK diwajibkan.
                        Kendala yang beres dalam dua menit tidak pantas menuntut
                        dua ketukan; memaksakannya justru membuat orang berhenti
                        menandai sama sekali — penyakit yang baru saja
                        disembuhkan halaman ini. */}
                    <div className="tg-aksi">
                      {orangLain ? (
                        <button type="button" className="tg-tombol-samar" disabled={menunggu}
                                onClick={() => setAmbilAlih({ tugas: t, pemegang: t.dikerjakan_oleh_nama })}>
                          <IconUser size={15} /> Ambil alih
                        </button>
                      ) : saya ? (
                        <button type="button" className="tg-tombol-samar" disabled={menunggu}
                                onClick={() => tindakan('lepas', t)}>
                          <IconUndo size={15} /> Lepas
                        </button>
                      ) : (
                        <button type="button" className="tg-tombol-samar" disabled={menunggu}
                                onClick={() => tindakan('mulai', t)}>
                          <IconWrench size={15} /> Saya kerjakan
                        </button>
                      )}

                      {/* Menyelesaikan tiket yang dipegang orang lain ditolak
                          server. Tombolnya disembunyikan agar penolakan itu
                          tidak perlu dialami dulu untuk diketahui — kecuali
                          bagi admin, yang memang bertugas menutup tiket saat
                          engineernya berhalangan. */}
                      {(!orangLain || pengguna.peran === 'admin') && (
                        <button type="button" className="tg-tombol-utama" disabled={menunggu}
                                onClick={() => { setGalatDialog(''); setDipilih(t); }}>
                          <IconCheck size={16} /> Selesai
                        </button>
                      )}
                    </div>
                  </div>
                </li>
                );
              })}
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

      {/* Pengambilalihan diizinkan — engineer yang dijadwalkan bisa
          berhalangan, dan tiket yang terkunci pada akun yang sedang cuti lebih
          buruk daripada tiket yang berpindah tangan. Tetapi harus disengaja:
          memindahkan pekerjaan seseorang diam-diam menghapus tiketnya dari
          daftar tugas orang itu tanpa ia tahu. */}
      {ambilAlih && (
        <div className="tg-dialog-latar" onClick={() => setAmbilAlih(null)}>
          <div className="tg-dialog" role="dialog" aria-modal="true"
               aria-label="Ambil alih tugas"
               onClick={(e) => e.stopPropagation()}>
            <h3>Ambil alih tugas ini?</h3>
            <p className="tg-dialog-tiket">
              {ambilAlih.tugas.nomor_tiket} · {ambilAlih.tugas.divisi_nama}
            </p>
            <p className="tg-dialog-keluhan">
              Tiket ini sedang dikerjakan <strong>{ambilAlih.pemegang}</strong>.
              Bila Anda mengambilnya, tiket berpindah ke daftar tugas Anda dan
              hilang dari daftar {ambilAlih.pemegang}. Sebaiknya beri tahu yang
              bersangkutan lebih dahulu.
            </p>

            <div className="tg-dialog-aksi">
              <button type="button" className="tg-tombol-samar"
                      onClick={() => setAmbilAlih(null)}>Batal</button>
              <button type="button" className="tg-tombol-utama"
                      onClick={konfirmasiAmbilAlih}>
                <IconUser size={16} /> Ya, ambil alih
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
