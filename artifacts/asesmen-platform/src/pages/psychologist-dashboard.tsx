import { useMutation, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { useLocation } from "wouter";
import { CalendarDays, ClipboardCheck, Download, ExternalLink, FileText, History, LogOut, Mail, MapPin, Phone, Save, Search, UserRound, Video } from "lucide-react";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Booking = {
  id: number;
  clientName: string;
  birthDate: string | null;
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
  reportSubmittedAt: string | null;
  status: string;
  paidAt: string | null;
  createdAt: string | null;
  service: {
    name: string;
  };
  order: {
    paymentStatus: string | null;
    totalAmount: string;
  };
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

type DashboardMode = "psychologist" | "admin";

export function AdminPsychologistBookings() {
  return <PsychologistDashboard mode="admin" />;
}

export default function PsychologistDashboard({ mode = "psychologist" }: { mode?: DashboardMode }) {
  const { user, isLoading: authLoading, logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [reportSearch, setReportSearch] = useState("");
  const isAdminMode = mode === "admin";
  const requiredRole = isAdminMode ? "admin" : "psychologist";
  const loginRedirect = isAdminMode ? "/admin/bookings" : "/psychologist/dashboard";
  const hasAccess = !!user && user.role === requiredRole;

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

  if (authLoading) {
    return <LoadingState label="Memuat akun..." />;
  }

  if (!user) {
    setLocation(`/login?redirect=${loginRedirect}`);
    return <LoadingState label="Mengalihkan ke login..." />;
  }

  if (!isAdminMode && user.role === "admin") {
    setLocation("/admin/bookings");
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
              <Button onClick={() => setLocation(user.role === "admin" ? "/admin/dashboard" : "/dashboard")}>Kembali ke Dashboard</Button>
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

        <Tabs defaultValue="konseling" className="space-y-6">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="konseling">Konseling</TabsTrigger>
            <TabsTrigger value="laporan">Laporan</TabsTrigger>
          </TabsList>

          <TabsContent value="konseling" className="space-y-4">
            <SectionTitle icon={<CalendarDays className="w-5 h-5" />} title="Klien Terjadwal" description="Kelola jadwal, link meeting, dan laporan setelah sesi konseling." />
            {isLoading ? (
              <LoadingState label="Memuat booking..." compact />
            ) : bookings.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-neutral-500">Belum ada booking untuk akun psikolog ini.</CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    onSaved={() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/psychologist/bookings"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/psychologist/reports"] });
                      toast({ title: "Data disimpan", description: "Perubahan jadwal atau laporan berhasil diperbarui." });
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="laporan" className="space-y-6">
            <SectionTitle icon={<FileText className="w-5 h-5" />} title="Laporan" description="Seluruh psikolog dapat mencari laporan berdasarkan nama klien." />
            <div className="relative max-w-xl">
              <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
              <Input
                value={reportSearch}
                onChange={(event) => setReportSearch(event.target.value)}
                placeholder="Cari nama klien, email, atau psikolog"
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
                  reports={reports.filter((booking) => Boolean(getClientReportText(booking)))}
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

function BookingCard({ booking, onSaved }: { booking: Booking; onSaved: () => void }) {
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
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 text-sm text-neutral-600">
              <Info icon={<CalendarDays className="w-4 h-4" />} text={`${booking.preferredDate}, ${booking.preferredTime}`} />
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
          </div>
        </div>

        <div className="mt-5 grid md:grid-cols-2 gap-4">
          <Detail label="Keluhan umum" value={booking.mainConcern} />
          <Detail label="Riwayat keluhan" value={booking.concernHistory} />
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
          {booking.consultationType === "child" && (
            <>
              <Detail label="Nama anak/remaja" value={booking.childName} />
              <Detail label="Diagnosa sebelumnya" value={booking.previousDiagnosis} />
            </>
          )}
        </div>

        <ScheduleEditor booking={booking} onSaved={onSaved} />
        <ReportEditor booking={booking} onSaved={onSaved} />
      </CardContent>
    </Card>
  );
}

function ScheduleEditor({ booking, onSaved }: { booking: Booking; onSaved: () => void }) {
  const [preferredDate, setPreferredDate] = useState(booking.preferredDate);
  const [preferredTime, setPreferredTime] = useState(booking.preferredTime);
  const [location, setLocation] = useState(booking.location ?? "online");
  const [meetingUrl, setMeetingUrl] = useState(booking.meetingUrl ?? "");
  const today = new Date().toISOString().slice(0, 10);
  const maxDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/psychologist/bookings/${booking.id}/schedule`, {
        preferredDate,
        preferredTime,
        location,
        meetingUrl,
      });
      return response.json();
    },
    onSuccess: onSaved,
  });

  return (
    <div className="mt-5 rounded-lg border bg-white p-4 space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-green-700" />
        Perubahan Jadwal
      </h3>
      <div className="grid md:grid-cols-4 gap-3">
        <div>
          <Label>Tanggal</Label>
          <Input type="date" min={today} max={maxDate} value={preferredDate} onChange={(event) => setPreferredDate(event.target.value)} className="mt-2" />
        </div>
        <div>
          <Label>Waktu</Label>
          <select value={preferredTime} onChange={(event) => setPreferredTime(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="08.00 - 10.00">08.00 - 10.00</option>
            <option value="10.30 - 12.30">10.30 - 12.30</option>
            <option value="13.30 - 15.30">13.30 - 15.30</option>
          </select>
        </div>
        <div>
          <Label>Lokasi</Label>
          <select value={location} onChange={(event) => setLocation(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="online">Online</option>
            <option value="colombo">Offline Colombo</option>
            <option value="bantul">Offline Bantul</option>
          </select>
        </div>
        <div>
          <Label>Link meeting</Label>
          <Input type="url" value={meetingUrl} onChange={(event) => setMeetingUrl(event.target.value)} placeholder="https://meet.google.com/..." className="mt-2" />
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

function ReportEditor({ booking, onSaved }: { booking: Booking; onSaved: () => void }) {
  const [meetingUrl, setMeetingUrl] = useState(booking.meetingUrl ?? "");
  const [sessionReport, setSessionReport] = useState(booking.sessionReport ?? "");
  const [reportRecommendations, setReportRecommendations] = useState(booking.reportRecommendations ?? "");
  const [clientReportNotes, setClientReportNotes] = useState(booking.clientReportNotes ?? booking.reportRecommendations ?? "");
  const [counselingHistoryNotes, setCounselingHistoryNotes] = useState(booking.counselingHistoryNotes ?? booking.sessionReport ?? "");

  const mutation = useMutation({
    mutationFn: async (submit: boolean) => {
      const response = await apiRequest("PATCH", `/api/psychologist/bookings/${booking.id}/report`, {
        meetingUrl,
        sessionReport,
        reportRecommendations,
        clientReportNotes,
        counselingHistoryNotes,
        submit,
      });
      return response.json();
    },
    onSuccess: onSaved,
  });

  return (
    <div className="mt-5 rounded-lg border bg-white p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-green-700" />
            Laporan Hasil Konseling
          </h3>
          <p className="text-xs text-neutral-500 mt-1">
            {booking.reportSubmittedAt ? `Terakhir disimpan ${new Date(booking.reportSubmittedAt).toLocaleString("id-ID")}` : "Belum ada laporan"}
          </p>
        </div>
        <Badge variant={booking.reportSubmittedAt ? "default" : "secondary"}>
          {booking.reportSubmittedAt ? "Tersimpan" : "Draft"}
        </Badge>
      </div>

      {booking.location === "online" && (
        <div>
          <Label className="flex items-center gap-2">
            <Video className="w-4 h-4" />
            Link meeting online
          </Label>
          <Input
            type="url"
            value={meetingUrl}
            onChange={(event) => setMeetingUrl(event.target.value)}
            placeholder="https://meet.google.com/... atau link Zoom"
            className="mt-2"
          />
        </div>
      )}

      <div>
        <Label>Laporan untuk Klien: Catatan Hasil Konseling / PR</Label>
        <Textarea
          value={clientReportNotes}
          onChange={(event) => {
            setClientReportNotes(event.target.value);
            setReportRecommendations(event.target.value);
          }}
          placeholder="Isi catatan hasil konseling atau PR yang akan dikirim ke dashboard klien."
          rows={4}
          className="mt-2"
        />
      </div>

      <div>
        <Label>Riwayat Konseling: Catatan internal psikolog</Label>
        <Textarea
          value={counselingHistoryNotes}
          onChange={(event) => {
            setCounselingHistoryNotes(event.target.value);
            setSessionReport(event.target.value);
          }}
          placeholder="Isi catatan internal yang akan menjadi track record konseling klien."
          rows={4}
          className="mt-2"
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => mutation.mutate(false)} disabled={mutation.isPending}>
          <Save className="w-4 h-4 mr-2" />
          {mutation.isPending ? "Menyimpan..." : "Simpan Draft"}
        </Button>
        <Button onClick={() => mutation.mutate(true)} disabled={mutation.isPending || !clientReportNotes.trim()} className="bg-green-700 hover:bg-green-800">
          <ClipboardCheck className="w-4 h-4 mr-2" />
          {mutation.isPending ? "Mengirim..." : "Selesai & Kirim ke Klien"}
        </Button>
      </div>
    </div>
  );
}

function getClientReportText(booking: Booking) {
  return booking.clientReportNotes || booking.reportRecommendations || booking.sessionReport || "";
}

function getHistoryReportText(booking: Booking) {
  return booking.counselingHistoryNotes || booking.sessionReport || "";
}

async function downloadClientReportPdf(booking: Booking) {
  const token = localStorage.getItem("accessToken");
  const response = await fetch(`/api/bookings/${booking.id}/client-report.pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) {
    throw new Error("PDF belum tersedia");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `laporan-konseling-${booking.clientName}-${booking.id}.pdf`.replace(/[^a-z0-9.-]+/gi, "-").toLowerCase();
  anchor.click();
  URL.revokeObjectURL(url);
}

function ReportList({ title, icon, reports, mode }: { title: string; icon: ReactNode; reports: Booking[]; mode: "client" | "history" }) {
  const { toast } = useToast();

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
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{booking.clientName}</h3>
                <p className="text-xs text-neutral-500 mt-1">
                  {booking.preferredDate} · {booking.psychologistName || "-"}
                </p>
              </div>
              {mode === "client" && booking.reportSubmittedAt && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadClientReportPdf(booking).catch(() => toast({ title: "PDF belum tersedia", variant: "destructive" }))}
                >
                  <Download className="w-4 h-4 mr-2" />
                  PDF
                </Button>
              )}
            </div>
            <p className="text-sm text-neutral-700 whitespace-pre-wrap mt-3">
              {mode === "client" ? getClientReportText(booking) : getHistoryReportText(booking)}
            </p>
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
      <div className="text-sm mt-2 whitespace-pre-wrap">{value || "-"}</div>
    </div>
  );
}

function LoadingState({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={compact ? "py-8 text-center text-neutral-500" : "min-h-screen flex items-center justify-center text-neutral-500"}>
      {label}
    </div>
  );
}
