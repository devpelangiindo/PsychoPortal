import { useQuery } from "@tanstack/react-query";
import { CmsLayout } from "@/components/layout";
import { Link } from "wouter";
import { FileText, BookOpen, Users, Briefcase, ArrowRight, Activity } from "lucide-react";
import { api } from "@/lib/api";

const statCards = [
  { label: "Halaman", key: "pages", icon: FileText, href: "/pages", color: "bg-primary/10 text-primary" },
  { label: "Blog & Artikel", key: "posts", icon: BookOpen, href: "/posts", color: "bg-secondary/30 text-secondary-foreground" },
  { label: "Anggota Tim", key: "teamMembers", icon: Users, href: "/team-members", color: "bg-accent/30 text-accent-foreground" },
  { label: "Layanan", key: "services", icon: Briefcase, href: "/services", color: "bg-chart-1/10 text-chart-1" },
];

const collections = [
  {
    href: "/pages",
    icon: FileText,
    label: "Halaman",
    desc: "Kelola halaman statis seperti Tentang Kami, Kontak, dsb.",
  },
  {
    href: "/posts",
    icon: BookOpen,
    label: "Blog & Artikel",
    desc: "Tulis dan kelola artikel blog serta berita.",
  },
  {
    href: "/team-members",
    icon: Users,
    label: "Tim",
    desc: "Profil psikolog dan anggota tim.",
  },
  {
    href: "/services",
    icon: Briefcase,
    label: "Layanan",
    desc: "Layanan yang ditawarkan kepada klien.",
  },
];

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/cms/stats"],
    queryFn: () => api.cmsStats(),
  });

  return (
    <CmsLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Selamat datang di CMS pi-psychology.com
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ label, key, icon: Icon, href, color }) => (
            <Link key={key} href={href}>
              <div className="bg-card border rounded-xl p-4 hover:shadow-sm transition-shadow cursor-pointer">
                <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center mb-3`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {isLoading ? (
                    <span className="inline-block w-8 h-6 bg-muted rounded animate-pulse" />
                  ) : (
                    stats?.[key] ?? 0
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Published stats */}
        {stats && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 text-primary" />
            </div>
            <div className="text-sm text-foreground">
              <span className="font-semibold">{stats.publishedPages ?? 0}</span> halaman &amp;{" "}
              <span className="font-semibold">{stats.publishedPosts ?? 0}</span> artikel sudah dipublikasikan.
            </div>
          </div>
        )}

        {/* Collections */}
        <div>
          <h2 className="text-base font-semibold text-foreground mb-4">Koleksi Konten</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {collections.map(({ href, icon: Icon, label, desc }) => (
              <Link key={href} href={href}>
                <div className="bg-card border rounded-xl p-5 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground">{label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors mt-0.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </CmsLayout>
  );
}
