#!/usr/bin/env bash
#
# Salin cadangan SIGAP KELUAR dari mesin ini.
#
# KENAPA PERLU. Aplikasi sudah mencadangkan basis data setiap hari ke folder
# CADANGAN_LUAR. Pada penempatan VPS, folder itu biasanya /var/backups/sigap —
# yang berada di DISK YANG SAMA dengan basis datanya. Bila VPS-nya hilang,
# rusak, atau terhapus, basis data dan seluruh cadangannya lenyap bersamaan.
# Persis keadaan yang variabel CADANGAN_LUAR dimaksudkan untuk cegah.
#
# Skrip ini menutup celah itu: menyalin cadangan harian ke tempat di luar
# mesin, memastikan salinannya benar-benar sampai dan berukuran sama, lalu
# merapikan salinan lama.
#
# SIAPKAN DULU (sekali saja):
#   sudo apt install -y rclone
#   rclone config          # buat remote, misalnya bernama "cadangan"
#
# JADWALKAN (tiap hari pukul 02.30, setelah pencadangan aplikasi berjalan):
#   sudo crontab -e
#   30 2 * * * /opt/sigap/skrip-linux/cadangkan-keluar.sh >> /var/log/sigap-cadangan.log 2>&1
#
# Menghentikan skrip pada galat apa pun — cadangan yang gagal separuh jalan
# lebih berbahaya daripada yang jelas-jelas gagal, sebab ia terlihat ada.
set -euo pipefail

# ── Sesuaikan tiga baris ini ──────────────────────────────────────────
SUMBER="/var/backups/sigap"          # sama dengan CADANGAN_LUAR di .env
TUJUAN="cadangan:sigap-lirik"        # nama remote rclone, lalu foldernya
SIMPAN_HARI=30                       # lama salinan luar disimpan

# ──────────────────────────────────────────────────────────────────────

waktu() { date '+%Y-%m-%d %H:%M:%S'; }
catat() { echo "[$(waktu)] $*"; }

catat "mulai"

if [ ! -d "$SUMBER" ]; then
  catat "GAGAL: folder sumber tidak ada — $SUMBER"
  catat "       periksa CADANGAN_LUAR di /opt/sigap/.env"
  exit 1
fi

# Cadangan hari ini. Aplikasi menamainya sigap-YYYY-MM-DD.db menurut waktu WIB,
# jadi tanggalnya dihitung pada zona itu pula supaya tidak meleset satu hari
# ketika mesin disetel UTC — hal yang baru terasa setelah pukul 17.00 WIB.
TANGGAL="$(TZ=Asia/Jakarta date '+%Y-%m-%d')"
BERKAS="sigap-${TANGGAL}.db"

if [ ! -f "${SUMBER}/${BERKAS}" ]; then
  catat "GAGAL: cadangan hari ini belum ada — ${BERKAS}"
  catat "       apakah aplikasi berjalan? cek: systemctl status sigap"
  exit 1
fi

UKURAN_ASAL=$(stat -c%s "${SUMBER}/${BERKAS}")

# Basis data yang sehat tidak mungkin sekecil ini. Ukuran yang mencurigakan
# lebih baik dihentikan sekarang daripada menimpa salinan luar yang masih baik
# dengan berkas yang ternyata kosong.
if [ "$UKURAN_ASAL" -lt 20480 ]; then
  catat "GAGAL: ${BERKAS} hanya ${UKURAN_ASAL} bita — terlalu kecil, tidak disalin"
  exit 1
fi

catat "menyalin ${BERKAS} (${UKURAN_ASAL} bita) ke ${TUJUAN}"
rclone copy "${SUMBER}/${BERKAS}" "${TUJUAN}/" --no-traverse

# Memastikan salinannya benar-benar sampai, bukan sekadar perintahnya sukses.
UKURAN_TUJUAN=$(rclone size "${TUJUAN}/${BERKAS}" --json 2>/dev/null \
  | grep -o '"bytes":[0-9]*' | cut -d: -f2 || echo 0)

if [ "$UKURAN_TUJUAN" != "$UKURAN_ASAL" ]; then
  catat "GAGAL: ukuran salinan tidak sama — asal ${UKURAN_ASAL}, tujuan ${UKURAN_TUJUAN}"
  exit 1
fi

catat "berhasil — ukuran cocok (${UKURAN_ASAL} bita)"

# Rapikan salinan luar yang sudah lewat masa simpan.
catat "merapikan salinan lebih dari ${SIMPAN_HARI} hari"
rclone delete "${TUJUAN}/" --min-age "${SIMPAN_HARI}d"

JUMLAH=$(rclone lsf "${TUJUAN}/" | wc -l)
catat "selesai — ${JUMLAH} cadangan tersimpan di luar mesin"
