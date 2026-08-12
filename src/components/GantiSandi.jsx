import React, { useEffect, useRef, useState } from 'react';
import { IconLock } from './Icons.jsx';
import './ganti-sandi.css';

const PANJANG_MINIMUM = 8;

/**
 * Tombol dan dialog "Ganti kata sandi" untuk akun sendiri.
 *
 * Dipakai bersama halaman rekap, tugas, dan penyunting SOP. Ditulis sekali
 * karena bilah merek yang dulu disalin ke lima berkas membuat satu cacat yang
 * sama muncul lima kali.
 *
 * Memanggil jalur yang sama dengan mode ganti sandi pada halaman masuk
 * (`Masuk.jsx`) — server tidak menuntut sesi, karena yang membuktikan
 * kepemilikan adalah kata sandi lamanya.
 */
export default function GantiSandi({ namaAkun, kelasTombol = '' }) {
  const [terbuka, setTerbuka] = useState(false);
  const [lama, setLama] = useState('');
  const [baru, setBaru] = useState('');
  const [ulang, setUlang] = useState('');
  const [galat, setGalat] = useState('');
  const [berhasil, setBerhasil] = useState('');
  const [mengirim, setMengirim] = useState(false);
  const kolomPertama = useRef(null);

  useEffect(() => {
    if (!terbuka) return;
    kolomPertama.current?.focus();

    const padaTombol = (e) => { if (e.key === 'Escape') tutup(); };
    document.addEventListener('keydown', padaTombol);
    return () => document.removeEventListener('keydown', padaTombol);
  }, [terbuka]);

  function tutup() {
    setTerbuka(false);
    setLama(''); setBaru(''); setUlang('');
    setGalat(''); setBerhasil(''); setMengirim(false);
  }

  // Pemeriksaan di sini hanya demi kecepatan tanggapan. Penjagaan yang
  // sesungguhnya ada di server — panjang minimum, sandi lama, pembatas laju,
  // dan pemutusan sesi lama semuanya diberlakukan di sana.
  async function kirim(e) {
    e.preventDefault();
    setGalat('');

    if (baru !== ulang) return setGalat('Ketikan ulang kata sandi baru tidak sama');
    if (baru.length < PANJANG_MINIMUM) return setGalat(`Kata sandi baru minimal ${PANJANG_MINIMUM} karakter`);
    if (baru === lama) return setGalat('Kata sandi baru harus berbeda dari yang lama');

    setMengirim(true);
    try {
      const r = await fetch('/api/auth/ganti-sandi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namaAkun, sandiLama: lama, sandiBaru: baru })
      });
      const d = await r.json();

      if (!d.success) {
        setGalat(d.error || 'Gagal mengganti kata sandi');
        setMengirim(false);
        return;
      }

      setBerhasil(d.pesan || 'Kata sandi berhasil diganti.');
      setLama(''); setBaru(''); setUlang('');
    } catch {
      setGalat('Sambungan ke server terputus. Coba lagi.');
    }
    setMengirim(false);
  }

  return (
    <>
      {/* Teksnya disembunyikan di ponsel, ikonnya tidak. Navbar /tugas memuat
          tiga tombol plus bilah merek; dengan teks lengkap jumlahnya 505px
          pada layar 393px. Ikon gembok tetap dapat dikenali, dan aria-label
          menjaga maknanya bagi pembaca layar. */}
      <button
        type="button"
        className={kelasTombol}
        onClick={() => setTerbuka(true)}
        title="Ganti kata sandi akun Anda"
        aria-label="Ganti kata sandi akun Anda"
      >
        <IconLock size={15} /> <span className="gs-label">Kata Sandi</span>
      </button>

      {terbuka && (
        <div
          className="gs-latar"
          onClick={(e) => { if (e.target === e.currentTarget) tutup(); }}
          role="presentation"
        >
          <div className="gs-dialog" role="dialog" aria-modal="true" aria-labelledby="gs-judul">
            <h3 id="gs-judul">Ganti kata sandi</h3>

            {berhasil ? (
              <>
                <p className="gs-berhasil">{berhasil}</p>
                <div className="gs-aksi">
                  <button type="button" className="gs-utama" onClick={tutup}>Selesai</button>
                </div>
              </>
            ) : (
              <form onSubmit={kirim}>
                <p className="gs-ket">
                  Berlaku untuk akun Anda sendiri. Setelah diganti, perangkat lain
                  yang masih masuk akan diminta masuk kembali.
                </p>

                <label>Kata sandi sekarang
                  <input
                    ref={kolomPertama}
                    type="password"
                    value={lama}
                    autoComplete="current-password"
                    onChange={(e) => setLama(e.target.value)}
                  />
                </label>

                <label>Kata sandi baru <small>minimal {PANJANG_MINIMUM} karakter</small>
                  <input
                    type="password"
                    value={baru}
                    autoComplete="new-password"
                    onChange={(e) => setBaru(e.target.value)}
                  />
                </label>

                <label>Ketik ulang kata sandi baru
                  <input
                    type="password"
                    value={ulang}
                    autoComplete="new-password"
                    onChange={(e) => setUlang(e.target.value)}
                  />
                </label>

                {galat && <p className="gs-galat" role="alert">{galat}</p>}

                <div className="gs-aksi">
                  <button type="button" className="gs-samar" onClick={tutup}>Batal</button>
                  <button
                    type="submit"
                    className="gs-utama"
                    disabled={mengirim || !lama || !baru || !ulang}
                  >
                    {mengirim ? 'Menyimpan…' : 'Ganti kata sandi'}
                  </button>
                </div>
              </form>
            )}

            <p className="gs-kaki">
              Lupa kata sandi sekarang? Hubungi admin ICT — kata sandi tidak
              tersimpan dalam bentuk yang dapat dibaca, jadi ia menggantinya
              dengan yang baru, bukan memberitahukan yang lama.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
