import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { CalendarCheck, Check, CreditCard, Loader2, MessageCircle, UserRound } from "lucide-react";
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

export default function Booking() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
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
    if (!authLoading && !isAuthenticated) {
      setLocation("/login?redirect=/booking");
    }
  }, [authLoading, isAuthenticated, setLocation]);

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
              <Button onClick={() => setLocation("/login?redirect=/booking")} className="bg-green-700 hover:bg-green-800">
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
          <Link href="/">
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
                        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {TIME_SLOTS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                      </select>
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
                      {LOCATIONS.map((location) => {
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
                      <span className="font-semibold text-right">{form.preferredDate || "-"} · {form.preferredTime}</span>
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
                <SummaryRow label="Waktu" value={form.preferredDate ? `${form.preferredDate}, ${form.preferredTime}` : "-"} />
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
