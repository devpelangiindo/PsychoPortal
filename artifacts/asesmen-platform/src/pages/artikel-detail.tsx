import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CalendarDays, User, ChevronRight } from "lucide-react";

interface CmsPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  contentHtml?: string;
  featuredImage?: {
    url: string;
    alt?: string;
    width?: number;
    height?: number;
  };
  author?: {
    name?: string;
    email?: string;
  };
  category?: string;
  tags?: string;
  publishedAt?: string;
  metaTitle?: string;
  metaDescription?: string;
  status: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  psikologi: "Psikologi",
  pendidikan: "Pendidikan",
  parenting: "Parenting",
  "kesehatan-mental": "Kesehatan Mental",
  tips: "Tips & Trik",
  berita: "Berita",
};

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ArtikelDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const { data: post, isLoading, error } = useQuery<CmsPost>({
    queryKey: ["/api/cms/posts", slug],
    queryFn: async () => {
      const res = await fetch(`/api/cms/posts/${slug}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json();
    },
    enabled: !!slug,
  });

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-neutral-500 dark:text-muted-foreground mb-8 flex-wrap">
          <Link href="/" className="hover:text-primary transition-colors">Beranda</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/artikel" className="hover:text-primary transition-colors">Artikel</Link>
          {post && (
            <>
              <ChevronRight className="w-4 h-4" />
              <span className="text-neutral-900 dark:text-foreground font-medium truncate max-w-[200px]">
                {post.title}
              </span>
            </>
          )}
        </nav>

        {isLoading && (
          <div className="space-y-6">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-72 w-full rounded-2xl" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        )}

        {error && (
          <div className="text-center py-16">
            <p className="text-red-500 mb-4 text-lg font-medium">Artikel tidak ditemukan</p>
            <p className="text-neutral-500 dark:text-muted-foreground mb-6">
              Halaman yang Anda cari tidak tersedia atau telah dihapus.
            </p>
            <Link href="/artikel">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Kembali ke Daftar Artikel
              </Button>
            </Link>
          </div>
        )}

        {post && (
          <article>
            {/* Category & meta */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              {post.category && (
                <Badge variant="secondary">
                  {CATEGORY_LABELS[post.category] ?? post.category}
                </Badge>
              )}
              {post.publishedAt && (
                <span className="flex items-center gap-1.5 text-sm text-neutral-400 dark:text-muted-foreground">
                  <CalendarDays className="w-4 h-4" />
                  {formatDate(post.publishedAt)}
                </span>
              )}
              {post.author && (
                <span className="flex items-center gap-1.5 text-sm text-neutral-400 dark:text-muted-foreground">
                  <User className="w-4 h-4" />
                  {post.author.name ?? post.author.email}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-foreground mb-6 leading-tight">
              {post.title}
            </h1>

            {/* Excerpt */}
            {post.excerpt && (
              <p className="text-lg text-neutral-500 dark:text-muted-foreground leading-relaxed mb-8 border-l-4 border-primary/30 pl-4 italic">
                {post.excerpt}
              </p>
            )}

            {/* Featured Image */}
            {post.featuredImage?.url && (
              <div className="rounded-2xl overflow-hidden shadow-lg mb-10">
                <img
                  src={post.featuredImage.url}
                  alt={post.featuredImage.alt || post.title}
                  className="w-full object-cover max-h-[28rem]"
                />
              </div>
            )}

            {/* Rich Text Content */}
            {post.contentHtml ? (
              <div
                className="prose prose-neutral dark:prose-invert max-w-none
                  prose-headings:font-bold prose-headings:text-neutral-900 dark:prose-headings:text-foreground
                  prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
                  prose-p:text-neutral-600 dark:prose-p:text-foreground/80 prose-p:leading-relaxed
                  prose-li:text-neutral-600 dark:prose-li:text-foreground/80
                  prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                  prose-strong:text-neutral-800 dark:prose-strong:text-foreground
                  prose-blockquote:border-primary/40 prose-blockquote:bg-primary/5 dark:prose-blockquote:bg-primary/10
                  prose-blockquote:p-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
                  prose-img:rounded-xl prose-img:shadow-md
                  prose-hr:border-gray-200 dark:prose-hr:border-border"
                dangerouslySetInnerHTML={{ __html: post.contentHtml }}
              />
            ) : (
              <p className="text-neutral-400 dark:text-muted-foreground italic">
                Konten artikel belum tersedia.
              </p>
            )}

            {/* Tags */}
            {post.tags && (
              <div className="mt-10 pt-6 border-t border-gray-100 dark:border-border">
                <p className="text-sm text-neutral-500 dark:text-muted-foreground mb-2 font-medium">Tags:</p>
                <div className="flex flex-wrap gap-2">
                  {post.tags.split(",").map((tag) => (
                    <Badge key={tag.trim()} variant="outline" className="text-xs">
                      {tag.trim()}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Back link */}
            <div className="mt-10">
              <Link href="/artikel">
                <Button variant="ghost" className="text-neutral-500 hover:text-neutral-700 dark:text-muted-foreground dark:hover:text-foreground pl-0">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Kembali ke Daftar Artikel
                </Button>
              </Link>
            </div>
          </article>
        )}
      </main>
      <Footer />
    </div>
  );
}
