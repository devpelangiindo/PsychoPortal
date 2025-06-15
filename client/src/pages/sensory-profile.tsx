import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Save, User, Users, FileText, AlertCircle } from "lucide-react";
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
}

interface Section {
  id: string;
  title: string;
  questions: Question[];
}

interface ParticipantInfo {
  childName: string;
  childBirthDate: string;
  childGender: string;
  parentName: string;
  relationship: string;
  parentAge: string;
  parentEducation: string;
  parentOccupation: string;
  testDate: string;
  concerns: string;
  otherInfo: string;
}

const sections: Section[] = [
  {
    id: 'A',
    title: 'A. Pemrosesan Auditori',
    questions: [
      { id: 1, text: 'Menanggapi secara negatif terhadap suara yang tidak terduga atau keras (misalnya: menangis atau bersembunyi dari kebisingan penyedot debu, gonggongan anjing, pengering rambut)' },
      { id: 2, text: 'Menutup telinga dengan tangan untuk melindungi telinga dari suara' },
      { id: 3, text: 'Kesulitan menyelesaikan tugas saat radio menyala' },
      { id: 4, text: 'Akan terganggu atau mengalami kesulitan melakukan fungsinya jika ada banyak kebisingan di sekitarnya' },
      { id: 5, text: 'Tidak dapat bekerja dengan latar belakang kebisingan (misalnya: suara kipas angin, lemari es)' },
      { id: 6, text: 'Tampaknya tidak mendengar apa yang Anda katakan (misalnya: tidak "mendengarkan" apa yang Anda katakan, tampaknya mengabaikan Anda)' },
      { id: 7, text: 'Tidak merespon saat namanya dipanggil tapi Anda tahu pendengaran anak baik-baik saja' },
      { id: 8, text: 'Menikmati suara-suara aneh/berusaha membuat suara-suara demi kebisingan' }
    ]
  },
  {
    id: 'B',
    title: 'B. Pemrosesan Visual',
    questions: [
      { id: 9, text: 'Lebih suka berada dalam kegelapan' },
      { id: 10, text: 'Menyatakan ketidaknyamanan dengan cahaya atau menghindari cahaya terang (misalnya: bersembunyi dari sinar matahari melalui jendela di dalam mobil)' },
      { id: 11, text: 'Senang berada dalam kegelapan' },
      { id: 12, text: 'Menjadi frustrasi saat mencoba menemukan objek/benda di latar belakang yang \'kacau\' (misalnya: laci yang berantakan)' },
      { id: 13, text: 'Memiliki kesulitan menyusun puzzle bersama (dibandingkan dengan anak-anak seusianya)' },
      { id: 14, text: 'Menghindari kontak mata atau memiliki kesulitan dengan kontak mata' },
      { id: 15, text: 'Memandang orang atau objek dari sudut matanya (tidak menatap langsung)' },
      { id: 16, text: 'Memandang objek dengan teliti atau dari jarak dekat' },
      { id: 17, text: 'Menyukai lampu terang atau sinar matahari' }
    ]
  },
  {
    id: 'C',
    title: 'C. Pemrosesan Vestibular',
    questions: [
      { id: 18, text: 'Menjadi cemas atau kesulitan saat kaki terangkat dari tanah' },
      { id: 19, text: 'Tidak menyukai aktivitas dimana kepala tidak tegak lurus atau terbalik' },
      { id: 20, text: 'Menghindari perosotan atau peralatan taman bermain lainnya' },
      { id: 21, text: 'Tidak menyukai naik escalator atau elevator' },
      { id: 22, text: 'Menghindari permainan yang tidak dapat diprediksi atau tidak terkendali' },
      { id: 23, text: 'Tidak suka berputar-putar atau akan menjadi pusing dengan mudah' },
      { id: 24, text: 'Mencari semua jenis gerakan dan ini mengganggu aktivitas sehari-hari (misalnya: tidak dapat duduk diam)' },
      { id: 25, text: 'Menikmati gerakan yang intens (misalnya: carnival rides, berputar-putar)' },
      { id: 26, text: 'Suka dilempar ke udara' },
      { id: 27, text: 'Melompat-lompat di permukaan empuk' },
      { id: 28, text: 'Suka berputar-putar dan jarang merasa pusing' }
    ]
  },
  {
    id: 'D',
    title: 'D. Pemrosesan Taktil',
    questions: [
      { id: 29, text: 'Menghindari bertelanjang kaki, terutama di pasir atau rumput' },
      { id: 30, text: 'Kesulitan dengan aktivitas perawatan diri (misalnya: pemotongan kuku, menyikat gigi, menyisir rambut)' },
      { id: 31, text: 'Menghindari bermain dengan finger paint, lem, atau bahan yang lengket' },
      { id: 32, text: 'Menghindari/tidak menyukai makanan yang berantakan' },
      { id: 33, text: 'Tidak suka disentuh oleh orang lain' },
      { id: 34, text: 'Tidak suka memiliki wajah yang kotor' },
      { id: 35, text: 'Tidak menyukai aktivitas dimana tangannya menjadi kotor' },
      { id: 36, text: 'Suka menyentuh orang dan objek' },
      { id: 37, text: 'Menyentuh permukaan atau tekstur yang menimbulkan respon dari orang lain (misalnya: meraba tempat yang kotor)' },
      { id: 38, text: 'Terlibat dalam perilaku yang melukai diri sendiri' }
    ]
  },
  {
    id: 'E',
    title: 'E. Pemrosesan Multisensoris',
    questions: [
      { id: 39, text: 'Menjadi bingung dalam lingkungan yang tidak dikenal' },
      { id: 40, text: 'Terganggu oleh suara keras, cahaya terang, atau bau yang tidak dikenal' },
      { id: 41, text: 'Kesulitan fokus di lingkungan yang sibuk' },
      { id: 42, text: 'Mencari input sensoris dengan menggabungkan banyak sensori' }
    ]
  },
  {
    id: 'F',
    title: 'F. Pemrosesan Oral Sensoris',
    questions: [
      { id: 43, text: 'Memilih makanan berdasarkan tekstur tertentu' },
      { id: 44, text: 'Membatasi diri pada tekstur makanan tertentu/memiliki pola makan yang terbatas' },
      { id: 45, text: 'Menghindari makanan tertentu karena baunya' },
      { id: 46, text: 'Hanya akan makan makanan bersuhu tertentu' },
      { id: 47, text: 'Pilih-pilih makanan, terutama yang berkaitan dengan tekstur makanan' },
      { id: 48, text: 'Memiliki kesulitan menelan' },
      { id: 49, text: 'Memasukkan objek ke dalam mulut (misalnya: tangan, mainan, baju)' },
      { id: 50, text: 'Mengunyah atau mengisap pakaian atau objek lainnya' },
      { id: 51, text: 'Mengeksplorasi objek dengan memasukkannya ke dalam mulut' },
      { id: 52, text: 'Suka makanan yang sangat pedas' },
      { id: 53, text: 'Suka makanan dengan tekstur yang intens (misalnya: sangat renyah, kenyal, dll)' },
      { id: 54, text: 'Menggertakkan atau menggeretakkan gigi' }
    ]
  },
  {
    id: 'G',
    title: 'G. Perencanaan Gerakan',
    questions: [
      { id: 55, text: 'Memiliki kesulitan dengan keterampilan motorik kasar yang membutuhkan koordinasi' },
      { id: 56, text: 'Memiliki kesulitan mengendarai sepeda' },
      { id: 57, text: 'Memiliki kesulitan dengan keterampilan motorik halus (misalnya: menggunakan pensil, gunting)' },
      { id: 58, text: 'Memiliki kesulitan motorik dalam aktivitas baru sampai belajar mereka' },
      { id: 59, text: 'Klak atau tersandung saat berjalan' },
      { id: 60, text: 'Memiliki keseimbangan yang buruk' },
      { id: 61, text: 'Takut jatuh atau berada di ketinggian' },
      { id: 62, text: 'Tidak aman secara fisik; sering terluka' },
      { id: 63, text: 'Mengambil risiko fisik yang tidak perlu selama bermain' },
      { id: 64, text: 'Tampaknya tidak menyadari saat terluka' }
    ]
  },
  {
    id: 'H',
    title: 'H. Modulasi Endurance dan Tonus',
    questions: [
      { id: 65, text: 'Memiliki tingkat aktivitas yang rendah' },
      { id: 66, text: 'Lelah dengan mudah, terutama saat berdiri atau memegang posisi tertentu' },
      { id: 67, text: 'Memiliki tonus otot yang lemah' },
      { id: 68, text: 'Menyandarkan tubuh pada orang, furnitur, dinding (yaitu cari dukungan)' },
      { id: 69, text: 'Memiliki "limp" handshake' },
      { id: 70, text: 'Memiliki kesulitan membuka botol, kaleng, atau kemasan' },
      { id: 71, text: 'Memiliki kesulitan mengangkat objek berat' },
      { id: 72, text: 'Suka tekanan berat (misalnya: selimut berat, beban berat)' },
      { id: 73, text: 'Suka pakaian ketat' },
      { id: 74, text: 'Suka "bear hugs" atau dipeluk kuat' },
      { id: 75, text: 'Suka sandwich diantara bantal atau furnitur' }
    ]
  },
  {
    id: 'I',
    title: 'I. Modulasi Sensory Processing yang Berkaitan dengan Tonus Tubuh dan Endurance',
    questions: [
      { id: 76, text: 'Menunjukkan fluktuasi dalam tingkat waspada/responsivitas sepanjang hari' },
      { id: 77, text: 'Memiliki kesulitan untuk "memulai"' },
      { id: 78, text: 'Tampak lelah; memiliki energi yang sedikit' },
      { id: 79, text: 'Mempengaruhi emosional; sering tampak khawatir' },
      { id: 80, text: 'Memiliki tingkat aktivitas yang tinggi' },
      { id: 81, text: 'Selalu bergerak' },
      { id: 82, text: 'Tampak tidak pernah lelah' },
      { id: 83, text: 'Impulsif; kurang menunjukkan restraint' },
      { id: 84, text: 'Tidak dapat berhenti dirinya untuk berbicara atau bergerak' }
    ]
  },
  {
    id: 'J',
    title: 'J. Modulasi Gerakan yang Mempengaruhi Tingkat Aktivitas',
    questions: [
      { id: 85, text: 'Lambat untuk merespon' },
      { id: 86, text: 'Berhati-hati dengan gerakan atau bermain' },
      { id: 87, text: 'Mencari gerakan yang menenangkan (misalnya: goyang, memantul)' },
      { id: 88, text: 'Mencari gerakan yang memutar atau berputar' },
      { id: 89, text: 'Menikmati, atau mencari, gerakan yang cepat, intens, atau berputar' }
    ]
  },
  {
    id: 'K',
    title: 'K. Modulasi Input Sensoris yang Mempengaruhi Respon Emosional',
    questions: [
      { id: 90, text: 'Tampaknya tidak tertarik dengan aktivitas yang menarik bagi anak lain' },
      { id: 91, text: 'Tidak mengekspresikan dirinya terlalu baik' },
      { id: 92, text: 'Tampaknya memiliki tingkat aktivitas yang sama terlepas dari situasinya' },
      { id: 93, text: 'Tidak menanggapi rangsangan eksternal yang berbahaya (misalnya: tidak menjauh dari situasi yang berbahaya)' },
      { id: 94, text: 'Mengambil bagian dalam gerakan yang berbahaya; tidak merasakan bahaya' },
      { id: 95, text: 'Tampaknya tidak menyadari konsekuensi dari tindakannya' },
      { id: 96, text: 'Bereaksi secara emosional tidak tepat terhadap situasi (misalnya: tertawa ketika seseorang terluka)' },
      { id: 97, text: 'Tidak merespons atau membutuhkan respon lebih intens dari yang Anda harapkan' },
      { id: 98, text: 'Menunjukkan respon ekstrem terhadap suara yang tidak terduga, cahaya, gerakan, sentuhan, bau, atau rasa' },
      { id: 99, text: 'Respon emosional tidak tepat untuk situasi' }
    ]
  },
  {
    id: 'L',
    title: 'L. Modulasi Input Visual yang Mempengaruhi Respon Emosional dan Tingkat Aktivitas',
    questions: [
      { id: 100, text: 'Bereaksi secara ekstrem terhadap rangsangan visual yang tidak terduga (misalnya: mengekspresikan ketidaknyamanan/menangis)' },
      { id: 101, text: 'Menghindari kontak mata' },
      { id: 102, text: 'Menonton TV dengan jarak dekat' },
      { id: 103, text: 'Senang melihat objek berputar (misalnya: mencuci dalam mesin cuci, roda berputar)' }
    ]
  },
  {
    id: 'M',
    title: 'M. Modulasi Input Taktil yang Mempengaruhi Respon Emosional',
    questions: [
      { id: 104, text: 'Menghindari kerumunan atau berdiri dekat dengan orang' },
      { id: 105, text: 'Tidak menyukai sentuhan tak terduga (misalnya: menjadi marah jika ada yang menyentuhnya dari belakang)' },
      { id: 106, text: 'Bereaksi secara emosional atau agresif terhadap sentuhan' },
      { id: 107, text: 'Menarik diri saat disentuh' },
      { id: 108, text: 'Bereaksi secara negatif untuk bersentuhan dengan tekstur tertentu' }
    ]
  },
  {
    id: 'N',
    title: 'N. Sensory Processing yang Berkaitan dengan Threshold Rendah',
    questions: [
      { id: 109, text: 'Memiliki respon yang dapat diprediksi terhadap rasa sakit (misalnya: menangis setiap kali terluka)' },
      { id: 110, text: 'Bereaksi terhadap ketidaknyamanan (misalnya: suhu, kebisingan)' },
      { id: 111, text: 'Merespon secara negatif untuk suara keras' },
      { id: 112, text: 'Terganggu oleh kegiatan yang memerlukan berpakaian dan menanggalkan pakaian' },
      { id: 113, text: 'Terganggu oleh kaus kaki, sepatu, atau pakaian' },
      { id: 114, text: 'Menghindari naik atau turun tangga atau eskalator' },
      { id: 115, text: 'Menjadi terganggu saat berpindah dari satu permukaan ke permukaan lain (misalnya: dari karpet ke linoleum, rumput ke trotoar)' },
      { id: 116, text: 'Kesulitan berdiri di antrean atau duduk di karpet dengan anak-anak lain karena kekhawatiran bahwa orang lain akan menyentuhnya' },
      { id: 117, text: 'Menghindari makanan dengan tekstur/suhu campuran' },
      { id: 118, text: 'Respon berlebihan terhadap panas, dingin, atau rasa sakit' },
      { id: 119, text: 'Mengurangi kegiatan yang melibatkan pergerakan' },
      { id: 120, text: 'Terganggu dengan kegiatan yang memiliki lebih dari satu bagian' },
      { id: 121, text: 'Mengekspresikan tekanan dari aktivitas sehari-hari' },
      { id: 122, text: 'Memerlukan istirahat lebih sering dari anak-anak lain' },
      { id: 123, text: 'Memiliki masalah untuk tidur' },
      { id: 124, text: 'Protes atau menolak untuk mengikuti aktivitas' },
      { id: 125, text: 'Menghindari aktivitas atau lingkungan tertentu' }
    ]
  }
];

export default function SensoryProfile() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/assessment/:id");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Assessment state
  const [currentStep, setCurrentStep] = useState<'instructions' | 'participant-info' | 'questions'>('instructions');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [notApplicable, setNotApplicable] = useState<Record<number, boolean>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  
  // Participant info state
  const [participantInfo, setParticipantInfo] = useState<ParticipantInfo>({
    childName: '',
    childBirthDate: '',
    childGender: '',
    parentName: '',
    relationship: '',
    parentAge: '',
    parentEducation: '',
    parentOccupation: '',
    testDate: new Date().toISOString().split('T')[0],
    concerns: '',
    otherInfo: ''
  });

  const [userAssessment, setUserAssessment] = useState<UserAssessmentWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get all questions
  const allQuestions = sections.flatMap(section => 
    section.questions.map(q => ({ ...q, sectionId: section.id, sectionTitle: section.title }))
  );

  // Calculate progress
  const answeredQuestions = Object.keys(responses).length;
  const totalQuestions = allQuestions.length;
  const progress = (answeredQuestions / totalQuestions) * 100;

  // Auto-save functionality
  const saveProgressMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!userAssessment?.id) return;
      return apiRequest(`/api/user-assessments/${userAssessment.id}/save-progress`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
  });

  const completeMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!userAssessment?.id) return;
      return apiRequest(`/api/user-assessments/${userAssessment.id}/complete`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({
        title: "Asesmen Selesai!",
        description: "Terima kasih telah menyelesaikan asesmen profil sensoris."
      });
      navigate("/assessment-results");
    }
  });

  // Initialize assessment
  useEffect(() => {
    const initializeAssessment = async () => {
      if (!user || !params?.id) return;
      
      try {
        const assessmentId = parseInt(params.id);
        const response = await apiRequest(`/api/user-assessments/${assessmentId}`);
        setUserAssessment(response);
        
        // Load existing progress if any
        if (response.results) {
          setResponses(response.results.responses || {});
          setNotApplicable(response.results.notApplicable || {});
          setComments(response.results.comments || {});
          setParticipantInfo(response.results.participantInfo || participantInfo);
          
          // If assessment is completed, redirect to results
          if (response.status === 'completed') {
            navigate("/assessment-results");
            return;
          }
        }
        
        setIsLoading(false);
      } catch (error) {
        if (isUnauthorizedError(error as Error)) {
          navigate("/");
          return;
        }
        toast({
          title: "Error",
          description: "Gagal memuat asesmen",
          variant: "destructive"
        });
      }
    };

    initializeAssessment();
  }, [user, params, navigate, toast]);

  // Auto-save when responses change
  useEffect(() => {
    if (!userAssessment || isLoading) return;
    
    const saveData = {
      responses,
      notApplicable,
      comments,
      participantInfo
    };
    
    saveProgressMutation.mutate(saveData);
  }, [responses, notApplicable, comments, participantInfo]);

  const handleResponseChange = (questionId: number, value: string) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
    setNotApplicable(prev => {
      const newState = { ...prev };
      delete newState[questionId];
      return newState;
    });
  };

  const handleNotApplicableChange = (questionId: number, checked: boolean) => {
    if (checked) {
      setNotApplicable(prev => ({ ...prev, [questionId]: true }));
      setResponses(prev => {
        const newState = { ...prev };
        delete newState[questionId];
        return newState;
      });
    } else {
      setNotApplicable(prev => {
        const newState = { ...prev };
        delete newState[questionId];
        return newState;
      });
    }
  };

  const calculateResults = () => {
    // Calculate section scores
    const sectionScores: Record<string, number> = {};
    
    sections.forEach(section => {
      let sectionScore = 0;
      section.questions.forEach(question => {
        const response = responses[question.id];
        if (response && !notApplicable[question.id]) {
          sectionScore += parseInt(response);
        }
      });
      sectionScores[section.id] = sectionScore;
    });

    // Calculate total score
    const totalScore = Object.values(sectionScores).reduce((sum, score) => sum + score, 0);
    
    // Determine interpretation
    let interpretation = '';
    if (totalScore < 155) {
      interpretation = 'Sensitivitas Rendah - Kemungkinan memerlukan stimulasi sensoris yang lebih kuat';
    } else if (totalScore < 190) {
      interpretation = 'Sensitivitas Sedang Rendah - Beberapa area memerlukan perhatian';
    } else if (totalScore < 240) {
      interpretation = 'Sensitivitas Normal - Respons sensoris dalam batas normal';
    } else if (totalScore < 285) {
      interpretation = 'Sensitivitas Sedang Tinggi - Beberapa area menunjukkan kepekaan berlebih';
    } else {
      interpretation = 'Sensitivitas Tinggi - Kemungkinan mengalami hipersensitivitas sensoris';
    }

    return {
      sectionScores,
      totalScore,
      interpretation,
      responses,
      notApplicable,
      comments,
      participantInfo,
      completionDate: new Date().toISOString()
    };
  };

  const handleComplete = () => {
    const results = calculateResults();
    completeMutation.mutate(results);
  };

  const isAllQuestionsAnswered = () => {
    return allQuestions.every(q => 
      responses[q.id] || notApplicable[q.id]
    );
  };

  const currentQuestion = allQuestions[currentQuestionIndex];

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-8 text-center">
              <p>Silakan login untuk mengakses asesmen ini.</p>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-8 text-center">
              <p>Memuat asesmen...</p>
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
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Instructions Step */}
        {currentStep === 'instructions' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-6 w-6" />
                Instruksi Asesmen Profil Sensoris
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
                <h3 className="text-lg font-semibold mb-4 text-blue-800 dark:text-blue-200">
                  Tujuan Asesmen
                </h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  Profil Sensoris adalah alat asesmen yang dirancang untuk mengukur pola pemrosesan 
                  sensoris anak dalam kehidupan sehari-hari. Asesmen ini akan membantu memahami bagaimana 
                  anak merespons berbagai rangsangan sensoris di lingkungannya.
                </p>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
                <h3 className="text-lg font-semibold mb-4 text-green-800 dark:text-green-200">
                  Cara Pengisian
                </h3>
                <div className="space-y-3 text-gray-700 dark:text-gray-300">
                  <p>• <strong>Nilai 1:</strong> Hampir Tidak Pernah (bila perilaku terjadi 0-10% dari waktu)</p>
                  <p>• <strong>Nilai 2:</strong> Kadang-kadang (bila perilaku terjadi 25% dari waktu)</p>
                  <p>• <strong>Nilai 3:</strong> Sering (bila perilaku terjadi 50% dari waktu)</p>
                  <p>• <strong>Nilai 4:</strong> Hampir Selalu (bila perilaku terjadi 75% dari waktu)</p>
                  <p>• <strong>Nilai 5:</strong> Selalu (bila perilaku terjadi 90-100% dari waktu)</p>
                  <p>• <strong>Tidak Berlaku:</strong> Pilih ini jika item tidak sesuai dengan situasi anak</p>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg">
                <h3 className="text-lg font-semibold mb-4 text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Penting untuk Diingat
                </h3>
                <div className="space-y-2 text-gray-700 dark:text-gray-300">
                  <p>• Jawablah berdasarkan pengamatan perilaku anak dalam 2-3 bulan terakhir</p>
                  <p>• Tidak ada jawaban yang benar atau salah</p>
                  <p>• Jika ragu, pilih frekuensi yang paling mendekati perilaku anak</p>
                  <p>• Asesmen akan disimpan otomatis setiap kali Anda menjawab</p>
                  <p>• Total waktu pengisian sekitar 30-45 menit</p>
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <Button 
                  onClick={() => setCurrentStep('participant-info')}
                  size="lg"
                  className="px-8"
                >
                  Lanjutkan ke Informasi Partisipan
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Participant Info Step */}
        {currentStep === 'participant-info' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-6 w-6" />
                Informasi Anak dan Orang Tua/Pengasuh
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    Informasi Anak
                  </h3>
                  
                  <div>
                    <Label htmlFor="childName">Nama Anak *</Label>
                    <Input
                      id="childName"
                      value={participantInfo.childName}
                      onChange={(e) => setParticipantInfo(prev => ({ ...prev, childName: e.target.value }))}
                      placeholder="Masukkan nama anak"
                    />
                  </div>

                  <div>
                    <Label htmlFor="childBirthDate">Tanggal Lahir *</Label>
                    <Input
                      id="childBirthDate"
                      type="date"
                      value={participantInfo.childBirthDate}
                      onChange={(e) => setParticipantInfo(prev => ({ ...prev, childBirthDate: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="childGender">Jenis Kelamin *</Label>
                    <Select 
                      value={participantInfo.childGender} 
                      onValueChange={(value) => setParticipantInfo(prev => ({ ...prev, childGender: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih jenis kelamin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L">Laki-laki</SelectItem>
                        <SelectItem value="P">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    Informasi Orang Tua/Pengasuh
                  </h3>

                  <div>
                    <Label htmlFor="parentName">Nama Orang Tua/Pengasuh *</Label>
                    <Input
                      id="parentName"
                      value={participantInfo.parentName}
                      onChange={(e) => setParticipantInfo(prev => ({ ...prev, parentName: e.target.value }))}
                      placeholder="Masukkan nama"
                    />
                  </div>

                  <div>
                    <Label htmlFor="relationship">Hubungan dengan Anak *</Label>
                    <Select 
                      value={participantInfo.relationship} 
                      onValueChange={(value) => setParticipantInfo(prev => ({ ...prev, relationship: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih hubungan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ibu">Ibu</SelectItem>
                        <SelectItem value="ayah">Ayah</SelectItem>
                        <SelectItem value="pengasuh">Pengasuh</SelectItem>
                        <SelectItem value="guru">Guru</SelectItem>
                        <SelectItem value="terapis">Terapis</SelectItem>
                        <SelectItem value="lainnya">Lainnya</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="parentAge">Usia</Label>
                    <Input
                      id="parentAge"
                      value={participantInfo.parentAge}
                      onChange={(e) => setParticipantInfo(prev => ({ ...prev, parentAge: e.target.value }))}
                      placeholder="Masukkan usia"
                    />
                  </div>

                  <div>
                    <Label htmlFor="parentEducation">Pendidikan Terakhir</Label>
                    <Input
                      id="parentEducation"
                      value={participantInfo.parentEducation}
                      onChange={(e) => setParticipantInfo(prev => ({ ...prev, parentEducation: e.target.value }))}
                      placeholder="Contoh: S1, SMA, dll"
                    />
                  </div>

                  <div>
                    <Label htmlFor="parentOccupation">Pekerjaan</Label>
                    <Input
                      id="parentOccupation"
                      value={participantInfo.parentOccupation}
                      onChange={(e) => setParticipantInfo(prev => ({ ...prev, parentOccupation: e.target.value }))}
                      placeholder="Masukkan pekerjaan"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="testDate">Tanggal Tes</Label>
                  <Input
                    id="testDate"
                    type="date"
                    value={participantInfo.testDate}
                    onChange={(e) => setParticipantInfo(prev => ({ ...prev, testDate: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="concerns">Kekhawatiran atau Keprihatinan Utama</Label>
                  <Textarea
                    id="concerns"
                    value={participantInfo.concerns}
                    onChange={(e) => setParticipantInfo(prev => ({ ...prev, concerns: e.target.value }))}
                    placeholder="Jelaskan kekhawatiran atau masalah perilaku yang Anda amati..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="otherInfo">Informasi Tambahan</Label>
                  <Textarea
                    id="otherInfo"
                    value={participantInfo.otherInfo}
                    onChange={(e) => setParticipantInfo(prev => ({ ...prev, otherInfo: e.target.value }))}
                    placeholder="Informasi lain yang dirasa penting untuk diketahui..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button 
                  variant="outline"
                  onClick={() => setCurrentStep('instructions')}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Kembali ke Instruksi
                </Button>
                
                <Button 
                  onClick={() => setCurrentStep('questions')}
                  disabled={!participantInfo.childName || !participantInfo.childBirthDate || !participantInfo.childGender || !participantInfo.parentName || !participantInfo.relationship}
                >
                  Mulai Asesmen
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Questions Step */}
        {currentStep === 'questions' && currentQuestion && (
          <div className="space-y-6">
            {/* Progress */}
            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Progress Asesmen</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {answeredQuestions} dari {totalQuestions} pertanyaan
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </CardContent>
            </Card>

            {/* Question */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {currentQuestion.sectionTitle}
                </CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Pertanyaan {currentQuestionIndex + 1} dari {totalQuestions}
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                    {currentQuestion.text}
                  </p>
                </div>

                {/* Response Options */}
                <div className="space-y-4">
                  <RadioGroup
                    value={responses[currentQuestion.id] || ''}
                    onValueChange={(value) => handleResponseChange(currentQuestion.id, value)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="1" id="option1" />
                      <Label htmlFor="option1" className="flex-1">
                        <span className="font-medium">1 - Hampir Tidak Pernah</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400 block">
                          (0-10% dari waktu)
                        </span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="2" id="option2" />
                      <Label htmlFor="option2" className="flex-1">
                        <span className="font-medium">2 - Kadang-kadang</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400 block">
                          (25% dari waktu)
                        </span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="3" id="option3" />
                      <Label htmlFor="option3" className="flex-1">
                        <span className="font-medium">3 - Sering</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400 block">
                          (50% dari waktu)
                        </span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="4" id="option4" />
                      <Label htmlFor="option4" className="flex-1">
                        <span className="font-medium">4 - Hampir Selalu</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400 block">
                          (75% dari waktu)
                        </span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="5" id="option5" />
                      <Label htmlFor="option5" className="flex-1">
                        <span className="font-medium">5 - Selalu</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400 block">
                          (90-100% dari waktu)
                        </span>
                      </Label>
                    </div>
                  </RadioGroup>

                  {/* Not Applicable Option */}
                  <div className="border-t pt-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="notApplicable"
                        checked={notApplicable[currentQuestion.id] || false}
                        onChange={(e) => handleNotApplicableChange(currentQuestion.id, e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="notApplicable" className="text-gray-700 dark:text-gray-300">
                        Tidak Berlaku untuk situasi anak ini
                      </Label>
                    </div>
                  </div>

                  {/* Comment Field */}
                  <div>
                    <Label htmlFor="comment">Komentar (opsional)</Label>
                    <Textarea
                      id="comment"
                      value={comments[currentQuestion.id] || ''}
                      onChange={(e) => setComments(prev => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                      placeholder="Tambahkan komentar jika diperlukan..."
                      rows={2}
                    />
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex justify-between pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentQuestionIndex === 0}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Sebelumnya
                  </Button>

                  {currentQuestionIndex < totalQuestions - 1 ? (
                    <Button
                      onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                      disabled={!responses[currentQuestion.id] && !notApplicable[currentQuestion.id]}
                    >
                      Selanjutnya
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleComplete}
                      disabled={!isAllQuestionsAnswered() || completeMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {completeMutation.isPending ? 'Menyelesaikan...' : 'Selesaikan Asesmen'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}