import { useEffect, useState, type MouseEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Camera, Crosshair, ImagePlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getAuthToken } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api-base";

type Course = {
  id: number;
  slug: string;
  title: string;
  price: string;
  description: string;
  details: string[];
  specialNote: string | null;
  sortOrder: number;
  isActive: boolean;
  imageId: number | null;
  imageFileName: string | null;
  imageFocusX: number | null;
  imageFocusY: number | null;
};

type CourseGalleryImage = {
  id: number;
  fileName: string;
  title: string | null;
  caption: string | null;
  sortOrder: number;
  focusX: number;
  focusY: number;
  isActive: boolean;
};

type FormState = {
  title: string;
  slug: string;
  price: string;
  description: string;
  detailsText: string;
  specialNote: string;
  sortOrder: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  title: "",
  slug: "",
  price: "",
  description: "",
  detailsText: "",
  specialNote: "",
  sortOrder: "0",
  isActive: true,
};

async function uploadCourseImage(courseId: number, file: File) {
  const response = await fetch(apiUrl(`/api/admin/courses/${courseId}/image`), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
    },
    body: file,
  });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return response.json();
}

async function uploadGalleryImage(file: File, imageId?: number) {
  const response = await fetch(apiUrl(imageId ? `/api/admin/course-gallery/${imageId}/file` : "/api/admin/course-gallery"), {
    method: imageId ? "PUT" : "POST",
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
    },
    body: file,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `${response.status}: Gagal mengunggah foto`);
  }
  return response.json();
}

export default function AdminCourses() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Course | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [focusEditor, setFocusEditor] = useState<{ course: Course; focusX: number; focusY: number } | null>(null);
  const [galleryEditor, setGalleryEditor] = useState<CourseGalleryImage | null>(null);
  const [galleryFocus, setGalleryFocus] = useState<{ focusX: number; focusY: number } | null>(null);
  const [isSavingFocus, setIsSavingFocus] = useState(false);
  const { data: courses = [], isLoading } = useQuery<Course[]>({ queryKey: ["/api/admin/courses"] });
  const { data: gallery = [], isLoading: galleryLoading } = useQuery<CourseGalleryImage[]>({ queryKey: ["/api/admin/course-gallery"] });

  useEffect(() => {
    if (!formOpen) return;
    if (!editing) {
      setForm(emptyForm);
      return;
    }
    setForm({
      title: editing.title,
      slug: editing.slug,
      price: editing.price,
      description: editing.description,
      detailsText: editing.details.join("\n"),
      specialNote: editing.specialNote || "",
      sortOrder: String(editing.sortOrder),
      isActive: editing.isActive,
    });
  }, [editing, formOpen]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
  const refreshGallery = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/course-gallery"] });
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(editing ? "PUT" : "POST", editing ? `/api/admin/courses/${editing.id}` : "/api/admin/courses", {
        title: form.title,
        slug: form.slug || undefined,
        price: form.price,
        description: form.description,
        details: form.detailsText.split("\n").map((item) => item.trim()).filter(Boolean),
        specialNote: form.specialNote,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      });
      return response.json();
    },
    onSuccess: async () => {
      await refresh();
      setFormOpen(false);
      setEditing(null);
      toast({ title: "Kursus berhasil disimpan" });
    },
    onError: (error) => toast({ title: "Gagal menyimpan kursus", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/courses/${id}`),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Kursus dinonaktifkan dari katalog" });
    },
    onError: (error) => toast({ title: "Gagal menghapus kursus", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" }),
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditing(course);
    setFormOpen(true);
  };

  const handleFocusClick = (event: MouseEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const focusX = Math.max(0, Math.min(100, Math.round(((event.clientX - bounds.left) / bounds.width) * 100)));
    const focusY = Math.max(0, Math.min(100, Math.round(((event.clientY - bounds.top) / bounds.height) * 100)));
    setFocusEditor((current) => current ? { ...current, focusX, focusY } : current);
  };

  const setFocusPreset = (focusX: number, focusY: number) => setFocusEditor((current) => current ? { ...current, focusX, focusY } : current);

  const saveImageFocus = async () => {
    if (!focusEditor) return;
    setIsSavingFocus(true);
    try {
      await apiRequest("PUT", `/api/admin/courses/${focusEditor.course.id}/image/focus`, { focusX: focusEditor.focusX, focusY: focusEditor.focusY });
      await refresh();
      setFocusEditor(null);
      toast({ title: "Titik fokus gambar berhasil disimpan" });
    } catch (error) {
      toast({ title: "Gagal menyimpan titik fokus", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" });
    } finally {
      setIsSavingFocus(false);
    }
  };

  const openGalleryEditor = (image: CourseGalleryImage) => {
    setGalleryEditor({ ...image });
    setGalleryFocus({ focusX: image.focusX, focusY: image.focusY });
  };

  const handleGalleryFocusClick = (event: MouseEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setGalleryFocus({
      focusX: Math.max(0, Math.min(100, Math.round(((event.clientX - bounds.left) / bounds.width) * 100))),
      focusY: Math.max(0, Math.min(100, Math.round(((event.clientY - bounds.top) / bounds.height) * 100))),
    });
  };

  const saveGalleryImage = async () => {
    if (!galleryEditor || !galleryFocus) return;
    setIsSavingFocus(true);
    try {
      await apiRequest("PUT", `/api/admin/course-gallery/${galleryEditor.id}`, {
        title: galleryEditor.title || "",
        caption: galleryEditor.caption || "",
        sortOrder: galleryEditor.sortOrder,
        focusX: galleryFocus.focusX,
        focusY: galleryFocus.focusY,
        isActive: galleryEditor.isActive,
      });
      await refreshGallery();
      setGalleryEditor(null);
      setGalleryFocus(null);
      toast({ title: "Foto galeri berhasil diperbarui" });
    } catch (error) {
      toast({ title: "Gagal memperbarui foto galeri", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" });
    } finally {
      setIsSavingFocus(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-green-700"><ArrowLeft size={17} /> Kembali ke Dashboard</Link>
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Pengelolaan Kursus</h1>
            <p className="mt-2 text-gray-600">Tambah, edit, urutkan, serta kelola foto kartu dan galeri kegiatan kursus.</p>
          </div>
          <Button className="bg-green-700 hover:bg-green-800" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Tambah Kursus</Button>
        </div>

        <section className="mb-10 rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-extrabold text-gray-900"><Camera className="h-5 w-5 text-green-700" />Galeri Kegiatan</h2>
              <p className="mt-1 text-sm text-gray-500">Kelola maksimal 12 foto yang ditampilkan pada halaman Kursus.</p>
            </div>
            <label className={`inline-flex cursor-pointer items-center justify-center rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 ${gallery.length >= 12 ? "pointer-events-none opacity-50" : ""}`}>
              <ImagePlus className="mr-2 h-4 w-4" />Upload Foto
              <input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" disabled={gallery.length >= 12} onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  await uploadGalleryImage(file);
                  await refreshGallery();
                  toast({ title: "Foto galeri berhasil diunggah" });
                } catch (error) {
                  toast({ title: "Gagal mengunggah foto galeri", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" });
                }
                event.target.value = "";
              }} />
            </label>
          </div>
          {galleryLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-green-700" /></div>
          ) : gallery.length === 0 ? (
            <div className="rounded-xl bg-gray-50 p-8 text-center text-sm text-gray-500">Belum ada foto galeri kegiatan.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {gallery.map((image) => (
                <article key={image.id} className={`overflow-hidden rounded-xl border bg-white ${image.isActive ? "" : "opacity-60"}`}>
                  <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                    <img src={apiUrl(`/api/course-gallery/images/${image.id}`)} alt={image.title || image.fileName} className="h-full w-full object-cover" style={{ objectPosition: `${image.focusX}% ${image.focusY}%` }} />
                    <span className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[11px] font-bold ${image.isActive ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>{image.isActive ? "Aktif" : "Nonaktif"}</span>
                  </div>
                  <div className="p-4">
                    <h3 className="truncate font-bold text-gray-900">{image.title || "Tanpa judul"}</h3>
                    <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-gray-500">{image.caption || "Belum ada keterangan"}</p>
                    <p className="mt-2 text-xs text-gray-400">Urutan {image.sortOrder}</p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" onClick={() => openGalleryEditor(image)}><Pencil className="mr-2 h-3.5 w-3.5" />Edit</Button>
                      <label className="inline-flex cursor-pointer items-center justify-center rounded-md border px-2 py-2 text-xs font-medium hover:bg-gray-50">Ganti Foto<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        try {
                          await uploadGalleryImage(file, image.id);
                          await refreshGallery();
                          toast({ title: "Foto galeri berhasil diganti" });
                        } catch (error) {
                          toast({ title: "Gagal mengganti foto", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" });
                        }
                        event.target.value = "";
                      }} /></label>
                      <Button size="sm" variant="destructive" className="col-span-2" onClick={async () => {
                        if (!confirm(`Hapus foto galeri ${image.title || image.fileName}?`)) return;
                        try {
                          await apiRequest("DELETE", `/api/admin/course-gallery/${image.id}`);
                          await refreshGallery();
                          toast({ title: "Foto galeri berhasil dihapus" });
                        } catch (error) {
                          toast({ title: "Gagal menghapus foto", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" });
                        }
                      }}><Trash2 className="mr-2 h-3.5 w-3.5" />Hapus</Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-green-700" /></div>
        ) : courses.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-gray-500">Belum ada data kursus.</CardContent></Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => (
              <Card key={course.id} className={`overflow-hidden ${course.isActive ? "" : "opacity-65"}`}>
                <div className="relative aspect-[16/9] bg-gradient-to-br from-green-100 to-emerald-200">
                  {course.imageId ? (
                    <img src={apiUrl(`/api/courses/images/${course.imageId}`)} alt={course.title} className="h-full w-full object-cover" style={{ objectPosition: `${course.imageFocusX ?? 50}% ${course.imageFocusY ?? 50}%` }} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-green-800"><BookOpen className="h-14 w-14" /></div>
                  )}
                  <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold ${course.isActive ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>{course.isActive ? "Aktif" : "Nonaktif"}</span>
                </div>
                <CardContent className="flex h-[310px] flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><h2 className="text-xl font-extrabold text-gray-900">{course.title}</h2><p className="mt-1 text-xs text-gray-500">/{course.slug} · Urutan {course.sortOrder}</p></div>
                  </div>
                  <p className="mt-3 whitespace-nowrap text-lg font-extrabold text-green-700">{course.price}</p>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-600">{course.description}</p>
                  <div className="mt-auto grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(course)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-gray-50"><ImagePlus className="mr-2 h-4 w-4" />{course.imageId ? "Ganti Foto" : "Upload Foto"}<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { await uploadCourseImage(course.id, file); await refresh(); toast({ title: "Foto kursus berhasil disimpan" }); } catch (error) { toast({ title: "Gagal mengunggah foto", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" }); } event.target.value = ""; }} /></label>
                    {course.imageId && <Button size="sm" variant="outline" onClick={() => setFocusEditor({ course, focusX: course.imageFocusX ?? 50, focusY: course.imageFocusY ?? 50 })}><Crosshair className="mr-2 h-4 w-4" />Atur Fokus</Button>}
                    {course.imageId && <Button size="sm" variant="outline" onClick={async () => { if (!confirm(`Hapus foto ${course.title}?`)) return; await apiRequest("DELETE", `/api/admin/courses/${course.id}/image`); await refresh(); }}><Trash2 className="mr-2 h-4 w-4" />Hapus Foto</Button>}
                    <Button size="sm" variant="destructive" className="col-span-2" disabled={!course.isActive || remove.isPending} onClick={() => { if (confirm(`Nonaktifkan ${course.title} dari katalog?`)) remove.mutate(course.id); }}><Trash2 className="mr-2 h-4 w-4" />Hapus Kursus</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditing(null); }}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="border-b px-6 py-5 pr-12 text-left">
            <DialogTitle>{editing ? "Edit Kursus" : "Tambah Kursus"}</DialogTitle>
            <DialogDescription>Isi detail yang akan ditampilkan pada katalog dan jendela Selengkapnya.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto px-6 py-5">
            <div><Label>Nama kursus</Label><Input value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Contoh: Kelas Bahasa Inggris" /></div>
            <div><Label>Slug (opsional)</Label><Input value={form.slug} onChange={(event) => update("slug", event.target.value)} placeholder="Dibuat otomatis dari nama" /></div>
            <div><Label>Harga</Label><Input value={form.price} onChange={(event) => update("price", event.target.value)} placeholder="Contoh: Rp 250.000/bulan" /></div>
            <div><Label>Deskripsi lengkap</Label><Textarea rows={6} value={form.description} onChange={(event) => update("description", event.target.value)} /></div>
            <div><Label>Informasi program</Label><Textarea rows={6} value={form.detailsText} onChange={(event) => update("detailsText", event.target.value)} placeholder={"Satu informasi per baris\n4 kali pertemuan\nFree trial 1 kali"} /><p className="mt-1 text-xs text-gray-500">Tuliskan satu poin pada setiap baris.</p></div>
            <div><Label>Catatan khusus (opsional)</Label><Textarea rows={3} value={form.specialNote} onChange={(event) => update("specialNote", event.target.value)} /></div>
            <div><Label>Urutan tampil</Label><Input type="number" min="0" max="9999" value={form.sortOrder} onChange={(event) => update("sortOrder", event.target.value)} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(event) => update("isActive", event.target.checked)} /> Tampilkan di katalog</label>
          </div>
          <div className="flex gap-2 border-t bg-white px-6 py-4">
            <Button variant="outline" className="flex-1" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button className="flex-1 bg-green-700 hover:bg-green-800" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={galleryEditor !== null} onOpenChange={(open) => { if (!open) { setGalleryEditor(null); setGalleryFocus(null); } }}>
        {galleryEditor && galleryFocus && (
          <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
            <DialogHeader className="border-b px-6 py-5 pr-12 text-left">
              <DialogTitle>Edit Foto Galeri</DialogTitle>
              <DialogDescription>Atur keterangan, urutan tampil, status, dan titik fokus foto.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 overflow-y-auto px-6 py-5">
              <button type="button" className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-100" onClick={handleGalleryFocusClick}>
                <img src={apiUrl(`/api/course-gallery/images/${galleryEditor.id}`)} alt="Preview foto galeri" className="h-full w-full object-cover" style={{ objectPosition: `${galleryFocus.focusX}% ${galleryFocus.focusY}%` }} />
                <span className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-green-600 shadow" style={{ left: `${galleryFocus.focusX}%`, top: `${galleryFocus.focusY}%` }} />
              </button>
              <p className="text-xs text-gray-500">Klik bagian foto yang harus tetap terlihat saat foto dipotong.</p>
              <div><Label>Judul (opsional)</Label><Input value={galleryEditor.title || ""} onChange={(event) => setGalleryEditor((current) => current ? { ...current, title: event.target.value } : current)} /></div>
              <div><Label>Keterangan (opsional)</Label><Textarea rows={3} value={galleryEditor.caption || ""} onChange={(event) => setGalleryEditor((current) => current ? { ...current, caption: event.target.value } : current)} /></div>
              <div><Label>Urutan tampil</Label><Input type="number" min="0" max="9999" value={galleryEditor.sortOrder} onChange={(event) => setGalleryEditor((current) => current ? { ...current, sortOrder: Number(event.target.value) || 0 } : current)} /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={galleryEditor.isActive} onChange={(event) => setGalleryEditor((current) => current ? { ...current, isActive: event.target.checked } : current)} /> Tampilkan di halaman Kursus</label>
            </div>
            <div className="flex gap-2 border-t bg-white px-6 py-4">
              <Button variant="outline" className="flex-1" onClick={() => { setGalleryEditor(null); setGalleryFocus(null); }}>Batal</Button>
              <Button className="flex-1 bg-green-700 hover:bg-green-800" disabled={isSavingFocus} onClick={saveGalleryImage}>{isSavingFocus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={focusEditor !== null} onOpenChange={(open) => !open && setFocusEditor(null)}>
        {focusEditor?.course.imageId && (
          <DialogContent className="w-[calc(100%-1rem)] max-w-xl sm:rounded-2xl">
            <DialogHeader><DialogTitle>Atur Fokus Foto</DialogTitle><DialogDescription>Klik bagian foto yang harus tetap terlihat pada kartu.</DialogDescription></DialogHeader>
            <button type="button" className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-gray-100" onClick={handleFocusClick}>
              <img src={apiUrl(`/api/courses/images/${focusEditor.course.imageId}`)} alt="Preview fokus foto" className="h-full w-full object-cover" style={{ objectPosition: `${focusEditor.focusX}% ${focusEditor.focusY}%` }} />
              <span className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-green-600 shadow" style={{ left: `${focusEditor.focusX}%`, top: `${focusEditor.focusY}%` }} />
            </button>
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" variant="outline" onClick={() => setFocusPreset(50, 0)}>Atas</Button>
              <Button size="sm" variant="outline" onClick={() => setFocusPreset(50, 50)}>Tengah</Button>
              <Button size="sm" variant="outline" onClick={() => setFocusPreset(50, 100)}>Bawah</Button>
              <Button size="sm" variant="outline" onClick={() => setFocusPreset(0, 50)}>Kiri</Button>
              <Button size="sm" variant="outline" onClick={() => setFocusPreset(100, 50)}>Kanan</Button>
              <Button size="sm" variant="outline" onClick={() => setFocusEditor(null)}>Batal</Button>
            </div>
            <Button className="bg-green-700 hover:bg-green-800" disabled={isSavingFocus} onClick={saveImageFocus}>{isSavingFocus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan Fokus</Button>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
