import React, { useState } from 'react';
import { IconLock } from './Icons.jsx';
import './masuk.css';

/**
 * Layar masuk bersama untuk halaman yang memerlukan akun.
 *
 * Dipakai dua halaman: laporan rekap (`/rekap`) dan penyunting SOP
 * (`/sop-editor`). Sebelumnya layar ini hidup di dalam `RekapPage.jsx`;
 * menyalinnya ke halaman kedua berarti dua tempat yang harus ikut diperbaiki
 * setiap kali penanganan galat masuk berubah — dan yang kedua pasti terlewat.
 *
 * Kelasnya berawalan `sg-` dan berdiri sendiri di `masuk.css`, sehingga
 * halaman penyunting SOP tidak perlu ikut mengunduh seluruh gaya halaman
 * rekap hanya untuk menampilkan kotak masuk.
 */
export default function Masuk({ judul, sub, label = 'AKSES TERBATAS', kaki, onBerhasil }) {
  const [namaAkun, setNamaAkun] = useState('');
  const [sandi, setSandi] = useState('');
  const [ingatSaya, setIngatSaya] = useState(false);
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const kirim = async (e) => {
    e.preventDefault();
    setGalat('');
    setSibuk(true);
    try {
      const res = await fetch('/api/auth/masuk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namaAkun, sandi, ingatSaya })
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
    <div className="sg-masuk-latar">
      <div className="sg-masuk-pita" aria-hidden="true" />

      <form className="sg-masuk" onSubmit={kirim}>
        {/* Kepala biru bukan pilihan gaya: berkas logo Pertamina EP adalah
            varian untuk latar gelap, wordmark "PERTAMINA" digambar putih.
            Di atas bidang putih tulisannya lenyap. */}
        <div className="sg-masuk-kepala">
          <div className="sg-merek">
            <img src="/logo-pertamina-ep.svg" alt="Pertamina EP" className="sg-merek-logo" />
            <img
              src="/logo-satu-it-sigap.png"
              alt="SATU-IT SIGAP"
              className="sg-merek-logo-unit"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span className="sg-merek-garis" aria-hidden="true" />
            <span className="sg-merek-teks">
              <strong>SIGAP</strong>
              <small>{sub}</small>
            </span>
          </div>
        </div>

        <div className="sg-masuk-isi">
          <span className="sg-eyebrow"><IconLock size={13} /> {label}</span>
          <h1>{judul}</h1>
          <p className="sg-masuk-sub">
            Halaman ini memuat data internal. Masuk dengan akun yang berwenang.
          </p>

          <label htmlFor="sg-akun">Nama akun</label>
          <input id="sg-akun" value={namaAkun} autoComplete="username" autoFocus
                 onChange={(e) => setNamaAkun(e.target.value)} />

          <label htmlFor="sg-sandi">Kata sandi</label>
          <input id="sg-sandi" type="password" value={sandi} autoComplete="current-password"
                 onChange={(e) => setSandi(e.target.value)} />

          {/* Tanpa ini, engineer yang menandai tiket selesai dari ponsel harus
              memasukkan kata sandi hampir setiap kali — sesi biasa hanya
              bertahan 12 jam. Pekerjaan yang menuntut masuk ulang setiap kali
              tidak akan dikerjakan. */}
          <label className="sg-ingat">
            <input type="checkbox" checked={ingatSaya}
                   onChange={(e) => setIngatSaya(e.target.checked)} />
            <span>Ingat saya di perangkat ini <small>(30 hari)</small></span>
          </label>

          {galat && <p className="sg-galat" role="alert">{galat}</p>}

          <button type="submit" disabled={sibuk || !namaAkun || !sandi}>
            {sibuk ? 'Memeriksa…' : 'Masuk'}
          </button>

          <p className="sg-masuk-kaki">
            {kaki || (
              <>Pelapor tidak perlu masuk. Halaman pengaduan ada di <a href="/">halaman utama</a>.</>
            )}
          </p>
        </div>
      </form>
    </div>
  );
}
