import { useMutation, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CalendarDays, ClipboardCheck, Clock, Download, ExternalLink, Eye, FileText, History, LogOut, Mail, MapPin, Phone, Save, Search, UserRound, Video } from "lucide-react";
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
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/date-format";

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
const psychologistNames = [
  "Tria Khusni Barokah, M.Psi., Psikolog",
  "Bagas Paramajana, M.Psi., Psikolog",
  "Dr. Yeni Triwahyuningsih, S.Psi., MM., Psikolog",
  "Retno Rahayu, M.Psi., Psikolog",
  "Ridwan Rahmawan, S.Psi., M.H., Psikolog",
];

type DashboardMode = "psychologist" | "admin";

export function AdminPsychologistBookings() {
  return <PsychologistDashboard mode="admin" />;
}

export default function PsychologistDashboard({ mode = "psychologist" }: { mode?: DashboardMode }) {
  const { user, isLoading: authLoading, logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [reportSearch, setReportSearch] = useState("");
  const [selectedAdminPsychologist, setSelectedAdminPsychologist] = useState(psychologistNames[0]);
  const isAdminMode = mode === "admin";
  const isAdminOrCso = user?.role === "admin" || user?.role === "internal";
  const loginRedirect = isAdminMode ? "/admin/bookings" : "/psychologist/dashboard";
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

  const { data: scheduleData, isLoading: scheduleLoading } = useQuery<ScheduleResponse>({
    queryKey: ["/api/psychologist/schedule-slots", mode, isAdminMode ? selectedAdminPsychologist : "self"],
    queryFn: async () => {
      const query = isAdminMode ? `?psychologistName=${encodeURIComponent(selectedAdminPsychologist)}` : "";
      const response = await apiRequest("GET", `/api/psychologist/schedule-slots${query}`);
      return response.json();
    },
    enabled: hasAccess && (!isAdminMode || Boolean(selectedAdminPsychologist)),
  });

  if (authLoading) {
    return <LoadingState label="Memuat akun..." />;
  }

  if (!user) {
    setLocation(`/login?redirect=${loginRedirect}`);
    return <LoadingState label="Mengalihkan ke login..." />;
  }

  if (!isAdminMode && isAdminOrCso) {
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
              <Button onClick={() => setLocation(isAdminOrCso ? "/admin/dashboard" : "/dashboard")}>Kembali ke Dashboard</Button>
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
                description="Upload jadwal 2 minggu ke depan. Setelah disimpan, jadwal terkunci dan hanya admin yang dapat mengubahnya."
              />
              {scheduleLoading ? (
                <LoadingState label="Memuat jadwal..." compact />
              ) : (
                <ScheduleUploadEditor scheduleSlots={scheduleData?.scheduleSlots ?? []} />
              )}
            </TabsContent>
          )}

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
                    canEditClientSchedule={isAdminMode}
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

          {isAdminMode && (
            <TabsContent value="jadwal-psikolog" className="space-y-4">
              <SectionTitle
                icon={<Clock className="w-5 h-5" />}
                title="Perubahan Jadwal Psikolog"
                description="Admin/CSO dapat mengubah jadwal psikolog untuk klien yang sudah terjadwal."
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
                  isAdmin
                  psychologistName={selectedAdminPsychologist}
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
  enabled: boolean;
  startTime: string;
  endTime: string;
  colombo: boolean;
  bantul: boolean;
};

function ScheduleUploadEditor({
  scheduleSlots,
  isAdmin = false,
  psychologistName,
}: {
  scheduleSlots: ScheduleSlot[];
  isAdmin?: boolean;
  psychologistName?: string;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState<ScheduleDraftRow[]>(() => buildScheduleRows(scheduleSlots));
  const isLocked = scheduleSlots.some((slot) => slot.isLocked);
  const canUploadToday = getLocalDayOfWeek() <= 5;

  useEffect(() => {
    setRows(buildScheduleRows(scheduleSlots));
  }, [scheduleSlots]);

  const mutation = useMutation({
    mutationFn: async () => {
      const slots = rows.flatMap((row) => {
        if (!row.enabled) return [];
        const timeSlot = `${row.startTime.replace(":", ".")} - ${row.endTime.replace(":", ".")}`;
        const locations = [
          "online",
          ...(row.colombo ? ["colombo"] : []),
          ...(row.bantul ? ["bantul"] : []),
        ] as const;
        return locations.map((location) => ({
          scheduleDate: row.scheduleDate,
          timeSlot,
          location,
          isAvailable: true,
        }));
      });
      const response = await apiRequest("PUT", "/api/psychologist/schedule-slots", {
        slots,
        ...(isAdmin && psychologistName ? { psychologistName } : {}),
      });
      return response.json();
    },
    onSuccess: (data: ScheduleResponse) => {
      setRows(buildScheduleRows(data.scheduleSlots));
      queryClient.invalidateQueries({ queryKey: ["/api/psychologist/schedule-slots"] });
      toast({
        title: "Jadwal disimpan",
        description: isAdmin ? "Jadwal psikolog berhasil diperbarui." : "Jadwal 2 minggu ke depan sudah dikunci.",
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

  const updateRow = (index: number, updates: Partial<ScheduleDraftRow>) => {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...updates } : row));
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-5">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          Online selalu tersedia untuk slot yang diaktifkan. Centang cabang offline hanya jika psikolog bersedia hadir di lokasi tersebut.
        </div>
        {isLocked && !isAdmin && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Jadwal sudah dikunci setelah disimpan. Perubahan lanjutan hanya dapat dilakukan admin.
          </div>
        )}
        {!canUploadToday && !isLocked && !isAdmin && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            Upload jadwal psikolog hanya dapat dilakukan maksimal hari Jumat.
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="text-left text-sm font-semibold text-neutral-600 p-3">Tanggal</th>
                <th className="text-left text-sm font-semibold text-neutral-600 p-3">Aktif</th>
                <th className="text-left text-sm font-semibold text-neutral-600 p-3">Waktu</th>
                <th className="text-left text-sm font-semibold text-neutral-600 p-3">Lokasi offline</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.scheduleDate} className="border-t">
                  <td className="p-3 font-medium text-neutral-900">{formatDisplayDate(row.scheduleDate)}</td>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      disabled={isLocked && !isAdmin}
                      onChange={(event) => updateRow(index, { enabled: event.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-green-700 focus:ring-green-700"
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Input type="time" min="07:00" max="21:00" value={row.startTime} disabled={(isLocked && !isAdmin) || !row.enabled} onChange={(event) => updateRow(index, { startTime: event.target.value })} />
                      <span className="text-neutral-400">-</span>
                      <Input type="time" min="07:00" max="21:00" value={row.endTime} disabled={(isLocked && !isAdmin) || !row.enabled} onChange={(event) => updateRow(index, { endTime: event.target.value })} />
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-4 text-sm text-neutral-700">
                      <span className="font-medium text-green-700">Online</span>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={row.colombo} disabled={(isLocked && !isAdmin) || !row.enabled} onChange={(event) => updateRow(index, { colombo: event.target.checked })} />
                        Colombo
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={row.bantul} disabled={(isLocked && !isAdmin) || !row.enabled} onChange={(event) => updateRow(index, { bantul: event.target.checked })} />
                        Bantul
                      </label>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || (!isAdmin && (isLocked || !canUploadToday))} className="bg-green-700 hover:bg-green-800">
            <Save className="w-4 h-4 mr-2" />
            {mutation.isPending ? "Menyimpan..." : isAdmin ? "Simpan Jadwal Psikolog" : "Simpan & Kunci Jadwal"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function buildScheduleRows(scheduleSlots: ScheduleSlot[]): ScheduleDraftRow[] {
  const today = new Date();
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const scheduleDate = formatDateInput(date);
    const slotsForDate = scheduleSlots.filter((slot) => slot.scheduleDate === scheduleDate && slot.isAvailable);
    const firstSlot = slotsForDate[0]?.timeSlot ?? "08.00 - 10.00";
    const [startTime, endTime] = firstSlot.replace(/\./g, ":").split(" - ");
    return {
      scheduleDate,
      enabled: slotsForDate.length > 0,
      startTime: startTime || "08:00",
      endTime: endTime || "10:00",
      colombo: slotsForDate.some((slot) => slot.location === "colombo"),
      bantul: slotsForDate.some((slot) => slot.location === "bantul"),
    };
  });
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalDayOfWeek() {
  return new Date().getDay();
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

function BookingCard({ booking, canEditClientSchedule, onSaved }: { booking: Booking; canEditClientSchedule: boolean; onSaved: () => void }) {
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

        {canEditClientSchedule && <ScheduleEditor booking={booking} onSaved={onSaved} />}
        <ReportEditor booking={booking} onSaved={onSaved} />
      </CardContent>
    </Card>
  );
}

function ScheduleEditor({ booking, onSaved }: { booking: Booking; onSaved: () => void }) {
  const { toast } = useToast();
  const [initialStart, initialEnd] = parseTimeRange(booking.preferredTime);
  const [preferredDate, setPreferredDate] = useState(booking.preferredDate);
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(initialEnd);
  const [location, setLocation] = useState(booking.location ?? "online");
  const [meetingUrl, setMeetingUrl] = useState(booking.meetingUrl ?? "");
  const today = new Date().toISOString().slice(0, 10);
  const maxDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/psychologist/bookings/${booking.id}/schedule`, {
        preferredDate,
        preferredTime: `${startTime.replace(":", ".")} - ${endTime.replace(":", ".")}`,
        location,
        meetingUrl,
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
      <div className="grid md:grid-cols-4 gap-3">
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
  const { toast } = useToast();
  const [meetingUrl, setMeetingUrl] = useState(booking.meetingUrl ?? "");
  const [sessionReport, setSessionReport] = useState(booking.sessionReport ?? "");
  const [reportRecommendations, setReportRecommendations] = useState(booking.reportRecommendations ?? "");
  const [clientReportNotes, setClientReportNotes] = useState(booking.clientReportNotes ?? booking.reportRecommendations ?? "");
  const [counselingHistoryNotes, setCounselingHistoryNotes] = useState(booking.counselingHistoryNotes ?? booking.sessionReport ?? "");
  const hasSavedReport = Boolean(
    booking.clientReportNotes ||
    booking.reportRecommendations ||
    booking.counselingHistoryNotes ||
    booking.sessionReport,
  );

  const mutation = useMutation({
    mutationFn: async (submit: boolean) => {
      if (submit && !counselingHistoryNotes.trim()) {
        throw new Error("Riwayat konseling wajib diisi.");
      }

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
    onError: (error) => {
      toast({
        title: error instanceof Error ? error.message : "Gagal menyimpan laporan",
        variant: "destructive",
      });
    },
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
            {booking.reportSubmittedAt
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Label>Laporan untuk Klien: Catatan Hasil Konseling / PR <span className="text-neutral-400">(opsional)</span></Label>
          <ReportPdfActions booking={booking} mode="client" />
        </div>
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Label>Riwayat Konseling: Catatan internal psikolog <span className="text-red-600">*</span></Label>
          <ReportPdfActions booking={booking} mode="history" />
        </div>
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
        <Button onClick={() => mutation.mutate(true)} disabled={mutation.isPending || !counselingHistoryNotes.trim()} className="bg-green-700 hover:bg-green-800">
          <ClipboardCheck className="w-4 h-4 mr-2" />
          {mutation.isPending ? "Menyelesaikan..." : "Selesai"}
        </Button>
      </div>
    </div>
  );
}

function ReportPdfActions({ booking, mode }: { booking: Booking; mode: "client" | "history" }) {
  const { toast } = useToast();
  const isAvailable =
    mode === "client"
      ? Boolean(booking.reportSubmittedAt && getClientReportText(booking))
      : Boolean(getHistoryReportText(booking));

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!isAvailable}
        onClick={() => viewReportPdf(booking, mode).catch(() => toast({ title: "PDF belum tersedia", variant: "destructive" }))}
      >
        <Eye className="w-4 h-4 mr-2" />
        Lihat PDF
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!isAvailable}
        onClick={() => downloadReportPdf(booking, mode).catch(() => toast({ title: "PDF belum tersedia", variant: "destructive" }))}
      >
        <Download className="w-4 h-4 mr-2" />
        Download PDF
      </Button>
    </div>
  );
}

function getClientReportText(booking: Booking) {
  return booking.clientReportNotes || booking.reportRecommendations || "";
}

function getHistoryReportText(booking: Booking) {
  return booking.counselingHistoryNotes || booking.sessionReport || "";
}

async function fetchReportPdf(booking: Booking, mode: "client" | "history") {
  const token = localStorage.getItem("accessToken");
  const endpoint = mode === "client" ? "client-report" : "history-report";
  const response = await fetch(`/api/bookings/${booking.id}/${endpoint}.pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) {
    throw new Error("PDF belum tersedia");
  }
  return response.blob();
}

async function viewReportPdf(booking: Booking, mode: "client" | "history") {
  const blob = await fetchReportPdf(booking, mode);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function downloadReportPdf(booking: Booking, mode: "client" | "history") {
  const blob = await fetchReportPdf(booking, mode);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${mode === "client" ? "laporan-konseling" : "riwayat-konseling"}-${booking.clientName}-${booking.id}.pdf`.replace(/[^a-z0-9.-]+/gi, "-").toLowerCase();
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
                  {formatDisplayDate(booking.preferredDate)} · {booking.psychologistName || "-"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => viewReportPdf(booking, mode).catch(() => toast({ title: "PDF belum tersedia", variant: "destructive" }))}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Lihat PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadReportPdf(booking, mode).catch(() => toast({ title: "PDF belum tersedia", variant: "destructive" }))}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </div>
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
