# Panduan Hosting SIGAP di VPS

Panduan menempatkan SIGAP pada server sewaan (VPS) agar dapat dibuka dari luar
jaringan kantor.

Untuk penempatan di dalam kantor, pakai [README.md](README.md) bagian
**Serah terima ke Fungsi IT** — bukan berkas ini.

---

## Yang akan dibangun

```
Pengunjung ──HTTPS──► nginx ──HTTP──► Node (SIGAP) ──► SQLite
                       :443           127.0.0.1:3000    /var/lib/sigap
                         │                                    │
                    sertifikat                           cadangan harian
                     certbot                            /var/backups/sigap
                                                              │
                                                       disalin keluar tiap malam
```

nginx yang berhadapan dengan internet. Node **tidak** dibuka ke publik — ia
hanya mendengarkan dari mesin itu sendiri.

## Spesifikasi VPS

| | |
|---|---|
| Prosesor | 1 vCPU sudah cukup |
| Memori | 2 GB |
| Disk | 20 GB, **permanen** — bukan disk sementara |
| Sistem | Ubuntu 22.04 atau 24.04 |
| Node | **22.5 ke atas** — wajib |

> **Satu syarat yang tidak bisa ditawar: disknya harus permanen.** Basis data
> SIGAP berupa berkas. Pada layanan berdisk sementara — Vercel, Netlify, atau
> paket gratis Railway dan Render — seluruh laporan, akun engineer, dan riwayat
> **terhapus setiap kali aplikasi dijalankan ulang**. Bukan risiko kecil;
> kehilangan total tanpa peringatan.

Utamakan penyedia yang pusat datanya di Indonesia — Biznet Gio, IDCloudHost,
Cloudkilat — karena basis data ini memuat nama pegawai sungguhan.

---

## Langkah 1: Node dan nginx

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs nginx
```

**Cara memastikan berhasil:**

```bash
node -v      # harus 22.5 atau lebih tinggi
nginx -v
```

Bila `node -v` menunjukkan angka di bawah 22.5, **jangan diteruskan**.
Aplikasi tidak akan menyala sama sekali — penyimpanannya memakai `node:sqlite`
yang baru ada sejak versi itu.

## Langkah 2: akun dan folder

Aplikasi dijalankan oleh akun tersendiri tanpa hak istimewa. Jangan sebagai
`root`: halaman ini terbuka untuk publik, dan satu celah pada proses yang
berjalan sebagai root berarti seluruh mesin ikut jatuh.

```bash
sudo useradd --system --home /opt/sigap --shell /usr/sbin/nologin sigap
sudo mkdir -p /opt/sigap /var/lib/sigap /var/backups/sigap
sudo chown -R sigap:sigap /opt/sigap /var/lib/sigap /var/backups/sigap
```

Perhatikan bahwa basis data diletakkan di `/var/lib/sigap`, **di luar folder
aplikasi**. Ini disengaja: deploy berikutnya menimpa `/opt/sigap`, dan basis
data yang berada di dalamnya akan ikut tertimpa.

## Langkah 3: mengirim kode

Di komputer Anda — **jangan menyalin folder kerja**:

```bash
git archive HEAD --format=tar.gz -o sigap.tar.gz
scp sigap.tar.gz pengguna@alamat-vps:/tmp/
```

`git archive` menghasilkan ±100 berkas berisi kode, seluruh SOP, dan
dokumentasi — tanpa `node_modules`, tanpa `.env` berisi nomor WhatsApp asli,
dan tanpa basis data berisi nama pegawai.

> Pastikan seluruh pekerjaan sudah di-commit. `git archive HEAD` mengambil dari
> commit terakhir, bukan dari berkas yang ada di layar Anda. Periksa dengan
> `git status`.

Di VPS:

```bash
sudo -u sigap tar xzf /tmp/sigap.tar.gz -C /opt/sigap
```

## Langkah 4: memasang dan membangun

```bash
cd /opt/sigap
sudo -u sigap npm install
sudo -u sigap npm run build:kb
sudo -u sigap npm run build
```

**Cara memastikan berhasil:** folder `/opt/sigap/dist` ada dan berisi
`index.html`. Tanpa `npm run build`, aplikasi menyala tetapi setiap halaman
menghasilkan galat — server menyajikan `dist/` yang belum ada.

## Langkah 5: mengisi .env

```bash
sudo -u sigap cp /opt/sigap/.env.example /opt/sigap/.env
sudo -u sigap nano /opt/sigap/.env
```

Isi yang berbeda dari penempatan di kantor:

```ini
NODE_ENV=production
PORT=3000

DB_PATH=/var/lib/sigap/sigap.db
CADANGAN_LUAR=/var/backups/sigap

# TLS diakhiri nginx, jadi Node melihat HTTP biasa. Kedua baris ini yang
# memberi tahu aplikasi bahwa pengunjung sebenarnya memakai HTTPS.
COOKIE_SECURE=1
TRUST_PROXY=1

ALAMAT_PUBLIK=https://sigap.contoh.id

# WAJIB, dan HARUS berbeda dari kunci yang dipakai server kantor.
SESSION_SECRET=
```

Membuat `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Isi pula seluruh `WHATSAPP_<DIVISI>`. Biarkan `HTTPS_KEY` dan `HTTPS_CERT`
kosong — sertifikat diurus nginx, bukan Node.

Kunci berkasnya, karena memuat kunci sesi dan nomor engineer:

```bash
sudo chmod 600 /opt/sigap/.env
sudo chown sigap:sigap /opt/sigap/.env
```

> **Kenapa `TRUST_PROXY=1` penting.** Tanpanya, seluruh permintaan tampak
> berasal dari `127.0.0.1` — alamat nginx, bukan alamat pengunjung. Pembatas
> laju halaman masuk lalu menghitung semua orang sebagai satu orang, sehingga
> **satu orang salah kata sandi mengunci seluruh pengguna sekaligus**.

## Langkah 6: menjalankan pertama kali

```bash
cd /opt/sigap && sudo -u sigap node server.js
```

**Catat kata sandi admin yang muncul — hanya ditampilkan sekali.**

Konsol seharusnya menampilkan:

```
🔒 HTTPS ditangani proxy di depan — kuki bertanda Secure, HSTS dipasang.
✅ Seluruh divisi sudah punya nomor WhatsApp engineer sendiri
```

Bila masih muncul `⚠️ Berjalan di atas HTTP`, berarti `COOKIE_SECURE=1` belum
terbaca — periksa kembali `.env`.

Hentikan dengan Ctrl+C, lalu lanjutkan.

## Langkah 7: menyala sendiri

```bash
sudo cp /opt/sigap/skrip-linux/sigap.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now sigap
```

**Cara memastikan berhasil:**

```bash
systemctl status sigap          # harus "active (running)"
curl -I http://127.0.0.1:3000   # harus 200
sudo reboot                     # lalu periksa lagi setelah menyala
```

Melihat catatan berjalan: `journalctl -u sigap -f`

## Langkah 8: nginx dan HTTPS

Arahkan dulu nama domain ke alamat IP VPS (rekaman A), tunggu sampai
menyebar. Periksa: `dig +short sigap.contoh.id`

```bash
sudo cp /opt/sigap/skrip-linux/nginx-sigap.conf /etc/nginx/sites-available/sigap
sudo nano /etc/nginx/sites-available/sigap     # ganti sigap.contoh.id
sudo ln -s /etc/nginx/sites-available/sigap /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Sertifikat:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d sigap.contoh.id
```

certbot menulis sendiri baris sertifikat ke dalam konfigurasi dan memasang
pembaruan otomatis.

**Cara memastikan berhasil:** buka `https://sigap.contoh.id` — beranda muncul
dengan gembok di bilah alamat. Lalu:

```bash
curl -sI https://sigap.contoh.id | grep -i strict-transport
```

Harus muncul `Strict-Transport-Security`. Bila tidak, `COOKIE_SECURE=1` belum
terbaca aplikasi.

## Langkah 9: firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

**Cara memastikan berhasil** — dari komputer lain:

```bash
curl http://alamat-vps:3000
```

Harus **gagal tersambung**. Bila berhasil, porta 3000 terbuka ke publik dan
seluruh lapisan nginx terlewati begitu saja.

## Langkah 10: cadangan keluar dari mesin

Cadangan harian aplikasi masuk ke `/var/backups/sigap` — **disk yang sama
dengan basis datanya**. VPS hilang, dua-duanya hilang bersamaan.

```bash
sudo apt install -y rclone
sudo -u sigap rclone config          # buat remote, misalnya "cadangan"
sudo nano /opt/sigap/skrip-linux/cadangkan-keluar.sh    # sesuaikan TUJUAN
sudo chmod +x /opt/sigap/skrip-linux/cadangkan-keluar.sh
```

Jadwalkan pukul 02.30, setelah pencadangan aplikasi berjalan:

```bash
sudo crontab -e
```

```
30 2 * * * /opt/sigap/skrip-linux/cadangkan-keluar.sh >> /var/log/sigap-cadangan.log 2>&1
```

**Cara memastikan berhasil:** jalankan sekali secara manual, lalu pastikan
berkasnya benar-benar ada di tujuan — jangan percaya pada perintah yang tidak
menampilkan galat.

```bash
sudo -u sigap /opt/sigap/skrip-linux/cadangkan-keluar.sh
sudo -u sigap rclone lsl cadangan:sigap-lirik
```

> Sekali dalam tiga bulan, **coba pulihkan** salah satu cadangan ke mesin lain
> lalu buka. Cadangan yang tidak pernah diuji bukan cadangan — hanya berkas
> yang diharapkan berguna.

## Langkah 11: akun engineer

```bash
cd /opt/sigap
sudo -u sigap npm run akun -- tambah <nama-akun> engineer
```

Selebihnya sama dengan [README.md](README.md).

---

## Daftar periksa akhir

- [ ] `node -v` menunjukkan 22.5 ke atas
- [ ] `https://domain` terbuka, bergembok
- [ ] `curl http://alamat-vps:3000` dari luar **gagal**
- [ ] `Strict-Transport-Security` muncul pada balasan
- [ ] Kata sandi admin sudah dicatat di tempat aman
- [ ] Masuk sebagai admin berhasil, halaman rekap terbuka
- [ ] `systemctl status sigap` aktif setelah `sudo reboot`
- [ ] Cadangan hari ini ada di `/var/backups/sigap`
- [ ] Cadangan hari ini juga ada di tujuan luar
- [ ] Seluruh divisi punya nomor WhatsApp sendiri
- [ ] Satu pengaduan uji berhasil sampai ke WhatsApp engineer
- [ ] Tautan "Tandai Selesai" di pesan WhatsApp dapat dibuka dari ponsel

---

## Perawatan rutin

| Kapan | Apa |
|---|---|
| Tiap pekan | `journalctl -u sigap --since "7 days ago" \| grep -i "error\|warn"` |
| Tiap bulan | `sudo apt update && sudo apt upgrade` lalu `sudo systemctl restart sigap` |
| Tiap bulan | Pastikan jumlah cadangan di tujuan luar bertambah |
| Tiap 3 bulan | Uji pulihkan cadangan ke mesin lain |
| Tiap 3 bulan | Ganti kata sandi admin |

Memperbarui aplikasi:

```bash
sudo systemctl stop sigap
cd /opt/sigap && sudo -u sigap tar xzf /tmp/sigap-baru.tar.gz
sudo -u sigap npm install && sudo -u sigap npm run build:kb && sudo -u sigap npm run build
sudo systemctl start sigap
```

Basis data tidak tersentuh karena berada di `/var/lib/sigap`.

---

## Yang berubah karena berada di luar kantor

Basis data ini memuat **nama pegawai, lokasi kerja, dan isi keluhan yang
sebenarnya**. Selama berada di mesin kantor, aksesnya terbatas pada jaringan
kantor. Setelah dipindahkan ke server sewaan, tiga hal menjadi tanggung jawab
baru:

**Siapa saja yang dapat menyentuh datanya.** Selain Fungsi IT Field Lirik,
kini juga siapa pun yang memegang akses `root` VPS dan administrator penyedia
layanannya. Batasi jumlah orang yang memegang kunci SSH, dan pakai kunci —
bukan kata sandi — untuk masuk.

**Persetujuan pemilik data.** Pemindahan data pegawai ke pihak ketiga
sebaiknya diketahui dan disetujui Fungsi IT pusat, bukan diputuskan di tingkat
lapangan. Simpan bukti persetujuannya bersama dokumen serah terima.

**Bila terjadi sesuatu.** Sediakan satu halaman berisi: siapa yang dihubungi,
cara mematikan layanan cepat (`sudo systemctl stop sigap && sudo systemctl
stop nginx`), dan letak cadangan terakhir. Halaman itu paling dibutuhkan
justru ketika tidak ada waktu mencarinya.

Alamat domainnya sebaiknya tidak disebarkan lebih luas dari yang perlu.
Halaman pengaduan memang harus terbuka bagi seluruh pekerja, tetapi tidak ada
alasan ia perlu ditemukan mesin pencari.
