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
import { ArrowLeft, ArrowRight, Save, User, Users } from "lucide-react";
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
  threshold?: 'L' | 'H';
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
    title: 'A. Pemrosesan Pendengaran',
    questions: [
      { id: 1, text: 'Menanggapi secara negatif terhadap suara yang tidak terduga atau keras (misalnya: menangis atau bersembunyi dari kebisingan penyedot debu, gonggongan anjing, pengering rambut)', threshold: 'L' },
      { id: 2, text: 'Menutup telinga dengan tangan untuk melindungi telinga dari suara', threshold: 'L' },
      { id: 3, text: 'Kesulitan menyelesaikan tugas saat radio menyala', threshold: 'L' },
      { id: 4, text: 'Akan terganggu atau mengalami kesulitan melakukan fungsinya jika ada banyak kebisingan di sekitarnya', threshold: 'L' },
      { id: 5, text: 'Tidak dapat bekerja dengan latar belakang kebisingan (misalnya: suara kipas angin, lemari es)', threshold: 'L' },
      { id: 6, text: 'Tampaknya tidak mendengar apa yang Anda katakan (misalnya: tidak "mendengarkan" apa yang Anda katakan, tampaknya mengabaikan Anda)', threshold: 'H' },
      { id: 7, text: 'Tidak merespon saat namanya dipanggil tapi Anda tahu pendengaran anak baik-baik saja', threshold: 'H' },
      { id: 8, text: 'Menikmati suara-suara aneh/berusaha membuat suara-suara demi kebisingan', threshold: 'H' }
    ]
  },
  {
    id: 'B',
    title: 'B. Pemrosesan Visual',
    questions: [
      { id: 9, text: 'Lebih suka berada dalam kegelapan', threshold: 'L' },
      { id: 10, text: 'Menyatakan ketidaknyamanan dengan cahaya atau menghindari cahaya terang (misalnya: bersembunyi dari sinar matahari melalui jendela di dalam mobil)', threshold: 'L' },
      { id: 11, text: 'Senang berada dalam kegelapan', threshold: 'L' },
      { id: 12, text: 'Menjadi frustrasi saat mencoba menemukan objek/benda di latar belakang yang \'kacau\' (misalnya: laci yang berantakan)', threshold: 'L' },
      { id: 13, text: 'Memiliki kesulitan menyusun puzzle bersama (dibandingkan dengan anak-anak seusianya)', threshold: 'L' },
      { id: 14, text: 'Menghindari kontak mata atau memiliki kesulitan dengan kontak mata', threshold: 'L' },
      { id: 15, text: 'Memandang orang atau objek dari sudut matanya (tidak menatap langsung)', threshold: 'L' },
      { id: 16, text: 'Memandang objek dengan teliti atau dari jarak dekat', threshold: 'H' },
      { id: 17, text: 'Menyukai lampu terang atau sinar matahari', threshold: 'H' }
    ]
  },
  {
    id: 'C',
    title: 'C. Pemrosesan Vestibular',
    questions: [
      { id: 18, text: 'Menjadi cemas atau kesulitan saat kaki terangkat dari tanah', threshold: 'L' },
      { id: 19, text: 'Tidak menyukai aktivitas dimana kepala tidak tegak lurus atau terbalik', threshold: 'L' },
      { id: 20, text: 'Menghindari perosotan atau peralatan taman bermain lainnya', threshold: 'L' },
      { id: 21, text: 'Tidak menyukai naik escalator atau elevator', threshold: 'L' },
      { id: 22, text: 'Menghindari permainan yang tidak dapat diprediksi atau tidak terkendali', threshold: 'L' },
      { id: 23, text: 'Tidak suka berputar-putar atau akan menjadi pusing dengan mudah', threshold: 'L' },
      { id: 24, text: 'Mencari semua jenis gerakan dan ini mengganggu aktivitas sehari-hari (misalnya: tidak dapat duduk diam)', threshold: 'H' },
      { id: 25, text: 'Menikmati gerakan yang intens (misalnya: carnival rides, berputar-putar)', threshold: 'H' },
      { id: 26, text: 'Suka dilempar ke udara', threshold: 'H' },
      { id: 27, text: 'Melompat-lompat di permukaan empuk', threshold: 'H' },
      { id: 28, text: 'Suka berputar-putar dan jarang merasa pusing', threshold: 'H' }
    ]
  },
  {
    id: 'D',
    title: 'D. Pemrosesan Sentuhan',
    questions: [
      { id: 29, text: 'Menghindari bertelanjang kaki, terutama di pasir atau rumput', threshold: 'L' },
      { id: 30, text: 'Kesulitan dengan aktivitas perawatan diri (misalnya: pemotongan kuku, menyikat gigi, menyisir rambut)', threshold: 'L' },
      { id: 31, text: 'Menghindari bermain dengan finger paint, lem, atau bahan yang lengket', threshold: 'L' },
      { id: 32, text: 'Menghindari/tidak menyukai makanan yang berantakan', threshold: 'L' },
      { id: 33, text: 'Tidak suka disentuh oleh orang lain', threshold: 'L' },
      { id: 34, text: 'Tidak suka memiliki wajah yang kotor', threshold: 'L' },
      { id: 35, text: 'Tidak menyukai aktivitas dimana tangannya menjadi kotor', threshold: 'L' },
      { id: 36, text: 'Suka menyentuh orang dan objek', threshold: 'H' },
      { id: 37, text: 'Menyentuh permukaan atau tekstur yang menimbulkan respon dari orang lain (misalnya: meraba tempat yang kotor)', threshold: 'H' },
      { id: 38, text: 'Terlibat dalam perilaku yang melukai diri sendiri', threshold: 'H' }
    ]
  },
  {
    id: 'E',
    title: 'E. Pemrosesan Multisensory',
    questions: [
      { id: 39, text: 'Menjadi bingung dalam lingkungan yang tidak dikenal', threshold: 'L' },
      { id: 40, text: 'Terganggu oleh suara keras, cahaya terang, atau bau yang tidak dikenal', threshold: 'L' },
      { id: 41, text: 'Kesulitan fokus di lingkungan yang sibuk', threshold: 'L' },
      { id: 42, text: 'Mencari input sensoris dengan menggabungkan banyak sensori', threshold: 'H' }
    ]
  },
  {
    id: 'F',
    title: 'F. Pemrosesan Oral Sensory',
    questions: [
      { id: 43, text: 'Memilih makanan berdasarkan tekstur tertentu', threshold: 'L' },
      { id: 44, text: 'Membatasi diri pada tekstur makanan tertentu/memiliki pola makan yang terbatas', threshold: 'L' },
      { id: 45, text: 'Menghindari makanan tertentu karena baunya', threshold: 'L' },
      { id: 46, text: 'Hanya akan makan makanan bersuhu tertentu', threshold: 'L' },
      { id: 47, text: 'Pilih-pilih makanan, terutama yang berkaitan dengan tekstur makanan', threshold: 'L' },
      { id: 48, text: 'Memiliki kesulitan menelan', threshold: 'L' },
      { id: 49, text: 'Memasukkan objek ke dalam mulut (misalnya: tangan, mainan, baju)', threshold: 'H' },
      { id: 50, text: 'Mengunyah atau mengisap pakaian atau objek lainnya', threshold: 'H' },
      { id: 51, text: 'Mengeksplorasi objek dengan memasukkannya ke dalam mulut', threshold: 'H' },
      { id: 52, text: 'Suka makanan yang sangat pedas', threshold: 'H' },
      { id: 53, text: 'Suka makanan dengan tekstur yang intens (misalnya: sangat renyah, kenyal, dll)', threshold: 'H' },
      { id: 54, text: 'Menggertakkan atau menggeretakkan gigi', threshold: 'H' }
    ]
  },
  {
    id: 'G',
    title: 'G. Pemrosesan Perencanaan Gerakan',
    questions: [
      { id: 55, text: 'Memiliki kesulitan dengan keterampilan motorik kasar yang membutuhkan koordinasi', threshold: 'L' },
      { id: 56, text: 'Memiliki kesulitan mengendarai sepeda', threshold: 'L' },
      { id: 57, text: 'Memiliki kesulitan dengan keterampilan motorik halus (misalnya: menggunakan pensil, gunting)', threshold: 'L' },
      { id: 58, text: 'Memiliki kesulitan motorik dalam aktivitas baru sampai belajar mereka', threshold: 'L' },
      { id: 59, text: 'Klak atau tersandung saat berjalan', threshold: 'L' },
      { id: 60, text: 'Memiliki keseimbangan yang buruk', threshold: 'L' },
      { id: 61, text: 'Takut jatuh atau berada di ketinggian', threshold: 'L' },
      { id: 62, text: 'Tidak aman secara fisik; sering terluka', threshold: 'H' },
      { id: 63, text: 'Mengambil risiko fisik yang tidak perlu selama bermain', threshold: 'H' },
      { id: 64, text: 'Tampaknya tidak menyadari saat terluka', threshold: 'H' }
    ]
  },
  {
    id: 'H',
    title: 'H. Pemrosesan Energi Tubuh',
    questions: [
      { id: 65, text: 'Memiliki tingkat aktivitas yang rendah', threshold: 'L' },
      { id: 66, text: 'Lelah dengan mudah, terutama saat berdiri atau memegang posisi tertentu', threshold: 'L' },
      { id: 67, text: 'Memiliki tonus otot yang lemah', threshold: 'L' },
      { id: 68, text: 'Menyandarkan tubuh pada orang, furnitur, dinding (yaitu cari dukungan)', threshold: 'L' },
      { id: 69, text: 'Memiliki "limp" handshake', threshold: 'L' },
      { id: 70, text: 'Memiliki kesulitan membuka botol, kaleng, atau kemasan', threshold: 'L' },
      { id: 71, text: 'Memiliki kesulitan mengangkat objek berat', threshold: 'L' },
      { id: 72, text: 'Suka tekanan berat (misalnya: selimut berat, beban berat)', threshold: 'H' },
      { id: 73, text: 'Suka pakaian ketat', threshold: 'H' },
      { id: 74, text: 'Suka "bear hugs" atau dipeluk kuat', threshold: 'H' },
      { id: 75, text: 'Suka sandwich diantara bantal atau furnitur', threshold: 'H' }
    ]
  },
  {
    id: 'I',
    title: 'I. Modulasi Sensory Processing yang Berkaitan dengan Tonus Tubuh dan Endurance',
    questions: [
      { id: 76, text: 'Menunjukkan fluktuasi dalam tingkat waspada/responsivitas sepanjang hari', threshold: 'L' },
      { id: 77, text: 'Memiliki kesulitan untuk "memulai"', threshold: 'L' },
      { id: 78, text: 'Tampak lelah; memiliki energi yang sedikit', threshold: 'L' },
      { id: 79, text: 'Mempengaruhi emosional; sering tampak khawatir', threshold: 'L' },
      { id: 80, text: 'Memiliki tingkat aktivitas yang tinggi', threshold: 'H' },
      { id: 81, text: 'Selalu bergerak', threshold: 'H' },
      { id: 82, text: 'Tampak tidak pernah lelah', threshold: 'H' },
      { id: 83, text: 'Impulsif; kurang menunjukkan restraint', threshold: 'H' },
      { id: 84, text: 'Tidak dapat berhenti dirinya untuk berbicara atau bergerak', threshold: 'H' }
    ]
  },
  {
    id: 'J',
    title: 'J. Modulasi Gerakan yang Mempengaruhi Tingkat Aktivitas',
    questions: [
      { id: 85, text: 'Lambat untuk merespon', threshold: 'L' },
      { id: 86, text: 'Berhati-hati dengan gerakan atau bermain', threshold: 'L' },
      { id: 87, text: 'Mencari gerakan yang menenangkan (misalnya: goyang, memantul)', threshold: 'H' },
      { id: 88, text: 'Mencari gerakan yang memutar atau berputar', threshold: 'H' },
      { id: 89, text: 'Menikmati, atau mencari, gerakan yang cepat, intens, atau berputar', threshold: 'H' }
    ]
  },
  {
    id: 'K',
    title: 'K. Modulasi Input Sensoris yang Mempengaruhi Respon Emosional',
    questions: [
      { id: 90, text: 'Memiliki outburst emosional saat terlibat dalam aktivitas sehari-hari', threshold: 'L' },
      { id: 91, text: 'Memperlihatkan ekstrim distress emosional selama aktivitas perawatan sehari-hari', threshold: 'L' },
      { id: 92, text: 'Memerlukan perlindungan dari stimulasi sehari-hari', threshold: 'L' },
      { id: 93, text: 'Menangis dengan mudah', threshold: 'L' },
      { id: 94, text: 'Tidak merespon atau kurang merespon terhadap rangsangan yang menyakitkan (misalnya: suntikan, jatuh)', threshold: 'H' },
      { id: 95, text: 'Tidak merespon nama saat dipanggil tetapi pendengaran OK', threshold: 'H' },
      { id: 96, text: 'Tampak tidak sadar akan tangan atau kaki disentuh atau dipindahkan oleh orang lain', threshold: 'H' },
      { id: 97, text: 'Menunjukkan tidak ada reaksi terhadap suhu ekstrem', threshold: 'H' }
    ]
  },
  {
    id: 'L',
    title: 'L. Modulasi Input Visual yang Mempengaruhi Respon Emosional dan Tingkat Aktivitas',
    questions: [
      { id: 98, text: 'Bereaksi emosional atau agresif terhadap input visual yang tidak terduga', threshold: 'L' },
      { id: 99, text: 'Mencari objek, orang, atau aktivitas visual', threshold: 'H' },
      { id: 100, text: 'Terpesona dengan lampu atau gerakan yang berputar', threshold: 'H' },
      { id: 101, text: 'Menatap intensely pada objek atau orang', threshold: 'H' },
      { id: 102, text: 'Mencari visual stimulation', threshold: 'H' }
    ]
  },
  {
    id: 'M',
    title: 'M. Modulasi Input Pendengaran yang Mempengaruhi Respon Emosional dan Tingkat Aktivitas',
    questions: [
      { id: 103, text: 'Bereaksi emosional atau agresif terhadap suara yang tidak terduga atau keras', threshold: 'L' },
      { id: 104, text: 'Memegang tangan di atas telinga untuk melindungi telinga dari suara', threshold: 'L' },
      { id: 105, text: 'Mengalami overload emosional yang berkaitan dengan suara di lingkungan', threshold: 'L' },
      { id: 106, text: 'Mencari suara-suara keras, musik, atau kebisingan', threshold: 'H' },
      { id: 107, text: 'Membuat suara-suara ketika bosan atau stressed', threshold: 'H' }
    ]
  },
  {
    id: 'N',
    title: 'N. Item yang Menunjukkan Ambang Batas untuk Respons',
    questions: [
      { id: 108, text: 'Melompat dari satu aktivitas ke aktivitas lainnya sehingga mengganggu permainan', threshold: 'H' },
      { id: 109, text: 'Sengaja mencium benda', threshold: 'H' },
      { id: 110, text: 'Tampak tidak mencium bau-bauan yang kuat', threshold: 'H' },
      { id: 111, text: 'Tidak memperhatikan saat namanya dipanggil', threshold: 'H' },
      { id: 112, text: 'Mengabaikan atau lambat merespon instruksi verbal', threshold: 'H' },
      { id: 113, text: 'Tampak tidak menyadari saat orang lain berbicara kepadanya', threshold: 'H' },
      { id: 114, text: 'Fokus pada detail daripada gambaran umum', threshold: 'L' },
      { id: 115, text: 'Tidak menyadari bahwa tangannya kotor', threshold: 'H' },
      { id: 116, text: 'Makan dengan cara yang berantakan', threshold: 'H' },
      { id: 117, text: 'Tidak dapat merasakan makanan di wajah atau tangan saat makan', threshold: 'H' },
      { id: 118, text: 'Menabrak atau mendorong orang lain', threshold: 'H' },
      { id: 119, text: 'Tampak clumsy atau ceroboh', threshold: 'H' },
      { id: 120, text: 'Memiliki kesulitan mentolerir perubahan pada rutinitas', threshold: 'L' },
      { id: 121, text: 'Memiliki kesulitan mentolerir perubahan pada perencanaan dan harapan', threshold: 'L' },
      { id: 122, text: 'Memiliki kesulitan mentolerir perubahan dalam rutinitas', threshold: 'L' },
      { id: 123, text: 'Menunjukkan perilaku yang ekstrim atau emosional saat rutinitas berubah', threshold: 'L' },
      { id: 124, text: 'Perlu ritual tertentu untuk menyelesaikan tugas', threshold: 'L' },
      { id: 125, text: 'Menunjukkan perilaku pengulangan yang mengganggu aktivitas sehari-hari', threshold: 'L' }
    ]
  }
];

export default function SensoryProfile() {
  const { isAuthenticated } = useAuth();
  const [, params] = useRoute("/sensory-profile/:assessmentId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentPhase, setCurrentPhase] = useState<'instructions' | 'info' | 'assessment'>('instructions');
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [notApplicable, setNotApplicable] = useState<Record<number, boolean>>({});
  
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

  const assessmentId = params?.assessmentId ? parseInt(params.assessmentId) : null;

  const { data: userAssessment, isLoading } = useQuery<UserAssessmentWithDetails>({
    queryKey: [`/api/user-assessments/${assessmentId}`],
    enabled: !!assessmentId && isAuthenticated,
  });

  // Restore progress when assessment loads
  useEffect(() => {
    if (userAssessment?.results && userAssessment.status === 'in_progress') {
      const savedData = userAssessment.results as any;
      if (savedData.responses) setResponses(savedData.responses);
      if (savedData.participantInfo) setParticipantInfo(savedData.participantInfo);
      if (savedData.currentSection !== undefined) setCurrentSectionIndex(savedData.currentSection);
      if (savedData.notApplicable) setNotApplicable(savedData.notApplicable);
      if (savedData.comments) setComments(savedData.comments);
      
      // If participant info is filled and we have responses, go to assessment
      const hasParticipantInfo = savedData.participantInfo && Object.values(savedData.participantInfo).some((v: any) => v && v.toString().trim() !== '');
      const hasResponses = savedData.responses && Object.keys(savedData.responses).length > 0;
      
      if (hasParticipantInfo && hasResponses) {
        setCurrentPhase('assessment');
      } else if (hasParticipantInfo) {
        setCurrentPhase('assessment');
      } else {
        setCurrentPhase('info');
      }
    } else if (userAssessment?.status === 'available') {
      // For new assessments, always start with instructions
      setCurrentPhase('instructions');
    }
  }, [userAssessment]);

  const startAssessmentMutation = useMutation({
    mutationFn: async () => {
      if (!userAssessment) throw new Error("No assessment found");
      const response = await apiRequest("POST", `/api/user-assessments/${userAssessment.id}/start`);
      return response.json();
    },
    onSuccess: () => {
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

  // Debounced auto-save to prevent excessive API calls
  const saveProgressDebounced = useRef<NodeJS.Timeout>();
  const autoSaveProgress = (data: any) => {
    if (saveProgressDebounced.current) {
      clearTimeout(saveProgressDebounced.current);
    }
    saveProgressDebounced.current = setTimeout(() => {
      saveProgressMutation.mutate(data);
    }, 1000); // Wait 1 second before saving
  };

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

  const currentSection = sections[currentSectionIndex];
  const totalSections = sections.length;
  const progress = ((currentSectionIndex + 1) / totalSections) * 100;

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

  // Auto scroll to top when section changes
  useEffect(() => {
    if (currentPhase === 'assessment') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentSectionIndex, currentPhase]);

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

  // Instructions Phase
  if (currentPhase === 'instructions' && userAssessment.status === 'available') {
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
              Asesmen Sensory Profile
            </h1>
            <p className="text-lg text-neutral-600 dark:text-muted-foreground mb-6">
              Kuesioner bagi Orangtua/Pengasuh
            </p>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Instruksi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-neutral-600 dark:text-muted-foreground">
                Kuesioner ini dirancang untuk memberikan gambaran umum tentang respons anak terhadap pengalaman sensoris sehari-hari. 
                Silakan jawab setiap pertanyaan berdasarkan pengamatan Anda terhadap anak.
              </p>

              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Cara Mengisi:</h3>
                <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                  <li>• Jawab berdasarkan observasi perilaku anak selama 6 bulan terakhir</li>
                  <li>• Gunakan skala 1-5 untuk setiap pertanyaan</li>
                  <li>• Tandai "Tidak Berlaku" jika pertanyaan tidak relevan</li>
                  <li>• Berikan komentar tambahan jika diperlukan</li>
                </ul>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Catatan:</strong> Hak Cipta © 2024 oleh Rumah Psikologi Indonesia. 
                  Asesmen ini terdiri dari 125 pertanyaan yang dibagi dalam 14 bagian.
                </p>
              </div>

              <Button 
                size="lg" 
                onClick={() => {
                  startAssessmentMutation.mutate();
                  setCurrentPhase('info');
                }}
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

  // Information Collection Phase
  if (currentPhase === 'info') {
    const validateInfo = (): boolean => {
      const required = ['childName', 'childGender', 'parentName', 'relationship'];
      return required.every(field => participantInfo[field as keyof ParticipantInfo].trim() !== '');
    };

    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-background">
        <Header />
        
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-foreground mb-4">
              Informasi Anak dan Orangtua/Pengasuh
            </h1>
            <p className="text-neutral-600 dark:text-muted-foreground">
              Mohon lengkapi informasi berikut sebelum memulai asesmen
            </p>
          </div>

          <div className="space-y-8">
            {/* Child Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Informasi Anak
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="childName">Nama Anak *</Label>
                    <Input
                      id="childName"
                      value={participantInfo.childName}
                      onChange={(e) => setParticipantInfo(prev => ({...prev, childName: e.target.value}))}
                      placeholder="Masukkan nama lengkap anak"
                    />
                  </div>

                  <div>
                    <Label htmlFor="childBirthDate">Tanggal Lahir</Label>
                    <Input
                      id="childBirthDate"
                      type="date"
                      value={participantInfo.childBirthDate}
                      onChange={(e) => setParticipantInfo(prev => ({...prev, childBirthDate: e.target.value}))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="childGender">Jenis Kelamin *</Label>
                    <Select value={participantInfo.childGender} onValueChange={(value) => setParticipantInfo(prev => ({...prev, childGender: value}))}>
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
              </CardContent>
            </Card>

            {/* Parent Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Informasi Orangtua/Pengasuh
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="parentName">Nama Orangtua/Pengasuh *</Label>
                    <Input
                      id="parentName"
                      value={participantInfo.parentName}
                      onChange={(e) => setParticipantInfo(prev => ({...prev, parentName: e.target.value}))}
                      placeholder="Masukkan nama lengkap"
                    />
                  </div>
                  <div>
                    <Label htmlFor="relationship">Hubungan dengan Anak *</Label>
                    <Select value={participantInfo.relationship} onValueChange={(value) => setParticipantInfo(prev => ({...prev, relationship: value}))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih hubungan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ibu">Ibu</SelectItem>
                        <SelectItem value="ayah">Ayah</SelectItem>
                        <SelectItem value="kakek">Kakek</SelectItem>
                        <SelectItem value="nenek">Nenek</SelectItem>
                        <SelectItem value="pengasuh">Pengasuh</SelectItem>
                        <SelectItem value="lainnya">Lainnya</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentPhase('instructions')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Kembali
              </Button>
              <Button onClick={() => {
                if (!validateInfo()) {
                  toast({
                    title: "Informasi Tidak Lengkap",
                    description: "Mohon lengkapi informasi yang wajib diisi.",
                    variant: "destructive",
                  });
                  return;
                }
                setCurrentPhase('assessment');
              }}>
                Lanjut ke Asesmen
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  // Assessment Phase
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-foreground">
              {currentSection?.title}
            </h1>
            <span className="text-sm text-neutral-500 dark:text-muted-foreground">
              Bagian {currentSectionIndex + 1} dari {totalSections}
            </span>
          </div>
          <Progress value={progress} className="mb-4" />
        </div>

        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="space-y-6">
              {currentSection?.questions.map((question) => {
                const questionResponse = responses[question.id];
                const isNotApplicable = notApplicable[question.id];
                
                return (
                  <div key={question.id} className="space-y-3">
                    <h3 className="font-medium text-neutral-900 dark:text-foreground">
                      {question.id}. {question.text}
                    </h3>
                    
                    <RadioGroup
                      value={questionResponse || ""}
                      onValueChange={(value) => {
                        const newResponses = {...responses, [question.id]: value};
                        setResponses(newResponses);
                        
                        let newNotApplicable = notApplicable;
                        if (notApplicable[question.id]) {
                          newNotApplicable = {...notApplicable, [question.id]: false};
                          setNotApplicable(newNotApplicable);
                        }
                        
                        // Auto-save progress with debounce
                        autoSaveProgress({
                          responses: newResponses,
                          participantInfo,
                          currentSection: currentSectionIndex,
                          notApplicable: newNotApplicable,
                          comments
                        });
                      }}
                      disabled={isNotApplicable}
                      className="grid grid-cols-5 gap-4"
                    >
                      {[
                        { value: "1", label: "Tidak Pernah" },
                        { value: "2", label: "Jarang" },
                        { value: "3", label: "Kadang-kadang" },
                        { value: "4", label: "Sering" },
                        { value: "5", label: "Selalu" }
                      ].map((option) => (
                        <div key={option.value} className="flex flex-col items-center space-y-2">
                          <RadioGroupItem 
                            value={option.value} 
                            id={`q${question.id}-${option.value}`}
                            disabled={isNotApplicable}
                          />
                          <Label 
                            htmlFor={`q${question.id}-${option.value}`} 
                            className="text-xs text-center cursor-pointer"
                          >
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>

                    <div className="flex items-center space-x-2 mt-2">
                      <input
                        type="checkbox"
                        id={`na-${question.id}`}
                        checked={isNotApplicable || false}
                        onChange={(e) => {
                          const newNotApplicable = {...notApplicable, [question.id]: e.target.checked};
                          setNotApplicable(newNotApplicable);
                          
                          let newResponses = responses;
                          if (e.target.checked && responses[question.id]) {
                            newResponses = { ...responses };
                            delete newResponses[question.id];
                            setResponses(newResponses);
                          }
                          
                          // Auto-save progress with debounce
                          autoSaveProgress({
                            responses: newResponses,
                            participantInfo,
                            currentSection: currentSectionIndex,
                            notApplicable: newNotApplicable,
                            comments
                          });
                        }}
                        className="w-4 h-4"
                      />
                      <Label htmlFor={`na-${question.id}`} className="text-sm text-neutral-500 dark:text-muted-foreground">
                        Tidak Berlaku
                      </Label>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => {
              if (currentSectionIndex > 0) {
                setCurrentSectionIndex(prev => prev - 1);
                // Auto-scroll to top after moving to previous section
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            disabled={currentSectionIndex === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Sebelumnya
          </Button>
          
          <Button
            onClick={() => {
              // Validate all questions in current section are answered
              const currentSectionQuestions = sections[currentSectionIndex].questions;
              const unansweredQuestions = currentSectionQuestions.filter(q => 
                !responses[q.id] && !notApplicable[q.id]
              );

              if (unansweredQuestions.length > 0) {
                toast({
                  title: "Pertanyaan Belum Lengkap",
                  description: `Silakan jawab ${unansweredQuestions.length} pertanyaan yang belum dijawab di bagian ini.`,
                  variant: "destructive",
                });
                return;
              }

              if (currentSectionIndex < totalSections - 1) {
                setCurrentSectionIndex(prev => prev + 1);
                // Auto-scroll to top after moving to next section
                window.scrollTo({ top: 0, behavior: 'smooth' });
              } else {
                // Calculate section scores
                const sectionScores: Record<string, number> = {};
                sections.forEach(section => {
                  const sectionResponses = section.questions
                    .filter(q => responses[q.id] && !notApplicable[q.id])
                    .map(q => parseInt(responses[q.id]));
                  
                  if (sectionResponses.length > 0) {
                    sectionScores[section.id] = sectionResponses.reduce((sum, score) => sum + score, 0);
                  }
                });

                const totalScore = Object.values(sectionScores).reduce((sum, score) => sum + score, 0);
                
                // Generate interpretation based on scores
                const getInterpretation = (score: number) => {
                  if (score <= 142) return "Sensitivitas Rendah - Memerlukan input sensoris yang lebih intens";
                  if (score <= 169) return "Sensitivitas Sedang Rendah - Beberapa area memerlukan perhatian";
                  if (score <= 183) return "Sensitivitas Normal - Respons sensoris dalam batas normal";
                  if (score <= 215) return "Sensitivitas Sedang Tinggi - Menunjukkan beberapa sensitivitas";
                  return "Sensitivitas Tinggi - Sangat sensitif terhadap input sensoris";
                };

                const results = {
                  participantInfo,
                  responses,
                  comments,
                  notApplicable,
                  sectionScores,
                  totalScore,
                  interpretation: getInterpretation(totalScore),
                  completionDate: new Date().toISOString()
                };
                completeAssessmentMutation.mutate(results);
              }
            }}
            disabled={completeAssessmentMutation.isPending}
          >
            {currentSectionIndex === totalSections - 1 ? (
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