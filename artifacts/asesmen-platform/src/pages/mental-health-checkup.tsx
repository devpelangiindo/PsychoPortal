import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Brain, Clock, HeartPulse, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { UserAssessmentWithDetails } from "@shared/schema";

type MentalHealthDomain = "anxiety" | "stress" | "depression" | "burnout" | "safety";

type MentalHealthQuestion = {
  id: string;
  domain: MentalHealthDomain;
  text: string;
};

const questions: MentalHealthQuestion[] = [
  { id: "anxiety_1", domain: "anxiety", text: "Saya merasa gugup, cemas, atau tegang." },
  { id: "anxiety_2", domain: "anxiety", text: "Saya sulit menghentikan atau mengendalikan kekhawatiran." },
  { id: "anxiety_3", domain: "anxiety", text: "Saya mengkhawatirkan banyak hal secara berlebihan." },
  { id: "anxiety_4", domain: "anxiety", text: "Tubuh saya bereaksi saat cemas, misalnya jantung berdebar, napas pendek, gemetar, atau berkeringat." },
  { id: "anxiety_5", domain: "anxiety", text: "Saya takut sesuatu yang buruk akan terjadi meskipun belum tentu ada ancaman nyata." },
  { id: "anxiety_6", domain: "anxiety", text: "Kecemasan membuat saya menghindari aktivitas, tempat, atau situasi tertentu." },
  { id: "stress_1", domain: "stress", text: "Saya merasa kewalahan oleh tuntutan yang harus saya hadapi." },
  { id: "stress_2", domain: "stress", text: "Saya sulit menenangkan diri atau benar-benar rileks." },
  { id: "stress_3", domain: "stress", text: "Saya lebih mudah tersinggung, marah, atau kehilangan kesabaran." },
  { id: "stress_4", domain: "stress", text: "Saya merasa tidak memiliki cukup kendali atas hal-hal penting dalam hidup." },
  { id: "stress_5", domain: "stress", text: "Saya merasakan ketegangan fisik, seperti sakit kepala, rahang mengeras, atau otot tegang." },
  { id: "stress_6", domain: "stress", text: "Pikiran saya terus aktif sehingga sulit beristirahat atau beralih dari masalah." },
  { id: "depression_1", domain: "depression", text: "Saya kehilangan minat atau kesenangan pada aktivitas yang biasanya saya nikmati." },
  { id: "depression_2", domain: "depression", text: "Saya merasa sedih, murung, kosong, atau putus asa." },
  { id: "depression_3", domain: "depression", text: "Saya merasa lelah atau kekurangan energi." },
  { id: "depression_4", domain: "depression", text: "Pola tidur saya terganggu, baik sulit tidur, sering terbangun, maupun tidur berlebihan." },
  { id: "depression_5", domain: "depression", text: "Saya merasa tidak berharga, gagal, atau sangat kecewa terhadap diri sendiri." },
  { id: "depression_6", domain: "depression", text: "Saya sulit berkonsentrasi, mengambil keputusan, atau menyelesaikan aktivitas sehari-hari." },
  { id: "burnout_1", domain: "burnout", text: "Saya merasa kehabisan energi setelah menjalani pekerjaan atau kegiatan belajar." },
  { id: "burnout_2", domain: "burnout", text: "Saya sulit memulihkan tenaga meskipun sudah beristirahat." },
  { id: "burnout_3", domain: "burnout", text: "Saya merasa semakin berjarak, sinis, atau negatif terhadap pekerjaan atau kegiatan belajar." },
  { id: "burnout_4", domain: "burnout", text: "Saya sulit menemukan makna atau antusiasme dalam pekerjaan atau kegiatan belajar." },
  { id: "burnout_5", domain: "burnout", text: "Saya merasa kemampuan atau efektivitas saya dalam bekerja atau belajar menurun." },
  { id: "burnout_6", domain: "burnout", text: "Memikirkan pekerjaan atau kegiatan belajar saja sudah membuat saya lelah secara emosional." },
  { id: "safety_1", domain: "safety", text: "Saya memiliki pikiran untuk menyakiti diri sendiri atau merasa lebih baik jika saya tidak ada." },
];

const responseOptions = [
  { value: "0", label: "Tidak pernah" },
  { value: "1", label: "Beberapa hari" },
  { value: "2", label: "Sering / lebih dari separuh hari" },
  { value: "3", label: "Hampir setiap hari" },
];

const domainLabels: Record<MentalHealthDomain, string> = {
  anxiety: "Kecemasan",
  stress: "Stres",
  depression: "Depresi",
  burnout: "Burnout kerja/studi",
  safety: "Keselamatan diri",
};

export default function MentalHealthCheckup() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, params] = useRoute("/mental-health-checkup/:userAssessmentId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userAssessmentId = params?.userAssessmentId ? Number(params.userAssessmentId) : null;
  const [started, setStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, number>>({});

  const { data: userAssessment, isLoading } = useQuery<UserAssessmentWithDetails>({
    queryKey: [`/api/user-assessments/by-id/${userAssessmentId}`],
    enabled: Boolean(userAssessmentId && isAuthenticated),
    retry: false,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/login");
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (userAssessment?.status === "in_progress") {
      const saved = userAssessment.results as any;
      setResponses(saved?.responses ?? {});
      setCurrentStep(saved?.currentStep ?? 0);
      setStarted(true);
    }
    if (userAssessment?.status === "completed") setLocation(`/results/${userAssessment.id}`);
  }, [userAssessment, setLocation]);

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!userAssessment) throw new Error("Asesmen tidak ditemukan");
      return apiRequest("POST", `/api/user-assessments/${userAssessment.id}/start`);
    },
    onSuccess: () => {
      setStarted(true);
      queryClient.invalidateQueries({ queryKey: [`/api/user-assessments/by-id/${userAssessmentId}`] });
    },
    onError: () => toast({ title: "Gagal memulai asesmen", variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { responses: Record<string, number>; currentStep: number }) => {
      if (!userAssessment) throw new Error("Asesmen tidak ditemukan");
      return apiRequest("POST", `/api/user-assessments/${userAssessment.id}/save-progress`, payload);
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!userAssessment) throw new Error("Asesmen tidak ditemukan");
      const response = await apiRequest("POST", `/api/user-assessments/${userAssessment.id}/complete`, {
        results: { responses, participantInfo: {} },
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-assessments"] });
      setLocation(`/results/${userAssessment?.id}`);
    },
    onError: () => toast({ title: "Gagal menyimpan hasil", description: "Silakan coba lagi.", variant: "destructive" }),
  });

  if (authLoading || isLoading) {
    return <div className="min-h-screen bg-neutral-50"><Header /><div className="py-24 text-center">Memuat asesmen...</div><Footer /></div>;
  }

  if (!userAssessment) {
    return <div className="min-h-screen bg-neutral-50"><Header /><div className="py-24 text-center"><p>Asesmen tidak ditemukan atau akses belum tersedia.</p><Button className="mt-4" onClick={() => setLocation("/assessments")}>Kembali</Button></div><Footer /></div>;
  }

  if (!started) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-background">
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-12">
          <Button variant="ghost" onClick={() => setLocation("/dashboard")} className="mb-5"><ArrowLeft className="mr-2 h-4 w-4" />Kembali</Button>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-3 text-2xl"><HeartPulse className="h-7 w-7 text-rose-600" />Mental Health Check Up</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <p>Skrining singkat untuk melihat indikator kecemasan, stres, depresi, dan burnout dalam <strong>2 minggu terakhir</strong>.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-green-50 p-4 text-sm text-green-900"><Clock className="mb-2 h-5 w-5" /><strong>10-15 menit</strong><br />Jawab 25 pertanyaan secara jujur.</div>
                <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900"><Brain className="mb-2 h-5 w-5" /><strong>Bukan diagnosis</strong><br />Hasil menunjukkan area yang mungkin perlu diperhatikan.</div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Burnout pada skrining ini merujuk pada pengalaman terkait pekerjaan atau kegiatan belajar. Jika tidak sedang bekerja atau belajar, pilih jawaban yang paling mendekati aktivitas utama Anda.
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                <ShieldAlert className="mr-2 inline h-5 w-5" />Jika Anda sedang dalam bahaya atau memiliki dorongan menyakiti diri, jangan menunggu hasil asesmen. Hubungi <strong>119 ekstensi 8</strong>, kunjungi <a className="underline" href="https://www.healing119.id" target="_blank" rel="noreferrer">Healing119.id</a>, atau datang ke IGD terdekat.
              </div>
              <Button className="w-full" size="lg" onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>{startMutation.isPending ? "Memulai..." : "Mulai Mental Health Check Up"}</Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;
  const currentValue = responses[currentQuestion.id];
  const handleNext = () => {
    if (currentValue === undefined) return;
    if (currentStep === questions.length - 1) {
      completeMutation.mutate();
      return;
    }
    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    saveMutation.mutate({ responses, currentStep: nextStep });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div><p className="text-sm font-medium text-rose-700">{domainLabels[currentQuestion.domain]}</p><h1 className="text-2xl font-bold">Mental Health Check Up</h1></div>
          <span className="text-sm text-neutral-500">{currentStep + 1} / {questions.length}</span>
        </div>
        <Progress value={progress} className="mb-6 h-2" />
        <Card className={currentQuestion.domain === "safety" ? "border-red-300" : ""}>
          <CardHeader><CardTitle className="text-xl leading-relaxed">Dalam 2 minggu terakhir, seberapa sering hal berikut Anda alami?</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <p className="rounded-lg bg-neutral-100 p-5 text-lg font-medium dark:bg-neutral-800">{currentQuestion.text}</p>
            <RadioGroup value={currentValue === undefined ? "" : String(currentValue)} onValueChange={(value) => setResponses((current) => ({ ...current, [currentQuestion.id]: Number(value) }))} className="space-y-3">
              {responseOptions.map((option) => (
                <div key={option.value} className="flex items-center gap-3 rounded-lg border p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                  <RadioGroupItem value={option.value} id={`${currentQuestion.id}-${option.value}`} />
                  <Label htmlFor={`${currentQuestion.id}-${option.value}`} className="flex-1 cursor-pointer">{option.label}</Label>
                </div>
              ))}
            </RadioGroup>
            {currentQuestion.domain === "safety" && currentValue !== undefined && currentValue > 0 && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">Anda tidak harus menghadapi ini sendiri. Hubungi 119 ekstensi 8 atau Healing119.id sekarang, minta orang tepercaya menemani Anda, dan menuju IGD jika ada risiko langsung.</div>
            )}
            <div className="flex justify-between gap-3">
              <Button variant="outline" onClick={() => setCurrentStep((step) => Math.max(0, step - 1))} disabled={currentStep === 0}>Sebelumnya</Button>
              <Button onClick={handleNext} disabled={currentValue === undefined || completeMutation.isPending}>{currentStep === questions.length - 1 ? (completeMutation.isPending ? "Menyimpan..." : "Lihat Hasil") : "Berikutnya"}</Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
