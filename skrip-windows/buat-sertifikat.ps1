<#
    ============================================================
     Membuat sertifikat HTTPS untuk SIGAP di jaringan kantor.

     KENAPA PERLU
     Selama server berjalan di atas HTTP, token sesi melintas di
     jaringan dalam bentuk TERBACA. Siapa pun di WiFi yang sama
     dapat mengambil sesi engineer atau admin dengan penyadap
     paket sederhana, lalu membuka /rekap yang memuat nama
     seluruh pegawai -- tanpa perlu tahu satu pun kata sandi.

     Itu melemahkan seluruh penjagaan lain: scrypt sekuat apa pun
     tidak menolong bila tokennya dicuri utuh dari udara.

     TENTANG SERTIFIKAT MANDIRI
     Skrip ini membuat sertifikat yang ditandatangani sendiri
     (self-signed). Peramban tidak mengenalnya, sehingga akan
     menampilkan peringatan -- KECUALI sertifikatnya dipasang
     sebagai tepercaya pada tiap perangkat.

     Itu penting, dan bukan sekadar soal kerapian: membiasakan
     orang menekan "Lanjutkan saja" pada peringatan sertifikat
     jauh lebih berbahaya daripada HTTP polos, karena kelak
     mereka akan menekannya juga pada peringatan yang sungguhan.

     Bila Fungsi ICT pusat punya Certificate Authority internal,
     PAKAI ITU dan lewati skrip ini -- sertifikat dari CA internal
     otomatis dipercaya seluruh komputer domain tanpa memasang
     apa pun satu per satu.

     Pemakaian:
       Buka PowerShell SEBAGAI ADMINISTRATOR, lalu:

         powershell -ExecutionPolicy Bypass -File .\skrip-windows\buat-sertifikat.ps1

       Melihat apa yang akan dilakukan tanpa membuat apa pun:

         powershell -ExecutionPolicy Bypass -File .\skrip-windows\buat-sertifikat.ps1 -WhatIf
    ============================================================
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    # Nama host yang akan dipakai membuka SIGAP. Alamat IP komputer ini
    # ditambahkan otomatis di bawah supaya ponsel tetap dapat membukanya.
    [string[]]$NamaHost = @('sigap', 'localhost'),

    # Berapa lama sertifikatnya berlaku
    [int]$BerlakuTahun = 3,

    # Folder tempat berkas kunci dan sertifikat disimpan
    [string]$FolderTujuan = 'sertifikat'
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
    Write-Host '       Membuat sertifikat dan memasangnya sebagai tepercaya'
    Write-Host '       memerlukan wewenang Administrator.'
    Write-Host ''
    Write-Host '       Klik kanan Windows PowerShell -> Run as administrator, lalu ulangi.'
    exit 1
}
Write-Host '  [ok] Berjalan sebagai Administrator'

$AkarProyek = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path -LiteralPath (Join-Path $AkarProyek 'server.js') -PathType Leaf)) {
    Write-Host "GAGAL: server.js tidak ada di $AkarProyek" -ForegroundColor Red
    exit 1
}
Write-Host "  [ok] Akar proyek : $AkarProyek"

# Alamat IP komputer ini ikut dimasukkan ke sertifikat. Tanpa itu, ponsel yang
# membuka https://10.x.x.x:3000 tetap mendapat peringatan meskipun
# sertifikatnya sudah dipercaya -- nama pada sertifikat tidak cocok.
$alamatLan = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -ExpandProperty IPAddress

$daftarNama = @($NamaHost) + @($alamatLan) + @($env:COMPUTERNAME) | Select-Object -Unique
Write-Host "  [ok] Nama pada sertifikat : $($daftarNama -join ', ')"

$dirSertifikat = Join-Path $AkarProyek $FolderTujuan
$berkasPfx  = Join-Path $dirSertifikat 'sigap.pfx'
$berkasKey  = Join-Path $dirSertifikat 'sigap-key.pem'
$berkasCert = Join-Path $dirSertifikat 'sigap-cert.pem'

# ------------------------------------------------------------
#  2. Buat sertifikat
# ------------------------------------------------------------

Tulis-Judul 'Membuat sertifikat'

if ($PSCmdlet.ShouldProcess($($daftarNama -join ', '), 'Buat sertifikat self-signed')) {
    New-Item -ItemType Directory -Force -Path $dirSertifikat | Out-Null

    $sertifikat = New-SelfSignedCertificate `
        -DnsName $daftarNama `
        -CertStoreLocation 'Cert:\LocalMachine\My' `
        -FriendlyName 'SIGAP - Layanan ICT Field Lirik' `
        -NotAfter (Get-Date).AddYears($BerlakuTahun) `
        -KeyExportPolicy Exportable `
        -KeyAlgorithm RSA `
        -KeyLength 2048 `
        -HashAlgorithm SHA256

    Write-Host "  [ok] Sertifikat dibuat (thumbprint $($sertifikat.Thumbprint))"

    # ------------------------------------------------------------
    #  3. Pasang sebagai tepercaya PADA KOMPUTER INI
    # ------------------------------------------------------------
    #  Tanpa langkah ini, peramban di komputer server sendiri pun akan
    #  memperingatkan. Perangkat LAIN tetap perlu memasangnya sendiri --
    #  lihat petunjuk di akhir.

    $sandiSementara = [System.Web.Security.Membership]::GeneratePassword(24, 6)
    $sandiAman = ConvertTo-SecureString -String $sandiSementara -Force -AsPlainText

    Export-PfxCertificate -Cert $sertifikat -FilePath $berkasPfx -Password $sandiAman | Out-Null

    Import-PfxCertificate `
        -FilePath $berkasPfx `
        -CertStoreLocation 'Cert:\LocalMachine\Root' `
        -Password $sandiAman | Out-Null

    Write-Host '  [ok] Dipasang sebagai tepercaya pada komputer ini'

    # ------------------------------------------------------------
    #  4. Ubah menjadi PEM yang dapat dibaca Node
    # ------------------------------------------------------------
    #  Node memerlukan kunci dan sertifikat sebagai dua berkas PEM terpisah,
    #  sedangkan Windows menyimpannya sebagai satu berkas PFX.

    $sertifikatPem = [Convert]::ToBase64String($sertifikat.RawData, 'InsertLineBreaks')
    @(
        '-----BEGIN CERTIFICATE-----'
        $sertifikatPem
        '-----END CERTIFICATE-----'
    ) | Set-Content -Path $berkasCert -Encoding ascii

    $kunciRsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($sertifikat)
    $kunciPem = [Convert]::ToBase64String($kunciRsa.ExportPkcs8PrivateKey(), 'InsertLineBreaks')
    @(
        '-----BEGIN PRIVATE KEY-----'
        $kunciPem
        '-----END PRIVATE KEY-----'
    ) | Set-Content -Path $berkasKey -Encoding ascii

    Write-Host "  [ok] $([System.IO.Path]::GetFileName($berkasCert))"
    Write-Host "  [ok] $([System.IO.Path]::GetFileName($berkasKey))"
} else {
    Write-Host '  (dilewati -- mode -WhatIf)'
    exit 0
}

# ------------------------------------------------------------
#  5. Ringkasan
# ------------------------------------------------------------

Write-Host ''
Write-Host '------------------------------------------------------------'
Write-Host ' SELESAI' -ForegroundColor Green
Write-Host '------------------------------------------------------------'
Write-Host ''
Write-Host '  Tambahkan dua baris ini ke .env:'
Write-Host ''
Write-Host "    HTTPS_KEY=$berkasKey" -ForegroundColor Cyan
Write-Host "    HTTPS_CERT=$berkasCert" -ForegroundColor Cyan
Write-Host ''
Write-Host '  COOKIE_SECURE disetel sendiri oleh server begitu HTTPS aktif,'
Write-Host '  jadi tidak perlu ditambahkan.'
Write-Host ''
Write-Host '  Lalu jalankan ulang server. Alamatnya berubah menjadi https://'
foreach ($ip in $alamatLan) {
    Write-Host "    https://${ip}:3000" -ForegroundColor Cyan
}
Write-Host ''
Write-Host '  AGAR TIDAK ADA PERINGATAN DI PERANGKAT LAIN' -ForegroundColor Yellow
Write-Host "  Bagikan berkas berikut, lalu pasang di tiap komputer dan ponsel:"
Write-Host "    $berkasCert"
Write-Host ''
Write-Host '    Windows : klik dua kali -> Install Certificate -> Local Machine'
Write-Host '              -> Place all in: Trusted Root Certification Authorities'
Write-Host '    Android : Settings -> Security -> Encryption & credentials'
Write-Host '              -> Install a certificate -> CA certificate'
Write-Host '    iPhone  : kirim berkasnya, buka, Settings -> Profile Downloaded'
Write-Host '              -> Install, lalu Settings -> General -> About'
Write-Host '              -> Certificate Trust Settings -> aktifkan'
Write-Host ''
Write-Host '  Membiarkan orang menekan "Lanjutkan saja" pada peringatan' -ForegroundColor Yellow
Write-Host '  sertifikat lebih berbahaya daripada HTTP polos: mereka akan' -ForegroundColor Yellow
Write-Host '  menekannya juga pada peringatan yang sungguhan.' -ForegroundColor Yellow
Write-Host ''
Write-Host '  BILA ADA CA INTERNAL PERTAMINA, pakai itu dan bongkar ini:'
Write-Host "    Remove-Item '$dirSertifikat' -Recurse"
Write-Host ''
