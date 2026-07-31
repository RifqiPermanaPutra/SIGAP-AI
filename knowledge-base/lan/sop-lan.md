# SOP Troubleshooting - Divisi LAN (Local Area Network)

> Sumber langkah umum: dokumentasi resmi Microsoft Support (Windows 11).
> Bagian bertanda [KONFIRMASI] wajib dilengkapi/divalidasi Engineer ICT Field Lirik.
> Langkah ditulis rinci untuk pengguna yang tidak memahami istilah teknologi.

## Tidak Bisa Terhubung ke WiFi Kantor

### Gejala yang Dirasakan User
Nama WiFi tidak muncul di daftar, atau muncul tetapi gagal tersambung. Bisa juga sudah tersambung tetapi tidak bisa membuka situs apa pun.

### Penyebab yang Mungkin Terjadi
- Fitur WiFi pada komputer sedang dimatikan
- Mode pesawat (Airplane mode) tidak sengaja menyala
- Posisi terlalu jauh dari alat pemancar WiFi
- Kata sandi WiFi telah diperbarui oleh Fungsi ICT

### Solusi Pertama: Nyalakan Ulang WiFi dan Sambungkan Kembali
1. Lihat pojok kanan bawah layar komputer Anda, tepat di sebelah kiri jam. Di sana ada beberapa ikon kecil.
2. Cari ikon WiFi. Bentuknya seperti kipas atau gelombang bertingkat tiga. Klik satu kali pada ikon tersebut.
3. Akan muncul kotak kecil di atasnya. Perhatikan tombol bergambar pesawat terbang bertuliskan "Airplane mode". Bila tombol itu berwarna biru artinya sedang menyala. Klik satu kali agar warnanya berubah menjadi abu-abu.
4. Pada kotak yang sama, cari tombol bergambar WiFi. Bila warnanya abu-abu, klik satu kali agar berubah menjadi biru. Ini menandakan WiFi sudah dinyalakan.
5. Setelah itu akan muncul daftar nama-nama WiFi yang tertangkap. Tunggu sekitar 10 detik hingga daftarnya terisi penuh.
6. Cari nama WiFi kantor pada daftar tersebut, lalu klik satu kali.
7. Klik tombol bertuliskan "Connect". Bila ada kotak kecil bertuliskan "Connect automatically", beri centang terlebih dahulu.
8. Bila diminta memasukkan kata sandi, ketik kata sandi WiFi kantor, lalu klik "Next".
9. Tunggu sekitar 15 detik. Bila berhasil, di bawah nama WiFi akan tertulis "Connected".

### Solusi Kedua: Lupakan Jaringan lalu Sambungkan Ulang
Dipakai bila WiFi tetap gagal tersambung padahal kata sandi sudah benar. Cara ini
menghapus data sambungan lama yang mungkin sudah tidak sesuai.
1. Klik tombol Start di bagian bawah layar, lalu klik ikon roda gigi bertuliskan "Settings".
2. Pada daftar di sisi kiri, klik "Network & internet".
3. Klik "Wi-Fi", lalu klik "Manage known networks".
4. Akan muncul daftar nama WiFi yang pernah tersambung. Cari nama WiFi kantor.
5. Klik nama WiFi kantor tersebut, lalu klik tombol "Forget".
6. Kembali ke pojok kanan bawah layar, klik ikon WiFi.
7. Cari kembali nama WiFi kantor pada daftar, lalu klik "Connect".
8. Masukkan kata sandi WiFi kantor saat diminta, lalu klik "Next".
9. Tunggu sekitar 15 detik hingga muncul tulisan "Connected".

### Solusi Ketiga: Jalankan Perbaikan Otomatis Windows
Dipakai bila kedua cara di atas belum berhasil. Windows memiliki alat perbaikan
jaringan bawaan yang memeriksa dan memperbaiki sendiri.
1. Klik tombol Start di bagian bawah layar.
2. Ketik kata "Get Help" pada kotak pencarian, lalu tekan Enter.
3. Setelah aplikasi Get Help terbuka, ketik "network troubleshooter" pada kotak pertanyaannya.
4. Ikuti petunjuk yang muncul di layar. Alat ini akan memeriksa jaringan secara otomatis.
5. Bila diminta izin melakukan perbaikan, pilih "Yes" atau "Apply this fix".
6. Tunggu sampai pemeriksaan selesai, biasanya sekitar 2 sampai 3 menit.
7. Setelah selesai, restart komputer melalui tombol Start, ikon daya, lalu "Restart".
8. Setelah komputer menyala, coba sambungkan kembali ke WiFi kantor.
9. Bila tetap gagal, laporkan kepada Engineer ICT dan sebutkan bahwa ketiga cara sudah dicoba.

### Kategori
Masalah Ringan

---

## Tidak Ada Koneksi Internet melalui Kabel LAN

### Gejala yang Dirasakan User
Tidak bisa membuka situs apa pun. Ikon jaringan di pojok kanan bawah bertanda silang atau berbentuk bola dunia.

### Penyebab yang Mungkin Terjadi
- Kabel jaringan terlepas dari komputer atau dari lubang di dinding
- Kabel jaringan rusak atau tertekuk
- Lubang jaringan di dinding sedang tidak aktif
- Gangguan jaringan pada area tersebut

### Solusi Pertama: Periksa dan Pasang Ulang Kabel Jaringan
1. Lihat bagian belakang atau samping komputer Anda. Cari kabel yang ujungnya mirip colokan telepon tetapi lebih lebar, berwarna bening dengan pengait kecil. Itulah kabel jaringan.
2. Pegang ujung kabel tersebut, lalu tekan masuk perlahan sampai terdengar bunyi klik. Bunyi klik menandakan kabel sudah terkunci.
3. Telusuri kabel itu sampai ujung satunya, biasanya menuju lubang kecil di dinding atau di bawah meja. Tekan juga ujung tersebut sampai berbunyi klik.
4. Perhatikan lubang tempat kabel masuk di komputer. Di sisinya ada lampu sangat kecil yang seharusnya menyala hijau atau berkedip.
5. Bila lampu kecil itu mati, cabut kabel, tunggu 10 detik, lalu pasang kembali sampai berbunyi klik.
6. Perhatikan apakah ada bagian kabel yang tertindih kaki meja, terjepit pintu, atau tertekuk tajam. Bila ada, rapikan posisinya perlahan.
7. Tunggu sekitar 1 menit, lalu periksa ikon jaringan di pojok kanan bawah layar.
8. Coba buka satu situs untuk menguji koneksi.

### Solusi Kedua: Restart Komputer
Dipakai bila kabel sudah terpasang benar tetapi internet tetap tidak jalan. Restart
menyegarkan sambungan jaringan pada komputer.
1. Simpan seluruh pekerjaan Anda yang belum tersimpan.
2. Klik tombol Start di bagian bawah layar.
3. Klik ikon tombol daya, lalu pilih "Restart".
4. Tunggu sampai komputer menyala kembali dan masuk ke layar utama.
5. Tunggu tambahan 2 menit agar sambungan jaringan siap sepenuhnya.
6. Lihat ikon jaringan di pojok kanan bawah layar. Pastikan tidak ada tanda silang atau tanda seru.
7. Coba buka dua situs berbeda untuk menguji koneksi.

### Solusi Ketiga: Jalankan Perbaikan Otomatis Windows
Dipakai bila kedua cara di atas belum berhasil.
1. Klik tombol Start di bagian bawah layar.
2. Ketik kata "Get Help" pada kotak pencarian, lalu tekan Enter.
3. Setelah aplikasi Get Help terbuka, ketik "network troubleshooter" pada kotak pertanyaannya.
4. Ikuti petunjuk yang muncul di layar.
5. Bila diminta izin melakukan perbaikan, pilih "Yes" atau "Apply this fix".
6. Tunggu sampai pemeriksaan selesai, biasanya 2 sampai 3 menit.
7. Coba buka satu situs untuk menguji koneksi.
8. Bila tetap gagal, tanyakan kepada rekan di ruangan yang sama apakah mereka juga terputus.
9. Laporkan kepada Engineer ICT beserta jawaban rekan Anda, karena keterangan itu membantu menentukan apakah gangguannya menyeluruh.

### Kategori
Masalah Ringan

---

## Lampu pada Lubang Kabel Jaringan Tidak Menyala

### Gejala yang Dirasakan User
Kabel jaringan sudah terpasang, tetapi lampu kecil di sebelah lubang kabel pada komputer tidak menyala sama sekali.

### Penyebab yang Mungkin Terjadi
- Kabel jaringan putus di bagian dalam meski luarnya terlihat baik
- Pengait plastik pada ujung kabel patah sehingga tidak terkunci
- Lubang jaringan di dinding sedang tidak aktif

### Langkah Penyelesaian
1. Cabut kabel jaringan dari komputer, lalu perhatikan ujungnya.
2. Periksa pengait plastik kecil di ujung kabel. Bila pengait itu patah, kabel tidak akan terkunci dan perlu diganti.
3. Pasang kembali kabel, tekan sampai berbunyi klik, lalu perhatikan lampu kecil di sisi lubang.
4. Bila masih mati, coba pindahkan ujung kabel yang di dinding ke lubang jaringan lain di dekat meja Anda.
5. Perhatikan kembali lampu kecil di komputer setelah pemindahan tersebut.
6. Bila tersedia kabel jaringan cadangan, coba ganti dengan kabel tersebut untuk memastikan apakah kabel lama yang bermasalah.
7. Bila lampu tetap mati pada semua percobaan, catat lokasi meja Anda, lalu laporkan kepada Engineer ICT.

### Kategori
Masalah Ringan

---

## Koneksi Jaringan Terasa Lambat

### Gejala yang Dirasakan User
Internet tetap tersambung, tetapi membuka halaman terasa lama dan mengunduh berkas berjalan lambat.

### Penyebab yang Mungkin Terjadi
- Banyak aplikasi memakai jaringan secara bersamaan
- Pembaruan sistem sedang berjalan tanpa disadari
- Pemakaian jaringan sedang padat pada jam sibuk

### Langkah Penyelesaian
1. Lihat bagian bawah layar Anda. Tutup aplikasi yang tidak sedang dipakai dengan mengklik tanda silang di pojok kanan atas setiap jendela.
2. Pada aplikasi peramban seperti Chrome atau Edge, tutup tab yang tidak diperlukan. Tab adalah kotak-kotak judul yang berjajar di bagian atas.
3. Perhatikan apakah ada aplikasi yang sedang mengunduh berkas besar. Biasanya terlihat bar biru berjalan di bagian bawah peramban.
4. Restart komputer. Klik tombol Start di bawah layar, klik ikon tombol daya, lalu pilih "Restart".
5. Setelah menyala kembali, tunggu sekitar 3 menit sebelum mulai bekerja, karena komputer masih menyiapkan sambungan.
6. Coba buka dua atau tiga situs yang berbeda untuk memastikan apakah lambatnya terjadi pada semua situs atau hanya satu situs.
7. Tanyakan kepada rekan di ruangan yang sama apakah mereka merasakan hal serupa.
8. Bila lambat berlangsung sepanjang hari dan dialami banyak orang, laporkan kepada Engineer ICT.

### Kategori
Masalah Ringan

---

## Seluruh Komputer di Satu Ruangan Terputus Bersamaan

### Gejala yang Dirasakan User
Semua orang di ruangan kehilangan koneksi pada waktu yang sama. Lampu pada perangkat jaringan di ruangan mati.

### Penyebab yang Mungkin Terjadi
- Kerusakan pada perangkat pembagi jaringan
- Gangguan pasokan listrik pada perangkat jaringan
- Kerusakan jalur kabel utama

### Penanganan
Masalah ini termasuk kategori BERAT dan memerlukan penanganan langsung oleh Engineer ICT. Silakan hubungi Engineer melalui tombol WhatsApp. Sebutkan nama ruangan dan perkiraan jumlah komputer yang terdampak.

### Kategori
Masalah Berat - Eskalasi ke Engineer

---

## Diminta Mengubah Pengaturan Jaringan

### Gejala yang Dirasakan User
Ada permintaan atau petunjuk untuk mengganti alamat IP, DNS, atau pengaturan jaringan lainnya.

### Penyebab yang Mungkin Terjadi
- Pengaturan jaringan komputer berubah
- Diperlukan penyesuaian konfigurasi jaringan

### Penanganan
Perubahan pengaturan jaringan memerlukan hak administrator serta pengetahuan mengenai skema jaringan Field Lirik. Tindakan ini tidak boleh dilakukan sendiri karena dapat memutus koneksi pengguna lain. Silakan hubungi Engineer melalui tombol WhatsApp.

### Kategori
Masalah Berat - Eskalasi ke Engineer

---

## Catatan Konfirmasi Engineer

Informasi berikut khas Field Lirik dan belum dapat diisi dari sumber umum:

- [KONFIRMASI] Nama jaringan WiFi resmi kantor di tiap area
- [KONFIRMASI] Cara pengguna memperoleh kata sandi WiFi
- [KONFIRMASI] Skema alamat IP yang digunakan tiap area
- [KONFIRMASI] Lokasi perangkat jaringan di tiap gedung
- [KONFIRMASI] Apakah pengguna boleh memindahkan kabel antar lubang jaringan
- [KONFIRMASI] Prosedur pelaporan gangguan yang berdampak satu ruangan
