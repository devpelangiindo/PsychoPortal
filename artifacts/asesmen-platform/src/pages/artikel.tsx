import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { formatDisplayDate } from "@/lib/date-format";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, User, ChevronRight } from "lucide-react";

interface CmsPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  contentHtml?: string;
  featuredImage?: {
    url: string;
    alt?: string;
  };
  author?: {
    name?: string;
    email?: string;
  };
  category?: string;
  tags?: string;
  publishedAt?: string;
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
  return dateStr ? formatDisplayDate(dateStr) : "";
}

export default function Artikel() {
  const { data, isLoading } = useQuery<{ docs: CmsPost[] }>({
    queryKey: ["/api/cms/posts"],
    queryFn: async () => {
      const res = await fetch("/api/cms/posts");
      if (!res.ok) throw new Error("Gagal memuat artikel");
      return res.json();
    },
  });

  const posts = data?.docs ?? [];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page heading */}
        <div className="mb-10">
          <nav className="flex items-center gap-2 text-sm text-neutral-500 dark:text-muted-foreground mb-4">
            <Link href="/" className="hover:text-primary transition-colors">Beranda</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-neutral-900 dark:text-foreground font-medium">Artikel</span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-foreground">
            Artikel & Blog
          </h1>
          <p className="mt-3 text-neutral-500 dark:text-muted-foreground text-lg">
            Wawasan, tips, dan informasi seputar psikologi dan kesehatan mental.
          </p>
        </div>

        {isLoading && (
          <div className="grid gap-8 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-card rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-border">
                <Skeleton className="h-48 w-full" />
                <div className="p-6 space-y-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && posts.length === 0 && (
          <div className="text-center py-20 text-neutral-400 dark:text-muted-foreground">
            <p className="text-lg">Belum ada artikel yang dipublikasikan.</p>
          </div>
        )}

        {!isLoading && posts.length > 0 && (
          <div className="grid gap-8 md:grid-cols-2">
            {posts.map((post) => (
              <Link key={post.id} href={`/artikel/${post.slug}`}>
                <article className="group bg-white dark:bg-card rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-border hover:shadow-md transition-shadow cursor-pointer h-full flex flex-col">
                  {post.featuredImage?.url && (
                    <div className="overflow-hidden">
                      <img
                        src={post.featuredImage.url}
                        alt={post.featuredImage.alt || post.title}
                        className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      {post.category && (
                        <Badge variant="secondary" className="text-xs">
                          {CATEGORY_LABELS[post.category] ?? post.category}
                        </Badge>
                      )}
                      {post.publishedAt && (
                        <span className="flex items-center gap-1 text-xs text-neutral-400 dark:text-muted-foreground">
                          <CalendarDays className="w-3 h-3" />
                          {formatDate(post.publishedAt)}
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="text-neutral-500 dark:text-muted-foreground text-sm leading-relaxed line-clamp-3 flex-1">
                        {post.excerpt}
                      </p>
                    )}
                    {post.author && (
                      <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-gray-100 dark:border-border text-xs text-neutral-400 dark:text-muted-foreground">
                        <User className="w-3.5 h-3.5" />
                        <span>{post.author.name ?? post.author.email}</span>
                      </div>
                    )}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
