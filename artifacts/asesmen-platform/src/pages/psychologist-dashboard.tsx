import { useMutation, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { CalendarDays, ClipboardCheck, Clock, ExternalLink, Eye, FileText, History, LogOut, Mail, MapPin, Phone, Plus, Printer, Save, Search, Trash2, UserRound, Video } from "lucide-react";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getAuthToken, queryClient } from "@/lib/queryClient";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/date-format";

type Booking = {
  id: number;
  clientName: string;
  birthDate: string | null;
  gender: "male" | "female" | null;
  age: number | null;
  email: string;
  whatsappNumber: string;
  mainConcern: string | null;
  concernHistory: string | null;
  consultationType: "child" | "adult" | "family" | null;
  childName: string | null;
  childBirthDate: string | null;
  previousDiagnosis: string | null;
  preferredDate: string;
  preferredTime: string;
  psychologistName: string | null;
  location: string | null;
  meetingUrl: string | null;
  sessionReport: string | null;
  reportRecommendations: string | null;
  clientReportNotes: string | null;
  counselingHistoryNotes: string | null;
  counselingSubjectiveNotes: string | null;
  counselingObservations: string[] | null;
  counselingResultNotes: string | null;
  counselingPlanNotes: string | null;
  reportSubmittedAt: string | null;
  status: string;
  paidAt: string | null;
  createdAt: string | null;
  service: {
    name: string;
  };
  order: {
    id: number;
    status: string;
    paymentId: string | null;
    paymentStatus: string | null;
    paymentMethod: string | null;
    totalAmount: string;
    paidAt: string | null;
  };
};

type AvailabilitySlot = {
  id?: number;
  dayOfWeek: number;
  timeSlot: string;
  isAvailable: boolean;
};

type AvailabilityResponse = {
  psychologistName: string;
  availability: AvailabilitySlot[];
};

type ScheduleSlot = {
  id: number;
  scheduleDate: string;
  timeSlot: string;
  location: "online" | "colombo" | "bantul";
  isAvailable: boolean;
  isLocked: boolean;
};

type ScheduleResponse = {
  psychologistName: string;
  startDate: string;
  endDate: string;
  scheduleSlots: ScheduleSlot[];
};

type PsychologistOption = {
  name: string;
  types: Array<"child" | "adult" | "family">;
};

const consultationLabels = {
  child: "Anak/remaja",
  adult: "Pribadi dewasa",
  family: "Keluarga",
};

const locationLabels: Record<string, string> = {
  online: "Online",
  colombo: "Offline Colombo",
  bantul: "Offline Bantul",
};

function formatCurrency(value: string | number) {
  return `Rp ${new Intl.NumberFormat("id-ID").format(Number(value) || 0)}`;
}

function compareBookingsNewestFirst(left: Booking, right: Booking) {
  const leftTimestamp = Date.parse(left.createdAt ?? "");
  const rightTimestamp = Date.parse(right.createdAt ?? "");
  const safeLeftTimestamp = Number.isFinite(leftTimestamp) ? leftTimestamp : 0;
  const safeRightTimestamp = Number.isFinite(rightTimestamp) ? rightTimestamp : 0;

  return safeRightTimestamp - safeLeftTimestamp || right.id - left.id;
}

function escapeHtml(value: unknown) {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function printBookingReceipt(booking: Booking) {
  if (booking.status !== "paid" && booking.order.paymentStatus !== "paid" && booking.order.status !== "completed") return;
  const paidAt = booking.order.paidAt ?? booking.paidAt ?? booking.createdAt;

  const receiptWindow = window.open("", "_blank", "width=720,height=900");
  if (!receiptWindow) return;

  receiptWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Resi Transaksi #${escapeHtml(booking.order.id)}</title>
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
            <div class="row"><span>No. Order</span><strong>#${escapeHtml(booking.order.id)}</strong></div>
            <div class="row"><span>Payment ID</span><strong>${escapeHtml(booking.order.paymentId)}</strong></div>
            <div class="row"><span>Tanggal/Jam Bayar</span><strong>${escapeHtml(paidAt ? formatDisplayDateTime(paidAt) : "-")}</strong></div>
            <div class="row"><span>Status</span><strong>${escapeHtml(booking.order.paymentStatus ?? booking.order.status)}</strong></div>
          </div>

          <div class="section">
            <h2>Detail Konseling</h2>
            <div class="row"><span>Nama Klien</span><strong>${escapeHtml(booking.clientName)}</strong></div>
            <div class="row"><span>Psikolog</span><strong>${escapeHtml(booking.psychologistName)}</strong></div>
            <div class="row"><span>Jadwal</span><strong>${escapeHtml(`${formatDisplayDate(booking.preferredDate)}, ${booking.preferredTime}`)}</strong></div>
            <div class="row"><span>Lokasi</span><strong>${escapeHtml(locationLabels[booking.location ?? ""] ?? booking.location ?? "-")}</strong></div>
          </div>

          <div class="section">
            <h2>Rincian</h2>
            <table>
              <thead><tr><th>Item</th><th class="right">Nominal</th></tr></thead>
              <tbody>
                <tr>
                  <td>${escapeHtml(booking.service.name)}</td>
                  <td class="right">${escapeHtml(formatCurrency(booking.order.totalAmount))}</td>
                </tr>
              </tbody>
              <tfoot><tr><td class="total">Total</td><td class="right total">${escapeHtml(formatCurrency(booking.order.totalAmount))}</td></tr></tfoot>
            </table>
          </div>
        </div>
        <script>window.onload = () => { window.print(); };</script>
      </body>
    </html>
  `);
  receiptWindow.document.close();
}

const dayLabels = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

const timeSlots = ["08.00 - 10.00", "10.30 - 12.30", "13.30 - 15.30"];
const defaultPsychologistNames = [
  "Tria Khusni Barokah, M.Psi., Psikolog",
  "Dr. Yeni Triwahyuningsih, S.Psi., MM., Psikolog",
  "Retno Rahayu, M.Psi., Psikolog",
  "Ridwan Rahmawan, S.Psi., M.H., Psikolog",
];

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

function matchesBookingDateRange(booking: Booking, startDate: string, endDate: string) {
  const bookingDate = booking.preferredDate.slice(0, 10);
  return (!startDate || bookingDate >= startDate) && (!endDate || bookingDate <= endDate);
}

type DashboardMode = "psychologist" | "admin";

export function AdminPsychologistBookings() {
  return <PsychologistDashboard mode="admin" />;
}

export default function PsychologistDashboard({ mode = "psychologist" }: { mode?: DashboardMode }) {
  const { user, isLoading: authLoading, logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingStartDate, setBookingStartDate] = useState("");
  const [bookingEndDate, setBookingEndDate] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [selectedAdminPsychologist, setSelectedAdminPsychologist] = useState(defaultPsychologistNames[0]);
  const isAdminMode = mode === "admin";
  const isAdminOrCso = user?.role === "admin" || user?.role === "internal" || user?.role === "cso";
  const isCsoRole = user?.role === "cso" || user?.role === "internal";
  const canManagePsychologistSchedules = !isAdminMode || user?.role === "admin";
  const canEditReports = !isAdminMode || user?.role === "admin";
  const loginRedirect = isAdminMode ? (user?.role === "cso" || user?.role === "internal" ? "/cso/bookings" : "/admin/bookings") : "/psychologist/dashboard";
  const hasAccess = !!user && (isAdminMode ? isAdminOrCso : user.role === "psychologist");

  const { data: bookings = [], isLoading } = useQuery<Booking[]>({
    queryKey: ["/api/psychologist/bookings", mode],
    enabled: hasAccess,
  });

  const { data: reports = [], isLoading: reportsLoading } = useQuery<Booking[]>({
    queryKey: ["/api/psychologist/reports", mode, reportSearch],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/psychologist/reports${reportSearch.trim() ? `?search=${encodeURIComponent(reportSearch.trim())}` : ""}`);
      return response.json();
    },
    enabled: hasAccess,
  });

  const { data: psychologistOptions = [] } = useQuery<PsychologistOption[]>({
    queryKey: ["/api/psychologists"],
    enabled: hasAccess,
  });
  const psychologistNames = useMemo(
    () => psychologistOptions.length
      ? psychologistOptions.map((psychologist) => psychologist.name)
      : defaultPsychologistNames,
    [psychologistOptions],
  );

  useEffect(() => {
    if (!psychologistNames.length || psychologistNames.includes(selectedAdminPsychologist)) return;
    setSelectedAdminPsychologist(psychologistNames[0]);
  }, [psychologistNames, selectedAdminPsychologist]);

  const { data: scheduleData, isLoading: scheduleLoading } = useQuery<ScheduleResponse>({
    queryKey: ["/api/psychologist/schedule-slots", mode, isAdminMode ? selectedAdminPsychologist : "self"],
    queryFn: async () => {
      const query = isAdminMode ? `?psychologistName=${encodeURIComponent(selectedAdminPsychologist)}` : "";
      const response = await apiRequest("GET", `/api/psychologist/schedule-slots${query}`);
      return response.json();
    },
    enabled: hasAccess && (!isAdminMode || Boolean(selectedAdminPsychologist)),
  });
  const filteredBookings = useMemo(() => {
    const query = bookingSearch.trim().toLowerCase();
    const hasDateFilter = Boolean(bookingStartDate || bookingEndDate);
    const matchingBookings = query || hasDateFilter
      ? bookings.filter((booking) => (
          (!query || matchesBookingSearch(booking, query))
          && (!hasDateFilter || matchesBookingDateRange(booking, bookingStartDate, bookingEndDate))
        ))
      : bookings;

    return isAdminMode
      ? [...matchingBookings].sort(compareBookingsNewestFirst)
      : matchingBookings;
  }, [bookingEndDate, bookingSearch, bookingStartDate, bookings, isAdminMode]);

  if (authLoading) {
    return <LoadingState label="Memuat akun..." />;
  }

  if (!user) {
    setLocation(`/login?redirect=${loginRedirect}`);
    return <LoadingState label="Mengalihkan ke login..." />;
  }

  if (!isAdminMode && isAdminOrCso) {
    setLocation(user?.role === "cso" || user?.role === "internal" ? "/cso/bookings" : "/admin/bookings");
    return <LoadingState label="Mengalihkan ke halaman booking admin..." />;
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-16">
          <Card>
            <CardHeader>
              <CardTitle>{isAdminMode ? "Akses khusus admin" : "Akses khusus psikolog"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-neutral-500">
                {isAdminMode ? "Akun ini belum memiliki role admin." : "Akun ini belum memiliki role psikolog."}
              </p>
              <Button onClick={() => setLocation(user?.role === "cso" || user?.role === "internal" ? "/cso/dashboard" : isAdminOrCso ? "/admin/dashboard" : "/dashboard")}>Kembali ke Dashboard</Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-foreground">
              {isAdminMode ? "Booking Psikolog" : "Dashboard Psikolog"}
            </h1>
            <p className="text-neutral-500 dark:text-muted-foreground mt-2">
              {isAdminMode
                ? "Seluruh booking konseling psikolog"
                : user.psychologistProfileName || `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()}
            </p>
          </div>
          <Button variant="outline" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Metric label="Total klien" value={bookings.length} />
          <Metric label="Sudah bayar" value={bookings.filter((booking) => booking.status === "paid").length} />
          <Metric label="Menunggu bayar" value={bookings.filter((booking) => booking.status !== "paid").length} />
        </div>

        <Tabs defaultValue={isAdminMode ? "konseling" : "perubahan-jadwal"} className="space-y-6">
          <TabsList className="h-auto flex-wrap justify-start">
            {!isAdminMode && <TabsTrigger value="perubahan-jadwal">Perubahan Jadwal</TabsTrigger>}
            <TabsTrigger value="konseling">Konseling</TabsTrigger>
            {isAdminMode && <TabsTrigger value="jadwal-psikolog">Perubahan Jadwal Psikolog</TabsTrigger>}
            <TabsTrigger value="laporan">Laporan</TabsTrigger>
          </TabsList>

          {!isAdminMode && (
            <TabsContent value="perubahan-jadwal" className="space-y-4">
              <SectionTitle
                icon={<Clock className="w-5 h-5" />}
                title="Perubahan Jadwal"
                description="Atur jadwal dalam satu bulan kalender berjalan. Jadwal dapat diperbarui kembali selama jam sesi tidak saling bertabrakan."
              />
              {scheduleLoading ? (
                <LoadingState label="Memuat jadwal..." compact />
              ) : (
                <ScheduleUploadEditor scheduleSlots={scheduleData?.scheduleSlots ?? []} bookings={bookings} />
              )}
            </TabsContent>
          )}

          <TabsContent value="konseling" className="space-y-4">
            <SectionTitle icon={<CalendarDays className="w-5 h-5" />} title="Klien Terjadwal" description="Kelola jadwal, link meeting, dan laporan setelah sesi konseling." />
            <div className={isAdminMode ? "grid gap-3 lg:grid-cols-2" : undefined}>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  value={bookingSearch}
                  onChange={(event) => setBookingSearch(event.target.value)}
                  placeholder="Cari nama klien, psikolog, atau status"
                  className="pl-9"
                />
              </div>
              {isAdminMode && (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-1">
                  <CalendarDays className="h-4 w-4 shrink-0 text-neutral-400" />
                  <Input
                    type="date"
                    aria-label="Tanggal konseling mulai"
                    value={bookingStartDate}
                    max={bookingEndDate || undefined}
                    onChange={(event) => setBookingStartDate(event.target.value)}
                    className="h-8 min-w-[135px] flex-1 border-0 px-0 shadow-none focus-visible:ring-0"
                  />
                  <span className="text-xs text-neutral-500">s.d.</span>
                  <Input
                    type="date"
                    aria-label="Tanggal konseling akhir"
                    value={bookingEndDate}
                    min={bookingStartDate || undefined}
                    onChange={(event) => setBookingEndDate(event.target.value)}
                    className="h-8 min-w-[135px] flex-1 border-0 px-0 shadow-none focus-visible:ring-0"
                  />
                </div>
              )}
            </div>
            {isLoading ? (
              <LoadingState label="Memuat booking..." compact />
            ) : filteredBookings.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-neutral-500">
                  {bookingSearch.trim() ? "Tidak ada booking yang cocok." : "Belum ada booking untuk akun psikolog ini."}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredBookings.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    canEditClientSchedule={isAdminMode}
                    canEditMeetingLink={user?.role === "admin"}
                    canEditReports={canEditReports}
                    canEditClientReport={user?.role === "admin"}
                    onSaved={() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/psychologist/bookings"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/psychologist/reports"] });
                      toast({ title: "Data disimpan", description: "Data booking berhasil diperbarui." });
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {isAdminMode && (
            <TabsContent value="jadwal-psikolog" className="space-y-4">
              <SectionTitle
                icon={<Clock className="w-5 h-5" />}
                title="Perubahan Jadwal Psikolog"
                description={isCsoRole ? "CSO dapat melihat kalender jadwal psikolog bulan berjalan. Perubahan jadwal psikolog hanya dapat dilakukan admin." : "Admin dapat mengubah jadwal psikolog dalam satu bulan kalender berjalan."}
              />
              <Card>
                <CardContent className="p-5">
                  <Label>Pilih psikolog</Label>
                  <select
                    value={selectedAdminPsychologist}
                    onChange={(event) => setSelectedAdminPsychologist(event.target.value)}
                    className="mt-2 h-10 w-full max-w-xl rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {psychologistNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </CardContent>
              </Card>
              {scheduleLoading ? (
                <LoadingState label="Memuat jadwal psikolog..." compact />
              ) : (
                <ScheduleUploadEditor
                  scheduleSlots={scheduleData?.scheduleSlots ?? []}
                  bookings={bookings.filter((booking) => booking.psychologistName === selectedAdminPsychologist)}
                  isAdmin
                  psychologistName={selectedAdminPsychologist}
                  readOnly={!canManagePsychologistSchedules}
                />
              )}
            </TabsContent>
          )}

          <TabsContent value="laporan" className="space-y-6">
            <SectionTitle icon={<FileText className="w-5 h-5" />} title="Laporan" description="Seluruh psikolog dapat mencari laporan berdasarkan nama klien." />
            <div className="relative max-w-xl">
              <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
              <Input
                value={reportSearch}
                onChange={(event) => setReportSearch(event.target.value)}
                placeholder="Cari nama klien, psikolog, atau tanggal DD/MM/YYYY; range 01/07/2026-13/07/2026"
                className="pl-9"
              />
            </div>
            {reportsLoading ? (
              <LoadingState label="Memuat laporan..." compact />
            ) : (
              <div className="grid lg:grid-cols-2 gap-6">
                <ReportList
                  title="Laporan untuk Klien"
                  icon={<ClipboardCheck className="w-5 h-5 text-green-700" />}
                  reports={reports.filter((booking) => Boolean(booking.reportSubmittedAt && getClientReportText(booking)))}
                  mode="client"
                />
                <ReportList
                  title="Riwayat Konseling"
                  icon={<History className="w-5 h-5 text-green-700" />}
                  reports={reports.filter((booking) => Boolean(getHistoryReportText(booking)))}
                  mode="history"
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-neutral-500">{label}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function matchesBookingSearch(booking: Booking, query: string) {
  const dateRange = parseDateSearch(query);
  if (dateRange) {
    return isDateInSearchRange(booking.preferredDate, dateRange) ||
      isDateInSearchRange(booking.createdAt, dateRange) ||
      isDateInSearchRange(booking.paidAt, dateRange) ||
      isDateInSearchRange(booking.order.paidAt, dateRange);
  }

  const haystack = [
    String(booking.id),
    booking.clientName,
    booking.email,
    booking.whatsappNumber,
    booking.psychologistName,
    booking.preferredDate,
    formatDisplayDate(booking.preferredDate),
    booking.preferredTime,
    booking.status,
    booking.order.status,
    booking.order.paymentStatus,
    booking.location,
    locationLabels[booking.location ?? ""],
    booking.service.name,
    booking.consultationType ? consultationLabels[booking.consultationType] : "",
    booking.childName,
    booking.previousDiagnosis,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function Info({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span>{text}</span>
    </div>
  );
}

function SectionTitle({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 text-green-800">{icon}</div>
      <div>
        <h2 className="text-xl font-bold text-neutral-900">{title}</h2>
        <p className="text-sm text-neutral-500 mt-1">{description}</p>
      </div>
    </div>
  );
}

type ScheduleDraftRow = {
  scheduleDate: string;
  sessions: ScheduleDraftSession[];
};

type ScheduleDraftSession = {
  key: string;
  persisted: boolean;
  enabled: boolean;
  startTime: string;
  endTime: string;
  colombo: boolean;
  bantul: boolean;
};

type DeletedScheduleSlot = {
  scheduleDate: string;
  timeSlot: string;
  location: "online";
  isAvailable: false;
};

function ScheduleUploadEditor({
  scheduleSlots,
  bookings,
  isAdmin = false,
  psychologistName,
  readOnly = false,
}: {
  scheduleSlots: ScheduleSlot[];
  bookings: Booking[];
  isAdmin?: boolean;
  psychologistName?: string;
  readOnly?: boolean;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState<ScheduleDraftRow[]>(() => buildScheduleRows(scheduleSlots));
  const [deletedSlots, setDeletedSlots] = useState<DeletedScheduleSlot[]>([]);
  const todayDate = formatDateInput(new Date());

  useEffect(() => {
    setRows(buildScheduleRows(scheduleSlots));
    setDeletedSlots([]);
  }, [scheduleSlots]);

  const calendarCells = useMemo(() => {
    const firstDayOffset = rows[0] ? getDayOfWeekFromDateString(rows[0].scheduleDate) : 0;
    const cells: Array<{ row: ScheduleDraftRow; rowIndex: number } | null> = [
      ...Array.from({ length: firstDayOffset }, () => null),
      ...rows.map((row, rowIndex) => ({ row, rowIndex })),
    ];
    const trailingDayCount = (7 - (cells.length % 7)) % 7;
    return [...cells, ...Array.from({ length: trailingDayCount }, () => null)];
  }, [rows]);
  const paidBookingsByDate = useMemo(() => groupPaidBookingsByDate(bookings), [bookings]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (readOnly) throw new Error("Akses hanya lihat. Perubahan jadwal psikolog hanya dapat dilakukan admin.");
      const activeSlots = rows.flatMap((row) =>
        row.sessions.flatMap((session) => {
          if (!session.enabled && !session.persisted) return [];
          const timeSlot = `${session.startTime.replace(":", ".")} - ${session.endTime.replace(":", ".")}`;
          const locations = [
            "online",
            ...(session.colombo ? ["colombo"] : []),
            ...(session.bantul ? ["bantul"] : []),
          ] as const;
          return locations.map((location) => ({
            scheduleDate: row.scheduleDate,
            timeSlot,
            location,
            isAvailable: session.enabled,
          }));
        }),
      );
      const activeSlotKeys = new Set(
        activeSlots
          .filter((slot) => slot.isAvailable)
          .map((slot) => `${slot.scheduleDate}|${slot.timeSlot}`),
      );
      const slots = activeSlots.concat(
        deletedSlots.filter((slot) => !activeSlotKeys.has(`${slot.scheduleDate}|${slot.timeSlot}`)),
      );
      const conflict = findScheduleDraftConflict(rows);
      if (conflict) {
        throw new Error(`Jadwal konflik pada ${formatDisplayDate(conflict.scheduleDate)}: ${conflict.previous} bertabrakan dengan ${conflict.current}.`);
      }
      const response = await apiRequest("PUT", "/api/psychologist/schedule-slots", {
        slots,
        ...(isAdmin && psychologistName ? { psychologistName } : {}),
      });
      return response.json();
    },
    onSuccess: (data: ScheduleResponse) => {
      setRows(buildScheduleRows(data.scheduleSlots));
      setDeletedSlots([]);
      queryClient.invalidateQueries({ queryKey: ["/api/psychologist/schedule-slots"] });
      toast({
        title: "Jadwal disimpan",
        description: isAdmin ? "Jadwal psikolog berhasil diperbarui." : "Jadwal bulan berjalan berhasil diperbarui.",
      });
    },
    onError: (error) => {
      toast({
        title: "Gagal menyimpan jadwal",
        description: error instanceof Error ? error.message : "Silakan coba lagi.",
        variant: "destructive",
      });
    },
  });

  const updateSession = (rowIndex: number, sessionKey: string, updates: Partial<ScheduleDraftSession>) => {
    setRows((current) => current.map((row, index) => {
      if (index !== rowIndex) return row;
      return {
        ...row,
        sessions: row.sessions.map((session) => session.key === sessionKey ? { ...session, ...updates } : session),
      };
    }));
  };

  const addSession = (rowIndex: number) => {
    setRows((current) => current.map((row, index) => {
      if (index !== rowIndex) return row;
      const lastSession = row.sessions[row.sessions.length - 1];
      return {
        ...row,
        sessions: [
          ...row.sessions,
          createDraftSession(
            row.scheduleDate,
            row.sessions.length,
            true,
            suggestNextStartTime(lastSession?.endTime ?? "08:00"),
            suggestEndTime(suggestNextStartTime(lastSession?.endTime ?? "08:00")),
          ),
        ],
      };
    }));
  };

  const removeSession = (rowIndex: number, sessionKey: string) => {
    const row = rows[rowIndex];
    const session = row?.sessions.find((item) => item.key === sessionKey);
    if (!row || !session) return;

    if (session.persisted) {
      const timeSlot = `${session.startTime.replace(":", ".")} - ${session.endTime.replace(":", ".")}`;
      setDeletedSlots((deleted) => [
        ...deleted.filter((slot) => !(slot.scheduleDate === row.scheduleDate && slot.timeSlot === timeSlot)),
        {
          scheduleDate: row.scheduleDate,
          timeSlot,
          location: "online",
          isAvailable: false,
        },
      ]);
    }

    setRows((current) => current.map((currentRow, index) => {
      if (index !== rowIndex) return currentRow;
      const sessions = currentRow.sessions.filter((item) => item.key !== sessionKey);
      return {
        ...currentRow,
        sessions: sessions.length ? sessions : [createDraftSession(currentRow.scheduleDate, 0, false)],
      };
    }));
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-5">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          Online selalu tersedia untuk slot yang diaktifkan. Centang cabang offline hanya jika psikolog bersedia hadir di lokasi tersebut.
        </div>
        {readOnly ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Mode lihat saja untuk CSO. CSO dapat mengubah jadwal klien pada kartu booking, tetapi tidak dapat mengubah jadwal psikolog.
          </div>
        ) : (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            Sesi dapat diedit dari hari ini sampai akhir bulan berjalan. Pastikan jam sesi tidak saling bertabrakan.
          </div>
        )}

        <div className="overflow-x-auto">
          <div className="min-w-[1260px]">
            <div className="rounded-t-lg border border-b-0 bg-white px-4 py-3">
              <p className="text-base font-semibold text-neutral-900">{formatCalendarMonthRange(rows)}</p>
              <p className="text-xs text-neutral-500">Kalender jadwal bulan berjalan</p>
            </div>
            <div className="grid grid-cols-7 rounded-t-lg border border-b-0 bg-neutral-50">
              {dayLabels.map((day) => (
                <div key={day} className="border-r p-3 text-center text-xs font-semibold uppercase text-neutral-500 last:border-r-0">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 border-l border-t">
              {calendarCells.map((cell, cellIndex) => {
                if (!cell) {
                  return <div key={`blank-${cellIndex}`} className="min-h-[220px] border-b border-r bg-neutral-50/60" />;
                }

                const paidBookingsForDate = paidBookingsByDate.get(cell.row.scheduleDate) ?? [];
                const isPastDate = cell.row.scheduleDate < todayDate;

                return (
                  <div key={cell.row.scheduleDate} className={`min-h-[220px] border-b border-r p-3 ${isPastDate ? "bg-neutral-100" : "bg-white"}`}>
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">{formatCalendarDayNumber(cell.row.scheduleDate)}</p>
                        <p className="text-xs text-neutral-500">{formatDisplayDate(cell.row.scheduleDate)}</p>
                        {paidBookingsForDate.length > 0 && (
                          <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                            {paidBookingsForDate.length} booked
                          </span>
                        )}
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={() => addSession(cell.rowIndex)} disabled={readOnly || isPastDate} className="h-8 px-2">
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {isPastDate ? (
                      <div className="rounded-md border border-neutral-200 bg-neutral-200/60 px-3 py-4 text-center text-xs font-medium text-neutral-500">
                        Tanggal telah lewat
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {cell.row.sessions.map((session) => {
                          const bookedSessions = findBookingsForSession(paidBookingsForDate, session);

                          return (
                        <div key={session.key} className={`rounded-md border p-3 ${bookedSessions.length > 0 ? "border-emerald-300 bg-emerald-50" : session.enabled ? "border-green-200 bg-green-50/50" : "border-neutral-200 bg-neutral-50"}`}>
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700">
                              <input
                                type="checkbox"
                                checked={session.enabled}
                                disabled={readOnly}
                                onChange={(event) => updateSession(cell.rowIndex, session.key, { enabled: event.target.checked })}
                                className="h-4 w-4 rounded border-gray-300 text-green-700 focus:ring-green-700"
                              />
                              Aktif
                            </label>
                            {bookedSessions.length > 0 && (
                              <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                Booked
                              </span>
                            )}
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={readOnly}
                              onClick={() => removeSession(cell.rowIndex, session.key)}
                              aria-label="Hapus sesi"
                              className="h-7 w-7"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <label className="min-w-0 text-[11px] font-medium text-neutral-500">
                              Mulai
                              <Input type="time" min="07:00" max="21:00" value={session.startTime} disabled={readOnly || !session.enabled} onChange={(event) => updateSession(cell.rowIndex, session.key, { startTime: event.target.value })} className="mt-1 h-8 w-full min-w-0 px-2 text-xs" />
                            </label>
                            <label className="min-w-0 text-[11px] font-medium text-neutral-500">
                              Selesai
                              <Input type="time" min="07:00" max="21:00" value={session.endTime} disabled={readOnly || !session.enabled} onChange={(event) => updateSession(cell.rowIndex, session.key, { endTime: event.target.value })} className="mt-1 h-8 w-full min-w-0 px-2 text-xs" />
                            </label>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-700">
                            <span className="font-medium text-green-700">Online</span>
                            <label className="inline-flex items-center gap-1.5">
                              <input type="checkbox" checked={session.colombo} disabled={readOnly || !session.enabled} onChange={(event) => updateSession(cell.rowIndex, session.key, { colombo: event.target.checked })} />
                              Colombo
                            </label>
                            <label className="inline-flex items-center gap-1.5">
                              <input type="checkbox" checked={session.bantul} disabled={readOnly || !session.enabled} onChange={(event) => updateSession(cell.rowIndex, session.key, { bantul: event.target.checked })} />
                              Bantul
                            </label>
                          </div>
                          {bookedSessions.length > 0 && (
                            <div className="mt-2 rounded border border-emerald-200 bg-white/80 px-2 py-1.5 text-[11px] leading-relaxed text-emerald-900">
                              {bookedSessions.map((booking) => booking.clientName).join(", ")}
                            </div>
                          )}
                        </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {!readOnly && (
          <div className="flex justify-end">
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="bg-green-700 hover:bg-green-800">
              <Save className="w-4 h-4 mr-2" />
              {mutation.isPending ? "Menyimpan..." : isAdmin ? "Simpan Jadwal Psikolog" : "Simpan Jadwal"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function buildScheduleRows(scheduleSlots: ScheduleSlot[]): ScheduleDraftRow[] {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(firstDayOfMonth);
    date.setDate(index + 1);
    const scheduleDate = formatDateInput(date);
    const slotsForDate = scheduleSlots.filter((slot) => slot.scheduleDate === scheduleDate && slot.isAvailable);
    const slotsByTime = new Map<string, ScheduleSlot[]>();
    slotsForDate.forEach((slot) => {
      const slots = slotsByTime.get(slot.timeSlot) ?? [];
      slots.push(slot);
      slotsByTime.set(slot.timeSlot, slots);
    });
    const sessions = Array.from(slotsByTime.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([timeSlot, slots], sessionIndex) => {
        const [startTime, endTime] = timeSlot.replace(/\./g, ":").split(" - ");
        const onlineSlot = slots.find((slot) => slot.location === "online");
        const enabled = onlineSlot ? onlineSlot.isAvailable : slots.some((slot) => slot.isAvailable);
        return createDraftSession(
          scheduleDate,
          sessionIndex,
          enabled,
          startTime || "08:00",
          endTime || "10:00",
          slots.some((slot) => slot.location === "colombo" && slot.isAvailable),
          slots.some((slot) => slot.location === "bantul" && slot.isAvailable),
          true,
        );
      });
    return {
      scheduleDate,
      sessions: sessions.length ? sessions : [createDraftSession(scheduleDate, 0, false)],
    };
  });
}

function createDraftSession(
  scheduleDate: string,
  index: number,
  enabled = false,
  startTime = "08:00",
  endTime = "10:00",
  colombo = false,
  bantul = false,
  persisted = false,
): ScheduleDraftSession {
  return {
    key: `${scheduleDate}-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    persisted,
    enabled,
    startTime,
    endTime,
    colombo,
    bantul,
  };
}

function suggestEndTime(startTime: string) {
  const [hour = "8", minute = "0"] = startTime.split(":");
  const endHour = Math.min(Math.max(Number(hour) + 2, 8), 21);
  return `${String(endHour).padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function suggestNextStartTime(value: string) {
  const [hour = "8", minute = "0"] = value.split(":");
  const startHour = Math.min(Number(hour), 19);
  return `${String(startHour).padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDayOfWeekFromDateString(value: string) {
  return parseLocalDate(value).getDay();
}

function formatCalendarDayNumber(value: string) {
  const day = value.split("-")[2];
  return day ? String(Number(day)) : value;
}

function formatCalendarMonthRange(rows: ScheduleDraftRow[]) {
  if (rows.length === 0) return "Kalender jadwal";
  const firstRow = rows[0];
  if (!firstRow) return "Kalender jadwal";
  const start = parseLocalDate(firstRow.scheduleDate);
  const end = parseLocalDate(rows[rows.length - 1]?.scheduleDate ?? firstRow.scheduleDate);
  const formatter = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" });
  const startLabel = formatter.format(start);
  const endLabel = formatter.format(end);
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function groupPaidBookingsByDate(bookings: Booking[]) {
  return bookings.reduce((groups, booking) => {
    if (!isPaidBooking(booking)) return groups;
    const dateBookings = groups.get(booking.preferredDate) ?? [];
    dateBookings.push(booking);
    groups.set(booking.preferredDate, dateBookings);
    return groups;
  }, new Map<string, Booking[]>());
}

function isPaidBooking(booking: Booking) {
  return booking.status === "paid" || booking.order.paymentStatus === "paid" || booking.order.status === "completed";
}

function findBookingsForSession(bookings: Booking[], session: ScheduleDraftSession) {
  const sessionStart = timeInputToMinutes(session.startTime);
  const sessionEnd = timeInputToMinutes(session.endTime);

  return bookings.filter((booking) => {
    const [bookingStart, bookingEnd] = parseTimeRange(booking.preferredTime);
    const bookingStartMinutes = timeInputToMinutes(bookingStart);
    const bookingEndMinutes = timeInputToMinutes(bookingEnd);
    return sessionStart < bookingEndMinutes && bookingStartMinutes < sessionEnd;
  });
}

function timeInputToMinutes(value: string) {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

function findScheduleDraftConflict(rows: ScheduleDraftRow[]) {
  for (const row of rows) {
    const activeSessions = row.sessions
      .filter((session) => session.enabled)
      .map((session) => ({
        label: `${session.startTime.replace(":", ".")} - ${session.endTime.replace(":", ".")}`,
        startMinutes: timeInputToMinutes(session.startTime),
        endMinutes: timeInputToMinutes(session.endTime),
      }))
      .sort((a, b) => a.startMinutes - b.startMinutes);

    for (let index = 1; index < activeSessions.length; index += 1) {
      const previous = activeSessions[index - 1];
      const current = activeSessions[index];
      if (!previous || !current) continue;
      if (current.startMinutes < previous.endMinutes) {
        return { scheduleDate: row.scheduleDate, previous: previous.label, current: current.label };
      }
    }
  }

  return null;
}

function parseTimeRange(value?: string | null) {
  const [start, end] = (value || "08.00 - 10.00").replace(/\./g, ":").split(" - ");
  return [start || "08:00", end || "10:00"];
}

function AvailabilityEditor({ availability }: { availability: AvailabilitySlot[] }) {
  const { toast } = useToast();
  const [slots, setSlots] = useState(() => buildAvailabilityState(availability));

  useEffect(() => {
    setSlots(buildAvailabilityState(availability));
  }, [availability]);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", "/api/psychologist/availability", {
        availability: flattenAvailability(slots),
      });
      return response.json();
    },
    onSuccess: (data: AvailabilityResponse) => {
      setSlots(buildAvailabilityState(data.availability));
      queryClient.invalidateQueries({ queryKey: ["/api/psychologist/availability"] });
      toast({ title: "Ketersediaan disimpan", description: "Pilihan hari dan jam booking sudah diperbarui." });
    },
    onError: (error) => {
      toast({
        title: "Gagal menyimpan",
        description: error instanceof Error ? error.message : "Silakan coba lagi.",
        variant: "destructive",
      });
    },
  });

  const toggleSlot = (dayOfWeek: number, timeSlot: string) => {
    setSlots((current) => ({
      ...current,
      [dayOfWeek]: {
        ...current[dayOfWeek],
        [timeSlot]: !current[dayOfWeek]?.[timeSlot],
      },
    }));
  };

  const setDayAvailability = (dayOfWeek: number, isAvailable: boolean) => {
    setSlots((current) => ({
      ...current,
      [dayOfWeek]: Object.fromEntries(timeSlots.map((slot) => [slot, isAvailable])) as Record<string, boolean>,
    }));
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-5">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          Centang jam yang tersedia. Klien tidak dapat memilih slot yang tidak dicentang.
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="text-left text-sm font-semibold text-neutral-600 p-3">Hari</th>
                {timeSlots.map((slot) => (
                  <th key={slot} className="text-left text-sm font-semibold text-neutral-600 p-3">
                    {slot}
                  </th>
                ))}
                <th className="text-left text-sm font-semibold text-neutral-600 p-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {dayLabels.map((day, dayOfWeek) => (
                <tr key={day} className="border-t">
                  <td className="p-3 font-medium text-neutral-900">{day}</td>
                  {timeSlots.map((slot) => {
                    const checked = slots[dayOfWeek]?.[slot] ?? true;
                    return (
                      <td key={slot} className="p-3">
                        <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSlot(dayOfWeek, slot)}
                            className="h-4 w-4 rounded border-gray-300 text-green-700 focus:ring-green-700"
                          />
                          Tersedia
                        </label>
                      </td>
                    );
                  })}
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => setDayAvailability(dayOfWeek, true)}>
                        Semua
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setDayAvailability(dayOfWeek, false)}>
                        Libur
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="bg-green-700 hover:bg-green-800">
            <Save className="w-4 h-4 mr-2" />
            {mutation.isPending ? "Menyimpan..." : "Simpan Ketersediaan"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function buildAvailabilityState(availability: AvailabilitySlot[]) {
  const state: Record<number, Record<string, boolean>> = {};
  dayLabels.forEach((_, dayOfWeek) => {
    state[dayOfWeek] = Object.fromEntries(timeSlots.map((slot) => [slot, true])) as Record<string, boolean>;
  });
  availability.forEach((slot) => {
    if (!state[slot.dayOfWeek]) return;
    state[slot.dayOfWeek][slot.timeSlot] = slot.isAvailable;
  });
  return state;
}

function flattenAvailability(slots: Record<number, Record<string, boolean>>) {
  return dayLabels.flatMap((_, dayOfWeek) =>
    timeSlots.map((timeSlot) => ({
      dayOfWeek,
      timeSlot,
      isAvailable: slots[dayOfWeek]?.[timeSlot] ?? true,
    })),
  );
}

function BookingCard({
  booking,
  canEditClientSchedule,
  canEditMeetingLink,
  canEditReports,
  canEditClientReport,
  onSaved,
}: {
  booking: Booking;
  canEditClientSchedule: boolean;
  canEditMeetingLink: boolean;
  canEditReports: boolean;
  canEditClientReport: boolean;
  onSaved: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-green-100 flex items-center justify-center">
                <UserRound className="w-5 h-5 text-green-800" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">{booking.clientName}</h2>
                <p className="text-sm text-neutral-500">
                  {booking.consultationType ? consultationLabels[booking.consultationType] : "-"}
                </p>
                <p className="text-sm font-medium text-green-800 mt-1">
                  Psikolog: {booking.psychologistName || "-"}
                </p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 text-sm text-neutral-600">
              <Info icon={<CalendarDays className="w-4 h-4" />} text={`${formatDisplayDate(booking.preferredDate)}, ${booking.preferredTime}`} />
              <Info icon={<MapPin className="w-4 h-4" />} text={locationLabels[booking.location ?? ""] ?? "-"} />
              <Info icon={<Mail className="w-4 h-4" />} text={booking.email} />
              <Info icon={<Phone className="w-4 h-4" />} text={booking.whatsappNumber} />
            </div>
          </div>
          <div className="flex lg:flex-col gap-2 lg:items-end">
            <Badge variant={booking.status === "paid" ? "default" : "secondary"}>
              {booking.status === "paid" ? "Sudah bayar" : "Menunggu bayar"}
            </Badge>
            <span className="text-sm text-neutral-500">{booking.service.name}</span>
            {(booking.status === "paid" || booking.order.paymentStatus === "paid" || booking.order.status === "completed") && (
              <Button size="sm" variant="outline" onClick={() => printBookingReceipt(booking)}>
                <Printer className="w-4 h-4 mr-2" />
                Cetak Resi
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 grid md:grid-cols-2 gap-4">
          <BookingDataDialogActions booking={booking} />
          {booking.location === "online" && (
            <Detail
              label="Link meeting online"
              value={booking.meetingUrl ? (
                <a href={booking.meetingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-green-700 hover:underline">
                  Buka ruang meeting
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : "-"}
            />
          )}
        </div>

        {canEditMeetingLink && booking.location === "online" && <MeetingLinkEditor booking={booking} onSaved={onSaved} />}
        {canEditClientSchedule && <ScheduleEditor booking={booking} onSaved={onSaved} />}
        <ReportEditor booking={booking} canEditReports={canEditReports} canEditClientReport={canEditClientReport} onSaved={onSaved} />
      </CardContent>
    </Card>
  );
}

function BookingDataDialogActions({ booking }: { booking: Booking }) {
  const personalData = formatBookingPersonalData(booking);
  const consentData = extractInformedConsentText(booking.concernHistory);

  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs uppercase text-neutral-400">Data formulir</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <UserRound className="w-4 h-4 mr-2" />
              Detail Data Diri
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[82vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detail Data Diri</DialogTitle>
              <DialogDescription>
                Data Form B untuk gambaran awal psikolog.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-800 whitespace-pre-wrap">
              {renderDetailValue(personalData)}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <FileText className="w-4 h-4 mr-2" />
              Informed Consent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[82vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Informed Consent</DialogTitle>
              <DialogDescription>
                Pernyataan persetujuan dan tanda tangan klien.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-800 whitespace-pre-wrap">
              {renderDetailValue(consentData)}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function formatBookingPersonalData(booking: Booking) {
  return [
    "Identitas Klien",
    `Nama klien: ${booking.clientName || "-"}`,
    `Tanggal lahir: ${booking.birthDate ? formatDisplayDate(booking.birthDate) : "-"}`,
    `Usia: ${booking.age !== null && booking.age !== undefined ? `${booking.age} tahun` : "-"}`,
    `Jenis kelamin: ${booking.gender === "male" ? "Laki-laki" : booking.gender === "female" ? "Perempuan" : "-"}`,
    `Email: ${booking.email || "-"}`,
    `No WA: ${booking.whatsappNumber || "-"}`,
    `Jenis konsultasi: ${booking.consultationType ? consultationLabels[booking.consultationType] : "-"}`,
    `Nama anak/remaja: ${booking.childName || "-"}`,
    `Diagnosa sebelumnya: ${booking.previousDiagnosis || "-"}`,
    "",
    "Data Konseling",
    `Nama psikolog: ${booking.psychologistName || "-"}`,
    `Jadwal: ${formatDisplayDate(booking.preferredDate)}, ${booking.preferredTime}`,
    `Lokasi: ${locationLabels[booking.location ?? ""] ?? "-"}`,
    `Keluhan saat ini/awal: ${booking.mainConcern || "-"}`,
    "",
    extractPersonalFormText(booking.concernHistory),
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

function extractPersonalFormText(value?: string | null) {
  if (!value) return "Detail Form B belum tersedia.";
  const [personalData] = value.split(/\n\s*\nInformed Consent Form/);
  return personalData?.trim() || "Detail Form B belum tersedia.";
}

function extractInformedConsentText(value?: string | null) {
  if (!value) return "Informed Consent belum tersedia.";
  const match = value.match(/Informed Consent Form[\s\S]*$/);
  return match?.[0]?.trim() || "Informed Consent belum tersedia.";
}

function MeetingLinkEditor({ booking, onSaved }: { booking: Booking; onSaved: () => void }) {
  const { toast } = useToast();
  const [meetingUrl, setMeetingUrl] = useState(booking.meetingUrl ?? "");

  useEffect(() => {
    setMeetingUrl(booking.meetingUrl ?? "");
  }, [booking.meetingUrl]);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/psychologist/bookings/${booking.id}/meeting-link`, {
        meetingUrl,
      });
      return response.json();
    },
    onSuccess: () => {
      onSaved();
    },
    onError: (error) => {
      toast({
        title: "Gagal menyimpan link meeting",
        description: error instanceof Error ? error.message : "Silakan cek link dan coba lagi.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="mt-5 rounded-lg border bg-white p-4 space-y-4">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <Video className="w-4 h-4 text-green-700" />
          Link Meeting Online
        </h3>
        <p className="text-xs text-neutral-500 mt-1">
          Simpan link meeting untuk konseling online. Setelah disimpan, link otomatis muncul di dashboard klien dan psikolog.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <Label>Link meeting</Label>
          <Input
            type="url"
            value={meetingUrl}
            onChange={(event) => setMeetingUrl(event.target.value)}
            placeholder="https://meet.google.com/... atau link Zoom"
            className="mt-2"
          />
        </div>
        <Button variant="outline" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          <Save className="w-4 h-4 mr-2" />
          {mutation.isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>
    </div>
  );
}

function ScheduleEditor({ booking, onSaved }: { booking: Booking; onSaved: () => void }) {
  const { toast } = useToast();
  const [initialStart, initialEnd] = parseTimeRange(booking.preferredTime);
  const [preferredDate, setPreferredDate] = useState(booking.preferredDate);
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(initialEnd);
  const [location, setLocation] = useState(booking.location ?? "online");
  const today = new Date().toISOString().slice(0, 10);
  const maxDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/psychologist/bookings/${booking.id}/schedule`, {
        preferredDate,
        preferredTime: `${startTime.replace(":", ".")} - ${endTime.replace(":", ".")}`,
        location,
      });
      return response.json();
    },
    onSuccess: (data) => {
      onSaved();
      if (data?.waSchedulePlaceholder) {
        toast({
          title: "Placeholder WA dibuat",
          description: "Notifikasi WA klien belum dikirim sampai WhatsApp Business API aktif.",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Gagal menyimpan jadwal",
        description: error instanceof Error ? error.message : "Silakan coba lagi.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="mt-5 rounded-lg border bg-white p-4 space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-green-700" />
        Perubahan Jadwal Klien
      </h3>
      <p className="text-xs text-neutral-500">
        Hanya admin/CSO yang berkomunikasi langsung dengan klien dapat mengubah jadwal ini. Placeholder notifikasi WA akan dibuat saat jadwal disimpan.
      </p>
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <Label>Tanggal</Label>
          <Input type="date" min={today} max={maxDate} value={preferredDate} onChange={(event) => setPreferredDate(event.target.value)} className="mt-2" />
        </div>
        <div>
          <Label>Waktu</Label>
          <div className="mt-2 flex items-center gap-2">
            <Input type="time" min="07:00" max="21:00" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            <span className="text-neutral-400">-</span>
            <Input type="time" min="07:00" max="21:00" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
          </div>
        </div>
        <div>
          <Label>Lokasi</Label>
          <select value={location} onChange={(event) => setLocation(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="online">Online</option>
            <option value="colombo">Offline Colombo</option>
            <option value="bantul">Offline Bantul</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          <Save className="w-4 h-4 mr-2" />
          {mutation.isPending ? "Menyimpan..." : "Simpan Jadwal"}
        </Button>
      </div>
    </div>
  );
}

type ReportMutationPayload = {
  clientReportNotes?: string;
  reportRecommendations?: string;
  counselingHistoryNotes?: string;
  counselingSubjectiveNotes?: string;
  counselingObservations?: string[];
  counselingResultNotes?: string;
  counselingPlanNotes?: string;
  sessionReport?: string;
  submitClientReport?: boolean;
  submitHistoryReport?: boolean;
};

const reportObservationOptions = [
  { value: "clean_appearance", label: "Penampilan bersih, rapi dan terawat" },
  { value: "notable_physical_signs", label: "Terdapat tanda fisik yang mencolok (tato/bekas luka, tremor, penggunaan alat bantu)" },
  { value: "maintains_eye_contact", label: "Mampu menjaga kontak mata" },
  { value: "repetitive_movements", label: "Adanya gerakan berulang (tic, menggigit kuku, mengetuk-ngetuk jari)" },
  { value: "cooperative", label: "Kooperatif, mampu merespon dan mengikuti instruksi" },
  { value: "emotional_problem", label: "Terdapat masalah emosi" },
  { value: "communication_barrier", label: "Ada hambatan komunikasi" },
  { value: "perception_thought_problem", label: "Ada masalah persepsi dan proses berpikir" },
] as const;

function ReportEditor({
  booking,
  canEditReports,
  canEditClientReport,
  onSaved,
}: {
  booking: Booking;
  canEditReports: boolean;
  canEditClientReport: boolean;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [reportRecommendations, setReportRecommendations] = useState(booking.reportRecommendations ?? "");
  const [clientReportNotes, setClientReportNotes] = useState(booking.clientReportNotes ?? booking.reportRecommendations ?? "");
  const [counselingSubjectiveNotes, setCounselingSubjectiveNotes] = useState(booking.counselingSubjectiveNotes ?? booking.mainConcern ?? "");
  const [counselingObservations, setCounselingObservations] = useState<string[]>(booking.counselingObservations ?? []);
  const [counselingResultNotes, setCounselingResultNotes] = useState(booking.counselingResultNotes ?? booking.counselingHistoryNotes ?? booking.sessionReport ?? "");
  const [counselingPlanNotes, setCounselingPlanNotes] = useState(booking.counselingPlanNotes ?? "");
  const [activeReportSection, setActiveReportSection] = useState<"client" | "history" | null>(null);
  const clientReportLocked = !canEditReports || Boolean(booking.reportSubmittedAt && !canEditClientReport);
  const hasSavedReport = Boolean(
    booking.clientReportNotes ||
    booking.reportRecommendations ||
    booking.counselingHistoryNotes ||
    booking.sessionReport ||
    booking.counselingSubjectiveNotes ||
    booking.counselingResultNotes ||
    booking.counselingPlanNotes,
  );

  useEffect(() => {
    setReportRecommendations(booking.reportRecommendations ?? "");
    setClientReportNotes(booking.clientReportNotes ?? booking.reportRecommendations ?? "");
    setCounselingSubjectiveNotes(booking.counselingSubjectiveNotes ?? booking.mainConcern ?? "");
    setCounselingObservations(booking.counselingObservations ?? []);
    setCounselingResultNotes(booking.counselingResultNotes ?? booking.counselingHistoryNotes ?? booking.sessionReport ?? "");
    setCounselingPlanNotes(booking.counselingPlanNotes ?? "");
  }, [booking]);

  const mutation = useMutation({
    mutationFn: async (payload: ReportMutationPayload) => {
      const response = await apiRequest("PATCH", `/api/psychologist/bookings/${booking.id}/report`, payload);
      return response.json();
    },
    onSuccess: onSaved,
    onError: (error) => {
      toast({
        title: error instanceof Error ? error.message : "Gagal menyimpan laporan",
        variant: "destructive",
      });
    },
  });

  const saveClientDraft = () => {
    if (!canEditReports) return;
    mutation.mutate({ clientReportNotes, reportRecommendations });
  };

  const finishClientReport = () => {
    if (!canEditReports) return;
    if (!clientReportNotes.trim()) {
      toast({ title: "Laporan untuk klien wajib diisi.", variant: "destructive" });
      return;
    }
    mutation.mutate({ clientReportNotes, reportRecommendations, submitClientReport: true });
  };

  const finishHistoryReport = () => {
    if (!canEditReports) return;
    if (!counselingSubjectiveNotes.trim() || !counselingResultNotes.trim() || !counselingPlanNotes.trim()) {
      toast({ title: "Keluhan/riwayat subjektif, hasil konseling, dan rencana penatalaksanaan wajib diisi.", variant: "destructive" });
      return;
    }
    mutation.mutate({
      sessionReport: counselingResultNotes,
      counselingHistoryNotes: counselingResultNotes,
      counselingSubjectiveNotes,
      counselingObservations,
      counselingResultNotes,
      counselingPlanNotes,
      submitHistoryReport: true,
    });
  };

  return (
    <div className="mt-5 rounded-lg border bg-white p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-green-700" />
            Laporan Hasil Konseling
          </h3>
          <p className="text-xs text-neutral-500 mt-1">
            {!canEditReports
              ? "Mode lihat saja untuk CSO"
              : booking.reportSubmittedAt
              ? `Laporan klien dikirim ${formatDisplayDateTime(booking.reportSubmittedAt)}`
              : hasSavedReport
                ? "Draft atau riwayat tersimpan"
                : "Belum ada laporan"}
          </p>
        </div>
        <Badge variant={hasSavedReport ? "default" : "secondary"}>
          {hasSavedReport ? "Tersimpan" : "Draft"}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          variant={activeReportSection === "client" ? "default" : "outline"}
          onClick={() => setActiveReportSection((current) => current === "client" ? null : "client")}
          className={activeReportSection === "client" ? "bg-amber-500 text-white hover:bg-amber-600" : "border-amber-300 text-amber-700 hover:bg-amber-50"}
        >
          <ClipboardCheck className="mr-2 h-4 w-4" />
          Laporan untuk Klien
        </Button>
        <Button
          type="button"
          variant={activeReportSection === "history" ? "default" : "outline"}
          onClick={() => setActiveReportSection((current) => current === "history" ? null : "history")}
          className={activeReportSection === "history" ? "bg-sky-500 text-white hover:bg-sky-600" : "border-sky-300 text-sky-700 hover:bg-sky-50"}
        >
          <History className="mr-2 h-4 w-4" />
          Riwayat Konseling
        </Button>
      </div>

      {activeReportSection === "client" && (
      <div className="rounded-lg border border-amber-100 bg-amber-50/30 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Label>Laporan untuk Klien: Catatan Hasil Konseling / PR <span className="text-neutral-400">(opsional)</span></Label>
          <ViewReportPdfButton booking={booking} mode="client" />
        </div>
        <Textarea
          value={clientReportNotes}
          onChange={(event) => setClientReportNotes(event.target.value)}
          placeholder="Isi catatan hasil konseling atau PR yang akan dikirim ke dashboard klien."
          rows={4}
          disabled={clientReportLocked}
          className="mt-2"
        />
        <div className="mt-3">
          <Label>Rekomendasi <span className="text-neutral-400">(opsional)</span></Label>
          <Textarea
            value={reportRecommendations}
            onChange={(event) => setReportRecommendations(event.target.value)}
            placeholder="Isi rekomendasi untuk klien bila diperlukan."
            rows={3}
            disabled={clientReportLocked}
            className="mt-2"
          />
        </div>
        {clientReportLocked && (
          <p className="text-xs text-amber-700 mt-2">
            {!canEditReports ? "CSO hanya dapat melihat laporan." : "Laporan untuk klien sudah selesai. Edit lanjutan hanya dapat dilakukan admin super."}
          </p>
        )}
        {canEditReports && (
          <div className="flex flex-wrap justify-end gap-2 mt-3">
            <Button variant="outline" onClick={saveClientDraft} disabled={mutation.isPending || clientReportLocked}>
              <Save className="w-4 h-4 mr-2" />
              {mutation.isPending ? "Menyimpan..." : "Simpan Draft Klien"}
            </Button>
            <Button onClick={finishClientReport} disabled={mutation.isPending || clientReportLocked} className="bg-green-700 hover:bg-green-800">
              <ClipboardCheck className="w-4 h-4 mr-2" />
              {mutation.isPending ? "Menyelesaikan..." : "Selesai Laporan Klien"}
            </Button>
          </div>
        )}
      </div>
      )}

      {activeReportSection === "history" && (
      <div className="rounded-lg border border-sky-100 bg-sky-50/30 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Label>Riwayat Konseling: Catatan internal psikolog <span className="text-red-600">*</span></Label>
          <ViewReportPdfButton booking={booking} mode="history" />
        </div>
        <div className="mt-3 space-y-4">
          <div>
            <Label>Keluhan & Riwayat Subjektif <span className="text-red-600">*</span></Label>
            <Textarea
              value={counselingSubjectiveNotes}
              onChange={(event) => setCounselingSubjectiveNotes(event.target.value)}
              placeholder="Keluhan yang dirasakan atau dialami oleh klien saat ini."
              rows={4}
              disabled={!canEditReports}
              className="mt-2"
            />
          </div>

          <div>
            <Label>Observasi</Label>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {reportObservationOptions.map((option) => (
                <label key={option.value} className="flex items-start gap-2 rounded-md border p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={counselingObservations.includes(option.value)}
                    onChange={(event) => setCounselingObservations((current) => event.target.checked
                      ? [...current, option.value]
                      : current.filter((value) => value !== option.value))}
                    disabled={!canEditReports}
                    className="mt-1"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Hasil Konseling <span className="text-red-600">*</span></Label>
            <Textarea
              value={counselingResultNotes}
              onChange={(event) => setCounselingResultNotes(event.target.value)}
              placeholder="Hasil anamnesa, riwayat kasus, serta gambaran diagnosa."
              rows={5}
              disabled={!canEditReports}
              className="mt-2"
            />
          </div>

          <div>
            <Label>Rencana Penatalaksanaan <span className="text-red-600">*</span></Label>
            <Textarea
              value={counselingPlanNotes}
              onChange={(event) => setCounselingPlanNotes(event.target.value)}
              placeholder="Tindakan saat sesi, tugas rumah, dan jadwal konseling berikutnya bila ada."
              rows={4}
              disabled={!canEditReports}
              className="mt-2"
            />
          </div>
        </div>
        {canEditReports && (
          <div className="flex flex-wrap justify-end gap-2 mt-3">
            <Button
              onClick={finishHistoryReport}
              disabled={mutation.isPending || !counselingSubjectiveNotes.trim() || !counselingResultNotes.trim() || !counselingPlanNotes.trim()}
              className="bg-green-700 hover:bg-green-800"
            >
              <ClipboardCheck className="w-4 h-4 mr-2" />
              {mutation.isPending ? "Menyimpan..." : "Selesai Riwayat Internal"}
            </Button>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function getClientReportText(booking: Booking) {
  return booking.clientReportNotes || booking.reportRecommendations || "";
}

function getHistoryReportText(booking: Booking) {
  return booking.counselingResultNotes || booking.counselingHistoryNotes || booking.sessionReport || "";
}

function ViewReportPdfButton({ booking, mode }: { booking: Booking; mode: "client" | "history" }) {
  const { toast } = useToast();
  const isAvailable = mode === "client"
    ? Boolean(booking.reportSubmittedAt && getClientReportText(booking))
    : Boolean(getHistoryReportText(booking));

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={!isAvailable}
      onClick={() => viewReportPdf(booking, mode).catch(() => toast({ title: "PDF belum tersedia", variant: "destructive" }))}
    >
      <Eye className="mr-2 h-4 w-4" />
      Lihat PDF
    </Button>
  );
}

async function fetchReportPdf(booking: Booking, mode: "client" | "history") {
  const token = getAuthToken();
  const endpoint = mode === "client" ? "client-report" : "history-report";
  const response = await fetch(`/api/bookings/${booking.id}/${endpoint}.pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) throw new Error("PDF belum tersedia");
  return response.blob();
}

async function viewReportPdf(booking: Booking, mode: "client" | "history") {
  const blob = await fetchReportPdf(booking, mode);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}


function ReportList({ title, icon, reports, mode }: { title: string; icon: ReactNode; reports: Booking[]; mode: "client" | "history" }) {
  const [expandedBookingId, setExpandedBookingId] = useState<number | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {reports.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-500">Belum ada data laporan.</p>
        ) : reports.map((booking) => (
          <div key={`${mode}-${booking.id}`} className="rounded-lg border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-semibold">{booking.clientName}</h3>
                <p className="text-xs text-neutral-500 mt-1">
                  {formatDisplayDate(booking.preferredDate)} · {booking.psychologistName || "-"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={expandedBookingId === booking.id ? "default" : "outline"}
                  onClick={() => setExpandedBookingId((current) => current === booking.id ? null : booking.id)}
                  className={mode === "client"
                    ? expandedBookingId === booking.id ? "bg-amber-500 hover:bg-amber-600" : "border-amber-300 text-amber-700 hover:bg-amber-50"
                    : expandedBookingId === booking.id ? "bg-sky-500 hover:bg-sky-600" : "border-sky-300 text-sky-700 hover:bg-sky-50"}
                >
                  {mode === "client" ? <ClipboardCheck className="mr-2 h-4 w-4" /> : <History className="mr-2 h-4 w-4" />}
                  {expandedBookingId === booking.id ? "Tutup" : title}
                </Button>
                <ViewReportPdfButton booking={booking} mode={mode} />
              </div>
            </div>
            {expandedBookingId === booking.id && <p className="mt-3 whitespace-pre-wrap rounded-md bg-neutral-50 p-3 text-sm text-neutral-700">
              {mode === "client" ? getClientReportText(booking) : getHistoryReportText(booking)}
            </p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value?: string | ReactNode | null }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs uppercase text-neutral-400">{label}</p>
      <div className="text-sm mt-2 whitespace-pre-wrap">{renderDetailValue(value)}</div>
    </div>
  );
}

function renderDetailValue(value?: string | ReactNode | null) {
  if (!value) return "-";
  if (typeof value !== "string") return value;

  const lines = value.split("\n");
  return lines.map((line, index) => {
    const match = line.match(/^Tanda tangan digital:\s*(data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+)$/);
    if (!match) {
      return (
        <span key={`${index}-${line}`}>
          {line}
          {index < lines.length - 1 ? "\n" : null}
        </span>
      );
    }

    return (
      <span key={`${index}-signature`} className="block whitespace-normal">
        <span className="block mb-2">Tanda tangan digital:</span>
        <img
          src={match[1]}
          alt="Tanda tangan digital klien"
          className="max-h-36 max-w-full rounded-md border bg-white object-contain p-2"
        />
        {index < lines.length - 1 ? "\n" : null}
      </span>
    );
  });
}

function LoadingState({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={compact ? "py-8 text-center text-neutral-500" : "min-h-screen flex items-center justify-center text-neutral-500"}>
      {label}
    </div>
  );
}
