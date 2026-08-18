import { useState } from "react";
import { createPortal } from "react-dom";
import { Brain, GraduationCap, Lightbulb, Clock, Users, Play, Eye, HeartPulse, MessageCircle, BrainCircuit, BriefcaseBusiness } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import SampleQuestions, { SampleResults } from "@/components/sample-questions";
import type { Assessment } from "@shared/schema";
import sensoryProfileImage from "@assets/asesmen-profil-sensori.png";
import learningStyleImage from "@assets/inventory-gaya-belajar.png";
import mentalHealthCheckUpImage from "@assets/mental-health-check-up.png";
import studentPotentialImage from "@assets/tes-intelegensi-potensi-siswa-sma.png";

const catalogImages: Record<string, { src: string; alt: string }> = {
  sensory: {
    src: sensoryProfileImage,
    alt: "Anak melakukan aktivitas permainan sensoris",
  },
  learning: {
    src: learningStyleImage,
    alt: "Ilustrasi Inventory Gaya Belajar",
  },
  "external-mental-health": {
    src: mentalHealthCheckUpImage,
    alt: "Sesi pemeriksaan awal kesehatan mental bersama tenaga profesional",
  },
  "external-student-potential": {
    src: studentPotentialImage,
    alt: "Siswa mengerjakan tes intelegensi dan potensi",
  },
};

const externalAssessmentTypes = new Set(["external-mental-health", "external-student-potential"]);

interface AssessmentCardProps {
  assessment: Assessment;
  showAddToCart: boolean;
  showCatalogImage?: boolean;
}

export default function AssessmentCard({ assessment, showAddToCart, showCatalogImage = false }: AssessmentCardProps) {
  const { toast } = useToast();
  const { addItem, items } = useCart();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [showSample, setShowSample] = useState(false);
  const [showSampleResults, setShowSampleResults] = useState(false);

  const isInCart = items.some(item => item.id === assessment.id);
  const isFree = parseFloat(assessment.price) === 0;
  const isAdmin = user?.role === 'admin';
  const isInternal = user?.role === 'internal';
  const isExternalAssessment = externalAssessmentTypes.has(assessment.type);
  const catalogImage = showCatalogImage ? catalogImages[assessment.type] : undefined;

  const getIcon = (type: string) => {
    if (type === 'sensory') {
      return <Brain className="w-12 h-12 text-secondary" />;
    } else if (type === 'intelligence') {
      return <Lightbulb className="w-12 h-12 text-purple-600" />;
    } else if (type === 'mental-health') {
      return <HeartPulse className="w-12 h-12 text-rose-600" />;
    } else if (type === 'external-mental-health') {
      return <HeartPulse className="w-12 h-12 text-rose-600" />;
    } else if (type === 'external-student-potential') {
      return <BrainCircuit className="w-12 h-12 text-indigo-600" />;
    } else if (type === 'student-potential') {
      return <BrainCircuit className="w-12 h-12 text-indigo-600" />;
    } else if (type === 'career-potential') {
      return <BriefcaseBusiness className="w-12 h-12 text-emerald-700" />;
    }
    return <GraduationCap className="w-12 h-12 text-accent" />;
  };

  const getGradientClass = (type: string) => {
    if (type === 'sensory') {
      return 'bg-secondary-light';
    } else if (type === 'intelligence') {
      return 'bg-purple-100 dark:bg-purple-900/20';
    } else if (type === 'mental-health') {
      return 'bg-rose-100 dark:bg-rose-950/30';
    } else if (type === 'external-mental-health') {
      return 'bg-gradient-to-br from-rose-100 to-orange-100 dark:from-rose-950/30 dark:to-orange-950/30';
    } else if (type === 'external-student-potential') {
      return 'bg-gradient-to-br from-indigo-100 to-cyan-100 dark:from-indigo-950/30 dark:to-cyan-950/30';
    } else if (type === 'student-potential') {
      return 'bg-gradient-to-br from-indigo-100 to-cyan-100 dark:from-indigo-950/30 dark:to-cyan-950/30';
    } else if (type === 'career-potential') {
      return 'bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-950/30 dark:to-teal-950/30';
    }
    return 'bg-accent-light';
  };

  const getIconLabel = (type: string) => {
    if (type === 'sensory') {
      return 'Pemrosesan Sensoris';
    } else if (type === 'intelligence') {
      return 'Kecerdasan Majemuk';
    } else if (type === 'mental-health') {
      return 'Kesehatan Mental';
    } else if (type === 'external-mental-health') {
      return 'Kesehatan Mental';
    } else if (type === 'external-student-potential') {
      return 'Potensi Siswa SMA';
    } else if (type === 'student-potential') {
      return 'Potensi Siswa SMA';
    } else if (type === 'career-potential') {
      return 'Potensi Karir Perusahaan';
    }
    return 'Preferensi Belajar';
  };

  // Mutation untuk direct access free assessment
  const directAccessMutation = useMutation({
    mutationFn: async (assessmentId: number) => {
      const response = await fetch(`/api/assessments/${assessmentId}/direct-access`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Gagal mengakses asesmen');
      }
      
      return response.json();
    },
    onSuccess: (data: { userAssessmentId: number; isAdminAccess?: boolean; isInternalAccess?: boolean }) => {
      toast({
        title: data.isAdminAccess 
          ? "Akses Admin Berhasil!" 
          : data.isInternalAccess 
            ? "Akses Internal Berhasil!"
            : "Akses Gratis Berhasil!",
        description: `${assessment.name} siap untuk dikerjakan.`,
        variant: "default",
      });
      // Redirect to assessment taking page based on assessment type
      if (assessment.type === 'sensory') {
        setLocation(`/sensory-profile/${data.userAssessmentId}`);
      } else if (assessment.type === 'learning') {
        setLocation(`/learning-style/${data.userAssessmentId}`);
      } else if (assessment.type === 'intelligence') {
        setLocation(`/multiple-intelligence/${data.userAssessmentId}`);
      } else if (assessment.type === 'mental-health') {
        setLocation(`/mental-health-checkup/${data.userAssessmentId}`);
      } else if (assessment.type === 'student-potential') {
        setLocation(`/student-potential-test/${data.userAssessmentId}`);
      } else if (assessment.type === 'career-potential') {
        setLocation(`/career-potential-test/${data.userAssessmentId}`);
      } else {
        // Fallback to assessment detail page
        setLocation(`/assessment/${assessment.id}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Gagal Mengakses Asesmen",
        description: error.message || "Terjadi kesalahan saat mengakses asesmen gratis.",
        variant: "destructive",
      });
    },
  });

  const handleTrySample = () => {
    setShowSample(true);
  };

  const handleSampleComplete = () => {
    setShowSample(false);
    setShowSampleResults(true);
  };

  const handleCloseSample = () => {
    setShowSample(false);
    setShowSampleResults(false);
  };

  const handleSignupFromSample = () => {
    setShowSampleResults(false);
    setLocation("/register");
  };

  const handleLoginFromSample = () => {
    setShowSampleResults(false);
    setLocation("/login");
  };

  const getAssessmentType = (): 'sensory' | 'learning' | 'intelligence' => {
    return assessment.type as 'sensory' | 'learning' | 'intelligence';
  };

  const handleAddToCart = () => {
    if (isInCart) {
      toast({
        title: "Sudah di Keranjang",
        description: "Asesmen ini sudah ada di keranjang Anda.",
        variant: "default",
      });
      return;
    }

    addItem({
      id: assessment.id,
      name: assessment.name,
      price: assessment.price,
      description: assessment.description,
      duration: assessment.duration,
      ageRange: assessment.ageRange,
      type: assessment.type,
    });

    toast({
      title: "Ditambahkan ke Keranjang",
      description: `${assessment.name} telah ditambahkan ke keranjang Anda.`,
      variant: "default",
    });
  };

  const handleDirectAccess = () => {
    if (!user) {
      toast({
        title: "Login Diperlukan",
        description: "Silakan login terlebih dahulu untuk mengakses asesmen gratis.",
        variant: "default",
      });
      setLocation("/login");
      return;
    }

    directAccessMutation.mutate(assessment.id);
  };

  const handleExternalCheckout = () => {
    if (!isInCart) {
      addItem({
        id: assessment.id,
        name: assessment.name,
        price: assessment.price,
        description: assessment.description,
        duration: assessment.duration,
        ageRange: assessment.ageRange,
        type: assessment.type,
      });
    }
    if (!user) {
      toast({ title: "Login Diperlukan", description: "Produk sudah disimpan di keranjang. Silakan login untuk melanjutkan transaksi." });
      setLocation("/login");
      return;
    }
    setLocation("/cart");
  };

  return (
    <Card className="assessment-card-hover bg-white dark:bg-card rounded-2xl shadow-lg border border-gray-100 dark:border-border overflow-hidden">
      {/* Professional assessment illustration */}
      {catalogImage ? (
        <div className="relative h-52 overflow-hidden bg-neutral-100">
          <img
            src={catalogImage.src}
            alt={catalogImage.alt}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
          <h3 className="absolute bottom-4 left-5 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-neutral-900 shadow-md">
            {getIconLabel(assessment.type)}
          </h3>
        </div>
      ) : (
        <div className={`h-48 ${getGradientClass(assessment.type)} flex items-center justify-center`}>
          <div className="text-center">
            {getIcon(assessment.type)}
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-foreground mt-4">
              {getIconLabel(assessment.type)}
            </h3>
          </div>
        </div>
      )}
      
      <CardContent className="p-8">
        <h3 className="text-2xl font-bold text-neutral-900 dark:text-foreground mb-4">
          {assessment.name}
        </h3>
        <p className="text-neutral-500 dark:text-muted-foreground mb-6 leading-relaxed">
          {assessment.description}
        </p>
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center text-sm text-neutral-500 dark:text-muted-foreground">
            <Clock className="w-4 h-4 mr-2" />
            <span>{assessment.duration}</span>
          </div>
          <div className="flex items-center text-sm text-neutral-500 dark:text-muted-foreground">
            <Users className="w-4 h-4 mr-2" />
            <span>{assessment.ageRange}</span>
          </div>
        </div>
        
        {/* Special benefit for Sensory Profile */}
        {assessment.type === 'sensory' && (
          <div className="mb-4">
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Gratis Konsultasi Online 1 Kali
                </span>
              </div>
            </div>
          </div>
        )}
        
        {assessment.type === 'mental-health' && (
          <div className="mb-4 space-y-3">
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200">
              Free access sementara. Hasil merupakan skrining awal dan bukan diagnosis.
            </div>
            <a
              href="https://wa.me/6285117658242?text=Halo%20PI%2C%20saya%20ingin%20mengetahui%20lebih%20lanjut%20tentang%20Mental%20Health%20Check%20Up."
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center rounded-md border-2 border-green-600 px-4 py-2 text-sm font-semibold text-green-700 transition-colors hover:bg-green-50"
            >
              <MessageCircle className="mr-2 h-4 w-4" />MORE INFO ...
            </a>
          </div>
        )}

        {assessment.type === 'external-mental-health' && (
          <div className="mb-4 space-y-3">
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200">
              Setelah pembayaran berhasil, nomor token, link pengerjaan, dan ketentuan tes akan tersedia di dashboard Anda.
            </div>
            <a
              href="https://wa.me/6285117658242?text=Halo%20PI%2C%20saya%20ingin%20mengetahui%20lebih%20lanjut%20tentang%20Mental%20Health%20Check%20Up."
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center rounded-md border-2 border-green-600 px-4 py-2 text-sm font-semibold text-green-700 transition-colors hover:bg-green-50"
            >
              <MessageCircle className="mr-2 h-4 w-4" />MORE INFO ...
            </a>
          </div>
        )}

        {assessment.type === 'external-student-potential' && (
          <div className="mb-4 space-y-3">
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/20 dark:text-indigo-200">
              Setelah pembayaran berhasil, nomor token, link pengerjaan, dan ketentuan tes akan tersedia di dashboard Anda.
            </div>
            <a
              href="https://wa.me/6285117658242?text=Halo%20PI%2C%20saya%20ingin%20mengetahui%20lebih%20lanjut%20tentang%20Paket%20Tes%20Intelegensi%20%26%20Potensi%20Siswa%20(SMA)."
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center rounded-md border-2 border-green-600 px-4 py-2 text-sm font-semibold text-green-700 transition-colors hover:bg-green-50"
            >
              <MessageCircle className="mr-2 h-4 w-4" />MORE INFO ...
            </a>
          </div>
        )}

        {assessment.type === 'student-potential' && (
          <div className="mb-4 space-y-3">
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/20 dark:text-indigo-200">
              Free access sementara. Hasil berupa pemetaan awal potensi, bukan skor IQ formal.
            </div>
            <a href="https://wa.me/6285117658242?text=Halo%20PI%2C%20saya%20ingin%20mengetahui%20lebih%20lanjut%20tentang%20Paket%20Tes%20Intelegensi%20%26%20Potensi%20Siswa%20(SMA)." target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center rounded-md border-2 border-green-600 px-4 py-2 text-sm font-semibold text-green-700 transition-colors hover:bg-green-50">
              <MessageCircle className="mr-2 h-4 w-4" />MORE INFO ...
            </a>
          </div>
        )}

        {assessment.type === 'career-potential' && (
          <div className="mb-4 space-y-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
              Free access sementara. Hasil merupakan pemetaan awal dan bukan keputusan ketenagakerjaan otomatis.
            </div>
            <a href="https://wa.me/6285117658242?text=Halo%20PI%2C%20saya%20ingin%20mengetahui%20lebih%20lanjut%20tentang%20Tes%20Potensi%20Karir%20(Perusahaan)." target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center rounded-md border-2 border-green-600 px-4 py-2 text-sm font-semibold text-green-700 transition-colors hover:bg-green-50">
              <MessageCircle className="mr-2 h-4 w-4" />MORE INFO ...
            </a>
          </div>
        )}

        {/* Try Sample Button - Always Visible */}
        {assessment.type !== 'mental-health' && !isExternalAssessment && assessment.type !== 'student-potential' && assessment.type !== 'career-potential' && <div className="mb-4">
          <Button
            onClick={handleTrySample}
            variant="outline"
            size="sm"
            className="w-full px-4 py-2 rounded-lg font-medium transition-all duration-200 border-2 border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
            data-testid={`button-try-sample-${assessment.id}`}
          >
            <Eye className="w-4 h-4 mr-2" />
            Coba Sample Gratis
          </Button>
        </div>}

        <div className="flex items-center justify-between">
          <div className="flex items-baseline text-primary">
            {assessment.type === 'career-potential' ? (
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-500 line-through">Rp 600.000</span>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-2xl font-bold text-emerald-700">Rp 450.000</span>
                  <span className="rounded-full bg-green-100 px-2 py-1 text-[11px] font-bold text-green-700">GRATIS SEMENTARA</span>
                </div>
              </div>
            ) : assessment.type === 'student-potential' || assessment.type === 'external-student-potential' ? (
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-500 line-through">Rp 350.000</span>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-2xl font-bold text-indigo-600">Rp 190.000</span>
                  {assessment.type === 'student-potential' && <span className="rounded-full bg-green-100 px-2 py-1 text-[11px] font-bold text-green-700">GRATIS SEMENTARA</span>}
                </div>
              </div>
            ) : assessment.type === 'mental-health' || assessment.type === 'external-mental-health' ? (
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-500 line-through">Rp 200.000</span>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-2xl font-bold text-rose-600">Rp 129.000</span>
                </div>
              </div>
            ) : parseFloat(assessment.price) === 0 ? (
              <span className="text-xl font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full">
                Free Access
              </span>
            ) : assessment.type === 'sensory' ? (
              // Special promotional pricing for Sensory Profile Assessment
              <div className="flex flex-col">
                <div className="flex items-baseline">
                  <span className="text-sm font-medium text-gray-500 line-through mr-2">
                    Rp {new Intl.NumberFormat('id-ID').format(500000)}
                  </span>
                  <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full font-semibold">
                    PROMO
                  </span>
                </div>
                <div className="flex items-baseline mt-1">
                  <span className="text-lg font-semibold mr-1 text-red-600">Rp</span>
                  <span className="text-2xl font-bold text-red-600">{new Intl.NumberFormat('id-ID').format(parseFloat(assessment.price))}</span>
                </div>
              </div>
            ) : (
              <>
                <span className="text-lg font-semibold mr-1">Rp</span>
                <span className="text-2xl font-bold">{new Intl.NumberFormat('id-ID').format(parseFloat(assessment.price))}</span>
              </>
            )}
          </div>
          {showAddToCart && (
            <>
              {isExternalAssessment ? (
                <Button
                  onClick={handleExternalCheckout}
                  size="sm"
                  className={assessment.type === 'external-student-potential' ? "bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700" : "bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"}
                  data-testid={`button-register-${assessment.id}`}
                >
                  DAFTAR SEKARANG
                </Button>
              ) : isFree || isAdmin || isInternal ? (
                <Button
                  onClick={handleDirectAccess}
                  disabled={directAccessMutation.isPending}
                  size="sm"
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg text-sm ${
                    (isAdmin || isInternal) && !isFree
                      ? 'bg-purple-600 hover:bg-purple-700 text-white hover:scale-105 disabled:opacity-50'
                      : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105 disabled:opacity-50'
                  }`}
                  data-testid={`button-access-${assessment.id}`}
                >
                  <Play className="w-4 h-4 mr-2" />
                  {directAccessMutation.isPending 
                    ? "Memproses..." 
                    : (isAdmin || isInternal) && !isFree 
                      ? (isAdmin ? "Akses sebagai Admin" : "Akses Internal")
                      : "Mulai Sekarang"
                  }
                </Button>
              ) : (
                <Button
                  onClick={handleAddToCart}
                  disabled={isInCart}
                  size="sm"
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg text-sm ${
                    isInCart 
                      ? 'bg-gray-400 text-white cursor-not-allowed' 
                      : 'bg-green-600 hover:bg-green-700 text-white hover:scale-105'
                  }`}
                  data-testid={`button-cart-${assessment.id}`}
                >
                  {isInCart ? "✓ Di Keranjang" : "+ Keranjang"}
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>

      {/* Sample Questions Modal - Rendered as Portal for full-screen */}
      {showSample && createPortal(
        <SampleQuestions
          assessmentType={getAssessmentType()}
          assessmentName={assessment.name}
          onComplete={handleSampleComplete}
          onClose={handleCloseSample}
        />,
        document.body
      )}

      {/* Sample Results Modal - Rendered as Portal for full-screen */}
      {showSampleResults && createPortal(
        <SampleResults
          assessmentType={getAssessmentType()}
          assessmentName={assessment.name}
          onSignup={handleSignupFromSample}
          onLogin={handleLoginFromSample}
          onClose={handleCloseSample}
        />,
        document.body
      )}
    </Card>
  );
}
