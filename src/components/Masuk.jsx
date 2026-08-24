import React, { useState } from 'react';
import { IconLock } from './Icons.jsx';
import KolomSandi from './KolomSandi.jsx';
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
const PANJANG_SANDI_MINIMUM = 8;

export default function Masuk({ judul, sub, label = 'AKSES TERBATAS', kaki, onBerhasil }) {
  const [namaAkun, setNamaAkun] = useState('');
  const [sandi, setSandi] = useState('');
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  /* Kartu yang sama berpindah mode, bukan berpindah halaman: nama akun dan
     kata sandi yang sudah diketik tetap terisi, sehingga orang yang baru
     menerima sandi sementara dari admin dapat langsung menggantinya tanpa
     mengetik ulang apa pun. */
  const [mode, setMode] = useState('masuk');       // 'masuk' | 'ganti'
  const [sandiBaru, setSandiBaru] = useState('');
  const [ulangi, setUlangi] = useState('');

  const gantiMode = (tujuan) => {
    setMode(tujuan);
    setGalat('');
    setSandiBaru('');
    setUlangi('');
  };

  const kirim = async (e) => {
    e.preventDefault();
    setGalat('');
    setSibuk(true);
    try {
      const res = await fetch('/api/auth/masuk', {
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

  /* Pemeriksaan di sini hanya demi kecepatan tanggapan. Penjagaan yang
     sesungguhnya di server: kata sandi lama, pembatas laju, galat yang samar,
     dan pemutusan seluruh sesi lama. */
  const kirimGanti = async (e) => {
    e.preventDefault();
    setGalat('');

    if (sandiBaru !== ulangi) return setGalat('Ketikan ulang kata sandi baru tidak sama');
    if (sandiBaru.length < PANJANG_SANDI_MINIMUM) {
      return setGalat(`Kata sandi baru minimal ${PANJANG_SANDI_MINIMUM} karakter`);
    }
    if (sandiBaru === sandi) return setGalat('Kata sandi baru harus berbeda dari yang lama');

    setSibuk(true);
    try {
      const res = await fetch('/api/auth/ganti-sandi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namaAkun, sandiLama: sandi, sandiBaru })
      });
      const data = await res.json();

      // Penggantian yang berhasil sekaligus memasukkannya — server memasang
      // kuki sesi pada balasan yang sama. Menyuruhnya mengetik sandi barunya
      // sekali lagi hanya menambah langkah tanpa menambah penjagaan apa pun.
      if (data.success) onBerhasil(data.pengguna);
      else setGalat(data.error || 'Gagal mengganti kata sandi');
    } catch {
      setGalat('Tidak dapat terhubung ke server.');
    } finally {
      setSibuk(false);
    }
  };

  const sedangGanti = mode === 'ganti';

  return (
    <div className="sg-masuk-latar">
      <div className="sg-masuk-pita" aria-hidden="true" />

      <form className="sg-masuk" onSubmit={sedangGanti ? kirimGanti : kirim}>
        {/* Kepala biru bukan pilihan gaya: berkas logo Pertamina EP adalah
            varian untuk latar gelap, wordmark "PERTAMINA" digambar putih.
            Di atas bidang putih tulisannya lenyap. */}
        <div className="sg-masuk-kepala">
          <div className="sg-merek">
            <img
              src="/logo-sigap.png"
              alt="SATU-IT SIGAP"
              className="sg-merek-logo-unit"
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
          <h1>{sedangGanti ? 'Ganti kata sandi' : judul}</h1>
          <p className="sg-masuk-sub">
            {sedangGanti
              ? 'Masukkan kata sandi yang sekarang, lalu yang baru. Setelah diganti Anda langsung masuk.'
              : 'Halaman ini memuat data internal. Masuk dengan akun yang berwenang.'}
          </p>

          <label htmlFor="sg-akun">Nama akun</label>
          <input id="sg-akun" value={namaAkun} autoComplete="username" autoFocus
                 onChange={(e) => setNamaAkun(e.target.value)} />

          <label htmlFor="sg-sandi">
            {sedangGanti ? 'Kata sandi sekarang' : 'Kata sandi'}
          </label>
          <KolomSandi id="sg-sandi" value={sandi} autoComplete="current-password"
                      onChange={(e) => setSandi(e.target.value)} />

          {sedangGanti && (
            <>
              <label htmlFor="sg-sandi-baru">
                Kata sandi baru <small>minimal {PANJANG_SANDI_MINIMUM} karakter</small>
              </label>
              <KolomSandi id="sg-sandi-baru" value={sandiBaru} autoComplete="new-password"
                          onChange={(e) => setSandiBaru(e.target.value)} />

              <label htmlFor="sg-sandi-ulang">Ketik ulang kata sandi baru</label>
              <KolomSandi id="sg-sandi-ulang" value={ulangi} autoComplete="new-password"
                          onChange={(e) => setUlangi(e.target.value)} />
            </>
          )}

          {/* Pilihan "Ingat saya 30 hari" pernah ada di sini, lalu dihapus:
              selama server berjalan di atas HTTP, token melintas dalam bentuk
              terbaca, dan token berumur 30 hari berarti sesi yang tercuri
              berlaku sebulan penuh. Sesi kini 12 jam untuk semua orang. */}

          {galat && <p className="sg-galat" role="alert">{galat}</p>}

          <button
            type="submit"
            disabled={sibuk || !namaAkun || !sandi || (sedangGanti && (!sandiBaru || !ulangi))}
          >
            {sibuk
              ? (sedangGanti ? 'Menyimpan…' : 'Memeriksa…')
              : (sedangGanti ? 'Ganti kata sandi' : 'Masuk')}
          </button>

          <button type="button" className="sg-tautan" onClick={() => gantiMode(sedangGanti ? 'masuk' : 'ganti')}>
            {sedangGanti ? 'Kembali ke halaman masuk' : 'Ganti kata sandi'}
          </button>

          <p className="sg-masuk-kaki">
            {sedangGanti ? (
              <>
                Yang benar-benar <strong>lupa</strong> kata sandinya hubungi admin IT.
                Kata sandi tidak tersimpan dalam bentuk yang dapat dibaca, jadi ia
                menggantinya dengan yang baru — bukan memberitahukan yang lama.
              </>
            ) : (
              kaki || (
                <>Pelapor tidak perlu masuk. Halaman pengaduan ada di <a href="/">halaman utama</a>.</>
              )
            )}
          </p>
        </div>
      </form>
    </div>
  );
}
