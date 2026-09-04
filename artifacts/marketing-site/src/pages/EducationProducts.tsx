import { useEffect, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ClipboardList, Info, Package } from "lucide-react";
import { Link, useRoute } from "wouter";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

const categories = [
  { title: "Produk Digital", description: "Modul, e-book, dan materi digital pilihan untuk mendukung pengembangan diri dan keluarga.", href: "/produk-layanan/produk-edukasi/produk-digital", icon: BookOpen, image: "/services/produk-digital-cover.png", imageAlt: "Produk edukasi digital yang dapat diakses melalui perangkat elektronik", status: "Katalog tersedia" },
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
        <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-green-50/85">Pilih produk digital, produk fisik, atau alat tes psikologi sesuai kebutuhan belajar dan praktik profesional Anda.</p>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-7 md:grid-cols-3">
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

export function PhysicalProducts() {
  return (
    <PageShell>
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <Link href="/produk-layanan/produk-edukasi" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-green-800"><ArrowLeft size={17} /> Kembali ke Produk Edukasi</Link>
        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="bg-gradient-to-br from-green-950 to-green-700 px-8 py-12 text-white sm:px-12"><Package size={46} /><h1 className="mt-5 text-4xl font-extrabold">Produk Fisik</h1><p className="mt-4 max-w-2xl text-lg leading-relaxed text-green-50/85">Produk edukasi fisik untuk mendukung kegiatan belajar, pendampingan, dan pengembangan.</p></div>
          <div className="flex items-start gap-4 p-8 text-gray-600 sm:p-12"><Info className="mt-0.5 shrink-0 text-green-700" /><div><h2 className="font-bold text-gray-900">Katalog sedang disiapkan</h2><p className="mt-1 leading-7">Informasi produk fisik akan ditampilkan di halaman ini setelah katalog tersedia.</p></div></div>
        </section>
      </main>
    </PageShell>
  );
}

export function PsychologyTestTools() {
  const message = encodeURIComponent("Halo PI, saya ingin mendapatkan informasi mengenai Alat Tes Psikologi.");
  return (
    <PageShell>
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <Link href="/produk-layanan/produk-edukasi" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-green-800"><ArrowLeft size={17} /> Kembali ke Produk Edukasi</Link>
        <section className="overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-black/5">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-8 sm:p-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><ClipboardList size={32} /></div>
              <p className="mt-8 text-sm font-bold uppercase tracking-[0.18em] text-green-700">Produk Edukasi</p>
              <h1 className="mt-3 text-4xl font-extrabold text-gray-900">Alat Tes Psikologi</h1>
              <p className="mt-5 text-lg leading-8 text-gray-600">Menyediakan berbagai instrumen tes psikologi yang valid dan terstandar untuk kebutuhan deteksi tumbuh kembang, pendidikan, klinis, hingga manajemen sumber daya manusia.</p>
              <h2 className="mt-9 text-xl font-extrabold text-gray-900">Mengapa memilih instrumen dari Pelangi Indonesia?</h2>
              <ul className="mt-5 space-y-4 text-gray-600">
                <li><strong className="text-gray-900">Valid & Terstandar.</strong> Kualitas hasil asesmen dapat dipertanggungjawabkan secara ilmiah.</li>
                <li><strong className="text-gray-900">Koleksi Lengkap.</strong> Berbagai macam alat tes tersedia dalam satu pintu.</li>
                <li><strong className="text-gray-900">Konsultasi Ahli.</strong> Tim kami membantu memilih alat tes yang sesuai dengan tujuan asesmen.</li>
              </ul>
              <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950"><strong>Catatan:</strong> Pembelian alat tes tertentu memerlukan bukti kualifikasi profesi (Psikolog/Sertifikasi Terkait) sesuai kode etik yang berlaku.</div>
              <a href={`https://wa.me/6285117658242?text=${message}`} target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex rounded-xl bg-green-800 px-6 py-3.5 font-bold text-white transition hover:bg-green-900">Hubungi Hotline PI</a>
            </div>
            <div className="grid min-h-[560px] grid-rows-2 bg-green-900">
              <img src="/services/alat-tes-psikologi-1.png" alt="Profesional menelaah hasil pengukuran psikologis" className="h-full min-h-0 w-full object-cover" />
              <img src="/services/alat-tes-psikologi-2.png" alt="Referensi dan materi alat tes psikologi" className="h-full min-h-0 w-full object-cover" />
            </div>
          </div>
        </section>
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
