# Berbagi artikel

Halaman publik memakai tombol **Bagikan** pada setiap artikel di daftar dan menu
floating **Bagikan Artikel** pada halaman isi. Menu floating ada di sisi kiri pada
layar lebar, dan menjadi tombol berlabel di kiri bawah pada layar kecil. Hotline
WhatsApp tetap berada di kanan bawah.

## Kanal berbagi

- Facebook membuka dialog berbagi URL artikel.
- WhatsApp menyiapkan judul dan URL; pengguna memilih penerima sendiri.
- Instagram/TikTok menyediakan kartu gambar, unduh gambar, dan salin caption serta
  URL. Menu berbagi gambar bawaan hanya muncul bila perangkat mendukungnya.
- Salin Tautan menyediakan pilihan salin manual bila clipboard ditolak browser.
- Bagikan Lainnya memakai Web Share API bila tersedia.

Tidak ada pengiriman pesan atau publikasi otomatis melalui akun pengunjung.
Dialog Instagram/TikTok menjelaskan langkah unggah; ketersediaan aplikasi tujuan
dan bentuk preview ditentukan perangkat/aplikasi tujuan.

## Metadata dan gambar

Semua tautan berbagi menggunakan `https://pi-psychology.com/artikel/:slug`, tanpa
parameter kategori. Endpoint API berikut hanya melayani artikel yang terbit dan
belum dihapus:

- `/api/articles/:slug/share-page`: HTML aplikasi marketing dengan judul,
  deskripsi, canonical, Open Graph dan Twitter Card khusus artikel.
- `/api/articles/:slug/share-image.jpg`: foto sampul JPEG 1200×630 untuk preview
  tautan WhatsApp/Facebook. Judul/ringkasan tersedia sebagai metadata terpisah.
- `/api/articles/:slug/share-card.jpg`: kartu JPEG 1080×1350 berisi foto, judul,
  merek dan domain untuk unggahan manual Instagram/TikTok.

Foto mengikuti titik fokus gambar yang dipilih admin. Foto kosong atau rusak
memakai desain pengganti merek. Metadata memakai URL gambar berversi agar edit
artikel dapat dibaca kembali oleh platform. Cache masing-masing platform masih
dapat menyimpan preview lama di luar kendali website.

API mengambil template marketing dari `ARTICLE_SITE_URL/index.html` dengan timeout
4 detik dan cache 30 detik. URL tersebut adalah berkas statis sehingga tidak
memicu ulang rewrite artikel. Saat template sementara gagal diambil, API memakai
template cache terbatas atau menyajikan artikel HTML yang tetap dapat dibaca.
HTML artikel memakai `Cache-Control: no-store`; endpoint gambar memeriksa status
publikasi sebelum memakai cache internal atau mengembalikan respons 304.

Konfigurasi server opsional (nilai produksi ini juga menjadi default):

```dotenv
ARTICLE_SITE_URL=https://pi-psychology.com
ARTICLE_API_PUBLIC_URL=https://psychoportal-api-k3k5.onrender.com
```

## Penerapan

1. Deploy API dan frontend dengan kode baru terlebih dahulu.
2. Periksa endpoint `share-page` langsung pada API: status 200, metadata judul
   sesuai artikel dan referensi aset `/assets/...` tersedia pada deployment
   marketing aktif. Periksa kedua gambar serta artikel yang tidak tersedia.
3. Setelah API siap, aktifkan rewrite khusus pada situs marketing, di atas
   catch-all SPA:

   ```yaml
   - type: rewrite
     source: /artikel/:slug
     destination: https://psychoportal-api-k3k5.onrender.com/api/articles/:slug/share-page
   - type: rewrite
     source: /*
     destination: /index.html
   ```

4. Periksa URL asli `https://pi-psychology.com/artikel/:slug`: tidak berpindah
   domain, respons HTML awal memuat metadata khusus, dan aplikasi beserta gambar
   termuat. Periksa desktop/ponsel, tombol saat scroll, salin dan unduh.
5. Validasi preview Facebook melalui Sharing Debugger. Pemeriksaan pesan WhatsApp
   dilakukan oleh pengguna di aplikasi; jangan mengirim pesan sebagai pengujian
   tanpa permintaan pengguna.

`render.yaml` mencatat aturan final. Jika layanan dikelola melalui Dashboard,
samakan aturan Dashboard dengan file tersebut. Sinkronisasi Blueprint harus
dilakukan setelah endpoint API siap, agar rewrite tidak mengarah ke versi lama.

## Pengujian

```sh
pnpm --filter @workspace/api-server test:article-sharing
pnpm --filter @workspace/api-server build
PORT=8081 BASE_PATH=/ pnpm --filter @workspace/marketing-site build
```

Tes menggunakan PostgreSQL in-memory dan template simulasi, tanpa token akun
sosial atau publikasi konten. Tes meliputi escaping HTML, metadata awal, crop
foto, ukuran gambar, cache template, status publikasi, dan timeout template.
