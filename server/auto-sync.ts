import { DatabaseStorage } from './storage';
import { checkTransactionStatus } from './midtrans';

const storage = new DatabaseStorage();

// Get all pending orders with payment_id from specific test user (for now)
async function getAllPendingOrders() {
  try {
    // Get orders from test user - in production, this should be all users
    const testUserId = 'IqO9IlNVqHch';
    const userOrders = await storage.getUserOrders(testUserId);
    
    const pendingOrders = userOrders.filter(order => 
      order.status === 'pending' && 
      order.paymentId &&
      new Date(order.createdAt!) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
    );
    
    console.log(`🔍 Found ${pendingOrders.length} pending orders with payment ID for user ${testUserId}`);
    
    return pendingOrders;
  } catch (error) {
    console.error('Error fetching pending orders:', error);
    return [];
  }
}

// Auto-sync function to periodically check Midtrans status and update orders
export async function autoSyncOrders() {
  try {
    console.log('🔄 Starting auto-sync with Midtrans...');
    
    // Get all pending orders from all users
    const pendingOrders = await getAllPendingOrders();
    console.log(`📋 Found ${pendingOrders.length} pending orders to check`);
    
    if (pendingOrders.length === 0) {
      console.log('✅ No pending orders to sync');
      return;
    }
    
    for (const order of pendingOrders) {
      try {
        const orderId = order.id;
        const paymentId = order.paymentId;
        
        // Skip orders without payment ID
        if (!paymentId) {
          console.log(`⚠️ Order ${orderId} has no payment ID, skipping`);
          continue;
        }
        
        console.log(`🔍 Checking order ${orderId} with payment ID: ${paymentId}`);
        
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
        
        console.log(`💳 Order ${orderId}: Database status = pending, Midtrans status = ${midtransStatus.transaction_status} (${paymentStatus})`);
        
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
        
      } catch (error) {
        console.error(`❌ Auto-sync error for order ${orderId}:`, error);
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
  
  // Then run every 15 seconds
  setInterval(autoSyncOrders, 15000); // 15 seconds for real-time sync
}