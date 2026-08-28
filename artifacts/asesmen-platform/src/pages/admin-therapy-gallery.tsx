import { useState, type MouseEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, ImagePlus, Loader2, Pencil, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api-base";
import { apiRequest, getAuthToken } from "@/lib/queryClient";

type TherapyGalleryImage = {
  id: number;
  fileName: string;
  title: string | null;
  caption: string | null;
  sortOrder: number;
  focusX: number;
  focusY: number;
  isActive: boolean;
};

const MAX_IMAGES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

async function uploadImage(file: File, imageId?: number) {
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error("Gunakan file JPG, PNG, atau WebP");
  if (file.size > MAX_FILE_SIZE) throw new Error("Ukuran foto maksimal 5 MB");
  const response = await fetch(apiUrl(imageId ? `/api/admin/therapy-gallery/${imageId}/file` : "/api/admin/therapy-gallery"), {
    method: imageId ? "PUT" : "POST",
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": file.type,
      "X-File-Name": encodeURIComponent(file.name),
    },
    body: file,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || "Gagal mengunggah foto");
  }
  return response.json();
}

export default function AdminTherapyGallery() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<TherapyGalleryImage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { data: images = [], isLoading } = useQuery<TherapyGalleryImage[]>({ queryKey: ["/api/admin/therapy-gallery"] });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/therapy-gallery"] });

  const handleUpload = async (file?: File, imageId?: number) => {
    if (!file) return;
    setIsUploading(true);
    try {
      await uploadImage(file, imageId);
      await refresh();
      toast({ title: imageId ? "Foto galeri berhasil diganti" : "Foto galeri berhasil diunggah" });
    } catch (error) {
      toast({ title: "Gagal mengunggah foto", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFocusClick = (event: MouseEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const focusX = Math.max(0, Math.min(100, Math.round(((event.clientX - bounds.left) / bounds.width) * 100)));
    const focusY = Math.max(0, Math.min(100, Math.round(((event.clientY - bounds.top) / bounds.height) * 100)));
    setEditor((current) => current ? { ...current, focusX, focusY } : current);
  };

  const saveEditor = async () => {
    if (!editor) return;
    setIsSaving(true);
    try {
      await apiRequest("PUT", `/api/admin/therapy-gallery/${editor.id}`, {
        title: editor.title || "",
        caption: editor.caption || "",
        sortOrder: editor.sortOrder,
        focusX: editor.focusX,
        focusY: editor.focusY,
        isActive: editor.isActive,
      });
      await refresh();
      setEditor(null);
      toast({ title: "Foto galeri berhasil diperbarui" });
    } catch (error) {
      toast({ title: "Gagal menyimpan perubahan", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-green-700"><ArrowLeft size={17} />Kembali ke Dashboard</Link>
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Galeri Terapi</h1>
            <p className="mt-2 text-gray-600">Kelola foto yang ditampilkan setelah kategori pada halaman Terapi.</p>
            <p className="mt-1 text-sm font-semibold text-green-700">{images.length} dari maksimal {MAX_IMAGES} foto</p>
          </div>
          <label className={`inline-flex items-center justify-center rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 ${images.length >= MAX_IMAGES || isUploading ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}Unggah Foto
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={images.length >= MAX_IMAGES || isUploading} onChange={async (event) => { await handleUpload(event.target.files?.[0]); event.target.value = ""; }} />
          </label>
        </div>

        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-900">
          Unggah JPG, PNG, atau WebP maksimal 5 MB. Atur urutan, judul, keterangan, status, dan titik fokus agar foto tampil proporsional pada galeri.
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-green-700" /></div>
        ) : images.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center p-14 text-center text-gray-500"><Camera className="mb-4 h-10 w-10 text-green-700" /><p>Belum ada foto galeri terapi.</p></CardContent></Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {images.map((image) => (
              <Card key={image.id} className={`overflow-hidden ${image.isActive ? "" : "opacity-60"}`}>
                <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                  <img src={apiUrl(`/api/therapy-gallery/images/${image.id}`)} alt={image.title || image.fileName} className="h-full w-full object-cover" style={{ objectPosition: `${image.focusX}% ${image.focusY}%` }} />
                  <span className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[11px] font-bold ${image.isActive ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>{image.isActive ? "Aktif" : "Nonaktif"}</span>
                </div>
                <CardContent className="p-4">
                  <h2 className="truncate font-bold text-gray-900">{image.title || "Tanpa judul"}</h2>
                  <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-gray-500">{image.caption || "Belum ada keterangan"}</p>
                  <p className="mt-2 text-xs text-gray-400">Urutan {image.sortOrder}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditor({ ...image })}><Pencil className="mr-2 h-3.5 w-3.5" />Edit</Button>
                    <label className={`inline-flex items-center justify-center rounded-md border px-2 py-2 text-xs font-medium hover:bg-gray-50 ${isUploading ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>Ganti Foto<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={isUploading} onChange={async (event) => { await handleUpload(event.target.files?.[0], image.id); event.target.value = ""; }} /></label>
                    <Button size="sm" variant="destructive" className="col-span-2" onClick={async () => {
                      if (!confirm(`Hapus foto ${image.title || image.fileName}?`)) return;
                      try {
                        await apiRequest("DELETE", `/api/admin/therapy-gallery/${image.id}`);
                        await refresh();
                        toast({ title: "Foto galeri berhasil dihapus" });
                      } catch (error) {
                        toast({ title: "Gagal menghapus foto", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" });
                      }
                    }}><Trash2 className="mr-2 h-3.5 w-3.5" />Hapus</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={editor !== null} onOpenChange={(open) => !open && setEditor(null)}>
        {editor && (
          <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
            <DialogHeader className="border-b px-6 py-5 pr-12 text-left">
              <DialogTitle>Edit Foto Galeri Terapi</DialogTitle>
              <DialogDescription>Atur informasi, urutan, status, dan klik foto untuk memilih titik fokus.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 overflow-y-auto px-6 py-5">
              <button type="button" className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-gray-100" onClick={handleFocusClick}>
                <img src={apiUrl(`/api/therapy-gallery/images/${editor.id}`)} alt="Preview foto galeri" className="h-full w-full object-cover" style={{ objectPosition: `${editor.focusX}% ${editor.focusY}%` }} />
                <span className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-green-600 shadow" style={{ left: `${editor.focusX}%`, top: `${editor.focusY}%` }} />
              </button>
              <p className="text-xs text-gray-500">Klik bagian foto yang harus tetap terlihat ketika bingkai menyesuaikan layar.</p>
              <div><Label>Judul (opsional)</Label><Input value={editor.title || ""} onChange={(event) => setEditor((current) => current ? { ...current, title: event.target.value } : current)} /></div>
              <div><Label>Keterangan (opsional)</Label><Textarea rows={3} value={editor.caption || ""} onChange={(event) => setEditor((current) => current ? { ...current, caption: event.target.value } : current)} /></div>
              <div><Label>Urutan tampil</Label><Input type="number" min="0" max="9999" value={editor.sortOrder} onChange={(event) => setEditor((current) => current ? { ...current, sortOrder: Number(event.target.value) || 0 } : current)} /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editor.isActive} onChange={(event) => setEditor((current) => current ? { ...current, isActive: event.target.checked } : current)} />Tampilkan di halaman Terapi</label>
            </div>
            <div className="flex gap-2 border-t bg-white px-6 py-4">
              <Button variant="outline" className="flex-1" onClick={() => setEditor(null)}>Batal</Button>
              <Button className="flex-1 bg-green-700 hover:bg-green-800" disabled={isSaving} onClick={saveEditor}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
