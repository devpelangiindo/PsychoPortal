import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Loader2, PlayCircle, Search, ShoppingCart, X } from "lucide-react";
import { Link, useRoute } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getAsesmenPlatformHref } from "@/lib/platform-links";

type ProductImage = { id: number; fileName: string; sortOrder: number; focusX: number; focusY: number };
type ProductMedia = { id: number; title: string; url: string; mediaType: "video" | "documentation"; platform: string; sortOrder: number; isActive: boolean };
type DigitalProduct = {
  id: number;
  category: "digital" | "elearning";
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  descriptionHtml?: string | null;
  price: string;
  promoPrice: string | null;
  effectivePrice: string;
  images: ProductImage[];
  media?: ProductMedia[];
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
  return `${base}/digital-products/checkout?product=${encodeURIComponent(product.slug)}&category=${product.category}`;
}

function youtubeEmbedUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    let videoId = "";
    if (hostname === "youtu.be") videoId = url.pathname.split("/").filter(Boolean)[0] || "";
    if (hostname.endsWith("youtube.com")) {
      videoId = url.searchParams.get("v") || "";
      if (!videoId) {
        const parts = url.pathname.split("/").filter(Boolean);
        if (["shorts", "embed", "live"].includes(parts[0])) videoId = parts[1] || "";
      }
    }
    return /^[a-zA-Z0-9_-]{6,20}$/.test(videoId) ? `https://www.youtube-nocookie.com/embed/${videoId}` : null;
  } catch {
    return null;
  }
}

function platformLabel(platform: string) {
  const labels: Record<string, string> = { youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", vimeo: "Vimeo", x: "X", linkedin: "LinkedIn" };
  return labels[platform] || "Media sosial";
}

function ProductGallery({ product, height = "h-56", fit = "cover" }: { product: DigitalProduct; height?: string; fit?: "cover" | "contain" }) {
  const [active, setActive] = useState(0);
  const images = product.images ?? [];
  const move = (direction: number) => setActive((current) => (current + direction + images.length) % images.length);

  if (!images.length) {
    return <div className={`${height} flex items-center justify-center bg-green-50 text-green-800 font-semibold`}>{product.category === "elearning" ? "Video E-Learning" : "Produk Digital"}</div>;
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

function DigitalProductDetail({ slug, elearning }: { slug: string; elearning: boolean }) {
  const title = elearning ? "Video E-Learning" : "Produk Digital";
  const category = elearning ? "elearning" : "digital";
  const basePath = `/produk-layanan/produk-edukasi/${elearning ? "video-e-learning" : "produk-digital"}`;
  const [openingCheckout, setOpeningCheckout] = useState(false);
  const { data: product, isLoading } = useQuery<DigitalProduct>({
    queryKey: ["digital-product", category, slug],
    queryFn: async () => {
      const response = await fetch(`${apiBase()}/api/digital-products/${encodeURIComponent(slug)}?category=${category}`);
      if (!response.ok) throw new Error("Produk tidak ditemukan");
      return response.json();
    },
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <Link href={basePath} className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-green-800"><ArrowLeft size={17} /> Kembali ke {title}</Link>
        {isLoading ? (
          <div className="flex justify-center py-24"><Loader2 className="animate-spin text-green-800" /></div>
        ) : !product ? (
          <p role="alert" className="rounded-2xl bg-white p-10 text-center text-gray-600">Produk tidak ditemukan atau belum dapat dimuat. Silakan kembali ke katalog.</p>
        ) : (
          <div className="space-y-8">
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
              <div className="grid items-start lg:grid-cols-2">
                <section className="p-7 sm:p-10">
                  <ProductGallery product={product} height="aspect-[4/3]" fit="contain" />
                  <p className="mt-4 text-center text-xs text-gray-500">Anda akan diminta login atau mendaftar sebelum melanjutkan transaksi.</p>
                </section>
                <section className="flex flex-col border-t border-gray-100 p-7 sm:p-10 lg:border-l lg:border-t-0">
                  <span className="mb-3 text-sm font-bold uppercase tracking-widest text-green-700">{title}</span>
                  <h1 className="text-3xl font-extrabold leading-tight text-gray-900 lg:text-4xl">{product.name}</h1>
                  <div className="mt-4"><ProductPrice product={product} large /></div>
                  {product.descriptionHtml
                    ? <div className="prose mt-6 max-w-none leading-7 text-gray-600 prose-headings:text-gray-900 prose-a:text-green-800" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
                    : <p className="mt-6 whitespace-pre-line leading-7 text-gray-600">{product.description}</p>}
                </section>
              </div>
            </div>
            {(product.media ?? []).some((media) => media.isActive) && <section className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-black/5 sm:p-10">
              <div className="mb-6"><p className="text-sm font-bold uppercase tracking-widest text-green-700">Media Eksternal</p><h2 className="mt-2 text-2xl font-extrabold text-gray-900 sm:text-3xl">Video & Dokumentasi</h2></div>
              <div className="grid gap-5 md:grid-cols-2">{(product.media ?? []).filter((media) => media.isActive).map((media) => {
                const embedUrl = media.platform === "youtube" && media.mediaType === "video" ? youtubeEmbedUrl(media.url) : null;
                return embedUrl ? <article key={media.id} className="overflow-hidden rounded-2xl border bg-gray-50">
                  <div className="aspect-video bg-black"><iframe className="h-full w-full" src={embedUrl} title={media.title} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>
                  <div className="p-4"><p className="text-xs font-bold uppercase tracking-wide text-green-700">YouTube</p><h3 className="mt-1 font-bold text-gray-900">{media.title}</h3></div>
                </article> : <a key={media.id} href={media.url} target="_blank" rel="noopener noreferrer" className="group flex min-h-36 items-center gap-4 rounded-2xl border bg-gradient-to-br from-green-50 to-white p-5 transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-md">
                  <span className="rounded-full bg-green-800 p-3 text-white"><PlayCircle className="h-6 w-6" /></span><span className="min-w-0 flex-1"><span className="text-xs font-bold uppercase tracking-wide text-green-700">{platformLabel(media.platform)} · {media.mediaType === "video" ? "Video" : "Dokumentasi"}</span><span className="mt-1 block font-bold text-gray-900">{media.title}</span><span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-green-800">Buka media <ExternalLink className="h-4 w-4" /></span></span>
                </a>;
              })}</div>
            </section>}
          </div>
        )}
      </main>
      {product && <a
        href={checkoutUrl(product)}
        aria-label={`Beli ${product.name} sekarang`}
        aria-disabled={openingCheckout}
        onClick={() => setOpeningCheckout(true)}
        className={`fixed bottom-24 right-4 z-[45] inline-flex items-center justify-center gap-2 rounded-full bg-green-800 px-5 py-3.5 text-sm font-extrabold text-white shadow-2xl shadow-green-950/30 ring-2 ring-white transition hover:-translate-y-0.5 hover:bg-green-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-green-300 sm:bottom-28 sm:right-8 sm:px-6 sm:text-base ${openingCheckout ? "pointer-events-none opacity-75" : ""}`}
      >
        {openingCheckout ? <Loader2 className="animate-spin" size={20} /> : <ShoppingCart size={20} />}
        {openingCheckout ? "Membuka Pembelian..." : "Beli Sekarang"}
      </a>}
      <Footer />
    </div>
  );
}

export default function DigitalProducts({ elearning = false }: { elearning?: boolean }) {
  const title = elearning ? "Video E-Learning" : "Produk Digital";
  const category = elearning ? "elearning" : "digital";
  const basePath = `/produk-layanan/produk-edukasi/${elearning ? "video-e-learning" : "produk-digital"}`;
  const [detailMatch, detailParams] = useRoute(`${basePath}/:productSlug`);
  const [searchKeyword, setSearchKeyword] = useState("");
  const { data: products = [], isLoading, isError, refetch } = useQuery<DigitalProduct[]>({
    queryKey: ["digital-products", category],
    queryFn: async () => {
      const response = await fetch(`${apiBase()}/api/digital-products?category=${category}`);
      if (!response.ok) throw new Error("Gagal memuat produk digital");
      return response.json();
    },
    enabled: !detailMatch,
  });
  const normalizedKeyword = searchKeyword.trim().toLocaleLowerCase("id-ID");
  const filteredProducts = normalizedKeyword
    ? products.filter(product => product.name.toLocaleLowerCase("id-ID").includes(normalizedKeyword))
    : products;

  if (detailMatch && detailParams?.productSlug) return <DigitalProductDetail key={`${category}:${detailParams.productSlug}`} slug={detailParams.productSlug} elearning={elearning} />;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <header className="bg-gradient-to-br from-green-950 to-green-700 px-4 pb-16 pt-32 text-center text-white">
        <p className="mb-3 font-semibold uppercase tracking-[.25em] text-green-200">Produk Edukasi</p>
        <h1 className="text-4xl font-extrabold lg:text-5xl">{title}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-green-50/85">{elearning ? "Fasilitas belajar mandiri melalui koleksi rekaman pelatihan psikologi dan pengembangan diri yang komprehensif, aplikatif, dan mudah diakses." : "Modul, e-book, dan materi digital pilihan untuk mendukung pengembangan diri dan keluarga."}</p>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto mb-10 max-w-2xl">
          <label htmlFor="digital-product-search" className="mb-2 block text-sm font-bold text-gray-800">Cari produk berdasarkan judul</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              id="digital-product-search"
              type="search"
              value={searchKeyword}
              onChange={event => setSearchKeyword(event.target.value)}
              placeholder="Masukkan judul produk..."
              className="h-14 w-full rounded-2xl border border-gray-200 bg-white py-3.5 pl-12 pr-12 text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-green-600 focus:ring-4 focus:ring-green-100"
            />
            {searchKeyword && <button type="button" aria-label="Hapus pencarian" onClick={() => setSearchKeyword("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"><X size={18} /></button>}
          </div>
          {normalizedKeyword && <p className="mt-3 text-sm text-gray-500">{filteredProducts.length} produk ditemukan untuk “{searchKeyword.trim()}”.</p>}
        </div>
        {isLoading ? (
          <div className="flex justify-center py-24"><Loader2 className="animate-spin text-green-800" /></div>
        ) : isError ? (
          <div role="alert" className="rounded-2xl bg-white p-12 text-center text-gray-600">Katalog belum dapat dimuat.<button type="button" onClick={() => void refetch()} className="ml-2 font-bold text-green-800 underline">Coba lagi</button></div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center text-gray-500 shadow-sm">Katalog {title.toLowerCase()} sedang disiapkan.</div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow-sm"><Search className="mx-auto h-10 w-10 text-gray-300" /><h2 className="mt-4 text-lg font-bold text-gray-800">Produk tidak ditemukan</h2><p className="mt-2 text-sm text-gray-500">Coba gunakan keyword judul yang berbeda.</p><button type="button" onClick={() => setSearchKeyword("")} className="mt-5 rounded-xl bg-green-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-900">Tampilkan Semua Produk</button></div>
        ) : (
          <div className="grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <article key={product.id} className="flex overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-lg">
                <div className="flex w-full flex-col">
                  <ProductGallery product={product} />
                  <div className="flex flex-1 flex-col p-6">
                    <h2 className="text-xl font-extrabold text-gray-900">{product.name}</h2>
                    <p className="mt-2 flex-1 text-sm leading-6 text-gray-600">{product.shortDescription}</p>
                    <div className="mt-5"><ProductPrice product={product} /></div>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <Link href={`${basePath}/${product.slug}`} className="rounded-xl border border-green-800 px-4 py-2.5 text-center text-sm font-bold text-green-800">Detail</Link>
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
