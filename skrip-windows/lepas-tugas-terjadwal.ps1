<#
    ============================================================
     Membongkar pendaftaran SIGAP dari Task Scheduler Windows.

     Kebalikan dari skrip-windows\pasang-tugas-terjadwal.ps1.
     Setiap yang bisa dipasang harus bisa dilepas dengan mudah.

     Yang dilakukan:
       1. Menghentikan tugas bila sedang berjalan (server ikut mati)
       2. Menghapus pendaftarannya

     Yang TIDAK dilakukan: menyentuh berkas proyek, basis data,
     cadangan, atau tugas terjadwal lain milik Anda.

     Pemakaian:
       Buka PowerShell SEBAGAI ADMINISTRATOR, lalu:

         powershell -ExecutionPolicy Bypass -File .\skrip-windows\lepas-tugas-terjadwal.ps1

       Melihat apa yang akan dilakukan tanpa benar-benar menghapus:

         powershell -ExecutionPolicy Bypass -File .\skrip-windows\lepas-tugas-terjadwal.ps1 -WhatIf
    ============================================================
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    # Harus sama persis dengan nama yang dipakai saat memasang.
    [string]$NamaTugas = 'SIGAP-Server',

    # Porta yang dibuka saat memasang. Harus sama agar aturannya ketemu.
    [int]$Porta = 3000,

    # Biarkan porta tetap terbuka. Isi bila server masih dijalankan manual.
    [switch]$BiarkanFirewall
)

$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host '=== Membongkar tugas terjadwal SIGAP ===' -ForegroundColor Cyan
Write-Host ''

$identitas = [Security.Principal.WindowsIdentity]::GetCurrent()
$prinsipalKini = New-Object Security.Principal.WindowsPrincipal($identitas)
if (-not $prinsipalKini.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host 'GAGAL: PowerShell ini tidak berjalan sebagai Administrator.' -ForegroundColor Red
    Write-Host '       Klik kanan Windows PowerShell -> Run as administrator, lalu ulangi.'
    exit 1
}

# Dicari dengan nama persis, tanpa wildcard. Skrip ini tidak boleh bisa
# menghapus tugas terjadwal lain hanya karena namanya mirip.
$tugas = Get-ScheduledTask -TaskName $NamaTugas -TaskPath '\' -ErrorAction SilentlyContinue

if ($null -eq $tugas) {
    Write-Host "  Tidak ada tugas bernama '$NamaTugas'."
} else {
    Write-Host "  Ditemukan tugas '$NamaTugas' (status: $($tugas.State))"

    if ($tugas.State -eq 'Running') {
        if ($PSCmdlet.ShouldProcess($NamaTugas, 'Hentikan tugas yang sedang berjalan')) {
            Stop-ScheduledTask -TaskName $NamaTugas -TaskPath '\'
            Write-Host '  [ok] Tugas dihentikan -- server SIGAP ikut mati'
        }
    }

    if ($PSCmdlet.ShouldProcess($NamaTugas, 'Hapus pendaftaran tugas terjadwal')) {
        Unregister-ScheduledTask -TaskName $NamaTugas -TaskPath '\' -Confirm:$false
        Write-Host '  [ok] Pendaftaran dihapus' -ForegroundColor Green
    } else {
        Write-Host '  (dilewati -- mode -WhatIf)'
    }
}

# Aturan firewall dibuang juga. Membongkar tugas terjadwal tetapi meninggalkan
# porta terbuka berarti sisa izin yang tidak ada gunanya -- dan tidak ada yang
# akan ingat menutupnya kelak.
$NamaAturan = "SIGAP - porta $Porta (HTTP masuk)"

if ($BiarkanFirewall) {
    Write-Host "  Aturan firewall '$NamaAturan' dibiarkan (-BiarkanFirewall)."
} else {
    $aturan = Get-NetFirewallRule -DisplayName $NamaAturan -ErrorAction SilentlyContinue
    if ($null -eq $aturan) {
        Write-Host "  Tidak ada aturan firewall bernama '$NamaAturan'."
    } elseif ($PSCmdlet.ShouldProcess($NamaAturan, 'Hapus aturan firewall')) {
        $aturan | Remove-NetFirewallRule
        Write-Host "  [ok] Porta $Porta ditutup kembali" -ForegroundColor Green
    }
}

Write-Host ''
Write-Host '------------------------------------------------------------'
Write-Host ' SELESAI' -ForegroundColor Green
Write-Host '------------------------------------------------------------'
Write-Host ''
Write-Host '  SIGAP tidak lagi berjalan otomatis saat komputer menyala.'
Write-Host ''
Write-Host '  Memastikan sudah benar-benar terhapus:'
Write-Host "    Get-ScheduledTask -TaskName $NamaTugas"
Write-Host '    (seharusnya menghasilkan galat "No MSFT_ScheduledTask objects found")'
Write-Host ''
Write-Host '  Menjalankan server secara manual kembali:'
Write-Host '    .\skrip-windows\jalankan-sigap.bat'
Write-Host ''
Write-Host '  Memasang ulang:'
Write-Host '    .\skrip-windows\pasang-tugas-terjadwal.ps1'
Write-Host ''
