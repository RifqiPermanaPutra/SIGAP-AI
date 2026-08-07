<#
    ============================================================
     Mendaftarkan SIGAP ke Task Scheduler Windows.

     Server helpdesk harus hidup segera setelah komputer menyala,
     TANPA menunggu ada yang login. Karena itu pemicunya "at startup"
     (saat komputer menyala), bukan "at logon" (saat pengguna masuk),
     dan tugasnya berjalan sebagai akun SYSTEM.

     Skrip ini MENGUBAH PENGATURAN SISTEM OPERASI. Jalankan hanya
     setelah Anda membaca isinya dan yakin ingin melakukannya.

     Pemakaian:
       Buka PowerShell SEBAGAI ADMINISTRATOR, lalu:

         powershell -ExecutionPolicy Bypass -File .\skrip-windows\pasang-tugas-terjadwal.ps1

       Melihat apa yang akan dilakukan tanpa benar-benar mendaftarkan:

         powershell -ExecutionPolicy Bypass -File .\skrip-windows\pasang-tugas-terjadwal.ps1 -WhatIf

     Membongkarnya kembali: skrip-windows\lepas-tugas-terjadwal.ps1
    ============================================================
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    # Nama tugas di Task Scheduler. Seluruh operasi skrip ini dibatasi pada
    # nama persis ini -- tugas terjadwal lain milik Anda tidak akan tersentuh.
    [string]$NamaTugas = 'SIGAP-Server',

    # Berapa kali Task Scheduler mencoba menjalankan ulang bila prosesnya mati
    [int]$PercobaanUlang = 3,

    # Jeda antar percobaan ulang, dalam menit (minimum 1 menit)
    [int]$JedaUlangMenit = 1,

    # Jeda setelah komputer menyala sebelum server dijalankan, dalam menit.
    # Memberi waktu bagi jaringan dan disk untuk siap lebih dulu.
    [int]$JedaMulaiMenit = 1
)

$ErrorActionPreference = 'Stop'

function Tulis-Judul($teks) {
    Write-Host ''
    Write-Host "=== $teks ===" -ForegroundColor Cyan
}

# ------------------------------------------------------------
#  1. Prasyarat
# ------------------------------------------------------------

Tulis-Judul 'Memeriksa prasyarat'

$identitas = [Security.Principal.WindowsIdentity]::GetCurrent()
$prinsipalKini = New-Object Security.Principal.WindowsPrincipal($identitas)
if (-not $prinsipalKini.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host 'GAGAL: PowerShell ini tidak berjalan sebagai Administrator.' -ForegroundColor Red
    Write-Host '       Mendaftarkan tugas terjadwal yang berjalan saat komputer menyala'
    Write-Host '       memerlukan wewenang Administrator.'
    Write-Host ''
    Write-Host '       Klik kanan Windows PowerShell -> Run as administrator, lalu ulangi.'
    exit 1
}
Write-Host '  [ok] Berjalan sebagai Administrator'

$AkarProyek = Split-Path -Parent $PSScriptRoot
$Bat        = Join-Path $PSScriptRoot 'jalankan-sigap.bat'

if (-not (Test-Path -LiteralPath $Bat -PathType Leaf)) {
    Write-Host "GAGAL: Berkas tidak ditemukan: $Bat" -ForegroundColor Red
    Write-Host '       Jalankan skrip ini dari dalam folder proyek SIGAP.'
    exit 1
}
Write-Host "  [ok] Berkas jalankan-sigap.bat ditemukan"

if (-not (Test-Path -LiteralPath (Join-Path $AkarProyek 'server.js') -PathType Leaf)) {
    Write-Host "GAGAL: server.js tidak ada di $AkarProyek" -ForegroundColor Red
    Write-Host '       Folder induk skrip ini bukan akar proyek SIGAP.'
    exit 1
}
Write-Host "  [ok] Akar proyek : $AkarProyek"

# Node dicari lebih dulu: tugas terjadwal berjalan sebagai SYSTEM, dan SYSTEM
# hanya melihat PATH sistem -- bukan PATH milik pengguna. Node yang dipasang
# "hanya untuk pengguna ini" tidak akan terlihat oleh tugas terjadwal.
$node = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $node) {
    Write-Host 'GAGAL: node tidak ditemukan pada PATH.' -ForegroundColor Red
    Write-Host '       Pasang Node.js 22.5 atau lebih baru lebih dulu.'
    exit 1
}
Write-Host "  [ok] Node        : $($node.Source)"

$pathSistem = [Environment]::GetEnvironmentVariable('Path', 'Machine')
if ($pathSistem -notlike "*$(Split-Path -Parent $node.Source)*") {
    Write-Host ''
    Write-Host 'PERINGATAN: folder Node.js tampaknya hanya ada di PATH pengguna,' -ForegroundColor Yellow
    Write-Host '            bukan di PATH sistem. Tugas terjadwal berjalan sebagai SYSTEM' -ForegroundColor Yellow
    Write-Host '            dan mungkin tidak menemukan node.' -ForegroundColor Yellow
    Write-Host '            Bila tugas gagal berjalan, pasang ulang Node.js dengan pilihan' -ForegroundColor Yellow
    Write-Host '            "install for all users".' -ForegroundColor Yellow
}

if (-not (Test-Path -LiteralPath (Join-Path $AkarProyek 'dist\index.html') -PathType Leaf)) {
    Write-Host ''
    Write-Host 'PERINGATAN: folder dist belum dibangun.' -ForegroundColor Yellow
    Write-Host '            jalankan-sigap.bat akan mencoba "npm run build" sendiri, tetapi' -ForegroundColor Yellow
    Write-Host '            lebih baik Anda menjalankan "npm run build" sekarang sebagai' -ForegroundColor Yellow
    Write-Host '            pengguna biasa daripada membiarkannya berjalan sebagai SYSTEM.' -ForegroundColor Yellow
}

# ------------------------------------------------------------
#  2. Buang pendaftaran lama bila ada (idempotent)
# ------------------------------------------------------------

Tulis-Judul 'Memeriksa pendaftaran lama'

# Pencarian dibatasi pada satu nama persis. Tidak ada wildcard dan tidak ada
# penghapusan massal: tugas terjadwal lain milik pengguna tidak boleh ikut
# terhapus hanya karena skrip ini dijalankan dua kali.
$lama = Get-ScheduledTask -TaskName $NamaTugas -TaskPath '\' -ErrorAction SilentlyContinue

if ($null -ne $lama) {
    Write-Host "  Tugas '$NamaTugas' sudah terdaftar (status: $($lama.State))."
    Write-Host '  Tugas lama dihentikan lalu dibuat ulang agar pengaturannya seragam.'

    if ($PSCmdlet.ShouldProcess($NamaTugas, 'Hentikan dan hapus tugas terjadwal lama')) {
        if ($lama.State -eq 'Running') {
            Stop-ScheduledTask -TaskName $NamaTugas -TaskPath '\'
            Write-Host '  [ok] Tugas lama dihentikan'
        }
        Unregister-ScheduledTask -TaskName $NamaTugas -TaskPath '\' -Confirm:$false
        Write-Host '  [ok] Pendaftaran lama dihapus'
    }
} else {
    Write-Host "  Belum ada tugas bernama '$NamaTugas'."
}

# ------------------------------------------------------------
#  3. Susun definisi tugas
# ------------------------------------------------------------

Tulis-Judul 'Menyusun definisi tugas'

$aksi = New-ScheduledTaskAction -Execute $Bat -WorkingDirectory $AkarProyek

# "AtStartup", bukan "AtLogOn". Server helpdesk harus hidup meski tidak ada
# seorang pun yang login ke komputer itu.
$pemicu = New-ScheduledTaskTrigger -AtStartup
$pemicu.Delay = "PT${JedaMulaiMenit}M"

# SYSTEM + ServiceAccount: berjalan tanpa sesi pengguna, tanpa menyimpan kata
# sandi siapa pun, dan tetap hidup setelah pengguna logout.
$prinsipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

$pengaturan = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -RestartCount $PercobaanUlang `
    -RestartInterval (New-TimeSpan -Minutes $JedaUlangMenit) `
    -ExecutionTimeLimit (New-TimeSpan -Seconds 0)

Write-Host "  Perintah        : $Bat"
Write-Host "  Folder kerja    : $AkarProyek"
Write-Host "  Pemicu          : saat komputer menyala, ditunda $JedaMulaiMenit menit"
Write-Host "  Akun            : SYSTEM (tidak perlu ada yang login)"
Write-Host "  Coba ulang      : $PercobaanUlang kali, jeda $JedaUlangMenit menit"
Write-Host "  Batas waktu     : tidak ada (server memang berjalan terus)"

# ------------------------------------------------------------
#  4. Daftarkan
# ------------------------------------------------------------

Tulis-Judul 'Mendaftarkan tugas'

if ($PSCmdlet.ShouldProcess($NamaTugas, 'Daftarkan tugas terjadwal baru')) {
    Register-ScheduledTask `
        -TaskName $NamaTugas `
        -TaskPath '\' `
        -Action $aksi `
        -Trigger $pemicu `
        -Principal $prinsipal `
        -Settings $pengaturan `
        -Description 'SIGAP - layanan bantuan ICT Pertamina EP Field Lirik. Menjalankan server helpdesk di porta 3000 saat komputer menyala.' | Out-Null

    Write-Host "  [ok] Tugas '$NamaTugas' terdaftar" -ForegroundColor Green
} else {
    Write-Host '  (dilewati -- mode -WhatIf)'
}

# ------------------------------------------------------------
#  5. Ringkasan
# ------------------------------------------------------------

Write-Host ''
Write-Host '------------------------------------------------------------'
Write-Host ' SELESAI' -ForegroundColor Green
Write-Host '------------------------------------------------------------'
Write-Host ''
Write-Host "  Nama tugas    : $NamaTugas"
Write-Host "  Kapan berjalan: setiap kali komputer menyala (+$JedaMulaiMenit menit),"
Write-Host "                  tanpa perlu ada yang login"
Write-Host "  Bila mati     : dijalankan ulang $PercobaanUlang kali, jeda $JedaUlangMenit menit"
Write-Host "  Alamat server : http://localhost:3000"
Write-Host ''
Write-Host '  Memeriksa statusnya:'
Write-Host "    Get-ScheduledTask     -TaskName $NamaTugas"
Write-Host "    Get-ScheduledTaskInfo -TaskName $NamaTugas"
Write-Host ''
Write-Host '  Menjalankan sekarang juga (tanpa menunggu komputer dinyalakan ulang):'
Write-Host "    Start-ScheduledTask -TaskName $NamaTugas"
Write-Host ''
Write-Host '  Menghentikan sementara:'
Write-Host "    Stop-ScheduledTask    -TaskName $NamaTugas    # hentikan yang sedang jalan"
Write-Host "    Disable-ScheduledTask -TaskName $NamaTugas    # matikan pemicunya"
Write-Host "    Enable-ScheduledTask  -TaskName $NamaTugas    # nyalakan lagi"
Write-Host ''
Write-Host '  Membongkar seluruhnya:'
Write-Host '    .\skrip-windows\lepas-tugas-terjadwal.ps1'
Write-Host ''
Write-Host '  Catatan: tugas ini belum berjalan sampai komputer dinyalakan ulang'
Write-Host '  atau Start-ScheduledTask dipanggil. Periksa http://localhost:3000'
Write-Host '  sesudahnya untuk memastikan servernya benar-benar menyala.'
Write-Host ''
