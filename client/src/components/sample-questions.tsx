import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, ArrowLeft, CheckCircle, Brain, GraduationCap, Lightbulb } from "lucide-react";
import { useLocation } from "wouter";

interface SampleQuestion {
  id: number;
  text: string;
  options: {
    value: string;
    label: string;
  }[];
}

const sampleQuestions = {
  sensory: [
    {
      id: 1,
      text: "Saya menyukai aktivitas yang menggerakkan tubuh seperti melompat, berlari, atau berputar.",
      options: [
        { value: "1", label: "Tidak Pernah" },
        { value: "2", label: "Jarang" },
        { value: "3", label: "Kadang-kadang" },
        { value: "4", label: "Sering" },
        { value: "5", label: "Selalu" }
      ]
    },
    {
      id: 2,
      text: "Saya sangat sensitif terhadap suara keras atau mendadak.",
      options: [
        { value: "1", label: "Tidak Pernah" },
        { value: "2", label: "Jarang" },
        { value: "3", label: "Kadang-kadang" },
        { value: "4", label: "Sering" },
        { value: "5", label: "Selalu" }
      ]
    },
    {
      id: 3,
      text: "Saya menyukai makanan dengan tekstur yang bervariasi.",
      options: [
        { value: "1", label: "Tidak Pernah" },
        { value: "2", label: "Jarang" },
        { value: "3", label: "Kadang-kadang" },
        { value: "4", label: "Sering" },
        { value: "5", label: "Selalu" }
      ]
    },
    {
      id: 4,
      text: "Saya mudah terganggu oleh cahaya yang terlalu terang.",
      options: [
        { value: "1", label: "Tidak Pernah" },
        { value: "2", label: "Jarang" },
        { value: "3", label: "Kadang-kadang" },
        { value: "4", label: "Sering" },
        { value: "5", label: "Selalu" }
      ]
    }
  ],
  learning: [
    {
      id: 1,
      text: "Ketika saya diminta untuk belajar sesuatu yang baru, maka saya mudah memahaminya ketika:",
      options: [
        { value: "visual", label: "Melihat cara orang lain melakukannya" },
        { value: "auditori", label: "Mendengarkan cara orang lain melakukannya" },
        { value: "kinestetik", label: "Mencoba sendiri" }
      ]
    },
    {
      id: 2,
      text: "Saat saya membaca sesuatu, saya sering menyadari jika saya:",
      options: [
        { value: "visual", label: "Membayangkan apa yang saya baca dalam pikiran" },
        { value: "auditori", label: "Membacanya dengan bersuara atau mendengarkan suara dalam pikiran" },
        { value: "kinestetik", label: "Duduk dengan gelisah dan merasakan isinya" }
      ]
    },
    {
      id: 3,
      text: "Jika saya tidak yakin pada suatu hal, maka saya akan:",
      options: [
        { value: "visual", label: "Menuliskannya untuk menentukan apakah hal itu tampak benar" },
        { value: "auditori", label: "Mengucapkannya untuk menentukan apakah hal itu terdengar benar" },
        { value: "kinestetik", label: "Menuliskannya untuk menentukan apakah hal itu terasa benar" }
      ]
    },
    {
      id: 4,
      text: "Saat menulis sesuatu, yang saya lakukan adalah:",
      options: [
        { value: "visual", label: "Memperhatikan kerapian tulisan dan jarak antar kata" },
        { value: "auditori", label: "Mengucapkan kata-kata sambil menulis" },
        { value: "kinestetik", label: "Menekan kuat alat tulis yang digunakan untuk merasakan alurnya" }
      ]
    }
  ],
  intelligence: [
    {
      id: 1,
      text: "Kamu suka seni-seni yang berkaitan dengan visual (lukis, pahat). Kamu dapat memadukan warna dengan baik.",
      options: [
        { value: "ya", label: "Ya" },
        { value: "tidak", label: "Tidak" }
      ]
    },
    {
      id: 2,
      text: "Kamu suka membaca (buku, majalah, koran, bahkan label produk).",
      options: [
        { value: "ya", label: "Ya" },
        { value: "tidak", label: "Tidak" }
      ]
    },
    {
      id: 3,
      text: "Kamu menyukai pekerjaan yang melibatkan angka dan dapat melakukan perhitungan dengan cara membayangkannya.",
      options: [
        { value: "ya", label: "Ya" },
        { value: "tidak", label: "Tidak" }
      ]
    },
    {
      id: 4,
      text: "Kamu berolahraga secara teratur. Kamu suka berjalan, berenang dan menggerakkan tubuh.",
      options: [
        { value: "ya", label: "Ya" },
        { value: "tidak", label: "Tidak" }
      ]
    },
    {
      id: 5,
      text: "Kamu dapat memainkan alat musik.",
      options: [
        { value: "ya", label: "Ya" },
        { value: "tidak", label: "Tidak" }
      ]
    }
  ]
};

interface SampleQuestionsProps {
  assessmentType: 'sensory' | 'learning' | 'intelligence';
  assessmentName: string;
  onComplete: () => void;
  onClose: () => void;
}

export default function SampleQuestions({ assessmentType, assessmentName, onComplete, onClose }: SampleQuestionsProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [, setLocation] = useLocation();

  const questions = sampleQuestions[assessmentType];
  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const hasAnswered = answers[currentQuestion.id];

  const getIcon = () => {
    switch (assessmentType) {
      case 'sensory':
        return <Brain className="w-8 h-8 text-secondary" />;
      case 'learning':
        return <GraduationCap className="w-8 h-8 text-accent" />;
      case 'intelligence':
        return <Lightbulb className="w-8 h-8 text-purple-600" />;
    }
  };

  const getGradientClass = () => {
    switch (assessmentType) {
      case 'sensory':
        return 'from-secondary to-secondary/80';
      case 'learning':
        return 'from-accent to-accent/80';
      case 'intelligence':
        return 'from-purple-600 to-purple-500';
    }
  };

  const handleAnswerChange = (value: string) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: value
    }));
  };

  const handleNext = () => {
    if (isLastQuestion) {
      onComplete();
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSignup = () => {
    setLocation("/register");
  };

  const handleLogin = () => {
    setLocation("/login");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`bg-gradient-to-r ${getGradientClass()} text-white p-6 rounded-t-2xl`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {getIcon()}
              <div className="ml-4">
                <h2 className="text-2xl font-bold">Sample: {assessmentName}</h2>
                <p className="text-white/90">Coba {questions.length} pertanyaan untuk merasakan pengalaman asesmen</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20"
              data-testid="button-close-sample"
            >
              ✕
            </Button>
          </div>
        </div>

        {/* Progress */}
        <div className="p-6 pb-0">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Pertanyaan {currentQuestionIndex + 1} dari {questions.length}
            </span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {Math.round(progress)}%
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Question */}
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            {currentQuestion.text}
          </h3>

          <RadioGroup
            value={answers[currentQuestion.id] || ''}
            onValueChange={handleAnswerChange}
            className="space-y-3"
          >
            {currentQuestion.options.map((option) => (
              <div key={option.value} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <RadioGroupItem 
                  value={option.value} 
                  id={`${currentQuestion.id}-${option.value}`}
                  data-testid={`option-${option.value}-${currentQuestion.id}`}
                />
                <Label 
                  htmlFor={`${currentQuestion.id}-${option.value}`} 
                  className="flex-1 cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center p-6 border-t bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className="flex items-center"
            data-testid="button-previous-sample"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Sebelumnya
          </Button>

          {isLastQuestion ? (
            <Button
              onClick={handleNext}
              disabled={!hasAnswered}
              className={`flex items-center bg-gradient-to-r ${getGradientClass()}`}
              data-testid="button-complete-sample"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Lihat Hasil Sample
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!hasAnswered}
              className="flex items-center"
              data-testid="button-next-sample"
            >
              Selanjutnya
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface SampleResultsProps {
  assessmentType: 'sensory' | 'learning' | 'intelligence';
  assessmentName: string;
  onSignup: () => void;
  onLogin: () => void;
  onClose: () => void;
}

export function SampleResults({ assessmentType, assessmentName, onSignup, onLogin, onClose }: SampleResultsProps) {
  const getIcon = () => {
    switch (assessmentType) {
      case 'sensory':
        return <Brain className="w-12 h-12 text-secondary" />;
      case 'learning':
        return <GraduationCap className="w-12 h-12 text-accent" />;
      case 'intelligence':
        return <Lightbulb className="w-12 h-12 text-purple-600" />;
    }
  };

  const getGradientClass = () => {
    switch (assessmentType) {
      case 'sensory':
        return 'from-secondary to-secondary/80';
      case 'learning':
        return 'from-accent to-accent/80';
      case 'intelligence':
        return 'from-purple-600 to-purple-500';
    }
  };

  const getSampleInsight = () => {
    switch (assessmentType) {
      case 'sensory':
        return {
          title: "Profil Sensoris Anda",
          description: "Berdasarkan sample jawaban, Anda menunjukkan preferensi sensoris yang unik. Asesmen lengkap akan menganalisis 125 pertanyaan untuk memberikan profil komprehensif tentang bagaimana Anda memproses informasi sensoris.",
          fullBenefit: "Dapatkan insight mendalam tentang pola pemrosesan sensoris Anda"
        };
      case 'learning':
        return {
          title: "Gaya Belajar Anda",
          description: "Sample ini menunjukkan kecenderungan gaya belajar Anda. Asesmen penuh akan menganalisis preferensi visual, auditori, dan kinestetik Anda secara detail untuk optimalisasi pembelajaran.",
          fullBenefit: "Temukan strategi belajar yang paling efektif untuk Anda"
        };
      case 'intelligence':
        return {
          title: "Profil Kecerdasan Majemuk",
          description: "Sample menunjukkan keberagaman kecerdasan Anda. Asesmen lengkap akan mengukur 7 dimensi kecerdasan untuk memberikan profil komprehensif potensi dan kekuatan Anda.",
          fullBenefit: "Identifikasi dan maksimalkan semua jenis kecerdasan Anda"
        };
    }
  };

  const insight = getSampleInsight();

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-card rounded-2xl shadow-2xl max-w-2xl w-full">
        {/* Header */}
        <div className={`bg-gradient-to-r ${getGradientClass()} text-white p-8 rounded-t-2xl text-center`}>
          {getIcon()}
          <h2 className="text-3xl font-bold mt-4 mb-2">Selamat!</h2>
          <p className="text-white/90">Anda telah menyelesaikan sample {assessmentName}</p>
        </div>

        {/* Results */}
        <div className="p-8">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              {insight.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              {insight.description}
            </p>
          </div>

          {/* Call to Action */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 p-6 rounded-xl mb-6">
            <div className="text-center">
              <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Ingin Hasil Lengkap?
              </h4>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {insight.fullBenefit}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={onSignup}
                  className={`px-8 py-3 text-lg font-semibold bg-gradient-to-r ${getGradientClass()}`}
                  data-testid="button-signup-after-sample"
                >
                  Daftar & Akses Penuh
                </Button>
                <Button
                  variant="outline"
                  onClick={onLogin}
                  className="px-8 py-3 text-lg"
                  data-testid="button-login-after-sample"
                >
                  Sudah Punya Akun? Masuk
                </Button>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
              data-testid="button-close-sample-results"
            >
              Tutup
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}