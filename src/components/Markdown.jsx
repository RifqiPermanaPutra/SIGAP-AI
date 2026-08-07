import React from 'react';

/**
 * Penampil Markdown ringan, khusus untuk format jawaban SIGAP.
 *
 * Menggantikan pustaka react-markdown yang menyeret lebih dari 60 paket
 * (sekitar 2,2 MB) hanya untuk menampilkan teks tebal dan daftar bernomor.
 * Jawaban asisten hanya memakai sebagian kecil sintaks Markdown:
 *
 *   **tebal**        judul bagian, misalnya **Langkah Penyelesaian**
 *   *miring*         penekanan sesekali
 *   `kode`           nama menu atau tombol
 *   [teks](tujuan)   tautan, misalnya ke halaman cek status tiket
 *   - butir          daftar penyebab
 *   1. butir         langkah penyelesaian
 *   ### judul        judul kecil
 *
 * Keluaran dibangun sebagai elemen React, bukan HTML mentah, sehingga teks
 * dari model tidak mungkin dieksekusi sebagai skrip.
 */

// Pemenggal penanda dalam satu baris. Tautan diperiksa lebih dulu agar teks di
// dalamnya — yang boleh memuat **tebal** — tidak terpenggal lebih awal.
const POLA_INLINE = /(\[[^\]\n]+\]\([^)\s]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;
const POLA_TAUTAN = /^\[([^\]\n]+)\]\(([^)\s]+)\)$/;

/**
 * Loloskan hanya tujuan tautan yang aman.
 *
 * Isi jawaban berasal dari berkas SOP yang dapat disunting lewat peramban,
 * sehingga tujuan tautan adalah masukan yang harus diperlakukan sebagai tidak
 * tepercaya. Tanpa penyaringan ini, `javascript:` pada href berarti satu baris
 * SOP dapat menjalankan skrip di halaman pelapor.
 *
 * @returns {string|null} tujuan yang boleh dipakai, atau null bila ditolak
 */
function tujuanAman(tujuan) {
  // Jalur di dalam aplikasi sendiri, misalnya '/tiket?nomor=SGP-…'.
  // '//host' sengaja ditolak: bentuknya mirip jalur, tujuannya situs lain.
  if (tujuan.startsWith('/') && !tujuan.startsWith('//')) return tujuan;
  if (/^https?:\/\//i.test(tujuan)) return tujuan;
  if (/^(mailto|tel):/i.test(tujuan)) return tujuan;
  return null;
}

/** Ubah satu baris teks menjadi rangkaian elemen React */
function renderInline(teks, kunci = 'i') {
  const bagian = String(teks).split(POLA_INLINE).filter(Boolean);

  return bagian.map((potongan, i) => {
    const k = `${kunci}-${i}`;

    const tautan = potongan.match(POLA_TAUTAN);
    if (tautan) {
      const tujuan = tujuanAman(tautan[2]);
      // Teks tautan tidak boleh memuat ']', sehingga tidak mungkin memuat
      // tautan lain — rekursi di sini pasti berhenti satu tingkat.
      const isi = renderInline(tautan[1], `${k}-t`);
      if (!tujuan) return <React.Fragment key={k}>{isi}</React.Fragment>;
      return (
        // Selalu tab baru, termasuk untuk jalur di dalam aplikasi. Percakapan
        // hanya hidup di memori peramban: berpindah halaman pada tab yang sama
        // membuangnya, dan pelapor yang kembali akan memperoleh sesi baru
        // dengan nomor tiket yang berbeda dari nomor yang baru saja ia buka.
        <a key={k} href={tujuan} target="_blank" rel="noopener noreferrer">{isi}</a>
      );
    }

    if (potongan.startsWith('**') && potongan.endsWith('**')) {
      return <strong key={k}>{potongan.slice(2, -2)}</strong>;
    }
    if (potongan.startsWith('`') && potongan.endsWith('`')) {
      return <code key={k}>{potongan.slice(1, -1)}</code>;
    }
    if (potongan.startsWith('*') && potongan.endsWith('*')) {
      return <em key={k}>{potongan.slice(1, -1)}</em>;
    }
    return <React.Fragment key={k}>{potongan}</React.Fragment>;
  });
}

const POLA_BUTIR = /^\s*[-*]\s+(.*)$/;
const POLA_NOMOR = /^\s*\d+[.)]\s+(.*)$/;
const POLA_JUDUL = /^\s*(#{1,6})\s+(.*)$/;

export default function Markdown({ children }) {
  const baris = String(children || '').split('\n');
  const elemen = [];

  // Penampung sementara untuk baris-baris yang membentuk satu blok
  let daftar = null;      // { tipe: 'ul' | 'ol', isi: string[] }
  let paragraf = [];

  const tutupParagraf = () => {
    if (paragraf.length === 0) return;
    elemen.push(
      <p key={`p-${elemen.length}`}>
        {paragraf.map((t, i) => (
          <React.Fragment key={i}>
            {i > 0 && <br />}
            {renderInline(t, `p${elemen.length}-${i}`)}
          </React.Fragment>
        ))}
      </p>
    );
    paragraf = [];
  };

  const tutupDaftar = () => {
    if (!daftar) return;
    const Tag = daftar.tipe;
    elemen.push(
      <Tag key={`l-${elemen.length}`}>
        {daftar.isi.map((t, i) => (
          <li key={i}>{renderInline(t, `l${elemen.length}-${i}`)}</li>
        ))}
      </Tag>
    );
    daftar = null;
  };

  for (const isiBaris of baris) {
    const kosong = isiBaris.trim() === '';
    const judul = isiBaris.match(POLA_JUDUL);
    const butir = isiBaris.match(POLA_BUTIR);
    const nomor = isiBaris.match(POLA_NOMOR);

    if (kosong) {
      tutupDaftar();
      tutupParagraf();
      continue;
    }

    if (judul) {
      tutupDaftar();
      tutupParagraf();
      elemen.push(<h3 key={`h-${elemen.length}`}>{renderInline(judul[2], `h${elemen.length}`)}</h3>);
      continue;
    }

    if (butir || nomor) {
      tutupParagraf();
      const tipe = butir ? 'ul' : 'ol';
      const teks = butir ? butir[1] : nomor[1];

      // Pergantian jenis daftar menutup daftar sebelumnya
      if (daftar && daftar.tipe !== tipe) tutupDaftar();
      if (!daftar) daftar = { tipe, isi: [] };
      daftar.isi.push(teks);
      continue;
    }

    tutupDaftar();
    paragraf.push(isiBaris);
  }

  tutupDaftar();
  tutupParagraf();

  return <>{elemen}</>;
}
