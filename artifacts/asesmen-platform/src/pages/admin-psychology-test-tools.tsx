import { useState, type MouseEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ClipboardList,
  Crosshair,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiUrl } from "@/lib/api-base";
import { apiRequest, getAuthToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Category =
  | "kognitif"
  | "perkembangan"
  | "klinis"
  | "inventori-kepribadian";
type Tool = {
  id: number;
  slug: string;
  category: Category;
  title: string;
  description: string;
  detailText: string;
  resultText: string;
  targetText: string;
  price: number;
  sortOrder: number;
  isActive: boolean;
  hasImage: boolean;
  imageFocusX: number;
  imageFocusY: number;
};
type Form = {
  id?: number;
  slug: string;
  category: Category;
  title: string;
  description: string;
  detailText: string;
  resultText: string;
  targetText: string;
  price: number;
  sortOrder: number;
  isActive: boolean;
};
const categories: Array<{ value: Category; label: string }> = [
  { value: "kognitif", label: "Kognitif" },
  { value: "perkembangan", label: "Perkembangan" },
  { value: "klinis", label: "Klinis" },
  { value: "inventori-kepribadian", label: "Inventori Kepribadian" },
];
const emptyForm = (order: number): Form => ({
  slug: "",
  category: "kognitif",
  title: "",
  description: "",
  detailText: "",
  resultText: "",
  targetText: "",
  price: 0,
  sortOrder: order,
  isActive: true,
});
const labelFor = (category: Category) =>
  categories.find((item) => item.value === category)?.label ?? category;

export default function AdminPsychologyTestTools() {
  const { toast } = useToast();
  const client = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [focus, setFocus] = useState<Tool | null>(null);
  const { data: tools = [], isLoading } = useQuery<Tool[]>({
    queryKey: ["/api/admin/psychology-test-tools"],
  });
  const refresh = () =>
    client.invalidateQueries({
      queryKey: ["/api/admin/psychology-test-tools"],
    });
  const errorToast = (title: string, error: unknown) =>
    toast({
      title,
      description: error instanceof Error ? error.message : "Silakan coba lagi",
      variant: "destructive",
    });
  const save = async () => {
    if (!form) return;
    if (
      !form.title.trim() ||
      !form.description.trim() ||
      !form.detailText.trim()
    ) {
      errorToast(
        "Data belum lengkap",
        new Error("Nama, deskripsi singkat, dan deskripsi tes wajib diisi"),
      );
      return;
    }
    setSaving(true);
    try {
      await apiRequest(
        form.id ? "PUT" : "POST",
        form.id
          ? `/api/admin/psychology-test-tools/${form.id}`
          : "/api/admin/psychology-test-tools",
        form,
      );
      await refresh();
      setForm(null);
      toast({ title: "Alat tes berhasil disimpan" });
    } catch (error) {
      errorToast("Gagal menyimpan alat tes", error);
    } finally {
      setSaving(false);
    }
  };
  const upload = async (tool: Tool, file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      errorToast(
        "Format gambar tidak didukung",
        new Error("Gunakan JPG, PNG, atau WebP"),
      );
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      errorToast("Gambar terlalu besar", new Error("Ukuran maksimal 5 MB"));
      return;
    }
    try {
      const response = await fetch(
        apiUrl(`/api/admin/psychology-test-tools/${tool.id}/image`),
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${getAuthToken()}`,
            "Content-Type": file.type,
            "X-File-Name": encodeURIComponent(file.name),
          },
          body: file,
        },
      );
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => null))?.message || "Upload gagal",
        );
      await refresh();
      toast({ title: "Gambar berhasil disimpan" });
    } catch (error) {
      errorToast("Gagal mengunggah gambar", error);
    }
  };
  const remove = async (tool: Tool) => {
    if (
      !confirm(`Hapus ${tool.title}? Item tidak akan tampil lagi di katalog.`)
    )
      return;
    try {
      await apiRequest("DELETE", `/api/admin/psychology-test-tools/${tool.id}`);
      await refresh();
      toast({ title: "Alat tes berhasil dihapus" });
    } catch (error) {
      errorToast("Gagal menghapus alat tes", error);
    }
  };
  const clickFocus = (event: MouseEvent<HTMLButtonElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setFocus((current) =>
      current
        ? {
            ...current,
            imageFocusX: Math.round(
              ((event.clientX - box.left) / box.width) * 100,
            ),
            imageFocusY: Math.round(
              ((event.clientY - box.top) / box.height) * 100,
            ),
          }
        : current,
    );
  };
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/admin/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-green-700"
        >
          <ArrowLeft size={17} />
          Kembali ke Dashboard
        </Link>
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-extrabold text-gray-900">
              <ClipboardList className="text-amber-700" />
              Kelola Alat Tes Psikologi
            </h1>
            <p className="mt-2 text-gray-600">
              Tambah, edit, hapus, urutkan, dan kelola gambar katalog Alat Tes
              Psikologi.
            </p>
          </div>
          <Button
            className="bg-amber-700 hover:bg-amber-800"
            onClick={() => setForm(emptyForm(tools.length + 1))}
          >
            <Plus className="mr-2 h-4 w-4" />
            Tambah Alat Tes
          </Button>
        </div>
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          Slug dibuat saat item ditambahkan dan dipertahankan ketika judul
          diedit. Penghapusan menggunakan soft delete agar data lebih aman.
        </div>
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-amber-700" />
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tools.map((tool) => (
              <Card
                key={tool.id}
                className={`overflow-hidden ${tool.isActive ? "" : "opacity-60"}`}
              >
                <div className="aspect-[4/3] bg-amber-50">
                  {tool.hasImage ? (
                    <img
                      src={apiUrl(
                        `/api/psychology-test-tools/${tool.id}/image`,
                      )}
                      alt={tool.title}
                      className="h-full w-full object-cover"
                      style={{
                        objectPosition: `${tool.imageFocusX}% ${tool.imageFocusY}%`,
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ClipboardList className="h-12 w-12 text-amber-700" />
                    </div>
                  )}
                </div>
                <CardContent className="p-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                    {labelFor(tool.category)} · Urutan {tool.sortOrder}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {tool.isActive ? "Aktif" : "Nonaktif"}
                  </p>
                  <h2 className="mt-2 text-lg font-extrabold text-gray-900">
                    {tool.title}
                  </h2>
                  <p className="mt-2 line-clamp-3 min-h-[3.75rem] text-sm leading-5 text-gray-600">
                    {tool.description}
                  </p>
                  <p className="mt-3 font-extrabold text-green-700">
                    Rp {Number(tool.price).toLocaleString("id-ID")}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setForm({ ...tool })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-1.5 text-xs font-semibold">
                      <ImagePlus className="mr-1 h-4 w-4" />
                      {tool.hasImage ? "Ganti" : "Foto"}
                      <input
                        className="hidden"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          upload(tool, e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {tool.hasImage && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          title="Atur fokus gambar"
                          onClick={() => setFocus({ ...tool })}
                        >
                          <Crosshair className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              await apiRequest(
                                "DELETE",
                                `/api/admin/psychology-test-tools/${tool.id}/image`,
                              );
                              await refresh();
                              toast({ title: "Gambar berhasil dihapus" });
                            } catch (error) {
                              errorToast("Gagal menghapus gambar", error);
                            }
                          }}
                        >
                          Hapus Foto
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(tool)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <Dialog
        open={form !== null}
        onOpenChange={(open) => !open && setForm(null)}
      >
        {form && (
          <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {form.id ? "Edit" : "Tambah"} Alat Tes Psikologi
              </DialogTitle>
              <DialogDescription>
                Informasi ini tampil pada kartu dan popup detail katalog publik.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Kategori</Label>
                <select
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value as Category })
                  }
                >
                  {categories.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Nama alat tes</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              {!form.id && (
                <div>
                  <Label>Slug (opsional)</Label>
                  <Input
                    placeholder="dibuat otomatis dari nama"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  />
                </div>
              )}
              <div>
                <Label>Deskripsi singkat</Label>
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Deskripsi Tes</Label>
                <Textarea
                  rows={6}
                  value={form.detailText}
                  onChange={(e) =>
                    setForm({ ...form, detailText: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Hasil yang Diperoleh</Label>
                <Textarea
                  rows={4}
                  placeholder="Tuliskan satu poin pada setiap baris"
                  value={form.resultText}
                  onChange={(e) =>
                    setForm({ ...form, resultText: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Sasaran Tes</Label>
                <Textarea
                  rows={4}
                  placeholder="Tuliskan satu sasaran pada setiap baris"
                  value={form.targetText}
                  onChange={(e) =>
                    setForm({ ...form, targetText: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Harga</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.price || ""}
                    onChange={(e) =>
                      setForm({ ...form, price: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <Label>Urutan</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        sortOrder: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                />
                Tampilkan di katalog publik
              </label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setForm(null)}
                >
                  Batal
                </Button>
                <Button
                  className="flex-1 bg-amber-700 hover:bg-amber-800"
                  disabled={saving}
                  onClick={save}
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
      <Dialog
        open={focus !== null}
        onOpenChange={(open) => !open && setFocus(null)}
      >
        {focus && (
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Atur Fokus Gambar</DialogTitle>
              <DialogDescription>
                Klik bagian gambar yang harus selalu terlihat pada kartu.
              </DialogDescription>
            </DialogHeader>
            <button
              type="button"
              onClick={clickFocus}
              className="relative aspect-[4/3] overflow-hidden rounded-xl bg-gray-100"
            >
              <img
                src={apiUrl(`/api/psychology-test-tools/${focus.id}/image`)}
                alt={focus.title}
                className="h-full w-full object-cover"
                style={{
                  objectPosition: `${focus.imageFocusX}% ${focus.imageFocusY}%`,
                }}
              />
              <span
                className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-amber-600 shadow"
                style={{
                  left: `${focus.imageFocusX}%`,
                  top: `${focus.imageFocusY}%`,
                }}
              />
            </button>
            <Button
              className="bg-amber-700 hover:bg-amber-800"
              onClick={async () => {
                try {
                  await apiRequest(
                    "PUT",
                    `/api/admin/psychology-test-tools/${focus.id}/image-focus`,
                    { focusX: focus.imageFocusX, focusY: focus.imageFocusY },
                  );
                  await refresh();
                  setFocus(null);
                  toast({ title: "Fokus gambar disimpan" });
                } catch (error) {
                  errorToast("Gagal menyimpan fokus", error);
                }
              }}
            >
              Simpan Fokus
            </Button>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
