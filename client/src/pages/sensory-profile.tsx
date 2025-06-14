import { useState, useEffect } from "react";
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
  childAge: string;
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
      { id: 13, text: 'Memiliki kesulitan menyusun puzzle bersama (dibandingkan dengan anak-anak seusianya)', threshold: 'L' }
    ]
  }
  // Note: Only including first 2 sections for demo - full implementation would include all 14 sections
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
    childAge: '',
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
                  <strong>Catatan:</strong> Hak Cipta © 1999 oleh Rumah Psikologi Indonesia. 
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
      const required = ['childName', 'childAge', 'childGender', 'parentName', 'relationship'];
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
                    <Label htmlFor="childAge">Usia *</Label>
                    <Input
                      id="childAge"
                      value={participantInfo.childAge}
                      onChange={(e) => setParticipantInfo(prev => ({...prev, childAge: e.target.value}))}
                      placeholder="Contoh: 5 tahun 6 bulan"
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
                        setResponses(prev => ({...prev, [question.id]: value}));
                        if (notApplicable[question.id]) {
                          setNotApplicable(prev => ({...prev, [question.id]: false}));
                        }
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
                          setNotApplicable(prev => ({...prev, [question.id]: e.target.checked}));
                          if (e.target.checked && responses[question.id]) {
                            setResponses(prev => {
                              const newResponses = { ...prev };
                              delete newResponses[question.id];
                              return newResponses;
                            });
                          }
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
              }
            }}
            disabled={currentSectionIndex === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Sebelumnya
          </Button>
          
          <Button
            onClick={() => {
              if (currentSectionIndex < totalSections - 1) {
                setCurrentSectionIndex(prev => prev + 1);
              } else {
                const results = {
                  participantInfo,
                  responses,
                  comments,
                  notApplicable,
                  sectionScores: {},
                  totalScore: Object.values(responses).reduce((total, response) => total + (parseInt(response) || 0), 0),
                  interpretation: 'Asesmen sensory profile telah diselesaikan.'
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