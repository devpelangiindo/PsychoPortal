import { useEffect, type ReactNode } from "react";
import { ArrowRight, BookOpen, ClipboardList, Package, PlayCircle } from "lucide-react";
import { Link, useRoute } from "wouter";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

const categories = [
  { title: "Video E-Learning", description: "Fasilitas belajar mandiri melalui koleksi rekaman pelatihan psikologi dan pengembangan diri yang komprehensif, aplikatif, dan mudah diakses.", href: "/produk-layanan/produk-edukasi/video-e-learning", icon: PlayCircle, image: "/services/produk-digital.png", imageAlt: "Pembelajaran mandiri melalui materi digital", status: "Informasi Produk" },
  { title: "Produk Digital", description: "Modul, e-book, dan materi digital pilihan untuk mendukung pengembangan diri dan keluarga.", href: "/produk-layanan/produk-edukasi/produk-digital", icon: BookOpen, image: "/services/produk-digital-cover.png", imageAlt: "Produk edukasi digital yang dapat diakses melalui perangkat elektronik", status: "Informasi Produk" },
  { title: "Produk Fisik", description: "Produk edukasi fisik yang dirancang untuk mendukung pembelajaran, pendampingan, dan aktivitas pengembangan.", href: "/produk-layanan/produk-edukasi/produk-fisik", icon: Package, image: "/services/produk-fisik-cover.png", imageAlt: "Ruang belajar dengan beragam produk edukasi fisik", status: "Informasi produk" },
  { title: "Alat Tes Psikologi", description: "Instrumen psikologi profesional untuk kebutuhan praktisi, lembaga pendidikan, perusahaan, dan organisasi.", href: "/produk-layanan/produk-edukasi/alat-tes-psikologi", icon: ClipboardList, image: "/services/alat-tes-psikologi-1.png", imageAlt: "Profesional menelaah alat tes psikologi", status: "Informasi produk" },
];

function PageShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-slate-50"><Navbar />{children}<Footer /></div>;
}
export default function EducationProducts() {
  return (
    <PageShell>
      <header className="bg-gradient-to-br from-green-950 via-green-900 to-green-700 px-4 pb-16 pt-32 text-center text-white">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-green-200">Produk & Layanan</p>
        <h1 className="mt-3 text-4xl font-extrabold lg:text-5xl">Produk Edukasi</h1>
        <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-green-50/85">Pilih video e-learning, produk digital, produk fisik, atau alat tes psikologi sesuai kebutuhan belajar dan praktik profesional Anda.</p>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-7 md:grid-cols-2">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Link key={category.title} href={category.href} className="group flex overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-xl">
                <article className="flex w-full flex-col">
                  <div className="relative aspect-[3/2] overflow-hidden bg-green-50">
                    <img src={category.image} alt={category.imageAlt} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-green-950/55 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/95 text-green-800 shadow"><Icon size={25} /></div>
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-green-700">{category.status}</p>
                    <h2 className="mt-2 text-2xl font-extrabold text-gray-900">{category.title}</h2>
                    <p className="mt-3 flex-1 leading-7 text-gray-600">{category.description}</p>
                    <span className="mt-6 inline-flex items-center gap-2 font-bold text-green-800">Lihat selengkapnya <ArrowRight size={17} /></span>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      </main>
    </PageShell>
  );
}

export function LegacyDigitalProductsRedirect() {
  const [, params] = useRoute("/produk-layanan/produk-digital/:productSlug");
  const target = params?.productSlug ? `/produk-layanan/produk-edukasi/produk-digital/${params.productSlug}` : "/produk-layanan/produk-edukasi/produk-digital";
  useEffect(() => window.location.replace(target), [target]);
  return <div className="min-h-screen bg-slate-50" />;
}
