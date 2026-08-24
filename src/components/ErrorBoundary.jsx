import React from 'react';

/**
 * Penangkap galat penggambaran.
 *
 * Tanpa ini, satu galat pada komponen mana pun membuat React melepas seluruh
 * pohon dan menyisakan **layar putih kosong** — tanpa pesan, tanpa tombol,
 * tanpa petunjuk apa pun. Bagi pekerja yang sedang mengalami kendala IT,
 * layar putih adalah jalan buntu yang paling buruk: ia datang justru karena
 * butuh bantuan.
 *
 * Karena itu tampilan cadangan di sini tidak berhenti pada permintaan maaf.
 * Ia tetap menyediakan dua jalan keluar: memuat ulang halaman, dan menghubungi
 * Engineer IT langsung lewat WhatsApp.
 *
 * Harus berupa komponen kelas — React hanya mengenali `componentDidCatch` dan
 * `getDerivedStateFromError` pada kelas, belum ada padanannya untuk fungsi.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { galat: null, nomorWa: null };
  }

  static getDerivedStateFromError(galat) {
    return { galat };
  }

  componentDidCatch(galat, info) {
    // Konsol peramban adalah satu-satunya jejak di sisi pengguna. Server tidak
    // pernah tahu galat penggambaran terjadi, sehingga keterangan ini penting
    // saat pengguna melaporkan "layarnya kosong".
    console.error('Galat penggambaran SIGAP:', galat, info?.componentStack);

    // Nomor engineer baru diambil ketika benar-benar dibutuhkan. Mengambilnya
    // di awal berarti setiap pemuatan halaman menanggung permintaan tambahan
    // demi keadaan yang mestinya tidak pernah terjadi.
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => this.setState({ nomorWa: d?.whatsappNumber || null }))
      .catch(() => { /* tombol WhatsApp cukup disembunyikan */ });
  }

  render() {
    if (!this.state.galat) return this.props.children;

    const nomor = this.state.nomorWa;
    const pesanWa = encodeURIComponent(
      'Halo Engineer IT, saya tidak dapat memakai aplikasi SIGAP. ' +
      'Halaman menampilkan pesan kesalahan.'
    );

    return (
      <div className="galat-batas" role="alert">
        <div className="galat-batas-kotak">
          <h1>Aplikasi mengalami gangguan</h1>
          <p>
            Maaf, terjadi kesalahan pada tampilan sehingga halaman tidak dapat
            dilanjutkan. Kendala IT Anda tetap dapat dilaporkan.
          </p>

          <div className="galat-batas-aksi">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Muat Ulang Halaman
            </button>

            {nomor && (
              <a
                className="btn btn-ghost"
                href={`https://wa.me/${nomor}?text=${pesanWa}`}
                target="_blank"
                rel="noreferrer"
              >
                Hubungi Engineer IT
              </a>
            )}
          </div>

          <p className="galat-batas-teknis">
            Bila gangguan berulang, sampaikan keterangan ini kepada Fungsi IT:
            <code>{String(this.state.galat?.message || this.state.galat)}</code>
          </p>
        </div>
      </div>
    );
  }
}
