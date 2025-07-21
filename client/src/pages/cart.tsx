import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, ArrowLeft } from "lucide-react";
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
  const [showPayment, setShowPayment] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(null);

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/orders", {
        assessmentIds: items.map(item => item.id)
      });
      return await response.json();
    },
    onSuccess: async (orderData) => {
      setCurrentOrderId(orderData.id);
      
      if (getTotalAmount() === 0) {
        // Free assessment - process immediately
        processDemoPaymentMutation.mutate({
          orderId: orderData.id,
          paymentMethod: 'free_access'
        });
      } else {
        // For paid assessments, directly create Xendit invoice and redirect
        try {
          console.log(`🚀 Starting direct Xendit payment for order ${orderData.id}`);
          
          // Prepare Xendit invoice data
          const invoiceData = {
            orderId: orderData.id,
            amount: getTotalAmount(),
            customerEmail: user?.email || '',
            customerName: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email || 'Customer',
            items: items.map(item => ({
              name: item.name,
              price: parseFloat(item.price),
              quantity: 1
            })),
            paymentMethod: 'BANK_TRANSFER', // Default method
            paymentChannel: 'BCA' // Default channel
          };

          // Create invoice directly
          const invoiceResponse = await apiRequest('POST', '/api/xendit/create-invoice', invoiceData);
          const invoiceResult = await invoiceResponse.json();
          
          if (invoiceResult.success && invoiceResult.invoiceUrl) {
            // Clear cart since order is created
            clearCart();
            
            // Store invoice info for tracking
            localStorage.setItem(`xendit_invoice_${orderData.id}`, JSON.stringify({
              invoiceId: invoiceResult.invoiceId,
              invoiceUrl: invoiceResult.invoiceUrl,
              externalId: invoiceResult.externalId,
              amount: invoiceResult.amount,
              orderId: orderData.id
            }));
            
            toast({
              title: 'Mengarahkan ke Pembayaran',
              description: 'Anda akan diarahkan ke halaman pembayaran Xendit...',
            });
            
            // Redirect directly to Xendit
            setTimeout(() => {
              window.location.href = invoiceResult.invoiceUrl;
            }, 1500);
          } else {
            throw new Error(invoiceResult.message || 'Gagal membuat invoice pembayaran');
          }
        } catch (error: any) {
          console.error('Xendit invoice creation error:', error);
          toast({
            title: "Error Pembayaran",
            description: error.message || "Gagal membuat invoice. Silakan coba lagi.",
            variant: "destructive"
          });
        }
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
    mutationFn: async ({ orderId, paymentMethod }: { orderId: number; paymentMethod: string }) => {
      const response = await apiRequest("POST", "/api/payments/create", {
        orderId,
        paymentMethod,
      });
      return await response.json();
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

    // For paid assessments, we'll handle Xendit payment directly after order creation
    createOrderMutation.mutate();
  };

  const handlePaymentSuccess = (invoiceData: any) => {
    // Clear cart and redirect to success page
    clearCart();
    setLocation(`/payment-success?orderId=${currentOrderId}`);
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
              Kembali ke Asesmen
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-foreground">Keranjang Belanja</h1>
        </div>

        {items.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <h3 className="text-lg font-semibold text-neutral-600 dark:text-muted-foreground mb-2">
                Keranjang Anda kosong
              </h3>
              <p className="text-neutral-500 dark:text-muted-foreground mb-6">
                Tambahkan asesmen ke keranjang untuk melanjutkan
              </p>
              <Link href="/assessments">
                <Button>Lihat Asesmen</Button>
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
              <Card className="sticky top-4 shadow-lg border-0 bg-white/95 dark:bg-card/95 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10 border-b border-neutral-100 dark:border-neutral-800">
                  <CardTitle className="text-center flex items-center justify-center space-x-2">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-lg">🛒</span>
                    </div>
                    <span className="text-xl font-bold text-neutral-800 dark:text-foreground">Ringkasan Pesanan</span>
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="p-0">
                  {/* Items Section */}
                  <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-sm text-neutral-700 dark:text-muted-foreground uppercase tracking-wider flex items-center">
                        <span className="w-2 h-2 bg-primary rounded-full mr-2"></span>
                        Item Dipilih
                      </h4>
                      <span className="text-xs bg-neutral-100 dark:bg-muted/50 px-2 py-1 rounded-full font-medium">
                        {items.length} item
                      </span>
                    </div>
                    
                    <div className="space-y-3">
                      {items.map((item, index) => (
                        <div key={item.id} className="group">
                          <div className="bg-gradient-to-r from-neutral-50 to-neutral-50/50 dark:from-muted/30 dark:to-muted/10 rounded-xl p-4 border border-neutral-200/50 dark:border-neutral-700/50 hover:shadow-md transition-all duration-200">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1 pr-3">
                                <div className="flex items-start space-x-2">
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium shrink-0">
                                    #{index + 1}
                                  </span>
                                  <h5 className="font-semibold text-sm text-neutral-800 dark:text-foreground leading-tight">
                                    {item.name}
                                  </h5>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                {parseFloat(item.price) === 0 ? (
                                  <div className="bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg px-3 py-1.5">
                                    <span className="text-green-700 dark:text-green-300 font-bold text-sm">GRATIS</span>
                                  </div>
                                ) : (
                                  <div className="text-right">
                                    <div className="text-primary font-bold text-lg">
                                      Rp {new Intl.NumberFormat('id-ID').format(parseFloat(item.price))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 text-xs text-neutral-600 dark:text-muted-foreground mb-3">
                              <div className="flex items-center space-x-1">
                                <span className="w-1 h-1 bg-blue-400 rounded-full"></span>
                                <span>⏱️ {item.duration}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <span className="w-1 h-1 bg-purple-400 rounded-full"></span>
                                <span>👥 {item.ageRange}</span>
                              </div>
                            </div>
                            
                            {item.type === 'sensory' && (
                              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-2.5">
                                <div className="flex items-center space-x-2">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                                    🎁 Bonus: Konsultasi Online Gratis
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Summary Section */}
                  <div className="p-6 bg-gradient-to-br from-neutral-50/50 to-white dark:from-muted/20 dark:to-card">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-dashed border-neutral-300 dark:border-neutral-600">
                        <span className="text-sm font-medium text-neutral-600 dark:text-muted-foreground">
                          Jumlah Item
                        </span>
                        <span className="font-semibold text-neutral-800 dark:text-foreground">
                          {items.length} asesmen
                        </span>
                      </div>
                      
                      <div className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-lg p-4 border border-primary/20">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-lg font-bold text-neutral-800 dark:text-foreground">Total Pembayaran</span>
                            <div className="text-xs text-neutral-500 dark:text-muted-foreground">
                              Semua biaya sudah termasuk
                            </div>
                          </div>
                          <div className="text-right">
                            {getTotalAmount() === 0 ? (
                              <div className="text-green-600 dark:text-green-400">
                                <div className="text-2xl font-bold">GRATIS</div>
                                <div className="text-xs bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
                                  Free Access
                                </div>
                              </div>
                            ) : (
                              <div className="text-primary">
                                <div className="text-2xl font-bold">
                                  Rp {new Intl.NumberFormat('id-ID').format(getTotalAmount())}
                                </div>
                                <div className="text-xs text-neutral-500 dark:text-muted-foreground">
                                  ~ {new Intl.NumberFormat('id-ID', { 
                                    style: 'currency', 
                                    currency: 'IDR',
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0
                                  }).format(getTotalAmount())}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Section */}
                  <div className="bg-gradient-to-br from-neutral-50/30 to-neutral-100/30 dark:from-muted/10 dark:to-muted/20 p-6 border-t border-neutral-200 dark:border-neutral-700">
                    {getTotalAmount() === 0 ? (
                      // Free access for Learning Style Assessment
                      <div className="space-y-4">
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4">
                          <div className="text-center space-y-2">
                            <div className="flex items-center justify-center space-x-2">
                              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                              <span className="text-lg font-bold text-green-700 dark:text-green-300">
                                🎉 AKSES SEPENUHNYA GRATIS!
                              </span>
                              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                            </div>
                            <p className="text-sm text-green-600 dark:text-green-400">
                              Tidak diperlukan pembayaran - langsung akses asesmen
                            </p>
                          </div>
                        </div>
                        
                        <Button 
                          className="w-full h-14 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 font-semibold text-lg" 
                          onClick={handleCheckout}
                          disabled={createOrderMutation.isPending}
                        >
                          {createOrderMutation.isPending ? (
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                              <span>Memproses Akses Gratis...</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center">
                              <span className="mr-3 text-xl">🚀</span>
                              <span>Dapatkan Akses Gratis Sekarang</span>
                            </div>
                          )}
                        </Button>
                      </div>
                    ) : (
                      // Payment with Xendit
                      <div className="space-y-4">
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-5">
                          <div className="text-center mb-4">
                            <h5 className="font-bold text-blue-900 dark:text-blue-100 text-lg flex items-center justify-center">
                              <span className="mr-2 text-xl">💳</span>
                              Metode Pembayaran Tersedia
                            </h5>
                            <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                              Pilih metode pembayaran yang paling sesuai untuk Anda
                            </p>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-3 text-xs text-blue-700 dark:text-blue-300">
                            <div className="bg-white/50 dark:bg-blue-800/20 p-2 rounded-lg text-center">
                              <div className="font-semibold">Bank Transfer</div>
                              <div className="text-xs opacity-75">BCA, BRI, BNI</div>
                            </div>
                            <div className="bg-white/50 dark:bg-blue-800/20 p-2 rounded-lg text-center">
                              <div className="font-semibold">E-Wallet</div>
                              <div className="text-xs opacity-75">DANA, OVO, dll</div>
                            </div>
                            <div className="bg-white/50 dark:bg-blue-800/20 p-2 rounded-lg text-center">
                              <div className="font-semibold">QRIS & CC</div>
                              <div className="text-xs opacity-75">Scan & Bayar</div>
                            </div>
                          </div>
                        </div>
                        
                        <Button 
                          className="w-full h-14 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white shadow-lg hover:shadow-xl transition-all duration-200 font-semibold text-lg" 
                          onClick={handleCheckout}
                          disabled={createOrderMutation.isPending}
                        >
                          {createOrderMutation.isPending ? (
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                              <span>Membuat Pesanan...</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center">
                              <span className="mr-3 text-xl">🔒</span>
                              <span>Lanjutkan ke Pembayaran Aman</span>
                            </div>
                          )}
                        </Button>
                      </div>
                    )}

                    {!isAuthenticated && (
                      <div className="mt-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
                        <div className="text-center">
                          <p className="text-sm font-medium text-amber-700 dark:text-amber-300 flex items-center justify-center">
                            <span className="mr-2 text-lg">⚠️</span>
                            Masuk diperlukan untuk melanjutkan checkout
                          </p>
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            Anda akan diarahkan ke halaman login secara otomatis
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>

      <Footer />

      {/* Payment modal removed - we now redirect directly to Xendit */}
    </div>
  );
}