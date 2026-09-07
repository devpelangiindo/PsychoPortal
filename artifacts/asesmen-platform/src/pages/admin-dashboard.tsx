import { useMutation, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Activity, User, Settings, LogOut, CalendarCheck, UserPlus, KeyRound, ShoppingBag, BookOpen, Newspaper, Presentation, Megaphone, Building2, HeartHandshake, ClipboardList, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getAuthToken } from "@/lib/queryClient";
import logoPath from "@assets/Logo_Rumah_Psikologi_Pelangi_Indonesia_1752037860440.png";

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  completedAssessments: number;
  inProgressAssessments: number;
  assessmentTypeStats: {
    type: string;
    name: string;
    count: number;
    revenue: number;
  }[];
}
const psychologists = [
  { name: "Tria Khusni Barokah, M.Psi., Psikolog", types: ["child"] },
  { name: "Retno Rahayu, M.Psi., Psikolog", types: ["child", "adult", "family"] },
  { name: "Dr. Yeni Triwahyuningsih, S.Psi., MM., Psikolog", types: ["child", "adult", "family"] },
  { name: "Ridwan Rahmawan, S.Psi., M.H., Psikolog", types: ["adult"] },
];

type PsychologistOption = {
  name: string;
  types: string[];
};

const consultationTypes = [
  { value: "child", label: "Anak/remaja" },
  { value: "adult", label: "Pribadi dewasa" },
  { value: "family", label: "Keluarga" },
];

const adminInputClass = "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100";

type ManualBookingForm = {
  clientName: string;
  birthDate: string;
  gender: string;
  age: string;
  email: string;
  whatsappNumber: string;
  mainConcern: string;
  concernHistory: string;
  consultationType: string;
  childName: string;
  childBirthDate: string;
  previousDiagnosis: string;
  preferredDate: string;
  startTime: string;
  endTime: string;
  psychologistName: string;
  location: string;
  markAsPaid: boolean;
};

const defaultManualBookingForm: ManualBookingForm = {
  clientName: "",
  birthDate: "",
  gender: "",
  age: "",
  email: "",
  whatsappNumber: "",
  mainConcern: "",
  concernHistory: "",
  consultationType: "adult",
  childName: "",
  childBirthDate: "",
  previousDiagnosis: "",
  preferredDate: "",
  startTime: "08:00",
  endTime: "10:00",
  psychologistName: "Dr. Yeni Triwahyuningsih, S.Psi., MM., Psikolog",
  location: "online",
  markAsPaid: true,
};

function calculateManualBookingAge(birthDateValue: string, referenceDateValue?: string) {
  if (!birthDateValue) return null;
  const birthDate = new Date(`${birthDateValue}T00:00:00`);
  const referenceDate = referenceDateValue ? new Date(`${referenceDateValue}T00:00:00`) : new Date();
  if (Number.isNaN(birthDate.getTime()) || Number.isNaN(referenceDate.getTime())) return null;
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDifference = referenceDate.getMonth() - birthDate.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && referenceDate.getDate() < birthDate.getDate())) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

export default function AdminDashboard({ mode = "admin" }: { mode?: "admin" | "cso" }) {
  const { toast } = useToast();
  const [manualForm, setManualForm] = useState<ManualBookingForm>(defaultManualBookingForm);
  const isCsoMode = mode === "cso";

  const token = localStorage.getItem('adminToken');
  const storedAdminUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("adminUser") || "null") as { role?: string } | null;
    } catch {
      return null;
    }
  })();
  const storedRole = storedAdminUser?.role;

  useEffect(() => {
    if (!isCsoMode && (storedRole === "cso" || storedRole === "internal")) {
      window.location.href = "/cso/dashboard";
    }
  }, [isCsoMode, storedRole]);
  
  const { data: stats, isLoading, error } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    retry: false,
    enabled: !!token && !isCsoMode && storedRole !== "cso" && storedRole !== "internal", // CSO does not access admin-super stats
    queryFn: async ({ queryKey }) => {
      const adminToken = localStorage.getItem('adminToken');
      if (!adminToken) {
        throw new Error('Token admin tidak ditemukan. Silakan login ulang.');
      }
      
      const res = await fetch(queryKey[0] as string, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Token admin tidak ditemukan. Silakan login ulang.');
        }
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      
      return await res.json();
    },
  });

  const { data: psychologistOptions = psychologists } = useQuery<PsychologistOption[]>({
    queryKey: ["/api/psychologists"],
  });

  // Debug: Check if token exists
  console.log('Admin Dashboard Debug:', { 
    token: token ? 'EXISTS' : 'MISSING', 
    tokenLength: token?.length,
    error: error?.message,
    stats,
    isLoading 
  });

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    toast({
      title: "Berhasil",
      description: "Logout berhasil.",
    });
    window.location.href = "/admin/login";
  };

  const manualBookingMutation = useMutation({
    mutationFn: async () => {
      if (!getAuthToken()) throw new Error("Token login tidak ditemukan. Silakan login ulang.");

      const response = await apiRequest("POST", "/api/admin/manual-counseling-bookings", {
        clientName: manualForm.clientName,
        birthDate: manualForm.birthDate,
        gender: manualForm.gender,
        age: Number(manualForm.age),
        email: manualForm.email,
        whatsappNumber: manualForm.whatsappNumber.replace(/\D/g, ""),
        mainConcern: manualForm.mainConcern,
        concernHistory: manualForm.concernHistory,
        consultationType: manualForm.consultationType,
        childName: manualForm.childName,
        childBirthDate: manualForm.childBirthDate,
        previousDiagnosis: manualForm.previousDiagnosis,
        preferredDate: manualForm.preferredDate,
        preferredTime: `${manualForm.startTime.replace(":", ".")} - ${manualForm.endTime.replace(":", ".")}`,
        psychologistName: manualForm.psychologistName,
        location: manualForm.location,
        markAsPaid: manualForm.markAsPaid,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Booking manual tersimpan",
        description: data?.message || "Data klien konseling berhasil ditambahkan.",
      });
      setManualForm(defaultManualBookingForm);
    },
    onError: (error) => {
      toast({
        title: "Gagal menyimpan booking manual",
        description: error instanceof Error ? error.message : "Silakan cek data dan coba lagi.",
        variant: "destructive",
      });
    },
  });

  const updateManualForm = (field: keyof ManualBookingForm, value: string | boolean) => {
    setManualForm((current) => {
      const next = { ...current, [field]: value };
      if ((field === "birthDate" || field === "preferredDate") && typeof value === "string") {
        const birthDate = field === "birthDate" ? value : next.birthDate;
        const referenceDate = field === "preferredDate" ? value : next.preferredDate;
        const calculatedAge = calculateManualBookingAge(birthDate, referenceDate);
        if (calculatedAge !== null) next.age = String(calculatedAge);
      }
      if (field === "consultationType" && typeof value === "string") {
        const firstMatch = psychologistOptions.find((psychologist) => psychologist.types.includes(value));
        next.psychologistName = firstMatch?.name || "";
      }
      return next;
    });
  };

  const manualPsychologistOptions = psychologistOptions.filter((psychologist) => psychologist.types.includes(manualForm.consultationType));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <img 
                src={logoPath} 
                alt="Rumah Psikologi Pelangi Indonesia" 
                className="h-10 w-10 object-contain"
              />
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {isCsoMode ? "CSO Dashboard" : "Admin Dashboard"}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isCsoMode ? "Panel input klien offline/manual" : "Panel Administrasi Rumah Psikologi Pelangi Indonesia"}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        {!isCsoMode && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">
                Total Pengguna
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Users className="w-8 h-8 opacity-80" />
                <div className="ml-4">
                  <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">
                Pengguna Aktif
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Activity className="w-8 h-8 opacity-80" />
                <div className="ml-4">
                  <div className="text-2xl font-bold">{stats?.activeUsers || 0}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">
                Tes Selesai
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <FileText className="w-8 h-8 opacity-80" />
                <div className="ml-4">
                  <div className="text-2xl font-bold">{stats?.completedAssessments || 0}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">
                Tes Berlangsung
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Settings className="w-8 h-8 opacity-80" />
                <div className="ml-4">
                  <div className="text-2xl font-bold">{stats?.inProgressAssessments || 0}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>}

        {/* Quick Actions */}
        <div className={`grid grid-cols-1 ${isCsoMode ? "md:grid-cols-3" : "md:grid-cols-3 lg:grid-cols-6"} gap-6`}>
          {!isCsoMode && (
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-indigo-700" />Analytics Website</CardTitle>
              <CardDescription>Analisis pengunjung, konten populer, sumber trafik, CTA, dan konversi</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/website-analytics">
                <Button className="w-full bg-indigo-700 hover:bg-indigo-800">Lihat Analytics</Button>
              </Link>
            </CardContent>
          </Card>
          )}

          {!isCsoMode && (
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Manajemen Pengguna
              </CardTitle>
              <CardDescription>
                Kelola pengguna, status akun, dan reset password
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/users">
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  Kelola Pengguna
                </Button>
              </Link>
            </CardContent>
          </Card>
          )}

          {!isCsoMode && (
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-emerald-700" />Produk Fisik</CardTitle>
              <CardDescription>Kelola katalog, stok, pesanan, pengiriman, dan resi</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/physical-products">
                <Button className="w-full bg-emerald-700 hover:bg-emerald-800">Kelola Produk Fisik</Button>
              </Link>
            </CardContent>
          </Card>
          )}

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-rose-600" />Tes Eksternal</CardTitle>
              <CardDescription>Kelola token tes dan unggah hasil klien</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={isCsoMode ? "/cso/external-assessments" : "/admin/external-assessments"}>
                <Button className="w-full bg-rose-600 hover:bg-rose-700">Kelola Tes</Button>
              </Link>
            </CardContent>
          </Card>

          {!isCsoMode && (
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-amber-600" />Produk Digital</CardTitle>
              <CardDescription>Kelola katalog, gambar, file, dan link produk</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/digital-products">
                <Button className="w-full bg-amber-600 hover:bg-amber-700">Kelola Produk</Button>
              </Link>
            </CardContent>
          </Card>
          )}

          {!isCsoMode && (
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Presentation className="w-5 h-5 text-violet-700" />Pelatihan</CardTitle>
              <CardDescription>Kelola agenda, pilihan harga, peserta, testimoni, dan galeri</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/trainings">
                <Button className="w-full bg-violet-700 hover:bg-violet-800">Kelola Pelatihan</Button>
              </Link>
            </CardContent>
          </Card>
          )}

          {!isCsoMode && (
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5 text-sky-700" />Asesmen Onsite</CardTitle>
              <CardDescription>Kelola layanan, harga, urutan, status, dan gambar katalog Asesmen Onsite</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/onsite-assessments">
                <Button className="w-full bg-sky-700 hover:bg-sky-800">Kelola Onsite</Button>
              </Link>
            </CardContent>
          </Card>
          )}

          {!isCsoMode && (
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ClipboardList className="w-5 h-5 text-amber-700" />Alat Tes Psikologi</CardTitle>
              <CardDescription>Kelola kategori, detail, harga, urutan, status, dan gambar katalog alat tes</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/psychology-test-tools">
                <Button className="w-full bg-amber-700 hover:bg-amber-800">Kelola Alat Tes</Button>
              </Link>
            </CardContent>
          </Card>
          )}

          {!isCsoMode && (
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-emerald-600" />Kursus</CardTitle>
              <CardDescription>Kelola jenis, detail, urutan, dan foto kursus</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/courses">
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700">Kelola Kursus</Button>
              </Link>
            </CardContent>
          </Card>
          )}

          {!isCsoMode && (
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HeartHandshake className="w-5 h-5 text-teal-700" />Kelola Terapi</CardTitle>
              <CardDescription>Kelola kategori, jenis layanan, detail, gambar, dan galeri terapi</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/therapies">
                <Button className="w-full bg-teal-700 hover:bg-teal-800">Kelola Terapi</Button>
              </Link>
            </CardContent>
          </Card>
          )}

          {!isCsoMode && (
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5 text-stone-700" />Hospitality Services</CardTitle>
              <CardDescription>Kelola layanan, harga, foto, dan galeri Hospitality Services</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/hospitality">
                <Button className="w-full bg-stone-700 hover:bg-stone-800">Kelola Hospitality</Button>
              </Link>
            </CardContent>
          </Card>
          )}

          {!isCsoMode && (
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Megaphone className="w-5 h-5 text-fuchsia-700" />Promo Booking</CardTitle>
              <CardDescription>Kelola Promo & Info pada halaman Booking Konseling</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/booking-promos">
                <Button className="w-full bg-fuchsia-700 hover:bg-fuchsia-800">Kelola Promo</Button>
              </Link>
            </CardContent>
          </Card>
          )}

          {!isCsoMode && (
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Newspaper className="w-5 h-5 text-cyan-700" />Artikel</CardTitle>
              <CardDescription>Kelola tulisan, status terbit, dan gambar artikel</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/articles">
                <Button className="w-full bg-cyan-700 hover:bg-cyan-800">Kelola Artikel</Button>
              </Link>
            </CardContent>
          </Card>
          )}

          {!isCsoMode && (
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600" />
                Hasil Asesmen
              </CardTitle>
              <CardDescription>
                Lihat semua hasil asesmen dan ekspor data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/assessments">
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  Lihat Hasil
                </Button>
              </Link>
            </CardContent>
          </Card>
          )}

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-emerald-600" />
                Booking Psikolog
              </CardTitle>
              <CardDescription>
                Review booking konsultasi dari semua psikolog
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={isCsoMode ? "/cso/bookings" : "/admin/bookings"}>
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                  Lihat Booking
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-teal-600" />
                Klien Manual
              </CardTitle>
              <CardDescription>
                Tambahkan klien konseling dari pendaftaran offline/CSO
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a href="#manual-counseling-booking">
                <Button className="w-full bg-teal-600 hover:bg-teal-700">
                  Tambah Manual
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>

        <Card id="manual-counseling-booking" className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-teal-600" />
              Tambah Klien Konseling Manual
            </CardTitle>
            <CardDescription>
              Untuk booking yang tidak melalui website. Jika email sudah terdaftar, booking akan terhubung ke akun klien tersebut.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <ManualField label="Nama klien">
                <input className={adminInputClass} value={manualForm.clientName} onChange={(event) => updateManualForm("clientName", event.target.value)} />
              </ManualField>
              <ManualField label="Tanggal lahir">
                <input type="date" className={adminInputClass} value={manualForm.birthDate} onChange={(event) => updateManualForm("birthDate", event.target.value)} />
              </ManualField>
              <ManualField label="Jenis kelamin">
                <select className={adminInputClass} value={manualForm.gender} onChange={(event) => updateManualForm("gender", event.target.value)}>
                  <option value="">Pilih jenis kelamin</option>
                  <option value="male">Laki-laki</option>
                  <option value="female">Perempuan</option>
                </select>
              </ManualField>
              <ManualField label="Usia saat konseling">
                <input
                  type="number"
                  min="0"
                  max="120"
                  className={adminInputClass}
                  value={manualForm.age}
                  onChange={(event) => updateManualForm("age", event.target.value)}
                  placeholder="Contoh: 25"
                />
              </ManualField>
              <ManualField label="Email">
                <input type="email" className={adminInputClass} value={manualForm.email} onChange={(event) => updateManualForm("email", event.target.value)} />
              </ManualField>
              <ManualField label="Nomor WhatsApp">
                <input className={adminInputClass} value={manualForm.whatsappNumber} onChange={(event) => updateManualForm("whatsappNumber", event.target.value.replace(/\D/g, ""))} placeholder="081234567890" />
              </ManualField>
              <ManualField label="Jenis konsultasi">
                <select className={adminInputClass} value={manualForm.consultationType} onChange={(event) => updateManualForm("consultationType", event.target.value)}>
                  {consultationTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </ManualField>
              <ManualField label="Psikolog">
                <select className={adminInputClass} value={manualForm.psychologistName} onChange={(event) => updateManualForm("psychologistName", event.target.value)}>
                  {manualPsychologistOptions.map((psychologist) => (
                    <option key={psychologist.name} value={psychologist.name}>{psychologist.name}</option>
                  ))}
                </select>
              </ManualField>
            </div>

            {manualForm.consultationType === "child" && (
              <div className="grid md:grid-cols-3 gap-4">
                <ManualField label="Nama anak/remaja">
                  <input className={adminInputClass} value={manualForm.childName} onChange={(event) => updateManualForm("childName", event.target.value)} />
                </ManualField>
                <ManualField label="Tanggal lahir anak">
                  <input type="date" className={adminInputClass} value={manualForm.childBirthDate} onChange={(event) => updateManualForm("childBirthDate", event.target.value)} />
                </ManualField>
                <ManualField label="Diagnosa sebelumnya">
                  <input className={adminInputClass} value={manualForm.previousDiagnosis} onChange={(event) => updateManualForm("previousDiagnosis", event.target.value)} />
                </ManualField>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <ManualField label="Keluhan umum">
                <textarea className={`${adminInputClass} min-h-24`} value={manualForm.mainConcern} onChange={(event) => updateManualForm("mainConcern", event.target.value)} />
              </ManualField>
              <ManualField label="Riwayat keluhan">
                <textarea className={`${adminInputClass} min-h-24`} value={manualForm.concernHistory} onChange={(event) => updateManualForm("concernHistory", event.target.value)} />
              </ManualField>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              <ManualField label="Tanggal konseling">
                <input type="date" className={adminInputClass} value={manualForm.preferredDate} onChange={(event) => updateManualForm("preferredDate", event.target.value)} />
              </ManualField>
              <ManualField label="Waktu">
                <div className="flex items-center gap-2">
                  <input type="time" min="07:00" max="21:00" className={adminInputClass} value={manualForm.startTime} onChange={(event) => updateManualForm("startTime", event.target.value)} />
                  <span className="text-gray-400">-</span>
                  <input type="time" min="07:00" max="21:00" className={adminInputClass} value={manualForm.endTime} onChange={(event) => updateManualForm("endTime", event.target.value)} />
                </div>
              </ManualField>
              <ManualField label="Lokasi">
                <select className={adminInputClass} value={manualForm.location} onChange={(event) => updateManualForm("location", event.target.value)}>
                  <option value="online">Online</option>
                  <option value="colombo">Offline Colombo</option>
                  <option value="bantul">Offline Bantul</option>
                </select>
              </ManualField>
              <ManualField label="Status pembayaran">
                <label className="flex h-10 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm">
                  <input type="checkbox" checked={manualForm.markAsPaid} onChange={(event) => updateManualForm("markAsPaid", event.target.checked)} />
                  Tandai sudah bayar
                </label>
              </ManualField>
            </div>

            <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
              Data manual akan memakai email sebagai kunci integrasi. Jika klien sudah punya akun website, booking masuk ke dashboard klien tersebut.
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => manualBookingMutation.mutate()}
                disabled={manualBookingMutation.isPending || !manualForm.gender || manualForm.age === ""}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {manualBookingMutation.isPending ? "Menyimpan..." : "Simpan Klien Manual"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Aktivitas Terbaru</CardTitle>
            <CardDescription>
              Ringkasan aktivitas sistem dalam 24 jam terakhir
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Sistem berjalan normal</p>
                  <p className="text-xs text-gray-500">Semua layanan aktif dan responsif</p>
                </div>
                <span className="text-xs text-gray-400">Sekarang</span>
              </div>
              
              <div className="flex items-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Database backup berhasil</p>
                  <p className="text-xs text-gray-500">Backup otomatis telah selesai</p>
                </div>
                <span className="text-xs text-gray-400">1 jam lalu</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ManualField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
