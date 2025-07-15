import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShoppingCart, Brain, GraduationCap, Clock, Users, Shield, Lock, IdCard, InfoIcon, UserPlus, LogIn } from "lucide-react";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import AssessmentCard from "@/components/assessment-card";
import type { Assessment } from "@shared/schema";
import logoPath from "@assets/Logo_Rumah_Psikologi_Pelangi_Indonesia_1752037860440.png";

export default function Landing() {
  const { data: assessments, isLoading } = useQuery<Assessment[]>({
    queryKey: ["/api/assessments"],
  });
  const [, setLocation] = useLocation();

  const handleGetStarted = () => {
    setLocation("/register");
  };

  const handleLogin = () => {
    setLocation("/login");
  };

  const handleLearnMore = () => {
    const assessmentsSection = document.getElementById('assessments');
    if (assessmentsSection) {
      assessmentsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      {/* Demo Mode Banner */}
      <div className="bg-blue-600 text-white py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center space-x-2">
            <InfoIcon className="h-5 w-5" />
            <span className="font-medium">
              Mode Demo Aktif - Sistem pembayaran menggunakan simulasi tanpa transaksi uang sungguhan
            </span>
          </div>
        </div>
      </div>
      {/* Hero Section */}
      <section className="gradient-hero py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <img 
                src={logoPath} 
                alt="Rumah Psikologi Pelangi Indonesia" 
                className="h-24 w-24 object-contain"
              />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold dark:text-foreground mb-6 text-[#248f59]">
              Platform <span className="text-primary">Asesmen</span> Psikologi Profesional
            </h1>
            <p className="text-xl text-neutral-500 dark:text-muted-foreground mb-8 max-w-3xl mx-auto">Akses asesmen psikologi yang telah divalidasi, termasuk Profil Sensori dan Inventori Gaya Belajar. Dengan model sistem pembayaran per-tes secara online yang aman.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="px-8 py-4 text-lg font-semibold bg-green-600 hover:bg-green-700"
                onClick={handleGetStarted}
              >
                <UserPlus className="w-5 h-5 mr-2" />
                Daftar Sekarang
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="px-8 py-4 text-lg font-semibold border-2"
                onClick={handleLearnMore}
              >
                Pelajari Lebih Lanjut
              </Button>
            </div>
            
            {/* Authentication Options */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center">
              <span className="text-sm text-neutral-500 dark:text-muted-foreground">Sudah punya akun?</span>
              <Button variant="link" onClick={handleLogin} className="text-green-600 hover:text-green-700">
                <LogIn className="w-4 h-4 mr-2" />
                Masuk di sini
              </Button>
            </div>
          </div>
        </div>
      </section>
      {/* Featured Assessments */}
      <section id="assessments" className="py-20 bg-white dark:bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-foreground mb-4">
              Asesmen yang Tersedia
            </h2>
            <p className="text-lg text-neutral-500 dark:text-muted-foreground max-w-2xl mx-auto">Pilih dari alat asesmen psikologi yang telah divalidasi berikut ini</p>
          </div>
          
          {isLoading ? (
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {[1, 2].map((i) => (
                <Card key={i} className="assessment-card-hover">
                  <div className="h-48 bg-muted animate-pulse" />
                  <CardContent className="p-8">
                    <div className="h-6 bg-muted rounded mb-4 animate-pulse" />
                    <div className="h-4 bg-muted rounded mb-2 animate-pulse" />
                    <div className="h-4 bg-muted rounded mb-6 animate-pulse" />
                    <div className="flex justify-between items-center">
                      <div className="h-8 w-20 bg-muted rounded animate-pulse" />
                      <div className="h-10 w-32 bg-muted rounded animate-pulse" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {assessments?.map((assessment) => (
                <AssessmentCard key={assessment.id} assessment={assessment} showAddToCart={true} />
              ))}
            </div>
          )}
        </div>
      </section>
      {/* How It Works */}
      <section className="py-20 bg-neutral-50 dark:bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-foreground mb-4">
              Cara Kerja
            </h2>
            <p className="text-lg text-neutral-500 dark:text-muted-foreground">
              Proses asesmen yang sederhana, aman, dan profesional
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingCart className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 dark:text-foreground mb-3">
                1. Pilih Asesmen
              </h3>
              <p className="text-neutral-500 dark:text-muted-foreground">
                Pilih dari alat asesmen psikologi yang telah divalidasi
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-secondary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Lock className="w-8 h-8 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 dark:text-foreground mb-3">
                2. Pembayaran Aman
              </h3>
              <p className="text-neutral-500 dark:text-muted-foreground">
                Bayar dengan aman menggunakan gateway pembayaran Xendit
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-accent/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Brain className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 dark:text-foreground mb-3">
                3. Ikuti Asesmen
              </h3>
              <p className="text-neutral-500 dark:text-muted-foreground">
                Selesaikan asesmen sesuai dengan kecepatan Anda
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-orange-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <IdCard className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 dark:text-foreground mb-3">
                4. Dapatkan Hasil
              </h3>
              <p className="text-neutral-500 dark:text-muted-foreground">
                Terima laporan profesional dan wawasan yang detail
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* Trust Indicators */}
      <section className="py-20 bg-white dark:bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-foreground mb-4">
              Dipercaya oleh Profesional
            </h2>
            <p className="text-lg text-neutral-500 dark:text-muted-foreground">
              Bergabung dengan ribuan profesional psikologi di seluruh dunia
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">10,000+</div>
              <div className="text-neutral-500 dark:text-muted-foreground">Asesmen Selesai</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-secondary mb-2">500+</div>
              <div className="text-neutral-500 dark:text-muted-foreground">Pengguna Profesional</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-accent mb-2">99.9%</div>
              <div className="text-neutral-500 dark:text-muted-foreground">Keandalan Uptime</div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-8">
            
            <div className="trust-indicator">
              <Lock className="w-5 h-5" />
              <span>Terenkripsi SSL</span>
            </div>
            <div className="trust-indicator">
              <IdCard className="w-5 h-5" />
              <span>Tervalidasi Ilmiah</span>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
