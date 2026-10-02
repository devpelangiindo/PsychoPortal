import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface MidtransPaymentProps {
  orderId: number;
  amount: number;
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
        resolve();
        return;
      }

      // Only use production environment for Midtrans - no sandbox
      const scriptUrl = 'https://app.midtrans.com/snap/snap.js';
      // Only use production client key - no fallback to sandbox
      const clientKey = import.meta.env.VITE_MIDTRANS_PRODUCTION_CLIENT_KEY;
      
      if (!clientKey) {
        reject(new Error('VITE_MIDTRANS_PRODUCTION_CLIENT_KEY is missing'));
        return;
      }

      const script = document.createElement('script');
      script.src = scriptUrl;
      script.setAttribute('data-client-key', clientKey);
      
      // Add timeout for script loading
      const timeoutId = setTimeout(() => {
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
        reject(new Error('Midtrans script loading timeout after 15 seconds'));
      }, 15000);
      
      script.onload = () => {
        clearTimeout(timeoutId);
        // Wait a bit for snap to be available
        setTimeout(() => {
          if (window.snap) {
            resolve();
          } else {
            reject(new Error('Midtrans snap object not available after script load'));
          }
        }, 1000); // Increased timeout for production
      };
      
      script.onerror = (error) => {
        clearTimeout(timeoutId);
        reject(new Error('Failed to load Midtrans script from ' + scriptUrl));
      };
      
      document.head.appendChild(script);
    });
  };

  const handlePayment = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const clientKey = import.meta.env.VITE_MIDTRANS_PRODUCTION_CLIENT_KEY;
      if (!Number.isSafeInteger(orderId) || orderId <= 0) {
        throw new Error('ID pesanan tidak valid');
      }

      const response = await apiRequest('POST', '/api/payments/create', {
        orderId,
        paymentMethod: 'midtrans',
      });

      if (!response.ok) {
        throw new Error(`Gagal membuat transaksi: HTTP ${response.status}`);
      }

      const transactionData = await response.json();

      if (!transactionData.token) {
        throw new Error('Token pembayaran tidak ditemukan dalam response');
      }

      const { token } = transactionData;

      if (!clientKey) {
        if (transactionData.redirect_url) {
          window.location.href = transactionData.redirect_url;
          return;
        }
        throw new Error('Midtrans client key belum dikonfigurasi');
      }

      await loadMidtransScript();

      if (!window.snap) {
        throw new Error('Midtrans script tidak berhasil dimuat');
      }

      // Validate window.snap exists and has pay method
      if (!window.snap || typeof window.snap.pay !== 'function') {
        throw new Error('Midtrans Snap tidak tersedia. Coba refresh halaman.');
      }

      // Open Midtrans payment page
      window.snap.pay(token, {
        onSuccess: async (result: any) => {
          try {
            await apiRequest('POST', `/api/midtrans/sync-status/${orderId}`, {});
            const statusResponse = await apiRequest('GET', `/api/payment-status/${orderId}`);
            const payment = await statusResponse.json();
            if (payment.paymentStatus === 'paid' || payment.status === 'completed') {
              toast({
                title: "Pembayaran Berhasil",
                description: "Pembayaran Anda telah dikonfirmasi.",
              });
              onSuccess?.(payment);
            } else {
              toast({
                title: "Pembayaran Sedang Diverifikasi",
                description: "Status pembayaran belum final. Periksa kembali beberapa saat lagi.",
              });
              onPending?.(payment);
            }
          } catch {
            toast({
              title: "Pembayaran Sedang Diverifikasi",
              description: "Midtrans menerima pembayaran. Status pesanan sedang disinkronkan.",
            });
            onPending?.(result);
          }
        },
        onPending: (result: any) => {
          toast({
            title: "Pembayaran Tertunda",
            description: "Pembayaran Anda sedang diproses. Kami akan memberitahu Anda setelah konfirmasi.",
            variant: "default",
          });
          onPending?.(result);
        },
        onError: (_result: any) => {
          toast({
            title: "Pembayaran Gagal",
            description: "Terjadi kesalahan saat memproses pembayaran. Silakan coba lagi.",
            variant: "destructive",
          });
          onError?.(_result);
        },
        onClose: () => {
          // Don't show toast for close event to avoid confusion
          setIsLoading(false);
        },
      });
    } catch (error) {
      console.error('Payment initialization failed');
      
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
