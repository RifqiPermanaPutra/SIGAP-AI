import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,

    // React dipisahkan dari kode aplikasi. React jarang berubah, sedangkan
    // kode aplikasi sering diperbarui. Dengan pemisahan ini, pembaruan
    // aplikasi hanya membuat peramban mengunduh ulang berkas kecil, bukan
    // seluruh isi termasuk React.
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [{ name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ }]
        }
      }
    },

    // Peringatan diturunkan agar berkas yang melewati batas wajar kembali
    // terlihat, bukan disembunyikan.
    chunkSizeWarningLimit: 300
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
