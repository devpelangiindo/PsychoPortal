import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Package,
  Search,
  ShoppingCart,
} from "lucide-react";
import { Link, useRoute } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getAsesmenPlatformHref } from "@/lib/platform-links";

type Image = { id: number; fileName: string; focusX: number; focusY: number };
type Media = {
  id: number;
  title: string;
  url: string;
  mediaType: string;
  platform: string;
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
  weightGrams: number;
  shippingFee: string;
  images: Image[];
  media: Media[];
};
const apiBase = () =>
  import.meta.env.VITE_ASESMEN_API_URL
    ? String(import.meta.env.VITE_ASESMEN_API_URL).replace(/\/$/, "")
    : window.location.hostname === "localhost"
      ? "http://localhost:5001"
      : "https://asesmen.pi-psychology.com";
const imageUrl = (id: number) =>
  `${apiBase()}/api/physical-products/images/${id}`;
const money = (value: string | number) =>
  `Rp ${new Intl.NumberFormat("id-ID").format(Number(value) || 0)}`;
const checkoutUrl = (p: Product) =>
  `${getAsesmenPlatformHref().replace(/\/$/, "")}/physical-products/checkout?product=${encodeURIComponent(p.slug)}`;

function Price({ product, big = false }: { product: Product; big?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      {product.promoPrice && (
        <span className="text-sm text-gray-400 line-through">
          {money(product.price)}
        </span>
      )}
      <span
        className={`${big ? "text-3xl" : "text-xl"} font-extrabold text-green-800`}
      >
        {money(product.effectivePrice)}
      </span>
      {product.promoPrice && (
        <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-bold text-rose-700">
          PROMO
        </span>
      )}
    </div>
  );
}

function Gallery({
  product,
  detail = false,
}: {
  product: Product;
  detail?: boolean;
}) {
  const [active, setActive] = useState(0);
  const images = product.images || [];
  if (!images.length)
    return (
      <div
        className={`${detail ? "h-[420px]" : "h-56"} flex items-center justify-center bg-green-50 text-green-800`}
      >
        <Package className="mr-2" />
        Produk Fisik
      </div>
    );
  const image = images[active];
  return (
    <div
      className={`relative overflow-hidden bg-gray-100 ${detail ? "h-[420px]" : "h-56"}`}
    >
      <img
        src={imageUrl(image.id)}
        alt={product.name}
        className="h-full w-full object-cover"
        style={{ objectPosition: `${image.focusX}% ${image.focusY}%` }}
      />
      {images.length > 1 && (
        <>
          <button
            aria-label="Foto sebelumnya"
            onClick={() =>
              setActive((active - 1 + images.length) % images.length)
            }
            className="absolute left-3 top-1/2 rounded-full bg-white/90 p-2 shadow"
          >
            <ChevronLeft />
          </button>
          <button
            aria-label="Foto berikutnya"
            onClick={() => setActive((active + 1) % images.length)}
            className="absolute right-3 top-1/2 rounded-full bg-white/90 p-2 shadow"
          >
            <ChevronRight />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
            {active + 1}/{images.length}
          </div>
        </>
      )}
    </div>
  );
}

function Listing() {
  const [search, setSearch] = useState("");
  const { data = [], isLoading } = useQuery<Product[]>({
    queryKey: ["physical-products"],
    queryFn: async () => {
      const r = await fetch(`${apiBase()}/api/physical-products`);
      if (!r.ok) throw new Error();
      return r.json();
    },
  });
  const products = data.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase().trim()),
  );
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#f8faf7]">
        <section className="bg-green-900 px-6 py-20 text-center text-white">
          <p className="mb-3 font-semibold uppercase tracking-[.25em] text-green-200">
            Produk Edukasi
          </p>
          <h1 className="text-4xl font-extrabold md:text-5xl">Produk Fisik</h1>
          <p className="mx-auto mt-4 max-w-2xl text-green-100">
            Perlengkapan edukasi pilihan yang dikirim langsung ke alamat Anda.
          </p>
        </section>
        <section className="mx-auto max-w-7xl px-6 py-14">
          <div className="relative mx-auto mb-10 max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk berdasarkan judul..."
              className="w-full rounded-2xl border bg-white py-4 pl-12 pr-4 shadow-sm outline-none focus:border-green-600"
            />
          </div>
          {isLoading ? (
            <Loader2 className="mx-auto animate-spin text-green-700" />
          ) : products.length ? (
            <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <article
                  key={p.id}
                  className="overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <Gallery product={p} />
                  <div className="p-6">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-gray-500">
                        SKU {p.sku}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-bold ${p.stock > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                      >
                        {p.stock > 0 ? `Stok ${p.stock}` : "Habis"}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {p.name}
                    </h2>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-600">
                      {p.shortDescription}
                    </p>
                    <div className="mt-5">
                      <Price product={p} />
                    </div>
                    <Link
                      href={`/produk-layanan/produk-edukasi/produk-fisik/${p.slug}`}
                      className="mt-6 block rounded-xl bg-green-800 px-5 py-3 text-center font-bold text-white hover:bg-green-900"
                    >
                      Lihat Selengkapnya
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl bg-white p-12 text-center text-gray-500">
              Produk belum tersedia atau tidak ditemukan.
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

function Detail({ slug }: { slug: string }) {
  const { data: p, isLoading } = useQuery<Product>({
    queryKey: ["physical-product", slug],
    queryFn: async () => {
      const r = await fetch(`${apiBase()}/api/physical-products/${slug}`);
      if (!r.ok) throw new Error();
      return r.json();
    },
  });
  if (isLoading)
    return (
      <>
        <Navbar />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="animate-spin text-green-700" />
        </div>
        <Footer />
      </>
    );
  if (!p) return <Listing />;
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#f8faf7] px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/produk-layanan/produk-edukasi/produk-fisik"
            className="mb-8 inline-flex items-center gap-2 font-semibold text-green-800"
          >
            <ArrowLeft size={18} />
            Kembali ke katalog
          </Link>
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
              <Gallery product={p} detail />
            </div>
            <article>
              <div className="mb-4 flex gap-2 text-sm text-gray-500">
                <span>SKU {p.sku}</span>
                <span>•</span>
                <span>
                  {p.weightGrams
                    ? `${p.weightGrams} gram`
                    : "Berat belum dicantumkan"}
                </span>
              </div>
              <h1 className="text-4xl font-extrabold leading-tight text-gray-900">
                {p.name}
              </h1>
              <p className="mt-5 text-lg leading-8 text-gray-600">
                {p.shortDescription}
              </p>
              <div className="mt-7">
                <Price product={p} big />
              </div>
              <div
                className={`mt-5 inline-flex rounded-full px-4 py-2 text-sm font-bold ${p.stock > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}
              >
                {p.stock > 0 ? `Tersedia ${p.stock} unit` : "Stok habis"}
              </div>
            {p.descriptionHtml ? (
              <div
                className="mt-8 prose max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: p.descriptionHtml }}
              />
            ) : (
              <p className="mt-8 whitespace-pre-line leading-7 text-gray-700">
                {p.description}
              </p>
            )}
              {p.media?.length > 0 && (
                <section className="mt-8">
                  <h2 className="text-xl font-bold">Video & Dokumentasi</h2>
                  <div className="mt-3 grid gap-3">
                    {p.media.map((m) => (
                      <a
                        key={m.id}
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-xl border bg-white p-4 font-semibold text-green-800"
                      >
                        {m.title}
                        <ExternalLink size={18} />
                      </a>
                    ))}
                  </div>
                </section>
              )}
            </article>
          </div>
        </div>
      </main>
      {p.stock > 0 && (
        <a
          href={checkoutUrl(p)}
          className="fixed bottom-24 right-5 z-40 flex items-center gap-2 rounded-full bg-green-700 px-6 py-4 font-extrabold text-white shadow-xl hover:bg-green-800"
        >
          <ShoppingCart />
          Beli Sekarang
        </a>
      )}
      <Footer />
    </>
  );
}

export default function PhysicalProducts() {
  const [match, params] = useRoute(
    "/produk-layanan/produk-edukasi/produk-fisik/:productSlug",
  );
  return match ? <Detail slug={params.productSlug} /> : <Listing />;
}
