import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, CreditCard, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import PaymentForm from "@/components/payment-form";
import type { OrderWithItems } from "@shared/schema";

export default function Checkout() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'card' | 'bank'>('card');

  // Get order ID from URL params
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const orderId = urlParams.get('orderId');

  const { data: order, isLoading, error } = useQuery<OrderWithItems>({
    queryKey: [`/api/orders/${orderId}`],
    enabled: !!orderId && isAuthenticated,
  });

  const paymentMutation = useMutation({
    mutationFn: async (paymentData: { orderId: number; paymentMethod: string }) => {
      const response = await apiRequest("POST", "/api/payments/create", paymentData);
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Pembayaran Berhasil!",
        description: "Asesmen Anda sekarang tersedia di dashboard.",
        variant: "default",
      });
      setLocation("/dashboard");
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Tidak Diizinkan",
          description: "Anda telah keluar. Masuk lagi...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Payment Failed",
        description: "There was an error processing your payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePayment = () => {
    if (!order) return;
    
    paymentMutation.mutate({
      orderId: order.id,
      paymentMethod: selectedPaymentMethod,
    });
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Please sign in",
        description: "You need to sign in to access checkout",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [authLoading, isAuthenticated, toast]);

  useEffect(() => {
    if (!orderId) {
      setLocation("/cart");
    }
  }, [orderId, setLocation]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-muted rounded w-1/4" />
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="h-32 bg-muted rounded" />
                <div className="h-24 bg-muted rounded" />
              </div>
              <div className="h-64 bg-muted rounded" />
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Alert variant="destructive">
            <AlertDescription>
              {error ? "Failed to load order details" : "Order not found"}. 
              Please try again or contact support.
            </AlertDescription>
          </Alert>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => setLocation("/cart")} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke Keranjang
          </Button>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-foreground">
            Checkout Aman
          </h1>
          <p className="text-neutral-500 dark:text-muted-foreground mt-2">
            Selesaikan pembelian Anda untuk mengakses asesmen yang dipilih
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Order Summary */}
          <div>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Ringkasan Pesanan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {order.orderItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-start pb-4 border-b border-gray-100 dark:border-border last:border-b-0">
                    <div className="flex-1">
                      <h3 className="font-medium text-neutral-900 dark:text-foreground">
                        {item.assessment.name}
                      </h3>
                      <p className="text-sm text-neutral-500 dark:text-muted-foreground mt-1">
                        {item.assessment.duration} • {item.assessment.ageRange}
                      </p>
                    </div>
                    <div className="text-lg font-semibold text-neutral-900 dark:text-foreground ml-4">
                      Rp {new Intl.NumberFormat('id-ID').format(parseFloat(item.price))}
                    </div>
                  </div>
                ))}
                
                <div className="pt-4 border-t border-gray-200 dark:border-border">
                  <div className="flex justify-between items-center text-xl font-bold">
                    <span>Total</span>
                    <span className="text-primary">
                      Rp {new Intl.NumberFormat('id-ID').format(parseFloat(order.totalAmount))}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security Indicators */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-neutral-900 dark:text-foreground mb-4">
                  Pembayaran Aman
                </h3>
                <div className="space-y-2 text-sm text-neutral-500 dark:text-muted-foreground">
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Transaksi Terenkripsi SSL
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Didukung oleh Xendit
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Kepatuhan HIPAA
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Form */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Payment Method</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Payment Method Selection */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <button
                    onClick={() => setSelectedPaymentMethod('card')}
                    className={`payment-card p-4 rounded-lg border-2 transition-all ${
                      selectedPaymentMethod === 'card' ? 'selected' : ''
                    }`}
                  >
                    <CreditCard className="w-6 h-6 mx-auto mb-2" />
                    <span className="text-sm font-medium">Credit Card</span>
                  </button>
                  
                  <button
                    onClick={() => setSelectedPaymentMethod('bank')}
                    className={`payment-card p-4 rounded-lg border-2 transition-all ${
                      selectedPaymentMethod === 'bank' ? 'selected' : ''
                    }`}
                  >
                    <Building className="w-6 h-6 mx-auto mb-2" />
                    <span className="text-sm font-medium">Bank Transfer</span>
                  </button>
                </div>

                {/* Payment Form Component */}
                <PaymentForm
                  paymentMethod={selectedPaymentMethod}
                  amount={parseFloat(order.totalAmount)}
                  onSubmit={handlePayment}
                  isLoading={paymentMutation.isPending}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
