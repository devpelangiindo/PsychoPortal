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
    if (!selectedMethod) {
      toast({
        title: 'Pilih Metode Pembayaran',
        description: 'Silakan pilih metode pembayaran terlebih dahulu',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await apiRequest('POST', '/api/xendit/create-invoice', {
        orderId,
        amount,
        customerEmail,
        customerName,
        items,
        paymentMethod: selectedMethod
      });
      
      const invoiceData = await response.json();

      if (invoiceData.success) {
        // Store invoice data for tracking
        localStorage.setItem(`xendit_invoice_${orderId}`, JSON.stringify({
          invoiceId: invoiceData.invoiceId,
          invoiceUrl: invoiceData.invoiceUrl,
          externalId: invoiceData.externalId,
          amount: invoiceData.amount
        }));

        // Redirect to Xendit payment page
        window.open(invoiceData.invoiceUrl, '_blank');

        // Call success callback if provided
        if (onPaymentSuccess) {
          onPaymentSuccess(invoiceData);
        }

        toast({
          title: 'Invoice Dibuat',
          description: 'Silakan lanjutkan pembayaran di halaman yang terbuka',
        });
      } else {
        throw new Error(invoiceData.message || 'Gagal membuat invoice');
      }
    } catch (error: any) {
      console.error('Error creating invoice:', error);
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
              <div key={method.type}>
                <button
                  onClick={() => setSelectedMethod(method.type)}
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
                      <div className="flex flex-wrap gap-1 mt-1">
                        {method.channels.slice(0, 4).map((channel) => (
                          <Badge key={channel} variant="secondary" className="text-xs">
                            {channel}
                          </Badge>
                        ))}
                        {method.channels.length > 4 && (
                          <Badge variant="secondary" className="text-xs">
                            +{method.channels.length - 4} lainnya
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
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
          disabled={isLoading || isLoadingMethods || !selectedMethod}
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Membuat Invoice...
            </>
          ) : (
            `Bayar ${formatCurrency(amount)}`
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