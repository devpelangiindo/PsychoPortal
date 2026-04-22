import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Phone, Tag } from "lucide-react";

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
  };
  icon?: string;
  price?: string;
  status: string;
  orderIndex?: number;
}

interface CmsServicesResponse {
  docs: CmsService[];
  totalDocs: number;
}

export default function Layanan() {
  const { data, isLoading, error } = useQuery<CmsServicesResponse>({
    queryKey: ["/api/cms/services"],
  });

  const services = data?.docs ?? [];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-neutral-900 dark:text-foreground mb-4">
            Layanan Kami
          </h1>
          <p className="text-lg text-neutral-500 dark:text-muted-foreground max-w-3xl mx-auto">
            Temukan layanan psikologi profesional yang tepat untuk kebutuhan Anda dan keluarga.
          </p>
        </div>

        {error && (
          <div className="text-center py-12">
            <p className="text-red-500 mb-4">Gagal memuat layanan</p>
            <p className="text-neutral-500 dark:text-muted-foreground">
              Silakan refresh halaman atau hubungi kami jika masalah berlanjut.
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-card rounded-2xl shadow-lg border border-gray-100 dark:border-border overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <div className="p-6 space-y-4">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <div className="flex justify-between items-center pt-4">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-10 w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : services.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-neutral-500 dark:text-muted-foreground mb-4">
              Belum ada layanan yang tersedia saat ini.
            </p>
            <p className="text-sm text-neutral-400 dark:text-muted-foreground">
              Silakan kunjungi kembali halaman ini atau hubungi kami untuk informasi lebih lanjut.
            </p>
            <div className="mt-6">
              <Link href="/kontak">
                <Button className="bg-green-600 hover:bg-green-700">
                  <Phone className="w-4 h-4 mr-2" />
                  Hubungi Kami
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function ServiceCard({ service }: { service: CmsService }) {
  const imageUrl = service.featuredImage?.url;

  return (
    <div className="bg-white dark:bg-card rounded-2xl shadow-lg border border-gray-100 dark:border-border overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col">
      {imageUrl ? (
        <div className="h-48 overflow-hidden">
          <img
            src={imageUrl}
            alt={service.featuredImage?.alt || service.title}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="h-48 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20 flex items-center justify-center">
          <div className="w-16 h-16 bg-green-600/10 rounded-full flex items-center justify-center">
            <div className="w-8 h-8 text-green-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
                <path d="M12 8v4l3 3" />
              </svg>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 flex flex-col flex-1">
        <h3 className="text-xl font-bold text-neutral-900 dark:text-foreground mb-2">
          {service.title}
        </h3>

        {service.shortDescription && (
          <p className="text-neutral-500 dark:text-muted-foreground text-sm mb-4 flex-1 line-clamp-3">
            {service.shortDescription}
          </p>
        )}

        <div className="mt-auto pt-4 flex items-center justify-between">
          {service.price ? (
            <div className="flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-green-600" />
              <span className="font-semibold text-green-700 dark:text-green-400 text-sm">
                {service.price}
              </span>
            </div>
          ) : (
            <Badge variant="secondary" className="text-xs">Hubungi kami</Badge>
          )}

          <Link href={`/layanan/${service.slug}`}>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
              Selengkapnya
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
