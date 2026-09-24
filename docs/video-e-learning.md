# Video E-Learning

- Publik: `/produk-layanan/produk-edukasi/video-e-learning` dan detail `/:productSlug`.
- Admin: `/admin/video-e-learning`, melalui menu Video E-Learning di dashboard.
- Pengelolaan mengikuti Produk Digital: nama, deskripsi, harga reguler/promo,
  gambar dan titik fokus, materi pendukung, media eksternal, serta status aktif.
  Isian tautan akses diberi label **Link E-Learning**.
- Intro: Fasilitas belajar mandiri melalui koleksi rekaman pelatihan psikologi dan
  pengembangan diri yang komprehensif, aplikatif, dan mudah diakses.
- Video E-Learning memakai kategori `elearning` pada infrastruktur produk digital.
  Produk lama mendapat kategori `digital`. Daftar katalog, admin, dan pembelian
  difilter berdasarkan kategori; kategori produk tidak berubah saat diedit.
- Keranjang E-Learning terpisah dari Produk Digital. Pembayaran dan otorisasi
  akses memakai alur yang sudah ada. Link hanya dikembalikan kepada pemilik
  pesanan yang telah dibayar/diselesaikan, melalui tombol **Buka E-Learning**.
- Slug tetap unik di seluruh produk digital dan E-Learning.
- Metode pembelian per video: Midtrans (default untuk data lama) atau manual.
  Pada metode manual, isi nomor WhatsApp admin dengan kode negara. Nomor lokal
  berawalan 0 dinormalisasi ke 62. Tombol katalog dan detail berubah menjadi
  **Hubungi Admin untuk Beli**, dengan pesan berisi judul video.
- Video manual ditolak oleh API pembuatan pesanan dan tidak dapat dibayar melalui
  keranjang Midtrans. Pembayaran dan pemberian akses manual ditangani admin;
  tidak ada pencatatan pembayaran atau pemberian akses otomatis dari WhatsApp.

Deploy API, dashboard asesmen, dan situs marketing bersama. Migrasi kolom
kategori dijalankan oleh inisialisasi API dan dapat dijalankan ulang.
Tidak ada konten contoh yang ditambahkan ke database produksi.

Pengujian integrasi lokal: dari `artifacts/api-server`, jalankan
`node --test tests/elearning.test.mjs`. Tes memakai PostgreSQL in-memory untuk
migrasi data lama, CRUD, pemisahan kategori, validasi URL, dan akses sebelum serta
sesudah pembayaran. Pembayaran eksternal tidak dijalankan oleh tes.
