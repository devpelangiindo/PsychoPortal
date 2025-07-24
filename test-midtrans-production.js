// Quick test untuk memastikan Midtrans configuration benar
import midtrans from 'midtrans-client';

console.log('Testing Midtrans Configuration for Production Domain...');

// Test environment variables
console.log('Environment Variables:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- MIDTRANS_SERVER_KEY:', process.env.MIDTRANS_SERVER_KEY ? 'EXISTS (length: ' + process.env.MIDTRANS_SERVER_KEY.length + ')' : 'MISSING');
console.log('- MIDTRANS_CLIENT_KEY:', process.env.MIDTRANS_CLIENT_KEY ? 'EXISTS (length: ' + process.env.MIDTRANS_CLIENT_KEY.length + ')' : 'MISSING');
console.log('- VITE_MIDTRANS_CLIENT_KEY:', process.env.VITE_MIDTRANS_CLIENT_KEY ? 'EXISTS (length: ' + process.env.VITE_MIDTRANS_CLIENT_KEY.length + ')' : 'MISSING');

// Initialize Midtrans clients
const snap = new midtrans.Snap({
  isProduction: false, // Always sandbox for testing
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY
});

const coreApi = new midtrans.CoreApi({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY
});

console.log('\nMidtrans Clients Initialized:');
console.log('- Snap client:', snap ? 'OK' : 'FAILED');
console.log('- Core API client:', coreApi ? 'OK' : 'FAILED');

// Test creating a transaction
console.log('\nTesting transaction creation...');

const testTransactionData = {
  transaction_details: {
    order_id: 'test_production_' + Date.now(),
    gross_amount: 400000
  },
  customer_details: {
    first_name: 'Test',
    last_name: 'Production',
    email: 'test@pi-psychology.com',
    phone: '081234567890'
  },
  item_details: [{
    id: '7',
    name: 'Test Asesmen Profil Sensori',
    price: 400000,
    quantity: 1
  }]
};

snap.createTransaction(testTransactionData)
  .then((transaction) => {
    console.log('✅ Transaction created successfully!');
    console.log('- Token:', transaction.token ? 'EXISTS (36 chars)' : 'MISSING');
    console.log('- Redirect URL:', transaction.redirect_url ? 'EXISTS' : 'MISSING');
    console.log('- Environment detected:', transaction.redirect_url?.includes('sandbox') ? 'SANDBOX' : 'PRODUCTION');
    
    if (transaction.redirect_url) {
      console.log('- Script URL should be: https://app.sandbox.midtrans.com/snap/snap.js');
    }
  })
  .catch((error) => {
    console.error('❌ Transaction creation failed:');
    console.error('- Error:', error.message);
    console.error('- HTTP Code:', error.httpStatusCode);
    console.error('- API Response:', error.ApiResponse);
  });