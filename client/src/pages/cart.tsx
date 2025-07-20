import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, ArrowLeft, CreditCard, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { useCart } from "@/lib/cart";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import XenditPayment from "@/components/XenditPayment";

export default function Cart() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { items, removeItem, clearCart, getTotalAmount } = useCart();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [paymentMethod, setPaymentMethod] = useState<'xendit' | 'demo'>('xendit');
  const [showPayment, setShowPayment] = useState(false);

  // Create order mutation for both demo and real payments
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const assessmentIds = items.map(item => item.id);
      const orderResponse = await apiRequest("POST", "/api/orders", { assessmentIds });
      return orderResponse;
    },
    onSuccess: (order) => {
      if (paymentMethod === 'demo' || getTotalAmount() === 0) {
        // Process demo payment immediately for free items or demo mode
        processDemoPayment(order.id);
      } else {
        // Show Xendit payment component
        setShowPayment(true);
      }
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Tidak Diizinkan",
          description: "Anda telah keluar. Masuk lagi...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Gagal membuat pesanan. Silakan coba lagi.",
        variant: "destructive",
      });
    },
  });

  // Demo payment processing
  const processDemoPaymentMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const paymentResponse = await apiRequest("POST", "/api/payments/create", {
        orderId,
        paymentMethod: 'demo',
      });
      return paymentResponse;
    },
    onSuccess: () => {
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["/api/user-assessments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      
      toast({
        title: getTotalAmount() === 0 ? "Akses Gratis Berhasil!" : "Pembayaran Demo Berhasil!",
        description: "Asesmen Anda sekarang tersedia di dashboard.",
        variant: "default",
      });
      setLocation("/dashboard");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Gagal memproses pembayaran. Silakan coba lagi.",
        variant: "destructive",
      });
    },
  });

  const processDemoPayment = (orderId: number) => {
    processDemoPaymentMutation.mutate(orderId);
  };

  const handleCheckout = () => {
    if (!isAuthenticated) {
      toast({
        title: "Silakan masuk",
        description: "Anda perlu masuk untuk melanjutkan checkout",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
      return;
    }

    createOrderMutation.mutate();
  };

  const handlePaymentSuccess = (invoiceData: any) => {
    // Clear cart and redirect to success page
    clearCart();
    setLocation(`/payment-success?orderId=${createOrderMutation.data?.id}`);
  };

  const handlePaymentError = (error: string) => {
    toast({
      title: "Error Pembayaran",
      description: error,
      variant: "destructive",
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-8" />
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-24 bg-muted rounded" />
              ))}
            </div>
          </div>
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
          <Link href="/assessments">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Lanjutkan Berbelanja
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-foreground">
            Keranjang Belanja
          </h1>
        </div>

        {items.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-6xl mb-4">🛒</div>
              <h2 className="text-2xl font-semibold text-neutral-900 dark:text-foreground mb-4">
                Keranjang Anda kosong
              </h2>
              <p className="text-neutral-500 dark:text-muted-foreground mb-8">
                Tambahkan beberapa asesmen untuk memulai perjalanan evaluasi psikologi Anda.
              </p>
              <Link href="/assessments">
                <Button size="lg">Jelajahi Asesmen</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {items.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-neutral-900 dark:text-foreground mb-2">
                          {item.name}
                        </h3>
                        <p className="text-neutral-500 dark:text-muted-foreground text-sm mb-4">
                          {item.description}
                        </p>
                        <div className="flex items-center space-x-4 text-sm text-neutral-500 dark:text-muted-foreground mb-3">
                          <span>⏱️ {item.duration}</span>
                          <span>👥 {item.ageRange}</span>
                        </div>
                        {item.type === 'sensory' && (
                          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2">
                            <div className="flex items-center">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                Gratis Konsultasi Online 1 Kali
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-6">
                        <div className="flex items-baseline text-primary mb-2">
                          {parseFloat(item.price) === 0 ? (
                            <span className="text-lg font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full">
                              Free Access
                            </span>
                          ) : (
                            <>
                              <span className="text-lg font-semibold mr-1">Rp</span>
                              <span className="text-2xl font-bold">{new Intl.NumberFormat('id-ID').format(parseFloat(item.price))}</span>
                            </>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Hapus
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Order Summary */}
            <div>
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle>Ringkasan Pesanan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-neutral-500 dark:text-muted-foreground truncate mr-2">
                          {item.name}
                        </span>
                        <span className="font-medium">
                          {parseFloat(item.price) === 0 ? (
                            <span className="text-green-600 bg-green-100 px-2 py-1 rounded text-xs">
                              Free
                            </span>
                          ) : (
                            `Rp ${new Intl.NumberFormat('id-ID').format(parseFloat(item.price))}`
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t pt-4">
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Total</span>
                      <span className="flex items-baseline text-primary">
                        {getTotalAmount() === 0 ? (
                          <span className="text-lg font-bold text-green-600">
                            Free Access
                          </span>
                        ) : (
                          <>
                            <span className="text-base font-semibold mr-1">Rp</span>
                            <span className="text-lg font-semibold">{new Intl.NumberFormat('id-ID').format(getTotalAmount())}</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {getTotalAmount() === 0 ? (
                    // Free access for Learning Style Assessment
                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={handleCheckout}
                      disabled={createOrderMutation.isPending}
                    >
                      {createOrderMutation.isPending ? "Memproses Akses..." : "Dapatkan Akses Gratis"}
                    </Button>
                  ) : (
                    // Payment options for paid assessments
                    <div className="space-y-4">
                      <Tabs value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as 'xendit' | 'demo')}>
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="xendit">
                            <CreditCard className="w-4 h-4 mr-2" />
                            Xendit Payment
                          </TabsTrigger>
                          <TabsTrigger value="demo">
                            <Zap className="w-4 h-4 mr-2" />
                            Demo Mode
                          </TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="xendit" className="mt-4">
                          <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            Bayar dengan berbagai metode melalui Xendit:
                            <ul className="list-disc list-inside mt-1 space-y-1">
                              <li>Virtual Account (BCA, BRI, BNI, dll)</li>
                              <li>E-wallet (DANA, OVO, GoPay, dll)</li>
                              <li>QRIS</li>
                              <li>Kartu Kredit</li>
                            </ul>
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="demo" className="mt-4">
                          <div className="text-sm text-yellow-600 dark:text-yellow-400 mb-3">
                            Mode demo untuk testing - pembayaran tidak akan diproses secara nyata.
                          </div>
                        </TabsContent>
                      </Tabs>
                      
                      <Button 
                        className="w-full" 
                        size="lg"
                        onClick={handleCheckout}
                        disabled={createOrderMutation.isPending || processDemoPaymentMutation.isPending}
                      >
                        {createOrderMutation.isPending ? "Membuat Pesanan..." : 
                         processDemoPaymentMutation.isPending ? "Memproses Pembayaran..." :
                         paymentMethod === 'demo' ? "Bayar Sekarang (Demo)" : "Lanjutkan ke Pembayaran"
                        }
                      </Button>
                    </div>
                  )}

                  {!isAuthenticated && (
                    <p className="text-sm text-center text-neutral-500 dark:text-muted-foreground">
                      Anda akan diminta masuk saat checkout
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>

      <Footer />

      {/* Xendit Payment Modal */}
      {showPayment && createOrderMutation.data && user && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="mb-4">
              <h2 className="text-2xl font-bold mb-2">Pembayaran</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPayment(false)}
                className="float-right"
              >
                ✕
              </Button>
            </div>
            
            <XenditPayment
              orderId={createOrderMutation.data.id}
              amount={getTotalAmount()}
              customerEmail={user.email || ''}
              customerName={user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email || 'Customer'}
              items={items.map(item => ({
                name: item.name,
                price: parseFloat(item.price),
                quantity: 1
              }))}
              onPaymentSuccess={handlePaymentSuccess}
              onPaymentError={handlePaymentError}
            />
          </div>
        </div>
      )}
    </div>
  );
}
