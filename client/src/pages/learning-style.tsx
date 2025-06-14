import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Save, BookOpen, Eye, Ear, Hand } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import type { UserAssessmentWithDetails } from "@shared/schema";

interface Question {
  id: number;
  text: string;
  options: {
    value: 'visual' | 'auditori' | 'kinestetik';
    label: string;
  }[];
}

const questions: Question[] = [
  {
    id: 1,
    text: "Ketika saya diminta untuk belajar sesuatu yang baru, maka saya mudah memahaminya ketika:",
    options: [
      { value: 'visual', label: "Melihat cara orang lain melakukannya" },
      { value: 'auditori', label: "Mendengarkan cara orang lain melakukannya" },
      { value: 'kinestetik', label: "Mencoba sendiri" }
    ]
  },
  {
    id: 2,
    text: "Saat saya membaca sesuatu, saya sering menyadari jika saya:",
    options: [
      { value: 'visual', label: "Membayangkan apa yang saya baca dalam pikiran" },
      { value: 'auditori', label: "Membacanya dengan bersuara atau mendengarkan suara dalam pikiran" },
      { value: 'kinestetik', label: "Duduk dengan gelisah dan merasakan isinya" }
    ]
  },
  {
    id: 3,
    text: "Waktu orang lain bertanya tentang arah dari suatu lokasi pada saya, yang saya lakukan adalah:",
    options: [
      { value: 'visual', label: "Melihat lokasi yang dimaksud dalam pikiran saya atau menggambar arahnya" },
      { value: 'auditori', label: "Langsung menjelaskan arahnya dengan kalimat yang runtut" },
      { value: 'kinestetik', label: "Menunjuk atau menggunakan anggota tubuh untuk menjelaskan" }
    ]
  },
  {
    id: 4,
    text: "Jika saya tidak yakin pada suatu hal, maka saya akan:",
    options: [
      { value: 'visual', label: "Menuliskannya untuk menentukan apakah hal itu tampak benar" },
      { value: 'auditori', label: "Mengucapkannya untuk menentukan apakah hal itu terdengar benar" },
      { value: 'kinestetik', label: "Menuliskannya untuk menentukan apakah hal itu terasa benar" }
    ]
  },
  {
    id: 5,
    text: "Saat menulis sesuatu, yang saya lakukan adalah:",
    options: [
      { value: 'visual', label: "Memperhatikan kerapian tulisan dan jarak antar kata" },
      { value: 'auditori', label: "Mengucapkan kata-kata sambil menulis" },
      { value: 'kinestetik', label: "Menekan kuat alat tulis yang digunakan untuk merasakan alurnya" }
    ]
  },
  {
    id: 6,
    text: "Jika saya harus menghafalkan beberapa hal, yang saya lakukan ialah:",
    options: [
      { value: 'visual', label: "Menuliskannya" },
      { value: 'auditori', label: "Mengucapkannya berulang kali" },
      { value: 'kinestetik', label: "Bergerak dan menggunakan jari tangan untuk menghafalkan" }
    ]
  },
  {
    id: 7,
    text: "Saya lebih senang dosen yang mengajar dengan cara:",
    options: [
      { value: 'visual', label: "Menggunakan papan atau proyektor saat menjelaskan" },
      { value: 'auditori', label: "Berbicara dengan berbahasa ekspresif" },
      { value: 'kinestetik', label: "Menggunakan banyak aktivitas" }
    ]
  },
  {
    id: 8,
    text: "Ketika hendak berkonsentrasi, saya mengalami kesulitan dengan:",
    options: [
      { value: 'visual', label: "Ruangan yang berantakan" },
      { value: 'auditori', label: "Kebisingan di sekitar ruangan" },
      { value: 'kinestetik', label: "Duduk diam dalam waktu yang lama" }
    ]
  },
  {
    id: 9,
    text: "Saat menyelesaikan masalah, yang saya lakukan adalah:",
    options: [
      { value: 'visual', label: "Menuliskan atau menggambar diagram untuk melihat masalahnya" },
      { value: 'auditori', label: "Berbicara dengan diri sendiri untuk menyelesaikannya" },
      { value: 'kinestetik', label: "Menggerakkan badan dan atau benda untuk membantu berpikir" }
    ]
  },
  {
    id: 10,
    text: "Ketika diberi instruksi tertulis untuk menyusun sesuatu, saya akan:",
    options: [
      { value: 'visual', label: "Membaca instruksi dengan teliti sebelum mulai" },
      { value: 'auditori', label: "Meminta penjelasan verbal atau membaca instruksi keras-keras" },
      { value: 'kinestetik', label: "Langsung mencoba sambil melihat instruksi sekilas" }
    ]
  },
  {
    id: 11,
    text: "Agar tidak bosan saat menunggu, maka saya akan:",
    options: [
      { value: 'visual', label: "Melihat sekeliling, mengamati sesuatu atau membaca" },
      { value: 'auditori', label: "Mengobrol atau mendengarkan orang lain bicara" },
      { value: 'kinestetik', label: "Mondar-mandir, memainkan suatu benda dengan tangan, atau menggerakkan kaki" }
    ]
  },
  {
    id: 12,
    text: "Saat saya diminta menjelaskan sesuatu pada orang lain, yang saya lakukan adalah:",
    options: [
      { value: 'visual', label: "Menjelaskan dengan singkat karena saya tidak suka banyak bicara" },
      { value: 'auditori', label: "Menjelaskan dengan terperinci karena saya senang berbicara" },
      { value: 'kinestetik', label: "Menggunakan bahasa tubuh dan gerakan saat berbicara" }
    ]
  },
  {
    id: 13,
    text: "Jika ada seseorang yang sedang menjelaskan sesuatu pada orang lain, saya akan:",
    options: [
      { value: 'visual', label: "Berusaha membayangkan hal yang dijelaskannya" },
      { value: 'auditori', label: "Senang mendengarkan namun ingin menyela" },
      { value: 'kinestetik', label: "Menjadi bosan jika penjelasannya terlalu lama atau detail" }
    ]
  },
  {
    id: 14,
    text: "Saat berusaha mengingat seseorang, saya akan teringat:",
    options: [
      { value: 'visual', label: "Wajahnya tetapi lupa namanya" },
      { value: 'auditori', label: "Namanya tetapi lupa wajahnya" },
      { value: 'kinestetik', label: "Situasi ketika bertemu orang tersebut dari pada nama atau wajahnya" }
    ]
  }
];

export default function LearningStyle() {
  const { isAuthenticated } = useAuth();
  const [, params] = useRoute("/learning-style/:assessmentId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<number, 'visual' | 'auditori' | 'kinestetik'>>({});
  const [isStarted, setIsStarted] = useState(false);

  const assessmentId = params?.assessmentId ? parseInt(params.assessmentId) : null;

  const { data: userAssessment, isLoading } = useQuery<UserAssessmentWithDetails>({
    queryKey: [`/api/user-assessments/${assessmentId}`],
    enabled: !!assessmentId && isAuthenticated,
  });

  // Restore progress when assessment loads
  useEffect(() => {
    if (userAssessment?.results && userAssessment.status === 'in_progress') {
      const savedData = userAssessment.results;
      if (savedData.responses) setResponses(savedData.responses);
      if (savedData.currentStep !== undefined) setCurrentStep(savedData.currentStep);
      setIsStarted(true);
    }
  }, [userAssessment]);

  const startAssessmentMutation = useMutation({
    mutationFn: async () => {
      if (!userAssessment) throw new Error("No assessment found");
      const response = await apiRequest("POST", `/api/user-assessments/${userAssessment.id}/start`);
      return response.json();
    },
    onSuccess: () => {
      setIsStarted(true);
      queryClient.invalidateQueries({ queryKey: [`/api/user-assessments/${assessmentId}`] });
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
        description: "Gagal memulai asesmen. Silakan coba lagi.",
        variant: "destructive",
      });
    },
  });

  const saveProgressMutation = useMutation({
    mutationFn: async (progressData: any) => {
      if (!userAssessment) throw new Error("No assessment found");
      return apiRequest("POST", `/api/user-assessments/${userAssessment.id}/save-progress`, progressData);
    },
  });

  const completeAssessmentMutation = useMutation({
    mutationFn: async (results: any) => {
      if (!userAssessment) throw new Error("No assessment found");
      const response = await apiRequest("POST", `/api/user-assessments/${userAssessment.id}/complete`, { results });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/user-assessments/${assessmentId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-assessments"] });
      toast({
        title: "Asesmen Selesai!",
        description: "Hasil Anda telah disimpan dan dapat dilihat di dashboard.",
      });
      setLocation("/dashboard");
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
        description: "Gagal menyelesaikan asesmen. Silakan coba lagi.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!isAuthenticated) {
      toast({
        title: "Tidak Diizinkan",
        description: "Anda perlu masuk untuk mengakses asesmen ini.",
        variant: "destructive",
      });
      window.location.href = "/api/login";
    }
  }, [isAuthenticated, toast]);

  const calculateResults = () => {
    const scores = { visual: 0, auditori: 0, kinestetik: 0 };
    
    Object.values(responses).forEach(response => {
      scores[response]++;
    });

    return {
      scores,
      dominantStyle: Object.entries(scores).reduce((a, b) => scores[a[0] as keyof typeof scores] > scores[b[0] as keyof typeof scores] ? a : b)[0],
      responses
    };
  };

  const handleResponse = (questionId: number, value: 'visual' | 'auditori' | 'kinestetik') => {
    const newResponses = {
      ...responses,
      [questionId]: value
    };
    setResponses(newResponses);
    
    // Auto-save progress
    saveProgressMutation.mutate({
      responses: newResponses,
      currentStep,
    });
  };

  const handleNext = () => {
    // Validate current question is answered
    if (!currentResponse) {
      toast({
        title: "Pertanyaan Belum Dijawab",
        description: "Silakan pilih salah satu jawaban sebelum melanjutkan.",
        variant: "destructive",
      });
      return;
    }

    if (currentStep < questions.length - 1) {
      setCurrentStep(prev => prev + 1);
      // Auto-scroll to top after moving to next question
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const results = calculateResults();
      completeAssessmentMutation.mutate(results);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      // Auto-scroll to top after moving to previous question
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const startAssessment = () => {
    startAssessmentMutation.mutate();
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

  if (!userAssessment) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card>
            <CardContent className="p-8 text-center">
              <h2 className="text-xl font-semibold mb-4">Asesmen Tidak Ditemukan</h2>
              <p className="text-neutral-500 dark:text-muted-foreground mb-6">
                Asesmen ini tidak tersedia atau Anda tidak memiliki akses.
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

  if (!isStarted && userAssessment.status === 'available') {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-background">
        <Header />
        
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-8">
            <Button variant="ghost" onClick={() => setLocation("/dashboard")} className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Kembali ke Dashboard
            </Button>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-foreground mb-4">
              Inventori Gaya Belajar
            </h1>
            <p className="text-lg text-neutral-600 dark:text-muted-foreground mb-6">
              Asesmen untuk mengidentifikasi preferensi gaya belajar Anda
            </p>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Instruksi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-neutral-600 dark:text-muted-foreground">
                Pilihlah salah satu pernyataan di bawah ini yang paling menggambarkan diri Anda, 
                dengan memberikan tanda pilihan. Tidak ada jawaban yang benar dan salah, 
                sehingga kejujuran dalam menjawab sangat dibutuhkan.
              </p>
              
              <div className="grid md:grid-cols-3 gap-4 mt-6">
                <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <Eye className="w-6 h-6 text-blue-600" />
                  <div>
                    <h3 className="font-semibold text-blue-800 dark:text-blue-200">Visual</h3>
                    <p className="text-sm text-blue-600 dark:text-blue-300">Belajar melalui pengelihatan</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <Ear className="w-6 h-6 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-green-800 dark:text-green-200">Auditori</h3>
                    <p className="text-sm text-green-600 dark:text-green-300">Belajar melalui pendengaran</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                  <Hand className="w-6 h-6 text-orange-600" />
                  <div>
                    <h3 className="font-semibold text-orange-800 dark:text-orange-200">Kinestetik</h3>
                    <p className="text-sm text-orange-600 dark:text-orange-300">Belajar melalui gerakan</p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Informasi:</strong> Asesmen ini terdiri dari 14 pertanyaan yang akan membantu 
                  mengidentifikasi gaya belajar dominan Anda.
                </p>
              </div>

              <Button 
                size="lg" 
                onClick={startAssessment}
                className="w-full mt-6"
                disabled={startAssessmentMutation.isPending}
              >
                {startAssessmentMutation.isPending ? "Memulai..." : "Mulai Asesmen"}
              </Button>
            </CardContent>
          </Card>
        </main>

        <Footer />
      </div>
    );
  }

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;
  const currentResponse = responses[currentQuestion?.id];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-foreground">
              Inventori Gaya Belajar
            </h1>
            <span className="text-sm text-neutral-500 dark:text-muted-foreground">
              Pertanyaan {currentStep + 1} dari {questions.length}
            </span>
          </div>
          <Progress value={progress} className="mb-4" />
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">
              {currentQuestion?.text}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={currentResponse || ""}
              onValueChange={(value) => handleResponse(currentQuestion.id, value as 'visual' | 'auditori' | 'kinestetik')}
              className="space-y-4"
            >
              {currentQuestion?.options.map((option, index) => (
                <div key={option.value} className="flex items-start space-x-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <RadioGroupItem value={option.value} id={`option-${index}`} className="mt-1" />
                  <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                    <span className="font-medium text-sm text-neutral-600 dark:text-neutral-400 block mb-1">
                      {option.value === 'visual' ? 'A.' : option.value === 'auditori' ? 'B.' : 'C.'}
                    </span>
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Sebelumnya
          </Button>
          
          <Button
            onClick={handleNext}
            disabled={completeAssessmentMutation.isPending}
          >
            {currentStep === questions.length - 1 ? (
              completeAssessmentMutation.isPending ? (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Selesai
                </>
              )
            ) : (
              <>
                Selanjutnya
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
}