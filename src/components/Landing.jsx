import React, { useEffect, useState } from 'react';
import { DivisionIcon, IconCctv, IconArrowRight, IconMenu, IconClose, IconHeadset } from './Icons.jsx';
import { LAYANAN_OTOMATIS } from '../data/layananOtomatis.js';

// Tiga tautan pertama menggulir di halaman ini; 'Cek Status' berpindah halaman.
// Perlu ada di sini karena pelapor yang sudah menutup percakapannya tidak punya
// jalan lain menuju /tiket selain mengetik alamatnya sendiri.
const NAV_LINKS = [
  { href: '#layanan', label: 'Layanan' },
  { href: '#cara-kerja', label: 'Cara Kerja' },
  { href: '#dukungan', label: 'Bantuan' },
  { href: '/tiket', label: 'Cek Status' }
];

// Keterangan langkah harus sesuai alur yang sebenarnya. Sebelumnya langkah 01
// menyuruh mengisi data pelapor lebih dulu, padahal formulir itu justru muncul
// di akhir — hanya bila kendalanya perlu diteruskan ke engineer.
const STEPS = [
  {
    no: '01',
    tone: 'blue',
    title: 'Pilih Layanan',
    desc: 'Pilih divisi layanan IT yang sedang mengalami kendala. Tidak perlu mengisi data apa pun terlebih dahulu.'
  },
  {
    no: '02',
    tone: 'green',
    title: 'Sampaikan Kendala',
    desc: 'Uraikan keluhan Anda dengan bahasa sehari-hari. Keluhan dicocokkan dengan dokumen SOP Field Lirik, sehingga langkah yang diberikan selalu bersumber dari prosedur resmi.'
  },
  {
    no: '03',
    tone: 'red',
    title: 'Terima Solusi atau Eskalasi',
    desc: 'Ikuti langkah penanganan yang diberikan. Bila belum tuntas, barulah data pelapor diminta dan laporan diteruskan ke engineer terkait melalui WhatsApp.'
  }
];

const PREVIEW = [
  { role: 'user', text: 'Printer di ruang admin menyala, tetapi hasil cetaknya bergaris.' },
  { role: 'ai', text: 'Kemungkinan head printer kotor atau tinta menipis. Silakan coba tiga langkah berikut.' }
];

export default function Landing({ divisions = [], onStart, onPickDivision }) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Laci mengalir bersama halaman, sehingga saat digulir ia hilang di balik
  // navbar yang sticky dan menyisakan menu "terbuka" yang tak terlihat.
  // Menutupnya begitu pengguna menggulir membuat keadaan tetap jujur.
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('scroll', close, { passive: true, once: true });
    return () => window.removeEventListener('scroll', close);
  }, [menuOpen]);

  return (
    <div className="landing" id="landing">
      {/* ── Navigasi ───────────────────────────────── */}
      <nav className="lp-nav">
        <a className="lp-brand" href="#landing" aria-label="SIGAP — Layanan IT Pertamina EP Field Lirik">
          <img
            src="/logo-sigap.png"
            alt="SATU-IT SIGAP"
            className="lp-brand-logo-unit"
          />
          <span className="lp-brand-divider" aria-hidden="true" />
          <span className="lp-brand-text">
            <strong>SIGAP</strong>
            <small>LAYANAN IT · FIELD LIRIK</small>
          </span>
        </a>

        <div className="lp-nav-links">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href}>{l.label}</a>
          ))}
        </div>

        <button className="btn btn-primary btn-sm lp-nav-cta" onClick={onStart} id="nav-start-btn">
          Mulai Pengaduan
        </button>

        <button
          className="lp-nav-toggle"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}
          aria-expanded={menuOpen}
          id="nav-toggle"
        >
          {menuOpen ? <IconClose size={20} /> : <IconMenu size={20} />}
        </button>
      </nav>

      {menuOpen && (
        <div className="lp-nav-drawer" id="nav-drawer">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}>{l.label}</a>
          ))}
          <button
            className="btn btn-primary"
            onClick={() => { setMenuOpen(false); onStart(); }}
          >
            Mulai Chat
          </button>
        </div>
      )}

      {/* ── Hero ───────────────────────────────────── */}
      <header className="lp-hero">
        <div className="lp-hero-copy">
          <span className="lp-badge">
            <i className="lp-badge-dot" />
            Siap Melayani Sepenuh Hati
          </span>

          <h1 className="lp-title">
            Penanganan Kendala IT
            <br />
            <span className="accent-text">yang Sigap dan Tepat.</span>
          </h1>

          <p className="lp-sub">
            SIGAP membantu seluruh pekerja Pertamina EP Asset 1 Regional 1 Field
            Lirik menyelesaikan kendala layanan IT. Sampaikan keluhan Anda, ikuti
            panduan penanganan bertahap, dan bila diperlukan, laporan diteruskan
            langsung kepada engineer terkait.
          </p>

          <div className="lp-cta-row">
            <button className="btn btn-primary" onClick={onStart} id="hero-start-btn">
              Mulai Pengaduan
              <span className="btn-arrow"><IconArrowRight size={17} /></span>
            </button>
            <a className="btn btn-ghost" href="#cara-kerja">Lihat Cara Kerja</a>
          </div>

          <p className="lp-note">
            Tanpa instalasi · Data laporan tercatat · Terhubung ke engineer melalui WhatsApp
          </p>
        </div>

        {/* Pratinjau percakapan */}
        <div className="lp-hero-visual" aria-hidden="true">
          <div className="lp-preview">
            <div className="lp-preview-top">
              <span className="lp-preview-avatar">SG</span>
              <div>
                <div className="lp-preview-name">SIGAP</div>
                <div className="lp-preview-status">
                  <i className="dot-live" /> siap membantu Anda
                </div>
              </div>
            </div>

            <div className="lp-preview-body">
              {PREVIEW.map((m, i) => (
                <div key={i} className={`lp-bubble ${m.role}`}>{m.text}</div>
              ))}
              <div className="lp-bubble ai typing">
                <span /><span /><span />
              </div>
            </div>
          </div>

          {/* Contoh "selesai mandiri" harus memakai divisi yang memang dipandu
              sistem. LAN kini langsung diteruskan ke engineer, sehingga tidak
              pernah berakhir "selesai" di dalam aplikasi. */}
          <div className="lp-chip chip-a">
            <span className="chip-ico"><DivisionIcon id="printer" size={19} /></span>
            <div>
              <b>Printer Ruang Admin</b>
              <em>selesai · 3 langkah</em>
            </div>
          </div>

          <div className="lp-chip chip-b">
            <span className="chip-ico"><IconCctv size={19} /></span>
            <div>
              <b>CCTV Gate 2</b>
              <em>diteruskan ke engineer</em>
            </div>
          </div>
        </div>
      </header>

      {/* ── Statistik ──────────────────────────────── */}
      <section className="lp-stats" aria-label="Ringkasan layanan">
        <div className="lp-stat">
          <strong>8</strong>
          <span>Divisi layanan IT</span>
        </div>
        <div className="lp-stat">
          <strong>3</strong>
          <span>Area operasi Field Lirik</span>
        </div>
        <div className="lp-stat">
          <strong>24<i>jam</i></strong>
          <span>Layanan setiap hari</span>
        </div>
        <div className="lp-stat">
          <strong>1<i>klik</i></strong>
          <span>Terhubung ke engineer</span>
        </div>
      </section>

      {/* ── Divisi layanan ─────────────────────────── */}
      <section className="lp-section" id="layanan">
        <div className="lp-section-head">
          <span className="lp-eyebrow">LAYANAN</span>
          <h2 className="lp-h2">
            Delapan divisi IT, <span className="accent-text">satu kanal layanan.</span>
          </h2>
          <p className="lp-section-sub">
            Pilih kategori yang paling sesuai dengan kendala Anda. Layanan bertanda
            <span className="lp-tag-inline">Langsung ke engineer</span> memerlukan
            pemeriksaan di lokasi, sehingga laporannya langsung diteruskan tanpa
            langkah mandiri.
          </p>
        </div>

        <div className="lp-service-grid">
          {divisions.map((d) => (
            <button
              key={d.id}
              className="lp-service"
              onClick={() => onPickDivision(d)}
              id={`lp-service-${d.id}`}
            >
              <span className="lp-service-ico"><DivisionIcon id={d.id} size={21} /></span>
              <span className="lp-service-name">{d.name}</span>
              <span className="lp-service-desc">{d.description}</span>
              {/* Menandai lebih awal jauh lebih baik daripada membiarkan
                  pengguna menunggu langkah perbaikan yang tidak akan datang. */}
              {d.mode === 'engineer' && (
                <span className="lp-service-tag">Langsung ke engineer</span>
              )}
              <span className="lp-service-go"><IconArrowRight size={17} /></span>
            </button>
          ))}

          {/* Jalan keluar bagi yang tidak tahu kendalanya masuk layanan mana.
              Menebak sendiri berisiko: laporan sampai ke engineer yang salah. */}
          <button
            className="lp-service lp-service-auto"
            onClick={() => onPickDivision(LAYANAN_OTOMATIS)}
            id="lp-service-auto"
          >
            <span className="lp-service-ico"><IconHeadset size={21} /></span>
            <span className="lp-service-name">{LAYANAN_OTOMATIS.name}</span>
            <span className="lp-service-desc">{LAYANAN_OTOMATIS.description}</span>
            <span className="lp-service-go"><IconArrowRight size={17} /></span>
          </button>
        </div>
      </section>

      {/* ── Cara kerja ─────────────────────────────── */}
      <section className="lp-section lp-section-alt" id="cara-kerja">
        <div className="lp-section-head">
          <span className="lp-eyebrow">CARA KERJA</span>
          <h2 className="lp-h2">
            Dari keluhan ke solusi, <span className="accent-text">dalam tiga langkah.</span>
          </h2>
        </div>

        <div className="lp-steps">
          <div className="lp-steps-rail" aria-hidden="true" />
          {STEPS.map((s) => (
            <article className={`lp-step tone-${s.tone}`} key={s.no}>
              <span className="lp-step-no">{s.no}</span>
              <h3 className="lp-step-title">{s.title}</h3>
              <p className="lp-step-desc">{s.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────── */}
      <section className="lp-cta" id="dukungan">
        <div className="lp-cta-inner">
          <div>
            <h2 className="lp-cta-title">Sedang mengalami kendala IT?</h2>
            <p className="lp-cta-sub">
              Sampaikan sekarang. Engineer kami siap membantu apabila diperlukan
              penanganan lebih lanjut.
            </p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={onStart} id="cta-start-btn">
            Mulai Pengaduan
            <span className="btn-arrow"><IconArrowRight size={17} /></span>
          </button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-footer-rule" aria-hidden="true" />
        <div className="lp-footer-text">
          <p>SIGAP · PT PERTAMINA EP ASSET 1 REGIONAL 1 FIELD LIRIK</p>
          <p>Fungsi IT · Untuk penggunaan internal perusahaan</p>
        </div>
      </footer>
    </div>
  );
}
