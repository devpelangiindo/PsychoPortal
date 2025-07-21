import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import AssessmentCard from "@/components/assessment-card";
import type { UserAssessmentWithDetails, OrderWithItems, Assessment } from "@shared/schema";

export default function Dashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(6);

  // Countdown timer for auto refresh
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshCountdown(prev => {
        if (prev <= 1) {
          return 6; // Reset to 6 seconds
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const { data: userAssessments, isLoading: assessmentsLoading } = useQuery<UserAssessmentWithDetails[]>({
    queryKey: ["/api/user-assessments"],
    enabled: isAuthenticated,
    refetchInterval: 6000, // Auto refresh every 6 seconds
    refetchIntervalInBackground: true, // Continue refreshing when tab is in background
    onSuccess: (data) => {
      // Only show toast on subsequent refreshes, not initial load
      if (data && !assessmentsLoading) {
        console.log("Assessment data refreshed automatically");
      }
    },
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/orders"],
    enabled: isAuthenticated,
    refetchInterval: 6000, // Auto refresh every 6 seconds
    refetchIntervalInBackground: true, // Continue refreshing when tab is in background
  });

  const { data: assessments, isLoading: assessmentsForSaleLoading } = useQuery<Assessment[]>({
    queryKey: ["/api/assessments"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Tidak Diizinkan",
        description: "Anda telah keluar. Masuk lagi...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [authLoading, isAuthenticated, toast]);

  // Manual refresh function
  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["/api/user-assessments"] }),
        queryClient.refetchQueries({ queryKey: ["/api/orders"] })
      ]);
      toast({
        title: "Berhasil",
        description: "Data telah diperbarui",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal memperbarui data",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const availableAssessments = userAssessments?.filter(ua => ua.status === 'available') || [];
  const completedAssessments = userAssessments?.filter(ua => ua.status === 'completed') || [];
  const inProgressAssessments = userAssessments?.filter(ua => ua.status === 'in_progress') || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge className="status-available">Tersedia</Badge>;
      case 'completed':
        return <Badge className="status-completed">Selesai</Badge>;
      case 'in_progress':
        return <Badge className="status-in-progress">Sedang Berlangsung</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Selesai</Badge>;
      case 'pending':
        return <Badge variant="secondary">Menunggu</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Dibatalkan</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (authLoading || assessmentsLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-background">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-muted rounded" />
              ))}
            </div>
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="h-96 bg-muted rounded" />
              <div className="h-96 bg-muted rounded" />
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* User Profile Header */}
        <div className="mb-12">
          <div className="bg-gradient-to-r from-primary to-accent p-8 rounded-2xl text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mr-6">
                  {user?.profileImageUrl ? (
                    <img 
                      src={user.profileImageUrl} 
                      alt="Profile" 
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl font-bold">
                      {user?.firstName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                    </span>
                  )}
                </div>
                <div>
                  <h1 className="text-3xl font-bold">
                    {user?.firstName && user?.lastName 
                      ? `${user.firstName} ${user.lastName}`
                      : user?.firstName || user?.email || 'User'
                    }
                  </h1>
                  <p className="opacity-90 mt-1">{user?.email}</p>
                  <p className="opacity-75 text-sm mt-2">
                    Anggota sejak {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Baru-baru ini'}
                  </p>
                </div>
              </div>
              
              {/* Auto Refresh Controls */}
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

        {/* Statistics Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-secondary mb-2">
                {availableAssessments.length}
              </div>
              <div className="text-neutral-500 dark:text-muted-foreground">
                Tersedia
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-orange-500 mb-2">
                {inProgressAssessments.length}
              </div>
              <div className="text-neutral-500 dark:text-muted-foreground">
                Sedang Berlangsung
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-accent mb-2">
                {completedAssessments.length}
              </div>
              <div className="text-neutral-500 dark:text-muted-foreground">
                Selesai
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-primary mb-2">
                {orders?.filter(o => o.status === 'completed').length || 0}
              </div>
              <div className="text-neutral-500 dark:text-muted-foreground">
                Pesanan
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Available Assessments Section */}
        <div className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle>Asesmen yang Tersedia</CardTitle>
              <p className="text-sm text-muted-foreground">
                Klik tombol keranjang untuk menambahkan asesmen ke keranjang dan lakukan pembelian
              </p>
            </CardHeader>
            <CardContent>
              {assessmentsForSaleLoading ? (
                <div className="grid md:grid-cols-2 gap-6">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-64 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              ) : assessments && assessments.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-6">
                  {assessments.map((assessment) => (
                    <AssessmentCard
                      key={assessment.id}
                      assessment={assessment}
                      showAddToCart={true}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-neutral-500 dark:text-muted-foreground">
                    Tidak ada asesmen yang tersedia saat ini
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* My Assessments */}
          <Card>
            <CardHeader>
              <CardTitle>Asesmen Saya</CardTitle>
            </CardHeader>
            <CardContent>
              {userAssessments && userAssessments.length > 0 ? (
                <div className="space-y-4">
                  {userAssessments.map((userAssessment) => (
                    <div key={userAssessment.id} className="dashboard-item">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium text-neutral-900 dark:text-foreground">
                            {userAssessment.assessment.name}
                          </h3>
                          {getStatusBadge(userAssessment.status)}
                        </div>
                        <p className="text-sm text-neutral-500 dark:text-muted-foreground">
                          {userAssessment.assessment.duration} • {userAssessment.assessment.ageRange}
                        </p>
                        {userAssessment.completedAt && (
                          <p className="text-xs text-neutral-400 dark:text-muted-foreground mt-1">
                            Selesai {new Date(userAssessment.completedAt).toLocaleDateString('id-ID')}
                          </p>
                        )}
                      </div>
                      <div className="ml-4">
                        {userAssessment.status === 'available' && (
                          <Link href={
                            userAssessment.assessment.type === 'sensory' 
                              ? `/sensory-profile/${userAssessment.id}`
                              : userAssessment.assessment.type === 'learning'
                                ? `/learning-style/${userAssessment.id}`
                                : `/assessment/${userAssessment.id}`
                          }>
                            <Button size="sm">Mulai Tes</Button>
                          </Link>
                        )}
                        {userAssessment.status === 'in_progress' && (
                          <Link href={
                            userAssessment.assessment.type === 'sensory' 
                              ? `/sensory-profile/${userAssessment.id}`
                              : userAssessment.assessment.type === 'learning'
                                ? `/learning-style/${userAssessment.id}`
                                : `/assessment/${userAssessment.id}`
                          }>
                            <Button size="sm" variant="outline">Lanjutkan</Button>
                          </Link>
                        )}
                        {userAssessment.status === 'completed' && (
                          <Link href={`/results/${userAssessment.id}`}>
                            <Button size="sm" variant="outline">
                              Lihat Laporan
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-neutral-500 dark:text-muted-foreground mb-4">
                    Belum ada asesmen yang dibeli
                  </p>
                  <Link href="/assessments">
                    <Button>Lihat Asesmen</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order History */}
          <Card>
            <CardHeader>
              <CardTitle>Riwayat Pesanan</CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              ) : orders && orders.length > 0 ? (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order.id} className="dashboard-item">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium text-neutral-900 dark:text-foreground">
                            Pesanan #{order.id}
                          </h3>
                          {getOrderStatusBadge(order.status)}
                        </div>
                        <p className="text-sm text-neutral-500 dark:text-muted-foreground">
                          {order.orderItems.length} item • 
                          Rp {new Intl.NumberFormat('id-ID').format(parseFloat(order.totalAmount))}
                        </p>
                        <p className="text-xs text-neutral-400 dark:text-muted-foreground mt-1">
                          {new Date(order.createdAt!).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-neutral-500 dark:text-muted-foreground">
                    Belum ada pesanan
                  </p>
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
          <Link href="/">
            <Button variant="outline" size="lg">
              Back to Home
            </Button>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
