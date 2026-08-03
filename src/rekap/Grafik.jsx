import React, { useState } from 'react';

/**
 * Grafik laporan rekap — SVG murni, tanpa pustaka grafik.
 *
 * Warna seri diambil dari palet korporat Pertamina dan sudah diuji terhadap
 * latar putih halaman ini:
 *
 *   biru  #006cb8 · jingga #eb6834 · hijau laut #1baf7a
 *
 *   - jarak antar warna bagi penyandang buta warna: terburuk ΔE 9,2 (deutan),
 *     di atas ambang 8
 *   - jarak bagi penglihatan normal: terburuk ΔE 27,6, jauh di atas ambang 15
 *
 * Hijau laut berkontras 2,82 terhadap putih, sedikit di bawah 3:1. Karena itu
 * warna TIDAK PERNAH menjadi satu-satunya penanda: setiap seri selalu disertai
 * keterangan bertulisan, dan seluruh angkanya juga tersedia pada tabel rinci
 * di bawah halaman.
 */

export const WARNA = {
  selesai: '#006cb8',
  diteruskan: '#eb6834',
  ditinggalkan: '#1baf7a'
};

const SERI = [
  { kunci: 'selesai', label: 'Selesai mandiri', warna: WARNA.selesai },
  { kunci: 'diteruskan', label: 'Diteruskan ke engineer', warna: WARNA.diteruskan },
  { kunci: 'ditinggalkan', label: 'Ditinggalkan', warna: WARNA.ditinggalkan }
];

/** Label periode yang lebih enak dibaca daripada nilai mentahnya */
function labelPeriode(periode, satuan) {
  if (!periode) return '';
  if (satuan === 'bulan') {
    const [th, bl] = periode.split('-');
    const NAMA = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${NAMA[Number(bl) - 1]} ${th}`;
  }
  if (satuan === 'minggu') return periode.replace('-M', ' mg ');
  return periode.slice(8) + '/' + periode.slice(5, 7);
}

/* ────────────────────────────────────────────────────────────────
   Grafik batang bertumpuk per periode
   ──────────────────────────────────────────────────────────────── */

/**
 * Jumlah laporan per hari/minggu/bulan, ditumpuk menurut hasil akhirnya.
 * @param {{deret: Array, satuan: string}} props
 */
export function GrafikPeriode({ deret, satuan }) {
  const [aktif, setAktif] = useState(null);

  if (!deret || deret.length === 0) {
    return <p className="rk-kosong">Belum ada laporan pada rentang ini.</p>;
  }

  const T = 8, B = 26, K = 34, Kn = 8;   // tepi atas, bawah, kiri, kanan
  const L = 720, T_ = 220;               // lebar & tinggi bidang gambar
  const lebarPlot = L - K - Kn;
  const tinggiPlot = T_ - T - B;

  const maks = Math.max(...deret.map((d) => d.total), 1);
  // Sumbu dibulatkan ke atas agar garis bantunya jatuh di angka bulat
  const atas = Math.ceil(maks / 4) * 4 || 4;

  const lebarSlot = lebarPlot / deret.length;
  const lebarBatang = Math.min(38, Math.max(6, lebarSlot - 6));
  const y = (nilai) => T + tinggiPlot - (nilai / atas) * tinggiPlot;

  // Label sumbu dijarangkan bila periodenya banyak, supaya tidak bertumpuk
  const langkahLabel = Math.ceil(deret.length / 12);

  return (
    <div className="rk-grafik-bungkus">
      <svg viewBox={`0 0 ${L} ${T_}`} className="rk-svg" role="img"
           aria-label={`Jumlah laporan per ${satuan}`}>
        {/* Garis bantu — sengaja tipis agar tidak bersaing dengan datanya */}
        {[0, 1, 2, 3, 4].map((i) => {
          const nilai = (atas / 4) * i;
          return (
            <g key={i}>
              <line x1={K} x2={L - Kn} y1={y(nilai)} y2={y(nilai)}
                    stroke="#e4e9f0" strokeWidth="1" />
              <text x={K - 8} y={y(nilai) + 4} textAnchor="end" className="rk-sumbu">
                {nilai}
              </text>
            </g>
          );
        })}

        {deret.map((d, i) => {
          const x = K + i * lebarSlot + (lebarSlot - lebarBatang) / 2;
          let bawah = T + tinggiPlot;

          return (
            <g key={d.periode}
               onMouseEnter={() => setAktif(i)}
               onMouseLeave={() => setAktif(null)}>
              {/* Bidang tak terlihat — sasaran arahkan kursor dibuat selebar
                  slot, jauh lebih mudah dikenai daripada batangnya sendiri */}
              <rect x={K + i * lebarSlot} y={T} width={lebarSlot} height={tinggiPlot}
                    fill={aktif === i ? 'rgba(0,108,184,0.06)' : 'transparent'} />

              {SERI.map((s) => {
                const nilai = d[s.kunci] || 0;
                if (nilai === 0) return null;
                const tinggi = (nilai / atas) * tinggiPlot;
                bawah -= tinggi;
                return (
                  <rect key={s.kunci} x={x} y={bawah}
                        width={lebarBatang} height={Math.max(tinggi - 2, 1)}
                        rx="3" fill={s.warna} />
                );
              })}

              {i % langkahLabel === 0 && (
                <text x={x + lebarBatang / 2} y={T_ - 8} textAnchor="middle" className="rk-sumbu">
                  {labelPeriode(d.periode, satuan)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {aktif !== null && (
        <div className="rk-tooltip" role="status">
          <strong>{labelPeriode(deret[aktif].periode, satuan)}</strong>
          <span>{deret[aktif].total} laporan</span>
          {SERI.map((s) => (deret[aktif][s.kunci] > 0 ? (
            <span key={s.kunci}>
              <i style={{ background: s.warna }} /> {s.label}: {deret[aktif][s.kunci]}
            </span>
          ) : null))}
        </div>
      )}

      {/* Keterangan seri selalu ada — identitas tidak boleh bergantung warna saja */}
      <div className="rk-legenda">
        {SERI.map((s) => (
          <span key={s.kunci}>
            <i style={{ background: s.warna }} />{s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Batang sebaran
   ──────────────────────────────────────────────────────────────── */

/**
 * Sebaran menurut satu kategori — divisi, area, urgensi, fungsi.
 *
 * Sengaja satu warna untuk semua batang: yang dibandingkan adalah besarannya,
 * bukan identitasnya. Memberi warna berbeda per baris justru menyiratkan
 * pengelompokan yang tidak ada.
 */
export function BatangSebaran({ data, kosong = 'Belum ada data.' }) {
  if (!data || data.length === 0) return <p className="rk-kosong">{kosong}</p>;

  const maks = Math.max(...data.map((d) => d.jumlah), 1);

  return (
    <ul className="rk-batang">
      {data.map((d) => (
        <li key={d.label}>
          <span className="rk-batang-label" title={d.label}>{d.label}</span>
          <span className="rk-batang-jalur">
            <span className="rk-batang-isi" style={{ width: `${(d.jumlah / maks) * 100}%` }} />
          </span>
          <span className="rk-batang-nilai">{d.jumlah}</span>
        </li>
      ))}
    </ul>
  );
}
