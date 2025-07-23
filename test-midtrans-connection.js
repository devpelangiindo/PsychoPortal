// Test Midtrans connection with new keys
const fetch = require('node-fetch');

async function testMidtransConnection() {
  try {
    console.log('🧪 Testing Midtrans connection...');
    
    // Test create transaction endpoint
    const testData = {
      orderId: 'test_order_123',
      amount: 400000,
      customerDetails: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com'
      },
      items: [{
        id: '7',
        name: 'Asesmen Profil Sensori',
        price: 400000,
        quantity: 1
      }]
    };
    
    const response = await fetch('http://localhost:5000/api/midtrans/create-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify(testData)
    });
    
    const result = await response.json();
    
    if (response.ok && result.token) {
      console.log('✅ Midtrans connection successful!');
      console.log('Token received:', result.token ? 'YES' : 'NO');
      console.log('Redirect URL:', result.redirect_url ? 'YES' : 'NO');
      return true;
    } else {
      console.log('❌ Midtrans connection failed:', result);
      return false;
    }
    
  } catch (error) {
    console.log('❌ Connection test error:', error.message);
    return false;
  }
}

testMidtransConnection();