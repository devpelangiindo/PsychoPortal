// Complete End-to-End Testing Script
// Testing flow: Registration → Login → Purchase → Payment → Assessment Access

const baseUrl = 'http://localhost:5000';

// Test data
const testUser = {
  email: 'test.user@example.com',
  password: 'TestPassword123',
  firstName: 'Test',
  lastName: 'User',
  whatsappNumber: '081234567890'
};

async function makeRequest(endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`;
  console.log(`🌐 ${options.method || 'GET'} ${endpoint}`);
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  const data = await response.json();
  console.log(`📊 Status: ${response.status}`);
  
  if (!response.ok) {
    console.error('❌ Error:', data);
    throw new Error(`Request failed: ${response.status} ${data.message}`);
  }
  
  return data;
}

async function testCompleteFlow() {
  console.log('🚀 Starting Complete End-to-End Testing...\n');
  
  let accessToken;
  let userId;
  
  try {
    // Step 1: Registration
    console.log('=== STEP 1: USER REGISTRATION ===');
    const registerResult = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(testUser)
    });
    
    accessToken = registerResult.accessToken;
    userId = registerResult.user.id;
    console.log('✅ Registration successful');
    console.log('✅ Auto-login successful');
    console.log(`👤 User ID: ${userId}\n`);
    
    // Step 2: Get Available Assessments
    console.log('=== STEP 2: GET AVAILABLE ASSESSMENTS ===');
    const assessments = await makeRequest('/api/assessments');
    console.log(`✅ Found ${assessments.length} assessments:`);
    assessments.forEach(a => {
      console.log(`   - ${a.name}: Rp ${parseFloat(a.price).toLocaleString('id-ID')}`);
    });
    console.log('');
    
    // Step 3: Test Free Assessment (Learning Style)
    console.log('=== STEP 3: FREE ASSESSMENT ACCESS ===');
    const learningStyleAssessment = assessments.find(a => a.type === 'learning');
    
    if (learningStyleAssessment && parseFloat(learningStyleAssessment.price) === 0) {
      // Create order for free assessment
      const freeOrder = await makeRequest('/api/orders', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
          assessmentIds: [learningStyleAssessment.id]
        })
      });
      
      console.log(`✅ Free assessment order created: ${freeOrder.id}`);
      
      // Complete free payment (demo)
      const freePayment = await makeRequest('/api/payments/create', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
          orderId: freeOrder.id,
          paymentMethod: 'demo'
        })
      });
      
      console.log('✅ Free assessment automatically available');
    }
    
    // Step 4: Test Paid Assessment (Sensory Profile)
    console.log('\n=== STEP 4: PAID ASSESSMENT PURCHASE ===');
    const sensoryAssessment = assessments.find(a => a.type === 'sensory');
    
    if (sensoryAssessment && parseFloat(sensoryAssessment.price) > 0) {
      // Create order for paid assessment
      const paidOrder = await makeRequest('/api/orders', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
          assessmentIds: [sensoryAssessment.id]
        })
      });
      
      console.log(`✅ Paid assessment order created: ${paidOrder.id}`);
      
      // Create Xendit invoice
      const invoiceData = {
        orderId: paidOrder.id,
        amount: sensoryAssessment.price,
        customerEmail: testUser.email,
        customerName: `${testUser.firstName} ${testUser.lastName}`,
        items: [{ name: sensoryAssessment.name }]
      };
      
      console.log('📄 Creating Xendit invoice...');
      const invoice = await makeRequest('/api/xendit/create-invoice', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify(invoiceData)
      });
      
      console.log('✅ Xendit invoice created successfully');
      console.log(`💰 Invoice URL: ${invoice.invoiceUrl}`);
      console.log(`🔗 External ID: ${invoice.externalId}`);
      
      // Simulate payment completion
      console.log('\n🧪 Simulating payment completion...');
      const paymentCompletion = await makeRequest(`/api/xendit/simulate-payment/${paidOrder.id}`, {
        method: 'POST'
      });
      
      console.log('✅ Payment simulation successful');
      console.log(`📋 Order Status: ${paymentCompletion.status}`);
    }
    
    // Step 5: Verify User Assessments
    console.log('\n=== STEP 5: VERIFY ASSESSMENT ACCESS ===');
    const userAssessments = await makeRequest('/api/user-assessments', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    console.log(`✅ User has access to ${userAssessments.length} assessments:`);
    userAssessments.forEach(ua => {
      console.log(`   - ${ua.assessment.name}: Status = ${ua.status}`);
    });
    
    // Step 6: Test Assessment Progress Save
    if (userAssessments.length > 0) {
      console.log('\n=== STEP 6: TEST ASSESSMENT PROGRESS ===');
      const firstAssessment = userAssessments[0];
      
      // Start assessment
      await makeRequest(`/api/user-assessments/${firstAssessment.id}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      console.log('✅ Assessment started');
      
      // Save progress
      const progressData = {
        responses: { '1': 3, '2': 2 },
        participantInfo: { age: '25' },
        currentPage: 1
      };
      
      await makeRequest(`/api/user-assessments/${firstAssessment.id}/save-progress`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify(progressData)
      });
      
      console.log('✅ Assessment progress saved');
    }
    
    console.log('\n🎉 ALL TESTS PASSED! End-to-end flow working perfectly.');
    
  } catch (error) {
    console.error('\n💥 TEST FAILED:', error.message);
    process.exit(1);
  }
}

// Run the test
testCompleteFlow();