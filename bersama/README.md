# bersama/

Daftar tetap yang dipakai **backend maupun frontend**.

Isinya bukan sembarang berkas yang kebetulan dipakai dua kali, melainkan
daftar yang **wajib sama persis di kedua sisi**: formulir menawarkan pilihannya,
server memeriksa kiriman terhadap daftar yang sama.

| Berkas | Isi | Dipakai untuk |
|---|---|---|
| `fungsi.js` | 7 fungsi/divisi kerja | Pilihan pada formulir · pemeriksaan `POST /api/chat/reporter` |
| `lokasi.js` | 29 lokasi, dikelompokkan per area | Pilihan pada formulir · penurunan `area` di server |
| `urgensi.js` | 4 tingkat urgensi | Pilihan pada formulir · pemeriksaan server · saringan rekap |

## Kenapa folder ini ada

Sebelumnya ketiganya berada di `src/data/`, dan **server mengimpornya dari
sana** — `server/config/divisi.js` dan `server/routes/chat.js` menjangkau ke
dalam pohon frontend.

Itu bukan sekadar tidak rapi. `src/` adalah sumber yang dipaketkan Vite untuk
peramban; backend yang bergantung padanya tidak dapat dipindahkan atau
disebarkan sendiri, dan perubahan yang dilakukan demi kebutuhan tampilan dapat
mematahkan pemeriksaan di server tanpa ada yang menduga.

Sekarang batasnya jelas:

```
bersama/   ──────┬──────>  server/   (backend)
                 └──────>  src/      (frontend)
```

Tidak ada panah yang berjalan mendatar. `server/` tidak pernah mengimpor dari
`src/`, dan sebaliknya.

## Aturan

**Boleh masuk sini** — daftar nilai tetap yang kedua sisi harus sepakat.

**Jangan masuk sini** — apa pun yang menyentuh React, DOM, `fs`, basis data,
atau `process.env`. Berkas di sini dimuat oleh peramban *dan* Node, sehingga
harus berupa data murni tanpa ketergantungan lingkungan.

## Jangan menyalin isinya

Menyalin daftar ke salah satu sisi "supaya ringkas" adalah cara paling mudah
membuat sistem retak diam-diam. Pernah terjadi dua kali:

- `server/routes/chat.js` menyimpan sendiri `['Rendah','Sedang','Tinggi','Kritis']`
  dengan komentar *"harus sama dengan urgensi.js"* — dan komentar bukan penjaga.
- `server/routes/rekap.js` menyalin daftar yang sama untuk pilihan saringan.

Menambah satu tingkat urgensi di sini akan membuat formulir menawarkannya
sementara server menolaknya, tanpa pesan galat apa pun sampai ada pelapor yang
gagal mengirim. Keduanya kini menurunkan nilainya dari berkas ini.

Satu salinan yang memang disengaja masih ada: `src/data/divisiCadangan.js`,
dipakai ketika `/api/config` tidak terjawab. Penyimpangannya dijaga pengujian
di `tests/api.test.mjs` bagian 6b — bukan oleh komentar.
