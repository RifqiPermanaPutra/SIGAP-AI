# SOP Troubleshooting - Divisi Printer

> Sumber langkah umum: dokumentasi resmi Microsoft Support (Windows 11).
> Bagian bertanda [KONFIRMASI] wajib dilengkapi/divalidasi Engineer ICT Field Lirik.
> Langkah ditulis rinci untuk pengguna yang tidak memahami istilah teknologi.

## Printer Offline atau Tidak Terdeteksi

### Gejala yang Dirasakan User
Saat hendak mencetak, di bawah nama printer tertulis "Offline". Dokumen tidak keluar meski printer sudah menyala.

### Penyebab yang Mungkin Terjadi
- Kabel penghubung printer longgar
- Printer sedang dalam kondisi tidur (sleep)
- Pengaturan "Use Printer Offline" tidak sengaja aktif
- Printer belum dipilih sebagai printer utama

### Solusi Pertama: Nyalakan Ulang Printer dan Matikan Mode Offline
1. Periksa printer secara fisik. Pastikan ada lampu yang menyala pada badan printer. Bila gelap total, tekan tombol daya pada printer.
2. Cari kabel yang menghubungkan printer ke komputer atau ke lubang jaringan. Tekan kedua ujungnya sampai terpasang rapat.
3. Matikan printer dengan menekan tombol daya, lalu cabut kabel listriknya dari stopkontak.
4. Tunggu sekitar 30 detik. Ini penting agar printer benar-benar mati total dan menyegarkan dirinya.
5. Pasang kembali kabel listrik, lalu nyalakan printer. Tunggu hingga lampu berhenti berkedip, sekitar 1 menit.
6. Pada komputer, klik tombol Start di bagian bawah layar, lalu klik ikon roda gigi bertuliskan "Settings".
7. Pada daftar di sisi kiri, klik "Bluetooth & devices".
8. Klik "Printers & scanners", lalu cari nama printer Anda pada daftar dan klik satu kali.
9. Perhatikan apakah ada tulisan "Use Printer Offline" yang aktif. Bila ada, klik satu kali untuk menonaktifkannya.
10. Coba cetak ulang satu halaman saja untuk menguji.

### Solusi Kedua: Restart Komputer untuk Menyegarkan Layanan Cetak
Dipakai bila printer tetap tertulis Offline. Restart komputer akan menyegarkan
layanan pencetakan di dalam Windows tanpa perlu pengaturan rumit.
1. Simpan terlebih dahulu seluruh pekerjaan Anda yang belum tersimpan.
2. Klik tombol Start di bagian bawah layar.
3. Klik ikon tombol daya, lalu pilih "Restart". Pilih Restart, bukan Shut Down.
4. Tunggu sampai komputer menyala kembali dan masuk ke layar utama.
5. Tunggu tambahan 2 menit agar seluruh layanan komputer siap.
6. Pastikan printer dalam kondisi menyala.
7. Buka kembali dokumen yang ingin dicetak.
8. Coba cetak satu halaman untuk menguji.

### Solusi Ketiga: Hapus Printer lalu Tambahkan Kembali
Dipakai bila printer tetap Offline setelah restart. Cara ini memasang ulang
sambungan printer pada komputer Anda.
1. Klik tombol Start, lalu klik ikon roda gigi bertuliskan "Settings".
2. Pada daftar di sisi kiri, klik "Bluetooth & devices".
3. Klik "Printers & scanners".
4. Cari nama printer yang bermasalah, lalu klik satu kali pada namanya.
5. Klik tombol "Remove" di bagian atas. Bila muncul pertanyaan konfirmasi, pilih "Yes".
6. Pastikan printer dalam keadaan menyala dan kabelnya terpasang.
7. Kembali ke halaman "Printers & scanners", lalu klik tombol "Add device".
8. Tunggu sekitar 30 detik sampai nama printer muncul dalam pencarian.
9. Bila nama printer sudah muncul, klik tombol "Add device" di sebelahnya.
10. Bila printer tidak muncul atau muncul permintaan izin administrator, hentikan dan laporkan kepada Engineer ICT.

### Kategori
Masalah Ringan

---

## Kertas Macet di Dalam Printer

### Gejala yang Dirasakan User
Printer berhenti mencetak di tengah jalan, terdengar bunyi menggerus, dan muncul lampu peringatan berwarna merah atau oranye.

### Penyebab yang Mungkin Terjadi
- Kertas tidak tersusun rapi saat dimasukkan
- Kertas lembap, kusut, atau bekas terlipat
- Jumlah kertas di baki terlalu banyak
- Ada sobekan kertas yang tertinggal dari cetakan sebelumnya

### Langkah Penyelesaian
1. Matikan printer terlebih dahulu dengan menekan tombol daya. Jangan menarik kertas saat printer masih menyala.
2. Buka penutup printer. Biasanya ada pegangan atau cekungan di bagian depan atau atas printer untuk membukanya.
3. Perhatikan di mana letak kertas yang tersangkut sebelum menariknya.
4. Tarik kertas perlahan searah jalur keluarnya kertas, yaitu ke arah depan. Jangan menarik ke arah berlawanan dan jangan menyentak.
5. Bila kertas sobek, periksa dengan teliti apakah ada potongan kecil yang tertinggal di dalam. Potongan yang tertinggal akan menyebabkan macet lagi.
6. Periksa juga baki kertas di bagian bawah. Tarik keluar bakinya dan pastikan tidak ada kertas kusut di sana.
7. Rapikan tumpukan kertas dengan mengetuk sisinya di atas meja agar rata, lalu masukkan kembali ke baki.
8. Pastikan jumlah kertas tidak melebihi garis batas yang tertera di dalam baki.
9. Tutup kembali seluruh penutup printer sampai terdengar bunyi klik.
10. Nyalakan printer, tunggu hingga lampu peringatan padam, lalu coba cetak satu halaman.

### Kategori
Masalah Ringan

---

## Perintah Cetak Tidak Berjalan dan Antrian Menumpuk

### Gejala yang Dirasakan User
Sudah menekan tombol cetak berkali-kali, tetapi tidak ada kertas yang keluar. Dokumen menumpuk di daftar antrian.

### Penyebab yang Mungkin Terjadi
- Ada satu dokumen bermasalah yang menyumbat antrian
- Printer yang dipilih bukan printer yang benar
- Tinta atau toner habis
- Printer kehilangan sambungan ke komputer

### Langkah Penyelesaian
1. Klik tombol Start di bagian bawah layar, lalu klik ikon roda gigi bertuliskan "Settings".
2. Pada daftar di sisi kiri, klik "Bluetooth & devices".
3. Klik "Printers & scanners". Akan muncul daftar printer yang tersedia.
4. Klik nama printer yang Anda gunakan.
5. Klik tulisan "Open print queue". Akan muncul jendela berisi daftar dokumen yang menunggu dicetak.
6. Pada jendela tersebut, hapus seluruh dokumen yang menunggu. Klik kanan pada tiap dokumen lalu pilih "Cancel".
7. Perhatikan layar kecil pada badan printer. Bila ada peringatan tinta atau toner habis, laporkan kepada Engineer ICT untuk penggantian.
8. Matikan printer, tunggu 30 detik, lalu nyalakan kembali.
9. Buka kembali dokumen yang ingin dicetak, lalu cetak satu halaman saja terlebih dahulu untuk menguji.
10. Bila tetap tidak keluar, laporkan kepada Engineer ICT.

### Kategori
Masalah Ringan

---

## Hasil Cetak Bergaris atau Buram

### Gejala yang Dirasakan User
Tulisan hasil cetak terlihat samar, ada garis putih memanjang, atau warna tidak rata.

### Penyebab yang Mungkin Terjadi
- Tinta atau toner hampir habis
- Bagian penyemprot tinta tersumbat
- Pengaturan kualitas cetak sedang di mode hemat
- Kertas yang dipakai lembap

### Langkah Penyelesaian
1. Perhatikan layar kecil pada badan printer. Cari tanda sisa tinta atau toner. Bila tampak hampir kosong, laporkan kepada Engineer ICT untuk penggantian.
2. Cari tombol menu pada badan printer, biasanya bertuliskan "Menu" atau "Setup".
3. Telusuri menu tersebut hingga menemukan pilihan bertuliskan "Cleaning", "Head Cleaning", atau "Maintenance".
4. Jalankan pembersihan tersebut. Proses ini memakan waktu sekitar 2 sampai 3 menit dan printer akan berbunyi. Ini normal.
5. Setelah selesai, cetak satu halaman untuk memeriksa hasilnya.
6. Bila masih bergaris, ulangi pembersihan sekali lagi. Jangan lebih dari dua kali berturut-turut karena boros tinta.
7. Ganti kertas dengan kertas baru dari bungkus yang belum lama dibuka. Kertas yang lama terbuka menyerap lembap.
8. Saat akan mencetak dari komputer, sebelum menekan Print, klik tulisan "More settings" atau "Printer properties".
9. Cari pilihan kualitas, lalu ubah dari "Draft" atau "Standard" menjadi "High" atau "Best".
10. Cetak ulang dokumen Anda. Bila hasilnya tetap buram, laporkan kepada Engineer ICT.

### Kategori
Masalah Ringan

---

## Hasil Cetak Kotor atau Bernoda

### Gejala yang Dirasakan User
Muncul noda tinta, bercak hitam, atau bayangan pada kertas hasil cetak.

### Penyebab yang Mungkin Terjadi
- Sisa tinta atau serbuk toner menempel pada jalur kertas
- Wadah tinta bocor
- Roda penarik kertas kotor

### Langkah Penyelesaian
1. Matikan printer dan cabut kabel listriknya.
2. Tunggu sekitar 10 menit. Bagian dalam printer bisa sangat panas dan berbahaya bila disentuh langsung.
3. Buka penutup printer secara perlahan.
4. Perhatikan apakah terlihat tumpahan tinta cair atau serbuk hitam di bagian dalam.
5. Bersihkan bagian yang terlihat kotor memakai kain kering yang lembut. Jangan memakai air, tisu basah, atau cairan pembersih apa pun.
6. Bila terlihat serbuk toner tumpah cukup banyak, hentikan pembersihan dan laporkan kepada Engineer ICT. Serbuk toner tidak boleh dihirup.
7. Tutup kembali penutup printer, pasang kabel listrik, lalu nyalakan.
8. Cetak tiga sampai lima halaman percobaan. Noda ringan biasanya hilang dengan sendirinya setelah beberapa lembar.
9. Bila noda tetap muncul, laporkan kepada Engineer ICT.

### Kategori
Masalah Ringan

---

## Printer Tidak Menyala atau Rusak

### Gejala yang Dirasakan User
Printer sama sekali tidak menyala meski tombol daya sudah ditekan, atau mengeluarkan bunyi keras yang tidak wajar, atau tercium bau terbakar.

### Penyebab yang Mungkin Terjadi
- Kerusakan pada bagian dalam printer
- Kerusakan pada sumber daya printer
- Komponen penggerak rusak karena usia atau benturan

### Penanganan
Masalah ini termasuk kategori BERAT dan memerlukan penanganan langsung oleh Engineer ICT. Bila tercium bau terbakar atau keluar asap, segera cabut kabel listrik printer dari stopkontak. Silakan hubungi Engineer melalui tombol WhatsApp.

### Kategori
Masalah Berat - Eskalasi ke Engineer

---

## Catatan Konfirmasi Engineer

Informasi berikut khas Field Lirik dan belum dapat diisi dari sumber umum:

- [KONFIRMASI] Merek dan tipe printer yang digunakan di tiap lokasi
- [KONFIRMASI] Printer terhubung langsung ke komputer atau melalui jaringan
- [KONFIRMASI] Letak tombol menu pada printer yang dipakai
- [KONFIRMASI] Prosedur permintaan penggantian tinta atau toner
- [KONFIRMASI] Siapa yang berwenang memasang printer baru pada komputer
