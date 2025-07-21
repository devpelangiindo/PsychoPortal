import { Request, Response } from 'express';

if (!process.env.XENDIT_SECRET_KEY) {
  throw new Error('XENDIT_SECRET_KEY is required');
}

// Initialize Xendit client lazily
let xendit: any = null;
async function getXenditClient() {
  if (!xendit) {
    const { Xendit } = await import('xendit-node');
    xendit = new Xendit({
      secretKey: process.env.XENDIT_SECRET_KEY!,
    });
  }
  return xendit;
}

// Create invoice for payment
export async function createXenditInvoice(req: Request, res: Response) {
  try {
    console.log('Received invoice request body:', req.body);
    const { orderId, amount, customerEmail, customerName, items, paymentMethod, paymentChannel } = req.body;

    console.log('Extracted fields:', { orderId, amount, customerEmail, customerName, items, paymentMethod, paymentChannel });

    if (!orderId || !amount || !customerEmail || !customerName || !items) {
      console.log('Missing fields detected:', { 
        orderId: !!orderId, 
        amount: !!amount, 
        customerEmail: !!customerEmail,
        customerName: !!customerName,
        items: !!items 
      });
      return res.status(400).json({ 
        error: 'Missing required fields: orderId, amount, customerEmail, customerName, items' 
      });
    }

    // Verify that the order exists and belongs to the user
    const { storage } = await import('./storage');
    const userId = (req as any).user.claims.sub;
    
    console.log('Looking for order:', { orderId, userId, orderIdType: typeof orderId });
    
    const order = await storage.getOrder(parseInt(orderId));
    console.log('Order lookup result:', { order: !!order, orderData: order });
    
    if (!order) {
      console.log('Order not found in database:', orderId);
      
      // Let's check all orders for debugging
      const allOrders = await storage.getOrdersByUserId(userId);
      console.log('All user orders:', allOrders.map(o => ({ id: o.id, status: o.status })));
      
      return res.status(404).json({ 
        error: 'Order ID tidak ditemukan' 
      });
    }

    if (order.userId !== userId) {
      console.log('Order access denied:', { orderId, userId, orderUserId: order.userId });
      return res.status(403).json({ 
        error: 'Access denied to order' 
      });
    }
    
    console.log('Order validation successful:', { orderId, userId, orderStatus: order.status });

    const xenditClient = await getXenditClient();
    
    // Use correct Xendit SDK format for createInvoice
    const invoiceData = {
      externalId: `order_${orderId}_${Date.now()}`,
      amount: parseInt(amount),
      description: `Pembayaran untuk ${items?.map((item: any) => item.name).join(', ') || 'Asesmen Psikologi'}`,
      invoiceDuration: 86400, // 24 hours
      currency: 'IDR',
      reminderTime: 1,
      customer: {
        givenNames: customerName,
        email: customerEmail
      },
      customerNotificationPreference: {
        invoiceCreated: ['email'],
        invoiceReminder: ['email'],
        invoicePaid: ['email']
      },
      successRedirectUrl: `${req.protocol}://${req.get('host')}/payment-return`,
      failureRedirectUrl: `${req.protocol}://${req.get('host')}/payment-return`
    };

    console.log('Creating invoice with correct format:', invoiceData);
    
    const invoice = await xenditClient.Invoice.createInvoice({
      data: invoiceData
    });

    console.log('✅ Xendit invoice created successfully:', {
      id: invoice.id,
      invoiceUrl: invoice.invoiceUrl,
      invoice_url: invoice.invoice_url,
      externalId: invoice.externalId,
      external_id: invoice.external_id,
      amount: invoice.amount,
      status: invoice.status
    });

    const invoiceUrlField = invoice.invoiceUrl || invoice.invoice_url;
    const externalIdField = invoice.externalId || invoice.external_id;

    if (!invoiceUrlField) {
      console.error('❌ Xendit did not return invoiceUrl!');
      console.error('Available fields:', Object.keys(invoice));
      console.error('Full Xendit response:', JSON.stringify(invoice, null, 2));
      throw new Error('Xendit tidak mengembalikan URL pembayaran');
    }

    res.json({
      success: true,
      invoiceId: invoice.id,
      invoiceUrl: invoiceUrlField,
      externalId: externalIdField,
      amount: invoice.amount,
      status: invoice.status,
    });

  } catch (error: any) {
    console.error('Xendit invoice creation error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      field: error.field,
      stack: error.stack
    });
    res.status(500).json({ 
      error: 'Failed to create invoice',
      message: error.message 
    });
  }
}

// Check invoice status
export async function checkInvoiceStatus(req: Request, res: Response) {
  try {
    const { invoiceId } = req.params;

    const xenditClient = await getXenditClient();
    const invoice = await xenditClient.Invoice.getInvoice({
      invoiceId: invoiceId,
    });

    res.json({
      success: true,
      invoiceId: invoice.id,
      status: invoice.status,
      amount: invoice.amount,
      paidAmount: invoice.paid_amount,
      paymentMethod: invoice.payment_method,
      paidAt: invoice.paid_at,
    });

  } catch (error: any) {
    console.error('Xendit invoice status check error:', error);
    res.status(500).json({ 
      error: 'Failed to check invoice status',
      message: error.message 
    });
  }
}

// Webhook handler for payment notifications
export async function handleXenditWebhook(req: Request, res: Response) {
  try {
    const webhookToken = req.headers['x-callback-token'];
    
    // Verify webhook token (optional but recommended)
    // if (webhookToken !== process.env.XENDIT_WEBHOOK_TOKEN) {
    //   return res.status(401).json({ error: 'Unauthorized webhook' });
    // }

    const { id, external_id, status, paid_amount, payment_method, paid_at } = req.body;
    
    console.log('Xendit webhook received:', {
      id,
      external_id,
      status,
      paid_amount,
      payment_method,
      paid_at,
    });

    // Extract order ID from external_id
    const orderIdMatch = external_id.match(/order_(\d+)_/);
    if (!orderIdMatch) {
      console.error('Invalid external_id format:', external_id);
      return res.status(400).json({ error: 'Invalid external_id format' });
    }

    const orderId = parseInt(orderIdMatch[1]);

    // Update order status based on invoice status
    if (status === 'PAID') {
      // Import storage here to avoid circular dependency
      const { storage } = await import('./storage');
      
      console.log(`🎉 Payment confirmed for order ${orderId}! Processing...`);
      
      // Update order status
      await storage.updateOrder(orderId, {
        status: 'completed',
        paymentStatus: 'paid',
        paymentMethod: payment_method,
        paidAt: new Date(paid_at),
        paidAmount: paid_amount.toString()
      });
      
      // Get order details to create user assessments
      const order = await storage.getOrder(orderId);
      if (order && order.orderItems) {
        console.log(`📝 Creating user assessments for ${order.orderItems.length} items...`);
        
        for (const item of order.orderItems) {
          // Create user assessment for each purchased assessment
          await storage.createUserAssessment({
            userId: order.userId,
            assessmentId: item.assessmentId,
            orderId: orderId,
            status: 'available'
          });
          
          console.log(`✅ Created user assessment for assessment ID ${item.assessmentId}`);
        }
        
        console.log(`🎉 Order ${orderId} processed successfully! User can now access assessments.`);
      }
      
      console.log(`Order ${orderId} marked as paid via Xendit`);
    } else if (status === 'EXPIRED' || status === 'FAILED') {
      const { storage } = await import('./storage');
      
      await storage.updateOrderPayment(orderId, {
        paymentStatus: 'failed',
        paymentMethod: 'xendit',
        xenditInvoiceId: id,
      });

      console.log(`Order ${orderId} marked as failed/expired`);
    }

    res.json({ success: true });

  } catch (error: any) {
    console.error('Xendit webhook processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process webhook',
      message: error.message 
    });
  }
}

// Get available payment methods
export async function getAvailablePaymentMethods(req: Request, res: Response) {
  try {
    // For now, return static list of commonly available payment methods in Indonesia
    const paymentMethods = [
      {
        type: 'BANK_TRANSFER',
        name: 'Transfer Bank',
        channels: ['BCA', 'BNI', 'BRI', 'MANDIRI', 'PERMATA', 'CIMB']
      },
      {
        type: 'EWALLET',
        name: 'E-Wallet',
        channels: ['OVO', 'DANA', 'LINKAJA', 'SHOPEEPAY']
      },
      {
        type: 'QRIS',
        name: 'QRIS',
        channels: ['QRIS']
      },
      {
        type: 'CREDIT_CARD',
        name: 'Kartu Kredit',
        channels: ['VISA', 'MASTERCARD', 'JCB']
      },
      {
        type: 'RETAIL_OUTLET',
        name: 'Retail Store',
        channels: ['ALFAMART', 'INDOMARET']
      }
    ];

    res.json({
      success: true,
      paymentMethods,
    });

  } catch (error: any) {
    console.error('Error getting payment methods:', error);
    res.status(500).json({ 
      error: 'Failed to get payment methods',
      message: error.message 
    });
  }
}