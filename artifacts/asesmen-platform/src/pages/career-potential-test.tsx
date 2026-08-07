import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BriefcaseBusiness, Clock, Scale, ShieldCheck } from "lucide-react";
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

type Section = "cognitive" | "situational" | "competency" | "interest";
type Question = { id: string; section: Section; prompt: string; options: { value: string; label: string }[] };
const choice = (...labels: string[]) => labels.map((label, index) => ({ value: String.fromCharCode(65 + index), label }));
const scaleOptions = [
  { value: "0", label: "Sangat tidak sesuai" }, { value: "1", label: "Tidak sesuai" },
  { value: "2", label: "Cukup sesuai" }, { value: "3", label: "Sesuai" }, { value: "4", label: "Sangat sesuai" },
];
const interestOptions = [
  { value: "0", label: "Tidak tertarik" }, { value: "1", label: "Sedikit tertarik" },
  { value: "2", label: "Cukup tertarik" }, { value: "3", label: "Tertarik" }, { value: "4", label: "Sangat tertarik" },
];

const questions: Question[] = [
  { id: "career_cog_1", section: "cognitive", prompt: "KPI : target = termometer : ...", options: choice("Cuaca", "Suhu", "Angka", "Tekanan") },
  { id: "career_cog_2", section: "cognitive", prompt: "Semua laporan audit harus memiliki bukti. Laporan X tidak memiliki bukti. Kesimpulan yang paling tepat adalah ...", options: choice("Laporan X pasti salah", "Audit tidak memerlukan laporan", "Bukti dapat diabaikan", "Laporan X belum memenuhi persyaratan audit") },
  { id: "career_cog_3", section: "cognitive", prompt: "Penjualan meningkat 20% dari Rp250 juta. Nilai penjualan baru adalah ...", options: choice("Rp270 juta", "Rp280 juta", "Rp300 juta", "Rp320 juta") },
  { id: "career_cog_4", section: "cognitive", prompt: "Lima orang menyelesaikan 100 tiket dengan kontribusi sama. Rata-rata tiket per orang adalah ...", options: choice("20", "25", "50", "95") },
  { id: "career_cog_5", section: "cognitive", prompt: "Semua permintaan prioritas tinggi ditinjau manajer. Tiket A belum ditinjau manajer. Pernyataan yang pasti benar adalah ...", options: choice("Tiket A sudah selesai", "Tiket A tidak penting", "Manajer menolak tiket A", "Tiket A belum dapat dinyatakan sebagai permintaan prioritas tinggi") },
  { id: "career_cog_6", section: "cognitive", prompt: "Urutan proses adalah verifikasi → persetujuan → pembayaran. Dokumen sudah diverifikasi tetapi belum disetujui. Langkah berikutnya adalah ...", options: choice("Pembayaran", "Persetujuan", "Verifikasi ulang selalu", "Pengarsipan") },
  { id: "career_cog_7", section: "cognitive", prompt: "Keluhan pelanggan naik dari 40 menjadi 60, sementara jumlah transaksi tetap. Interpretasi awal yang paling tepat adalah ...", options: choice("Pelanggan bertambah", "Penjualan pasti turun", "Rasio keluhan meningkat dan penyebabnya perlu dianalisis", "Kualitas pasti buruk di semua produk") },
  { id: "career_cog_8", section: "cognitive", prompt: "Tahap A memproses 50 unit/jam, B 30 unit/jam, dan C 45 unit/jam. Titik hambatan utama adalah ...", options: choice("Tahap B", "Tahap A", "Tahap C", "Tidak dapat diketahui") },
  { id: "career_cog_9", section: "cognitive", prompt: "Data berikut: A-104-7, A-140-7, A-104-7, A-104-7. Entri yang berbeda adalah ...", options: choice("Entri pertama", "Entri kedua", "Entri ketiga", "Entri keempat") },
  { id: "career_cog_10", section: "cognitive", prompt: "Proyek W selesai Senin, X Rabu, Y Selasa, dan Z Jumat. Proyek yang selesai paling akhir adalah ...", options: choice("W", "X", "Y", "Z") },
  { id: "career_sjt_1", section: "situational", prompt: "Deadline besok, tetapi kamu menemukan risiko kualitas yang signifikan. Kamu ...", options: choice("Diam agar target tercapai", "Memperbaiki sendiri tanpa memberi kabar", "Segera menyampaikan risiko, dampak, opsi mitigasi, dan rekomendasi", "Menunda semua pekerjaan") },
  { id: "career_sjt_2", section: "situational", prompt: "Dua tim berbeda pendapat tentang prioritas proyek. Respons paling efektif adalah ...", options: choice("Mengikuti tim yang paling senior", "Menyelaraskan tujuan, data, dampak, dan kriteria keputusan bersama", "Membiarkan konflik selesai sendiri", "Memilih opsi tercepat tanpa analisis") },
  { id: "career_sjt_3", section: "situational", prompt: "Karyawan baru berulang kali keliru pada proses yang belum terdokumentasi. Kamu ...", options: choice("Memberi umpan balik spesifik, mengecek pemahaman, dan memperbaiki panduan", "Mengambil alih seluruh tugas", "Memberi label tidak kompeten", "Mengoreksi kesalahan tanpa penjelasan") },
  { id: "career_sjt_4", section: "situational", prompt: "Pelanggan meminta pengecualian yang melanggar kebijakan. Kamu ...", options: choice("Langsung menyetujui", "Menolak singkat tanpa alternatif", "Mengabaikan permintaan", "Menjelaskan batasan, memahami kebutuhan, lalu menawarkan opsi yang sesuai") },
  { id: "career_sjt_5", section: "situational", prompt: "Atasan meminta angka segera, tetapi data belum lengkap. Kamu ...", options: choice("Memberi estimasi tanpa label", "Membuat angka agar terlihat lengkap", "Menyampaikan data sementara beserta asumsi, keterbatasan, dan waktu finalisasi", "Menolak semua komunikasi") },
  { id: "career_sjt_6", section: "situational", prompt: "Prioritas berubah saat pekerjaan sudah berjalan. Kamu ...", options: choice("Tetap menjalankan rencana lama", "Mengonfirmasi tujuan baru, menilai dampak, lalu memperbarui rencana dan komunikasi", "Mengubah semuanya tanpa koordinasi", "Menunggu sampai ada yang mengingatkan") },
  { id: "career_sjt_7", section: "situational", prompt: "Kamu melihat potensi konflik kepentingan dalam keputusan vendor. Kamu ...", options: choice("Mengungkapkan potensi konflik dan mengikuti prosedur penanganannya", "Menyembunyikannya karena belum ada masalah", "Membahasnya sebagai gosip", "Keluar dari proyek tanpa penjelasan") },
  { id: "career_sjt_8", section: "situational", prompt: "Anggota tim berkinerja baik tetapi mulai kewalahan. Sebagai pemimpin kamu ...", options: choice("Memberi motivasi tanpa mengubah beban", "Memindahkan semua tugasnya", "Menunggu sampai target gagal", "Mendiskusikan kapasitas, prioritas, dukungan, dan pembagian beban yang realistis") },
  { id: "career_comp_1", section: "competency", prompt: "Saya menerjemahkan sasaran menjadi prioritas dan langkah kerja yang jelas.", options: scaleOptions },
  { id: "career_comp_2", section: "competency", prompt: "Saya sering membiarkan pekerjaan penting tidak selesai tanpa tindak lanjut.", options: scaleOptions },
  { id: "career_comp_3", section: "competency", prompt: "Saya berbagi informasi relevan dan melibatkan pihak yang tepat untuk mencapai hasil bersama.", options: scaleOptions },
  { id: "career_comp_4", section: "competency", prompt: "Saya cenderung mempertahankan kepentingan sendiri meskipun merugikan kerja tim.", options: scaleOptions },
  { id: "career_comp_5", section: "competency", prompt: "Saya dapat menyesuaikan rencana ketika informasi atau kebutuhan berubah.", options: scaleOptions },
  { id: "career_comp_6", section: "competency", prompt: "Perubahan kecil membuat saya sulit kembali produktif.", options: scaleOptions },
  { id: "career_comp_7", section: "competency", prompt: "Saya berusaha memahami kebutuhan pengguna sebelum menawarkan solusi.", options: scaleOptions },
  { id: "career_comp_8", section: "competency", prompt: "Saya lebih fokus menutup permintaan daripada memastikan masalah pengguna terselesaikan.", options: scaleOptions },
  { id: "career_comp_9", section: "competency", prompt: "Saya berani mengambil tanggung jawab, memberi arah, dan membantu orang lain berkembang.", options: scaleOptions },
  { id: "career_comp_10", section: "competency", prompt: "Saya menghindari keputusan tim meskipun informasi yang diperlukan sudah cukup.", options: scaleOptions },
  { id: "career_comp_11", section: "competency", prompt: "Saya menyampaikan fakta dan keterbatasan pekerjaan secara jujur meskipun tidak nyaman.", options: scaleOptions },
  { id: "career_comp_12", section: "competency", prompt: "Menurut saya, melewati prosedur dapat dibenarkan selama hasil terlihat baik.", options: scaleOptions },
  { id: "career_int_1", section: "interest", prompt: "Menganalisis data untuk menemukan pola dan rekomendasi.", options: interestOptions },
  { id: "career_int_2", section: "interest", prompt: "Menyelidiki akar masalah yang kompleks.", options: interestOptions },
  { id: "career_int_3", section: "interest", prompt: "Mendampingi orang belajar, berkembang, atau menyelesaikan masalah.", options: interestOptions },
  { id: "career_int_4", section: "interest", prompt: "Membangun pengalaman pelanggan atau karyawan yang lebih baik.", options: interestOptions },
  { id: "career_int_5", section: "interest", prompt: "Mengatur proses, jadwal, sumber daya, dan detail pelaksanaan.", options: interestOptions },
  { id: "career_int_6", section: "interest", prompt: "Meningkatkan efisiensi dan konsistensi operasional.", options: interestOptions },
  { id: "career_int_7", section: "interest", prompt: "Bernegosiasi dan membangun relasi bisnis.", options: interestOptions },
  { id: "career_int_8", section: "interest", prompt: "Mengejar peluang pasar, penjualan, atau kemitraan.", options: interestOptions },
  { id: "career_int_9", section: "interest", prompt: "Merancang produk, layanan, atau cara kerja baru.", options: interestOptions },
  { id: "career_int_10", section: "interest", prompt: "Menguji ide melalui eksperimen dan umpan balik pengguna.", options: interestOptions },
  { id: "career_int_11", section: "interest", prompt: "Menetapkan arah dan menyelaraskan orang pada tujuan bersama.", options: interestOptions },
  { id: "career_int_12", section: "interest", prompt: "Memimpin keputusan dan perubahan lintas fungsi.", options: interestOptions },
];

const sectionInfo: Record<Section, { title: string; instruction: string }> = {
  cognitive: { title: "Penalaran Kerja", instruction: "Pilih satu jawaban paling tepat. Kerjakan mandiri tanpa kalkulator atau pencarian." },
  situational: { title: "Situational Judgment", instruction: "Pilih respons yang paling efektif berdasarkan informasi yang tersedia." },
  competency: { title: "Kompetensi Perilaku", instruction: "Jawab sesuai perilaku yang paling sering kamu tunjukkan, bukan jawaban ideal." },
  interest: { title: "Preferensi Peran", instruction: "Nilai ketertarikanmu melakukan aktivitas kerja berikut." },
};

export default function CareerPotentialTest() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, params] = useRoute("/career-potential-test/:userAssessmentId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userAssessmentId = params?.userAssessmentId ? Number(params.userAssessmentId) : null;
  const [started, setStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const { data: userAssessment, isLoading } = useQuery<UserAssessmentWithDetails>({ queryKey: [`/api/user-assessments/by-id/${userAssessmentId}`], enabled: Boolean(userAssessmentId && isAuthenticated), retry: false });
  useEffect(() => { if (!authLoading && !isAuthenticated) setLocation("/login"); }, [authLoading, isAuthenticated, setLocation]);
  useEffect(() => { if (userAssessment?.status === "in_progress") { const saved = userAssessment.results as any; setResponses(saved?.responses ?? {}); setCurrentStep(saved?.currentStep ?? 0); setStarted(true); } if (userAssessment?.status === "completed") setLocation(`/results/${userAssessment.id}`); }, [userAssessment, setLocation]);
  const startMutation = useMutation({ mutationFn: () => apiRequest("POST", `/api/user-assessments/${userAssessment!.id}/start`), onSuccess: () => { setStarted(true); queryClient.invalidateQueries({ queryKey: [`/api/user-assessments/by-id/${userAssessmentId}`] }); }, onError: () => toast({ title: "Gagal memulai asesmen", variant: "destructive" }) });
  const saveMutation = useMutation({ mutationFn: (payload: { responses: Record<string, string>; currentStep: number }) => apiRequest("POST", `/api/user-assessments/${userAssessment!.id}/save-progress`, payload) });
  const completeMutation = useMutation({ mutationFn: async () => { const response = await apiRequest("POST", `/api/user-assessments/${userAssessment!.id}/complete`, { results: { responses, participantInfo: {} } }); return response.json(); }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/user-assessments"] }); setLocation(`/results/${userAssessment!.id}`); }, onError: () => toast({ title: "Gagal menyimpan hasil", description: "Silakan coba lagi.", variant: "destructive" }) });
  if (authLoading || isLoading) return <div className="min-h-screen bg-neutral-50"><Header /><div className="py-24 text-center">Memuat asesmen...</div><Footer /></div>;
  if (!userAssessment) return <div className="min-h-screen bg-neutral-50"><Header /><div className="py-24 text-center"><p>Asesmen tidak ditemukan atau akses belum tersedia.</p><Button className="mt-4" onClick={() => setLocation("/assessments")}>Kembali</Button></div><Footer /></div>;
  if (!started) return <div className="min-h-screen bg-neutral-50 dark:bg-background"><Header /><main className="mx-auto max-w-4xl px-4 py-12"><Button variant="ghost" onClick={() => setLocation("/dashboard")} className="mb-5"><ArrowLeft className="mr-2 h-4 w-4" />Kembali</Button><Card><CardHeader><CardTitle className="flex items-center gap-3 text-2xl"><BriefcaseBusiness className="h-7 w-7 text-emerald-700" />Tes Potensi Karir (Perusahaan)</CardTitle></CardHeader><CardContent className="space-y-5"><p>Pemetaan awal potensi kerja untuk mendukung pengembangan karyawan dan proses talent management yang lebih terstruktur.</p><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900"><Clock className="mb-2 h-5 w-5" /><strong>40–50 menit</strong><br />42 pertanyaan dalam empat bagian.</div><div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900"><Scale className="mb-2 h-5 w-5" /><strong>Keputusan tetap oleh manusia</strong><br />Tidak ada status lulus/gagal atau ranking otomatis.</div></div><div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><ShieldCheck className="mr-2 inline h-5 w-5" /><strong>Penting:</strong> hasil bukan alat tunggal untuk rekrutmen, promosi, evaluasi kinerja, atau pengembangan. Organisasi perlu memastikan relevansi dengan jabatan, validitas penggunaan, aksesibilitas, dan pemeriksaan potensi bias.</div><ul className="list-disc space-y-1 pl-5 text-sm text-neutral-600"><li>Kerjakan mandiri di tempat yang tenang.</li><li>Jawab perilaku dan minat sesuai kondisi sebenarnya.</li><li>Hasil perlu dipadukan dengan wawancara terstruktur, simulasi kerja, dan bukti kinerja.</li></ul><Button className="w-full bg-emerald-700 hover:bg-emerald-800" size="lg" onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>{startMutation.isPending ? "Memulai..." : "Mulai Asesmen"}</Button></CardContent></Card></main><Footer /></div>;
  const current = questions[currentStep]; const section = sectionInfo[current.section]; const selected = responses[current.id];
  const handleNext = () => { if (selected === undefined) return; if (currentStep === questions.length - 1) return completeMutation.mutate(); const nextStep = currentStep + 1; setCurrentStep(nextStep); saveMutation.mutate({ responses, currentStep: nextStep }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  return <div className="min-h-screen bg-neutral-50 dark:bg-background"><Header /><main className="mx-auto max-w-4xl px-4 py-10"><div className="mb-6 flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-emerald-700">{section.title}</p><h1 className="text-2xl font-bold">Tes Potensi Karir</h1></div><span className="text-sm text-neutral-500">{currentStep + 1} / {questions.length}</span></div><Progress value={((currentStep + 1) / questions.length) * 100} className="mb-6 h-2" /><Card><CardHeader><p className="text-sm text-neutral-500">{section.instruction}</p><CardTitle className="pt-3 text-xl leading-relaxed">{current.prompt}</CardTitle></CardHeader><CardContent className="space-y-6"><RadioGroup value={selected ?? ""} onValueChange={(value) => setResponses((previous) => ({ ...previous, [current.id]: value }))} className="space-y-3">{current.options.map((option) => <div key={option.value} className="flex items-center gap-3 rounded-lg border p-4 hover:bg-emerald-50/60"><RadioGroupItem value={option.value} id={`${current.id}-${option.value}`} /><Label htmlFor={`${current.id}-${option.value}`} className="flex-1 cursor-pointer">{option.label}</Label></div>)}</RadioGroup><div className="flex justify-between gap-3"><Button variant="outline" onClick={() => { setCurrentStep((step) => Math.max(0, step - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }} disabled={currentStep === 0}>Sebelumnya</Button><Button className="bg-emerald-700 hover:bg-emerald-800" onClick={handleNext} disabled={selected === undefined || completeMutation.isPending}>{currentStep === questions.length - 1 ? (completeMutation.isPending ? "Menyimpan..." : "Lihat Hasil") : "Berikutnya"}</Button></div></CardContent></Card></main><Footer /></div>;
}
