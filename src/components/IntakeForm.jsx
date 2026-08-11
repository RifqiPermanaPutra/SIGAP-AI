import React, { useState, useRef, useEffect } from 'react';
import { IconArrowRight, IconClose, IconCheck, IconWhatsapp } from './Icons.jsx';
import { LOKASI_GROUPS } from '../../bersama/lokasi.js';
import { FUNGSI_LIST } from '../../bersama/fungsi.js';
import { URGENSI_LIST } from '../../bersama/urgensi.js';

/**
 * Formulir pendataan pelapor — ditampilkan saat kendala akan diteruskan
 * kepada Engineer ICT, bukan di awal percakapan.
 *
 * Alasan penempatan: sebagian besar kendala selesai di percakapan. Meminta
 * data di awal membebani semua pengguna demi sebagian kecil yang benar-benar
 * memerlukan engineer. Data baru diminta ketika memang dibutuhkan.
 *
 * Prinsip IMK yang diterapkan:
 *  - Pencegahan galat  : validasi per-kolom, tombol kirim terkunci
 *  - Pemulihan galat    : pesan spesifik di kolom yang kosong
 *  - Recognition        : contoh isian pada placeholder + tanda centang saat valid
 *  - Efisiensi          : fokus otomatis
 *  - Kontrol pengguna   : dapat dibatalkan, kembali ke percakapan
 *
 * @param {object}   props.initial  Nilai awal (bila pengguna mengoreksi isian)
 * @param {function} props.onSubmit Dipanggil dengan { nama, fungsi, lokasi, urgensi }
 * @param {function} props.onClose  Menutup formulir dan kembali ke percakapan
 */
const FIELDS = [
  {
    key: 'nama',
    type: 'text',
    label: 'Nama Pelapor',
    placeholder: 'Contoh: Budi Santoso',
    hint: 'Nama lengkap Anda',
    autoComplete: 'name',
    error: 'Nama pelapor wajib diisi.'
  },
  {
    key: 'fungsi',
    type: 'select',
    grouped: false,
    options: FUNGSI_LIST,
    label: 'Fungsi / Divisi',
    placeholder: '— Pilih fungsi Anda —',
    hint: 'Fungsi tempat Anda bekerja',
    error: 'Fungsi wajib dipilih.'
  },
  {
    key: 'lokasi',
    type: 'select',
    grouped: true,
    options: LOKASI_GROUPS,
    label: 'Lokasi',
    placeholder: '— Pilih lokasi Anda —',
    hint: 'Pilih lokasi Anda di Field Lirik',
    error: 'Lokasi wajib dipilih.'
  },
  {
    key: 'urgensi',
    type: 'urgensi',
    label: 'Tingkat Urgensi Kendala',
    hint: 'Pilih sesuai dampak kendala terhadap pekerjaan Anda',
    error: 'Tingkat urgensi wajib dipilih.'
  }
];

export default function IntakeForm({ initial, onSubmit, onClose }) {
  const [values, setValues] = useState({
    nama: initial?.nama || '',
    fungsi: initial?.fungsi || '',
    lokasi: initial?.lokasi || '',
    urgensi: initial?.urgensi || ''
  });
  const [touched, setTouched] = useState({});
  const firstFieldRef = useRef(null);

  // Fokus otomatis ke kolom pertama — mengurangi langkah bagi pengguna
  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  const isFilled = (key) => values[key].trim().length > 0;
  const allValid = FIELDS.every((f) => isFilled(f.key));

  const setField = (key, val) => setValues((v) => ({ ...v, [key]: val }));
  const markTouched = (key) => setTouched((t) => ({ ...t, [key]: true }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!allValid) {
      // Tandai semua kolom agar galat yang tersisa langsung terlihat,
      // lalu arahkan fokus ke kolom kosong pertama (pemulihan galat).
      // Daftar kolom diturunkan dari FIELDS agar tidak tertinggal saat ada
      // kolom baru ditambahkan.
      setTouched(Object.fromEntries(FIELDS.map((f) => [f.key, true])));
      const firstEmpty = FIELDS.find((f) => !isFilled(f.key));
      if (firstEmpty) document.getElementById(`intake-${firstEmpty.key}`)?.focus();
      return;
    }
    // Nilai dikumpulkan dari FIELDS, bukan disebut satu per satu, supaya
    // kolom baru otomatis ikut terkirim.
    onSubmit(Object.fromEntries(FIELDS.map((f) => [f.key, values[f.key].trim()])));
  };

  return (
    <div className="intake-overlay" id="intake-overlay">
      <div
        className="intake-modal"
        role="dialog"
        aria-label="Formulir Pendataan Pelapor"
        aria-modal="true"
      >
        {onClose && (
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Batalkan dan kembali ke percakapan"
            id="intake-close"
          >
            <IconClose size={18} />
          </button>
        )}

        <div className="intake-head">
          <h2 className="intake-title">Data Pelaporan ke Engineer</h2>
          <p className="intake-sub">
            Kendala Anda akan diteruskan kepada Engineer ICT. Mohon lengkapi
            data berikut agar engineer dapat menindaklanjuti dengan tepat.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="intake-form" noValidate>
          {FIELDS.map((f, i) => {
            const filled = isFilled(f.key);
            const showError = touched[f.key] && !filled;
            const errId = `intake-${f.key}-err`;
            return (
              <div className="intake-field" key={f.key}>
                <label className="intake-label" htmlFor={`intake-${f.key}`}>
                  {f.label} <span className="req" aria-hidden="true">*</span>
                </label>
                <div className={`intake-input-wrap ${showError ? 'has-error' : ''} ${filled ? 'is-valid' : ''}`}>
                  {f.type === 'urgensi' ? (
                    // Ditampilkan sebagai pilihan berkartu, bukan dropdown, agar
                    // keterangan tiap tingkat terbaca langsung. Tanpa keterangan,
                    // pelapor cenderung selalu memilih tingkat tertinggi.
                    <div
                      className="urgensi-grid"
                      role="radiogroup"
                      aria-label={f.label}
                      id={`intake-${f.key}`}
                    >
                      {URGENSI_LIST.map((u) => {
                        const dipilih = values[f.key] === u.nilai;
                        return (
                          <button
                            type="button"
                            key={u.nilai}
                            role="radio"
                            aria-checked={dipilih}
                            className={`urgensi-opsi tingkat-${u.nilai.toLowerCase()} ${dipilih ? 'terpilih' : ''}`}
                            onClick={() => { setField(f.key, u.nilai); markTouched(f.key); }}
                            id={`urgensi-${u.nilai.toLowerCase()}`}
                          >
                            <span className="urgensi-titik" aria-hidden="true" />
                            <span className="urgensi-teks">
                              <span className="urgensi-nama">{u.nilai}</span>
                              <span className="urgensi-ket">{u.keterangan}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : f.type === 'select' ? (
                    <select
                      className={`intake-select ${filled ? '' : 'is-placeholder'}`}
                      value={values[f.key]}
                      onChange={(e) => { setField(f.key, e.target.value); markTouched(f.key); }}
                      onBlur={() => markTouched(f.key)}
                      id={`intake-${f.key}`}
                      aria-required="true"
                      aria-invalid={showError}
                      aria-describedby={showError ? errId : undefined}
                    >
                      <option value="">{f.placeholder}</option>
                      {f.grouped
                        ? f.options.map((group) => (
                            <optgroup key={group.area} label={group.area}>
                              {group.items.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </optgroup>
                          ))
                        : f.options.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                    </select>
                  ) : (
                    <>
                      <input
                        ref={i === 0 ? firstFieldRef : null}
                        type="text"
                        className="intake-input"
                        value={values[f.key]}
                        onChange={(e) => setField(f.key, e.target.value)}
                        onBlur={() => markTouched(f.key)}
                        placeholder={f.placeholder}
                        autoComplete={f.autoComplete}
                        id={`intake-${f.key}`}
                        aria-required="true"
                        aria-invalid={showError}
                        aria-describedby={showError ? errId : undefined}
                      />
                      {filled && (
                        <span className="intake-valid-icon" aria-hidden="true">
                          <IconCheck size={16} />
                        </span>
                      )}
                    </>
                  )}
                </div>
                {showError ? (
                  <p className="intake-field-error" id={errId} role="alert">{f.error}</p>
                ) : (
                  <p className="intake-field-hint">{f.hint}</p>
                )}
              </div>
            );
          })}

          <button
            type="submit"
            className="btn intake-submit intake-kirim-wa"
            disabled={!allValid}
            id="intake-submit"
          >
            <IconWhatsapp size={18} />
            Kirim ke Engineer
            <span className="btn-arrow"><IconArrowRight size={17} /></span>
          </button>
        </form>

        <p className="intake-foot">
          Setelah dikirim, aplikasi WhatsApp akan terbuka berisi data dan keluhan Anda.
        </p>
      </div>
    </div>
  );
}
