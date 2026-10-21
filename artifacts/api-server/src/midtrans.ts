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
const asesmenSiteUrl = (process.env.ASESMEN_SITE_URL || 'https://asesmen.pi-psychology.com').replace(/\/$/, '');

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

// Bound network calls so an unavailable provider cannot stall reconciliation indefinitely.
for (const gateway of [snap, coreApi]) {
  if (gateway.httpClient?.http_client?.defaults) gateway.httpClient.http_client.defaults.timeout = 10000;
}

export interface MidtransTransactionData {
  orderId: string;
  amount: number;
  expiryMinutes?: number;
  expiryStartTime?: Date;
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
    const itemDetails = transactionData.itemDetails.map((item) => ({
      ...item,
      id: item.id.slice(0, 50),
      name: item.name.slice(0, 50),
      price: Math.round(item.price),
      quantity: item.quantity,
    }));
    const expectedAmount = Math.round(Number(transactionData.amount));
    const itemTotal = itemDetails.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (!Number.isSafeInteger(expectedAmount) || expectedAmount <= 0) {
      throw new Error('Payment amount must be a positive integer');
    }
    if (itemDetails.length === 0 || itemDetails.some((item) =>
      !item.id || !item.name || !Number.isSafeInteger(item.price) || item.price <= 0 ||
      !Number.isSafeInteger(item.quantity) || item.quantity <= 0
    )) {
      throw new Error('Payment items must have a name and positive integer prices and quantities');
    }
    if (!Number.isSafeInteger(itemTotal) || itemTotal !== expectedAmount) {
      throw new Error('Payment amount does not match the item total');
    }
    if (!transactionData.customerDetails.first_name || !transactionData.customerDetails.email) {
      throw new Error('Customer name and email are required');
    }

    if (!hasMidtransCredentials) {
      return {
        token: `local-dev-${nanoid()}`,
        redirect_url: `http://localhost:8084/asesmen/payment-return?order_id=${encodeURIComponent(transactionData.orderId)}`,
      };
    }

    const parameter = {
      transaction_details: {
        order_id: transactionData.orderId,
        gross_amount: expectedAmount,
      },
      customer_details: transactionData.customerDetails,
      item_details: itemDetails,
      callbacks: {
        finish: `${asesmenSiteUrl}/payment-return?order_id=${encodeURIComponent(transactionData.orderId)}`,
        pending: `${asesmenSiteUrl}/payment-return?order_id=${encodeURIComponent(transactionData.orderId)}`,
        error: `${asesmenSiteUrl}/payment-failed?order_id=${encodeURIComponent(transactionData.orderId)}`,
      },
      expiry: {
        start_time: new Date((transactionData.expiryStartTime ?? new Date()).getTime() + 7 * 60 * 60 * 1000)
          .toISOString().slice(0, 19).replace('T', ' ') + ' +0700',
        duration: transactionData.expiryMinutes ?? 15,
        unit: 'minutes',
      },
      page_expiry: {
        duration: transactionData.expiryMinutes ?? 15,
        unit: 'minutes',
      },
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
        'echannel',
        'permata_va',
        'other_va',
        'gopay',
        'shopeepay',
        'dana',
        'other_qris',
        'akulaku',
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
    console.error('Midtrans transaction creation failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
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
    console.error('Midtrans transaction status lookup failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    throw error;
  }
}

export async function expireMidtransTransaction(orderId: string) {
  if (!hasMidtransCredentials) throw new Error('Midtrans is not configured');
  return coreApi.transaction.expire(orderId);
}

export async function cancelMidtransSession(token: string): Promise<boolean> {
  if (!hasMidtransCredentials) throw new Error('Midtrans is not configured');
  const response = await fetch(`https://app.midtrans.com/snap/v1/transactions/${encodeURIComponent(token)}/cancel`, {
    method: 'POST', headers: { Authorization: serverKey!,
      'Content-Type': 'application/json', Accept: 'application/json' }, signal: AbortSignal.timeout(10000),
  });
  const result = await response.json() as { canceled_at?: string; error_messages?: string[] };
  return Boolean(response.ok && result.canceled_at) || Boolean(result.error_messages?.includes('token already canceled'));
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
    } else if (!fraud_status || fraud_status === 'accept') {
      return 'paid';
    }
  } else if (transaction_status === 'settlement' && (!fraud_status || fraud_status === 'accept')) {
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
        transactionStatus: notification.transaction_status || 'pending',
        fraudStatus: notification.fraud_status,
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
      transactionStatus: parsedNotification.transaction_status,
      fraudStatus: parsedNotification.fraud_status,
      paymentType: parsedNotification.payment_type,
      transactionTime: parsedNotification.transaction_time,
      settlementTime: parsedNotification.settlement_time,
    };
  } catch (error) {
    console.error('Midtrans notification verification failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    throw error;
  }
}
