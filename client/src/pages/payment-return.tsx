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
  const { user } = useAuth();
  const [paymentStatus, setPaymentStatus] = useState<'loading' | 'success' | 'failed' | 'pending'>('loading');
  const [orderData, setOrderData] = useState<any>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const checkPaymentStatus = async () => {
      try {
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const invoiceId = urlParams.get('invoice_id');
        const externalId = urlParams.get('external_id');
        const status = urlParams.get('status');

        console.log('Payment return params:', { invoiceId, externalId, status });

        if (!invoiceId && !externalId) {
          throw new Error('Parameter pembayaran tidak ditemukan');
        }

        // Extract order ID from external_id (format: order_123_timestamp)
        let orderId: number | null = null;
        if (externalId) {
          const matches = externalId.match(/order_(\d+)_/);
          if (matches) {
            orderId = parseInt(matches[1]);
          }
        }

        // Try to get order ID from localStorage as fallback
        if (!orderId) {
          const storedInvoices = Object.keys(localStorage).filter(key => key.startsWith('xendit_invoice_'));
          for (const key of storedInvoices) {
            const invoiceData = JSON.parse(localStorage.getItem(key) || '{}');
            if (invoiceData.invoiceId === invoiceId || invoiceData.externalId === externalId) {
              orderId = invoiceData.orderId;
              break;
            }
          }
        }

        if (!orderId) {
          throw new Error('Order ID tidak dapat ditemukan dari parameter pembayaran');
        }

        console.log('Found order ID:', orderId);

        // Check payment status via our backend
        const response = await apiRequest('GET', `/api/payment-status/${orderId}`);
        const paymentData = await response.json();
        
        console.log('Payment status response:', paymentData);
        setOrderData(paymentData);

        // Determine status based on response
        if (paymentData.paymentStatus === 'paid' || paymentData.status === 'completed') {
          setPaymentStatus('success');
          
          // Clean up localStorage
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('xendit_invoice_')) {
              const invoiceData = JSON.parse(localStorage.getItem(key) || '{}');
              if (invoiceData.orderId === orderId) {
                localStorage.removeItem(key);
              }
            }
          });
          
          toast({
            title: "Pembayaran Berhasil!",
            description: "Asesmen Anda sekarang tersedia di dashboard.",
          });
        } else if (paymentData.paymentStatus === 'pending') {
          setPaymentStatus('pending');
        } else {
          setPaymentStatus('failed');
          setError('Pembayaran tidak berhasil atau dibatalkan');
        }

      } catch (error: any) {
        console.error('Error checking payment status:', error);
        setError(error.message || 'Gagal memeriksa status pembayaran');
        setPaymentStatus('failed');
        
        toast({
          title: "Error",
          description: error.message || "Gagal memeriksa status pembayaran",
          variant: "destructive"
        });
      }
    };

    checkPaymentStatus();
  }, [toast]);

  const handleContinue = () => {
    if (paymentStatus === 'success') {
      setLocation('/dashboard');
    } else {
      setLocation('/cart');
    }
  };

  const handleRetryPayment = async () => {
    if (orderData?.orderId) {
      try {
        // Simulate payment completion for testing
        const response = await apiRequest('POST', `/api/xendit/simulate-payment/${orderData.orderId}`, {});
        const result = await response.json();
        
        if (result.success) {
          setPaymentStatus('success');
          toast({
            title: "Pembayaran Berhasil!",
            description: "Asesmen Anda sekarang tersedia di dashboard.",
          });
        } else {
          throw new Error(result.message || 'Gagal mensimulasikan pembayaran');
        }
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Gagal mengulang pembayaran",
          variant: "destructive"
        });
      }
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
                    <strong>Total:</strong> {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(orderData.totalAmount)}
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
                <Button onClick={handleRetryPayment} className="w-full">
                  Simulasi Pembayaran (Testing)
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
              <div className="space-y-2">
                <Button onClick={handleRetryPayment} className="w-full">
                  Simulasi Pembayaran (Testing)
                </Button>
                <Button onClick={handleContinue} variant="outline" className="w-full">
                  Kembali ke Keranjang
                </Button>
              </div>
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
            Hasil pembayaran Anda dengan Xendit
          </p>
        </div>

        {renderContent()}
      </main>

      <Footer />
    </div>
  );
}