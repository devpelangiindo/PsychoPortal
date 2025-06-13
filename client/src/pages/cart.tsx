import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

export default function Cart() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { items, removeItem, clearCart, getTotalAmount } = useCart();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const assessmentIds = items.map(item => item.id);
      const response = await apiRequest("POST", "/api/orders", { assessmentIds });
      return response.json();
    },
    onSuccess: (order) => {
      clearCart();
      setLocation(`/checkout?orderId=${order.id}`);
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
        title: "Error",
        description: "Gagal membuat pesanan. Silakan coba lagi.",
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
        window.location.href = "/api/login";
      }, 500);
      return;
    }

    createOrderMutation.mutate();
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
                        <div className="flex items-center space-x-4 text-sm text-neutral-500 dark:text-muted-foreground">
                          <span>⏱️ {item.duration}</span>
                          <span>👥 {item.ageRange}</span>
                        </div>
                      </div>
                      <div className="text-right ml-6">
                        <div className="text-2xl font-bold text-primary mb-2">
                          Rp {new Intl.NumberFormat('id-ID').format(parseFloat(item.price))}
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
                          Rp {new Intl.NumberFormat('id-ID').format(parseFloat(item.price))}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t pt-4">
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Total</span>
                      <span className="text-primary">
                        Rp {new Intl.NumberFormat('id-ID').format(getTotalAmount())}
                      </span>
                    </div>
                  </div>

                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={handleCheckout}
                    disabled={createOrderMutation.isPending}
                  >
                    {createOrderMutation.isPending ? "Memproses..." : "Lanjut ke Checkout"}
                  </Button>

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
    </div>
  );
}
