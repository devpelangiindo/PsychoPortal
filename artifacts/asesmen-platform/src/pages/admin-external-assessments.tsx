import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, FileUp, KeyRound, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getAuthToken } from "@/lib/queryClient";
import { formatDisplayDateTime } from "@/lib/date-format";

type Product = {
  id: number;
  name: string;
  description: string;
  price: string;
  originalPrice: string;
  websiteName: string | null;
  websiteUrl: string | null;
  workHours: string;
  resultEtaText: string;
  instructionsFileName: string | null;
  availableCodes: number;
  allocatedCodes: number;
};

type PaidOrder = {
  orderId: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  paidAt: string | null;
  assessmentId: number;
  token: string | null;
  resultFileName: string | null;
};

type AdminData = { products: Product[]; orders: PaidOrder[] };

async function uploadPdf(url: string, file: File) {
  const token = getAuthToken();
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/pdf",
      "X-File-Name": file.name,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: file,
  });
  if (!response.ok) throw new Error((await response.text()) || "Upload gagal");
  return response.json();
}

export default function AdminExternalAssessments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [codes, setCodes] = useState("");
  const [config, setConfig] = useState({ websiteName: "", websiteUrl: "", workHours: "08.00-17.00 WIB", resultEtaText: "Hasil akan dikirimkan dalam waktu 2x24 jam hari kerja" });
  const { data, isLoading } = useQuery<AdminData>({ queryKey: ["/api/admin/external-assessments"] });
  const product = data?.products[0];

  useEffect(() => {
    if (!product) return;
    setConfig({
      websiteName: product.websiteName || "",
      websiteUrl: product.websiteUrl || "",
      workHours: product.workHours,
      resultEtaText: product.resultEtaText,
    });
  }, [product?.id]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/external-assessments"] });
  const saveConfig = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/admin/external-assessments/${product!.id}/config`, config),
    onSuccess: () => { refresh(); toast({ title: "Konfigurasi tersimpan" }); },
    onError: (error) => toast({ title: "Gagal menyimpan", description: String(error), variant: "destructive" }),
  });
  const addCodes = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/admin/external-assessments/${product!.id}/codes`, { codes })).json(),
    onSuccess: (result) => { setCodes(""); refresh(); toast({ title: `${result.added} kode ditambahkan`, description: result.duplicates ? `${result.duplicates} kode duplikat dilewati.` : undefined }); },
    onError: (error) => toast({ title: "Gagal menambahkan kode", description: String(error), variant: "destructive" }),
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center">Memuat pengelolaan produk...</div>;
  if (!product) return <div className="p-8 text-center">Produk eksternal belum tersedia.</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Link href="/admin/dashboard"><Button variant="ghost"><ArrowLeft className="mr-2 h-4 w-4" />Kembali ke Dashboard</Button></Link>
        <div>
          <h1 className="text-3xl font-bold">Mental Health Check Up</h1>
          <p className="mt-1 text-gray-600">Kelola informasi pengerjaan, bank kode tes, dan PDF hasil klien.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Informasi Pengerjaan</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><label className="text-sm font-medium">Nama website</label><Input value={config.websiteName} onChange={(e) => setConfig({ ...config, websiteName: e.target.value })} placeholder="Nama platform tes" /></div>
              <div><label className="text-sm font-medium">URL website</label><Input value={config.websiteUrl} onChange={(e) => setConfig({ ...config, websiteUrl: e.target.value })} placeholder="https://..." /></div>
              <div><label className="text-sm font-medium">Jam pengerjaan</label><Input value={config.workHours} onChange={(e) => setConfig({ ...config, workHours: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Keterangan hasil</label><Input value={config.resultEtaText} onChange={(e) => setConfig({ ...config, resultEtaText: e.target.value })} /></div>
              <Button onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending}><Save className="mr-2 h-4 w-4" />Simpan Informasi</Button>
              <div className="rounded-lg border p-4">
                <p className="mb-2 text-sm font-medium">PDF ketentuan pengerjaan</p>
                <p className="mb-3 text-xs text-gray-500">{product.instructionsFileName || "Belum ada PDF"}</p>
                <Input type="file" accept="application/pdf" onChange={async (event) => {
                  const file = event.target.files?.[0]; if (!file) return;
                  try { await uploadPdf(`/api/admin/external-assessments/${product.id}/instructions.pdf`, file); refresh(); toast({ title: "PDF ketentuan berhasil diunggah" }); }
                  catch (error) { toast({ title: "Upload gagal", description: String(error), variant: "destructive" }); }
                  event.target.value = "";
                }} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />Bank Kode Tes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-green-50 p-4"><p className="text-sm text-green-800">Tersedia</p><p className="text-3xl font-bold text-green-700">{product.availableCodes}</p></div>
                <div className="rounded-xl bg-blue-50 p-4"><p className="text-sm text-blue-800">Sudah dialokasikan</p><p className="text-3xl font-bold text-blue-700">{product.allocatedCodes}</p></div>
              </div>
              <div><label className="text-sm font-medium">Tambah kode (satu per baris, atau pisahkan dengan koma)</label><Textarea value={codes} onChange={(e) => setCodes(e.target.value)} rows={9} placeholder={"MHC-001\nMHC-002\nMHC-003"} /></div>
              <Button onClick={() => addCodes.mutate()} disabled={!codes.trim() || addCodes.isPending}><Upload className="mr-2 h-4 w-4" />Tambahkan Kode</Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Pesanan Lunas dan Hasil Klien</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Pesanan</TableHead><TableHead>Klien</TableHead><TableHead>Token</TableHead><TableHead>Pembayaran</TableHead><TableHead>Hasil PDF</TableHead></TableRow></TableHeader>
              <TableBody>
                {(data?.orders || []).map((order) => (
                  <TableRow key={order.orderId}>
                    <TableCell className="font-mono">#{order.orderId}</TableCell>
                    <TableCell><p className="font-medium">{`${order.firstName || ""} ${order.lastName || ""}`.trim() || "-"}</p><p className="text-xs text-gray-500">{order.email}</p></TableCell>
                    <TableCell>{order.token ? <Badge className="font-mono">{order.token}</Badge> : <Badge variant="destructive">Stok kode kosong</Badge>}</TableCell>
                    <TableCell className="text-sm">{order.paidAt ? formatDisplayDateTime(order.paidAt) : "Lunas"}</TableCell>
                    <TableCell>
                      <p className="mb-2 max-w-48 truncate text-xs text-gray-500">{order.resultFileName || "Belum diunggah"}</p>
                      <label className="inline-flex cursor-pointer items-center rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50">
                        <FileUp className="mr-2 h-4 w-4" />{order.resultFileName ? "Ganti PDF" : "Upload PDF"}
                        <input className="hidden" type="file" accept="application/pdf" onChange={async (event) => {
                          const file = event.target.files?.[0]; if (!file) return;
                          try { await uploadPdf(`/api/admin/external-assessments/orders/${order.orderId}/result.pdf`, file); refresh(); toast({ title: "Hasil klien berhasil diunggah" }); }
                          catch (error) { toast({ title: "Upload gagal", description: String(error), variant: "destructive" }); }
                          event.target.value = "";
                        }} />
                      </label>
                    </TableCell>
                  </TableRow>
                ))}
                {!data?.orders.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-gray-500">Belum ada pesanan lunas.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
