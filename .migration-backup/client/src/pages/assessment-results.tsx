import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Eye, Ear, Hand, Brain, BarChart3, FileText, Lightbulb, Calculator, Play, Music, Users, User } from "lucide-react";
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
      
      // Get JWT token from localStorage
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch(`/api/user-assessments/${userAssessment.id}/pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/pdf',
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('UNAUTHORIZED');
        }
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
      if (error.message === 'UNAUTHORIZED' || isUnauthorizedError(error)) {
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



  const renderLearningStyleResults = (results: any) => {
    // Handle both old and new data structures for backward compatibility
    const styleScores = results.styleScores || results.scores || {};
    const primaryStyle = results.primaryStyle || results.dominantStyle || 'visual';
    const total = Object.values(styleScores).reduce((sum: number, score: any) => sum + score, 0);

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

    const dominantInfo = getStyleInfo(primaryStyle);

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
              {Object.entries(styleScores).map(([style, score]: [string, any]) => {
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
                {primaryStyle === 'visual' && (
                  <>
                    <li>Gunakan diagram, grafik, dan mind map</li>
                    <li>Buat catatan dengan warna-warna berbeda</li>
                    <li>Tonton video pembelajaran dan presentasi</li>
                    <li>Gunakan flashcard bergambar</li>
                  </>
                )}
                {primaryStyle === 'auditori' && (
                  <>
                    <li>Ikuti diskusi kelompok dan seminar</li>
                    <li>Rekam dan dengarkan kembali materi</li>
                    <li>Belajar dengan membaca keras</li>
                    <li>Gunakan musik atau ritme untuk mengingat</li>
                  </>
                )}
                {primaryStyle === 'kinestetik' && (
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

  const renderMultipleIntelligenceResults = (results: any) => {
    if (!results || !results.categoryScores) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Hasil Asesmen Kecerdasan Majemuk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-neutral-600 dark:text-muted-foreground mb-4">
              Hasil asesmen kecerdasan majemuk Anda telah disimpan dan sedang diproses.
            </p>
            <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Interpretasi hasil akan tersedia setelah semua pertanyaan dijawab.
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    const { categoryScores, dominantIntelligences } = results;

    // Intelligence category definitions
    const intelligenceInfo: Record<string, any> = {
      'visual_spasial': { 
        name: "Visual Spasial", 
        icon: <Eye className="w-6 h-6" />, 
        color: "bg-purple-500",
        bgColor: "bg-purple-50 dark:bg-purple-950/20",
        description: "Kemampuan memvisualisasikan dan memanipulasi objek dalam ruang" 
      },
      'linguistik': { 
        name: "Linguistik", 
        icon: <Lightbulb className="w-6 h-6" />, 
        color: "bg-blue-500",
        bgColor: "bg-blue-50 dark:bg-blue-950/20",
        description: "Kemampuan menggunakan bahasa secara efektif" 
      },
      'logis_matematis': { 
        name: "Logis Matematis", 
        icon: <Calculator className="w-6 h-6" />, 
        color: "bg-green-500",
        bgColor: "bg-green-50 dark:bg-green-950/20",
        description: "Kemampuan bernalar logis dan menyelesaikan masalah matematika" 
      },
      'kinestetik': { 
        name: "Kinestetik", 
        icon: <Play className="w-6 h-6" />, 
        color: "bg-orange-500",
        bgColor: "bg-orange-50 dark:bg-orange-950/20",
        description: "Kemampuan menggunakan tubuh untuk mengekspresikan ide dan perasaan" 
      },
      'musik': { 
        name: "Musik", 
        icon: <Music className="w-6 h-6" />, 
        color: "bg-pink-500",
        bgColor: "bg-pink-50 dark:bg-pink-950/20",
        description: "Kemampuan memahami dan mengekspresikan musik" 
      },
      'interpersonal': { 
        name: "Interpersonal", 
        icon: <Users className="w-6 h-6" />, 
        color: "bg-indigo-500",
        bgColor: "bg-indigo-50 dark:bg-indigo-950/20",
        description: "Kemampuan berinteraksi dan memahami orang lain" 
      },
      'intrapersonal': { 
        name: "Intrapersonal", 
        icon: <User className="w-6 h-6" />, 
        color: "bg-teal-500",
        bgColor: "bg-teal-50 dark:bg-teal-950/20",
        description: "Kemampuan memahami diri sendiri" 
      }
    };

    // Get top 3 intelligences - ensure they have category field
    let topIntelligences = dominantIntelligences;
    if (!topIntelligences || !Array.isArray(topIntelligences) || topIntelligences.length === 0) {
      // Fallback to top 3 from categoryScores, sorted by percentage
      topIntelligences = categoryScores
        ? [...categoryScores].sort((a, b) => b.percentage - a.percentage).slice(0, 3)
        : [];
    }

    return (
      <div className="space-y-6">
        {/* Top 3 Dominant Intelligences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Kecerdasan Dominan Anda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topIntelligences.map((intelligence: any, index: number) => {
                const category = intelligence.category || intelligence.name?.toLowerCase().replace(/\s+/g, '_');
                const info = intelligenceInfo[category];
                if (!info) {
                  console.warn('Intelligence category not found:', category, intelligence);
                  return null;
                }
                
                return (
                  <div key={category} className={`p-4 rounded-lg ${info.bgColor}`}>
                    <div className="flex items-center gap-4 mb-2">
                      <div className={`p-3 rounded-full ${info.color} text-white`}>
                        {info.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">{info.name}</h3>
                          <div className="flex items-center gap-2">
                            <Badge className={`${info.color} text-white`}>
                              #{index + 1}
                            </Badge>
                            <span className="font-bold text-lg">{intelligence.percentage}%</span>
                          </div>
                        </div>
                        <p className="text-neutral-600 dark:text-neutral-300 text-sm mt-1">
                          {info.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* All Intelligence Scores */}
        <Card>
          <CardHeader>
            <CardTitle>Profil Kecerdasan Lengkap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categoryScores.map((intelligence: any) => {
                const category = intelligence.category || intelligence.name?.toLowerCase().replace(/\s+/g, '_');
                const info = intelligenceInfo[category];
                if (!info) {
                  console.warn('Intelligence category not found:', category, intelligence);
                  return null;
                }
                
                return (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-1 rounded ${info.color} text-white`}>
                          {info.icon}
                        </div>
                        <span className="font-medium">{info.name}</span>
                      </div>
                      <span className="font-semibold">{intelligence.score}/{intelligence.total} ({intelligence.percentage}%)</span>
                    </div>
                    <Progress value={intelligence.percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recommendations based on top intelligences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Rekomendasi Pengembangan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-neutral-600 dark:text-muted-foreground">
                Berdasarkan profil kecerdasan dominan Anda, berikut adalah rekomendasi untuk mengoptimalkan potensi:
              </p>
              
              {topIntelligences.slice(0, 2).map((intelligence: any, index: number) => {
                const category = intelligence.category || intelligence.name?.toLowerCase().replace(/\s+/g, '_');
                const info = intelligenceInfo[category];
                if (!info) {
                  console.warn('Intelligence category not found:', category, intelligence);
                  return null;
                }

                const recommendations = getIntelligenceRecommendations(category);
                
                return (
                  <div key={category} className={`p-4 rounded-lg ${info.bgColor}`}>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <div className={`p-2 rounded ${info.color} text-white`}>
                        {info.icon}
                      </div>
                      {info.name} ({intelligence.percentage}%)
                    </h4>
                    <ul className="list-disc list-inside text-sm space-y-1 text-neutral-600 dark:text-neutral-300">
                      {recommendations.map((rec: string, idx: number) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Professional Recommendation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Catatan Penting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                <strong>Penting:</strong> Hasil asesmen ini memberikan gambaran umum tentang profil kecerdasan majemuk Anda.
              </p>
              <ul className="list-disc list-inside text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>Setiap orang memiliki kombinasi unik dari berbagai jenis kecerdasan</li>
                <li>Kecerdasan dapat dikembangkan melalui latihan dan pengalaman</li>
                <li>Gunakan hasil ini sebagai panduan untuk mengoptimalkan cara belajar Anda</li>
                <li>Konsultasikan dengan ahli pendidikan untuk strategi pengembangan yang tepat</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Helper function for intelligence-specific recommendations
  const getIntelligenceRecommendations = (category: string): string[] => {
    const recommendations: Record<string, string[]> = {
      'visual_spasial': [
        'Gunakan mind map dan diagram saat belajar',
        'Manfaatkan media visual seperti gambar dan video',
        'Praktikkan aktivitas seni dan desain',
        'Latih kemampuan navigasi dan orientasi ruang'
      ],
      'linguistik': [
        'Perbanyak membaca dan menulis',
        'Latih public speaking dan storytelling',
        'Pelajari bahasa asing',
        'Ikuti aktivitas debat dan diskusi'
      ],
      'logis_matematis': [
        'Latih kemampuan problem solving',
        'Pelajari programming dan logika',
        'Mainkan game strategi dan puzzle',
        'Praktikkan metode ilmiah dalam berpikir'
      ],
      'kinestetik': [
        'Integrasikan gerakan dalam proses belajar',
        'Ikuti aktivitas olahraga dan tari',
        'Praktikkan pembelajaran hands-on',
        'Gunakan role-play dan simulasi'
      ],
      'musik': [
        'Gunakan lagu untuk mengingat informasi',
        'Pelajari alat musik',
        'Ikuti aktivitas bernyanyi atau paduan suara',
        'Manfaatkan ritme dalam pembelajaran'
      ],
      'interpersonal': [
        'Ikuti kegiatan kelompok dan teamwork',
        'Praktikkan empati dan komunikasi',
        'Latih kemampuan leadership',
        'Terlibat dalam aktivitas sosial dan volunteer'
      ],
      'intrapersonal': [
        'Luangkan waktu untuk refleksi diri',
        'Latih journaling dan self-assessment',
        'Praktikkan mindfulness dan meditasi',
        'Tentukan tujuan personal yang jelas'
      ]
    };
    
    return recommendations[category] || [];
  };

  const renderSensoryProfileResults = (results: any) => {
    if (!results || !results.sectionScores) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Hasil Asesmen Profil Sensori
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-neutral-600 dark:text-muted-foreground mb-4">
              Hasil asesmen profil sensori Anda telah disimpan dan sedang diproses.
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
                    {typeof score === 'object' && score !== null ? (
                      <div className="text-sm space-y-1">
                        <div className="text-lg font-semibold">{score.total || score.count || 0}</div>
                        {score.average && (
                          <div className="text-xs text-neutral-600 dark:text-neutral-400">
                            Rata-rata: {(() => {
                              if (typeof score.average === 'number') {
                                return score.average.toFixed(1);
                              }
                              const avgNum = parseFloat(score.average);
                              return isNaN(avgNum) ? score.average : avgNum.toFixed(1);
                            })()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-lg font-semibold">{score}</span>
                    )}
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
          : userAssessment.assessment.type === 'intelligence' 
          ? renderMultipleIntelligenceResults(userAssessment.results)
          : renderSensoryProfileResults(userAssessment.results)
        }

        <div className="mt-8">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => downloadPdfMutation.mutate()}
            disabled={downloadPdfMutation.isPending}
          >
            <Download className="w-4 h-4 mr-2" />
            {downloadPdfMutation.isPending ? 'Mengunduh...' : 'Unduh Laporan PDF'}
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
}