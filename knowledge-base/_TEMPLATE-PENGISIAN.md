# Template Pengumpulan Data SOP — SIGAP

Panduan dan template untuk mengumpulkan data masalah & solusi ICT **langsung dari
engineer**, guna menggantikan data contoh (dummy) di basis pengetahuan SIGAP.

> Satu file per divisi, disimpan di: `knowledge-base/<divisi>/sop-<divisi>.md`
> Divisi: `printer`, `cctv`, `telepon`, `radio`, `windows`, `fttp`, `lan`, `wan`

---

## BAGIAN 1 — Yang perlu ditanyakan ke engineer

Untuk **setiap divisi**, gali dari engineer:

1. **Masalah apa yang PALING SERING dilaporkan user?**
   (Minta 5–10 keluhan tersering. Ini yang paling berdampak.)

2. **Untuk tiap masalah, tanyakan:**
   - **Nama/gejala** — bagaimana user biasanya menyebut masalah ini?
     (Contoh istilah awam: "laptop lemot", "layar biru", "internet mati")
   - **Kategori** — apakah user **bisa dipandu memperbaiki sendiri (RINGAN)**,
     atau **wajib ditangani engineer (BERAT)**?
   - Jika **RINGAN**:
     - Apa saja **kemungkinan penyebabnya**?
     - Apa **langkah perbaikan yang aman** dilakukan user awam
       (tanpa akses admin, tanpa membongkar perangkat), urut dari 1?
   - Jika **BERAT**:
     - **Kenapa** tidak boleh dipandu user? (butuh alat/akses/keahlian khusus,
       risiko merusak, dll.)

3. **Tindakan yang JANGAN PERNAH dilakukan user** (berbahaya / memperparah)?

4. **Kapan user harus berhenti mencoba** dan langsung menghubungi engineer?

---

## BAGIAN 2 — Template pengisian per masalah

Salin blok di bawah untuk **setiap** masalah. Pisahkan antar-masalah dengan `---`.

### ▸ Untuk MASALAH RINGAN (user bisa dipandu sendiri)

```markdown
## <Nama Masalah / Gejala>

### Gejala yang Dirasakan User
<Kalimat singkat pakai bahasa user. Sebutkan juga istilah lain yang sering
dipakai, agar AI mudah menemukannya. Contoh: "layar laptop biru lalu restart
sendiri (blue screen)".>

### Penyebab yang Mungkin Terjadi
- <penyebab 1>
- <penyebab 2>
- <penyebab 3>

### Langkah Penyelesaian
1. <langkah 1 — paling mudah/aman dulu>
2. <langkah 2>
3. <langkah 3>
4. <langkah 4 — opsional>
5. <langkah 5 — opsional>

### Kategori
Masalah Ringan
```

### ▸ Untuk MASALAH BERAT (wajib engineer)

```markdown
## <Nama Masalah / Gejala>

### Gejala yang Dirasakan User
<Kalimat singkat pakai bahasa user.>

### Penyebab yang Mungkin Terjadi
- <penyebab 1>
- <penyebab 2>

### Penanganan
Masalah ini termasuk kategori BERAT dan memerlukan penanganan langsung oleh
Engineer ICT. Silakan hubungi Engineer melalui tombol WhatsApp.

### Kategori
Masalah Berat - Eskalasi ke Engineer
```

---

## BAGIAN 3 — Contoh terisi (Divisi Windows)

```markdown
## Laptop Lemot / Lambat

### Gejala yang Dirasakan User
Laptop terasa berat, aplikasi lama terbuka, sering "not responding".

### Penyebab yang Mungkin Terjadi
- Terlalu banyak aplikasi berjalan di latar belakang
- Penyimpanan (disk C) hampir penuh
- Banyak program berjalan otomatis saat startup

### Langkah Penyelesaian
1. Tutup aplikasi yang tidak sedang digunakan
2. Restart laptop, lalu tunggu 2–3 menit sebelum dipakai kembali
3. Periksa sisa ruang disk C melalui File Explorer; kosongkan Recycle Bin
4. Hapus file sementara: tekan Windows+R, ketik %temp%, hapus isinya
5. Bila masih lambat setelah langkah di atas, laporkan ke Engineer ICT

### Kategori
Masalah Ringan

---

## Blue Screen Berulang / Laptop Gagal Menyala

### Gejala yang Dirasakan User
Layar biru dengan kode error, laptop restart sendiri berulang, atau gagal masuk Windows.

### Penyebab yang Mungkin Terjadi
- Kerusakan sistem operasi
- Kerusakan komponen hardware (RAM, hard disk)

### Penanganan
Masalah ini termasuk kategori BERAT dan memerlukan penanganan langsung oleh
Engineer ICT. Silakan hubungi Engineer melalui tombol WhatsApp.

### Kategori
Masalah Berat - Eskalasi ke Engineer
```

---

## BAGIAN 4 — Aturan pengisian (WAJIB dibaca)

1. **Satu masalah diawali `## `** dan antar-masalah dipisah dengan `---`.
   Sistem memakai `##` sebagai penanda satu unit pencarian.
2. **Maksimal 5 langkah** penyelesaian. Lebih dari itu, ringkas atau pecah.
3. **Tulis untuk user awam** — tanpa istilah teknis berat, tanpa perintah
   Command Prompt/registry, tanpa langkah yang butuh hak administrator.
   Bila solusinya butuh hal-hal itu → jadikan **BERAT**.
4. **Jangan menebak.** Isi hanya solusi yang benar-benar diketahui engineer.
   AI dilarang mengarang; bila data tidak ada, ia otomatis mengarahkan ke engineer.
5. **Gunakan bahasa user** pada judul & gejala (mis. "internet mati",
   "printer bergaris") supaya pencarian AI akurat.
6. **Kata kunci BERAT** yang otomatis memicu eskalasi (pakai bila memang berat):
   *rusak, kerusakan, mati total, putus, gagal boot, blue screen, mainboard,
   server, konfigurasi router, administrator, kunjungan engineer.*

---

## BAGIAN 5 — Setelah data terkumpul

1. Isi tiap file divisi: `knowledge-base/<divisi>/sop-<divisi>.md`
2. Muat ulang basis pengetahuan:
   ```bash
   npm run ingest -- --clear --ingest
   ```
3. Uji beberapa keluhan nyata di aplikasi untuk memastikan jawaban sesuai.

> **Catatan:** template ini juga bisa dipindahkan ke Google Form / spreadsheet —
> tiap kolom = satu bagian di atas (Nama masalah, Gejala, Kategori, Penyebab,
> Langkah 1–5). Hasil isian tinggal disusun ulang mengikuti format Bagian 2.
