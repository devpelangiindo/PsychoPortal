import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, CreditCard, Smartphone, QrCode, Building2, Store } from 'lucide-react';

interface XenditPaymentProps {
  orderId: number;
  amount: number;
  customerEmail: string;
  customerName: string;
  items: Array<{
    name: string;
    price: number;
    quantity?: number;
  }>;
  onPaymentSuccess?: (invoiceData: any) => void;
  onPaymentError?: (error: string) => void;
}

interface PaymentMethod {
  type: string;
  name: string;
  channels: string[];
}

const paymentIcons: Record<string, React.ReactNode> = {
  BANK_TRANSFER: <Building2 className="w-5 h-5" />,
  EWALLET: <Smartphone className="w-5 h-5" />,
  QRIS: <QrCode className="w-5 h-5" />,
  CREDIT_CARD: <CreditCard className="w-5 h-5" />,
  RETAIL_OUTLET: <Store className="w-5 h-5" />
};

export default function XenditPayment({ 
  orderId, 
  amount, 
  customerEmail, 
  customerName, 
  items, 
  onPaymentSuccess, 
  onPaymentError 
}: XenditPaymentProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMethods, setIsLoadingMethods] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    setIsLoadingMethods(true);
    try {
      const response = await apiRequest('GET', '/api/xendit/payment-methods');
      const data = await response.json();
      console.log('Payment methods data:', data);
      
      if (data.success && data.paymentMethods) {
        setPaymentMethods(data.paymentMethods);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
      toast({
        title: 'Error',
        description: 'Gagal memuat metode pembayaran',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingMethods(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (!selectedMethod || !selectedChannel) {
      toast({
        title: 'Pilih Metode Pembayaran',
        description: 'Silakan pilih metode pembayaran dan channel terlebih dahulu',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const invoicePayload = {
        orderId,
        amount,
        customerEmail,
        customerName,
        items,
        paymentMethod: selectedMethod,
        paymentChannel: selectedChannel
      };
      
      console.log('Creating invoice with payload:', invoicePayload);
      console.log('OrderId value:', orderId, 'Type:', typeof orderId);
      
      // Add debugging for request flow
      console.log('About to make API request to /api/xendit/create-invoice');
      console.log('Token in localStorage:', !!localStorage.getItem('accessToken'));
      console.log('Token value (first 50 chars):', localStorage.getItem('accessToken')?.substring(0, 50) + '...');
      console.log('Request payload before sending:', JSON.stringify(invoicePayload, null, 2));
      
      console.log('🚀 MAKING ACTUAL API CALL NOW...');
      const response = await apiRequest('POST', '/api/xendit/create-invoice', invoicePayload);
      
      console.log('✅ API response received:', response.status, response.statusText);
      console.log('Response headers:', response.headers);
      
      console.log('📦 Parsing response JSON...');
      const invoiceData = await response.json();
      console.log('📦 Invoice data received:', invoiceData);

      if (invoiceData.success) {
        console.log('✅ Invoice created successfully. Checking for invoiceUrl...');
        console.log('invoiceUrl field:', invoiceData.invoiceUrl);
        console.log('All invoice data fields:', Object.keys(invoiceData));
        
        // Store invoice data for tracking
        localStorage.setItem(`xendit_invoice_${orderId}`, JSON.stringify({
          invoiceId: invoiceData.invoiceId,
          invoiceUrl: invoiceData.invoiceUrl,
          externalId: invoiceData.externalId,
          amount: invoiceData.amount
        }));

        if (invoiceData.invoiceUrl) {
          console.log('🌐 Opening Xendit payment page:', invoiceData.invoiceUrl);
          // Redirect to Xendit payment page
          window.open(invoiceData.invoiceUrl, '_blank');

          toast({
            title: 'Invoice Dibuat',
            description: 'Silakan lanjutkan pembayaran di halaman yang terbuka',
          });
        } else {
          console.error('❌ No invoiceUrl found in response!');
          throw new Error('Invoice URL tidak tersedia dari Xendit');
        }

        // Call success callback if provided
        if (onPaymentSuccess) {
          onPaymentSuccess(invoiceData);
        }
      } else {
        throw new Error(invoiceData.message || 'Gagal membuat invoice');
      }
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      
      // Handle authentication errors specifically
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        const authErrorMsg = 'Sesi login telah berakhir. Silakan login ulang untuk melanjutkan pembayaran.';
        
        toast({
          title: 'Sesi Berakhir',
          description: authErrorMsg,
          variant: 'destructive'
        });
        
        // Redirect to login after short delay
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        
        if (onPaymentError) {
          onPaymentError(authErrorMsg);
        }
        return;
      }
      
      // Handle order not found specifically
      if (error.message?.includes('Order ID tidak ditemukan')) {
        const orderErrorMsg = 'Order tidak ditemukan. Silakan buat pesanan baru.';
        
        toast({
          title: 'Order Tidak Valid',
          description: orderErrorMsg,
          variant: 'destructive'
        });
        
        if (onPaymentError) {
          onPaymentError(orderErrorMsg);
        }
        return;
      }
      
      // General error handling
      const errorMessage = error.message || 'Gagal membuat invoice pembayaran';
      
      toast({
        title: 'Error Pembayaran',
        description: errorMessage,
        variant: 'destructive'
      });

      if (onPaymentError) {
        onPaymentError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Pembayaran Xendit</CardTitle>
        <CardDescription className="text-center">
          Pilih metode pembayaran yang diinginkan
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Order Summary */}
        <div className="space-y-2">
          <h3 className="font-semibold">Ringkasan Pesanan</h3>
          {items.map((item, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span>{item.name}</span>
              <span>{formatCurrency(item.price)}</span>
            </div>
          ))}
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatCurrency(amount)}</span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="space-y-3">
          <h3 className="font-semibold">Metode Pembayaran</h3>
          {isLoadingMethods ? (
            <div className="text-center py-6">
              <div className="animate-spin w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Memuat metode pembayaran...</p>
            </div>
          ) : paymentMethods && paymentMethods.length > 0 ? (
            paymentMethods.map((method) => (
              <div key={method.type} className="space-y-2">
                <button
                  onClick={() => {
                    setSelectedMethod(method.type);
                    setSelectedChannel(''); // Reset channel selection
                  }}
                  className={`w-full p-3 border rounded-lg text-left transition-colors ${
                    selectedMethod === method.type
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {paymentIcons[method.type]}
                    <div className="flex-1">
                      <div className="font-medium">{method.name}</div>
                    </div>
                  </div>
                </button>
                
                {/* Channel Selection */}
                {selectedMethod === method.type && (
                  <div className="pl-4 space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Pilih {method.name}:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {method.channels.map((channel) => (
                        <button
                          key={channel}
                          onClick={() => setSelectedChannel(channel)}
                          className={`p-2 text-sm border rounded text-center transition-colors ${
                            selectedChannel === channel
                              ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                              : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          {channel}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Tidak dapat memuat metode pembayaran
              </p>
              <Button 
                onClick={loadPaymentMethods}
                variant="outline" 
                size="sm" 
                className="mt-2"
              >
                Coba Lagi
              </Button>
            </div>
          )}
        </div>

        {/* Customer Info */}
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <div>Email: {customerEmail}</div>
          <div>Nama: {customerName}</div>
        </div>

        {/* Pay Button */}
        <Button
          onClick={handleCreateInvoice}
          disabled={isLoading || isLoadingMethods || !selectedMethod || !selectedChannel}
          className="w-full bg-green-600 hover:bg-green-700 text-white"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Membuat Invoice...
            </>
          ) : selectedMethod && selectedChannel ? (
            `Bayar ${formatCurrency(amount)} dengan ${selectedChannel}`
          ) : (
            'Pilih Metode dan Channel Pembayaran'
          )}
        </Button>

        {/* Security Notice */}
        <div className="text-xs text-center text-gray-500 dark:text-gray-400">
          <p>Pembayaran diproses melalui Xendit yang aman dan terpercaya</p>
          <p>Anda akan diarahkan ke halaman pembayaran Xendit</p>
        </div>
      </CardContent>
    </Card>
  );
}