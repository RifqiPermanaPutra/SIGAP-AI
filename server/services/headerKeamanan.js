/**
 * Header keamanan HTTP.
 *
 * Lapis kedua, bukan lapis pertama. Penjagaan yang sesungguhnya ada pada
 * pemeriksaan masukan, kueri berparameter, dan penyusunan jawaban sebagai
 * elemen React — dan seluruhnya sudah terpasang. Header di sini menjawab
 * pertanyaan yang berbeda: **kalau suatu hari salah satu penjagaan itu jebol,
 * seberapa jauh akibatnya menyebar?**
 *
 * Tanpa dependensi. Paket seperti `helmet` melakukan hal yang sama dengan
 * seratusan baris untuk kasus yang tidak pernah dipakai proyek ini, sementara
 * batas empat dependensi runtime jauh lebih berharga daripada kemudahan itu.
 *
 * NILAI CSP DISUSUN DARI HALAMAN YANG BENAR-BENAR DIBANGUN
 * Setiap izin di bawah ada karena sesuatu memang membutuhkannya. Menyalin
 * kebijakan dari proyek lain menghasilkan salah satu dari dua hal: terlalu
 * longgar sehingga tidak menjaga apa pun, atau terlalu ketat sehingga halaman
 * mati dan orang mematikannya seluruhnya.
 */

/**
 * Susun nilai Content-Security-Policy.
 *
 * @param {boolean} lewatHttps Naikkan sambungan tidak aman ke HTTPS
 */
function susunCsp(lewatHttps) {
  const aturan = {
    // Apa pun yang tidak disebut khusus di bawah: hanya dari asal sendiri.
    'default-src': ["'self'"],

    // Seluruh skrip berupa berkas terpaket di /assets — tidak ada satu pun
    // skrip sebaris pada dist/index.html. Karena itu TANPA 'unsafe-inline',
    // dan justru di sinilah CSP paling berguna: skrip yang disuntikkan lewat
    // celah XSS tidak akan pernah dijalankan.
    'script-src': ["'self'"],

    // 'unsafe-inline' terpaksa ada: React menulis atribut `style` sebaris
    // (6 tempat di src/), dan tidak ada cara menyatakannya lewat nonce tanpa
    // merombak komponennya. Risikonya jauh lebih kecil daripada pada skrip —
    // gaya sebaris tidak dapat menjalankan kode.
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'https://fonts.gstatic.com'],

    // Logo dan favicon dari asal sendiri; data: untuk gambar tertanam.
    'img-src': ["'self'", 'data:'],

    // API berada pada asal yang sama. Tidak ada panggilan ke mana pun lagi.
    'connect-src': ["'self'"],

    // Tidak ada Flash, applet, maupun objek tertanam. Ditutup rapat.
    'object-src': ["'none'"],

    // Halaman ini tidak boleh dibingkai situs mana pun — penjagaan terhadap
    // clickjacking, dan lebih kuat daripada X-Frame-Options karena dipatuhi
    // peramban modern secara seragam.
    'frame-ancestors': ["'none'"],

    // Mencegah <base href> yang disuntikkan mengalihkan seluruh jalur relatif
    // ke tempat lain.
    'base-uri': ["'self'"],

    // Formulir hanya boleh mengirim ke asal sendiri.
    'form-action': ["'self'"]
  };

  const bagian = Object.entries(aturan).map(([k, v]) => `${k} ${v.join(' ')}`);

  // Hanya bermakna saat halaman memang disajikan lewat HTTPS. Memasangnya di
  // atas HTTP membuat setiap sumber daya diminta ulang sebagai HTTPS lalu
  // gagal seluruhnya.
  if (lewatHttps) bagian.push('upgrade-insecure-requests');

  return bagian.join('; ');
}

/**
 * Middleware header keamanan.
 *
 * @param {object} [opsi]
 * @param {boolean} [opsi.https] Sambungan disajikan lewat HTTPS
 */
export function headerKeamanan({ https = false } = {}) {
  const csp = susunCsp(https);

  return (req, res, next) => {
    res.setHeader('Content-Security-Policy', csp);

    // Peramban dilarang menebak tipe berkas dari isinya. Tanpa ini, berkas
    // yang diunggah atau dihasilkan bisa ditafsirkan sebagai skrip.
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Cadangan bagi peramban lama yang belum memahami frame-ancestors.
    res.setHeader('X-Frame-Options', 'DENY');

    // Alamat halaman rekap memuat rentang tanggal dan kata pencarian pada
    // query string. Tanpa ini, keduanya ikut terkirim sebagai Referer ke
    // setiap situs luar yang dibuka dari sini — termasuk wa.me.
    res.setHeader('Referrer-Policy', 'same-origin');

    // Tidak satu pun halaman memerlukan kamera, mikrofon, atau lokasi.
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');

    // Hanya dipasang di atas HTTPS. Di atas HTTP ia diabaikan peramban, dan
    // memasangnya sebelum sertifikat benar-benar ada berarti mengunci
    // pengguna dari halaman yang belum dapat disajikan secara aman.
    if (https) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    next();
  };
}
