import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CollectionPage, StatusBadge } from "@/components/collection-page";
import { api } from "@/lib/api";

const fields = [
  { key: "title", label: "Judul", type: "text" as const, required: true, placeholder: "Judul halaman", cols: "full" as const },
  { key: "slug", label: "Slug (URL)", type: "text" as const, required: true, placeholder: "tentang-kami", cols: "half" as const },
  { key: "status", label: "Status", type: "select" as const, cols: "half" as const, options: [
    { value: "draft", label: "Draft" },
    { value: "published", label: "Published" },
  ]},
  { key: "excerpt", label: "Ringkasan", type: "textarea" as const, placeholder: "Ringkasan singkat halaman ini...", cols: "full" as const },
  { key: "content", label: "Konten", type: "textarea" as const, placeholder: "Isi konten halaman...", cols: "full" as const },
  { key: "metaTitle", label: "Meta Title (SEO)", type: "text" as const, placeholder: "Judul untuk mesin pencari", cols: "full" as const },
  { key: "metaDescription", label: "Meta Description (SEO)", type: "textarea" as const, placeholder: "Deskripsi untuk mesin pencari...", cols: "full" as const },
  { key: "featuredImage", label: "URL Gambar Utama", type: "url" as const, placeholder: "https://...", cols: "full" as const },
];

const listColumns = [
  { key: "title" as const, label: "Judul" },
  { key: "slug" as const, label: "Slug", render: (v: string) => <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{v}</code> },
  { key: "status" as const, label: "Status", render: (v: string) => <StatusBadge status={v} /> },
  { key: "updatedAt" as const, label: "Diperbarui", render: (v: string) => v ? new Date(v).toLocaleDateString("id-ID") : "-" },
];

export default function PagesCollectionPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["/cms/pages"], queryFn: api.getPages });

  const save = useMutation({
    mutationFn: ({ data, id }: { data: any; id?: number }) =>
      id ? api.updatePage(id, data) : api.createPage(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/cms/pages"] }),
  });

  const remove = useMutation({
    mutationFn: api.deletePage,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/cms/pages"] }),
  });

  return (
    <CollectionPage
      title="Halaman"
      singularTitle="Halaman"
      items={data}
      isLoading={isLoading}
      fields={fields}
      listColumns={listColumns}
      defaultValues={{ status: "draft" }}
      onSave={(formData, id) => save.mutateAsync({ data: formData, id })}
      onDelete={(id) => remove.mutateAsync(id)}
    />
  );
}
