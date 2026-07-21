# SIGAP AI

**AI Helpdesk ICT — Pertamina EP Asset 1 Regional 1 Field Lirik**

Sistem pengaduan layanan ICT berbasis AI. Pekerja mengisi data pelapor,
memilih layanan yang bermasalah, lalu asisten AI memandu perbaikan bertahap
menggunakan basis pengetahuan internal (RAG). Bila kendala belum tuntas atau
tergolong berat, laporan otomatis diteruskan ke engineer divisi terkait
melalui WhatsApp beserta konteks keluhan.

## Fitur

- **Formulir pendataan pelapor** (nama, fungsi/divisi, lokasi) sebelum pengaduan
- **8 kategori layanan ICT**: Printer, CCTV, Telepon, Radio Komunikasi, Windows, FTTP, LAN, WAN
- **Asisten AI + RAG** — jawaban berdasarkan SOP tiap divisi, bukan mengarang
- **Eskalasi WhatsApp per divisi** — tiap layanan punya nomor engineer sendiri
- **Deteksi tuntas/belum** untuk menutup atau meneruskan pengaduan
- Antarmuka mengikuti prinsip Interaksi Manusia–Komputer (indikator langkah,
  validasi per-kolom, ramah, responsif untuk ponsel)

## Teknologi

| Lapisan | Teknologi |
|---|---|
| Frontend | React 19 + Vite |
| Backend | Express (Node.js) |
| LLM | NVIDIA NIM — Qwen3-Next 80B (cadangan: Llama 3.1 8B) |
| Embedding | NVIDIA `nv-embedqa-e5-v5` (1024 dimensi) |
| Basis data | JSON lokal |

## Menjalankan secara lokal

### 1. Prasyarat
- Node.js 18+
- API key NVIDIA NIM — daftar gratis di https://build.nvidia.com

### 2. Instalasi
```bash
npm install
cp .env.example .env      # lalu isi NVIDIA_API_KEY dan nomor WhatsApp
```

### 3. Isi basis pengetahuan
```bash
npm run ingest -- --clear --ingest
```
> Menjalankan ini wajib setelah mengganti model embedding (dimensi vektor berubah).

### 4. Menjalankan (mode pengembangan)
```bash
# Terminal 1 — backend (API + database)
npm run dev

# Terminal 2 — frontend (hot-reload)
npm run dev:frontend
```
Buka http://localhost:5173

### Mode produksi
```bash
npm run build
npm start          # menyajikan hasil build + API di port 3000
```

## Konfigurasi (.env)

Seluruh variabel didokumentasikan di [`.env.example`](.env.example).
Yang wajib diisi:

- `NVIDIA_API_KEY` — API key NVIDIA NIM
- `WHATSAPP_DEFAULT` — nomor engineer cadangan
- `WHATSAPP_PRINTER`, `WHATSAPP_CCTV`, … — nomor engineer per divisi (opsional;
  yang kosong akan memakai `WHATSAPP_DEFAULT`)

> **Jangan pernah meng-commit file `.env`.** File tersebut berisi kunci rahasia
> dan sudah diabaikan oleh `.gitignore`.

## Struktur

```
server/          Backend Express
  routes/        Endpoint API (chat, knowledgebase)
  services/      RAG, knowledge base, embedding
  database/      Penyimpanan JSON
src/             Frontend React
  components/    Komponen antarmuka
knowledge-base/  Dokumen SOP per divisi (sumber RAG)
scripts/         Skrip ingest basis pengetahuan
```

---
Pengembang: Rifqi Permana Putra · Untuk penggunaan internal Pertamina EP Field Lirik.
