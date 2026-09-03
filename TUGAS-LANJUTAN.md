# Tugas Lanjutan SIGAP AI — Auto-start, Uji Cetak, Penyunting SOP

> Salin isi berkas ini sebagai prompt ke sesi Claude Code baru di folder
> proyek ini. Ditulis mandiri — tidak bergantung riwayat percakapan
> sebelumnya.

---

## Konteks proyek

**SIGAP AI** adalah sistem helpdesk IT internal untuk PT Pertamina EP Asset 1
Regional 1 Field Lirik — **bukan proyek skripsi**, dipakai nyata sehari-hari.
Pekerja menyampaikan kendala IT lewat halaman web, sistem memandu perbaikan
dari SOP (murni pencocokan kata kunci, **tanpa AI**), dan bila belum tuntas
laporan diteruskan ke engineer via WhatsApp.

**Wajib dibaca lebih dulu, dalam urutan ini:**
1. `KONTEKS-PROYEK.md` — keputusan penting & jebakan yang sudah ditemukan.
   Beberapa hal di sana tampak seperti kesalahan padahal sengaja dibuat begitu.
2. `README.md` — cara menjalankan, struktur, perintah yang tersedia
3. `RANCANGAN-DATA.md` — skema data & laporan rekap

**Stack:** React 19 + Vite 8 (frontend), Express 5 (backend), SQLite lewat
`node:sqlite` bawaan Node (bukan paket pihak ketiga). **Empat** dependensi
runtime saja (`compression`, `cors`, `dotenv`, `express`) — pertahankan ini,
jangan tambah dependensi kecuali benar-benar tidak terhindarkan.

**Sebelum menyentuh apa pun:**
```bash
npm install
# harus 116 pemeriksaan lulus (37 basisdata + 9 akurasi + 70 api)
npm test
```
Jika ada yang gagal sebelum Anda mengubah apa pun, laporkan dan hentikan —
jangan lanjut di atas fondasi yang sudah rusak.

---

## Tugas 1 — Jalan otomatis saat komputer menyala (Windows)

### Keadaan sekarang
`skrip-windows/jalankan-sigap.bat` sudah ada dan berfungsi — memanggil
`node server.js` langsung (bukan lewat `npm start`, karena npm adalah proses
perantara `.cmd` yang bisa meninggalkan server tanpa induk saat dihentikan).
**Yang belum ada: skrip pendaftar Task Scheduler.**

### Yang harus dikerjakan

Buat `skrip-windows/pasang-tugas-terjadwal.ps1` (PowerShell) yang:

1. Mendaftarkan Task Scheduler untuk menjalankan
   `skrip-windows\jalankan-sigap.bat` **saat komputer menyala (at startup)**,
   bukan saat user login — server helpdesk harus hidup meski tidak ada yang
   login.
2. Dikonfigurasi agar **restart otomatis jika prosesnya berhenti** (Task
   Scheduler punya opsi "Restart the task if it fails", set beberapa kali
   percobaan dengan jeda wajar, misal 3x setiap 1 menit).
3. **Idempotent** — bisa dijalankan berkali-kali tanpa membuat tugas duplikat
   (cek dulu dengan `Get-ScheduledTask`, hapus yang lama sebelum membuat ulang
   bila sudah ada).
4. Menampilkan ringkasan jelas di akhir: nama tugas, kapan akan berjalan,
   cara memeriksa statusnya (`Get-ScheduledTaskInfo`), cara menghentikannya.
5. **Jangan otomatis dijalankan oleh Anda (AI)** — ini mengubah pengaturan
   sistem operasi pengguna. Buat skripnya, uji sintaksnya (`Test-Path`,
   `-WhatIf` bila memungkinkan), tapi eksekusi pendaftaran sesungguhnya
   diserahkan ke pengguna dengan instruksi jelas di README.

Juga buat `skrip-windows/lepas-tugas-terjadwal.ps1` untuk membongkarnya —
setiap yang bisa dipasang harus bisa dilepas dengan mudah.

Perbarui bagian "Cara Menjalankan" di `README.md` dengan sub-bagian
**"Jalan otomatis saat komputer menyala (Windows)"** yang menjelaskan dua
skrip ini, kapan dipakai, dan peringatan bahwa mendaftarkan tugas terjadwal
adalah tindakan yang mengubah sistem — jalankan PowerShell sebagai
Administrator, dan pahami dulu apa yang dilakukan skripnya.

### Verifikasi
- Baca ulang kedua skrip, pastikan tidak ada `-Force` yang menghapus tugas
  terjadwal *lain* milik pengguna secara tidak sengaja (filter berdasarkan
  nama tugas yang spesifik, misal `SIGAP-AI-Server`).
- Jalankan `skrip-windows/jalankan-sigap.bat` secara manual sekali untuk
  memastikan servernya benar-benar menyala di port 3000 sebelum menyentuh
  Task Scheduler sama sekali.

---

## Tugas 2 — Uji cetak PDF dan uji di ponsel sungguhan

### Latar belakang
Halaman `/rekap` punya tombol "Cetak / Simpan PDF" dengan CSS `@media print`
yang sudah ditulis (lihat `src/rekap/rekap.css`, blok `@media print` di
bagian akhir berkas) — tapi **belum pernah benar-benar dicetak dan dilihat
hasilnya oleh siapa pun**. CSS yang benar secara teori tidak selalu benar di
praktik (tabel terpotong, halaman kosong tambahan, warna yang tidak ikut
tercetak).

Begitu juga tata letak mobile-first di `src/index.css` dan
`src/rekap/rekap.css` — sudah diuji lewat *viewport* tiruan di peramban
(375/768/1280px), **belum pernah dilihat di layar HP sungguhan** (skala DPI,
keyboard virtual, gestur, dsb bisa berbeda dari simulasi).

### Yang harus dikerjakan

**A. Uji cetak PDF**
1. Jalankan server (`npm start`), masuk ke `/rekap` dengan akun admin.
2. Pilih rentang tanggal yang punya cukup data (30 hari atau lebih) supaya
   tabelnya panjang — kasus paling rawan terpotong.
3. Tekan "Cetak / Simpan PDF", simpan sebagai PDF (bukan langsung ke
   printer fisik).
4. Buka PDF-nya, periksa satu per satu:
   - Apakah tabel laporan terpotong rapi antar halaman, atau ada baris yang
     terbelah di tengah?
   - Apakah kotak ringkasan (`.rk-kotak`) dan grafik ikut tercetak dengan
     warna, atau jadi abu-abu/hilang karena peramban membuang warna latar
     secara default?
   - Apakah kop halaman (`.rk-judul-cetak`) muncul dan terbaca?
   - Apakah kontrol antarmuka (tombol, dropdown saringan) **benar-benar
     hilang** dari hasil cetak (kelas `.rk-sembunyi-cetak`)?
   - Ukuran kertas A4 landscape — apakah kolom tabel yang banyak (16 kolom)
     masih terbaca tanpa terlalu kecil?
5. Bila ada cacat, perbaiki `@media print` di `src/rekap/rekap.css` sampai
   hasil cetaknya benar. Uji ulang setelah tiap perbaikan — jangan menebak.

**B. Uji di ponsel sungguhan**
1. Jalankan server di komputer, catat alamat IP lokal komputer tersebut
   (`ipconfig` di Windows, cari `IPv4 Address`).
2. Dari HP yang tersambung ke jaringan Wi-Fi yang sama, buka
   `http://<IP-komputer>:3000` di peramban HP.
3. Uji alur lengkap pelapor: pilih layanan (termasuk kartu "Saya tidak
   yakin"), ketik keluhan dengan keyboard virtual, tekan tombol
   Sudah/Belum berhasil, isi formulir pelapor, tekan Hubungi Engineer —
   pastikan WhatsApp benar-benar terbuka dengan pesan terisi.
4. Uji halaman `/rekap` di HP juga — dialog "Tandai Selesai" khususnya,
   karena ia sengaja dirancang menempel di bawah layar (`align-items: end`)
   supaya dekat ibu jari; pastikan itu terasa wajar, bukan aneh.
5. Perhatikan hal yang tidak bisa disimulasikan dari peramban desktop:
   apakah kolom input memicu perbesaran otomatis (font kurang dari 16px)?
   Apakah area aman (*safe area*) perangkat berponi menutupi tombol kirim?
   Apakah teks kepanjangan sehingga terpotong `…` padahal seharusnya
   tidak?
6. Catat semua cacat yang ditemukan, perbaiki di CSS/komponen terkait, uji
   ulang di HP yang sama sampai bersih.

### Verifikasi
- `npm test` tetap 116/116 lulus setelah perubahan apa pun.
- `npm run build` tanpa galat.
- Dokumentasikan temuan dan perbaikan secara singkat — cukup ringkasan di
  akhir tugas, tidak perlu berkas laporan terpisah.

---

## Tugas 3 — Penyunting SOP lewat peramban (paling menentukan umur sistem)

### Kenapa ini penting
Sekarang, mengubah satu langkah SOP menuntut: menyunting Markdown di
`knowledge-base/<divisi>/sop-*.md`, menjalankan `npm run build:kb`, lalu
`npm run build`, lalu menyalakan ulang server. **Engineer IT tidak akan
melakukan itu.** Akibatnya SOP menjadi usang seiring waktu (printer model
baru, versi Windows baru) dan sistem terus memberi langkah yang tidak lagi
cocok — lebih berbahaya daripada tidak ada SOP sama sekali, karena
instruksinya keliru namun disampaikan dengan percaya diri.

### Prinsip yang wajib dipatuhi

1. **Markdown tetap jadi sumber kebenaran**, disimpan di
   `knowledge-base/<divisi>/sop-*.md` — jangan pindahkan datanya ke tabel
   basis data terpisah. Penyunting web ini menulis ulang berkas Markdown
   yang sama, lalu memicu `build:kb` secara terprogram.
2. **Format parser di `scripts/build-kb.js` wajib dipatuhi persis.** Baca
   berkas itu dulu sebelum menulis apa pun — pahami pola
   `## judul`, `### Gejala yang Dirasakan User`, `### Penyebab yang Mungkin
   Terjadi`, `### Solusi Pertama: ...` / `### Langkah Penyelesaian`,
   `### Kategori`, dan blok akhir `## Catatan Konfirmasi Engineer` dengan
   penanda `[KONFIRMASI]`. Penyunting harus menghasilkan Markdown yang
   persis bisa diurai ulang oleh parser yang sama, tanpa mengubah
   `scripts/build-kb.js` kecuali benar-benar diperlukan.
3. **Wajib admin-only**, memakai `wajibMasuk('admin')` yang sudah ada di
   `server/services/authService.js` — jangan buat sistem hak akses baru.
4. **Wajib ada pratinjau sebelum simpan.** Tampilkan hasil parse (skor
   pencocokan tetap butuh kata kunci yang khas — lihat penjelasan
   pembobotan kekhasan kata di `server/services/answerService.js` dan
   `KONTEKS-PROYEK.md` §6b) sebelum menimpa berkas asli.
5. **Wajib mencadangkan berkas Markdown sebelum menimpa** — pola yang sama
   dengan `server/services/pemeliharaan.js` (cadangan bertanggal, retensi
   terbatas). Perubahan SOP yang salah harus bisa dibatalkan.
6. **Setelah simpan, panggil ulang `build:kb` dan muat ulang basis
   pengetahuan di memori** — lihat `POST /api/kb/reload` yang sudah ada di
   `server/routes/knowledgebase.js` (sudah dilindungi `wajibMasuk('admin')`).
   Jangan minta admin menyalakan ulang server secara manual.
7. **Jangan biarkan penyunting mengekspos `[KONFIRMASI]` sebagai sekadar
   teks bebas.** Field itu representasi hal yang harus divalidasi
   engineer lapangan (merek perangkat, prosedur internal, dsb) — beri
   perlakuan visual berbeda (mis. ditandai kuning/oranye) supaya penyunting
   sadar itu bukan langkah SOP biasa.

### Rancangan minimum yang disarankan

- Rute baru `server/routes/sop.js`: `GET /api/sop/:divisi` (baca &
  urai satu berkas jadi struktur JSON pakai ulang logic `uraiBlok` dari
  `scripts/build-kb.js` — pertimbangkan ekstrak fungsi itu jadi modul
  bersama `server/services/sopParser.js` supaya tidak duplikasi kode antara
  skrip build dan API), `PUT /api/sop/:divisi/:masalahId` (perbarui satu
  blok masalah, susun ulang Markdown, cadangkan yang lama, simpan yang
  baru, panggil `build:kb` + reload).
- Halaman baru `src/sop-editor/` (pola sama seperti `src/rekap/` — dimuat
  terpisah lewat `React.lazy`, rute berdasar `window.location.pathname`,
  lihat `src/main.jsx` sebagai contoh), diakses lewat `/sop-editor`,
  wajib login admin (pakai ulang halaman `Masuk` dari
  `src/rekap/RekapPage.jsx` sebagai referensi pola, boleh diekstrak jadi
  komponen bersama bila masuk akal).
- Form per masalah: gejala, daftar penyebab, hingga 3 solusi (judul +
  pengantar opsional + langkah bernomor), kategori (ringan/berat).
  Untuk kategori berat: field "penanganan" bebas, bukan daftar solusi.
- Tombol "Uji keluhan ini" di halaman penyunting yang memanggil
  `cariMasalah()` / `kandidatTeratas()` secara langsung (lewat API
  kecil) supaya admin bisa mengetik contoh keluhan dan melihat skor
  pencocokan **sebelum** menyimpan — mencegah SOP baru yang skornya
  tidak pernah menembus ambang 0,4 (lihat `AMBANG_COCOK` di
  `server/services/answerService.js`).

### Yang TIDAK perlu dikerjakan sekarang (di luar cakupan)
- Riwayat versi/histori penyuntingan lengkap (cukup satu cadangan
  sebelum-simpan untuk mulai; audit trail lengkap boleh menyusul).
- Kolaborasi multi-editor bersamaan (kunci baris/optimistic locking) —
  hanya ada 1 admin sekarang, ini bukan prioritas.
- Menyunting `[KONFIRMASI]` lewat editor ini — field itu tetap disunting
  manual di Markdown untuk sekarang, cukup ditampilkan (baca-saja) di
  penyunting supaya admin ingat itu ada.

### Verifikasi
- Tulis pengujian baru di `tests/` mengikuti pola `tests/api.test.mjs` —
  minimal: admin bisa baca & ubah SOP, engineer/tanpa-login ditolak,
  Markdown yang dihasilkan bisa diurai ulang oleh `build-kb.js` tanpa
  error, basis pengetahuan di memori benar-benar termuat ulang setelah
  simpan (skor pencocokan berubah cocok dengan SOP baru).
- `npm test` total harus tetap 100% lulus, termasuk 9 pengujian akurasi
  yang sudah ada di `tests/akurasi.test.mjs` — SOP Printer & Windows yang
  sudah lengkap 3-solusi-per-masalah **tidak boleh rusak** oleh perubahan
  ini.
- `npm run build` tanpa galat, cek ukuran bundel `sop-editor` (harus
  code-split terpisah, tidak membengkakkan bundel utama pelapor — cek
  laporan `npm run build` seperti pola `RekapPage-*.js` yang sudah
  terpisah).

---

## Urutan pengerjaan yang disarankan

1. Tugas 1 dulu (auto-start) — kecil, cepat selesai, menutup risiko
   "server mati saat restart, tidak ada yang tahu".
2. Tugas 2 (uji cetak + HP) — juga cepat, dan temuannya (bila ada) sebaiknya
   diperbaiki sebelum membangun fitur besar berikutnya di atas fondasi yang
   sama.
3. Tugas 3 (penyunting SOP) — paling besar, kerjakan terakhir dengan waktu
   cukup. Jangan terburu-buru di sini; salah rancang berarti SOP bisa rusak
   diam-diam.

Di setiap tugas: baca kode yang relevan dulu sebelum menulis, jalankan
`npm test` sebelum dan sesudah perubahan, dan jangan menambah dependensi
baru kecuali benar-benar tidak ada jalan lain — tanyakan dulu ke pengguna
bila merasa perlu.
