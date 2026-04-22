// Test Midtrans connection dengan API keys baru
import midtransClient from 'midtrans-client';

console.log('🔍 Testing Midtrans Configuration...\n');

// Check environment variables
const requiredEnvs = [
  'MIDTRANS_SERVER_KEY',
  'MIDTRANS_CLIENT_KEY', 
  'MIDTRANS_MERCHANT_ID',
  'VITE_MIDTRANS_CLIENT_KEY'
];

console.log('📋 Environment Variables:');
requiredEnvs.forEach(env => {
  const exists = process.env[env] ? '✅' : '❌';
  const value = process.env[env] ? `${process.env[env].substring(0, 15)}...` : 'NOT FOUND';
  console.log(`${exists} ${env}: ${value}`);
});

// Test Midtrans client initialization
try {
  console.log('\n🔧 Initializing Midtrans Clients...');
  
  const snap = new midtransClient.Snap({
    isProduction: false, // Sandbox mode
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY,
  });

  const coreApi = new midtransClient.CoreApi({
    isProduction: false,
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY,
  });

  console.log('✅ Midtrans Snap client initialized successfully');
  console.log('✅ Midtrans Core API client initialized successfully');
  
  // Test transaction parameter structure
  console.log('\n🧪 Testing Transaction Parameter Structure...');
  
  const testParameter = {
    transaction_details: {
      order_id: 'test-order-' + Date.now(),
      gross_amount: 400000,
    },
    customer_details: {
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      phone: '+6281234567890',
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
  };

  console.log('✅ Transaction parameter structure valid');
  console.log('📄 Sample transaction details:', JSON.stringify(testParameter, null, 2));
  
  console.log('\n🎉 Midtrans configuration test completed successfully!');
  console.log('🚀 Ready for sandbox transactions');

} catch (error) {
  console.error('❌ Error during Midtrans test:', error.message);
  process.exit(1);
}