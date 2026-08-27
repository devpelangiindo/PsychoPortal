import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, Crosshair, ImagePlus, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api-base";
import { apiRequest, getAuthToken } from "@/lib/queryClient";

type WhyItem = { title: string; description: string };
type PriceOption = { label: string; price: number; promoPrice: number | null; unit: string };
type Offering = {
  id: number; serviceId: number; slug: string; title: string; description: string;
  capacity: string | null; area: string | null; facilities: string | null; duration: string | null;
  priceOptions: PriceOption[]; sortOrder: number; isActive: boolean; hasImage: boolean;
  imageFileName: string | null; imageFocusX: number; imageFocusY: number;
};
type Service = {
  id: number; slug: string; title: string; summary: string; description: string;
  sortOrder: number; isActive: boolean; hasImage: boolean; imageFileName: string | null;
  imageFocusX: number; imageFocusY: number; offerings: Offering[];
};
type HospitalityData = {
  settings: { intro: string; aboutText: string; whyItems: WhyItem[]; philosophy: string };
  services: Service[];
};
type GalleryImage = {
  id: number; fileName: string; title: string | null; caption: string | null;
  sortOrder: number; focusX: number; focusY: number; isActive: boolean;
};
type ServiceForm = { title: string; slug: string; summary: string; description: string; sortOrder: number; isActive: boolean };
type OfferingForm = {
  title: string; slug: string; description: string; capacity: string; area: string;
  facilities: string; duration: string; priceOptions: PriceOption[]; sortOrder: number; isActive: boolean;
};

const emptyService: ServiceForm = { title: "", slug: "", summary: "", description: "", sortOrder: 0, isActive: true };
const emptyOffering: OfferingForm = { title: "", slug: "", description: "", capacity: "", area: "", facilities: "", duration: "", priceOptions: [], sortOrder: 0, isActive: true };
const emptyPrice = (): PriceOption => ({ label: "", price: 0, promoPrice: null, unit: "" });

async function uploadBinary(path: string, file: File, method: "POST" | "PUT" = "PUT") {
  const response = await fetch(apiUrl(path), {
    method,
    headers: { Authorization: `Bearer ${getAuthToken()}`, "Content-Type": file.type, "X-File-Name": encodeURIComponent(file.name) },
    body: file,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `${response.status}: Upload gagal`);
  }
  return response.json();
}

function imagePath(target: { kind: "service"; id: number } | { kind: "offering"; id: number }) {
  return target.kind === "service" ? `/api/hospitality/services/${target.id}/image` : `/api/hospitality/offerings/${target.id}/image`;
}

export default function AdminHospitality() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"halaman" | "layanan" | "galeri">("layanan");
  const [settingsForm, setSettingsForm] = useState({ intro: "", aboutText: "", whyItems: [] as WhyItem[], philosophy: "" });
  const [serviceDialog, setServiceDialog] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceForm, setServiceForm] = useState<ServiceForm>(emptyService);
  const [offeringDialog, setOfferingDialog] = useState(false);
  const [offeringService, setOfferingService] = useState<Service | null>(null);
  const [editingOffering, setEditingOffering] = useState<Offering | null>(null);
  const [offeringForm, setOfferingForm] = useState<OfferingForm>(emptyOffering);
  const [galleryEditor, setGalleryEditor] = useState<GalleryImage | null>(null);
  const [focusEditor, setFocusEditor] = useState<{ kind: "service" | "offering"; id: number; title: string; focusX: number; focusY: number } | null>(null);
  const { data, isLoading } = useQuery<HospitalityData>({ queryKey: ["/api/admin/hospitality"] });
  const { data: gallery = [] } = useQuery<GalleryImage[]>({ queryKey: ["/api/admin/hospitality/gallery"] });

  useEffect(() => {
    if (!data?.settings) return;
    setSettingsForm({ ...data.settings, whyItems: data.settings.whyItems.map(item => ({ ...item })) });
  }, [data?.settings]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hospitality"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hospitality/gallery"] }),
      queryClient.invalidateQueries({ queryKey: ["hospitality-catalog"] }),
      queryClient.invalidateQueries({ queryKey: ["hospitality-gallery"] }),
    ]);
  };

  const saveSettings = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/admin/hospitality/settings", settingsForm),
    onSuccess: async () => { await refresh(); toast({ title: "Informasi halaman berhasil disimpan" }); },
    onError: error => toast({ title: "Gagal menyimpan informasi", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" }),
  });

  const saveService = useMutation({
    mutationFn: () => apiRequest(editingService ? "PUT" : "POST", editingService ? `/api/admin/hospitality/services/${editingService.id}` : "/api/admin/hospitality/services", serviceForm),
    onSuccess: async () => { await refresh(); setServiceDialog(false); setEditingService(null); setServiceForm(emptyService); toast({ title: "Layanan berhasil disimpan" }); },
    onError: error => toast({ title: "Gagal menyimpan layanan", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" }),
  });

  const saveOffering = useMutation({
    mutationFn: () => apiRequest(editingOffering ? "PUT" : "POST", editingOffering ? `/api/admin/hospitality/services/${offeringService!.id}/offerings/${editingOffering.id}` : `/api/admin/hospitality/services/${offeringService!.id}/offerings`, offeringForm),
    onSuccess: async () => { await refresh(); setOfferingDialog(false); setOfferingService(null); setEditingOffering(null); setOfferingForm(emptyOffering); toast({ title: "Detail layanan berhasil disimpan" }); },
    onError: error => toast({ title: "Gagal menyimpan detail layanan", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" }),
  });

  const openService = (service?: Service) => {
    setEditingService(service || null);
    setServiceForm(service ? { title: service.title, slug: service.slug, summary: service.summary, description: service.description, sortOrder: service.sortOrder, isActive: service.isActive } : emptyService);
    setServiceDialog(true);
  };

  const openOffering = (service: Service, offering?: Offering) => {
    setOfferingService(service);
    setEditingOffering(offering || null);
    setOfferingForm(offering ? {
      title: offering.title, slug: offering.slug, description: offering.description, capacity: offering.capacity || "",
      area: offering.area || "", facilities: offering.facilities || "", duration: offering.duration || "",
      priceOptions: (offering.priceOptions || []).map(price => ({ ...price, price: Number(price.price), promoPrice: price.promoPrice == null ? null : Number(price.promoPrice) })),
      sortOrder: offering.sortOrder, isActive: offering.isActive,
    } : emptyOffering);
    setOfferingDialog(true);
  };

  const updatePrice = (index: number, key: keyof PriceOption, value: string | number | null) => setOfferingForm(current => ({
    ...current,
    priceOptions: current.priceOptions.map((price, priceIndex) => priceIndex === index ? { ...price, [key]: value } : price),
  }));

  const deleteService = async (service: Service) => {
    if (!confirm(`Hapus layanan ${service.title} dari katalog?`)) return;
    try { await apiRequest("DELETE", `/api/admin/hospitality/services/${service.id}`); await refresh(); toast({ title: "Layanan dihapus" }); }
    catch (error) { toast({ title: "Gagal menghapus layanan", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" }); }
  };

  const deleteOffering = async (service: Service, offering: Offering) => {
    if (!confirm(`Hapus detail ${offering.title}?`)) return;
    try { await apiRequest("DELETE", `/api/admin/hospitality/services/${service.id}/offerings/${offering.id}`); await refresh(); toast({ title: "Detail layanan dihapus" }); }
    catch (error) { toast({ title: "Gagal menghapus detail", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" }); }
  };

  const uploadImage = async (path: string, file?: File, method: "POST" | "PUT" = "PUT") => {
    if (!file) return;
    try { await uploadBinary(path, file, method); await refresh(); toast({ title: "Foto berhasil disimpan" }); }
    catch (error) { toast({ title: "Upload gagal", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" }); }
  };

  const saveFocus = async () => {
    if (!focusEditor) return;
    const endpoint = focusEditor.kind === "service"
      ? `/api/admin/hospitality/services/${focusEditor.id}/image/focus`
      : (() => { const service = data?.services.find(item => item.offerings.some(offering => offering.id === focusEditor.id)); return `/api/admin/hospitality/services/${service?.id}/offerings/${focusEditor.id}/image/focus`; })();
    try { await apiRequest("PUT", endpoint, { focusX: focusEditor.focusX, focusY: focusEditor.focusY }); await refresh(); setFocusEditor(null); toast({ title: "Posisi fokus disimpan" }); }
    catch (error) { toast({ title: "Gagal menyimpan fokus", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" }); }
  };

  return <div className="min-h-screen bg-gray-50 p-4 sm:p-8"><div className="mx-auto max-w-7xl">
    <Link href="/admin/dashboard" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-green-700"><ArrowLeft size={17} /> Dashboard Admin</Link>
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><h1 className="flex items-center gap-3 text-3xl font-extrabold"><Building2 className="text-green-700" />Kelola Hospitality Services</h1><p className="mt-2 text-gray-500">Kelola informasi halaman, layanan, pilihan harga, foto, dan galeri.</p></div>{tab === "layanan" && <Button className="bg-green-700 hover:bg-green-800" onClick={() => openService()}><Plus className="mr-2 h-4 w-4" />Tambah Layanan</Button>}</div>
    <div className="mb-6 flex flex-wrap gap-2">{([['halaman','Informasi Halaman'],['layanan','Layanan & Harga'],['galeri','Galeri']] as const).map(([value,label]) => <Button key={value} variant={tab === value ? "default" : "outline"} className={tab === value ? "bg-green-700 hover:bg-green-800" : ""} onClick={() => setTab(value)}>{label}</Button>)}</div>

    {tab === "halaman" && <Card><CardHeader><CardTitle>Tentang Hospitality Services</CardTitle><CardDescription>Konten ini tampil pada hero dan jendela Tentang Hospitality Services.</CardDescription></CardHeader><CardContent className="space-y-5"><div><Label>Pengantar singkat</Label><Textarea rows={3} value={settingsForm.intro} onChange={event => setSettingsForm(current => ({ ...current, intro: event.target.value }))} /></div><div><Label>Tentang Kami</Label><Textarea rows={6} value={settingsForm.aboutText} onChange={event => setSettingsForm(current => ({ ...current, aboutText: event.target.value }))} /></div><div><div className="mb-3 flex items-center justify-between"><Label>Mengapa Memilih Layanan Kami?</Label><Button size="sm" variant="outline" onClick={() => setSettingsForm(current => ({ ...current, whyItems: [...current.whyItems, { title: "", description: "" }] }))}><Plus className="mr-1 h-4 w-4" />Tambah Poin</Button></div><div className="space-y-3">{settingsForm.whyItems.map((item,index) => <div key={index} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[.7fr_1.3fr_auto]"><Input placeholder="Judul" value={item.title} onChange={event => setSettingsForm(current => ({ ...current, whyItems: current.whyItems.map((why,whyIndex) => whyIndex === index ? { ...why, title: event.target.value } : why) }))} /><Textarea rows={2} placeholder="Penjelasan" value={item.description} onChange={event => setSettingsForm(current => ({ ...current, whyItems: current.whyItems.map((why,whyIndex) => whyIndex === index ? { ...why, description: event.target.value } : why) }))} /><Button size="icon" variant="ghost" onClick={() => setSettingsForm(current => ({ ...current, whyItems: current.whyItems.filter((_,whyIndex) => whyIndex !== index) }))}><Trash2 className="h-4 w-4 text-red-600" /></Button></div>)}</div></div><div><Label>Filosofi Layanan</Label><Textarea rows={6} value={settingsForm.philosophy} onChange={event => setSettingsForm(current => ({ ...current, philosophy: event.target.value }))} /></div><Button className="bg-green-700 hover:bg-green-800" disabled={saveSettings.isPending} onClick={() => saveSettings.mutate()}>{saveSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<Save className="mr-2 h-4 w-4" />Simpan Informasi</Button></CardContent></Card>}

    {tab === "layanan" && (isLoading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-green-700" /></div> : <div className="space-y-6">{data?.services.map(service => <Card key={service.id} className={service.isActive ? "" : "opacity-65"}><CardHeader><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase text-green-700">/{service.slug} · Urutan {service.sortOrder} · {service.isActive ? "Aktif" : "Nonaktif"}</p><CardTitle className="mt-1">{service.title}</CardTitle><CardDescription className="mt-2 max-w-3xl">{service.summary}</CardDescription></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => openService(service)}><Pencil className="mr-1 h-4 w-4" />Edit</Button><label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-1.5 text-sm font-medium"><ImagePlus className="mr-1 h-4 w-4" />{service.hasImage ? "Ganti Foto" : "Foto Kartu"}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => { uploadImage(`/api/admin/hospitality/services/${service.id}/image`, event.target.files?.[0]); event.target.value = ""; }} /></label>{service.hasImage && <Button size="sm" variant="outline" onClick={() => setFocusEditor({ kind: "service", id: service.id, title: service.title, focusX: service.imageFocusX, focusY: service.imageFocusY })}><Crosshair className="mr-1 h-4 w-4" />Fokus</Button>}<Button size="sm" variant="ghost" onClick={() => deleteService(service)}><Trash2 className="h-4 w-4 text-red-600" /></Button></div></div></CardHeader><CardContent><div className="mb-4 flex items-center justify-between"><h3 className="font-extrabold">Detail / Paket ({service.offerings.length})</h3><Button size="sm" className="bg-green-700 hover:bg-green-800" onClick={() => openOffering(service)}><Plus className="mr-1 h-4 w-4" />Tambah Detail</Button></div>{service.offerings.length === 0 ? <div className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">Belum ada detail atau paket pada layanan ini.</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{service.offerings.map(offering => <article key={offering.id} className={`overflow-hidden rounded-xl border bg-white ${offering.isActive ? "" : "opacity-60"}`}><div className="aspect-video bg-green-50">{offering.hasImage ? <img src={apiUrl(`/api/hospitality/offerings/${offering.id}/image`)} alt={offering.title} className="h-full w-full object-cover" style={{ objectPosition: `${offering.imageFocusX}% ${offering.imageFocusY}%` }} /> : <div className="flex h-full items-center justify-center text-green-800"><Building2 className="h-10 w-10" /></div>}</div><div className="p-4"><h4 className="font-extrabold">{offering.title}</h4><p className="mt-1 text-xs text-gray-500">{offering.priceOptions.length} pilihan harga · Urutan {offering.sortOrder}</p><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => openOffering(service,offering)}><Pencil className="h-4 w-4" /></Button><label className="inline-flex cursor-pointer items-center rounded-md border px-2.5 py-1.5 text-xs font-medium"><ImagePlus className="mr-1 h-3.5 w-3.5" />Foto<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => { uploadImage(`/api/admin/hospitality/services/${service.id}/offerings/${offering.id}/image`, event.target.files?.[0]); event.target.value = ""; }} /></label>{offering.hasImage && <Button size="sm" variant="outline" onClick={() => setFocusEditor({ kind: "offering", id: offering.id, title: offering.title, focusX: offering.imageFocusX, focusY: offering.imageFocusY })}><Crosshair className="h-4 w-4" /></Button>}<Button size="sm" variant="ghost" onClick={() => deleteOffering(service,offering)}><Trash2 className="h-4 w-4 text-red-600" /></Button></div></div></article>)}</div>}</CardContent></Card>)}</div>)}

    {tab === "galeri" && <div><Card className="mb-6"><CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6"><div><CardTitle>Galeri Hospitality Services</CardTitle><p className="mt-1 text-sm text-gray-500">Unggah JPG, PNG, atau WebP maksimal 8 MB.</p></div><label className="inline-flex cursor-pointer items-center rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white"><ImagePlus className="mr-2 h-4 w-4" />Unggah Foto<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => { uploadImage("/api/admin/hospitality/gallery", event.target.files?.[0], "POST"); event.target.value = ""; }} /></label></CardContent></Card><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{gallery.map(image => <Card key={image.id} className={image.isActive ? "" : "opacity-60"}><div className="aspect-video overflow-hidden"><img src={apiUrl(`/api/hospitality/gallery/images/${image.id}`)} alt={image.title || image.fileName} className="h-full w-full object-cover" style={{ objectPosition: `${image.focusX}% ${image.focusY}%` }} /></div><CardContent className="space-y-3 pt-4">{galleryEditor?.id === image.id ? <><Input value={galleryEditor.title || ""} placeholder="Judul" onChange={event => setGalleryEditor(current => current ? { ...current, title: event.target.value } : current)} /><Textarea value={galleryEditor.caption || ""} placeholder="Keterangan" onChange={event => setGalleryEditor(current => current ? { ...current, caption: event.target.value } : current)} /><div className="grid grid-cols-3 gap-2"><Input type="number" value={galleryEditor.sortOrder} onChange={event => setGalleryEditor(current => current ? { ...current, sortOrder: Number(event.target.value) || 0 } : current)} /><Input type="number" min="0" max="100" value={galleryEditor.focusX} onChange={event => setGalleryEditor(current => current ? { ...current, focusX: Number(event.target.value) || 0 } : current)} /><Input type="number" min="0" max="100" value={galleryEditor.focusY} onChange={event => setGalleryEditor(current => current ? { ...current, focusY: Number(event.target.value) || 0 } : current)} /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={galleryEditor.isActive} onChange={event => setGalleryEditor(current => current ? { ...current, isActive: event.target.checked } : current)} />Tampilkan</label><div className="flex gap-2"><Button onClick={async () => { await apiRequest("PUT", `/api/admin/hospitality/gallery/${image.id}`, galleryEditor); setGalleryEditor(null); await refresh(); toast({ title: "Foto galeri diperbarui" }); }}>Simpan</Button><Button variant="outline" onClick={() => setGalleryEditor(null)}>Batal</Button></div></> : <><p className="font-bold">{image.title || image.fileName}</p><p className="text-xs text-gray-500">Urutan {image.sortOrder} · {image.isActive ? "Aktif" : "Nonaktif"}</p><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setGalleryEditor({ ...image })}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={async () => { if (!confirm(`Hapus ${image.title || image.fileName}?`)) return; await apiRequest("DELETE", `/api/admin/hospitality/gallery/${image.id}`); await refresh(); toast({ title: "Foto galeri dihapus" }); }}><Trash2 className="h-4 w-4 text-red-600" /></Button></div></>}</CardContent></Card>)}</div></div>}
  </div>

  <Dialog open={serviceDialog} onOpenChange={setServiceDialog}><DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{editingService ? "Edit Layanan" : "Tambah Layanan"}</DialogTitle><DialogDescription>Informasi kartu utama pada halaman Hospitality Services.</DialogDescription></DialogHeader><div className="space-y-4"><div><Label>Nama layanan</Label><Input value={serviceForm.title} onChange={event => setServiceForm(current => ({ ...current, title: event.target.value }))} /></div><div><Label>Slug (opsional)</Label><Input value={serviceForm.slug} onChange={event => setServiceForm(current => ({ ...current, slug: event.target.value }))} /></div><div><Label>Ringkasan kartu</Label><Textarea rows={3} value={serviceForm.summary} onChange={event => setServiceForm(current => ({ ...current, summary: event.target.value }))} /></div><div><Label>Deskripsi lengkap</Label><Textarea rows={6} value={serviceForm.description} onChange={event => setServiceForm(current => ({ ...current, description: event.target.value }))} /></div><div><Label>Urutan</Label><Input type="number" value={serviceForm.sortOrder} onChange={event => setServiceForm(current => ({ ...current, sortOrder: Number(event.target.value) || 0 }))} /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={serviceForm.isActive} onChange={event => setServiceForm(current => ({ ...current, isActive: event.target.checked }))} />Tampilkan di katalog</label><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setServiceDialog(false)}>Batal</Button><Button className="bg-green-700" disabled={saveService.isPending} onClick={() => saveService.mutate()}>{saveService.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan</Button></div></div></DialogContent></Dialog>

  <Dialog open={offeringDialog} onOpenChange={setOfferingDialog}><DialogContent className="max-h-[94vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{editingOffering ? "Edit" : "Tambah"} Detail {offeringService?.title}</DialogTitle><DialogDescription>Kelola deskripsi, fasilitas, harga reguler, dan harga khusus.</DialogDescription></DialogHeader><div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div><Label>Nama pilihan</Label><Input value={offeringForm.title} onChange={event => setOfferingForm(current => ({ ...current, title: event.target.value }))} /></div><div><Label>Slug (opsional)</Label><Input value={offeringForm.slug} onChange={event => setOfferingForm(current => ({ ...current, slug: event.target.value }))} /></div></div><div><Label>Deskripsi</Label><Textarea rows={5} value={offeringForm.description} onChange={event => setOfferingForm(current => ({ ...current, description: event.target.value }))} /></div><div className="grid gap-4 sm:grid-cols-2"><div><Label>Kapasitas</Label><Input value={offeringForm.capacity} onChange={event => setOfferingForm(current => ({ ...current, capacity: event.target.value }))} /></div><div><Label>Luas</Label><Input value={offeringForm.area} onChange={event => setOfferingForm(current => ({ ...current, area: event.target.value }))} /></div><div><Label>Durasi</Label><Input value={offeringForm.duration} onChange={event => setOfferingForm(current => ({ ...current, duration: event.target.value }))} /></div><div><Label>Urutan</Label><Input type="number" value={offeringForm.sortOrder} onChange={event => setOfferingForm(current => ({ ...current, sortOrder: Number(event.target.value) || 0 }))} /></div></div><div><Label>Fasilitas & ketentuan</Label><Textarea rows={4} value={offeringForm.facilities} onChange={event => setOfferingForm(current => ({ ...current, facilities: event.target.value }))} /></div><div><div className="mb-3 flex items-center justify-between"><Label>Pilihan Harga</Label><Button size="sm" variant="outline" onClick={() => setOfferingForm(current => ({ ...current, priceOptions: [...current.priceOptions, emptyPrice()] }))}><Plus className="mr-1 h-4 w-4" />Tambah Harga</Button></div><div className="space-y-3">{offeringForm.priceOptions.map((price,index) => <div key={index} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1.2fr_1fr_1fr_.7fr_auto]"><Input placeholder="Label" value={price.label} onChange={event => updatePrice(index,"label",event.target.value)} /><Input type="number" min="0" placeholder="Harga normal" value={price.price || ""} onChange={event => updatePrice(index,"price",Number(event.target.value) || 0)} /><Input type="number" min="0" placeholder="Harga khusus" value={price.promoPrice ?? ""} onChange={event => updatePrice(index,"promoPrice",event.target.value === "" ? null : Number(event.target.value))} /><Input placeholder="/ malam" value={price.unit} onChange={event => updatePrice(index,"unit",event.target.value)} /><Button size="icon" variant="ghost" onClick={() => setOfferingForm(current => ({ ...current, priceOptions: current.priceOptions.filter((_,priceIndex) => priceIndex !== index) }))}><X className="h-4 w-4 text-red-600" /></Button></div>)}</div></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={offeringForm.isActive} onChange={event => setOfferingForm(current => ({ ...current, isActive: event.target.checked }))} />Tampilkan di halaman publik</label><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOfferingDialog(false)}>Batal</Button><Button className="bg-green-700" disabled={saveOffering.isPending} onClick={() => saveOffering.mutate()}>{saveOffering.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan Detail</Button></div></div></DialogContent></Dialog>

  <Dialog open={focusEditor !== null} onOpenChange={open => !open && setFocusEditor(null)}>{focusEditor && <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Atur Fokus Foto {focusEditor.title}</DialogTitle><DialogDescription>Klik bagian foto yang harus tetap terlihat saat gambar dipotong.</DialogDescription></DialogHeader><button type="button" className="relative aspect-video overflow-hidden rounded-xl bg-gray-100" onClick={event => { const bounds = event.currentTarget.getBoundingClientRect(); setFocusEditor(current => current ? { ...current, focusX: Math.round(((event.clientX-bounds.left)/bounds.width)*100), focusY: Math.round(((event.clientY-bounds.top)/bounds.height)*100) } : current); }}><img src={apiUrl(imagePath({ kind: focusEditor.kind, id: focusEditor.id }))} alt="Preview fokus" className="h-full w-full object-cover" style={{ objectPosition: `${focusEditor.focusX}% ${focusEditor.focusY}%` }} /><span className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-green-600 shadow" style={{ left: `${focusEditor.focusX}%`, top: `${focusEditor.focusY}%` }} /></button><div className="grid grid-cols-3 gap-2">{[[50,0,'Atas'],[50,50,'Tengah'],[50,100,'Bawah'],[0,50,'Kiri'],[100,50,'Kanan']] .map(([x,y,label]) => <Button key={String(label)} size="sm" variant="outline" onClick={() => setFocusEditor(current => current ? { ...current, focusX: Number(x), focusY: Number(y) } : current)}>{label}</Button>)}</div><Button className="bg-green-700" onClick={saveFocus}>Simpan Fokus</Button></DialogContent>}</Dialog>
  </div>;
}
