import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ArrowRight, Star, Users, Brain, BookOpen, Award } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppBranchChooser from "@/components/WhatsAppBranchChooser";
import {
  fetchTestimonials,
  fetchSiteStats,
  type CMSTestimonial,
  type CMSStat,
} from "@/lib/cms";
import { getAsesmenPlatformHref, getBookingHref } from "@/lib/platform-links";
import { useRef } from "react";

// ─── Fallback data (shown while CMS is empty) ────────────────────────────────

const FALLBACK_TESTIMONIALS: Array<{ text: string; author: string; rating: number }> = [
  { text: "Bagus banget pelatihannya, trainer sangat profesional, ilmunya banyak dan sangat bermanfaat", author: "Peserta Workshop", rating: 5 },
  { text: "Workshop tidak hanya teori namun juga dilengkapi sesi praktek yang cukup panjang sehingga dapat membantu ketika implementasi dengan klien", author: "Peserta Workshop", rating: 5 },
  { text: "Alat-alat disusun dengan lengkap, sangat memudahkan proses terapi & konseling dengan anak sehingga konselor tidak perlu lagi mencari alat satu per satu", author: "Pengguna Alat Pendamping Konseling Anak", rating: 5 },
  { text: "Modul dan e-booknya lengkap banget, isinya sangat bermanfaat", author: "Peserta Workshop", rating: 5 },
];

const FALLBACK_STATS: CMSStat[] = [
  { value: "1500+", label: "Klien Terbantu" },
  { value: "2000", label: "Sesi Terapi & Konseling" },
  { value: "50+", label: "Program Pelatihan Terselenggara" },
  { value: "5+", label: "Kemitraan" },
];

const heroImages = [
  { src: "/homepage/pig-building-1.jpg", alt: "Gedung Pelangi Indonesia" },
  { src: "/homepage/pig-building-2.jpg", alt: "Kampus Pelangi Indonesia" },
  { src: "/homepage/pig-building-3.jpg", alt: "Convention Hall Pelangi Indonesia" },
];

const businessUnits = [
  { label: "Klinik Psikologi & Terapi", icon: Brain },
  { label: "Pendidikan & Akademi", icon: BookOpen },
  { label: "Pelatihan & Produk Digital", icon: Award },
  { label: "Kemitraan & Pengembangan", icon: Users },
  { label: "Hospitality Services", icon: Star },
];

const services = [
  { slug: "asesmen", name: "Asesmen", desc: "Platform asesmen psikologi online dengan pembayaran Midtrans dan laporan digital.", color: "#2D6A4F", appHref: "asesmen" },
  { slug: "konseling", name: "Konseling", desc: "Reservasi sesi konseling dengan psikolog melalui layanan booking online.", color: "#9A6E5E", appHref: "booking" },
  { slug: "terapi", name: "Terapi", desc: "Program terapi tumbuh kembang yang terstruktur dan tepat sasaran.", color: "#52B788" },
  { slug: "pelatihan", name: "Pelatihan", desc: "Pelatihan profesional untuk tenaga pendidik dan terapis.", color: "#40916C" },
  { slug: "produk-digital", name: "Produk Digital", desc: "Modul digital dan e-book berkualitas untuk pengembangan diri.", color: "#1B4332" },
  { slug: "kursus", name: "Kursus", desc: "Kursus pengembangan minat bakat: musik, tari, olahraga, akademik.", color: "#2D6A4F" },
  { slug: "sekolah", name: "Sekolah Pelangi Indonesia", desc: "Pendidikan inklusif dengan metode pembelajaran aktif dan inovatif.", color: "#3A7D58", externalHref: "https://www.pi-education.com/" },
  { slug: "horecal", name: "Hospitality Services", desc: "Layanan hospitality profesional untuk mendukung fasilitas edukasi, kelembagaan, dan penyelenggaraan kegiatan.", color: "#1B4332" },
];

const serviceIcons: Record<string, string> = {
  asesmen: "/services/asesmen.png",
  konseling: "/services/konseling.png",
  terapi: "/services/terapi.png",
  pelatihan: "/services/pelatihan.png",
  "produk-digital": "/services/produk-digital.png",
  kursus: "/services/kursus.png",
  sekolah: "/services/sekolah.png",
  horecal: "/services/horecal.png",
};

function useIntersectionObserver(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

export default function Home() {
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const [heroImageIdx, setHeroImageIdx] = useState(0);
  const statsSection = useIntersectionObserver(0.2);

  // Fetch testimonials from CMS
  const { data: cmsTestimonials } = useQuery({
    queryKey: ["cms-testimonials"],
    queryFn: fetchTestimonials,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Fetch site stats from CMS
  const { data: cmsSiteStats } = useQuery({
    queryKey: ["cms-site-stats"],
    queryFn: fetchSiteStats,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  // Use CMS data if available, otherwise fall back to hardcoded
  const testimonials: Array<{ text: string; author: string; rating: number }> =
    (cmsTestimonials?.docs?.length ?? 0) > 0
      ? cmsTestimonials!.docs.map((t: CMSTestimonial) => ({
          text: t.text,
          author: t.author,
          rating: t.rating ?? 5,
        }))
      : FALLBACK_TESTIMONIALS;

  const stats: CMSStat[] =
    (cmsSiteStats?.stats?.length ?? 0) > 0
      ? cmsSiteStats!.stats!
      : FALLBACK_STATS;

  // Auto-advance testimonials
  useEffect(() => {
    if (testimonials.length <= 1) return;
    const t = setInterval(() => {
      setTestimonialIdx((i) => (i + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(t);
  }, [testimonials.length]);

  useEffect(() => {
    const t = setInterval(() => {
      setHeroImageIdx((i) => (i + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  // Keep index in bounds if testimonials list changes
  useEffect(() => {
    setTestimonialIdx(0);
  }, [testimonials.length]);

  const prevTestimonial = () => setTestimonialIdx((i) => (i - 1 + testimonials.length) % testimonials.length);
  const nextTestimonial = () => setTestimonialIdx((i) => (i + 1) % testimonials.length);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section
        className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#1B4332]"
      >
        <div className="absolute inset-0">
          {heroImages.map((image, index) => (
            <img
              key={image.src}
              src={image.src}
              alt={image.alt}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
                index === heroImageIdx ? "opacity-100" : "opacity-0"
              }`}
              loading={index === 0 ? "eager" : "lazy"}
            />
          ))}
          <div className="absolute inset-0 bg-[#1B4332]/70" />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#1B4332]/75 to-transparent" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-24 pb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-green-200 border border-green-400/30 bg-white/10 backdrop-blur-sm mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Ekosistem Layanan Terpadu
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
            Selamat Datang di<br />
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(90deg, #74C69D, #D8F3DC)" }}>
              Pelangi Indonesia Group
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-green-100/90 max-w-3xl mx-auto leading-relaxed mb-10">
            Pusat Layanan Psikologi, Pendidikan Inklusif, dan Pengembangan Kapasitas Terpadu Pelangi Indonesia
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <WhatsAppBranchChooser label="Hubungi Kami" />
            <Link
              href="/produk-layanan"
              className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white border border-white/30 hover:bg-white/10 transition-all hover:scale-105"
            >
              Jelajahi Layanan
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-2.5">
            {businessUnits.map(({ label, icon: Icon }) => (
              <div
                key={label}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white/90 bg-white/10 border border-white/20 backdrop-blur-sm hover:bg-white/20 transition-colors cursor-default"
              >
                <Icon size={14} className="text-green-300" />
                {label}
              </div>
            ))}
          </div>

          <div className="mt-10 flex justify-center gap-2" aria-label="Foto lokasi Pelangi Indonesia Group">
            {heroImages.map((image, index) => (
              <button
                key={image.src}
                type="button"
                aria-label={`Tampilkan ${image.alt}`}
                onClick={() => setHeroImageIdx(index)}
                className={`h-2.5 rounded-full transition-all ${
                  index === heroImageIdx ? "w-8 bg-white" : "w-2.5 bg-white/45 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-16 sm:h-20">
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* Sejarah */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <div className="rounded-2xl overflow-hidden aspect-video bg-green-50 shadow-sm">
                <img
                  src="/homepage/pig-building-1.jpg"
                  alt="Gedung Pelangi Indonesia"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-2xl -z-10" style={{ background: "#D8F3DC" }} />
            </div>

            <div>
              <div className="section-divider" />
              <h2 className="text-3xl lg:text-4xl font-extrabold mb-6" style={{ color: "#1B4332" }}>
                Sejarah Kami
              </h2>
              <p className="text-gray-600 leading-relaxed text-base mb-6">
                Pelangi Indonesia Group adalah ekosistem layanan terpadu yang mendedikasikan diri pada optimalisasi kualitas sumber daya manusia secara holistik. Perjalanan kami dimulai dari sebuah visi luhur untuk menyediakan fasilitas kesehatan mental dan tumbuh kembang yang aman dan inklusif.
              </p>
              <p className="text-gray-600 leading-relaxed text-base mb-8">
                Bermula dari pendirian Rumah Psikologi dan Sekolah Pelangi Indonesia, komitmen kami terus berkembang hingga kini seluruh layanan bersatu di bawah naungan Pelangi Indonesia Group — bergerak selaras menciptakan dampak nyata dari hulu ke hilir.
              </p>
              <Link
                href="/tentang-kami"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all hover:scale-105 hover:shadow-md"
                style={{ background: "#2D6A4F" }}
              >
                Pelajari Lebih Lanjut
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Visi & Misi */}
      <section className="py-20" style={{ background: "#F7FAF8" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="section-divider mx-auto" />
            <h2 className="text-3xl lg:text-4xl font-extrabold" style={{ color: "#1B4332" }}>Visi & Misi</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="rounded-2xl p-8 text-white" style={{ background: "linear-gradient(135deg, #1B4332, #2D6A4F)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 bg-white/20">
                <Star size={20} className="text-yellow-300" />
              </div>
              <h3 className="text-xl font-bold mb-4">Visi</h3>
              <p className="text-green-100/90 leading-relaxed">
                Menjadi ekosistem layanan psikologi, pendidikan, dan pengembangan sumber daya manusia yang komprehensif dan terpercaya di Indonesia guna mewujudkan <span className="text-white font-semibold">"Jiwa Tumbuh, Indonesia Tangguh."</span>
              </p>
            </div>

            <div className="rounded-2xl p-8 bg-white border border-gray-100 shadow-sm">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5" style={{ background: "#D8F3DC" }}>
                <Award size={20} style={{ color: "#2D6A4F" }} />
              </div>
              <h3 className="text-xl font-bold mb-4" style={{ color: "#1B4332" }}>Misi</h3>
              <ol className="space-y-3">
                {[
                  "Menyediakan layanan psikotes, asesmen, dan konseling berbasis kode etik dan metode ilmiah yang teruji.",
                  "Menyediakan layanan pendidikan dengan metode pembelajaran aktif, inovatif, dan inklusif.",
                  "Menyelenggarakan program terapi tumbuh kembang dan kursus pengembangan minat bakat yang terstruktur.",
                  "Memfasilitasi edukasi masyarakat melalui pelatihan profesional dan produk digital berkualitas.",
                  "Membangun jaringan kemitraan strategis untuk memperluas jangkauan layanan secara nasional.",
                  "Menghadirkan layanan bisnis operasional yang unggul guna menunjang kelancaran fasilitas edukasi.",
                ].map((m, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-600">
                    <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5" style={{ background: "#2D6A4F" }}>
                      {i + 1}
                    </span>
                    <span>{m}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Statistik — from CMS or hardcoded fallback */}
      <section className="relative isolate overflow-hidden py-20 bg-white" ref={statsSection.ref}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 grid grid-rows-2 sm:grid-cols-2 sm:grid-rows-1">
          <img
            src="/homepage/dampak-nyata-1.jpeg"
            alt=""
            className="h-full w-full object-cover opacity-60"
          />
          <img
            src="/homepage/dampak-nyata-2.jpeg"
            alt=""
            className="h-full w-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-white/45" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="section-divider mx-auto" />
            <h2 className="text-3xl lg:text-4xl font-extrabold" style={{ color: "#1B4332" }}>Dampak Nyata Kami</h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">
              Angka-angka ini mencerminkan perjalanan dan kepercayaan yang telah diberikan kepada kami.
            </p>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={`rounded-2xl border p-4 text-center transition-all hover:shadow-md sm:p-5 lg:p-6 ${statsSection.visible ? "stat-item" : "opacity-0"}`}
                style={{
                  animationDelay: `${i * 0.15}s`,
                  background: i % 2 === 0 ? "linear-gradient(135deg, #1B4332, #2D6A4F)" : "white",
                  borderColor: i % 2 === 0 ? "transparent" : "#E5F5EC",
                }}
              >
                <div
                  className="mb-2 text-3xl font-extrabold lg:text-4xl"
                  style={{ color: i % 2 === 0 ? "white" : "#2D6A4F" }}
                >
                  {s.value}
                </div>
                <div className={`text-sm font-medium leading-snug ${i % 2 === 0 ? "text-green-200" : "text-gray-500"}`}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Layanan */}
      <section className="py-20" style={{ background: "#F7FAF8" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="section-divider mx-auto" />
            <h2 className="text-3xl lg:text-4xl font-extrabold" style={{ color: "#1B4332" }}>Produk & Layanan</h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">
              Beragam layanan psikologi, pendidikan, dan pengembangan kapasitas untuk semua kalangan.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((s) => {
              const cardClass = "service-card block p-6 bg-white rounded-2xl border border-gray-100 shadow-sm group";
              const inner = (
                <>
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-xl bg-white">
                    <img
                      src={serviceIcons[s.slug]}
                      alt=""
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2 group-hover:text-green-800 transition-colors">{s.name}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
                  <div className="mt-4 flex items-center gap-1 text-xs font-semibold" style={{ color: "#2D6A4F" }}>
                    Selengkapnya <ArrowRight size={12} />
                  </div>
                </>
              );
              if ("appHref" in s) {
                const href = s.appHref === "booking" ? getBookingHref() : getAsesmenPlatformHref();
                return <a key={s.slug} href={href} className={cardClass}>{inner}</a>;
              }
              return s.externalHref ? (
                <a key={s.slug} href={s.externalHref} target="_blank" rel="noopener noreferrer" className={cardClass}>{inner}</a>
              ) : (
                <Link key={s.slug} href={`/produk-layanan/${s.slug}`} className={cardClass}>{inner}</Link>
              );
            })}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/produk-layanan"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white transition-all hover:scale-105 hover:shadow-md"
              style={{ background: "#2D6A4F" }}
            >
              Lihat Semua Layanan
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Testimoni — from CMS or fallback */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="section-divider mx-auto" />
            <h2 className="text-3xl lg:text-4xl font-extrabold" style={{ color: "#1B4332" }}>Apa Kata Mereka?</h2>
            <p className="text-gray-500 mt-3">Sepenggal kisah dari mereka yang telah bertumbuh bersama kami.</p>
          </div>

          <div className="relative">
            <div className="bg-white rounded-3xl p-10 shadow-lg border border-gray-100 text-center min-h-[200px] flex flex-col items-center justify-center">
              <div className="flex justify-center gap-1 mb-6">
                {Array.from({ length: testimonials[testimonialIdx]?.rating ?? 5 }).map((_, i) => (
                  <Star key={i} size={16} fill="#D4AC0D" color="#D4AC0D" />
                ))}
              </div>
              <blockquote className="text-lg text-gray-700 italic leading-relaxed mb-6 max-w-2xl font-serif">
                &ldquo;{testimonials[testimonialIdx]?.text}&rdquo;
              </blockquote>
              <cite className="text-sm font-semibold not-italic" style={{ color: "#2D6A4F" }}>
                — {testimonials[testimonialIdx]?.author}
              </cite>
            </div>

            {testimonials.length > 1 && (
              <>
                <button
                  onClick={prevTestimonial}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-5 w-10 h-10 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center text-gray-600 hover:text-green-800 hover:border-green-300 transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={nextTestimonial}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-5 w-10 h-10 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center text-gray-600 hover:text-green-800 hover:border-green-300 transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}

            <div className="flex justify-center gap-2 mt-6">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setTestimonialIdx(i)}
                  className={`h-2 rounded-full transition-all ${i === testimonialIdx ? "w-6" : "w-2 opacity-30"}`}
                  style={{ background: "#2D6A4F" }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Sub unit bisnis */}
      <section className="py-20" style={{ background: "#F7FAF8" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="section-divider mx-auto" />
            <h2 className="text-3xl lg:text-4xl font-extrabold" style={{ color: "#1B4332" }}>Sub Unit Bisnis Pelangi Indonesia</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="h-56 overflow-hidden bg-green-50">
                <img
                  src="/homepage/sekolah-pelangi-unit.jpg"
                  alt="Sekolah Pelangi Indonesia"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold mb-3" style={{ color: "#1B4332" }}>Sekolah Pelangi Indonesia</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-5">
                  Sekolah inklusif yang menyediakan pendidikan berkualitas dengan metode pembelajaran aktif, inovatif, dan ramah anak berkebutuhan khusus.
                </p>
                <a href="https://www.pi-education.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:shadow-md" style={{ background: "#2D6A4F" }}>
                  More Information <ArrowRight size={14} />
                </a>
              </div>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="h-56 overflow-hidden bg-green-50">
                <img
                  src="/homepage/horecal-unit.jpg"
                  alt="Hospitality Services"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold mb-3" style={{ color: "#1B4332" }}>Hospitality Services</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-5">
                  Unit usaha pendukung yang menyediakan layanan hospitality dan operasional profesional untuk fasilitas edukasi, kelembagaan, dan berbagai kegiatan.
                </p>
                <Link href="/produk-layanan/horecal" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:shadow-md" style={{ background: "#9A6E5E" }}>
                  More Information <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20" style={{ background: "linear-gradient(135deg, #1B4332, #2D6A4F)" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-extrabold text-white mb-5">Siap Memulai Perjalanan Anda?</h2>
          <p className="text-green-100/80 text-lg mb-10 leading-relaxed">
            Konsultasikan kebutuhan Anda bersama tim profesional kami. Kami siap membantu menemukan layanan yang paling sesuai.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <WhatsAppBranchChooser label="Chat WhatsApp" />
            <Link
              href="/kontak"
              className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white border border-white/30 hover:bg-white/10 transition-all"
            >
              Lihat Kontak Lengkap
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <Footer />

    </div>
  );
}
