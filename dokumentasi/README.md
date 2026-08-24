# Dokumentasi Visual SIGAP

Tangkapan layar seluruh halaman aplikasi, untuk keperluan presentasi, lampiran
dokumen serah terima, dan panduan pemakaian.

## Cara tangkapan layar ini dibuat

**Data yang tampil bukan data asli.** Seluruh gambar diambil dari basis data
contoh berisi 169 laporan buatan yang menyerupai keadaan sebenarnya — akhir
pekan lebih sepi, layanan swalayan lebih ramai, sebagian tiket sudah ditandai
selesai dan sebagian belum.

Nama, lokasi, dan keluhan di dalamnya **karangan**, bukan pegawai sungguhan.
Ini disengaja: gambar dokumentasi kerap ikut tersebar ke luar Fungsi ICT, dan
laporan nyata memuat nama pegawai beserta isi keluhannya.

Diambil dengan Chrome headless yang dikendalikan lewat Chrome DevTools
Protocol, seluruhnya pada ketajaman 2× (retina) agar tetap tajam bila dicetak.

Halaman yang berisi daftar panjang **dipotong sebatas bagian atasnya**, bukan
diambil utuh. Halaman tugas di ponsel, misalnya, setinggi 20.036 px — bila
diambil utuh gambarnya berasio 1:51, benar secara teknis tetapi mustahil dibaca
sebagai lampiran dokumen. Yang berguna bagi pembaca adalah kepala halaman
beserta beberapa isinya.

## Daftar berkas

Lima puluh gambar, mencakup kelima halaman beserta keadaan-keadaan di
dalamnya — bukan hanya tampilan awal tiap halaman.

### Halaman pelapor — tanpa perlu masuk

| Berkas | Isi |
|---|---|
| `01-beranda-lengkap` | Beranda utuh dari atas sampai bawah |
| `02-beranda-layar-pertama` | Tampilan pertama yang dilihat pekerja |
| `03-modal-pilih-layanan` | Pemilihan layanan, termasuk kartu "Saya tidak yakin" |
| `04-percakapan-saran-awal` | Saran keluhan yang sering dilaporkan |
| `05-percakapan-solusi-pertama` | Panduan langkah pertama beserta tombol Sudah/Belum berhasil |
| `06-percakapan-solusi-kedua` | Langkah kedua setelah pekerja menjawab "belum berhasil" |
| `07-formulir-data-pelapor` | Formulir yang muncul di AKHIR alur, bukan di awal |
| `08-layanan-mode-engineer` | Layanan yang langsung diteruskan tanpa panduan mandiri |
| `09-layanan-otomatis-terdeteksi` | Sistem menentukan layanan sendiri dari isi keluhan |
| `20-percakapan-selesai-mandiri` | Pekerja menekan "Sudah berhasil" — kendala tuntas tanpa engineer |
| `21-formulir-terisi` | Formulir setelah diisi lengkap, urgensi terpilih |
| `22-nomor-tiket-terbit` | Nomor tiket diterbitkan; identitas pelapor tampil di kepala percakapan |

Tautan WhatsApp tidak muncul sebagai gambar karena eskalasinya berupa
`window.open` ke `wa.me` di tab baru, bukan tautan di dalam halaman.

### Penentuan layanan otomatis

Tiga kemungkinan jawaban sistem ketika pekerja memilih "Saya tidak yakin":

| Berkas | Isi |
|---|---|
| `09-layanan-otomatis-terdeteksi` | **Pasti** — satu layanan menang telak, langsung dipakai |
| `23-layanan-otomatis-ragu` | **Ragu** — beberapa layanan berdekatan skornya, pekerja diminta memilih |
| `24-layanan-otomatis-tidak-dikenali` | **Tidak dikenali** — keluhan di luar lingkup ICT |

### Cek status laporan

| Berkas | Isi |
|---|---|
| `10-cek-tiket-kosong` | Halaman pemeriksaan sebelum nomor diisi |
| `25-tiket-ditemukan-diteruskan` | Tiket yang sudah sampai ke engineer |
| `26-tiket-ditemukan-selesai` | Tiket yang sudah ditandai selesai |
| `27-tiket-tidak-ditemukan` | Nomor yang tidak ada |

### Masuk

| Berkas | Isi |
|---|---|
| `11-halaman-masuk` | Layar masuk untuk admin dan engineer |
| `28-masuk-sandi-salah` | Pesan galat saat sandi keliru |
| `29-masuk-ganti-sandi` | Ganti kata sandi tanpa perlu menghubungi admin |

### Laporan rekap — admin dan engineer

| Berkas | Isi |
|---|---|
| `12-rekap-lengkap` | Halaman rekap utuh |
| `13-rekap-layar-pertama` | Angka ringkasan dan saringan periode |
| `30-rekap-saringan-lain` | Saringan layanan, status, area, dan urgensi |
| `31-rekap-grafik-harian` | Laporan masuk per hari/minggu/bulan |
| `32-rekap-sebaran-layanan` | Sebaran per layanan dan tingkat urgensi |
| `33-rekap-sebaran-area-fungsi` | Sebaran per area dan per fungsi |
| `34-rekap-keefektifan-solusi` | Seberapa sering tiap solusi benar-benar menuntaskan |
| `35-rekap-keluhan-belum-dikenali` | Keluhan yang belum dikenali — bahan penambahan SOP |
| `36-rekap-daftar-laporan` | Tabel seluruh laporan |
| `37-rekap-jejak-audit` | Siapa membuka dan mengubah apa |
| `38-rekap-rincian-satu-laporan` | Rincian satu laporan saat barisnya dibuka |

### Tugas engineer

| Berkas | Isi |
|---|---|
| `14-tugas-engineer` | Daftar tiket yang menunggu ditangani |
| `39-tugas-disaring-per-layanan` | Daftar disaring pada satu layanan |
| `40-tugas-dialog-ambil-alih` | Peringatan saat mengambil tiket yang dipegang engineer lain |
| `41-tugas-dialog-tandai-selesai` | Penandaan selesai beserta waktu dan catatan tindakan |

### Penyunting SOP — khusus admin

| Berkas | Isi |
|---|---|
| `15-penyunting-sop` | Daftar masalah yang dapat disunting |
| `42-sop-form-sunting` | Satu masalah dibuka: gejala, penyebab, dan solusinya |
| `43-sop-pratinjau-sebelum-simpan` | Pratinjau bagaimana SOP akan terbaca sistem |
| `44-sop-uji-keluhan` | Menguji satu keluhan tanpa perlu menyimpan dulu |
| `45-sop-menunggu-konfirmasi-engineer` | SOP yang masih menunggu pengesahan engineer |

### Tampilan ponsel 390×844

| Berkas | Isi |
|---|---|
| `16-ponsel-beranda` | Beranda |
| `17-ponsel-percakapan` | Percakapan pelaporan |
| `18-ponsel-tugas-engineer` | Halaman tugas — dibuka engineer sambil di lapangan |
| `19-ponsel-rekap` | Laporan rekap pada layar sempit |
| `46-ponsel-menu-navigasi` | Menu navigasi saat dibuka |
| `47-ponsel-pilih-layanan` | Pemilihan layanan |
| `48-ponsel-cek-tiket` | Cek status laporan |
| `49-ponsel-halaman-masuk` | Layar masuk |
| `50-ponsel-penyunting-sop` | Penyunting SOP |

## Membuat ulang

Tangkapan layar akan menua seiring tampilan berubah. Skrip pembuatnya ada di
riwayat pengembangan; yang perlu diketahui untuk membuatnya kembali:

1. Siapkan basis data contoh terpisah dengan `tests/benih.mjs` — **jangan**
   memakai basis data nyata
2. Jalankan server pada porta tersendiri yang menunjuk ke basis data itu
3. Ambil gambar dengan Chrome headless pada ketajaman 2×. Untuk halaman
   berdaftar panjang, batasi tinggi tangkapan lewat `clip` — sekitar 3.000 px
   untuk layar lebar dan 2.000 px untuk ponsel sudah memadai

Tiga hal yang mudah menjebak saat membuat ulang:

- `clip.scale` **bertumpuk** dengan `deviceScaleFactor`. Bila keduanya diisi 2,
  hasilnya 4× — isi `clip.scale` dengan 1
- Tangkapan seluruh halaman menggantung selamanya bila ada animasi yang
  berputar terus. Hentikan animasi lebih dulu sebelum mengambil gambar
- Dialog "Ambil alih tugas ini?" hanya muncul bila tiketnya **sudah dipegang
  engineer lain**. Menekan "Saya kerjakan" pada tiket yang bebas langsung
  mengklaimnya tanpa bertanya — jadi dialog itu perlu dua akun: satu memegang,
  satu mencoba mengambil

Akun pada basis data contoh: `admin`, `eka`, dan `budi`, seluruhnya dengan kata
sandi `ujicoba123`. Akun-akun ini **hanya ada di basis data contoh** dan tidak
pernah dibuat pada sistem yang sungguhan.
