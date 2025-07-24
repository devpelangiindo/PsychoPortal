# Midtrans Production Debugging - Sandbox Environment

## Current Issue
Payment gateway bekerja di Replit development tapi gagal di domain production pi-psychology.com menggunakan **sandbox environment**.

## Debugging Steps untuk Production Domain

### 1. Check Environment Variables di Production
Pastikan environment variables ini ter-set di production deployment:

```bash
# Di production server, check environment variables:
echo $NODE_ENV                    # harus "production"
echo $MIDTRANS_SERVER_KEY         # harus dimulai dengan "Mid-server"
echo $MIDTRANS_CLIENT_KEY         # harus dimulai dengan "Mid-client"  
echo $VITE_MIDTRANS_CLIENT_KEY    # harus sama dengan MIDTRANS_CLIENT_KEY
```

### 2. Test API Endpoint Directly
Test endpoint Midtrans langsung dari browser/curl:

```bash
# Test dari browser console di pi-psychology.com:
fetch('/api/midtrans/create-transaction', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('accessToken')
  },
  body: JSON.stringify({
    orderId: 'test_' + Date.now(),
    amount: 400000,
    customerDetails: {
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      phone: '081234567890'
    },
    itemDetails: [{
      id: '7',
      name: 'Test Assessment',
      price: 400000,
      quantity: 1
    }]
  })
}).then(r => r.json()).then(console.log).catch(console.error);
```

### 3. Check Browser Console Errors
Di pi-psychology.com, buka browser console dan cari error messages saat:
1. Loading halaman cart
2. Klik tombol "Bayar"
3. Loading Midtrans script

### 4. Midtrans Dashboard Configuration

**PENTING**: Tambahkan domain production ke Midtrans Dashboard:

1. Login ke https://dashboard.sandbox.midtrans.com
2. Go to Settings → Configuration
3. Tambahkan domain:
   - `pi-psychology.com`
   - `https://pi-psychology.com`
   - `*.pi-psychology.com`

4. Set Payment Notification URL:
   - `https://pi-psychology.com/api/midtrans/webhook`

5. Set Finish Redirect URL:
   - `https://pi-psychology.com/payment-return`

### 5. CORS Headers Check
Cek apakah server production mengirim CORS headers yang benar:

```bash
# Test CORS dari browser lain:
curl -H "Origin: https://pi-psychology.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type,Authorization" \
     -X OPTIONS \
     https://pi-psychology.com/api/midtrans/create-transaction
```

### 6. Network Tab Analysis
Di pi-psychology.com:
1. Buka DevTools → Network tab
2. Coba proses payment
3. Lihat apakah ada request yang failed:
   - `/api/midtrans/create-transaction`
   - `https://app.sandbox.midtrans.com/snap/snap.js`

### 7. SSL Certificate Check
Pastikan HTTPS certificate valid:

```bash
curl -I https://pi-psychology.com
```

## Expected Error Messages

### Jika Domain Tidak Terdaftar di Midtrans:
```
"unauthorized: SNAP token is not valid"
```

### Jika CORS Issue:
```
"CORS error: has been blocked by CORS policy"
```

### Jika Environment Variables Missing:
```
"VITE_MIDTRANS_CLIENT_KEY tidak dikonfigurasi"
```

### Jika Script Loading Fail:
```
"Failed to load Midtrans script"
```

## Quick Fix untuk Testing

Sementara untuk debugging, tambahkan logging tambahan di console:

1. Check apakah environment variables ter-load:
```javascript
console.log('Environment Check:', {
  isProd: import.meta.env.PROD,
  clientKey: import.meta.env.VITE_MIDTRANS_CLIENT_KEY?.substring(0, 10),
  mode: import.meta.env.MODE
});
```

2. Check network connectivity:
```javascript
fetch('https://app.sandbox.midtrans.com/snap/snap.js')
  .then(r => console.log('Midtrans script accessible:', r.ok))
  .catch(e => console.error('Cannot reach Midtrans:', e));
```

## Recommended Testing Order

1. ✅ Test environment variables
2. ✅ Test API endpoint response  
3. ✅ Test Midtrans script loading
4. ✅ Configure Midtrans dashboard domains
5. ✅ Test end-to-end payment flow

## Success Indicators

Payment working correctly when you see:
1. "Midtrans script loaded successfully" in console
2. API returns valid token (36-char UUID)
3. Midtrans popup opens without errors
4. Payment completion triggers webhook/auto-completion