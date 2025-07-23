// Test payment flow end-to-end dengan API keys yang benar
const axios = require('axios');

async function testPaymentFlow() {
  console.log('🧪 TESTING PAYMENT FLOW END-TO-END\n');
  
  try {
    // 1. Test user registration
    console.log('1️⃣ Testing user registration...');
    const registerData = {
      email: 'testuser@example.com',
      password: 'testpass123',
      firstName: 'Test',
      lastName: 'User',
      whatsappNumber: '628123456789'
    };
    
    const registerResponse = await axios.post('http://localhost:5000/api/auth/register', registerData);
    console.log('✅ Registration successful');
    
    // 2. Extract auth token
    const authToken = registerResponse.data.token;
    const headers = { Authorization: `Bearer ${authToken}` };
    
    // 3. Test create order
    console.log('2️⃣ Testing order creation...');
    const orderData = {
      items: [{
        assessmentId: 7, // Sensory Profile
        quantity: 1
      }]
    };
    
    const orderResponse = await axios.post('http://localhost:5000/api/orders', orderData, { headers });
    const orderId = orderResponse.data.id;
    console.log('✅ Order created:', orderId);
    
    // 4. Test Midtrans transaction creation
    console.log('3️⃣ Testing Midtrans transaction...');
    const transactionData = {
      orderId: `order_${orderId}_${Date.now()}`,
      amount: 400000,
      customerDetails: {
        first_name: 'Test',
        last_name: 'User',
        email: 'testuser@example.com',
        phone: '628123456789'
      },
      itemDetails: [{
        id: '7',
        name: 'Asesmen Profil Sensori',
        price: 400000,
        quantity: 1
      }]
    };
    
    const transactionResponse = await axios.post('http://localhost:5000/api/midtrans/create-transaction', transactionData, { headers });
    
    console.log('✅ Midtrans transaction created successfully!');
    console.log('Token received:', transactionResponse.data.token ? 'Yes' : 'No');
    console.log('Redirect URL:', transactionResponse.data.redirect_url ? 'Available' : 'Not available');
    
    console.log('\n🎉 PAYMENT FLOW TEST COMPLETED SUCCESSFULLY!');
    console.log('✅ Registration ✅ Order Creation ✅ Midtrans Integration');
    
  } catch (error) {
    console.log('❌ Error during test:', error.response?.data || error.message);
    console.log('Status:', error.response?.status);
  }
}

testPaymentFlow();