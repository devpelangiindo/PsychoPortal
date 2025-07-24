import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, Building2, Smartphone, QrCode, Store } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface MidtransPaymentProps {
  orderId: string;
  amount: number;
  customerDetails: {
    firstName: string;
    lastName?: string;
    email: string;
    whatsappNumber?: string;
  };
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  onSuccess?: (result: any) => void;
  onPending?: (result: any) => void;
  onError?: (error: any) => void;
}

declare global {
  interface Window {
    snap: any;
  }
}

export default function MidtransPayment({
  orderId,
  amount,
  customerDetails,
  items,
  onSuccess,
  onPending,
  onError,
}: MidtransPaymentProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const loadMidtransScript = () => {
    return new Promise<void>((resolve, reject) => {
      if (window.snap) {
        console.log('Midtrans script already loaded');
        resolve();
        return;
      }

      const isProduction = import.meta.env.PROD;
      const scriptUrl = isProduction 
        ? 'https://app.midtrans.com/snap/snap.js' 
        : 'https://app.sandbox.midtrans.com/snap/snap.js';
      const clientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY;
      
      console.log(`Loading Midtrans script (${isProduction ? 'PRODUCTION' : 'SANDBOX'}):`, scriptUrl);
      console.log('Client Key:', clientKey?.substring(0, 10) + '...');
      
      if (!clientKey) {
        console.error('VITE_MIDTRANS_CLIENT_KEY is missing!');
        reject(new Error('Midtrans client key is not configured'));
        return;
      }

      const script = document.createElement('script');
      script.src = scriptUrl;
      script.setAttribute('data-client-key', clientKey);
      
      script.onload = () => {
        console.log('Midtrans script loaded successfully');
        // Wait a bit for snap to be available
        setTimeout(() => {
          if (window.snap) {
            resolve();
          } else {
            console.error('Midtrans snap object not available after script load');
            reject(new Error('Midtrans snap object not available after script load'));
          }
        }, 500); // Increased timeout for production
      };
      
      script.onerror = (error) => {
        console.error('Failed to load Midtrans script:', error);
        reject(new Error('Failed to load Midtrans script'));
      };
      
      document.head.appendChild(script);
    });
  };

  const handlePayment = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      // Validate client key first
      if (!import.meta.env.VITE_MIDTRANS_CLIENT_KEY) {
        throw new Error('VITE_MIDTRANS_CLIENT_KEY tidak dikonfigurasi');
      }

      // Load Midtrans script
      await loadMidtransScript();
      
      // Validate snap object
      if (!window.snap) {
        throw new Error('Midtrans script tidak berhasil dimuat');
      }

      // Create transaction
      console.log('Sending transaction request with data:', {
        orderId,
        amount,
        customerDetails: {
          first_name: customerDetails.firstName,
          last_name: customerDetails.lastName || '',
          email: customerDetails.email,
          phone: customerDetails.whatsappNumber || '',
        },
        itemDetails: items,
      });
      
      const response = await apiRequest('POST', '/api/midtrans/create-transaction', {
        orderId,
        amount,
        customerDetails: {
          first_name: customerDetails.firstName,
          last_name: customerDetails.lastName || '',
          email: customerDetails.email,
          phone: customerDetails.whatsappNumber || '',
        },
        itemDetails: items,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Transaction API error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const transactionData = await response.json();
      console.log('Transaction response:', transactionData);

      if (!transactionData.token) {
        throw new Error('Token pembayaran tidak ditemukan dalam response');
      }

      const { token } = transactionData;
      console.log('About to call window.snap.pay with token:', token);

      // Validate window.snap exists and has pay method
      if (!window.snap || typeof window.snap.pay !== 'function') {
        throw new Error('Midtrans Snap tidak tersedia. Coba refresh halaman.');
      }

      // Open Midtrans payment page
      window.snap.pay(token, {
        onSuccess: async (result: any) => {
          console.log('Payment success:', result);
          
          // Auto-complete the order since webhook might not trigger immediately
          if (result.order_id) {
            const orderIdMatch = result.order_id.match(/order_(\d+)_/);
            const numericOrderId = orderIdMatch ? parseInt(orderIdMatch[1]) : null;
            
            if (numericOrderId) {
              try {
                console.log(`🔄 Auto-completing order ${numericOrderId} after successful payment`);
                const simulateResponse = await fetch(`/api/midtrans/simulate-payment/${numericOrderId}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    order_id: result.order_id,
                    transaction_status: result.transaction_status || 'capture',
                    fraud_status: result.fraud_status || 'accept'
                  })
                });
                
                if (simulateResponse.ok) {
                  console.log('✅ Order auto-completion successful');
                } else {
                  console.log('⚠️ Order auto-completion failed, webhook should handle it');
                }
              } catch (error) {
                console.log('⚠️ Auto-completion error, webhook should handle payment:', error);
              }
            }
          }
          
          toast({
            title: "Pembayaran Berhasil",
            description: "Pembayaran Anda telah berhasil diproses.",
          });
          onSuccess?.(result);
        },
        onPending: (result: any) => {
          console.log('Payment pending:', result);
          toast({
            title: "Pembayaran Tertunda",
            description: "Pembayaran Anda sedang diproses. Kami akan memberitahu Anda setelah konfirmasi.",
            variant: "default",
          });
          onPending?.(result);
        },
        onError: (result: any) => {
          console.error('Payment error:', result);
          toast({
            title: "Pembayaran Gagal",
            description: "Terjadi kesalahan saat memproses pembayaran. Silakan coba lagi.",
            variant: "destructive",
          });
          onError?.(result);
        },
        onClose: () => {
          console.log('Payment popup closed by user');
          // Don't show toast for close event to avoid confusion
          setIsLoading(false);
        },
      });
    } catch (error) {
      console.error('Payment initialization error:', error);
      
      // More detailed error handling
      let errorMessage = "Gagal memulai proses pembayaran.";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast({
        title: "Pembayaran Gagal",
        description: errorMessage + " Silakan coba lagi.",
        variant: "destructive",
      });
      onError?.(error);
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
        <CardTitle className="text-center">Pembayaran dengan Midtrans</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Payment Amount */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Total Pembayaran</p>
          <p className="text-2xl font-bold text-primary">{formatCurrency(amount)}</p>
        </div>

        {/* Order Details */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Detail Pesanan:</p>
          <div className="bg-muted p-3 rounded-lg space-y-1">
            <p className="text-sm">Order ID: <span className="font-mono">{orderId}</span></p>
            {items.map((item, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span>{item.name} x{item.quantity}</span>
                <span>{formatCurrency(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Metode Pembayaran yang Tersedia:</p>
          <div className="grid grid-cols-2 gap-2">
            <Badge variant="outline" className="justify-center py-2">
              <CreditCard className="w-4 h-4 mr-1" />
              Kartu Kredit
            </Badge>
            <Badge variant="outline" className="justify-center py-2">
              <Building2 className="w-4 h-4 mr-1" />
              Virtual Account
            </Badge>
            <Badge variant="outline" className="justify-center py-2">
              <Smartphone className="w-4 h-4 mr-1" />
              E-Wallet
            </Badge>
            <Badge variant="outline" className="justify-center py-2">
              <QrCode className="w-4 h-4 mr-1" />
              QRIS
            </Badge>
          </div>
          <div className="flex justify-center">
            <Badge variant="outline" className="justify-center py-2">
              <Store className="w-4 h-4 mr-1" />
              Convenience Store
            </Badge>
          </div>
        </div>

        {/* Payment Button */}
        <Button
          onClick={handlePayment}
          disabled={isLoading}
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Memproses...
            </>
          ) : (
            'Bayar Sekarang'
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Dengan melanjutkan, Anda setuju dengan syarat dan ketentuan pembayaran
        </p>
      </CardContent>
    </Card>
  );
}