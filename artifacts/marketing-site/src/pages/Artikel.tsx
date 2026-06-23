import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Search, Calendar, ChevronRight, ArrowRight, Loader2 } from "lucide-react";
import {
  fetchPosts,
  fetchPostBySlug,
  formatDate,
  CATEGORY_LABELS,
  type CMSPost,
} from "@/lib/cms";

// ─── Fallback data (shown while CMS is empty) ────────────────────────────────

const FALLBACK_ARTICLES = [
  {
    slug: "memahami-asesmen-psikologi-anak",
    title: "Memahami Asesmen Psikologi pada Anak: Panduan untuk Orang Tua",
    excerpt: "Asesmen psikologi anak adalah proses evaluasi komprehensif yang bertujuan untuk memahami potensi, kebutuhan, dan tantangan yang dihadapi anak. Artikel ini memandu orang tua memahami prosesnya.",
    publishedAt: "2026-04-15T00:00:00.000Z",
    category: "psikologi",
    color: "#2D6A4F",
  },
  {
    slug: "pentingnya-konseling-keluarga",
    title: "Pentingnya Konseling Keluarga dalam Mendukung Tumbuh Kembang Anak",
    excerpt: "Keluarga adalah fondasi utama perkembangan anak. Konseling keluarga membantu menciptakan lingkungan yang sehat, komunikatif, dan penuh dukungan untuk anak bertumbuh optimal.",
    publishedAt: "2026-04-10T00:00:00.000Z",
    category: "parenting",
    color: "#3A7D58",
  },
  {
    slug: "terapi-sensori-integrasi",
    title: "Terapi Sensori Integrasi: Membantu Anak dengan Gangguan Pemrosesan Sensorik",
    excerpt: "Gangguan pemrosesan sensorik dapat berdampak besar pada kehidupan sehari-hari anak. Terapi sensori integrasi adalah pendekatan berbasis bukti yang membantu anak mengelola sensitivitas mereka.",
    publishedAt: "2026-04-05T00:00:00.000Z",
    category: "psikologi",
    color: "#52B788",
  },
  {
    slug: "tips-belajar-efektif-anak",
    title: "5 Strategi Belajar Efektif untuk Anak di Rumah",
    excerpt: "Membantu anak belajar di rumah tidak harus membuat stres. Berikut lima strategi berbasis bukti ilmiah yang terbukti meningkatkan efektivitas belajar anak secara mandiri.",
    publishedAt: "2026-03-28T00:00:00.000Z",
    category: "pendidikan",
    color: "#40916C",
  },
  {
    slug: "mengenali-gejala-kecemasan-anak",
    title: "Mengenali Gejala Kecemasan pada Anak: Kapan Harus Mencari Bantuan?",
    excerpt: "Kecemasan adalah respons normal, tetapi kecemasan berlebihan pada anak dapat mengganggu perkembangan. Pelajari tanda-tanda yang perlu diwaspadai dan langkah yang tepat.",
    publishedAt: "2026-03-20T00:00:00.000Z",
    category: "kesehatan-mental",
    color: "#1B4332",
  },
  {
    slug: "manfaat-pelatihan-profesional-guru",
    title: "Mengapa Pelatihan Berkelanjutan Penting bagi Guru dan Konselor Sekolah",
    excerpt: "Dunia pendidikan terus berkembang. Pelatihan profesional berkelanjutan bukan sekadar kewajiban — ini adalah investasi nyata untuk kualitas layanan kepada siswa dan keluarga.",
    publishedAt: "2026-03-12T00:00:00.000Z",
    category: "pendidikan",
    color: "#9A6E5E",
  },
];

const COLOR_BY_CATEGORY: Record<string, string> = {
  psikologi: "#2D6A4F",
  pendidikan: "#40916C",
  parenting: "#3A7D58",
  "kesehatan-mental": "#1B4332",
  tips: "#52B788",
  berita: "#9A6E5E",
};

function articleColor(category?: string) {
  return category ? (COLOR_BY_CATEGORY[category] ?? "#2D6A4F") : "#2D6A4F";
}

// ─── Promo sidebar ────────────────────────────────────────────────────────────

const promos = [
  { title: "Konsultasi Awal Gratis", desc: "Jadwalkan sesi konsultasi pertama Anda tanpa biaya." },
  { title: "Workshop Pelangi Indonesia", desc: "Pelatihan Manajemen Perilaku Anak — Daftar sekarang!" },
  { title: "Paket Asesmen Lengkap", desc: "Dapatkan laporan komprehensif dengan rekomendasi terapi." },
];

function PromoSidebar() {
  return (
    <div className="space-y-4">
      <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Promo & Info</h3>
      {promos.map((p, i) => (
        <div key={i} className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
          <h4 className="font-semibold text-sm mb-1" style={{ color: "#2D6A4F" }}>{p.title}</h4>
          <p className="text-xs text-gray-500 mb-2">{p.desc}</p>
          <a
            href="https://wa.me/6285117658242"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold flex items-center gap-1"
            style={{ color: "#2D6A4F" }}
          >
            Info lebih lanjut <ArrowRight size={10} />
          </a>
        </div>
      ))}
    </div>
  );
}

// ─── Article Detail ───────────────────────────────────────────────────────────

function ArticleDetail({ slug }: { slug: string }) {
  const { data: cmsPost, isLoading } = useQuery({
    queryKey: ["cms-post", slug],
    queryFn: () => fetchPostBySlug(slug),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const fallback = FALLBACK_ARTICLES.find((a) => a.slug === slug);
  const color = cmsPost ? articleColor(cmsPost.category) : (fallback?.color ?? "#2D6A4F");
  const title = cmsPost?.title ?? fallback?.title ?? "Artikel";
  const excerpt = cmsPost?.excerpt ?? fallback?.excerpt ?? "";
  const category = cmsPost?.category ?? fallback?.category;
  const categoryLabel = category ? (CATEGORY_LABELS[category] ?? category) : "";
  const date = cmsPost?.publishedAt ? formatDate(cmsPost.publishedAt) : (fallback?.publishedAt ? formatDate(fallback.publishedAt) : "");
  const imageUrl = (cmsPost?.featuredImage as { url?: string } | undefined)?.url;

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="pt-28 pb-12 text-white" style={{ background: `linear-gradient(135deg, ${color}cc, ${color})` }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 text-sm text-white/70 mb-6">
            <Link href="/" className="hover:text-white transition-colors">Beranda</Link>
            <ChevronRight size={14} />
            <Link href="/artikel" className="hover:text-white transition-colors">Artikel</Link>
            <ChevronRight size={14} />
            <span className="text-white line-clamp-1">{title}</span>
          </nav>
          {categoryLabel && (
            <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-white/20 mb-4">
              {categoryLabel}
            </div>
          )}
          <h1 className="text-3xl lg:text-4xl font-extrabold mb-4 max-w-3xl leading-tight">{title}</h1>
          {date && (
            <div className="flex items-center gap-4 text-sm text-white/70">
              <span className="flex items-center gap-1.5"><Calendar size={14} />{date}</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-green-700" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2">
              {imageUrl ? (
                <img src={imageUrl} alt={title} className="w-full h-64 object-cover rounded-2xl mb-8" />
              ) : (
                <div className="w-full h-64 rounded-2xl mb-8 flex items-center justify-center" style={{ background: `${color}22` }}>
                  <span className="text-sm font-medium" style={{ color }}>Foto Artikel</span>
                </div>
              )}

              {cmsPost?.contentHtml ? (
                <div
                  className="prose prose-lg max-w-none prose-headings:text-green-900 prose-a:text-green-700"
                  dangerouslySetInnerHTML={{ __html: cmsPost.contentHtml }}
                />
              ) : (
                <div className="prose prose-lg max-w-none text-gray-600 space-y-4">
                  {excerpt && <p className="text-lg font-medium text-gray-800 leading-relaxed">{excerpt}</p>}
                  <p>
                    Dalam dunia layanan psikologi dan pendidikan, pendekatan yang tepat dapat membuat perbedaan yang signifikan bagi perkembangan individu. Di Pelangi Indonesia Group, kami berkomitmen untuk menghadirkan layanan yang tidak hanya berbasis bukti ilmiah, tetapi juga sensitif terhadap keunikan setiap individu dan konteks budaya lokal.
                  </p>
                  <p>
                    Tim profesional kami terdiri dari psikolog klinis, konselor pendidikan, terapis tumbuh kembang, dan educator berpengalaman yang terus memperbarui kompetensi mereka melalui pelatihan dan supervisi berkala.
                  </p>
                  <div className="p-4 rounded-xl border-l-4" style={{ background: "#D8F3DC", borderColor: "#2D6A4F" }}>
                    <p className="text-sm text-green-900 font-medium">
                      Artikel ini akan segera diperbarui dengan konten lengkap dari tim redaksi kami. Untuk informasi lebih lanjut, silakan hubungi kami melalui WhatsApp.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="sticky top-24">
                <PromoSidebar />
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

// ─── Article List ─────────────────────────────────────────────────────────────

export default function Artikel() {
  const [matchDetail, paramsDetail] = useRoute("/artikel/:slug");
  const [search, setSearch] = useState("");

  if (matchDetail && paramsDetail?.slug) {
    return <ArticleDetail slug={paramsDetail.slug} />;
  }

  const { data: cmsPosts, isLoading } = useQuery({
    queryKey: ["cms-posts"],
    queryFn: () => fetchPosts({ limit: 20 }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Use CMS data if available, otherwise fall back to hardcoded
  type ArticleItem = {
    slug: string
    title: string
    excerpt: string
    publishedAt?: string
    category?: string
    color: string
  }

  const articles: ArticleItem[] =
    (cmsPosts?.docs?.length ?? 0) > 0
      ? cmsPosts!.docs.map((p: CMSPost) => ({
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt ?? "",
          publishedAt: p.publishedAt,
          category: p.category,
          color: articleColor(p.category),
        }))
      : FALLBACK_ARTICLES;

  const filtered = articles.filter(
    (a) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      (a.category ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="pt-32 pb-16 text-center" style={{ background: "linear-gradient(135deg, #1B4332, #2D6A4F)" }}>
        <h1 className="text-4xl lg:text-5xl font-extrabold text-white mb-4">Artikel</h1>
        <p className="text-green-100/80 text-lg max-w-2xl mx-auto px-4 mb-8">
          Wawasan, tips, dan panduan dari para profesional Pelangi Indonesia Group.
        </p>
        <div className="relative max-w-xl mx-auto px-4">
          <Search size={18} className="absolute left-7 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari artikel..."
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white text-gray-900 text-sm shadow-sm outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
      </div>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2">
              {isLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 size={32} className="animate-spin text-green-700" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-gray-500 py-10 text-center">Tidak ada artikel yang ditemukan.</p>
              ) : (
                <div className="space-y-6">
                  {filtered.map((a) => {
                    const label = a.category ? (CATEGORY_LABELS[a.category] ?? a.category) : "";
                    return (
                      <Link
                        key={a.slug}
                        href={`/artikel/${a.slug}`}
                        className="flex gap-5 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group"
                      >
                        <div
                          className="w-28 h-24 shrink-0 rounded-xl flex items-center justify-center text-white text-xs font-medium"
                          style={{ background: `${a.color}cc` }}
                        >
                          Foto
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {label && (
                              <span
                                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: `${a.color}20`, color: a.color }}
                              >
                                {label}
                              </span>
                            )}
                            {a.publishedAt && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Calendar size={11} />{formatDate(a.publishedAt)}
                              </span>
                            )}
                          </div>
                          <h2 className="font-bold text-gray-900 text-base mb-2 leading-tight group-hover:text-green-800 transition-colors line-clamp-2">
                            {a.title}
                          </h2>
                          {a.excerpt && (
                            <p className="text-gray-500 text-sm leading-relaxed line-clamp-2">{a.excerpt}</p>
                          )}
                          <div className="mt-3 text-xs font-semibold flex items-center gap-1" style={{ color: a.color }}>
                            Lihat selengkapnya... <ArrowRight size={11} />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="sticky top-24">
                <PromoSidebar />
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
