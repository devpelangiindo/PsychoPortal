import type { ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Info, MessageCircle, MonitorCheck, PackageSearch, Sparkles } from "lucide-react";
import { Link } from "wouter";
import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import onsiteAssessmentTopImage from "@assets/asesmen-onsite-1.png";
import onsiteAssessmentBottomImage from "@assets/asesmen-onsite-2.png";
import { apiUrl } from "@/lib/api-base";

type AssessmentCategory = {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
  iconStyle: string;
  availability: string;
};

type AssessmentService = {
  id?: number;
  slug?: string;
  title: string;
  description: string;
  resultText?: string;
  targetText?: string;
  price: number;
  hasImage?: boolean;
  imageFocusX?: number;
  imageFocusY?: number;
};

function detailLines(value?: string) {
  return (value || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

const onsiteAssessmentServices: AssessmentService[] = [
  {
    title: "Surat Keterangan Sehat Mental Psikologi",
    description: "Sebagai syarat administratif kerja, jabatan, atau legal.",
    price: 250000,
  },
  {
    title: "Tes Intelegensi Lengkap",
    description: "Pemetaan skor IQ dan kekuatan kognitif.",
    price: 250000,
  },
  {
    title: "Asesmen Deteksi Dini Tumbuh Kembang",
    description: "Identifikasi awal aspek motorik, bicara, & sosial anak.",
    price: 450000,
  },
  {
    title: "Asesmen Kesiapan Masuk SD",
    description: "Evaluasi kematangan anak memasuki jenjang sekolah dasar.",
    price: 450000,
  },
  {
    title: "Asesmen Kecerdasan, Minat, Kepribadian SMP",
    description: "Penentuan arah studi dan penjurusan karier masa depan.",
    price: 500000,
  },
  {
    title: "Asesmen Kecerdasan, Minat, Kepribadian SMA",
    description: "Penentuan arah studi dan penjurusan karier masa depan.",
    price: 600000,
  },
  {
    title: "Asesmen Kerja",
    description: "Rekrutmen, promosi, dan pemetaan potensi SDM.",
    price: 800000,
  },
  {
    title: "Asesmen Klinis Dewasa",
    description: "Diagnosis kesehatan mental dan rencana intervensi.",
    price: 800000,
  },
];

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

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
];

export function AssessmentCategoryGrid() {
  return (
    <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
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
  catalog,
  panelImages,
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
  catalog?: AssessmentService[];
  panelImages?: {
    top: { src: string; alt: string };
    bottom: { src: string; alt: string };
  };
}) {
  const whatsappMessage = encodeURIComponent(`Halo PI, saya ingin mendapatkan informasi mengenai ${title}.`);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
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
            <div className="min-h-[320px] bg-gradient-to-br from-emerald-800 to-green-500 text-white">
              {panelImages ? (
                <div className="grid h-full min-h-[620px] grid-rows-[minmax(170px,1fr)_auto_minmax(170px,1fr)] lg:min-h-full">
                  <img src={panelImages.top.src} alt={panelImages.top.alt} className="h-full min-h-0 w-full object-cover" />
                  <div className="px-8 py-8 text-center">
                    <PackageSearch className="mx-auto h-14 w-14 opacity-90" />
                    <h2 className="mt-4 text-2xl font-bold">{catalog ? `${catalog.length} Layanan Tersedia` : "Katalog sedang disiapkan"}</h2>
                    <p className="mx-auto mt-3 max-w-sm text-green-50/90">
                      {catalog
                        ? "Pilih layanan asesmen yang sesuai dan hubungi Hotline PI untuk mengatur jadwal pelaksanaan."
                        : "Tim kami siap membantu memberikan informasi layanan dan produk yang tersedia saat ini."}
                    </p>
                  </div>
                  <img src={panelImages.bottom.src} alt={panelImages.bottom.alt} className="h-full min-h-0 w-full object-cover" />
                </div>
              ) : (
                <div className="flex min-h-[320px] items-center justify-center p-10">
                  <div className="text-center">
                    <PackageSearch className="mx-auto h-20 w-20 opacity-90" />
                    <h2 className="mt-6 text-2xl font-bold">{catalog ? `${catalog.length} Layanan Tersedia` : "Katalog sedang disiapkan"}</h2>
                    <p className="mt-3 max-w-sm text-green-50/90">
                      {catalog
                        ? "Pilih layanan asesmen yang sesuai dan hubungi Hotline PI untuk mengatur jadwal pelaksanaan."
                        : "Tim kami siap membantu memberikan informasi layanan dan produk yang tersedia saat ini."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {catalog && (
          <section className="mt-12" aria-labelledby="onsite-catalog-title">
            <div className="mb-7 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Promo Paket</p>
              <h2 id="onsite-catalog-title" className="mt-2 text-3xl font-bold text-neutral-900">Katalog Layanan Asesmen Onsite</h2>
              <p className="mx-auto mt-3 max-w-2xl text-neutral-600">Pilih layanan yang paling sesuai dengan kebutuhan Anda. Tim kami akan membantu proses pendaftaran dan penjadwalan.</p>
            </div>
            <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {catalog.map((service) => {
                const serviceMessage = encodeURIComponent(`Halo PI, saya ingin mendaftar layanan Asesmen Onsite: ${service.title}. Mohon informasi selanjutnya.`);
                return (
                  <Card key={service.title} className="group overflow-hidden border-neutral-200 bg-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                    <CardContent className="flex h-full flex-col p-0">
                      {service.id && service.hasImage && <div className="aspect-[4/3] overflow-hidden bg-neutral-100"><img src={apiUrl(`/api/onsite-assessments/${service.id}/image`)} alt={service.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" style={{ objectPosition: `${service.imageFocusX ?? 50}% ${service.imageFocusY ?? 50}%` }} /></div>}
                      <div className="bg-gradient-to-r from-emerald-700 to-green-500 px-5 py-3 text-white">
                        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em]">
                          <Sparkles className="h-4 w-4" />
                          Best Deals
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col p-6">
                        <h3 className="text-xl font-bold leading-snug text-neutral-900">{service.title}</h3>
                        <p className="mt-3 flex-1 leading-relaxed text-neutral-600">{service.description}</p>
                        {(service.resultText || service.targetText) && <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="mt-5 w-full border-emerald-200 text-emerald-800 hover:bg-emerald-50">
                              <Info className="mr-2 h-4 w-4" />
                              Lihat Selengkapnya
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle className="pr-6 text-2xl text-neutral-900">{service.title}</DialogTitle>
                              <DialogDescription className="text-left leading-7 text-neutral-600">{service.description}</DialogDescription>
                            </DialogHeader>
                            <div className="mt-2 grid gap-5 md:grid-cols-2">
                              {service.resultText && <section className="rounded-2xl bg-emerald-50 p-5">
                                <h4 className="font-bold text-emerald-950">Hasil yang Diperoleh</h4>
                                <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-700">
                                  {detailLines(service.resultText).map((line, index) => <li key={index} className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-700" /><span>{line}</span></li>)}
                                </ul>
                              </section>}
                              {service.targetText && <section className="rounded-2xl bg-sky-50 p-5">
                                <h4 className="font-bold text-sky-950">Sasaran Tes</h4>
                                <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-700">
                                  {detailLines(service.targetText).map((line, index) => <li key={index} className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-sky-700" /><span>{line}</span></li>)}
                                </ul>
                              </section>}
                            </div>
                            <a
                              href={`https://wa.me/6285117658242?text=${serviceMessage}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1"
                            >
                              <Button className="w-full bg-[#25D366] font-semibold text-white hover:bg-[#1fb85a]">
                                <MessageCircle className="mr-2 h-4 w-4" />
                                Hubungi Admin
                              </Button>
                            </a>
                          </DialogContent>
                        </Dialog>}
                        <div className="mt-6 border-t border-neutral-100 pt-5">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Harga layanan</p>
                          <p className="mt-1 text-2xl font-extrabold text-emerald-700">{formatRupiah(service.price)}</p>
                        </div>
                        <a
                          href={`https://wa.me/6285117658242?text=${serviceMessage}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-5"
                        >
                          <Button className="w-full bg-emerald-700 font-semibold hover:bg-emerald-800">
                            <MessageCircle className="mr-2 h-4 w-4" />
                            Daftar Sekarang
                          </Button>
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

export function OnsiteAssessments() {
  const { data: managedServices } = useQuery<AssessmentService[]>({
    queryKey: ["onsite-assessment-catalog"],
    queryFn: async () => { const response = await fetch(apiUrl("/api/onsite-assessments")); if (!response.ok) throw new Error("Gagal memuat katalog Asesmen Onsite"); return response.json(); },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const catalog = managedServices !== undefined ? managedServices : onsiteAssessmentServices;
  return (
    <InformationPage
      title="Asesmen Onsite"
      description="Layanan asesmen psikologi yang dilaksanakan secara langsung dan disesuaikan dengan kebutuhan individu maupun institusi."
      icon={Building2}
      highlights={["Pelaksanaan terjadwal di lokasi", "Pendampingan tim profesional", "Pilihan layanan dapat disesuaikan dengan kebutuhan"]}
      catalog={catalog}
      panelImages={{
        top: { src: onsiteAssessmentTopImage, alt: "Anak menjalani asesmen onsite dengan tenaga profesional" },
        bottom: { src: onsiteAssessmentBottomImage, alt: "Proses observasi dan asesmen profesional" },
      }}
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
