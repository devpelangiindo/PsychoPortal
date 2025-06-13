import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import AssessmentCard from "@/components/assessment-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Assessment } from "@shared/schema";

export default function Assessments() {
  const { data: assessments, isLoading, error } = useQuery<Assessment[]>({
    queryKey: ["/api/assessments"],
  });

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-neutral-900 dark:text-foreground mb-4">
            Asesmen Psikologi
          </h1>
          <p className="text-lg text-neutral-500 dark:text-muted-foreground max-w-3xl mx-auto">
            Pilih dari alat asesmen psikologi yang telah divalidasi secara profesional. 
            Setiap asesmen didukung secara ilmiah dan dirancang untuk memberikan wawasan yang akurat.
          </p>
        </div>

        {error && (
          <div className="text-center py-12">
            <p className="text-red-500 mb-4">Gagal memuat asesmen</p>
            <p className="text-neutral-500 dark:text-muted-foreground">
              Silakan refresh halaman atau hubungi dukungan jika masalah berlanjut.
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-card rounded-2xl shadow-lg border border-gray-100 dark:border-border overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <div className="p-8 space-y-4">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <div className="flex justify-between items-center pt-4">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-10 w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : assessments && assessments.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {assessments.map((assessment) => (
              <AssessmentCard 
                key={assessment.id} 
                assessment={assessment} 
                showAddToCart={true} 
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-neutral-500 dark:text-muted-foreground mb-4">
              No assessments available at the moment
            </p>
            <p className="text-sm text-neutral-400 dark:text-muted-foreground">
              Please check back later or contact support for assistance.
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
