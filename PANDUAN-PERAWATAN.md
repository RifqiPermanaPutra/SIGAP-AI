# Panduan Perawatan SIGAP

Cara mengubah sesuatu di SIGAP dan menayangkannya ke server, dari awal sampai
selesai. Berbeda dari [PANDUAN-HOSTING.md](PANDUAN-HOSTING.md) yang dipakai
**sekali** saat membangun server; berkas ini dipakai **setiap kali** ada
perubahan.

Sistemnya sudah berdiri di <https://sigapit.my.id>.

---

## Yang perlu diketahui lebih dulu

**Ada dua komputer, dan keduanya berbeda kemampuan.**

| | Laptop kantor | Laptop rumah |
|---|---|---|
| Menyunting kode | Bisa | Bisa |
| `git push` ke GitHub | Bisa | Bisa |
| SSH langsung ke VPS | Bisa | Bisa |
| Menayangkan ke server | Lewat SSH | Lewat SSH |

Penayangan tidak lagi memakai `scp`, melainkan `git pull` yang dijalankan
**di dalam** VPS. Cara ini dipilih bukan sekadar karena lebih ringkas: arsip
yang dulu dikirim berukuran 27 MB tiap kali, sedangkan `git pull` hanya
memindahkan baris yang benar-benar berubah.

Bila suatu saat SSH tidak dapat menembus jaringan tempat Anda berada —
sebagian jaringan perusahaan menutup porta 22 — VPS tetap dapat dikelola
lewat **Terminal web IDCloudHost** yang berjalan di atas HTTPS. Isi
perintahnya sama persis.

**PowerShell di laptop kantor versi 5.1 dan tidak mengenal `&&`.** Perintah
untuk Windows di bawah ini karena itu ditulis satu per satu. Perintah untuk VPS
tetap memakai `&&` karena Linux memakai bash.

---

## Alur ringkas

```
sunting di laptop  →  uji  →  git push  →  git pull di VPS  →  periksa
```

Lima langkah, dijelaskan satu per satu di bawah.

---

## Langkah 1: ambil versi terbaru lebih dulu

Di laptop, dari dalam folder proyek:

```
git pull
```

**Jangan dilewat.** Orang lain mungkin sudah mengubah sesuatu, dan menyunting
di atas versi lama menghasilkan tabrakan yang jauh lebih repot diselesaikan
daripada satu perintah ini.

Bila muncul `Already up to date`, berarti memang belum ada perubahan baru.

---

## Langkah 2: sunting

Buka folder proyek di VS Code, ubah yang perlu diubah.

Beberapa berkas yang paling sering disentuh:

| Yang ingin diubah | Berkasnya |
|---|---|
| Daftar Fungsi/Divisi pada formulir | `bersama/fungsi.js` |
| Daftar lokasi | `bersama/lokasi.js` |
| Isi SOP tiap layanan | `knowledge-base/<layanan>.json` |
| Tampilan halaman rekap | `src/rekap/RekapPage.jsx` |
| Tampilan halaman cek tiket | `src/tiket/TiketPage.jsx` |
| Halaman tugas engineer | `src/tugas/TugasPage.jsx` |

SOP juga dapat disunting **tanpa menyentuh kode** lewat halaman `/sop-editor`
di web. Bila memakai cara itu, perubahannya tersimpan di server dan langkah
1–5 di berkas ini tidak diperlukan.

---

## Langkah 3: uji di laptop sendiri

Selalu uji sebelum mengirim. Menemukan kesalahan di laptop memakan waktu satu
menit; menemukannya setelah tayang berarti pekerja sungguhan yang menemukannya.

```
npm test
```

Harus berakhir dengan `SELURUH PENGUJIAN LULUS`. Bila ada yang gagal,
**berhenti di sini** dan perbaiki dulu.

Bila mengubah SOP di `knowledge-base/`:

```
npm run build:kb
```

Lalu bangun tampilannya:

```
npm run build
```

Untuk melihat hasilnya sendiri:

```
npm run dev
```

Buka <http://localhost:3000>, periksa perubahannya, lalu tekan `Ctrl+C` untuk
berhenti.

> Basis data di laptop sengaja kosong atau berisi data uji. Data sungguhan
> hanya ada di VPS, dan tidak pernah disalin ke laptop.

---

## Langkah 4: simpan ke GitHub

```
git add -A
```

```
git commit -m "keterangan singkat perubahannya"
```

```
git push
```

Tulis keterangan yang menjelaskan **apa yang berubah dan mengapa**, bukan
sekadar "update". Enam bulan lagi keterangan itu yang menjelaskan alasan
sebuah baris ditulis begitu.

Bila ini push pertama dari komputer tersebut, akan muncul jendela
**Sign in to GitHub** — masuk lewat peramban. GitHub tidak lagi menerima kata
sandi biasa di terminal.

---

## Langkah 5: tayangkan ke server

### Cara biasa — lewat SSH

Dari PowerShell di laptop mana pun:

```bash
ssh sigapit@103.55.37.108
```

Masukkan kata sandi VPS. Huruf tidak akan terlihat saat diketik — itu
perilaku normal SSH, bukan tanda macet.

Setelah prompt berubah menjadi `sigapit@sigapit:~$`, jalankan:

```bash
cd /opt/sigap \
  && sudo -u sigap git pull \
  && sudo -u sigap npm run build \
  && sudo systemctl restart sigap
```

> **Cara memastikan sudah berada di dalam VPS:** prompt-nya
> `sigapit@sigapit:~$`, bukan `PS C:\...>`. Perintah `sudo` tidak akan pernah
> jalan di Windows.

### Bila SSH tidak dapat menembus jaringan — lewat Terminal web

Sebagian jaringan perusahaan menutup porta 22. Gejalanya: `ssh` berhenti di
`Connecting to ... port 22` lalu diam sampai `Connection timed out`. Bila itu
terjadi, VPS tetap dapat dikelola lewat peramban:

1. Buka <https://my.idcloudhost.com>
2. Masuk ke VPS bernama `sigapit`
3. Klik tombol **Terminal** di baris atas (sederet dengan Start, Stop, Reboot)
4. Masuk sebagai `sigapit` dengan kata sandi VPS
5. Jalankan perintah yang sama persis seperti di atas

Terminal ini berjalan di atas HTTPS, sehingga tidak terpengaruh blokir porta 22.

---

## Langkah 6: pastikan berhasil

Masih di VPS:

```bash
systemctl status sigap
```

Harus tertulis **`active (running)`** berwarna hijau. Bila tertulis
`activating (auto-restart)` atau `failed`, lihat bagian **Bila ada masalah**
di bawah.

Lalu buka <https://sigapit.my.id> di peramban dan periksa perubahannya benar
muncul.

Selesai. Seluruh langkah di atas biasanya memakan waktu di bawah lima menit.

---

## Bila ada masalah

### Layanan tidak mau menyala

Lihat sebab sesungguhnya — `systemctl status` hanya bilang gagal, tidak bilang
mengapa:

```bash
sudo journalctl -u sigap -n 40 --no-pager
```

Dua sebab yang paling sering:

**`EADDRINUSE: address already in use :::3000`**
Ada proses lama yang masih memegang porta 3000. Cari dan hentikan:

```bash
sudo ss -ltnp | grep 3000
```

```bash
sudo kill <angka-setelah-pid=>
```

```bash
sudo systemctl restart sigap
```

**Galat menyebut `.env`**
Berkas `.env` tidak pernah ikut git, jadi ia tidak berubah oleh penayangan.
Bila galatnya menyebut variabel yang hilang, kemungkinan ada variabel baru
yang perlu ditambahkan:

```bash
sudo -u sigap nano /opt/sigap/.env
```

### Perubahan tidak muncul di web

Hampir selalu karena `npm run build` terlewat. Tampilan yang disajikan berasal
dari folder `dist/`, dan folder itu **tidak ikut git** — jadi harus dibangun
ulang di server setiap kali menayangkan.

```bash
cd /opt/sigap \
  && sudo -u sigap npm run build \
  && sudo systemctl restart sigap
```

### Ingin kembali ke versi sebelumnya

Lihat riwayatnya:

```bash
cd /opt/sigap \
  && sudo -u sigap git log --oneline -10
```

Kembali ke commit tertentu:

```bash
cd /opt/sigap \
  && sudo -u sigap git reset --hard <kode-commit> \
  && sudo -u sigap npm run build \
  && sudo systemctl restart sigap
```

Basis data tidak ikut mundur — ia berada di `/var/lib/sigap/`, di luar folder
aplikasi. Yang kembali hanya kodenya.

---

## Sebelum perubahan yang berisiko

Bila perubahannya menyentuh basis data atau Anda ragu, cadangkan lebih dulu:

```bash
cd /opt/sigap \
  && sudo -u sigap npm run cadangkan
```

Hasilnya tersimpan di `/var/lib/sigap/cadangan`. Pencadangan harian sebenarnya
sudah berjalan sendiri, tetapi cadangan yang dibuat tepat sebelum perubahan
jauh lebih menenangkan daripada cadangan tadi malam.

---

## Yang TIDAK perlu ditayangkan lewat langkah di atas

| Perubahan | Cara sebenarnya |
|---|---|
| Menyunting SOP | Halaman `/sop-editor` di web, langsung tersimpan |
| Menambah akun engineer | `npm run akun -- buat ...` di VPS |
| Mengganti kata sandi akun | Halaman masuk, atau `npm run akun -- ganti ...` |
| Menghapus laporan fiktif | Tombol **Hapus** di halaman rekap, oleh admin |
| Mengabari pelapor | Tombol **Kabari pelapor** di halaman tugas |

Kelimanya berjalan di server yang sedang menyala, tanpa perlu menyunting kode
maupun menayangkan ulang.

---

## Ringkasan perintah

**Di laptop:**

```
git pull
npm test
npm run build
git add -A
git commit -m "keterangan"
git push
```

**Di VPS:**

```bash
cd /opt/sigap \
  && sudo -u sigap git pull \
  && sudo -u sigap npm run build \
  && sudo systemctl restart sigap
systemctl status sigap
```
