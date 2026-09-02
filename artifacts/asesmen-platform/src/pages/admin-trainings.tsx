import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Eye, ImagePlus, Loader2, Pencil, Plus, Save, Trash2, Users } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getAuthToken, queryClient } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api-base";

type Option = { id: number; name: string; description?: string | null; price: string; capacity?: number | null; sortOrder: number; isActive: boolean };
type Training = { id: number; slug: string; title: string; summary: string; description: string; startsAt?: string | null; endsAt?: string | null; location?: string | null; registrationDeadline?: string | null; sortOrder: number; status: "draft" | "published" | "closed" | "completed"; posterId?: number | null; posterFocusX?: number; posterFocusY?: number; options: Option[] };
type Testimonial = { id: number; name: string; occupation?: string; trainingName?: string; testimonial: string; sortOrder: number; isActive: boolean };
type Gallery = { id: number; fileName: string; title?: string; caption?: string; sortOrder: number; focusX: number; focusY: number; isActive: boolean };
type Registration = { id: number; orderId: number; trainingId: number; trainingTitle: string; optionName: string; fullName: string; birthDate?: string | null; gender?: string | null; address?: string | null; whatsappNumber: string; email: string; education?: string | null; occupation?: string | null; price: string; status: string; paymentStatus: string; adminNotes?: string | null; createdAt: string };
type TrainingForm = { title: string; slug: string; summary: string; description: string; startsAt: string; endsAt: string; location: string; registrationDeadline: string; sortOrder: number; status: "draft" | "published" | "closed" | "completed" };
type TrainingPageSettings = {
  hasHero: boolean; heroFileName?: string; heroFocusX: number; heroFocusY: number;
  hasTestimonialBackground: boolean; testimonialBackgroundFileName?: string | null;
  testimonialBackgroundFocusX: number; testimonialBackgroundFocusY: number;
  testimonialInstagramUrl?: string | null; settingsUpdatedAt?: string | null;
};
const emptyTraining: TrainingForm = { title: "", slug: "", summary: "", description: "", startsAt: "", endsAt: "", location: "", registrationDeadline: "", sortOrder: 0, status: "draft" };
const emptyOption = { name: "", description: "", price: 0, capacity: "", sortOrder: 0, isActive: true };
const emptyTestimonial = { name: "", occupation: "", trainingName: "", testimonial: "", sortOrder: 0, isActive: true };

async function uploadBinary(path: string, file: File, method = "POST") {
  const response = await fetch(apiUrl(path), {
    method,
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
    },
    body: file,
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Upload gagal");
  return response.json();
}
function localDateTime(value?: string | null) { return value ? new Date(value).toISOString().slice(0, 16) : ""; }
function money(value: string | number) { return `Rp ${new Intl.NumberFormat("id-ID").format(Number(value) || 0)}`; }
function displayDate(value?: string | null, includeTime = false) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", includeTime ? { dateStyle: "long", timeStyle: "short" } : { dateStyle: "long" }).format(date);
}
function isTrainingCompleted(training: Training) {
  if (training.status === "completed") return true;
  const finishedAt = training.endsAt || training.startsAt;
  return Boolean(finishedAt && new Date(finishedAt).getTime() < Date.now());
}
function trainingStatusLabel(training: Training) {
  if (isTrainingCompleted(training)) return "Selesai";
  if (training.status === "published") return "Terbit";
  if (training.status === "closed") return "Pendaftaran ditutup";
  return "Draft";
}

export default function AdminTrainings() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"agenda" | "testimoni" | "galeri" | "peserta">("agenda");
  const [editing, setEditing] = useState<Training | null>(null);
  const [isTrainingFormOpen, setIsTrainingFormOpen] = useState(false);
  const [form, setForm] = useState<TrainingForm>(emptyTraining);
  const [optionTraining, setOptionTraining] = useState<Training | null>(null);
  const [editingOption, setEditingOption] = useState<Option | null>(null);
  const [optionForm, setOptionForm] = useState(emptyOption);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [testimonialForm, setTestimonialForm] = useState(emptyTestimonial);
  const [editingGallery, setEditingGallery] = useState<Gallery | null>(null);
  const [expandedRegistrationId, setExpandedRegistrationId] = useState<number | null>(null);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [trainingFilter, setTrainingFilter] = useState<"all" | "active" | "completed">("all");
  const [testimonialSettingsForm, setTestimonialSettingsForm] = useState({ backgroundFocusX: 50, backgroundFocusY: 50, instagramUrl: "" });

  const { data, isLoading } = useQuery<{ trainings: Training[]; settings: TrainingPageSettings }>({ queryKey: ["/api/admin/trainings"] });
  const { data: testimonials = [] } = useQuery<Testimonial[]>({ queryKey: ["/api/admin/training-testimonials"] });
  const { data: gallery = [] } = useQuery<Gallery[]>({ queryKey: ["/api/admin/training-gallery"] });
  const { data: registrations = [] } = useQuery<Registration[]>({ queryKey: ["/api/admin/training-registrations"] });
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["/api/admin/trainings"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/admin/training-testimonials"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/admin/training-gallery"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/admin/training-registrations"] }),
  ]);
  const trainings = data?.trainings || [];
  const filteredTrainings = useMemo(() => trainings.filter(training => trainingFilter === "all" || (trainingFilter === "completed" ? isTrainingCompleted(training) : !isTrainingCompleted(training))), [trainings, trainingFilter]);

  useEffect(() => {
    if (!data?.settings) return;
    setTestimonialSettingsForm({
      backgroundFocusX: data.settings.testimonialBackgroundFocusX ?? 50,
      backgroundFocusY: data.settings.testimonialBackgroundFocusY ?? 50,
      instagramUrl: data.settings.testimonialInstagramUrl || "",
    });
  }, [data?.settings?.testimonialBackgroundFocusX, data?.settings?.testimonialBackgroundFocusY, data?.settings?.testimonialInstagramUrl]);

  const saveTraining = useMutation({ mutationFn: () => apiRequest(editing ? "PUT" : "POST", editing ? `/api/admin/trainings/${editing.id}` : "/api/admin/trainings", { ...form, startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null, endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null, registrationDeadline: form.registrationDeadline ? new Date(form.registrationDeadline).toISOString() : null }), onSuccess: async () => { await refresh(); setEditing(null); setIsTrainingFormOpen(false); setForm(emptyTraining); toast({ title: "Agenda pelatihan tersimpan" }); }, onError: error => toast({ title: "Gagal menyimpan", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" }) });
  const saveOption = useMutation({ mutationFn: () => apiRequest(editingOption ? "PUT" : "POST", editingOption ? `/api/admin/trainings/${optionTraining!.id}/options/${editingOption.id}` : `/api/admin/trainings/${optionTraining!.id}/options`, { ...optionForm, capacity: optionForm.capacity ? Number(optionForm.capacity) : null }), onSuccess: async () => { await refresh(); setOptionTraining(null); setEditingOption(null); setOptionForm(emptyOption); toast({ title: "Pilihan agenda tersimpan" }); } });
  const deleteOption = useMutation({
    mutationFn: (option: Option) => apiRequest("DELETE", `/api/admin/trainings/${optionTraining!.id}/options/${option.id}`),
    onSuccess: async (_data, option) => {
      setOptionTraining(current => current ? { ...current, options: current.options.filter(item => item.id !== option.id) } : null);
      if (editingOption?.id === option.id) {
        setEditingOption(null);
        setOptionForm(emptyOption);
      }
      await refresh();
      toast({ title: "Pilihan agenda dihapus" });
    },
    onError: error => toast({ title: "Gagal menghapus pilihan", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" }),
  });
  const saveTestimonial = useMutation({ mutationFn: () => apiRequest(editingTestimonial ? "PUT" : "POST", editingTestimonial ? `/api/admin/training-testimonials/${editingTestimonial.id}` : "/api/admin/training-testimonials", testimonialForm), onSuccess: async () => { await refresh(); setEditingTestimonial(null); setTestimonialForm(emptyTestimonial); toast({ title: "Testimoni tersimpan" }); } });
  const saveTestimonialSettings = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/admin/trainings/testimonial/settings", testimonialSettingsForm),
    onSuccess: async () => { await refresh(); toast({ title: "Tampilan testimoni tersimpan" }); },
    onError: error => toast({ title: "Gagal menyimpan pengaturan", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" }),
  });

  const registrationStats = useMemo(() => ({ total: registrations.length, paid: registrations.filter(item => item.paymentStatus === "paid").length }), [registrations]);
  const openTraining = (training?: Training) => { setEditing(training || null); setIsTrainingFormOpen(true); setForm(training ? { title: training.title, slug: training.slug, summary: training.summary, description: training.description, startsAt: localDateTime(training.startsAt), endsAt: localDateTime(training.endsAt), location: training.location || "", registrationDeadline: localDateTime(training.registrationDeadline), sortOrder: training.sortOrder, status: training.status } : emptyTraining); };
  const exportRegistrationsCsv = async () => {
    setIsExportingCsv(true);
    try {
      const response = await fetch(apiUrl("/api/admin/training-registrations.csv"), {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "CSV peserta gagal diunduh");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "pendaftaran-pelatihan.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast({ title: "CSV peserta berhasil diunduh" });
    } catch (error) {
      toast({ title: "Export CSV gagal", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" });
    } finally {
      setIsExportingCsv(false);
    }
  };

  return <div className="min-h-screen bg-gray-50 p-4 sm:p-8"><div className="mx-auto max-w-7xl">
    <Link href="/admin/dashboard" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-green-700"><ArrowLeft size={17} /> Dashboard Admin</Link>
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-extrabold">Kelola Pelatihan</h1><p className="mt-1 text-gray-500">Kelola agenda, pilihan harga, peserta, banner, testimoni, dan galeri.</p></div><Button onClick={() => { setTab("agenda"); openTraining(); }} className="bg-green-700 hover:bg-green-800"><Plus className="mr-2 h-4 w-4" />Tambah Agenda</Button></div>
    <div className="mb-6 flex flex-wrap gap-2">{([['agenda','Agenda'],['testimoni','Testimoni'],['galeri','Galeri'],['peserta',`Peserta (${registrationStats.total})`]] as const).map(([value,label]) => <Button key={value} variant={tab === value ? "default" : "outline"} className={tab === value ? "bg-green-700 hover:bg-green-800" : ""} onClick={() => setTab(value)}>{label}</Button>)}</div>

    {tab === "agenda" && <div className="space-y-6">
      <Card><CardHeader><CardTitle>Banner Agenda Pelatihan</CardTitle></CardHeader><CardContent className="flex flex-wrap items-center gap-4"><div className="h-24 w-48 overflow-hidden rounded-xl bg-green-50">{data?.settings.hasHero && <img src={apiUrl("/api/trainings/hero")} alt="Banner" className="h-full w-full object-cover" />}</div><label className="inline-flex cursor-pointer items-center rounded-md border px-4 py-2 text-sm font-semibold"><ImagePlus className="mr-2 h-4 w-4" />{data?.settings.hasHero ? "Ganti Banner" : "Unggah Banner"}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async e => { const file=e.target.files?.[0]; if(!file)return; try{await uploadBinary('/api/admin/trainings/hero/image',file,'PUT');await refresh();toast({title:'Banner tersimpan'});}catch(error){toast({title:'Upload gagal',description:String(error),variant:'destructive'});}e.target.value='';}} /></label></CardContent></Card>
      {isTrainingFormOpen && <Card><CardHeader><CardTitle>{editing ? "Edit Agenda" : "Tambah Agenda"}</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div><Label>Judul</Label><Input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></div><div><Label>Slug (opsional)</Label><Input value={form.slug} onChange={e=>setForm({...form,slug:e.target.value})}/></div><div className="sm:col-span-2"><Label>Ringkasan</Label><Textarea value={form.summary} onChange={e=>setForm({...form,summary:e.target.value})}/></div><div className="sm:col-span-2"><Label>Deskripsi lengkap</Label><Textarea rows={7} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div><div><Label>Mulai</Label><Input type="datetime-local" value={form.startsAt} onChange={e=>setForm({...form,startsAt:e.target.value})}/></div><div><Label>Selesai</Label><Input type="datetime-local" value={form.endsAt} onChange={e=>setForm({...form,endsAt:e.target.value})}/></div><div><Label>Batas pendaftaran</Label><Input type="datetime-local" value={form.registrationDeadline} onChange={e=>setForm({...form,registrationDeadline:e.target.value})}/></div><div><Label>Lokasi/media</Label><Input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></div><div><Label>Urutan</Label><Input type="number" value={form.sortOrder} onChange={e=>setForm({...form,sortOrder:Number(e.target.value)||0})}/></div><div><Label>Status</Label><select className="h-10 w-full rounded-md border bg-white px-3" value={form.status} onChange={e=>setForm({...form,status:e.target.value as TrainingForm['status']})}><option value="draft">Draft</option><option value="published">Terbit / Pendaftaran dibuka</option><option value="closed">Pendaftaran ditutup</option><option value="completed">Selesai / Arsip</option></select></div><div className="sm:col-span-2 flex justify-end gap-2"><Button variant="outline" onClick={()=>{setEditing(null);setIsTrainingFormOpen(false);setForm(emptyTraining);}}>Batal</Button><Button className="bg-green-700" disabled={saveTraining.isPending||form.title.length<3||form.summary.length<10||form.description.length<20} onClick={()=>saveTraining.mutate()}>{saveTraining.isPending&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}<Save className="mr-2 h-4 w-4"/>Simpan</Button></div></CardContent></Card>}
      <div className="flex flex-wrap items-center gap-2"><span className="mr-1 text-sm font-semibold text-gray-600">Tampilkan:</span>{([['all','Semua'],['active','Aktif'],['completed','Selesai']] as const).map(([value,label])=><Button key={value} type="button" size="sm" variant={trainingFilter===value?'default':'outline'} className={trainingFilter===value?'bg-green-700 hover:bg-green-800':''} onClick={()=>setTrainingFilter(value)}>{label}</Button>)}</div>
      {isLoading ? <Loader2 className="animate-spin"/> : filteredTrainings.length === 0 ? <div className="rounded-xl border bg-white p-10 text-center text-gray-500">Tidak ada agenda pada kategori ini.</div> : <div className="grid gap-5 md:grid-cols-2">{filteredTrainings.map(training=><Card key={training.id}><div className="aspect-[16/7] overflow-hidden bg-green-50">{training.posterId&&<img src={apiUrl(`/api/trainings/posters/${training.posterId}`)} alt="" className="h-full w-full object-cover" style={{objectPosition:`${training.posterFocusX??50}% ${training.posterFocusY??50}%`}}/>}</div><CardContent className="space-y-4 pt-5"><div><span className="text-xs font-bold uppercase text-green-700">{trainingStatusLabel(training)}</span><h2 className="text-xl font-extrabold">{training.title}</h2></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>openTraining(training)}><Pencil className="mr-1 h-4 w-4"/>Edit</Button><Button size="sm" variant="outline" onClick={()=>{setOptionTraining(training);setEditingOption(null);setOptionForm(emptyOption);}}>Pilihan & Harga ({training.options.length})</Button><label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-1.5 text-sm font-medium"><ImagePlus className="mr-1 h-4 w-4"/>Poster<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;await uploadBinary(`/api/admin/trainings/${training.id}/poster`,file,'PUT');await refresh();e.target.value='';}}/></label><Button size="sm" variant="ghost" className="text-red-600" onClick={async()=>{if(!confirm(`Hapus ${training.title}?`))return;await apiRequest('DELETE',`/api/admin/trainings/${training.id}`);await refresh();}}><Trash2 className="h-4 w-4"/></Button></div></CardContent></Card>)}</div>}
      {optionTraining&&<Card><CardHeader><CardTitle>Pilihan Agenda: {optionTraining.title}</CardTitle></CardHeader><CardContent className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Input placeholder="Nama pilihan" value={optionForm.name} onChange={e=>setOptionForm({...optionForm,name:e.target.value})}/><Input placeholder="Deskripsi" value={optionForm.description} onChange={e=>setOptionForm({...optionForm,description:e.target.value})}/><Input type="number" placeholder="Harga" value={optionForm.price||''} onChange={e=>setOptionForm({...optionForm,price:Number(e.target.value)||0})}/><Input type="number" placeholder="Kuota (opsional)" value={optionForm.capacity} onChange={e=>setOptionForm({...optionForm,capacity:e.target.value})}/><Input type="number" placeholder="Urutan" value={optionForm.sortOrder} onChange={e=>setOptionForm({...optionForm,sortOrder:Number(e.target.value)||0})}/><Button disabled={!optionForm.name||saveOption.isPending} onClick={()=>saveOption.mutate()}>{editingOption?'Simpan':'Tambah'}</Button></div><div className="space-y-2">{optionTraining.options.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><strong>{item.name}</strong><span className="ml-3 text-green-700">{money(item.price)}</span>{item.capacity&&<span className="ml-3 text-xs text-gray-500">Kuota {item.capacity}</span>}</div><div><Button size="sm" variant="ghost" onClick={()=>{setEditingOption(item);setOptionForm({name:item.name,description:item.description||'',price:Number(item.price),capacity:item.capacity?String(item.capacity):'',sortOrder:item.sortOrder,isActive:item.isActive});}}><Pencil className="h-4 w-4"/></Button><Button size="sm" variant="ghost" disabled={deleteOption.isPending} onClick={()=>{if(confirm(`Hapus pilihan ${item.name}?`))deleteOption.mutate(item);}}><Trash2 className="h-4 w-4 text-red-600"/></Button></div></div>)}</div><Button variant="outline" onClick={()=>setOptionTraining(null)}>Tutup</Button></CardContent></Card>}
    </div>}

    {tab === "testimoni" && <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Tampilan Section Testimoni</CardTitle></CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.8fr)]">
          <div className="space-y-4">
            <div className="aspect-[16/7] overflow-hidden rounded-2xl bg-gradient-to-r from-[#ead8bc] to-[#fffaf2] ring-1 ring-amber-100">
              {data?.settings.hasTestimonialBackground && <img src={`${apiUrl("/api/trainings/testimonial-background")}?v=${encodeURIComponent(data.settings.settingsUpdatedAt || "")}`} alt="Background testimoni" className="h-full w-full object-cover" style={{objectPosition:`${testimonialSettingsForm.backgroundFocusX}% ${testimonialSettingsForm.backgroundFocusY}%`}}/>}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-md border px-4 py-2 text-sm font-semibold"><ImagePlus className="mr-2 h-4 w-4"/>{data?.settings.hasTestimonialBackground ? "Ganti Foto" : "Unggah Foto"}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{await uploadBinary('/api/admin/trainings/testimonial/background',file,'PUT');await refresh();toast({title:'Background testimoni tersimpan'});}catch(error){toast({title:'Upload gagal',description:error instanceof Error?error.message:String(error),variant:'destructive'});}e.target.value='';}}/></label>
              {data?.settings.hasTestimonialBackground && <Button type="button" variant="outline" className="text-red-600" onClick={async()=>{if(!confirm('Hapus background testimoni?'))return;try{await apiRequest('DELETE','/api/admin/trainings/testimonial/background');await refresh();toast({title:'Background testimoni dihapus'});}catch(error){toast({title:'Gagal menghapus',description:error instanceof Error?error.message:String(error),variant:'destructive'});}}}><Trash2 className="mr-2 h-4 w-4"/>Hapus</Button>}
            </div>
            <p className="text-xs text-gray-500">Format JPG, PNG, atau WebP maksimal 8 MB. Foto akan diberi lapisan krem transparan pada halaman publik.</p>
          </div>
          <div className="space-y-4">
            <div><Label>Link postingan Instagram</Label><Input type="url" placeholder="https://www.instagram.com/p/..." value={testimonialSettingsForm.instagramUrl} onChange={e=>setTestimonialSettingsForm({...testimonialSettingsForm,instagramUrl:e.target.value})}/><p className="mt-1 text-xs text-gray-500">Kosongkan bila tautan tidak ingin ditampilkan.</p></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Fokus horizontal (%)</Label><Input type="number" min="0" max="100" value={testimonialSettingsForm.backgroundFocusX} onChange={e=>setTestimonialSettingsForm({...testimonialSettingsForm,backgroundFocusX:Math.min(100,Math.max(0,Number(e.target.value)||0))})}/></div><div><Label>Fokus vertikal (%)</Label><Input type="number" min="0" max="100" value={testimonialSettingsForm.backgroundFocusY} onChange={e=>setTestimonialSettingsForm({...testimonialSettingsForm,backgroundFocusY:Math.min(100,Math.max(0,Number(e.target.value)||0))})}/></div></div>
            <Button disabled={saveTestimonialSettings.isPending} onClick={()=>saveTestimonialSettings.mutate()} className="bg-green-700 hover:bg-green-800">{saveTestimonialSettings.isPending&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}<Save className="mr-2 h-4 w-4"/>Simpan Tampilan</Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]"><Card><CardHeader><CardTitle>{editingTestimonial?'Edit':'Tambah'} Testimoni</CardTitle></CardHeader><CardContent className="space-y-3"><Input placeholder="Nama" value={testimonialForm.name} onChange={e=>setTestimonialForm({...testimonialForm,name:e.target.value})}/><Input placeholder="Pekerjaan" value={testimonialForm.occupation} onChange={e=>setTestimonialForm({...testimonialForm,occupation:e.target.value})}/><Input placeholder="Pelatihan yang diikuti" value={testimonialForm.trainingName} onChange={e=>setTestimonialForm({...testimonialForm,trainingName:e.target.value})}/><Textarea placeholder="Isi testimoni" value={testimonialForm.testimonial} onChange={e=>setTestimonialForm({...testimonialForm,testimonial:e.target.value})}/><Input type="number" placeholder="Urutan" value={testimonialForm.sortOrder} onChange={e=>setTestimonialForm({...testimonialForm,sortOrder:Number(e.target.value)||0})}/><label className="flex gap-2 text-sm"><input type="checkbox" checked={testimonialForm.isActive} onChange={e=>setTestimonialForm({...testimonialForm,isActive:e.target.checked})}/>Tampilkan</label><Button disabled={!testimonialForm.name||testimonialForm.testimonial.length<5} onClick={()=>saveTestimonial.mutate()}>Simpan</Button></CardContent></Card><div className="space-y-3">{testimonials.map(item=><Card key={item.id}><CardContent className="pt-5"><p className="leading-6">“{item.testimonial}”</p><p className="mt-2 font-bold">{item.name}</p><div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={()=>{setEditingTestimonial(item);setTestimonialForm({name:item.name,occupation:item.occupation||'',trainingName:item.trainingName||'',testimonial:item.testimonial,sortOrder:item.sortOrder,isActive:item.isActive});}}><Pencil className="h-4 w-4"/></Button><Button size="sm" variant="ghost" onClick={async()=>{await apiRequest('DELETE',`/api/admin/training-testimonials/${item.id}`);await refresh();}}><Trash2 className="h-4 w-4 text-red-600"/></Button></div></CardContent></Card>)}</div></div>
    </div>}

    {tab === "galeri"&&<div><Card className="mb-6"><CardContent className="flex items-center justify-between pt-6"><div><CardTitle>Galeri Foto Pelatihan</CardTitle><p className="mt-1 text-sm text-gray-500">Unggah JPG, PNG, atau WebP maksimal 8 MB.</p></div><label className="inline-flex cursor-pointer items-center rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white"><ImagePlus className="mr-2 h-4 w-4"/>Unggah Foto<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;await uploadBinary('/api/admin/training-gallery',file);await refresh();e.target.value='';}}/></label></CardContent></Card><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{gallery.map(item=><Card key={item.id}><div className="aspect-video overflow-hidden"><img src={apiUrl(`/api/trainings/gallery/images/${item.id}`)} alt="" className="h-full w-full object-cover" style={{objectPosition:`${item.focusX}% ${item.focusY}%`}}/></div><CardContent className="space-y-3 pt-4">{editingGallery?.id===item.id?<><Input value={editingGallery.title||''} placeholder="Judul" onChange={e=>setEditingGallery({...editingGallery,title:e.target.value})}/><Textarea value={editingGallery.caption||''} placeholder="Keterangan" onChange={e=>setEditingGallery({...editingGallery,caption:e.target.value})}/><div className="grid grid-cols-3 gap-2"><Input type="number" value={editingGallery.sortOrder} onChange={e=>setEditingGallery({...editingGallery,sortOrder:Number(e.target.value)||0})}/><Input type="number" min="0" max="100" value={editingGallery.focusX} onChange={e=>setEditingGallery({...editingGallery,focusX:Number(e.target.value)||0})}/><Input type="number" min="0" max="100" value={editingGallery.focusY} onChange={e=>setEditingGallery({...editingGallery,focusY:Number(e.target.value)||0})}/></div><Button onClick={async()=>{await apiRequest('PUT',`/api/admin/training-gallery/${item.id}`,editingGallery);setEditingGallery(null);await refresh();}}>Simpan</Button></>:<><p className="font-bold">{item.title||item.fileName}</p><div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>setEditingGallery(item)}><Pencil className="h-4 w-4"/></Button><Button size="sm" variant="ghost" onClick={async()=>{await apiRequest('DELETE',`/api/admin/training-gallery/${item.id}`);await refresh();}}><Trash2 className="h-4 w-4 text-red-600"/></Button></div></>}</CardContent></Card>)}</div></div>}

    {tab === "peserta" && <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3">
          <Card><CardContent className="flex items-center gap-3 px-5 py-4"><Users className="text-green-700"/><div><p className="text-xs text-gray-500">Total</p><p className="text-xl font-bold">{registrationStats.total}</p></div></CardContent></Card>
          <Card><CardContent className="px-5 py-4"><p className="text-xs text-gray-500">Lunas</p><p className="text-xl font-bold text-green-700">{registrationStats.paid}</p></CardContent></Card>
        </div>
        <Button type="button" variant="outline" disabled={isExportingCsv} onClick={exportRegistrationsCsv} className="bg-white">
          {isExportingCsv ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}
          {isExportingCsv ? "Menyiapkan CSV..." : "Export CSV"}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left"><tr>{['Peserta','Pelatihan','Kontak','Harga','Pembayaran','Status','Detail'].map(label=><th key={label} className="whitespace-nowrap px-4 py-3">{label}</th>)}</tr></thead>
          <tbody>
            {registrations.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">Belum ada data peserta pelatihan.</td></tr>}
            {registrations.map(item => <Fragment key={item.id}>
              <tr className="border-t align-top">
                <td className="px-4 py-3 font-semibold">{item.fullName}</td>
                <td className="px-4 py-3">{item.trainingTitle}<br/><span className="text-xs text-gray-500">{item.optionName}</span></td>
                <td className="px-4 py-3">{item.whatsappNumber}<br/><span className="text-xs text-gray-500">{item.email}</span></td>
                <td className="whitespace-nowrap px-4 py-3">{money(item.price)}</td>
                <td className="px-4 py-3">{item.paymentStatus}</td>
                <td className="px-4 py-3"><select value={item.status} className="rounded border px-2 py-1" onChange={async e=>{await apiRequest('PUT',`/api/admin/training-registrations/${item.id}`,{status:e.target.value,adminNotes:item.adminNotes||''});await refresh();}}><option value="pending_payment">Menunggu bayar</option><option value="registered">Terdaftar</option><option value="attended">Hadir</option><option value="cancelled">Dibatalkan</option></select></td>
                <td className="px-4 py-3"><Button type="button" size="sm" variant="outline" onClick={() => setExpandedRegistrationId(current => current === item.id ? null : item.id)}><Eye className="mr-1.5 h-4 w-4"/>{expandedRegistrationId === item.id ? "Tutup" : "Lihat"}</Button></td>
              </tr>
              {expandedRegistrationId === item.id && <tr className="border-t bg-green-50/50">
                <td colSpan={7} className="px-4 py-5">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Nama lengkap</p><p className="mt-1 font-semibold">{item.fullName}</p></div>
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tanggal lahir</p><p className="mt-1">{displayDate(item.birthDate)}</p></div>
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Jenis kelamin</p><p className="mt-1">{item.gender || "-"}</p></div>
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">WhatsApp</p><p className="mt-1">{item.whatsappNumber || "-"}</p></div>
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email</p><p className="mt-1 break-all">{item.email || "-"}</p></div>
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pendidikan terakhir</p><p className="mt-1">{item.education || "-"}</p></div>
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pekerjaan saat ini</p><p className="mt-1">{item.occupation || "-"}</p></div>
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pelatihan</p><p className="mt-1">{item.trainingTitle}</p></div>
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pilihan agenda</p><p className="mt-1">{item.optionName}</p></div>
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Harga</p><p className="mt-1">{money(item.price)}</p></div>
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status pembayaran</p><p className="mt-1">{item.paymentStatus || "-"}</p></div>
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tanggal daftar</p><p className="mt-1">{displayDate(item.createdAt, true)}</p></div>
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Nomor pesanan</p><p className="mt-1">#{item.orderId}</p></div>
                    <div className="sm:col-span-2 lg:col-span-3"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Alamat domisili</p><p className="mt-1 whitespace-pre-line">{item.address || "-"}</p></div>
                    <div className="sm:col-span-2 lg:col-span-3"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Catatan admin</p><p className="mt-1 whitespace-pre-line">{item.adminNotes || "Belum ada catatan."}</p></div>
                  </div>
                </td>
              </tr>}
            </Fragment>)}
          </tbody>
        </table>
      </div>
    </div>}
  </div></div>;
}
