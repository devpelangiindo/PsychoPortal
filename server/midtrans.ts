// @ts-ignore - midtrans-client doesn't have types
import midtransClient from 'midtrans-client';
import { Request, Response } from 'express';
import { nanoid } from 'nanoid';

// Only use production keys - no fallback to sandbox
const serverKey = process.env.MIDTRANS_PRODUCTION_SERVER_KEY;
const clientKey = process.env.MIDTRANS_PRODUCTION_CLIENT_KEY;
const merchantId = process.env.MIDTRANS_PRODUCTION_MERCHANT_ID;

if (!serverKey) {
  throw new Error('Missing MIDTRANS_PRODUCTION_SERVER_KEY environment variable - Production mode only');
}

if (!clientKey) {
  throw new Error('Missing MIDTRANS_PRODUCTION_CLIENT_KEY environment variable - Production mode only');
}

if (!merchantId) {
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

// Initialize Midtrans clients
const snap = new midtransClient.Snap({
  isProduction,
  serverKey: serverKey,
  clientKey: clientKey,
  merchantId: merchantId,
});

const coreApi = new midtransClient.CoreApi({
  isProduction,
  serverKey: serverKey,
  clientKey: clientKey,
  merchantId: merchantId,
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
    const parameter = {
      transaction_details: {
        order_id: transactionData.orderId,
        gross_amount: transactionData.amount,
      },
      customer_details: transactionData.customerDetails,
      item_details: transactionData.itemDetails,
      // Add merchant configuration
      credit_card: {
        secure: true,
      },
      enabled_payments: [
        'credit_card',
        'bca_va',
        'bni_va',
        'bri_va',
        'mandiri_va',
        'permata_va',
        'other_va',
        'gopay',
        'shopeepay',
        'qris',
        'indomaret',
        'alfamart',
      ],
    };

    const transaction = await snap.createTransaction(parameter);
    return {
      token: transaction.token,
      redirect_url: transaction.redirect_url,
    };
  } catch (error) {
    console.error('Error creating Midtrans transaction:', error);
    throw error;
  }
}

export async function checkTransactionStatus(orderId: string) {
  try {
    const statusResponse = await coreApi.transaction.status(orderId);
    return statusResponse;
  } catch (error) {
    console.error('Error checking transaction status:', error);
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