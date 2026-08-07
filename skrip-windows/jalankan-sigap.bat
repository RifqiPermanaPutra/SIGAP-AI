@echo off
REM ============================================================
REM  Menjalankan server SIGAP.
REM
REM  Dipakai dua keperluan:
REM    1. Dijalankan sendiri dengan klik ganda
REM    2. Dipanggil Task Scheduler saat komputer menyala
REM
REM  Memanggil node secara langsung, bukan lewat "npm start".
REM  Pada Task Scheduler, npm adalah berkas .cmd yang membuka proses
REM  perantara — bila prosesnya dihentikan, server kerap tertinggal hidup
REM  tanpa induk dan porta 3000 tetap terpakai.
REM ============================================================

REM Pindah ke folder proyek, yaitu satu tingkat di atas berkas ini
cd /d "%~dp0.."

REM Pastikan Node tersedia bagi pengguna yang menjalankan tugas terjadwal
where node >nul 2>nul
if errorlevel 1 (
    echo [SIGAP] Node.js tidak ditemukan pada PATH.
    echo [SIGAP] Pasang Node.js 22.5 atau lebih baru, lalu coba lagi.
    exit /b 1
)

REM Antarmuka harus sudah dibangun; tanpa folder dist server hanya melayani API
if not exist "dist\index.html" (
    echo [SIGAP] Folder dist belum ada. Menjalankan pembangunan...
    call npm run build
)

echo [SIGAP] Menjalankan server...
node server.js

REM Bila server berhenti, kode keluarnya diteruskan agar Task Scheduler
REM dapat mengenali kegagalan dan menjalankannya ulang.
exit /b %errorlevel%
