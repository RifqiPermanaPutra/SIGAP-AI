import React from 'react';
import { IconCheck } from './Icons.jsx';

/**
 * Indikator langkah untuk proses awal (data pelapor → pilih layanan).
 * Menerapkan prinsip IMK "visibilitas status sistem": pengguna selalu tahu
 * ada di langkah mana dan berapa langkah tersisa.
 *
 * @param {number} current - Langkah aktif (1 atau 2)
 */
const STEPS = ['Data Diri', 'Pilih Layanan'];

export default function Stepper({ current = 1 }) {
  return (
    <ol className="stepper" aria-label={`Langkah ${current} dari ${STEPS.length}`}>
      {STEPS.map((label, i) => {
        const no = i + 1;
        const state = no < current ? 'done' : no === current ? 'active' : 'todo';
        return (
          <React.Fragment key={label}>
            <li className={`step ${state}`} aria-current={state === 'active' ? 'step' : undefined}>
              <span className="step-dot">
                {state === 'done' ? <IconCheck size={14} /> : no}
              </span>
              <span className="step-label">{label}</span>
            </li>
            {no < STEPS.length && <span className="step-bar" aria-hidden="true" />}
          </React.Fragment>
        );
      })}
    </ol>
  );
}
