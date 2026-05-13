import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import AssessmentCard from "@/components/assessment-card";
import type { UserAssessmentWithDetails, OrderWithItems, Assessment } from "@shared/schema";

type Booking = {
  id: number;
  clientName: string;
  preferredDate: string;
  preferredTime: string;
  psychologistName: string | null;
  location: string | null;
  clientReportNotes: string | null;
  reportRecommendations: string | null;
  sessionReport: string | null;
  reportSubmittedAt: string | null;
  service: { name: string };
};

export default function Dashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(3);

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

  const { data: userAssessments, isLoading: assessmentsLoading } = useQuery<UserAssessmentWithDetails[]>({
    queryKey: ["/api/user-assessments"],
    enabled: isAuthenticated,
    refetchInterval: 3000, // Auto refresh every 3 seconds
    refetchIntervalInBackground: true, // Continue refreshing when tab is in background
  });

  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/orders"],
    enabled: isAuthenticated,
    refetchInterval: 2000, // Auto refresh every 2 seconds for real-time sync
    refetchIntervalInBackground: true, // Continue refreshing when tab is in background
  });

  const { data: assessments, isLoading: assessmentsForSaleLoading } = useQuery<Assessment[]>({
    queryKey: ["/api/assessments"],
    enabled: isAuthenticated,
  });

  const { data: bookings } = useQuery<Booking[]>({
    queryKey: ["/api/bookings"],
    enabled: isAuthenticated,
    refetchInterval: 5000,
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
      // Get the access token for sync trigger
      const accessToken = localStorage.getItem('accessToken');
      
      // Trigger real-time sync first
      await fetch('/api/sync/trigger', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      // Then refresh local data
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["/api/user-assessments"] }),
        queryClient.refetchQueries({ queryKey: ["/api/orders"] })
      ]);
      toast({
        title: "Sinkronisasi Berhasil",
        description: "Status pesanan telah disinkronisasi dengan Midtrans",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal sinkronisasi dengan Midtrans",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };



  const availableAssessments = userAssessments?.filter((ua: UserAssessmentWithDetails) => ua.status === 'available') || [];
  const completedAssessments = userAssessments?.filter((ua: UserAssessmentWithDetails) => ua.status === 'completed') || [];
  const inProgressAssessments = userAssessments?.filter((ua: UserAssessmentWithDetails) => ua.status === 'in_progress') || [];
  const clientReports = bookings?.filter((booking) => booking.reportSubmittedAt && getClientReportText(booking)) || [];

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
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Selesai</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">Menunggu</Badge>;
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
                  {userAssessments.map((userAssessment: UserAssessmentWithDetails) => (
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
                                : userAssessment.assessment.type === 'intelligence'
                                  ? `/multiple-intelligence/${userAssessment.id}`
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
                                : userAssessment.assessment.type === 'intelligence'
                                  ? `/multiple-intelligence/${userAssessment.id}`
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
              <div className="flex items-center justify-between">
                <CardTitle>Riwayat Pesanan</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/20 rounded-md">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-700 dark:text-green-400 font-medium">Real-time Sync</span>
                  </div>
                </div>
              </div>
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

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-700" />
                Laporan Konseling
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Laporan hasil konseling yang sudah dikirim psikolog akan muncul di sini.
              </p>
            </CardHeader>
            <CardContent>
              {clientReports.length > 0 ? (
                <div className="space-y-4">
                  {clientReports.map((booking) => (
                    <div key={booking.id} className="rounded-lg border bg-white p-4">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-neutral-900">Laporan Hasil Konseling</h3>
                          <p className="text-sm text-neutral-500 mt-1">
                            {booking.preferredDate}, {booking.preferredTime} · {booking.psychologistName || "-"}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => downloadClientReportPdf(booking)}>
                          <Download className="w-4 h-4 mr-2" />
                          Download PDF
                        </Button>
                      </div>
                      <p className="text-sm text-neutral-700 whitespace-pre-wrap mt-4">{getClientReportText(booking)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-neutral-500">Belum ada laporan konseling dari psikolog.</p>
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

function getClientReportText(booking: Booking) {
  return booking.clientReportNotes || booking.reportRecommendations || booking.sessionReport || "";
}

async function downloadClientReportPdf(booking: Booking) {
  const token = localStorage.getItem("accessToken");
  const response = await fetch(`/api/bookings/${booking.id}/client-report.pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) return;
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `laporan-konseling-${booking.clientName}-${booking.id}.pdf`.replace(/[^a-z0-9.-]+/gi, "-").toLowerCase();
  anchor.click();
  URL.revokeObjectURL(url);
}
