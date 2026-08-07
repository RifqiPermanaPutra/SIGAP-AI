/**
 * Rute penyunting SOP.
 *
 * Mengubah satu langkah SOP sebelumnya menuntut: menyunting Markdown,
 * menjalankan `npm run build:kb`, menjalankan `npm run build`, lalu
 * menyalakan ulang server. Engineer ICT tidak akan melakukan itu — dan SOP
 * yang tidak pernah diperbarui lebih berbahaya daripada tidak ada SOP sama
 * sekali, karena instruksinya keliru namun disampaikan dengan percaya diri.
 *
 * Seluruh rute di berkas ini WAJIB admin. Tidak ada sistem hak akses baru:
 * penjaganya `wajibMasuk('admin')` yang sudah dipakai rute lain.
 */
import { Router } from 'express';
import { wajibMasuk, catatAkses } from '../services/authService.js';
import { bacaSop, simpanMasalah, pratinjauMasalah, daftarCadanganSop } from '../services/sopBerkas.js';
import { cariMasalah, kandidatTeratas, AMBANG_COCOK } from '../services/answerService.js';
import { DIVISI_KE_FOLDER } from '../services/sopParser.js';
import { DIVISIONS } from '../config/divisi.js';

export const sopRouter = Router();

/** Seluruh rute penyunting SOP mengubah atau memperlihatkan sumber kebenaran */
sopRouter.use(wajibMasuk('admin'));

const divisiSah = (divisi) => Boolean(DIVISI_KE_FOLDER[divisi]);

/**
 * GET /api/sop
 * Daftar divisi beserta jumlah masalahnya — halaman pembuka penyunting.
 */
sopRouter.get('/', (req, res) => {
  const daftar = DIVISIONS.map((d) => {
    const sop = bacaSop(d.id);
    return {
      id: d.id,
      nama: d.name,
      mode: d.mode,
      tersedia: Boolean(sop),
      jumlahMasalah: sop ? sop.masalah.length : 0,
      // Hanya divisi swalayan yang isinya benar-benar sampai ke pengguna;
      // sisanya langsung diteruskan ke engineer. Perbedaan itu menentukan
      // mana yang mendesak diperbaiki.
      disajikan: d.mode === 'swalayan'
    };
  });

  res.json({ success: true, divisi: daftar });
});

/**
 * GET /api/sop/:divisi
 * Isi satu berkas SOP dalam bentuk terstruktur untuk formulir penyunting.
 */
sopRouter.get('/:divisi', (req, res) => {
  const { divisi } = req.params;
  if (!divisiSah(divisi)) {
    return res.status(400).json({ success: false, error: 'Divisi tidak valid' });
  }

  const sop = bacaSop(divisi);
  if (!sop) {
    return res.status(404).json({ success: false, error: 'Berkas SOP divisi ini tidak ditemukan' });
  }

  catatAkses(req.pengguna.akun, 'sop-dibuka', divisi);

  res.json({
    success: true,
    ...sop,
    cadangan: daftarCadanganSop(divisi).slice(0, 10),
    ambangCocok: AMBANG_COCOK
  });
});

/**
 * POST /api/sop/:divisi/:masalahId/pratinjau
 * Susun Markdown dan urai kembali tanpa menulis apa pun.
 *
 * Wajib dilihat admin sebelum menimpa berkas asli: yang menentukan apakah SOP
 * ini akan pernah ditemukan pengguna bukan bentuk formulirnya, melainkan hasil
 * urainya — kata kunci apa yang terkumpul, dan berapa solusi yang benar-benar
 * terbaca.
 */
sopRouter.post('/:divisi/:masalahId/pratinjau', (req, res) => {
  const { divisi, masalahId } = req.params;
  if (!divisiSah(divisi)) {
    return res.status(400).json({ success: false, error: 'Divisi tidak valid' });
  }

  const hasil = pratinjauMasalah(divisi, masalahId, req.body || {});

  if (!hasil.ok) {
    return res.status(hasil.status).json({ success: false, error: hasil.galat[0], galat: hasil.galat });
  }

  res.json({
    success: true,
    markdown: hasil.markdown,
    // Hasil urai apa adanya — inilah yang akan masuk ke basis pengetahuan
    hasil: {
      id: hasil.hasil.id,
      judul: hasil.hasil.judul,
      kategori: hasil.hasil.kategori,
      gejala: hasil.hasil.gejala,
      penyebab: hasil.hasil.penyebab,
      penanganan: hasil.hasil.penanganan,
      solusi: hasil.hasil.solusi.map((s) => ({ judul: s.judul, langkah: s.langkah.length })),
      kataKunci: hasil.hasil.kataKunci
    }
  });
});

/**
 * PUT /api/sop/:divisi/:masalahId
 * Perbarui satu blok masalah, cadangkan yang lama, bangun ulang, muat ulang.
 */
sopRouter.put('/:divisi/:masalahId', (req, res) => {
  const { divisi, masalahId } = req.params;
  if (!divisiSah(divisi)) {
    return res.status(400).json({ success: false, error: 'Divisi tidak valid' });
  }

  const hasil = simpanMasalah(divisi, masalahId, req.body || {});

  if (!hasil.ok) {
    return res.status(hasil.status).json({
      success: false,
      error: hasil.galat[0],
      galat: hasil.galat
    });
  }

  catatAkses(req.pengguna.akun, 'sop-disunting', `${divisi}/${masalahId}`);

  res.json({
    success: true,
    message: `SOP diperbarui — basis pengetahuan dimuat ulang (${hasil.kb.dimuat} masalah)`,
    masalah: hasil.masalah,
    kb: hasil.kb,
    cadangan: hasil.cadangan
  });
});

/**
 * POST /api/sop/uji
 * Coba satu contoh keluhan terhadap basis pengetahuan yang sedang aktif.
 *
 * Inilah yang mencegah SOP baru yang tidak pernah tersentuh siapa pun: skor
 * pencocokan bergantung pada kekhasan kata, sehingga judul dan gejala yang
 * terdengar wajar bagi manusia bisa saja tidak pernah menembus ambang 0,4.
 * Tanpa alat uji, hal itu baru ketahuan berbulan-bulan kemudian lewat daftar
 * "keluhan yang belum dikenali" di halaman rekap.
 */
sopRouter.post('/uji', (req, res) => {
  const { keluhan, divisi } = req.body || {};

  if (!divisiSah(divisi)) {
    return res.status(400).json({ success: false, error: 'Divisi tidak valid' });
  }
  if (!String(keluhan || '').trim()) {
    return res.status(400).json({ success: false, error: 'Contoh keluhan wajib diisi' });
  }

  const teratas = kandidatTeratas(keluhan, divisi);
  const cocok = cariMasalah(keluhan, divisi);

  res.json({
    success: true,
    ambang: AMBANG_COCOK,
    // Skor apa adanya, termasuk yang di bawah ambang — nilai 0,3 memberi tahu
    // penyusun SOP bahwa ia sudah dekat, bukan sekadar "tidak cocok".
    skor: teratas ? Number(teratas.skor.toFixed(3)) : 0,
    masalah: teratas ? { id: teratas.masalah.id, judul: teratas.masalah.judul } : null,
    dijawab: Boolean(cocok)
  });
});
