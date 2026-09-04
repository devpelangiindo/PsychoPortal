import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, ShoppingCart } from "lucide-react";
import { Link, useRoute } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getAsesmenPlatformHref } from "@/lib/platform-links";

type ProductImage = { id: number; fileName: string; sortOrder: number; focusX: number; focusY: number };
type DigitalProduct = {
  id: number;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  price: string;
  promoPrice: string | null;
  effectivePrice: string;
  images: ProductImage[];
};

function apiBase() {
  if (import.meta.env.VITE_ASESMEN_API_URL) return String(import.meta.env.VITE_ASESMEN_API_URL).replace(/\/$/, "");
  return window.location.hostname === "localhost" ? "http://localhost:5001" : "https://asesmen.pi-psychology.com";
}

function imageUrl(id: number) {
  return `${apiBase()}/api/digital-products/images/${id}`;
}

function formatCurrency(value: string) {
  return `Rp ${new Intl.NumberFormat("id-ID").format(Number(value) || 0)}`;
}

function ProductPrice({ product, large = false }: { product: DigitalProduct; large?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      {product.promoPrice && <span className={`${large ? "text-base" : "text-sm"} text-gray-400 line-through`}>{formatCurrency(product.price)}</span>}
      <span className={`${large ? "text-2xl" : "text-xl"} font-extrabold text-green-800`}>{formatCurrency(product.effectivePrice)}</span>
      {product.promoPrice && <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-rose-700">Promo</span>}
    </div>
  );
}

function checkoutUrl(product: DigitalProduct) {
  const base = getAsesmenPlatformHref().replace(/\/$/, "");
  return `${base}/digital-products/checkout?product=${encodeURIComponent(product.slug)}`;
}

function ProductGallery({ product, height = "h-56", fit = "cover" }: { product: DigitalProduct; height?: string; fit?: "cover" | "contain" }) {
  const [active, setActive] = useState(0);
  const images = product.images ?? [];
  const move = (direction: number) => setActive((current) => (current + direction + images.length) % images.length);

  if (!images.length) {
    return <div className={`${height} flex items-center justify-center bg-green-50 text-green-800 font-semibold`}>Produk Digital</div>;
  }

  return (
    <div className={`relative overflow-hidden bg-gray-100 ${height}`}>
      {fit === "contain" && (
        <img
          src={imageUrl(images[active].id)}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-xl"
          style={{ objectPosition: `${images[active].focusX ?? 50}% ${images[active].focusY ?? 50}%` }}
        />
      )}
      <img
        src={imageUrl(images[active].id)}
        alt={`${product.name} ${active + 1}`}
        className={`relative h-full w-full ${fit === "contain" ? "object-contain p-3 sm:p-5" : "object-cover"}`}
        style={{ objectPosition: `${images[active].focusX ?? 50}% ${images[active].focusY ?? 50}%` }}
      />
      {images.length > 1 && (
        <>
          <button type="button" aria-label="Gambar sebelumnya" onClick={() => move(-1)} className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow"><ChevronLeft size={18} /></button>
          <button type="button" aria-label="Gambar berikutnya" onClick={() => move(1)} className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow"><ChevronRight size={18} /></button>
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {images.map((image, index) => <button key={image.id} type="button" aria-label={`Tampilkan gambar ${index + 1}`} onClick={() => setActive(index)} className={`h-2 rounded-full transition-all ${index === active ? "w-6 bg-white" : "w-2 bg-white/60"}`} />)}
          </div>
        </>
      )}
    </div>
  );
}

function DigitalProductDetail({ slug }: { slug: string }) {
  const [openingCheckout, setOpeningCheckout] = useState(false);
  const { data: product, isLoading } = useQuery<DigitalProduct>({
    queryKey: ["digital-product", slug],
    queryFn: async () => {
      const response = await fetch(`${apiBase()}/api/digital-products/${encodeURIComponent(slug)}`);
      if (!response.ok) throw new Error("Produk tidak ditemukan");
      return response.json();
    },
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <Link href="/produk-layanan/produk-edukasi/produk-digital" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-green-800"><ArrowLeft size={17} /> Kembali ke Produk Digital</Link>
        {isLoading || !product ? (
          <div className="flex justify-center py-24"><Loader2 className="animate-spin text-green-800" /></div>
        ) : (
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
            <div className="grid items-start lg:grid-cols-2">
              <section className="p-7 sm:p-10">
                <ProductGallery product={product} height="aspect-[4/3]" fit="contain" />
                <a href={checkoutUrl(product)} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-800 px-6 py-3.5 font-bold text-white transition hover:bg-green-900"><ShoppingCart size={19} /> Tambahkan ke Keranjang</a>
                <p className="mt-3 text-center text-xs text-gray-500">Anda akan diminta login atau mendaftar sebelum melanjutkan transaksi.</p>
              </section>
              <section className="flex flex-col border-t border-gray-100 p-7 sm:p-10 lg:border-l lg:border-t-0">
                <span className="mb-3 text-sm font-bold uppercase tracking-widest text-green-700">Produk Digital</span>
                <h1 className="text-3xl font-extrabold leading-tight text-gray-900 lg:text-4xl">{product.name}</h1>
                <div className="mt-4"><ProductPrice product={product} large /></div>
                <p className="mt-6 whitespace-pre-line leading-7 text-gray-600">{product.description}</p>
              </section>
            </div>
          </div>
        )}
      </main>
      {product && <a
        href={checkoutUrl(product)}
        aria-label={`Tambahkan ${product.name} ke keranjang`}
        aria-disabled={openingCheckout}
        onClick={() => setOpeningCheckout(true)}
        className={`fixed bottom-24 right-4 z-[45] inline-flex items-center justify-center gap-2 rounded-full bg-green-800 px-5 py-3.5 text-sm font-extrabold text-white shadow-2xl shadow-green-950/30 ring-2 ring-white transition hover:-translate-y-0.5 hover:bg-green-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-green-300 sm:bottom-28 sm:right-8 sm:px-6 sm:text-base ${openingCheckout ? "pointer-events-none opacity-75" : ""}`}
      >
        {openingCheckout ? <Loader2 className="animate-spin" size={20} /> : <ShoppingCart size={20} />}
        {openingCheckout ? "Membuka Keranjang..." : "Tambahkan ke Keranjang"}
      </a>}
      <Footer />
    </div>
  );
}

export default function DigitalProducts() {
  const [detailMatch, detailParams] = useRoute("/produk-layanan/produk-edukasi/produk-digital/:productSlug");
  const { data: products = [], isLoading } = useQuery<DigitalProduct[]>({
    queryKey: ["digital-products"],
    queryFn: async () => {
      const response = await fetch(`${apiBase()}/api/digital-products`);
      if (!response.ok) throw new Error("Gagal memuat produk digital");
      return response.json();
    },
    enabled: !detailMatch,
  });

  if (detailMatch && detailParams?.productSlug) return <DigitalProductDetail slug={detailParams.productSlug} />;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <header className="bg-gradient-to-br from-green-950 to-green-700 px-4 pb-16 pt-32 text-center text-white">
        <h1 className="text-4xl font-extrabold lg:text-5xl">Produk Digital</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-green-50/85">Modul, e-book, dan materi digital pilihan untuk mendukung pengembangan diri dan keluarga.</p>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex justify-center py-24"><Loader2 className="animate-spin text-green-800" /></div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center text-gray-500 shadow-sm">Katalog produk digital sedang disiapkan.</div>
        ) : (
          <div className="grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <article key={product.id} className="flex overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-lg">
                <div className="flex w-full flex-col">
                  <ProductGallery product={product} />
                  <div className="flex flex-1 flex-col p-6">
                    <h2 className="text-xl font-extrabold text-gray-900">{product.name}</h2>
                    <p className="mt-2 flex-1 text-sm leading-6 text-gray-600">{product.shortDescription}</p>
                    <div className="mt-5"><ProductPrice product={product} /></div>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <Link href={`/produk-layanan/produk-edukasi/produk-digital/${product.slug}`} className="rounded-xl border border-green-800 px-4 py-2.5 text-center text-sm font-bold text-green-800">Detail</Link>
                      <a href={checkoutUrl(product)} className="rounded-xl bg-green-800 px-4 py-2.5 text-center text-sm font-bold text-white">Beli</a>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
