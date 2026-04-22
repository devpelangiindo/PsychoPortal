import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShoppingCart, Brain, GraduationCap, Clock, Users, Shield, Lock, IdCard, InfoIcon, UserPlus, LogIn, ArrowRight } from "lucide-react";
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

  const handleStartAssessment = () => {
    setLocation("/assessments");
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
      {/* Hero Section - Assessments as Primary Focus */}
      <section className="gradient-hero py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
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
            <p className="text-xl text-neutral-500 dark:text-muted-foreground mb-8 max-w-3xl mx-auto">
              Mulai perjalanan self-discovery Anda dengan asesmen psikologi teruji. Coba gratis beberapa pertanyaan sebelum mendaftar!
            </p>
            
            {/* Primary CTA - Start Assessment */}
            <div className="mb-6">
              <Button
                size="lg"
                className="px-10 py-5 text-xl font-bold bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
                onClick={handleStartAssessment}
              >
                <Brain className="w-6 h-6 mr-2" />
                Mulai Asesmen Sekarang
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>

            {/* Authentication Options */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-12">
              <Button 
                size="lg" 
                variant="outline"
                className="px-8 py-4 text-lg font-semibold border-green-600 text-green-600 hover:bg-green-50"
                onClick={handleGetStarted}
              >
                <UserPlus className="w-5 h-5 mr-2" />
                Daftar Sekarang
              </Button>
              <span className="text-sm text-neutral-500 dark:text-muted-foreground">atau</span>
              <Button variant="link" onClick={handleLogin} className="text-green-600 hover:text-green-700">
                <LogIn className="w-4 h-4 mr-2" />
                Masuk jika sudah punya akun
              </Button>
            </div>
          </div>

          {/* Featured Assessments as Hero */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-foreground mb-4">
              Coba Asesmen Kami Sekarang!
            </h2>
            <p className="text-lg text-neutral-500 dark:text-muted-foreground max-w-2xl mx-auto">
              Pilih asesmen di bawah dan coba beberapa pertanyaan sample untuk merasakan pengalaman sebelum mendaftar
            </p>
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
      {/* About Us Section with Video */}
      <section className="py-20 bg-white dark:bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-foreground mb-4">
              Tentang Rumah Psikologi Pelangi Indonesia
            </h2>
            <p className="text-lg text-neutral-500 dark:text-muted-foreground max-w-3xl mx-auto">
              Mengenal lebih dekat profil, visi, dan misi kami dalam menyediakan layanan asesmen psikologi yang profesional dan terpercaya
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <div className="relative aspect-video rounded-lg overflow-hidden shadow-lg">
              <iframe
                width="100%"
                height="100%"
                src="https://www.youtube.com/embed/AHpKifVl9rA"
                title="Profil Rumah Psikologi Pelangi Indonesia"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              ></iframe>
            </div>
            
            <div className="mt-8 text-center">
              <p className="text-neutral-600 dark:text-muted-foreground mb-4">Tonton video profil kami untuk mengetahui lebih lanjut tentang tim profesional, fasilitas, dan komitmen kami dalam memberikan layanan asesmen psikologi.</p>
              <Button 
                variant="outline" 
                className="border-green-600 text-green-600 hover:bg-green-50"
                onClick={() => window.open('http://www.youtube.com/@rumahpsikologipi9364', '_blank')}
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  Kunjungi Channel YouTube Kami
                </div>
              </Button>
            </div>
          </div>
        </div>
      </section>
      {/* How It Works */}
      <section className="py-20 bg-white dark:bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-foreground mb-4">
              Cara Kerja
            </h2>
            <p className="text-lg text-neutral-500 dark:text-muted-foreground">Proses asesmen yang sederhana dan aman</p>
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
                Bayar dengan aman menggunakan gateway pembayaran Midtrans
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
              <p className="text-neutral-500 dark:text-muted-foreground">Terima laporan dan wawasan yang detail</p>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
