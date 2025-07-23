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

      console.log('Loading Midtrans script...');
      const script = document.createElement('script');
      script.src = import.meta.env.PROD 
        ? 'https://app.midtrans.com/snap/snap.js' 
        : 'https://app.stg.midtrans.com/snap/snap.js';
      script.setAttribute('data-client-key', import.meta.env.VITE_MIDTRANS_CLIENT_KEY || '');
      
      script.onload = () => {
        console.log('Midtrans script loaded successfully');
        // Wait a bit for snap to be available
        setTimeout(() => {
          if (window.snap) {
            resolve();
          } else {
            reject(new Error('Midtrans snap object not available after script load'));
          }
        }, 100);
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
        onSuccess: (result: any) => {
          console.log('Payment success:', result);
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