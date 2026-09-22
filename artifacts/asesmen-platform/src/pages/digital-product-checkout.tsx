import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Loader2, ShoppingCart, Trash2 } from "lucide-react";
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

type Product = { id: number; slug: string; name: string; shortDescription: string; price: string; promoPrice: string | null; effectivePrice: string; images: { id: number; focusX: number; focusY: number }[] };


function money(value: string | number) {
  return `Rp ${new Intl.NumberFormat("id-ID").format(Number(value) || 0)}`;
}

export default function DigitalProductCheckout() {
  const elearning = new URLSearchParams(window.location.search).get("category") === "elearning";
  const category = elearning ? "elearning" : "digital";
  const CART_KEY = elearning ? "elearningCart" : "digitalProductCart";
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const slug = new URLSearchParams(window.location.search).get("product") || "";
  const [cartSlugs, setCartSlugs] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); } catch { return []; }
  });
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      const redirect = `${window.location.pathname}${window.location.search}`;
      window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`;
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (slug) setCartSlugs((current) => current.includes(slug) ? current : [...current, slug]);
  }, [slug]);

  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cartSlugs)); }, [cartSlugs]);
  useEffect(() => {
    if (!user) return;
    setFullName(`${user.firstName || ""} ${user.lastName || ""}`.trim());
    setEmail(user.email || "");
    setPhone(user.whatsappNumber || "");
  }, [user]);

  const { data: allProducts = [], isLoading } = useQuery<Product[]>({ queryKey: [`/api/digital-products?category=${category}`] });
  const products = useMemo(() => allProducts.filter((product) => cartSlugs.includes(product.slug)), [allProducts, cartSlugs]);
  const total = products.reduce((sum, product) => sum + Number(product.effectivePrice), 0);

  const checkout = useMutation({
    mutationFn: async () => {
      const orderResponse = await apiRequest("POST", "/api/digital-products/orders", {
        productIds: products.map((product) => product.id),
        customer: { fullName, email, phone, notes },
      });
      const order = await orderResponse.json();
      const paymentResponse = await apiRequest("POST", "/api/payments/create", { orderId: order.id, paymentMethod: "midtrans" });
      return paymentResponse.json();
    },
    onSuccess: (payment) => {
      localStorage.removeItem(CART_KEY);
      if (payment.redirect_url) window.location.href = payment.redirect_url;
      else toast({ title: "Pembayaran siap", description: "Silakan lanjutkan pembayaran melalui Midtrans." });
    },
    onError: (error) => toast({ title: "Transaksi gagal", description: error instanceof Error ? error.message : "Silakan coba lagi.", variant: "destructive" }),
  });

  if (authLoading || !isAuthenticated) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-green-700" /></div>;

  const invalid = !products.length || fullName.trim().length < 2 || !email.includes("@") || phone.trim().length < 7;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto max-w-6xl px-4 py-10">
        <a href={`https://pi-psychology.com/produk-layanan/produk-edukasi/${elearning ? "video-e-learning" : "produk-digital"}`} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-green-700"><ArrowLeft size={17} /> Kembali ke katalog</a>
        <div className="mb-8 flex items-center gap-3"><ShoppingCart className="text-green-700" /><h1 className="text-3xl font-extrabold">Keranjang {elearning ? "Video E-Learning" : "Produk Digital"}</h1></div>
        <div className="grid gap-7 lg:grid-cols-[1.1fr_.9fr]">
          <Card>
            <CardHeader><CardTitle>Produk yang dipilih</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? <Loader2 className="animate-spin" /> : products.length === 0 ? <p className="text-gray-500">Keranjang masih kosong.</p> : products.map((product) => (
                <div key={product.id} className="flex items-center gap-4 rounded-xl border p-3">
                  <div className="h-20 w-24 overflow-hidden rounded-lg bg-green-50">
                    {product.images?.[0] && <img src={apiUrl(`/api/digital-products/images/${product.images[0].id}`)} alt="" className="h-full w-full object-cover" style={{ objectPosition: `${product.images[0].focusX ?? 50}% ${product.images[0].focusY ?? 50}%` }} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{product.name}</p>
                    <div className="flex flex-wrap items-baseline gap-2">
                      {product.promoPrice && <span className="text-xs text-gray-400 line-through">{money(product.price)}</span>}
                      <span className="text-sm font-semibold text-green-700">{money(product.effectivePrice)}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Hapus produk" onClick={() => setCartSlugs((current) => current.filter((item) => item !== product.slug))}><Trash2 size={18} /></Button>
                </div>
              ))}
              <div className="flex justify-between border-t pt-4 text-lg font-extrabold"><span>Total</span><span className="text-green-700">{money(total)}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Informasi pembeli</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label htmlFor="digital-name">Nama lengkap</Label><Input id="digital-name" value={fullName} onChange={(event) => setFullName(event.target.value)} /></div>
              <div><Label htmlFor="digital-email">Email</Label><Input id="digital-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
              <div><Label htmlFor="digital-phone">Nomor WhatsApp</Label><Input id="digital-phone" value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
              <div><Label htmlFor="digital-notes">Catatan (opsional)</Label><Textarea id="digital-notes" value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
              <Button className="w-full bg-green-700 hover:bg-green-800" disabled={invalid || checkout.isPending} onClick={() => checkout.mutate()}>
                {checkout.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Bayar dengan Midtrans
              </Button>
              <p className="text-xs leading-5 text-gray-500">Produk dapat diunduh atau dibuka dari dashboard setelah pembayaran berhasil.</p>
            </CardContent>
          </Card>
        </div>
        <div className="mt-6 text-center"><Link href="/dashboard" className="text-sm text-green-700 underline">Lihat dashboard saya</Link></div>
      </main>
      <Footer />
    </div>
  );
}
