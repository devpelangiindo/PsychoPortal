import { useEffect, useRef, useState, type ComponentType, type FocusEvent, type TouchEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowRight, BookOpen, Calculator, Camera, CheckCircle2, ChevronLeft, ChevronRight, GraduationCap, Maximize2, Medal, Music2, Sparkles, Users, Waves } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Course = {
  id?: number;
  slug?: string;
  title: string;
  price: string;
  description: string;
  details: string[];
  icon: ComponentType<{ className?: string }>;
  accent: string;
  specialNote?: string | null;
  imageId?: number | null;
  imageFocusX?: number | null;
  imageFocusY?: number | null;
};

const courses: Course[] = [
  {
    slug: "baca-tulis",
    title: "Baca Tulis",
    price: "Rp 325.000/bulan",
    description: "Program baca tulis dirancang untuk membantu anak mengembangkan kemampuan dasar literasi, mulai dari mengenal huruf, membaca, menulis, hingga memahami kalimat sederhana. Pembelajaran dilakukan secara interaktif dan menyenangkan sesuai tahap perkembangan anak.",
    details: ["8 kali pertemuan", "Maksimal 6 anak per kelas", "Free trial 1 kali", "Modul disusun oleh tim Pelangi Indonesia dan telah digunakan kurang lebih 15 tahun"],
    icon: BookOpen,
    accent: "from-emerald-500 to-green-700",
  },
  {
    slug: "matematika",
    title: "Matematika",
    price: "Rp 325.000/bulan",
    description: "Kursus matematika membantu peserta memahami konsep berhitung, logika, dan pemecahan masalah dengan metode yang mudah dipahami. Materi disesuaikan dengan usia dan tingkat kemampuan anak agar proses belajar lebih efektif.",
    details: ["8 kali pertemuan", "Maksimal 6 anak per kelas", "Free trial 1 kali"],
    icon: Calculator,
    accent: "from-sky-500 to-blue-700",
  },
  {
    slug: "bimbingan-belajar-privat",
    title: "Bimbingan Belajar Privat",
    price: "Rp 250.000/bulan",
    description: "Program bimbingan belajar privat memberikan pendampingan sesuai kebutuhan akademik anak. Perhatian yang lebih terfokus membantu proses belajar menjadi lebih optimal dan terarah.",
    details: ["4 kali pertemuan", "Tersedia home visit atau belajar onsite di Pelangi Indonesia"],
    icon: GraduationCap,
    accent: "from-violet-500 to-purple-700",
  },
  {
    slug: "sempoa",
    title: "Sempoa",
    price: "Rp 275.000/bulan",
    description: "Kursus sempoa membantu melatih kemampuan berhitung cepat, konsentrasi, dan daya ingat anak melalui metode visual dan motorik. Latihan dilakukan secara bertahap agar anak mampu menghitung dengan cepat dan tepat.",
    details: ["8 kali pertemuan", "Maksimal 6 anak per kelas", "Free trial 1 kali"],
    icon: Sparkles,
    accent: "from-amber-500 to-orange-600",
  },
  {
    slug: "balet",
    title: "Balet",
    price: "Mulai Rp 325.000/bulan",
    description: "Kelas balet membantu anak mengembangkan kelenturan, koordinasi gerak, keseimbangan motorik, disiplin, fokus, dan rasa percaya diri. Program bekerja sama dengan Flores Balet dengan pengajar bersertifikasi RAD.",
    details: ["Kurikulum RAD London", "4 kali pertemuan", "Free trial 1 kali", "Tersedia 7 klasifikasi kelompok", "Mulai usia 3 tahun (baby class)"],
    icon: Activity,
    accent: "from-rose-400 to-pink-600",
  },
  {
    slug: "taekwondo",
    title: "Taekwondo",
    price: "Rp 250.000/bulan",
    description: "Kursus taekwondo melatih kekuatan fisik, ketahanan tubuh, dan kemampuan bela diri dasar. Anak juga belajar disiplin, tanggung jawab, pengendalian diri, serta membangun kepercayaan diri dan karakter positif.",
    details: ["4 kali pertemuan", "Free trial 1 kali", "Mulai usia 3 tahun"],
    icon: Medal,
    accent: "from-red-500 to-red-700",
  },
  {
    slug: "renang-privat",
    title: "Renang Privat",
    price: "Rp 300.000/bulan",
    description: "Kursus renang membantu anak mempelajari teknik dasar berenang sekaligus meningkatkan kemampuan motorik dan koordinasi tubuh. Pembelajaran dilakukan secara aman dan bertahap sesuai usia serta kemampuan anak.",
    details: ["4 kali pertemuan", "Mulai usia 3 tahun"],
    icon: Waves,
    accent: "from-cyan-500 to-blue-600",
    specialNote: "Khusus tersedia di Pelangi Indonesia Cabang Bantul",
  },
  {
    slug: "musik-privat",
    title: "Musik Privat",
    price: "Mulai Rp 390.000/bulan",
    description: "Kursus musik mendukung kreativitas, konsentrasi, dan kemampuan anak mengekspresikan diri melalui seni. Anak mempelajari nada, ritme, dan teknik dasar musik sesuai minat dan usianya.",
    details: ["4 kali pertemuan", "Free trial 1 kali", "Mulai usia 3 tahun"],
    icon: Music2,
    accent: "from-indigo-500 to-violet-700",
  },
  {
    slug: "tari",
    title: "Tari",
    price: "Rp 250.000/bulan",
    description: "Kursus tari membantu anak mengeksplorasi gerak, irama, dan ekspresi diri secara menyenangkan. Program ini mendukung rasa percaya diri, kerja sama, kreativitas, perkembangan motorik, dan koordinasi tubuh.",
    details: ["4 kali pertemuan", "Free trial 1 kali", "Mulai usia 3 tahun"],
    icon: Users,
    accent: "from-fuchsia-500 to-purple-700",
  },
];

const courseDisplayOrder = [
  "Balet",
  "Taekwondo",
  "Renang Privat",
  "Musik Privat",
  "Tari",
  "Bimbingan Belajar Privat",
  "Baca Tulis",
  "Matematika",
  "Sempoa",
];

const orderedCourses = [...courses].sort(
  (firstCourse, secondCourse) =>
    courseDisplayOrder.indexOf(firstCourse.title) - courseDisplayOrder.indexOf(secondCourse.title),
);

type ManagedCourse = Omit<Course, "icon" | "accent"> & {
  id: number;
  slug: string;
  details: string[];
};

type CourseGalleryImage = {
  id: number;
  fileName: string;
  title: string | null;
  caption: string | null;
  sortOrder: number;
  focusX: number;
  focusY: number;
};

function apiBase() {
  if (import.meta.env.VITE_ASESMEN_API_URL) return String(import.meta.env.VITE_ASESMEN_API_URL).replace(/\/$/, "");
  return window.location.hostname === "localhost" ? "http://localhost:5001" : "https://asesmen.pi-psychology.com";
}

function courseImageUrl(imageId: number) {
  return `${apiBase()}/api/courses/images/${imageId}`;
}

function courseGalleryImageUrl(imageId: number) {
  return `${apiBase()}/api/course-gallery/images/${imageId}`;
}

function whatsappHref(courseName: string) {
  return `https://wa.me/6285117658242?text=${encodeURIComponent(`Halo Pelangi Indonesia, saya ingin mendaftar dan mengetahui informasi lebih lanjut mengenai kursus ${courseName}.`)}`;
}

export default function CoursePage() {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<CourseGalleryImage | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryTimerKey, setGalleryTimerKey] = useState(0);
  const [isGalleryPaused, setIsGalleryPaused] = useState(false);
  const galleryTouchStartX = useRef<number | null>(null);
  const suppressGalleryClick = useRef(false);
  const { data: managedCourses } = useQuery<ManagedCourse[]>({
    queryKey: ["courses"],
    queryFn: async () => {
      const response = await fetch(`${apiBase()}/api/courses`);
      if (!response.ok) throw new Error("Gagal memuat katalog kursus");
      return response.json();
    },
    retry: 1,
  });
  const { data: gallery = [] } = useQuery<CourseGalleryImage[]>({
    queryKey: ["course-gallery"],
    queryFn: async () => {
      const response = await fetch(`${apiBase()}/api/course-gallery`);
      if (!response.ok) throw new Error("Gagal memuat galeri kegiatan kursus");
      return response.json();
    },
    retry: 1,
  });
  const displayedCourses: Course[] = managedCourses
    ? managedCourses.map((course) => {
        const visual = courses.find((fallbackCourse) => fallbackCourse.slug === course.slug);
        return {
          ...course,
          icon: visual?.icon ?? GraduationCap,
          accent: visual?.accent ?? "from-emerald-500 to-green-700",
        };
      })
    : orderedCourses;
  const activeGalleryImage = gallery[galleryIndex];

  useEffect(() => {
    if (galleryIndex >= gallery.length) setGalleryIndex(0);
  }, [gallery.length, galleryIndex]);

  useEffect(() => {
    if (gallery.length <= 1 || isGalleryPaused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = window.setInterval(() => {
      setGalleryIndex((current) => (current + 1) % gallery.length);
    }, 4000);
    return () => window.clearInterval(interval);
  }, [gallery.length, galleryTimerKey, isGalleryPaused]);

  const moveGallery = (direction: -1 | 1) => {
    if (gallery.length <= 1) return;
    setGalleryIndex((current) => (current + direction + gallery.length) % gallery.length);
    setGalleryTimerKey((current) => current + 1);
  };

  const selectGallerySlide = (index: number) => {
    setGalleryIndex(index);
    setGalleryTimerKey((current) => current + 1);
  };

  const handleGalleryTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    galleryTouchStartX.current = event.touches[0]?.clientX ?? null;
    setIsGalleryPaused(true);
  };

  const handleGalleryTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    setIsGalleryPaused(false);
    if (galleryTouchStartX.current === null) return;
    const distance = (event.changedTouches[0]?.clientX ?? galleryTouchStartX.current) - galleryTouchStartX.current;
    galleryTouchStartX.current = null;
    if (Math.abs(distance) < 40) return;
    suppressGalleryClick.current = true;
    moveGallery(distance < 0 ? 1 : -1);
  };

  const handleGalleryBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsGalleryPaused(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <section className="bg-gradient-to-br from-[#1B4332] via-[#2D6A4F] to-[#40916C] px-4 pb-16 pt-28 text-white sm:px-6 lg:px-8 lg:pb-20">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-100">Produk & Layanan</p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">Kursus</h1>
          <div className="mx-auto mt-5 max-w-4xl space-y-4 text-base leading-7 text-green-50/90 sm:text-lg">
            <p>Program kursus kami hadir sebagai layanan pembelajaran dan pengembangan keterampilan yang dirancang untuk mendukung kemampuan akademik, minat, bakat, serta perkembangan individu secara optimal. Dengan metode belajar interaktif dan pendampingan tenaga pengajar profesional, setiap program disusun agar peserta dapat belajar dengan nyaman, terarah, dan menyenangkan.</p>
            <p>Kami menyediakan berbagai pilihan kursus, mulai dari baca tulis, matematika, bimbingan belajar privat, sempoa, hingga pengembangan minat dan bakat seperti balet, taekwondo, renang, musik, dan tari. Setiap program dirancang sesuai kebutuhan dan tahapan perkembangan peserta, baik anak maupun remaja. Melalui program ini, peserta tidak hanya memperoleh peningkatan kemampuan akademik dan keterampilan, tetapi juga mengembangkan rasa percaya diri, disiplin, kreativitas, serta kemampuan sosial dalam pembelajaran.</p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        {gallery.length > 0 && (
          <section className="overflow-hidden rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8 lg:p-10">
            <div className="mb-7 max-w-3xl">
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-green-700"><Camera className="h-4 w-4" />Galeri Kegiatan</p>
              <h2 className="mt-2 text-3xl font-extrabold text-gray-900">Belajar, bergerak, dan berkembang bersama</h2>
              <p className="mt-3 leading-7 text-gray-600">Dokumentasi kegiatan kursus Pelangi Indonesia yang mendukung anak belajar dengan nyaman, aktif, dan menyenangkan.</p>
            </div>
            {activeGalleryImage && (
              <div
                className="relative"
                onMouseEnter={() => setIsGalleryPaused(true)}
                onMouseLeave={() => setIsGalleryPaused(false)}
                onFocusCapture={() => setIsGalleryPaused(true)}
                onBlurCapture={handleGalleryBlur}
                onTouchStart={handleGalleryTouchStart}
                onTouchEnd={handleGalleryTouchEnd}
                onTouchCancel={() => { galleryTouchStartX.current = null; setIsGalleryPaused(false); }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (suppressGalleryClick.current) {
                      suppressGalleryClick.current = false;
                      return;
                    }
                    setSelectedGalleryImage(activeGalleryImage);
                  }}
                  className="group relative block aspect-[16/10] w-full touch-pan-y overflow-hidden rounded-2xl bg-gray-100 text-left sm:aspect-[16/8]"
                >
                  <img
                    key={activeGalleryImage.id}
                    src={courseGalleryImageUrl(activeGalleryImage.id)}
                    alt={activeGalleryImage.title || activeGalleryImage.fileName}
                    className="h-full w-full animate-in fade-in object-cover duration-500 group-hover:scale-[1.02]"
                    style={{ objectPosition: `${activeGalleryImage.focusX}% ${activeGalleryImage.focusY}%` }}
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/10" />
                  <span className="absolute right-4 top-4 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm"><Maximize2 className="h-4 w-4" /></span>
                  {(activeGalleryImage.title || activeGalleryImage.caption) && (
                    <span className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
                      {activeGalleryImage.title && <span className="block text-lg font-bold sm:text-xl">{activeGalleryImage.title}</span>}
                      {activeGalleryImage.caption && <span className="mt-1 line-clamp-2 block max-w-3xl text-sm leading-6 text-white/85">{activeGalleryImage.caption}</span>}
                    </span>
                  )}
                </button>

                {gallery.length > 1 && (
                  <>
                    <button type="button" aria-label="Foto sebelumnya" onClick={() => moveGallery(-1)} className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white shadow backdrop-blur-sm transition hover:bg-black/60 sm:left-5"><ChevronLeft className="h-5 w-5" /></button>
                    <button type="button" aria-label="Foto berikutnya" onClick={() => moveGallery(1)} className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white shadow backdrop-blur-sm transition hover:bg-black/60 sm:right-5"><ChevronRight className="h-5 w-5" /></button>
                    <div className="mt-5 flex justify-center gap-2" aria-label="Navigasi galeri">
                      {gallery.map((image, index) => (
                        <button
                          key={image.id}
                          type="button"
                          aria-label={`Tampilkan foto ${index + 1}`}
                          aria-current={index === galleryIndex ? "true" : undefined}
                          onClick={() => selectGallerySlide(index)}
                          className={`h-2.5 rounded-full transition-all ${index === galleryIndex ? "w-7 bg-green-700" : "w-2.5 bg-gray-300 hover:bg-gray-400"}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        )}

        <section className="mt-14">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-green-700">Program tersedia</p>
            <h2 className="mt-2 text-3xl font-extrabold text-gray-900">Pilih Kursus yang Sesuai</h2>
            <p className="mt-3 max-w-3xl leading-7 text-gray-600">Setiap program dirancang sesuai kebutuhan dan tahapan perkembangan peserta dengan pendampingan tenaga pengajar profesional.</p>
          </div>
          <div className="grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
            {displayedCourses.length === 0 ? (
              <div className="col-span-full rounded-2xl bg-white p-12 text-center text-gray-500 shadow-sm">Katalog kursus sedang disiapkan.</div>
            ) : displayedCourses.map((course) => {
              const Icon = course.icon;
              return (
                <article key={course.id ?? course.title} className="flex overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-black/5">
                  <div className="flex w-full flex-col">
                    <div className={`relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br ${course.accent}`}>
                      {course.imageId ? (
                        <img src={courseImageUrl(course.imageId)} alt={course.title} className="h-full w-full object-cover" style={{ objectPosition: `${course.imageFocusX ?? 50}% ${course.imageFocusY ?? 50}%` }} />
                      ) : (
                        <>
                          <img src="/services/kursus.png" alt="" aria-hidden="true" className="absolute -right-6 -top-8 h-40 w-40 rounded-full bg-white/90 p-8 opacity-20" />
                          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-white/95 text-green-800 shadow-lg"><Icon className="h-10 w-10" /></div>
                        </>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col p-6 sm:p-7">
                      <h3 className="line-clamp-2 min-h-14 text-2xl font-extrabold leading-7 text-gray-900">{course.title}</h3>
                      <p className="mt-3 whitespace-nowrap text-[clamp(1.125rem,5.5vw,1.875rem)] font-extrabold tracking-tight text-green-800 md:text-[clamp(1.125rem,2.5vw,1.5rem)] xl:text-[clamp(1.125rem,1.55vw,1.5rem)]">{course.price}</p>
                      <p className="mt-4 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-gray-600">{course.description}</p>
                      <div className="mt-auto space-y-3 pt-6">
                        <button
                          type="button"
                          onClick={() => setSelectedCourse(course)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-green-700 px-5 py-3 font-bold text-green-800 transition hover:bg-green-50"
                        >
                          Selengkapnya <ArrowRight className="h-4 w-4" />
                        </button>
                        <a href={whatsappHref(course.title)} target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 font-bold text-white transition hover:bg-[#1fb85a]"><SiWhatsapp size={18} /> Daftar Sekarang</a>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <Dialog open={selectedCourse !== null} onOpenChange={(open) => !open && setSelectedCourse(null)}>
        {selectedCourse && (
          <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0 sm:rounded-3xl">
            <div className={`relative overflow-hidden bg-gradient-to-br px-6 py-7 pr-14 text-white sm:px-8 ${selectedCourse.accent}`}>
              <DialogHeader className="relative text-left">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/80">Detail Kursus</p>
                <DialogTitle className="mt-2 text-2xl font-extrabold leading-tight text-white sm:text-3xl">{selectedCourse.title}</DialogTitle>
                <DialogDescription className="mt-3 whitespace-nowrap text-[clamp(1.125rem,5vw,1.75rem)] font-extrabold text-white sm:text-2xl">{selectedCourse.price}</DialogDescription>
              </DialogHeader>
            </div>
            <div className="overflow-y-auto p-6 sm:p-8">
              <p className="leading-7 text-gray-600">{selectedCourse.description}</p>
              <h4 className="mt-6 font-extrabold text-gray-900">Informasi Program</h4>
              <ul className="mt-3 space-y-3">
                {selectedCourse.details.map((detail) => (
                  <li key={detail} className="flex items-start gap-3 text-sm leading-6 text-gray-600"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-green-700" />{detail}</li>
                ))}
              </ul>
              {selectedCourse.specialNote && <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">{selectedCourse.specialNote}</p>}
              <a href={whatsappHref(selectedCourse.title)} target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 font-bold text-white transition hover:bg-[#1fb85a]"><SiWhatsapp size={18} /> Daftar Sekarang</a>
            </div>
          </DialogContent>
        )}
      </Dialog>
      <Dialog open={selectedGalleryImage !== null} onOpenChange={(open) => !open && setSelectedGalleryImage(null)}>
        {selectedGalleryImage && (
          <DialogContent className="w-[calc(100%-1rem)] max-w-5xl overflow-hidden border-0 bg-black p-0 sm:rounded-2xl">
            <DialogHeader className="sr-only">
              <DialogTitle>{selectedGalleryImage.title || "Foto galeri kegiatan kursus"}</DialogTitle>
              <DialogDescription>{selectedGalleryImage.caption || "Dokumentasi kegiatan kursus Pelangi Indonesia"}</DialogDescription>
            </DialogHeader>
            <img src={courseGalleryImageUrl(selectedGalleryImage.id)} alt={selectedGalleryImage.title || selectedGalleryImage.fileName} className="max-h-[78vh] w-full object-contain" />
            {(selectedGalleryImage.title || selectedGalleryImage.caption) && (
              <div className="bg-white p-5 sm:p-6">
                {selectedGalleryImage.title && <h3 className="text-xl font-extrabold text-gray-900">{selectedGalleryImage.title}</h3>}
                {selectedGalleryImage.caption && <p className="mt-2 leading-7 text-gray-600">{selectedGalleryImage.caption}</p>}
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
      <Footer />
    </div>
  );
}
