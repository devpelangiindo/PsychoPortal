import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const [refreshCountdown, setRefreshCountdown] = useState(3);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Countdown timer for auto refresh
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshCountdown(prev => {
        if (prev <= 1) {
          return 3; // Reset to 3 seconds
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const { data: userAssessments, isLoading } = useQuery<UserAssessmentWithDetails[]>({
    queryKey: ["/api/user-assessments"],
    refetchInterval: 3000, // Auto refresh every 3 seconds
    refetchIntervalInBackground: true, // Continue refreshing when tab is in background
  });

  const { data: allAssessments, isLoading: isLoadingAssessments } = useQuery<Assessment[]>({
    queryKey: ["/api/assessments"],
    refetchInterval: 3000, // Auto refresh every 3 seconds
    refetchIntervalInBackground: true,
  });

  // Manual refresh function
  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["/api/user-assessments"] }),
        queryClient.refetchQueries({ queryKey: ["/api/assessments"] })
      ]);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const availableAssessments = userAssessments?.filter((ua: UserAssessmentWithDetails) => ua.status === 'available') || [];
  const completedAssessments = userAssessments?.filter((ua: UserAssessmentWithDetails) => ua.status === 'completed') || [];
  const inProgressAssessments = userAssessments?.filter((ua: UserAssessmentWithDetails) => ua.status === 'in_progress') || [];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <div className="bg-gradient-to-r from-primary to-accent p-8 rounded-2xl text-white">
            <div className="flex items-center justify-between">
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
              
              {/* Auto Refresh Indicator */}
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="flex items-center justify-end">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
                    <span className="text-xs opacity-75">Refresh dalam {refreshCountdown}s</span>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  {isRefreshing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  <span className="ml-2">Refresh</span>
                </Button>
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



        {/* Available Assessments for Purchase */}
        <div className="mt-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-foreground mb-4">
              Asesmen Online yang Tersedia
            </h2>
            <p className="text-lg text-neutral-500 dark:text-muted-foreground max-w-2xl mx-auto">
              Jelajahi asesmen psikologi yang dapat dikerjakan secara online dan tambahkan ke keranjang Anda
            </p>
            <Link href="/assessments">
              <Button variant="outline" className="mt-5">Lihat Semua Kategori Asesmen</Button>
            </Link>
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
            <div className="flex justify-center">
              <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
                {allAssessments.filter((assessment) => ["learning", "sensory", "external-mental-health", "external-student-potential", "external-career-potential"].includes(assessment.type)).map((assessment) => (
                  <AssessmentCard 
                    key={assessment.id} 
                    assessment={assessment} 
                    showAddToCart={true} 
                  />
                ))}
              </div>
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
