import React, { useId, useState } from 'react';
import { IconMata, IconMataTutup } from './Icons.jsx';
import './kolom-sandi.css';

/**
 * Kolom kata sandi dengan tombol tampilkan/sembunyikan.
 *
 * Ditulis sekali dan dipakai keenam kolom sandi yang ada — halaman masuk dan
 * dialog navbar. Menyalinnya ke tiap tempat berarti tombolnya bisa berperilaku
 * berbeda di satu halaman tanpa ada yang menyadarinya.
 *
 * Bukan sekadar kenyamanan. Kolom sandi dipakai dari ponsel di lapangan,
 * papan ketiknya kecil, dan sandi awal dari admin berisi campuran huruf besar,
 * kecil, serta tanda baca. Tanpa cara memeriksa apa yang sudah diketik, satu
 * salah ketik terbaca sama saja dengan "kata sandi salah" — dan orangnya
 * menyimpulkan sandinya yang keliru, bukan ketikannya.
 *
 * Selalu mulai tersembunyi, dan kembali tersembunyi setiap kali komponennya
 * dilepas. Keadaan "terlihat" tidak pernah bertahan antar halaman.
 */
export default function KolomSandi({
  id,
  value,
  onChange,
  autoComplete = 'current-password',
  autoFocus = false,
  inputRef
}) {
  const [terlihat, setTerlihat] = useState(false);
  const idCadangan = useId();
  const idKolom = id || idCadangan;

  return (
    <div className="ks-bungkus">
      <input
        id={idKolom}
        ref={inputRef}
        className="ks-input"
        type={terlihat ? 'text' : 'password'}
        value={value}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        onChange={onChange}
      />

      {/* type="button" wajib: tanpa itu ia menjadi tombol kirim bawaan, dan
          menekan "tampilkan" akan mengirimkan formulirnya. */}
      <button
        type="button"
        className="ks-tombol"
        onClick={() => setTerlihat((v) => !v)}
        aria-label={terlihat ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
        aria-pressed={terlihat}
        title={terlihat ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
      >
        {terlihat ? <IconMataTutup size={18} /> : <IconMata size={18} />}
      </button>
    </div>
  );
}
