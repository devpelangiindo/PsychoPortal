import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Minus, Package, Plus } from "lucide-react";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api-base";

type Product = {
  id: number;
  slug: string;
  name: string;
  effectivePrice: string;
  shippingFee: string;
  stock: number;
  images: { id: number; focusX: number; focusY: number }[];
};
const money = (v: string | number) =>
  `Rp ${new Intl.NumberFormat("id-ID").format(Number(v) || 0)}`;

export default function PhysicalProductCheckout() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const slug = new URLSearchParams(location.search).get("product") || "";
  const [quantity, setQuantity] = useState(1);
  const [form, setForm] = useState({
    recipientName: "",
    email: "",
    phone: "",
    address: "",
    district: "",
    city: "",
    province: "",
    postalCode: "",
    notes: "",
  });
  useEffect(() => {
    if (!authLoading && !isAuthenticated)
      location.href = `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`;
  }, [authLoading, isAuthenticated]);
  useEffect(() => {
    if (user)
      setForm((v) => ({
        ...v,
        recipientName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        email: user.email || "",
        phone: user.whatsappNumber || "",
      }));
  }, [user]);
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/physical-products"],
  });
  const product = useMemo(
    () => products.find((p) => p.slug === slug),
    [products, slug],
  );
  const subtotal = Number(product?.effectivePrice || 0) * quantity,
    shipping = Number(product?.shippingFee || 0) * quantity,
    total = subtotal + shipping;
  const checkout = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/physical-products/orders", {
        items: [{ productId: product!.id, quantity }],
        shipping: form,
      });
      const order = await r.json();
      const p = await apiRequest("POST", "/api/payments/create", {
        orderId: order.id,
        paymentMethod: "midtrans",
      });
      return p.json();
    },
    onSuccess: (p) => {
      if (p.redirect_url) location.href = p.redirect_url;
    },
    onError: (e) =>
      toast({
        title: "Transaksi gagal",
        description: e instanceof Error ? e.message : "Silakan coba lagi",
        variant: "destructive",
      }),
  });
  if (authLoading || !isAuthenticated)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  const invalid =
    !product ||
    product.stock < quantity ||
    form.recipientName.length < 2 ||
    !form.email.includes("@") ||
    form.phone.length < 7 ||
    form.address.length < 10 ||
    !form.district ||
    !form.city ||
    !form.province ||
    !/^[0-9]{5}$/.test(form.postalCode);
  const field = (key: keyof typeof form, label: string, placeholder = "") => (
    <div>
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        value={form[key]}
        placeholder={placeholder}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto max-w-6xl px-4 py-10">
        <a
          href="https://pi-psychology.com/produk-layanan/produk-edukasi/produk-fisik"
          className="font-semibold text-green-700"
        >
          ← Kembali ke katalog
        </a>
        <h1 className="my-7 flex items-center gap-3 text-3xl font-extrabold">
          <Package className="text-green-700" />
          Checkout Produk Fisik
        </h1>
        {isLoading ? (
          <Loader2 className="animate-spin" />
        ) : !product ? (
          <Card>
            <CardContent className="p-8">Produk tidak ditemukan.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-7 lg:grid-cols-[.85fr_1.15fr]">
            <Card>
              <CardHeader>
                <CardTitle>Ringkasan pesanan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  {product.images?.[0] && (
                    <img
                      src={apiUrl(
                        `/api/physical-products/images/${product.images[0].id}`,
                      )}
                      className="h-24 w-28 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <h2 className="font-bold">{product.name}</h2>
                    <p className="text-green-700">
                      {money(product.effectivePrice)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Stok {product.stock}
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Minus />
                  </Button>
                  <span className="w-8 text-center font-bold">{quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setQuantity(Math.min(product.stock, quantity + 1))
                    }
                  >
                    <Plus />
                  </Button>
                </div>
                <div className="mt-6 space-y-2 border-t pt-4 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{money(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Biaya pengiriman</span>
                    <span>{money(shipping)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-extrabold">
                    <span>Total</span>
                    <span className="text-green-700">{money(total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Alamat pengiriman</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {field("recipientName", "Nama penerima")}
                {field("phone", "Nomor WhatsApp")}
                {field("email", "Email")}{" "}
                {field("postalCode", "Kode pos", "5 digit")}
                <div className="sm:col-span-2">
                  <Label>Alamat lengkap</Label>
                  <Textarea
                    value={form.address}
                    onChange={(e) =>
                      setForm({ ...form, address: e.target.value })
                    }
                  />
                </div>
                {field("district", "Kecamatan")}
                {field("city", "Kota/Kabupaten")}
                {field("province", "Provinsi")}
                <div className="sm:col-span-2">
                  <Label>Catatan (opsional)</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button
                    className="w-full bg-green-700"
                    disabled={invalid || checkout.isPending}
                    onClick={() => checkout.mutate()}
                  >
                    {checkout.isPending && (
                      <Loader2 className="mr-2 animate-spin" />
                    )}
                    Bayar dengan Midtrans
                  </Button>
                  <p className="mt-3 text-xs text-gray-500">
                    Stok diamankan selama batas waktu pembayaran. Pengiriman
                    diproses setelah pembayaran terkonfirmasi.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
