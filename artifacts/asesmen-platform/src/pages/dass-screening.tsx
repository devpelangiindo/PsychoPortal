import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, LockKeyhole, Send } from "lucide-react";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDisplayDate } from "@/lib/date-format";

type DassEligibility = {
  orderId: number;
  psychologistName: string | null;
  preferredDate: string;
  preferredTime: string;
  completed: boolean;
  completedAt: string | null;
};

type DassEligibilityResponse = {
  eligibleOrders: DassEligibility[];
};

const DASS_QUESTIONS = [
  "Saya merasa bahwa diri saya menjadi marah karena hal-hal sepele.",
  "Saya merasa bibir saya sering kering.",
  "Saya sama sekali tidak dapat merasakan perasaan positif.",
  "Saya mengalami kesulitan bernapas (misalnya sering terengah-engah atau tidak dapat bernapas padahal tidak melakukan aktivitas fisik sebelumnya).",
  "Saya sepertinya tidak kuat lagi untuk melakukan suatu kegiatan.",
  "Saya cenderung bereaksi berlebihan terhadap suatu situasi.",
  "Saya merasa goyah (misalnya kaki terasa mau 'copot').",
  "Saya merasa sulit untuk bersantai.",
  "Saya menemukan diri saya berada dalam situasi yang membuat saya merasa sangat cemas dan saya akan merasa sangat lega jika semua ini berakhir.",
  "Saya merasa tidak ada hal yang dapat diharapkan di masa depan.",
  "Saya menemukan diri saya mudah merasa kesal.",
  "Saya merasa telah menghabiskan banyak energi untuk merasa cemas.",
  "Saya merasa sedih dan tertekan.",
  "Saya menemukan diri saya menjadi tidak sabar ketika mengalami penundaan (misalnya kemacetan lalu lintas atau menunggu sesuatu).",
  "Saya merasa lemas seperti mau pingsan.",
  "Saya merasa saya kehilangan minat akan segala hal.",
  "Saya merasa bahwa saya tidak berharga sebagai seorang manusia.",
  "Saya merasa bahwa saya sangat mudah tersinggung.",
  "Saya berkeringat secara berlebihan (misalnya tangan berkeringat), padahal temperatur tidak panas atau tidak melakukan aktivitas fisik sebelumnya.",
  "Saya merasa takut tanpa alasan yang jelas.",
  "Saya merasa bahwa hidup tidak bermanfaat.",
  "Saya merasa sulit untuk beristirahat.",
  "Saya mengalami kesulitan dalam menelan.",
  "Saya tidak dapat merasakan kenikmatan dari berbagai hal yang saya lakukan.",
  "Saya menyadari kegiatan jantung, walaupun saya tidak sehabis melakukan aktivitas fisik (misalnya merasa detak jantung meningkat atau melemah).",
  "Saya merasa putus asa dan sedih.",
  "Saya merasa bahwa saya sangat mudah marah.",
  "Saya merasa saya hampir panik.",
  "Saya merasa sulit untuk tenang setelah sesuatu membuat saya kesal.",
  "Saya takut bahwa saya akan 'terhambat' oleh tugas-tugas sepele yang tidak biasa saya lakukan.",
  "Saya tidak merasa antusias dalam hal apa pun.",
  "Saya sulit untuk sabar dalam menghadapi gangguan terhadap hal yang sedang saya lakukan.",
  "Saya sedang merasa gelisah.",
  "Saya merasa bahwa saya tidak berharga.",
  "Saya tidak dapat memaklumi hal apa pun yang menghalangi saya untuk menyelesaikan hal yang sedang saya lakukan.",
  "Saya merasa sangat ketakutan.",
  "Saya melihat tidak ada harapan untuk masa depan.",
  "Saya merasa bahwa hidup tidak berarti.",
  "Saya menemukan diri saya mudah gelisah.",
  "Saya merasa khawatir dengan situasi di mana saya mungkin menjadi panik dan mempermalukan diri sendiri.",
  "Saya merasa gemetar (misalnya pada tangan).",
  "Saya merasa sulit untuk meningkatkan inisiatif dalam melakukan sesuatu.",
] as const;

const RESPONSE_OPTIONS = [
  { value: "0", label: "Tidak sesuai dengan saya sama sekali, atau tidak pernah." },
  { value: "1", label: "Sesuai dengan saya sampai tingkat tertentu, atau kadang-kadang." },
  { value: "2", label: "Sesuai dengan saya sampai batas yang dapat dipertimbangkan, atau lumayan sering." },
  { value: "3", label: "Sangat sesuai dengan saya, atau sering sekali." },
] as const;

const QUESTIONS_PER_PAGE = 7;

export default function DassScreening() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, params] = useRoute("/dass-screening/:orderId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const orderId = Number(params?.orderId);
  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<Array<number | null>>(() => Array(DASS_QUESTIONS.length).fill(null));

  const { data, isLoading } = useQuery<DassEligibilityResponse>({
    queryKey: ["/api/dass-screenings/eligibility"],
    enabled: isAuthenticated && Number.isInteger(orderId) && orderId > 0,
    retry: false,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation(`/login?redirect=/dass-screening/${orderId}`);
  }, [authLoading, isAuthenticated, orderId, setLocation]);

  const eligibility = data?.eligibleOrders.find((item) => item.orderId === orderId);
  const pageCount = Math.ceil(DASS_QUESTIONS.length / QUESTIONS_PER_PAGE);
  const pageStart = page * QUESTIONS_PER_PAGE;
  const pageQuestions = useMemo(
    () => DASS_QUESTIONS.slice(pageStart, pageStart + QUESTIONS_PER_PAGE),
    [pageStart],
  );
  const answeredCount = answers.filter((answer) => answer !== null).length;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/dass-screenings", {
        orderId,
        answers: answers.map((answer) => Number(answer)),
      });
      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/dass-screenings/eligibility"] });
    },
    onError: (submissionError: any) => {
      toast({
        title: "Hasil belum tersimpan",
        description: submissionError?.message || "Silakan periksa jawaban dan coba lagi.",
        variant: "destructive",
      });
    },
  });

  const currentPageComplete = pageQuestions.every((_, offset) => answers[pageStart + offset] !== null);

  const goToNextPage = () => {
    if (!currentPageComplete) {
      toast({ title: "Jawaban belum lengkap", description: "Jawab semua pernyataan pada halaman ini terlebih dahulu." });
      return;
    }
    setPage((current) => Math.min(current + 1, pageCount - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (authLoading || isLoading) {
    return <PageShell><div className="py-24 text-center text-neutral-500">Memeriksa akses tes DASS...</div></PageShell>;
  }

  if (!eligibility) {
    return (
      <PageShell>
        <Card className="mx-auto max-w-xl">
          <CardContent className="py-12 text-center">
            <LockKeyhole className="mx-auto mb-4 h-10 w-10 text-neutral-400" />
            <h1 className="text-xl font-semibold">Tes belum tersedia</h1>
            <p className="mt-2 text-neutral-500">Tes DASS hanya dapat diakses setelah booking konseling dan pembayaran berhasil.</p>
            <Button className="mt-6" onClick={() => setLocation("/dashboard")}>Kembali ke Dashboard</Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (eligibility.completed || submitted) {
    return (
      <PageShell>
        <Card className="mx-auto max-w-xl">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-700" />
            <h1 className="text-2xl font-semibold">Tes DASS telah selesai</h1>
            <p className="mt-3 text-neutral-600">Jawaban Anda sudah tersimpan dan hanya dapat ditinjau oleh psikolog yang menangani konseling Anda.</p>
            <p className="mt-2 text-sm text-neutral-500">Hasil screening akan dibahas oleh psikolog dalam konteks konseling dan bukan merupakan diagnosis.</p>
            <Button className="mt-6" onClick={() => setLocation("/dashboard")}>Kembali ke Dashboard</Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (!started) {
    return (
      <PageShell>
        <Button variant="ghost" onClick={() => setLocation("/dashboard")} className="mb-5">
          <ArrowLeft className="mr-2 h-4 w-4" />Kembali
        </Button>
        <Card className="mx-auto max-w-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <ClipboardCheck className="h-7 w-7 text-green-700" />
              Tes DASS (Depression Anxiety Stress Scale)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="leading-relaxed text-neutral-700">Tes screening awal ini berisi 42 pernyataan tentang pengalaman Anda selama <strong>satu minggu terakhir</strong>. Pilih jawaban pertama yang paling sesuai dengan keadaan diri Anda.</p>
            <div className="rounded-lg border bg-neutral-50 p-4 text-sm text-neutral-700">
              <p><strong>Psikolog:</strong> {eligibility.psychologistName || "-"}</p>
              <p className="mt-1"><strong>Jadwal konseling:</strong> {formatDisplayDate(eligibility.preferredDate)}, {eligibility.preferredTime}</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              Hasil tidak ditampilkan pada dashboard klien. Hasil hanya dapat diakses oleh psikolog yang menangani Anda dan akan digunakan sebagai data pendukung konseling.
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Tes ini bukan diagnosis dan bukan layanan darurat. Bila Anda merasa tidak aman atau membutuhkan pertolongan segera, hubungi orang tepercaya dan layanan darurat/IGD terdekat.
            </div>
            <Button size="lg" className="w-full" onClick={() => setStarted(true)}>Mulai Tes DASS</Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-sm text-neutral-600">
            <span>Bagian {page + 1} dari {pageCount}</span>
            <span>{answeredCount} dari {DASS_QUESTIONS.length} terjawab</span>
          </div>
          <Progress value={(answeredCount / DASS_QUESTIONS.length) * 100} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pilih jawaban yang paling sesuai selama satu minggu terakhir</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {pageQuestions.map((question, offset) => {
              const questionIndex = pageStart + offset;
              return (
                <div key={questionIndex} className="rounded-xl border p-5">
                  <p className="font-medium leading-relaxed"><span className="mr-2 text-green-700">{questionIndex + 1}.</span>{question}</p>
                  <RadioGroup
                    value={answers[questionIndex] === null ? undefined : String(answers[questionIndex])}
                    onValueChange={(value) => setAnswers((current) => {
                      const next = [...current];
                      next[questionIndex] = Number(value);
                      return next;
                    })}
                    className="mt-4 grid gap-3"
                  >
                    {RESPONSE_OPTIONS.map((option) => (
                      <div key={option.value} className="flex items-start gap-3 rounded-lg border p-3 hover:bg-green-50">
                        <RadioGroupItem value={option.value} id={`question-${questionIndex}-${option.value}`} className="mt-0.5" />
                        <Label htmlFor={`question-${questionIndex}-${option.value}`} className="cursor-pointer font-normal leading-relaxed">
                          <strong className="mr-1">{option.value}.</strong>{option.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              );
            })}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button variant="outline" disabled={page === 0} onClick={() => {
                setPage((current) => Math.max(current - 1, 0));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}>
                <ArrowLeft className="mr-2 h-4 w-4" />Sebelumnya
              </Button>
              {page < pageCount - 1 ? (
                <Button onClick={goToNextPage}>Berikutnya<ArrowRight className="ml-2 h-4 w-4" /></Button>
              ) : (
                <Button
                  onClick={() => {
                    if (!currentPageComplete || answeredCount !== DASS_QUESTIONS.length) {
                      toast({ title: "Jawaban belum lengkap", description: "Pastikan seluruh 42 pernyataan sudah dijawab." });
                      return;
                    }
                    submitMutation.mutate();
                  }}
                  disabled={submitMutation.isPending}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {submitMutation.isPending ? "Menyimpan..." : "Kirim ke Psikolog"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">{children}</main>
      <Footer />
    </div>
  );
}
