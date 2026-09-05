import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ClipboardList, Loader2, Search, X } from "lucide-react";
import { Link } from "wouter";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

type Category =
  | "kognitif"
  | "perkembangan"
  | "klinis"
  | "inventori-kepribadian";
type Tool = {
  id: number;
  slug: string;
  category: Category;
  title: string;
  description: string;
  detailText: string;
  resultText: string;
  targetText: string;
  price: string;
  sortOrder: number;
  isActive: boolean;
  hasImage: boolean;
  imageFocusX: number;
  imageFocusY: number;
};

const apiBase = () =>
  import.meta.env.VITE_ASESMEN_API_URL
    ? String(import.meta.env.VITE_ASESMEN_API_URL).replace(/\/$/, "")
    : window.location.hostname === "localhost"
      ? "http://localhost:5001"
      : "https://asesmen.pi-psychology.com";

const categories: Array<{ value: "all" | Category; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "kognitif", label: "Kognitif" },
  { value: "perkembangan", label: "Perkembangan" },
  { value: "klinis", label: "Klinis" },
  { value: "inventori-kepribadian", label: "Inventori Kepribadian" },
];
const categoryLabel = (value: Category) =>
  categories.find((item) => item.value === value)?.label ?? value;
const money = (value: string | number) =>
  `Rp ${new Intl.NumberFormat("id-ID").format(Number(value) || 0)}`;
const lines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
const whatsappHref = (title: string) =>
  `https://wa.me/6285117658242?text=${encodeURIComponent(`Halo PI, saya ingin mendapatkan informasi dan membeli Alat Tes Psikologi: ${title}.`)}`;

export default function PsychologyTestTools() {
  const [category, setCategory] = useState<"all" | Category>("all");
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState<Tool | null>(null);
  const { data: tools = [], isLoading } = useQuery<Tool[]>({
    queryKey: ["psychology-test-tools"],
    queryFn: async () => {
      const response = await fetch(`${apiBase()}/api/psychology-test-tools`);
      if (!response.ok) throw new Error("Katalog alat tes tidak dapat dimuat");
      return response.json();
    },
  });
  const filtered = useMemo(() => {
    const query = keyword.trim().toLocaleLowerCase("id-ID");
    return tools.filter(
      (tool) =>
        (category === "all" || tool.category === category) &&
        (!query || tool.title.toLocaleLowerCase("id-ID").includes(query)),
    );
  }, [tools, category, keyword]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <header className="bg-gradient-to-br from-green-950 via-green-900 to-green-700 px-4 pb-16 pt-32 text-white">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/produk-layanan/produk-edukasi"
            className="inline-flex items-center gap-2 text-sm font-semibold text-green-100"
          >
            <ArrowLeft size={17} /> Kembali ke Produk Edukasi
          </Link>
          <p className="mt-9 text-sm font-bold uppercase tracking-[0.2em] text-green-200">
            Produk Edukasi
          </p>
          <h1 className="mt-3 text-4xl font-extrabold lg:text-5xl">
            Alat Tes Psikologi
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-green-50/85">
            Instrumen psikologi untuk kebutuhan kognitif, perkembangan, klinis,
            dan inventori kepribadian.
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {categories.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setCategory(item.value)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${category === item.value ? "bg-green-800 text-white" : "bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-green-500"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="flex min-w-0 items-center gap-2 rounded-xl bg-white px-4 py-3 ring-1 ring-gray-200 lg:w-80">
            <Search size={18} className="text-gray-400" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Cari judul alat tes"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-green-800" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl bg-white px-6 py-20 text-center ring-1 ring-black/5">
            <ClipboardList className="mx-auto h-12 w-12 text-green-700" />
            <h2 className="mt-4 text-xl font-extrabold text-gray-900">
              Belum ada alat tes pada kategori ini
            </h2>
            <p className="mt-2 text-gray-600">
              Katalog akan tampil setelah ditambahkan melalui dashboard admin.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((tool) => (
              <article
                key={tool.id}
                className="flex overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="flex w-full flex-col">
                  <div className="aspect-[4/3] overflow-hidden bg-green-50">
                    {tool.hasImage ? (
                      <img
                        src={`${apiBase()}/api/psychology-test-tools/${tool.id}/image`}
                        alt={tool.title}
                        className="h-full w-full object-cover"
                        style={{
                          objectPosition: `${tool.imageFocusX}% ${tool.imageFocusY}%`,
                        }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ClipboardList className="h-14 w-14 text-green-700" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-green-700">
                      {categoryLabel(tool.category)}
                    </p>
                    <h2 className="mt-2 text-xl font-extrabold text-gray-900">
                      {tool.title}
                    </h2>
                    <p className="mt-3 line-clamp-4 flex-1 text-sm leading-6 text-gray-600">
                      {tool.description}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelected(tool)}
                      className="mt-3 self-start text-sm font-bold text-green-800 hover:underline"
                    >
                      Lihat Selengkapnya
                    </button>
                    <p className="mt-5 text-xl font-extrabold text-green-800">
                      {money(tool.price)}
                    </p>
                    <a
                      href={whatsappHref(tool.title)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 rounded-xl bg-green-800 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-green-900"
                    >
                      Beli Sekarang
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      <Footer />
      {selected && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="tool-title"
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-9"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-green-700">
                  {categoryLabel(selected.category)}
                </p>
                <h2
                  id="tool-title"
                  className="mt-2 text-2xl font-extrabold text-gray-900 sm:text-3xl"
                >
                  {selected.title}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Tutup detail"
                onClick={() => setSelected(null)}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
              >
                <X />
              </button>
            </div>
            <div className="mt-7 space-y-7 text-gray-700">
              <div>
                <h3 className="font-extrabold text-gray-900">Deskripsi Tes</h3>
                <p className="mt-2 whitespace-pre-line leading-7">
                  {selected.detailText}
                </p>
              </div>
              {lines(selected.resultText).length > 0 && (
                <div>
                  <h3 className="font-extrabold text-gray-900">
                    Hasil yang Diperoleh
                  </h3>
                  <ul className="mt-2 list-disc space-y-2 pl-5">
                    {lines(selected.resultText).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}
              {lines(selected.targetText).length > 0 && (
                <div>
                  <h3 className="font-extrabold text-gray-900">Sasaran Tes</h3>
                  <ul className="mt-2 list-disc space-y-2 pl-5">
                    {lines(selected.targetText).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-gray-500">Harga</p>
                <p className="mt-1 text-2xl font-extrabold text-green-800">
                  {money(selected.price)}
                </p>
              </div>
            </div>
            <a
              href={whatsappHref(selected.title)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 block rounded-xl bg-green-800 px-5 py-3.5 text-center font-bold text-white hover:bg-green-900"
            >
              Hubungi Admin
            </a>
          </section>
        </div>
      )}
    </div>
  );
}
