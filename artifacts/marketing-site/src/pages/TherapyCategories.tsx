import type { ComponentType } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, HeartHandshake, Puzzle } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Link, useRoute } from "wouter";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

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

const therapyCategories: TherapyCategory[] = [
  {
    slug: "tumbuh-kembang",
    title: "Terapi Tumbuh Kembang",
    description: "Program terapi terstruktur untuk mendukung kemampuan komunikasi, perilaku, sensori, serta perkembangan anak.",
    introduction: "Program pendampingan untuk anak berkebutuhan khusus dan anak dengan tantangan perkembangan. Rencana terapi disusun berdasarkan kebutuhan setiap anak dan dievaluasi secara berkala.",
    icon: Puzzle,
    accent: "from-emerald-500 to-green-700",
    iconStyle: "bg-emerald-100 text-emerald-700",
    availability: "Layanan anak & remaja",
    services: ["Terapi wicara", "Terapi perilaku", "Terapi sensori integrasi", "Terapi bermain"],
  },
  {
    slug: "psikoterapi",
    title: "Psikoterapi",
    description: "Pendampingan psikologis profesional untuk membantu mengelola masalah emosional, perilaku, dan kesehatan mental.",
    introduction: "Layanan intervensi psikologis yang dilakukan secara profesional dan disesuaikan dengan kebutuhan, kondisi, serta tujuan terapi setiap klien.",
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

export default function TherapyCategories() {
  const [detailMatch, detailParams] = useRoute("/produk-layanan/terapi/:categorySlug");
  const selectedCategory = detailMatch ? therapyCategories.find((category) => category.slug === detailParams.categorySlug) : undefined;

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
      </main>
      <Footer />
    </div>
  );
}
