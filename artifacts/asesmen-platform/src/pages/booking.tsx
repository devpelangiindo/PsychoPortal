import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";
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
  gender: string;
  address: string;
  email: string;
  whatsappNumber: string;
  occupation: string;
  religion: string;
  mainConcern: string;
  concernHistory: string;
  consultationType: ConsultationType | "";
  fatherName: string;
  motherName: string;
  fatherOccupation: string;
  motherOccupation: string;
  fatherWhatsapp: string;
  motherWhatsapp: string;
  guardianName: string;
  guardianOccupation: string;
  guardianWhatsapp: string;
  guardianRelation: string;
  childName: string;
  childBirthDate: string;
  pregnancyBirthNotes: string;
  birthAgeMonths: string;
  birthWeightKg: string;
  birthLengthCm: string;
  previousDiagnosis: string;
  consentName: string;
  consentAddress: string;
  consentPhone: string;
  consentAge: string;
  consentRole: string;
  consentMedicalInfo: string;
  consentMedicalStatus: string;
  consentCity: string;
  consentDate: string;
  consentSignature: string;
  preferredDate: string;
  preferredTime: string;
  psychologistName: string;
  location: LocationType;
};

const PSYCHOLOGISTS = [
  { name: "Tria Khusni Barokah, M.Psi., Psikolog", fee: 300000, types: ["child"] as ConsultationType[] },
  { name: "Retno Rahayu, M.Psi., Psikolog", fee: 300000, types: ["child", "adult", "family"] as ConsultationType[] },
  { name: "Dr. Yeni Triwahyuningsih, S.Psi., MM., Psikolog", fee: 400000, types: ["child", "adult", "family"] as ConsultationType[] },
  { name: "Ridwan Rahmawan, S.Psi., M.H., Psikolog", fee: 300000, types: ["adult"] as ConsultationType[] },
];

const PSYCHOLOGIST_PROFILES = [
  "Dr. Yeni Triwahyuningsih, S.Psi., MM., Psikolog",
  "Retno Rahayu, M.Psi., Psikolog",
  "Tria Khusni Barokah, M.Psi., Psikolog",
  "Ridwan Rahmawan, S.Psi., M.H., Psikolog",
].map((name) => ({
  name,
  sipp: "Nomor SIPP menyusul",
  description: "Deskripsi singkat psikolog akan ditambahkan.",
}));

const CONSULTATION_TYPES = [
  {
    value: "child",
    label: "Perkembangan anak & remaja",
    hint: "Kurang dari 17 tahun",
    note: "Sudah termasuk skrining, rujukan intervensi, dan surat keterangan (jika diperlukan)*",
  },
  { value: "adult", label: "Permasalahan pribadi", hint: "Dewasa" },
  { value: "family", label: "Permasalahan keluarga", hint: "Keluarga" },
] satisfies Array<{ value: ConsultationType; label: string; hint: string; note?: string }>;

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

const formatScheduleOption = (dateString: string, timeSlot: string) => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const formattedDate = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return `${formattedDate}, Pukul ${timeSlot}`;
};

const formatScheduleDate = (dateString: string) => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
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
    gender: "",
    address: "",
    email: "",
    whatsappNumber: "",
    occupation: "",
    religion: "",
    mainConcern: "",
    concernHistory: "",
    consultationType: "",
    fatherName: "",
    motherName: "",
    fatherOccupation: "",
    motherOccupation: "",
    fatherWhatsapp: "",
    motherWhatsapp: "",
    guardianName: "",
    guardianOccupation: "",
    guardianWhatsapp: "",
    guardianRelation: "",
    childName: "",
    childBirthDate: "",
    pregnancyBirthNotes: "",
    birthAgeMonths: "",
    birthWeightKg: "",
    birthLengthCm: "",
    previousDiagnosis: "",
    consentName: "",
    consentAddress: "",
    consentPhone: "",
    consentAge: "",
    consentRole: "",
    consentMedicalInfo: "",
    consentMedicalStatus: "",
    consentCity: "",
    consentDate: formatDateInput(new Date()),
    consentSignature: "",
    preferredDate: "",
    preferredTime: "",
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
  const today = useMemo(() => formatDateInput(new Date()), []);
  const maxBookingDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return formatDateInput(date);
  }, []);
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
  const scheduleDateOptions = useMemo(() => {
    if (!availabilityData?.scheduleSlots?.length) return [];
    const dates = new Map<string, { date: string; label: string; hasAvailable: boolean }>();
    availabilityData.scheduleSlots
      .filter((slot) => slot.scheduleDate >= today && slot.scheduleDate <= maxBookingDate)
      .forEach((slot) => {
        const current = dates.get(slot.scheduleDate);
        dates.set(slot.scheduleDate, {
          date: slot.scheduleDate,
          label: formatScheduleDate(slot.scheduleDate),
          hasAvailable: Boolean(current?.hasAvailable || slot.isAvailable),
        });
      });
    return Array.from(dates.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [availabilityData, maxBookingDate, today]);

  const availableScheduleOptions = useMemo(() => {
    if (!form.preferredDate || !availabilityData?.scheduleSlots?.length) return [];
    const unique = new Map<string, ScheduleSlot>();
    availabilityData.scheduleSlots
      .filter((slot) => slot.isAvailable && slot.scheduleDate === form.preferredDate)
      .forEach((slot) => {
        const key = `${slot.scheduleDate}|${slot.timeSlot}`;
        if (!unique.has(key)) unique.set(key, slot);
      });

    return Array.from(unique.values())
      .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot))
      .map((slot) => ({
        value: `${slot.scheduleDate}|${slot.timeSlot}`,
        date: slot.scheduleDate,
        time: slot.timeSlot,
        label: formatScheduleOption(slot.scheduleDate, slot.timeSlot),
      }));
  }, [availabilityData, form.preferredDate]);
  const availableTimeSlots = useMemo(() => {
    return availableScheduleOptions
      .filter((option) => !form.preferredDate || option.date === form.preferredDate)
      .map((option) => option.time);
  }, [availableScheduleOptions, form.preferredDate]);
  const availableLocations = useMemo(() => {
    if (!form.preferredTime || dateScheduleSlots.length === 0) return LOCATIONS;
    const offlineLocations = new Set(
      dateScheduleSlots
        .filter((slot) => slot.timeSlot === form.preferredTime && slot.location !== "online")
        .map((slot) => slot.location),
    );
    return LOCATIONS.filter((location) => location.value === "online" || offlineLocations.has(location.value));
  }, [dateScheduleSlots, form.preferredTime]);
  const selectedScheduleLabel = form.preferredDate && form.preferredTime
    ? formatScheduleOption(form.preferredDate, form.preferredTime)
    : "-";
  const updateField = (field: keyof BookingForm, value: string) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "consultationType") {
        next.psychologistName = "";
        next.preferredDate = "";
        next.preferredTime = "";
        next.location = "online";
        if (value !== "child") {
          next.fatherName = "";
          next.motherName = "";
          next.fatherOccupation = "";
          next.motherOccupation = "";
          next.fatherWhatsapp = "";
          next.motherWhatsapp = "";
          next.guardianName = "";
          next.guardianOccupation = "";
          next.guardianWhatsapp = "";
          next.guardianRelation = "";
          next.childName = "";
          next.childBirthDate = "";
          next.pregnancyBirthNotes = "";
          next.birthAgeMonths = "";
          next.birthWeightKg = "";
          next.birthLengthCm = "";
          next.previousDiagnosis = "";
        }
        next.consentName = "";
        next.consentAddress = "";
        next.consentPhone = "";
        next.consentAge = "";
        next.consentRole = "";
        next.consentMedicalInfo = "";
        next.consentMedicalStatus = "";
        next.consentCity = "";
        next.consentDate = formatDateInput(new Date());
        next.consentSignature = "";
      }
      if (field === "psychologistName") {
        next.preferredDate = "";
        next.preferredTime = "";
        next.location = "online";
      }
      if (field === "preferredDate") {
        next.preferredTime = "";
        next.location = "online";
      }
      return next;
    });
  };

  useEffect(() => {
    if (!availableLocations.some((location) => location.value === form.location)) {
      updateField("location", "online");
    }
  }, [availableLocations, form.location]);

  const updateScheduleChoice = (value: string) => {
    const [preferredDate, preferredTime] = value.split("|");
    setForm((current) => ({
      ...current,
      preferredDate: preferredDate || "",
      preferredTime: preferredTime || "",
      location: "online",
    }));
  };

  const createBookingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedService) throw new Error("Pilih layanan terlebih dahulu");
      if (!selectedPsychologist) throw new Error("Pilih psikolog terlebih dahulu");

      const bookingResponse = await apiRequest("POST", "/api/bookings", {
        serviceId: selectedService.id,
        ...buildBookingPayload(form, user),
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

  const validateStep = (stepToValidate = step) => {
    if (stepToValidate === 0) {
      if (!form.consultationType) return "Pilih jenis konsultasi.";
    }

    if (stepToValidate === 1) {
      if (form.consultationType === "child") {
        if (!form.fatherName || !form.motherName || !form.fatherOccupation || !form.motherOccupation || !form.fatherWhatsapp || !form.motherWhatsapp) {
          return "Lengkapi data ayah/wali, ibu, pekerjaan, dan nomor WhatsApp.";
        }
        if (!form.childName || !form.pregnancyBirthNotes || !form.birthAgeMonths || !form.birthWeightKg || !form.birthLengthCm || !form.mainConcern) {
          return "Lengkapi data anak, proses kelahiran, ukuran lahir, dan keluhan awal.";
        }
        if (!/^[0-9]+$/.test(form.fatherWhatsapp) || !/^[0-9]+$/.test(form.motherWhatsapp) || (form.guardianWhatsapp && !/^[0-9]+$/.test(form.guardianWhatsapp))) {
          return "Nomor WhatsApp hanya boleh angka.";
        }
        return "";
      }

      const name = form.clientName || `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
      const email = form.email || user?.email;
      const whatsapp = form.whatsappNumber || user?.whatsappNumber;
      if (!name || !form.birthDate || !form.gender || !form.address || !email || !whatsapp || !form.occupation || !form.religion || !form.mainConcern) {
        return "Lengkapi nama, tanggal lahir, jenis kelamin, alamat, email, WhatsApp, pekerjaan, agama, dan keluhan saat ini.";
      }
      if (!/^[0-9]+$/.test(whatsapp)) {
        return "Nomor WhatsApp hanya boleh angka.";
      }
    }

    if (stepToValidate === 2) {
      if (!form.consentName || !form.consentAddress || !form.consentPhone || !form.consentAge || !form.consentRole || !form.consentMedicalInfo || !form.consentMedicalStatus || !form.consentCity || !form.consentDate || !form.consentSignature) {
        return "Lengkapi informed consent dan tanda tangan.";
      }
      if (!/^[0-9]+$/.test(form.consentPhone)) {
        return "Nomor telepon/WA informed consent hanya boleh angka.";
      }
    }

    if (stepToValidate === 3) {
      if (!form.preferredDate || !form.preferredTime || !form.psychologistName || !form.location) {
        return "Lengkapi tanggal, psikolog, waktu, dan lokasi.";
      }
      if (!availableTimeSlots.includes(form.preferredTime)) {
        return "Psikolog tidak tersedia pada hari dan jam yang dipilih.";
      }
      if (form.preferredDate < today || form.preferredDate > maxBookingDate) {
        return "Tanggal booking hanya dapat dipilih sampai 30 hari dari hari ini.";
      }
    }

    return "";
  };

  const firstIncompleteStepBefore = (targetStep: number) => {
    for (let index = 0; index < targetStep; index += 1) {
      if (validateStep(index)) return index;
    }
    return -1;
  };

  const canMoveToStep = (targetStep: number) => targetStep <= step || firstIncompleteStepBefore(targetStep) === -1;
  const currentStepError = validateStep();
  const canGoNext = isAuthenticated && !currentStepError;
  const firstIncompleteSubmitStep = firstIncompleteStepBefore(4);
  const canSubmitBooking = isAuthenticated && firstIncompleteSubmitStep === -1 && Boolean(selectedPsychologist);

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

    const error = currentStepError;
    if (error) {
      toast({ title: "Data belum lengkap", description: error, variant: "destructive" });
      return;
    }
    setStep((current) => Math.min(current + 1, 4));
  };

  const handleSubmit = () => {
    const incompleteStep = firstIncompleteStepBefore(4);
    const error = incompleteStep === -1 ? currentStepError : validateStep(incompleteStep);
    if (error) {
      toast({ title: "Data belum lengkap", description: error, variant: "destructive" });
      if (incompleteStep !== -1) setStep(incompleteStep);
      return;
    }
    createBookingMutation.mutate();
  };

  const steps = ["Form A", "Form B", "Informed Consent Form", "Penjadwalan", "Form C"];

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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {steps.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  disabled={!canMoveToStep(index)}
                  onClick={() => {
                    if (canMoveToStep(index)) setStep(index);
                  }}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    step === index
                      ? "border-green-700 bg-green-700 text-white"
                      : index < step
                        ? "border-green-200 bg-green-50 text-green-800"
                        : canMoveToStep(index)
                          ? "border-gray-200 bg-white text-gray-500"
                          : "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {step === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Form A: Jenis Konsultasi</CardTitle>
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
                          {type.note && <p className="text-xs leading-relaxed text-green-700 mt-3">{type.note}</p>}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Form B: Data Diri</CardTitle>
                </CardHeader>
                <CardContent>
                  {form.consultationType === "child" ? (
                    <ChildClientForm form={form} updateField={updateField} />
                  ) : (
                    <GeneralClientForm form={form} user={user} updateField={updateField} />
                  )}
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <ConsentForm form={form} updateField={updateField} />
            )}

            {step === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle>Penjadwalan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <Label>Pilihan psikolog</Label>
                    <div className="grid md:grid-cols-2 gap-4 mt-2">
                      {availablePsychologists.length === 0 ? (
                        <p className="text-sm text-neutral-500">Pilih jenis konsultasi pada Form A terlebih dahulu.</p>
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
                    <Label>Pilihan tanggal</Label>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                      {!form.psychologistName ? (
                        <p className="text-sm text-neutral-500">Pilih psikolog terlebih dahulu.</p>
                      ) : scheduleDateOptions.length === 0 ? (
                      <p className="text-xs text-red-600 mt-2">
                        Jadwal psikolog belum tersedia. Jadwal mengikuti upload ketersediaan pada dashboard psikolog.
                      </p>
                      ) : scheduleDateOptions.map((option) => (
                        <button
                          key={option.date}
                          type="button"
                          disabled={!option.hasAvailable}
                          onClick={() => updateField("preferredDate", option.date)}
                          className={`rounded-lg border p-3 text-left text-sm ${
                            form.preferredDate === option.date
                              ? "border-green-700 bg-green-50 text-green-900"
                              : option.hasAvailable
                                ? "border-gray-200 bg-white hover:border-green-500"
                                : "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Field label="Pilihan sesi tersedia">
                    <select
                      value={form.preferredDate && form.preferredTime ? `${form.preferredDate}|${form.preferredTime}` : ""}
                      onChange={(event) => updateScheduleChoice(event.target.value)}
                      disabled={!form.preferredDate || availableScheduleOptions.length === 0}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">
                        {!form.preferredDate
                          ? "Pilih tanggal terlebih dahulu"
                          : availableScheduleOptions.length === 0
                            ? "Tidak ada sesi tersedia pada tanggal ini"
                            : "Pilih sesi konseling"}
                      </option>
                      {availableScheduleOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    {form.preferredDate && availableScheduleOptions.length === 0 && (
                      <p className="text-xs text-red-600 mt-2">Semua sesi pada tanggal ini sudah terisi atau belum tersedia.</p>
                    )}
                  </Field>

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

            {step === 4 && (
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
                      <span className="font-semibold text-right">{selectedScheduleLabel}</span>
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
              {step < 4 ? (
                <Button onClick={nextStep} className="bg-green-700 hover:bg-green-800" disabled={!canGoNext}>
                  Berikutnya
                </Button>
              ) : (
                <Button onClick={handleSubmit} className="bg-green-700 hover:bg-green-800" disabled={authLoading || createBookingMutation.isPending || !canSubmitBooking}>
                  {createBookingMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Membuat Booking...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Pembayaran
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
                <SummaryRow label="Waktu" value={selectedScheduleLabel} />
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

function GeneralClientForm({
  form,
  user,
  updateField,
}: {
  form: BookingForm;
  user: any;
  updateField: (field: keyof BookingForm, value: string) => void;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
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
      <Field label="Jenis kelamin">
        <select value={form.gender} onChange={(event) => updateField("gender", event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">Pilih jenis kelamin</option>
          <option value="Laki-laki">Laki-laki</option>
          <option value="Perempuan">Perempuan</option>
        </select>
      </Field>
      <Field label="Alamat" className="md:col-span-2">
        <Textarea rows={3} value={form.address} onChange={(event) => updateField("address", event.target.value)} />
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
      <Field label="Pekerjaan saat ini (untuk klien usia di atas 17 tahun)">
        <Input value={form.occupation} onChange={(event) => updateField("occupation", event.target.value)} />
      </Field>
      <Field label="Agama">
        <Input value={form.religion} onChange={(event) => updateField("religion", event.target.value)} />
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
    </div>
  );
}

function ChildClientForm({
  form,
  updateField,
}: {
  form: BookingForm;
  updateField: (field: keyof BookingForm, value: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-neutral-900">Data diri Orang tua/wali</h3>
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <Field label="Nama Ayah/wali">
            <Input value={form.fatherName} onChange={(event) => updateField("fatherName", event.target.value)} />
          </Field>
          <Field label="Nama Ibu">
            <Input value={form.motherName} onChange={(event) => updateField("motherName", event.target.value)} />
          </Field>
          <Field label="Pekerjaan Ayah">
            <Input value={form.fatherOccupation} onChange={(event) => updateField("fatherOccupation", event.target.value)} />
          </Field>
          <Field label="Pekerjaan Ibu">
            <Input value={form.motherOccupation} onChange={(event) => updateField("motherOccupation", event.target.value)} />
          </Field>
          <Field label="Nomor WA Ayah">
            <Input inputMode="numeric" value={form.fatherWhatsapp} onChange={(event) => updateField("fatherWhatsapp", event.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Nomor WA Ibu">
            <Input inputMode="numeric" value={form.motherWhatsapp} onChange={(event) => updateField("motherWhatsapp", event.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Nama Wali (bila tidak ada ayah/ibu)">
            <Input value={form.guardianName} onChange={(event) => updateField("guardianName", event.target.value)} />
          </Field>
          <Field label="Pekerjaan Wali">
            <Input value={form.guardianOccupation} onChange={(event) => updateField("guardianOccupation", event.target.value)} />
          </Field>
          <Field label="Nomor WA Wali">
            <Input inputMode="numeric" value={form.guardianWhatsapp} onChange={(event) => updateField("guardianWhatsapp", event.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Relasi dengan client (wali)">
            <Input value={form.guardianRelation} onChange={(event) => updateField("guardianRelation", event.target.value)} />
          </Field>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-neutral-900">Data diri Anak</h3>
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <Field label="Nama anak">
            <Input value={form.childName} onChange={(event) => updateField("childName", event.target.value)} />
          </Field>
          <Field label="Umur kelahiran (bulan)">
            <Input inputMode="decimal" value={form.birthAgeMonths} onChange={(event) => updateField("birthAgeMonths", event.target.value)} />
          </Field>
          <Field label="Berat badan lahir (kilogram)">
            <Input inputMode="decimal" value={form.birthWeightKg} onChange={(event) => updateField("birthWeightKg", event.target.value)} />
          </Field>
          <Field label="Panjang badan lahir (centimeter)">
            <Input inputMode="decimal" value={form.birthLengthCm} onChange={(event) => updateField("birthLengthCm", event.target.value)} />
          </Field>
          <Field label="Proses kelahiran dan catatan khusus anak selama masa kandungan" className="md:col-span-2">
            <Textarea rows={4} value={form.pregnancyBirthNotes} onChange={(event) => updateField("pregnancyBirthNotes", event.target.value)} />
          </Field>
          <Field label="Keluhan awal" className="md:col-span-2">
            <Textarea rows={5} value={form.mainConcern} onChange={(event) => updateField("mainConcern", event.target.value)} />
          </Field>
          <Field label="Diagnosa anak dari ahli sebelumnya" className="md:col-span-2">
            <Textarea rows={3} value={form.previousDiagnosis} placeholder="Opsional, isi jika ada." onChange={(event) => updateField("previousDiagnosis", event.target.value)} />
          </Field>
        </div>
      </div>
    </div>
  );
}

function ConsentForm({
  form,
  updateField,
}: {
  form: BookingForm;
  updateField: (field: keyof BookingForm, value: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Informed Consent Form</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border bg-white p-4 text-sm leading-relaxed text-neutral-700 space-y-3">
          <p>Saya bertanda tangan di bawah ini mewakili diri sendiri/sebagai orangtua wali.</p>
          <p>Saya dalam hal ini bertindak sebagai saya sendiri/orangtua/wali/keluarga klien telah mendapatkan penjelasan dan informasi mengenai tindakan psikologi, dan saya secara sukarela bersedia sepenuhnya mendapatkan layanan/terapi psikologi klinis tersebut.</p>
          <p>Saya memahami sepenuhnya dan saya tidak akan mengajukan komplain maupun tuntutan hukum sehubungan dengan hasil maupun tindakan tersebut.</p>
          <p>Saya sepenuhnya setuju dengan layanan tindakan/terapi psikologi klinis, dan saya akan mematuhi segala hal yang sudah dijelaskan.</p>
          <p>Saya mengijinkan psikolog klinis untuk menyentuh bagian tubuh tertentu (kepala, bahu, tangan) sebagai bagian dari tindakan/terapi psikologi klinis.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Nama">
            <Input value={form.consentName} onChange={(event) => updateField("consentName", event.target.value)} />
          </Field>
          <Field label="Alamat rumah">
            <Input value={form.consentAddress} onChange={(event) => updateField("consentAddress", event.target.value)} />
          </Field>
          <Field label="No telp/WA">
            <Input inputMode="numeric" value={form.consentPhone} onChange={(event) => updateField("consentPhone", event.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Usia">
            <Input inputMode="numeric" value={form.consentAge} onChange={(event) => updateField("consentAge", event.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Bertindak sebagai">
            <select value={form.consentRole} onChange={(event) => updateField("consentRole", event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Pilih</option>
              <option value="Diri sendiri">Diri sendiri</option>
              <option value="Orangtua/wali">Orangtua/wali</option>
              <option value="Keluarga klien">Keluarga klien</option>
            </select>
          </Field>
          <Field label="Kota">
            <Input value={form.consentCity} onChange={(event) => updateField("consentCity", event.target.value)} />
          </Field>
          <Field label="Tanggal">
            <Input type="date" value={form.consentDate} onChange={(event) => updateField("consentDate", event.target.value)} />
          </Field>
        </div>

        <div className="space-y-3 rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-neutral-900">
            Saya memahami bahwa jika ada diagnosa medis yang lain, saya menginformasikan dengan jelas kepada psikolog klinis: <span className="text-red-600">*</span>
          </p>
          <ConsentCheckbox
            checked={Boolean(form.consentMedicalInfo)}
            label="Saya/yang saya wakili tidak memiliki penyakit medis yang gawat"
            onChange={(checked) => updateField("consentMedicalInfo", checked ? "Saya/yang saya wakili tidak memiliki penyakit medis yang gawat" : "")}
          />
          <ConsentCheckbox
            checked={Boolean(form.consentMedicalStatus)}
            label="Saya/yang saya wakili telah mendapatkan rujukan dari dokter bahwa saya dapat menerima tindakan/terapi psikologi klinis"
            onChange={(checked) => updateField("consentMedicalStatus", checked ? "Saya/yang saya wakili telah mendapatkan rujukan dari dokter bahwa saya dapat menerima tindakan/terapi psikologi klinis" : "")}
          />
        </div>

        <SignaturePad value={form.consentSignature} onChange={(value) => updateField("consentSignature", value)} />
      </CardContent>
    </Card>
  );
}

function ConsentCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 text-sm leading-relaxed text-neutral-700 transition-colors hover:border-green-300 hover:bg-green-50/50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-700 focus:ring-green-700"
      />
      <span>{label}</span>
    </label>
  );
}

function SignaturePad({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  const getPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const beginDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    const point = getPoint(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const draw = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const point = getPoint(event);
    context.lineWidth = 2;
    context.lineCap = "round";
    context.strokeStyle = "#166534";
    context.lineTo(point.x, point.y);
    context.stroke();
    onChange(canvas.toDataURL("image/png"));
  };

  const endDrawing = () => {
    drawingRef.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>Tanda tangan</Label>
        <Button type="button" variant="outline" size="sm" onClick={clear}>Hapus</Button>
      </div>
      <canvas
        ref={canvasRef}
        width={640}
        height={180}
        onPointerDown={beginDrawing}
        onPointerMove={draw}
        onPointerUp={endDrawing}
        onPointerLeave={endDrawing}
        className="h-44 w-full rounded-lg border bg-white touch-none"
      />
      {!value && <p className="text-xs text-neutral-500">Gambar tanda tangan di area ini.</p>}
    </div>
  );
}

function buildBookingPayload(form: BookingForm, user: any) {
  if (form.consultationType === "child") {
    const parentWhatsapp = form.fatherWhatsapp || form.motherWhatsapp || form.guardianWhatsapp || user?.whatsappNumber || "";
    return {
      ...form,
      clientName: form.childName,
      birthDate: "",
      email: form.email || user?.email,
      whatsappNumber: parentWhatsapp,
      childBirthDate: "",
      concernHistory: [formatChildConcernHistory(form), formatConsentHistory(form)].join("\n\n"),
    };
  }

  return {
    ...form,
    clientName: form.clientName || `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim(),
    email: form.email || user?.email,
    whatsappNumber: form.whatsappNumber || user?.whatsappNumber,
    concernHistory: [formatGeneralConcernHistory(form), formatConsentHistory(form)].filter(Boolean).join("\n\n"),
  };
}

function formatGeneralConcernHistory(form: BookingForm) {
  return [
    "Data Klien",
    `Jenis kelamin: ${form.gender || "-"}`,
    `Alamat: ${form.address || "-"}`,
    `Pekerjaan saat ini: ${form.occupation || "-"}`,
    `Agama: ${form.religion || "-"}`,
    "",
    "Riwayat keluhan",
    form.concernHistory || "-",
  ].join("\n");
}

function formatChildConcernHistory(form: BookingForm) {
  return [
    "Data Orang tua/wali",
    `Nama Ayah/wali: ${form.fatherName || "-"}`,
    `Nama Ibu: ${form.motherName || "-"}`,
    `Pekerjaan Ayah: ${form.fatherOccupation || "-"}`,
    `Pekerjaan Ibu: ${form.motherOccupation || "-"}`,
    `Nomor WA Ayah: ${form.fatherWhatsapp || "-"}`,
    `Nomor WA Ibu: ${form.motherWhatsapp || "-"}`,
    `Nama Wali: ${form.guardianName || "-"}`,
    `Pekerjaan Wali: ${form.guardianOccupation || "-"}`,
    `Nomor WA Wali: ${form.guardianWhatsapp || "-"}`,
    `Relasi dengan Client (wali): ${form.guardianRelation || "-"}`,
    "",
    "Data Anak",
    `Nama anak: ${form.childName || "-"}`,
    `Proses kelahiran/catatan kandungan: ${form.pregnancyBirthNotes || "-"}`,
    `Umur kelahiran: ${form.birthAgeMonths || "-"} bulan`,
    `Berat badan lahir: ${form.birthWeightKg || "-"} kg`,
    `Panjang badan lahir: ${form.birthLengthCm || "-"} cm`,
  ].join("\n");
}

function formatConsentHistory(form: BookingForm) {
  return [
    "Informed Consent Form",
    `Nama: ${form.consentName || "-"}`,
    `Alamat rumah: ${form.consentAddress || "-"}`,
    `No telp/WA: ${form.consentPhone || "-"}`,
    `Usia: ${form.consentAge || "-"}`,
    `Bertindak sebagai: ${form.consentRole || "-"}`,
    "Pernyataan diagnosa medis lain:",
    `1. ${form.consentMedicalInfo || "-"}`,
    `2. ${form.consentMedicalStatus || "-"}`,
    `Kota/Tanggal: ${form.consentCity || "-"}, ${form.consentDate || "-"}`,
    `Tanda tangan digital: ${form.consentSignature || "-"}`,
  ].join("\n");
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
                  <HeroMetric label="Jadwal" value="Maks. 30 hari" />
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
                description="Pilih tanggal maksimal 30 hari dari hari booking, waktu, lokasi, dan psikolog."
              />
              <ProcessStep
                icon={<CreditCard className="w-7 h-7" />}
                title="4. Pembayaran"
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
                href="https://wa.me/6285117658242"
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
