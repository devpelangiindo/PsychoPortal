import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ImagePlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiUrl } from "@/lib/api-base";
import { apiRequest, getAuthToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AdminTherapyGallery from "@/pages/admin-therapy-gallery";

type TherapyService = { id:number; categoryId:number; slug:string; title:string; price:string; description:string; fullDescription:string; focus:string; target:string; benefits:string[]; conditions:string[]; sections:Array<{title:string;description:string;conditions:string[]}>; sortOrder:number; isActive:boolean; imageId:number|null; imageFocusX:number; imageFocusY:number };
type TherapyCategory = { id:number; slug:string; kind:"development"|"psychotherapy"|"general"; title:string; description:string; introduction:string; availability:string; summaryItems:string[]; theme:"green"|"blue"|"orange"|"purple"; sortOrder:number; isActive:boolean; heroImageId:number|null; heroFocusX:number; heroFocusY:number; services:TherapyService[] };
type Editor = { type:"category"; value:Partial<TherapyCategory> } | { type:"service"; value:Partial<TherapyService> };
const lines = (value?: string[]) => (value || []).join("\n");
const toLines = (value:string) => value.split("\n").map((item) => item.trim()).filter(Boolean);

async function upload(path:string, file:File) {
  if (!["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("Gunakan JPG, PNG, atau WebP");
  if (file.size > 5 * 1024 * 1024) throw new Error("Ukuran gambar maksimal 5 MB");
  const response = await fetch(apiUrl(path), { method:"PUT", headers:{ Authorization:`Bearer ${getAuthToken()}`, "Content-Type":file.type, "X-File-Name":encodeURIComponent(file.name) }, body:file });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || "Gagal mengunggah gambar");
}

export default function AdminTherapies() {
  const [tab, setTab] = useState<"categories"|"services"|"gallery">("categories");
  const [editor, setEditor] = useState<Editor|null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const client = useQueryClient();
  const { data: categories = [], isLoading } = useQuery<TherapyCategory[]>({ queryKey:["/api/admin/therapies"] });
  const services = useMemo(() => categories.flatMap((category) => category.services), [categories]);
  const refresh = () => client.invalidateQueries({ queryKey:["/api/admin/therapies"] });
  const notifyError = (title:string, error:unknown) => toast({ title, description:error instanceof Error ? error.message : "Silakan coba lagi", variant:"destructive" });

  const save = async () => {
    if (!editor) return; setSaving(true);
    try {
      if (editor.type === "category") {
        const v = editor.value;
        const body = { title:v.title, slug:v.slug, kind:v.kind || "general", description:v.description, introduction:v.introduction || "", availability:v.availability || "", summaryItems:v.summaryItems || [], theme:v.theme || "green", sortOrder:v.sortOrder || 0, isActive:v.isActive ?? true };
        await apiRequest(v.id ? "PUT" : "POST", v.id ? `/api/admin/therapy-categories/${v.id}` : "/api/admin/therapy-categories", body);
        if (v.id) await apiRequest("PUT", `/api/admin/therapy-categories/${v.id}/image-focus`, { focusX:v.heroFocusX ?? 50, focusY:v.heroFocusY ?? 50 });
      } else {
        const v = editor.value;
        const body = { categoryId:v.categoryId, title:v.title, slug:v.slug, price:v.price || "", description:v.description, fullDescription:v.fullDescription || "", focus:v.focus || "", target:v.target || "", benefits:v.benefits || [], conditions:v.conditions || [], sections:v.sections || [], sortOrder:v.sortOrder || 0, isActive:v.isActive ?? true };
        await apiRequest(v.id ? "PUT" : "POST", v.id ? `/api/admin/therapy-services/${v.id}` : "/api/admin/therapy-services", body);
        if (v.id) await apiRequest("PUT", `/api/admin/therapy-services/${v.id}/image-focus`, { focusX:v.imageFocusX ?? 50, focusY:v.imageFocusY ?? 50 });
      }
      await refresh(); setEditor(null); toast({ title:"Data terapi berhasil disimpan" });
    } catch (error) { notifyError("Gagal menyimpan data", error); } finally { setSaving(false); }
  };

  const remove = async (type:"category"|"service", id:number, title:string) => {
    if (!confirm(`Hapus ${title}? Data akan dinonaktifkan dan tidak lagi tampil di website.`)) return;
    try { await apiRequest("DELETE", type === "category" ? `/api/admin/therapy-categories/${id}` : `/api/admin/therapy-services/${id}`); await refresh(); toast({ title:"Data terapi berhasil dihapus" }); }
    catch (error) { notifyError("Gagal menghapus data", error); }
  };

  const imageControl = (type:"category"|"service", item:TherapyCategory|TherapyService) => {
    const category = type === "category"; const id = item.id; const hasImage = category ? (item as TherapyCategory).heroImageId : (item as TherapyService).imageId;
    const path = category ? `/api/admin/therapy-categories/${id}/image` : `/api/admin/therapy-services/${id}/image`;
    return <div className="flex flex-wrap gap-2">
      <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-xs font-semibold hover:bg-gray-50"><ImagePlus className="mr-2 h-4 w-4" />{hasImage ? "Ganti gambar" : "Unggah gambar"}<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={async(e)=>{ const file=e.target.files?.[0]; if(!file)return; try{await upload(path,file);await refresh();toast({title:"Gambar berhasil disimpan"});}catch(error){notifyError("Gagal mengunggah gambar",error);} e.target.value=""; }} /></label>
      {hasImage && <Button size="sm" variant="outline" onClick={async()=>{try{await apiRequest("DELETE",path);await refresh();}catch(error){notifyError("Gagal menghapus gambar",error);}}}>Hapus gambar</Button>}
    </div>;
  };

  if (tab === "gallery") return <div><div className="sticky top-0 z-20 flex justify-center gap-2 border-b bg-white/95 p-3 backdrop-blur"><Button variant="outline" onClick={()=>setTab("categories")}>Kategori</Button><Button variant="outline" onClick={()=>setTab("services")}>Jenis Terapi</Button><Button className="bg-green-700" onClick={()=>setTab("gallery")}>Galeri</Button></div><AdminTherapyGallery /></div>;

  return <div className="min-h-screen bg-gray-50 px-4 py-8"><div className="mx-auto max-w-7xl">
    <Link href="/admin/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-green-700"><ArrowLeft size={17}/>Kembali ke Dashboard</Link>
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-3xl font-extrabold text-gray-900">Kelola Terapi</h1><p className="mt-2 text-gray-600">Kelola kategori, jenis layanan, detail, gambar, status, urutan, dan galeri terapi dalam satu tempat.</p></div>
      <Button className="bg-green-700 hover:bg-green-800" onClick={()=>setEditor(tab === "categories" ? {type:"category",value:{kind:"general",theme:"green",sortOrder:categories.length,isActive:true,summaryItems:[]}} : {type:"service",value:{categoryId:categories[0]?.id,sortOrder:services.length,isActive:true,benefits:[],conditions:[],sections:[]}})}><Plus className="mr-2 h-4 w-4"/>Tambah {tab === "categories" ? "Kategori" : "Jenis Terapi"}</Button>
    </div>
    <div className="mb-6 flex gap-2"><Button className={tab==="categories"?"bg-green-700":""} variant={tab==="categories"?"default":"outline"} onClick={()=>setTab("categories")}>Kategori ({categories.length})</Button><Button className={tab==="services"?"bg-green-700":""} variant={tab==="services"?"default":"outline"} onClick={()=>setTab("services")}>Jenis Terapi ({services.length})</Button><Button variant="outline" onClick={()=>setTab("gallery")}>Galeri Terapi</Button></div>
    {isLoading ? <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-green-700"/></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {(tab === "categories" ? categories : services).map((raw) => {
        const isCategory = tab === "categories"; const item = raw as TherapyCategory & TherapyService;
        const categoryName = !isCategory ? categories.find((c)=>c.id===item.categoryId)?.title : "";
        return <Card key={`${tab}-${item.id}`} className={!item.isActive?"opacity-60":""}><CardContent className="p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-green-700">{isCategory ? item.kind : categoryName}</p><h2 className="mt-1 text-lg font-extrabold text-gray-900">{item.title}</h2><p className="mt-1 text-xs text-gray-400">/{item.slug} · Urutan {item.sortOrder} · {item.isActive?"Aktif":"Nonaktif"}</p></div></div><p className="line-clamp-3 min-h-[4rem] text-sm leading-6 text-gray-600">{item.description}</p><div className="mt-4">{imageControl(isCategory?"category":"service", item)}</div><div className="mt-4 flex gap-2"><Button size="sm" variant="outline" className="flex-1" onClick={()=>setEditor(isCategory?{type:"category",value:{...item}}:{type:"service",value:{...item}})}><Pencil className="mr-2 h-4 w-4"/>Edit</Button><Button size="sm" variant="destructive" onClick={()=>remove(isCategory?"category":"service",item.id,item.title)}><Trash2 className="h-4 w-4"/></Button></div></CardContent></Card>;
      })}
    </div>}
  </div>

  <Dialog open={Boolean(editor)} onOpenChange={(open)=>!open&&setEditor(null)}>{editor && <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{editor.value.id?"Edit":"Tambah"} {editor.type==="category"?"Kategori Terapi":"Jenis Terapi"}</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2">
    {editor.type === "service" && <div className="sm:col-span-2"><Label>Kategori</Label><select className="mt-1 h-10 w-full rounded-md border bg-white px-3" value={editor.value.categoryId||""} onChange={(e)=>setEditor({type:"service",value:{...editor.value,categoryId:Number(e.target.value)}})}>{categories.map((c)=><option key={c.id} value={c.id}>{c.title}</option>)}</select></div>}
    <div><Label>Nama</Label><Input value={editor.value.title||""} onChange={(e)=>setEditor({...editor,value:{...editor.value,title:e.target.value}} as Editor)}/></div>
    {!editor.value.id && <div><Label>Slug (opsional)</Label><Input value={editor.value.slug||""} onChange={(e)=>setEditor({...editor,value:{...editor.value,slug:e.target.value}} as Editor)}/></div>}
    {editor.type === "category" ? <><div><Label>Jenis tampilan</Label><select className="mt-1 h-10 w-full rounded-md border bg-white px-3" value={editor.value.kind||"general"} onChange={(e)=>setEditor({type:"category",value:{...editor.value,kind:e.target.value as TherapyCategory["kind"]}})}><option value="development">Tumbuh Kembang</option><option value="psychotherapy">Psikoterapi</option><option value="general">Umum</option></select></div><div><Label>Tema warna</Label><select className="mt-1 h-10 w-full rounded-md border bg-white px-3" value={editor.value.theme||"green"} onChange={(e)=>setEditor({type:"category",value:{...editor.value,theme:e.target.value as TherapyCategory["theme"]}})}>{["green","blue","orange","purple"].map(x=><option key={x}>{x}</option>)}</select></div><div className="sm:col-span-2"><Label>Pengantar</Label><Textarea rows={4} value={editor.value.introduction||""} onChange={(e)=>setEditor({type:"category",value:{...editor.value,introduction:e.target.value}})}/></div><div><Label>Keterangan layanan</Label><Input value={editor.value.availability||""} onChange={(e)=>setEditor({type:"category",value:{...editor.value,availability:e.target.value}})}/></div><div className="sm:col-span-2"><Label>Ringkasan layanan (satu per baris)</Label><Textarea rows={5} value={lines(editor.value.summaryItems)} onChange={(e)=>setEditor({type:"category",value:{...editor.value,summaryItems:toLines(e.target.value)}})}/></div></> : <><div><Label>Harga</Label><Input value={editor.value.price||""} onChange={(e)=>setEditor({type:"service",value:{...editor.value,price:e.target.value}})}/></div><div className="sm:col-span-2"><Label>Deskripsi lengkap</Label><Textarea rows={5} value={editor.value.fullDescription||""} onChange={(e)=>setEditor({type:"service",value:{...editor.value,fullDescription:e.target.value}})}/></div><div className="sm:col-span-2"><Label>Fokus utama</Label><Textarea value={editor.value.focus||""} onChange={(e)=>setEditor({type:"service",value:{...editor.value,focus:e.target.value}})}/></div><div className="sm:col-span-2"><Label>Target</Label><Textarea value={editor.value.target||""} onChange={(e)=>setEditor({type:"service",value:{...editor.value,target:e.target.value}})}/></div><div><Label>Manfaat (satu per baris)</Label><Textarea rows={6} value={lines(editor.value.benefits)} onChange={(e)=>setEditor({type:"service",value:{...editor.value,benefits:toLines(e.target.value)}})}/></div><div><Label>Kondisi (satu per baris)</Label><Textarea rows={6} value={lines(editor.value.conditions)} onChange={(e)=>setEditor({type:"service",value:{...editor.value,conditions:toLines(e.target.value)}})}/></div></>}
    <div className="sm:col-span-2"><Label>Deskripsi singkat</Label><Textarea rows={4} value={editor.value.description||""} onChange={(e)=>setEditor({...editor,value:{...editor.value,description:e.target.value}} as Editor)}/></div><div><Label>Urutan</Label><Input type="number" min="0" value={editor.value.sortOrder||0} onChange={(e)=>setEditor({...editor,value:{...editor.value,sortOrder:Number(e.target.value)}} as Editor)}/></div><label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={editor.value.isActive??true} onChange={(e)=>setEditor({...editor,value:{...editor.value,isActive:e.target.checked}} as Editor)}/>Tampilkan di website</label>
    {editor.value.id && <><div><Label>Fokus gambar horizontal (0–100)</Label><Input type="number" min="0" max="100" value={editor.type==="category"?(editor.value.heroFocusX??50):(editor.value.imageFocusX??50)} onChange={(e)=>editor.type==="category"?setEditor({type:"category",value:{...editor.value,heroFocusX:Number(e.target.value)}}):setEditor({type:"service",value:{...editor.value,imageFocusX:Number(e.target.value)}})}/></div><div><Label>Fokus gambar vertikal (0–100)</Label><Input type="number" min="0" max="100" value={editor.type==="category"?(editor.value.heroFocusY??50):(editor.value.imageFocusY??50)} onChange={(e)=>editor.type==="category"?setEditor({type:"category",value:{...editor.value,heroFocusY:Number(e.target.value)}}):setEditor({type:"service",value:{...editor.value,imageFocusY:Number(e.target.value)}})}/></div></>}
  </div><div className="mt-5 flex gap-2"><Button variant="outline" className="flex-1" onClick={()=>setEditor(null)}>Batal</Button><Button className="flex-1 bg-green-700" disabled={saving} onClick={save}>{saving&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Simpan</Button></div></DialogContent>}</Dialog>
  </div>;
}
