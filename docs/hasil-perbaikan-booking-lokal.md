# Hasil perbaikan pembayaran dan booking — lokal

Perubahan dikerjakan pada salinan kode lokal. Website aktif dan data produksi order 116–117 belum diubah. Pengujian menggunakan database terisolasi dan respons Midtrans tiruan; tidak melakukan pembayaran sungguhan.

## Temuan pada kode sebelumnya

- Pembacaan pesanan dapat membatalkan pesanan berdasarkan waktu lokal `updatedAt`, tanpa memastikan status terakhir di Midtrans. Sinkronisasi massal hanya mencari pesanan pending, sehingga pesanan yang telanjur cancelled terlewat.
- Pembuatan pembayaran ulang menimpa referensi pembayaran sebelumnya. Notifikasi pembayaran dengan ID lama kemudian ditolak meskipun pembayaran tersebut sah.
- Pencatatan manual membuat pesanan baru dan sebelumnya secara default mencatatnya sudah dibayar. Tidak ada hubungan ke pembayaran pesanan website asal.
- Pemeriksaan ketersediaan dan perubahan jadwal belum sepenuhnya dilindungi dalam transaksi yang sama dengan penguncian slot.

Temuan ini menunjukkan jalur kegagalan yang diperbaiki. Penyebab pasti insiden produksi 116–117 tetap memerlukan pencocokan data pesanan, riwayat notifikasi, serta status dan waktu pembayaran dari Midtrans produksi.

## Perubahan yang diterapkan

1. **Pembayaran dan booking diselaraskan.** Server memverifikasi ID, nominal, status, serta waktu pembayaran. Pembayaran sah mengaktifkan booking dan tersedia untuk dasbor serta resi. Notifikasi berulang tidak membuat booking tambahan.
2. **Kedaluwarsa dan pembayaran ulang diperbaiki.** Tenggat disimpan secara tetap, bukan diperpanjang oleh perubahan data lain. Token pembayaran aktif dipakai kembali. Percobaan baru menunggu penutupan percobaan sebelumnya yang terkonfirmasi provider. Gangguan jaringan atau respons belum pasti tidak dianggap sebagai pembatalan. Seluruh ID percobaan pembayaran tetap disimpan.
3. **Slot dilindungi.** Pembuatan, pembayaran terlambat, rekonsiliasi, dan pemindahan jadwal memeriksa benturan di bawah penguncian database. Bila uang diterima setelah slot terisi, pembayaran tetap tercatat dan jadwal ditandai untuk ditinjau. Admin/CSO dapat memindahkannya ke slot kosong melalui editor jadwal.
4. **Pemulihan berjalan berkala.** Worker memeriksa pesanan yang perlu diverifikasi, termasuk pesanan lama yang telanjur cancelled. Attempt yang belum selesai tetap dipantau setelah order direkonsiliasi agar pembayaran kedua tanpa webhook tidak terlewat.
5. **Dasbor dan resi diperbarui.** Daftar staf diperbarui berkala dan saat kembali ke halaman. Error pengambilan data tidak ditampilkan sebagai daftar kosong. Resi menggunakan ID, metode, nominal, dan waktu pembayaran asal; waktu input manual diberi label sebagai waktu pencatatan.
6. **Booking ganda ditangani sebagai alur sistem.** Form manual memisahkan booking baru dari pemulihan order website. Pemulihan cukup memakai nomor order dan tidak membuat pesanan baru. Sistem mencegah input ulang untuk klien dan sesi yang sudah ada.
7. **Pasangan yang terlanjur ganda dapat direkonsiliasi.** Admin/CSO memilih pasangan, memeriksa preview dan bukti provider, lalu mencatat alasan. Order asal menyimpan pembayaran; booking manual menjadi satu layanan operasional dengan referensi pembayaran asal. ID, laporan, dan snapshot audit dipertahankan. Pasangan yang sudah didaftarkan dapat diproses otomatis setelah bukti pembayaran valid; data yang tidak cocok tidak digabung otomatis.
8. **Pembayaran kedua memerlukan pemeriksaan.** Sistem tidak mengasumsikan dua attempt lunas sebagai satu pembayaran. Penerimaan tersebut ditandai untuk pemeriksaan keuangan. Status negatif atau pembalikan pada attempt yang sebelumnya lunas juga ditandai untuk diperiksa tanpa menghapus riwayat pembayaran. Perubahan ini tidak melakukan refund otomatis.

Detail API dan prosedur rekonsiliasi tersedia dalam [booking-payment-reconciliation.md](booking-payment-reconciliation.md).

## GoPay pada HP dan QRIS pada laptop

Midtrans secara default memilih alur pembukaan aplikasi pada layar kecil dan QRIS pada layar lebar. Perbedaan tampilan tersebut sesuai perilaku Snap dan tidak dengan sendirinya membuktikan perbedaan hak akses akun. Nama kanal yang dikirim server juga diperbaiki mengikuti dokumentasi Midtrans. Ketersediaan kanal tetap mengikuti aktivasi merchant dan kemampuan provider. Lihat [GoPay & QRIS](https://docs.midtrans.com/reference/gopay) dan [Snap Advanced Feature](https://docs.midtrans.com/docs/snap-advanced-feature).

## Validasi dan batas pemeriksaan

Tes mencakup penyimpanan booking dan pendapatan, permintaan SDK Midtrans, lifecycle pembayaran, serta rekonsiliasi dengan database PGlite terisolasi. Simulasi 116–117 memeriksa satu booking aktif, resi pembayaran asal, ID manual yang tetap ada, laporan yang terjaga, snapshot audit, dan idempotensi.

Hasil tes otomatis: **57 dari 57 lulus**.

| Kelompok pengujian | Lulus |
| --- | ---: |
| Penyimpanan booking, pemindahan jadwal, pendapatan | 10 |
| Integrasi SDK Midtrans dengan provider tiruan | 4 |
| Lifecycle pembayaran, kegagalan jaringan, penutupan Snap, pembalikan | 23 |
| Rekonsiliasi, audit, akses peran, simulasi 116–117 | 14 |
| Sumber resi, tampilan status, penghitungan pembayaran | 6 |

Perintah pengulangan tes:

```text
node artifacts/api-server/tests/run-booking-payments.mjs
node artifacts/asesmen-platform/tests/run-booking-payment-state.mjs
```

Build backend dan frontend untuk mode produksi berhasil dijalankan secara lokal. Dependensi native Rollup untuk Windows yang belum tersedia dipasang pada dependensi lokal; versi dependensi dan lockfile tidak diubah. Satu perintah tes ditambahkan pada manifest API.

Panel admin diuji melalui browser dengan data tiruan lokal: pencarian pasangan 116–117, pemilihan kandidat, serta pergantian formulir ke pemulihan order asal. Pemeriksaan ini bukan pengujian transaksi Midtrans langsung atau pengujian seluruh dasbor terhadap database produksi.

Pemeriksaan tipe dibandingkan dengan kode awal untuk memisahkan error lama dari error perubahan ini. API memiliki 98 diagnostik lama pada kode awal dan akhir; frontend memiliki 52 pada kode awal dan akhir. **Tidak ada diagnostik tipe baru.** Pemeriksaan tipe seluruh proyek belum bersih karena error lama tersebut.

Sebelum penerapan ke website aktif, konfigurasi produksi, migrasi tambahan, dan data asli 116–117 tetap harus diverifikasi.
