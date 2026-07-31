import React, { useState, useRef, useEffect } from 'react';
import { IconArrowRight, IconClose, IconCheck } from './Icons.jsx';
import Stepper from './Stepper.jsx';
import { LOKASI_GROUPS } from '../data/lokasi.js';
import { FUNGSI_LIST } from '../data/fungsi.js';

/**
 * Formulir pendataan pelapor — langkah 1 dari 2, sebelum memilih layanan.
 *
 * Prinsip IMK yang diterapkan:
 *  - Pencegahan galat  : validasi per-kolom, tombol lanjut terkunci
 *  - Pemulihan galat    : pesan spesifik di kolom yang kosong
 *  - Recognition        : contoh isian pada placeholder + tanda centang saat valid
 *  - Efisiensi          : fokus otomatis, tekan Enter untuk lanjut
 *  - Kontrol pengguna   : dapat ditutup (kembali ke beranda)
 *
 * @param {object}   props.initial  Nilai awal (untuk mengedit data yang sudah ada)
 * @param {function} props.onSubmit Dipanggil dengan { nama, fungsi, lokasi }
 * @param {function} props.onClose  Menutup formulir
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
  }
];

export default function IntakeForm({ initial, onSubmit, onClose }) {
  const [values, setValues] = useState({
    nama: initial?.nama || '',
    fungsi: initial?.fungsi || '',
    lokasi: initial?.lokasi || ''
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
      setTouched({ nama: true, fungsi: true, lokasi: true });
      const firstEmpty = FIELDS.find((f) => !isFilled(f.key));
      if (firstEmpty) document.getElementById(`intake-${firstEmpty.key}`)?.focus();
      return;
    }
    onSubmit({
      nama: values.nama.trim(),
      fungsi: values.fungsi.trim(),
      lokasi: values.lokasi.trim()
    });
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
            aria-label="Tutup dan kembali ke beranda"
            id="intake-close"
          >
            <IconClose size={18} />
          </button>
        )}

        <Stepper current={1} />

        <div className="intake-head">
          <h2 className="intake-title">Data Pelapor</h2>
          <p className="intake-sub">
            Mohon lengkapi data berikut sebelum menyampaikan pengaduan. Data ini
            membantu engineer mengenali dan menindaklanjuti laporan Anda.
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
                  {f.type === 'select' ? (
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
            className="btn btn-primary intake-submit"
            disabled={!allValid}
            id="intake-submit"
          >
            Lanjut Pilih Layanan
            <span className="btn-arrow"><IconArrowRight size={17} /></span>
          </button>
        </form>

        <p className="intake-foot">
          Pertamina EP Asset 1 Regional 1 · Field Lirik
        </p>
      </div>
    </div>
  );
}
