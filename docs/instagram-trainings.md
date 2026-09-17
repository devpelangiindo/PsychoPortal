# Instagram untuk Kelola Pelatihan

Pelatihan memakai koneksi Instagram yang sama dengan artikel. Akun dapat
ditentukan kemudian; konfigurasi dan aktivasi mengikuti [panduan artikel](instagram-articles.md).
Panel koneksi tersedia pada tab agenda di Kelola Pelatihan.

## Penggunaan

1. Simpan pelatihan sebagai draft, lalu unggah poster.
2. Aktifkan opsi Instagram, periksa pratinjau poster, dan sesuaikan caption.
   Caption bawaan memuat judul, ringkasan, jadwal dalam WIB, lokasi/media,
   batas pendaftaran, dan arahan ke halaman Pelatihan. Caption kosong memakai
   data pelatihan terbaru saat diterbitkan; caption khusus dipakai apa adanya.
3. Ubah status menjadi Terbit. Pengiriman berjalan melalui antrean dan tidak
   menghalangi penerbitan di website.
4. Periksa status pengiriman pada kartu pelatihan. Jika gagal sebelum pengiriman,
   perbaiki data lalu gunakan Coba Lagi. Jika hasil pengiriman belum pasti,
   Periksa Status hanya memeriksa kiriman yang sama agar tidak membuat duplikat.

## Batas perilaku

- Opsi Instagram awalnya nonaktif. Pemicu adalah penerbitan pertama, bukan
  tanggal jadwal. Pelatihan yang sebelumnya sudah terbit, ditutup, atau selesai
  tidak otomatis dikirim ketika diedit atau dibuka kembali.
- Satu pelatihan mempunyai satu catatan pengiriman. Perubahan jadwal atau caption
  setelah berhasil tidak memperbarui posting Instagram dan tidak membuat posting baru.
- Antrean yang belum mulai dikirim dibatalkan jika pelatihan ditutup, selesai,
  dihapus, atau opsi Instagram dinonaktifkan. Worker juga memeriksa batas
  pendaftaran dan waktu selesai; jika waktu selesai kosong, waktu mulai digunakan.
- Coba Lagi memakai poster dan caption terbaru, dengan akun tujuan semula jika
  sudah ditentukan. Pelatihan harus masih aktif. Kiriman yang hasilnya belum pasti
  tetap dapat diperiksa meskipun pelatihan sudah ditutup.
- Memutus koneksi berlaku untuk artikel dan pelatihan, serta membatalkan antrean
  keduanya yang belum dikirim. Posting yang sudah ada di Instagram tetap tersedia.
- Tanpa konfigurasi akun, pengiriman nyata belum berjalan. Simpan sebagai draft
  sampai poster dan akun siap jika belum ingin membuat antrean publikasi.

## Validasi

`pnpm --filter @workspace/api-server test:instagram` menjalankan pengujian artikel
dan pelatihan menggunakan PostgreSQL in-memory serta simulasi Meta. Tidak ada
konten yang diposting oleh pengujian ini. OAuth dan publikasi nyata perlu diuji
setelah akun dan konfigurasi Meta tersedia.
