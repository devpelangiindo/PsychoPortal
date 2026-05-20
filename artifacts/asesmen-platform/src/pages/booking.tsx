import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  ClipboardList,
  CreditCard,
  HeartHandshake,
  Loader2,
  MapPin,
  MessageCircle,
  ShieldCheck,
  UserRound,
  Users,
  Video,
} from "lucide-react";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDisplayDate } from "@/lib/date-format";

type BookingService = {
  id: number;
  name: string;
  description: string;
  price: string;
  duration: string;
};

type AvailabilitySlot = {
  dayOfWeek: number;
  timeSlot: string;
  isAvailable: boolean;
};

type ScheduleSlot = {
  id: number;
  scheduleDate: string;
  timeSlot: string;
  location: LocationType;
  isAvailable: boolean;
  isLocked: boolean;
};

type AvailabilityResponse = {
  psychologistName: string;
  availability: AvailabilitySlot[];
  scheduleSlots?: ScheduleSlot[];
};

type ConsultationType = "child" | "adult" | "family";
type LocationType = "online" | "colombo" | "bantul";

type BookingForm = {
  clientName: string;
  birthDate: string;
  email: string;
  whatsappNumber: string;
  mainConcern: string;
  concernHistory: string;
  consultationType: ConsultationType | "";
  childName: string;
  childBirthDate: string;
  previousDiagnosis: string;
  preferredDate: string;
  preferredTime: string;
  psychologistName: string;
  location: LocationType;
};

const PSYCHOLOGISTS = [
  { name: "Tria Khusni Barokah, M.Psi., Psikolog", fee: 300000, types: ["child"] as ConsultationType[] },
  { name: "Bagas Paramajana, M.Psi., Psikolog", fee: 300000, types: ["child"] as ConsultationType[] },
  { name: "Dr. Yeni Triwahyuningsih, S.Psi., MM., Psikolog", fee: 400000, types: ["adult", "family"] as ConsultationType[] },
  { name: "Retno Rahayu, M.Psi., Psikolog", fee: 300000, types: ["adult", "family"] as ConsultationType[] },
  { name: "Ridwan Rahmawan, S.Psi., M.H., Psikolog", fee: 300000, types: ["adult"] as ConsultationType[] },
];

const PSYCHOLOGIST_PROFILES = [
  "Dr. Yeni Triwahyuningsih, S.Psi., MM., Psikolog",
  "Retno Rahayu, M.Psi., Psikolog",
  "Tria Khusni Barokah, M.Psi., Psikolog",
  "Bagas Paramajana, M.Psi., Psikolog",
  "Ridwan Rahmawan, S.Psi., M.H., Psikolog",
].map((name) => ({
  name,
  sipp: "Nomor SIPP menyusul",
  description: "Deskripsi singkat psikolog akan ditambahkan.",
}));

const CONSULTATION_TYPES = [
  { value: "child", label: "Perkembangan anak & remaja", hint: "Kurang dari 17 tahun" },
  { value: "adult", label: "Permasalahan pribadi", hint: "Dewasa" },
  { value: "family", label: "Permasalahan keluarga", hint: "Keluarga" },
] satisfies Array<{ value: ConsultationType; label: string; hint: string }>;

const TIME_SLOTS = ["08.00 - 10.00", "10.30 - 12.30", "13.30 - 15.30"];

const LOCATIONS = [
  { value: "online", label: "Online", detail: "Sesi dilakukan secara daring" },
  { value: "colombo", label: "Offline Colombo", detail: "Jl. Colombo No.8, Samirono, Caturtunggal, Sleman, DIY 55281" },
  { value: "bantul", label: "Offline Bantul", detail: "Jalan Mgr. Sugiyo Pranoto No.14 Melikan Kidul, Bantul, Yogyakarta" },
] satisfies Array<{ value: LocationType; label: string; detail: string }>;

const PROMOS = [
  { title: "Konsultasi Awal Gratis", desc: "Jadwalkan sesi konsultasi pertama Anda tanpa biaya." },
  { title: "Workshop Pelangi Indonesia", desc: "Pelatihan Manajemen Perilaku Anak — Daftar sekarang!" },
  { title: "Paket Asesmen Lengkap", desc: "Dapatkan laporan komprehensif dengan rekomendasi terapi." },
];

const formatCurrency = (value: string | number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(value));

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDayOfWeek = (dateString: string) => {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

export default function Booking() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const isFormRoute = location.startsWith("/booking/form");
  const [form, setForm] = useState<BookingForm>({
    clientName: "",
    birthDate: "",
    email: "",
    whatsappNumber: "",
    mainConcern: "",
    concernHistory: "",
    consultationType: "",
    childName: "",
    childBirthDate: "",
    previousDiagnosis: "",
    preferredDate: "",
    preferredTime: TIME_SLOTS[0],
    psychologistName: "",
    location: "online",
  });

  useEffect(() => {
    if (isFormRoute && !authLoading && !isAuthenticated) {
      setLocation("/login?redirect=/booking/form");
    }
  }, [authLoading, isAuthenticated, isFormRoute, setLocation]);

  const { data: services, isLoading: servicesLoading } = useQuery<BookingService[]>({
    queryKey: ["/api/booking-services"],
  });

  const selectedService = useMemo(() => {
    if (!services?.length) return undefined;
    return services.find((service) => service.id === selectedServiceId) ?? services[0];
  }, [services, selectedServiceId]);

  const availablePsychologists = useMemo(() => {
    if (!form.consultationType) return [];
    return PSYCHOLOGISTS.filter((psychologist) => psychologist.types.includes(form.consultationType as ConsultationType));
  }, [form.consultationType]);

  const selectedPsychologist = availablePsychologists.find((psychologist) => psychologist.name === form.psychologistName);
  const { data: availabilityData } = useQuery<AvailabilityResponse>({
    queryKey: ["/api/psychologist-availability", form.psychologistName],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/psychologist-availability?psychologistName=${encodeURIComponent(form.psychologistName)}`);
      return response.json();
    },
    enabled: Boolean(form.psychologistName),
  });
  const dateScheduleSlots = useMemo(() => {
    if (!form.preferredDate || !availabilityData?.scheduleSlots?.length) return [];
    return availabilityData.scheduleSlots.filter((slot) => slot.scheduleDate === form.preferredDate && slot.isAvailable);
  }, [availabilityData, form.preferredDate]);
  const availableTimeSlots = useMemo(() => {
    if (dateScheduleSlots.length > 0) {
      return Array.from(new Set(dateScheduleSlots.map((slot) => slot.timeSlot))).sort();
    }
    if (!form.preferredDate || !availabilityData?.availability?.length) return TIME_SLOTS;
    const dayOfWeek = getDayOfWeek(form.preferredDate);
    return TIME_SLOTS.filter((slot) => {
      const availability = availabilityData.availability.find((item) => item.dayOfWeek === dayOfWeek && item.timeSlot === slot);
      return availability?.isAvailable !== false;
    });
  }, [availabilityData, dateScheduleSlots, form.preferredDate]);
  const availableLocations = useMemo(() => {
    if (!form.preferredTime || dateScheduleSlots.length === 0) return LOCATIONS;
    const offlineLocations = new Set(
      dateScheduleSlots
        .filter((slot) => slot.timeSlot === form.preferredTime && slot.location !== "online")
        .map((slot) => slot.location),
    );
    return LOCATIONS.filter((location) => location.value === "online" || offlineLocations.has(location.value));
  }, [dateScheduleSlots, form.preferredTime]);
  const today = useMemo(() => formatDateInput(new Date()), []);
  const maxBookingDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return formatDateInput(date);
  }, []);

  const updateField = (field: keyof BookingForm, value: string) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "consultationType") {
        next.psychologistName = "";
        if (value !== "child") {
          next.childName = "";
          next.childBirthDate = "";
          next.previousDiagnosis = "";
        }
      }
      return next;
    });
  };

  useEffect(() => {
    if (availableTimeSlots.length > 0 && !availableTimeSlots.includes(form.preferredTime)) {
      updateField("preferredTime", availableTimeSlots[0]);
    }
  }, [availableTimeSlots, form.preferredTime]);

  useEffect(() => {
    if (!availableLocations.some((location) => location.value === form.location)) {
      updateField("location", "online");
    }
  }, [availableLocations, form.location]);

  const createBookingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedService) throw new Error("Pilih layanan terlebih dahulu");
      if (!selectedPsychologist) throw new Error("Pilih psikolog terlebih dahulu");

      const bookingResponse = await apiRequest("POST", "/api/bookings", {
        serviceId: selectedService.id,
        ...form,
        clientName: form.clientName || `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim(),
        email: form.email || user?.email,
        whatsappNumber: form.whatsappNumber || user?.whatsappNumber,
      });
      const booking = await bookingResponse.json();

      const paymentResponse = await apiRequest("POST", `/api/bookings/${booking.id}/pay`, {});
      return await paymentResponse.json();
    },
    onSuccess: (payment) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Booking dibuat",
        description: "Anda akan diarahkan ke pembayaran Midtrans.",
      });

      if (payment.redirect_url) {
        window.location.href = payment.redirect_url;
      } else {
        setLocation(`/payment-return?order_id=${payment.orderId}`);
      }
    },
    onError: (error) => {
      toast({
        title: "Booking gagal",
        description: error instanceof Error ? error.message : "Silakan cek data dan coba lagi.",
        variant: "destructive",
      });
    },
  });

  const validateStep = () => {
    if (step === 0) {
      const name = form.clientName || `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
      const email = form.email || user?.email;
      const whatsapp = form.whatsappNumber || user?.whatsappNumber;
      if (!name || !form.birthDate || !email || !whatsapp || !form.mainConcern) {
        return "Lengkapi nama, tanggal lahir, email, WhatsApp, dan keluhan umum.";
      }
      if (!/^[0-9]+$/.test(whatsapp)) {
        return "Nomor WhatsApp hanya boleh angka.";
      }
    }

    if (step === 1) {
      if (!form.consultationType) return "Pilih jenis konsultasi.";
      if (form.consultationType === "child" && (!form.childName || !form.childBirthDate)) {
        return "Lengkapi nama dan tanggal lahir anak.";
      }
    }

    if (step === 2) {
      if (!form.preferredDate || !form.preferredTime || !form.psychologistName || !form.location) {
        return "Lengkapi tanggal, psikolog, waktu, dan lokasi.";
      }
      if (!availableTimeSlots.includes(form.preferredTime)) {
        return "Psikolog tidak tersedia pada hari dan jam yang dipilih.";
      }
      if (form.preferredDate < today || form.preferredDate > maxBookingDate) {
        return "Tanggal booking hanya dapat dipilih sampai 14 hari dari hari ini.";
      }
    }

    return "";
  };

  const nextStep = () => {
    if (!isAuthenticated) {
      toast({
        title: "Silakan masuk",
        description: "Anda perlu masuk sebelum membuat booking psikolog.",
        variant: "destructive",
      });
      setLocation("/login");
      return;
    }

    const error = validateStep();
    if (error) {
      toast({ title: "Data belum lengkap", description: error, variant: "destructive" });
      return;
    }
    setStep((current) => Math.min(current + 1, 3));
  };

  const handleSubmit = () => {
    const error = validateStep();
    if (error) {
      toast({ title: "Data belum lengkap", description: error, variant: "destructive" });
      return;
    }
    createBookingMutation.mutate();
  };

  const steps = ["Form A", "Form B", "Penjadwalan", "Form C"];

  if (!isFormRoute) {
    return (
      <BookingLanding
        services={services}
        servicesLoading={servicesLoading}
        onStart={() => setLocation(isAuthenticated ? "/booking/form" : "/login?redirect=/booking/form")}
      />
    );
  }

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-background">
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <Card>
            <CardHeader>
              <CardTitle>Login diperlukan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-neutral-500">Silakan masuk terlebih dahulu sebelum mengisi form booking psikolog.</p>
              <Button onClick={() => setLocation("/login?redirect=/booking/form")} className="bg-green-700 hover:bg-green-800">
                Masuk untuk Booking
              </Button>
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
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <Link href="/booking">
            <Button variant="ghost" className="mb-4">Kembali</Button>
          </Link>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-foreground">
            Booking Konsultasi Psikolog
          </h1>
          <p className="text-neutral-500 dark:text-muted-foreground mt-2 max-w-2xl">
            Isi data diri, pilih kebutuhan konsultasi, tentukan jadwal preferensi, lalu lanjutkan ke pembayaran.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-8">
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-2">
              {steps.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStep(index)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    step === index
                      ? "border-green-700 bg-green-700 text-white"
                      : index < step
                        ? "border-green-200 bg-green-50 text-green-800"
                        : "border-gray-200 bg-white text-gray-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {step === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Form A: Data Diri</CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                  <Field label="Nama lengkap">
                    <Input
                      value={form.clientName}
                      placeholder={user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : "Nama lengkap"}
                      onChange={(event) => updateField("clientName", event.target.value)}
                    />
                  </Field>
                  <Field label="Tanggal lahir">
                    <Input
                      type="date"
                      value={form.birthDate}
                      onChange={(event) => updateField("birthDate", event.target.value)}
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      type="email"
                      value={form.email}
                      placeholder={user?.email ?? "email@example.com"}
                      onChange={(event) => updateField("email", event.target.value)}
                    />
                  </Field>
                  <Field label="Nomor WhatsApp">
                    <Input
                      inputMode="numeric"
                      value={form.whatsappNumber}
                      placeholder={user?.whatsappNumber ?? "081224248324"}
                      onChange={(event) => updateField("whatsappNumber", event.target.value.replace(/\D/g, ""))}
                    />
                  </Field>
                  <Field label="Keluhan umum" className="md:col-span-2">
                    <Textarea
                      rows={5}
                      value={form.mainConcern}
                      placeholder="Ceritakan keluhan umum yang ingin dikonsultasikan."
                      onChange={(event) => updateField("mainConcern", event.target.value)}
                    />
                  </Field>
                  <Field label="Riwayat keluhan" className="md:col-span-2">
                    <Textarea
                      rows={4}
                      value={form.concernHistory}
                      placeholder="Opsional, isi jika ada riwayat keluhan sebelumnya."
                      onChange={(event) => updateField("concernHistory", event.target.value)}
                    />
                  </Field>
                </CardContent>
              </Card>
            )}

            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Form B: Jenis Konsultasi</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid md:grid-cols-3 gap-4">
                    {CONSULTATION_TYPES.map((type) => {
                      const selected = form.consultationType === type.value;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => updateField("consultationType", type.value)}
                          className={`text-left rounded-lg border p-4 ${
                            selected ? "border-green-700 bg-green-50" : "border-gray-200 bg-white hover:border-green-500"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded border flex items-center justify-center ${selected ? "bg-green-700 border-green-700 text-white" : "border-gray-300"}`}>
                              {selected && <Check className="w-3 h-3" />}
                            </span>
                            <span className="font-semibold">{type.label}</span>
                          </div>
                          <p className="text-sm text-neutral-500 mt-2">{type.hint}</p>
                        </button>
                      );
                    })}
                  </div>

                  {form.consultationType === "child" && (
                    <div className="grid md:grid-cols-2 gap-4 rounded-lg border bg-white p-4">
                      <Field label="Nama lengkap anak/remaja">
                        <Input value={form.childName} onChange={(event) => updateField("childName", event.target.value)} />
                      </Field>
                      <Field label="Tanggal lahir anak/remaja">
                        <Input type="date" value={form.childBirthDate} onChange={(event) => updateField("childBirthDate", event.target.value)} />
                      </Field>
                      <Field label="Diagnosa ahli sebelumnya" className="md:col-span-2">
                        <Textarea rows={3} value={form.previousDiagnosis} placeholder="Opsional, isi jika ada." onChange={(event) => updateField("previousDiagnosis", event.target.value)} />
                      </Field>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Penjadwalan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Field label="Pilihan tanggal">
                      <Input
                        type="date"
                        min={today}
                        max={maxBookingDate}
                        value={form.preferredDate}
                        onChange={(event) => updateField("preferredDate", event.target.value)}
                      />
                    </Field>
                    <Field label="Pilihan waktu">
                      <select
                        value={form.preferredTime}
                        onChange={(event) => updateField("preferredTime", event.target.value)}
                        disabled={Boolean(form.psychologistName && form.preferredDate && availableTimeSlots.length === 0)}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {availableTimeSlots.length === 0 ? (
                          <option value="">Tidak ada jam tersedia</option>
                        ) : availableTimeSlots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                      </select>
                      {form.psychologistName && form.preferredDate && availableTimeSlots.length === 0 && (
                        <p className="text-xs text-red-600 mt-2">Psikolog tidak tersedia pada tanggal ini.</p>
                      )}
                    </Field>
                  </div>

                  <div>
                    <Label>Pilihan psikolog</Label>
                    <div className="grid md:grid-cols-2 gap-4 mt-2">
                      {availablePsychologists.length === 0 ? (
                        <p className="text-sm text-neutral-500">Pilih jenis konsultasi pada Form B terlebih dahulu.</p>
                      ) : availablePsychologists.map((psychologist) => {
                        const selected = form.psychologistName === psychologist.name;
                        return (
                          <button
                            key={psychologist.name}
                            type="button"
                            onClick={() => updateField("psychologistName", psychologist.name)}
                            className={`text-left rounded-lg border p-4 ${
                              selected ? "border-green-700 bg-green-50" : "border-gray-200 bg-white hover:border-green-500"
                            }`}
                          >
                            <div className="flex gap-3">
                              <div className="w-11 h-11 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                <UserRound className="w-5 h-5 text-green-800" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm">{psychologist.name}</p>
                                <p className="text-sm text-green-700 mt-1">{formatCurrency(psychologist.fee)} / sesi</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label>Pilihan lokasi</Label>
                    <div className="grid md:grid-cols-3 gap-4 mt-2">
                      {availableLocations.map((location) => {
                        const selected = form.location === location.value;
                        return (
                          <button
                            key={location.value}
                            type="button"
                            onClick={() => updateField("location", location.value)}
                            className={`text-left rounded-lg border p-4 ${
                              selected ? "border-green-700 bg-green-50" : "border-gray-200 bg-white hover:border-green-500"
                            }`}
                          >
                            <p className="font-semibold text-sm">{location.label}</p>
                            <p className="text-xs text-neutral-500 mt-2 leading-relaxed">{location.detail}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle>Form C: Pembayaran</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="rounded-lg border bg-white p-5 space-y-3">
                    <div className="flex justify-between gap-4">
                      <span className="text-neutral-500">Layanan</span>
                      <span className="font-semibold text-right">{selectedService?.name ?? "Konsultasi Psikolog"}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-neutral-500">Psikolog</span>
                      <span className="font-semibold text-right">{selectedPsychologist?.name ?? "-"}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-neutral-500">Jadwal</span>
                      <span className="font-semibold text-right">{form.preferredDate ? formatDisplayDate(form.preferredDate) : "-"} · {form.preferredTime}</span>
                    </div>
                    <div className="border-t pt-3 flex justify-between items-center">
                      <span className="font-semibold">Total Transaksi</span>
                      <span className="text-2xl font-bold text-green-700">{formatCurrency(selectedPsychologist?.fee ?? 0)}</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                    Setelah pembayaran, Admin Pelangi Indonesia akan menghubungi Anda maksimal 1x24 jam kerja. Wajib hadir paling lambat 30 menit sebelum jadwal.
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep((current) => Math.max(current - 1, 0))} disabled={step === 0}>
                Sebelumnya
              </Button>
              {step < 3 ? (
                <Button onClick={nextStep} className="bg-green-700 hover:bg-green-800">
                  Berikutnya
                </Button>
              ) : (
                <Button onClick={handleSubmit} className="bg-green-700 hover:bg-green-800" disabled={authLoading || createBookingMutation.isPending || !selectedPsychologist}>
                  {createBookingMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Membuat Booking...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Bayar dengan Midtrans
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <Card className="h-fit sticky top-20">
            <CardHeader>
              <CardTitle>Ringkasan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {servicesLoading ? (
                <div className="h-24 rounded bg-muted animate-pulse" />
              ) : (
                <div className="space-y-2">
                  <p className="font-semibold">{selectedService?.name ?? "Konsultasi Psikolog"}</p>
                  <p className="text-sm text-neutral-500">{selectedService?.description}</p>
                </div>
              )}
              <div className="space-y-2 text-sm">
                <SummaryRow label="Jenis" value={CONSULTATION_TYPES.find((type) => type.value === form.consultationType)?.label ?? "-"} />
                <SummaryRow label="Psikolog" value={selectedPsychologist?.name ?? "-"} />
                <SummaryRow label="Waktu" value={form.preferredDate ? `${formatDisplayDate(form.preferredDate)}, ${form.preferredTime}` : "-"} />
                <SummaryRow label="Lokasi" value={LOCATIONS.find((location) => location.value === form.location)?.label ?? "-"} />
              </div>
              <div className="border-t pt-4">
                <p className="text-sm text-neutral-500">Total</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(selectedPsychologist?.fee ?? 0)}</p>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                <div className="flex gap-2">
                  <MessageCircle className="w-4 h-4 mt-0.5" />
                  <p>Konfirmasi jadwal dilakukan manual oleh admin setelah pembayaran berhasil.</p>
                </div>
              </div>
              {!isAuthenticated && (
                <p className="text-xs text-center text-neutral-500">
                  Anda akan diarahkan untuk masuk sebelum pembayaran.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function BookingLanding({
  services,
  servicesLoading,
  onStart,
}: {
  services?: BookingService[];
  servicesLoading: boolean;
  onStart: () => void;
}) {
  const service = services?.[0];
  const startingFee = Math.min(...PSYCHOLOGISTS.map((psychologist) => psychologist.fee));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <section className="gradient-hero py-20 md:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
              <div className="text-white">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-green-50 mb-6">
                  <HeartHandshake className="w-4 h-4" />
                  Konseling bersama psikolog profesional
                </div>
                <h1 className="text-4xl md:text-6xl font-extrabold tracking-normal leading-tight">
                  Booking Psikolog Pelangi Indonesia
                </h1>
                <p className="text-lg md:text-xl text-green-50/90 mt-6 max-w-2xl leading-relaxed">
                  Pilih kebutuhan konseling, tentukan psikolog dan jadwal preferensi, lalu lanjutkan pembayaran aman melalui Midtrans.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 mt-8">
                  <Button
                    size="lg"
                    onClick={onStart}
                    className="px-8 py-5 text-base md:text-lg font-bold bg-white text-[#1B4332] hover:bg-green-50 shadow-lg"
                  >
                    <CalendarCheck className="w-5 h-5 mr-2" />
                    Mulai Booking
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <a href="#alur-booking">
                    <Button
                      size="lg"
                      variant="outline"
                      className="px-8 py-5 text-base md:text-lg font-semibold border-white/80 bg-transparent text-white hover:bg-white/10 hover:text-white"
                    >
                      Lihat Alur
                    </Button>
                  </a>
                </div>
                <div className="grid sm:grid-cols-3 gap-4 mt-10 max-w-3xl">
                  <HeroMetric label="Mulai dari" value={formatCurrency(startingFee)} />
                  <HeroMetric label="Pilihan sesi" value="Online / Offline" />
                  <HeroMetric label="Jadwal" value="Maks. 14 hari" />
                </div>
              </div>

              <div className="rounded-2xl bg-white/95 p-5 md:p-6 shadow-2xl ring-1 ring-white/60">
                <div className="rounded-xl bg-green-50 p-5 border border-green-100">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-700 text-white flex items-center justify-center shrink-0">
                      <ClipboardList className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-neutral-900">
                        {servicesLoading ? "Konsultasi Psikolog" : service?.name ?? "Konsultasi Psikolog"}
                      </h2>
                      <p className="text-neutral-600 mt-2 leading-relaxed">
                        {service?.description ?? "Layanan konseling psikologi untuk anak, remaja, dewasa, dan keluarga."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 mt-5">
                  {CONSULTATION_TYPES.map((type) => (
                    <div key={type.value} className="rounded-lg border bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-neutral-900">{type.label}</p>
                          <p className="text-sm text-neutral-500 mt-1">{type.hint}</p>
                        </div>
                        <Check className="w-5 h-5 text-green-700 shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-green-200 bg-green-50 p-4 mt-5 text-sm text-green-900">
                  Konfirmasi jadwal dilakukan oleh admin setelah pembayaran berhasil.
                </div>
              </div>
            </div>
          </div>
        </section>

        <PsychologistProfilesSection />

        <section id="alur-booking" className="py-20 bg-white dark:bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-foreground">
                Alur Booking
              </h2>
              <p className="text-lg text-neutral-500 dark:text-muted-foreground mt-3">
                Proses dibuat ringkas agar klien bisa langsung sampai ke jadwal konseling.
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-6">
              <ProcessStep
                icon={<Users className="w-7 h-7" />}
                title="1. Isi Data"
                description="Lengkapi data diri, keluhan umum, dan riwayat keluhan."
              />
              <ProcessStep
                icon={<HeartHandshake className="w-7 h-7" />}
                title="2. Pilih Konseling"
                description="Pilih konseling anak/remaja, dewasa, atau keluarga."
              />
              <ProcessStep
                icon={<CalendarCheck className="w-7 h-7" />}
                title="3. Tentukan Jadwal"
                description="Pilih tanggal maksimal 14 hari dari hari booking, waktu, lokasi, dan psikolog."
              />
              <ProcessStep
                icon={<CreditCard className="w-7 h-7" />}
                title="4. Bayar Midtrans"
                description="Lanjutkan ke pembayaran aman, lalu tunggu konfirmasi jadwal dari admin."
              />
            </div>
          </div>
        </section>

        <section className="py-20 bg-neutral-50 dark:bg-muted/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-10 items-start">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-foreground">
                  Pilihan Sesi
                </h2>
                <p className="text-lg text-neutral-500 dark:text-muted-foreground mt-4 leading-relaxed">
                  Konseling tersedia secara online maupun tatap muka di cabang Colombo dan Bantul.
                </p>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <SessionCard
                  icon={<Video className="w-6 h-6" />}
                  title="Online"
                  description="Sesi daring dengan link meeting yang disiapkan oleh psikolog."
                />
                <SessionCard
                  icon={<MapPin className="w-6 h-6" />}
                  title="Offline Colombo"
                  description="Konseling tatap muka di Jl. Colombo No.8, Yogyakarta."
                />
                <SessionCard
                  icon={<MapPin className="w-6 h-6" />}
                  title="Offline Bantul"
                  description="Konseling tatap muka di Melikan Kidul, Bantul."
                />
              </div>
            </div>
          </div>
        </section>

        <PromoInfoSection />

        <section className="py-20 bg-white dark:bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl bg-[#1B4332] px-6 py-10 md:p-12 text-white grid lg:grid-cols-[1fr_auto] gap-8 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-green-50 mb-5">
                  <ShieldCheck className="w-4 h-4" />
                  Pembayaran aman via Midtrans
                </div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-normal">
                  Siap membuat jadwal konseling?
                </h2>
                <p className="text-green-50/90 mt-4 max-w-2xl leading-relaxed">
                  Anda perlu login sebelum mengisi form agar booking, pembayaran, dan laporan konseling tersimpan di dashboard klien.
                </p>
              </div>
              <Button
                size="lg"
                onClick={onStart}
                className="bg-white text-[#1B4332] hover:bg-green-50 px-8 py-5 font-bold"
              >
                Booking Sekarang
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function PsychologistProfilesSection() {
  return (
    <section className="py-20 bg-neutral-50 dark:bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-10">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-green-700">Profil Psikolog</p>
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-foreground mt-2">
              Pilih Psikolog Sesuai Kebutuhan
            </h2>
          </div>
          <p className="text-neutral-500 dark:text-muted-foreground md:max-w-md leading-relaxed">
            Foto, nomor SIPP, dan deskripsi singkat akan dilengkapi setelah informasi final tersedia.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {PSYCHOLOGIST_PROFILES.map((psychologist) => (
            <div key={psychologist.name} className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-800">
                  <UserRound className="h-9 w-9" />
                </div>
                <div>
                  <h3 className="font-bold leading-snug text-neutral-900">{psychologist.name}</h3>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-green-700">
                    {psychologist.sipp}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-neutral-500">
                {psychologist.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PromoInfoSection() {
  return (
    <section className="py-20 bg-white dark:bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-green-700">Promo & Info</p>
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-foreground mt-2">
              Informasi Layanan Pelangi Indonesia
            </h2>
          </div>
          <p className="text-neutral-500 dark:text-muted-foreground md:max-w-md leading-relaxed">
            Pilih informasi yang paling sesuai dengan kebutuhan Anda, lalu lanjutkan melalui WhatsApp.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {PROMOS.map((promo) => (
            <div key={promo.title} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
              <h3 className="font-semibold text-base mb-2 text-[#2D6A4F]">{promo.title}</h3>
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">{promo.desc}</p>
              <a
                href="https://wa.me/62816669533"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#2D6A4F]"
              >
                Info lebih lanjut <ArrowRight size={13} />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/20 bg-white/10 p-4">
      <p className="text-sm text-green-50/80">{label}</p>
      <p className="font-bold text-white mt-1">{value}</p>
    </div>
  );
}

function ProcessStep({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="w-14 h-14 rounded-full bg-green-100 text-green-800 flex items-center justify-center mb-5">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-neutral-900">{title}</h3>
      <p className="text-sm text-neutral-500 leading-relaxed mt-3">{description}</p>
    </div>
  );
}

function SessionCard({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="w-12 h-12 rounded-full bg-green-100 text-green-800 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-bold text-neutral-900">{title}</h3>
      <p className="text-sm text-neutral-500 leading-relaxed mt-2">{description}</p>
    </div>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
