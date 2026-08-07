/**
 * Pilihan "Saya tidak yakin" pada daftar layanan.
 *
 * Bukan divisi sungguhan — tidak ada engineer yang menanganinya dan tidak ada
 * SOP-nya. Ia hanya menyatakan bahwa pelapor tidak tahu kendalanya masuk
 * layanan mana, sehingga penentuannya diserahkan kepada sistem berdasarkan
 * keluhan yang ditulisnya.
 *
 * Alasannya: pekerja berpikir dalam **gejala**, sedangkan daftar layanan
 * menuntut mereka memilih **kategori**. "Internet saya mati" itu LAN, FTTH,
 * WAN, atau Windows? Salah pilih bukan sekadar merepotkan — laporannya sampai
 * ke WhatsApp engineer yang keliru.
 *
 * Sengaja tidak dikirim server bersama daftar divisi: menaruhnya di sana
 * berarti ia ikut terhitung pada validasi divisi, rekap, dan pemetaan nomor
 * WhatsApp, padahal ia bukan salah satu dari itu.
 */
export const LAYANAN_OTOMATIS = {
  id: 'auto',
  name: 'Saya tidak yakin',
  description: 'Ceritakan saja kendalanya, kami yang menentukan layanannya',
  mode: 'auto'
};
