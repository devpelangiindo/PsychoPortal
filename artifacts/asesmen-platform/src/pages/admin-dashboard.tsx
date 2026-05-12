import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Activity, TrendingUp, User, Settings, LogOut, CalendarCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import logoPath from "@assets/Logo_Rumah_Psikologi_Pelangi_Indonesia_1752037860440.png";

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  completedAssessments: number;
  inProgressAssessments: number;
  totalRevenue: number;
  assessmentTypeStats: {
    type: string;
    name: string;
    count: number;
    revenue: number;
  }[];
}

export default function AdminDashboard() {
  const { toast } = useToast();

  const token = localStorage.getItem('adminToken');
  
  const { data: stats, isLoading, error } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    retry: false,
    enabled: !!token, // Only run query if token exists
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

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
                  Admin Dashboard
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Panel Administrasi Rumah Psikologi Pelangi Indonesia</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
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

          <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">
                Total Pendapatan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <TrendingUp className="w-8 h-8 opacity-80" />
                <div className="ml-4">
                  <div className="text-xl font-bold">{formatCurrency(stats?.totalRevenue || 0)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                Laporan & Analisis
              </CardTitle>
              <CardDescription>
                Analisis data dan laporan statistik
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/reports">
                <Button className="w-full bg-purple-600 hover:bg-purple-700">
                  Lihat Laporan
                </Button>
              </Link>
            </CardContent>
          </Card>

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
              <Link href="/psychologist/dashboard">
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                  Lihat Booking
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

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
