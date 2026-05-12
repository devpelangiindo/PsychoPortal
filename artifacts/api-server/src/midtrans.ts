// @ts-ignore - midtrans-client doesn't have types
import midtransClient from 'midtrans-client';
import { Request, Response } from 'express';
import { nanoid } from 'nanoid';

// Only use production keys - no fallback to sandbox
const serverKey = process.env.MIDTRANS_PRODUCTION_SERVER_KEY;
const clientKey = process.env.MIDTRANS_PRODUCTION_CLIENT_KEY;
const merchantId = process.env.MIDTRANS_PRODUCTION_MERCHANT_ID;
const hasMidtransCredentials = Boolean(serverKey && clientKey && merchantId);
const allowMissingMidtrans = process.env.NODE_ENV !== 'production';

if (!serverKey && !allowMissingMidtrans) {
  throw new Error('Missing MIDTRANS_PRODUCTION_SERVER_KEY environment variable - Production mode only');
}

if (!clientKey && !allowMissingMidtrans) {
  throw new Error('Missing MIDTRANS_PRODUCTION_CLIENT_KEY environment variable - Production mode only');
}

if (!merchantId && !allowMissingMidtrans) {
  throw new Error('Missing MIDTRANS_PRODUCTION_MERCHANT_ID environment variable - Production mode only');
}

// Enable production mode for Midtrans
const isProduction = true; // Use production environment

console.log(`Midtrans Environment: ${isProduction ? 'PRODUCTION' : 'SANDBOX'}`);
console.log(`Midtrans Server Key: ${serverKey?.substring(0, 10)}...`);
console.log(`Midtrans Client Key: ${clientKey?.substring(0, 10)}...`);
console.log(`Midtrans Merchant ID: ${merchantId?.substring(0, 10)}...`);
console.log('Environment Variables Status:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- MIDTRANS_PRODUCTION_SERVER_KEY:', process.env.MIDTRANS_PRODUCTION_SERVER_KEY ? 'EXISTS' : 'MISSING');
console.log('- MIDTRANS_PRODUCTION_CLIENT_KEY:', process.env.MIDTRANS_PRODUCTION_CLIENT_KEY ? 'EXISTS' : 'MISSING');
console.log('- MIDTRANS_PRODUCTION_MERCHANT_ID:', process.env.MIDTRANS_PRODUCTION_MERCHANT_ID ? 'EXISTS' : 'MISSING');
console.log('- VITE_MIDTRANS_PRODUCTION_CLIENT_KEY:', process.env.VITE_MIDTRANS_PRODUCTION_CLIENT_KEY ? 'EXISTS' : 'MISSING');
if (!hasMidtransCredentials) {
  console.warn('Midtrans credentials are missing. Local development will use mock payment responses.');
}

// Initialize Midtrans clients
const snap = new midtransClient.Snap({
  isProduction,
  serverKey: serverKey || 'local-dev-server-key',
  clientKey: clientKey || 'local-dev-client-key',
  merchantId: merchantId || 'local-dev-merchant-id',
});

const coreApi = new midtransClient.CoreApi({
  isProduction,
  serverKey: serverKey || 'local-dev-server-key',
  clientKey: clientKey || 'local-dev-client-key',
  merchantId: merchantId || 'local-dev-merchant-id',
});

export interface MidtransTransactionData {
  orderId: string;
  amount: number;
  customerDetails: {
    first_name: string;
    last_name?: string;
    email: string;
    phone?: string;
  };
  itemDetails: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}

export async function createMidtransTransaction(transactionData: MidtransTransactionData) {
  try {
    if (!hasMidtransCredentials) {
      return {
        token: `local-dev-${nanoid()}`,
        redirect_url: `http://localhost:8084/asesmen/payment-return?order_id=${encodeURIComponent(transactionData.orderId)}`,
      };
    }

    const itemDetails = transactionData.itemDetails.map((item) => ({
      ...item,
      id: item.id.slice(0, 50),
      name: item.name.slice(0, 50),
      price: Math.round(item.price),
      quantity: item.quantity,
    }));
    const grossAmount = itemDetails.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const parameter = {
      transaction_details: {
        order_id: transactionData.orderId,
        gross_amount: grossAmount,
      },
      customer_details: transactionData.customerDetails,
      item_details: itemDetails,
      // Add merchant configuration
      credit_card: {
        secure: true,
      },
      enabled_payments: [
        'credit_card',
        'bca_va',
        'bni_va',
        'bri_va',
        'cimb_va',
        'danamon_va',
        'mandiri_va',
        'permata_va',
        'other_va',
        'gopay',
        'gopay_static_qr',
        'shopeepay',
        'dana',
        'qris',
        'akulaku',
        'indomaret',
        'alfamart',
      ],
    };

    // Enhanced logging untuk debugging payment methods
    console.log('🔧 MIDTRANS TRANSACTION DEBUG - START');
    console.log('📋 Transaction Details:');
    console.log('   - Order ID:', parameter.transaction_details.order_id);
    console.log('   - Amount:', parameter.transaction_details.gross_amount);
    console.log('💳 Payment Methods Configuration:');
    console.log('   - Total enabled methods:', parameter.enabled_payments.length);
    console.log('   - Full list:', JSON.stringify(parameter.enabled_payments, null, 2));
    console.log('   - Bank Mandiri VA included:', parameter.enabled_payments.includes('mandiri_va') ? '✅ YES' : '❌ NO');
    console.log('   - GoPay included:', parameter.enabled_payments.includes('gopay') ? '✅ YES' : '❌ NO');
    console.log('   - Danamon VA included:', parameter.enabled_payments.includes('danamon_va') ? '✅ YES' : '❌ NO');
    console.log('   - Dana E-Wallet included:', parameter.enabled_payments.includes('dana') ? '✅ YES' : '❌ NO');
    console.log('🌐 Environment Configuration:');
    console.log('   - Environment:', isProduction ? 'PRODUCTION' : 'SANDBOX');
    console.log('   - Server Key exists:', !!serverKey);
    console.log('   - Client Key exists:', !!clientKey);
    console.log('   - Merchant ID exists:', !!merchantId);
    console.log('📦 Full Parameter Object:');
    console.log(JSON.stringify(parameter, null, 2));
    console.log('🔧 MIDTRANS TRANSACTION DEBUG - END');

    const transaction = await snap.createTransaction(parameter);
    
    console.log('✅ Midtrans Response:');
    console.log('- Token:', transaction.token?.substring(0, 20) + '...');
    console.log('- Redirect URL:', transaction.redirect_url);
    console.log('- Full Transaction Response:', JSON.stringify(transaction, null, 2));
    
    return {
      token: transaction.token,
      redirect_url: transaction.redirect_url,
    };
  } catch (error) {
    console.error('❌ Error creating Midtrans transaction:', error instanceof Error ? error.message : error);
    console.error('- Environment:', isProduction ? 'PRODUCTION' : 'SANDBOX');
    console.error('- Enabled payments configured:', ['credit_card', 'bca_va', 'bni_va', 'bri_va', 'cimb_va', 'danamon_va', 'mandiri_va', 'permata_va', 'other_va', 'gopay', 'gopay_static_qr', 'shopeepay', 'qris', 'akulaku', 'indomaret', 'alfamart']);
    throw error;
  }
}

export async function checkTransactionStatus(orderId: string) {
  try {
    if (!hasMidtransCredentials) {
      return {
        order_id: orderId,
        transaction_status: 'pending',
        fraud_status: 'accept',
      };
    }

    const statusResponse = await coreApi.transaction.status(orderId);
    return statusResponse;
  } catch (error) {
    console.error('Error checking transaction status:', error instanceof Error ? error.message : error);
    throw error;
  }
}

export function parseMidtransNotification(notification: any) {
  return {
    order_id: notification.order_id,
    transaction_status: notification.transaction_status,
    fraud_status: notification.fraud_status,
    payment_type: notification.payment_type,
    gross_amount: parseFloat(notification.gross_amount),
    transaction_time: notification.transaction_time,
    settlement_time: notification.settlement_time,
  };
}

export function getMidtransPaymentStatus(transaction_status: string, fraud_status?: string) {
  if (transaction_status === 'capture') {
    if (fraud_status === 'challenge') {
      return 'pending';
    } else if (fraud_status === 'accept') {
      return 'paid';
    }
  } else if (transaction_status === 'settlement') {
    return 'paid';
  } else if (transaction_status === 'cancel') {
    return 'cancelled';
  } else if (transaction_status === 'deny' || transaction_status === 'expire' || transaction_status === 'failure') {
    return 'failed';
  } else if (transaction_status === 'pending') {
    return 'pending';
  }
  
  return 'pending';
}

export async function handleMidtransCallback(req: Request, res: Response) {
  try {
    const notification = req.body;
    if (!hasMidtransCredentials) {
      return {
        orderId: notification.order_id,
        status: getMidtransPaymentStatus(notification.transaction_status || 'pending', notification.fraud_status),
        amount: Number(notification.gross_amount || 0),
        paymentType: notification.payment_type || 'local-dev',
        transactionTime: notification.transaction_time,
        settlementTime: notification.settlement_time,
      };
    }
    
    // Verify notification signature (recommended for production)
    const statusResponse = await coreApi.transaction.notification(notification);
    
    const parsedNotification = parseMidtransNotification(statusResponse);
    const paymentStatus = getMidtransPaymentStatus(
      parsedNotification.transaction_status,
      parsedNotification.fraud_status
    );

    return {
      orderId: parsedNotification.order_id,
      status: paymentStatus,
      amount: parsedNotification.gross_amount,
      paymentType: parsedNotification.payment_type,
      transactionTime: parsedNotification.transaction_time,
      settlementTime: parsedNotification.settlement_time,
    };
  } catch (error) {
    console.error('Error handling Midtrans callback:', error);
    throw error;
  }
}
