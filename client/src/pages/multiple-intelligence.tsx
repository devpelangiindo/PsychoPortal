import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Brain, Lightbulb, Calculator, Play, Music, Users, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import type { UserAssessmentWithDetails, Assessment } from "@shared/schema";

interface Question {
  id: number;
  text: string;
  category: 'visual_spasial' | 'linguistik' | 'logis_matematis' | 'kinestetik' | 'musik' | 'interpersonal' | 'intrapersonal';
}

const questions: Question[] = [
  // Visual Spasial (10 questions)
  {
    id: 1,
    category: 'visual_spasial',
    text: "Kamu suka seni-seni yang berkaitan dengan visual (lukis, pahat). Kamu dapat memadukan warna dengan baik."
  },
  {
    id: 2,
    category: 'visual_spasial',
    text: "Kamu menghafal dengan menggunakan bantuan visual (dikaitkan dengan gambar)"
  },
  {
    id: 3,
    category: 'visual_spasial',
    text: "Kamu sering mencorat-coret ketika sedang berfikir atau mencatat. Kamu dapat menggambar dengan baik dan mendetail (akurat)"
  },
  {
    id: 4,
    category: 'visual_spasial',
    text: "Kamu tidak mengalami kesulitan dalam membaca peta ataupun navigasi. Kamu dapat menentukan arah dengan baik."
  },
  {
    id: 5,
    category: 'visual_spasial',
    text: "Kamu suka permainan seperti jigsaws, puzzles dan mazes."
  },
  {
    id: 6,
    category: 'visual_spasial',
    text: "Kamu cukup ahli dalam membongkar benda-benda dan menyusunnya kembali. Kamu dapat dengan mudah merakit peralatan ataupun mengikuti diagram dalam merakit peralatan"
  },
  {
    id: 7,
    category: 'visual_spasial',
    text: "Di sekolah kamu menyukai pelajaran seni dan lebih memilih geometri (ilmu ukur ruang) dibanding aljabar."
  },
  {
    id: 8,
    category: 'visual_spasial',
    text: "Kamu sering menjelaskan pemikiranmu dengan menggunakan diagram atau gambar dan dapat mengartikan diagram dengan mudah"
  },
  {
    id: 9,
    category: 'visual_spasial',
    text: "Kamu dapat membayangkan bagaimana bila suatu benda dilihat dari sudut pandang yang berbeda"
  },
  {
    id: 10,
    category: 'visual_spasial',
    text: "Kamu menyukai bacaan yang mempunyai banyak gambar"
  },

  // Linguistik (10 questions)
  {
    id: 11,
    category: 'linguistik',
    text: "Kamu menyukai puisi, sajak & dongeng. Kamu pengeja yang baik."
  },
  {
    id: 12,
    category: 'linguistik',
    text: "Kamu suka membaca (buku, majalah, koran, bahkan label produk)"
  },
  {
    id: 13,
    category: 'linguistik',
    text: "Kamu dapat dengan mudah mengekspresikan diri baik secara lisan maupun tulisan. Kamu dapat bernalar (berfikir logis) dengan baik."
  },
  {
    id: 14,
    category: 'linguistik',
    text: "Kamu seorang yang teratur dan sistematis"
  },
  {
    id: 15,
    category: 'linguistik',
    text: "Kamu suka mengisi teka-teki silang, bermain scrabble atau mencoba menebak teka-teki permainan kata. Kamu menyukai permainan kata, membuat plesetan, kata-kata yang sulit diucapkan & pantun jenaka."
  },
  {
    id: 16,
    category: 'linguistik',
    text: "Kamu mempunyai perbendaharaan kata yang sangat banyak sehingga kadang orang harus memintamu untuk menjelaskan kata yang kamu gunakan."
  },
  {
    id: 17,
    category: 'linguistik',
    text: "Di sekolah kamu menyukai mata pelajaran bahasa, sejarah dan ilmu-ilmu sosial."
  },
  {
    id: 18,
    category: 'linguistik',
    text: "Kamu dapat mempertahankan pendapat dalam debat atau argumentasi verbal dan dapat memberikan penjelasan serta petunjuk yang jelas."
  },
  {
    id: 19,
    category: 'linguistik',
    text: "Kamu suka berfikir sambil berbicara, membahas masalah, menjelaskan jalan keluar (solusi) & pertanyaan."
  },
  {
    id: 20,
    category: 'linguistik',
    text: "Kamu dapat dengan mudah menyerap informasi ketika mendengarkan radio/kaset/orang berbicara."
  },

  // Logis Matematis (10 questions)
  {
    id: 21,
    category: 'logis_matematis',
    text: "Kamu menyukai pekerjaan yang melibatkan angka dan dapat melakukan perhitungan dengan cara membayangkannya."
  },
  {
    id: 22,
    category: 'logis_matematis',
    text: "Kamu tertarik pada perkembangan-perkembangan ilmiah baru dan suka bereksperimen dengan berbagai benda untuk mengetahui cara bekerjanya"
  },
  {
    id: 23,
    category: 'logis_matematis',
    text: "Kamu dapat dengan mudah menyeimbangkan pemasukan dan pengeluaran anggaran atau membuat anggaran belanja. Kamu suka membuat target yang berupa angka."
  },
  {
    id: 24,
    category: 'logis_matematis',
    text: "Kamu suka membuat rencana yang terperinci dan sering membuat, mengurutkan dan menerapkan daftar/rencana yang dibuat."
  },
  {
    id: 25,
    category: 'logis_matematis',
    text: "Kamu menyukai teka-teki dan permainan yang melibatkan logika (pemikiran logis) dan statistik seperti dam, halma dan catur."
  },
  {
    id: 26,
    category: 'logis_matematis',
    text: "Kamu cenderung mudah menunjukkan kesalahan-kesalahan logis dari apa yang dikatakan atau dikerjakan orang lain."
  },
  {
    id: 27,
    category: 'logis_matematis',
    text: "Matematika dan pengetahuan-pengetahuan ilmiah merupakan mata pelajaran favoritmu di sekolah."
  },
  {
    id: 28,
    category: 'logis_matematis',
    text: "Kamu dapat memberikan contoh-contoh khusus untuk mendukung suatu pendapat/cara pandang yang bersifat umum, dan kamu senang menganalisa situasi atau argumentasi"
  },
  {
    id: 29,
    category: 'logis_matematis',
    text: "Dalam memecahkan persoalan kamu melakukan pendekatan yang sistematis, tahap demi tahap. Kamu cenderung mencari pola dan hubungan antar obyek atau angka."
  },
  {
    id: 30,
    category: 'logis_matematis',
    text: "Untuk dapat mengetahui hubungan antara satu dengan lainnya, kamu sering membuat kategori, mengelompokkan atau membandingkan."
  },

  // Kinestetik (10 questions)
  {
    id: 31,
    category: 'kinestetik',
    text: "Kamu berolahraga secara teratur. Kamu suka berjalan, berenang dan menggerakkan tubuh."
  },
  {
    id: 32,
    category: 'kinestetik',
    text: "Kamu cukup ahli dalam prakarya"
  },
  {
    id: 33,
    category: 'kinestetik',
    text: "Kamu suka berpikir sambil melakukan kegiatan-kegiatan fisik seperti berjalan"
  },
  {
    id: 34,
    category: 'kinestetik',
    text: "Di taman bermain kamu menyukai permainan-permainan mencekam yang memutar-mutar tubuh (seperti halilintar di Dufan)"
  },
  {
    id: 35,
    category: 'kinestetik',
    text: "Untuk dapat mengerti sesuatu, kamu menanganinya secara fisik, memegangnya dan menyelidikinya"
  },
  {
    id: 36,
    category: 'kinestetik',
    text: "Pelajaran yang kamu sukai di sekolah adalah olahraga dan prakarya. Kamu menyukai seni pahat"
  },
  {
    id: 37,
    category: 'kinestetik',
    text: "Dalam mengekspresikan diri, kamu menggunakan gerak tangan atau bentuk bahasa tubuh."
  },
  {
    id: 38,
    category: 'kinestetik',
    text: "Kamu menyukai permainan fisik dan guling-gulingan. Kamu menyukai permainan membuat model (menyusun benda)"
  },
  {
    id: 39,
    category: 'kinestetik',
    text: "Dalam mempelajari sesuatu yang baru, kamu akan lebih mengerti bila dapat menyentuhnya atau memegangnya secara langsung daripada membaca buku atau menyaksikannya."
  },
  {
    id: 40,
    category: 'kinestetik',
    text: "Kamu mempunyai refleks dan respon tubuh yang baik"
  },

  // Musik (10 questions)
  {
    id: 41,
    category: 'musik',
    text: "Kamu dapat memainkan alat musik"
  },
  {
    id: 42,
    category: 'musik',
    text: "Kamu dapat bernyanyi dengan baik (tidak fals)"
  },
  {
    id: 43,
    category: 'musik',
    text: "Biasanya kamu dapat mengingat suatu irama hanya dengan mendengarkannya dua kali"
  },
  {
    id: 44,
    category: 'musik',
    text: "Kamu sering mendengarkan musik dimanapun kamu berada, dan suka pergi menonton pertunjukkan musik. Kamu menyukai bahkan membutuhkan musik sebagai latar belakang ketika mengerjakan sesuatu"
  },
  {
    id: 45,
    category: 'musik',
    text: "Kamu suka mengetuk-ngetuk untuk mengikuti irama musik tanpa sadar. Kamu memiliki kepekaan terhadap nada, tinggi/rendah dan warna irama."
  },
  {
    id: 46,
    category: 'musik',
    text: "Kamu dapat mengenali bunyi dari berbagai alat musik yang berbeda."
  },
  {
    id: 47,
    category: 'musik',
    text: "Musik film atau iklan sering muncul dengan tiba-tiba di kepala kamu."
  },
  {
    id: 48,
    category: 'musik',
    text: "Kamu tidak dapat hidup tanpa musik. Musik dapat dengan mudah menggunggah emosi kamu atau mengingatkan kamu akan berbagai hal."
  },
  {
    id: 49,
    category: 'musik',
    text: "Kamu sering bersiul atau menggumamkan suatu irama."
  },
  {
    id: 50,
    category: 'musik',
    text: "Kamu sering menggunakan irama untuk mengingatkan, misalnya menyebutkan nomor telepon secara berirama."
  },

  // Interpersonal (10 questions)
  {
    id: 51,
    category: 'interpersonal',
    text: "Kamu suka bekerja sama dengan orang lain sebagai bagian dari suatu kelompok / group atau kepanitiaan."
  },
  {
    id: 52,
    category: 'interpersonal',
    text: "Kamu bangga bila menjadi mentor atau penasihat bagi orang lain, kamu orang yang simpatik."
  },
  {
    id: 53,
    category: 'interpersonal',
    text: "Kamu orang yang pandai bernegosiasi(tawar menawar)"
  },
  {
    id: 54,
    category: 'interpersonal',
    text: "Kamu lebih suka olahraga yang bersifat tim seperti basket, voli, sepakbola daripada olah raga yang bersifat individual seperti berenang."
  },
  {
    id: 55,
    category: 'interpersonal',
    text: "Kamu menyukai permainan yang melibatkan orang lain seperti monopoli dan kartu."
  },
  {
    id: 56,
    category: 'interpersonal',
    text: "Kamu jauh lebih suka berada di pesta daripada menonton TV seorang diri dirumah."
  },
  {
    id: 57,
    category: 'interpersonal',
    text: "Kamu memiliki banyak teman dan beberapa sahabat dekat."
  },
  {
    id: 58,
    category: 'interpersonal',
    text: "Kamu dapat berkomunikasi dengan baik dengan orang lain dan dapat menjadi penengah dalam suatu pertengkaran."
  },
  {
    id: 59,
    category: 'interpersonal',
    text: "Kamu tidak ragu-ragu dalam memimpin, menunjukkan kepada orang bagaimana melakukan sesuatu."
  },
  {
    id: 60,
    category: 'interpersonal',
    text: "Dalam menghadapi persoalan, kamu membicarakannya dengan orang lain."
  },

  // Intrapersonal (10 questions)
  {
    id: 61,
    category: 'intrapersonal',
    text: "Kamu memiliki buku harian atau catatan untuk menuliskan pikiran-pikiran kamu yang terdalam."
  },
  {
    id: 62,
    category: 'intrapersonal',
    text: "Kamu sering mengadakan \"waktu teduh\", merefleksikan hal-hal terpenting dalam hidup kamu."
  },
  {
    id: 63,
    category: 'intrapersonal',
    text: "Kamu sudah menetapkan tujuan-tujuan - kamu kemana arah hidup kamu."
  },
  {
    id: 64,
    category: 'intrapersonal',
    text: "Kamu seorang pemikir yang mandiri, kamu mengenal pikiran kamu sendiri dan dapat membuat keputusan tanpa dipengaruhi orang lain."
  },
  {
    id: 65,
    category: 'intrapersonal',
    text: "Kamu mempunyai minat atau hobi yang bersifat pribadi, yang tidak suka kamu bagikan dengan orang lain."
  },
  {
    id: 66,
    category: 'intrapersonal',
    text: "Kamu menikmati kesendirian kamu ketika memancing atau mendaki gunung. Menurut kamu tempat berlibur yang menyenangkan adalah sebuah rumah terpencil dipuncak bukit, bukan sebuah hotel yang ramai."
  },
  {
    id: 67,
    category: 'intrapersonal',
    text: "Kamu dapat memotivasi diri sendiri."
  },
  {
    id: 68,
    category: 'intrapersonal',
    text: "Kamu mempunyai pendapat realistik (sesuai kenyataan) tentang kelebihan dan kekurangan kamu."
  },
  {
    id: 69,
    category: 'intrapersonal',
    text: "Kamu suka mengikuti pelatihan pengembangan diri atau konseling untuk lebih mengenal diri sendiri."
  },
  {
    id: 70,
    category: 'intrapersonal',
    text: "Kamu bekerja untuk diri sendiri atau berniat melakukan apa yang kamu minati (tanpa peduli pendapat orang lain)."
  }
];

const categoryInfo = {
  visual_spasial: { 
    name: "Visual Spasial", 
    icon: Brain, 
    color: "from-purple-500 to-purple-600",
    description: "Kemampuan memvisualisasikan dan memanipulasi objek dalam ruang" 
  },
  linguistik: { 
    name: "Linguistik", 
    icon: Lightbulb, 
    color: "from-blue-500 to-blue-600",
    description: "Kemampuan menggunakan bahasa secara efektif" 
  },
  logis_matematis: { 
    name: "Logis Matematis", 
    icon: Calculator, 
    color: "from-green-500 to-green-600",
    description: "Kemampuan bernalar logis dan menyelesaikan masalah matematika" 
  },
  kinestetik: { 
    name: "Kinestetik", 
    icon: Play, 
    color: "from-orange-500 to-orange-600",
    description: "Kemampuan menggunakan tubuh untuk mengekspresikan ide dan perasaan" 
  },
  musik: { 
    name: "Musik", 
    icon: Music, 
    color: "from-pink-500 to-pink-600",
    description: "Kemampuan memahami dan mengekspresikan musik" 
  },
  interpersonal: { 
    name: "Interpersonal", 
    icon: Users, 
    color: "from-indigo-500 to-indigo-600",
    description: "Kemampuan berinteraksi dan memahami orang lain" 
  },
  intrapersonal: { 
    name: "Intrapersonal", 
    icon: User, 
    color: "from-teal-500 to-teal-600",
    description: "Kemampuan memahami diri sendiri" 
  }
};

export default function MultipleIntelligence() {
  const [match, params] = useRoute("/multiple-intelligence/:userAssessmentId");
  const [, setLocation] = useLocation();
  const userAssessmentId = params?.userAssessmentId;

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingAccess, setIsCreatingAccess] = useState(false);
  const [hasTriedCreate, setHasTriedCreate] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const saveProgressDebounced = useRef<NodeJS.Timeout>();

  const { data: userAssessment, isLoading, error: userAssessmentError } = useQuery<UserAssessmentWithDetails>({
    queryKey: [`/api/user-assessments/by-id/${userAssessmentId}`],
    enabled: !!userAssessmentId && !!user,
    retry: false
  });

  const { data: assessments } = useQuery<Assessment[]>({
    queryKey: ["/api/assessments"],
    enabled: !!user
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentQuestionIndex]);

  useEffect(() => {
    if (!user) {
      toast({
        title: "Login Diperlukan",
        description: "Silakan login untuk mengakses asesmen ini.",
        variant: "destructive",
      });
      setLocation("/login");
    }
  }, [user, setLocation, toast]);

  const createAccessMutation = useMutation({
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
        throw new Error(errorData.message || 'Gagal membuat akses');
      }
      
      return response.json();
    },
    onSuccess: (data: { userAssessmentId: number }) => {
      setIsCreatingAccess(false);
      queryClient.invalidateQueries({ queryKey: [`/api/user-assessments/by-id/${userAssessmentId}`] });
      setLocation(`/multiple-intelligence/${data.userAssessmentId}`);
    },
    onError: (error: any) => {
      setIsCreatingAccess(false);
      setHasTriedCreate(true);
      toast({
        title: "Gagal Membuat Akses",
        description: error.message || "Terjadi kesalahan saat membuat akses asesmen.",
        variant: "destructive",
      });
    }
  });

  useEffect(() => {
    if (!userAssessment && !isLoading && user && assessments && !hasTriedCreate && !isCreatingAccess) {
      const intelligenceAssessment = assessments.find(a => a.type === 'intelligence' && a.name === 'Kecerdasan Majemuk');
      
      if (intelligenceAssessment && parseFloat(intelligenceAssessment.price) === 0) {
        setIsCreatingAccess(true);
        setHasTriedCreate(true);
        createAccessMutation.mutate(intelligenceAssessment.id);
      }
    }
  }, [userAssessment, isLoading, user, assessments, hasTriedCreate, isCreatingAccess]);

  // Restore saved responses when userAssessment data is loaded
  useEffect(() => {
    if (userAssessment?.results) {
      const results = userAssessment.results as any;
      if (results.responses) {
        setAnswers(results.responses);
        // Also restore the current page if saved
        if (results.currentPage !== undefined) {
          setCurrentQuestionIndex(results.currentPage);
        }
      }
    }
  }, [userAssessment]);

  const submitAssessmentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/user-assessments/${userAssessmentId}/complete`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-assessments'] });
      toast({
        title: "Asesmen Selesai!",
        description: "Hasil asesmen kecerdasan majemuk Anda telah disimpan.",
        variant: "default",
      });
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      console.error('Error submitting assessment:', error);
      if (isUnauthorizedError(error)) {
        toast({
          title: "Sesi Berakhir",
          description: "Silakan login kembali untuk melanjutkan.",
          variant: "destructive",
        });
        setLocation("/login");
      } else {
        toast({
          title: "Gagal Menyimpan",
          description: error.message || "Terjadi kesalahan saat menyimpan hasil asesmen.",
          variant: "destructive",
        });
      }
    },
  });

  const saveProgressMutation = useMutation({
    mutationFn: async (progressData: any) => {
      if (!userAssessmentId) throw new Error("No assessment found");
      return apiRequest("POST", `/api/user-assessments/${userAssessmentId}/save-progress`, progressData);
    },
  });

  const handleAnswerChange = (value: string) => {
    const currentQuestion = questions[currentQuestionIndex];
    const newAnswers = {
      ...answers,
      [currentQuestion.id]: value === 'ya'
    };
    setAnswers(newAnswers);
    
    // Auto-save progress with proper backend structure
    autoSaveProgress({
      responses: newAnswers,
      currentPage: currentQuestionIndex,
      participantInfo: {}
    });
  };

  const calculateResults = () => {
    const categoryScores: Record<string, { score: number; total: number }> = {};
    
    // Initialize category scores
    Object.keys(categoryInfo).forEach(category => {
      categoryScores[category] = { score: 0, total: 0 };
    });

    // Calculate scores for each category
    questions.forEach(question => {
      categoryScores[question.category].total += 1;
      if (answers[question.id] === true) {
        categoryScores[question.category].score += 1;
      }
    });

    // Convert to percentages and find dominant intelligences
    const categoryPercentages = Object.entries(categoryScores).map(([category, data]) => ({
      category,
      name: categoryInfo[category as keyof typeof categoryInfo].name,
      score: data.score,
      total: data.total,
      percentage: Math.round((data.score / data.total) * 100)
    }));

    // Sort by percentage (highest first)
    categoryPercentages.sort((a, b) => b.percentage - a.percentage);

    return {
      categoryScores: categoryPercentages,
      dominantIntelligences: categoryPercentages.slice(0, 3), // Top 3
      completedAt: new Date().toISOString(),
      answeredQuestions: Object.keys(answers).length,
      totalQuestions: questions.length
    };
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length < questions.length) {
      toast({
        title: "Asesmen Belum Lengkap",
        description: "Mohon jawab semua pertanyaan sebelum menyelesaikan asesmen.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Send raw responses to backend - backend will calculate results
      await submitAssessmentMutation.mutateAsync({
        responses: answers,
        participantInfo: {}
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      
      // Immediately save progress when navigating - no debouncing for navigation
      saveProgressMutation.mutate({
        responses: answers,
        currentPage: nextIndex,
        participantInfo: {}
      });
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      const prevIndex = currentQuestionIndex - 1;
      setCurrentQuestionIndex(prevIndex);
      
      // Immediately save progress when navigating - no debouncing for navigation
      saveProgressMutation.mutate({
        responses: answers,
        currentPage: prevIndex,
        participantInfo: {}
      });
    }
  };

  // Enhanced auto-save with debouncing
  const autoSaveProgress = (data: any) => {
    if (saveProgressDebounced.current) {
      clearTimeout(saveProgressDebounced.current);
    }
    saveProgressDebounced.current = setTimeout(() => {
      saveProgressMutation.mutate(data);
    }, 500); // Wait 0.5 seconds for better responsiveness
  };

  // Save when user navigates away from the page
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (userAssessmentId && Object.keys(answers).length > 0) {
        // Synchronous save when leaving page with proper backend structure
        navigator.sendBeacon(`/api/user-assessments/${userAssessmentId}/save-progress`, 
          JSON.stringify({
            responses: answers,
            currentPage: currentQuestionIndex,
            participantInfo: {}
          })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [userAssessmentId, answers, currentQuestionIndex]);

  if (isLoading || isCreatingAccess) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {isCreatingAccess ? "Membuat akses asesmen gratis..." : "Memuat asesmen..."}
          </p>
        </div>
      </div>
    );
  }

  if (!userAssessment && hasTriedCreate) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-semibold text-red-600 mb-2">Asesmen Tidak Ditemukan</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Asesmen ini tidak tersedia atau Anda tidak memiliki akses.
            </p>
            <Button onClick={() => setLocation("/dashboard")}>
              Kembali ke Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const currentCategory = categoryInfo[currentQuestion.category];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const answeredCount = Object.keys(answers).length;
  const selectedAnswer = answers[currentQuestion.id];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div ref={scrollRef} className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Asesmen Kecerdasan Majemuk
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Pertanyaan {currentQuestionIndex + 1} dari {questions.length}
            </p>
          </div>

          {/* Progress */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Progress
              </span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {Math.round(progress)}%
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {answeredCount} dari {questions.length} pertanyaan telah dijawab
            </p>
          </div>

          {/* Current Category */}
          <div className={`bg-gradient-to-r ${currentCategory.color} text-white p-4 rounded-lg mb-6`}>
            <div className="flex items-center">
              <currentCategory.icon className="w-6 h-6 mr-3" />
              <div>
                <h3 className="font-semibold">{currentCategory.name}</h3>
                <p className="text-sm opacity-90">{currentCategory.description}</p>
              </div>
            </div>
          </div>

          {/* Question Card */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-xl text-gray-900 dark:text-white">
                Pertanyaan {currentQuestionIndex + 1}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
                {currentQuestion.text}
              </p>

              <RadioGroup
                value={selectedAnswer === true ? 'ya' : selectedAnswer === false ? 'tidak' : ''}
                onValueChange={handleAnswerChange}
                className="space-y-4"
              >
                <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <RadioGroupItem 
                    value="ya" 
                    id="ya" 
                    data-testid={`option-ya-${currentQuestion.id}`}
                  />
                  <Label htmlFor="ya" className="flex-1 cursor-pointer text-base">
                    Ya
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <RadioGroupItem 
                    value="tidak" 
                    id="tidak"
                    data-testid={`option-tidak-${currentQuestion.id}`}
                  />
                  <Label htmlFor="tidak" className="flex-1 cursor-pointer text-base">
                    Tidak
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between items-center mb-8">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
              className="flex items-center space-x-2"
              data-testid="button-previous"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Sebelumnya</span>
            </Button>

            <div className="text-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Progress tersimpan otomatis
              </span>
            </div>

            {currentQuestionIndex === questions.length - 1 ? (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || Object.keys(answers).length < questions.length}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700"
                data-testid="button-submit"
              >
                <span>
                  {isSubmitting ? "Menyelesaikan..." : "Selesaikan Asesmen"}
                </span>
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={selectedAnswer === undefined}
                className="flex items-center space-x-2"
                data-testid="button-next"
              >
                <span>Selanjutnya</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Summary */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Ringkasan Jawaban per Kategori
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(categoryInfo).map(([key, info]) => {
                  const categoryQuestions = questions.filter(q => q.category === key);
                  const answeredInCategory = categoryQuestions.filter(q => answers[q.id] !== undefined);
                  
                  return (
                    <div key={key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center">
                        <info.icon className="w-5 h-5 mr-2 text-gray-600 dark:text-gray-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {info.name}
                        </span>
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {answeredInCategory.length}/{categoryQuestions.length}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}