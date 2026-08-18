import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import AssessmentCard from "@/components/assessment-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Assessment } from "@shared/schema";
import { ArrowLeft, CheckCircle2, Info, MonitorCheck } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const onlineAssessmentBenefits = [
  "Waktu pengerjaan fleksibel",
  "Dapat dilakukan dari mana saja",
  "Hasil tepat dan akurat",
  "Biaya terjangkau",
  "GRATIS 1x konseling dengan psikolog (untuk asesmen paket)",
  "Tes dapat berlaku untuk klien individu dan klasikal (akan ada harga khusus)",
];

const hiddenOnlineAssessmentTypes = new Set([
  "mental-health",
  "student-potential",
  "career-potential",
]);

const onlineAssessmentOrder = new Map([
  ["learning", 0],
  ["sensory", 1],
  ["external-mental-health", 2],
  ["external-student-potential", 3],
  ["external-career-potential", 4],
]);

export default function Assessments() {
  const { data: assessments, isLoading, error } = useQuery<Assessment[]>({
    queryKey: ["/api/assessments"],
  });
  const visibleAssessments = assessments
    ?.filter((assessment) => !hiddenOnlineAssessmentTypes.has(assessment.type))
    .sort(
      (first, second) =>
        (onlineAssessmentOrder.get(first.type) ?? Number.MAX_SAFE_INTEGER) -
        (onlineAssessmentOrder.get(second.type) ?? Number.MAX_SAFE_INTEGER),
    );

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/assessments" className="mb-8 inline-flex items-center text-sm font-semibold text-emerald-800 hover:text-emerald-600">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke Kategori Asesmen
        </Link>
        <div className="text-center mb-12">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <MonitorCheck className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-bold text-neutral-900 dark:text-foreground mb-4">
            Asesmen Online
          </h1>
          <p className="text-lg text-neutral-500 dark:text-muted-foreground max-w-3xl mx-auto">Pilih asesmen psikologi yang dapat dikerjakan secara daring. Setiap asesmen dirancang untuk memberikan pengalaman yang praktis, aman, dan mudah diakses.</p>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="mt-6 border-emerald-300 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900">
                <Info className="mr-2 h-4 w-4" />
                Tentang Asesmen Online
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto p-0">
              <div className="bg-gradient-to-r from-emerald-800 to-green-600 px-6 py-7 text-white sm:px-8">
                <DialogHeader>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
                    <MonitorCheck className="h-6 w-6" />
                  </div>
                  <DialogTitle className="text-left text-2xl text-white">Deskripsi Asesmen Online</DialogTitle>
                  <DialogDescription className="text-left text-green-50/90">
                    Layanan asesmen psikologi digital dari Pelangi Indonesia.
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="space-y-6 px-6 pb-7 pt-7 sm:px-8">
                <div className="space-y-4 text-left leading-relaxed text-neutral-700">
                  <p>
                    Layanan asesmen online merupakan proses evaluasi psikologis yang dilakukan secara digital atau online untuk membantu memahami potensi, karakter, maupun kebutuhan individu secara lebih mendalam. Asesmen dilakukan menggunakan instrumen psikologi yang terstandar dan didampingi oleh tenaga profesional di bidang psikologi.
                  </p>
                  <p>
                    Layanan ini dapat digunakan untuk berbagai kebutuhan, seperti pemetaan potensi diri, asesmen pendidikan, seleksi dan pengembangan sumber daya manusia, evaluasi tumbuh kembang anak hingga kebutuhan konseling dan intervensi lanjutan. Proses asesmen dirancang praktis, fleksibel, dan dapat diakses dari mana saja tanpa mengurangi kualitas hasil evaluasi. Hasil asesmen disajikan dalam bentuk laporan psikologis yang informatif dan dapat menjadi dasar pengambilan keputusan, baik untuk individu, orang tua, sekolah, maupun perusahaan.
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-left">
                  <h3 className="font-semibold text-emerald-950">Keunggulan Asesmen Online Pelangi Indonesia</h3>
                  <ol className="mt-4 space-y-3">
                    {onlineAssessmentBenefits.map((benefit, index) => (
                      <li key={benefit} className="flex items-start gap-3 text-sm leading-relaxed text-neutral-700 sm:text-base">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">{index + 1}</span>
                        <span className="flex-1">{benefit}</span>
                        <CheckCircle2 className="mt-0.5 hidden h-5 w-5 shrink-0 text-emerald-600 sm:block" />
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <div className="text-center py-12">
            <p className="text-red-500 mb-4">Gagal memuat asesmen</p>
            <p className="text-neutral-500 dark:text-muted-foreground">
              Silakan refresh halaman atau hubungi dukungan jika masalah berlanjut.
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-card rounded-2xl shadow-lg border border-gray-100 dark:border-border overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <div className="p-8 space-y-4">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <div className="flex justify-between items-center pt-4">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-10 w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : visibleAssessments && visibleAssessments.length > 0 ? (
          <div className="flex justify-center">
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl">
              {visibleAssessments.map((assessment) => (
                <AssessmentCard 
                  key={assessment.id} 
                  assessment={assessment} 
                  showAddToCart={true} 
                  showCatalogImage={true}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-neutral-500 dark:text-muted-foreground mb-4">
              No assessments available at the moment
            </p>
            <p className="text-sm text-neutral-400 dark:text-muted-foreground">
              Please check back later or contact support for assistance.
            </p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
