# Rekonsiliasi pembayaran dan booking pengganti

Order pembayaran online tetap menjadi sumber keuangan. Booking manual yang dibuat untuk mengganti sesi yang sama tetap menjadi satu booking operasional. Rekonsiliasi menghubungkan keduanya tanpa menghapus order, riwayat provider, atau laporan konseling. Resi order asal mengacu ke ID attempt yang benar-benar dibayar. Jika kode lama sempat menimpa ID tersebut dengan attempt lain, ID sebelumnya dipertahankan dalam snapshot dan riwayat attempt, lalu referensi resi asal dipulihkan ke pembayaran yang terverifikasi. ID manual target tetap dipertahankan.

## Kasus 116 dan 117

`order_116_1792051716673` mengarah ke order internal 116 dan dibuat sekitar 15 Oktober 2026 pukul 15:08:36.673 WIB. `manual_counseling_1792056417566` dibuat sekitar pukul 16:26:57.566 WIB, selisih 1 jam 18 menit 20.893 detik. Pola ID dan selisih waktu belum membuktikan keduanya sesi yang sama atau penyebab insiden. Status manual “paid” adalah pencatatan admin; status tersebut bukan bukti pembayaran kedua.

Sebelum menerapkan rekonsiliasi, verifikasi server harus memperoleh settlement/capture yang diterima Midtrans untuk attempt milik order asal. Nominal harus sama persis. Order dan booking harus memakai akun klien yang sama, psikolog, tanggal, rentang waktu, lokasi, jenis konsultasi, layanan, dan jumlah sesi yang sama. Target harus booking manual. Pembayaran provider terpisah pada target, tautan lain, rantai, atau siklus ditolak. Preview menunjukkan ketidakcocokan tanpa memperbarui database.

Jangan menjalankan sinkronisasi lama yang langsung mengaktifkan booking 116 sementara booking 117 sudah aktif. Payment lifecycle baru memeriksa proposal rekonsiliasi sebelum fulfillment biasa, dan memeriksa ulang konflik jadwal di bawah penguncian database.

## Inspeksi tanpa perubahan data

Script berikut hanya membaca database yang telah dikonfigurasi pada lingkungan yang boleh diperiksa. Script tidak membaca berkas kredensial, tidak memanggil Midtrans, serta tidak menampilkan string koneksi, kontak klien, atau isi laporan klinis. Jangan menaruh kredensial pada command line atau menyalinnya ke chat.

```powershell
node scripts/inspect-booking-reconciliation.mjs 116 117
```

Inspeksi ini belum dijalankan terhadap produksi oleh perubahan kode ini. Cocokkan hasilnya dengan provider order ID, nominal dan settlement time Midtrans, riwayat pengiriman webhook, serta versi backend yang aktif. Bila masih ada ketidakcocokan akun atau sesi, perbaiki sumber data berdasarkan bukti sebelum menjalankan apply; jangan mengakali validasi.

## Alur admin dan CSO

1. `GET /api/admin/booking-reconciliation/candidates?orderId=116` menampilkan order asal dan maksimal 100 kandidat manual dari akun yang sama. `matches` hanya menunjukkan kecocokan data lokal.
2. `POST /api/admin/booking-reconciliation/preview` dengan `{ "sourceOrderId": 116, "replacementOrderId": 117 }` memeriksa data dan meminta verifikasi provider melalui server. Preview tidak menyimpan status, proposal, atau audit.
3. `POST /api/admin/booking-reconciliation/apply` dengan kedua ID dan `reason` yang menjelaskan penggantian serta penanganan pencatatan manual. Alasan eksplisit harus sepanjang 10–2000 karakter. Actor selalu diambil dari sesi admin/CSO, bukan request body.
4. Jika data lokal sudah cocok tetapi pembayaran masih menunggu verifikasi, `POST /api/admin/booking-reconciliation/register` dengan kedua ID dan alasan eksplisit mencatat pasangan yang dipilih admin. Endpoint ini tidak menganggap checkbox manual sebagai bukti pembayaran. Worker atau webhook menerapkan pasangan tersebut setelah pembayaran asal benar-benar terverifikasi. Hasilnya memuat `registered`, `status`, `reconciliationId`, dan pesan konfirmasi.

Apply mengambil kunci advisory per psikolog/tanggal, lalu mengunci order menurut ID menaik dan booking menurut ID menaik. Seluruh pemeriksaan akhir, snapshot, perubahan status, dan audit berada dalam satu transaksi. Konflik dengan booking ketiga membatalkan keseluruhan transaksi. Snapshot sebelum perubahan disimpan sekali, bersama actor, alasan, snapshot sesudah, serta bukti provider. Apply ulang pasangan yang sama tidak membuat backup baru atau menghitung pembayaran lagi.

Hasilnya:

- Order asal menyimpan `payment_id` pembayaran provider yang terverifikasi, `completed/paid`, nominal penerimaan, settlement time yang terverifikasi, dan `replaced_by_order_id` ke target. Semua ID attempt sebelumnya tetap ada pada riwayat/snapshot. Booking asal menjadi `replaced` dan tidak memakai slot.
- Order manual menyimpan ID/method manualnya, `payment_source_order_id` ke asal, dan settlement time yang sama. `paid_amount=0` menunjukkan tidak ada penerimaan uang tambahan. Satu booking target tetap aktif dan laporan/jadwal dipertahankan.
- Rekap pendapatan harus mengecualikan order yang mewarisi pembayaran (`payment_source_order_id IS NOT NULL`). Resi target merujuk pembayaran asal.

## Booking manual baru yang mengacu ke order online

Saat admin mengisi `sourceOrderId` pada formulir manual baru, route mencoba memulihkan order asal setelah verifikasi provider, tanpa membuat order manual baru. Bila pembayaran belum dapat dipastikan, order manual baru tidak dibuat. Pemisahan ini mencegah pencatatan penerimaan baru untuk satu pembayaran.

Untuk pasangan manual yang sudah terlanjur ada, endpoint `register` menyimpan proposal melalui `registerReplacement(sourceOrderId, replacementOrderId, actorId, reason, transactionClient?)`. Pendaftaran proposal belum menyatakan pembayaran diterima. Jika bukti paid kemudian datang melalui webhook atau worker, `applyLinkedReplacementIfAny(sourceOrderId, verifiedPayment, transactionClient?)` menerapkan pasangan yang sudah dipilih admin secara atomik. Proposal yang tidak lagi cocok menimbulkan peninjauan; tidak boleh diteruskan ke fulfillment biasa yang mengaktifkan ulang booking asal. Pembayaran provider kedua pada order asal yang sudah direkonsiliasi juga diblokir dari penerapan pasangan ulang dan perlu ditinjau secara keuangan.

`verifyOrder` dan bukti `verifiedPayment` hanya boleh dibuat dari pemeriksaan provider server. Jangan menerima bukti provider dari JSON browser. Waktu settlement harus dinormalisasi dari WIB provider dan tidak diganti dengan waktu klik admin. Bila memakai transaction client dari pemanggil, pemanggil mengelola COMMIT/ROLLBACK dan harus mengikuti urutan kunci psikolog/tanggal sebelum baris order.

Order asal yang sudah digantikan tetap dipantau worker selama masih ada attempt pembayaran yang belum terminal. Pemantauan tersebut juga berlaku untuk order lama; status `paid` dan tautan ke booking manual tidak menghilangkan kewajiban memeriksa attempt lain. Sebelum otomatis menerapkan pasangan ketika ada attempt lain yang belum selesai, server memeriksa seluruh attempt di provider di luar transaksi penguncian. Ketidakpastian menghasilkan `reconciliation_review`; dana yang telah terverifikasi tetap dicatat lunas dan proposal tidak dianggap selesai. Pembayaran kedua yang terverifikasi menghasilkan `multiple_payments` dan tidak mengaktifkan booking tambahan. Jika attempt lain akhirnya ditutup secara terverifikasi, proses dapat melanjutkan rekonsiliasi secara otomatis.

Respons Core API 404 hanya dikecualikan dari ketidakpastian bila attempt sudah tersimpan `closed`, mempunyai waktu verifikasi, dan bukti provider tersimpan menunjukkan `expire` atau `cancel`. Ini mencakup sesi Snap yang ditutup sebelum memilih channel. Respons 404 pada attempt aktif atau tanpa bukti penutupan tetap membutuhkan verifikasi.

## Verifikasi lokal

```powershell
node artifacts/api-server/tests/run-booking-payments.mjs
```

Runner menjalankan tes storage, SDK Midtrans, payment lifecycle, serta rekonsiliasi. Tes memakai PostgreSQL terisolasi PGlite dan provider palsu; tidak membaca atau memperbarui produksi. Tes meliputi preview tanpa perubahan, kecocokan akun/sesi/nominal, attempt lama yang dibayar, pembayaran provider kedua, rantai tautan, rollback konflik jadwal, snapshot dan idempotensi, proposal yang diselesaikan webhook, pembatasan role/alasan, dan alur gabungan lifecycle–rekonsiliasi untuk pasangan 116/117.
