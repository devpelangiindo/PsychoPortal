import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CollectionPage } from "@/components/collection-page";
import { api } from "@/lib/api";

const fields = [
  { key: "name", label: "Nama Lengkap", type: "text" as const, required: true, placeholder: "Nama anggota tim", cols: "half" as const },
  { key: "role", label: "Jabatan / Peran", type: "text" as const, required: true, placeholder: "Psikolog Klinis", cols: "half" as const },
  { key: "bio", label: "Biografi", type: "textarea" as const, placeholder: "Biografi singkat...", cols: "full" as const },
  { key: "email", label: "Email", type: "text" as const, placeholder: "nama@pi-psychology.com", cols: "half" as const },
  { key: "linkedIn", label: "URL LinkedIn", type: "url" as const, placeholder: "https://linkedin.com/in/...", cols: "half" as const },
  { key: "photo", label: "URL Foto", type: "url" as const, placeholder: "https://...", cols: "full" as const },
  { key: "orderIndex", label: "Urutan Tampil", type: "text" as const, placeholder: "0 (terkecil tampil pertama)", cols: "half" as const },
  { key: "isActive", label: "Status", type: "select" as const, cols: "half" as const, options: [
    { value: "true", label: "Aktif" },
    { value: "false", label: "Tidak Aktif" },
  ]},
];

const listColumns = [
  { key: "name" as const, label: "Nama",
    render: (v: string, row: any) => (
      <div className="flex items-center gap-2">
        {row.photo ? (
          <img src={row.photo} alt={v} className="w-7 h-7 rounded-full object-cover bg-muted" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
            {v?.[0] ?? "?"}
          </div>
        )}
        <span className="font-medium">{v}</span>
      </div>
    )
  },
  { key: "role" as const, label: "Jabatan" },
  { key: "email" as const, label: "Email", render: (v: string) => v || "-" },
  { key: "isActive" as const, label: "Status", render: (v: boolean) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${v ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
      {v ? "Aktif" : "Nonaktif"}
    </span>
  )},
];

export default function TeamMembersCollectionPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["/cms/team-members"], queryFn: api.getTeamMembers });

  const save = useMutation({
    mutationFn: ({ data, id }: { data: any; id?: number }) => {
      const payload = { ...data, isActive: data.isActive === "true" || data.isActive === true, orderIndex: parseInt(data.orderIndex ?? "0") || 0 };
      return id ? api.updateTeamMember(id, payload) : api.createTeamMember(payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/cms/team-members"] }),
  });

  const remove = useMutation({
    mutationFn: api.deleteTeamMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/cms/team-members"] }),
  });

  return (
    <CollectionPage
      title="Anggota Tim"
      singularTitle="Anggota Tim"
      items={data}
      isLoading={isLoading}
      fields={fields}
      listColumns={listColumns}
      defaultValues={{ isActive: "true", orderIndex: "0" }}
      onSave={(formData, id) => save.mutateAsync({ data: formData, id })}
      onDelete={(id) => remove.mutateAsync(id)}
    />
  );
}
