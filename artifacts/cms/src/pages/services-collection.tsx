import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CollectionPage, StatusBadge } from "@/components/collection-page";
import { api } from "@/lib/api";

const fields = [
  { key: "title", label: "Nama Layanan", type: "text" as const, required: true, placeholder: "Konsultasi Psikologi", cols: "half" as const },
  { key: "slug", label: "Slug (URL)", type: "text" as const, required: true, placeholder: "konsultasi-psikologi", cols: "half" as const },
  { key: "status", label: "Status", type: "select" as const, cols: "half" as const, options: [
    { value: "active", label: "Aktif" },
    { value: "inactive", label: "Tidak Aktif" },
  ]},
  { key: "price", label: "Harga", type: "text" as const, placeholder: "Rp 500.000", cols: "half" as const },
  { key: "icon", label: "Nama Ikon (lucide)", type: "text" as const, placeholder: "brain, heart, users...", cols: "half" as const },
  { key: "orderIndex", label: "Urutan Tampil", type: "text" as const, placeholder: "0", cols: "half" as const },
  { key: "shortDescription", label: "Deskripsi Singkat", type: "textarea" as const, placeholder: "Deskripsi pendek layanan...", cols: "full" as const },
  { key: "description", label: "Deskripsi Lengkap", type: "textarea" as const, placeholder: "Isi detail layanan di sini...", cols: "full" as const },
  { key: "featuredImage", label: "URL Gambar Utama", type: "url" as const, placeholder: "https://...", cols: "full" as const },
];

const listColumns = [
  { key: "title" as const, label: "Nama Layanan" },
  { key: "slug" as const, label: "Slug", render: (v: string) => <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{v}</code> },
  { key: "price" as const, label: "Harga", render: (v: string) => v || "-" },
  { key: "status" as const, label: "Status", render: (v: string) => <StatusBadge status={v} /> },
  { key: "orderIndex" as const, label: "Urutan" },
];

export default function ServicesCollectionPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["/cms/services"], queryFn: api.getServices });

  const save = useMutation({
    mutationFn: ({ data, id }: { data: any; id?: number }) => {
      const payload = { ...data, orderIndex: parseInt(data.orderIndex ?? "0") || 0 };
      return id ? api.updateService(id, payload) : api.createService(payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/cms/services"] }),
  });

  const remove = useMutation({
    mutationFn: api.deleteService,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/cms/services"] }),
  });

  return (
    <CollectionPage
      title="Layanan"
      singularTitle="Layanan"
      items={data}
      isLoading={isLoading}
      fields={fields}
      listColumns={listColumns}
      defaultValues={{ status: "active", orderIndex: "0" }}
      onSave={(formData, id) => save.mutateAsync({ data: formData, id })}
      onDelete={(id) => remove.mutateAsync(id)}
    />
  );
}
