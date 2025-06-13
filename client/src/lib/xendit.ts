// Xendit integration utilities
// Note: In a real implementation, this would integrate with Xendit's SDK
// For now, we'll implement the structure that would work with Xendit APIs

export interface XenditPaymentRequest {
  amount: number;
  currency: string;
  payment_method_id?: string;
  description?: string;
  customer?: {
    reference_id: string;
    type: 'INDIVIDUAL' | 'BUSINESS';
    individual_detail?: {
      given_names: string;
      surname?: string;
    };
    email?: string;
    mobile_number?: string;
  };
  metadata?: Record<string, any>;
  success_redirect_url?: string;
  failure_redirect_url?: string;
}

export interface XenditPaymentResponse {
  id: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REQUIRES_ACTION';
  amount: number;
  currency: string;
  payment_method?: {
    id: string;
    type: string;
    card?: {
      last4: string;
      brand: string;
    };
  };
  actions?: Array<{
    action: string;
    url: string;
    method: 'GET' | 'POST';
  }>;
  failure_code?: string;
  failure_message?: string;
  created: string;
  updated: string;
}

export interface XenditCardPaymentMethod {
  type: 'CARD';
  card: {
    number: string;
    exp_month: string;
    exp_year: string;
    cvc: string;
    cardholder_name: string;
  };
  billing_information?: {
    country: string;
    street_line1?: string;
    street_line2?: string;
    city?: string;
    province_state?: string;
    postal_code?: string;
  };
}

export interface XenditBankTransferPaymentMethod {
  type: 'BANK_TRANSFER';
  bank_transfer: {
    bank_code: string;
    account_number: string;
    account_holder_name: string;
  };
}

export class XenditClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    // In production, get this from environment variables
    this.apiKey = import.meta.env.VITE_XENDIT_API_KEY || process.env.XENDIT_API_KEY || '';
    this.baseUrl = import.meta.env.VITE_XENDIT_BASE_URL || 'https://api.xendit.co';
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultHeaders = {
      'Authorization': `Basic ${btoa(this.apiKey + ':')}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Xendit API error: ${response.status}`);
    }

    return response.json();
  }

  async createPaymentMethod(
    paymentMethod: XenditCardPaymentMethod | XenditBankTransferPaymentMethod
  ) {
    return this.makeRequest('/payment_methods', {
      method: 'POST',
      body: JSON.stringify(paymentMethod),
    });
  }

  async createPayment(paymentRequest: XenditPaymentRequest): Promise<XenditPaymentResponse> {
    return this.makeRequest('/payments', {
      method: 'POST',
      body: JSON.stringify({
        ...paymentRequest,
        currency: paymentRequest.currency || 'USD',
      }),
    });
  }

  async getPayment(paymentId: string): Promise<XenditPaymentResponse> {
    return this.makeRequest(`/payments/${paymentId}`);
  }

  async capturePayment(paymentId: string, amount?: number) {
    return this.makeRequest(`/payments/${paymentId}/capture`, {
      method: 'POST',
      body: JSON.stringify(amount ? { amount } : {}),
    });
  }

  // Utility method to format payment method data
  static formatCardPaymentMethod(formData: {
    cardNumber: string;
    expiryDate: string;
    cvv: string;
    cardholderName: string;
  }): XenditCardPaymentMethod {
    const [expMonth, expYear] = formData.expiryDate.split('/');
    
    return {
      type: 'CARD',
      card: {
        number: formData.cardNumber.replace(/\s/g, ''),
        exp_month: expMonth,
        exp_year: `20${expYear}`,
        cvc: formData.cvv,
        cardholder_name: formData.cardholderName,
      },
    };
  }

  static formatBankTransferPaymentMethod(formData: {
    bankCode: string;
    accountNumber: string;
    accountHolder: string;
  }): XenditBankTransferPaymentMethod {
    return {
      type: 'BANK_TRANSFER',
      bank_transfer: {
        bank_code: formData.bankCode.toUpperCase(),
        account_number: formData.accountNumber,
        account_holder_name: formData.accountHolder,
      },
    };
  }
}

// Export a singleton instance
export const xenditClient = new XenditClient();

// Utility functions for common operations
export const createPaymentSession = async (
  amount: number,
  paymentMethod: 'card' | 'bank',
  formData: any,
  customerInfo: {
    email: string;
    phone?: string;
    name: string;
  }
) => {
  try {
    // Create payment method
    let paymentMethodData;
    
    if (paymentMethod === 'card') {
      paymentMethodData = XenditClient.formatCardPaymentMethod(formData);
    } else {
      paymentMethodData = XenditClient.formatBankTransferPaymentMethod(formData);
    }

    const createdPaymentMethod = await xenditClient.createPaymentMethod(paymentMethodData);

    // Create payment
    const paymentRequest: XenditPaymentRequest = {
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'USD',
      payment_method_id: createdPaymentMethod.id,
      description: 'PsyAssess Pro - Psychological Assessment Purchase',
      customer: {
        reference_id: `customer_${Date.now()}`,
        type: 'INDIVIDUAL',
        individual_detail: {
          given_names: customerInfo.name,
        },
        email: customerInfo.email,
        mobile_number: customerInfo.phone,
      },
      metadata: {
        platform: 'psyassess_pro',
        timestamp: new Date().toISOString(),
      },
    };

    const payment = await xenditClient.createPayment(paymentRequest);
    return payment;
  } catch (error) {
    console.error('Xendit payment creation failed:', error);
    throw error;
  }
};

export const handlePaymentCallback = async (paymentId: string) => {
  try {
    const payment = await xenditClient.getPayment(paymentId);
    return payment;
  } catch (error) {
    console.error('Failed to fetch payment status:', error);
    throw error;
  }
};
