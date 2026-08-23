import { useState, type ComponentType } from "react";
import { Activity, ArrowRight, BookOpen, Calculator, Camera, CheckCircle2, GraduationCap, Medal, Music2, Sparkles, Users, Video, Waves } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Course = {
  title: string;
  price: string;
  description: string;
  details: string[];
  icon: ComponentType<{ className?: string }>;
  accent: string;
  specialNote?: string;
};

const courses: Course[] = [
  {
    title: "Baca Tulis",
    price: "Rp 325.000/bulan",
    description: "Program baca tulis dirancang untuk membantu anak mengembangkan kemampuan dasar literasi, mulai dari mengenal huruf, membaca, menulis, hingga memahami kalimat sederhana. Pembelajaran dilakukan secara interaktif dan menyenangkan sesuai tahap perkembangan anak.",
    details: ["8 kali pertemuan", "Maksimal 6 anak per kelas", "Free trial 1 kali", "Modul disusun oleh tim Pelangi Indonesia dan telah digunakan kurang lebih 15 tahun"],
    icon: BookOpen,
    accent: "from-emerald-500 to-green-700",
  },
  {
    title: "Matematika",
    price: "Rp 325.000/bulan",
    description: "Kursus matematika membantu peserta memahami konsep berhitung, logika, dan pemecahan masalah dengan metode yang mudah dipahami. Materi disesuaikan dengan usia dan tingkat kemampuan anak agar proses belajar lebih efektif.",
    details: ["8 kali pertemuan", "Maksimal 6 anak per kelas", "Free trial 1 kali"],
    icon: Calculator,
    accent: "from-sky-500 to-blue-700",
  },
  {
    title: "Bimbingan Belajar Privat",
    price: "Rp 250.000/4 pertemuan",
    description: "Program bimbingan belajar privat memberikan pendampingan sesuai kebutuhan akademik anak. Perhatian yang lebih terfokus membantu proses belajar menjadi lebih optimal dan terarah.",
    details: ["4 kali pertemuan", "Tersedia home visit atau belajar onsite di Pelangi Indonesia"],
    icon: GraduationCap,
    accent: "from-violet-500 to-purple-700",
  },
  {
    title: "Sempoa",
    price: "Rp 275.000/bulan",
    description: "Kursus sempoa membantu melatih kemampuan berhitung cepat, konsentrasi, dan daya ingat anak melalui metode visual dan motorik. Latihan dilakukan secara bertahap agar anak mampu menghitung dengan cepat dan tepat.",
    details: ["8 kali pertemuan", "Maksimal 6 anak per kelas", "Free trial 1 kali"],
    icon: Sparkles,
    accent: "from-amber-500 to-orange-600",
  },
  {
    title: "Balet",
    price: "Mulai Rp 325.000/bulan",
    description: "Kelas balet membantu anak mengembangkan kelenturan, koordinasi gerak, keseimbangan motorik, disiplin, fokus, dan rasa percaya diri. Program bekerja sama dengan Flores Balet dengan pengajar bersertifikasi RAD.",
    details: ["Kurikulum RAD London", "4 kali pertemuan", "Free trial 1 kali", "Tersedia 7 klasifikasi kelompok", "Mulai usia 3 tahun (baby class)"],
    icon: Activity,
    accent: "from-rose-400 to-pink-600",
  },
  {
    title: "Taekwondo",
    price: "Rp 250.000/bulan",
    description: "Kursus taekwondo melatih kekuatan fisik, ketahanan tubuh, dan kemampuan bela diri dasar. Anak juga belajar disiplin, tanggung jawab, pengendalian diri, serta membangun kepercayaan diri dan karakter positif.",
    details: ["4 kali pertemuan", "Free trial 1 kali", "Mulai usia 3 tahun"],
    icon: Medal,
    accent: "from-red-500 to-red-700",
  },
  {
    title: "Renang Privat",
    price: "Rp 300.000/bulan",
    description: "Kursus renang membantu anak mempelajari teknik dasar berenang sekaligus meningkatkan kemampuan motorik dan koordinasi tubuh. Pembelajaran dilakukan secara aman dan bertahap sesuai usia serta kemampuan anak.",
    details: ["4 kali pertemuan", "Mulai usia 3 tahun"],
    icon: Waves,
    accent: "from-cyan-500 to-blue-600",
    specialNote: "Khusus tersedia di Pelangi Indonesia Cabang Bantul",
  },
  {
    title: "Musik Privat",
    price: "Mulai Rp 390.000/bulan",
    description: "Kursus musik mendukung kreativitas, konsentrasi, dan kemampuan anak mengekspresikan diri melalui seni. Anak mempelajari nada, ritme, dan teknik dasar musik sesuai minat dan usianya.",
    details: ["4 kali pertemuan", "Free trial 1 kali", "Mulai usia 3 tahun"],
    icon: Music2,
    accent: "from-indigo-500 to-violet-700",
  },
  {
    title: "Tari",
    price: "Rp 250.000/bulan",
    description: "Kursus tari membantu anak mengeksplorasi gerak, irama, dan ekspresi diri secara menyenangkan. Program ini mendukung rasa percaya diri, kerja sama, kreativitas, perkembangan motorik, dan koordinasi tubuh.",
    details: ["4 kali pertemuan", "Free trial 1 kali", "Mulai usia 3 tahun"],
    icon: Users,
    accent: "from-fuchsia-500 to-purple-700",
  },
];

function whatsappHref(courseName: string) {
  return `https://wa.me/6285117658242?text=${encodeURIComponent(`Halo Pelangi Indonesia, saya ingin mendaftar dan mengetahui informasi lebih lanjut mengenai kursus ${courseName}.`)}`;
}

export default function CoursePage() {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

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
        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="grid lg:grid-cols-[1.35fr_1fr]">
            <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden bg-gradient-to-br from-green-100 via-white to-emerald-100 p-8">
              <div className="absolute -left-16 -top-16 h-52 w-52 rounded-full bg-green-300/30 blur-2xl" />
              <img src="/services/kursus.png" alt="Ilustrasi kegiatan kursus Pelangi Indonesia" className="relative h-52 w-52 object-contain drop-shadow-lg sm:h-60 sm:w-60" />
            </div>
            <div className="flex flex-col justify-center p-7 sm:p-10">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-green-700">Galeri Kegiatan</p>
              <h2 className="mt-2 text-3xl font-extrabold text-gray-900">Belajar, bergerak, dan berkembang bersama</h2>
              <p className="mt-4 leading-7 text-gray-600">Section galeri telah disiapkan untuk menampilkan dokumentasi foto dan video dari berbagai kegiatan kursus Pelangi Indonesia.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-2xl bg-green-50 p-4 text-sm font-bold text-green-900"><Camera className="h-5 w-5 text-green-700" /> Dokumentasi Foto</div>
                <div className="flex items-center gap-3 rounded-2xl bg-blue-50 p-4 text-sm font-bold text-blue-900"><Video className="h-5 w-5 text-blue-700" /> Video Kegiatan</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-green-700">Program tersedia</p>
            <h2 className="mt-2 text-3xl font-extrabold text-gray-900">Pilih Kursus yang Sesuai</h2>
            <p className="mt-3 max-w-3xl leading-7 text-gray-600">Setiap program dirancang sesuai kebutuhan dan tahapan perkembangan peserta dengan pendampingan tenaga pengajar profesional.</p>
          </div>
          <div className="grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => {
              const Icon = course.icon;
              return (
                <article key={course.title} className="flex overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-black/5">
                  <div className="flex w-full flex-col">
                    <div className={`relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br ${course.accent}`}>
                      <img src="/services/kursus.png" alt="" aria-hidden="true" className="absolute -right-6 -top-8 h-40 w-40 rounded-full bg-white/90 p-8 opacity-20" />
                      <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-white/95 text-green-800 shadow-lg"><Icon className="h-10 w-10" /></div>
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
      <Footer />
    </div>
  );
}
