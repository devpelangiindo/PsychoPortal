import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertCircle, CheckCircle2, ChevronDown, ClipboardCheck, Clock, CreditCard, Download, ExternalLink, FileText, Loader2, MessageCircle, Presentation, Printer, Search, Truck, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getAuthToken } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api-base";
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

type DassEligibility = {
  orderId: number;
  psychologistName: string | null;
  preferredDate: string;
  preferredTime: string;
  completed: boolean;
  completedAt: string | null;
  canAccess: boolean;
  accessStatus: "available" | "upcoming" | "expired";
};

type DassEligibilityResponse = {
  eligibleOrders: DassEligibility[];
};

type SrqEligibilityResponse = DassEligibilityResponse;

type ExternalAssessmentAccess = {
  orderId: number;
  assessmentId: number;
  assessmentName: string;
  description: string;
  websiteName: string | null;
  websiteUrl: string | null;
  workHours: string;
  resultEtaText: string;
  hasInstructions: boolean;
  instructionsFileName: string | null;
  instructionsUpdatedAt: string | null;
  token: string | null;
  hasResult: boolean;
  resultFileName: string | null;
  resultUploadedAt: string | null;
};

type DigitalPurchase = {
  productId: number;
  slug: string;
  name: string;
  shortDescription: string;
  orderId: number;
  paidAt: string | null;
  hasFile: boolean;
  hasLink: boolean;
  fileName: string | null;
  imageId: number | null;
  imageFocusX: number | null;
  imageFocusY: number | null;
};

type PhysicalOrder = {
  orderId:number; totalAmount:string; orderStatus:string; paymentStatus:string; createdAt:string;
  fulfillment_status:string; recipient_name:string; address:string; district:string; city:string; province:string; postal_code:string;
  courier:string|null; tracking_number:string|null; tracking_url:string|null;
  products:{productId:number;productName:string;sku:string;unitPrice:string;quantity:number;imageId:number|null}[];
};

type TrainingRegistration = {
  id: number; orderId: number; trainingTitle: string; optionName: string; price: string;
  status: string; paymentStatus: string; startsAt: string | null; endsAt: string | null;
  location: string | null; posterId: number | null; posterFocusX: number | null; posterFocusY: number | null; posterUpdatedAt: string | null;
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
  const [isMyAssessmentsOpen, setIsMyAssessmentsOpen] = useState(false);
  const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState(false);
  const [isCounselingReportsOpen, setIsCounselingReportsOpen] = useState(false);

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

  const { data: dassEligibility } = useQuery<DassEligibilityResponse>({
    queryKey: ["/api/dass-screenings/eligibility"],
    enabled: isAuthenticated,
    refetchInterval: 5000,
  });

  const { data: srqEligibility } = useQuery<SrqEligibilityResponse>({
    queryKey: ["/api/srq-screenings/eligibility"],
    enabled: isAuthenticated,
    refetchInterval: 5000,
  });

  const { data: externalAssessmentAccess = [] } = useQuery<ExternalAssessmentAccess[]>({
    queryKey: ["/api/external-assessments/access"],
    enabled: isAuthenticated,
    refetchInterval: 5000,
    refetchOnMount: "always",
  });

  const { data: digitalPurchases = [] } = useQuery<DigitalPurchase[]>({
    queryKey: ["/api/digital-products/purchases/me"],
    enabled: isAuthenticated,
    refetchInterval: 5000,
  });

  const { data: physicalOrders = [] } = useQuery<PhysicalOrder[]>({
    queryKey: ["/api/physical-products/orders/me"],
    enabled: isAuthenticated,
    refetchInterval: 5000,
  });

  const { data: trainingRegistrations = [] } = useQuery<TrainingRegistration[]>({
    queryKey: ["/api/training-registrations/me"],
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
        queryClient.refetchQueries({ queryKey: ["/api/orders"] }),
        queryClient.refetchQueries({ queryKey: ["/api/dass-screenings/eligibility"] }),
        queryClient.refetchQueries({ queryKey: ["/api/srq-screenings/eligibility"] }),
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
  const activeDassScreening = dassEligibility?.eligibleOrders.find((item) => !item.completed)
    ?? dassEligibility?.eligibleOrders[0];
  const activeSrqScreening = srqEligibility?.eligibleOrders.find((item) => !item.completed)
    ?? srqEligibility?.eligibleOrders[0];
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

        {trainingRegistrations.length > 0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div><p className="text-sm font-bold uppercase tracking-wider text-violet-700">Pendaftaran Anda</p><h2 className="text-2xl font-extrabold">Pelatihan Saya</h2></div>
              <a href="https://pi-psychology.com/produk-layanan/pelatihan" className="text-sm font-semibold text-violet-700 hover:underline">Lihat agenda</a>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {trainingRegistrations.map((registration) => (
                <Card key={registration.id} className="overflow-hidden">
                  <div className="h-40 bg-violet-50">
                    {registration.posterId ? <img src={apiUrl(`/api/trainings/posters/${registration.posterId}?v=${encodeURIComponent(registration.posterUpdatedAt || String(registration.posterId))}`)} alt={registration.trainingTitle} className="h-full w-full object-cover" style={{ objectPosition: `${registration.posterFocusX ?? 50}% ${registration.posterFocusY ?? 50}%` }} /> : <div className="flex h-full items-center justify-center"><Presentation className="h-10 w-10 text-violet-700" /></div>}
                  </div>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-violet-700">Pesanan #{registration.orderId}</p><h3 className="mt-1 text-lg font-bold">{registration.trainingTitle}</h3></div><Badge className={registration.paymentStatus === "paid" ? "bg-green-700" : "bg-amber-600"}>{registration.paymentStatus === "paid" ? "Lunas" : "Menunggu bayar"}</Badge></div>
                    <p className="mt-3 text-sm font-semibold text-gray-700">{registration.optionName}</p>
                    {registration.startsAt && <p className="mt-2 text-sm text-gray-500">{formatDisplayDateTime(registration.startsAt)}</p>}
                    {registration.location && <p className="mt-1 text-sm text-gray-500">{registration.location}</p>}
                    <p className="mt-3 font-extrabold text-violet-800">{formatCurrency(registration.price)}</p>
                    {registration.paymentStatus !== "paid" && <Button size="sm" className="mt-4 bg-violet-700 hover:bg-violet-800" disabled={settlePaymentMutation.isPending && settlingOrderId === registration.orderId} onClick={() => { setSettlingOrderId(registration.orderId); settlePaymentMutation.mutate(registration.orderId); }}>{settlePaymentMutation.isPending && settlingOrderId === registration.orderId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Lanjutkan Pembayaran</Button>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {digitalPurchases.length > 0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div><p className="text-sm font-bold uppercase tracking-wider text-green-700">Pembelian Anda</p><h2 className="text-2xl font-extrabold">Produk Digital Saya</h2></div>
              <a href="https://pi-psychology.com/produk-layanan/produk-edukasi/produk-digital" className="text-sm font-semibold text-green-700 hover:underline">Lihat katalog</a>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {digitalPurchases.map((product) => (
                <Card key={product.productId} className="overflow-hidden">
                  <div className="h-40 bg-green-50">
                    {product.imageId ? <img src={apiUrl(`/api/digital-products/images/${product.imageId}`)} alt={product.name} className="h-full w-full object-cover" style={{ objectPosition: `${product.imageFocusX ?? 50}% ${product.imageFocusY ?? 50}%` }} /> : <div className="flex h-full items-center justify-center font-semibold text-green-800">Produk Digital</div>}
                  </div>
                  <CardContent className="p-5">
                    <p className="text-xs font-bold uppercase tracking-wide text-green-700">Pesanan #{product.orderId}</p>
                    <h3 className="mt-1 text-lg font-bold">{product.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600">{product.shortDescription}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {product.hasFile && <Button size="sm" onClick={() => downloadProtectedFile(`/api/digital-products/purchases/${product.productId}/download`, product.fileName || product.name)}><Download className="mr-2 h-4 w-4" />Download</Button>}
                      {product.hasLink && <Button size="sm" variant="outline" onClick={async () => { try { const response = await apiRequest("GET", `/api/digital-products/purchases/${product.productId}/link`); const data = await response.json(); window.open(data.url, "_blank", "noopener,noreferrer"); } catch (error) { toast({ title: "Link tidak dapat dibuka", description: error instanceof Error ? error.message : "Silakan hubungi admin.", variant: "destructive" }); } }}><ExternalLink className="mr-2 h-4 w-4" />Buka Link</Button>}
                      {!product.hasFile && !product.hasLink && <Badge variant="secondary">Konten sedang disiapkan</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {physicalOrders.length > 0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Pengiriman Anda</p><h2 className="text-2xl font-extrabold">Pesanan Produk Fisik</h2></div><a href="https://pi-psychology.com/produk-layanan/produk-edukasi/produk-fisik" className="text-sm font-semibold text-green-700 hover:underline">Lihat katalog</a></div>
            <div className="space-y-4">{physicalOrders.map(order => <Card key={order.orderId}><CardContent className="p-5"><div className="flex flex-col justify-between gap-5 md:flex-row"><div className="flex gap-4">{order.products[0]?.imageId?<img src={apiUrl(`/api/physical-products/images/${order.products[0].imageId}`)} className="h-24 w-28 rounded-xl object-cover"/>:<div className="flex h-24 w-28 items-center justify-center rounded-xl bg-emerald-50"><Truck className="text-emerald-700"/></div>}<div><p className="text-xs font-bold uppercase text-emerald-700">Pesanan #{order.orderId}</p>{order.products.map(p=><p key={p.productId} className="font-semibold">{p.quantity}× {p.productName}</p>)}<p className="mt-1 font-extrabold text-green-700">{formatCurrency(order.totalAmount)}</p></div></div><div className="md:text-right"><Badge className={order.paymentStatus==="paid"?"bg-green-700":"bg-amber-600"}>{order.paymentStatus==="paid"?order.fulfillment_status:"Menunggu pembayaran"}</Badge><p className="mt-2 max-w-md text-sm text-gray-600">{order.address}, {order.district}, {order.city}, {order.province} {order.postal_code}</p>{order.tracking_number&&<p className="mt-2 text-sm"><b>{order.courier||"Kurir"}:</b> {order.tracking_number}</p>}<div className="mt-3 flex justify-end gap-2">{order.paymentStatus!=="paid"&&!isOrderCancelled(order as any)&&<Button size="sm" disabled={settlePaymentMutation.isPending&&settlingOrderId===order.orderId} onClick={()=>{setSettlingOrderId(order.orderId);settlePaymentMutation.mutate(order.orderId)}}>Lanjutkan Pembayaran</Button>}{order.tracking_url&&<a href={order.tracking_url} target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><ExternalLink className="mr-2 h-4 w-4"/>Lacak</Button></a>}</div></div></div></CardContent></Card>)}</div>
          </section>
        )}

        {externalAssessmentAccess.map((access) => (
          <Card key={`${access.orderId}-${access.assessmentId}`} className="mb-8 overflow-hidden border-rose-200 bg-gradient-to-r from-rose-50 to-orange-50">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-rose-700">Asesmen eksternal · Pesanan #{access.orderId}</p>
                  <CardTitle className="mt-1">{access.assessmentName}</CardTitle>
                  <p className="mt-2 text-sm text-neutral-600">{access.description}</p>
                </div>
                <Badge className={access.token ? "bg-green-700" : "bg-amber-600"}>
                  {access.token ? "Siap dikerjakan" : "Menunggu token"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {access.token ? (
                <div className="grid gap-3 rounded-xl border border-rose-100 bg-white p-4 sm:grid-cols-2">
                  <div><p className="text-xs text-neutral-500">Nomor token</p><p className="mt-1 font-mono text-lg font-bold text-rose-700">{access.token}</p></div>
                  <div><p className="text-xs text-neutral-500">Website pengerjaan</p><p className="mt-1 font-semibold">{access.websiteName || "Menunggu informasi Admin/CSO"}</p></div>
                  <div><p className="text-xs text-neutral-500">Jam pengerjaan</p><p className="mt-1 font-semibold">{access.workHours}</p></div>
                  <div><p className="text-xs text-neutral-500">Informasi hasil</p><p className="mt-1 font-semibold">{access.resultEtaText}</p></div>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Pembayaran sudah diterima, tetapi stok kode sedang dipersiapkan. Admin/CSO telah dapat melihat pesanan ini.
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                {access.websiteUrl && access.token && (
                  <a href={access.websiteUrl} target="_blank" rel="noreferrer"><Button><ExternalLink className="mr-2 h-4 w-4" />Buka Website Tes</Button></a>
                )}
                {access.hasInstructions && (
                  <Button variant="outline" onClick={() => downloadProtectedFile(`/api/external-assessments/${access.orderId}/${access.assessmentId}/instructions.pdf`, access.instructionsFileName || `ketentuan-${access.orderId}-${access.assessmentId}.pdf`, true)}>
                    <FileText className="mr-2 h-4 w-4" />Lihat Ketentuan PDF
                  </Button>
                )}
                {access.hasResult && (
                  <Button variant="outline" onClick={() => downloadProtectedFile(`/api/external-assessments/${access.orderId}/${access.assessmentId}/result.pdf`, access.resultFileName || `hasil-${access.orderId}-${access.assessmentId}.pdf`)}>
                    <Download className="mr-2 h-4 w-4" />Download Hasil
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {activeDassScreening && (
          <Card className="mb-12 overflow-hidden border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
            <CardContent className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-green-700 p-3 text-white">
                  {activeDassScreening.completed ? <CheckCircle2 className="h-6 w-6" /> : <ClipboardCheck className="h-6 w-6" />}
                </div>
                <div>
                  <p className="text-sm font-medium uppercase tracking-wide text-green-700">Screening Awal Konseling</p>
                  <h2 className="mt-1 text-xl font-semibold text-neutral-900">Tes DASS (Depression Anxiety Stress Scale)</h2>
                  <p className="mt-2 text-sm text-neutral-600">
                    {activeDassScreening.completed
                      ? "Tes telah selesai dan hasilnya sudah tersedia untuk psikolog yang menangani Anda."
                      : activeDassScreening.canAccess
                        ? "Isi 42 pernyataan mengenai kondisi satu minggu terakhir sebagai data pendukung konseling."
                        : activeDassScreening.accessStatus === "upcoming"
                          ? `Tes dapat diakses pada tanggal konseling, ${formatDisplayDate(activeDassScreening.preferredDate)}.`
                          : "Periode akses tes untuk jadwal konseling ini telah berakhir."}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Psikolog: {activeDassScreening.psychologistName || "-"} · Jadwal {formatDisplayDate(activeDassScreening.preferredDate)}, {activeDassScreening.preferredTime}
                  </p>
                </div>
              </div>
              {activeDassScreening.completed ? (
                <Badge className="self-start bg-green-700 md:self-center">Sudah diisi</Badge>
              ) : activeDassScreening.canAccess ? (
                <Link href={`/dass-screening/${activeDassScreening.orderId}`}>
                  <Button className="w-full whitespace-nowrap md:w-auto">Mulai Tes DASS</Button>
                </Link>
              ) : (
                <Button className="w-full whitespace-nowrap md:w-auto" disabled>
                  {activeDassScreening.accessStatus === "upcoming" ? "Belum dapat diakses" : "Akses berakhir"}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {activeSrqScreening && (
          <Card className="mb-12 -mt-8 overflow-hidden border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50">
            <CardContent className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-sky-700 p-3 text-white">
                  {activeSrqScreening.completed ? <CheckCircle2 className="h-6 w-6" /> : <ClipboardCheck className="h-6 w-6" />}
                </div>
                <div>
                  <p className="text-sm font-medium uppercase tracking-wide text-sky-700">Screening Awal Konseling</p>
                  <h2 className="mt-1 text-xl font-semibold text-neutral-900">Self-Reporting Questionnaire (SRQ-29)</h2>
                  <p className="mt-2 text-sm text-neutral-600">
                    {activeSrqScreening.completed
                      ? "Tes telah selesai dan hasilnya sudah tersedia untuk psikolog yang menangani Anda."
                      : activeSrqScreening.canAccess
                        ? "Jawab 29 pertanyaan mengenai kondisi 30 hari terakhir sebagai data pendukung konseling."
                        : activeSrqScreening.accessStatus === "upcoming"
                          ? `Tes dapat diakses pada tanggal konseling, ${formatDisplayDate(activeSrqScreening.preferredDate)}.`
                          : "Periode akses tes untuk jadwal konseling ini telah berakhir."}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Psikolog: {activeSrqScreening.psychologistName || "-"} · Jadwal {formatDisplayDate(activeSrqScreening.preferredDate)}, {activeSrqScreening.preferredTime}
                  </p>
                </div>
              </div>
              {activeSrqScreening.completed ? (
                <Badge className="self-start bg-sky-700 md:self-center">Sudah diisi</Badge>
              ) : activeSrqScreening.canAccess ? (
                <Link href={`/srq-screening/${activeSrqScreening.orderId}`}>
                  <Button className="w-full whitespace-nowrap bg-sky-700 hover:bg-sky-800 md:w-auto">Mulai Tes SRQ</Button>
                </Link>
              ) : (
                <Button className="w-full whitespace-nowrap md:w-auto" disabled>
                  {activeSrqScreening.accessStatus === "upcoming" ? "Belum dapat diakses" : "Akses berakhir"}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

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

        <div className="grid lg:grid-cols-2 gap-8">
          {/* My Assessments */}
          <Card className="order-2 self-start">
            <CardHeader className="p-0">
              <button
                type="button"
                onClick={() => setIsMyAssessmentsOpen((isOpen) => !isOpen)}
                aria-expanded={isMyAssessmentsOpen}
                aria-controls="my-assessments-content"
                className="flex w-full items-center justify-between gap-4 rounded-t-lg p-6 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <CardTitle>Asesmen Saya</CardTitle>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 transition-transform ${isMyAssessmentsOpen ? "rotate-180" : ""}`}
                />
              </button>
            </CardHeader>
            {isMyAssessmentsOpen && (
            <CardContent id="my-assessments-content">
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
            )}
          </Card>

          {/* Order History */}
          <Card className="order-1 self-start">
            <CardHeader className="p-0">
              <button
                type="button"
                onClick={() => setIsOrderHistoryOpen((isOpen) => !isOpen)}
                aria-expanded={isOrderHistoryOpen}
                aria-controls="order-history-content"
                className="flex w-full items-center justify-between gap-4 rounded-t-lg p-6 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <CardTitle>Riwayat Pesanan</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/20 rounded-md">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-700 dark:text-green-400 font-medium">Real-time Sync</span>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 transition-transform ${isOrderHistoryOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </button>
            </CardHeader>
            {isOrderHistoryOpen && (
            <CardContent id="order-history-content">
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
            )}
          </Card>
        </div>

        <div className="mt-8">
          <Card>
            <CardHeader className="p-0">
              <button
                type="button"
                onClick={() => setIsCounselingReportsOpen((isOpen) => !isOpen)}
                aria-expanded={isCounselingReportsOpen}
                aria-controls="counseling-reports-content"
                className="flex w-full items-center justify-between gap-4 rounded-t-lg p-6 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <div className="space-y-1.5">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-green-700" />
                    Laporan Konseling
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Laporan hasil konseling yang sudah dikirim psikolog akan muncul di sini.
                  </p>
                </div>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 transition-transform ${isCounselingReportsOpen ? "rotate-180" : ""}`}
                />
              </button>
            </CardHeader>
            {isCounselingReportsOpen && (
            <CardContent id="counseling-reports-content">
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
            )}
          </Card>
        </div>

        {/* Available Assessments Section */}
        <div className="mt-12">
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
                  {assessments.filter((assessment) => ["learning", "sensory", "external-mental-health", "external-student-potential", "external-career-potential"].includes(assessment.type)).map((assessment) => (
                    <AssessmentCard
                      key={assessment.id}
                      assessment={assessment}
                      showAddToCart={true}
                      showCatalogImage={true}
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

async function downloadProtectedFile(endpoint: string, fileName: string, openInline = false) {
  const token = getAuthToken();
  const response = await fetch(endpoint, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!response.ok) return;
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  if (openInline) {
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
