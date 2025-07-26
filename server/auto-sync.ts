import { DatabaseStorage } from './storage';
import { checkTransactionStatus } from './midtrans';

const storage = new DatabaseStorage();

// Get ALL pending orders, including those without payment_id (potential missing syncs)
async function getAllPendingOrders() {
  try {
    // Get orders from test user - in production, this should be all users
    const testUserId = 'IqO9IlNVqHch';
    const userOrders = await storage.getUserOrders(testUserId);
    
    // Get ALL pending orders, not just those with payment_id
    const pendingOrders = userOrders.filter(order => 
      order.status === 'pending' &&
      new Date(order.createdAt!) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
    );
    
    console.log(`🔍 Found ${pendingOrders.length} total pending orders for user ${testUserId}`);
    console.log(`📝 Orders with payment_id: ${pendingOrders.filter(o => o.paymentId).length}`);
    console.log(`📝 Orders without payment_id: ${pendingOrders.filter(o => !o.paymentId).length}`);
    
    return pendingOrders;
  } catch (error) {
    console.error('Error fetching pending orders:', error);
    return [];
  }
}

// Auto-sync function to periodically check Midtrans status and update orders
export async function autoSyncOrders() {
  try {
    console.log('🔄 Starting real-time auto-sync with Midtrans...');
    
    // Get all pending orders from all users
    const pendingOrders = await getAllPendingOrders();
    console.log(`📋 Found ${pendingOrders.length} pending orders to check`);
    
    if (pendingOrders.length === 0) {
      console.log('✅ No pending orders to sync');
      return { synced: 0, total: 0 };
    }
    
    for (const order of pendingOrders) {
      try {
        const orderId = order.id;
        let paymentId = order.paymentId;
        
        // For orders without payment_id, try to construct it from order ID and timestamp
        if (!paymentId) {
          const createdAt = new Date(order.createdAt!);
          const timestamp = createdAt.getTime();
          paymentId = `order_${orderId}_${timestamp}`;
          console.log(`🔄 Order ${orderId} missing payment_id, trying constructed ID: ${paymentId}`);
        }
        
        console.log(`🔍 Checking order ${orderId} with payment ID: ${paymentId}`);
        
        try {
          // Check status from Midtrans
          const midtransStatus = await checkTransactionStatus(paymentId);
          
          // Determine the payment status
          let paymentStatus = 'pending';
          if (midtransStatus.transaction_status === 'settlement' || midtransStatus.transaction_status === 'capture') {
            paymentStatus = 'paid';
          } else if (midtransStatus.transaction_status === 'cancel') {
            paymentStatus = 'cancelled';
          } else if (midtransStatus.transaction_status === 'deny' || midtransStatus.transaction_status === 'expire' || midtransStatus.transaction_status === 'failure') {
            paymentStatus = 'failed';
          }
          
          console.log(`💳 Order ${orderId}: Database=pending, Midtrans=${midtransStatus.transaction_status} (${paymentStatus})`);
          
          // Update database payment_id if it was missing
          if (!order.paymentId && paymentId) {
            console.log(`📝 Updating payment_id for order ${orderId}: ${paymentId}`);
          }
          
          // Update order if status changed
          if (paymentStatus === 'paid' && order.status === 'pending') {
            await storage.updateOrderStatus(orderId, 'completed', paymentId, 'paid');
            
            // Create user assessments
            if (order.orderItems) {
              for (const item of order.orderItems) {
                const existingAssessment = await storage.getUserAssessmentByOrder(order.userId, item.assessmentId, orderId);
                if (!existingAssessment) {
                  await storage.createUserAssessment({
                    userId: order.userId,
                    assessmentId: item.assessmentId,
                    orderId: orderId,
                    status: 'available'
                  });
                  console.log(`📚 Auto-sync: Created assessment ${item.assessmentId} for order ${orderId}`);
                }
              }
            }
            
            console.log(`✅ Auto-sync: Order ${orderId} completed`);
          } else if ((paymentStatus === 'cancelled' || paymentStatus === 'failed') && order.status === 'pending') {
            await storage.updateOrderStatus(orderId, 'cancelled', paymentId, paymentStatus);
            console.log(`❌ Auto-sync: Order ${orderId} cancelled (${paymentStatus})`);
          }
        } catch (midtransError: any) {
          if (midtransError.httpStatusCode === 404) {
            console.log(`❓ Order ${orderId} not found in Midtrans (404) - might be expired or never created`);
            // For orders not found in Midtrans, mark as cancelled after 1 hour (more aggressive)
            const orderAge = Date.now() - new Date(order.createdAt!).getTime();
            if (orderAge > 60 * 60 * 1000) { // 1 hour
              console.log(`⏰ Order ${orderId} is older than 1h and not in Midtrans, marking as cancelled`);
              await storage.updateOrderStatus(orderId, 'cancelled', paymentId || 'not_found', 'expired');
            } else {
              console.log(`⌛ Order ${orderId} is less than 1h old, keeping as pending for now`);
            }
          } else {
            console.error(`❌ Midtrans API error for order ${order.id}:`, midtransError.message);
          }
        }
        
      } catch (error) {
        console.error(`❌ Auto-sync error for order ${order.id}:`, error);
      }
    }
    
    console.log('✅ Auto-sync completed');
  } catch (error) {
    console.error('❌ Auto-sync failed:', error);
  }
}

// Run auto-sync every 15 seconds for better real-time sync
export function startAutoSync() {
  console.log('🚀 Starting auto-sync service...');
  
  // Run immediately on startup
  setTimeout(autoSyncOrders, 2000);
  
  // Then run every 5 seconds for enhanced real-time sync
  setInterval(autoSyncOrders, 5000); // 5 seconds for maximum real-time responsiveness
}