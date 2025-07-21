import { useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Loader2 } from "lucide-react";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";

export default function AutoRedirect() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Show success message and redirect to dashboard
    toast({
      title: "Pembayaran Berhasil!",
      description: "Asesmen Anda sekarang tersedia di dashboard.",
    });

    // Clean up any localStorage items
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('xendit_invoice_')) {
        localStorage.removeItem(key);
      }
    });

    // Redirect to dashboard after 2 seconds
    const redirectTimer = setTimeout(() => {
      setLocation('/dashboard');
    }, 2000);

    return () => clearTimeout(redirectTimer);
  }, [toast, setLocation]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 dark:from-gray-900 dark:to-gray-800">
      <Header />
      
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="w-6 h-6" />
                Pembayaran Berhasil
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                Pembayaran Anda telah berhasil diproses. Asesmen sekarang tersedia di dashboard.
              </p>
              
              <div className="flex items-center justify-center gap-2 text-blue-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Mengarahkan ke dashboard...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}