import { DatabaseStorage } from './storage';
import { checkTransactionStatus } from './midtrans';

const storage = new DatabaseStorage();

// Manual recovery function for problematic orders
export async function recoverPendingOrders() {
  try {
    console.log('🔧 Starting manual order recovery process...');
    
    // Get all pending orders
    const testUserId = 'IqO9IlNVqHch';
    const userOrders = await storage.getUserOrders(testUserId);
    const pendingOrders = userOrders.filter(order => order.status === 'pending');
    
    console.log(`🔍 Found ${pendingOrders.length} pending orders to recover`);
    
    for (const order of pendingOrders) {
      const orderId = order.id;
      const orderAge = Date.now() - new Date(order.createdAt!).getTime();
      const ageInMinutes = Math.floor(orderAge / (60 * 1000));
      
      console.log(`🔄 Processing order ${orderId} (${ageInMinutes} minutes old)`);
      
      // For orders older than 10 minutes without payment_id, mark as cancelled
      if (!order.paymentId && ageInMinutes > 10) {
        console.log(`❌ Order ${orderId} has no payment_id and is ${ageInMinutes}min old, cancelling...`);
        await storage.updateOrderStatus(orderId, 'cancelled', 'no_payment_created', 'expired');
        continue;
      }
      
      // For orders with payment_id but older than 30 minutes, check Midtrans
      if (order.paymentId && ageInMinutes > 30) {
        try {
          const midtransStatus = await checkTransactionStatus(order.paymentId);
          console.log(`📊 Order ${orderId} Midtrans status:`, midtransStatus.transaction_status);
          
          // Process based on Midtrans status
          if (midtransStatus.transaction_status === 'settlement' || midtransStatus.transaction_status === 'capture') {
            console.log(`✅ Order ${orderId} should be completed, updating...`);
            await storage.updateOrderStatus(orderId, 'completed', order.paymentId, 'paid');
            
            // Create user assessments
            for (const item of order.orderItems) {
              const existingAssessment = await storage.getUserAssessmentByOrder(order.userId, item.assessmentId, orderId);
              if (!existingAssessment) {
                await storage.createUserAssessment({
                  userId: order.userId,
                  assessmentId: item.assessmentId,
                  orderId: orderId,
                  status: 'available'
                });
                console.log(`📚 Recovery: Created assessment ${item.assessmentId} for order ${orderId}`);
              }
            }
          } else if (midtransStatus.transaction_status === 'expire' || midtransStatus.transaction_status === 'cancel') {
            console.log(`❌ Order ${orderId} expired/cancelled in Midtrans, updating...`);
            await storage.updateOrderStatus(orderId, 'cancelled', order.paymentId, 'expired');
          }
        } catch (error) {
          console.log(`❓ Order ${orderId} not found in Midtrans, marking as expired...`);
          await storage.updateOrderStatus(orderId, 'cancelled', order.paymentId || 'not_found', 'expired');
        }
      }
    }
    
    console.log('✅ Order recovery process completed');
  } catch (error) {
    console.error('❌ Order recovery failed:', error);
  }
}

// Export for manual execution
if (require.main === module) {
  recoverPendingOrders().then(() => {
    console.log('Recovery process finished');
    process.exit(0);
  });
}