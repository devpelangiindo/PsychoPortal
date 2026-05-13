import { useMutation, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { useLocation } from "wouter";
import { CalendarDays, ExternalLink, FileText, LogOut, Mail, MapPin, Phone, Save, UserRound, Video } from "lucide-react";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default function PsychologistDashboard() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: bookings = [], isLoading } = useQuery<Booking[]>({
    queryKey: ["/api/psychologist/bookings"],
    enabled: !!user && (user.role === "psychologist" || user.role === "admin"),
  });

  if (authLoading) {
    return <LoadingState label="Memuat akun..." />;
  }

  if (!user) {
    setLocation("/login?redirect=/psychologist/dashboard");
    return <LoadingState label="Mengalihkan ke login..." />;
  }

  if (user.role !== "psychologist" && user.role !== "admin") {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-16">
          <Card>
            <CardHeader>
              <CardTitle>Akses khusus psikolog</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-neutral-500">Akun ini belum memiliki role psikolog.</p>
              <Button onClick={() => setLocation("/dashboard")}>Kembali ke Dashboard</Button>
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
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-foreground">Dashboard Psikolog</h1>
            <p className="text-neutral-500 dark:text-muted-foreground mt-2">
              {user.psychologistProfileName || `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()}
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

        {isLoading ? (
          <LoadingState label="Memuat booking..." compact />
        ) : bookings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-neutral-500">Belum ada booking untuk akun psikolog ini.</CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <Card key={booking.id}>
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
                  <ReportEditor booking={booking} onSaved={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/psychologist/bookings"] });
                    toast({ title: "Laporan disimpan", description: "Catatan psikolog berhasil diperbarui." });
                  }} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
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

function ReportEditor({ booking, onSaved }: { booking: Booking; onSaved: () => void }) {
  const [meetingUrl, setMeetingUrl] = useState(booking.meetingUrl ?? "");
  const [sessionReport, setSessionReport] = useState(booking.sessionReport ?? "");
  const [reportRecommendations, setReportRecommendations] = useState(booking.reportRecommendations ?? "");

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/psychologist/bookings/${booking.id}/report`, {
        meetingUrl,
        sessionReport,
        reportRecommendations,
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
            Laporan Psikolog
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
        <Label>Ringkasan sesi</Label>
        <Textarea
          value={sessionReport}
          onChange={(event) => setSessionReport(event.target.value)}
          placeholder="Isi ringkasan observasi dan proses konseling."
          rows={4}
          className="mt-2"
        />
      </div>

      <div>
        <Label>Rekomendasi / tindak lanjut</Label>
        <Textarea
          value={reportRecommendations}
          onChange={(event) => setReportRecommendations(event.target.value)}
          placeholder="Isi rekomendasi, PR klien, atau rencana sesi berikutnya."
          rows={4}
          className="mt-2"
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="bg-green-700 hover:bg-green-800">
          <Save className="w-4 h-4 mr-2" />
          {mutation.isPending ? "Menyimpan..." : "Simpan Laporan"}
        </Button>
      </div>
    </div>
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
