import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Loader2, MapPin } from "lucide-react";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api-base";

type TrainingOption = { id: number; name: string; description?: string | null; price: string; capacity?: number | null };
type Training = { id: number; slug: string; title: string; summary: string; startsAt?: string | null; endsAt?: string | null; location?: string | null; status: string; posterId?: number | null; options: TrainingOption[] };
type Participant = { fullName: string; birthDate: string; gender: string; address: string; whatsappNumber: string; email: string; education: string; occupation: string };
const emptyParticipant: Participant = { fullName: "", birthDate: "", gender: "", address: "", whatsappNumber: "", email: "", education: "", occupation: "" };

function money(value: string | number) { return `Rp ${new Intl.NumberFormat("id-ID").format(Number(value) || 0)}`; }
function formatDate(value?: string | null) { return value ? new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "Jadwal akan diumumkan"; }

export default function TrainingRegistration() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const slug = new URLSearchParams(window.location.search).get("training") || "";
  const [step, setStep] = useState(1);
  const [participant, setParticipant] = useState<Participant>(emptyParticipant);
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      const redirect = `${window.location.pathname}${window.location.search}`;
      window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`;
    }
  }, [authLoading, isAuthenticated]);

  const { data: training, isLoading, isError, error, refetch } = useQuery<Training>({
    queryKey: ["training-registration", slug],
    queryFn: async () => {
      const response = await fetch(apiUrl(`/api/trainings/${encodeURIComponent(slug)}`));
      if (response.status === 404) throw new Error("Agenda pelatihan tidak ditemukan.");
      if (!response.ok) throw new Error("Agenda pelatihan gagal dimuat.");
      return response.json();
    },
    enabled: Boolean(slug),
  });
  const { data: profile } = useQuery<Participant>({ queryKey: ["/api/training-registrations/profile"], enabled: isAuthenticated });
  useEffect(() => { if (profile) setParticipant(current => ({ ...current, ...Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, value || current[key as keyof Participant]])) })); }, [profile]);
  useEffect(() => { if (training?.options.length === 1) setSelectedOptionId(training.options[0].id); }, [training]);

  const option = useMemo(() => training?.options.find(item => item.id === selectedOptionId), [training, selectedOptionId]);
  const submit = useMutation({
    mutationFn: async () => {
      const registrationResponse = await apiRequest("POST", "/api/training-registrations", { trainingId: training!.id, optionId: selectedOptionId, participant });
      const registration = await registrationResponse.json();
      const paymentResponse = await apiRequest("POST", "/api/payments/create", { orderId: registration.orderId, paymentMethod: "midtrans" });
      return paymentResponse.json();
    },
    onSuccess: payment => { if (payment.redirect_url) window.location.href = payment.redirect_url; else toast({ title: "Pembayaran siap", description: "Silakan lanjutkan pembayaran melalui Midtrans." }); },
    onError: error => toast({ title: "Pendaftaran gagal", description: error instanceof Error ? error.message : "Silakan coba lagi.", variant: "destructive" }),
  });

  if (authLoading || !isAuthenticated || isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-green-700" /></div>;
  if (isError) return <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center"><p className="text-lg font-semibold">{error instanceof Error ? error.message : "Agenda pelatihan gagal dimuat."}</p><Button variant="outline" onClick={() => refetch()}>Coba Lagi</Button></div>;
  if (!training) return <div className="p-12 text-center">Agenda pelatihan tidak ditemukan.</div>;
  const finishedAt = training.endsAt || training.startsAt;
  const isRegistrationClosed = training.status !== "published" || Boolean(finishedAt && new Date(finishedAt).getTime() < Date.now());
  if (isRegistrationClosed) return <div className="min-h-screen bg-gray-50"><Header/><main className="container mx-auto max-w-3xl px-4 py-20 text-center"><Card><CardContent className="py-12"><h1 className="text-2xl font-extrabold">Pendaftaran pelatihan telah ditutup</h1><p className="mt-3 text-gray-500">Agenda ini sudah selesai atau tidak lagi menerima pendaftaran.</p><a href={`https://pi-psychology.com/produk-layanan/pelatihan/${training.slug}`} className="mt-6 inline-flex items-center gap-2 font-semibold text-green-700"><ArrowLeft size={17}/> Kembali ke detail pelatihan</a></CardContent></Card></main><Footer/></div>;
  const participantValid = participant.fullName.length >= 2 && participant.birthDate && participant.gender && participant.address.length >= 5 && participant.whatsappNumber.length >= 7 && participant.email.includes("@") && participant.education.length >= 2 && participant.occupation.length >= 2;

  const update = (key: keyof Participant, value: string) => setParticipant(current => ({ ...current, [key]: value }));
  return <div className="min-h-screen bg-gray-50"><Header />
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <a href={`https://pi-psychology.com/produk-layanan/pelatihan/${training.slug}`} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-green-700"><ArrowLeft size={17} /> Kembali ke detail pelatihan</a>
      <div className="grid gap-7 lg:grid-cols-[.72fr_1.28fr]">
        <aside><Card className="sticky top-6 overflow-hidden"><div className="aspect-[4/3] bg-green-50">{training.posterId ? <img src={apiUrl(`/api/trainings/posters/${training.posterId}`)} alt="" className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center font-bold text-green-800">Agenda Pelatihan</div>}</div><CardContent className="space-y-4 pt-6"><h1 className="text-2xl font-extrabold">{training.title}</h1><p className="text-sm leading-6 text-gray-500">{training.summary}</p><div className="flex gap-2 text-sm"><CalendarDays size={18} className="shrink-0 text-green-700" />{formatDate(training.startsAt)}</div>{training.location && <div className="flex gap-2 text-sm"><MapPin size={18} className="shrink-0 text-green-700" />{training.location}</div>}</CardContent></Card></aside>
        <section>
          <div className="mb-6 grid grid-cols-3 gap-2">{["Data Diri", "Pilihan Agenda", "Pembayaran"].map((label, index) => <div key={label} className={`rounded-xl px-2 py-3 text-center text-xs font-bold sm:text-sm ${step >= index + 1 ? "bg-green-700 text-white" : "bg-white text-gray-400"}`}><span className="mr-1">{step > index + 1 ? <Check className="inline h-4 w-4" /> : index + 1}.</span> {label}</div>)}</div>
          {step === 1 && <Card><CardHeader><CardTitle>Form 1: Data Diri</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Nama lengkap beserta gelar</Label><Input value={participant.fullName} onChange={e => update("fullName", e.target.value)} /></div>
            <div><Label>Tanggal lahir</Label><Input type="date" value={participant.birthDate} onChange={e => update("birthDate", e.target.value)} /></div>
            <div><Label>Jenis kelamin</Label><select value={participant.gender} onChange={e => update("gender", e.target.value)} className="h-10 w-full rounded-md border bg-white px-3 text-sm"><option value="">Pilih</option><option value="Laki-laki">Laki-laki</option><option value="Perempuan">Perempuan</option></select></div>
            <div className="sm:col-span-2"><Label>Alamat domisili</Label><Textarea value={participant.address} onChange={e => update("address", e.target.value)} /></div>
            <div><Label>Nomor WhatsApp</Label><Input value={participant.whatsappNumber} onChange={e => update("whatsappNumber", e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={participant.email} onChange={e => update("email", e.target.value)} /></div>
            <div><Label>Pendidikan terakhir</Label><Input value={participant.education} onChange={e => update("education", e.target.value)} /></div>
            <div><Label>Pekerjaan saat ini</Label><Input value={participant.occupation} onChange={e => update("occupation", e.target.value)} /></div>
            <div className="sm:col-span-2 flex justify-end"><Button disabled={!participantValid} className="bg-green-700 hover:bg-green-800" onClick={() => setStep(2)}>Lanjutkan <ArrowRight className="ml-2 h-4 w-4" /></Button></div>
          </CardContent></Card>}
          {step === 2 && <Card><CardHeader><CardTitle>Form 2: Pilihan Agenda</CardTitle></CardHeader><CardContent className="space-y-4">{training.options.length === 0 ? <p className="text-gray-500">Pilihan agenda belum tersedia.</p> : training.options.map(item => <button key={item.id} type="button" onClick={() => setSelectedOptionId(item.id)} className={`w-full rounded-2xl border p-5 text-left transition ${selectedOptionId === item.id ? "border-green-700 bg-green-50 ring-2 ring-green-100" : "hover:border-green-300"}`}><div className="flex justify-between gap-4"><div><p className="font-extrabold">{item.name}</p>{item.description && <p className="mt-1 text-sm text-gray-500">{item.description}</p>}</div><p className="shrink-0 font-extrabold text-green-700">{money(item.price)}</p></div></button>)}<div className="flex justify-between pt-3"><Button variant="outline" onClick={() => setStep(1)}>Kembali</Button><Button disabled={!selectedOptionId} className="bg-green-700 hover:bg-green-800" onClick={() => setStep(3)}>Lanjutkan <ArrowRight className="ml-2 h-4 w-4" /></Button></div></CardContent></Card>}
          {step === 3 && <Card><CardHeader><CardTitle>Form 3: Pembayaran</CardTitle></CardHeader><CardContent className="space-y-5"><div className="rounded-2xl bg-green-50 p-5"><div className="flex justify-between gap-4"><span>Pelatihan</span><strong className="text-right">{training.title}</strong></div><div className="mt-3 flex justify-between gap-4"><span>Pilihan</span><strong>{option?.name}</strong></div><div className="mt-5 flex justify-between border-t border-green-200 pt-5 text-xl"><strong>Total Pembayaran</strong><strong className="text-green-800">{money(option?.price || 0)}</strong></div></div><p className="text-sm leading-6 text-gray-500">Setelah pembayaran berhasil, informasi pendaftaran dapat dilihat pada dashboard Anda.</p><div className="flex justify-between"><Button variant="outline" onClick={() => setStep(2)}>Kembali</Button><Button disabled={!option || submit.isPending} className="bg-green-700 hover:bg-green-800" onClick={() => submit.mutate()}>{submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Bayar dengan Midtrans</Button></div></CardContent></Card>}
        </section>
      </div>
    </main><Footer /></div>;
}
