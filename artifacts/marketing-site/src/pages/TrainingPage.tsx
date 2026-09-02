import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Clock3, Loader2, MapPin } from "lucide-react";
import { Link, useRoute } from "wouter";
import { SiWhatsapp } from "react-icons/si";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getAsesmenPlatformHref } from "@/lib/platform-links";

type TrainingOption = { id: number; name: string; description?: string | null; price: string; capacity?: number | null };
type Training = {
  id: number; slug: string; title: string; summary: string; description: string; startsAt?: string | null;
  endsAt?: string | null; location?: string | null; registrationDeadline?: string | null; status: "published" | "closed" | "completed";
  posterId?: number | null; posterFocusX?: number | null; posterFocusY?: number | null; options: TrainingOption[];
};
type Testimonial = { id: number; name: string; occupation?: string | null; trainingName?: string | null; testimonial: string };
type GalleryImage = { id: number; title?: string | null; caption?: string | null; focusX: number; focusY: number };
type TestimonialSettings = { hasBackground: boolean; backgroundFocusX: number; backgroundFocusY: number; instagramUrl?: string | null; updatedAt?: string | null };

function apiBase() {
  if (import.meta.env.VITE_ASESMEN_API_URL) return String(import.meta.env.VITE_ASESMEN_API_URL).replace(/\/$/, "");
  return window.location.hostname === "localhost" ? "http://localhost:5001" : "https://asesmen.pi-psychology.com";
}

function formatDate(value?: string | null) {
  if (!value) return "Jadwal akan diumumkan";
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function formatTime(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
}

function money(value: string | number) {
  return `Rp ${new Intl.NumberFormat("id-ID").format(Number(value) || 0)}`;
}

function posterUrl(id: number) { return `${apiBase()}/api/trainings/posters/${id}`; }
function galleryUrl(id: number) { return `${apiBase()}/api/trainings/gallery/images/${id}`; }
function isTrainingCompleted(training: Training) {
  if (training.status === "completed") return true;
  const finishedAt = training.endsAt || training.startsAt;
  return Boolean(finishedAt && new Date(finishedAt).getTime() < Date.now());
}

function TrainingCard({ training }: { training: Training }) {
  return <Link href={`/produk-layanan/pelatihan/${training.slug}`} className="group overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100 transition hover:-translate-y-1 hover:shadow-xl">
    <div className="aspect-[4/5] overflow-hidden bg-green-50">{training.posterId ? <img src={posterUrl(training.posterId)} alt={`Poster ${training.title}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" style={{ objectPosition: `${training.posterFocusX ?? 50}% ${training.posterFocusY ?? 50}%` }} /> : <div className="flex h-full w-full items-center justify-center font-bold text-green-800">Agenda Pelatihan</div>}</div>
    <div className="p-5"><h3 className="text-xl font-extrabold text-gray-950 group-hover:text-green-800">{training.title}</h3></div>
  </Link>;
}

function TrainingDetail({ slug }: { slug: string }) {
  const { data: training, isLoading } = useQuery<Training>({
    queryKey: ["training", slug],
    queryFn: async () => { const response = await fetch(`${apiBase()}/api/trainings/${encodeURIComponent(slug)}`); if (!response.ok) throw new Error("Agenda tidak ditemukan"); return response.json(); },
  });
  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-green-700" /></div>;
  if (!training) return <div className="min-h-screen bg-white"><Navbar /><main className="mx-auto max-w-4xl px-4 pb-20 pt-36 text-center"><h1 className="text-3xl font-bold">Agenda tidak ditemukan</h1></main><Footer /></div>;
  const isCompleted = isTrainingCompleted(training);
  const registerHref = `${getAsesmenPlatformHref().replace(/\/$/, "")}/training/register?training=${encodeURIComponent(training.slug)}`;
  const whatsappText = encodeURIComponent(`Halo Admin Pelangi Indonesia, saya ingin bertanya tentang pelatihan ${training.title}.`);
  return <div className="min-h-screen bg-gray-50">
    <Navbar />
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">
      <Link href="/produk-layanan/pelatihan" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-green-800"><ArrowLeft size={17} /> Kembali ke Agenda Pelatihan</Link>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100">
          <div className="aspect-[4/5] bg-green-50">{training.posterId ? <img src={posterUrl(training.posterId)} alt={`Poster ${training.title}`} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-xl font-bold text-green-800">Agenda Pelatihan</div>}</div>
        </div>
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100 sm:p-9">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${!isCompleted && training.status === "published" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>{isCompleted ? "Pelatihan Selesai" : training.status === "published" ? "Pendaftaran Dibuka" : "Pendaftaran Ditutup"}</span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight text-gray-950 sm:text-4xl">{training.title}</h1>
          <p className="mt-4 text-lg leading-8 text-gray-600">{training.summary}</p>
          <div className="mt-7 grid gap-3 rounded-2xl bg-green-50 p-5 text-sm text-green-950 sm:grid-cols-2">
            <div className="flex gap-3"><CalendarDays className="shrink-0 text-green-700" size={20} /><span>{formatDate(training.startsAt)}</span></div>
            <div className="flex gap-3"><Clock3 className="shrink-0 text-green-700" size={20} /><span>{formatTime(training.startsAt)}{training.endsAt ? ` - ${formatTime(training.endsAt)}` : ""}</span></div>
            {training.location && <div className="flex gap-3 sm:col-span-2"><MapPin className="shrink-0 text-green-700" size={20} /><span>{training.location}</span></div>}
          </div>
          <div className="mt-8"><h2 className="text-xl font-extrabold text-green-950">Tentang Pelatihan</h2><div className="mt-3 whitespace-pre-line leading-7 text-gray-600">{training.description}</div></div>
          {training.options.length > 0 && <div className="mt-8"><h2 className="text-xl font-extrabold text-green-950">Pilihan Agenda</h2><div className="mt-3 space-y-3">{training.options.map(option => <div key={option.id} className="flex items-start justify-between gap-4 rounded-xl border border-green-100 p-4"><div><p className="font-bold">{option.name}</p>{option.description && <p className="mt-1 text-sm text-gray-500">{option.description}</p>}</div><p className="shrink-0 font-extrabold text-green-800">{money(option.price)}</p></div>)}</div></div>}
          <div className="mt-9 grid gap-3 sm:grid-cols-2">
            <a href={`https://wa.me/6285117658242?text=${whatsappText}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3.5 font-bold text-white"><SiWhatsapp /> Hubungi Admin</a>
            {!isCompleted && training.status === "published" ? <a href={registerHref} className="inline-flex items-center justify-center rounded-xl bg-green-800 px-5 py-3.5 font-bold text-white hover:bg-green-900">Daftar Sekarang</a> : <span className="inline-flex items-center justify-center rounded-xl bg-gray-200 px-5 py-3.5 font-bold text-gray-500">{isCompleted ? "Pelatihan Selesai" : "Pendaftaran Ditutup"}</span>}
          </div>
        </section>
      </div>
    </main><Footer />
  </div>;
}

function Slider({ children, count, index, setIndex, label }: { children: ReactNode; count: number; index: number; setIndex: (value: number) => void; label: string }) {
  return <div className="relative">
    {children}
    {count > 1 && <><button type="button" aria-label={`${label} sebelumnya`} onClick={() => setIndex((index - 1 + count) % count)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow"><ChevronLeft /></button><button type="button" aria-label={`${label} berikutnya`} onClick={() => setIndex((index + 1) % count)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow"><ChevronRight /></button></>}
  </div>;
}

export default function TrainingPage() {
  const [matchDetail, params] = useRoute("/produk-layanan/pelatihan/:trainingSlug");
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [heroAvailable, setHeroAvailable] = useState(true);
  const timer = useRef<number | null>(null);
  const { data: trainings = [], isLoading } = useQuery<Training[]>({ queryKey: ["trainings"], queryFn: async () => (await fetch(`${apiBase()}/api/trainings`)).json(), enabled: !matchDetail });
  const { data: testimonials = [] } = useQuery<Testimonial[]>({ queryKey: ["training-testimonials"], queryFn: async () => (await fetch(`${apiBase()}/api/trainings/testimonials`)).json(), enabled: !matchDetail });
  const { data: testimonialSettings } = useQuery<TestimonialSettings>({ queryKey: ["training-testimonial-settings"], queryFn: async () => { const response = await fetch(`${apiBase()}/api/trainings/testimonial-settings`); if (!response.ok) throw new Error("Pengaturan testimoni tidak tersedia"); return response.json(); }, enabled: !matchDetail });
  const { data: gallery = [] } = useQuery<GalleryImage[]>({ queryKey: ["training-gallery"], queryFn: async () => (await fetch(`${apiBase()}/api/trainings/gallery`)).json(), enabled: !matchDetail });
  useEffect(() => { if (gallery.length < 2) return; timer.current = window.setInterval(() => setGalleryIndex(current => (current + 1) % gallery.length), 4000); return () => { if (timer.current) window.clearInterval(timer.current); }; }, [gallery.length]);
  const currentTrainings = trainings.filter(training => !isTrainingCompleted(training));
  const completedTrainings = trainings.filter(isTrainingCompleted);
  if (matchDetail && params?.trainingSlug) return <TrainingDetail slug={params.trainingSlug} />;
  return <div className="min-h-screen bg-white"><Navbar />
    <header className="relative isolate flex min-h-[420px] items-center justify-center overflow-hidden bg-gradient-to-br from-green-950 via-green-900 to-emerald-700 pt-24 text-center text-white">
      <div className="mx-auto max-w-4xl px-4"><p className="mb-4 text-sm font-bold uppercase tracking-[.3em] text-green-200">Pelangi Indonesia Group</p><h1 className="text-5xl font-black sm:text-6xl">Agenda Pelatihan</h1><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-green-50">Workshop dan webinar profesional untuk orang tua, pendidik, terapis, serta masyarakat umum.</p></div>
    </header>
    <main>
      {heroAvailable && <section className="bg-white px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-gray-50 shadow-sm ring-1 ring-gray-100">
          <img src={`${apiBase()}/api/trainings/hero`} alt="Banner Agenda Pelatihan" className="block h-auto w-full object-contain" onError={() => setHeroAvailable(false)} />
        </div>
      </section>}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><div className="mb-10"><p className="font-bold uppercase tracking-wider text-green-700">Program Terkini</p><h2 className="mt-2 text-3xl font-extrabold text-gray-950">Pilih pelatihan yang sesuai</h2></div>
        {isLoading ? <Loader2 className="mx-auto animate-spin text-green-700" /> : currentTrainings.length === 0 ? <div className="rounded-2xl bg-green-50 p-12 text-center text-green-900">Agenda pelatihan sedang disiapkan.</div> : <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">{currentTrainings.map(training => <TrainingCard key={training.id} training={training} />)}</div>}
      </section>
      <section className="bg-gray-50 py-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="mb-10"><p className="font-bold uppercase tracking-wider text-green-700">Dokumentasi Program</p><h2 className="mt-2 text-3xl font-extrabold text-gray-950">Pelatihan yang Telah Selesai</h2><p className="mt-3 max-w-2xl text-gray-500">Lihat kembali program pelatihan yang telah diselenggarakan oleh Pelangi Indonesia Group.</p></div>
        {isLoading ? <Loader2 className="mx-auto animate-spin text-green-700" /> : completedTrainings.length === 0 ? <div className="rounded-2xl bg-white p-12 text-center text-gray-500 ring-1 ring-gray-100">Belum ada pelatihan selesai yang ditampilkan.</div> : <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">{completedTrainings.map(training => <TrainingCard key={training.id} training={training} />)}</div>}
      </div></section>
      {testimonials.length > 0 && <section className="relative isolate overflow-hidden bg-[#f4eadb] py-20 text-stone-900">
        {testimonialSettings?.hasBackground && <img src={`${apiBase()}/api/trainings/testimonial-background?v=${encodeURIComponent(testimonialSettings.updatedAt || "")}`} alt="" aria-hidden="true" className="absolute inset-0 -z-20 h-full w-full object-cover" style={{objectPosition:`${testimonialSettings.backgroundFocusX ?? 50}% ${testimonialSettings.backgroundFocusY ?? 50}%`}}/>}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#ead8bc]/72 via-[#f5ead9]/58 to-white/72"/>
        <div className="mx-auto max-w-4xl px-4 text-center">
          <p className="font-bold uppercase tracking-wider text-amber-900">Testimoni Pelatihan</p>
          <h2 className="mt-2 text-3xl font-extrabold text-stone-950">Cerita dari para peserta</h2>
          {testimonialSettings?.instagramUrl && <p className="mt-2 text-sm font-medium text-stone-700">kata mereka tentang kami (<a href={testimonialSettings.instagramUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-green-800 underline decoration-green-500 underline-offset-4 hover:text-green-950">klik di sini</a>)</p>}
          <Slider count={testimonials.length} index={testimonialIndex} setIndex={setTestimonialIndex} label="Testimoni"><div className="mt-10 rounded-3xl border border-white/80 bg-white/70 px-14 py-10 shadow-xl shadow-amber-950/10 backdrop-blur-sm"><p className="text-xl leading-9 text-stone-800">“{testimonials[testimonialIndex].testimonial}”</p><p className="mt-6 font-extrabold text-stone-950">{testimonials[testimonialIndex].name}</p><p className="text-sm text-stone-600">{[testimonials[testimonialIndex].occupation, testimonials[testimonialIndex].trainingName].filter(Boolean).join(" · ")}</p></div></Slider>
        </div>
      </section>}
      {gallery.length > 0 && <section className="mx-auto max-w-6xl px-4 py-20 text-center"><p className="font-bold uppercase tracking-wider text-green-700">Galeri Foto</p><h2 className="mt-2 text-3xl font-extrabold">Kegiatan yang telah berlangsung</h2><div className="mt-10 overflow-hidden rounded-3xl bg-gray-100 shadow-lg"><Slider count={gallery.length} index={galleryIndex} setIndex={setGalleryIndex} label="Galeri"><div className="aspect-video"><img src={galleryUrl(gallery[galleryIndex].id)} alt={gallery[galleryIndex].title || "Galeri pelatihan"} className="h-full w-full object-cover" style={{ objectPosition: `${gallery[galleryIndex].focusX}% ${gallery[galleryIndex].focusY}%` }} /></div></Slider></div>{(gallery[galleryIndex].title || gallery[galleryIndex].caption) && <div className="mt-4"><p className="font-bold">{gallery[galleryIndex].title}</p><p className="text-gray-500">{gallery[galleryIndex].caption}</p></div>}</section>}
    </main><Footer /></div>;
}
