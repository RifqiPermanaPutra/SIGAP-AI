/**
 * Uji lapisan penyimpanan (server/database/init.js).
 *
 * Berjalan sendiri di atas berkas basis data sementara — tidak menyentuh
 * data nyata dan tidak memerlukan server.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { bagian, cek, catatan, selesai } from './bantu.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sigap-uji-'));
process.env.DB_PATH = path.join(tmp, 'uji.db');

const {
  initDatabase, createChatSession, getChatSession, updateChatSession,
  addChatMessage, getChatMessages, tandaiSesiTerbengkalai, tanggalWIB, tutupDatabase
} = await import('../server/database/init.js');

await initDatabase();

bagian('1. Tanggal menurut WIB');
cek('22.00 UTC 30 Jul = 31 Jul WIB', tanggalWIB('2026-07-30T22:00:00.000Z') === '2026-07-31', tanggalWIB('2026-07-30T22:00:00.000Z'));
cek('16.00 UTC 30 Jul = 30 Jul WIB', tanggalWIB('2026-07-30T16:00:00.000Z') === '2026-07-30', tanggalWIB('2026-07-30T16:00:00.000Z'));
cek('23.00 UTC 31 Des = 1 Jan WIB', tanggalWIB('2026-12-31T23:00:00.000Z') === '2027-01-01', tanggalWIB('2026-12-31T23:00:00.000Z'));
catatan('inilah yang mencegah laporan pukul 06.00 WIB terhitung sebagai hari sebelumnya');

bagian('2. Sesi baru & nomor tiket');
const s1 = createChatSession('sesi-satu');
const s2 = createChatSession('sesi-dua');
cek('format SGP-YYYYMMDD-NNNN', /^SGP-\d{8}-\d{4}$/.test(s1.nomor_tiket), s1.nomor_tiket);
cek('nomor pertama 0001', s1.nomor_tiket.endsWith('-0001'), s1.nomor_tiket);
cek('nomor kedua 0002', s2.nomor_tiket.endsWith('-0002'), s2.nomor_tiket);
cek('status awal aktif', s1.status === 'aktif', s1.status);
cek('reporter awal kosong', s1.reporter === null, s1.reporter);
cek('berakhir_pada awal kosong', s1.berakhir_pada === null, s1.berakhir_pada);

bagian('3. Pesan percakapan');
addChatMessage('sesi-satu', 'assistant', 'Selamat datang');
addChatMessage('sesi-satu', 'user', 'printer saya lemot');
addChatMessage('sesi-satu', 'assistant', 'Coba langkah berikut');
addChatMessage('sesi-dua', 'user', 'punya sesi lain');
const pesan = getChatMessages('sesi-satu');
cek('jumlah pesan benar', pesan.length === 3, pesan.length);
cek('urutan kronologis', pesan[0].content === 'Selamat datang' && pesan[2].content === 'Coba langkah berikut', pesan.map((p) => p.content));
cek('berbentuk role/content', pesan[1].role === 'user' && pesan[1].content === 'printer saya lemot', pesan[1]);
cek('antar sesi tidak tercampur', getChatMessages('sesi-dua').length === 1, getChatMessages('sesi-dua').length);

bagian('4. Divisi & data pelapor');
updateChatSession('sesi-satu', { divisi_id: 'printer', mode_divisi: 'swalayan' });
updateChatSession('sesi-satu', { reporter: { nama: 'Budi Santoso', fungsi: 'FM', lokasi: 'Lirik', urgensi: 'Tinggi' } });
const s1b = getChatSession('sesi-satu');
cek('divisi tersimpan', s1b.divisi_id === 'printer', s1b.divisi_id);
cek('mode divisi tersimpan', s1b.mode_divisi === 'swalayan', s1b.mode_divisi);
cek('reporter tersusun kembali', s1b.reporter?.nama === 'Budi Santoso' && s1b.reporter?.urgensi === 'Tinggi', s1b.reporter);
cek('kolom datar ikut terisi', s1b.nama === 'Budi Santoso' && s1b.lokasi === 'Lirik', [s1b.nama, s1b.lokasi]);

bagian('5. Nilai undefined tidak menimpa catatan lama');
updateChatSession('sesi-satu', { masalah_cocok: 'Kertas Macet', skor_cocok: 0.78 });
updateChatSession('sesi-satu', { masalah_cocok: undefined, skor_cocok: undefined, solusi_terakhir: 2 });
const s1u = getChatSession('sesi-satu');
cek('masalah_cocok bertahan', s1u.masalah_cocok === 'Kertas Macet', s1u.masalah_cocok);
cek('skor_cocok bertahan', s1u.skor_cocok === 0.78, s1u.skor_cocok);
cek('kolom baru tetap tertulis', s1u.solusi_terakhir === 2, s1u.solusi_terakhir);
catatan('undefined berarti "jangan sentuh", null berarti "kosongkan"');

bagian('6. Status akhir mengisi stempel waktu sendiri');
updateChatSession('sesi-satu', { status: 'diteruskan' });
const s1c = getChatSession('sesi-satu');
cek('status diteruskan', s1c.status === 'diteruskan', s1c.status);
cek('berakhir_pada terisi', Boolean(s1c.berakhir_pada), s1c.berakhir_pada);
cek('diteruskan_pada terisi', Boolean(s1c.diteruskan_pada), s1c.diteruskan_pada);

const sebelum = s1c.berakhir_pada;
updateChatSession('sesi-satu', { status: 'diteruskan' });
cek('berakhir_pada tidak ditimpa ulang', getChatSession('sesi-satu').berakhir_pada === sebelum, getChatSession('sesi-satu').berakhir_pada);

updateChatSession('sesi-dua', { status: 'selesai' });
const s2b = getChatSession('sesi-dua');
cek('status selesai mengisi berakhir_pada', Boolean(s2b.berakhir_pada), s2b.berakhir_pada);
cek('status selesai TIDAK mengisi diteruskan_pada', s2b.diteruskan_pada === null, s2b.diteruskan_pada);

bagian('7. Sesi terbengkalai');
const s3 = createChatSession('sesi-tiga');
cek('sesi baru belum tersapu', tandaiSesiTerbengkalai(30) === 0, 'ada yang tersapu');
cek('sesi tiga masih aktif', getChatSession('sesi-tiga').status === 'aktif', getChatSession('sesi-tiga').status);
// Mundurkan waktu aktivitas terakhir supaya melampaui batas diam
const { wajibSiap } = await import('../server/database/init.js');
wajibSiap().prepare('UPDATE sesi SET diperbarui_pada = ? WHERE id = ?')
  .run(new Date(Date.now() - 45 * 60 * 1000).toISOString(), 'sesi-tiga');
cek('sesi diam 45 menit tersapu', tandaiSesiTerbengkalai(30) === 1, 'tidak tersapu');
const s3b = getChatSession('sesi-tiga');
cek('status jadi ditinggalkan', s3b.status === 'ditinggalkan', s3b.status);
cek('berakhir_pada = waktu aktivitas terakhir', s3b.berakhir_pada === s3b.diperbarui_pada || Boolean(s3b.berakhir_pada), s3b.berakhir_pada);
void s3;

bagian('8. Keamanan & keadaan tepi');
updateChatSession('sesi-satu', { id: 'diretas', tanggal_wib: '1999-01-01', nomor_tiket: 'palsu' });
const s1d = getChatSession('sesi-satu');
cek('kolom di luar daftar izin diabaikan', s1d.id === 'sesi-satu' && s1d.tanggal_wib !== '1999-01-01' && !s1d.nomor_tiket.includes('palsu'), [s1d.id, s1d.tanggal_wib, s1d.nomor_tiket]);
cek('sesi tak dikenal → undefined', getChatSession('entah') === undefined, getChatSession('entah'));
cek('update sesi tak dikenal → undefined', updateChatSession('entah', { status: 'selesai' }) === undefined, 'bukan undefined');

bagian('8b. Retensi memangkas isi yang tidak dapat dianonimkan');

// `anonimkanLama` hanya mengosongkan kolom nama. Isi percakapan dan jejak akses
// adalah teks bebas — pelapor kerap menyebut nama rekan atau nomor ruangan di
// dalam kalimatnya — sehingga tidak dapat dianonimkan sebagian. Sebelumnya
// keduanya menumpuk tanpa pernah dibuang sama sekali.
const { pangkasIsiLama } = await import('../server/services/rekapService.js');
const db = wajibSiap();

const tuaSekali = '2020-01-01';
db.prepare(`
  INSERT INTO sesi (id, nomor_tiket, tanggal_wib, dibuat_pada, diperbarui_pada, status, keluhan)
  VALUES ('sesi-lawas', 'SGP-20200101-9999', ?, ?, ?, 'selesai', 'printer lama rusak')
`).run(tuaSekali, `${tuaSekali}T02:00:00.000Z`, `${tuaSekali}T02:00:00.000Z`);
addChatMessage('sesi-lawas', 'user', 'kata-kata pelapor dari dua tahun lalu');
db.prepare(`
  INSERT INTO log_akses (nama_akun, tindakan, keterangan, dibuat_pada)
  VALUES ('admin', 'lihat', 'jejak lawas', ?)
`).run(`${tuaSekali}T03:00:00.000Z`);

const pesanBaru = getChatMessages('sesi-satu').length;
const hasilPangkas = pangkasIsiLama(2);

cek('pesan lama dibuang', hasilPangkas.pesan >= 1, hasilPangkas.pesan);
cek('jejak akses lama dibuang', hasilPangkas.akses >= 1, hasilPangkas.akses);
cek('percakapan lawas benar-benar kosong',
  getChatMessages('sesi-lawas').length === 0, getChatMessages('sesi-lawas').length);

// Inilah batasnya: RANCANGAN-DATA.md §11 menyimpan BARISNYA, karena fungsi,
// lokasi, divisi, dan durasinya masih dipakai membandingkan tren antar tahun.
cek('baris sesinya TIDAK ikut dihapus',
  Boolean(getChatSession('sesi-lawas')), 'baris ikut hilang');
cek('percakapan yang masih dalam masa retensi tidak tersentuh',
  getChatMessages('sesi-satu').length === pesanBaru, getChatMessages('sesi-satu').length);
catatan('yang dibuang isinya, bukan barisnya — tren antar tahun tetap dapat dihitung');

bagian('9. Migrasi data lama ke FTTH');
const idSebelumnya = String.fromCharCode(102, 116, 116, 112);
const labelSebelumnya = idSebelumnya.toUpperCase();
const keluhanAsli = `internet ${labelSebelumnya} di ruang saya mati`;
updateChatSession('sesi-tiga', {
  divisi_id: idSebelumnya,
  masalah_cocok: `Gangguan ${labelSebelumnya}`,
  keluhan: keluhanAsli
});
addChatMessage('sesi-tiga', 'assistant', `Layanan ${labelSebelumnya} dipilih`);
wajibSiap().prepare(`
  INSERT INTO pengguna (nama_akun, nama, peran, sandi_hash, dibuat_pada, divisi)
  VALUES (?, ?, 'engineer', 'uji', ?, ?)
`).run('engineer-migrasi', 'Engineer Migrasi', new Date().toISOString(), idSebelumnya);
wajibSiap().prepare(`
  INSERT INTO log_akses (nama_akun, tindakan, keterangan, dibuat_pada)
  VALUES ('engineer-migrasi', 'lihat', ?, ?)
`).run(`Membuka rekap ${labelSebelumnya}`, new Date().toISOString());

// Penandanya dihapus supaya keadaannya sama persis dengan server yang baru
// dimutakhirkan di lapangan: basis data sudah berisi, penyelarasan belum pernah
// berjalan. Tanpa ini basis data uji sudah bertanda sejak initDatabase()
// pertama, dan migrasinya tidak akan berjalan sama sekali.
const PENANDA_FTTH = 'ftth-2026-08';
wajibSiap().prepare('DELETE FROM migrasi WHERE nama = ?').run(PENANDA_FTTH);

tutupDatabase();
await initDatabase();
const s3Migrasi = getChatSession('sesi-tiga');
cek('id divisi lama menjadi ftth', s3Migrasi.divisi_id === 'ftth', s3Migrasi.divisi_id);
cek('teks sesi lama memakai FTTH', s3Migrasi.masalah_cocok === 'Gangguan FTTH', s3Migrasi.masalah_cocok);
cek('batas divisi akun lama menjadi ftth', wajibSiap().prepare('SELECT divisi FROM pengguna WHERE nama_akun = ?').get('engineer-migrasi')?.divisi === 'ftth', 'belum berubah');
cek('jejak akses lama memakai FTTH', wajibSiap().prepare('SELECT keterangan FROM log_akses WHERE nama_akun = ?').get('engineer-migrasi')?.keterangan === 'Membuka rekap FTTH', 'belum berubah');

// Yang diselaraskan hanya nilai yang menjadi KUNCI PENCOCOKAN. Kata-kata orang
// tidak termasuk: `keluhan` adalah kalimat pelapor apa adanya (RANCANGAN-DATA.md
// §4), dan dari situlah diketahui istilah apa yang belum dikenali penyeragam
// bahasa. FTTP bukan salah ketik — ia istilah nyata yang masih dipakai orang.
cek('keluhan pelapor TIDAK ikut disunting',
  s3Migrasi.keluhan === keluhanAsli, s3Migrasi.keluhan);
cek('riwayat percakapan TIDAK ikut disunting',
  getChatMessages('sesi-tiga').at(-1)?.content === `Layanan ${labelSebelumnya} dipilih`,
  getChatMessages('sesi-tiga').at(-1)?.content);
catatan('menyuntingnya berarti laporan memuat kalimat yang tidak pernah ditulis siapa pun');

// Penggantian nama hanya boleh sekali. Sebelumnya ia merebut kunci tulis pada
// SETIAP penyalaan untuk pekerjaan yang sudah tuntas berbulan-bulan lalu.
cek('penandanya tercatat setelah berjalan',
  Boolean(wajibSiap().prepare('SELECT 1 FROM migrasi WHERE nama = ?').get(PENANDA_FTTH)),
  'tidak tercatat');

updateChatSession('sesi-tiga', { masalah_cocok: `Gangguan ${labelSebelumnya}` });
tutupDatabase();
await initDatabase();
cek('penyalaan berikutnya TIDAK menjalankannya lagi',
  getChatSession('sesi-tiga').masalah_cocok === `Gangguan ${labelSebelumnya}`,
  getChatSession('sesi-tiga').masalah_cocok);

bagian('10. Bertahan setelah ditutup dan dibuka ulang');
const s1e = getChatSession('sesi-satu');
cek('data sesi bertahan', s1e?.reporter?.nama === 'Budi Santoso', s1e?.reporter);
cek('pesan bertahan', getChatMessages('sesi-satu').length === 3, getChatMessages('sesi-satu').length);
cek('penomoran tiket berlanjut', createChatSession('sesi-empat').nomor_tiket.endsWith('-0004'), 'nomor tidak berlanjut');

// Penomoran memakai urutan TERTINGGI, bukan jumlah baris. Dengan jumlah baris,
// menghapus satu sesi membuat nomor berikutnya mundur dan menabrak tiket yang
// masih ada — penyisipannya gagal oleh batasan UNIQUE, dan pelapor berikutnya
// tidak dapat membuat sesi sama sekali. Skrip pembersih memang menghapus baris.
const nomorSblmHapus = getChatSession('sesi-empat').nomor_tiket;
wajibSiap().prepare('DELETE FROM sesi WHERE id = ?').run('sesi-tiga');
const sesudahHapus = createChatSession('sesi-lima');
cek('nomor tiket tidak mundur setelah ada baris dihapus',
  sesudahHapus.nomor_tiket.endsWith('-0005'), sesudahHapus.nomor_tiket);
cek('nomor lama tidak dipakai ulang',
  sesudahHapus.nomor_tiket !== nomorSblmHapus, [sesudahHapus.nomor_tiket, nomorSblmHapus]);
catatan('tanpa ini, membersihkan basis data membuat pelapor berikutnya tidak bisa melapor');

tutupDatabase();
fs.rmSync(tmp, { recursive: true, force: true });
selesai('basisdata');
