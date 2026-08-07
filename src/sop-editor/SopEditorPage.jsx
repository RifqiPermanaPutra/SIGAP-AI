import React, { useState, useEffect, useCallback } from 'react';
import {
  DivisionIcon, IconLogout, IconCheck, IconAlert, IconChart,
  IconPlus, IconClose, IconChevronDown
} from '../components/Icons.jsx';
import Masuk from '../components/Masuk.jsx';
import './sop-editor.css';

/**
 * Penyunting SOP lewat peramban.
 *
 * Alasan halaman ini ada: mengubah satu langkah SOP sebelumnya menuntut
 * menyunting Markdown, menjalankan `npm run build:kb`, `npm run build`, lalu
 * menyalakan ulang server. Engineer ICT tidak akan melakukan itu — dan SOP
 * yang tidak pernah diperbarui akan terus memberi langkah yang tidak lagi
 * cocok, disampaikan dengan percaya diri.
 *
 * Berkas Markdown tetap menjadi sumber kebenaran. Halaman ini hanya menulis
 * ulang berkas yang sama lewat API, yang kemudian membangun ulang basis
 * pengetahuan dan memuatnya ke memori.
 */

const API = '/api';

const MAKS_SOLUSI = 3;

/* ────────────────────────────────────────────────────────────────
   Bantuan kecil
   ──────────────────────────────────────────────────────────────── */

const salin = (nilai) => JSON.parse(JSON.stringify(nilai));

/** Daftar baris teks: satu baris per butir, kosong dibuang saat disimpan */
function DaftarBaris({ label, keterangan, nilai, onUbah, teksTambah, penanda = 'butir' }) {
  const ubahBaris = (i, teks) => onUbah(nilai.map((b, n) => (n === i ? teks : b)));
  const hapus = (i) => onUbah(nilai.filter((_, n) => n !== i));
  const tambah = () => onUbah([...nilai, '']);

  return (
    <div className="se-blok">
      <label className="se-label">{label}</label>
      {keterangan && <p className="se-ket">{keterangan}</p>}

      <ul className="se-daftar">
        {nilai.map((baris, i) => (
          <li key={i}>
            <span className="se-nomor" aria-hidden="true">
              {penanda === 'nomor' ? `${i + 1}.` : '•'}
            </span>
            <textarea
              rows={Math.max(1, Math.ceil((baris.length || 1) / 60))}
              value={baris}
              onChange={(e) => ubahBaris(i, e.target.value)}
            />
            <button type="button" className="se-hapus" title="Hapus baris"
                    onClick={() => hapus(i)}>
              <IconClose size={14} />
            </button>
          </li>
        ))}
      </ul>

      <button type="button" className="se-tombol-samar se-kecil" onClick={tambah}>
        <IconPlus size={14} /> {teksTambah}
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Satu solusi
   ──────────────────────────────────────────────────────────────── */

const URUTAN = ['Solusi Pertama', 'Solusi Kedua', 'Solusi Ketiga'];

function Solusi({ indeks, nilai, onUbah, onHapus }) {
  const set = (bidang, isi) => onUbah({ ...nilai, [bidang]: isi });

  return (
    <section className="se-solusi">
      <header className="se-solusi-kepala">
        <h3>{URUTAN[indeks] || `Solusi ke-${indeks + 1}`}</h3>
        <button type="button" className="se-hapus" title="Hapus solusi ini" onClick={onHapus}>
          <IconClose size={15} />
        </button>
      </header>

      <div className="se-blok">
        <label className="se-label" htmlFor={`se-judul-${indeks}`}>Nama solusi</label>
        {/* Awalan "Solusi Pertama:" ditambahkan server menurut urutannya.
            Pengurai basis pengetahuan mensyaratkan awalan itu persis, dan satu
            salah ketik membuat seluruh langkahnya hilang tanpa pesan galat. */}
        <p className="se-ket">
          Ditulis tanpa awalan. Server menyusunnya menjadi
          “{URUTAN[indeks]}: {nilai.judul || '…'}”.
        </p>
        <input
          id={`se-judul-${indeks}`}
          value={nilai.judul}
          placeholder="Nyalakan Ulang Printer dan Matikan Mode Offline"
          onChange={(e) => set('judul', e.target.value)}
        />
      </div>

      <div className="se-blok">
        <label className="se-label" htmlFor={`se-pengantar-${indeks}`}>
          Kalimat pengantar <small>(boleh dikosongkan)</small>
        </label>
        <p className="se-ket">Kapan solusi ini dipakai, dan mengapa.</p>
        <textarea
          id={`se-pengantar-${indeks}`}
          rows="2"
          value={nilai.pengantar || ''}
          placeholder="Dipakai bila printer tetap tertulis Offline."
          onChange={(e) => set('pengantar', e.target.value)}
        />
      </div>

      <DaftarBaris
        label="Langkah"
        keterangan="Satu langkah per baris, ditulis rinci untuk pengguna yang tidak memahami istilah teknologi."
        penanda="nomor"
        nilai={nilai.langkah}
        teksTambah="Tambah langkah"
        onUbah={(langkah) => set('langkah', langkah)}
      />
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   Alat uji keluhan
   ──────────────────────────────────────────────────────────────── */

/**
 * Mengetik contoh keluhan lalu melihat skor pencocokannya.
 *
 * Tanpa alat ini, SOP baru yang skornya tidak pernah menembus ambang 0,4 baru
 * ketahuan berbulan-bulan kemudian lewat daftar "keluhan yang belum dikenali"
 * di halaman rekap — bila ada yang membacanya.
 */
function UjiKeluhan({ divisi, ambang }) {
  const [keluhan, setKeluhan] = useState('');
  const [hasil, setHasil] = useState(null);
  const [sibuk, setSibuk] = useState(false);

  const jalankan = async () => {
    if (!keluhan.trim()) return;
    setSibuk(true);
    try {
      const r = await fetch(`${API}/sop/uji`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keluhan, divisi })
      });
      setHasil(await r.json());
    } catch {
      setHasil({ success: false, error: 'Tidak dapat terhubung ke server.' });
    } finally {
      setSibuk(false);
    }
  };

  return (
    <section className="se-panel se-uji">
      <h2>Uji keluhan ini</h2>
      <p className="se-ket">
        Ketik contoh keluhan seperti yang biasa ditulis pekerja. Pencocokan diuji
        terhadap SOP yang <strong>sedang aktif</strong> — jalankan lagi setelah
        menyimpan untuk melihat pengaruh suntingan Anda.
      </p>

      <div className="se-uji-baris">
        <input
          value={keluhan}
          placeholder="printernya offline terus"
          onChange={(e) => setKeluhan(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') jalankan(); }}
        />
        <button type="button" className="se-tombol-utama" disabled={sibuk || !keluhan.trim()}
                onClick={jalankan}>
          {sibuk ? 'Menguji…' : 'Uji'}
        </button>
      </div>

      {hasil && hasil.success && (
        <div className={`se-uji-hasil ${hasil.dijawab ? 'cocok' : 'meleset'}`}>
          <div className="se-uji-skor">
            <strong>{hasil.skor.toFixed(3)}</strong>
            <span>ambang {ambang}</span>
          </div>
          <div>
            {hasil.dijawab ? (
              <>
                <p className="se-uji-vonis">Dijawab otomatis</p>
                <p className="se-ket">Masalah: <strong>{hasil.masalah?.judul}</strong></p>
              </>
            ) : (
              <>
                <p className="se-uji-vonis">Belum dijawab — diteruskan ke engineer</p>
                <p className="se-ket">
                  {hasil.masalah
                    ? <>Paling mendekati: <strong>{hasil.masalah.judul}</strong>. Tambahkan
                       kata khas dari keluhan ini ke bagian gejala atau penyebab.</>
                    : 'Tidak ada masalah yang mendekati sama sekali.'}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {hasil && !hasil.success && <p className="se-galat">{hasil.error}</p>}
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   Pratinjau
   ──────────────────────────────────────────────────────────────── */

function Pratinjau({ data, onTutup, onSimpan, menyimpan }) {
  return (
    <div className="se-dialog-latar" onClick={onTutup}>
      <div className="se-dialog" role="dialog" aria-modal="true" aria-label="Pratinjau sebelum simpan"
           onClick={(e) => e.stopPropagation()}>
        <h3>Pratinjau sebelum simpan</h3>
        <p className="se-ket">
          Beginilah SOP ini akan terbaca sistem. Yang menentukan apakah SOP ini
          pernah ditemukan pengguna bukan bentuk formulirnya, melainkan hasil
          urai di bawah.
        </p>

        <div className="se-pratinjau-kisi">
          <div>
            <span>Kategori</span>
            <strong>{data.hasil.kategori}</strong>
          </div>
          <div>
            <span>Penyebab terbaca</span>
            <strong>{data.hasil.penyebab.length}</strong>
          </div>
          <div>
            <span>Solusi terbaca</span>
            <strong className={data.hasil.kategori === 'ringan' && data.hasil.solusi.length < MAKS_SOLUSI
              ? 'se-kurang' : ''}>
              {data.hasil.solusi.length} dari {MAKS_SOLUSI}
            </strong>
          </div>
          <div>
            <span>Kata kunci terkumpul</span>
            <strong>{data.hasil.kataKunci.length}</strong>
          </div>
        </div>

        {data.hasil.kategori === 'ringan' && data.hasil.solusi.length < MAKS_SOLUSI && (
          <p className="se-peringatan">
            <IconAlert size={15} /> Antarmuka menjanjikan tiga solusi sebelum
            menyerah ke engineer. Dengan {data.hasil.solusi.length} solusi, sistem
            akan menyerah lebih cepat daripada yang dijanjikan kepada pengguna.
          </p>
        )}

        {data.hasil.solusi.length > 0 && (
          <ol className="se-pratinjau-solusi">
            {data.hasil.solusi.map((s) => (
              <li key={s.judul}>{s.judul} <em>— {s.langkah} langkah</em></li>
            ))}
          </ol>
        )}

        <details className="se-pratinjau-kunci">
          <summary>Kata kunci yang akan dipakai mencocokkan ({data.hasil.kataKunci.length})</summary>
          <p className="se-kunci">{data.hasil.kataKunci.join(' · ')}</p>
        </details>

        <details className="se-pratinjau-md">
          <summary>Markdown yang akan ditulis ke berkas</summary>
          <pre>{data.markdown}</pre>
        </details>

        <div className="se-dialog-aksi">
          <button type="button" className="se-tombol-samar" onClick={onTutup}>Kembali menyunting</button>
          <button type="button" className="se-tombol-utama" disabled={menyimpan} onClick={onSimpan}>
            <IconCheck size={16} /> {menyimpan ? 'Menyimpan…' : 'Simpan & bangun ulang'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Halaman utama
   ──────────────────────────────────────────────────────────────── */

export default function SopEditorPage() {
  const [pengguna, setPengguna] = useState(undefined);
  const [divisi, setDivisi] = useState('printer');
  const [daftarDivisi, setDaftarDivisi] = useState([]);
  const [sop, setSop] = useState(null);
  const [terpilih, setTerpilih] = useState(null);
  const [draf, setDraf] = useState(null);
  const [galat, setGalat] = useState('');
  const [kabar, setKabar] = useState('');
  const [pratinjau, setPratinjau] = useState(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [memuat, setMemuat] = useState(false);

  useEffect(() => {
    fetch(`${API}/auth/saya`)
      .then((r) => r.json())
      .then((d) => setPengguna(d.pengguna))
      .catch(() => setPengguna(null));
  }, []);

  useEffect(() => {
    if (!pengguna) return;
    fetch(`${API}/sop`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setDaftarDivisi(d.divisi); })
      .catch(() => { /* daftar divisi bukan syarat menyunting */ });
  }, [pengguna]);

  const ambilSop = useCallback(async () => {
    setMemuat(true);
    setGalat('');
    try {
      const r = await fetch(`${API}/sop/${divisi}`);
      if (r.status === 401) { setPengguna(null); return; }
      if (r.status === 403) { setGalat('Penyunting SOP hanya untuk akun admin.'); setSop(null); return; }

      const d = await r.json();
      if (d.success) {
        setSop(d);
        setTerpilih(null);
        setDraf(null);
      } else {
        setGalat(d.error || 'Gagal memuat SOP');
      }
    } catch {
      setGalat('Tidak dapat terhubung ke server.');
    } finally {
      setMemuat(false);
    }
  }, [divisi]);

  useEffect(() => { if (pengguna) ambilSop(); }, [pengguna, ambilSop]);

  const keluar = async () => {
    await fetch(`${API}/auth/keluar`, { method: 'POST' });
    setPengguna(null);
    setSop(null);
  };

  const pilihMasalah = (masalah) => {
    if (terpilih === masalah.id) { setTerpilih(null); setDraf(null); return; }
    setTerpilih(masalah.id);
    setDraf(salin(masalah));
    setKabar('');
    setGalat('');
  };

  const setBidang = (bidang, isi) => setDraf((d) => ({ ...d, [bidang]: isi }));

  const setSolusi = (i, isi) =>
    setDraf((d) => ({ ...d, solusi: d.solusi.map((s, n) => (n === i ? isi : s)) }));

  const hapusSolusi = (i) =>
    setDraf((d) => ({ ...d, solusi: d.solusi.filter((_, n) => n !== i) }));

  const tambahSolusi = () =>
    setDraf((d) => ({ ...d, solusi: [...d.solusi, { judul: '', pengantar: '', langkah: [''] }] }));

  /** Buang baris kosong sebelum dikirim — baris kosong bukan langkah */
  const bersihkan = (d) => ({
    ...d,
    penyebab: d.penyebab.map((p) => p.trim()).filter(Boolean),
    solusi: d.solusi.map((s) => ({
      judul: s.judul.trim(),
      pengantar: (s.pengantar || '').trim(),
      langkah: s.langkah.map((l) => l.trim()).filter(Boolean)
    }))
  });

  const bukaPratinjau = async () => {
    setGalat('');
    try {
      const r = await fetch(`${API}/sop/${divisi}/${terpilih}/pratinjau`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bersihkan(draf))
      });
      const d = await r.json();
      if (d.success) setPratinjau(d);
      else setGalat(d.galat ? d.galat.join(' · ') : d.error);
    } catch {
      setGalat('Tidak dapat terhubung ke server.');
    }
  };

  const simpan = async () => {
    setMenyimpan(true);
    setGalat('');
    try {
      const r = await fetch(`${API}/sop/${divisi}/${terpilih}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bersihkan(draf))
      });
      const d = await r.json();
      if (d.success) {
        setPratinjau(null);
        setKabar(d.message);
        await ambilSop();
      } else {
        setGalat(d.galat ? d.galat.join(' · ') : d.error);
      }
    } catch {
      setGalat('Tidak dapat terhubung ke server.');
    } finally {
      setMenyimpan(false);
    }
  };

  if (pengguna === undefined) return <div className="se-tunggu">Memuat…</div>;

  if (pengguna === null) {
    return (
      <Masuk
        judul="Penyunting SOP"
        sub="PENYUNTING SOP · FIELD LIRIK"
        label="KHUSUS ADMIN"
        kaki={<>Halaman laporan ada di <a href="/rekap">/rekap</a>, pengaduan di <a href="/">halaman utama</a>.</>}
        onBerhasil={setPengguna}
      />
    );
  }

  if (pengguna.peran !== 'admin') {
    return (
      <div className="se-halaman">
        <div className="se-tolak">
          <IconAlert size={28} />
          <h1>Khusus admin</h1>
          <p>
            Akun <strong>{pengguna.nama}</strong> berperan <em>{pengguna.peran}</em>.
            Menyunting SOP mengubah langkah yang diterima seluruh pekerja, sehingga
            dibatasi pada akun admin.
          </p>
          <p><a href="/rekap">Buka laporan rekap</a></p>
        </div>
      </div>
    );
  }

  return (
    <div className="se-halaman">
      <header className="se-navbar">
        <div className="se-merek">
          <img src="/logo-pertamina-ep.svg" alt="Pertamina EP" className="se-merek-logo" />
          <span className="se-merek-garis" aria-hidden="true" />
          <span className="se-merek-teks">
            <strong>SIGAP</strong>
            <small>PENYUNTING SOP</small>
          </span>
        </div>
        <div className="se-navbar-kanan">
          <a className="se-tombol-navbar" href="/rekap"><IconChart size={15} /> Rekap</a>
          <button className="se-tombol-navbar" onClick={keluar}>
            <IconLogout size={15} /> Keluar
          </button>
        </div>
      </header>

      <div className="se">
        <div className="se-judul">
          <h1>Penyunting SOP</h1>
          <p className="se-ket">
            Berkas Markdown di <code>knowledge-base/</code> tetap menjadi sumber
            kebenaran. Setelah disimpan, basis pengetahuan dibangun ulang dan
            dimuat ulang sendiri — server tidak perlu dijalankan ulang.
          </p>
        </div>

        {/* ── Pemilih divisi ── */}
        <nav className="se-divisi" aria-label="Pilih layanan">
          {daftarDivisi.map((d) => (
            <button
              key={d.id}
              className={divisi === d.id ? 'aktif' : ''}
              onClick={() => setDivisi(d.id)}
              title={d.disajikan
                ? 'Isinya disajikan langsung kepada pengguna'
                : 'Mode engineer — isinya tidak disajikan kepada pengguna'}
            >
              <DivisionIcon id={d.id} size={15} />
              {d.nama}
              <span className="se-jumlah">{d.jumlahMasalah}</span>
              {d.disajikan && <span className="se-titik" title="Disajikan ke pengguna" />}
            </button>
          ))}
        </nav>

        {galat && <p className="se-galat" role="alert">{galat}</p>}
        {kabar && <p className="se-kabar" role="status"><IconCheck size={15} /> {kabar}</p>}
        {memuat && <p className="se-ket">Memuat SOP…</p>}

        {sop && (
          <>
            <p className="se-berkas">
              Sumber: <code>{sop.berkas}</code> · {sop.masalah.length} masalah
              {sop.cadangan?.length > 0 && ` · ${sop.cadangan.length} cadangan tersimpan`}
            </p>

            {/* ── Daftar masalah ── */}
            <div className="se-daftar-masalah">
              {sop.masalah.map((m) => (
                <article key={m.id} className={`se-masalah ${terpilih === m.id ? 'terbuka' : ''}`}>
                  <button type="button" className="se-masalah-kepala" onClick={() => pilihMasalah(m)}>
                    <span className={`se-lencana ${m.kategori}`}>{m.kategori}</span>
                    <span className="se-masalah-judul">{m.judul}</span>
                    <span className={`se-hitung ${m.kategori === 'ringan' && m.solusi.length < MAKS_SOLUSI ? 'kurang' : ''}`}>
                      {m.kategori === 'berat' ? 'penanganan' : `${m.solusi.length}/${MAKS_SOLUSI} solusi`}
                    </span>
                    <IconChevronDown size={16} />
                  </button>

                  {terpilih === m.id && draf && (
                    <div className="se-formulir">
                      {/* Judul menentukan id masalah, dan id yang berubah memutus
                          rujukan pada laporan rekap. Karena itu baca-saja. */}
                      <div className="se-blok">
                        <label className="se-label">Judul masalah</label>
                        <p className="se-ket">
                          Tidak dapat diubah dari sini: judul menentukan id masalah,
                          dan id yang berubah memutus rujukan pada laporan rekap.
                        </p>
                        <input value={draf.judul} readOnly className="se-baca-saja" />
                      </div>

                      <div className="se-blok">
                        <label className="se-label" htmlFor="se-kategori">Kategori</label>
                        <p className="se-ket">
                          <strong>Ringan</strong> dipandu langkah SOP lebih dulu.
                          <strong> Berat</strong> langsung diteruskan ke engineer.
                        </p>
                        <select id="se-kategori" value={draf.kategori}
                                onChange={(e) => setBidang('kategori', e.target.value)}>
                          <option value="ringan">Ringan — dipandu SOP</option>
                          <option value="berat">Berat — langsung ke engineer</option>
                        </select>
                      </div>

                      <div className="se-blok">
                        <label className="se-label" htmlFor="se-gejala">Gejala yang dirasakan pengguna</label>
                        <p className="se-ket">
                          Ditulis dengan kata-kata yang benar-benar dipakai pekerja.
                          Bagian inilah yang paling menentukan apakah keluhan dikenali.
                        </p>
                        <textarea id="se-gejala" rows="3" value={draf.gejala}
                                  onChange={(e) => setBidang('gejala', e.target.value)} />
                      </div>

                      <DaftarBaris
                        label="Penyebab yang mungkin terjadi"
                        nilai={draf.penyebab}
                        teksTambah="Tambah penyebab"
                        onUbah={(p) => setBidang('penyebab', p)}
                      />

                      {draf.kategori === 'berat' ? (
                        <div className="se-blok">
                          <label className="se-label" htmlFor="se-penanganan">Penanganan</label>
                          <p className="se-ket">
                            Keterangan yang ditampilkan kepada pengguna sebelum diteruskan
                            ke engineer. Sertakan tindakan pengamanan bila ada.
                          </p>
                          <textarea id="se-penanganan" rows="4" value={draf.penanganan || ''}
                                    onChange={(e) => setBidang('penanganan', e.target.value)} />
                        </div>
                      ) : (
                        <>
                          {draf.solusi.map((s, i) => (
                            <Solusi key={i} indeks={i} nilai={s}
                                    onUbah={(baru) => setSolusi(i, baru)}
                                    onHapus={() => hapusSolusi(i)} />
                          ))}

                          {draf.solusi.length < MAKS_SOLUSI && (
                            <button type="button" className="se-tombol-samar" onClick={tambahSolusi}>
                              <IconPlus size={15} /> Tambah solusi ({draf.solusi.length}/{MAKS_SOLUSI})
                            </button>
                          )}

                          {draf.solusi.length < MAKS_SOLUSI && (
                            <p className="se-peringatan">
                              <IconAlert size={15} /> Antarmuka menjanjikan tiga solusi
                              sebelum menyerah ke engineer.
                            </p>
                          )}
                        </>
                      )}

                      <div className="se-aksi">
                        <button type="button" className="se-tombol-samar"
                                onClick={() => pilihMasalah(m)}>
                          Batal
                        </button>
                        <button type="button" className="se-tombol-utama" onClick={bukaPratinjau}>
                          Pratinjau & simpan
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>

            <UjiKeluhan divisi={divisi} ambang={sop.ambangCocok} />

            {/* ── Catatan konfirmasi engineer ── */}
            {sop.catatan?.butir.length > 0 && (
              <section className="se-panel se-konfirmasi">
                <h2><IconAlert size={16} /> Menunggu konfirmasi engineer</h2>
                <p className="se-ket">
                  Hal-hal berikut hanya engineer lapangan yang tahu — merek perangkat,
                  nama jaringan, prosedur internal. <strong>Bukan langkah SOP</strong>,
                  dan sengaja tidak dapat disunting dari sini: isinya harus datang dari
                  jawaban engineer, bukan dari tebakan. Untuk sekarang tetap disunting
                  langsung pada berkas Markdown.
                </p>
                <ul>
                  {sop.catatan.butir.map((b) => <li key={b}>{b}</li>)}
                </ul>
              </section>
            )}
          </>
        )}
      </div>

      {pratinjau && (
        <Pratinjau
          data={pratinjau}
          menyimpan={menyimpan}
          onTutup={() => setPratinjau(null)}
          onSimpan={simpan}
        />
      )}
    </div>
  );
}
