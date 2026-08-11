# SIGAP

**Layanan Bantuan ICT — Pertamina EP Asset 1 Regional 1 Field Lirik**

Pekerja menyampaikan kendala ICT, sistem memandu langkah perbaikan dari SOP,
dan bila belum tuntas laporan diteruskan ke engineer divisi terkait melalui
WhatsApp beserta data pelapor dan keluhannya.

> **Sistem ini tidak memakai AI.** Namanya dulu "SIGAP AI"; kata "AI" dibuang
> karena tidak lagi menggambarkan cara kerjanya. Jawaban disusun langsung dari
> dokumen SOP lewat pencocokan kata kunci, sehingga tidak mungkin mengarang,
> tidak memerlukan internet, tidak memerlukan API key, dan menjawab dalam
> 0,14 detik.
> Latar belakang perpindahannya ada di [KONTEKS-PROYEK.md](KONTEKS-PROYEK.md) §4.

---

## Menjalankan

### Prasyarat

- **Node.js 22.5 atau lebih baru** — wajib, karena penyimpanan data memakai
  modul bawaan `node:sqlite`. Diuji pada Node 24.
  Periksa versi Anda: `node -v`

### Langkah pertama kali

```bash
npm install
```

```bash
cp .env.example .env
```

Buka `.env`, lalu isi minimal dua hal:

| Variabel | Isi |
|---|---|
| `WHATSAPP_DEFAULT` | Nomor engineer cadangan, contoh `6281234567890` |
| `SESSION_SECRET` | Kunci acak untuk halaman rekap — lihat cara membuatnya di bawah |

Membuat kunci acak:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Bangun basis pengetahuan dari berkas SOP:

```bash
npm run build:kb
```

Bangun antarmuka:

```bash
npm run build
```

Jalankan:

```bash
npm start
```

Buka **http://localhost:3000**

### Akun admin pertama

Saat `npm start` dijalankan pertama kali, akun `admin` dibuat otomatis dengan
kata sandi acak yang **hanya ditampilkan sekali di konsol**:

```
┌─────────────────────────────────────────────────────────┐
│  AKUN ADMIN PERTAMA DIBUAT                              │
├─────────────────────────────────────────────────────────┤
│  Nama akun  : admin                                     │
│  Kata sandi : xxxxxxxxxxxx                              │
└─────────────────────────────────────────────────────────┘
```

**Catat saat itu juga.** Kata sandi tersebut tidak disimpan dalam bentuk yang
dapat dibaca kembali. Bila terlewat, ganti dengan perintah `npm run akun`.

### Jalan otomatis saat komputer menyala (Windows)

Server helpdesk yang hanya hidup selama ada yang membuka terminal bukan
layanan — ia mati diam-diam setiap kali komputer dinyalakan ulang, dan tidak
ada yang tahu sampai ada pekerja yang gagal melapor. Tiga berkas di
[skrip-windows/](skrip-windows/) menutup risiko itu.

| Berkas | Kegunaan |
|---|---|
| `jalankan-sigap.bat` | Menjalankan server. Bisa diklik ganda, bisa dipanggil Task Scheduler |
| `pasang-tugas-terjadwal.ps1` | Mendaftarkan server ke Task Scheduler **dan membuka porta 3000 di firewall** |
| `lepas-tugas-terjadwal.ps1` | Membongkar keduanya kembali |

> ⚠️ **Mendaftarkan tugas terjadwal mengubah pengaturan sistem operasi.**
> Skripnya berjalan sebagai Administrator, mendaftarkan layanan yang hidup
> tanpa ada yang login, dan membuka satu porta pada Windows Firewall. Bacalah
> isi skripnya lebih dulu — keduanya sengaja ditulis dengan komentar panjang
> supaya dapat dipahami sebelum dijalankan.

**Izin firewall bukan tambahan yang bisa dilewati.** Tanpa aturan itu Windows
menolak sambungan masuk ke Node, sehingga server hanya dapat dibuka dari
komputer itu sendiri — pelapor di meja lain dan engineer yang membuka `/tugas`
dari ponsel sama-sama tidak akan sampai, **tanpa pesan galat apa pun**, hanya
halaman yang tidak pernah termuat. Aturannya dibatasi profil **Private dan
Domain**; profil Public sengaja tidak disertakan supaya halaman pelaporan tidak
ikut terbuka bila laptop ini suatu saat tersambung ke WiFi umum.

Sebelum menyentuh Task Scheduler, pastikan servernya memang menyala:

```bash
skrip-windows\jalankan-sigap.bat
```

Buka http://localhost:3000. Bila halamannya muncul, tekan `Ctrl+C` dan lanjut.

Buka **PowerShell sebagai Administrator** (klik kanan → *Run as
administrator*), pindah ke folder proyek, lalu lihat dulu apa yang akan
dilakukan tanpa mengubah apa pun:

```powershell
powershell -ExecutionPolicy Bypass -File .\skrip-windows\pasang-tugas-terjadwal.ps1 -WhatIf
```

Bila sudah cocok, jalankan tanpa `-WhatIf`:

```powershell
powershell -ExecutionPolicy Bypass -File .\skrip-windows\pasang-tugas-terjadwal.ps1
```

Yang didaftarkan:

| Hal | Nilai |
|---|---|
| Nama tugas | `SIGAP-Server` |
| Pemicu | **Saat komputer menyala**, ditunda 1 menit — bukan saat pengguna login |
| Akun | `SYSTEM` — server tetap hidup meski tidak ada seorang pun yang login |
| Bila prosesnya mati | Dijalankan ulang 3 kali, jeda 1 menit |
| Batas waktu jalan | Tidak ada |
| Aturan firewall | `SIGAP - porta 3000 (HTTP masuk)`, profil Private + Domain |

Di akhir, skripnya menampilkan **alamat yang dapat dibuka dari ponsel** — mis.
`http://10.202.15.98:3000`. Catat alamat itu: `localhost` tidak berguna di
ponsel, karena di sana ia menunjuk ke ponsel itu sendiri.

Skripnya **idempotent**: dijalankan berkali-kali tidak membuat tugas maupun
aturan firewall ganda, karena yang lama dengan nama sama dihentikan dan dihapus
lebih dulu. Pencariannya memakai nama persis tanpa wildcard, jadi tugas
terjadwal dan aturan firewall lain milik Anda tidak tersentuh.

Ingin mengatur firewall sendiri? Tambahkan `-TanpaFirewall`. Ingin porta lain?
`-Porta 8080` — samakan dengan `PORT` di `.env`.

Memeriksa dan mengendalikannya:

```powershell
Get-ScheduledTaskInfo -TaskName SIGAP-Server   # kapan terakhir jalan, hasilnya apa
Start-ScheduledTask   -TaskName SIGAP-Server   # jalankan sekarang, tanpa restart komputer
Stop-ScheduledTask    -TaskName SIGAP-Server   # hentikan yang sedang berjalan
Disable-ScheduledTask -TaskName SIGAP-Server   # matikan pemicunya untuk sementara
```

Membongkar seluruhnya:

```powershell
powershell -ExecutionPolicy Bypass -File .\skrip-windows\lepas-tugas-terjadwal.ps1
```

> **Node.js harus terpasang "for all users".** Tugas terjadwal berjalan sebagai
> `SYSTEM`, yang hanya melihat PATH sistem — bukan PATH milik akun Anda. Node
> yang dipasang hanya untuk satu pengguna tidak akan ditemukan. Skrip
> pemasangnya memeriksa hal ini dan memperingatkan bila mencurigakan.

---

## Mode pengembangan

Perlu **dua terminal**:

```bash
npm run dev
```

```bash
npm run dev:frontend
```

Buka **http://localhost:5173** — bukan 3000.

Terminal pertama menjalankan server API di port 3000, terminal kedua
menjalankan antarmuka dengan hot-reload di port 5173. Permintaan ke `/api`
otomatis diteruskan ke port 3000, jadi tidak perlu pengaturan tambahan.

> **Setelah mengubah berkas SOP di `knowledge-base/` dengan editor teks, wajib
> jalankan `npm run build:kb`.** Tanpa itu perubahan Anda tidak akan terbaca
> sistem. Menyunting lewat halaman [`/sop-editor`](#penyunting-sop) tidak
> memerlukan langkah ini — pembangunan ulangnya dijalankan sendiri.

---

## Halaman laporan rekap

Berada di **`/rekap`** — misalnya http://localhost:3000/rekap

Memuat nama pegawai asli, sehingga wajib masuk lebih dulu. Isinya: ringkasan
periode, grafik laporan per hari/minggu/bulan, sebaran per layanan, area,
fungsi, dan urgensi, daftar keluhan yang belum dikenali sistem, serta tabel
rinci seluruh laporan.

| Peran | Wewenang |
|---|---|
| **admin** | Lihat semua, unduh Excel, cetak PDF, kelola akun, sunting SOP |
| **engineer** | Lihat semua laporan, tandai tiket selesai lewat [`/tugas`](#tugas-engineer) |

Rancangan datanya selengkapnya ada di [RANCANGAN-DATA.md](RANCANGAN-DATA.md).

### Mutu langkah SOP

Panel **"Seberapa sering tiap solusi menuntaskan"** membaca kolom
`solusi_terakhir` yang sudah tersimpan sejak awal tetapi tidak pernah dihitung.
Dibaca sebagai corong — yang sampai ke Solusi Ketiga pasti sudah mencoba yang
pertama dan kedua:

```
Solusi ke-1  ████░░░░░░░░░░░░░░░░  17%   12 dari 70
Solusi ke-2  ████████░░░░░░░░░░░░  38%   22 dari 58
Solusi ke-3  ████████░░░░░░░░░░░░  39%   14 dari 36
```

Solusi yang sering ditawarkan tetapi jarang menuntaskan adalah langkah yang
perlu ditulis ulang — dan tanpa angka ini ia dapat bertahan bertahun-tahun
tanpa ada yang mempertanyakannya. Di bawahnya, daftar masalah yang SOP-nya
paling sering gagal, disaring minimal tiga laporan supaya angkanya berarti.

### Membatalkan penandaan selesai

Admin dapat membatalkan tiket yang keliru ditandai selesai lewat tombol
*batalkan* di kolom Tindakan. Tiketnya kembali ke daftar tugas, dan catatan
serta waktu tanggapnya dikosongkan. Khusus admin — membiarkan engineer
membatalkan penandaan engineer lain membuka kembali celah yang ditutup oleh
pembatasan per layanan.

Yang **tidak** hilang adalah jejaknya: siapa menandai dan siapa membatalkan
tetap tersimpan pada jejak akses.

### Jejak akses

Panel terlipat di bagian bawah halaman rekap, khusus admin. Menampilkan 200
tindakan terakhir: siapa membuka rekap, mengunduh Excel, mencetak, menandai
selesai, dan menyunting SOP. Pencatatannya sudah berjalan sejak awal
(RANCANGAN-DATA.md §10), tetapi sebelumnya tidak ada satu pun halaman yang
menampilkannya.

---

## Cek status laporan (pelapor)

Berada di **`/tiket`**. **Tidak perlu masuk.**

Sebelumnya pelapor menerima nomor tiket lalu tidak pernah tahu apa-apa lagi —
tidak ada pemberitahuan saat engineer menandai selesai, dan tidak ada tempat
untuk memeriksanya sendiri. Untuk layanan pengaduan, itu keluhan yang paling
cepat muncul.

Nomor tiketnya kini disebutkan di akhir percakapan beserta alamat halaman ini,
dan dapat dibuka langsung lewat `/tiket?nomor=SGP-20260805-0007`.

> **Isinya sengaja tipis.** Nomor tiket berbentuk `SGP-YYYYMMDD-NNNN` sehingga
> mudah ditebak berurutan — siapa pun di jaringan kantor dapat mencoba `-0001`,
> `-0002`, dan seterusnya. Karena itu yang ditampilkan hanya **keadaan**
> laporan: layanan, tanggal, sudah ditangani atau belum. Nama pelapor, lokasi,
> fungsi, isi keluhan, dan catatan penanganan **tidak pernah ikut keluar**, dan
> hal itu dijaga pengujian. Rincian lengkap tetap hanya ada di `/rekap`.

## Tugas engineer

Berada di **`/tugas`** — misalnya http://localhost:3000/tugas. Untuk akun
engineer dan admin.

Halaman rekap sudah punya tombol "Tandai Selesai" sejak awal, dan selama
dipakai **tidak pernah sekali pun ditekan**. Yang menghambat bukan tombolnya,
melainkan jalan menuju ke sana: engineer harus membuka rekap di ponsel, masuk,
lalu mencari satu baris di dalam tabel enam belas kolom — sementara nomor
tiketnya tidak pernah ikut terkirim lewat WhatsApp.

Alurnya sekarang:

```
Pelapor tekan Hubungi Engineer
        │
        ▼
Pesan WhatsApp memuat  Nomor Tiket  +  tautan /tugas?tiket=SGP-…
        │
        ▼
Engineer buka tautan di ponsel  →  masuk sekali ("ingat saya" 30 hari)
        │
        ▼
Dialog terbuka pada tiket itu  →  kapan beres? + catatan  →  Selesai
        │
        ▼
ditangani_pada · ditangani_oleh · waktu_tanggap  →  rekap
```

Halaman `/tugas` sengaja dibuat sesempit mungkin: hanya tiket yang benar-benar
menunggu, terlama di atas, satu tombol besar per tiket. Tanpa saringan, tanpa
grafik, tanpa tabel — karena dibuka sambil berdiri di lapangan, kerap dengan
satu tangan. Tiket yang menganggur lebih dari 8 jam ditandai jingga, lebih dari
48 jam merah.

> **Tautannya tidak memerlukan pengaturan apa pun.** Alamatnya diambil dari
> peramban pelapor sendiri — ia sudah membuka aplikasi ini dari alamat yang
> benar, dan engineer berada di jaringan yang sama. Isi `ALAMAT_PUBLIK` di
> `.env` hanya bila alamatnya memang berbeda, misalnya di belakang reverse
> proxy dengan nama domain.
>
> Satu pengecualian: bila pelapor membuka aplikasi lewat `localhost` (duduk di
> komputer server itu sendiri), tautannya tidak disertakan — di ponsel engineer
> `localhost` menunjuk ke ponselnya sendiri, dan tautan yang pasti gagal lebih
> buruk daripada tidak ada tautan.

### Kapan kendalanya beres ≠ kapan tombolnya ditekan

Dialognya menanyakan **kapan kendalanya benar-benar beres**, bawaan "sekarang",
dengan pintasan *1 jam lalu* / *3 jam lalu* / *kemarin*. Alasannya: yang diukur
`waktu_tanggap` adalah lama penanganan, bukan lama keterlambatan mengisi
formulir. Engineer yang baru sempat menandai tiga hari kemudian akan tercatat
menanggapi dalam tiga hari — dan angka yang tidak dipercaya tidak akan dipakai
siapa pun. Waktu yang disebutkan ditolak bila berada di masa depan atau
mendahului saat laporan diteruskan.

### Dua kolom waktu yang berbeda artinya

| Kolom | Arti |
|---|---|
| **Jam Berakhir** (`berakhir_pada`) | Jam laporan **berpindah tangan** ke engineer |
| **Ditangani** (`ditangani_pada`) | Jam kendalanya **benar-benar beres** |

Keduanya sengaja dipisah dan `berakhir_pada` **tidak** ditimpa saat tiket
ditandai selesai — artinya per status sudah ditetapkan di
[RANCANGAN-DATA.md](RANCANGAN-DATA.md) §8, dan `rata_durasi` membacanya. Kolom
"Ditangani" muncul pada rincian laporan di halaman rekap, klik barisnya untuk
membukanya.

---

## Penyunting SOP

Berada di **`/sop-editor`** — misalnya http://localhost:3000/sop-editor.
**Khusus akun admin.**

Sebelumnya, mengubah satu langkah SOP menuntut: menyunting berkas sumber,
menjalankan `npm run build:kb`, lalu `npm run build`, lalu menyalakan ulang
server. Akibatnya SOP menjadi usang seiring waktu — dan SOP yang usang lebih
berbahaya daripada tidak ada SOP sama sekali, karena langkahnya keliru namun
disampaikan dengan percaya diri.

Lewat halaman ini, satu suntingan cukup ditekan sekali:

1. Pilih layanan, lalu klik masalah yang ingin diubah
2. Sunting gejala, penyebab, dan hingga tiga solusi (judul, pengantar, langkah)
3. Tekan **Pratinjau & simpan** — hasil urainya ditampilkan lebih dulu
4. Setelah disimpan, basis pengetahuan dibangun ulang dan dimuat ulang sendiri

> **Berkas Markdown tetap menjadi sumber kebenaran.** Penyunting ini menulis
> ulang berkas `knowledge-base/<divisi>.json` yang sama — tidak ada salinan
> data SOP di dalam basis data. Menyunting berkasnya langsung dengan editor teks
> tetap boleh, dan keduanya menghasilkan hal yang sama.

**Yang dijaga halaman ini:**

| Penjagaan | Alasan |
|---|---|
| Cadangan sebelum menimpa | Suntingan yang salah harus dapat dibatalkan. Tersimpan di `data/cadangan-sop/` dengan cap waktu |
| Pratinjau hasil urai | Yang menentukan SOP ini pernah ditemukan pengguna bukan bentuk formulirnya, melainkan kata kunci yang terkumpul dari hasil urainya |
| Tombol **Uji keluhan ini** | Mengetik contoh keluhan lalu melihat skornya, sebelum menyimpan. Mencegah SOP baru yang skornya tidak pernah menembus ambang 0,4 |
| Judul masalah baca-saja | Judul menentukan id masalah; id yang berubah memutus rujukan pada laporan rekap |
| Peringatan bila solusi kurang dari tiga | Antarmuka pelapor menjanjikan tiga solusi sebelum menyerah ke engineer |
| Batal otomatis bila gagal dibangun | Bila basis pengetahuan gagal dibangun ulang, berkas SOP dikembalikan seperti semula |

Penanda **`[KONFIRMASI]`** ditampilkan terpisah dengan warna jingga dan
**tidak dapat disunting** dari halaman ini. Isinya bukan langkah SOP melainkan
hal yang hanya engineer lapangan yang tahu — merek perangkat, nama jaringan,
prosedur internal. Jawabannya harus datang dari engineer, bukan dari tebakan;
untuk sekarang tetap disunting langsung pada berkas JSON sumbernya.

---

## Pemeliharaan otomatis

Berjalan sendiri selama server hidup — tidak perlu dijadwalkan dari luar.

| Pekerjaan | Jadwal | Keterangan |
|---|---|---|
| **Cadangan basis data** | saat menyala, lalu tiap 24 jam | `data/cadangan/sigap-YYYY-MM-DD.db` |
| **Cadangan berkas SOP** | tiap kali SOP disunting | `data/cadangan-sop/`, 20 salinan terakhir per berkas |
| **Salinan ke luar mesin** | menyusul tiap cadangan | Ke `CADANGAN_LUAR`, diverifikasi ukurannya |
| Buang cadangan lama | harian | Simpan 14 hari terakhir, di kedua tempat |
| **Retensi data** | harian | Nama pelapor dikosongkan setelah 2 tahun; barisnya tetap disimpan |
| Tandai sesi ditinggalkan | tiap 5 menit | Sesi diam lebih dari 30 menit |
| Buang log lama | harian | Simpan 30 hari terakhir |

Cadangan dibuat dengan `VACUUM INTO`, bukan menyalin berkasnya. Menyalin berkas
SQLite yang sedang dipakai menghasilkan **salinan rusak** — sebagian perubahan
masih berada di berkas WAL terpisah.

### Cadangan ke luar mesin — wajib untuk pemakaian nyata

Cadangan di `data/cadangan/` berada pada **disk yang sama** dengan basis
datanya. Itu melindungi dari salah hapus dan berkas rusak, tetapi **tidak
melindungi dari disk yang mati** — basis data dan seluruh cadangannya hilang
bersamaan.

Isi `CADANGAN_LUAR` di `.env` dengan folder di luar mesin ini:

```bash
CADANGAN_LUAR=\\server-file\backup\sigap
```

Boleh juga folder OneDrive atau flashdisk yang selalu tertancap. Bila tujuannya
sedang tidak terhubung, server **tetap berjalan** dan hanya mencatat peringatan;
peringatannya mengeras bila kegagalan berlanjut lebih dari 3 hari.

> ⚠️ **Partisi lain belum tentu disk lain.** `C:` dan `D:` pada satu komputer
> umumnya dua partisi pada SSD yang sama — menaruh cadangan di `C:\` sementara
> basis datanya di `D:\` tidak melindungi apa pun bila disk itu mati. Periksa
> lebih dulu:
>
> ```powershell
> Get-Partition | Where-Object DriveLetter | Select-Object DriveLetter, DiskNumber
> ```
>
> Bila `DiskNumber`-nya sama, keduanya satu disk fisik.

Mencadangkan sekarang juga — misalnya sebelum memperbarui SOP:

```bash
npm run cadangkan
```

**Memulihkan dari cadangan:** hentikan server, ganti berkas basis data dengan
cadangan yang dikehendaki, lalu jalankan `npm start`.

Berkas yang diganti adalah yang ditunjuk **`DB_PATH` di `.env`** — bukan selalu
`data/sigap.db`. Periksa dulu, karena mengganti berkas yang salah saat sedang
panik hanya menambah satu kebingungan lagi:

```bash
grep DB_PATH .env          # mis. DB_PATH=./data/helpdesk.db
```

Hapus juga berkas `-wal` dan `-shm` yang menyertainya (mis.
`helpdesk.db-wal`, `helpdesk.db-shm`). Keduanya memuat perubahan yang belum
menyatu ke berkas utama, dan meninggalkannya di samping berkas cadangan yang
baru membuat SQLite menolak membukanya.

> Folder `cadangan/`, `log/`, dan tujuan `CADANGAN_LUAR` memuat nama pegawai.
> Dua yang pertama sudah diabaikan `.gitignore`; yang ketiga berada di luar
> repositori, jadi perhatikan siapa saja yang dapat membuka folder tersebut.

Log aplikasi berada di `data/log/sigap-YYYY-MM-DD.log` — mencatat percobaan
masuk, pengunduhan rekap, pencadangan, dan galat server.

---

## Perintah yang tersedia

| Perintah | Kegunaan |
|---|---|
| `npm start` | Jalankan server produksi di port 3000 |
| `npm run build` | Bangun antarmuka ke folder `dist/` |
| `npm run build:kb` | Bangun basis pengetahuan dari berkas SOP |
| `npm run dev` | Server API saja, untuk pengembangan |
| `npm run dev:frontend` | Antarmuka dengan hot-reload di port 5173 |
| `npm test` | Jalankan seluruh pengujian |
| `npm run akun` | Kelola akun halaman rekap |
| `npm run cadangkan` | Cadangkan basis data sekarang juga |
| `npm run perbaiki-status` | Perbaiki status `diteruskan` lama yang tanpa data pelapor (sekali jalan) |
| `npm run bersihkan-sesi` | Buang baris sesi yang terbentuk tanpa jejak manusia (sekali jalan) |

Dua perintah terakhir **menulis ulang atau menghapus data**, dan karena itu
berjalan dalam mode melihat-saja lebih dulu. Keduanya baru benar-benar mengubah
sesuatu bila diberi `--terapkan`:

```bash
npm run bersihkan-sesi                 # lihat dulu apa yang akan dibuang
npm run cadangkan                      # cadangkan sebelum mengubah
npm run bersihkan-sesi -- --terapkan   # benar-benar menghapus
```

`bersihkan-sesi` hanya membuang baris yang **tidak punya jejak manusia sama
sekali**: tanpa keluhan, tanpa layanan terpilih, tanpa nama pelapor, tanpa
eskalasi, dan tanpa satu pun pesan dari pengguna. Baris seperti itu dulu
terbentuk setiap kali halaman dibuka, sehingga "Total laporan" pada rekap
menghitung kunjungan alih-alih laporan. Sumbernya sudah ditutup; perintah ini
untuk membereskan yang terlanjur tersimpan.

### Mengelola akun

```bash
npm run akun -- daftar
```

```bash
npm run akun -- buat eka "Eka Maulana" engineer katasandi123 printer,windows
```

```bash
npm run akun -- ganti admin katasandibaru123
```

```bash
npm run akun -- divisi eka printer,windows,cctv
```

Peran yang tersedia: `admin` dan `engineer`. Kata sandi minimal 8 karakter.

#### Wewenang per layanan

**Akun engineer wajib menyebutkan layanan yang ditanganinya sejak dibuat.**
Tanpa argumen terakhir itu, perintah `buat` menolak — dan itu disengaja.

Ada delapan layanan dengan engineer berbeda-beda (KONTEKS-PROYEK.md §8), dan
seorang engineer Printer tidak seharusnya dapat menutup tiket Radio Komunikasi.
Pembatasannya berlaku di **sisi server** pada kedua jalan menuju penandaan
selesai — halaman `/tugas` maupun `/rekap` — sehingga tidak dapat dilewati
dengan berpindah halaman atau mengirim nomor tiket secara langsung.

| Nilai kolom `divisi` | Artinya |
|---|---|
| `printer,windows` | Hanya kedua layanan itu |
| `semua` | Seluruh layanan — **penetapan yang disengaja** |
| kosong | **Belum diberi layanan apa pun** — tidak dapat menandai apa pun |

> Baris terakhir itu penting. Sebelumnya kolom kosong dibaca sebagai "tanpa
> batas", sehingga setiap akun engineer yang baru dibuat berwenang atas
> kedelapan layanan sampai ada yang **ingat** mengaturnya. Kelalaian itu tidak
> menghasilkan pesan galat apa pun — hanya wewenang berlebih yang diam.
> Sekarang kebalikannya: yang lupa diatur tidak bisa apa-apa, dan engineer
> yang bersangkutan melihat pesan yang menjelaskan sebabnya.

Admin tidak dibatasi per layanan — ia yang menutup tiket saat engineer
berhalangan. `npm run akun -- daftar` menampilkan kolom **LAYANAN**, dan akun
yang belum diatur ditandai `⚠ belum diberi`.

### Pengujian

```bash
npm test
```

Menjalankan 295 pemeriksaan di atas basis data sementara — data nyata tidak
tersentuh. Mencakup lapisan penyimpanan, akurasi pencocokan keluhan,
autentikasi, wewenang peran, penyaringan rekap, ekspor Excel, kelengkapan data
SOP, penyunting SOP, daftar tugas engineer, dan kedua alur percakapan.

Berkas SOP juga disalin ke folder sementara lebih dulu: pengujian penyunting
SOP benar-benar menulis ke berkas sumber, dan `npm test` tidak boleh
menyentuh dokumen SOP sungguhan.

Pengujian memakai porta 3999. Bila porta itu sedang dipakai, jalankan pada porta
lain:

```bash
UJI_PORT=4100 npm test
```

---

## Cara kerja

```
knowledge-base/<divisi>.json              (sumber, ditulis manusia)
        │
        │  npm run build:kb
        ▼
server/data/knowledge-base.json           (44 masalah, 56 solusi)
        │
        ▼
Keluhan pengguna ──> teksUtil.js ──> answerService.js ──> jawaban
                     (seragamkan)      (cocokkan)         (dari data SOP)
```

Pencocokan murni kata kunci: keluhan diseragamkan (`lemot`→`lambat`,
`gabisa`→`tidak bisa`), kata umum dibuang, lalu tiap masalah diberi skor dengan
kata pada judul bernilai 3×, gejala 2×, penyebab 1×, dan tiap kata dibobot
menurut kekhasannya dalam divisi tersebut.

### Dua mode layanan

| Mode | Divisi | Perilaku |
|---|---|---|
| `swalayan` | Printer, Windows | Dipandu tiga solusi dulu; formulir muncul bila belum tuntas |
| `engineer` | CCTV, Telepon, Radio, FTTH, LAN, WAN | Langsung ke formulir pelapor |

Pembagian ini berasal dari masukan Engineer ICT: kendala yang cukup umum untuk
dipandu sendiri hanya ada pada komputer dan printer. Selebihnya memerlukan
pemeriksaan langsung, dan SOP-nya tidak boleh disusun dari sumber umum karena
sangat spesifik lapangan.

---

## Konfigurasi (.env)

Seluruh variabel didokumentasikan di [`.env.example`](.env.example).

| Variabel | Keterangan |
|---|---|
| `WHATSAPP_DEFAULT` | Nomor engineer cadangan — **wajib** |
| `WHATSAPP_PRINTER`, `WHATSAPP_CCTV`, … | Nomor engineer per divisi; yang kosong memakai `WHATSAPP_DEFAULT` |
| `SESSION_SECRET` | Kunci penanda tangan sesi halaman rekap — **wajib** di lingkungan nyata |
| `ALAMAT_PUBLIK` | Opsional. Hanya perlu bila alamat yang dipakai engineer berbeda dari yang dipakai pelapor (mis. di belakang reverse proxy) |
| `COOKIE_SECURE` | Isi `1` bila disajikan lewat HTTPS |
| `DB_PATH` | Letak berkas SQLite, bawaan `./data/sigap.db` |
| `PORT` | Porta server, bawaan `3000` |
| `MENIT_SESI_TERBENGKALAI` | Batas diam sebelum sesi dianggap ditinggalkan, bawaan `30` |

Format nomor WhatsApp: kode negara tanpa tanda `+`. Nomor `081234567890`
ditulis `6281234567890`. Tanda hubung dan spasi otomatis dibersihkan server.

> **Jangan pernah meng-commit `.env` maupun berkas `.db`.** Keduanya berisi
> nomor engineer dan nama pegawai asli, dan sudah diabaikan `.gitignore`.

---

## Struktur

```
server/
  config/divisi.js         Daftar divisi, mode layanan, turunan area
  config/jalur.js          Letak berkas SOP & hasil bangunnya
  routes/                  chat, knowledgebase, auth, rekap, sop, tugas
  services/
    answerService.js       Pencocokan keluhan + penyusun jawaban
    teksUtil.js            Penyeragam bahasa: sinonim, kata umum, akhiran
    sopJson.js             Pembaca & penulis berkas SOP JSON (dipakai bersama)
    sopBerkas.js           Baca/tulis berkas SOP, cadangan, bangun & muat ulang
    rekapService.js        Kueri penyaringan & peringkasan laporan
    authService.js         scrypt, token sesi, peran, jejak akses
    xlsxUtil.js            Penulis berkas .xlsx tanpa dependensi
  database/init.js         Skema & operasi SQLite
  data/                    Hasil bangun basis pengetahuan (jangan disunting manual)

src/
  components/              Antarmuka pelapor + layar masuk bersama
  rekap/                   Halaman laporan rekap
  sop-editor/              Halaman penyunting SOP
  tugas/                   Halaman tugas engineer
  data/                    Pilihan fungsi, lokasi, urgensi

knowledge-base/<divisi>.json  Dokumen SOP — sumber kebenaran, disunting manusia
scripts/                   build-kb.js, akun.js, cadangkan.js
skrip-windows/             Jalankan server & daftarkan ke Task Scheduler
tests/                     Pengujian otomatis
```

`sopJson.js` sengaja dipakai bersama oleh `scripts/build-kb.js` dan penyunting
SOP. Dua pengurai untuk satu format berarti dua tafsiran yang dapat bergeser
sendiri-sendiri — SOP yang tampak benar di penyunting akan terurai berbeda saat
dibangun, dan tidak ada yang menyadarinya sampai pengguna menerima langkah yang
keliru.

---

## Dokumen lain

| Berkas | Isi |
|---|---|
| [KONTEKS-PROYEK.md](KONTEKS-PROYEK.md) | Serah-terima: keputusan penting, jebakan yang sudah ditemukan |
| [RANCANGAN-DATA.md](RANCANGAN-DATA.md) | Rancangan data & laporan rekap |
| [server/data/sop.schema.json](server/data/sop.schema.json) | Kontrak berkas SOP sumber — setiap medan dijelaskan |
| [server/data/knowledge-base.schema.json](server/data/knowledge-base.schema.json) | Kontrak hasil bangunnya |

**Bacalah `KONTEKS-PROYEK.md` sebelum mengubah apa pun** — beberapa hal di sana
tampak seperti kesalahan padahal sengaja dibuat begitu.

---

Pengembang: Rifqi Permana Putra · Teknik Informatika, Universitas Islam Riau
Untuk penggunaan internal Pertamina EP Field Lirik.
