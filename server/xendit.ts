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
      secretKey: process.env.XENDIT_SECRET_KEY,
    });
  }
  return xendit;
}

// Create invoice for payment
export async function createXenditInvoice(req: Request, res: Response) {
  try {
    const { orderId, amount, customerEmail, customerName, items } = req.body;

    if (!orderId || !amount || !customerEmail) {
      return res.status(400).json({ 
        error: 'Missing required fields: orderId, amount, customerEmail' 
      });
    }

    const xenditClient = await getXenditClient();
    
    // Create invoice
    const invoice = await xenditClient.Invoice.createInvoice({
      externalId: `order_${orderId}_${Date.now()}`,
      payerEmail: customerEmail,
      description: `Pembayaran untuk ${items?.map((item: any) => item.name).join(', ') || 'Asesmen Psikologi'}`,
      amount: parseInt(amount),
      currency: 'IDR',
      invoiceDuration: 86400, // 24 hours
      successRedirectUrl: `${req.protocol}://${req.get('host')}/payment-success?orderId=${orderId}`,
      failureRedirectUrl: `${req.protocol}://${req.get('host')}/payment-failed?orderId=${orderId}`,
      customer: {
        givenNames: customerName || customerEmail.split('@')[0],
        email: customerEmail,
      },
      customerNotificationPreference: {
        invoiceCreated: ['email'],
        invoicePaid: ['email'],
      },
      items: items?.map((item: any) => ({
        name: item.name,
        quantity: item.quantity || 1,
        price: parseInt(item.price),
      })) || [{
        name: 'Asesmen Psikologi',
        quantity: 1,
        price: parseInt(amount),
      }],
    });

    res.json({
      success: true,
      invoiceId: invoice.id,
      invoiceUrl: invoice.invoice_url,
      externalId: invoice.external_id,
      amount: invoice.amount,
      status: invoice.status,
    });

  } catch (error: any) {
    console.error('Xendit invoice creation error:', error);
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
      
      await storage.updateOrderPayment(orderId, {
        paymentStatus: 'completed',
        paymentMethod: 'xendit',
        xenditInvoiceId: id,
        paidAt: paid_at ? new Date(paid_at) : new Date(),
        paidAmount: paid_amount,
      });

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