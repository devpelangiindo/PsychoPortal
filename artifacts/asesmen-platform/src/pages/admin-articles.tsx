import { useEffect, useState, type MouseEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Crosshair, ImagePlus, Loader2, Megaphone, Newspaper, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getAuthToken } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api-base";

type ArticleImage = {
  id: number;
  fileName: string;
  altText: string | null;
  caption: string | null;
  placement: "cover" | "after-first" | "middle" | "end";
  sortOrder: number;
  focusX: number;
  focusY: number;
};

type Article = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  authorName: string | null;
  status: "draft" | "published";
  publishedAt: string | null;
  updatedAt: string;
  images: ArticleImage[];
};

type ArticleCategory = {
  id: number;
  slug: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

type CategoryFormState = Omit<ArticleCategory, "id">;

type ArticlePromo = {
  id: number;
  title: string;
  description: string;
  buttonText: string;
  linkUrl: string;
  sortOrder: number;
  isActive: boolean;
};

type PromoFormState = Omit<ArticlePromo, "id">;

type FormState = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  authorName: string;
  status: "draft" | "published";
  publishedAt: string;
};

const emptyForm: FormState = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  category: "berita",
  authorName: "",
  status: "draft",
  publishedAt: "",
};

const emptyPromoForm: PromoFormState = {
  title: "",
  description: "",
  buttonText: "Info lebih lanjut",
  linkUrl: "https://wa.me/6285117658242",
  sortOrder: 0,
  isActive: true,
};

const emptyCategoryForm: CategoryFormState = {
  slug: "",
  name: "",
  sortOrder: 0,
  isActive: true,
};

const placementLabels: Record<ArticleImage["placement"], string> = {
  cover: "Gambar utama",
  "after-first": "Setelah bagian pertama",
  middle: "Tengah artikel",
  end: "Akhir artikel",
};

function toLocalDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

async function uploadArticleImage(articleId: number, file: File) {
  const response = await fetch(apiUrl(`/api/admin/articles/${articleId}/images`), {
    method: "POST",
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

export default function AdminArticles() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Article | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingPromo, setEditingPromo] = useState<ArticlePromo | null>(null);
  const [promoFormOpen, setPromoFormOpen] = useState(false);
  const [promoForm, setPromoForm] = useState<PromoFormState>(emptyPromoForm);
  const [editingCategory, setEditingCategory] = useState<ArticleCategory | null>(null);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm);
  const [imageEditor, setImageEditor] = useState<{
    article: Article;
    image: ArticleImage;
    altText: string;
    caption: string;
    placement: ArticleImage["placement"];
    sortOrder: number;
    focusX: number;
    focusY: number;
  } | null>(null);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const { data: articles = [], isLoading } = useQuery<Article[]>({ queryKey: ["/api/admin/articles"] });
  const { data: promos = [], isLoading: promosLoading } = useQuery<ArticlePromo[]>({ queryKey: ["/api/admin/article-promos"] });
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<ArticleCategory[]>({ queryKey: ["/api/admin/article-categories"] });

  useEffect(() => {
    if (!formOpen) return;
    if (!editing) {
      setForm({ ...emptyForm, category: categories.find((category) => category.isActive)?.slug ?? "berita" });
      return;
    }
    setForm({
      title: editing.title,
      slug: editing.slug,
      excerpt: editing.excerpt,
      content: editing.content,
      category: editing.category,
      authorName: editing.authorName || "",
      status: editing.status,
      publishedAt: toLocalDateTime(editing.publishedAt),
    });
  }, [editing, formOpen]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/articles"] });
  const refreshPromos = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/article-promos"] });
  const refreshCategories = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/article-categories"] });
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(editing ? "PUT" : "POST", editing ? `/api/admin/articles/${editing.id}` : "/api/admin/articles", {
        ...form,
        slug: form.slug || undefined,
        publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
      });
      return response.json();
    },
    onSuccess: async () => {
      await refresh();
      setFormOpen(false);
      setEditing(null);
      toast({ title: "Artikel berhasil disimpan" });
    },
    onError: (error) => toast({ title: "Gagal menyimpan artikel", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/articles/${id}`),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Artikel berhasil dihapus" });
    },
    onError: (error) => toast({ title: "Gagal menghapus artikel", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" }),
  });

  const savePromo = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(editingPromo ? "PUT" : "POST", editingPromo ? `/api/admin/article-promos/${editingPromo.id}` : "/api/admin/article-promos", promoForm);
      return response.json();
    },
    onSuccess: async () => {
      await refreshPromos();
      setPromoFormOpen(false);
      setEditingPromo(null);
      setPromoForm(emptyPromoForm);
      toast({ title: "Promo & Info berhasil disimpan" });
    },
    onError: (error) => toast({ title: "Gagal menyimpan Promo & Info", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" }),
  });

  const removePromo = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/article-promos/${id}`),
    onSuccess: async () => {
      await refreshPromos();
      toast({ title: "Promo & Info berhasil dihapus" });
    },
    onError: (error) => toast({ title: "Gagal menghapus Promo & Info", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" }),
  });

  const saveCategory = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(editingCategory ? "PUT" : "POST", editingCategory ? `/api/admin/article-categories/${editingCategory.id}` : "/api/admin/article-categories", {
        name: categoryForm.name,
        slug: editingCategory ? undefined : categoryForm.slug || undefined,
        sortOrder: categoryForm.sortOrder,
        isActive: categoryForm.isActive,
      });
      return response.json();
    },
    onSuccess: async () => {
      await refreshCategories();
      setCategoryFormOpen(false);
      setEditingCategory(null);
      setCategoryForm(emptyCategoryForm);
      toast({ title: "Kategori artikel berhasil disimpan" });
    },
    onError: (error) => toast({ title: "Gagal menyimpan kategori", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" }),
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (article: Article) => {
    setEditing(article);
    setFormOpen(true);
  };

  const openCreatePromo = () => {
    setEditingPromo(null);
    setPromoForm(emptyPromoForm);
    setPromoFormOpen(true);
  };

  const openEditPromo = (promo: ArticlePromo) => {
    setEditingPromo(promo);
    setPromoForm({
      title: promo.title,
      description: promo.description,
      buttonText: promo.buttonText,
      linkUrl: promo.linkUrl,
      sortOrder: promo.sortOrder,
      isActive: promo.isActive,
    });
    setPromoFormOpen(true);
  };

  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm(emptyCategoryForm);
    setCategoryFormOpen(true);
  };

  const openEditCategory = (category: ArticleCategory) => {
    setEditingCategory(category);
    setCategoryForm({ slug: category.slug, name: category.name, sortOrder: category.sortOrder, isActive: category.isActive });
    setCategoryFormOpen(true);
  };

  const openImageEditor = (article: Article, image: ArticleImage) => setImageEditor({
    article,
    image,
    altText: image.altText || "",
    caption: image.caption || "",
    placement: image.placement,
    sortOrder: image.sortOrder,
    focusX: image.focusX,
    focusY: image.focusY,
  });

  const handleFocusClick = (event: MouseEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const focusX = Math.max(0, Math.min(100, Math.round(((event.clientX - bounds.left) / bounds.width) * 100)));
    const focusY = Math.max(0, Math.min(100, Math.round(((event.clientY - bounds.top) / bounds.height) * 100)));
    setImageEditor((current) => current ? { ...current, focusX, focusY } : current);
  };

  const saveImage = async () => {
    if (!imageEditor) return;
    setIsSavingImage(true);
    try {
      await apiRequest("PUT", `/api/admin/articles/${imageEditor.article.id}/images/${imageEditor.image.id}`, {
        altText: imageEditor.altText,
        caption: imageEditor.caption,
        placement: imageEditor.placement,
        sortOrder: imageEditor.sortOrder,
        focusX: imageEditor.focusX,
        focusY: imageEditor.focusY,
      });
      await refresh();
      setImageEditor(null);
      toast({ title: "Pengaturan gambar berhasil disimpan" });
    } catch (error) {
      toast({ title: "Gagal menyimpan gambar", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" });
    } finally {
      setIsSavingImage(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-green-700"><ArrowLeft size={17} /> Kembali ke Dashboard</Link>
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><h1 className="text-3xl font-extrabold text-gray-900">Pengelolaan Artikel</h1><p className="mt-2 text-gray-600">Kelola artikel, gambar, serta Promo & Info pada halaman Berita.</p></div>
          <Button className="bg-green-700 hover:bg-green-800" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Tambah Artikel</Button>
        </div>

        <section className="mb-10 rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-extrabold text-gray-900"><Megaphone className="h-5 w-5 text-green-700" />Promo & Info</h2>
              <p className="mt-1 text-sm text-gray-500">Atur informasi yang tampil di sisi kanan halaman daftar dan detail Berita.</p>
            </div>
            <Button variant="outline" onClick={openCreatePromo}><Plus className="mr-2 h-4 w-4" />Tambah Promo</Button>
          </div>
          {promosLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-green-700" /></div>
          ) : promos.length === 0 ? (
            <div className="rounded-xl bg-gray-50 p-8 text-center text-sm text-gray-500">Belum ada Promo & Info.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {promos.map((promo) => (
                <Card key={promo.id} className={promo.isActive ? "" : "opacity-60"}>
                  <CardContent className="flex h-full flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-gray-900">{promo.title}</h3>
                        <p className="mt-1 text-xs text-gray-500">Urutan {promo.sortOrder}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${promo.isActive ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>{promo.isActive ? "Aktif" : "Nonaktif"}</span>
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-600">{promo.description}</p>
                    <p className="mt-3 truncate text-xs text-green-700">{promo.buttonText} → {promo.linkUrl}</p>
                    <div className="mt-auto flex gap-2 pt-5">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => openEditPromo(promo)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>
                      <Button size="sm" variant="destructive" className="flex-1" disabled={removePromo.isPending} onClick={() => { if (confirm(`Hapus Promo & Info ${promo.title}?`)) removePromo.mutate(promo.id); }}><Trash2 className="mr-2 h-4 w-4" />Hapus</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="mb-10 rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-extrabold text-gray-900"><Tags className="h-5 w-5 text-green-700" />Kategori Artikel</h2>
              <p className="mt-1 text-sm text-gray-500">Kategori aktif dapat dipilih pada form Tambah dan Edit Artikel.</p>
            </div>
            <Button variant="outline" onClick={openCreateCategory}><Plus className="mr-2 h-4 w-4" />Tambah Kategori</Button>
          </div>
          {categoriesLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-green-700" /></div>
          ) : categories.length === 0 ? (
            <div className="rounded-xl bg-gray-50 p-8 text-center text-sm text-gray-500">Belum ada kategori artikel.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
                <div key={category.id} className={`flex items-center justify-between gap-3 rounded-xl border p-4 ${category.isActive ? "bg-white" : "bg-gray-50 opacity-65"}`}>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900">{category.name}</p>
                    <p className="mt-1 truncate text-xs text-gray-500">{category.slug} · Urutan {category.sortOrder}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${category.isActive ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>{category.isActive ? "Aktif" : "Nonaktif"}</span>
                    <Button size="icon" variant="outline" aria-label={`Edit kategori ${category.name}`} onClick={() => openEditCategory(category)}><Pencil className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-green-700" /></div>
        ) : articles.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-gray-500">Belum ada artikel yang dibuat melalui dashboard ini.</CardContent></Card>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {articles.map((article) => {
              const cover = article.images.find((image) => image.placement === "cover") ?? article.images[0];
              return (
                <Card key={article.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="grid sm:grid-cols-[220px_1fr]">
                      <div className="relative min-h-48 bg-gradient-to-br from-green-100 to-emerald-200">
                        {cover ? <img src={apiUrl(`/api/articles/images/${cover.id}`)} alt={cover.altText || article.title} className="h-full w-full object-cover" style={{ objectPosition: `${cover.focusX}% ${cover.focusY}%` }} /> : <div className="flex h-full min-h-48 items-center justify-center text-green-800"><Newspaper className="h-14 w-14" /></div>}
                        <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold ${article.status === "published" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{article.status === "published" ? "Terbit" : "Draft"}</span>
                      </div>
                      <div className="flex min-w-0 flex-col p-5">
                        <p className="text-xs font-bold uppercase tracking-wide text-green-700">{categories.find((category) => category.slug === article.category)?.name ?? article.category}</p>
                        <h2 className="mt-1 line-clamp-2 text-xl font-extrabold text-gray-900">{article.title}</h2>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-600">{article.excerpt}</p>
                        <p className="mt-2 text-xs text-gray-500">/{article.slug} · {article.images.length}/3 gambar</p>
                        <div className="mt-auto flex flex-wrap gap-2 pt-4">
                          <Button size="sm" variant="outline" onClick={() => openEdit(article)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>
                          <label className={`inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium ${article.images.length >= 3 ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-gray-50"}`}><ImagePlus className="mr-2 h-4 w-4" />Tambah Gambar<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" disabled={article.images.length >= 3} onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { await uploadArticleImage(article.id, file); await refresh(); toast({ title: "Gambar berhasil diunggah" }); } catch (error) { toast({ title: "Gagal mengunggah gambar", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" }); } event.target.value = ""; }} /></label>
                          <Button size="sm" variant="destructive" onClick={() => { if (confirm(`Hapus artikel ${article.title}?`)) remove.mutate(article.id); }}><Trash2 className="mr-2 h-4 w-4" />Hapus</Button>
                        </div>
                      </div>
                    </div>
                    {article.images.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 border-t bg-gray-50 p-3">
                        {article.images.map((image) => (
                          <div key={image.id} className="group relative aspect-video overflow-hidden rounded-lg bg-gray-100">
                            <img src={apiUrl(`/api/articles/images/${image.id}`)} alt={image.altText || "Gambar artikel"} className="h-full w-full object-cover" style={{ objectPosition: `${image.focusX}% ${image.focusY}%` }} />
                            <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">{placementLabels[image.placement]}</span>
                            <button type="button" aria-label="Edit gambar" className="absolute right-8 top-1 rounded bg-white/90 p-1 text-gray-800" onClick={() => openImageEditor(article, image)}><Crosshair size={13} /></button>
                            <button type="button" aria-label="Hapus gambar" className="absolute right-1 top-1 rounded bg-red-600 p-1 text-white" onClick={async () => { if (!confirm("Hapus gambar ini?")) return; await apiRequest("DELETE", `/api/admin/articles/${article.id}/images/${image.id}`); await refresh(); }}><Trash2 size={13} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={categoryFormOpen} onOpenChange={(open) => { setCategoryFormOpen(open); if (!open) { setEditingCategory(null); setCategoryForm(emptyCategoryForm); } }}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="border-b px-6 py-5 pr-12 text-left">
            <DialogTitle>{editingCategory ? "Edit Kategori Artikel" : "Tambah Kategori Artikel"}</DialogTitle>
            <DialogDescription>{editingCategory ? "Nama, urutan, dan status dapat diperbarui. Slug tetap agar artikel lama tidak rusak." : "Kategori aktif akan tersedia pada form Artikel."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto px-6 py-5">
            <div><Label>Nama kategori</Label><Input maxLength={255} value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} placeholder="Contoh: Perkembangan Anak" /></div>
            <div><Label>Slug {editingCategory ? "" : "(opsional)"}</Label><Input maxLength={100} value={categoryForm.slug} disabled={Boolean(editingCategory)} onChange={(event) => setCategoryForm((current) => ({ ...current, slug: event.target.value }))} placeholder="Dibuat otomatis dari nama" />{editingCategory && <p className="mt-1 text-xs text-gray-500">Slug tidak dapat diubah setelah kategori dibuat.</p>}</div>
            <div><Label>Urutan tampil</Label><Input type="number" min="0" max="9999" value={categoryForm.sortOrder} onChange={(event) => setCategoryForm((current) => ({ ...current, sortOrder: Number(event.target.value) || 0 }))} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={categoryForm.isActive} onChange={(event) => setCategoryForm((current) => ({ ...current, isActive: event.target.checked }))} /> Aktifkan kategori</label>
          </div>
          <div className="flex gap-2 border-t bg-white px-6 py-4">
            <Button variant="outline" className="flex-1" onClick={() => setCategoryFormOpen(false)}>Batal</Button>
            <Button className="flex-1 bg-green-700 hover:bg-green-800" disabled={saveCategory.isPending} onClick={() => saveCategory.mutate()}>{saveCategory.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={promoFormOpen} onOpenChange={(open) => { setPromoFormOpen(open); if (!open) { setEditingPromo(null); setPromoForm(emptyPromoForm); } }}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="border-b px-6 py-5 pr-12 text-left">
            <DialogTitle>{editingPromo ? "Edit Promo & Info" : "Tambah Promo & Info"}</DialogTitle>
            <DialogDescription>Informasi aktif akan tampil pada halaman daftar dan detail Berita.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto px-6 py-5">
            <div><Label>Judul</Label><Input maxLength={255} value={promoForm.title} onChange={(event) => setPromoForm((current) => ({ ...current, title: event.target.value }))} /></div>
            <div><Label>Deskripsi singkat</Label><Textarea rows={4} maxLength={1000} value={promoForm.description} onChange={(event) => setPromoForm((current) => ({ ...current, description: event.target.value }))} /></div>
            <div><Label>Teks tombol</Label><Input maxLength={100} value={promoForm.buttonText} onChange={(event) => setPromoForm((current) => ({ ...current, buttonText: event.target.value }))} placeholder="Info lebih lanjut" /></div>
            <div><Label>Tautan tujuan</Label><Input maxLength={2000} value={promoForm.linkUrl} onChange={(event) => setPromoForm((current) => ({ ...current, linkUrl: event.target.value }))} placeholder="https://wa.me/... atau /kontak" /><p className="mt-1 text-xs text-gray-500">Gunakan alamat http/https atau halaman internal yang diawali dengan /.</p></div>
            <div><Label>Urutan tampil</Label><Input type="number" min="0" max="9999" value={promoForm.sortOrder} onChange={(event) => setPromoForm((current) => ({ ...current, sortOrder: Number(event.target.value) || 0 }))} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={promoForm.isActive} onChange={(event) => setPromoForm((current) => ({ ...current, isActive: event.target.checked }))} /> Tampilkan pada halaman Berita</label>
          </div>
          <div className="flex gap-2 border-t bg-white px-6 py-4">
            <Button variant="outline" className="flex-1" onClick={() => setPromoFormOpen(false)}>Batal</Button>
            <Button className="flex-1 bg-green-700 hover:bg-green-800" disabled={savePromo.isPending} onClick={() => savePromo.mutate()}>{savePromo.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditing(null); }}>
        <DialogContent className="flex max-h-[94vh] w-[calc(100%-1rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="border-b px-6 py-5 pr-12 text-left"><DialogTitle>{editing ? "Edit Artikel" : "Tambah Artikel"}</DialogTitle><DialogDescription>Isi artikel, simpan sebagai draft, atau langsung terbitkan.</DialogDescription></DialogHeader>
          <div className="space-y-4 overflow-y-auto px-6 py-5">
            <div><Label>Judul artikel</Label><Input value={form.title} onChange={(event) => update("title", event.target.value)} /></div>
            <div><Label>Slug (opsional)</Label><Input value={form.slug} onChange={(event) => update("slug", event.target.value)} placeholder="Dibuat otomatis dari judul" /></div>
            <div><Label>Ringkasan untuk kartu Berita</Label><Textarea rows={3} maxLength={1000} value={form.excerpt} onChange={(event) => update("excerpt", event.target.value)} /></div>
            <div><Label>Isi artikel</Label><Textarea rows={16} value={form.content} onChange={(event) => update("content", event.target.value)} placeholder={"Gunakan baris kosong untuk memisahkan paragraf.\n\n## Subjudul\n**teks tebal**\n- daftar poin\n[teks tautan](https://alamat.com)"} /><p className="mt-1 text-xs leading-5 text-gray-500">Mendukung subjudul dengan ##, teks tebal dengan **teks**, daftar dengan -, dan tautan Markdown.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Kategori</Label><Select value={form.category} onValueChange={(value) => update("category", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.filter((category) => category.isActive || (Boolean(editing) && category.slug === form.category)).map((category) => <SelectItem key={category.slug} value={category.slug}>{category.name}{category.isActive ? "" : " (Nonaktif)"}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Nama penulis (opsional)</Label><Input value={form.authorName} onChange={(event) => update("authorName", event.target.value)} /></div>
              <div><Label>Status</Label><Select value={form.status} onValueChange={(value: "draft" | "published") => update("status", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Terbit</SelectItem></SelectContent></Select></div>
              <div><Label>Tanggal publikasi (opsional)</Label><Input type="datetime-local" value={form.publishedAt} onChange={(event) => update("publishedAt", event.target.value)} /></div>
            </div>
          </div>
          <div className="flex gap-2 border-t bg-white px-6 py-4"><Button variant="outline" className="flex-1" onClick={() => setFormOpen(false)}>Batal</Button><Button className="flex-1 bg-green-700 hover:bg-green-800" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={imageEditor !== null} onOpenChange={(open) => !open && setImageEditor(null)}>
        {imageEditor && (
          <DialogContent className="flex max-h-[94vh] w-[calc(100%-1rem)] max-w-xl flex-col overflow-y-auto sm:rounded-2xl">
            <DialogHeader><DialogTitle>Atur Gambar Artikel</DialogTitle><DialogDescription>Tentukan posisi gambar, keterangannya, dan titik fokus untuk kartu.</DialogDescription></DialogHeader>
            <button type="button" className="relative aspect-video w-full overflow-hidden rounded-xl bg-gray-100" onClick={handleFocusClick}>
              <img src={apiUrl(`/api/articles/images/${imageEditor.image.id}`)} alt="Preview gambar" className="h-full w-full object-cover" style={{ objectPosition: `${imageEditor.focusX}% ${imageEditor.focusY}%` }} />
              <span className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-green-600 shadow" style={{ left: `${imageEditor.focusX}%`, top: `${imageEditor.focusY}%` }} />
            </button>
            <div className="grid grid-cols-3 gap-2"><Button size="sm" variant="outline" onClick={() => setImageEditor((current) => current ? { ...current, focusX: 50, focusY: 0 } : current)}>Atas</Button><Button size="sm" variant="outline" onClick={() => setImageEditor((current) => current ? { ...current, focusX: 50, focusY: 50 } : current)}>Tengah</Button><Button size="sm" variant="outline" onClick={() => setImageEditor((current) => current ? { ...current, focusX: 50, focusY: 100 } : current)}>Bawah</Button></div>
            <div><Label>Posisi gambar</Label><Select value={imageEditor.placement} onValueChange={(value: ArticleImage["placement"]) => setImageEditor((current) => current ? { ...current, placement: value } : current)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(placementLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Teks alternatif</Label><Input value={imageEditor.altText} onChange={(event) => setImageEditor((current) => current ? { ...current, altText: event.target.value } : current)} placeholder="Jelaskan isi gambar" /></div>
            <div><Label>Keterangan gambar (opsional)</Label><Textarea rows={2} value={imageEditor.caption} onChange={(event) => setImageEditor((current) => current ? { ...current, caption: event.target.value } : current)} /></div>
            <div><Label>Urutan gambar (0–2)</Label><Input type="number" min="0" max="2" value={imageEditor.sortOrder} onChange={(event) => setImageEditor((current) => current ? { ...current, sortOrder: Number(event.target.value) || 0 } : current)} /></div>
            <Button className="bg-green-700 hover:bg-green-800" disabled={isSavingImage} onClick={saveImage}>{isSavingImage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan Gambar</Button>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
