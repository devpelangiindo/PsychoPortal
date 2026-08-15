import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Brain, Lock, IdCard, UserPlus, LogIn, ArrowRight } from "lucide-react";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { AssessmentCategoryGrid } from "@/pages/assessment-categories";
import logoPath from "@assets/Logo_Rumah_Psikologi_Pelangi_Indonesia_1752037860440.png";
import assessmentFrontOne from "@assets/asesmen-depan-1.png";
import assessmentFrontTwo from "@assets/asesmen-depan-2.png";
import assessmentFrontThree from "@assets/asesmen-depan-3.png";

const landingSlides = [
  { src: assessmentFrontOne, alt: "Buku asesmen dan evaluasi psikologi" },
  { src: assessmentFrontTwo, alt: "Gedung Pelangi Indonesia" },
  { src: assessmentFrontThree, alt: "Formulir asesmen profesional" },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const interval = window.setInterval(() => {
      setCurrentSlide((slide) => (slide + 1) % landingSlides.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  const handleGetStarted = () => {
    setLocation("/register");
  };

  const handleLogin = () => {
    setLocation("/login");
  };

  const handleStartAssessment = () => {
    setLocation("/assessments/online");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      {/* Hero Section - Assessments as Primary Focus */}
      <section className="relative isolate min-h-[680px] overflow-hidden bg-[#123f2f] py-20 md:py-24">
        <div className="absolute inset-0 -z-20" aria-hidden="true">
          {landingSlides.map((slide, index) => (
            <img
              key={slide.src}
              src={slide.src}
              alt=""
              loading={index === 0 ? "eager" : "lazy"}
              className={`absolute inset-0 h-full w-full object-cover transition-all duration-1000 ease-in-out ${
                index === currentSlide ? "scale-100 opacity-100" : "scale-105 opacity-0"
              }`}
            />
          ))}
        </div>
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(13,57,42,0.78)_0%,rgba(15,72,52,0.70)_55%,rgba(10,54,39,0.84)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-black/20 to-transparent" />

        <div className="relative mx-auto flex min-h-[520px] max-w-7xl flex-col justify-center px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <div className="rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-white/60">
                <img 
                  src={logoPath} 
                  alt="Rumah Psikologi Pelangi Indonesia" 
                  className="h-24 w-24 object-contain"
                />
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-6 tracking-normal">
              Platform <span className="text-[#D8F3DC]">Asesmen</span> Psikologi Profesional
            </h1>
            <p className="text-lg md:text-xl text-green-50/90 mb-8 max-w-3xl mx-auto leading-relaxed">
              Mulai perjalanan self-discovery Anda dengan asesmen psikologi teruji. Coba gratis beberapa pertanyaan sebelum mendaftar!
            </p>
            
            {/* Primary CTA - Start Assessment */}
            <div className="mb-6">
              <Button
                size="lg"
                className="px-10 py-5 text-lg md:text-xl font-bold bg-white text-[#1B4332] hover:bg-green-50 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
                onClick={handleStartAssessment}
              >
                <Brain className="w-6 h-6 mr-2" />
                Mulai Asesmen Sekarang
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>

            {/* Authentication Options */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Button 
                size="lg" 
                variant="outline"
                className="px-8 py-4 text-lg font-semibold border-white/80 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={handleGetStarted}
              >
                <UserPlus className="w-5 h-5 mr-2" />
                Daftar Sekarang
              </Button>
              <span className="text-sm text-green-50/80">atau</span>
              <Button variant="link" onClick={handleLogin} className="text-white hover:text-[#D8F3DC]">
                <LogIn className="w-4 h-4 mr-2" />
                Masuk jika sudah punya akun
              </Button>
            </div>
          </div>
        </div>

        <div className="absolute bottom-7 left-1/2 z-10 flex -translate-x-1/2 gap-2" role="tablist" aria-label="Pilih foto landing page">
          {landingSlides.map((slide, index) => (
            <button
              key={slide.alt}
              type="button"
              role="tab"
              aria-selected={index === currentSlide}
              aria-label={`Tampilkan foto ${index + 1}`}
              onClick={() => setCurrentSlide(index)}
              className={`h-2.5 rounded-full border border-white/35 shadow-sm transition-all ${index === currentSlide ? "w-8 bg-white" : "w-2.5 bg-white/45 hover:bg-white/80"}`}
            />
          ))}
        </div>
      </section>

      <section className="gradient-hero py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Assessment Categories */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Pilih Kategori Asesmen
            </h2>
            <p className="text-lg text-green-50/85 max-w-2xl mx-auto">
              Temukan asesmen online, layanan asesmen onsite, dan alat tes psikologi sesuai kebutuhan Anda
            </p>
          </div>
          <AssessmentCategoryGrid />
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
