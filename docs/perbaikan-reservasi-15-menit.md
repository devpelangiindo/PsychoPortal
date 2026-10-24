# Perbaikan reservasi konseling 15 menit — acuan pesanan 135

## Status dan batas pemeriksaan

Revisi diterapkan pada kode lokal pada 24 Oktober 2026. Pengguna mengonfirmasi bahwa 135 adalah nomor pesanan. Database produksi, status Midtrans asli pesanan 135, versi deployment aktif, dan log worker produksi belum dapat diperiksa: lingkungan kerja tidak memiliki `DATABASE_URL` atau konfigurasi koneksi produksi. Tidak ada deployment, transaksi sungguhan, atau perubahan data produksi dalam pekerjaan ini.

## Penyebab yang ditemukan pada kode

Aturan sebelumnya menganggap reservasi pending tetap aktif tanpa batas apabila terdapat ID pembayaran `order_...` atau alasan pemeriksaan pembayaran. Pengecualian itu melewati pemeriksaan tenggat 15 menit. Aturan yang sama terdapat pada pemeriksaan ketersediaan, benturan pembayaran, dan rekonsiliasi booking.

Pembuatan percobaan pembayaran juga dapat menulis tenggat baru 15 menit dari waktu pembayaran dibuka. Sementara itu, worker rekonsiliasi hanya berjalan jika konfigurasi `PAYMENT_RECONCILIATION_WORKER_ENABLED` bernilai tepat `true`. Kombinasi ini menyediakan jalur slot tetap terblokir meskipun belum ada pembayaran terverifikasi. Temuan kode tersebut belum membuktikan jalur yang terjadi pada transaksi produksi 135.

## Perilaku setelah revisi

- Satu helper menentukan reservasi aktif untuk penyimpanan, availability, pembayaran, dan rekonsiliasi. Batas unpaid adalah waktu pembuatan order ditambah 15 menit. Tenggat eksplisit yang lebih awal tetap dihormati; tenggat lama yang lebih panjang dibatasi kembali ke batas awal.
- Pada atau setelah tenggat, unpaid tidak lagi menahan slot, termasuk ketika masih ada ID pembayaran, verifikasi provider gagal, browser ditutup, atau worker tidak berjalan. Slot dapat dipilih kembali apabila tidak ada booking aktif lain yang bertumpang tindih.
- Masa tahan jadwal dan status uang masuk dipisahkan. Pelepasan slot tidak menghapus order, ID pembayaran, attempt, resi, maupun catatan verifikasi; juga tidak menganggap gangguan jaringan atau respons 404 sebagai bukti uang belum masuk.
- Booking yang sudah terverifikasi dibayar tetap melindungi jadwalnya. Flag booking cancelled yang tertinggal tidak meniadakan pembayaran sah. Booking replaced dan schedule review mempertahankan aturan operasionalnya.
- Pembuatan, pembukaan ulang, dan percobaan pembayaran berikutnya menggunakan sisa masa tahan awal. Setelah tenggat, backend menolak pembayaran booking lama dengan kode `ORDER_EXPIRED`.
- Midtrans menerima expiry dengan awal waktu tetap sehingga batas halaman dan kanal pembayaran mengikuti tenggat reservasi. Override `page_expiry` yang relatif dihapus. Rekonsiliasi juga memakai batas reservasi saat menutup attempt lama yang tenggat tersimpannya terlalu panjang.
- Pembayaran yang terkonfirmasi terlambat memeriksa ulang benturan di bawah penguncian psikolog/tanggal. Uang dan resi tetap dicatat; jika slot dimiliki klien lain, booking menjadi `schedule_review` tanpa mengambil slot tersebut.
- Form booking menampilkan sisa masa tahan, menolak pengalihan pembayaran setelah tenggat, dan menyediakan tindakan eksplisit memilih jadwal untuk pesanan baru. Data klien serta persetujuan tetap ada; pilihan jam dibersihkan. Status pembayaran yang sudah terkonfirmasi menyembunyikan pilihan reservasi ulang.
- Availability diperbarui setiap 10 detik dan saat pengguna kembali ke halaman; respons API diberi `Cache-Control: no-store`. Respons pembuatan booking menyediakan tenggat efektif dari server.
- Pesanan nonkonseling tetap mengikuti masa berlaku pembayarannya sendiri.

## Validasi lokal

**82 pengujian lulus**, terdiri atas:

| Kelompok | Lulus |
| --- | ---: |
| Aktivasi dan penghentian worker | 2 |
| Penyimpanan booking dan perlindungan slot | 13 |
| Integrasi SDK Midtrans dengan provider tiruan/loopback | 5 |
| Lifecycle pembayaran | 35 |
| Rekonsiliasi pembayaran dan booking | 17 |
| Status pembayaran dan reservasi frontend | 10 |

Rangkaian gabungan awal meluluskan 81 tes. Setelah penambahan satu pemeriksaan pelestarian tenggat nonkonseling, suite lifecycle terbaru meluluskan 35 dari 35 tes. Tes menggunakan PGlite terisolasi, provider tiruan, jam simulasi, dan loopback; bukan transaksi Midtrans produksi atau uji beban konkurensi pada PostgreSQL produksi.

Build backend dan frontend untuk produksi berhasil. Pemeriksaan TypeScript dibandingkan dengan kode awal menggunakan compiler host yang membaca sumber awal dari Git: API tetap 97 diagnostik, frontend tetap 21, tanpa diagnostik baru. Typecheck seluruh proyek masih memiliki error lama. `git diff --check` tidak menemukan masalah whitespace.

Pengulangan tes:

```text
node artifacts/api-server/tests/run-booking-payments.mjs
node artifacts/asesmen-platform/tests/run-booking-payment-state.mjs
node artifacts/api-server/build.mjs
```

## Pemeriksaan pesanan 135 di lingkungan yang memiliki akses

Alat inspeksi berikut hanya membaca database yang sudah dikonfigurasi pada lingkungan yang diizinkan:

```text
node scripts/inspect-booking-reservation.mjs 135
```

Script tidak membaca berkas kredensial, memanggil Midtrans, atau menulis database. Keluaran memuat status order, waktu reservasi/tenggat, jadwal, attempt pembayaran, serta booking lain untuk psikolog dan hari yang sama. Token Snap, kontak klien, dan laporan klinis tidak ditampilkan. Status provider aktual tetap perlu dicocokkan tersendiri.

Setelah API dan frontend revisi diterapkan, unpaid lama yang sudah melewati batas tidak lagi menahan slot pada pembacaan availability berikutnya. Tidak diperlukan penghapusan booking atau pembatalan massal untuk melepaskan reservasi tersebut. Jika slot tetap tidak tersedia, periksa booking sah lain, konfigurasi jadwal psikolog, dan kesesuaian versi deployment.

Worker tetap memakai aktivasi eksplisit yang sudah ada. Aktifkan dan periksa `PAYMENT_RECONCILIATION_WORKER_ENABLED=true` sesuai [panduan rilis](payment-release.md) agar verifikasi serta penutupan pembayaran berjalan berkala. Pelepasan masa tahan jadwal tidak bergantung pada flag ini.

Perbedaan expiry halaman dan expiry pembayaran mengikuti [dokumentasi resmi Midtrans](https://docs.midtrans.com/reference/expire-a-snap-session); perilaku Snap yang dapat memberi respons status 404 sebelum kanal dipilih dijelaskan pada [siklus status transaksi](https://docs.midtrans.com/docs/transaction-status-cycle).
