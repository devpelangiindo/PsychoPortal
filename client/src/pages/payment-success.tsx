import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Download, Home, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface PaymentDetails {
  orderId: number;
  status: string;
  paymentStatus: string;
  paymentMethod?: string;
  totalAmount: string;
  paidAt?: string;
  items: Array<{
    assessmentName: string;
    price: string;
  }>;
}

export default function PaymentSuccess() {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4" />
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
                <Clock className="w-8 h-8 text-red-600 dark:text-red-400" />
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

  const isPaymentCompleted = paymentDetails.paymentStatus === 'completed';

  return (
    <div className={`min-h-screen bg-gradient-to-br ${
      isPaymentCompleted 
        ? 'from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20'
        : 'from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20'
    } flex items-center justify-center p-4`}>
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
            isPaymentCompleted 
              ? 'bg-green-100 dark:bg-green-900/30'
              : 'bg-yellow-100 dark:bg-yellow-900/30'
          }`}>
            {isPaymentCompleted ? (
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            ) : (
              <Clock className="w-10 h-10 text-yellow-600 dark:text-yellow-400" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isPaymentCompleted ? 'Pembayaran Berhasil!' : 'Pembayaran Dalam Proses'}
          </CardTitle>
          <CardDescription>
            {isPaymentCompleted 
              ? 'Terima kasih, pembayaran Anda telah berhasil diproses'
              : 'Pembayaran Anda sedang diverifikasi'
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Payment Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <span className="font-medium">Status Pembayaran:</span>
            <Badge variant={isPaymentCompleted ? 'default' : 'secondary'}>
              {paymentDetails.paymentStatus === 'completed' ? 'Lunas' : 
               paymentDetails.paymentStatus === 'pending' ? 'Menunggu' : 
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
              {paymentDetails.paidAt && (
                <div className="flex justify-between text-sm">
                  <span>Tanggal Pembayaran:</span>
                  <span>{formatDate(paymentDetails.paidAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Items Purchased */}
          <div className="space-y-3">
            <h3 className="font-semibold">Item yang Dibeli</h3>
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

          {/* Actions */}
          <div className="space-y-3 pt-4">
            {isPaymentCompleted && (
              <Button 
                onClick={() => navigate('/dashboard')} 
                className="w-full"
                size="lg"
              >
                <Home className="w-4 h-4 mr-2" />
                Mulai Asesmen
              </Button>
            )}
            
            <Button 
              onClick={() => navigate('/dashboard')} 
              variant="outline" 
              className="w-full"
            >
              Kembali ke Dashboard
            </Button>
          </div>

          {/* Information */}
          <div className="text-xs text-center text-gray-500 dark:text-gray-400 pt-4 border-t">
            {isPaymentCompleted ? (
              <p>Asesmen Anda sudah dapat diakses di dashboard. Silakan klik "Mulai Asesmen" untuk memulai.</p>
            ) : (
              <p>Jika pembayaran sudah dilakukan, status akan terupdate otomatis dalam beberapa menit. Refresh halaman jika diperlukan.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}