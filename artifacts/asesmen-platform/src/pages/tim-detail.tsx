import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, Mail, Linkedin, User } from "lucide-react";

interface CmsTeamMember {
  id: string;
  name: string;
  role: string;
  photo?: {
    url: string;
    alt?: string;
    width?: number;
    height?: number;
  };
  bio?: object;
  bioHtml?: string;
  email?: string;
  linkedIn?: string;
  isActive: boolean;
  orderIndex?: number;
}

export default function TimDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: member, isLoading, error } = useQuery<CmsTeamMember>({
    queryKey: ["/api/cms/team-members", id],
    queryFn: async () => {
      const res = await fetch(`/api/cms/team-members/${id}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json();
    },
    enabled: !!id,
  });

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-neutral-500 dark:text-muted-foreground mb-8 flex-wrap">
          <Link href="/" className="hover:text-primary transition-colors">Beranda</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-neutral-900 dark:text-foreground font-medium">
            {member ? member.name : "Profil Tim"}
          </span>
        </nav>

        {isLoading && (
          <div className="space-y-8">
            <div className="flex items-center gap-6">
              <Skeleton className="w-32 h-32 rounded-full" />
              <div className="space-y-3 flex-1">
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-5 w-1/3" />
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        )}

        {error && (
          <div className="text-center py-16">
            <p className="text-red-500 mb-4 text-lg font-medium">Profil tidak ditemukan</p>
            <p className="text-neutral-500 dark:text-muted-foreground mb-6">
              Halaman yang Anda cari tidak tersedia.
            </p>
            <Link href="/">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Kembali ke Beranda
              </Button>
            </Link>
          </div>
        )}

        {member && (
          <article className="space-y-8">
            {/* Profile header */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-border p-8 shadow-sm">
              {member.photo?.url ? (
                <img
                  src={member.photo.url}
                  alt={member.photo.alt || member.name}
                  className="w-32 h-32 rounded-full object-cover shadow-md flex-shrink-0"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-14 h-14 text-primary/50" />
                </div>
              )}
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-foreground mb-1">
                  {member.name}
                </h1>
                <p className="text-primary font-medium text-lg mb-4">{member.role}</p>
                <div className="flex items-center gap-4">
                  {member.email && (
                    <a
                      href={`mailto:${member.email}`}
                      className="flex items-center gap-1.5 text-sm text-neutral-500 dark:text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      {member.email}
                    </a>
                  )}
                  {member.linkedIn && (
                    <a
                      href={member.linkedIn}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-neutral-500 dark:text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Linkedin className="w-4 h-4" />
                      LinkedIn
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Bio rich text */}
            {member.bioHtml ? (
              <div
                className="prose prose-neutral dark:prose-invert max-w-none
                  prose-headings:font-bold prose-headings:text-neutral-900 dark:prose-headings:text-foreground
                  prose-p:text-neutral-600 dark:prose-p:text-foreground/80 prose-p:leading-relaxed
                  prose-li:text-neutral-600 dark:prose-li:text-foreground/80
                  prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                  prose-strong:text-neutral-800 dark:prose-strong:text-foreground
                  prose-blockquote:border-primary/40 prose-blockquote:bg-primary/5 dark:prose-blockquote:bg-primary/10
                  prose-blockquote:p-4 prose-blockquote:rounded-r-lg"
                dangerouslySetInnerHTML={{ __html: member.bioHtml }}
              />
            ) : (
              <p className="text-neutral-400 dark:text-muted-foreground italic">
                Biografi belum tersedia.
              </p>
            )}

            {/* Back link */}
            <div>
              <Link href="/">
                <Button variant="ghost" className="text-neutral-500 hover:text-neutral-700 dark:text-muted-foreground dark:hover:text-foreground pl-0">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Kembali ke Beranda
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
