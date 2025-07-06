import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Search, Download, BarChart3, Users, FileText, TrendingUp, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReportData {
  totalUsers: number;
  activeUsers: number;
  completedAssessments: number;
  inProgressAssessments: number;
  totalRevenue: number;
  monthlyStats: {
    month: string;
    users: number;
    assessments: number;
    revenue: number;
  }[];
  assessmentTypeStats: {
    type: string;
    name: string;
    count: number;
    revenue: number;
  }[];
}

export default function AdminReports() {
  const [dateRange, setDateRange] = useState("last_30_days");
  const [reportType, setReportType] = useState("overview");
  
  const { toast } = useToast();

  const { data: stats, isLoading } = useQuery<ReportData>({
    queryKey: ["/api/admin/stats"],
    retry: false,
  });

  const handleExportReport = (type: 'pdf' | 'excel') => {
    toast({
      title: "Info",
      description: `Fitur ekspor ${type.toUpperCase()} akan segera tersedia.`,
    });
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
          <p className="mt-4 text-gray-600 dark:text-gray-400">Memuat laporan...</p>
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
            <div className="flex items-center">
              <Link href="/admin/dashboard">
                <Button variant="ghost" size="sm" className="mr-4">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Kembali
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Laporan & Analitik
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Lihat statistik dan tren platform
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button onClick={() => handleExportReport('excel')} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Ekspor Excel
              </Button>
              <Button onClick={() => handleExportReport('pdf')} className="bg-green-600 hover:bg-green-700">
                <Download className="w-4 h-4 mr-2" />
                Ekspor PDF
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Jenis Laporan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overview">Ringkasan Umum</SelectItem>
                <SelectItem value="users">Analisis Pengguna</SelectItem>
                <SelectItem value="assessments">Analisis Asesmen</SelectItem>
                <SelectItem value="revenue">Analisis Pendapatan</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Rentang Waktu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_7_days">7 Hari Terakhir</SelectItem>
                <SelectItem value="last_30_days">30 Hari Terakhir</SelectItem>
                <SelectItem value="last_90_days">90 Hari Terakhir</SelectItem>
                <SelectItem value="this_year">Tahun Ini</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pengguna</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.activeUsers || 0} aktif
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Asesmen Selesai</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.completedAssessments || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.inProgressAssessments || 0} berlangsung
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats?.totalRevenue || 0)}</div>
              <p className="text-xs text-muted-foreground">
                Akumulasi seluruhnya
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tingkat Konversi</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.totalUsers ? Math.round((stats.completedAssessments / stats.totalUsers) * 100) : 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                Pengguna yang menyelesaikan
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Assessment Type Analysis */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Analisis Jenis Asesmen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">Asesmen Profil Sensoris</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Jumlah Selesai:</span>
                    <span className="font-medium">0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Pendapatan:</span>
                    <span className="font-medium">{formatCurrency(0)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: '0%' }}></div>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3">Inventori Gaya Belajar</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Jumlah Selesai:</span>
                    <span className="font-medium">0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Pendapatan:</span>
                    <span className="font-medium">{formatCurrency(0)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '0%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Aktivitas Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="font-medium">Sistem Laporan Baru</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Halaman laporan dan analitik telah diaktifkan
                  </p>
                </div>
                <Badge variant="outline">Baru</Badge>
              </div>
              
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aktivitas terbaru akan muncul di sini</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}