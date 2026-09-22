# Promo & Info Pelatihan

Buka **Kelola Pelatihan → Promo & Info** pada dashboard admin.

1. Klik **Tambah Promo**, isi judul, deskripsi, teks tombol, dan tautan tujuan.
2. Atur urutan tampil (angka lebih kecil tampil lebih dahulu) dan status aktif.
3. Simpan. Jika diperlukan, klik **Tambah Gambar** pada kartu promo.
4. Gambar dapat diganti atau dihapus tanpa menghapus teks promo.

Gambar opsional: JPEG, PNG, atau WebP, maksimal 8 MB dan 25 megapiksel.
Server memvalidasi isi gambar, menyesuaikan orientasi, dan menyimpan JPEG hingga
1200 × 1600 piksel dengan rasio asli. Gambar publik ditampilkan utuh.

Promo aktif muncul di kanan daftar pelatihan terkini pada desktop, dan di bawah
daftar pada layar kecil. Jika tidak ada promo aktif, daftar pelatihan memakai
lebar penuh seperti sebelumnya. Promo Pelatihan terpisah dari Promo Berita dan
Booking. Promo nonaktif/hapus beserta gambarnya tidak tersedia melalui API publik.

Deploy API, dashboard, dan marketing site bersama. Inisialisasi API membuat
tabel `training_promos` secara idempoten. Tidak ada data promo bawaan atau
perubahan pada tabel promo yang sudah ada.

Pengujian lokal dari `artifacts/api-server`:
`node tests/run-training-promos.mjs`.
Pengujian memakai PostgreSQL in-memory dan server HTTP lokal untuk validasi
hak akses, CRUD, pengurutan, tautan, unggah gambar, serta visibilitas publik.
