import React from 'react';
import { IconCheck, IconArrowRight } from './Icons.jsx';

/**
 * Dua tombol jawaban saat sistem menanyakan apakah kendala sudah teratasi.
 *
 * Sebelumnya pengguna harus MENGETIK "sudah berhasil" atau "belum berhasil".
 * Itu titik paling rawan pada seluruh alur: pengenal jawaban bekerja dengan
 * mencocokkan frasa, sehingga jawaban di luar dugaan — "oke tapi masih agak
 * lambat", "udah sih" — dapat terbaca keliru. Kalimat "belum berhasil" bahkan
 * memuat kata "berhasil" (lihat KONTEKS-PROYEK.md §6c).
 *
 * Tombol menghilangkan seluruh risiko itu untuk jalur yang paling sering
 * dipakai: teks yang dikirim persis frasa yang dikenali. Mengetik tetap
 * diperbolehkan bagi pengguna yang ingin menjelaskan lebih panjang.
 *
 * Tombol "Hubungi Engineer" sengaja TIDAK ditaruh di sini. Menampilkannya pada
 * setiap jawaban membuat pengguna terdorong melewati langkah perbaikan —
 * alasan yang sama yang mendasari KONTEKS-PROYEK.md §6d. Tombol itu muncul
 * pada waktunya sendiri, ketika sistem memang sudah kehabisan langkah.
 *
 * @param {(teks: string) => void} props.onPick  Mengirim jawaban sebagai pesan
 * @param {boolean} props.disabled
 */
export default function ConfirmReplies({ onPick, disabled }) {
  return (
    <div className="confirm-replies" id="confirm-replies">
      <p className="confirm-replies-label">Bagaimana hasilnya?</p>
      <div className="confirm-replies-list">
        <button
          type="button"
          className="confirm-reply berhasil"
          onClick={() => onPick('sudah berhasil')}
          disabled={disabled}
          id="confirm-berhasil"
        >
          <IconCheck size={16} />
          Sudah berhasil
        </button>

        <button
          type="button"
          className="confirm-reply belum"
          onClick={() => onPick('belum berhasil')}
          disabled={disabled}
          id="confirm-belum"
        >
          Belum berhasil
          <span className="confirm-reply-arrow"><IconArrowRight size={15} /></span>
        </button>
      </div>
      <p className="confirm-replies-hint">
        Atau tuliskan sendiri bila ada keterangan tambahan.
      </p>
    </div>
  );
}
