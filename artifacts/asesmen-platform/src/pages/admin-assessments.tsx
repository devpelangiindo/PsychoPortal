import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Search, Download, Filter, FileText, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDisplayDateTime } from "@/lib/date-format";

interface UserAssessment {
  id: number;
  userId: string;
  status: string;
  completedAt: string | null;
  createdAt: string;
  assessment: {
    id: number;
    name: string;
    type: string;
    price: string;
  };
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    whatsappNumber: string | null;
  };
}

export default function AdminAssessments() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  
  const { toast } = useToast();

  const { data: assessments, isLoading } = useQuery<UserAssessment[]>({
    queryKey: ["/api/admin/assessments"],
    retry: false,
    queryFn: async ({ queryKey }) => {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        throw new Error('Token admin tidak ditemukan. Silakan login ulang.');
      }
      
      const res = await fetch(queryKey[0] as string, {
        headers: {
          'Authorization': `Bearer ${token}`,
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

  const filteredAssessments = assessments?.filter(assessment => {
    const searchMatch = 
      assessment.assessment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assessment.user?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${assessment.user?.firstName || ''} ${assessment.user?.lastName || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
    
    const statusMatch = statusFilter === "all" || assessment.status === statusFilter;
    const typeMatch = typeFilter === "all" || assessment.assessment.type === typeFilter;
    
    return searchMatch && statusMatch && typeMatch;
  }) || [];

  const handleViewResult = async (assessmentId: number, status: string) => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        toast({
          title: "Error",
          description: "Token admin tidak ditemukan. Silakan login ulang.",
          variant: "destructive",
        });
        return;
      }

      // Check if assessment is still in progress
      if (status !== 'completed') {
        toast({
          title: "Error",
          description: "Asesmen masih berlangsung, hasil belum bisa dilihat.",
          variant: "destructive",
        });
        return;
      }

      // Redirect to admin result view route
      window.open(`/admin/assessment-result/${assessmentId}`, '_blank');
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal membuka hasil asesmen.",
        variant: "destructive",
      });
    }
  };

  const handleExportPDF = async (assessmentId: number, status: string) => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        toast({
          title: "Error",
          description: "Token admin tidak ditemukan. Silakan login ulang.",
          variant: "destructive",
        });
        return;
      }

      // Check if assessment is still in progress
      if (status !== 'completed') {
        toast({
          title: "Error",
          description: "Asesmen masih berlangsung, hasil belum bisa dilihat.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(`/api/admin/assessments/${assessmentId}/pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/pdf',
        },
      });

      if (!response.ok) {
        throw new Error('Gagal mengunduh PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Hasil_Asesmen_${assessmentId}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Berhasil",
        description: "PDF berhasil diunduh.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal mengunduh PDF. Silakan coba lagi.",
        variant: "destructive",
      });
    }
  };

  const handleExportAll = () => {
    if (!assessments || assessments.length === 0) {
      toast({
        title: "Info",
        description: "Tidak ada data untuk diekspor.",
      });
      return;
    }

    try {
      // Prepare CSV data
      const headers = [
        'ID Assessment',
        'Nama Pengguna',
        'Email',
        'WhatsApp',
        'Jenis Assessment',
        'Status',
        'Tanggal Dibuat',
        'Tanggal Selesai',
        'Harga'
      ];

      const csvData = assessments.map(assessment => [
        assessment.id,
        `${assessment.user?.firstName || ''} ${assessment.user?.lastName || ''}`.trim() || 'Tidak ada nama',
        assessment.user?.email || '',
        assessment.user?.whatsappNumber || '-',
        assessment.assessment.name,
        assessment.status === 'completed' ? 'Selesai' : 'Berlangsung',
        formatDate(assessment.createdAt),
        assessment.completedAt ? formatDate(assessment.completedAt) : '-',
        formatPrice(assessment.assessment.price)
      ]);

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `Data_Assessment_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Berhasil",
        description: "Data berhasil diekspor sebagai file CSV.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal mengekspor data. Silakan coba lagi.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return formatDisplayDateTime(dateString);
  };

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(parseFloat(price));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Memuat data asesmen...</p>
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
                  Hasil Asesmen
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Kelola semua hasil asesmen pengguna
                </p>
              </div>
            </div>
            <Button onClick={handleExportAll} className="bg-green-600 hover:bg-green-700">
              <Download className="w-4 h-4 mr-2" />
              Ekspor Semua
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Asesmen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{assessments?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Selesai
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {assessments?.filter(a => a.status === 'completed').length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Berlangsung
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {assessments?.filter(a => a.status === 'in_progress' || a.status === 'available').length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Daftar Asesmen ({filteredAssessments.length})</CardTitle>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Cari asesmen..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua</SelectItem>
                    <SelectItem value="completed">Selesai</SelectItem>
                    <SelectItem value="in_progress">Berlangsung</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Tipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua</SelectItem>
                    <SelectItem value="sensory">Sensoris</SelectItem>
                    <SelectItem value="learning">Gaya Belajar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Pengguna</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Jenis Asesmen</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dibuat</TableHead>
                    <TableHead>Selesai</TableHead>
                    <TableHead>Harga</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssessments.map((assessment) => (
                    <TableRow key={assessment.id}>
                      <TableCell className="font-mono text-sm">
                        #{assessment.id}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {`${assessment.user?.firstName || ''} ${assessment.user?.lastName || ''}`.trim() || 'Tidak ada nama'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {assessment.user?.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {assessment.user?.whatsappNumber || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{assessment.assessment.name}</div>
                          <Badge variant="outline" className="mt-1">
                            {assessment.assessment.type === 'sensory' ? 'Profil Sensori' : 'Gaya Belajar'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={assessment.status === 'completed' ? 'default' : 'secondary'}>
                          {assessment.status === 'completed' ? 'Selesai' : 'Berlangsung'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(assessment.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {assessment.completedAt ? formatDate(assessment.completedAt) : '-'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatPrice(assessment.assessment.price)}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleViewResult(assessment.id, assessment.status)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExportPDF(assessment.id, assessment.status)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
