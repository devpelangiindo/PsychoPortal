# Perbaikan sinkronisasi pembayaran, booking, jadwal, dan resi

Catatan ini merekam perbaikan sebelumnya. Aturan masa tahan jadwal di bawah telah digantikan oleh [revisi reservasi 15 menit](perbaikan-reservasi-15-menit.md): pembayaran yang belum terkonfirmasi tidak lagi menahan slot setelah tenggat, sementara verifikasi keuangan tetap berjalan.

## Ruang lingkup dan status

Perbaikan tersedia pada kode lokal. Fokusnya mencegah pembayaran yang sudah diterima Midtrans tetap dianggap dibatalkan, booking tidak muncul, atau slot terlepas secara keliru. Pembahasan push/deployment dan penanganan pasangan order manual tetap ditangguhkan. Perubahan lokal sebelumnya dipertahankan; tidak ada perubahan data produksi, push GitHub, atau deployment dalam pekerjaan ini.

## Alur yang diperbaiki

- Server memverifikasi pembayaran dan menyimpan semua ID percobaan pembayaran. Notifikasi berulang maupun notifikasi lama tidak boleh membatalkan pembayaran yang sudah terverifikasi lunas.
- Aktivasi booking dan pemeriksaan benturan jadwal dilakukan dalam transaksi database dengan penguncian per psikolog/tanggal. Slot tetap ditahan selama pembayaran eksternal belum dapat dipastikan selesai atau ditutup.
- Pembacaan riwayat pesanan tidak membatalkan pembayaran hanya karena tenggat lokal lewat. Server memeriksa status provider dan dapat memulihkan transaksi melalui pemeriksaan berkala tanpa bergantung pada browser klien tetap terbuka.
- Dasbor staf dan klien memakai status pesanan yang konsisten. Resi mengacu pada pembayaran terverifikasi. Respons status pembayaran juga menyediakan ID pembayaran dan nominal penerimaan.
- Bila pembayaran terlambat terkonfirmasi setelah slot sudah terisi, pembayaran serta resinya tetap tercatat dan jadwal ditandai untuk pemeriksaan, tanpa membuat dua booking aktif pada slot yang sama.

## Celah tambahan yang ditutup pada pemeriksaan ulang

1. **Formulir menampilkan jadwal lama.** Ketersediaan diperbarui setiap 10 detik dan ketika pengguna kembali ke halaman. Pilihan slot yang sudah tidak tersedia dibersihkan setelah respons berhasil. Gangguan pengambilan data tidak menghapus isian; slot milik booking yang sudah tersimpan tidak dibersihkan karena reservasinya sendiri.
2. **Konfirmasi pembayaran bersamaan dengan pemindahan jadwal.** Server membaca ulang booking setelah memperoleh kunci. Jika tanggal/provider berubah, transaksi diulang dengan kunci jadwal terbaru, maksimal tiga kali. Pemeriksaan tidak menggunakan snapshot jadwal lama.
3. **Flag booking lama bertentangan dengan status order.** Pemeriksaan benturan mengikuti status order yang menjadi sumber kebenaran. Flag booking cancelled yang tertinggal tidak melepaskan slot milik order paid atau pembayaran eksternal yang belum selesai. Order yang memang kedaluwarsa atau dalam pemeriksaan jadwal tidak dianggap reservasi aktif secara keliru.
4. **Gangguan verifikasi terlihat seperti pembatalan.** Halaman pembayaran memperhatikan hasil sinkronisasi `failed`, bukan hanya keberhasilan respons HTTP. Respons yang belum pasti tetap diperiksa ulang. Dasbor juga membedakan inisialisasi/verifikasi yang belum pasti dari kegagalan pembayaran yang sudah diketahui.

## Hasil pengujian

**61 dari 61 tes otomatis lulus.**

| Kelompok | Lulus |
| --- | ---: |
| Penyimpanan booking, perubahan jadwal, pendapatan | 10 |
| Integrasi SDK Midtrans dengan provider tiruan | 4 |
| Lifecycle pembayaran dan penguncian slot | 27 |
| Regresi rekonsiliasi yang sudah tersedia sebelumnya | 14 |
| Status pembayaran, sumber resi, penghitungan pembayaran | 6 |

Empat tes lifecycle tambahan memeriksa pembacaan ulang jadwal setelah simulasi pemindahan, flag cancelled yang tertinggal pada booking paid, reservasi eksternal yang belum selesai, dan status pemeriksaan jadwal.

Dua skenario browser pada aplikasi hasil build juga lulus:

- Pesanan lokal cancelled/expired dengan verifikasi provider gagal tetap diperiksa enam kali, lalu menampilkan status belum dapat dipastikan; tidak ditampilkan sebagai pembayaran tidak aktif.
- Verifikasi pertama gagal, kemudian verifikasi kedua berhasil: halaman berubah menjadi pembayaran terkonfirmasi.

Build backend dan frontend berhasil. Perbandingan diagnostik tipe dengan kode awal tidak menemukan diagnostik baru: API tetap memiliki 98 diagnostik lama dan frontend 52. Pemeriksaan tipe seluruh proyek belum bersih karena diagnostik lama tersebut.

Perintah tes otomatis:

```text
node artifacts/api-server/tests/run-booking-payments.mjs
node artifacts/asesmen-platform/tests/run-booking-payment-state.mjs
```

## Batas pemeriksaan

Tes memakai PGlite dan provider tiruan yang terisolasi. Skenario browser memakai server localhost tanpa koneksi ke database atau Midtrans produksi. Tidak ada transaksi pembayaran sungguhan atau data tiruan yang dimasukkan ke produksi.

Pengujian ini tidak menyatakan kasus pelanggan produksi sudah diperbaiki. Data asli, pengiriman notifikasi Midtrans, konfigurasi aktif, dan tampilan seluruh akun produksi belum diperiksa. ID pembayaran historis yang pernah tertimpa dan sama sekali tidak tersimpan tetap memerlukan pencocokan dengan bukti Midtrans; riwayat baru sudah disimpan untuk mencegah kehilangan referensi berikutnya.
