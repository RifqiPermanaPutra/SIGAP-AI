# SOP Troubleshooting - Divisi FTTP (Fiber To The Premise)

## ONU Belum Menyala

### Penyebab yang Mungkin Terjadi
- Adaptor power ONU belum terpasang atau terlepas
- Stop kontak/colokan listrik tidak berfungsi
- Adaptor ONU rusak

### Langkah Penyelesaian
1. Periksa apakah adaptor power ONU sudah terpasang ke stop kontak dan ke port power di ONU
2. Pastikan stop kontak yang digunakan berfungsi (coba colok perangkat lain untuk mengetes)
3. Periksa apakah ada tombol power pada ONU, pastikan dalam posisi ON
4. Cabut adaptor power dari stop kontak, tunggu 10 detik, lalu colok kembali
5. Jika ONU tetap tidak menyala, kemungkinan adaptor rusak dan perlu penanganan engineer

### Kategori
Masalah Ringan

---

## FTTP LOS Merah (Lampu LOS Menyala Merah)

### Penyebab yang Mungkin Terjadi
- Kabel fiber optik terlepas dari port ONU
- Kabel fiber optik tertekuk tajam
- Konektor fiber optik kotor
- Gangguan pada jalur fiber dari OLT ke ONU

### Langkah Penyelesaian
1. Periksa kabel fiber optik yang masuk ke port ONU, pastikan konektor terpasang dengan baik (terdengar "klik")
2. Periksa sepanjang kabel fiber optik yang terlihat, pastikan tidak ada yang tertekuk tajam atau terjepit
3. Jika memungkinkan, cabut konektor fiber optik dari port ONU lalu pasang kembali secara hati-hati (jangan menyentuh ujung konektor)
4. Periksa apakah ada furniture atau benda berat yang menindih kabel fiber optik
5. Jika lampu LOS masih merah setelah langkah di atas, kemungkinan ada gangguan pada jalur fiber dan perlu ditangani engineer

### Kategori
Masalah Ringan

---

## Internet Lambat via FTTP

### Penyebab yang Mungkin Terjadi
- Banyak perangkat yang terhubung ke jaringan secara bersamaan
- Kabel LAN dari ONU ke router/komputer bermasalah
- Router WiFi perlu di-restart

### Langkah Penyelesaian
1. Restart ONU dan router WiFi dengan mematikan keduanya, tunggu 30 detik, nyalakan ONU terlebih dahulu, lalu router
2. Kurangi jumlah perangkat yang terhubung ke WiFi jika terlalu banyak
3. Coba hubungkan komputer langsung ke ONU menggunakan kabel LAN untuk memastikan koneksi stabil
4. Periksa apakah lampu indikator pada ONU semua menyala hijau normal
5. Jika internet masih lambat, kemungkinan ada gangguan pada sisi provider dan perlu dilaporkan ke engineer

### Kategori
Masalah Ringan

---

## Fiber Optik Putus

### Penyebab yang Mungkin Terjadi
- Kabel fiber optik terkena benturan fisik atau terpotong
- Kerusakan akibat hewan pengerat
- Pekerjaan konstruksi di sekitar jalur kabel

### Penanganan
Masalah ini termasuk kategori BERAT dan memerlukan penanganan langsung oleh Engineer ICT. Silakan hubungi Engineer melalui tombol WhatsApp.

### Kategori
Masalah Berat - Eskalasi ke Engineer
