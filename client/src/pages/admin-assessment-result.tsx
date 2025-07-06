import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Eye, Ear, Hand, Brain, BarChart3, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { UserAssessmentWithDetails } from "@shared/schema";

export default function AdminAssessmentResult() {
  const [, params] = useRoute("/admin/assessment-result/:userAssessmentId");
  const { toast } = useToast();

  const userAssessmentId = params?.userAssessmentId ? parseInt(params.userAssessmentId) : null;

  const { data: userAssessment, isLoading } = useQuery<UserAssessmentWithDetails>({
    queryKey: [`/api/admin/assessments/${userAssessmentId}/result`],
    enabled: !!userAssessmentId,
  });

  const downloadPDF = async () => {
    try {
      if (!userAssessment) throw new Error("No assessment found");
      
      const token = localStorage.getItem('adminToken');
      if (!token) {
        throw new Error('No admin token found');
      }
      
      const response = await fetch(`/api/admin/assessments/${userAssessment.id}/pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
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
      a.download = `Admin_Hasil_${userAssessment.assessment.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal mengunduh PDF. Silakan coba lagi.",
        variant: "destructive",
      });
    }
  };

  const renderLearningStyleResults = (results: any) => {
    if (!results.styleScores) return null;

    const styles = [
      { key: 'visual', name: 'Visual', icon: Eye, color: 'bg-blue-500' },
      { key: 'auditory', name: 'Auditori', icon: Ear, color: 'bg-green-500' },
      { key: 'kinesthetic', name: 'Kinestetik', icon: Hand, color: 'bg-orange-500' },
    ];

    const totalScore = Object.values(results.styleScores).reduce((sum: number, score: any) => sum + score, 0);

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Gaya Belajar Dominan: {results.primaryStyle?.charAt(0).toUpperCase() + results.primaryStyle?.slice(1)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {styles.map((style) => {
                const score = results.styleScores[style.key] || 0;
                const percentage = totalScore > 0 ? (score / totalScore) * 100 : 0;
                
                return (
                  <div key={style.key} className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2 w-32">
                      <style.icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{style.name}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600">{score} poin</span>
                        <span className="text-sm text-gray-600">{percentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Interpretasi Hasil</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 leading-relaxed">
              Berdasarkan hasil asesmen, gaya belajar dominan adalah <strong>{results.primaryStyle}</strong>. 
              Ini menunjukkan preferensi cara pemrosesan informasi yang paling efektif untuk individu ini.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderSensoryProfileResults = (results: any) => {
    if (!results.sectionScores) return null;

    const sections = [
      { key: 'A', name: 'Pemrosesan Auditori', icon: Ear },
      { key: 'B', name: 'Pemrosesan Visual', icon: Eye },
      { key: 'C', name: 'Pemrosesan Vestibular', icon: Brain },
      { key: 'D', name: 'Pemrosesan Taktil', icon: Hand },
      { key: 'E', name: 'Pemrosesan Multisensoris', icon: BarChart3 },
      { key: 'F', name: 'Modulasi Motorik dan Postural', icon: Brain },
      { key: 'G', name: 'Modulasi Terkait Posisi Tubuh', icon: Brain },
      { key: 'H', name: 'Modulasi Gerakan', icon: Brain },
      { key: 'I', name: 'Modulasi Input Sensoris', icon: Brain },
      { key: 'J', name: 'Modulasi Emosional', icon: Brain },
      { key: 'K', name: 'Modulasi Aktivitas', icon: Brain },
      { key: 'L', name: 'Modulasi Perilaku', icon: Brain },
      { key: 'M', name: 'Ambang Batas', icon: Brain },
    ];

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Profil Sensoris - Skor per Bagian
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sections.map((section) => {
                const sectionData = results.sectionScores[section.key];
                if (!sectionData) return null;

                const score = typeof sectionData === 'object' ? sectionData.average || 0 : sectionData;
                const total = typeof sectionData === 'object' ? sectionData.total || 0 : 0;
                const count = typeof sectionData === 'object' ? sectionData.count || 0 : 0;

                return (
                  <div key={section.key} className="p-4 border rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <section.icon className="w-4 h-4" />
                      <span className="font-medium text-sm">Bagian {section.key}</span>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{section.name}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Rata-rata:</span>
                        <span className="font-medium">{typeof score === 'number' ? score.toFixed(2) : score}</span>
                      </div>
                      {typeof sectionData === 'object' && (
                        <>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Total:</span>
                            <span>{total}</span>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Jumlah:</span>
                            <span>{count}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Interpretasi Hasil</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 leading-relaxed">
              {results.interpretation || "Profil sensoris menunjukkan pola pemrosesan sensoris individu. Skor yang lebih tinggi menunjukkan sensitivitas yang lebih besar pada area tersebut. Hasil ini dapat membantu dalam memahami kebutuhan sensoris dan merancang intervensi yang sesuai."}
            </p>
            
            {results.patterns && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Pola Sensoris:</h4>
                <div className="space-y-2">
                  {Object.entries(results.patterns).map(([pattern, description]: [string, any]) => (
                    <div key={pattern} className="flex items-start space-x-2">
                      <Badge variant="outline" className="mt-0.5">
                        {pattern}
                      </Badge>
                      <span className="text-sm text-gray-600">{description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Memuat hasil asesmen...</p>
        </div>
      </div>
    );
  }

  if (!userAssessment) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <p className="text-red-500">Hasil asesmen tidak ditemukan.</p>
            <Link href="/admin/assessments">
              <Button className="mt-4">
                Kembali ke Daftar Asesmen
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <Link href="/admin/assessments">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Kembali ke Daftar Asesmen
            </Button>
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Hasil {userAssessment.assessment.name}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                Pengguna: {userAssessment.user?.firstName} {userAssessment.user?.lastName}
                {userAssessment.user?.email && (
                  <span className="ml-2">({userAssessment.user.email})</span>
                )}
              </p>
              <p className="text-gray-500 dark:text-gray-400">
                Diselesaikan pada {new Date(userAssessment.completedAt!).toLocaleDateString('id-ID')}
              </p>
            </div>
            <Button onClick={downloadPDF} className="bg-green-600 hover:bg-green-700">
              <Download className="w-4 h-4 mr-2" />
              Unduh PDF
            </Button>
          </div>
        </div>

        {userAssessment.assessment.type === 'learning' 
          ? renderLearningStyleResults(userAssessment.results)
          : renderSensoryProfileResults(userAssessment.results)
        }
      </div>
    </div>
  );
}