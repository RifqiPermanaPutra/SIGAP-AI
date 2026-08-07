/**
 * Letak berkas SOP dan hasil bangunnya.
 *
 * Dikumpulkan di satu tempat karena kini ada EMPAT pihak yang menunjuk ke
 * berkas yang sama — pembangun basis pengetahuan, layanan jawaban, rute
 * basis pengetahuan, dan penyunting SOP. Sebelumnya masing-masing menyusun
 * jalurnya sendiri dari `__dirname`; begitu penyunting mulai MENULIS ke
 * berkas itu, empat jalur yang disusun terpisah menjadi empat kesempatan
 * untuk menunjuk ke tempat yang berbeda.
 *
 * Keduanya dapat ditimpa lewat lingkungan. Yang membutuhkannya bukan
 * pemakaian sehari-hari melainkan `npm test`: pengujian penyunting SOP
 * benar-benar menulis ke berkas Markdown, dan pengujian tidak boleh menyentuh
 * SOP sungguhan milik pengembang. Penjalan pengujian menyalin
 * `knowledge-base/` ke folder sementara lalu mengarahkan kedua nilai ini ke
 * sana.
 */
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AKAR = path.join(__dirname, '..', '..');

/** Folder berisi berkas SOP Markdown — sumber kebenaran */
export const SOP_DIR = process.env.SOP_DIR
  ? path.resolve(process.env.SOP_DIR)
  : path.join(AKAR, 'knowledge-base');

/** Berkas JSON hasil bangun — boleh dibuang dan dibuat ulang kapan saja */
export const KB_FILE = process.env.KB_FILE
  ? path.resolve(process.env.KB_FILE)
  : path.join(AKAR, 'server', 'data', 'knowledge-base.json');
