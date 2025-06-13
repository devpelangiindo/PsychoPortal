import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";

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
      { id: 114, text: 'Memiliki ketakutan yang mengganggu rutinitas sehari-hari' },
      { id: 115, text: 'Tidak memiliki selera humor' },
      { id: 116, text: 'Tidak mengekspresikan emosi' }
    ]
  },
  {
    id: 'M',
    title: 'M. Hasil Perilaku Pemrosesan Sensorik',
    questions: [
      { id: 117, text: 'Berbicara sendiri saat mengerjakan aktivitas' },
      { id: 118, text: 'Tulisan tidak terbaca' },
      { id: 119, text: 'Mengalami kesulitan untuk tetap ada di antara baris/paragraf saat mewarnai atau saat menulis' },
      { id: 120, text: 'Menggunakan cara yang tidak efisien dalam melakukan sesuatu (misalnya: membuang waktu, bergerak lambat, melakukan sesuatu dengan cara yang lebih sulit dari yang dibutuhkan)' },
      { id: 121, text: 'Memiliki kesulitan mentolerir perubahan pada perencanaan dan harapan', threshold: 'L' },
      { id: 122, text: 'Memiliki kesulitan mentolerir perubahan dalam rutinitas', threshold: 'L' }
    ]
  },
  {
    id: 'N',
    title: 'N. Item yang Menunjukkan Ambang Batas untuk Respons',
    questions: [
      { id: 123, text: 'Melompat dari satu aktivitas ke aktivitas lainnya sehingga mengganggu permainan' },
      { id: 124, text: 'Sengaja mencium benda', threshold: 'H' },
      { id: 125, text: 'Tampak tidak mencium bau-bauan yang kuat', threshold: 'H' }
    ]
  }
];

export default function SensoryProfile() {
  const { isAuthenticated } = useAuth();
  const [, params] = useRoute("/sensory-profile/:assessmentId");
  const { toast } = useToast();
  
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [notApplicable, setNotApplicable] = useState<Record<number, boolean>>({});
  const [isStarted, setIsStarted] = useState(false);

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

  const handleResponse = (questionId: number, value: string) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
    // Remove not applicable if user selects a response
    if (notApplicable[questionId]) {
      setNotApplicable(prev => ({
        ...prev,
        [questionId]: false
      }));
    }
  };

  const handleNotApplicable = (questionId: number) => {
    setNotApplicable(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
    // Clear response if marked as not applicable
    if (!notApplicable[questionId]) {
      setResponses(prev => {
        const newResponses = { ...prev };
        delete newResponses[questionId];
        return newResponses;
      });
    }
  };

  const handleComment = (sectionId: string, comment: string) => {
    setComments(prev => ({
      ...prev,
      [sectionId]: comment
    }));
  };

  const isCurrentSectionComplete = () => {
    return currentSection.questions.every(q => 
      responses[q.id] || notApplicable[q.id]
    );
  };

  const handleNext = () => {
    if (currentSectionIndex < totalSections - 1) {
      setCurrentSectionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    const results = {
      responses,
      comments,
      notApplicable,
      completedAt: new Date().toISOString()
    };
    
    console.log('Assessment completed:', results);
    toast({
      title: "Asesmen Selesai!",
      description: "Hasil asesmen Anda telah disimpan.",
    });
  };

  const startAssessment = () => {
    setIsStarted(true);
  };

  if (!isStarted) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-background">
        <Header />
        
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-8">
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
              <p className="text-neutral-700 dark:text-foreground">
                Silakan mencentang kotak yang paling menggambarkan frekuensi perilaku yang 
                dilakukan anak Anda seperti pada keterangan di bawah ini. Tolong jawab semua 
                pernyataan. Jika Anda tidak dapat memberi komentar karena Anda tidak mengamati 
                perilaku tersebut atau percaya bahwa perilaku yang dimaksud itu tidak berlaku 
                untuk anak Anda, maka silakan beri tanda pada "Tidak Berlaku" untuk item tersebut. 
                Tulis komentar apa pun di akhir setiap bagian.
              </p>
              
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                  Gunakan kata kunci berikut untuk menandai tanggapan Anda:
                </h3>
                <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                  <div><strong>SELALU:</strong> Saat diberi kesempatan, anak Anda selalu merespons dengan cara ini, 100% setiap saat.</div>
                  <div><strong>SERING:</strong> Saat diberi kesempatan, anak Anda sering merespons dengan cara ini, sekitar 75% dari rutinas kesehariannya.</div>
                  <div><strong>KADANG-KADANG:</strong> Saat diberi kesempatan, anak Anda terkadang merespons dengan cara ini, sekitar 50% dari rutinas kesehariannya.</div>
                  <div><strong>JARANG:</strong> Saat diberi kesempatan, anak Anda jarang merespons dengan cara ini, sekitar 25% dari rutinas kesehariannya.</div>
                  <div><strong>TIDAK PERNAH:</strong> Saat diberi kesempatan, anak Anda tidak pernah merespons dengan cara ini, 0% dari rutinas kesehariannya.</div>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Catatan:</strong> Hak Cipta © 1999 oleh Rumah Psikologi Indonesia. 
                  Asesmen ini terdiri dari 125 pertanyaan yang dibagi dalam 14 bagian.
                </p>
              </div>

              <Button 
                size="lg" 
                onClick={startAssessment}
                className="w-full mt-6"
              >
                Mulai Asesmen
              </Button>
            </CardContent>
          </Card>
        </main>

        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-foreground">
              Asesmen Sensory Profile
            </h1>
            <span className="text-sm text-neutral-500 dark:text-muted-foreground">
              Bagian {currentSectionIndex + 1} dari {totalSections}
            </span>
          </div>
          <Progress value={progress} className="mb-4" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{currentSection.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentSection.questions.map((question) => (
              <div key={question.id} className="space-y-3 p-4 border border-gray-200 dark:border-border rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-medium text-sm text-neutral-600 dark:text-muted-foreground">
                        {question.id}.
                      </span>
                      {question.threshold && (
                        <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-muted rounded">
                          {question.threshold}
                        </span>
                      )}
                    </div>
                    <p className="text-neutral-900 dark:text-foreground">
                      {question.text}
                    </p>
                  </div>
                  
                  <div className="ml-4">
                    <Label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notApplicable[question.id] || false}
                        onChange={() => handleNotApplicable(question.id)}
                        className="rounded"
                      />
                      <span className="text-sm text-neutral-600 dark:text-muted-foreground">
                        Tidak Berlaku
                      </span>
                    </Label>
                  </div>
                </div>

                {!notApplicable[question.id] && (
                  <RadioGroup
                    value={responses[question.id] || ""}
                    onValueChange={(value) => handleResponse(question.id, value)}
                    className="flex flex-wrap gap-4"
                  >
                    {[
                      { value: "5", label: "Selalu", color: "bg-red-100 dark:bg-red-950/20 border-red-300 dark:border-red-800" },
                      { value: "4", label: "Sering", color: "bg-orange-100 dark:bg-orange-950/20 border-orange-300 dark:border-orange-800" },
                      { value: "3", label: "Kadang-kadang", color: "bg-yellow-100 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-800" },
                      { value: "2", label: "Jarang", color: "bg-blue-100 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800" },
                      { value: "1", label: "Tidak Pernah", color: "bg-green-100 dark:bg-green-950/20 border-green-300 dark:border-green-800" }
                    ].map(option => (
                      <Label
                        key={option.value}
                        className={`flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          responses[question.id] === option.value 
                            ? `${option.color} ring-2 ring-offset-2 ring-primary` 
                            : 'border-gray-200 dark:border-border hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <RadioGroupItem value={option.value} className="sr-only" />
                        <span className={`text-sm font-medium ${
                          responses[question.id] === option.value 
                            ? 'text-gray-900 dark:text-gray-100' 
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {option.label}
                        </span>
                      </Label>
                    ))}
                  </RadioGroup>
                )}
              </div>
            ))}

            <div className="mt-8 space-y-2">
              <Label htmlFor={`comment-${currentSection.id}`} className="text-sm font-medium">
                Komentar untuk bagian {currentSection.title}:
              </Label>
              <Textarea
                id={`comment-${currentSection.id}`}
                placeholder="Tuliskan komentar atau observasi tambahan untuk bagian ini..."
                value={comments[currentSection.id] || ""}
                onChange={(e) => handleComment(currentSection.id, e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-border">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentSectionIndex === 0}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Sebelumnya</span>
              </Button>

              {currentSectionIndex === totalSections - 1 ? (
                <Button
                  onClick={handleComplete}
                  disabled={!isCurrentSectionComplete()}
                  className="flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Selesaikan Asesmen</span>
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  disabled={!isCurrentSectionComplete()}
                  className="flex items-center space-x-2"
                >
                  <span>Selanjutnya</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}