import type { ComponentType } from "react";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, ClipboardList, Info, MonitorCheck, PackageSearch } from "lucide-react";
import { Link } from "wouter";
import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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
  details,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  highlights: string[];
  details?: {
    buttonLabel: string;
    title: string;
    subtitle: string;
    introduction: string;
    sectionTitle: string;
    items: Array<{ title: string; description: string }>;
    note?: string;
  };
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
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {details && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="lg" variant="outline" className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900">
                        <Info className="mr-2 h-4 w-4" />
                        {details.buttonLabel}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto p-0">
                      <div className="bg-gradient-to-r from-sky-800 to-blue-600 px-6 py-7 text-white sm:px-8">
                        <DialogHeader>
                          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
                            <Icon className="h-6 w-6" />
                          </div>
                          <DialogTitle className="text-left text-2xl text-white">{details.title}</DialogTitle>
                          <DialogDescription className="text-left text-sky-50/90">{details.subtitle}</DialogDescription>
                        </DialogHeader>
                      </div>
                      <div className="space-y-6 px-6 pb-7 pt-7 sm:px-8">
                        <p className="text-left leading-relaxed text-neutral-700">{details.introduction}</p>
                        <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-5 text-left">
                          <h3 className="font-semibold text-sky-950">{details.sectionTitle}</h3>
                          <ol className="mt-4 space-y-4">
                            {details.items.map((item, index) => (
                              <li key={item.title} className="flex items-start gap-3">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-700 text-xs font-bold text-white">{index + 1}</span>
                                <div className="flex-1 text-sm leading-relaxed text-neutral-700 sm:text-base">
                                  <strong className="text-neutral-900">{item.title}:</strong> {item.description}
                                </div>
                                <CheckCircle2 className="mt-0.5 hidden h-5 w-5 shrink-0 text-sky-600 sm:block" />
                              </li>
                            ))}
                          </ol>
                        </div>
                        {details.note && (
                          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-left text-sm leading-relaxed text-amber-950 sm:text-base">
                            <strong>Catatan:</strong> {details.note}
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                <a href={`https://wa.me/6285117658242?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer">
                  <Button size="lg" className="w-full bg-emerald-700 hover:bg-emerald-800 sm:w-auto">Hubungi Hotline PI</Button>
                </a>
              </div>
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
      details={{
        buttonLabel: "Tentang Asesmen Onsite",
        title: "Deskripsi Asesmen Onsite",
        subtitle: "Layanan asesmen psikologi tatap muka dari Pelangi Indonesia.",
        introduction: "Kami percaya bahwa setiap individu memiliki kebutuhan yang unik. Oleh karena itu, layanan Asesmen Onsite kami dilakukan secara tatap muka langsung dengan tenaga ahli profesional untuk memastikan proses pengambilan data yang valid, observasi yang mendalam, dan hasil yang presisi.",
        sectionTitle: "Kami ingin memastikan",
        items: [
          { title: "Kebutuhan yang tepat", description: "Kami akan membantu mencocokkan keluhan atau kebutuhan Anda dengan jenis asesmen yang paling sesuai." },
          { title: "Tenaga ahli yang sesuai", description: "Kami akan menugaskan psikolog atau asisten ahli yang memiliki spesialisasi tepat untuk kasus Anda." },
          { title: "Fleksibilitas Jadwal", description: "Menyesuaikan waktu terbaik antara Anda dan tim ahli kami agar proses asesmen berjalan tanpa terburu-buru." },
        ],
      }}
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
      details={{
        buttonLabel: "Tentang Alat Tes Psikologi",
        title: "Deskripsi Alat Tes Psikologi",
        subtitle: "Instrumen tes psikologi profesional dari Pelangi Indonesia.",
        introduction: "Menyediakan berbagai instrumen tes psikologi yang valid dan terstandar untuk mendukung kebutuhan profesional Anda, mulai dari kebutuhan deteksi tumbuh kembang, pendidikan, klinis, hingga manajemen sumber daya manusia.",
        sectionTitle: "Mengapa Memilih Instrumen dari Pelangi Indonesia?",
        items: [
          { title: "Valid & Terstandar", description: "Menjamin kualitas hasil asesmen yang dapat dipertanggungjawabkan secara ilmiah." },
          { title: "Koleksi Lengkap", description: "Tersedia berbagai macam alat tes dalam satu pintu." },
          { title: "Konsultasi Ahli", description: "Kami membantu Anda merekomendasikan alat tes yang paling sesuai dengan tujuan asesmen Anda." },
        ],
        note: "Pembelian alat tes tertentu memerlukan bukti kualifikasi profesi (Psikolog/Sertifikasi Terkait) sesuai dengan kode etik yang berlaku.",
      }}
    />
  );
}
