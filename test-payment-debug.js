// Debug Midtrans payment dengan URL dan client key yang benar
import midtransClient from 'midtrans-client';

console.log('🔧 DEBUGGING MIDTRANS PAYMENT ISSUE\n');

// Check environment setup
console.log('📋 Environment Check:');
console.log('SERVER_KEY prefix:', process.env.MIDTRANS_SERVER_KEY?.substring(0, 10));
console.log('CLIENT_KEY prefix:', process.env.MIDTRANS_CLIENT_KEY?.substring(0, 10));
console.log('MERCHANT_ID:', process.env.MIDTRANS_MERCHANT_ID);
console.log('VITE_CLIENT_KEY prefix:', process.env.VITE_MIDTRANS_CLIENT_KEY?.substring(0, 10));

// Verify client key matches
const serverClientKey = process.env.MIDTRANS_CLIENT_KEY;
const viteClientKey = process.env.VITE_MIDTRANS_CLIENT_KEY;
console.log('Client keys match:', serverClientKey === viteClientKey ? '✅' : '❌');

try {
  console.log('\n🧪 Testing with proper sandbox configuration...');
  
  const snap = new midtransClient.Snap({
    isProduction: false, // Force sandbox
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY,
  });

  // Test with minimal but complete transaction
  const testTransaction = {
    transaction_details: {
      order_id: 'debug-test-' + Date.now(),
      gross_amount: 400000,
    },
    customer_details: {
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      phone: '628123456789',
    },
    item_details: [{
      id: 'sensory-assessment',
      name: 'Asesmen Profil Sensori',
      price: 400000,
      quantity: 1,
    }],
    credit_card: {
      secure: true,
    },
    enabled_payments: [
      'credit_card',
      'bca_va',
      'bni_va',
      'bri_va',
      'gopay',
      'shopeepay',
      'qris'
    ],
  };

  console.log('Creating transaction with:', JSON.stringify(testTransaction, null, 2));
  
  const result = await snap.createTransaction(testTransaction);
  
  console.log('\n✅ SUCCESS:');
  console.log('Token:', result.token);
  console.log('Redirect URL:', result.redirect_url);
  
  // Check if URL is sandbox
  const isSandbox = result.redirect_url.includes('sandbox');
  console.log('Is Sandbox URL:', isSandbox ? '✅' : '❌');
  
  console.log('\n📋 Frontend Script URL should be:');
  console.log('Sandbox: https://app.sandbox.midtrans.com/snap/snap.js');
  console.log('Production: https://app.midtrans.com/snap/snap.js');
  
} catch (error) {
  console.error('\n❌ ERROR:', error.message);
  if (error.ApiResponse) {
    console.log('API Response:', error.ApiResponse);
  }
}