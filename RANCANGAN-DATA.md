# Rancangan Data & Laporan Rekap — SIGAP

> Dokumen rancangan, **belum diimplementasikan**. Disusun untuk disetujui
> pembimbing lapangan sebelum pengodean dimulai.
>
> Bacalah `KONTEKS-PROYEK.md` lebih dulu untuk memahami sistemnya secara umum.
> Berkas ini hanya membahas **penyimpanan data dan laporan rekap**.

---

## 1. Latar Belakang

Pembimbing lapangan meminta dua hal:

1. Seluruh data pelapor ikut terkirim ke engineer saat kendala diteruskan
2. Laporan rekap yang dapat disaring **per hari, per minggu, per bulan**

Selain itu, masukan dari engineer (Eka Maulana) mempersempit cakupan layanan
swalayan: hanya **Printer** dan **Windows** yang kendalanya cukup umum untuk
dipandu sendiri. Enam divisi lain langsung diteruskan ke engineer.

Kedua hal ini mengubah kebutuhan penyimpanan data secara mendasar, karena
sistem sekarang belum menyimpan riwayat laporan dengan cara yang bisa disaring
per periode.

---

## 2. Prinsip Rancangan

| Prinsip | Alasan |
|---|---|
| Formulir identitas tetap **di akhir** | Sebagian besar kendala selesai di percakapan; meminta data di awal membebani semua pengguna demi sebagian kecil |
| Setiap sesi dicatat, **identitas hanya saat eskalasi** | Rekap tetap lengkap tanpa memaksa semua orang mengisi formulir |
| Simpan keluhan **mentah apa adanya** | Sumber utama perbaikan basis pengetahuan |
| Yang tidak terukur **jangan diklaim terukur** | Sistem tidak tahu apa yang terjadi setelah percakapan berpindah ke WhatsApp |
| Kumpulkan **seperlunya** | Rekap memuat nama pegawai asli — setiap kolom tambahan menambah beban privasi |

---

## 3. Tiga Lapis Data

```
Pengguna masuk, pilih divisi, ketik keluhan
        │
        ├── LAPIS 1 : Sesi          ← selalu tercatat, tanpa identitas
        ├── LAPIS 2 : Penelusuran   ← selalu tercatat, bahan evaluasi
        │
        └── (bila kendala belum tuntas)
                │
                └── LAPIS 3 : Eskalasi  ← identitas pelapor, hanya di sini
                        │
                        └── LAPIS 4 : Penanganan  ← diisi engineer (opsional)
```

Pemisahan inilah yang membuat formulir dapat tetap berada di akhir alur tanpa
kehilangan data rekap. Lapis 1 dan 2 berjalan otomatis di latar belakang.

---

## 4. Lapis 1 — Sesi

Satu baris untuk **setiap** laporan yang masuk, termasuk yang selesai mandiri.

| Kolom | Tipe | Sumber | Keterangan |
|---|---|---|---|
| `nomor_tiket` | teks | otomatis | Format `SGP-YYYYMMDD-NNNN` |
| `dibuat_pada` | timestamp | otomatis | Disimpan UTC, ditampilkan WIB |
| `berakhir_pada` | timestamp | otomatis | Maknanya berbeda per status — lihat §8 |
| `durasi_detik` | angka | turunan | Selisih kedua kolom di atas |
| `divisi_id` | enum | pilihan pengguna | 8 divisi layanan ICT |
| `mode_divisi` | enum | otomatis | `swalayan` \| `engineer` |
| `keluhan` | teks panjang | ketikan pengguna | Disimpan mentah, tanpa diubah |
| `status` | enum | otomatis | `selesai` \| `diteruskan` \| `ditinggalkan` |

**Nomor tiket** memakai tanggal + urutan harian (`SGP-20260731-0042`) agar
terbaca manusia dan mudah disebut lisan lewat WhatsApp. UUID acak tidak
memenuhi keduanya.

**Kolom `keluhan`** wajib disimpan apa adanya. Dari sinilah diketahui kata apa
yang belum dikenali `teksUtil.js`, dan SOP mana yang perlu ditambah kata
kuncinya.

---

## 5. Lapis 2 — Penelusuran

Merekam bagaimana sistem menanggapi keluhan. Tidak diminta pembimbing, tetapi
inilah yang membuat sistem dapat diperbaiki berdasarkan data nyata.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `masalah_cocok` | teks | Judul masalah yang dipilih sistem |
| `skor_cocok` | 0–1 | Skor pencocokan dari `answerService.js` |
| `solusi_terakhir` | 1 \| 2 \| 3 | Solusi ke berapa yang menuntaskan, atau sampai mana sebelum menyerah |

Kegunaan utama `skor_cocok`: setelah sebulan dipakai, seluruh keluhan berskor
**0,2–0,4** dapat ditarik — itulah daftar kendala yang *nyaris* dikenali, dan
paling murah diperbaiki. Ambang keputusan tetap seperti tercantum di
`KONTEKS-PROYEK.md` §5.

---

## 6. Lapis 3 — Eskalasi

Hanya terisi untuk laporan berstatus `diteruskan`.

| Kolom | Tipe | Sumber | Keterangan |
|---|---|---|---|
| `nama` | teks | formulir | Nama lengkap pelapor |
| `fungsi` | enum 7 | formulir | `src/data/fungsi.js` |
| `lokasi` | enum 29 | formulir | `src/data/lokasi.js` |
| `area` | enum 3 | **turunan** | Buatan \| Ukui \| Lirik |
| `urgensi` | enum 4 | formulir | `src/data/urgensi.js` |
| `engineer_tujuan` | teks | otomatis | Engineer penerima laporan |
| `diteruskan_pada` | timestamp | otomatis | Saat tombol WhatsApp ditekan |

`area` diturunkan otomatis dari `lokasi` melalui `LOKASI_GROUPS` — tidak perlu
ditanyakan kembali kepada pengguna. Diperlukan karena 29 lokasi terlalu halus
untuk ditampilkan sebagai grafik.

`engineer_tujuan` memungkinkan laporan menampilkan sebaran beban kerja antar
kelima engineer.

---

## 7. Lapis 4 — Penanganan Engineer *(opsional)*

Diisi engineer melalui tombol **"Tandai Selesai"** di halaman rekap.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `ditangani_pada` | timestamp | Saat engineer menandai tiket tuntas |
| `ditangani_oleh` | teks | Akun engineer yang menandai |
| `waktu_tanggap` | angka | Selisih dari `diteruskan_pada` |
| `catatan` | teks | Tindakan yang dilakukan (bebas, boleh kosong) |

**Wajib bersifat opsional.** Bila engineer lupa menandai, tiket tetap tercatat
`diteruskan` dan seluruh rekap tetap benar — hanya `waktu_tanggap` yang kosong.
Sistem tidak boleh bergantung pada kedisiplinan pengisian.

`waktu_tanggap` adalah satu-satunya ukuran kecepatan penanganan yang sebenarnya,
dan biasanya yang paling dicari dalam laporan helpdesk.

---

## 8. Nilai `status` dan Batasannya

| Status | Arti | Cara diketahui |
|---|---|---|
| `selesai` | Pengguna menekan "sudah berhasil" | Dilaporkan sendiri oleh pengguna |
| `diteruskan` | Formulir diisi, tombol WhatsApp ditekan | Terekam sistem |
| `ditinggalkan` | Tidak ada aktivitas selama 30 menit | Ditetapkan otomatis |

### Dua batasan yang harus dipahami pembaca laporan

**a. Sistem tidak mengetahui hasil akhir penanganan engineer.**
`wa.me` hanya membuka aplikasi WhatsApp; percakapan setelahnya berada di luar
jangkauan sistem. Status `diteruskan` berarti *diteruskan*, **bukan** *selesai
ditangani*. Angka penyelesaian hanya tersedia bila Lapis 4 diisi.

**b. Status `ditinggalkan` bersifat ambigu.**
Pengguna yang menutup peramban bisa jadi masalahnya sudah beres, bisa jadi
menyerah. Keduanya tidak dapat dibedakan.

### Penamaan kolom waktu

Kolom `berakhir_pada` diberi judul **"Jam Berakhir"**, bukan "Jam Selesai",
karena artinya berbeda menurut status:

| Status | "Jam Berakhir" adalah |
|---|---|
| `selesai` | Jam pengguna menyatakan berhasil |
| `diteruskan` | Jam laporan **berpindah tangan** ke engineer |
| `ditinggalkan` | Jam aktivitas terakhir |

Judul "Jam Selesai" akan terbaca sebagai *masalah beres pada jam tersebut*,
padahal untuk status `diteruskan` masalahnya justru baru dimulai.

---

## 9. Isi Laporan

### a. Excel — data rinci

Satu baris per laporan. Laporan yang selesai mandiri **tetap ikut**, dengan
kolom identitas kosong — justru baris inilah yang menunjukkan sistem bekerja.

| # | Kolom | # | Kolom |
|---|---|---|---|
| 1 | Nomor Tiket | 9 | Nama Pelapor |
| 2 | Tanggal | 10 | Fungsi |
| 3 | Jam Mulai | 11 | Lokasi |
| 4 | Jam Berakhir | 12 | Area |
| 5 | Durasi | 13 | Urgensi |
| 6 | Divisi | 14 | Engineer |
| 7 | Keluhan | 15 | Waktu Tanggap |
| 8 | Masalah Terdeteksi | 16 | Status |

Format berkas `.xlsx` asli (`exceljs`), **bukan CSV** — Excel versi Indonesia
kerap memakai titik-koma sebagai pemisah, dan tanpa BOM UTF-8 huruf beraksen
menjadi rusak.

### b. PDF — ringkasan periode

| Bagian | Isi |
|---|---|
| Total laporan | Volume periode terpilih |
| **Persentase selesai mandiri** | Ukuran keberhasilan utama sistem |
| Jumlah diteruskan | Beban engineer |
| Grafik per hari / minggu / bulan | Permintaan pembimbing |
| Sebaran per divisi | Layanan paling bermasalah |
| Sebaran per area & fungsi | Lokasi yang perlu perhatian |
| Sebaran urgensi | Proporsi kegentingan |
| Rata-rata durasi & waktu tanggap | Kecepatan layanan |
| Daftar keluhan tak dikenali | Bahan perbaikan SOP berikutnya |

Catatan kaki PDF memuat jam cetak, nama pencetak, dan keterangan
*"Dokumen internal — memuat data pegawai"*.

### c. Halaman web — antarmuka utama

Penyaringan dan grafik ditampilkan langsung di layar. Unduhan Excel/PDF hanya
diperlukan bila berkasnya memang dibutuhkan; untuk pemeriksaan rutin, pembimbing
tidak perlu membuka berkas sama sekali.

**Format Word tidak disediakan** — tidak dapat diolah seperti Excel, dan tidak
sebaik PDF untuk dicetak maupun diarsipkan.

---

## 10. Akses & Privasi

Rekap memuat nama pegawai asli, sehingga autentikasi menjadi **prasyarat**,
bukan pelengkap. Saat ini sistem belum memiliki autentikasi sama sekali.

| Peran | Jumlah | Wewenang |
|---|---|---|
| **Admin** | 1 | Lihat semua, unduh Excel/PDF, kelola akun |
| **Engineer** | 5 | Lihat semua laporan, tandai tiket selesai |

Tidak ada halaman pendaftaran — akun dibuat lewat skrip. Untuk enam pengguna
tetap, membuka pintu pendaftaran hanya menambah risiko tanpa manfaat.

Teknis: tabel `users` di SQLite, kata sandi di-hash `bcrypt`, sesi melalui
`express-session` dengan cookie `httpOnly`.

**Log akses.** Dicatat siapa membuka dan mengunduh rekap beserta waktunya.
Karena isinya data pegawai, bila suatu saat muncul pertanyaan siapa yang
menyebarkan daftar tersebut, jawabannya tersedia.

**Berkas basis data menjadi sensitif.** Tambahkan `*.db` ke `.gitignore`,
sebagaimana `.env`.

**Berkas unduhan keluar dari kendali sistem.** Setelah tersimpan di laptop atau
terkirim di grup WhatsApp, tidak dapat ditarik kembali. Catatan kaki pada PDF
dimaksudkan untuk menaikkan kehati-hatian, bukan sebagai pengaman.

---

## 11. Retensi Data

| Umur data | Perlakuan |
|---|---|
| 0–2 tahun | Lengkap, termasuk nama pelapor |
| Lebih dari 2 tahun | **Kolom nama dikosongkan**, baris tetap disimpan |

Yang dibuang hanya kolom yang sensitif, bukan barisnya. Setelah dua tahun, nama
seseorang yang pernah melaporkan printer macet tidak bernilai bagi siapa pun,
sementara fungsi, lokasi, divisi, urgensi, dan durasinya masih berguna untuk
membandingkan tren antar tahun.

Dipilih dua tahun karena mencakup masa penelitian, cukup untuk satu perbandingan
tahun-ke-tahun yang utuh, dan cukup singkat untuk dipertanggungjawabkan.

Kapasitas bukan pertimbangan — pada perkiraan 30–50 laporan per bulan, SQLite
tidak akan terbebani meski disimpan bertahun-tahun.

> **Perlu dikonfirmasi:** Pertamina kemungkinan memiliki kebijakan retensi data
> internal. Bila ada, kebijakan tersebut menggantikan ketentuan di atas.

---

## 12. Yang Sengaja Tidak Dikumpulkan

Nomor telepon pelapor, alamat IP, jenis perangkat, dan nomor aset.

Tidak ada bagian laporan yang memerlukannya, sementara semuanya menambah beban
privasi pada basis data yang sudah memuat nama pegawai. Menambah kolom di
kemudian hari jauh lebih mudah daripada menjelaskan mengapa data pribadi
terlanjur dikumpulkan tanpa keperluan.

---

## 13. Perubahan Teknis yang Diperlukan

### a. Pindah dari JSON ke SQLite

Penyimpanan sekarang tidak sanggup menopang rekap. Pada
`server/database/init.js`, fungsi `saveDatabase()` menulis ulang **seluruh isi
berkas** setiap satu pesan masuk. Akibatnya:

- Pada laporan ke-1000, satu pesan berarti menulis ulang ribuan rekaman
- Dua pengguna bersamaan → yang satu menimpa yang lain, data hilang diam-diam
- Server mati saat menulis → berkas rusak, dan seluruh data **dibuang** saat
  dimuat ulang
- Penyaringan tanggal berarti memuat semua rekaman ke memori

SQLite (`better-sqlite3`) tetap berupa satu berkas tanpa server terpisah, namun
tahan tulis bersamaan dan mampu menyaring per periode dalam satu kueri.

Sekalian dibersihkan: skema sekarang masih membawa `knowledgeChunks` dan
`embedding`, sisa arsitektur RAG yang sudah tidak dipakai.

### b. Zona waktu

Timestamp disimpan **UTC**, tetapi pengelompokan tanggal wajib memakai **WIB**.
Bila dikelompokkan langsung menurut UTC, laporan yang masuk pukul 06.00 WIB akan
terhitung sebagai hari sebelumnya — salah hitung yang tidak terlihat sampai ada
yang mempertanyakan.

### c. Aturan sesi ditinggalkan

Sesi tanpa aktivitas selama 30 menit ditandai `ditinggalkan` secara otomatis.
Tanpa aturan ini, statusnya akan bertahan `active` selamanya dan merusak seluruh
perhitungan.

---

## 14. Keputusan yang Masih Menunggu

| # | Pertanyaan | Untuk siapa |
|---|---|---|
| 1 | FTTP masuk kelompok swalayan atau engineer? Eka menyebut "jaringan" tanpa merinci | Engineer (Eka) |
| 2 | Engineer melihat **semua** divisi, atau hanya divisinya sendiri? | Pembimbing |
| 3 | Adakah kebijakan retensi data internal Pertamina? | Pembimbing / ICT |
| 4 | Dari laporan CCTV/jaringan/telepon/HT yang masuk selama ini, adakah yang ternyata sepele — kabel lepas, baterai habis? | Engineer (Eka) |

Pertanyaan nomor 4 bukan soal data, melainkan penentu apakah keenam divisi
mode engineer perlu diberi "pemeriksaan cepat sebelum lapor". Jawabannya jauh
lebih berharga daripada sumber mana pun di internet, karena berasal dari keluhan
nyata Field Lirik.

---

## 15. Urutan Pengerjaan

| Tahap | Pekerjaan | Keadaan |
|---|---|---|
| 1 | Pindah ke SQLite, bersihkan sisa skema RAG | **Selesai** |
| 2 | Pencatatan sesi (Lapis 1 & 2) | **Selesai** |
| 3 | Mode divisi (`swalayan` / `engineer`) | **Selesai** |
| 4 | Autentikasi & akun | **Selesai** |
| 5 | Halaman rekap: saring + grafik | **Selesai** |
| 6 | Tombol "Tandai Selesai" (Lapis 4) | **Selesai** |
| 7 | Unduh Excel & PDF | **Selesai** |

Seluruhnya dikerjakan **tanpa menambah satu dependensi pun** — SQLite memakai
`node:sqlite` bawaan, kata sandi memakai scrypt dari `node:crypto`, berkas
`.xlsx` disusun sendiri di atas `node:zlib`, dan PDF dihasilkan lewat pencetakan
peramban dengan CSS `@media print`. Dependensi runtime tetap empat seperti
sebelumnya.

### Berkas yang terlibat

| Berkas | Peran |
|---|---|
| `server/database/init.js` | Skema & operasi dasar SQLite |
| `server/config/divisi.js` | Daftar divisi, mode layanan, turunan area |
| `server/services/rekapService.js` | Kueri penyaringan, ringkasan, sebaran |
| `server/services/authService.js` | scrypt, token sesi, peran, jejak akses |
| `server/services/xlsxUtil.js` | Penulis `.xlsx` tanpa dependensi |
| `server/routes/rekap.js` · `auth.js` | Rute rekap dan autentikasi |
| `src/rekap/RekapPage.jsx` · `Grafik.jsx` · `rekap.css` | Halaman rekap |
| `scripts/akun.js` | Pengelola akun baris perintah |

### Cara membuka

```bash
npm run build
npm start
```

Halaman rekap berada di `/rekap`. Saat pertama dijalankan, akun `admin` dibuat
otomatis dengan kata sandi acak yang **hanya ditampilkan sekali** di konsol.
Akun engineer ditambahkan lewat `npm run akun -- buat …`.

Tahap 1 dan 3 tidak bergantung pada keputusan yang masih menunggu di §14,
sehingga dapat dikerjakan lebih dulu.
