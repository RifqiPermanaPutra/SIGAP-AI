# Konteks Proyek SIGAP

> Dokumen serah-terima. Bacalah berkas ini lebih dulu sebelum mengubah apa pun,
> terutama bagian **Keputusan Penting** dan **Jebakan yang Sudah Ditemukan** —
> beberapa hal di sana tampak seperti kesalahan padahal sengaja dibuat begitu.

---

## 1. Ringkasan

**SIGAP** — layanan bantuan (helpdesk) ICT untuk PT Pertamina EP Asset 1
Regional 1 Field Lirik. Pekerja menyampaikan kendala ICT, sistem memandu
langkah perbaikan dari SOP, dan bila belum tuntas laporan diteruskan ke
engineer divisi terkait melalui WhatsApp.

- Pengembang: Rifqi Permana Putra
- Repositori: https://github.com/RifqiPermanaPutra/SIGAP-AI
- Sifat: **sistem internal untuk PT Pertamina EP Field Lirik** — dibangun untuk
  dipakai sehari-hari oleh pekerja dan Engineer ICT, bukan proyek akademik.
  Karena itu prioritasnya kesiapan operasional: data yang benar, laporan yang
  dapat dipertanggungjawabkan, dan sistem yang tidak kehilangan data.

**Penting:** sistem ini **sudah tidak memakai AI**. Namanya dulu "SIGAP AI",
dan kata "AI" dibuang setelah arsitekturnya berpindah — nama yang menjanjikan
sesuatu yang tidak ada akan menyesatkan siapa pun yang datang berikutnya, dan
membuat orang mengira jawaban yang keliru berasal dari model yang mengarang.
Lihat bagian 4.

> Repositori git-nya masih bernama `SIGAP-AI`. Menggantinya berarti mengubah
> URL remote di setiap salinan yang sudah ada, jadi dibiarkan sampai ada
> alasan yang cukup.

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
server/data/knowledge-base.json           (44 masalah, 56 solusi)
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

### e. Kedua logo memakai varian untuk latar gelap
Bilah merek memuat **dua** berkas berdampingan, dan keduanya varian latar
gelap. Bidang di belakangnya wajib biru — di atas putih, keduanya rusak.

| Berkas | Isi | Yang digambar putih |
|---|---|---|
| `public/logo-pertamina-ep.svg` | Pertamina EP | wordmark "PERTAMINA" (`fill="#ffffff"`) |
| `public/logo-satu-it-sigap-dark.png` | PERTAMINA ONE + SATU-IT SIGAP | wordmark "ONE" dan baris tagline |

Ada juga `public/logo-satu-it-sigap.png` — varian **latar terang** dengan
wordmark hitam. Ia sempat dipakai bersama alas putih di belakangnya, dan itu
ditinggalkan: varian gelap yang digambar khusus jauh lebih baik daripada
menambal varian terang dengan panel. **Berkasnya kini tidak dirujuk kode mana
pun**, disimpan hanya untuk keperluan cetak di atas kertas putih.

Karena tidak lagi memerlukan panel, aturannya tinggal `object-fit: contain`
ditambah `filter` pencerah tipis — lihat `.lp-brand-logo-unit` di
`src/index.css` dan saudaranya di tiap halaman.

Rasionya **4,9:1** — jauh lebih lebar daripada logo unit sebelumnya. Pada
navbar sempit (`/tugas`, `/tiket`, `/rekap`, penyunting SOP) teks merek
disembunyikan di bawah 600–700px agar tombol di sisi kanan tidak terdesak
keluar layar; nama halaman tetap terbaca pada judul `<h1>` di bawahnya.

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

**8 divisi layanan:** Printer, CCTV, Telepon, Radio Komunikasi, Windows, FTTH, LAN, WAN

**5 nomor WhatsApp engineer** (di `.env`, tidak ikut ke repositori):

| Nomor | Divisi |
|---|---|
| 1 | Printer, Windows |
| 2 | CCTV, Radio |
| 3 | Telepon |
| 4 | LAN, WAN |
| 5 | FTTH |

**Data pilihan pengguna** (`src/data/`):
- `fungsi.js` — 7 fungsi: FM, HC & Plan Eval, PE & WO/WS, Finance, R.A.M, Legal & Relation, PO
- `lokasi.js` — 29 lokasi dalam 3 area: Buatan (2), Ukui (4), Lirik (23)
- `urgensi.js` — 4 tingkat: Rendah, Sedang, Tinggi, Kritis

---

## 9. Status Basis Pengetahuan

Sejak divisi dibagi menjadi mode `swalayan` dan `engineer`, **hanya SOP Printer
dan Windows yang benar-benar disajikan kepada pengguna.** Enam divisi lain
langsung diteruskan ke engineer, sehingga isinya tidak lagi menghambat.

| Divisi | Mode | Status |
|---|---|---|
| Printer, Windows | `swalayan` | **Lengkap** — tiap masalah ringan punya 3 solusi. Draf, belum divalidasi engineer |
| LAN, CCTV, FTTH | `engineer` | Sudah disusun rinci, tetapi tidak disajikan ke pengguna |
| Telepon, Radio Komunikasi, WAN | `engineer` | Masih data contoh (dummy), tidak disajikan ke pengguna |

Alur percakapan menjanjikan **tiga** solusi sebelum menyerah ke engineer
(`MAKS_SOLUSI = 3`). Sebelumnya 8 dari 10 masalah ringan pada divisi swalayan
hanya memiliki satu solusi, sehingga sistem menyerah setelah percobaan pertama
padahal antarmukanya menjanjikan tiga. Sudah dilengkapi, dan dijaga oleh
pengujian `npm test` bagian "Kelengkapan data divisi swalayan".

Tiga divisi terakhir sengaja belum disusun: isinya sangat spesifik lapangan
(jenis PABX, frekuensi radio, topologi antar site) dan **tidak boleh** diisi
dari sumber umum. Radio Komunikasi terutama — alat komunikasi darurat, salah
instruksi berisiko.

Terdapat penanda `[KONFIRMASI]` di berkas SOP: hal-hal yang hanya engineer yang
tahu (merek perangkat, nama WiFi, penyedia fiber, dsb). Semuanya terkumpul di
blok "Catatan Konfirmasi Engineer" pada akhir tiap berkas, bukan tersebar di
dalam langkah — jadi langkah SOP-nya sudah dapat dipakai apa adanya.

Seluruhnya ada **29 penanda**. Yang benar-benar mendesak hanya **11 penanda
pada Printer dan Windows**, karena hanya kedua divisi itu yang isinya sampai ke
pengguna.

Panduan pengumpulan data dari engineer: `knowledge-base/_TEMPLATE-PENGISIAN.md`

Sejak ada halaman `/sop-editor`, SOP dapat disunting langsung lewat peramban
oleh admin — tidak perlu lagi menyunting Markdown, menjalankan `npm run
build:kb`, lalu menyalakan ulang server. Berkas Markdown tetap menjadi sumber
kebenaran; penyunting itu menulis ulang berkas yang sama. Penanda
`[KONFIRMASI]` sengaja ditampilkan baca-saja di sana: isinya harus datang dari
jawaban engineer, bukan dari tebakan.

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

**Menunggu pihak lain:**
4. **Nomor WhatsApp engineer FTTH** belum diisi di `.env`; eskalasinya jatuh ke
   `WHATSAPP_DEFAULT`

**Langkah menuju pemakaian nyata:**
5. Deploy — masih berjalan di laptop pengembang. Perlu komputer yang menyala
   terus, proses yang hidup ulang otomatis, dan sebaiknya HTTPS
   (`COOKIE_SECURE=1` dan `TRUST_PROXY=1` bila di belakang reverse proxy)
6. Uji pakai oleh beberapa pekerja sebelum diumumkan ke seluruh Field Lirik

**Sudah selesai:**
- Riwayat laporan berupa grafik per hari/minggu/bulan, dengan penyaringan
- Perpindahan penyimpanan dari berkas JSON ke SQLite
- Autentikasi halaman rekap (peran admin & engineer) beserta jejak akses
- Mode divisi `swalayan` / `engineer` sesuai masukan Engineer ICT
- SOP Printer & Windows lengkap tiga solusi per masalah ringan
- Pencadangan harian otomatis + salinan ke luar mesin (`CADANGAN_LUAR`),
  retensi 2 tahun, log aplikasi bertahan
- Pembatas laju, penguncian masuk per akun+alamat, penangkap galat tampilan
- Penyunting SOP lewat peramban (`/sop-editor`, khusus admin) — cadangan
  sebelum menimpa, pratinjau hasil urai, dan alat uji skor pencocokan
- Daftar tugas engineer (`/tugas`) — nomor tiket kini ikut terkirim lewat
  WhatsApp beserta tautan langsung, sehingga tiket dapat ditandai selesai dari
  ponsel tanpa membuka tabel rekap
- Skrip pendaftar Task Scheduler Windows (`skrip-windows/`)
- Pengujian otomatis: 295 pemeriksaan, termasuk tolok ukur akurasi pencocokan
- Logo Pertamina ONE dan SATU-IT SIGAP transparan terpasang responsif di navbar
  dan header percakapan

---

## 12. Keadaan Git

- Cabang: `main`
- Commit terakhir: `8594b5a` — "mengubah desain ke mobile"
- **54 berkas belum di-commit** — termasuk pencadangan otomatis, pembatas laju,
  skrip Windows, penyunting SOP, dan daftar tugas engineer

> ⚠️ Ini risiko terbesar yang paling mudah dihilangkan. Pekerjaan berbulan-bulan
> hanya berada di satu disk, yaitu disk yang sama dengan basis datanya.
> Lakukan commit sebelum apa pun yang lain.

`.env` berisi nomor WhatsApp asli dan **tidak boleh** ikut ter-commit
(sudah diabaikan `.gitignore`).
