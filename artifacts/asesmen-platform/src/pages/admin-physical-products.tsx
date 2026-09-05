import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  Package,
  Pencil,
  Plus,
  Trash2,
  Truck,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import TrainingRichTextEditor from "@/components/training-rich-text-editor";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getAuthToken } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api-base";

type Image = { id: number; fileName: string; focusX: number; focusY: number };
type Media = {
  id: number;
  title: string;
  url: string;
  mediaType: "video" | "documentation";
  sortOrder: number;
  isActive: boolean;
};
type Product = {
  id: number;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  descriptionHtml?: string | null;
  sku: string;
  price: string;
  promoPrice: string | null;
  effectivePrice: string;
  stock: number;
  lowStockThreshold: number;
  weightGrams: number;
  shippingFee: string;
  isActive: boolean;
  images: Image[];
  media: Media[];
};
type Order = {
  orderId: number;
  totalAmount: string;
  orderStatus: string;
  paymentStatus: string;
  createdAt: string;
  recipient_name: string;
  email: string;
  phone: string;
  address: string;
  district: string;
  city: string;
  province: string;
  postal_code: string;
  notes?: string;
  shipping_fee: string;
  fulfillment_status: string;
  courier?: string;
  tracking_number?: string;
  tracking_url?: string;
  products: {
    productName: string;
    sku: string;
    unitPrice: string;
    quantity: number;
  }[];
};
const empty = {
  name: "",
  slug: "",
  shortDescription: "",
  description: "",
  descriptionHtml: "",
  sku: "",
  price: "",
  promoPrice: "",
  stock: "0",
  lowStockThreshold: "0",
  weightGrams: "0",
  shippingFee: "0",
  isActive: true,
};
const money = (v: any) =>
  `Rp ${new Intl.NumberFormat("id-ID").format(Number(v) || 0)}`;
async function upload(path: string, file: File) {
  const r = await fetch(apiUrl(path), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": file.type,
      "X-File-Name": encodeURIComponent(file.name),
    },
    body: file,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function AdminPhysicalProducts() {
  const qc = useQueryClient(),
    { toast } = useToast(),
    isCso = location.pathname.startsWith("/cso");
  const [tab, setTab] = useState<"products" | "orders">("products"),
    [editing, setEditing] = useState<Product | null>(null),
    [form, setForm] = useState<any>(empty),
    [mediaProduct, setMediaProduct] = useState<number | null>(null),
    [media, setMedia] = useState({
      id: 0,
      title: "",
      url: "",
      mediaType: "video",
      sortOrder: "0",
      isActive: true,
    });
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/admin/physical-products"],
  });
  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/admin/physical-product-orders"],
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["/api/admin/physical-products"] });
    qc.invalidateQueries({ queryKey: ["/api/admin/physical-product-orders"] });
  };
  const edit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      slug: p.slug,
      shortDescription: p.shortDescription,
      description: p.description,
      descriptionHtml: p.descriptionHtml || p.description,
      sku: p.sku,
      price: p.price,
      promoPrice: p.promoPrice || "",
      stock: String(p.stock),
      lowStockThreshold: String(p.lowStockThreshold),
      weightGrams: String(p.weightGrams),
      shippingFee: p.shippingFee,
      isActive: p.isActive,
    });
    scrollTo({ top: 0, behavior: "smooth" });
  };
  const save = useMutation({
    mutationFn: () =>
      apiRequest(
        editing ? "PUT" : "POST",
        editing
          ? `/api/admin/physical-products/${editing.id}`
          : "/api/admin/physical-products",
        {
          ...form,
          price: Number(form.price),
          promoPrice: form.promoPrice === "" ? null : Number(form.promoPrice),
          stock: Number(form.stock),
          lowStockThreshold: Number(form.lowStockThreshold),
          weightGrams: Number(form.weightGrams),
          shippingFee: Number(form.shippingFee),
        },
      ),
    onSuccess: () => {
      setEditing(null);
      setForm(empty);
      refresh();
      toast({ title: "Produk fisik tersimpan" });
    },
    onError: (e) =>
      toast({
        title: "Gagal menyimpan",
        description: String(e),
        variant: "destructive",
      }),
  });
  const updateFulfillment = async (order: Order, status: string) => {
    await apiRequest(
      "PUT",
      `/api/admin/physical-product-orders/${order.orderId}/fulfillment`,
      {
        fulfillmentStatus: status,
        courier: order.courier || "",
        trackingNumber: order.tracking_number || "",
        trackingUrl: order.tracking_url || "",
      },
    );
    refresh();
    toast({ title: "Status pengiriman disimpan" });
  };
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href={isCso ? "/cso/dashboard" : "/admin/dashboard"}
          className="mb-6 inline-flex items-center gap-2 font-semibold text-green-700"
        >
          <ArrowLeft size={18} />
          Kembali ke Dashboard
        </Link>
        <h1 className="text-3xl font-extrabold">Pengelolaan Produk Fisik</h1>
        <p className="mt-2 text-gray-600">
          Kelola katalog, stok, galeri, media, pembelian, dan pengiriman.
        </p>
        <div className="my-6 flex gap-2">
          <Button
            onClick={() => setTab("products")}
            variant={tab === "products" ? "default" : "outline"}
          >
            <Package className="mr-2" />
            Produk
          </Button>
          <Button
            onClick={() => setTab("orders")}
            variant={tab === "orders" ? "default" : "outline"}
          >
            <Truck className="mr-2" />
            Pesanan ({orders.length})
          </Button>
        </div>
        {tab === "products" && (
          <div className="grid gap-7 lg:grid-cols-[410px_1fr]">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>{editing ? "Edit" : "Tambah"} Produk</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Nama</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Slug (opsional)</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  />
                </div>
                <div>
                  <Label>SKU</Label>
                  <Input
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Deskripsi singkat</Label>
                  <Textarea
                    value={form.shortDescription}
                    onChange={(e) =>
                      setForm({ ...form, shortDescription: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Deskripsi lengkap</Label>
                  <TrainingRichTextEditor
                    value={form.descriptionHtml}
                    enableImageUpload={false}
                    onChange={(descriptionHtml, description) =>
                      setForm({ ...form, descriptionHtml, description })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["price", "Harga reguler"],
                    ["promoPrice", "Harga promo"],
                    ["stock", "Stok"],
                    ["lowStockThreshold", "Batas stok rendah"],
                    ["weightGrams", "Berat (gram)"],
                    ["shippingFee", "Ongkir/unit"],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <Label>{label}</Label>
                      <Input
                        type="number"
                        min="0"
                        value={form[key]}
                        onChange={(e) =>
                          setForm({ ...form, [key]: e.target.value })
                        }
                      />
                    </div>
                  ))}
                </div>
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm({ ...form, isActive: e.target.checked })
                    }
                  />
                  Tampilkan di katalog
                </label>
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-green-700"
                    onClick={() => save.mutate()}
                    disabled={save.isPending}
                  >
                    {save.isPending && (
                      <Loader2 className="mr-2 animate-spin" />
                    )}
                    Simpan
                  </Button>
                  {editing && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditing(null);
                        setForm(empty);
                      }}
                    >
                      Batal
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            <div className="space-y-4">
              {isLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                products.map((p) => (
                  <Card key={p.id} className={!p.isActive ? "opacity-60" : ""}>
                    <CardContent className="p-5">
                      <div className="flex flex-col gap-5 md:flex-row">
                        <div className="w-full md:w-48">
                          <div className="grid grid-cols-3 gap-2">
                            {p.images.map((i) => (
                              <div
                                className="group relative aspect-square overflow-hidden rounded-lg"
                                key={i.id}
                              >
                                <img
                                  src={apiUrl(
                                    `/api/physical-products/images/${i.id}`,
                                  )}
                                  className="h-full w-full object-cover"
                                  style={{
                                    objectPosition: `${i.focusX}% ${i.focusY}%`,
                                  }}
                                />
                                <button
                                  className="absolute right-1 top-1 rounded bg-red-600 p-1 text-white"
                                  onClick={async () => {
                                    await apiRequest(
                                      "DELETE",
                                      `/api/admin/physical-products/${p.id}/images/${i.id}`,
                                    );
                                    refresh();
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                                <select
                                  aria-label="Posisi fokus gambar"
                                  className="absolute bottom-1 left-1 max-w-[70%] rounded bg-black/70 px-1 py-0.5 text-[10px] text-white"
                                  defaultValue=""
                                  onChange={async (event) => {
                                    const [focusX, focusY] = event.target.value
                                      .split(",")
                                      .map(Number);
                                    if (Number.isNaN(focusX)) return;
                                    await apiRequest(
                                      "PUT",
                                      `/api/admin/physical-products/${p.id}/images/${i.id}/focus`,
                                      { focusX, focusY },
                                    );
                                    refresh();
                                  }}
                                >
                                  <option value="" disabled>
                                    Fokus
                                  </option>
                                  <option value="50,0">Atas</option>
                                  <option value="50,50">Tengah</option>
                                  <option value="50,100">Bawah</option>
                                  <option value="0,50">Kiri</option>
                                  <option value="100,50">Kanan</option>
                                </select>
                              </div>
                            ))}
                            <label className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border-2 border-dashed">
                              <ImagePlus />
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    await upload(
                                      `/api/admin/physical-products/${p.id}/images`,
                                      f,
                                    );
                                    refresh();
                                  }
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between">
                            <div>
                              <h2 className="text-xl font-bold">{p.name}</h2>
                              <p className="text-xs text-gray-500">
                                SKU {p.sku}
                              </p>
                            </div>
                            <span className="text-sm font-bold text-green-700">
                              Stok {p.stock}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-gray-600">
                            {p.shortDescription}
                          </p>
                          <div className="mt-2 font-extrabold text-green-700">
                            {p.promoPrice && (
                              <span className="mr-2 text-sm text-gray-400 line-through">
                                {money(p.price)}
                              </span>
                            )}
                            {money(p.effectivePrice)}
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => edit(p)}
                            >
                              <Pencil className="mr-1" size={15} />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={!p.isActive}
                              onClick={async () => {
                                if (confirm("Nonaktifkan produk?")) {
                                  await apiRequest(
                                    "DELETE",
                                    `/api/admin/physical-products/${p.id}`,
                                  );
                                  refresh();
                                }
                              }}
                            >
                              <Trash2 className="mr-1" size={15} />
                              Hapus
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setMediaProduct(
                                  mediaProduct === p.id ? null : p.id,
                                )
                              }
                            >
                              <Plus className="mr-1" size={15} />
                              Media
                            </Button>
                          </div>
                          {mediaProduct === p.id && (
                            <div className="mt-4 space-y-2 rounded-xl border bg-green-50 p-3">
                              <Label>Video/dokumentasi eksternal</Label>
                              <Input
                                placeholder="Judul"
                                value={media.title}
                                onChange={(e) =>
                                  setMedia({ ...media, title: e.target.value })
                                }
                              />
                              <Input
                                placeholder="https://..."
                                value={media.url}
                                onChange={(e) =>
                                  setMedia({ ...media, url: e.target.value })
                                }
                              />
                              <Button
                                size="sm"
                                onClick={async () => {
                                  await apiRequest(
                                    media.id ? "PUT" : "POST",
                                    media.id
                                      ? `/api/admin/physical-products/${p.id}/media/${media.id}`
                                      : `/api/admin/physical-products/${p.id}/media`,
                                    {
                                      ...media,
                                      sortOrder: Number(media.sortOrder),
                                    },
                                  );
                                  setMedia({
                                    ...media,
                                    id: 0,
                                    title: "",
                                    url: "",
                                  });
                                  refresh();
                                }}
                              >
                                {media.id ? "Simpan perubahan" : "Tambah media"}
                              </Button>
                              {p.media?.map((m) => (
                                <div
                                  key={m.id}
                                  className="flex justify-between rounded bg-white p-2 text-xs"
                                >
                                  <a href={m.url} target="_blank">
                                    {m.title}
                                  </a>
                                  <div className="flex gap-2">
                                    <button
                                      className="text-green-700"
                                      onClick={() =>
                                        setMedia({
                                          id: m.id,
                                          title: m.title,
                                          url: m.url,
                                          mediaType: m.mediaType,
                                          sortOrder: String(m.sortOrder),
                                          isActive: m.isActive,
                                        })
                                      }
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="text-red-600"
                                      onClick={async () => {
                                        await apiRequest(
                                          "DELETE",
                                          `/api/admin/physical-products/${p.id}/media/${m.id}`,
                                        );
                                        refresh();
                                      }}
                                    >
                                      Hapus
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
        {tab === "orders" && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center text-gray-500">
                  Belum ada pesanan produk fisik.
                </CardContent>
              </Card>
            ) : (
              orders.map((o, index) => (
                <Card key={o.orderId}>
                  <CardContent className="p-5">
                    <div className="grid gap-4 lg:grid-cols-[1fr_1fr_220px]">
                      <div>
                        <p className="text-xs font-bold text-gray-400">
                          PESANAN #{o.orderId}
                        </p>
                        <h2 className="font-bold">{o.recipient_name}</h2>
                        <p className="text-sm">
                          {o.phone} · {o.email}
                        </p>
                        <p className="mt-2 text-sm text-gray-600">
                          {o.address}, {o.district}, {o.city}, {o.province}{" "}
                          {o.postal_code}
                        </p>
                      </div>
                      <div>
                        {o.products.map((p) => (
                          <p key={p.sku} className="text-sm">
                            <b>{p.quantity}×</b> {p.productName} ({p.sku})
                          </p>
                        ))}
                        <p className="mt-2 font-bold text-green-700">
                          {money(o.totalAmount)}
                        </p>
                        <p className="text-xs">Pembayaran: {o.paymentStatus}</p>
                      </div>
                      <div className="space-y-2">
                        <select
                          className="h-10 w-full rounded-md border px-2"
                          defaultValue={o.fulfillment_status}
                          onChange={(e) => {
                            orders[index].fulfillment_status = e.target.value;
                          }}
                        >
                          <option value="awaiting_payment" disabled>
                            Menunggu pembayaran
                          </option>
                          <option value="paid">Lunas</option>
                          <option value="processing">Diproses</option>
                          <option value="shipped">Dikirim</option>
                          <option value="completed">Selesai</option>
                          <option value="cancelled">Dibatalkan</option>
                        </select>
                        <Input
                          placeholder="Kurir"
                          defaultValue={o.courier}
                          onChange={(e) => {
                            orders[index].courier = e.target.value;
                          }}
                        />
                        <Input
                          placeholder="Nomor resi"
                          defaultValue={o.tracking_number}
                          onChange={(e) => {
                            orders[index].tracking_number = e.target.value;
                          }}
                        />
                        <Input
                          placeholder="Link pelacakan (https://)"
                          defaultValue={o.tracking_url}
                          onChange={(e) => {
                            orders[index].tracking_url = e.target.value;
                          }}
                        />
                        <Button
                          className="w-full bg-green-700"
                          disabled={o.paymentStatus !== "paid"}
                          onClick={() =>
                            updateFulfillment(o, o.fulfillment_status)
                          }
                        >
                          Simpan Pengiriman
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
