import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowRight, ChevronRight, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { SiWhatsapp } from "react-icons/si";
import { fetchServices, fetchServiceBySlug, type CMSService } from "@/lib/cms";
import { getAsesmenPlatformHref, getBookingHref } from "@/lib/platform-links";

// ─── Fallback data ────────────────────────────────────────────────────────────

const FALLBACK_SERVICES = [
  { slug: "asesmen", name: "Asesmen", shortDescription: "Platform asesmen psikologi online dengan pembayaran Midtrans dan laporan digital.", longDesc: "Platform asesmen psikologi online Rumah Psikologi Pelangi Indonesia untuk memilih, membayar, dan mengerjakan asesmen secara digital.", color: "#2D6A4F", externalHref: "__ASESMEN_PLATFORM__" },
  { slug: "konseling", name: "Konseling", shortDescription: "Reservasi sesi konseling dengan psikolog melalui layanan booking online.", longDesc: "Layanan booking psikolog untuk konsultasi individu, keluarga, pendidikan, atau tindak lanjut asesmen. Setelah pembayaran berhasil, jadwal sesi dikonfirmasi bersama psikolog.", color: "#9A6E5E", externalHref: "__BOOKING__" },
  { slug: "terapi", name: "Terapi", shortDescription: "Program terapi tumbuh kembang yang terstruktur dan tepat sasaran.", longDesc: "Program terapi tumbuh kembang untuk anak berkebutuhan khusus (ABK) dan anak dengan tantangan perkembangan. Meliputi terapi wicara, terapi perilaku, terapi sensori integrasi, dan terapi bermain.", color: "#52B788" },
  { slug: "pelatihan", name: "Pelatihan", shortDescription: "Pelatihan profesional untuk tenaga pendidik dan terapis.", longDesc: "Workshop dan pelatihan profesional untuk guru, konselor, orang tua, dan tenaga kesehatan. Mencakup pelatihan manajemen perilaku anak, teknik konseling, dan asesmen psikologi.", color: "#40916C" },
  { slug: "produk-digital", name: "Produk Digital", shortDescription: "Modul digital dan e-book berkualitas untuk pengembangan diri.", longDesc: "Berbagai modul pembelajaran digital, e-book, dan materi pelatihan yang dikembangkan oleh tim ahli Pelangi Indonesia.", color: "#1B4332" },
  { slug: "kursus", name: "Kursus", shortDescription: "Kursus pengembangan minat bakat: musik, tari, olahraga, akademik.", longDesc: "Program kursus terstruktur untuk anak dan remaja: Baca Tulis, Matematika, Bimbingan Belajar Privat, Sempoa, Balet, Taekwondo, Renang, Tari, Musik, Senam, dan Yoga.", color: "#2D6A4F", highlights: ["Baca Tulis — Rp 325.000/bulan", "Matematika", "Sempoa", "Balet", "Taekwondo", "Renang", "Tari", "Musik", "Senam", "Yoga", "Bimbingan Belajar Privat"] },
  { slug: "franchise", name: "Franchise", shortDescription: "Peluang kemitraan dan franchise untuk memperluas jangkauan layanan.", longDesc: "Program franchise Pelangi Indonesia memungkinkan institusi lain untuk mengadopsi sistem layanan psikologi dan pendidikan kami.", color: "#9A6E5E" },
  { slug: "sekolah", name: "Sekolah Pelangi Indonesia", shortDescription: "Pendidikan inklusif dengan metode pembelajaran aktif dan inovatif.", longDesc: "Sekolah Pelangi Indonesia adalah lembaga pendidikan inklusif yang menerima semua anak termasuk Anak Berkebutuhan Khusus.", color: "#1B4332", externalHref: "https://www.pi-education.com/" },
  { slug: "horecal", name: "HORECAL", shortDescription: "Layanan bisnis operasional untuk fasilitas edukasi dan kelembagaan.", longDesc: "HORECAL adalah unit usaha pendukung Pelangi Indonesia yang menyediakan layanan bisnis operasional komprehensif.", color: "#9A6E5E" },
];

function serviceColor(slug: string): string {
  return FALLBACK_SERVICES.find((s) => s.slug === slug)?.color ?? "#2D6A4F";
}

function resolveServiceHref(externalHref: string) {
  if (externalHref === "__BOOKING__") return getBookingHref();
  if (externalHref === "__ASESMEN_PLATFORM__") return getAsesmenPlatformHref();
  return externalHref;
}

// ─── Service List Card ────────────────────────────────────────────────────────

function ServiceCard({ service }: { service: { slug: string; name: string; shortDescription?: string; color: string; externalHref?: string } }) {
  const cardClass = "service-card block p-6 bg-white rounded-2xl border border-gray-100 shadow-sm group";
  const inner = (
    <>
      <div className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center text-white text-lg font-bold" style={{ background: service.color }}>
        {service.name.charAt(0)}
      </div>
      <h3 className="font-bold text-gray-900 mb-2 group-hover:text-green-800 transition-colors text-lg">{service.name}</h3>
      <p className="text-gray-500 text-sm leading-relaxed mb-4">{service.shortDescription}</p>
      <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: service.color }}>
        Pelajari Selengkapnya <ArrowRight size={12} />
      </div>
    </>
  );
  if (service.externalHref) {
    const href = resolveServiceHref(service.externalHref);
    const isPlatformLink = service.externalHref === "__BOOKING__" || service.externalHref === "__ASESMEN_PLATFORM__";
    return <a href={href} target={isPlatformLink ? undefined : "_blank"} rel={isPlatformLink ? undefined : "noopener noreferrer"} className={cardClass}>{inner}</a>;
  }
  return <Link href={`/produk-layanan/${service.slug}`} className={cardClass}>{inner}</Link>;
}

// ─── Service Detail ───────────────────────────────────────────────────────────

function ServiceDetail({ slug }: { slug: string }) {
  const { data: cmsService, isLoading } = useQuery({
    queryKey: ["cms-service", slug],
    queryFn: () => fetchServiceBySlug(slug),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const fallback = FALLBACK_SERVICES.find((s) => s.slug === slug);
  const color = cmsService ? serviceColor(cmsService.slug) : (fallback?.color ?? "#2D6A4F");
  const name = cmsService?.title ?? fallback?.name ?? "Layanan";
  const shortDesc = cmsService?.shortDescription ?? fallback?.shortDescription ?? "";
  const descHtml = (cmsService as CMSService | null)?.descriptionHtml;
  const imageUrl = (cmsService?.featuredImage as { url?: string } | undefined)?.url;
  const price = cmsService?.price;

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="pt-28 pb-16 text-white" style={{ background: `linear-gradient(135deg, ${color}dd, ${color})` }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 text-sm text-white/70 mb-8">
            <Link href="/" className="hover:text-white transition-colors">Beranda</Link>
            <ChevronRight size={14} />
            <Link href="/produk-layanan" className="hover:text-white transition-colors">Produk & Layanan</Link>
            <ChevronRight size={14} />
            <span className="text-white">{name}</span>
          </nav>
          <h1 className="text-4xl lg:text-5xl font-extrabold mb-4">{name}</h1>
          {shortDesc && <p className="text-lg text-white/80 max-w-2xl">{shortDesc}</p>}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-green-700" />
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-10">
            <div className="md:col-span-2">
              {imageUrl && (
                <img src={imageUrl} alt={name} className="w-full h-56 object-cover rounded-2xl mb-8" />
              )}

              <div className="section-divider" />
              <h2 className="text-2xl font-extrabold mb-5" style={{ color: "#1B4332" }}>Tentang Layanan Ini</h2>

              {descHtml ? (
                <div
                  className="prose prose-lg max-w-none prose-headings:text-green-900 prose-a:text-green-700 mb-6"
                  dangerouslySetInnerHTML={{ __html: descHtml }}
                />
              ) : (
                <p className="text-gray-600 leading-relaxed text-base mb-6">
                  {fallback?.longDesc}
                </p>
              )}

              {price && (
                <div className="mt-4 p-4 rounded-xl border" style={{ background: "#D8F3DC", borderColor: "#52B788" }}>
                  <p className="text-sm font-semibold" style={{ color: "#1B4332" }}>Harga: {price}</p>
                </div>
              )}

              {fallback?.highlights && !descHtml && (
                <>
                  <h3 className="text-lg font-bold mt-6 mb-3" style={{ color: "#1B4332" }}>Program Tersedia</h3>
                  <ul className="space-y-2">
                    {fallback.highlights.map((h, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                        {h}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div>
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm sticky top-24">
                <h3 className="font-bold text-gray-900 mb-4">Tertarik dengan layanan ini?</h3>
                <p className="text-gray-500 text-sm mb-5 leading-relaxed">
                  Konsultasikan kebutuhan Anda bersama tim profesional kami.
                </p>
                <a
                  href="https://wa.me/6285117658242"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md mb-3"
                  style={{ background: "#25D366" }}
                >
                  <SiWhatsapp size={16} />
                  Chat WhatsApp
                </a>
                <a
                  href="mailto:psikologi.pelangiindonesia@gmail.com"
                  className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:border-green-300 hover:text-green-800 transition-all"
                >
                  Kirim Email
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProdukLayanan() {
  const [matchDetail, paramsDetail] = useRoute("/produk-layanan/:slug");

  // Hooks must always be called before any conditional returns
  const { data: cmsServices, isLoading } = useQuery({
    queryKey: ["cms-services"],
    queryFn: fetchServices,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: !matchDetail,
  });

  // Handle detail / external-redirect routes after all hooks
  if (matchDetail && paramsDetail?.slug) {
    const slug = paramsDetail.slug;
    const external = FALLBACK_SERVICES.find((s) => s.slug === slug)?.externalHref;
    if (external) {
      window.location.replace(resolveServiceHref(external));
      return null;
    }
    return <ServiceDetail slug={slug} />;
  }

  // Use CMS data if available, otherwise fall back to hardcoded
  const services =
    (cmsServices?.docs?.length ?? 0) > 0
      ? cmsServices!.docs.filter((s: CMSService) => s.slug !== "booking-psikolog").map((s: CMSService) => ({
          slug: s.slug,
          name: s.title,
          shortDescription: s.shortDescription,
          color: serviceColor(s.slug),
          externalHref: FALLBACK_SERVICES.find((f) => f.slug === s.slug)?.externalHref,
        }))
      : FALLBACK_SERVICES.map((s) => ({
          slug: s.slug,
          name: s.name,
          shortDescription: s.shortDescription,
          color: s.color,
          externalHref: s.externalHref,
        }));

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="pt-32 pb-16 text-center" style={{ background: "linear-gradient(135deg, #1B4332, #2D6A4F)" }}>
        <h1 className="text-4xl lg:text-5xl font-extrabold text-white mb-4">Produk & Layanan</h1>
        <p className="text-green-100/80 text-lg max-w-2xl mx-auto px-4">
          Beragam layanan psikologi, pendidikan, dan pengembangan kapasitas untuk semua kalangan.
        </p>
      </div>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 size={32} className="animate-spin text-green-700" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((s) => (
                <ServiceCard key={s.slug} service={s} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
