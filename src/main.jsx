import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

/**
 * Halaman rekap dimuat terpisah (code splitting).
 *
 * Yang membukanya hanya enam akun engineer dan admin, sedangkan pelapor biasa
 * tidak akan pernah menyentuhnya. Menyertakannya ke bundel utama berarti
 * setiap pelapor ikut mengunduh grafik dan tabel yang tak pernah dipakainya.
 */
const RekapPage = lazy(() => import('./rekap/RekapPage.jsx'));

// Perutean sederhana berdasarkan alamat. Server sudah mengarahkan seluruh
// jalur non-API ke index.html, sehingga /rekap sampai ke sini tanpa perlu
// pustaka perutean tambahan.
const diRekap = window.location.pathname.replace(/\/+$/, '') === '/rekap';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {diRekap ? (
      <Suspense fallback={<div style={{ padding: 48, textAlign: 'center' }}>Memuat…</div>}>
        <RekapPage />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>
);
