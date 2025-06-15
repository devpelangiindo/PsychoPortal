import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, FileText, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  parentName: string;
  relationship: string;
  testDate: string;
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
      { id: 14, text: 'Terganggu oleh cahaya terang setelah orang lain beradaptasi dengan cahaya itu', threshold: 'L' },
      { id: 15, text: 'Menutupi mata atau juling untuk melindungi mata dari cahaya', threshold: 'L' },
      { id: 16, text: 'Melihat dengan hati-hati atau intens pada objek/orang (misalnya: tatapan)', threshold: 'H' },
      { id: 17, text: 'Sulit menemukan objek di latar belakang yang \'kacau\' (misalnya: sepatu di ruangan yang berantakan, mainan favorit di dalam "kotak barang-barang bekas")', threshold: 'H' }
    ]
  },
  {
    id: 'C',
    title: 'C. Pemrosesan Vestibular',
    questions: [
      { id: 18, text: 'Menjadi cemas atau tertekan saat kaki beranjak dari tanah', threshold: 'L' },
      { id: 19, text: 'Tidak menyukai aktivitas kepala terbalik (misalnya: jungkir balik, gerakan fisik yang aktif seperti bergulat, melompat diatas sofa)', threshold: 'L' },
      { id: 20, text: 'Menghindari peralatan yang ada di taman bermain atau mainan yang bergerak (misalnya: ayunan, komidi putar)', threshold: 'L' },
      { id: 21, text: 'Tidak suka mengendarai mobil', threshold: 'L' },
      { id: 22, text: 'Menahan kepala tegak, bahkan saat membungkuk atau bersandar (misalnya: mempertahankan posisi/postur kaku selama aktivitas)', threshold: 'L' },
      { id: 23, text: 'Menjadi bingung setelah membungkuk di wastafel atau meja (misalnya: jatuh atau pusing)', threshold: 'L' },
      { id: 24, text: 'Mencari segala macam gerakan yang mengganggu rutinitas sehari-hari (misalnya : tidak bisa duduk diam, gelisah)', threshold: 'H' },
      { id: 25, text: 'Mencari semua jenis aktivitas gerakan (misalnya: diputar oleh orang dewasa, komidi putar, peralatan bermain, mainan yang bergerak)', threshold: 'H' },
      { id: 26, text: 'Sering berputar-putar sendiri sepanjang hari (misalnya: jadi suka merasa pusing)', threshold: 'H' },
      { id: 27, text: 'Bergoyang secara tidak sadar (misalnya: saat menonton TV)', threshold: 'H' },
      { id: 28, text: 'Bergoyang di meja/kursi/lantai', threshold: 'H' }
    ]
  },
  {
    id: 'D',
    title: 'D. Pemrosesan Sentuhan',
    questions: [
      { id: 29, text: 'Menghindari "berantakan" (misalnya: di pasta, pasir, cat jari, lem, selotip)', threshold: 'L' },
      { id: 30, text: 'Mengekspresikan "kesusahan" saat melakukan kegiatan harian seperti berkelahi atau menangis saat potong rambut, mencuci muka, memotong kuku', threshold: 'L' },
      { id: 31, text: 'Lebih suka pakaian lengan panjang saat hangat atau lengan pendek saat cuaca dingin', threshold: 'L' },
      { id: 32, text: 'Menyatakan ketidaknyamanan pada perawatan gigi atau menyikat gigi (misalnya: menangis atau berkelahi)', threshold: 'L' },
      { id: 33, text: 'Peka terhadap kain tertentu (misalnya: khusus tentang pakaian atau seprai tertentu)', threshold: 'L' },
      { id: 34, text: 'Teriritasi oleh sepatu atau kaus kaki', threshold: 'L' },
      { id: 35, text: 'Menghindari bertelanjang kaki, terutama di pasir atau rumput', threshold: 'L' },
      { id: 36, text: 'Bereaksi secara emosional atau agresif terhadap sentuhan', threshold: 'L' },
      { id: 37, text: 'Menarik diri dari percikan air', threshold: 'L' },
      { id: 38, text: 'Mengalami kesulitan berdiri dalam antrean atau dekat dengan orang lain', threshold: 'L' },
      { id: 39, text: 'Menggosok atau menggores tempat yang telah disentuh', threshold: 'L' },
      { id: 40, text: 'Menyentuh orang dan benda hingga membuat orang lain kesal', threshold: 'H' },
      { id: 41, text: 'Menampilkan kebutuhan yang tidak biasa untuk menyentuh mainan, permukaan, atau tekstur tertentu (misalnya: terus-menerus menyentuh benda-benda)', threshold: 'H' },
      { id: 42, text: 'Penurunan kesadaran akan rasa sakit dan suhu', threshold: 'H' },
      { id: 43, text: 'Tidak menyadari saat seseorang menyentuh lengan atau punggungnya', threshold: 'H' },
      { id: 44, text: 'Menghindari memakai sepatu; suka bertelanjang kaki', threshold: 'H' },
      { id: 45, text: 'Menyentuh orang dan benda', threshold: 'H' },
      { id: 46, text: 'Sepertinya tidak memperhatikan saat wajah atau tangannya berantakan', threshold: 'H' }
    ]
  },
  {
    id: 'E',
    title: 'E. Pemrosesan Multisensori',
    questions: [
      { id: 47, text: 'Tersesat dengan mudah (bahkan di tempat yang familiar)' },
      { id: 48, text: 'Memiliki kesulitan memperhatikan sesuatu' },
      { id: 49, text: 'Berpaling dari tugas untuk memperhatikan semua tindakan di dalam ruangan', threshold: 'L' },
      { id: 50, text: 'Tampak tidak sadar dalam lingkungan yang aktif (misalnya: tidak menyadari aktivitas)', threshold: 'H' },
      { id: 51, text: 'Berpegangan pada orang, furnitur, atau objek bahkan dalam situasi yang biasa', threshold: 'H' },
      { id: 52, text: 'Berjalan dengan jari kaki/berjinjit', threshold: 'H' },
      { id: 53, text: 'Menanggalkan pakaian yang membelit di tubuh', threshold: 'H' }
    ]
  },
  {
    id: 'F',
    title: 'F. Pengolahan Sensorik Oral',
    questions: [
      { id: 54, text: 'Mudah muntah dengan tekstur makanan atau peralatan makanan di mulut', threshold: 'L' },
      { id: 55, text: 'Menghindari rasa atau bau makanan tertentu yang biasanya menjadi bagian dari makanan anak-anak', threshold: 'L' },
      { id: 56, text: 'Hanya akan memakan menu tertentu', threshold: 'L' },
      { id: 57, text: 'Membatasi diri pada tekstur/suhu makanan tertentu', threshold: 'L' },
      { id: 58, text: 'Pemilih makanan, terutama soal tekstur makanan', threshold: 'L' },
      { id: 59, text: 'Secara rutin mencium bau benda yang bukan makanan', threshold: 'H' },
      { id: 60, text: 'Menunjukkan pilihan yang kuat untuk bau tertentu', threshold: 'H' },
      { id: 61, text: 'Menunjukkan pilihan yang kuat untuk menu tertentu', threshold: 'H' },
      { id: 62, text: 'Mengidam makanan tertentu', threshold: 'H' },
      { id: 63, text: 'Mencari rasa atau bau tertentu', threshold: 'H' },
      { id: 64, text: 'Mengunyah atau menjilat benda yang bukan makanan', threshold: 'H' },
      { id: 65, text: 'Suka memasukkan benda ke dalam mulut (misalnya: pensil, tangan)', threshold: 'H' }
    ]
  },
  {
    id: 'G',
    title: 'G. Pemrosesan Sensorik Terkait Daya Tahan/Keselarasan',
    questions: [
      { id: 66, text: 'Bergerak dengan kaku' },
      { id: 67, text: 'Mudah lelah, terutama saat berdiri atau menopang posisi tubuh tertentu', threshold: 'H' },
      { id: 68, text: 'Mengunci sendi (misalnya: siku, lutut) untuk stabilitas', threshold: 'H' },
      { id: 69, text: 'Tampaknya memiliki otot yang lemah', threshold: 'H' },
      { id: 70, text: 'Memiliki genggaman yang lemah', threshold: 'H' },
      { id: 71, text: 'Tidak dapat mengangkat benda berat (misalnya: lemah dibandingkan dengan anak seusianya)', threshold: 'H' },
      { id: 72, text: 'Butuh alat untuk menopang diri (bahkan selama aktivitas)', threshold: 'H' },
      { id: 73, text: 'Daya tahan yang buruk/mudah lelah', threshold: 'H' },
      { id: 74, text: 'Tampak lesu (misalnya: tidak bertenaga, lesu)', threshold: 'H' }
    ]
  },
  {
    id: 'H',
    title: 'H. Modulasi Berkaitan dengan Posisi dan Gerakan Tubuh',
    questions: [
      { id: 75, text: 'Rawan kecelakaan' },
      { id: 76, text: 'Ragu-ragu naik atau turun trotoar atau tangga (misalnya: hati-hati, berhenti sebelum bergerak)' },
      { id: 77, text: 'Takut jatuh atau takut ketinggian', threshold: 'L' },
      { id: 78, text: 'Menghindari untuk memanjat/melompat atau menghindari tanah bergelombang/tidak rata', threshold: 'L' },
      { id: 79, text: 'Memegang dinding atau pegangan tangga (misalnya: menempel)', threshold: 'L' },
      { id: 80, text: 'Mengambil risiko berlebihan saat bermain (misalnya: memanjat pohon tinggi, melompat dari furnitur yang tinggi)', threshold: 'H' },
      { id: 81, text: 'Mengambil risiko gerakan atau memanjat yang membahayakan keselamatan pribadi selama bermain', threshold: 'H' },
      { id: 82, text: 'Membalikkan seluruh tubuhnya untuk melihat Anda', threshold: 'H' },
      { id: 83, text: 'Mencari peluang untuk jatuh tanpa memperhatikan keselamatan pribadi', threshold: 'H' },
      { id: 84, text: 'Tampaknya menikmati untuk jatuh', threshold: 'H' }
    ]
  },
  {
    id: 'I',
    title: 'I. Modulasi Gerakan yang Mempengaruhi Tingkat Aktivitas',
    questions: [
      { id: 85, text: 'Menghabiskan sebagian besar harinya dalam permainan yang tidak banyak bergerak (misalnya: melakukan hal-hal yang tenang)', threshold: 'L' },
      { id: 86, text: 'Lebih suka permainan yang tenang dan tidak banyak bergerak (misalnya: menonton TV, buku, komputer)', threshold: 'L' },
      { id: 87, text: 'Mencari opsi bermain yang tidak banyak bergerak', threshold: 'L' },
      { id: 88, text: 'Lebih suka aktivitas menetap/tidak banyak bergerak', threshold: 'L' },
      { id: 89, text: 'Menjadi terlalu bersemangat selama aktivitas gerakan', threshold: 'H' },
      { id: 90, text: '"Serba bergerak"', threshold: 'H' },
      { id: 91, text: 'Menghindari aktivitas bermain yang tenang', threshold: 'H' }
    ]
  },
  {
    id: 'J',
    title: 'J. Modulasi Input Sensorik yang Mempengaruhi Respon Emosional',
    questions: [
      { id: 92, text: 'Membutuhkan lebih banyak perlindungan dari kehidupan, dibandingkan anak-anak lain (misalnya: tidak berdaya secara fisik atau emosional)' },
      { id: 93, text: 'Ritual/kebiasaan yang kaku dalam hal kebersihan pribadi', threshold: 'L' },
      { id: 94, text: 'Terlalu sayang/penuh kasih sayang dengan orang lain', threshold: 'H' },
      { id: 95, text: 'Tidak menyadari bahasa tubuh atau ekspresi wajah (misalnya: tidak dapat menafsirkan)', threshold: 'H' }
    ]
  },
  {
    id: 'K',
    title: 'K. Modulasi Input Visual yang Mempengaruhi Respon Emosional dan Tingkat Aktivitas',
    questions: [
      { id: 96, text: 'Menghindari kontak mata', threshold: 'L' },
      { id: 97, text: 'Menatap objek atau orang secara intens', threshold: 'H' },
      { id: 98, text: 'Memperhatikan setiap orang yang bergerak di sekitar ruangan', threshold: 'H' },
      { id: 99, text: 'Tidak memperhatikan ketika orang masuk ke ruangan', threshold: 'H' }
    ]
  },
  {
    id: 'L',
    title: 'L. Respon Emosional/Sosial',
    questions: [
      { id: 100, text: 'Tampaknya mengalami kesulitan menyukai diri sendiri (misalnya: harga diri rendah)' },
      { id: 101, text: 'Mengalami kesulitan "bertumbuh" (misalnya: bereaksi tidak dewasa terhadap situasi)' },
      { id: 102, text: 'Peka terhadap kritik' },
      { id: 103, text: 'Memiliki ketakutan tertentu (misalnya: ketakutan dapat diprediksi)' },
      { id: 104, text: 'Terlihat cemas' },
      { id: 105, text: 'Menunjukkan ledakan emosi yang berlebihan saat tidak berhasil dalam suatu tugas' },
      { id: 106, text: 'Mengungkapkan perasaan gagal' },
      { id: 107, text: 'Keras kepala atau tidak kooperatif' },
      { id: 108, text: 'Memiliki amarah' },
      { id: 109, text: 'Toleransi frustrasi yang buruk' },
      { id: 110, text: 'Mudah menangis' },
      { id: 111, text: 'Terlalu serius' },
      { id: 112, text: 'Sulit berteman (misalnya: tidak berinteraksi atau berpartisipasi dalam permainan kelompok)' },
      { id: 113, text: 'Mengalami mimpi buruk' },
      { id: 114, text: 'Memiliki masalah tidur' }
    ]
  },
  {
    id: 'M',
    title: 'M. Hasil Pemrosesan Sensorik',
    questions: [
      { id: 115, text: 'Tampak tidak termotivasi' },
      { id: 116, text: 'Tampak lemas atau tidak bertenaga (tidak seperti anak seusianya)' },
      { id: 117, text: 'Impulsif' },
      { id: 118, text: 'Tidak bisa menunggu; butuh kepuasan segera' },
      { id: 119, text: 'Kesulitan memulai suatu aktivitas' },
      { id: 120, text: 'Frustrasi dengan mudah' },
      { id: 121, text: 'Sulit untuk menenangkan/menghibur diri' },
      { id: 122, text: 'Miskin perhatian/konsentrasi' },
      { id: 123, text: 'Tidak dapat tinggal dalam tugas untuk menyelesaikan/mengakhirinya' },
      { id: 124, text: 'Tidak memperhatikan detail dalam tugas (misalnya: membuat kesalahan yang ceroboh)' },
      { id: 125, text: 'Cenderung tidak berprestasi secara akademis' }
    ]
  }
];

export default function SensoryProfile() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/sensory-profile/:assessmentId");
  const { user } = useAuth();
  const { toast } = useToast();
  const topRef = useRef<HTMLDivElement>(null);
  
  // Assessment state
  const [currentStep, setCurrentStep] = useState<'instructions' | 'participant-info' | 'questions'>('instructions');
  const [currentPage, setCurrentPage] = useState(0);
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [notApplicable, setNotApplicable] = useState<Record<number, boolean>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  
  // Participant info state
  const [participantInfo, setParticipantInfo] = useState<ParticipantInfo>({
    childName: '',
    childBirthDate: '',
    parentName: '',
    relationship: '',
    testDate: new Date().toISOString().split('T')[0]
  });

  const [userAssessment, setUserAssessment] = useState<UserAssessmentWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showValidationAlert, setShowValidationAlert] = useState(false);

  // Get all questions
  const allQuestions = sections.flatMap(section => 
    section.questions.map(q => ({ ...q, sectionId: section.id, sectionTitle: section.title }))
  );

  // Pagination logic - 10 questions per page
  const questionsPerPage = 10;
  const totalPages = Math.ceil(allQuestions.length / questionsPerPage);
  const currentPageQuestions = allQuestions.slice(
    currentPage * questionsPerPage, 
    (currentPage + 1) * questionsPerPage
  );

  // Get current section for page subtitle
  const currentPageSection = currentPageQuestions.length > 0 ? currentPageQuestions[0].sectionTitle : '';

  // Calculate progress
  const answeredQuestions = Object.keys(responses).length;
  const totalQuestions = allQuestions.length;
  const progress = (answeredQuestions / totalQuestions) * 100;

  // Auto-save functionality with debouncing
  const saveProgressMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!userAssessment?.id) return null;
      const response = await fetch(`/api/user-assessments/${userAssessment.id}/save-progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await response.json();
    }
  });

  // Auto-save when responses change
  useEffect(() => {
    if (currentStep === 'questions' && userAssessment?.id) {
      const saveTimer = setTimeout(() => {
        saveProgressMutation.mutate({
          responses,
          notApplicable,
          comments,
          participantInfo,
          currentPage,
          currentStep
        });
      }, 1000); // Save after 1 second of inactivity

      return () => clearTimeout(saveTimer);
    }
  }, [responses, notApplicable, comments, participantInfo, currentPage, currentStep]);

  const completeMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!userAssessment?.id) return null;
      const response = await fetch(`/api/user-assessments/${userAssessment.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await response.json();
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
      if (!user || !params?.assessmentId) return;
      
      try {
        const userAssessmentId = parseInt(params.assessmentId);
        const response = await fetch(`/api/user-assessments/${userAssessmentId}`);
        const data = await response.json();
        setUserAssessment(data);
        
        // Load existing progress if any
        if (data.results) {
          setResponses(data.results.responses || {});
          setNotApplicable(data.results.notApplicable || {});
          setComments(data.results.comments || {});
          setParticipantInfo(data.results.participantInfo || participantInfo);
          setCurrentPage(data.results.currentPage || 0);
          
          // If assessment is completed, redirect to results
          if (data.status === 'completed') {
            navigate("/assessment-results");
            return;
          }
          
          // If participant info is filled, go to questions
          if (data.results.participantInfo?.childName) {
            setCurrentStep('questions');
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
  }, [user, params, navigate, toast, participantInfo]);

  // Auto-save when responses change
  useEffect(() => {
    if (!userAssessment || isLoading) return;
    
    const saveData = {
      responses,
      notApplicable,
      comments,
      participantInfo,
      currentPage
    };
    
    saveProgressMutation.mutate(saveData);
  }, [responses, notApplicable, comments, participantInfo, currentPage]);

  // Validation functions
  const validateParticipantInfo = () => {
    const errors: Record<string, string> = {};
    
    if (!participantInfo.childName.trim()) {
      errors.childName = "Nama anak harus diisi";
    }
    if (!participantInfo.childBirthDate) {
      errors.childBirthDate = "Tanggal lahir anak harus diisi";
    }
    if (!participantInfo.parentName.trim()) {
      errors.parentName = "Nama orangtua/pengasuh harus diisi";
    }
    if (!participantInfo.relationship.trim()) {
      errors.relationship = "Hubungan dengan anak harus dipilih";
    }
    if (!participantInfo.testDate) {
      errors.testDate = "Tanggal tes harus diisi";
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateCurrentPageQuestions = () => {
    const unansweredQuestions: number[] = [];
    
    currentPageQuestions.forEach(question => {
      const hasResponse = responses[question.id] || notApplicable[question.id];
      if (!hasResponse) {
        unansweredQuestions.push(question.id);
      }
    });
    
    if (unansweredQuestions.length > 0) {
      setShowValidationAlert(true);
      setTimeout(() => setShowValidationAlert(false), 5000);
      return false;
    }
    
    setShowValidationAlert(false);
    return true;
  };

  // Scroll to top function
  const scrollToTop = () => {
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

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
    
    // Determine interpretation based on total score
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

  const isAllQuestionsAnswered = () => {
    return allQuestions.every(q => responses[q.id] || notApplicable[q.id]);
  };

  const handleComplete = () => {
    const results = calculateResults();
    completeMutation.mutate({
      responses,
      notApplicable,
      comments,
      participantInfo,
      results
    });
  };

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
              <CardTitle className="text-center text-xl font-bold">
                Asesmen Profil Sensoris
              </CardTitle>
              <p className="text-center text-lg font-semibold mt-4">Kuesioner bagi Orangtua/Pengasuh</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
                <h3 className="text-lg font-semibold mb-4 text-center">
                  INSTRUKSI
                </h3>
                <div className="space-y-4 text-gray-700 dark:text-gray-300">
                  <p>
                    Silakan mencentang kotak yang paling menggambarkan frekuensi perilaku yang 
                    dilakukan anak Anda seperti pada keterangan di bawah ini. Tolong jawab semua 
                    pernyataan. Jika Anda tidak dapat memberi komentar karena Anda tidak mengamati 
                    perilaku tersebut atau percaya bahwa perilaku yang dimaksud itu tidak berlaku 
                    untuk anak Anda, maka silakan beri tanda X pada nomor untuk item tersebut. Tulis 
                    komentar apa pun di akhir setiap bagian. Harap jangan menulis pada baris Total 
                    Bagian Skor Mentah.
                  </p>
                  <p className="font-semibold">Gunakan kata kunci berikut untuk menandai tanggapan Anda:</p>
                  
                  <div className="space-y-3 ml-4">
                    <div>
                      <p className="font-semibold">SELALU</p>
                      <p className="text-sm ml-4">Saat diberi kesempatan, anak Anda selalu merespons dengan cara ini, 100% setiap saat.</p>
                    </div>
                    <div>
                      <p className="font-semibold">SERING</p>
                      <p className="text-sm ml-4">Saat diberi kesempatan, anak Anda sering merespons dengan cara ini, sekitar 75% dari rutinas kesehariannya.</p>
                    </div>
                    <div>
                      <p className="font-semibold">KADANG-KADANG</p>
                      <p className="text-sm ml-4">Saat diberi kesempatan, anak Anda terkadang merespons dengan cara ini, sekitar 50% dari rutinas kesehariannya.</p>
                    </div>
                    <div>
                      <p className="font-semibold">JARANG</p>
                      <p className="text-sm ml-4">Saat diberi kesempatan, anak Anda jarang merespons dengan cara ini, sekitar 25% dari rutinas kesehariannya.</p>
                    </div>
                    <div>
                      <p className="font-semibold">TIDAK PERNAH</p>
                      <p className="text-sm ml-4">Saat diberi kesempatan, anak Anda tidak pernah merespons dengan cara ini, 0% dari rutinas kesehariannya.</p>
                    </div>
                  </div>
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
              <CardTitle>Informasi Partisipan</CardTitle>
              <p className="text-gray-600 dark:text-gray-400">
                Silakan lengkapi informasi berikut sebelum memulai asesmen.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="childName">Nama Anak:</Label>
                  <Input
                    id="childName"
                    value={participantInfo.childName}
                    onChange={(e) => setParticipantInfo(prev => ({ ...prev, childName: e.target.value }))}
                    placeholder="Masukkan nama anak"
                    className={validationErrors.childName ? "border-red-500" : ""}
                    required
                  />
                  {validationErrors.childName && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.childName}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="childBirthDate">Tanggal Lahir Anak:</Label>
                  <Input
                    id="childBirthDate"
                    type="date"
                    value={participantInfo.childBirthDate}
                    onChange={(e) => setParticipantInfo(prev => ({ ...prev, childBirthDate: e.target.value }))}
                    className={validationErrors.childBirthDate ? "border-red-500" : ""}
                    required
                  />
                  {validationErrors.childBirthDate && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.childBirthDate}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="parentName">Nama Orangtua/Pengasuh:</Label>
                  <Input
                    id="parentName"
                    value={participantInfo.parentName}
                    onChange={(e) => setParticipantInfo(prev => ({ ...prev, parentName: e.target.value }))}
                    placeholder="Masukkan nama orangtua/pengasuh"
                    className={validationErrors.parentName ? "border-red-500" : ""}
                    required
                  />
                  {validationErrors.parentName && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.parentName}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="relationship">Hubungan dengan Anak:</Label>
                  <Select 
                    value={participantInfo.relationship} 
                    onValueChange={(value) => setParticipantInfo(prev => ({ ...prev, relationship: value }))}
                  >
                    <SelectTrigger className={validationErrors.relationship ? "border-red-500" : ""}>
                      <SelectValue placeholder="Pilih hubungan dengan anak" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ibu">Ibu</SelectItem>
                      <SelectItem value="Ayah">Ayah</SelectItem>
                      <SelectItem value="Pengasuh">Pengasuh</SelectItem>
                      <SelectItem value="Nenek">Nenek</SelectItem>
                      <SelectItem value="Kakek">Kakek</SelectItem>
                      <SelectItem value="Bibi">Bibi</SelectItem>
                      <SelectItem value="Paman">Paman</SelectItem>
                      <SelectItem value="Kakak">Kakak</SelectItem>
                      <SelectItem value="Adik">Adik</SelectItem>
                      <SelectItem value="Wali">Wali</SelectItem>
                      <SelectItem value="Lainnya">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                  {validationErrors.relationship && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.relationship}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="testDate">Tanggal Tes:</Label>
                  <Input
                    id="testDate"
                    type="date"
                    value={participantInfo.testDate}
                    onChange={(e) => setParticipantInfo(prev => ({ ...prev, testDate: e.target.value }))}
                    className={validationErrors.testDate ? "border-red-500" : ""}
                  />
                  {validationErrors.testDate && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.testDate}</p>
                  )}
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
                  onClick={() => {
                    if (validateParticipantInfo()) {
                      setCurrentStep('questions');
                    }
                  }}
                >
                  Mulai Asesmen
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Questions Step */}
        {currentStep === 'questions' && (
          <div ref={topRef} className="space-y-6">
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
                <div className="flex justify-between items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>Halaman {currentPage + 1} dari {totalPages}</span>
                  <span>{currentPageSection}</span>
                </div>
              </CardContent>
            </Card>

            {/* Current Page Questions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-center">
                  {currentPageSection}
                </CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  Halaman {currentPage + 1} dari {totalPages}
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {showValidationAlert && (
                  <Alert className="border-red-500 bg-red-50 dark:bg-red-900/20">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <AlertDescription className="text-red-700 dark:text-red-300">
                      Mohon jawab semua pertanyaan di halaman ini sebelum melanjutkan ke halaman berikutnya.
                    </AlertDescription>
                  </Alert>
                )}
                {currentPageQuestions.map((question, index) => {
                  const hasAnswer = responses[question.id] || notApplicable[question.id];
                  const isAnswered = Boolean(hasAnswer);
                  
                  return (
                    <div key={question.id} className={`border-2 rounded-lg p-6 transition-all duration-200 ${
                      isAnswered 
                        ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' 
                        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 hover:border-green-300 dark:hover:border-green-700'
                    }`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              isAnswered 
                                ? 'bg-green-500 text-white' 
                                : 'bg-gray-300 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                            }`}>
                              {isAnswered ? '✓' : (currentPage * questionsPerPage) + index + 1}
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Item {question.id} - Pertanyaan {(currentPage * questionsPerPage) + index + 1} dari {totalQuestions}
                            </p>
                          </div>
                          <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                            <p className="text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
                              {question.text}
                            </p>
                          </div>
                        </div>
                        {question.threshold && (
                          <span className="ml-4 px-3 py-1 bg-blue-100 dark:bg-blue-800 rounded-full text-xs font-medium text-blue-700 dark:text-blue-300">
                            {question.threshold}
                          </span>
                        )}
                      </div>

                      {/* Response Options */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Pilih frekuensi yang paling sesuai:</p>
                        <RadioGroup
                          value={responses[question.id] || ''}
                          onValueChange={(value) => handleResponseChange(question.id, value)}
                          className="space-y-2"
                        >
                          {[
                            { value: "5", label: "SELALU", desc: "100% dari waktu", color: "bg-red-500" },
                            { value: "4", label: "SERING", desc: "75% dari waktu", color: "bg-orange-500" },
                            { value: "3", label: "KADANG-KADANG", desc: "50% dari waktu", color: "bg-yellow-500" },
                            { value: "2", label: "JARANG", desc: "25% dari waktu", color: "bg-blue-500" },
                            { value: "1", label: "TIDAK PERNAH", desc: "0% dari waktu", color: "bg-green-500" }
                          ].map((option) => (
                            <div key={option.value} className={`flex items-center space-x-3 p-3 rounded-lg border-2 transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                              responses[question.id] === option.value 
                                ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                                : 'border-gray-200 dark:border-gray-600'
                            }`}>
                              <RadioGroupItem value={option.value} id={`q${question.id}_option${option.value}`} />
                              <div className={`w-3 h-3 rounded-full ${option.color}`}></div>
                              <Label htmlFor={`q${question.id}_option${option.value}`} className="flex-1 cursor-pointer">
                                <span className="font-semibold text-gray-800 dark:text-gray-200">{option.label}</span>
                                <span className="text-gray-600 dark:text-gray-400 ml-2">({option.desc})</span>
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>

                        {/* Not Applicable Option */}
                        <div className="border-t-2 border-dashed border-gray-300 dark:border-gray-600 pt-4 mt-4">
                          <div className={`flex items-center space-x-3 p-3 rounded-lg border-2 transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                            notApplicable[question.id] 
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                              : 'border-gray-200 dark:border-gray-600'
                          }`}>
                            <input
                              type="checkbox"
                              id={`q${question.id}_notApplicable`}
                              checked={notApplicable[question.id] || false}
                              onChange={(e) => handleNotApplicableChange(question.id, e.target.checked)}
                              className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 dark:focus:ring-purple-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                            />
                            <Label htmlFor={`q${question.id}_notApplicable`} className="text-gray-700 dark:text-gray-300 cursor-pointer font-medium">
                              ❌ Tidak berlaku / Belum pernah mengamati perilaku ini
                            </Label>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Navigation */}
                <div className="flex justify-between pt-6">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCurrentPage(prev => Math.max(0, prev - 1));
                      scrollToTop();
                    }}
                    disabled={currentPage === 0}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Halaman Sebelumnya
                  </Button>

                  {currentPage < totalPages - 1 ? (
                    <Button
                      onClick={() => {
                        if (validateCurrentPageQuestions()) {
                          setCurrentPage(prev => prev + 1);
                          scrollToTop();
                        }
                      }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Halaman Selanjutnya
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleComplete}
                      disabled={!isAllQuestionsAnswered() || completeMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {completeMutation.isPending ? 'Menyelesaikan...' : 'Selesaikan Asesmen'}
                      <FileText className="ml-2 h-4 w-4" />
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