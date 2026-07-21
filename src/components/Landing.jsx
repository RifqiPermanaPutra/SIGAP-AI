import React, { useEffect, useState } from 'react';
import { DivisionIcon, IconLan, IconCctv, IconArrowRight, IconMenu, IconClose } from './Icons.jsx';

const NAV_LINKS = [
  { href: '#layanan', label: 'Layanan' },
  { href: '#cara-kerja', label: 'Cara Kerja' },
  { href: '#dukungan', label: 'Dukungan' }
];

const STEPS = [
  {
    no: '01',
    tone: 'blue',
    title: 'Pilih Divisi',
    desc: 'Tentukan layanan ICT yang bermasalah — printer, jaringan, CCTV, radio, dan lainnya.'
  },
  {
    no: '02',
    tone: 'green',
    title: 'Ceritakan Kendala',
    desc: 'Tulis gejalanya dengan bahasa sehari-hari. AI membaca konteks dan basis pengetahuan internal.'
  },
  {
    no: '03',
    tone: 'red',
    title: 'Terapkan Solusi',
    desc: 'Dapat langkah perbaikan runut. Belum tuntas? Eskalasi ke engineer lewat WhatsApp.'
  }
];

const PREVIEW = [
  { role: 'user', text: 'Printer di ruang admin nyala tapi hasil cetaknya bergaris.' },
  { role: 'ai', text: 'Indikasi head printer kotor atau cartridge menipis. Coba tiga langkah ini dulu…' }
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
        <a className="lp-brand" href="#landing" aria-label="AI Helpdesk ICT Pertamina EP">
          <img
            src="/logo-pertamina-ep.svg"
            alt="Pertamina EP"
            className="lp-brand-logo"
          />
          <span className="lp-brand-divider" aria-hidden="true" />
          <span className="lp-brand-text">
            <strong>Helpdesk ICT</strong>
            <small>FIELD LIRIK</small>
          </span>
        </a>

        <div className="lp-nav-links">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href}>{l.label}</a>
          ))}
        </div>

        <button className="btn btn-primary btn-sm lp-nav-cta" onClick={onStart} id="nav-start-btn">
          Mulai Chat
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
            Asisten AI · Aktif 24 jam
          </span>

          <h1 className="lp-title">
            Kendala ICT beres
            <br />
            <span className="accent-text">tanpa antre tiket.</span>
          </h1>

          <p className="lp-sub">
            Asisten berbasis AI untuk seluruh pekerja Pertamina EP Asset 1 Regional 1
            Field Lirik. Jelaskan masalahnya, dapatkan panduan teknis bertahap, dan
            eskalasi ke engineer hanya bila benar-benar perlu.
          </p>

          <div className="lp-cta-row">
            <button className="btn btn-primary" onClick={onStart} id="hero-start-btn">
              Mulai Percakapan
              <span className="btn-arrow"><IconArrowRight size={17} /></span>
            </button>
            <a className="btn btn-ghost" href="#cara-kerja">Lihat Cara Kerja</a>
          </div>

          <p className="lp-note">
            Tanpa instalasi · Riwayat percakapan tersimpan · Eskalasi WhatsApp sekali klik
          </p>
        </div>

        {/* Pratinjau percakapan */}
        <div className="lp-hero-visual" aria-hidden="true">
          <div className="lp-preview">
            <div className="lp-preview-top">
              <span className="lp-preview-avatar">AI</span>
              <div>
                <div className="lp-preview-name">AI Helpdesk ICT</div>
                <div className="lp-preview-status">
                  <i className="dot-live" /> membalas dalam hitungan detik
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

          <div className="lp-chip chip-a">
            <span className="chip-ico"><IconLan size={19} /></span>
            <div>
              <b>LAN Gedung B</b>
              <em>terselesaikan · 4 langkah</em>
            </div>
          </div>

          <div className="lp-chip chip-b">
            <span className="chip-ico"><IconCctv size={19} /></span>
            <div>
              <b>CCTV Gate 2</b>
              <em>dieskalasi ke engineer</em>
            </div>
          </div>
        </div>
      </header>

      {/* ── Statistik ──────────────────────────────── */}
      <section className="lp-stats" aria-label="Ringkasan layanan">
        <div className="lp-stat">
          <strong>8</strong>
          <span>Divisi layanan ICT</span>
        </div>
        <div className="lp-stat">
          <strong>24/7</strong>
          <span>Selalu siap merespons</span>
        </div>
        <div className="lp-stat">
          <strong>&lt; 5<i>dtk</i></strong>
          <span>Rata-rata waktu jawab</span>
        </div>
        <div className="lp-stat">
          <strong>1<i>klik</i></strong>
          <span>Eskalasi ke engineer</span>
        </div>
      </section>

      {/* ── Divisi layanan ─────────────────────────── */}
      <section className="lp-section" id="layanan">
        <div className="lp-section-head">
          <span className="lp-eyebrow">LAYANAN</span>
          <h2 className="lp-h2">
            Delapan divisi, <span className="accent-text">satu pintu masuk.</span>
          </h2>
          <p className="lp-section-sub">
            Pilih kategori yang paling mendekati kendalamu — percakapan langsung
            diarahkan ke basis pengetahuan divisi tersebut.
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
              <span className="lp-service-go"><IconArrowRight size={17} /></span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Cara kerja ─────────────────────────────── */}
      <section className="lp-section lp-section-alt" id="cara-kerja">
        <div className="lp-section-head">
          <span className="lp-eyebrow">CARA KERJA</span>
          <h2 className="lp-h2">
            Dari keluhan ke solusi, <span className="accent-text">tiga langkah.</span>
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
            <h2 className="lp-cta-title">Ada kendala ICT sekarang?</h2>
            <p className="lp-cta-sub">
              Mulai percakapan — engineer tetap siaga bila AI belum menemukan solusinya.
            </p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={onStart} id="cta-start-btn">
            Mulai Percakapan
            <span className="btn-arrow"><IconArrowRight size={17} /></span>
          </button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-footer-rule" aria-hidden="true" />
        <div className="lp-footer-text">
          <p>AI HELPDESK ICT · PT PERTAMINA EP ASSET 1 REGIONAL 1 FIELD LIRIK</p>
          <p>Fungsi ICT · Untuk penggunaan internal perusahaan</p>
        </div>
      </footer>
    </div>
  );
}
