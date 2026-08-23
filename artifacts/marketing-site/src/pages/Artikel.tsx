import { useState, type ReactNode } from "react";
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

type ManagedArticleImage = {
  id: number;
  altText: string | null;
  caption: string | null;
  placement: "cover" | "after-first" | "middle" | "end";
  sortOrder: number;
  focusX: number;
  focusY: number;
};

type ManagedArticle = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  authorName: string | null;
  status: "published";
  publishedAt: string | null;
  createdAt: string;
  images: ManagedArticleImage[];
};

function articleApiBase() {
  if (import.meta.env.VITE_ASESMEN_API_URL) return String(import.meta.env.VITE_ASESMEN_API_URL).replace(/\/$/, "");
  return window.location.hostname === "localhost" ? "http://localhost:5001" : "https://asesmen.pi-psychology.com";
}

function managedArticleImageUrl(imageId: number) {
  return `${articleApiBase()}/api/articles/images/${imageId}`;
}

async function fetchManagedArticles(): Promise<ManagedArticle[]> {
  const response = await fetch(`${articleApiBase()}/api/articles`);
  if (!response.ok) throw new Error("Gagal memuat artikel dari dashboard");
  return response.json();
}

async function fetchManagedArticle(slug: string): Promise<ManagedArticle | null> {
  const response = await fetch(`${articleApiBase()}/api/articles/${encodeURIComponent(slug)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Gagal memuat artikel dari dashboard");
  return response.json();
}

// ─── Fallback data (shown while CMS is empty) ────────────────────────────────

const FALLBACK_ARTICLES = [
  {
    slug: "memahami-asesmen-psikologi-anak",
    title: "Memahami Asesmen Psikologi pada Anak: Panduan untuk Orang Tua",
    excerpt: "Asesmen psikologi anak adalah proses evaluasi komprehensif yang bertujuan untuk memahami potensi, kebutuhan, dan tantangan yang dihadapi anak. Berita ini memandu orang tua memahami prosesnya.",
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

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\))/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={`${keyPrefix}-strong-${index}`}>{token.slice(2, -2)}</strong>);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
      if (linkMatch) nodes.push(<a key={`${keyPrefix}-link-${index}`} href={linkMatch[2]} target="_blank" rel="noopener noreferrer">{linkMatch[1]}</a>);
    }
    cursor = match.index + token.length;
    index += 1;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function ArticleFigure({ image }: { image: ManagedArticleImage }) {
  return (
    <figure className="my-8">
      <img
        src={managedArticleImageUrl(image.id)}
        alt={image.altText || "Gambar artikel"}
        className="max-h-[32rem] w-full rounded-2xl object-cover shadow-sm"
        style={{ objectPosition: `${image.focusX}% ${image.focusY}%` }}
      />
      {image.caption && <figcaption className="mt-2 text-center text-sm text-gray-500">{image.caption}</figcaption>}
    </figure>
  );
}

function ManagedArticleContent({ article }: { article: ManagedArticle }) {
  const blocks = article.content.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  const cover = article.images.find((image) => image.placement === "cover") ?? article.images[0];
  const inlineImages = article.images.filter((image) => image.id !== cover?.id).sort((first, second) => first.sortOrder - second.sortOrder);
  const imageBlockIndex = (image: ManagedArticleImage) => {
    if (image.placement === "after-first") return 0;
    if (image.placement === "middle") return Math.max(0, Math.floor((blocks.length - 1) / 2));
    return Math.max(0, blocks.length - 1);
  };

  const renderBlock = (block: string, index: number) => {
    if (block.startsWith("### ")) return <h3 className="text-xl font-extrabold text-green-950">{renderInlineMarkdown(block.slice(4), `block-${index}`)}</h3>;
    if (block.startsWith("## ")) return <h2 className="text-2xl font-extrabold text-green-950">{renderInlineMarkdown(block.slice(3), `block-${index}`)}</h2>;
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length && lines.every((line) => /^[-*]\s+/.test(line))) {
      return <ul className="list-disc space-y-2 pl-6">{lines.map((line, lineIndex) => <li key={lineIndex}>{renderInlineMarkdown(line.replace(/^[-*]\s+/, ""), `block-${index}-${lineIndex}`)}</li>)}</ul>;
    }
    if (lines.length && lines.every((line) => /^\d+\.\s+/.test(line))) {
      return <ol className="list-decimal space-y-2 pl-6">{lines.map((line, lineIndex) => <li key={lineIndex}>{renderInlineMarkdown(line.replace(/^\d+\.\s+/, ""), `block-${index}-${lineIndex}`)}</li>)}</ol>;
    }
    return <p>{lines.map((line, lineIndex) => <span key={lineIndex}>{renderInlineMarkdown(line, `block-${index}-${lineIndex}`)}{lineIndex < lines.length - 1 && <br />}</span>)}</p>;
  };

  return (
    <div className="prose prose-lg max-w-none prose-headings:text-green-950 prose-a:text-green-700 prose-p:leading-8">
      {blocks.map((block, index) => (
        <div key={index}>
          {renderBlock(block, index)}
          {inlineImages.filter((image) => imageBlockIndex(image) === index).map((image) => <ArticleFigure key={image.id} image={image} />)}
        </div>
      ))}
      {blocks.length === 0 && inlineImages.map((image) => <ArticleFigure key={image.id} image={image} />)}
    </div>
  );
}

// ─── Article Detail ───────────────────────────────────────────────────────────

function ArticleDetail({ slug }: { slug: string }) {
  const { data: managedPost, isLoading: managedLoading } = useQuery({
    queryKey: ["managed-article", slug],
    queryFn: () => fetchManagedArticle(slug),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const { data: cmsPost, isLoading: cmsLoading } = useQuery({
    queryKey: ["cms-post", slug],
    queryFn: () => fetchPostBySlug(slug),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const fallback = FALLBACK_ARTICLES.find((a) => a.slug === slug);
  const color = articleColor(managedPost?.category ?? cmsPost?.category) || fallback?.color || "#2D6A4F";
  const title = managedPost?.title ?? cmsPost?.title ?? fallback?.title ?? "Berita";
  const excerpt = managedPost?.excerpt ?? cmsPost?.excerpt ?? fallback?.excerpt ?? "";
  const category = managedPost?.category ?? cmsPost?.category ?? fallback?.category;
  const categoryLabel = category ? (CATEGORY_LABELS[category] ?? category) : "";
  const publishedAt = managedPost?.publishedAt ?? cmsPost?.publishedAt ?? fallback?.publishedAt;
  const date = publishedAt ? formatDate(publishedAt) : "";
  const managedCover = managedPost?.images.find((image) => image.placement === "cover") ?? managedPost?.images[0];
  const imageUrl = managedCover ? managedArticleImageUrl(managedCover.id) : (cmsPost?.featuredImage as { url?: string } | undefined)?.url;
  const isLoading = managedLoading && cmsLoading;

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="pt-28 pb-12 text-white" style={{ background: `linear-gradient(135deg, ${color}cc, ${color})` }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 text-sm text-white/70 mb-6">
            <Link href="/" className="hover:text-white transition-colors">Beranda</Link>
            <ChevronRight size={14} />
            <Link href="/artikel" className="hover:text-white transition-colors">Berita</Link>
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
                <img src={imageUrl} alt={managedCover?.altText || title} className="mb-8 h-64 w-full rounded-2xl object-cover" style={managedCover ? { objectPosition: `${managedCover.focusX}% ${managedCover.focusY}%` } : undefined} />
              ) : (
                <div className="w-full h-64 rounded-2xl mb-8 flex items-center justify-center" style={{ background: `${color}22` }}>
                  <span className="text-sm font-medium" style={{ color }}>Foto Berita</span>
                </div>
              )}

              {managedPost ? (
                <ManagedArticleContent article={managedPost} />
              ) : cmsPost?.contentHtml ? (
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
                      Berita ini akan segera diperbarui dengan konten lengkap dari tim redaksi kami. Untuk informasi lebih lanjut, silakan hubungi kami melalui WhatsApp.
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

  const { data: managedPosts, isLoading: managedPostsLoading } = useQuery({
    queryKey: ["managed-articles"],
    queryFn: fetchManagedArticles,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const { data: cmsPosts, isLoading: cmsPostsLoading } = useQuery({
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
    imageUrl?: string
    imageAlt?: string
    imageFocusX?: number
    imageFocusY?: number
  }

  const managedItems: ArticleItem[] = (managedPosts ?? []).map((article) => {
    const cover = article.images.find((image) => image.placement === "cover") ?? article.images[0];
    return {
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      publishedAt: article.publishedAt ?? article.createdAt,
      category: article.category,
      color: articleColor(article.category),
      imageUrl: cover ? managedArticleImageUrl(cover.id) : undefined,
      imageAlt: cover?.altText || article.title,
      imageFocusX: cover?.focusX,
      imageFocusY: cover?.focusY,
    };
  });
  const managedSlugs = new Set(managedItems.map((article) => article.slug));
  const cmsItems: ArticleItem[] = (cmsPosts?.docs ?? [])
    .filter((post: CMSPost) => !managedSlugs.has(post.slug))
    .map((p: CMSPost) => ({
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt ?? "",
          publishedAt: p.publishedAt,
          category: p.category,
          color: articleColor(p.category),
          imageUrl: (p.featuredImage as { url?: string } | undefined)?.url,
          imageAlt: (p.featuredImage as { alt?: string } | undefined)?.alt || p.title,
        }));
  const combinedArticles = [...managedItems, ...cmsItems].sort((first, second) =>
    new Date(second.publishedAt ?? 0).getTime() - new Date(first.publishedAt ?? 0).getTime(),
  );
  const articles: ArticleItem[] = combinedArticles.length > 0 ? combinedArticles : FALLBACK_ARTICLES;
  const isLoading = managedPostsLoading && cmsPostsLoading;

  const filtered = articles.filter(
    (a) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      (a.category ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="pt-32 pb-16 text-center" style={{ background: "linear-gradient(135deg, #1B4332, #2D6A4F)" }}>
        <h1 className="text-4xl lg:text-5xl font-extrabold text-white mb-4">Berita</h1>
        <p className="text-green-100/80 text-lg max-w-2xl mx-auto px-4 mb-8">
          Wawasan, tips, dan panduan dari para profesional Pelangi Indonesia Group.
        </p>
        <div className="relative max-w-xl mx-auto px-4">
          <Search size={18} className="absolute left-7 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari berita..."
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
                <p className="text-gray-500 py-10 text-center">Tidak ada berita yang ditemukan.</p>
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
                        <div className="flex h-24 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xs font-medium text-white" style={{ background: `${a.color}cc` }}>
                          {a.imageUrl ? <img src={a.imageUrl} alt={a.imageAlt || a.title} className="h-full w-full object-cover" style={{ objectPosition: `${a.imageFocusX ?? 50}% ${a.imageFocusY ?? 50}%` }} /> : "Foto"}
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
