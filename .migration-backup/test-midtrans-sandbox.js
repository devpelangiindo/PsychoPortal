// Test Midtrans Sandbox API dengan debugging detail
import midtransClient from 'midtrans-client';

console.log('🔍 DEBUGGING MIDTRANS SANDBOX API\n');

// Tampilkan API keys untuk verifikasi format
console.log('📋 Current API Keys:');
console.log('SERVER_KEY format:', process.env.MIDTRANS_SERVER_KEY?.substring(0, 20) + '...');
console.log('CLIENT_KEY format:', process.env.MIDTRANS_CLIENT_KEY?.substring(0, 20) + '...');
console.log('MERCHANT_ID:', process.env.MIDTRANS_MERCHANT_ID);

// Test dengan parameter minimal
const testOrder = {
  transaction_details: {
    order_id: 'test-debug-' + Date.now(),
    gross_amount: 10000, // Minimal amount untuk test
  },
  customer_details: {
    first_name: 'Test',
    email: 'test@example.com',
  },
  item_details: [{
    id: 'test-item',
    name: 'Test Item',
    price: 10000,
    quantity: 1,
  }],
};

try {
  console.log('\n🧪 Testing Midtrans Snap API...');
  
  const snap = new midtransClient.Snap({
    isProduction: false, // Pastikan sandbox mode
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY,
  });

  console.log('Client initialized, attempting transaction...');
  
  const transaction = await snap.createTransaction(testOrder);
  
  console.log('✅ SUCCESS! Transaction created:');
  console.log('Token:', transaction.token?.substring(0, 20) + '...');
  console.log('Redirect URL:', transaction.redirect_url);
  
} catch (error) {
  console.log('❌ ERROR Details:');
  console.log('Status:', error.httpStatusCode || 'Unknown');
  console.log('Message:', error.message);
  
  if (error.ApiResponse) {
    console.log('API Response:', JSON.stringify(error.ApiResponse, null, 2));
  }
  
  if (error.rawHttpClientData) {
    console.log('Raw Status:', error.rawHttpClientData.status);
    console.log('Raw Data:', error.rawHttpClientData.data);
  }
}