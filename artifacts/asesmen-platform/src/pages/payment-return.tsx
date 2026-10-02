import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";

export default function PaymentReturn() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [paymentStatus, setPaymentStatus] = useState<'loading' | 'success' | 'failed' | 'pending'>('loading');
  const [orderData, setOrderData] = useState<any>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (authLoading) return;
    let active = true;

    const checkPaymentStatus = async () => {
      if (!isAuthenticated) {
        setError('Silakan masuk ke akun yang membuat pesanan untuk melihat status pembayaran.');
        setPaymentStatus('failed');
        return;
      }

      const urlParams = new URLSearchParams(window.location.search);
      const paymentOrderId = urlParams.get('external_id') || urlParams.get('order_id') || urlParams.get('transaction_order_id');
      const directOrderId = urlParams.get('orderId');
      const match = paymentOrderId ? /^order_(\d+)_\d+$/.exec(paymentOrderId) : null;
      const orderId = match ? Number(match[1]) : /^\d+$/.test(directOrderId || '')
        ? Number(directOrderId)
        : /^\d+$/.test(paymentOrderId || '')
          ? Number(paymentOrderId)
          : null;

      if (!orderId || !Number.isSafeInteger(orderId) || orderId <= 0) {
        setError('Nomor pesanan tidak ditemukan pada halaman pembayaran. Buka status pesanan dari dashboard.');
        setPaymentStatus('failed');
        return;
      }

      try {
        try {
          await apiRequest('POST', `/api/midtrans/sync-status/${orderId}`, {});
        } catch {
          // The webhook may already have updated the order, or Midtrans may still be processing it.
        }

        const response = await apiRequest('GET', `/api/payment-status/${orderId}`);
        const payment = await response.json();
        if (!active) return;
        setOrderData(payment);

        if (payment.paymentStatus === 'paid' || payment.status === 'completed') {
          setPaymentStatus('success');
          toast({
            title: 'Pembayaran Berhasil!',
            description: 'Pembayaran Anda telah dikonfirmasi.',
          });
        } else if (payment.paymentStatus === 'pending' || payment.status === 'pending') {
          setPaymentStatus('pending');
        } else {
          setError('Pembayaran tidak berhasil atau dibatalkan.');
          setPaymentStatus('failed');
        }
      } catch (statusError) {
        if (!active) return;
        setError(statusError instanceof Error ? statusError.message : 'Gagal memeriksa status pembayaran.');
        setPaymentStatus('failed');
      }
    };

    void checkPaymentStatus();
    return () => {
      active = false;
    };
  }, [authLoading, isAuthenticated, toast]);
  const handleContinue = () => {
    if (paymentStatus === 'success') {
      setLocation('/dashboard');
    } else {
      setLocation('/cart');
    }
  };

  const renderContent = () => {
    switch (paymentStatus) {
      case 'loading':
        return (
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin" />
                Memverifikasi Pembayaran
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground">
                Sedang memverifikasi status pembayaran Anda...
              </p>
            </CardContent>
          </Card>
        );

      case 'success':
        return (
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="w-6 h-6" />
                Pembayaran Berhasil!
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                Terima kasih! Pembayaran Anda telah berhasil diproses.
              </p>
              {orderData && (
                <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg">
                  <p className="text-sm">
                    <strong>Order ID:</strong> {orderData.orderId}
                  </p>
                  <p className="text-sm">
                    <strong>Total:</strong> {new Intl.NumberFormat('id-ID', { 
                      style: 'currency', 
                      currency: 'IDR',
                      minimumFractionDigits: 0 
                    }).format(parseFloat(orderData.totalAmount) || 0)}
                  </p>
                </div>
              )}
              <p className="text-sm text-green-600">
                Asesmen Anda sekarang tersedia di dashboard.
              </p>
              <Button onClick={handleContinue} className="w-full">
                Lanjut ke Dashboard
              </Button>
            </CardContent>
          </Card>
        );

      case 'pending':
        return (
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-yellow-600">
                <Clock className="w-6 h-6" />
                Pembayaran Pending
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                Pembayaran Anda sedang diproses. Ini mungkin membutuhkan beberapa menit.
              </p>
              {orderData && (
                <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg">
                  <p className="text-sm">
                    <strong>Order ID:</strong> {orderData.orderId}
                  </p>
                  <p className="text-sm">
                    <strong>Status:</strong> Menunggu Pembayaran
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
                  Periksa Status Lagi
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'failed':
        return (
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-red-600">
                <XCircle className="w-6 h-6" />
                Pembayaran Gagal
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                {error || 'Pembayaran tidak berhasil atau dibatalkan.'}
              </p>
              {orderData && (
                <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg">
                  <p className="text-sm">
                    <strong>Order ID:</strong> {orderData.orderId}
                  </p>
                  <p className="text-sm">
                    <strong>Status:</strong> {orderData.status}
                  </p>
                </div>
              )}
              <Button onClick={handleContinue} variant="outline" className="w-full">
                Kembali ke Keranjang
              </Button>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-foreground mb-4">
            Status Pembayaran
          </h1>
          <p className="text-neutral-600 dark:text-muted-foreground">
            Hasil Pembayaran
          </p>
        </div>

        {renderContent()}
      </main>

      <Footer />
    </div>
  );
}
