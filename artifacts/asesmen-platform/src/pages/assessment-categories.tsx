import type { ComponentType } from "react";
import { ArrowLeft, ArrowRight, Building2, ClipboardList, MonitorCheck, PackageSearch } from "lucide-react";
import { Link } from "wouter";
import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type AssessmentCategory = {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
  iconStyle: string;
  availability: string;
};

const assessmentCategories: AssessmentCategory[] = [
  {
    title: "Asesmen Online",
    description: "Kerjakan asesmen psikologi secara daring dengan proses yang praktis, aman, dan dapat diakses dari mana saja.",
    href: "/assessments/online",
    icon: MonitorCheck,
    accent: "from-emerald-500 to-green-700",
    iconStyle: "bg-emerald-100 text-emerald-700",
    availability: "Tersedia sekarang",
  },
  {
    title: "Asesmen Onsite",
    description: "Layanan asesmen yang dilaksanakan secara langsung dengan pendampingan tim profesional di lokasi.",
    href: "/assessments/onsite",
    icon: Building2,
    accent: "from-sky-500 to-blue-700",
    iconStyle: "bg-sky-100 text-sky-700",
    availability: "Informasi layanan",
  },
  {
    title: "Alat Tes Psikologi",
    description: "Katalog alat tes psikologi untuk mendukung kebutuhan praktisi, institusi pendidikan, dan organisasi.",
    href: "/assessments/alat-tes",
    icon: ClipboardList,
    accent: "from-amber-500 to-orange-700",
    iconStyle: "bg-amber-100 text-amber-700",
    availability: "Informasi produk",
  },
];

export function AssessmentCategoryGrid() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {assessmentCategories.map((category) => {
        const Icon = category.icon;
        return (
          <Card key={category.title} className="group relative overflow-hidden border-0 bg-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className={`h-2 bg-gradient-to-r ${category.accent}`} />
            <CardContent className="flex h-full flex-col p-7">
              <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${category.iconStyle}`}>
                <Icon className="h-7 w-7" />
              </div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">{category.availability}</p>
              <h3 className="text-2xl font-bold text-neutral-900">{category.title}</h3>
              <p className="mt-3 flex-1 leading-relaxed text-neutral-600">{category.description}</p>
              <Link href={category.href} className="mt-6 inline-flex items-center font-semibold text-emerald-800 transition-colors hover:text-emerald-600">
                Lihat Selengkapnya
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function AssessmentCategories() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      <main>
        <section className="bg-gradient-to-br from-[#1B4332] via-[#2D6A4F] to-[#40916C] px-4 py-16 text-white sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-100">Produk & Layanan</p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">Pilih Kategori Asesmen</h1>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-green-50/90">
              Temukan layanan asesmen yang paling sesuai untuk kebutuhan pribadi, keluarga, sekolah, organisasi, maupun praktik profesional.
            </p>
          </div>
        </section>
        <section className="px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
          <div className="mx-auto max-w-7xl">
            <AssessmentCategoryGrid />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function InformationPage({
  title,
  description,
  icon: Icon,
  highlights,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  highlights: string[];
}) {
  const whatsappMessage = encodeURIComponent(`Halo PI, saya ingin mendapatkan informasi mengenai ${title}.`);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <Link href="/assessments" className="mb-8 inline-flex items-center text-sm font-semibold text-emerald-800 hover:text-emerald-600">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke Kategori Asesmen
        </Link>
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-neutral-200">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-8 sm:p-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Icon className="h-8 w-8" />
              </div>
              <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Produk & Layanan Asesmen</p>
              <h1 className="mt-3 text-4xl font-bold text-neutral-900">{title}</h1>
              <p className="mt-5 text-lg leading-relaxed text-neutral-600">{description}</p>
              <ul className="mt-8 space-y-3">
                {highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-3 text-neutral-700">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-600" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
              <a href={`https://wa.me/6285117658242?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="mt-9 bg-emerald-700 hover:bg-emerald-800">Hubungi Hotline PI</Button>
              </a>
            </div>
            <div className="flex min-h-[320px] items-center justify-center bg-gradient-to-br from-emerald-800 to-green-500 p-10 text-white">
              <div className="text-center">
                <PackageSearch className="mx-auto h-20 w-20 opacity-90" />
                <h2 className="mt-6 text-2xl font-bold">Katalog sedang disiapkan</h2>
                <p className="mt-3 max-w-sm text-green-50/90">Tim kami siap membantu memberikan informasi layanan dan produk yang tersedia saat ini.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export function OnsiteAssessments() {
  return (
    <InformationPage
      title="Asesmen Onsite"
      description="Layanan asesmen psikologi yang dilaksanakan secara langsung dan disesuaikan dengan kebutuhan individu maupun institusi."
      icon={Building2}
      highlights={["Pelaksanaan terjadwal di lokasi", "Pendampingan tim profesional", "Pilihan layanan dapat disesuaikan dengan kebutuhan"]}
    />
  );
}

export function PsychologyTestTools() {
  return (
    <InformationPage
      title="Alat Tes Psikologi"
      description="Informasi alat tes psikologi untuk mendukung kebutuhan praktisi, lembaga pendidikan, perusahaan, dan organisasi."
      icon={ClipboardList}
      highlights={["Informasi fungsi dan sasaran penggunaan", "Dukungan pemilihan alat sesuai kebutuhan", "Pemesanan dan ketersediaan melalui Hotline PI"]}
    />
  );
}
