import { useEffect, useRef, useState, type ComponentType, type FocusEvent, type TouchEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowLeft, ArrowRight, Brain, Camera, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, HeartHandshake, MessagesSquare, Puzzle } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Link, useRoute } from "wouter";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type TherapyCategory = {
  slug: string;
  title: string;
  description: string;
  introduction: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
  iconStyle: string;
  availability: string;
  services: string[];
};

type DevelopmentTherapy = {
  title: string;
  price: string;
  focus: string;
  target: string;
  benefits: string[];
  icon: ComponentType<{ className?: string }>;
  accent: string;
};

type PsychotherapyMethod = {
  title: string;
  description: string;
  fullDescription: string;
  conditions?: string[];
  sections?: Array<{ title: string; description: string; conditions: string[] }>;
};

type TherapyGalleryImage = {
  id: number;
  fileName: string;
  title: string | null;
  caption: string | null;
  sortOrder: number;
  focusX: number;
  focusY: number;
};

function therapyApiBase() {
  if (import.meta.env.VITE_ASESMEN_API_URL) return String(import.meta.env.VITE_ASESMEN_API_URL).replace(/\/$/, "");
  return window.location.hostname === "localhost" ? "http://localhost:5001" : "https://asesmen.pi-psychology.com";
}

function therapyGalleryImageUrl(imageId: number) {
  return `${therapyApiBase()}/api/therapy-gallery/images/${imageId}`;
}

function TherapyGallery() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [timerKey, setTimerKey] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const { data: images = [] } = useQuery<TherapyGalleryImage[]>({
    queryKey: ["therapy-gallery"],
    queryFn: async () => {
      const response = await fetch(`${therapyApiBase()}/api/therapy-gallery`);
      if (!response.ok) throw new Error("Gagal memuat galeri terapi");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    if (activeIndex >= images.length) setActiveIndex(0);
  }, [activeIndex, images.length]);

  useEffect(() => {
    if (images.length <= 1 || isPaused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = window.setInterval(() => setActiveIndex((current) => (current + 1) % images.length), 4000);
    return () => window.clearInterval(interval);
  }, [images.length, isPaused, timerKey]);

  if (images.length === 0) return null;
  const activeImage = images[activeIndex] ?? images[0];

  const move = (direction: -1 | 1) => {
    setActiveIndex((current) => (current + direction + images.length) % images.length);
    setTimerKey((current) => current + 1);
  };

  const select = (index: number) => {
    setActiveIndex(index);
    setTimerKey((current) => current + 1);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
    setIsPaused(true);
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    setIsPaused(false);
    if (touchStartX.current === null) return;
    const distance = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) >= 40) move(distance < 0 ? 1 : -1);
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsPaused(false);
  };

  return (
    <section className="mx-auto mt-14 max-w-6xl overflow-hidden rounded-3xl bg-white p-6 shadow-lg ring-1 ring-black/5 sm:p-8 lg:p-10">
      <div className="mb-7 max-w-3xl">
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-green-700"><Camera className="h-4 w-4" />Galeri Terapi</p>
        <h2 className="mt-2 text-3xl font-extrabold text-gray-900">Pendampingan dalam suasana yang aman dan nyaman</h2>
        <p className="mt-3 leading-7 text-gray-600">Dokumentasi kegiatan terapi Pelangi Indonesia yang dilaksanakan bersama tenaga profesional.</p>
      </div>
      <div
        className="relative"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocusCapture={() => setIsPaused(true)}
        onBlurCapture={handleBlur}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => { touchStartX.current = null; setIsPaused(false); }}
      >
        <div className="relative aspect-[16/10] touch-pan-y overflow-hidden rounded-2xl bg-gray-100 sm:aspect-[16/8]">
          <img
            key={activeImage.id}
            src={therapyGalleryImageUrl(activeImage.id)}
            alt={activeImage.title || activeImage.fileName}
            className="h-full w-full animate-in fade-in object-cover duration-500"
            style={{ objectPosition: `${activeImage.focusX}% ${activeImage.focusY}%` }}
          />
          {(activeImage.title || activeImage.caption) && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-5 pt-20 text-white sm:p-7 sm:pt-24">
              {activeImage.title && <h3 className="text-xl font-extrabold sm:text-2xl">{activeImage.title}</h3>}
              {activeImage.caption && <p className="mt-1 max-w-3xl text-sm leading-6 text-white/85 sm:text-base">{activeImage.caption}</p>}
            </div>
          )}
        </div>
        {images.length > 1 && (
          <>
            <button type="button" aria-label="Foto sebelumnya" onClick={() => move(-1)} className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow backdrop-blur-sm transition hover:bg-black/65 sm:left-5"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" aria-label="Foto berikutnya" onClick={() => move(1)} className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow backdrop-blur-sm transition hover:bg-black/65 sm:right-5"><ChevronRight className="h-5 w-5" /></button>
            <div className="mt-5 flex justify-center gap-2" aria-label="Navigasi galeri terapi">
              {images.map((image, index) => (
                <button key={image.id} type="button" aria-label={`Tampilkan foto ${index + 1}`} aria-current={index === activeIndex ? "true" : undefined} onClick={() => select(index)} className={`h-2.5 rounded-full transition-all ${index === activeIndex ? "w-7 bg-green-700" : "w-2.5 bg-gray-300 hover:bg-gray-400"}`} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

const developmentTherapies: DevelopmentTherapy[] = [
  {
    title: "Terapi Otak Bugar",
    price: "Rp 150.000/sesi",
    focus: "Meningkatkan kemampuan fisik (motorik dan postural), sensoris, dan fokus anak.",
    target: "Cocok untuk anak dengan ADHD, disleksia, masalah konsentrasi, dan kebutuhan terkait lainnya.",
    benefits: ["Meningkatkan respons terhadap rangsangan sensorik", "Meningkatkan fokus dan perhatian", "Mengurangi kecemasan dan stres", "Meningkatkan keterampilan motorik"],
    icon: Brain,
    accent: "from-emerald-500 to-green-700",
  },
  {
    title: "Terapi Perilaku",
    price: "Rp 200.000/sesi",
    focus: "Meningkatkan kepatuhan serta membentuk perilaku adaptif dan fungsional pada anak.",
    target: "Cocok untuk anak dengan Autisme (ASD), ADHD, atau tantrum berlebihan.",
    benefits: ["Meningkatkan keterampilan sosial", "Mengurangi perilaku bermasalah", "Mengembangkan keterampilan komunikasi", "Meningkatkan adaptasi dalam kehidupan sehari-hari"],
    icon: Activity,
    accent: "from-sky-500 to-blue-700",
  },
  {
    title: "Terapi Bicara dan Bahasa",
    price: "Rp 150.000/sesi",
    focus: "Meningkatkan kemampuan bicara dan bahasa pada anak.",
    target: "Cocok untuk anak dengan speech delay, gangguan artikulasi, gangguan pendengaran, atau feeding issues.",
    benefits: ["Mengembangkan bahasa ekspresif dan reseptif", "Mengurangi frustrasi dan tantrum", "Mendukung kesiapan akademis", "Membangun kepercayaan diri", "Meningkatkan kejelasan komunikasi", "Melatih keterampilan motorik oral"],
    icon: MessagesSquare,
    accent: "from-amber-500 to-orange-600",
  },
];

const psychotherapyMethods: PsychotherapyMethod[] = [
  {
    title: "Cognitive Behavior Therapy (CBT)",
    description: "Pendekatan psikoterapi yang berfokus pada hubungan antara pikiran, perasaan, dan perilaku. CBT umumnya digunakan untuk membantu menangani kecemasan, depresi, trauma dan PTSD, serta Obsessive Compulsive Disorder (OCD).",
    fullDescription: "Cognitive Behavior Therapy (CBT) merupakan pendekatan psikoterapi yang berfokus pada hubungan antara pikiran (kognitif), perasaan, dan perilaku. Pendekatan ini membantu individu mengenali pola pikir yang kurang membantu dan mengembangkan respons yang lebih adaptif.",
    conditions: ["Anxiety (gangguan kecemasan)", "Depresi", "Trauma dan stres (PTSD)", "Obsessive Compulsive Disorder (OCD)"],
  },
  {
    title: "Dialectical Behavior Therapy (DBT)",
    description: "Terapi bicara turunan CBT yang dirancang untuk membantu individu dengan emosi sangat intens melalui keseimbangan antara penerimaan diri dan perubahan perilaku positif. Pendekatan ini dapat digunakan pada BPD, bipolar, depresi berat, gangguan makan, PTSD, dan OCD.",
    fullDescription: "Dialectical Behavior Therapy (DBT) adalah terapi bicara turunan dari CBT yang secara khusus dirancang untuk membantu individu yang merasakan emosi dengan sangat intens. Tujuannya adalah menyeimbangkan penerimaan diri dengan perubahan perilaku positif.",
    conditions: ["Borderline Personality Disorder (BPD)", "Bipolar", "Depresi berat", "Eating disorder", "PTSD", "OCD"],
  },
  {
    title: "Rational Emotive Behavior Therapy (REBT)",
    description: "Pendekatan perilaku kognitif yang membantu mengenali dan mengubah pemikiran irasional yang memengaruhi emosi serta perilaku. REBT dapat digunakan untuk kecemasan, depresi, masalah regulasi emosi, perilaku adiktif, dan trauma.",
    fullDescription: "Rational Emotive Behavior Therapy (REBT) merupakan pendekatan perilaku kognitif yang menekankan keterkaitan antara perasaan, perilaku, dan pikiran. REBT memandang bahwa emosi atau perilaku bermasalah dapat dipengaruhi oleh pemikiran irasional, sehingga fokus penanganannya berada pada pemikiran individu.",
    conditions: ["Anxiety (gangguan kecemasan)", "Depresi", "Masalah kemampuan emosi", "Kecanduan dan perilaku adiktif", "Trauma"],
  },
  {
    title: "Mind Over Mood (MOM)",
    description: "Program yang membantu memperbaiki suasana hati dengan mengidentifikasi, mengevaluasi, dan mengubah pikiran negatif. Metode ini dapat mendukung penanganan bipolar, PTSD, masalah kemarahan, dan stres.",
    fullDescription: "Mind Over Mood (MOM) adalah program yang membantu mengubah suasana hati dengan cara mengidentifikasi, mengevaluasi, dan mengubah pikiran negatif. Prosesnya membantu individu memahami pengaruh pikiran terhadap emosi dan respons sehari-hari.",
    conditions: ["Bipolar", "PTSD", "Anger issues", "Stres"],
  },
  {
    title: "Eye Movement Desensitization and Reprocessing (EMDR)",
    description: "Psikoterapi interaktif yang menggunakan stimulasi bilateral, termasuk gerakan mata, untuk membantu pemrosesan memori traumatis secara lebih adaptif. EMDR digunakan terutama untuk PTSD serta dapat diterapkan pada fobia, kecemasan, dan depresi.",
    fullDescription: "Eye Movement Desensitization and Reprocessing (EMDR) adalah psikoterapi interaktif yang dirancang untuk membantu seseorang memulihkan diri dari trauma dan mengurangi stres psikologis. Terapi ini merangsang kedua sisi otak melalui gerakan mata atau stimulasi fisik lain agar memori traumatis dapat diproses dengan lebih adaptif.",
    conditions: ["Gangguan stres pascatrauma (PTSD)", "Fobia", "Anxiety (gangguan kecemasan)", "Depresi"],
  },
  {
    title: "Brainspotting",
    description: "Teknik psikoterapi berbasis pikiran dan tubuh yang memanfaatkan arah pandangan mata untuk membantu memproses trauma, emosi negatif, stres, dan pengalaman yang sulit dijangkau melalui kata-kata. Pendekatan ini dapat digunakan pada PTSD, depresi, kecemasan, fobia, dan OCD.",
    fullDescription: "Brainspotting merupakan teknik psikoterapi berbasis pikiran dan tubuh yang digunakan untuk memproses dan melepaskan trauma, emosi negatif, stres, hingga nyeri fisik yang tersimpan. Metode ini memanfaatkan arah pandangan mata (fiksasi) untuk mengakses memori bawah sadar yang sulit dijangkau hanya dengan kata-kata.",
    conditions: ["PTSD dan trauma", "Depresi dan kecemasan", "Fobia", "OCD"],
  },
  {
    title: "Clinical Hypnotherapy",
    description: "Metode terapi psikologis yang menggunakan kondisi relaksasi mendalam untuk membantu individu lebih terbuka terhadap sugesti positif. Pendekatan ini dapat digunakan untuk kecemasan, trauma dan PTSD, fobia, depresi, kebiasaan adiktif, insomnia, serta keluhan psikosomatis.",
    fullDescription: "Clinical Hypnotherapy adalah metode terapi psikologis yang menggunakan teknik hipnosis untuk membawa seseorang ke kondisi relaksasi yang sangat dalam (trance). Dalam kondisi ini, pikiran bawah sadar menjadi lebih terbuka terhadap sugesti positif untuk membantu mengatasi masalah emosi, perilaku, trauma, fobia, hingga keluhan psikosomatis.",
    conditions: ["Anxiety", "Trauma dan PTSD", "Fobia", "Depresi", "Gangguan kebiasaan dan kecanduan", "Gangguan tidur (insomnia)", "Keluhan psikosomatis"],
  },
  {
    title: "Mindfulness Based Stress Reduction (MBSR)",
    description: "Program pelatihan mindfulness terstruktur selama delapan minggu untuk membantu individu hadir pada masa kini dengan penuh kesadaran tanpa menghakimi. MBSR dapat mendukung pengelolaan stres, kecemasan, depresi, nyeri kronis, burnout, gangguan tidur, dan depresi postpartum.",
    fullDescription: "Mindfulness Based Stress Reduction (MBSR) adalah program pelatihan terstruktur selama delapan minggu yang dirancang untuk membantu individu mengelola stres, kecemasan, depresi, dan nyeri kronis. Metode ini melatih individu untuk hadir sepenuhnya pada masa kini dengan penuh kesadaran dan tanpa menghakimi.",
    conditions: ["Anxiety", "Depresi", "Stres kronis dan burnout", "Gangguan tidur", "Postpartum depression"],
  },
  {
    title: "Mindfulness Based Cognitive Therapy (MBCT)",
    description: "Psikoterapi yang menggabungkan CBT dengan meditasi mindfulness untuk membantu individu mengenali pikiran negatif tanpa menghakiminya. MBCT digunakan untuk membantu mencegah kekambuhan depresi serta menangani kecemasan dan stres kronis.",
    fullDescription: "Mindfulness Based Cognitive Therapy (MBCT) menggabungkan teknik CBT dengan meditasi kesadaran penuh (mindfulness). Terapi ini melatih individu untuk hidup pada masa kini (here and now) dan mengenali pikiran negatif tanpa menghakiminya, guna membantu mencegah kekambuhan depresi.",
    conditions: ["Depresi mayor", "Gangguan kecemasan", "Stres kronis"],
  },
  {
    title: "Art Therapy",
    description: "Bentuk psikoterapi yang menggunakan media seni sebagai sarana mengekspresikan dan memahami emosi yang sulit disampaikan melalui kata-kata. Art Therapy dapat digunakan dalam penanganan trauma, PTSD, depresi, kecemasan, stres kronis, dan adiksi.",
    fullDescription: "Art Therapy adalah bentuk psikoterapi yang menggunakan media seni, seperti menggambar, melukis, mewarnai, atau memahat, sebagai sarana utama untuk mengekspresikan emosi. Pendekatan ini membantu individu mengeluarkan perasaan yang sulit diungkapkan melalui kata-kata dan memahami emosi bawah sadar.",
    conditions: ["Trauma dan PTSD", "Depresi", "Anxiety", "Stres kronis", "Kecanduan (adiksi)"],
  },
  {
    title: "Emotional Freedom Technique (EFT)",
    description: "Metode yang dikenal sebagai tapping dan menggabungkan pendekatan psikologis dengan stimulasi titik tertentu pada tubuh sambil melafalkan afirmasi. EFT digunakan sebagai pendekatan pendamping untuk trauma, PTSD, kecemasan, depresi, dan stres.",
    fullDescription: "Emotional Freedom Technique (EFT), dikenal juga sebagai tapping, adalah metode terapi alternatif yang menggabungkan pendekatan psikologis dengan stimulasi titik energi tubuh seperti akupunktur tanpa jarum. Teknik dilakukan dengan mengetuk titik-titik tertentu menggunakan jari sambil melafalkan afirmasi atau doa.",
    conditions: ["Trauma dan PTSD", "Anxiety", "Depresi", "Stres"],
  },
  {
    title: "Touch For Health (TFH)",
    description: "Pendekatan komplementer yang memadukan prinsip akupresur, meridian, dan kinesiologi melalui muscle testing sebagai biofeedback. TFH digunakan untuk mendukung manajemen stres serta membantu keluhan kecemasan, depresi ringan, dan burnout.",
    fullDescription: "Touch For Health (TFH) merupakan metode terapi komplementer dan perawatan diri holistik yang menggabungkan prinsip pengobatan Timur, seperti akupresur dan meridian, dengan ilmu kinesiologi Barat. Metode ini menggunakan muscle testing sebagai biofeedback untuk mendukung keseimbangan tubuh, mengurangi stres, dan meningkatkan vitalitas.",
    conditions: ["Anxiety", "Depresi ringan", "Burnout"],
  },
  {
    title: "Meridian/PACE/PMR",
    description: "Gabungan pendekatan integratif: Meridian menggunakan stimulasi titik tubuh untuk mendukung regulasi emosi; PACE membangun rasa aman melalui playfulness, acceptance, curiosity, dan empathy; sedangkan PMR menggunakan relaksasi otot progresif untuk mengurangi kecemasan, stres, depresi, dan gangguan tidur.",
    fullDescription: "Tiga pendekatan yang digunakan sesuai kebutuhan untuk mendukung regulasi emosi, membangun rasa aman, dan membantu relaksasi fisik.",
    sections: [
      {
        title: "Meridian",
        description: "Meridian lebih sering digunakan dalam pendekatan psikologi alternatif atau integratif yang dipengaruhi pengobatan tradisional Tiongkok. Secara teori, stimulasi pada titik tertentu dipercaya dapat membantu regulasi emosi dengan mendukung keseimbangan aliran energi pada meridian.",
        conditions: ["Stres dan anxiety", "PTSD dan fobia", "Depresi ringan"],
      },
      {
        title: "PACE",
        description: "PACE adalah singkatan dari Playfulness (Keceriaan), Acceptance (Penerimaan), Curiosity (Rasa Ingin Tahu), dan Empathy (Empati). PACE digunakan sebagai pendekatan komunikasi dan pola asuh untuk membangun rasa aman, mengurangi sikap defensif, serta membantu anak memproses emosi.",
        conditions: ["Trauma masa kecil (developmental trauma)", "Attachment disorder"],
      },
      {
        title: "PMR",
        description: "Progressive Muscle Relaxation (PMR) adalah teknik relaksasi fisik untuk mengurangi kecemasan, stres, dan ketegangan otot dengan cara mengencangkan lalu melepaskan kelompok otot tertentu secara berurutan.",
        conditions: ["Anxiety", "Stres", "Depresi", "Gangguan tidur (insomnia)"],
      },
    ],
  },
  {
    title: "Tension & Trauma Releasing Exercises (TRE)",
    description: "Serangkaian latihan fisik yang dirancang untuk membantu tubuh melepaskan stres, ketegangan, dan trauma yang tersimpan dalam otot. Teknik ini digunakan untuk membantu meredakan gejala stres, kecemasan, dan dampak trauma secara fisik.",
    fullDescription: "Tension & Trauma Releasing Exercises (TRE) merupakan serangkaian latihan fisik yang dirancang untuk membantu tubuh melepaskan stres, ketegangan, dan trauma yang tersimpan di dalam otot.",
    conditions: ["Gejala stres", "Kecemasan", "Trauma secara fisik"],
  },
  {
    title: "Brain Gym",
    description: "Serangkaian gerakan fisik sederhana untuk mendukung koordinasi tubuh serta kemampuan kognitif seperti fokus dan daya ingat. Latihan ini dapat digunakan untuk membantu mengelola stres, kecemasan, dan mendukung rehabilitasi gangguan jiwa berat.",
    fullDescription: "Brain Gym berupa serangkaian gerakan fisik sederhana yang dirancang untuk mengoptimalkan fungsi otak. Terapi non-invasif ini bertujuan menyeimbangkan kerja otak kiri dan kanan, memperbaiki koordinasi tubuh, serta merangsang kemampuan kognitif seperti fokus dan daya ingat.",
    conditions: ["Membantu mengelola gejala stres", "Anxiety", "Mendukung rehabilitasi gangguan jiwa berat"],
  },
  {
    title: "Psikologi Positif",
    description: "Pendekatan yang berfokus pada pengembangan kekuatan karakter, emosi positif, kebahagiaan, dan makna hidup. Dalam psikoterapi, pendekatan ini dapat membantu individu menghadapi kecemasan, trauma dan PTSD, serta stres kronis.",
    fullDescription: "Psikologi Positif merupakan cabang ilmu psikologi yang berfokus pada pengembangan kekuatan karakter, emosi positif, dan makna hidup. Saat digunakan sebagai pendekatan terapi, metodenya berfokus membangun kebahagiaan untuk membantu mengatasi gejala depresi dan kecemasan.",
    conditions: ["Gangguan kecemasan (anxiety)", "Trauma (PTSD)", "Stres kronis"],
  },
];

const therapyCategories: TherapyCategory[] = [
  {
    slug: "tumbuh-kembang",
    title: "Terapi Tumbuh Kembang",
    description: "Layanan terapi kami dirancang untuk mendukung setiap individu dalam melewati fase perkembangan dengan optimal. Kami menghadirkan intervensi yang disesuaikan dengan kebutuhan unik setiap anak melalui metode yang telah teruji secara ilmiah dan dilakukan oleh tenaga profesional.",
    introduction: "Layanan terapi yang disesuaikan dengan kebutuhan unik setiap anak dan didampingi oleh tenaga profesional.",
    icon: Puzzle,
    accent: "from-emerald-500 to-green-700",
    iconStyle: "bg-emerald-100 text-emerald-700",
    availability: "Layanan anak & remaja",
    services: ["Terapi wicara", "Terapi perilaku", "Terapi sensori integrasi", "Terapi bermain"],
  },
  {
    slug: "psikoterapi",
    title: "Psikoterapi",
    description: "Layanan psikoterapi untuk dewasa di Pelangi Indonesia (RPPI) dirancang untuk membantu individu menghadapi tekanan hidup, hambatan emosional, hingga pengembangan potensi diri.",
    introduction: "Layanan psikoterapi untuk dewasa yang disesuaikan dengan kebutuhan, kondisi, serta tujuan setiap klien.",
    icon: HeartHandshake,
    accent: "from-sky-500 to-blue-700",
    iconStyle: "bg-sky-100 text-sky-700",
    availability: "Pendampingan psikologis",
    services: ["Konsultasi kebutuhan dan tujuan terapi", "Pendekatan sesuai kondisi klien", "Pendampingan oleh tenaga profesional", "Evaluasi perkembangan secara berkala"],
  },
];

function TherapyHero({ title, description, detail = false }: { title: string; description: string; detail?: boolean }) {
  return (
    <section className="bg-gradient-to-br from-[#1B4332] via-[#2D6A4F] to-[#40916C] px-4 pb-16 pt-28 text-white sm:px-6 lg:px-8 lg:pb-20">
      <div className="mx-auto max-w-5xl">
        {detail && (
          <nav className="mb-8 flex flex-wrap items-center gap-2 text-sm text-green-50/75">
            <Link href="/produk-layanan" className="transition-colors hover:text-white">Produk & Layanan</Link>
            <ChevronRight size={14} />
            <Link href="/produk-layanan/terapi" className="transition-colors hover:text-white">Terapi</Link>
            <ChevronRight size={14} />
            <span className="text-white">{title}</span>
          </nav>
        )}
        <div className={detail ? "max-w-3xl" : "mx-auto max-w-4xl text-center"}>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-100">Produk & Layanan</p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">{title}</h1>
          <p className="mt-5 text-lg leading-relaxed text-green-50/90">{description}</p>
        </div>
      </div>
    </section>
  );
}

function TherapyDetail({ category }: { category: TherapyCategory }) {
  const Icon = category.icon;
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <TherapyHero title={category.title} description={category.description} detail />
      <main className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <Link href="/produk-layanan/terapi" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-green-800"><ArrowLeft size={17} /> Kembali ke Kategori Terapi</Link>
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_320px]">
          <section className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-black/5 sm:p-10">
            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${category.iconStyle}`}><Icon className="h-8 w-8" /></div>
            <h2 className="mt-6 text-2xl font-extrabold text-gray-900">Tentang {category.title}</h2>
            <p className="mt-4 leading-7 text-gray-600">{category.introduction}</p>
            <h3 className="mt-8 text-lg font-bold text-green-900">Cakupan layanan</h3>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {category.services.map((service) => (
                <li key={service} className="flex items-start gap-3 rounded-xl bg-green-50/70 p-4 text-sm font-medium text-gray-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />{service}
                </li>
              ))}
            </ul>
          </section>
          <aside className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-black/5 lg:sticky lg:top-28">
            <h2 className="text-xl font-bold text-gray-900">Konsultasikan kebutuhan Anda</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">Tim Pelangi Indonesia akan membantu menentukan layanan dan langkah awal yang sesuai.</p>
            <a href="https://wa.me/6285117658242" target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 font-bold text-white transition hover:bg-[#1fb85a]"><SiWhatsapp size={18} /> Chat WhatsApp</a>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function DevelopmentTherapyDetail({ category }: { category: TherapyCategory }) {
  const whatsappHref = (therapyName: string) => `https://wa.me/6285117658242?text=${encodeURIComponent(`Halo Pelangi Indonesia, saya ingin mengetahui informasi lebih lanjut mengenai ${therapyName}.`)}`;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <TherapyHero title={category.title} description={category.description} detail />
      <main className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <Link href="/produk-layanan/terapi" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-green-800"><ArrowLeft size={17} /> Kembali ke Kategori Terapi</Link>
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-green-700">Layanan yang tersedia</p>
          <h2 className="mt-2 text-3xl font-extrabold text-gray-900">Jenis Terapi Perkembangan</h2>
          <p className="mt-3 max-w-3xl leading-7 text-gray-600">Pilih layanan yang sesuai untuk melihat fokus terapi, target pendampingan, manfaat, dan informasi biaya setiap sesi.</p>
        </div>
        <div className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
          {developmentTherapies.map((therapy) => {
            const Icon = therapy.icon;
            return (
              <article key={therapy.title} className="overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-black/5">
                <div className={`relative flex h-48 items-center justify-center overflow-hidden bg-gradient-to-br ${therapy.accent}`}>
                  <img src="/services/terapi.png" alt="" aria-hidden="true" className="absolute -right-5 -top-5 h-44 w-44 rounded-full bg-white/90 p-8 opacity-25" />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-white/95 text-green-800 shadow-lg"><Icon className="h-10 w-10" /></div>
                </div>
                <div className="p-6 sm:p-7">
                  <h3 className="text-2xl font-extrabold text-gray-900">{therapy.title}</h3>
                  <span className="mt-4 inline-flex rounded-full bg-green-100 px-4 py-2 text-sm font-extrabold text-green-800">{therapy.price}</span>
                  <p className="mt-5 text-sm leading-6 text-gray-600"><strong className="text-gray-900">Fokus utama:</strong> {therapy.focus}</p>
                  <details className="group mt-5 border-t border-gray-100 pt-1">
                    <summary className="flex cursor-pointer list-none items-center justify-between py-4 font-bold text-green-800 marker:content-none">
                      Lihat Selengkapnya
                      <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="pb-1">
                      <p className="text-sm leading-6 text-gray-600"><strong className="text-gray-900">Target:</strong> {therapy.target}</p>
                      <h4 className="mt-5 font-bold text-gray-900">Manfaat</h4>
                      <ul className="mt-3 space-y-3">
                        {therapy.benefits.map((benefit) => (
                          <li key={benefit} className="flex items-start gap-2 text-sm leading-6 text-gray-600"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />{benefit}</li>
                        ))}
                      </ul>
                      <a href={whatsappHref(therapy.title)} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 font-bold text-white transition hover:bg-[#1fb85a]"><SiWhatsapp size={18} /> Info Selengkapnya</a>
                    </div>
                  </details>
                </div>
              </article>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function PsychotherapyDetail({ category }: { category: TherapyCategory }) {
  const [selectedMethod, setSelectedMethod] = useState<PsychotherapyMethod | null>(null);
  const whatsappHref = selectedMethod
    ? `https://wa.me/6285117658242?text=${encodeURIComponent(`Halo Pelangi Indonesia, saya ingin mengetahui informasi lebih lanjut mengenai ${selectedMethod.title}.`)}`
    : "https://wa.me/6285117658242";

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <TherapyHero title={category.title} description={category.description} detail />
      <main className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <Link href="/produk-layanan/terapi" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-green-800"><ArrowLeft size={17} /> Kembali ke Kategori Terapi</Link>
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-green-700">Pendekatan yang tersedia</p>
          <h2 className="mt-2 text-3xl font-extrabold text-gray-900">Jenis Psikoterapi</h2>
          <p className="mt-3 max-w-3xl leading-7 text-gray-600">Setiap pendekatan memiliki fokus dan teknik yang berbeda. Tim profesional kami akan membantu menyesuaikannya dengan kebutuhan setiap klien.</p>
        </div>
        <div className="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
          {psychotherapyMethods.map((method, index) => (
            <article key={method.title} className="relative overflow-hidden rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-lg sm:p-7">
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 to-green-700" />
              <button type="button" onClick={() => setSelectedMethod(method)} className="group flex h-full w-full flex-col text-left outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-4" aria-label={`Lihat detail ${method.title}`}>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-sm font-extrabold text-green-800">{String(index + 1).padStart(2, "0")}</span>
                <span className="mt-5 block text-xl font-extrabold leading-snug text-gray-900">{method.title}</span>
                <span className="mt-3 block flex-1 text-sm leading-6 text-gray-600">{method.description}</span>
                <span className="mt-5 inline-flex items-center font-bold text-green-800">Lihat Detail <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
              </button>
            </article>
          ))}
        </div>
        <section className="mt-10 flex flex-col items-start justify-between gap-6 rounded-3xl bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] p-7 text-white sm:flex-row sm:items-center sm:p-9">
          <div>
            <h2 className="text-2xl font-extrabold">Butuh bantuan memilih pendekatan?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-green-50/90">Konsultasikan kebutuhan Anda bersama tim Pelangi Indonesia untuk mendapatkan informasi layanan yang sesuai.</p>
          </div>
          <a href="https://wa.me/6285117658242?text=Halo%20Pelangi%20Indonesia%2C%20saya%20ingin%20mengetahui%20informasi%20lebih%20lanjut%20mengenai%20layanan%20psikoterapi." target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 py-3 font-bold text-white transition hover:bg-[#1fb85a]"><SiWhatsapp size={18} /> Info Selengkapnya</a>
        </section>
      </main>
      <Dialog open={Boolean(selectedMethod)} onOpenChange={(open) => { if (!open) setSelectedMethod(null); }}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0 sm:rounded-3xl">
          {selectedMethod && (
            <>
              <DialogHeader className="border-b border-gray-100 px-6 pb-5 pt-7 text-left sm:px-8 sm:pt-8">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">Detail Psikoterapi</p>
                <DialogTitle className="pr-8 text-2xl font-extrabold leading-tight text-gray-900 sm:text-3xl">{selectedMethod.title}</DialogTitle>
                <DialogDescription className="text-sm leading-6 text-gray-500">Informasi pendekatan dan kondisi yang disebutkan dalam layanan ini.</DialogDescription>
              </DialogHeader>
              <div className="overflow-y-auto px-6 py-6 sm:px-8">
                <p className="leading-7 text-gray-600">{selectedMethod.fullDescription}</p>
                {selectedMethod.conditions && (
                  <div className="mt-6">
                    <h3 className="font-extrabold text-gray-900">Kondisi yang biasanya ditangani</h3>
                    <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                      {selectedMethod.conditions.map((condition) => (
                        <li key={condition} className="flex items-start gap-2 rounded-xl bg-green-50/70 p-3 text-sm leading-6 text-gray-700"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-green-700" />{condition}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedMethod.sections?.map((section) => (
                  <section key={section.title} className="mt-6 rounded-2xl border border-gray-100 p-5">
                    <h3 className="text-lg font-extrabold text-green-900">{section.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600">{section.description}</p>
                    <h4 className="mt-4 text-sm font-bold text-gray-900">Kondisi atau kebutuhan terkait</h4>
                    <ul className="mt-3 space-y-2">
                      {section.conditions.map((condition) => (
                        <li key={condition} className="flex items-start gap-2 text-sm leading-6 text-gray-600"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-green-700" />{condition}</li>
                      ))}
                    </ul>
                  </section>
                ))}
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 py-3 font-bold text-white transition hover:bg-[#1fb85a]"><SiWhatsapp size={18} /> Info Selengkapnya</a>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
}

export default function TherapyCategories() {
  const [detailMatch, detailParams] = useRoute("/produk-layanan/terapi/:categorySlug");
  const selectedCategory = detailMatch ? therapyCategories.find((category) => category.slug === detailParams.categorySlug) : undefined;

  if (selectedCategory?.slug === "tumbuh-kembang") return <DevelopmentTherapyDetail category={selectedCategory} />;
  if (selectedCategory?.slug === "psikoterapi") return <PsychotherapyDetail category={selectedCategory} />;
  if (selectedCategory) return <TherapyDetail category={selectedCategory} />;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <TherapyHero title="Pilih Kategori Terapi" description="Temukan layanan terapi yang paling sesuai untuk kebutuhan perkembangan, perilaku, emosi, dan kesehatan mental." />
      <main className="px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          {therapyCategories.map((category) => {
            const Icon = category.icon;
            return (
              <article key={category.slug} className="group relative overflow-hidden rounded-3xl bg-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div className={`h-2 bg-gradient-to-r ${category.accent}`} />
                <div className="flex h-full flex-col p-7 sm:p-8">
                  <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${category.iconStyle}`}><Icon className="h-7 w-7" /></div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{category.availability}</p>
                  <h2 className="text-2xl font-bold text-gray-900">{category.title}</h2>
                  <p className="mt-3 flex-1 leading-relaxed text-gray-600">{category.description}</p>
                  <Link href={`/produk-layanan/terapi/${category.slug}`} className="mt-7 inline-flex items-center font-semibold text-green-800 transition-colors hover:text-green-600">Lihat Selengkapnya <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
                </div>
              </article>
            );
          })}
        </div>
        <TherapyGallery />
      </main>
      <Footer />
    </div>
  );
}
