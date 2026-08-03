# Konteks Proyek SIGAP AI

> Dokumen serah-terima. Bacalah berkas ini lebih dulu sebelum mengubah apa pun,
> terutama bagian **Keputusan Penting** dan **Jebakan yang Sudah Ditemukan** —
> beberapa hal di sana tampak seperti kesalahan padahal sengaja dibuat begitu.

---

## 1. Ringkasan

**SIGAP AI** — layanan bantuan (helpdesk) ICT untuk PT Pertamina EP Asset 1
Regional 1 Field Lirik. Pekerja menyampaikan kendala ICT, sistem memandu
langkah perbaikan dari SOP, dan bila belum tuntas laporan diteruskan ke
engineer divisi terkait melalui WhatsApp.

- Pengembang: Rifqi Permana Putra · Teknik Informatika, Universitas Islam Riau
- Repositori: https://github.com/RifqiPermanaPutra/SIGAP-AI
- Sifat: proyek skripsi, direncanakan dipakai nyata di Field Lirik

**Penting:** meski namanya "SIGAP AI", sistem ini **sudah tidak memakai AI**.
Nama tetap dipertahankan sebagai merek. Lihat bagian 4.

---

## 2. Alur Pengguna

```
Beranda
  └─> Pilih layanan (8 divisi ICT)
        └─> Sampaikan kendala (percakapan)
              ├─> Solusi Pertama  → "belum berhasil"
              ├─> Solusi Kedua    → "belum berhasil"
              ├─> Solusi Ketiga   → "belum berhasil"
              └─> Formulir data pelapor
                    └─> WhatsApp engineer divisi terkait
```

Formulir data pelapor (nama, fungsi, lokasi, tingkat urgensi) **muncul di akhir**,
saat kendala benar-benar perlu diteruskan ke engineer — bukan di awal. Pengguna
yang kendalanya selesai di percakapan tidak mengisi apa pun.

---

## 3. Teknologi

| Bagian | Teknologi |
|---|---|
| Antarmuka | React 19 + Vite 8 |
| Server | Express 5 (Node.js) |
| Basis pengetahuan | Berkas JSON hasil bangun dari SOP |
| Riwayat laporan | SQLite lewat `node:sqlite` (modul bawaan Node) |
| Dependensi runtime | `compression`, `cors`, `dotenv`, `express` |

Tidak ada layanan awan dan tidak ada API key. Basis data memakai modul bawaan
Node, sehingga dependensi runtime tetap empat seperti sebelumnya.

**Syarat: Node.js 22.5+** (`node:sqlite`), diuji pada Node 24.

---

## 4. Riwayat Arsitektur AI (penting untuk dipahami)

Sistem ini sudah berpindah arsitektur **tiga kali**. Urutannya:

1. **Ollama lokal** (awal proyek)
2. **NVIDIA NIM (awan)** — lebih cepat, tetapi bergantung internet dan API key
3. **NVIDIA utama + Ollama cadangan** — berlapis
4. **Tanpa AI sama sekali** ← **kondisi sekarang**

Migrasi terakhir dilakukan atas permintaan pengembang. Alasannya masuk akal:
untuk helpdesk berbasis SOP, jawaban wajib persis mengikuti dokumen, dan AI
justru menambah risiko mengarang, biaya, serta ketergantungan internet.

**Hasil migrasi:**

| | Dengan AI | Tanpa AI |
|---|---|---|
| Waktu jawab | 4–70 detik | 0,14 detik |
| Butuh internet | ya | tidak |
| Butuh API key | ya | tidak |
| `node_modules` | 64 MB | 47 MB |
| Basis pengetahuan | 1,6 MB (vektor) | 83 KB (JSON) |
| Bisa mengarang | ya | tidak mungkin |

Seluruh modul AI sudah dihapus: `ragService.js`, `embeddingService.js`,
`knowledgeBaseService.js`, `scripts/ingest.js`, dependensi `openai`.

---

## 5. Cara Kerja Sekarang (tanpa AI)

```
knowledge-base/<divisi>/sop-*.md          (sumber, ditulis manusia)
        │
        │  npm run build:kb
        ▼
server/data/knowledge-base.json           (44 masalah, 40 solusi)
        │
        ▼
Keluhan pengguna ──> teksUtil.js ──> answerService.js ──> jawaban
                     (seragamkan)      (cocokkan)         (dari data SOP)
```

**Berkas inti:**

| Berkas | Peran |
|---|---|
| `server/services/teksUtil.js` | Penyeragam bahasa: sinonim, kata umum, akhiran |
| `server/services/answerService.js` | Pencocokan keluhan + penyusun jawaban |
| `scripts/build-kb.js` | Pengurai Markdown SOP → JSON |
| `server/data/knowledge-base.json` | Hasil bangun (jangan disunting manual) |

**Cara pencocokan** (tanpa AI, murni kata kunci):
1. Keluhan diseragamkan — `lemot`→`lambat`, `gabisa`→`tidak bisa`, `ngeprint`→`cetak`
2. Kata umum dibuang, akhiran `-nya` dilepas
3. Tiap masalah diberi skor; kata pada **judul** bernilai 3×, **gejala** 2×, **penyebab** 1×
4. Tiap kata dibobot menurut **kekhasannya** dalam divisi tersebut
5. Skor ≥ 0,4 → dijawab · 0,2–0,4 → tawarkan pilihan · < 0,2 → arahkan ke engineer

Akurasi pengujian: **28 dari 29** keluhan realistis.

---

## 6. Keputusan Penting (jangan diubah tanpa alasan kuat)

### a. Ambang pencocokan sengaja tinggi (0,4)
Untuk layanan pengaduan, menjawab "belum dikenali" lalu menawarkan bantuan
engineer **jauh lebih baik** daripada memberi langkah perbaikan untuk masalah
yang keliru. Menurunkan ambang akan menaikkan jawaban salah.

### b. Pembobotan kekhasan kata
Kata "printer" muncul di 4 dari 6 masalah divisi Printer sehingga hampir tidak
membedakan apa pun; kata "macet" hanya di 1 dan sangat menentukan. Tanpa
pembobotan ini, keluhan *"printer berwarna ungu"* keliru dijawab "Kertas Macet".

### c. Pemeriksaan "belum" didahulukan sebelum "sudah"
Kalimat **"belum berhasil" memuat kata "berhasil"**. Bila urutannya dibalik,
pengguna yang gagal justru diucapkan selamat. Ini pernah terjadi dan sudah
diperbaiki — jangan dibalik lagi.

### d. Deteksi eskalasi berbasis frasa khas
Menganggap setiap penyebutan "Engineer ICT" sebagai eskalasi membuat tombol
Hubungi Engineer muncul di hampir semua jawaban, sehingga pengguna terdorong
melewati langkah perbaikan. Penanda yang dipakai: `kategori berat`,
`masalah berat`, `memerlukan penanganan langsung oleh engineer`,
`silakan tekan tombol`, `tombol whatsapp`.
Frasa "tombol WhatsApp" sudah diverifikasi hanya muncul pada 14 blok berat dan
**0 blok ringan**.

### e. Logo Pertamina wajib di atas latar gelap
Berkas `public/logo-pertamina-ep.svg` adalah **varian untuk latar gelap** —
wordmark "PERTAMINA" digambar putih (`fill="#ffffff"`). Menaruhnya di atas
bidang putih membuat tulisan PERTAMINA lenyap, menyisakan emblem dan "EP" saja.
Karena itu navbar dan header percakapan berlatar biru.

### f. Formulir data di akhir, bukan di awal
Sebagian besar kendala selesai di percakapan. Meminta data di awal membebani
semua pengguna demi sebagian kecil yang benar-benar memerlukan engineer.

---

## 7. Jebakan yang Sudah Ditemukan

| Jebakan | Penjelasan |
|---|---|
| `.gitignore` pola `data/` | Pernah mengabaikan `src/data/` yang berisi kode, membuat hasil clone rusak. Sudah diperbaiki menjadi `/data/` (hanya akar). |
| Jalur menu Windows 11 | SOP lama memakai jalur Windows 10 (`Settings > Devices`). Yang benar: `Settings > Bluetooth & devices`. |
| Kompresi server | Sempat tidak aktif — server mengirim 440 KB mentah meski peramban meminta gzip. Sekarang aktif, transfer turun ke 135 KB. |
| Pemotongan dokumen SOP | Batas terlalu kecil membuat "Solusi Ketiga" terpisah dari judulnya sehingga tak dapat ditemukan. |
| Nomor WhatsApp format lokal | `0812-xxx` harus dinormalkan ke `62812xxx`, jika tidak tautan wa.me gagal. Sudah ditangani di `server.js`. |

---

## 8. Data Lapangan

**8 divisi layanan:** Printer, CCTV, Telepon, Radio Komunikasi, Windows, FTTP, LAN, WAN

**5 nomor WhatsApp engineer** (di `.env`, tidak ikut ke repositori):

| Nomor | Divisi |
|---|---|
| 1 | Printer, Windows |
| 2 | CCTV, Radio |
| 3 | Telepon |
| 4 | LAN, WAN |
| 5 | FTTP |

**Data pilihan pengguna** (`src/data/`):
- `fungsi.js` — 7 fungsi: FM, HC & Plan Eval, PE & WO/WS, Finance, R.A.M, Legal & Relation, PO
- `lokasi.js` — 29 lokasi dalam 3 area: Buatan (2), Ukui (4), Lirik (23)
- `urgensi.js` — 4 tingkat: Rendah, Sedang, Tinggi, Kritis

---

## 9. Status Basis Pengetahuan

| Divisi | Status |
|---|---|
| Printer, Windows, LAN, CCTV, FTTP | Sudah disusun rinci — **draf, belum divalidasi engineer** |
| Telepon, Radio Komunikasi, WAN | **Masih data contoh (dummy)** |

Tiga divisi terakhir sengaja belum disusun: isinya sangat spesifik lapangan
(jenis PABX, frekuensi radio, topologi antar site) dan **tidak boleh** diisi
dari sumber umum. Radio Komunikasi terutama — alat komunikasi darurat, salah
instruksi berisiko.

Terdapat **33 penanda `[KONFIRMASI]`** di berkas SOP: hal-hal yang hanya
engineer yang tahu (merek perangkat, nama WiFi, penyedia fiber, dsb).

Panduan pengumpulan data dari engineer: `knowledge-base/_TEMPLATE-PENGISIAN.md`

---

## 10. Cara Menjalankan

```bash
npm install
cp .env.example .env      # lalu isi nomor WhatsApp engineer
npm run build:kb          # bangun basis pengetahuan dari SOP
npm run build             # bangun antarmuka
npm start                 # jalankan di http://localhost:3000
```

Mode pengembangan (dua terminal):
```bash
npm run dev            # server, port 3000
npm run dev:frontend   # antarmuka dengan hot-reload, port 5173
```

**Setelah mengubah berkas SOP, wajib jalankan `npm run build:kb`.**

---

## 11. Pekerjaan yang Belum Selesai

**Kritis sebelum dipakai nyata:**
1. Data SOP 3 divisi (Telepon, Radio, WAN) — wajib wawancara engineer
2. Validasi engineer untuk 5 divisi yang sudah disusun
3. Pengisian 33 penanda `[KONFIRMASI]`

**Diminta tetapi belum dikerjakan:**
4. **Berkas logo `public/logo-satu-it-sigap.png`** — kode sudah siap di navbar
   dan header, elemennya tersembunyi otomatis karena berkasnya belum ada

**Perlu dipertimbangkan:**
5. Belum ada pengujian otomatis yang tersimpan di repositori
6. Belum di-deploy, masih berjalan di laptop pengembang
7. `src/index.css` masih ditulis desktop-first (20 aturan `max-width` pada
   titik henti 400/720/980). Halaman rekap sudah mobile-first dengan
   `min-width`; keduanya belum seragam.

**Sudah selesai (lihat `RANCANGAN-DATA.md`):**
- Riwayat laporan berupa grafik per hari/minggu/bulan, dengan penyaringan
- Perpindahan penyimpanan dari berkas JSON ke SQLite
- Autentikasi halaman rekap (peran admin & engineer) beserta jejak akses
- Mode divisi `swalayan` / `engineer` sesuai masukan Engineer ICT

---

## 12. Keadaan Git

- Cabang: `main`
- Commit terakhir: `8ef8c0c` — "Rombak SIGAP AI: LLM berlapis, SOP rinci, dan efisiensi bundel"
- **22 berkas belum di-commit** — termasuk seluruh migrasi tanpa AI, formulir
  urgensi, dan pemindahan alur formulir

`.env` berisi nomor WhatsApp asli dan **tidak boleh** ikut ter-commit
(sudah diabaikan `.gitignore`).
