import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Eye, Ear, Hand, Brain, BarChart3, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import type { UserAssessmentWithDetails } from "@shared/schema";

export default function AssessmentResults() {
  const { isAuthenticated } = useAuth();
  const [, params] = useRoute("/results/:assessmentId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const assessmentId = params?.assessmentId ? parseInt(params.assessmentId) : null;

  const { data: userAssessment, isLoading } = useQuery<UserAssessmentWithDetails>({
    queryKey: [`/api/user-assessments/${assessmentId}`],
    enabled: !!assessmentId && isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      toast({
        title: "Tidak Diizinkan",
        description: "Anda perlu masuk untuk melihat hasil asesmen.",
        variant: "destructive",
      });
      window.location.href = "/api/login";
    }
  }, [isAuthenticated, toast]);

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
            textColor: 'text-blue-700 dark:text-blue-300',
            description: 'Berfokus pada pengelihatan. Lebih nyaman belajar dengan penggunaan warna-warna, garis, maupun bentuk.',
            characteristics: [
              'Mudah mengingat informasi visual seperti diagram dan grafik',
              'Lebih suka membaca daripada mendengarkan penjelasan',
              'Menggunakan warna dan highlight saat belajar',
              'Dapat memvisualisasikan konsep dalam pikiran'
            ],
            tips: [
              'Gunakan mind map dan diagram saat belajar',
              'Highlight teks penting dengan warna berbeda',
              'Buat catatan visual dengan gambar dan simbol',
              'Pilih tempat belajar yang rapi dan terorganisir'
            ]
          };
        case 'auditori':
          return {
            icon: <Ear className="w-6 h-6" />,
            name: 'Auditori',
            color: 'bg-green-500',
            bgColor: 'bg-green-50 dark:bg-green-950/20',
            textColor: 'text-green-700 dark:text-green-300',
            description: 'Berfokus pada pendengaran saat menerima informasi dan pengetahuan. Peka dan hafal dari setiap ucapan yang pernah didengar.',
            characteristics: [
              'Belajar lebih baik melalui penjelasan verbal',
              'Mudah mengingat informasi yang didengar',
              'Senang berdiskusi dan menjelaskan kepada orang lain',
              'Dapat berkonsentrasi sambil mendengarkan musik'
            ],
            tips: [
              'Rekam materi pembelajaran dan dengarkan berulang',
              'Bergabung dengan kelompok diskusi',
              'Baca materi dengan bersuara',
              'Gunakan aplikasi pembelajaran audio'
            ]
          };
        case 'kinestetik':
          return {
            icon: <Hand className="w-6 h-6" />,
            name: 'Kinestetik',
            color: 'bg-orange-500',
            bgColor: 'bg-orange-50 dark:bg-orange-950/20',
            textColor: 'text-orange-700 dark:text-orange-300',
            description: 'Menyukai belajar yang melibatkan gerakan. Mudah mempelajari sesuatu dengan cara mempraktikkannya.',
            characteristics: [
              'Belajar melalui praktik dan aktivitas fisik',
              'Mudah gelisah jika duduk terlalu lama',
              'Menggunakan gerakan tubuh saat menjelaskan',
              'Lebih suka eksperimen daripada teori'
            ],
            tips: [
              'Belajar sambil berjalan atau bergerak',
              'Gunakan objek fisik untuk memahami konsep',
              'Praktikkan langsung apa yang dipelajari',
              'Ambil istirahat reguler saat belajar'
            ]
          };
        default:
          return null;
      }
    };

    const dominantInfo = getStyleInfo(dominantStyle);
    if (!dominantInfo) return null;

    return (
      <div className="space-y-6">
        {/* Dominant Style Header */}
        <Card className={dominantInfo.bgColor}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className={`p-3 rounded-full ${dominantInfo.color} text-white`}>
                {dominantInfo.icon}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-foreground">
                  Gaya Belajar Dominan: {dominantInfo.name}
                </h2>
                <p className={`text-sm ${dominantInfo.textColor} mt-1`}>
                  Skor: {scores[dominantStyle]}/{total} ({Math.round((scores[dominantStyle] / total) * 100)}%)
                </p>
              </div>
            </div>
            <p className="text-neutral-600 dark:text-muted-foreground">
              {dominantInfo.description}
            </p>
          </CardContent>
        </Card>

        {/* Score Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Rincian Skor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(scores).map(([style, score]: [string, any]) => {
              const styleInfo = getStyleInfo(style);
              if (!styleInfo) return null;
              
              const percentage = (score / total) * 100;
              return (
                <div key={style} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded ${styleInfo.color} text-white`}>
                        {styleInfo.icon}
                      </div>
                      <span className="font-medium">{styleInfo.name}</span>
                    </div>
                    <span className="text-sm text-neutral-500 dark:text-muted-foreground">
                      {score}/{total} ({Math.round(percentage)}%)
                    </span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Characteristics */}
        <Card>
          <CardHeader>
            <CardTitle>Karakteristik Gaya Belajar {dominantInfo.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {dominantInfo.characteristics.map((char, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-primary font-bold mt-1">•</span>
                  <span className="text-neutral-600 dark:text-muted-foreground">{char}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Learning Tips */}
        <Card>
          <CardHeader>
            <CardTitle>Tips Belajar untuk Gaya {dominantInfo.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {dominantInfo.tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-green-500 font-bold mt-1">✓</span>
                  <span className="text-neutral-600 dark:text-muted-foreground">{tip}</span>
                </li>
              ))}
            </ul>
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

    const { sectionScores, totalScore, interpretation } = results;
    
    const getSectionInfo = (sectionId: string) => {
      const sectionMap: Record<string, { name: string; description: string }> = {
        'A': { name: 'Pemrosesan Pendengaran', description: 'Respons terhadap stimulus auditori' },
        'B': { name: 'Pemrosesan Visual', description: 'Respons terhadap stimulus visual' },
        'C': { name: 'Aktivitas Level Tinggi', description: 'Tingkat aktivitas dan energi' },
        'D': { name: 'Pemrosesan Vestibular', description: 'Sistem keseimbangan dan gerakan' },
        'E': { name: 'Pemrosesan Sentuhan', description: 'Respons terhadap stimulus taktil' },
        'F': { name: 'Pemrosesan Multisensori', description: 'Integrasi berbagai input sensoris' },
        'G': { name: 'Modulasi Sensoris', description: 'Regulasi respons sensoris' },
        'H': { name: 'Perilaku dan Emosi', description: 'Respons perilaku terhadap stimulus' },
        'I': { name: 'Respons Emosional', description: 'Regulasi emosi terkait sensoris' },
        'J': { name: 'Respons Sosial', description: 'Interaksi sosial dan sensoris' },
        'K': { name: 'Perhatian/Atensi', description: 'Fokus dan konsentrasi' },
        'L': { name: 'Sedasi/Arousal', description: 'Tingkat kewaspadaan' },
        'M': { name: 'Mencari Sensoris', description: 'Perilaku mencari input sensoris' },
        'N': { name: 'Menghindari Sensoris', description: 'Perilaku menghindari input sensoris' }
      };
      return sectionMap[sectionId] || { name: `Bagian ${sectionId}`, description: 'Tidak ada deskripsi' };
    };

    const getThresholdCategory = (score: number, threshold: { low: number; high: number }) => {
      if (score <= threshold.low) return { category: 'Rendah', color: 'bg-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-950/20' };
      if (score >= threshold.high) return { category: 'Tinggi', color: 'bg-red-500', bgColor: 'bg-red-50 dark:bg-red-950/20' };
      return { category: 'Tipikal', color: 'bg-green-500', bgColor: 'bg-green-50 dark:bg-green-950/20' };
    };

    return (
      <div className="space-y-6">
        {/* Overall Score */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Ringkasan Hasil Profil Sensoris
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">Skor Total</h3>
                <div className="text-3xl font-bold text-primary mb-2">{totalScore}</div>
                <p className="text-sm text-neutral-500 dark:text-muted-foreground">
                  dari {Object.keys(sectionScores).length} bagian asesmen
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Interpretasi</h3>
                <p className="text-neutral-600 dark:text-muted-foreground">
                  {interpretation || 'Profil sensoris menunjukkan pola unik dalam pemrosesan informasi sensoris.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section Scores */}
        <Card>
          <CardHeader>
            <CardTitle>Skor per Bagian</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(sectionScores).map(([sectionId, sectionData]: [string, any]) => {
                const sectionInfo = getSectionInfo(sectionId);
                const { score, threshold } = sectionData;
                const category = getThresholdCategory(score, threshold);
                
                return (
                  <div key={sectionId} className={`p-4 rounded-lg ${category.bgColor}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-semibold">{sectionInfo.name}</h4>
                        <p className="text-sm text-neutral-500 dark:text-muted-foreground">
                          {sectionInfo.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{score}</div>
                        <Badge variant="secondary" className={`${category.color} text-white`}>
                          {category.category}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-muted-foreground">
                      <span>Ambang Rendah: ≤{threshold.low}</span>
                      <span>•</span>
                      <span>Tipikal: {threshold.low + 1}-{threshold.high - 1}</span>
                      <span>•</span>
                      <span>Ambang Tinggi: ≥{threshold.high}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle>Rekomendasi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                  Konsultasi Profesional
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Hasil ini sebaiknya diinterpretasikan oleh terapis okupasi atau profesional kesehatan 
                  mental yang berpengalaman dalam asesmen sensoris.
                </p>
              </div>
              
              <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg">
                <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                  Strategi Dukungan
                </h4>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Berdasarkan profil sensoris ini, dapat dikembangkan strategi khusus untuk mendukung 
                  fungsi sehari-hari dan meningkatkan kualitas hidup.
                </p>
              </div>
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
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!userAssessment || userAssessment.status !== 'completed' || !userAssessment.results) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card>
            <CardContent className="p-8 text-center">
              <h2 className="text-xl font-semibold mb-4">Hasil Tidak Tersedia</h2>
              <p className="text-neutral-500 dark:text-muted-foreground mb-6">
                Asesmen belum selesai atau hasil tidak tersedia.
              </p>
              <Button onClick={() => setLocation("/dashboard")}>
                Kembali ke Dashboard
              </Button>
            </CardContent>
          </Card>
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
          
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-foreground">
                Hasil Asesmen
              </h1>
              <p className="text-neutral-500 dark:text-muted-foreground mt-2">
                {userAssessment.assessment.name}
              </p>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              Selesai
            </Badge>
          </div>

          <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-muted-foreground">
            <span>
              Diselesaikan: {userAssessment.completedAt ? new Date(userAssessment.completedAt).toLocaleDateString('id-ID', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }) : 'Tidak diketahui'}
            </span>
          </div>
        </div>

        {userAssessment.assessment.type === 'learning' 
          ? renderLearningStyleResults(userAssessment.results)
          : renderSensoryProfileResults(userAssessment.results)
        }

        <div className="mt-8 flex gap-4">
          <Button variant="outline" className="flex-1">
            <Download className="w-4 h-4 mr-2" />
            Unduh Laporan PDF
          </Button>
          <Button variant="outline" className="flex-1">
            <FileText className="w-4 h-4 mr-2" />
            Bagikan Hasil
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
}