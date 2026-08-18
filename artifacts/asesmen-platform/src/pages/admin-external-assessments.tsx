import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, FileUp, KeyRound, Pencil, Save, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

type TestCode = {
  id: number;
  assessmentId: number;
  code: string;
  status: string;
  orderId: number | null;
  userId: string | null;
  allocatedAt: string | null;
  createdAt: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

type AdminData = { products: Product[]; orders: PaidOrder[]; codes: TestCode[] };

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
  const [editingCode, setEditingCode] = useState<TestCode | null>(null);
  const [editedCodeValue, setEditedCodeValue] = useState("");
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
  const editCode = useMutation({
    mutationFn: async ({ id, code }: { id: number; code: string }) =>
      (await apiRequest("PUT", `/api/admin/external-assessments/${product!.id}/codes/${id}`, { code })).json(),
    onSuccess: () => {
      setEditingCode(null);
      setEditedCodeValue("");
      refresh();
      toast({ title: "Kode tes berhasil diperbarui" });
    },
    onError: (error) => toast({ title: "Gagal mengedit kode", description: String(error), variant: "destructive" }),
  });
  const deleteCode = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("DELETE", `/api/admin/external-assessments/${product!.id}/codes/${id}`)).json(),
    onSuccess: () => {
      refresh();
      toast({ title: "Kode tes berhasil dihapus" });
    },
    onError: (error) => toast({ title: "Gagal menghapus kode", description: String(error), variant: "destructive" }),
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
          <CardHeader>
            <CardTitle>Daftar dan Penempatan Kode Tes</CardTitle>
            <p className="text-sm text-gray-600">Kode yang sudah diberikan kepada klien tetap dapat dilihat, tetapi dikunci agar token pada dashboard klien tidak berubah.</p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode Tes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Penempatan</TableHead>
                  <TableHead>Dialokasikan</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.codes || []).map((testCode) => {
                  const isAvailable = testCode.status === "available" && !testCode.orderId;
                  const clientName = `${testCode.firstName || ""} ${testCode.lastName || ""}`.trim();
                  return (
                    <TableRow key={testCode.id}>
                      <TableCell><span className="font-mono font-semibold">{testCode.code}</span></TableCell>
                      <TableCell>
                        {isAvailable ? (
                          <Badge className="bg-green-700 hover:bg-green-700">Tersedia</Badge>
                        ) : testCode.status === "allocated" ? (
                          <Badge className="bg-blue-700 hover:bg-blue-700">Sudah digunakan</Badge>
                        ) : (
                          <Badge variant="secondary">{testCode.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {testCode.orderId ? (
                          <div>
                            <p className="font-medium">Pesanan #{testCode.orderId}</p>
                            <p className="text-sm text-gray-700">{clientName || "Klien"}</p>
                            <p className="text-xs text-gray-500">{testCode.email || "-"}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">Belum ditempatkan</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{testCode.allocatedAt ? formatDisplayDateTime(testCode.allocatedAt) : "-"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{testCode.createdAt ? formatDisplayDateTime(testCode.createdAt) : "-"}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!isAvailable}
                            title={isAvailable ? "Edit kode tes" : "Kode yang sudah digunakan tidak dapat diedit"}
                            onClick={() => {
                              setEditingCode(testCode);
                              setEditedCodeValue(testCode.code);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit kode {testCode.code}</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!isAvailable || deleteCode.isPending}
                                title={isAvailable ? "Hapus kode tes" : "Kode yang sudah digunakan tidak dapat dihapus"}
                                className="text-red-700 hover:bg-red-50 hover:text-red-800"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Hapus kode {testCode.code}</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus kode tes?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Kode <span className="font-mono font-semibold text-foreground">{testCode.code}</span> akan dihapus dari bank kode. Tindakan ini tidak dapat dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-red-600 text-white hover:bg-red-700"
                                  onClick={() => deleteCode.mutate(testCode.id)}
                                >
                                  Hapus Kode
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!(data?.codes || []).length && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-gray-500">Belum ada kode tes di bank data.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

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

        <Dialog open={Boolean(editingCode)} onOpenChange={(open) => {
          if (!open && !editCode.isPending) {
            setEditingCode(null);
            setEditedCodeValue("");
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Kode Tes</DialogTitle>
              <DialogDescription>Kode hanya dapat diubah selama belum diberikan kepada klien.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label htmlFor="edit-test-code" className="text-sm font-medium">Kode tes</label>
              <Input
                id="edit-test-code"
                value={editedCodeValue}
                maxLength={255}
                autoComplete="off"
                onChange={(event) => setEditedCodeValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && editingCode && editedCodeValue.trim() && editedCodeValue.trim() !== editingCode.code) {
                    editCode.mutate({ id: editingCode.id, code: editedCodeValue.trim() });
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" disabled={editCode.isPending} onClick={() => {
                setEditingCode(null);
                setEditedCodeValue("");
              }}>Batal</Button>
              <Button
                disabled={!editingCode || !editedCodeValue.trim() || editedCodeValue.trim() === editingCode.code || editCode.isPending}
                onClick={() => editingCode && editCode.mutate({ id: editingCode.id, code: editedCodeValue.trim() })}
              >
                <Save className="mr-2 h-4 w-4" />{editCode.isPending ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
