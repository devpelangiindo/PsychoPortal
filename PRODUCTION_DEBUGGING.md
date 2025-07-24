# Production Midtrans Payment Issue Debugging Guide

## Issue Summary
Midtrans payment gateway works perfectly in Replit development environment but fails on production domain (pi-psychology.com).

## Identified Problems and Solutions

### 1. Environment Configuration Issues

**Problem**: Production deployment may be using sandbox keys with production Midtrans script URLs.

**Solutions**:
- Ensure production environment variables are properly set
- Verify `NODE_ENV=production` is correctly configured
- Check that production Midtrans keys are used (not sandbox keys)

### 2. CORS and Domain Configuration

**Problem**: Midtrans may not allow the production domain (pi-psychology.com) in their allowed origins.

**Solutions**:
- Add `pi-psychology.com` to Midtrans dashboard allowed domains
- Configure CORS headers properly for production
- Ensure SSL/HTTPS is properly configured

### 3. Script Loading Issues

**Problem**: Production environment may have different script loading behavior.

**Solutions**:
- Increased timeout for Midtrans script loading from 100ms to 500ms
- Added comprehensive error logging for script loading failures
- Validate `window.snap` availability before payment calls

### 4. API Key Validation

**Problem**: Missing or incorrect API keys in production.

**Solutions**:
- Added client-side validation for `VITE_MIDTRANS_CLIENT_KEY`
- Added server-side logging for Midtrans configuration
- Verify all required environment variables are present

## Required Midtrans Dashboard Configuration

For production domain `pi-psychology.com`, ensure these settings:

1. **Payment Settings**:
   - Environment: Production (if using production keys) or Sandbox (if testing)
   - Allowed payment methods: Credit Card, Bank Transfer, E-wallets, etc.

2. **Security Settings**:
   - Allowed domains: `pi-psychology.com`, `*.pi-psychology.com`
   - Webhook URL: `https://pi-psychology.com/api/midtrans/webhook`
   - Finish redirect URL: `https://pi-psychology.com/payment-return`

3. **CORS Configuration**:
   - Add `https://pi-psychology.com` to allowed origins
   - Enable credentials if needed

## Environment Variables Checklist

Ensure these are set in production:

```
NODE_ENV=production
MIDTRANS_SERVER_KEY=SB-... (sandbox) or Mid-... (production)
MIDTRANS_CLIENT_KEY=SB-... (sandbox) or Mid-... (production)
MIDTRANS_MERCHANT_ID=...
VITE_MIDTRANS_CLIENT_KEY=SB-... (sandbox) or Mid-... (production)
```

## Debugging Steps

1. Check browser console for JavaScript errors
2. Verify network requests to `/api/midtrans/create-transaction`
3. Check server logs for Midtrans initialization messages
4. Verify Midtrans script loading success
5. Test with different browsers and clear cache

## Testing Commands

```bash
# Test API endpoint directly
curl -X POST https://pi-psychology.com/api/midtrans/create-transaction \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"orderId":"test_123","amount":400000,"customerDetails":{"first_name":"Test","email":"test@example.com"},"itemDetails":[{"id":"1","name":"Test","price":400000,"quantity":1}]}'

# Check if Midtrans script loads
curl -I https://app.midtrans.com/snap/snap.js
curl -I https://app.sandbox.midtrans.com/snap/snap.js
```

## Expected Behavior

1. User clicks "Bayar" button
2. Midtrans script loads successfully
3. API call to `/api/midtrans/create-transaction` returns token
4. Midtrans payment popup opens
5. User completes payment
6. Payment completion triggers webhook or auto-completion

## Common Production Issues

1. **SSL Certificate Issues**: Ensure valid HTTPS certificate
2. **Environment Variable Loading**: Verify .env files are loaded correctly
3. **Server Restart**: Production server may need restart after environment changes
4. **CDN/Caching**: Clear any CDN or browser caches
5. **Firewall**: Ensure Midtrans webhooks can reach production server