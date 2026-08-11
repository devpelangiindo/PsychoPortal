import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, LockKeyhole } from "lucide-react";
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

type SrqEligibility = {
  orderId: number;
  psychologistName: string | null;
  preferredDate: string;
  preferredTime: string;
  completed: boolean;
  completedAt: string | null;
};

type SrqEligibilityResponse = { eligibleOrders: SrqEligibility[] };

export const SRQ_QUESTIONS = [
  "Apakah Anda sering menderita sakit kepala?",
  "Apakah Anda kehilangan nafsu makan?",
  "Apakah tidur Anda tidak lelap?",
  "Apakah Anda mudah menjadi takut?",
  "Apakah Anda merasa cemas, tegang, atau khawatir?",
  "Apakah tangan Anda gemetar?",
  "Apakah Anda mengalami gangguan pencernaan?",
  "Apakah Anda merasa sulit berpikir jernih?",
  "Apakah Anda merasa tidak bahagia?",
  "Apakah Anda lebih sering menangis?",
  "Apakah Anda merasa sulit untuk menikmati aktivitas sehari-hari?",
  "Apakah Anda mengalami kesulitan untuk mengambil keputusan?",
  "Apakah aktivitas atau tugas sehari-hari Anda terbengkalai?",
  "Apakah Anda merasa tidak mampu berperan dalam kehidupan ini?",
  "Apakah Anda kehilangan minat dalam banyak hal?",
  "Apakah Anda merasa tidak berharga?",
  "Apakah Anda mempunyai pikiran untuk mengakhiri hidup Anda?",
  "Apakah Anda merasa lelah sepanjang waktu?",
  "Apakah Anda merasa tidak enak di perut?",
  "Apakah Anda mudah lelah?",
  "Apakah Anda minum alkohol lebih banyak dari biasanya atau menggunakan narkoba?",
  "Apakah Anda yakin bahwa seseorang mencoba mencelakai Anda dengan cara tertentu?",
  "Apakah ada hal yang mengganggu atau tidak biasa dalam pikiran Anda?",
  "Apakah Anda pernah mendengar suara tanpa tahu sumbernya atau yang tidak dapat didengar orang lain?",
  "Apakah Anda mengalami mimpi yang mengganggu tentang suatu bencana atau musibah, atau merasa seolah mengalami kembali kejadian tersebut?",
  "Apakah Anda menghindari kegiatan, tempat, orang, atau pikiran yang mengingatkan Anda pada bencana tersebut?",
  "Apakah minat Anda terhadap teman dan kegiatan yang biasa Anda lakukan berkurang?",
  "Apakah Anda merasa sangat terganggu ketika berada dalam situasi yang mengingatkan Anda pada bencana atau ketika memikirkannya?",
  "Apakah Anda kesulitan memahami atau mengekspresikan perasaan Anda?",
] as const;

const QUESTIONS_PER_PAGE = 6;

function PageShell({ children }: { children: React.ReactNode }) {
  return <><Header /><main className="min-h-screen bg-neutral-50 px-4 py-10">{children}</main><Footer /></>;
}

export default function SrqScreening() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, params] = useRoute("/srq-screening/:orderId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const orderId = Number(params?.orderId);
  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<Array<boolean | null>>(() => Array(SRQ_QUESTIONS.length).fill(null));

  const { data, isLoading } = useQuery<SrqEligibilityResponse>({
    queryKey: ["/api/srq-screenings/eligibility"],
    enabled: isAuthenticated && Number.isInteger(orderId) && orderId > 0,
    retry: false,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation(`/login?redirect=/srq-screening/${orderId}`);
  }, [authLoading, isAuthenticated, orderId, setLocation]);

  const eligibility = data?.eligibleOrders.find((item) => item.orderId === orderId);
  const pageCount = Math.ceil(SRQ_QUESTIONS.length / QUESTIONS_PER_PAGE);
  const pageStart = page * QUESTIONS_PER_PAGE;
  const pageQuestions = useMemo(() => SRQ_QUESTIONS.slice(pageStart, pageStart + QUESTIONS_PER_PAGE), [pageStart]);
  const answeredCount = answers.filter((answer) => answer !== null).length;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/srq-screenings", { orderId, answers });
      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/srq-screenings/eligibility"] });
    },
    onError: (error: any) => toast({
      title: "Hasil belum tersimpan",
      description: error?.message || "Silakan coba kembali.",
      variant: "destructive",
    }),
  });

  const currentPageComplete = pageQuestions.every((_, index) => answers[pageStart + index] !== null);
  const goNext = () => {
    if (!currentPageComplete) {
      toast({ title: "Jawaban belum lengkap", description: "Jawab semua pertanyaan pada bagian ini terlebih dahulu." });
      return;
    }
    setPage((current) => current + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (authLoading || isLoading) return <PageShell><div className="py-24 text-center text-neutral-500">Memeriksa akses tes SRQ...</div></PageShell>;

  if (!eligibility) return (
    <PageShell><Card className="mx-auto max-w-xl"><CardContent className="py-12 text-center">
      <LockKeyhole className="mx-auto mb-4 h-10 w-10 text-neutral-400" />
      <h1 className="text-xl font-semibold">Tes belum tersedia</h1>
      <p className="mt-2 text-neutral-500">Self-Reporting Questionnaire hanya dapat diakses setelah booking konseling dan pembayaran berhasil.</p>
      <Button className="mt-6" onClick={() => setLocation("/dashboard")}>Kembali ke Dashboard</Button>
    </CardContent></Card></PageShell>
  );

  if (eligibility.completed || submitted) return (
    <PageShell><Card className="mx-auto max-w-xl"><CardContent className="py-12 text-center">
      <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-700" />
      <h1 className="text-2xl font-semibold">Self-Reporting Questionnaire telah selesai</h1>
      <p className="mt-3 text-neutral-600">Jawaban Anda sudah tersimpan dan hanya dapat ditinjau oleh psikolog yang menangani konseling Anda.</p>
      <p className="mt-2 text-sm text-neutral-500">Tes ini merupakan screening awal dan bukan diagnosis. Jika Anda merasa tidak aman, segera hubungi orang tepercaya dan layanan darurat atau IGD terdekat.</p>
      <Button className="mt-6" onClick={() => setLocation("/dashboard")}>Kembali ke Dashboard</Button>
    </CardContent></Card></PageShell>
  );

  if (!started) return (
    <PageShell><Card className="mx-auto max-w-3xl"><CardHeader><CardTitle className="flex items-center gap-3 text-2xl">
      <ClipboardCheck className="h-7 w-7 text-green-700" />Self-Reporting Questionnaire (SRQ-29)
    </CardTitle></CardHeader><CardContent className="space-y-5">
      <p className="leading-relaxed text-neutral-700">Tes screening awal ini berisi 29 pertanyaan mengenai masalah yang mungkin mengganggu Anda selama <strong>30 hari terakhir</strong>. Pilih Ya bila Anda mengalaminya dan Tidak bila tidak.</p>
      <div className="rounded-lg bg-green-50 p-4 text-sm text-green-900">
        <p><strong>Psikolog:</strong> {eligibility.psychologistName || "-"}</p>
        <p><strong>Jadwal:</strong> {formatDisplayDate(eligibility.preferredDate)}, {eligibility.preferredTime}</p>
        <p className="mt-2">Jawaban bersifat rahasia dan hanya dapat diakses psikolog yang menangani Anda.</p>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Tes ini bukan diagnosis dan bukan layanan darurat. Bila Anda merasa tidak aman atau membutuhkan pertolongan segera, hubungi orang tepercaya dan layanan darurat atau IGD terdekat.</div>
      <Button size="lg" className="w-full" onClick={() => setStarted(true)}>Mulai Tes SRQ</Button>
    </CardContent></Card></PageShell>
  );

  return <PageShell><div className="mx-auto max-w-4xl">
    <div className="mb-6"><div className="mb-2 flex items-center justify-between text-sm text-neutral-600">
      <span>Bagian {page + 1} dari {pageCount}</span><span>{answeredCount} dari {SRQ_QUESTIONS.length} terjawab</span>
    </div><Progress value={(answeredCount / SRQ_QUESTIONS.length) * 100} /></div>
    <Card><CardHeader><CardTitle>Keadaan selama 30 hari terakhir</CardTitle></CardHeader><CardContent className="space-y-6">
      {pageQuestions.map((question, localIndex) => {
        const index = pageStart + localIndex;
        return <div key={question} className="rounded-xl border bg-white p-4">
          <p className="font-medium leading-relaxed"><span className="mr-2 text-green-700">{index + 1}.</span>{question}</p>
          <RadioGroup className="mt-4 grid grid-cols-2 gap-3" value={answers[index] === null ? undefined : String(answers[index])} onValueChange={(value) => setAnswers((current) => {
            const next = [...current]; next[index] = value === "true"; return next;
          })}>
            {[{ value: "true", label: "Ya" }, { value: "false", label: "Tidak" }].map((option) => <Label key={option.value} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-neutral-50">
              <RadioGroupItem value={option.value} /><span>{option.label}</span>
            </Label>)}
          </RadioGroup>
        </div>;
      })}
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" disabled={page === 0} onClick={() => { setPage((current) => current - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}><ArrowLeft className="mr-2 h-4 w-4" />Sebelumnya</Button>
        {page < pageCount - 1 ? <Button onClick={goNext}>Berikutnya<ArrowRight className="ml-2 h-4 w-4" /></Button> : <Button disabled={submitMutation.isPending} onClick={() => {
          if (!currentPageComplete || answeredCount !== SRQ_QUESTIONS.length) {
            toast({ title: "Jawaban belum lengkap", description: "Pastikan seluruh 29 pertanyaan sudah dijawab." }); return;
          }
          submitMutation.mutate();
        }}>{submitMutation.isPending ? "Menyimpan..." : "Kirim Jawaban"}</Button>}
      </div>
    </CardContent></Card>
  </div></PageShell>;
}
