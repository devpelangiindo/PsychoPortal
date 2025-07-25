import { DatabaseStorage } from './storage';
import { checkTransactionStatus } from './midtrans';

const storage = new DatabaseStorage();

// Auto-sync function to periodically check Midtrans status and update orders
export async function autoSyncOrders() {
  try {
    console.log('🔄 Starting auto-sync with Midtrans...');
    
    // Get all pending orders from the last 24 hours
    const pendingOrders = await storage.getUserOrders('IqO9IlNVqHch'); // For testing - in production, get all pending orders
    const allPendingOrders = pendingOrders.filter(order => order.status === 'pending' && order.paymentId);
    
    for (const order of allPendingOrders) {
      try {
        if (!order.paymentId) {
          console.log(`⚠️ Order ${order.id} has no payment ID, skipping`);
          continue;
        }
        
        console.log(`🔍 Checking order ${order.id} with payment ID: ${order.paymentId}`);
        
        // Check status from Midtrans
        const midtransStatus = await checkTransactionStatus(order.paymentId);
        
        // Determine the payment status
        let paymentStatus = 'pending';
        if (midtransStatus.transaction_status === 'settlement' || midtransStatus.transaction_status === 'capture') {
          paymentStatus = 'paid';
        } else if (midtransStatus.transaction_status === 'cancel') {
          paymentStatus = 'cancelled';
        } else if (midtransStatus.transaction_status === 'deny' || midtransStatus.transaction_status === 'expire' || midtransStatus.transaction_status === 'failure') {
          paymentStatus = 'failed';
        }
        
        // Update order if status changed
        if (paymentStatus === 'paid' && order.status !== 'completed') {
          await storage.updateOrderStatus(order.id, 'completed', order.paymentId, 'paid');
          
          // Create user assessments
          if (order.orderItems) {
            for (const item of order.orderItems) {
              const existingAssessment = await storage.getUserAssessmentByOrder(order.userId, item.assessmentId, order.id);
              if (!existingAssessment) {
                await storage.createUserAssessment({
                  userId: order.userId,
                  assessmentId: item.assessmentId,
                  orderId: order.id,
                  status: 'available'
                });
                console.log(`📚 Auto-sync: Created assessment ${item.assessmentId} for order ${order.id}`);
              }
            }
          }
          
          console.log(`✅ Auto-sync: Order ${order.id} completed`);
        } else if ((paymentStatus === 'cancelled' || paymentStatus === 'failed') && order.status === 'pending') {
          if (order.paymentId) {
            await storage.updateOrderStatus(order.id, 'cancelled', order.paymentId, paymentStatus);
            console.log(`❌ Auto-sync: Order ${order.id} cancelled (${paymentStatus})`);
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

// Run auto-sync every 30 seconds
export function startAutoSync() {
  console.log('🚀 Starting auto-sync service...');
  setInterval(autoSyncOrders, 30000); // 30 seconds
}