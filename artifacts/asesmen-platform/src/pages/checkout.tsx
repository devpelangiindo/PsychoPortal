import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import MidtransPayment from "@/components/MidtransPayment";
import type { OrderWithItems } from "@shared/schema";

export default function Checkout() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Get order ID from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('orderId');

  const { data: order, isLoading, error } = useQuery<OrderWithItems>({
    queryKey: [`/api/orders/${orderId}`],
    enabled: !!orderId && isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Please sign in",
        description: "You need to sign in to access checkout",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
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
                    <div className="flex items-baseline text-neutral-900 dark:text-foreground ml-4">
                      <span className="text-base font-semibold mr-1">Rp</span>
                      <span className="text-lg font-semibold">{new Intl.NumberFormat('id-ID').format(parseFloat(item.price))}</span>
                    </div>
                  </div>
                ))}
                
                <div className="pt-4 border-t border-gray-200 dark:border-border">
                  <div className="flex justify-between items-center text-xl font-bold">
                    <span>Total</span>
                    <span className="flex items-baseline text-primary">
                      <span className="text-lg font-semibold mr-1">Rp</span>
                      <span className="text-xl font-bold">{new Intl.NumberFormat('id-ID').format(parseFloat(order.totalAmount))}</span>
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
                    Didukung oleh Midtrans
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Akses asesmen diberikan setelah pembayaran dikonfirmasi
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Form */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Pembayaran dengan Midtrans</CardTitle>
              </CardHeader>
              <CardContent>
                <MidtransPayment
                  orderId={order.id}
                  amount={Number(order.totalAmount)}
                  items={order.orderItems.map((item) => ({
                    id: String(item.assessmentId),
                    name: item.assessment.name,
                    price: Number(item.price),
                    quantity: 1,
                  }))}
                  onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/user-assessments"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
                    toast({
                      title: "Pembayaran Berhasil",
                      description: "Pembayaran telah dikonfirmasi oleh Midtrans.",
                    });
                    setLocation("/dashboard");
                  }}
                  onPending={() => setLocation(`/payment-return?orderId=${order.id}`)}
                  onError={() => {
                    toast({
                      title: "Pembayaran gagal dimulai",
                      description: "Silakan coba lagi beberapa saat lagi.",
                      variant: "destructive",
                    });
                  }}
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
