import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BrainCircuit, Clock, Compass, ShieldCheck } from "lucide-react";
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

type Section = "cognitive" | "emotional" | "personality" | "interest";
type Question = { id: string; section: Section; prompt: string; options: { value: string; label: string }[] };

const agreeOptions = [
  { value: "0", label: "Sangat tidak sesuai" }, { value: "1", label: "Kurang sesuai" },
  { value: "2", label: "Cukup sesuai" }, { value: "3", label: "Sangat sesuai" },
];
const interestOptions = [
  { value: "0", label: "Tidak tertarik" }, { value: "1", label: "Sedikit tertarik" },
  { value: "2", label: "Tertarik" }, { value: "3", label: "Sangat tertarik" },
];
const choice = (...labels: string[]) => labels.map((label, index) => ({ value: String.fromCharCode(65 + index), label }));

const questions: Question[] = [
  { id: "cog_1", section: "cognitive", prompt: "Kata yang paling dekat maknanya dengan 'cermat' adalah ...", options: choice("Cepat", "Ragu", "Teliti", "Berani") },
  { id: "cog_2", section: "cognitive", prompt: "Kompas : arah = termometer : ...", options: choice("Cuaca", "Suhu", "Panas", "Angka") },
  { id: "cog_3", section: "cognitive", prompt: "Semua anggota tim riset mencatat data. Rani anggota tim riset. Kesimpulan yang tepat adalah ...", options: choice("Rani memimpin tim", "Rani menilai data", "Rani membuat alat", "Rani mencatat data") },
  { id: "cog_4", section: "cognitive", prompt: "Lanjutkan pola: 4, 7, 13, 22, 34, ...", options: choice("43", "46", "49", "52") },
  { id: "cog_5", section: "cognitive", prompt: "Sebuah buku didiskon 20% dari Rp150.000. Harganya menjadi ...", options: choice("Rp110.000", "Rp120.000", "Rp125.000", "Rp130.000") },
  { id: "cog_6", section: "cognitive", prompt: "Rasio siswa laki-laki dan perempuan 3:5. Jika total 32 siswa, jumlah siswa perempuan adalah ...", options: choice("12", "15", "18", "20") },
  { id: "cog_7", section: "cognitive", prompt: "Jika semua A adalah B dan tidak ada B yang merupakan C, maka ...", options: choice("Semua C adalah A", "Tidak ada A yang merupakan C", "Sebagian A adalah C", "Semua B adalah A") },
  { id: "cog_8", section: "cognitive", prompt: "Dina lebih tinggi dari Sari. Sari lebih tinggi dari Nia. Siapa yang paling pendek?", options: choice("Dina", "Sari", "Nia", "Tidak dapat diketahui") },
  { id: "cog_9", section: "cognitive", prompt: "Sebuah panah menghadap utara lalu diputar 90° searah jarum jam. Panah menghadap ...", options: choice("Timur", "Barat", "Selatan", "Utara") },
  { id: "cog_10", section: "cognitive", prompt: "Kertas persegi dilipat dua secara vertikal, lalu dilubangi dekat sudut atas pada sisi lipatan. Setelah dibuka, jumlah lubang menjadi ...", options: choice("Satu", "Tiga", "Empat", "Dua") },
  { id: "eq_1", section: "emotional", prompt: "Nilai presentasimu di bawah harapan. Respons yang paling membantu adalah ...", options: choice("Menyalahkan penilai", "Menghindari presentasi berikutnya", "Menenangkan diri, meminta umpan balik, lalu menyusun latihan", "Langsung mengulang tanpa mengevaluasi") },
  { id: "eq_2", section: "emotional", prompt: "Teman satu tim terlihat diam dan mulai tertinggal. Kamu ...", options: choice("Mengambil semua tugasnya", "Menanyakan kondisinya secara pribadi dan menyepakati bantuan", "Membiarkannya", "Menegurnya di grup") },
  { id: "eq_3", section: "emotional", prompt: "Saat marah dalam diskusi, langkah terbaik adalah ...", options: choice("Mengirim pesan panjang saat itu juga", "Keluar tanpa penjelasan", "Berhenti sejenak, mengenali pemicu, lalu bicara dengan tenang", "Menyindir lawan bicara") },
  { id: "eq_4", section: "emotional", prompt: "Dua anggota kelompok berselisih. Sebagai ketua kamu ...", options: choice("Mendengar keduanya, merangkum masalah, dan mencari kesepakatan", "Memilih teman terdekat", "Mengabaikan konflik", "Memutuskan sendiri tanpa mendengar") },
  { id: "eq_5", section: "emotional", prompt: "Jadwal ujian terasa sangat padat. Kamu ...", options: choice("Belajar tanpa tidur", "Menunda sampai panik", "Mengerjakan yang termudah saja", "Menyusun prioritas, jeda realistis, dan meminta bantuan bila perlu") },
  { id: "eq_6", section: "emotional", prompt: "Seorang teman gagal seleksi yang sangat ia inginkan. Kamu ...", options: choice("Mengatakan agar segera melupakan", "Mendengarkan, mengakui perasaannya, lalu menawarkan dukungan", "Membandingkan dengan kegagalan orang lain", "Memberi banyak nasihat tanpa bertanya") },
  { id: "per_1", section: "personality", prompt: "Saya senang mencoba gagasan atau cara baru.", options: agreeOptions },
  { id: "per_2", section: "personality", prompt: "Saya lebih suka selalu memakai cara lama meskipun ada alternatif.", options: agreeOptions },
  { id: "per_3", section: "personality", prompt: "Saya membuat rencana dan berusaha menuntaskan tugas tepat waktu.", options: agreeOptions },
  { id: "per_4", section: "personality", prompt: "Saya sering meninggalkan pekerjaan sebelum selesai.", options: agreeOptions },
  { id: "per_5", section: "personality", prompt: "Saya bersemangat saat berinteraksi dengan banyak orang.", options: agreeOptions },
  { id: "per_6", section: "personality", prompt: "Saya hampir selalu menghindari menyampaikan pendapat di kelompok.", options: agreeOptions },
  { id: "per_7", section: "personality", prompt: "Saya berusaha memahami sudut pandang orang lain.", options: agreeOptions },
  { id: "per_8", section: "personality", prompt: "Saya sulit bekerja sama jika ide saya tidak dipakai.", options: agreeOptions },
  { id: "per_9", section: "personality", prompt: "Saya dapat kembali tenang setelah menghadapi tekanan.", options: agreeOptions },
  { id: "per_10", section: "personality", prompt: "Kekhawatiran kecil mudah mengganggu saya dalam waktu lama.", options: agreeOptions },
  { id: "int_1", section: "interest", prompt: "Merakit, memperbaiki, atau mengoperasikan alat.", options: interestOptions },
  { id: "int_2", section: "interest", prompt: "Melakukan kegiatan lapangan, olahraga, atau praktik langsung.", options: interestOptions },
  { id: "int_3", section: "interest", prompt: "Menyelidiki penyebab masalah melalui data atau eksperimen.", options: interestOptions },
  { id: "int_4", section: "interest", prompt: "Mempelajari sains, matematika, kesehatan, atau teknologi secara mendalam.", options: interestOptions },
  { id: "int_5", section: "interest", prompt: "Membuat desain, cerita, musik, foto, atau karya visual.", options: interestOptions },
  { id: "int_6", section: "interest", prompt: "Mengekspresikan ide dengan cara yang kreatif dan orisinal.", options: interestOptions },
  { id: "int_7", section: "interest", prompt: "Mengajar, mendampingi, atau membantu orang menyelesaikan masalah.", options: interestOptions },
  { id: "int_8", section: "interest", prompt: "Terlibat dalam kegiatan sosial atau pelayanan masyarakat.", options: interestOptions },
  { id: "int_9", section: "interest", prompt: "Memimpin tim, bernegosiasi, atau mempresentasikan gagasan.", options: interestOptions },
  { id: "int_10", section: "interest", prompt: "Membangun usaha, kampanye, atau proyek organisasi.", options: interestOptions },
  { id: "int_11", section: "interest", prompt: "Mengatur data, anggaran, jadwal, atau dokumen secara rapi.", options: interestOptions },
  { id: "int_12", section: "interest", prompt: "Bekerja dengan prosedur, detail, dan sistem yang terstruktur.", options: interestOptions },
];

const sectionInfo: Record<Section, { title: string; instruction: string }> = {
  cognitive: { title: "Potensi Penalaran", instruction: "Pilih satu jawaban yang paling tepat. Kerjakan mandiri tanpa kalkulator atau bantuan pencarian." },
  emotional: { title: "Kecerdasan Emosional", instruction: "Pilih respons yang menurutmu paling efektif dalam situasi tersebut." },
  personality: { title: "Gambaran Kepribadian", instruction: "Jawab sesuai dirimu sehari-hari, bukan jawaban yang dianggap paling baik." },
  interest: { title: "Minat Bidang", instruction: "Nilai seberapa tertarik kamu melakukan aktivitas berikut." },
};

export default function StudentPotentialTest() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, params] = useRoute("/student-potential-test/:userAssessmentId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userAssessmentId = params?.userAssessmentId ? Number(params.userAssessmentId) : null;
  const [started, setStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});

  const { data: userAssessment, isLoading } = useQuery<UserAssessmentWithDetails>({ queryKey: [`/api/user-assessments/by-id/${userAssessmentId}`], enabled: Boolean(userAssessmentId && isAuthenticated), retry: false });
  useEffect(() => { if (!authLoading && !isAuthenticated) setLocation("/login"); }, [authLoading, isAuthenticated, setLocation]);
  useEffect(() => {
    if (userAssessment?.status === "in_progress") { const saved = userAssessment.results as any; setResponses(saved?.responses ?? {}); setCurrentStep(saved?.currentStep ?? 0); setStarted(true); }
    if (userAssessment?.status === "completed") setLocation(`/results/${userAssessment.id}`);
  }, [userAssessment, setLocation]);

  const startMutation = useMutation({ mutationFn: () => apiRequest("POST", `/api/user-assessments/${userAssessment!.id}/start`), onSuccess: () => { setStarted(true); queryClient.invalidateQueries({ queryKey: [`/api/user-assessments/by-id/${userAssessmentId}`] }); }, onError: () => toast({ title: "Gagal memulai asesmen", variant: "destructive" }) });
  const saveMutation = useMutation({ mutationFn: (payload: { responses: Record<string, string>; currentStep: number }) => apiRequest("POST", `/api/user-assessments/${userAssessment!.id}/save-progress`, payload) });
  const completeMutation = useMutation({ mutationFn: async () => { const response = await apiRequest("POST", `/api/user-assessments/${userAssessment!.id}/complete`, { results: { responses, participantInfo: {} } }); return response.json(); }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/user-assessments"] }); setLocation(`/results/${userAssessment!.id}`); }, onError: () => toast({ title: "Gagal menyimpan hasil", description: "Silakan coba lagi.", variant: "destructive" }) });

  if (authLoading || isLoading) return <div className="min-h-screen bg-neutral-50"><Header /><div className="py-24 text-center">Memuat asesmen...</div><Footer /></div>;
  if (!userAssessment) return <div className="min-h-screen bg-neutral-50"><Header /><div className="py-24 text-center"><p>Asesmen tidak ditemukan atau akses belum tersedia.</p><Button className="mt-4" onClick={() => setLocation("/assessments")}>Kembali</Button></div><Footer /></div>;

  if (!started) return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background"><Header /><main className="mx-auto max-w-4xl px-4 py-12">
      <Button variant="ghost" onClick={() => setLocation("/dashboard")} className="mb-5"><ArrowLeft className="mr-2 h-4 w-4" />Kembali</Button>
      <Card><CardHeader><CardTitle className="flex items-center gap-3 text-2xl"><BrainCircuit className="h-7 w-7 text-indigo-600" />Paket Tes Intelegensi & Potensi Siswa (SMA)</CardTitle></CardHeader>
        <CardContent className="space-y-5"><p>Asesmen modern untuk memetakan penalaran, kecerdasan emosional, kecenderungan kepribadian, minat bidang studi, dan aktivitas pengembangan.</p>
          <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-indigo-50 p-4 text-sm text-indigo-900"><Clock className="mb-2 h-5 w-5" /><strong>35–45 menit</strong><br />38 pertanyaan dalam empat bagian.</div><div className="rounded-lg bg-cyan-50 p-4 text-sm text-cyan-900"><Compass className="mb-2 h-5 w-5" /><strong>Rekomendasi personal</strong><br />Bidang studi dan aktivitas berdasarkan kombinasi hasil.</div></div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><ShieldCheck className="mr-2 inline h-5 w-5" /><strong>Penting:</strong> bagian penalaran memberi gambaran potensi kognitif, bukan skor IQ formal. Pengukuran IQ formal memerlukan alat terstandar, kondisi terkontrol, dan psikolog.</div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-600"><li>Kerjakan mandiri di tempat tenang.</li><li>Jawab bagian kepribadian dan minat secara jujur.</li><li>Gunakan hasil bersama nilai akademik, aspirasi, serta diskusi dengan orang tua dan guru BK.</li></ul>
          <Button className="w-full bg-indigo-600 hover:bg-indigo-700" size="lg" onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>{startMutation.isPending ? "Memulai..." : "Mulai Asesmen"}</Button>
        </CardContent></Card>
    </main><Footer /></div>
  );

  const current = questions[currentStep];
  const section = sectionInfo[current.section];
  const selected = responses[current.id];
  const handleNext = () => {
    if (selected === undefined) return;
    if (currentStep === questions.length - 1) return completeMutation.mutate();
    const nextStep = currentStep + 1; setCurrentStep(nextStep); saveMutation.mutate({ responses, currentStep: nextStep }); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return <div className="min-h-screen bg-neutral-50 dark:bg-background"><Header /><main className="mx-auto max-w-4xl px-4 py-10">
    <div className="mb-6 flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-indigo-700">{section.title}</p><h1 className="text-2xl font-bold">Pemetaan Potensi Siswa</h1></div><span className="text-sm text-neutral-500">{currentStep + 1} / {questions.length}</span></div>
    <Progress value={((currentStep + 1) / questions.length) * 100} className="mb-6 h-2" />
    <Card><CardHeader><p className="text-sm text-neutral-500">{section.instruction}</p><CardTitle className="pt-3 text-xl leading-relaxed">{current.prompt}</CardTitle></CardHeader><CardContent className="space-y-6">
      <RadioGroup value={selected ?? ""} onValueChange={(value) => setResponses((previous) => ({ ...previous, [current.id]: value }))} className="space-y-3">{current.options.map((option) => <div key={option.value} className="flex items-center gap-3 rounded-lg border p-4 hover:bg-indigo-50/60"><RadioGroupItem value={option.value} id={`${current.id}-${option.value}`} /><Label htmlFor={`${current.id}-${option.value}`} className="flex-1 cursor-pointer">{option.label}</Label></div>)}</RadioGroup>
      <div className="flex justify-between gap-3"><Button variant="outline" onClick={() => { setCurrentStep((step) => Math.max(0, step - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }} disabled={currentStep === 0}>Sebelumnya</Button><Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleNext} disabled={selected === undefined || completeMutation.isPending}>{currentStep === questions.length - 1 ? (completeMutation.isPending ? "Menyimpan..." : "Lihat Hasil") : "Berikutnya"}</Button></div>
    </CardContent></Card>
  </main><Footer /></div>;
}
