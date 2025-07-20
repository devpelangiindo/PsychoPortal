import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { XCircle, RefreshCw, Home, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface PaymentDetails {
  orderId: number;
  status: string;
  paymentStatus: string;
  paymentMethod?: string;
  totalAmount: string;
  items: Array<{
    assessmentName: string;
    price: string;
  }>;
}

export default function PaymentFailed() {
  const [location, navigate] = useLocation();
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const orderId = searchParams.get('orderId');

  useEffect(() => {
    if (orderId) {
      loadPaymentDetails();
    } else {
      toast({
        title: 'Error',
        description: 'Order ID tidak ditemukan',
        variant: 'destructive'
      });
      navigate('/dashboard');
    }
  }, [orderId]);

  const loadPaymentDetails = async () => {
    try {
      const details = await apiRequest('GET', `/api/payment-status/${orderId}`);
      setPaymentDetails(details);
      
      // Clear stored invoice data
      localStorage.removeItem(`xendit_invoice_${orderId}`);
    } catch (error: any) {
      console.error('Error loading payment details:', error);
      toast({
        title: 'Error',
        description: 'Gagal memuat detail pembayaran',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(parseFloat(amount));
  };

  const retryPayment = () => {
    // Navigate back to cart to retry payment
    navigate('/cart');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p>Memuat detail pembayaran...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!paymentDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Detail Tidak Ditemukan</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Tidak dapat memuat detail pembayaran
              </p>
              <Button onClick={() => navigate('/dashboard')} variant="outline">
                Kembali ke Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 mx-auto mb-4 rounded-full flex items-center justify-center">
            <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl text-red-600 dark:text-red-400">
            Pembayaran Gagal
          </CardTitle>
          <CardDescription>
            Maaf, pembayaran Anda tidak dapat diproses
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Payment Status */}
          <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <span className="font-medium">Status Pembayaran:</span>
            <Badge variant="destructive">
              {paymentDetails.paymentStatus === 'failed' ? 'Gagal' : 
               paymentDetails.paymentStatus === 'expired' ? 'Kedaluwarsa' : 
               paymentDetails.paymentStatus}
            </Badge>
          </div>

          {/* Order Details */}
          <div className="space-y-3">
            <h3 className="font-semibold">Detail Pesanan</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Order ID:</span>
                <span className="font-mono">#{paymentDetails.orderId}</span>
              </div>
              {paymentDetails.paymentMethod && (
                <div className="flex justify-between text-sm">
                  <span>Metode Pembayaran:</span>
                  <span className="capitalize">{paymentDetails.paymentMethod}</span>
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            <h3 className="font-semibold">Item yang Gagal Dibayar</h3>
            {paymentDetails.items.map((item, index) => (
              <div key={index} className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <span>{item.assessmentName}</span>
                <span className="font-medium">{formatCurrency(item.price)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t font-semibold">
              <span>Total:</span>
              <span>{formatCurrency(paymentDetails.totalAmount)}</span>
            </div>
          </div>

          {/* Common Reasons */}
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <h4 className="font-semibold mb-2 text-yellow-800 dark:text-yellow-200">
              Kemungkinan Penyebab:
            </h4>
            <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
              <li>• Saldo tidak mencukupi</li>
              <li>• Koneksi internet terputus</li>
              <li>• Waktu pembayaran habis</li>
              <li>• Pembatasan dari bank/e-wallet</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-4">
            <Button 
              onClick={retryPayment} 
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Coba Lagi Pembayaran
            </Button>
            
            <Button 
              onClick={() => navigate('/dashboard')} 
              variant="outline" 
              className="w-full"
            >
              <Home className="w-4 h-4 mr-2" />
              Kembali ke Dashboard
            </Button>
          </div>

          {/* Support Information */}
          <div className="text-xs text-center text-gray-500 dark:text-gray-400 pt-4 border-t">
            <p>Jika masalah berlanjut, silakan hubungi customer support:</p>
            <p className="font-medium mt-1">WhatsApp: +6281991466546</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}