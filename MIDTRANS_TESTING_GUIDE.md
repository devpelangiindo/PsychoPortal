# Panduan Testing Midtrans Sandbox

## 🔑 Credential yang Dibutuhkan (Sudah Terkonfigurasi)
✅ **MIDTRANS_SERVER_KEY** - Server Key untuk backend API
✅ **MIDTRANS_CLIENT_KEY** - Client Key untuk frontend
✅ **MIDTRANS_MERCHANT_ID** - Merchant ID unik
✅ **VITE_MIDTRANS_CLIENT_KEY** - Client Key untuk Vite frontend

## 💳 Test Credit Cards (Midtrans Sandbox)

### Sukses
- **Visa**: 4811 1111 1111 1114
- **Mastercard**: 5573 3810 1095 1122
- **JCB**: 3528 2033 2456 1411
- **CVV**: 123
- **Expiry**: 12/25 (format MM/YY)
- **Nama**: Test User

### Gagal (untuk testing error handling)
- **Visa Gagal**: 4911 1111 1111 1113
- **Decline**: 4411 1111 1111 1118

## 🏦 Virtual Account Test Numbers

### BCA VA
- **Nomor VA**: 12345678901 (11 digit)
- **Status**: Otomatis sukses setelah 5 detik

### BNI VA
- **Nomor VA**: 12345678901
- **Status**: Otomatis sukses

### BRI VA
- **Nomor VA**: 12345678901
- **Status**: Otomatis sukses

## 📱 E-Wallet Testing

### GoPay
- **PIN**: 123456
- **OTP**: 112233
- **Status**: Simulasi pembayaran sukses

### ShopeePay
- **PIN**: 123456
- **Status**: Otomatis approve

## 🔄 Flow Testing yang Disarankan

### 1. Registration & Login
1. Daftar user baru di `/register`
2. Login dengan credentials
3. Verifikasi dashboard dapat diakses

### 2. Assessment Purchase
1. Buka halaman `/` (beranda)
2. Pilih "Asesmen Profil Sensori" (Rp 400,000)
3. Klik "Tambah ke Keranjang"
4. Buka cart dan proceed ke checkout

### 3. Payment Testing
1. **Credit Card Testing**:
   - Gunakan card number: 4811 1111 1111 1114
   - CVV: 123, Expiry: 12/25
   - Nama: Test User

2. **Virtual Account Testing**:
   - Pilih BCA/BNI/BRI VA
   - Salin nomor VA yang diberikan
   - Simulasi pembayaran (auto-approve setelah 5 detik)

3. **E-Wallet Testing**:
   - Pilih GoPay/ShopeePay
   - Gunakan PIN test: 123456
   - Approve pembayaran

### 4. Verification
1. Cek halaman payment success
2. Kembali ke dashboard
3. Verifikasi assessment tersedia untuk dikerjakan
4. Test mengerjakan assessment
5. Download PDF hasil

## 🎯 Test Cases yang Harus Dijalankan

### ✅ Positive Test Cases
- [ ] User registration berhasil
- [ ] Login berhasil
- [ ] Add to cart berhasil
- [ ] Order creation berhasil
- [ ] Payment dengan credit card berhasil
- [ ] Payment dengan VA berhasil
- [ ] Payment dengan e-wallet berhasil
- [ ] Assessment access setelah payment
- [ ] Assessment completion
- [ ] PDF download

### ❌ Negative Test Cases
- [ ] Payment dengan invalid card
- [ ] Payment timeout handling
- [ ] Unauthorized access attempt
- [ ] Invalid order processing

## 🚀 Langkah Testing Cepat

### Scenario 1: Credit Card Success
```
1. Register: tommysigit@gmail.com / password123
2. Add Sensory Assessment to cart
3. Checkout → Credit Card
4. Card: 4811 1111 1111 1114, CVV: 123, Exp: 12/25
5. Verify payment success
6. Check assessment access
```

### Scenario 2: Virtual Account Success  
```
1. Login dengan user yang sama
2. Add another assessment
3. Checkout → BCA Virtual Account
4. Copy VA number
5. Auto-payment simulation (5 seconds)
6. Verify success
```

## 📊 Expected Results
- **Order Status**: "completed" setelah payment sukses
- **Payment Status**: "settlement" 
- **User Assessment**: Status "available" setelah payment
- **Webhook**: Notifikasi real-time ke server
- **Redirect**: Otomatis ke payment-success page

## 🐛 Troubleshooting Common Issues
- **"Pembayaran Gagal"**: Cek MIDTRANS_MERCHANT_ID
- **Token tidak ditemukan**: Refresh page, cek network
- **Unauthorized**: Re-login, cek JWT token
- **Assessment tidak muncul**: Cek webhook, manual simulate payment