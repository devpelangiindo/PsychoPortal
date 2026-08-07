import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertCircle, Clock, CreditCard, Download, ExternalLink, FileText, Loader2, MessageCircle, Printer, Search, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import AssessmentCard from "@/components/assessment-card";
import type { UserAssessmentWithDetails, OrderWithItems, Assessment } from "@shared/schema";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/date-format";

type Booking = {
  id: number;
  orderId: number;
  clientName: string;
  preferredDate: string;
  preferredTime: string;
  psychologistName: string | null;
  location: string | null;
  meetingUrl: string | null;
  clientReportNotes: string | null;
  reportRecommendations: string | null;
  sessionReport: string | null;
  reportSubmittedAt: string | null;
  service: { name: string };
};

const PAYMENT_EXPIRY_MINUTES = 15;

function isOrderPaid(order: OrderWithItems) {
  return order.status === "completed" || order.paymentStatus === "paid";
}

function isOrderCancelled(order: OrderWithItems) {
  return order.status === "cancelled" || ["expired", "cancelled", "failed"].includes(order.paymentStatus || "");
}

function getPaymentDeadline(order: OrderWithItems) {
  if (!order.paymentId || isOrderPaid(order) || isOrderCancelled(order) || !order.updatedAt) return null;

  const updatedAt = new Date(order.updatedAt).getTime();
  if (Number.isNaN(updatedAt)) return null;

  return new Date(updatedAt + PAYMENT_EXPIRY_MINUTES * 60 * 1000);
}

function isOrderPaymentExpired(order: OrderWithItems) {
  const deadline = getPaymentDeadline(order);
  return Boolean(deadline && Date.now() >= deadline.getTime());
}

function formatCurrency(value: string | number) {
  return `Rp ${new Intl.NumberFormat("id-ID").format(Number(value) || 0)}`;
}

function normalizeDateInput(value: string) {
  const trimmed = value.trim();
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const yyyymmdd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return null;
}

function parseDateSearch(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return null;
  const rangeMatch = normalizedQuery.match(/^(.+?)\s*(?:s\/d|sd|sampai|to|\.\.|-)\s*(.+)$/i);
  if (rangeMatch) {
    const start = normalizeDateInput(rangeMatch[1]);
    const end = normalizeDateInput(rangeMatch[2]);
    if (start && end) return { start: start <= end ? start : end, end: start <= end ? end : start };
  }
  const exact = normalizeDateInput(normalizedQuery);
  return exact ? { start: exact, end: exact } : null;
}

function isDateInSearchRange(dateValue: string | null | undefined, range: { start: string; end: string }) {
  if (!dateValue) return false;
  const normalized = dateValue.slice(0, 10);
  return normalized >= range.start && normalized <= range.end;
}

function matchesClientDashboardOrder(order: OrderWithItems, bookings: Booking[], query: string) {
  const orderBookings = bookings.filter((item) => item.orderId === order.id);
  const dateRange = parseDateSearch(query);
  if (dateRange) {
    return isDateInSearchRange(order.createdAt, dateRange) ||
      isDateInSearchRange(order.updatedAt, dateRange) ||
      isDateInSearchRange(order.paidAt, dateRange) ||
      orderBookings.some((booking) => isDateInSearchRange(booking.preferredDate, dateRange));
  }

  const haystack = [
    `pesanan ${order.id}`,
    String(order.id),
    order.status,
    order.paymentStatus,
    order.paymentMethod,
    order.totalAmount,
    order.createdAt,
    ...orderBookings.flatMap((booking) => [
      booking.clientName,
      booking.psychologistName,
      booking.service.name,
      booking.preferredDate,
      booking.preferredTime,
      booking.location,
    ]),
    ...order.orderItems.map((item) => item.assessment.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function escapeHtml(value: unknown) {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function printReceipt(order: OrderWithItems, bookings: Booking[] = []) {
  if (!isOrderPaid(order)) return;
  const paidAt = order.paidAt ?? order.updatedAt ?? order.createdAt;
  const booking = bookings[0];

  const items = order.orderItems.length > 0
    ? order.orderItems.map((item) => `
        <tr>
          <td>${escapeHtml(item.assessment.name)}</td>
          <td class="right">${escapeHtml(formatCurrency(item.price))}</td>
        </tr>
      `).join("")
    : `
        <tr>
          <td>${escapeHtml(`${booking?.service.name ?? "Booking Psikolog"}${bookings.length > 1 ? ` (${bookings.length} sesi)` : ""}`)}</td>
          <td class="right">${escapeHtml(formatCurrency(order.totalAmount))}</td>
        </tr>
      `;

  const details = booking ? `
    <div class="section">
      <h2>Detail Konseling</h2>
      <div class="row"><span>Nama Klien</span><strong>${escapeHtml(booking.clientName)}</strong></div>
      <div class="row"><span>Psikolog</span><strong>${escapeHtml(booking.psychologistName)}</strong></div>
      ${bookings.map((item, index) => `<div class="row"><span>Sesi ${index + 1}</span><strong>${escapeHtml(`${formatDisplayDate(item.preferredDate)}, ${item.preferredTime}`)}</strong></div>`).join("")}
      <div class="row"><span>Lokasi</span><strong>${escapeHtml(booking.location ?? "-")}</strong></div>
    </div>
  ` : "";

  const receiptWindow = window.open("", "_blank", "width=720,height=900");
  if (!receiptWindow) return;

  receiptWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Resi Transaksi #${escapeHtml(order.id)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #1f2937; margin: 32px; }
          .receipt { max-width: 680px; margin: 0 auto; }
          h1 { margin: 0 0 6px; font-size: 24px; }
          h2 { font-size: 15px; margin: 0 0 12px; color: #166534; }
          .muted { color: #6b7280; font-size: 13px; }
          .section { border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 18px; }
          .row { display: flex; justify-content: space-between; gap: 24px; margin: 8px 0; font-size: 14px; }
          .row span { color: #6b7280; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
          th, td { padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: left; }
          .right { text-align: right; }
          .total { font-size: 18px; font-weight: 700; }
          .paid { display: inline-block; margin-top: 10px; padding: 5px 10px; border-radius: 999px; background: #dcfce7; color: #166534; font-weight: 700; font-size: 12px; }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>
        <div class="receipt">
          <h1>Resi Transaksi</h1>
          <div class="muted">Rumah Psikologi Pelangi Indonesia</div>
          <span class="paid">LUNAS</span>

          <div class="section">
            <h2>Detail Pembayaran</h2>
            <div class="row"><span>No. Order</span><strong>#${escapeHtml(order.id)}</strong></div>
            <div class="row"><span>Payment ID</span><strong>${escapeHtml(order.paymentId)}</strong></div>
            <div class="row"><span>Tanggal/Jam Bayar</span><strong>${escapeHtml(paidAt ? formatDisplayDateTime(paidAt) : "-")}</strong></div>
            <div class="row"><span>Status</span><strong>${escapeHtml(order.paymentStatus ?? order.status)}</strong></div>
          </div>

          ${details}

          <div class="section">
            <h2>Rincian</h2>
            <table>
              <thead><tr><th>Item</th><th class="right">Nominal</th></tr></thead>
              <tbody>${items}</tbody>
              <tfoot><tr><td class="total">Total</td><td class="right total">${escapeHtml(formatCurrency(order.totalAmount))}</td></tr></tfoot>
            </table>
          </div>
        </div>
        <script>window.onload = () => { window.print(); };</script>
      </body>
    </html>
  `);
  receiptWindow.document.close();
}

export default function Dashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(3);
  const [settlingOrderId, setSettlingOrderId] = useState<number | null>(null);
  const [orderSearch, setOrderSearch] = useState("");

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

  const settlePaymentMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const response = await apiRequest("POST", "/api/payments/create", {
        orderId,
        paymentMethod: "midtrans",
      });
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-assessments"] });

      if (result.redirect_url) {
        window.location.href = result.redirect_url;
        return;
      }

      toast({
        title: "Pembayaran dibuat",
        description: "Silakan lanjutkan pembayaran pesanan Anda.",
      });
      refetchOrders();
    },
    onError: () => {
      toast({
        title: "Gagal membuat pembayaran",
        description: "Silakan coba lagi atau hubungi admin.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setSettlingOrderId(null);
    },
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
  const filteredOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();
    if (!query) return orders || [];
    return (orders || []).filter((order) => matchesClientDashboardOrder(order, bookings || [], query));
  }, [bookings, orderSearch, orders]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
      case 'purchased':
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

  const canSettleOrderPayment = (order: OrderWithItems) =>
    !isOrderPaid(order) && !isOrderCancelled(order) && !isOrderPaymentExpired(order);

  const handleSettleOrderPayment = (order: OrderWithItems) => {
    if (!canSettleOrderPayment(order) || settlePaymentMutation.isPending) return;
    setSettlingOrderId(order.id);
    settlePaymentMutation.mutate(order.id);
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
                    Anggota sejak {user?.createdAt ? formatDisplayDate(user.createdAt) : 'Baru-baru ini'}
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
                            Selesai {formatDisplayDate(userAssessment.completedAt)}
                          </p>
                        )}
                      </div>
                      <div className="ml-4">
                        {(userAssessment.status === 'available' || userAssessment.status === 'purchased') && (
                          <Link href={
                            userAssessment.assessment.type === 'sensory' 
                              ? `/sensory-profile/${userAssessment.id}`
                              : userAssessment.assessment.type === 'learning'
                                ? `/learning-style/${userAssessment.id}`
                                : userAssessment.assessment.type === 'intelligence'
                                  ? `/multiple-intelligence/${userAssessment.id}`
                                  : userAssessment.assessment.type === 'mental-health'
                                    ? `/mental-health-checkup/${userAssessment.id}`
                                    : userAssessment.assessment.type === 'student-potential'
                                      ? `/student-potential-test/${userAssessment.id}`
                                      : userAssessment.assessment.type === 'career-potential'
                                        ? `/career-potential-test/${userAssessment.id}`
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
                                  : userAssessment.assessment.type === 'mental-health'
                                    ? `/mental-health-checkup/${userAssessment.id}`
                                    : userAssessment.assessment.type === 'student-potential'
                                      ? `/student-potential-test/${userAssessment.id}`
                                      : userAssessment.assessment.type === 'career-potential'
                                        ? `/career-potential-test/${userAssessment.id}`
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
              <div className="relative mb-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  value={orderSearch}
                  onChange={(event) => setOrderSearch(event.target.value)}
                  placeholder="Cari pesanan, psikolog, status, atau tanggal DD/MM/YYYY; range 01/07/2026-13/07/2026"
                  className="pl-9"
                />
              </div>
              {ordersLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              ) : filteredOrders.length > 0 ? (
                <div className="space-y-4">
                  {filteredOrders.map((order) => {
                    const paymentDeadline = getPaymentDeadline(order);
                    const paymentExpired = isOrderPaymentExpired(order);
                    const canPay = canSettleOrderPayment(order);
                    const orderBookings = bookings?.filter((item) => item.orderId === order.id) ?? [];
                    const booking = orderBookings[0];

                    return (
                    <div key={order.id} className="dashboard-item">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium text-neutral-900 dark:text-foreground">
                            Pesanan #{order.id}
                          </h3>
                          {getOrderStatusBadge(order.status)}
                        </div>
                        <p className="text-sm text-neutral-500 dark:text-muted-foreground">
                          {order.orderItems.length > 0 ? `${order.orderItems.length} item` : `${orderBookings.length || 1} sesi psikolog`} •
                          Rp {new Intl.NumberFormat('id-ID').format(parseFloat(order.totalAmount))}
                        </p>
                        {booking?.psychologistName && (
                          <p className="mt-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                            Psikolog: {booking.psychologistName}
                          </p>
                        )}
                        {orderBookings.map((item, index) => (
                          <div key={item.id} className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                            Sesi {index + 1}: {formatDisplayDate(item.preferredDate)}, {item.preferredTime}
                            {item.location === "online" && item.meetingUrl && (
                              <a
                                href={item.meetingUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-2 inline-flex items-center gap-1 font-medium text-green-700 hover:underline"
                              >
                                <Video className="w-4 h-4" />
                                Link meeting
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ))}
                        <p className="text-xs text-neutral-400 dark:text-muted-foreground mt-1">
                          {formatDisplayDate(order.createdAt)}
                        </p>
                        {paymentDeadline && canPay && (
                          <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-700">
                            <Clock className="w-3 h-3" />
                            Batas pembayaran: {formatDisplayDateTime(paymentDeadline)}. Kode pembayaran berlaku 15 menit.
                          </p>
                        )}
                        {canPay && (
                          <p className="mt-2 inline-flex items-center gap-1 text-xs text-green-700">
                            <MessageCircle className="w-3 h-3" />
                            Placeholder pengingat WA pembayaran: menunggu setup WhatsApp Business API.
                          </p>
                        )}
                        {(paymentExpired || isOrderCancelled(order)) && !isOrderPaid(order) && (
                          <p className="mt-2 inline-flex items-center gap-1 text-xs text-red-700">
                            <AlertCircle className="w-3 h-3" />
                            Pesanan sudah kadaluwarsa/dibatalkan. Silakan isi booking atau buat pesanan ulang.
                          </p>
                        )}
                      </div>
                      {canPay && (
                        <div className="ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSettleOrderPayment(order)}
                            disabled={settlePaymentMutation.isPending}
                            className="whitespace-nowrap"
                          >
                            {settlingOrderId === order.id ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <CreditCard className="w-4 h-4 mr-2" />
                            )}
                            Bayar
                          </Button>
                        </div>
                      )}
                      {isOrderPaid(order) && (
                        <div className="ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => printReceipt(order, orderBookings)}
                            className="whitespace-nowrap"
                          >
                            <Printer className="w-4 h-4 mr-2" />
                            Cetak Resi
                          </Button>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-neutral-500 dark:text-muted-foreground">
                    {orderSearch.trim() ? "Tidak ada pesanan yang cocok." : "Belum ada pesanan"}
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
                            {formatDisplayDate(booking.preferredDate)}, {booking.preferredTime} · {booking.psychologistName || "-"}
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
  return booking.clientReportNotes || booking.reportRecommendations || "";
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
