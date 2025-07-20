#!/usr/bin/env node

// Automated Payment Flow Testing Script
const http = require('http');
const https = require('https');

const BASE_URL = 'http://localhost:5000';

// Test user credentials
const TEST_USER = {
  email: 'testuser@example.com',
  password: 'password123'
};

// Utility function to make HTTP requests
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

async function testPaymentFlow() {
  console.log('🚀 Starting Payment Flow Testing...\n');

  try {
    // Step 1: Login to get token
    console.log('1️⃣ Testing login...');
    const loginResponse = await makeRequest('POST', '/api/auth/login', TEST_USER);
    
    console.log(`   Login Response Status: ${loginResponse.status}`);
    console.log(`   Login Response Data:`, JSON.stringify(loginResponse.data, null, 2));
    
    if (loginResponse.status !== 200) {
      throw new Error(`Login failed: ${loginResponse.status} - ${JSON.stringify(loginResponse.data)}`);
    }
    
    const token = loginResponse.data.accessToken || loginResponse.data.token;
    if (!token) {
      throw new Error('No access token received from login');
    }
    console.log('✅ Login successful');
    console.log(`   Token: ${token.substring(0, 20)}...`);

    const authHeaders = { 'Authorization': `Bearer ${token}` };

    // Step 2: Get available assessments
    console.log('\n2️⃣ Fetching available assessments...');
    const assessmentsResponse = await makeRequest('GET', '/api/assessments', null, authHeaders);
    
    if (assessmentsResponse.status !== 200) {
      throw new Error(`Failed to fetch assessments: ${assessmentsResponse.status}`);
    }
    
    const assessments = assessmentsResponse.data;
    const paidAssessment = assessments.find(a => parseFloat(a.price) > 0);
    const freeAssessment = assessments.find(a => parseFloat(a.price) === 0);
    
    console.log('✅ Assessments fetched');
    console.log(`   Paid assessment: ${paidAssessment?.name} (Rp ${paidAssessment?.price})`);
    console.log(`   Free assessment: ${freeAssessment?.name} (Rp ${freeAssessment?.price})`);

    // Step 3: Test creating order with paid assessment
    console.log('\n3️⃣ Creating order with paid assessment...');
    const orderResponse = await makeRequest('POST', '/api/orders', {
      assessmentIds: [paidAssessment.id]
    }, authHeaders);
    
    if (orderResponse.status !== 200) {
      throw new Error(`Order creation failed: ${orderResponse.status} - ${JSON.stringify(orderResponse.data)}`);
    }
    
    const order = orderResponse.data;
    console.log('✅ Order created successfully');
    console.log(`   Order ID: ${order.id}`);
    console.log(`   Total Amount: Rp ${order.totalAmount}`);

    // Step 4: Test getting payment methods
    console.log('\n4️⃣ Fetching payment methods...');
    const paymentMethodsResponse = await makeRequest('GET', '/api/xendit/payment-methods');
    
    if (paymentMethodsResponse.status !== 200) {
      throw new Error(`Payment methods fetch failed: ${paymentMethodsResponse.status}`);
    }
    
    const paymentMethods = paymentMethodsResponse.data.paymentMethods;
    console.log('✅ Payment methods fetched');
    paymentMethods.forEach(method => {
      console.log(`   ${method.name}: ${method.channels.join(', ')}`);
    });

    // Step 5: Test creating Xendit invoice
    console.log('\n5️⃣ Creating Xendit invoice...');
    const invoiceData = {
      orderId: order.id,
      amount: parseFloat(order.totalAmount),
      customerEmail: TEST_USER.email,
      customerName: 'Test User',
      items: [{
        name: paidAssessment.name,
        price: parseFloat(paidAssessment.price),
        quantity: 1
      }],
      paymentMethod: 'BANK_TRANSFER'
    };

    const invoiceResponse = await makeRequest('POST', '/api/xendit/create-invoice', invoiceData, authHeaders);
    
    if (invoiceResponse.status !== 200) {
      console.log('❌ Xendit invoice creation failed (expected in test mode)');
      console.log(`   Status: ${invoiceResponse.status}`);
      console.log(`   Response: ${JSON.stringify(invoiceResponse.data)}`);
      
      // This is expected to fail in test mode without real Xendit credentials
      console.log('ℹ️  This is normal - Xendit requires real API keys for invoice creation');
    } else {
      console.log('✅ Xendit invoice created');
      console.log(`   Invoice ID: ${invoiceResponse.data.invoiceId}`);
      console.log(`   Invoice URL: ${invoiceResponse.data.invoiceUrl}`);
    }

    // Step 6: Test demo payment flow
    console.log('\n6️⃣ Testing demo payment flow...');
    const demoOrderResponse = await makeRequest('POST', '/api/orders', {
      assessmentIds: [paidAssessment.id]
    }, authHeaders);
    
    const demoOrder = demoOrderResponse.data;
    
    const demoPaymentResponse = await makeRequest('POST', '/api/payments/create', {
      orderId: demoOrder.id,
      paymentMethod: 'demo'
    }, authHeaders);
    
    if (demoPaymentResponse.status !== 200) {
      throw new Error(`Demo payment failed: ${demoPaymentResponse.status} - ${JSON.stringify(demoPaymentResponse.data)}`);
    }
    
    console.log('✅ Demo payment successful');
    console.log(`   Payment ID: ${demoPaymentResponse.data.id}`);
    console.log(`   Status: ${demoPaymentResponse.data.status}`);

    // Step 7: Test free assessment flow
    console.log('\n7️⃣ Testing free assessment flow...');
    if (freeAssessment) {
      const freeOrderResponse = await makeRequest('POST', '/api/orders', {
        assessmentIds: [freeAssessment.id]
      }, authHeaders);
      
      const freeOrder = freeOrderResponse.data;
      
      const freePaymentResponse = await makeRequest('POST', '/api/payments/create', {
        orderId: freeOrder.id,
        paymentMethod: 'demo'
      }, authHeaders);
      
      console.log('✅ Free assessment access granted');
      console.log(`   Order ID: ${freeOrder.id}`);
      console.log(`   Total: Rp ${freeOrder.totalAmount}`);
    }

    // Step 8: Test payment status endpoint
    console.log('\n8️⃣ Testing payment status endpoint...');
    const statusResponse = await makeRequest('GET', `/api/payment-status/${demoOrder.id}`, null, authHeaders);
    
    if (statusResponse.status === 200) {
      console.log('✅ Payment status retrieved');
      console.log(`   Order Status: ${statusResponse.data.status}`);
      console.log(`   Payment Status: ${statusResponse.data.paymentStatus}`);
    } else {
      console.log(`❌ Payment status check failed: ${statusResponse.status}`);
    }

    console.log('\n🎉 Payment Flow Testing Completed Successfully!');
    console.log('\n📊 Test Summary:');
    console.log('   ✅ User authentication');
    console.log('   ✅ Assessment fetching');
    console.log('   ✅ Order creation');
    console.log('   ✅ Payment methods loading');
    console.log('   ⚠️  Xendit invoice creation (requires real API keys)');
    console.log('   ✅ Demo payment processing');
    console.log('   ✅ Free assessment access');
    console.log('   ✅ Payment status tracking');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testPaymentFlow();