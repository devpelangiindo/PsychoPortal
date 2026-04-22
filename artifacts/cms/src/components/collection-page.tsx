import { useState } from "react";
import { Plus, Pencil, Trash2, Search, X, ChevronLeft, Save, Loader2 } from "lucide-react";
import { CmsLayout } from "@/components/layout";

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "url";
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  cols?: "full" | "half";
}

interface CollectionPageProps<T extends { id: number }> {
  title: string;
  singularTitle: string;
  items: T[];
  isLoading: boolean;
  fields: FieldDef[];
  listColumns: { key: keyof T; label: string; render?: (val: any, row: T) => React.ReactNode }[];
  onSave: (data: Partial<T>, id?: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  defaultValues?: Partial<T>;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    published: "bg-primary/10 text-primary",
    draft: "bg-muted text-muted-foreground",
    active: "bg-primary/10 text-primary",
    inactive: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}

export function CollectionPage<T extends { id: number }>({
  title,
  singularTitle,
  items,
  isLoading,
  fields,
  listColumns,
  onSave,
  onDelete,
  defaultValues = {},
}: CollectionPageProps<T>) {
  const [view, setView] = useState<"list" | "form">("list");
  const [editItem, setEditItem] = useState<T | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const openCreate = () => {
    setEditItem(null);
    setFormData({ ...defaultValues });
    setError("");
    setView("form");
  };

  const openEdit = (item: T) => {
    setEditItem(item);
    setFormData({ ...item });
    setError("");
    setView("form");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(formData, editItem?.id);
      setView("list");
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan data.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Yakin ingin menghapus data ini?")) return;
    setDeleting(id);
    try {
      await onDelete(id);
    } finally {
      setDeleting(null);
    }
  };

  const filtered = items.filter((item: any) => {
    const q = search.toLowerCase();
    return Object.values(item).some(
      (v) => typeof v === "string" && v.toLowerCase().includes(q)
    );
  });

  const setValue = (key: string, val: string) =>
    setFormData((prev) => ({ ...prev, [key]: val }));

  if (view === "form") {
    return (
      <CmsLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView("list")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Kembali
            </button>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium">
              {editItem ? `Edit ${singularTitle}` : `Buat ${singularTitle} Baru`}
            </span>
          </div>

          <div className="bg-card border rounded-xl p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {fields.map((field) => {
                  const colClass = field.cols === "half" ? "col-span-1" : "col-span-2";
                  return (
                    <div key={field.key} className={colClass}>
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        {field.label}
                        {field.required && <span className="text-destructive ml-1">*</span>}
                      </label>
                      {field.type === "textarea" ? (
                        <textarea
                          required={field.required}
                          value={formData[field.key] ?? ""}
                          onChange={(e) => setValue(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          rows={5}
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        />
                      ) : field.type === "select" ? (
                        <select
                          required={field.required}
                          value={formData[field.key] ?? ""}
                          onChange={(e) => setValue(field.key, e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="">Pilih...</option>
                          {field.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type === "url" ? "url" : "text"}
                          required={field.required}
                          value={formData[field.key] ?? ""}
                          onChange={(e) => setValue(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {error && (
                <div className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      </CmsLayout>
    );
  }

  return (
    <CmsLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tambah {singularTitle}
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Cari ${title.toLowerCase()}...`}
            className="w-full pl-9 pr-9 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="bg-card border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Memuat data...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="text-4xl mb-3">📭</div>
              <div className="font-medium">Belum ada data</div>
              <div className="text-sm mt-1">
                Klik "Tambah {singularTitle}" untuk mulai.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {listColumns.map((col) => (
                      <th
                        key={String(col.key)}
                        className="text-left px-4 py-3 font-semibold text-foreground text-xs uppercase tracking-wide"
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs uppercase tracking-wide font-semibold text-foreground">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      {listColumns.map((col) => (
                        <td key={String(col.key)} className="px-4 py-3 text-foreground">
                          {col.render
                            ? col.render((item as any)[col.key], item)
                            : String((item as any)[col.key] ?? "-")}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => openEdit(item)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border hover:bg-muted transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={deleting === item.id}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                          >
                            {deleting === item.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </CmsLayout>
  );
}

export { StatusBadge };
