import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageCircle, Tag, ChevronRight } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

interface CmsService {
  id: string;
  title: string;
  slug: string;
  shortDescription?: string;
  description?: object;
  descriptionHtml?: string;
  featuredImage?: {
    url: string;
    alt?: string;
    width?: number;
    height?: number;
  };
  icon?: string;
  price?: string;
  status: string;
  orderIndex?: number;
}

const WA_NUMBER = "6281991466546";

export default function LayananDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const { data: service, isLoading, error } = useQuery<CmsService>({
    queryKey: ["/api/cms/services", slug],
    queryFn: async () => {
      const res = await fetch(`/api/cms/services/${slug}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json();
    },
    enabled: !!slug,
  });

  const waMessage = service
    ? `Halo, saya ingin mengetahui lebih lanjut tentang layanan "${service.title}" di Rumah Psikologi Pelangi Indonesia.`
    : `Halo, saya ingin bertanya tentang layanan Rumah Psikologi Pelangi Indonesia.`;

  const waUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMessage)}`;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-neutral-500 dark:text-muted-foreground mb-8">
          <Link href="/" className="hover:text-primary transition-colors">Beranda</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/layanan" className="hover:text-primary transition-colors">Layanan</Link>
          {service && (
            <>
              <ChevronRight className="w-4 h-4" />
              <span className="text-neutral-900 dark:text-foreground font-medium truncate max-w-[200px]">
                {service.title}
              </span>
            </>
          )}
        </nav>

        {isLoading && (
          <div className="space-y-6">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-72 w-full rounded-2xl" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        )}

        {error && (
          <div className="text-center py-16">
            <p className="text-red-500 mb-4 text-lg font-medium">Layanan tidak ditemukan</p>
            <p className="text-neutral-500 dark:text-muted-foreground mb-6">
              Halaman yang Anda cari tidak tersedia atau telah dihapus.
            </p>
            <Link href="/layanan">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Kembali ke Daftar Layanan
              </Button>
            </Link>
          </div>
        )}

        {service && (
          <article className="space-y-8">
            {/* Title & Price */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-foreground mb-4">
                {service.title}
              </h1>
              {service.price && (
                <div className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-green-600" />
                  <span className="text-xl font-semibold text-green-700 dark:text-green-400">
                    {service.price}
                  </span>
                </div>
              )}
            </div>

            {/* Featured Image */}
            {service.featuredImage?.url && (
              <div className="rounded-2xl overflow-hidden shadow-lg">
                <img
                  src={service.featuredImage.url}
                  alt={service.featuredImage.alt || service.title}
                  className="w-full object-cover max-h-96"
                />
              </div>
            )}

            {/* Short Description */}
            {service.shortDescription && !service.descriptionHtml && (
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30 rounded-xl p-6">
                <p className="text-neutral-700 dark:text-foreground/80 leading-relaxed text-lg">
                  {service.shortDescription}
                </p>
              </div>
            )}

            {/* Rich Text Description */}
            {service.descriptionHtml ? (
              <div
                className="prose prose-neutral dark:prose-invert max-w-none
                  prose-headings:font-bold prose-headings:text-neutral-900 dark:prose-headings:text-foreground
                  prose-p:text-neutral-600 dark:prose-p:text-foreground/80 prose-p:leading-relaxed
                  prose-li:text-neutral-600 dark:prose-li:text-foreground/80
                  prose-a:text-green-600 prose-a:no-underline hover:prose-a:underline
                  prose-strong:text-neutral-800 dark:prose-strong:text-foreground
                  prose-blockquote:border-green-500 prose-blockquote:bg-green-50 dark:prose-blockquote:bg-green-950/20 prose-blockquote:p-4 prose-blockquote:rounded-r-lg"
                dangerouslySetInnerHTML={{ __html: service.descriptionHtml }}
              />
            ) : service.shortDescription ? null : (
              <div className="text-neutral-500 dark:text-muted-foreground italic">
                Deskripsi layanan belum tersedia.
              </div>
            )}

            {/* CTA Section */}
            <div className="bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-border p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-foreground mb-3">
                Tertarik dengan layanan ini?
              </h2>
              <p className="text-neutral-500 dark:text-muted-foreground mb-6">
                Hubungi kami untuk mendapatkan informasi lebih lanjut, jadwal konsultasi, atau pertanyaan lainnya.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a href={waUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto text-base px-6 py-3 h-auto">
                    <FaWhatsapp className="w-5 h-5 mr-2" />
                    Chat via WhatsApp
                  </Button>
                </a>
                <Link href="/kontak">
                  <Button variant="outline" className="w-full sm:w-auto text-base px-6 py-3 h-auto border-green-600 text-green-700 hover:bg-green-50">
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Formulir Kontak
                  </Button>
                </Link>
              </div>
            </div>

            {/* Back link */}
            <div>
              <Link href="/layanan">
                <Button variant="ghost" className="text-neutral-500 hover:text-neutral-700 dark:text-muted-foreground dark:hover:text-foreground pl-0">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Kembali ke Daftar Layanan
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
