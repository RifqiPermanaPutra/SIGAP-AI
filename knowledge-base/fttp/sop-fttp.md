# SOP Troubleshooting - Divisi FTTP (Fiber To The Premise)

> Sumber langkah umum: praktik standar pengoperasian perangkat ONU/ONT jaringan fiber.
> Bagian bertanda [KONFIRMASI] wajib dilengkapi/divalidasi Engineer ICT Field Lirik.
> PERINGATAN: kabel fiber optik tidak boleh ditekuk tajam, ditarik, atau dibuka sendiri.
> Langkah ditulis rinci untuk pengguna yang tidak memahami istilah teknologi.

## Lampu LOS Menyala Merah pada Perangkat Internet

### Gejala yang Dirasakan User
Pada kotak perangkat internet terdapat lampu bertuliskan LOS yang menyala atau berkedip merah. Internet mati total.

### Penyebab yang Mungkin Terjadi
- Kabel fiber terlepas dari perangkat
- Kabel fiber tertekuk tajam, terjepit, atau tertindih barang
- Gangguan pada jalur kabel di luar ruangan
- Gangguan dari penyedia layanan internet

### Solusi Pertama: Periksa Posisi Kabel Fiber
1. Temukan kotak perangkat internet Anda. Bentuknya kotak kecil berwarna putih atau hitam dengan beberapa lampu kecil di bagian depan.
2. Perhatikan deretan lampu di bagian depan. Cari lampu yang di bawahnya tertulis LOS. Bila menyala merah, berarti sambungan kabel fiber terputus.
3. Lihat bagian belakang perangkat. Cari kabel yang sangat kecil dan tipis, biasanya berwarna kuning atau hijau, jauh lebih kecil daripada kabel lain. Itulah kabel fiber.
4. JANGAN mencabut kabel fiber tersebut. Cukup periksa apakah ujungnya masih terpasang rapat pada perangkat.
5. Telusuri kabel fiber itu perlahan. Perhatikan apakah ada bagian yang tertindih kaki meja, terjepit pintu, atau tertekuk membentuk sudut tajam.
6. Bila ada yang tertindih, angkat benda tersebut dengan hati-hati dan rapikan posisi kabelnya. Jangan menarik kabelnya.
7. Tunggu sekitar 1 menit, lalu perhatikan kembali apakah lampu LOS sudah padam.

### Solusi Kedua: Matikan dan Nyalakan Ulang Perangkat
Dipakai bila lampu LOS tetap merah setelah posisi kabel dirapikan. Mematikan
perangkat memaksa sambungan ke penyedia layanan dibangun ulang dari awal.
1. Cari kabel listrik perangkat, yaitu kabel yang menuju stopkontak di dinding.
2. Cabut kabel tersebut dari stopkontak.
3. Bila perangkat memiliki tombol bertuliskan Power atau ON/OFF, tekan juga ke posisi mati.
4. Tunggu sekitar 60 detik. Jangan terburu-buru, perangkat memerlukan waktu untuk benar-benar mati.
5. Pasang kembali kabel listrik ke stopkontak, lalu tekan tombol daya ke posisi menyala.
6. Tunggu sekitar 3 menit tanpa melakukan apa pun. Lampu akan berkedip-kedip, dan ini normal.
7. Setelah 3 menit, perhatikan lampu LOS. Bila sudah padam, coba buka satu situs untuk menguji.
8. Bila lampu LOS masih merah, ulangi sekali lagi dari langkah 2, namun kali ini tunggu 5 menit.

### Solusi Ketiga: Pastikan Gangguan Bersifat Menyeluruh
Dipakai bila lampu LOS tetap merah. Langkah ini bukan untuk memperbaiki, melainkan
mengumpulkan keterangan agar engineer dapat menangani lebih cepat.
1. Tanyakan kepada rekan di ruangan lain, apakah internet mereka juga mati.
2. Perhatikan apakah ada pekerjaan penggalian, perbaikan jalan, atau alat berat di sekitar area belakangan ini.
3. Catat sejak kapan internet mati, sebutkan jam bila masih ingat.
4. Catat lokasi Anda, misalnya nama gedung atau ruangan.
5. Catat lampu apa saja yang menyala dan warnanya pada perangkat internet.
6. Laporkan kepada Engineer ICT beserta seluruh catatan tersebut. Lampu LOS merah yang menetap menandakan gangguan pada jalur kabel di luar ruangan yang hanya dapat ditangani engineer.

### Kategori
Masalah Ringan

---

## Perangkat Internet Tidak Menyala Sama Sekali

### Gejala yang Dirasakan User
Seluruh lampu pada kotak perangkat internet padam. Tidak ada internet sama sekali.

### Penyebab yang Mungkin Terjadi
- Kabel listrik perangkat terlepas
- Stopkontak tidak dialiri listrik
- Tombol daya perangkat dalam posisi mati

### Langkah Penyelesaian
1. Temukan kotak perangkat internet Anda, lalu perhatikan bagian depannya. Pastikan benar-benar tidak ada satu pun lampu yang menyala.
2. Lihat bagian belakang atau samping perangkat. Cari tombol kecil bertuliskan Power atau ON/OFF. Pastikan tombol tersebut dalam posisi ditekan atau menyala.
3. Telusuri kabel listrik perangkat sampai ke stopkontak di dinding.
4. Pastikan kepala kabel tertancap penuh ke stopkontak, tidak longgar atau setengah masuk.
5. Untuk memastikan stopkontak berfungsi, coba colokkan perangkat lain seperti pengisi daya ponsel ke stopkontak yang sama.
6. Bila perangkat lain juga tidak menyala, berarti masalahnya pada aliran listrik ruangan tersebut, bukan pada perangkat internet.
7. Bila stopkontak berfungsi normal, cabut kabel listrik perangkat internet, tunggu 30 detik, lalu pasang kembali.
8. Tunggu sekitar 2 menit dan perhatikan apakah lampu mulai menyala.
9. Bila seluruh lampu tetap padam, laporkan kepada Engineer ICT. Sebutkan bahwa perangkat tidak menyala sama sekali meski listrik normal.

### Kategori
Masalah Ringan

---

## Lampu PON Berkedip Terus Menerus

### Gejala yang Dirasakan User
Lampu bertuliskan PON pada perangkat berkedip terus dan tidak pernah menyala tetap. Internet tidak bisa dipakai.

### Penyebab yang Mungkin Terjadi
- Perangkat sedang berusaha menyambung ke penyedia layanan
- Data perangkat belum terdaftar di sistem penyedia layanan
- Sedang ada gangguan dari penyedia layanan

### Langkah Penyelesaian
1. Perhatikan deretan lampu pada perangkat. Cari lampu bertuliskan PON dan lampu bertuliskan LOS.
2. Pastikan lampu LOS tidak menyala merah. Bila LOS merah, ikuti panduan untuk lampu LOS merah terlebih dahulu.
3. Bila hanya PON yang berkedip, tunggu sekitar 5 menit tanpa melakukan apa pun. Proses penyambungan memang memerlukan waktu.
4. Bila setelah 5 menit masih berkedip, cabut kabel listrik perangkat dari stopkontak.
5. Tunggu sekitar 30 detik.
6. Pasang kembali kabel listrik ke stopkontak.
7. Tunggu sampai 5 menit lagi sambil memperhatikan lampu PON.
8. Bila lampu PON akhirnya menyala tetap dan tidak berkedip, internet seharusnya sudah dapat digunakan. Coba buka satu situs untuk memastikan.
9. Bila lampu PON tetap berkedip setelah semua langkah ini, laporkan kepada Engineer ICT untuk diperiksa ke penyedia layanan.

### Kategori
Masalah Ringan

---

## Internet dari Fiber Terasa Lambat

### Gejala yang Dirasakan User
Internet tetap tersambung, tetapi membuka halaman terasa lama dan mengunduh berkas berjalan lambat.

### Penyebab yang Mungkin Terjadi
- Banyak perangkat memakai jaringan bersamaan
- Ada unduhan besar berjalan tanpa disadari
- Perangkat sudah berminggu-minggu menyala tanpa pernah dimatikan

### Langkah Penyelesaian
1. Tutup aplikasi yang sedang mengunduh berkas berukuran besar pada komputer Anda.
2. Tanyakan kepada rekan di ruangan yang sama, apakah mereka juga merasakan internet lambat.
3. Bila hanya Anda yang merasakannya, kemungkinan masalahnya pada komputer Anda, bukan pada perangkat internet.
4. Bila semua orang merasakannya, lanjutkan ke langkah berikut.
5. Cabut kabel listrik perangkat internet dari stopkontak.
6. Tunggu sekitar 30 detik.
7. Pasang kembali kabel listrik, lalu tunggu sekitar 2 menit sampai lampu berhenti berkedip.
8. Coba buka dua atau tiga situs berbeda untuk menguji kecepatannya.
9. Bila internet tetap lambat sepanjang hari, laporkan kepada Engineer ICT beserta keterangan berapa banyak orang yang terdampak.

### Kategori
Masalah Ringan

---

## Kabel Fiber Optik Putus atau Rusak

### Gejala yang Dirasakan User
Kabel fiber terlihat putus, terpotong, atau rusak. Bisa terjadi akibat pekerjaan penggalian atau alat berat di sekitar area.

### Penyebab yang Mungkin Terjadi
- Kabel terkena alat berat atau pekerjaan penggalian
- Kabel tertarik hingga putus
- Kerusakan pada ujung sambungan kabel

### Penanganan
Masalah ini termasuk kategori BERAT dan memerlukan penanganan langsung oleh Engineer ICT. Kabel fiber optik tidak boleh disambung sendiri karena memerlukan alat khusus, dan ujung kabel yang patah dapat melukai mata bila ditatap langsung. Jangan menyentuh atau menatap ujung kabel yang putus. Silakan hubungi Engineer melalui tombol WhatsApp.

### Kategori
Masalah Berat - Eskalasi ke Engineer

---

## Perangkat Internet Rusak atau Berbau Terbakar

### Gejala yang Dirasakan User
Perangkat terasa sangat panas, tercium bau terbakar, keluar asap, atau lampu menyala dengan pola yang tidak wajar.

### Penyebab yang Mungkin Terjadi
- Kerusakan akibat lonjakan listrik atau sambaran petir
- Kerusakan pada bagian pengubah daya
- Perangkat telah melewati usia pakai

### Penanganan
Masalah ini termasuk kategori BERAT dan memerlukan penanganan langsung oleh Engineer ICT. Bila tercium bau terbakar atau keluar asap, segera cabut kabel listrik perangkat dari stopkontak dan jauhkan barang mudah terbakar. Silakan hubungi Engineer melalui tombol WhatsApp.

### Kategori
Masalah Berat - Eskalasi ke Engineer

---

## Catatan Konfirmasi Engineer

Informasi berikut khas Field Lirik dan belum dapat diisi dari sumber umum:

- [KONFIRMASI] Merek dan tipe perangkat yang digunakan di tiap lokasi
- [KONFIRMASI] Penyedia layanan fiber serta kontak gangguannya
- [KONFIRMASI] Arti pasti setiap lampu pada perangkat yang dipakai
- [KONFIRMASI] Letak pemasangan perangkat di tiap area
- [KONFIRMASI] Apakah pengguna diperbolehkan mematikan dan menyalakan perangkat sendiri
- [KONFIRMASI] Prosedur pelaporan gangguan yang berdampak satu area
