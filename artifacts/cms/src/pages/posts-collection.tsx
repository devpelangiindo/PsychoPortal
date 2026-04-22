import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CollectionPage, StatusBadge } from "@/components/collection-page";
import { api } from "@/lib/api";

const fields = [
  { key: "title", label: "Judul Artikel", type: "text" as const, required: true, placeholder: "Judul artikel blog", cols: "full" as const },
  { key: "slug", label: "Slug (URL)", type: "text" as const, required: true, placeholder: "tips-belajar-efektif", cols: "half" as const },
  { key: "status", label: "Status", type: "select" as const, cols: "half" as const, options: [
    { value: "draft", label: "Draft" },
    { value: "published", label: "Published" },
  ]},
  { key: "author", label: "Penulis", type: "text" as const, placeholder: "Nama penulis", cols: "half" as const },
  { key: "category", label: "Kategori", type: "text" as const, placeholder: "Psikologi, Pendidikan, dsb.", cols: "half" as const },
  { key: "tags", label: "Tag (pisahkan dengan koma)", type: "text" as const, placeholder: "belajar, tips, psikologi", cols: "full" as const },
  { key: "excerpt", label: "Ringkasan", type: "textarea" as const, placeholder: "Ringkasan singkat artikel ini...", cols: "full" as const },
  { key: "content", label: "Konten Artikel", type: "textarea" as const, placeholder: "Tulis konten artikel di sini...", cols: "full" as const },
  { key: "featuredImage", label: "URL Gambar Utama", type: "url" as const, placeholder: "https://...", cols: "full" as const },
];

const listColumns = [
  { key: "title" as const, label: "Judul" },
  { key: "author" as const, label: "Penulis", render: (v: string) => v || "-" },
  { key: "category" as const, label: "Kategori", render: (v: string) => v || "-" },
  { key: "status" as const, label: "Status", render: (v: string) => <StatusBadge status={v} /> },
  { key: "updatedAt" as const, label: "Diperbarui", render: (v: string) => v ? new Date(v).toLocaleDateString("id-ID") : "-" },
];

export default function PostsCollectionPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["/cms/posts"], queryFn: api.getPosts });

  const save = useMutation({
    mutationFn: ({ data, id }: { data: any; id?: number }) =>
      id ? api.updatePost(id, data) : api.createPost(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/cms/posts"] }),
  });

  const remove = useMutation({
    mutationFn: api.deletePost,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/cms/posts"] }),
  });

  return (
    <CollectionPage
      title="Blog & Artikel"
      singularTitle="Artikel"
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
