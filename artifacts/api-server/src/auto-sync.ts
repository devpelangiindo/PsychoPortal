import { DatabaseStorage } from './storage';
import { checkTransactionStatus } from './midtrans';

const storage = new DatabaseStorage();

// Get ALL pending orders from database (system-wide, all users)
async function getAllPendingOrders() {
  try {
    const db = storage.getDb();
    const { sql } = await import('drizzle-orm');
    
    console.log('🔍 Fetching ALL pending orders system-wide from all users...');
    
    // Get ALL pending orders across ALL users
    const result = await db.execute(
      sql`SELECT o.id, o.user_id, o.total_amount, o.status, o.payment_id, o.payment_status, o.created_at,
               oi.assessment_id, oi.price 
          FROM orders o 
          LEFT JOIN order_items oi ON o.id = oi.order_id 
          WHERE o.status = 'pending' 
          ORDER BY o.created_at DESC`
    );

    console.log(`📊 Raw query returned ${result.rows.length} rows from all users`);

    // Group by order to build complete order objects
    const ordersMap = new Map();
    for (const row of result.rows) {
      const orderId = row.id as number;
      if (!ordersMap.has(orderId)) {
        ordersMap.set(orderId, {
          id: orderId,
          userId: row.user_id as string,
          totalAmount: row.total_amount as string,
          status: row.status as string,
          paymentId: row.payment_id as string | null,
          paymentStatus: row.payment_status as string | null,
          createdAt: row.created_at as Date,
          orderItems: []
        });
      }
      if (row.assessment_id) {
        ordersMap.get(orderId).orderItems.push({
          assessmentId: row.assessment_id as number,
          price: row.price as string
        });
      }
    }

    const pendingOrders = Array.from(ordersMap.values());
    console.log(`📋 Processed into ${pendingOrders.length} unique pending orders across all users`);
    console.log(`📝 Orders with payment_id: ${pendingOrders.filter(o => o.paymentId).length}`);
    console.log(`📝 Orders without payment_id: ${pendingOrders.filter(o => !o.paymentId).length}`);
    
    return pendingOrders;
  } catch (error) {
    console.error('❌ Error fetching pending orders:', error);
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

    let syncedCount = 0;
    
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
            syncedCount++;
          } else if ((paymentStatus === 'cancelled' || paymentStatus === 'failed') && order.status === 'pending') {
            await storage.updateOrderStatus(orderId, 'cancelled', paymentId, paymentStatus);
            console.log(`❌ Auto-sync: Order ${orderId} cancelled (${paymentStatus})`);
            syncedCount++;
          }
        } catch (midtransError: any) {
          // Universal cleanup approach: Any error from Midtrans API suggests transaction issues
          const orderAge = Date.now() - new Date(order.createdAt!).getTime();
          const ageInMinutes = Math.floor(orderAge / (60 * 1000));
          
          console.log(`❓ Order ${orderId} failed Midtrans API check (age: ${ageInMinutes}min) - Error: ${midtransError.message}`);
          
          console.log(`⌛ Order ${orderId} remains pending after Midtrans status check error.`);
        }
        
      } catch (error) {
        console.error(`❌ Auto-sync error for order ${order.id}:`, error);
        
        console.log(`⌛ Order ${order.id} remains pending after auto-sync processing error.`);
      }
    }
    
    console.log(`✅ Auto-sync completed: ${syncedCount}/${pendingOrders.length} orders processed`);
    return { synced: syncedCount, total: pendingOrders.length };
    
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
