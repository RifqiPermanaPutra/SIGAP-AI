import React, { useState, useEffect } from 'react';
import { IconCheck, IconClock, IconAlert, IconArrowLeft, IconWrench } from '../components/Icons.jsx';
import './tiket.css';

/**
 * Pemeriksaan status laporan oleh pelapor.
 *
 * Sebelum halaman ini ada, pelapor menerima nomor tiket lalu tidak pernah tahu
 * apa-apa lagi — tidak ada pemberitahuan saat engineer menandai selesai, dan
 * tidak ada tempat untuk memeriksanya sendiri.
 *
 * TIDAK perlu masuk, dan karena itu isinya sengaja tipis: keadaan laporan saja,
 * tanpa nama, lokasi, maupun isi keluhan. Nomor tiket berbentuk berurutan
 * sehingga mudah ditebak; rincian lengkap tetap hanya ada di `/rekap`.
 */

const API = '/api';
const WIB_MS = 7 * 60 * 60 * 1000;

function waktuWIB(iso) {
  if (!iso) return null;
  const d = new Date(new Date(iso).getTime() + WIB_MS);
  const hari = String(d.getUTCDate()).padStart(2, '0');
  const bulan = String(d.getUTCMonth() + 1).padStart(2, '0');
  const jam = String(d.getUTCHours()).padStart(2, '0');
  const menit = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hari}/${bulan}/${d.getUTCFullYear()} pukul ${jam}.${menit} WIB`;
}

export default function TiketPage() {
  // Tautan dari percakapan membawa nomornya, sehingga pelapor tidak perlu
  // mengetik ulang apa pun.
  const dariAlamat = new URLSearchParams(window.location.search).get('nomor') || '';

  const [nomor, setNomor] = useState(dariAlamat);
  const [hasil, setHasil] = useState(null);
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const cari = async (nilai) => {
    const n = (nilai ?? nomor).trim().toUpperCase();
    if (!n) return;

    setSibuk(true);
    setGalat('');
    setHasil(null);
    try {
      const r = await fetch(`${API}/tiket/${encodeURIComponent(n)}`);
      const d = await r.json();
      if (d.success) setHasil(d.tiket);
      else setGalat(d.error || 'Nomor tiket tidak ditemukan.');
    } catch {
      setGalat('Tidak dapat terhubung ke server.');
    } finally {
      setSibuk(false);
    }
  };

  useEffect(() => {
    if (dariAlamat) cari(dariAlamat);
    // Sekali saja, saat halaman dibuka dari tautan
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="tk-halaman">
      <header className="tk-navbar">
        <div className="tk-merek">
          <img
            src="/logo-sigap.png"
            alt="SATU-IT SIGAP"
            className="tk-merek-logo-unit"
          />
          <span className="tk-merek-garis" aria-hidden="true" />
          <span className="tk-merek-teks">
            <strong>SIGAP</strong>
            <small>CEK STATUS LAPORAN</small>
          </span>
        </div>
        <a className="tk-tombol-navbar" href="/">
          <IconArrowLeft size={15} /> Beranda
        </a>
      </header>

      <div className="tk">
        <h1>Cek status laporan</h1>
        <p className="tk-ket">
          Masukkan nomor tiket yang Anda terima saat melapor. Nomornya berbentuk
          <code>SGP-20260805-0007</code>.
        </p>

        <form
          className="tk-cari"
          onSubmit={(e) => { e.preventDefault(); cari(); }}
        >
          <input
            value={nomor}
            placeholder="SGP-20260805-0007"
            autoComplete="off"
            autoCapitalize="characters"
            onChange={(e) => setNomor(e.target.value)}
          />
          <button type="submit" disabled={sibuk || !nomor.trim()}>
            {sibuk ? 'Mencari…' : 'Cek'}
          </button>
        </form>

        {galat && (
          <p className="tk-galat" role="alert">
            <IconAlert size={16} /> {galat}
          </p>
        )}

        {hasil && (
          <section className={`tk-hasil ${
            hasil.sudahDitangani ? 'tuntas' : hasil.sedangDikerjakan ? 'dikerjakan' : hasil.status
          }`}>
            <span className="tk-nomor">{hasil.nomor}</span>

            <div className="tk-lencana">
              {hasil.sudahDitangani ? <IconCheck size={17} />
                : hasil.sedangDikerjakan ? <IconWrench size={17} />
                : <IconClock size={17} />}
              <strong>
                {hasil.sudahDitangani ? 'Sudah ditangani engineer'
                  : hasil.sedangDikerjakan ? 'Sedang dikerjakan engineer'
                  : hasil.statusLabel}
              </strong>
            </div>

            {/* Tiga keadaan, bukan dua. Sebelumnya laporan yang sudah dipegang
                engineer terlihat persis sama dengan yang belum disentuh siapa
                pun, sehingga pelapor yang memeriksa dua hari berturut-turut
                melihat kalimat yang tidak berubah dan menyimpulkan tidak ada
                yang mengerjakannya. */}
            <p className="tk-arti">
              {hasil.sudahDitangani
                ? 'Engineer IT sudah menandai kendala Anda selesai ditangani.'
                : hasil.sedangDikerjakan
                ? 'Engineer IT sudah mengambil laporan Anda dan sedang menanganinya.'
                : hasil.arti}
            </p>

            <dl className="tk-rincian">
              {hasil.layanan && (
                <div><dt>Layanan</dt><dd>{hasil.layanan}</dd></div>
              )}
              <div><dt>Dilaporkan</dt><dd>{waktuWIB(hasil.dibuatPada)}</dd></div>
              {hasil.diteruskanPada && (
                <div><dt>Diteruskan ke engineer</dt><dd>{waktuWIB(hasil.diteruskanPada)}</dd></div>
              )}
              {hasil.mulaiDikerjakanPada && (
                <div><dt>Mulai dikerjakan</dt><dd>{waktuWIB(hasil.mulaiDikerjakanPada)}</dd></div>
              )}
              {hasil.ditanganiPada && (
                <div><dt>Selesai ditangani</dt><dd>{waktuWIB(hasil.ditanganiPada)}</dd></div>
              )}
            </dl>

            {/* Kabar dari engineer. Inilah yang membedakan perbaikan yang
                sedang menunggu barang datang dari tiket yang terlupakan —
                tanpa ini, keduanya terlihat persis sama bagi pelapor.

                Nama penulisnya tidak ditampilkan; lihat alasannya pada
                server/routes/tiket.js. */}
            {hasil.kabar?.length > 0 && (
              <div className="tk-kabar">
                <h3>Kabar dari Engineer IT</h3>
                <ol>
                  {hasil.kabar.map((k, i) => (
                    <li key={i}>
                      <time>{waktuWIB(k.dibuatPada)}</time>
                      <p>{k.isi}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Halaman ini tidak menampilkan isi keluhan maupun data pelapor.
                Nomor tiket berurutan dan mudah ditebak, sehingga menampilkannya
                di sini berarti membukanya bagi siapa pun yang menghitung. */}
            <p className="tk-catatan">
              Rincian laporan hanya dapat dilihat Engineer IT. Bila kendala Anda
              masih berlanjut, hubungi engineer kembali dengan menyebutkan nomor
              tiket di atas.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
