# Instagram untuk Pengelolaan Artikel

Fitur ini boleh dipasang sebelum akun Instagram ditentukan. Tanpa konfigurasi,
panel menampilkan **Belum terhubung**, tombol koneksi nonaktif, dan worker tidak
menghubungi Meta. Caption dapat disiapkan pada draft. Artikel tetap dapat terbit
di website meskipun pengiriman Instagram gagal atau menunggu konfigurasi.

## Aktivasi setelah akun tersedia

1. Siapkan akun Instagram Business atau Creator dan aplikasi Meta Developers
   dengan **Instagram API with Instagram Login**. Gunakan Instagram App ID dan
   App Secret untuk produk tersebut, bukan kredensial Facebook Login.
2. Aktifkan izin `instagram_business_basic` dan
   `instagram_business_content_publish`. Untuk pengujian akun milik pengelola,
   tambahkan peran/tester dan terima undangannya. Penggunaan di luar peran aplikasi
   memerlukan tingkat akses dan App Review yang sesuai di Meta.
3. Isi variabel server dalam `.env.example`: App ID, App Secret, versi Graph API
   yang didukung aplikasi, callback HTTPS, URL halaman admin, URL publik API,
   serta kunci enkripsi acak 32 byte (64 karakter hex). Contoh membuat kunci:
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
   Simpan kunci di secret manager, jangan di Git atau variabel `VITE_`.
4. Daftarkan `https://asesmen.pi-psychology.com/api/admin/instagram/callback`
   sebagai OAuth redirect URI persis sama dengan `INSTAGRAM_REDIRECT_URI`.
   Admin dan API koneksi harus disajikan melalui origin yang sama agar cookie
   pengikatan sesi OAuth dapat digunakan. Pastikan reverse proxy melayani
   `/api/admin/instagram/*` dan URL gambar `/api/instagram/media/*`.
5. Deploy API dan frontend bersama, restart server, buka Pengelolaan Artikel,
   kemudian klik **Hubungkan Instagram**. Login dan izinkan akses resmi Meta.
   Kredensial akun Instagram tidak dimasukkan ke aplikasi ini.
6. Uji menggunakan artikel draft dan akun uji: unggah cover, aktifkan opsi
   Instagram, periksa pratinjau, lalu ubah status ke Terbit. Pastikan satu posting
   terbit, status berhasil dan tautannya tersedia. Jangan mengaktifkan artikel
   produksi sebagai bahan uji tanpa persetujuan pemilik konten.

## Perilaku

- Admin menyimpan draft dahulu, mengunggah gambar, lalu mengedit caption dan
  menerbitkan. Caption bawaan berasal dari judul dan ringkasan (maksimal 2.200
  karakter). Seluruh gambar utama dipertahankan, diberi ruang putih jika perlu,
  lalu dikonversi ke JPEG persegi 1080×1080. Pratinjau menggunakan konversi yang sama.
- Pemicu adalah pertama kali status menjadi Terbit, bukan kolom tanggal publikasi.
  Fitur ini tidak menambahkan penjadwalan. Artikel yang sudah pernah terbit sebelum
  fitur dipasang tidak diposting otomatis saat diedit atau diterbitkan ulang.
- Pilihan Instagram default nonaktif. Antrean persisten dibuat atomik dengan
  penerbitan artikel dan menyimpan salinan caption/gambar pada saat itu. Jika
  opsi diaktifkan tanpa koneksi, antrean menunggu konfigurasi atau menunjukkan
  kegagalan koneksi. Setelah akun tersedia, admin dapat mencoba lagi.
- Worker memeriksa antrean setiap 15 detik. Lock PostgreSQL mencegah beberapa
  instance server mengirim pekerjaan bersamaan. Satu artikel hanya punya satu
  catatan pengiriman. Edit artikel tidak membuat posting baru.
- Gagal sebelum publish: **Coba Lagi** memakai caption dan cover terbaru, serta
  tetap memerlukan akun tujuan semula jika sudah diketahui. Artikel harus terbit
  dan opsi Instagram aktif. Menonaktifkan opsi/menghapus artikel membatalkan
  antrean yang belum mulai dikirim.
- Timeout saat publish: status **Perlu pemeriksaan status**. **Periksa Status**
  hanya mengecek container yang sama, tidak menerbitkan lagi. Jika Meta belum bisa
  memastikan hasil, periksa akun secara manual. Jika sudah PUBLISHED tetapi ID
  media hilang karena timeout, aplikasi menandai berhasil tanpa tautan.
- Memutus koneksi menghapus token lokal dan membatalkan antrean yang belum dikirim.
  Ini tidak menghapus posting Instagram atau mencabut izin aplikasi di Meta;
  pencabutan izin dapat dilakukan dari pengaturan Instagram. Untuk mengganti akun,
  putuskan akun lama dulu. Pekerjaan yang terikat akun lama tidak dikirim ke akun baru.
- Token disimpan terenkripsi AES-256-GCM. Worker menyegarkan token yang mendekati
  kedaluwarsa saat ada pekerjaan. Jika lama tidak digunakan sampai token habis,
  admin perlu menghubungkan ulang. Ganti kunci enkripsi hanya dengan rencana
  migrasi token atau pemutusan dan koneksi ulang akun.
- Pemrosesan gambar menggunakan `sharp` sebagai dependensi runtime. Pastikan
  dependensi native untuk platform server ikut terpasang saat deployment.

## Pemeriksaan lokal

Jalankan `pnpm --filter @workspace/api-server test:instagram`. Tes menggunakan
PostgreSQL in-memory dan simulasi API Meta; tidak memerlukan token atau akun dan
tidak mempublikasikan konten. Pemeriksaan akhir OAuth dan publikasi nyata tetap
memerlukan konfigurasi Meta dan akun yang dipilih.

Rujukan: [koleksi API resmi Meta](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api),
[Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/),
[Content Publishing](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing/).
