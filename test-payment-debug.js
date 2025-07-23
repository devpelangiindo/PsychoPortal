// Test script to debug Midtrans payment issue
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fetch = require('node-fetch');

async function testPaymentFlow() {
  console.log('🧪 Testing Midtrans payment flow...\n');

  try {
    // Step 1: Login user
    console.log('1️⃣ Logging in user...');
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'tommysigit@gmail.com',
        password: 'testuser123'
      })
    });

    if (!loginResponse.ok) {
      console.log('❌ Login failed');
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log('✅ Login successful');

    // Step 2: Create order
    console.log('\n2️⃣ Creating order...');
    const orderResponse = await fetch('http://localhost:5000/api/orders', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        items: [{
          assessmentId: 7,
          price: 400000
        }]
      })
    });

    const orderData = await orderResponse.json();
    console.log('✅ Order created:', orderData.id);

    // Step 3: Test Midtrans transaction creation
    console.log('\n3️⃣ Testing Midtrans transaction...');
    const transactionResponse = await fetch('http://localhost:5000/api/midtrans/create-transaction', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        orderId: `order_${orderData.id}_${Date.now()}`,
        amount: 400000,
        customerDetails: {
          first_name: 'Tommy',
          last_name: 'Sigit',
          email: 'tommysigit@gmail.com',
          phone: '+628123456789'
        },
        itemDetails: [{
          id: '7',
          name: 'Asesmen Profil Sensori',
          price: 400000,
          quantity: 1
        }]
      })
    });

    if (transactionResponse.ok) {
      const transactionData = await transactionResponse.json();
      console.log('✅ Midtrans transaction successful!');
      console.log('   Token length:', transactionData.token?.length || 0);
      console.log('   Has redirect URL:', !!transactionData.redirect_url);
    } else {
      const errorData = await transactionResponse.json();
      console.log('❌ Midtrans transaction failed:', errorData);
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Run test
testPaymentFlow();