import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import AssessmentCard from "@/components/assessment-card";
import type { UserAssessmentWithDetails, Assessment } from "@shared/schema";

export default function Home() {
  const { user } = useAuth();
  const { data: userAssessments, isLoading } = useQuery<UserAssessmentWithDetails[]>({
    queryKey: ["/api/user-assessments"],
  });

  const { data: allAssessments, isLoading: isLoadingAssessments } = useQuery<Assessment[]>({
    queryKey: ["/api/assessments"],
  });

  const availableAssessments = userAssessments?.filter(ua => ua.status === 'available') || [];
  const completedAssessments = userAssessments?.filter(ua => ua.status === 'completed') || [];
  const inProgressAssessments = userAssessments?.filter(ua => ua.status === 'in_progress') || [];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <div className="bg-gradient-to-r from-primary to-accent p-8 rounded-2xl text-white">
            <div className="flex items-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mr-4">
                <span className="text-2xl font-bold">
                  {user?.firstName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-bold">
                  Selamat datang kembali, {user?.firstName || user?.email || 'Pengguna'}!
                </h1>
                <p className="opacity-90 mt-1">
                  Siap melanjutkan perjalanan asesmen psikologi Anda?
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-secondary mb-2">
                {availableAssessments.length}
              </div>
              <div className="text-neutral-500 dark:text-muted-foreground">
                Asesmen Tersedia
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-accent mb-2">
                {completedAssessments.length}
              </div>
              <div className="text-neutral-500 dark:text-muted-foreground">
                Asesmen Selesai
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-orange-500 mb-2">
                {inProgressAssessments.length}
              </div>
              <div className="text-neutral-500 dark:text-muted-foreground">
                Sedang Berjalan
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Available Assessments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Asesmen Tersedia
                <span className="bg-secondary text-white text-sm px-3 py-1 rounded-full">
                  {availableAssessments.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="p-3 bg-muted rounded-lg animate-pulse">
                      <div className="h-4 bg-muted-foreground/20 rounded mb-2" />
                      <div className="h-3 bg-muted-foreground/20 rounded w-3/4" />
                    </div>
                  ))}
                </div>
              ) : availableAssessments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-neutral-500 dark:text-muted-foreground mb-4">
                    Tidak ada asesmen tersedia. Beli asesmen untuk mulai!
                  </p>
                  <Link href="/assessments">
                    <Button>Lihat Asesmen</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableAssessments.map((userAssessment) => (
                    <div key={userAssessment.id} className="dashboard-item">
                      <div>
                        <div className="font-medium text-neutral-900 dark:text-foreground">
                          {userAssessment.assessment.name}
                        </div>
                        <div className="text-sm text-neutral-500 dark:text-muted-foreground">
                          {userAssessment.assessment.duration} • {userAssessment.assessment.ageRange}
                        </div>
                      </div>
                      <Link href={`/assessment/${userAssessment.assessmentId}`}>
                        <Button size="sm">Mulai</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Completed Assessments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Asesmen Selesai
                <span className="bg-accent text-white text-sm px-3 py-1 rounded-full">
                  {completedAssessments.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="p-3 bg-muted rounded-lg animate-pulse">
                      <div className="h-4 bg-muted-foreground/20 rounded mb-2" />
                      <div className="h-3 bg-muted-foreground/20 rounded w-3/4" />
                    </div>
                  ))}
                </div>
              ) : completedAssessments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-neutral-500 dark:text-muted-foreground">
                    Belum ada asesmen yang selesai
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {completedAssessments.map((userAssessment) => (
                    <div key={userAssessment.id} className="dashboard-item">
                      <div>
                        <div className="font-medium text-neutral-900 dark:text-foreground">
                          {userAssessment.assessment.name}
                        </div>
                        <div className="text-sm text-neutral-500 dark:text-muted-foreground">
                          Selesai {userAssessment.completedAt ? new Date(userAssessment.completedAt).toLocaleDateString('id-ID') : 'Baru-baru ini'}
                        </div>
                      </div>
                      <Link href={`/results/${userAssessment.id}`}>
                        <Button variant="outline" size="sm">
                          Lihat Laporan
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Available Assessments for Purchase */}
        <div className="mt-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-foreground mb-4">
              Asesmen yang Tersedia
            </h2>
            <p className="text-lg text-neutral-500 dark:text-muted-foreground max-w-2xl mx-auto">
              Jelajahi berbagai asesmen psikologi yang tersedia dan tambahkan ke keranjang Anda
            </p>
          </div>

          {isLoadingAssessments ? (
            <div className="grid md:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white dark:bg-card rounded-2xl shadow-lg border border-gray-100 dark:border-border overflow-hidden">
                  <div className="h-48 bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  <div className="p-8 space-y-4">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
                    <div className="flex justify-between items-center pt-4">
                      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse" />
                      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : allAssessments && allAssessments.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-6">
              {allAssessments.map((assessment) => (
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
                Tidak ada asesmen tersedia saat ini
              </p>
              <p className="text-sm text-neutral-400 dark:text-muted-foreground">
                Silakan coba lagi nanti atau hubungi dukungan untuk bantuan.
              </p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-12 flex flex-wrap gap-4 justify-center">
          <Link href="/assessments">
            <Button variant="outline" size="lg">
              Lihat Asesmen Lainnya
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" size="lg">
              Lihat Dashboard Lengkap
            </Button>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
