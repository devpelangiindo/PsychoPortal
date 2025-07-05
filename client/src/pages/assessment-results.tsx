import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Eye, Ear, Hand, Brain, BarChart3, FileText, Share2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import type { UserAssessmentWithDetails } from "@shared/schema";

export default function AssessmentResults() {
  const { isAuthenticated } = useAuth();
  const [, params] = useRoute("/results/:userAssessmentId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const userAssessmentId = params?.userAssessmentId ? parseInt(params.userAssessmentId) : null;

  const { data: userAssessment, isLoading } = useQuery<UserAssessmentWithDetails>({
    queryKey: [`/api/user-assessments/result/${userAssessmentId}`],
    enabled: !!userAssessmentId && isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      toast({
        title: "Tidak Diizinkan",
        description: "Anda perlu masuk untuk melihat hasil asesmen.",
        variant: "destructive",
      });
      window.location.href = "/login";
    }
  }, [isAuthenticated, toast]);

  const downloadPdfMutation = useMutation({
    mutationFn: async () => {
      if (!userAssessment) throw new Error("No assessment found");
      const response = await fetch(`/api/user-assessments/${userAssessment.id}/pdf`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/pdf',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Hasil_${userAssessment.assessment.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({
        title: "Berhasil!",
        description: "Laporan PDF telah berhasil diunduh.",
      });
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
        description: "Gagal mengunduh laporan PDF. Silakan coba lagi.",
        variant: "destructive",
      });
    },
  });

  const shareResultsMutation = useMutation({
    mutationFn: async () => {
      if (!userAssessment) throw new Error("No assessment found");
      const response = await apiRequest("POST", `/api/user-assessments/${userAssessment.id}/share`);
      return response;
    },
    onSuccess: (data: any) => {
      const shareUrl = `${window.location.origin}/shared-results/${data.shareToken}`;
      
      if (navigator.share) {
        navigator.share({
          title: `Hasil ${userAssessment?.assessment.name}`,
          text: `Lihat hasil asesmen ${userAssessment?.assessment.name} saya`,
          url: shareUrl,
        });
      } else {
        navigator.clipboard.writeText(shareUrl);
        toast({
          title: "Berhasil!",
          description: "Link hasil asesmen telah disalin ke clipboard.",
        });
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
        description: "Gagal membagikan hasil. Silakan coba lagi.",
        variant: "destructive",
      });
    },
  });

  const renderLearningStyleResults = (results: any) => {
    const { scores, dominantStyle } = results;
    const total = Object.values(scores).reduce((sum: number, score: any) => sum + score, 0);

    const getStyleInfo = (style: string) => {
      switch (style) {
        case 'visual':
          return {
            icon: <Eye className="w-6 h-6" />,
            name: 'Visual',
            color: 'bg-blue-500',
            bgColor: 'bg-blue-50 dark:bg-blue-950/20',
            description: 'Belajar terbaik melalui melihat dan mengamati. Lebih mudah memahami informasi melalui diagram, grafik, dan presentasi visual.'
          };
        case 'auditori':
          return {
            icon: <Ear className="w-6 h-6" />,
            name: 'Auditori',
            color: 'bg-green-500',
            bgColor: 'bg-green-50 dark:bg-green-950/20',
            description: 'Belajar terbaik melalui mendengar dan berbicara. Lebih mudah memahami informasi melalui penjelasan lisan dan diskusi.'
          };
        case 'kinestetik':
          return {
            icon: <Hand className="w-6 h-6" />,
            name: 'Kinestetik',
            color: 'bg-orange-500',
            bgColor: 'bg-orange-50 dark:bg-orange-950/20',
            description: 'Belajar terbaik melalui praktik langsung dan gerakan. Lebih mudah memahami informasi melalui aktivitas hands-on.'
          };
        default:
          return {
            icon: <Brain className="w-6 h-6" />,
            name: 'Campuran',
            color: 'bg-purple-500',
            bgColor: 'bg-purple-50 dark:bg-purple-950/20',
            description: 'Menggunakan kombinasi gaya belajar yang seimbang.'
          };
      }
    };

    const dominantInfo = getStyleInfo(dominantStyle);

    return (
      <div className="space-y-6">
        {/* Dominant Style */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Gaya Belajar Dominan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`p-6 rounded-lg ${dominantInfo.bgColor}`}>
              <div className="flex items-center gap-4 mb-4">
                <div className={`p-3 rounded-full ${dominantInfo.color} text-white`}>
                  {dominantInfo.icon}
                </div>
                <div>
                  <h3 className="text-2xl font-bold">{dominantInfo.name}</h3>
                  <p className="text-neutral-600 dark:text-neutral-300">
                    {dominantInfo.description}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Score Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Rincian Skor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(scores).map(([style, score]: [string, any]) => {
                const styleInfo = getStyleInfo(style);
                const percentage = total > 0 ? (score / total) * 100 : 0;
                
                return (
                  <div key={style} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-1 rounded ${styleInfo.color} text-white`}>
                          {styleInfo.icon}
                        </div>
                        <span className="font-medium">{styleInfo.name}</span>
                      </div>
                      <span className="font-semibold">{score} ({percentage.toFixed(1)}%)</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Rekomendasi Belajar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`p-4 rounded-lg ${dominantInfo.bgColor} mb-4`}>
              <h4 className="font-semibold mb-2">Berdasarkan gaya belajar {dominantInfo.name}:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {dominantStyle === 'visual' && (
                  <>
                    <li>Gunakan diagram, grafik, dan mind map</li>
                    <li>Buat catatan dengan warna-warna berbeda</li>
                    <li>Tonton video pembelajaran dan presentasi</li>
                    <li>Gunakan flashcard bergambar</li>
                  </>
                )}
                {dominantStyle === 'auditori' && (
                  <>
                    <li>Ikuti diskusi kelompok dan seminar</li>
                    <li>Rekam dan dengarkan kembali materi</li>
                    <li>Belajar dengan membaca keras</li>
                    <li>Gunakan musik atau ritme untuk mengingat</li>
                  </>
                )}
                {dominantStyle === 'kinestetik' && (
                  <>
                    <li>Praktik langsung dan eksperimen</li>
                    <li>Gunakan gerakan saat belajar</li>
                    <li>Buat model atau prototype</li>
                    <li>Ambil break regular untuk bergerak</li>
                  </>
                )}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderSensoryProfileResults = (results: any) => {
    if (!results || !results.sectionScores) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Hasil Asesmen Profil Sensoris
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-neutral-600 dark:text-muted-foreground mb-4">
              Hasil asesmen profil sensoris Anda telah disimpan dan sedang diproses.
            </p>
            <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Interpretasi hasil sensory profile memerlukan analisis mendalam oleh profesional terlatih.
                Silakan konsultasikan hasil ini dengan psikolog atau terapis okupasi.
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    const { totalScore, sectionScores, interpretation, participantInfo } = results;

    // Section names mapping
    const sectionNames: Record<string, string> = {
      'A': 'Pemrosesan Pendengaran',
      'B': 'Pemrosesan Visual', 
      'C': 'Pemrosesan Vestibular',
      'D': 'Pemrosesan Sentuhan',
      'E': 'Pemrosesan Multisensory',
      'F': 'Pemrosesan Oral Sensory',
      'G': 'Pemrosesan Perencanaan Gerakan',
      'H': 'Pemrosesan Energi Tubuh',
      'I': 'Modulasi Sensory Processing dengan Tonus Tubuh',
      'J': 'Modulasi Gerakan yang Mempengaruhi Tingkat Aktivitas',
      'K': 'Modulasi Input Sensoris yang Mempengaruhi Respon Emosional',
      'L': 'Modulasi Input Visual yang Mempengaruhi Respon Emosional',
      'M': 'Modulasi Input Pendengaran yang Mempengaruhi Respon Emosional',
      'N': 'Item yang Menunjukkan Ambang Batas untuk Respons'
    };

    const getScoreCategory = (score: number) => {
      if (score <= 142) return { label: "Sensitivitas Rendah", color: "bg-blue-500", bgColor: "bg-blue-50 dark:bg-blue-950/20" };
      if (score <= 169) return { label: "Sensitivitas Sedang Rendah", color: "bg-green-500", bgColor: "bg-green-50 dark:bg-green-950/20" };
      if (score <= 183) return { label: "Sensitivitas Normal", color: "bg-gray-500", bgColor: "bg-gray-50 dark:bg-gray-950/20" };
      if (score <= 215) return { label: "Sensitivitas Sedang Tinggi", color: "bg-orange-500", bgColor: "bg-orange-50 dark:bg-orange-950/20" };
      return { label: "Sensitivitas Tinggi", color: "bg-red-500", bgColor: "bg-red-50 dark:bg-red-950/20" };
    };

    const scoreCategory = getScoreCategory(totalScore);

    return (
      <div className="space-y-6">
        {/* Participant Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Informasi Peserta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold">Nama Anak:</h4>
                <p>{participantInfo?.childName || 'Tidak tersedia'}</p>
              </div>
              <div>
                <h4 className="font-semibold">Jenis Kelamin:</h4>
                <p>{participantInfo?.childGender === 'L' ? 'Laki-laki' : participantInfo?.childGender === 'P' ? 'Perempuan' : 'Tidak tersedia'}</p>
              </div>
              <div>
                <h4 className="font-semibold">Tanggal Lahir:</h4>
                <p>{participantInfo?.childBirthDate || 'Tidak tersedia'}</p>
              </div>
              <div>
                <h4 className="font-semibold">Pengisi Asesmen:</h4>
                <p>{participantInfo?.parentName || 'Tidak tersedia'} ({participantInfo?.relationship || 'Tidak tersedia'})</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overall Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Hasil Keseluruhan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`p-6 rounded-lg ${scoreCategory.bgColor} mb-4`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Skor Total: {totalScore}</h3>
                <Badge className={`${scoreCategory.color} text-white`}>
                  {scoreCategory.label}
                </Badge>
              </div>
              <p className="text-neutral-700 dark:text-neutral-300">
                {interpretation}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Rincian Per Bagian</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(sectionScores).map(([sectionId, score]: [string, any]) => (
                <div key={sectionId} className="flex justify-between items-center p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                  <div>
                    <h4 className="font-medium">{sectionId}. {sectionNames[sectionId] || `Bagian ${sectionId}`}</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-semibold">{score}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Professional Recommendation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Rekomendasi Profesional
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                <strong>Penting:</strong> Hasil asesmen ini adalah alat skrining awal dan tidak menggantikan evaluasi profesional.
              </p>
              <ul className="list-disc list-inside text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>Konsultasikan hasil dengan terapis okupasi atau psikolog anak</li>
                <li>Gunakan hasil ini sebagai informasi untuk perencanaan intervensi</li>
                <li>Observasi langsung tetap diperlukan untuk diagnosis yang akurat</li>
                <li>Asesmen ulang mungkin diperlukan seiring perkembangan anak</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <p>Memuat hasil asesmen...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!userAssessment) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <p className="text-red-500">Hasil asesmen tidak ditemukan.</p>
            <Button onClick={() => setLocation("/dashboard")} className="mt-4">
              Kembali ke Dashboard
            </Button>
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
          <Button variant="ghost" onClick={() => setLocation("/dashboard")} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-foreground">
            Hasil {userAssessment.assessment.name}
          </h1>
          <p className="text-neutral-500 dark:text-muted-foreground mt-2">
            Diselesaikan pada {new Date(userAssessment.completedAt!).toLocaleDateString('id-ID')}
          </p>
        </div>

        {userAssessment.assessment.type === 'learning' 
          ? renderLearningStyleResults(userAssessment.results)
          : renderSensoryProfileResults(userAssessment.results)
        }

        <div className="mt-8 flex gap-4">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => downloadPdfMutation.mutate()}
            disabled={downloadPdfMutation.isPending}
          >
            <Download className="w-4 h-4 mr-2" />
            {downloadPdfMutation.isPending ? 'Mengunduh...' : 'Unduh Laporan PDF'}
          </Button>
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => shareResultsMutation.mutate()}
            disabled={shareResultsMutation.isPending}
          >
            <Share2 className="w-4 h-4 mr-2" />
            {shareResultsMutation.isPending ? 'Membagikan...' : 'Bagikan Hasil'}
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
}