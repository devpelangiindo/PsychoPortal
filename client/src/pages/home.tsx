import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import type { UserAssessmentWithDetails } from "@shared/schema";

export default function Home() {
  const { user } = useAuth();
  const { data: userAssessments, isLoading } = useQuery<UserAssessmentWithDetails[]>({
    queryKey: ["/api/user-assessments"],
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
                Completed Assessments
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
                    No completed assessments yet
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
                          Completed {userAssessment.completedAt ? new Date(userAssessment.completedAt).toLocaleDateString() : 'Recently'}
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        View Report
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-12 flex flex-wrap gap-4 justify-center">
          <Link href="/assessments">
            <Button variant="outline" size="lg">
              Browse More Assessments
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" size="lg">
              View Full Dashboard
            </Button>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
