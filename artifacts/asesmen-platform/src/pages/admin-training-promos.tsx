import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiUrl } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getAuthToken } from "@/lib/queryClient";

type TrainingPromo = {
  id: number;
  hasImage: boolean;
  updatedAt: string;
  title: string;
  description: string;
  buttonText: string;
  linkUrl: string;
  sortOrder: number;
  isActive: boolean;
};

type PromoForm = Omit<TrainingPromo, "id" | "hasImage" | "updatedAt">;

const emptyForm: PromoForm = {
  title: "",
  description: "",
  buttonText: "Info lebih lanjut",
  linkUrl: "https://wa.me/6285117658242",
  sortOrder: 0,
  isActive: true,
};

export default function AdminTrainingPromos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState<number | null>(null);
  const [editing, setEditing] = useState<TrainingPromo | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<PromoForm>(emptyForm);
  const { data: promos = [], isLoading } = useQuery<TrainingPromo[]>({ queryKey: ["/api/admin/training-promos"] });

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["/api/admin/training-promos"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/training-promos"] }),
  ]);

  const save = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        editing ? "PUT" : "POST",
        editing ? `/api/admin/training-promos/${editing.id}` : "/api/admin/training-promos",
        form,
      );
      return response.json();
    },
    onSuccess: async () => {
      await refresh();
      closeForm();
      toast({ title: "Promo & Info Pelatihan berhasil disimpan" });
    },
    onError: (error) => toast({
      title: "Gagal menyimpan Promo & Info Pelatihan",
      description: error instanceof Error ? error.message : "Silakan coba lagi",
      variant: "destructive",
    }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/training-promos/${id}`),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Promo & Info Pelatihan berhasil dihapus" });
    },
    onError: (error) => toast({
      title: "Gagal menghapus Promo & Info Pelatihan",
      description: error instanceof Error ? error.message : "Silakan coba lagi",
      variant: "destructive",
    }),
  });

  const uploadImage = async (promoId: number, file: File) => {
    setUploading(promoId);
    try {
      if(file.size > 8 * 1024 * 1024) throw new Error('Ukuran gambar maksimal 8 MB.');
      const response = await fetch(apiUrl('/api/admin/training-promos/' + promoId + '/image'), {method:'PUT',headers:{Authorization:'Bearer ' + getAuthToken(),'Content-Type':file.type},body:file});
      if(!response.ok) throw new Error((await response.json()).message || 'Upload gagal');
      await refresh(); toast({title:'Gambar promo tersimpan'});
    } catch(error) { toast({title:'Gagal mengunggah gambar',description:String(error),variant:'destructive'}); }
    finally { setUploading(null); }
  };
  const removeImage = async (id:number) => {
    try { await apiRequest('DELETE','/api/admin/training-promos/' + id + '/image'); await refresh(); }
    catch(error) { toast({title:'Gagal menghapus gambar',description:String(error),variant:'destructive'}); }
  };
  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const createPromo = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const editPromo = (promo: TrainingPromo) => {
    setEditing(promo);
    setForm({
      title: promo.title,
      description: promo.description,
      buttonText: promo.buttonText,
      linkUrl: promo.linkUrl,
      sortOrder: promo.sortOrder,
      isActive: promo.isActive,
    });
    setFormOpen(true);
  };

  const formValid = form.title.trim().length >= 2
    && form.description.trim().length >= 3
    && form.buttonText.trim().length >= 2
    && form.linkUrl.trim().length > 0;

  return (
    <div className="">
      <div className="mx-auto max-w-6xl">

        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Promo & Info Pelatihan</h1>
            <p className="mt-2 text-gray-600">Kelola informasi di sisi kanan halaman Pelatihan. Simpan promo dahulu, lalu unggah gambar opsional.</p>
          </div>
          <Button className="bg-green-700 hover:bg-green-800" onClick={createPromo}><Plus className="mr-2 h-4 w-4" />Tambah Promo</Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-green-700" /></div>
        ) : promos.length === 0 ? (
          <div className="rounded-2xl border bg-white p-12 text-center text-gray-500">Belum ada Promo & Info Pelatihan.</div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {promos.map((promo) => (
              <Card key={promo.id} className={promo.isActive ? "" : "opacity-60"}>
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-2 font-extrabold text-gray-900"><Megaphone className="h-4 w-4 shrink-0 text-green-700" />{promo.title}</h2>
                      <p className="mt-1 text-xs text-gray-500">Urutan {promo.sortOrder}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${promo.isActive ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>{promo.isActive ? "Aktif" : "Nonaktif"}</span>
                  </div>
                  <p className="mt-4 line-clamp-4 text-sm leading-6 text-gray-600">{promo.description}</p>
                  <a href={promo.linkUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 truncate text-xs font-semibold text-green-700">{promo.buttonText}<ExternalLink className="h-3 w-3 shrink-0" /></a>
                  <div className="mt-4 space-y-3">
                    {promo.hasImage && <PromoImage promo={promo} />}
                    <label className="inline-flex cursor-pointer rounded-md border px-3 py-2 text-sm font-semibold">{uploading === promo.id ? 'Mengunggah…' : promo.hasImage ? 'Ganti Gambar' : 'Tambah Gambar'}<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading !== null} onChange={event=>{const file=event.target.files?.[0];if(file) void uploadImage(promo.id,file);event.target.value='';}} /></label>
                    {promo.hasImage && <Button size="sm" variant="ghost" onClick={()=>void removeImage(promo.id)}>Hapus Gambar</Button>}
                    <p className="text-xs text-gray-500">Opsional · JPEG, PNG, WebP · Maksimal 8 MB</p>
                  </div><div className="mt-auto flex gap-2 pt-6">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => editPromo(promo)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>
                    <Button size="sm" variant="destructive" className="flex-1" disabled={remove.isPending} onClick={() => { if (confirm(`Hapus Promo & Info ${promo.title}?`)) remove.mutate(promo.id); }}><Trash2 className="mr-2 h-4 w-4" />Hapus</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="border-b px-6 py-5 pr-12 text-left">
            <DialogTitle>{editing ? "Edit Promo & Info Pelatihan" : "Tambah Promo & Info Pelatihan"}</DialogTitle>
            <DialogDescription>Promo aktif akan tampil sesuai urutan pada halaman Pelatihan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto px-6 py-5">
            <div><Label>Judul</Label><Input maxLength={255} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></div>
            <div><Label>Deskripsi singkat</Label><Textarea rows={4} maxLength={1000} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></div>
            <div><Label>Teks tombol</Label><Input maxLength={100} value={form.buttonText} onChange={(event) => setForm((current) => ({ ...current, buttonText: event.target.value }))} /></div>
            <div><Label>Tautan tujuan</Label><Input maxLength={2000} value={form.linkUrl} onChange={(event) => setForm((current) => ({ ...current, linkUrl: event.target.value }))} placeholder="https://wa.me/... atau /produk-layanan/pelatihan" /><p className="mt-1 text-xs text-gray-500">Gunakan alamat http/https atau halaman internal yang diawali dengan /.</p></div>
            <div><Label>Urutan tampil</Label><Input type="number" min="0" max="9999" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: Number(event.target.value) || 0 }))} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} /> Tampilkan pada halaman Pelatihan</label>
          </div>
          <div className="flex gap-2 border-t bg-white px-6 py-4">
            <Button variant="outline" className="flex-1" onClick={closeForm}>Batal</Button>
            <Button className="flex-1 bg-green-700 hover:bg-green-800" disabled={!formValid || save.isPending} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PromoImage({promo}:{promo:TrainingPromo}) {
  const [src,setSrc]=useState('');
  useEffect(()=>{let active=true;let url='';setSrc('');
    apiRequest('GET','/api/admin/training-promos/'+promo.id+'/image').then(r=>r.blob()).then(blob=>{if(active){url=URL.createObjectURL(blob);setSrc(url);}}).catch(()=>{});
    return ()=>{active=false;if(url)URL.revokeObjectURL(url);};
  },[promo.id,promo.updatedAt]);
  return src ? <img src={src} alt={promo.title} className="max-h-64 w-full rounded-lg object-contain" /> : <p className="text-xs text-gray-500">Pratinjau gambar belum tersedia.</p>;
}
