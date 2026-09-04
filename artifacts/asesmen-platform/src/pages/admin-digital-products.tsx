import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Crosshair, Eye, FileUp, ImagePlus, Loader2, Pencil, Plus, Search, ShoppingBag, Trash2 } from "lucide-react";
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

type ProductImage = { id: number; fileName: string; focusX: number; focusY: number };
type Product = {
  id: number; slug: string; name: string; shortDescription: string; description: string; descriptionHtml?: string | null; price: string;
  promoPrice: string | null; effectivePrice: string;
  isActive: boolean; hasDeliveryFile: boolean; hasDeliveryUrl: boolean; deliveryFileName: string | null;
  deliveryUrl: string | null;
  images: ProductImage[];
};
type FormState = { name: string; slug: string; shortDescription: string; description: string; descriptionHtml: string; price: string; promoPrice: string; deliveryUrl: string; isActive: boolean };
type DigitalOrderItem = { productId: number; productName: string; price: string };
type DigitalOrder = {
  orderId: number; userId: string; totalAmount: string; orderStatus: string; paymentStatus: string;
  paymentMethod?: string | null; paidAmount?: string | null; paidAt?: string | null; createdAt: string;
  fullName: string; email: string; phone: string; notes?: string | null;
  accountEmail?: string | null; accountFirstName?: string | null; accountLastName?: string | null;
  products: DigitalOrderItem[];
};
const emptyForm: FormState = { name: "", slug: "", shortDescription: "", description: "", descriptionHtml: "", price: "", promoPrice: "", deliveryUrl: "", isActive: true };

function plainTextToHtml(value: string) {
  const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return value.split(/\n{2,}/).map((paragraph) => `<p>${escape(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
}

async function uploadBinary(path: string, file: File, method = "POST", preserveMimeType = true) {
  const response = await fetch(apiUrl(path), {
    method,
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": preserveMimeType ? (file.type || "application/octet-stream") : "application/octet-stream",
      "X-Original-Mime-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
    },
    body: file,
  });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return response.json();
}

function formatMoney(value: string | number | null | undefined) {
  return `Rp ${new Intl.NumberFormat("id-ID").format(Number(value) || 0)}`;
}

function formatOrderDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function AdminDigitalProducts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [focusEditor, setFocusEditor] = useState<{ productId: number; image: ProductImage; focusX: number; focusY: number } | null>(null);
  const [isSavingFocus, setIsSavingFocus] = useState(false);
  const [activeTab, setActiveTab] = useState<"products" | "orders">("products");
  const [orderSearch, setOrderSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const isCso = window.location.pathname.startsWith("/cso");
  const { data: products = [], isLoading } = useQuery<Product[]>({ queryKey: ["/api/admin/digital-products"] });
  const { data: digitalOrders = [], isLoading: ordersLoading } = useQuery<DigitalOrder[]>({ queryKey: ["/api/admin/digital-product-orders"] });

  const filteredOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();
    return digitalOrders.filter((order) => {
      const isPaid = order.paymentStatus === "paid" || order.orderStatus === "completed";
      if (paymentFilter === "paid" && !isPaid) return false;
      if (paymentFilter !== "all" && paymentFilter !== "paid" && order.paymentStatus !== paymentFilter) return false;
      if (!query) return true;
      return [
        String(order.orderId), order.fullName, order.email, order.phone, order.accountEmail || "",
        ...order.products.map((product) => product.productName),
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [digitalOrders, orderSearch, paymentFilter]);

  const orderStats = useMemo(() => ({
    total: digitalOrders.length,
    paid: digitalOrders.filter((order) => order.paymentStatus === "paid" || order.orderStatus === "completed").length,
  }), [digitalOrders]);

  useEffect(() => {
    if (!editing) return setForm(emptyForm);
    setForm({ name: editing.name, slug: editing.slug, shortDescription: editing.shortDescription, description: editing.description, descriptionHtml: editing.descriptionHtml || plainTextToHtml(editing.description), price: editing.price, promoPrice: editing.promoPrice || "", deliveryUrl: editing.deliveryUrl || "", isActive: editing.isActive });
  }, [editing]);

  const save = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(editing ? "PUT" : "POST", editing ? `/api/admin/digital-products/${editing.id}` : "/api/admin/digital-products", {
        ...form,
        price: Number(form.price),
        promoPrice: form.promoPrice === "" ? null : Number(form.promoPrice),
      });
      return response.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/digital-products"] }); setEditing(null); setForm(emptyForm); toast({ title: "Produk tersimpan" }); },
    onError: (error) => toast({ title: "Gagal menyimpan", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/digital-products/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/digital-products"] }); toast({ title: "Produk dinonaktifkan" }); },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/digital-products"] });
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const setFocusPreset = (focusX: number, focusY: number) => setFocusEditor((current) => current ? { ...current, focusX, focusY } : current);
  const handleFocusClick = (event: MouseEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const focusX = Math.max(0, Math.min(100, Math.round(((event.clientX - bounds.left) / bounds.width) * 100)));
    const focusY = Math.max(0, Math.min(100, Math.round(((event.clientY - bounds.top) / bounds.height) * 100)));
    setFocusPreset(focusX, focusY);
  };
  const saveImageFocus = async () => {
    if (!focusEditor) return;
    setIsSavingFocus(true);
    try {
      await apiRequest("PUT", `/api/admin/digital-products/${focusEditor.productId}/images/${focusEditor.image.id}/focus`, {
        focusX: focusEditor.focusX,
        focusY: focusEditor.focusY,
      });
      await refresh();
      toast({ title: "Titik fokus gambar tersimpan" });
      setFocusEditor(null);
    } catch (error) {
      toast({ title: "Gagal menyimpan titik fokus", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" });
    } finally {
      setIsSavingFocus(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <Link href={isCso ? "/cso/dashboard" : "/admin/dashboard"} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-green-700"><ArrowLeft size={17} /> Kembali ke Dashboard</Link>
        <div className="mb-7"><h1 className="text-3xl font-extrabold">Pengelolaan Produk Digital</h1><p className="mt-2 text-gray-600">Tambah katalog, gambar, file unduhan, atau link akses produk.</p></div>
        <div className="mb-6 flex flex-wrap gap-2">
          <Button type="button" variant={activeTab === "products" ? "default" : "outline"} className={activeTab === "products" ? "bg-green-700 hover:bg-green-800" : ""} onClick={() => setActiveTab("products")}><ShoppingBag className="mr-2 h-4 w-4"/>Produk</Button>
          <Button type="button" variant={activeTab === "orders" ? "default" : "outline"} className={activeTab === "orders" ? "bg-green-700 hover:bg-green-800" : ""} onClick={() => setActiveTab("orders")}>Pembelian ({orderStats.total})</Button>
        </div>
        {activeTab === "products" && <div className="grid gap-7 lg:grid-cols-[400px_1fr]">
          <Card className="h-fit lg:sticky lg:top-6">
            <CardHeader><CardTitle className="flex items-center gap-2">{editing ? <Pencil size={19} /> : <Plus size={19} />}{editing ? "Edit Produk" : "Tambah Produk"}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Nama produk</Label><Input value={form.name} onChange={(event) => update("name", event.target.value)} /></div>
              <div><Label>Slug (opsional)</Label><Input value={form.slug} onChange={(event) => update("slug", event.target.value)} placeholder="dibuat otomatis dari nama" /></div>
              <div><Label>Deskripsi singkat</Label><Textarea value={form.shortDescription} onChange={(event) => update("shortDescription", event.target.value)} /></div>
              <div className="space-y-2">
                <Label>Deskripsi lengkap</Label>
                <TrainingRichTextEditor
                  value={form.descriptionHtml}
                  enableImageUpload={false}
                  placeholder="Tulis deskripsi lengkap produk..."
                  onChange={(descriptionHtml, description) => setForm((current) => ({ ...current, descriptionHtml, description }))}
                />
              </div>
              <div><Label>Harga Reguler</Label><Input type="number" min="0" value={form.price} onChange={(event) => update("price", event.target.value)} /></div>
              <div><Label>Harga Promo (opsional)</Label><Input type="number" min="0" value={form.promoPrice} onChange={(event) => update("promoPrice", event.target.value)} placeholder="Harus lebih rendah dari harga reguler" /></div>
              <div><Label>Link produk (opsional)</Label><Input type="url" value={form.deliveryUrl} onChange={(event) => update("deliveryUrl", event.target.value)} placeholder="https://..." /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(event) => update("isActive", event.target.checked)} /> Tampilkan di katalog</label>
              <div className="flex gap-2"><Button className="flex-1 bg-green-700 hover:bg-green-800" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan</Button>{editing && <Button variant="outline" onClick={() => setEditing(null)}>Batal</Button>}</div>
            </CardContent>
          </Card>

          <div className="space-y-5">
            {isLoading ? <Loader2 className="animate-spin" /> : products.length === 0 ? <Card><CardContent className="p-10 text-center text-gray-500">Belum ada produk digital.</CardContent></Card> : products.map((product) => (
              <Card key={product.id} className={!product.isActive ? "opacity-65" : ""}>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-5 xl:flex-row">
                    <div className="w-full xl:w-64">
                      <div className="grid grid-cols-3 gap-2">
                        {product.images.map((image) => (
                          <div key={image.id} className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                            <img src={apiUrl(`/api/digital-products/images/${image.id}`)} alt="" className="h-full w-full object-cover" style={{ objectPosition: `${image.focusX}% ${image.focusY}%` }} />
                            <button type="button" className="absolute bottom-1 left-1 rounded bg-black/70 p-1 text-white" aria-label="Atur fokus gambar" onClick={() => setFocusEditor({ productId: product.id, image, focusX: image.focusX, focusY: image.focusY })}><Crosshair size={13} /></button>
                            <button type="button" className="absolute right-1 top-1 rounded bg-red-600 p-1 text-white opacity-0 group-hover:opacity-100" onClick={async () => { await apiRequest("DELETE", `/api/admin/digital-products/${product.id}/images/${image.id}`); refresh(); }}><Trash2 size={13} /></button>
                          </div>
                        ))}
                        <label className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border-2 border-dashed text-gray-500 hover:border-green-500 hover:text-green-700">
                          <ImagePlus size={22} /><input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { await uploadBinary(`/api/admin/digital-products/${product.id}/images`, file); refresh(); } catch (error) { toast({ title: "Gagal mengunggah gambar", description: String(error), variant: "destructive" }); } event.target.value = ""; }} />
                        </label>
                      </div>
                      {focusEditor?.productId === product.id && (
                        <div className="mt-3 rounded-xl border bg-white p-3 shadow-sm">
                          <p className="mb-2 text-xs font-bold text-gray-700">Klik bagian gambar yang ingin diprioritaskan</p>
                          <button type="button" className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-gray-100" onClick={handleFocusClick}>
                            <img src={apiUrl(`/api/digital-products/images/${focusEditor.image.id}`)} alt="Preview titik fokus" className="h-full w-full object-cover" style={{ objectPosition: `${focusEditor.focusX}% ${focusEditor.focusY}%` }} />
                            <span className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-green-600 shadow" style={{ left: `${focusEditor.focusX}%`, top: `${focusEditor.focusY}%` }} />
                          </button>
                          <div className="mt-2 grid grid-cols-3 gap-1 text-xs">
                            <Button type="button" size="sm" variant="outline" onClick={() => setFocusPreset(50, 0)}>Atas</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setFocusPreset(50, 50)}>Tengah</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setFocusPreset(50, 100)}>Bawah</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setFocusPreset(0, 50)}>Kiri</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setFocusPreset(100, 50)}>Kanan</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setFocusEditor(null)}>Batal</Button>
                          </div>
                          <Button type="button" size="sm" className="mt-2 w-full bg-green-700 hover:bg-green-800" disabled={isSavingFocus} onClick={saveImageFocus}>{isSavingFocus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan Fokus</Button>
                          <p className="mt-2 text-center text-[11px] text-gray-500">Posisi: {focusEditor.focusX}% × {focusEditor.focusY}%</p>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{product.name}</h2><p className="text-sm text-gray-500">/{product.slug}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${product.isActive ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>{product.isActive ? "Aktif" : "Nonaktif"}</span></div>
                      <p className="mt-3 text-sm leading-6 text-gray-600">{product.shortDescription}</p>
                      <div className="mt-2 flex flex-wrap items-baseline gap-2">
                        {product.promoPrice && <span className="text-sm text-gray-500 line-through">Rp {new Intl.NumberFormat("id-ID").format(Number(product.price))}</span>}
                        <span className="font-extrabold text-green-700">Rp {new Intl.NumberFormat("id-ID").format(Number(product.effectivePrice))}</span>
                        {product.promoPrice && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">Promo</span>}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditing(product)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>
                        <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-gray-50"><FileUp className="mr-2 h-4 w-4" />{product.hasDeliveryFile ? "Ganti file" : "Unggah file"}<input className="hidden" type="file" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { await uploadBinary(`/api/admin/digital-products/${product.id}/file`, file, "PUT", false); refresh(); toast({ title: "File produk tersimpan" }); } catch (error) { toast({ title: "Gagal mengunggah file", description: String(error), variant: "destructive" }); } event.target.value = ""; }} /></label>
                        {product.hasDeliveryFile && <Button size="sm" variant="outline" onClick={async () => { if (!confirm("Hapus file produk ini?")) return; await apiRequest("DELETE", `/api/admin/digital-products/${product.id}/file`); refresh(); }}><Trash2 className="mr-2 h-4 w-4" />Hapus file</Button>}
                        <Button size="sm" variant="destructive" disabled={!product.isActive || remove.isPending} onClick={() => { if (confirm("Nonaktifkan produk ini dari katalog?")) remove.mutate(product.id); }}><Trash2 className="mr-2 h-4 w-4" />Hapus</Button>
                      </div>
                      <p className="mt-3 text-xs text-gray-500">Akses: {product.hasDeliveryFile ? `file (${product.deliveryFileName})` : "tanpa file"} · {product.hasDeliveryUrl ? "link tersedia" : "tanpa link"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>}
        {activeTab === "orders" && <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card><CardContent className="flex items-center gap-4 p-5"><div className="rounded-full bg-green-100 p-3 text-green-800"><ShoppingBag className="h-5 w-5"/></div><div><p className="text-sm text-gray-500">Total transaksi</p><p className="text-2xl font-extrabold">{orderStats.total}</p></div></CardContent></Card>
            <Card><CardContent className="flex items-center gap-4 p-5"><div className="rounded-full bg-emerald-100 p-3 text-emerald-800"><ShoppingBag className="h-5 w-5"/></div><div><p className="text-sm text-gray-500">Transaksi lunas</p><p className="text-2xl font-extrabold text-green-700">{orderStats.paid}</p></div></CardContent></Card>
          </div>
          <Card><CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_220px]"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"/><Input className="pl-9" placeholder="Cari pembeli, email, WhatsApp, nomor pesanan, atau produk" value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)}/></div><select className="h-10 rounded-md border bg-white px-3 text-sm" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}><option value="all">Semua pembayaran</option><option value="paid">Lunas</option><option value="pending">Menunggu pembayaran</option><option value="failed">Gagal</option><option value="expired">Kedaluwarsa</option></select></CardContent></Card>
          {ordersLoading ? <div className="flex justify-center py-14"><Loader2 className="animate-spin text-green-700"/></div> : filteredOrders.length === 0 ? <Card><CardContent className="p-12 text-center text-gray-500">Belum ada pembelian yang sesuai.</CardContent></Card> : <div className="space-y-3">{filteredOrders.map((order) => {
            const isPaid = order.paymentStatus === "paid" || order.orderStatus === "completed";
            return <Card key={order.orderId}><CardContent className="p-0"><div className="grid items-center gap-4 p-5 md:grid-cols-[minmax(180px,1fr)_minmax(220px,1.25fr)_160px_130px_auto]"><div><p className="text-xs font-bold uppercase tracking-wide text-gray-400">Pesanan #{order.orderId}</p><p className="mt-1 font-bold">{order.fullName}</p><p className="text-xs text-gray-500">{formatOrderDate(order.createdAt)}</p></div><div><p className="line-clamp-2 text-sm font-medium text-gray-700">{order.products.map((product) => product.productName).join(", ")}</p><p className="mt-1 text-xs text-gray-500">{order.products.length} produk</p></div><p className="font-extrabold text-green-700">{formatMoney(order.totalAmount)}</p><span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${isPaid ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{isPaid ? "Lunas" : order.paymentStatus || "Pending"}</span><Button type="button" size="sm" variant="outline" onClick={() => setExpandedOrderId((current) => current === order.orderId ? null : order.orderId)}><Eye className="mr-2 h-4 w-4"/>{expandedOrderId === order.orderId ? "Tutup" : "Detail"}</Button></div>
              {expandedOrderId === order.orderId && <div className="border-t bg-gray-50 p-5"><div className="grid gap-6 lg:grid-cols-2"><div><h3 className="font-bold">Data pembeli</h3><dl className="mt-3 grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm"><dt className="text-gray-500">Nama</dt><dd>{order.fullName}</dd><dt className="text-gray-500">Email</dt><dd className="break-all">{order.email}</dd><dt className="text-gray-500">WhatsApp</dt><dd>{order.phone}</dd><dt className="text-gray-500">Akun</dt><dd className="break-all">{order.accountEmail || order.userId}</dd><dt className="text-gray-500">Catatan</dt><dd className="whitespace-pre-line">{order.notes || "-"}</dd></dl></div><div><h3 className="font-bold">Produk yang dibeli</h3><div className="mt-3 space-y-2">{order.products.map((product) => <div key={product.productId} className="flex justify-between gap-4 rounded-lg border bg-white px-4 py-3 text-sm"><span>{product.productName}</span><strong className="shrink-0">{formatMoney(product.price)}</strong></div>)}</div><dl className="mt-4 grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-sm"><dt className="text-gray-500">Total</dt><dd className="font-bold">{formatMoney(order.totalAmount)}</dd><dt className="text-gray-500">Metode bayar</dt><dd>{order.paymentMethod || "-"}</dd><dt className="text-gray-500">Waktu lunas</dt><dd>{formatOrderDate(order.paidAt)}</dd></dl></div></div></div>}
            </CardContent></Card>;
          })}</div>}
        </div>}
      </div>
    </div>
  );
}
