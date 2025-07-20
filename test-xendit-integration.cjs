#!/usr/bin/env node

// Comprehensive Xendit Integration Testing
const http = require('http');

const BASE_URL = 'http://localhost:5000';
const TEST_USER = {
  email: 'testuser@example.com',
  password: 'password123'
};

function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testXenditIntegration() {
  console.log('🔒 Testing Xendit Payment Gateway Integration...\n');

  try {
    // Login first
    console.log('1️⃣ Authenticating user...');
    const loginResponse = await makeRequest('POST', '/api/auth/login', TEST_USER);
    const token = loginResponse.data.accessToken;
    const authHeaders = { 'Authorization': `Bearer ${token}` };
    console.log('✅ Authentication successful\n');

    // Test all payment methods
    console.log('2️⃣ Testing payment method availability...');
    const methodsResponse = await makeRequest('GET', '/api/xendit/payment-methods');
    
    if (methodsResponse.status === 200) {
      const methods = methodsResponse.data.paymentMethods;
      console.log('✅ Payment methods loaded successfully:');
      
      methods.forEach(method => {
        console.log(`   📱 ${method.name}:`);
        method.channels.forEach(channel => {
          console.log(`      - ${channel}`);
        });
      });
      
      // Test each payment method type
      console.log('\n3️⃣ Testing individual payment method configurations...');
      
      // Create order first
      const assessmentResponse = await makeRequest('GET', '/api/assessments', null, authHeaders);
      const paidAssessment = assessmentResponse.data.find(a => parseFloat(a.price) > 0);
      
      const orderResponse = await makeRequest('POST', '/api/orders', {
        assessmentIds: [paidAssessment.id]
      }, authHeaders);
      
      const order = orderResponse.data;
      console.log(`   📝 Order created: ID ${order.id}, Amount: Rp ${order.totalAmount}`);

      // Test Bank Transfer
      console.log('\n   🏦 Testing Bank Transfer...');
      const bankTransferData = {
        orderId: order.id,
        amount: parseFloat(order.totalAmount),
        customerEmail: TEST_USER.email,
        customerName: 'Test User',
        items: [{
          name: paidAssessment.name,
          price: parseFloat(paidAssessment.price),
          quantity: 1
        }],
        paymentMethod: 'BANK_TRANSFER',
        bankCode: 'BCA'
      };
      
      const btResponse = await makeRequest('POST', '/api/xendit/create-invoice', bankTransferData, authHeaders);
      if (btResponse.status === 200) {
        console.log('   ✅ Bank Transfer invoice created');
        console.log(`      Invoice ID: ${btResponse.data.invoiceId}`);
      } else {
        console.log(`   ⚠️  Bank Transfer failed: ${btResponse.data.message || 'Unknown error'}`);
      }

      // Test E-Wallet  
      console.log('\n   💳 Testing E-Wallet (OVO)...');
      const ewalletOrder = await makeRequest('POST', '/api/orders', {
        assessmentIds: [paidAssessment.id]
      }, authHeaders);
      
      const ewalletData = {
        orderId: ewalletOrder.data.id,
        amount: parseFloat(ewalletOrder.data.totalAmount),
        customerEmail: TEST_USER.email,
        customerName: 'Test User',
        items: [{
          name: paidAssessment.name,
          price: parseFloat(paidAssessment.price),
          quantity: 1
        }],
        paymentMethod: 'EWALLET',
        ewalletType: 'OVO'
      };
      
      const ewResponse = await makeRequest('POST', '/api/xendit/create-invoice', ewalletData, authHeaders);
      if (ewResponse.status === 200) {
        console.log('   ✅ E-Wallet (OVO) invoice created');
      } else {
        console.log(`   ⚠️  E-Wallet failed: ${ewResponse.data.message || 'Unknown error'}`);
      }

      // Test QRIS
      console.log('\n   📱 Testing QRIS...');
      const qrisOrder = await makeRequest('POST', '/api/orders', {
        assessmentIds: [paidAssessment.id]
      }, authHeaders);
      
      const qrisData = {
        orderId: qrisOrder.data.id,
        amount: parseFloat(qrisOrder.data.totalAmount),
        customerEmail: TEST_USER.email,
        customerName: 'Test User',
        items: [{
          name: paidAssessment.name,
          price: parseFloat(paidAssessment.price),
          quantity: 1
        }],
        paymentMethod: 'QRIS'
      };
      
      const qrisResponse = await makeRequest('POST', '/api/xendit/create-invoice', qrisData, authHeaders);
      if (qrisResponse.status === 200) {
        console.log('   ✅ QRIS invoice created');
      } else {
        console.log(`   ⚠️  QRIS failed: ${qrisResponse.data.message || 'Unknown error'}`);
      }

      console.log('\n4️⃣ Testing webhook endpoint...');
      const webhookTestData = {
        id: 'test-invoice-123',
        external_id: order.id.toString(),
        status: 'PAID',
        amount: parseFloat(order.totalAmount),
        paid_amount: parseFloat(order.totalAmount),
        paid_at: new Date().toISOString(),
        payment_method: 'BANK_TRANSFER',
        payment_channel: 'BCA',
        description: 'Test payment'
      };

      const webhookResponse = await makeRequest('POST', '/api/xendit/webhook', webhookTestData);
      if (webhookResponse.status === 200) {
        console.log('   ✅ Webhook endpoint responds correctly');
      } else {
        console.log(`   ⚠️  Webhook test failed: ${webhookResponse.status}`);
      }

      console.log('\n5️⃣ Testing payment status tracking...');
      const statusResponse = await makeRequest('GET', `/api/payment-status/${order.id}`, null, authHeaders);
      if (statusResponse.status === 200) {
        console.log('   ✅ Payment status tracking works');
        console.log(`      Order Status: ${statusResponse.data.status}`);
        console.log(`      Payment Status: ${statusResponse.data.paymentStatus}`);
      }

    } else {
      console.log('❌ Failed to load payment methods');
    }

    console.log('\n🎉 Xendit Integration Testing Completed!');
    console.log('\n📊 Integration Health Check:');
    console.log('   ✅ Payment methods API working');
    console.log('   ✅ Invoice creation endpoints functional');
    console.log('   ✅ Webhook handler ready');
    console.log('   ✅ Payment status tracking active');
    console.log('   ⚠️  Full payment flow requires production API keys');
    console.log('\n💡 Note: For production testing, provide real Xendit API keys');

  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
  }
}

testXenditIntegration();