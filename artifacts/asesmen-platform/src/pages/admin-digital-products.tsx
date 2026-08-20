import { useEffect, useState, type MouseEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Crosshair, FileUp, ImagePlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getAuthToken } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api-base";

type ProductImage = { id: number; fileName: string; focusX: number; focusY: number };
type Product = {
  id: number; slug: string; name: string; shortDescription: string; description: string; price: string;
  promoPrice: string | null; effectivePrice: string;
  isActive: boolean; hasDeliveryFile: boolean; hasDeliveryUrl: boolean; deliveryFileName: string | null;
  deliveryUrl: string | null;
  images: ProductImage[];
};
type FormState = { name: string; slug: string; shortDescription: string; description: string; price: string; promoPrice: string; deliveryUrl: string; isActive: boolean };
const emptyForm: FormState = { name: "", slug: "", shortDescription: "", description: "", price: "", promoPrice: "", deliveryUrl: "", isActive: true };

async function uploadBinary(path: string, file: File, method = "POST", preserveMimeType = true) {
  const response = await fetch(apiUrl(path), {
    method,
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": preserveMimeType ? (file.type || "application/octet-stream") : "application/octet-stream",
      "X-Original-Mime-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
    },
    body: file,
  });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return response.json();
}

export default function AdminDigitalProducts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [focusEditor, setFocusEditor] = useState<{ productId: number; image: ProductImage; focusX: number; focusY: number } | null>(null);
  const [isSavingFocus, setIsSavingFocus] = useState(false);
  const isCso = window.location.pathname.startsWith("/cso");
  const { data: products = [], isLoading } = useQuery<Product[]>({ queryKey: ["/api/admin/digital-products"] });

  useEffect(() => {
    if (!editing) return setForm(emptyForm);
    setForm({ name: editing.name, slug: editing.slug, shortDescription: editing.shortDescription, description: editing.description, price: editing.price, promoPrice: editing.promoPrice || "", deliveryUrl: editing.deliveryUrl || "", isActive: editing.isActive });
  }, [editing]);

  const save = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(editing ? "PUT" : "POST", editing ? `/api/admin/digital-products/${editing.id}` : "/api/admin/digital-products", {
        ...form,
        price: Number(form.price),
        promoPrice: form.promoPrice === "" ? null : Number(form.promoPrice),
      });
      return response.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/digital-products"] }); setEditing(null); setForm(emptyForm); toast({ title: "Produk tersimpan" }); },
    onError: (error) => toast({ title: "Gagal menyimpan", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/digital-products/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/digital-products"] }); toast({ title: "Produk dinonaktifkan" }); },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/digital-products"] });
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const setFocusPreset = (focusX: number, focusY: number) => setFocusEditor((current) => current ? { ...current, focusX, focusY } : current);
  const handleFocusClick = (event: MouseEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const focusX = Math.max(0, Math.min(100, Math.round(((event.clientX - bounds.left) / bounds.width) * 100)));
    const focusY = Math.max(0, Math.min(100, Math.round(((event.clientY - bounds.top) / bounds.height) * 100)));
    setFocusPreset(focusX, focusY);
  };
  const saveImageFocus = async () => {
    if (!focusEditor) return;
    setIsSavingFocus(true);
    try {
      await apiRequest("PUT", `/api/admin/digital-products/${focusEditor.productId}/images/${focusEditor.image.id}/focus`, {
        focusX: focusEditor.focusX,
        focusY: focusEditor.focusY,
      });
      await refresh();
      toast({ title: "Titik fokus gambar tersimpan" });
      setFocusEditor(null);
    } catch (error) {
      toast({ title: "Gagal menyimpan titik fokus", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" });
    } finally {
      setIsSavingFocus(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <Link href={isCso ? "/cso/dashboard" : "/admin/dashboard"} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-green-700"><ArrowLeft size={17} /> Kembali ke Dashboard</Link>
        <div className="mb-7"><h1 className="text-3xl font-extrabold">Pengelolaan Produk Digital</h1><p className="mt-2 text-gray-600">Tambah katalog, gambar, file unduhan, atau link akses produk.</p></div>
        <div className="grid gap-7 lg:grid-cols-[400px_1fr]">
          <Card className="h-fit lg:sticky lg:top-6">
            <CardHeader><CardTitle className="flex items-center gap-2">{editing ? <Pencil size={19} /> : <Plus size={19} />}{editing ? "Edit Produk" : "Tambah Produk"}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Nama produk</Label><Input value={form.name} onChange={(event) => update("name", event.target.value)} /></div>
              <div><Label>Slug (opsional)</Label><Input value={form.slug} onChange={(event) => update("slug", event.target.value)} placeholder="dibuat otomatis dari nama" /></div>
              <div><Label>Deskripsi singkat</Label><Textarea value={form.shortDescription} onChange={(event) => update("shortDescription", event.target.value)} /></div>
              <div><Label>Deskripsi lengkap</Label><Textarea rows={6} value={form.description} onChange={(event) => update("description", event.target.value)} /></div>
              <div><Label>Harga Reguler</Label><Input type="number" min="0" value={form.price} onChange={(event) => update("price", event.target.value)} /></div>
              <div><Label>Harga Promo (opsional)</Label><Input type="number" min="0" value={form.promoPrice} onChange={(event) => update("promoPrice", event.target.value)} placeholder="Harus lebih rendah dari harga reguler" /></div>
              <div><Label>Link produk (opsional)</Label><Input type="url" value={form.deliveryUrl} onChange={(event) => update("deliveryUrl", event.target.value)} placeholder="https://..." /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(event) => update("isActive", event.target.checked)} /> Tampilkan di katalog</label>
              <div className="flex gap-2"><Button className="flex-1 bg-green-700 hover:bg-green-800" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan</Button>{editing && <Button variant="outline" onClick={() => setEditing(null)}>Batal</Button>}</div>
            </CardContent>
          </Card>

          <div className="space-y-5">
            {isLoading ? <Loader2 className="animate-spin" /> : products.length === 0 ? <Card><CardContent className="p-10 text-center text-gray-500">Belum ada produk digital.</CardContent></Card> : products.map((product) => (
              <Card key={product.id} className={!product.isActive ? "opacity-65" : ""}>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-5 xl:flex-row">
                    <div className="w-full xl:w-64">
                      <div className="grid grid-cols-3 gap-2">
                        {product.images.map((image) => (
                          <div key={image.id} className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                            <img src={apiUrl(`/api/digital-products/images/${image.id}`)} alt="" className="h-full w-full object-cover" style={{ objectPosition: `${image.focusX}% ${image.focusY}%` }} />
                            <button type="button" className="absolute bottom-1 left-1 rounded bg-black/70 p-1 text-white" aria-label="Atur fokus gambar" onClick={() => setFocusEditor({ productId: product.id, image, focusX: image.focusX, focusY: image.focusY })}><Crosshair size={13} /></button>
                            <button type="button" className="absolute right-1 top-1 rounded bg-red-600 p-1 text-white opacity-0 group-hover:opacity-100" onClick={async () => { await apiRequest("DELETE", `/api/admin/digital-products/${product.id}/images/${image.id}`); refresh(); }}><Trash2 size={13} /></button>
                          </div>
                        ))}
                        <label className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border-2 border-dashed text-gray-500 hover:border-green-500 hover:text-green-700">
                          <ImagePlus size={22} /><input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { await uploadBinary(`/api/admin/digital-products/${product.id}/images`, file); refresh(); } catch (error) { toast({ title: "Gagal mengunggah gambar", description: String(error), variant: "destructive" }); } event.target.value = ""; }} />
                        </label>
                      </div>
                      {focusEditor?.productId === product.id && (
                        <div className="mt-3 rounded-xl border bg-white p-3 shadow-sm">
                          <p className="mb-2 text-xs font-bold text-gray-700">Klik bagian gambar yang ingin diprioritaskan</p>
                          <button type="button" className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-gray-100" onClick={handleFocusClick}>
                            <img src={apiUrl(`/api/digital-products/images/${focusEditor.image.id}`)} alt="Preview titik fokus" className="h-full w-full object-cover" style={{ objectPosition: `${focusEditor.focusX}% ${focusEditor.focusY}%` }} />
                            <span className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-green-600 shadow" style={{ left: `${focusEditor.focusX}%`, top: `${focusEditor.focusY}%` }} />
                          </button>
                          <div className="mt-2 grid grid-cols-3 gap-1 text-xs">
                            <Button type="button" size="sm" variant="outline" onClick={() => setFocusPreset(50, 0)}>Atas</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setFocusPreset(50, 50)}>Tengah</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setFocusPreset(50, 100)}>Bawah</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setFocusPreset(0, 50)}>Kiri</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setFocusPreset(100, 50)}>Kanan</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setFocusEditor(null)}>Batal</Button>
                          </div>
                          <Button type="button" size="sm" className="mt-2 w-full bg-green-700 hover:bg-green-800" disabled={isSavingFocus} onClick={saveImageFocus}>{isSavingFocus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan Fokus</Button>
                          <p className="mt-2 text-center text-[11px] text-gray-500">Posisi: {focusEditor.focusX}% × {focusEditor.focusY}%</p>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{product.name}</h2><p className="text-sm text-gray-500">/{product.slug}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${product.isActive ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>{product.isActive ? "Aktif" : "Nonaktif"}</span></div>
                      <p className="mt-3 text-sm leading-6 text-gray-600">{product.shortDescription}</p>
                      <div className="mt-2 flex flex-wrap items-baseline gap-2">
                        {product.promoPrice && <span className="text-sm text-gray-500 line-through">Rp {new Intl.NumberFormat("id-ID").format(Number(product.price))}</span>}
                        <span className="font-extrabold text-green-700">Rp {new Intl.NumberFormat("id-ID").format(Number(product.effectivePrice))}</span>
                        {product.promoPrice && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">Promo</span>}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditing(product)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>
                        <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-gray-50"><FileUp className="mr-2 h-4 w-4" />{product.hasDeliveryFile ? "Ganti file" : "Unggah file"}<input className="hidden" type="file" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { await uploadBinary(`/api/admin/digital-products/${product.id}/file`, file, "PUT", false); refresh(); toast({ title: "File produk tersimpan" }); } catch (error) { toast({ title: "Gagal mengunggah file", description: String(error), variant: "destructive" }); } event.target.value = ""; }} /></label>
                        {product.hasDeliveryFile && <Button size="sm" variant="outline" onClick={async () => { if (!confirm("Hapus file produk ini?")) return; await apiRequest("DELETE", `/api/admin/digital-products/${product.id}/file`); refresh(); }}><Trash2 className="mr-2 h-4 w-4" />Hapus file</Button>}
                        <Button size="sm" variant="destructive" disabled={!product.isActive || remove.isPending} onClick={() => { if (confirm("Nonaktifkan produk ini dari katalog?")) remove.mutate(product.id); }}><Trash2 className="mr-2 h-4 w-4" />Hapus</Button>
                      </div>
                      <p className="mt-3 text-xs text-gray-500">Akses: {product.hasDeliveryFile ? `file (${product.deliveryFileName})` : "tanpa file"} · {product.hasDeliveryUrl ? "link tersedia" : "tanpa link"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
