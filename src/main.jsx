import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './index.css';

/**
 * Halaman rekap dimuat terpisah (code splitting).
 *
 * Yang membukanya hanya enam akun engineer dan admin, sedangkan pelapor biasa
 * tidak akan pernah menyentuhnya. Menyertakannya ke bundel utama berarti
 * setiap pelapor ikut mengunduh grafik dan tabel yang tak pernah dipakainya.
 */
const RekapPage = lazy(() => import('./rekap/RekapPage.jsx'));

/**
 * Penyunting SOP, dimuat terpisah dengan alasan yang sama — bahkan lebih kuat.
 * Yang membukanya hanya admin, dan hanya sesekali saat SOP perlu diperbarui.
 */
const SopEditorPage = lazy(() => import('./sop-editor/SopEditorPage.jsx'));

/**
 * Daftar tugas engineer. Dibuka dari tautan di dalam pesan WhatsApp, kerap di
 * ponsel dengan sinyal lapangan — jadi justru halaman ini yang paling
 * diuntungkan bundelnya kecil dan terpisah.
 */
const TugasPage = lazy(() => import('./tugas/TugasPage.jsx'));

/**
 * Cek status laporan oleh pelapor. Satu-satunya halaman terpisah yang tidak
 * memerlukan akun — dibuka sesekali dari tautan, lalu ditutup.
 */
const TiketPage = lazy(() => import('./tiket/TiketPage.jsx'));

// Perutean sederhana berdasarkan alamat. Server sudah mengarahkan seluruh
// jalur non-API ke index.html, sehingga /rekap sampai ke sini tanpa perlu
// pustaka perutean tambahan.
const jalur = window.location.pathname.replace(/\/+$/, '');

const memuat = <div style={{ padding: 48, textAlign: 'center' }}>Memuat…</div>;

function Halaman() {
  if (jalur === '/rekap') {
    return <Suspense fallback={memuat}><RekapPage /></Suspense>;
  }
  if (jalur === '/sop-editor') {
    return <Suspense fallback={memuat}><SopEditorPage /></Suspense>;
  }
  if (jalur === '/tugas') {
    return <Suspense fallback={memuat}><TugasPage /></Suspense>;
  }
  if (jalur === '/tiket') {
    return <Suspense fallback={memuat}><TiketPage /></Suspense>;
  }
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Membungkus seluruhnya: layar putih tanpa penjelasan sama buruknya bagi
        pelapor maupun bagi engineer yang sedang membuka rekap. */}
    <ErrorBoundary>
      <Halaman />
    </ErrorBoundary>
  </React.StrictMode>
);
