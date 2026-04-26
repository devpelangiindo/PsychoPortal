import { useState } from "react";
import { Link, useRoute } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Search, Calendar, ChevronRight, ArrowRight } from "lucide-react";

const articles = [
  {
    slug: "memahami-asesmen-psikologi-anak",
    title: "Memahami Asesmen Psikologi pada Anak: Panduan untuk Orang Tua",
    excerpt: "Asesmen psikologi anak adalah proses evaluasi komprehensif yang bertujuan untuk memahami potensi, kebutuhan, dan tantangan yang dihadapi anak. Artikel ini memandu orang tua memahami prosesnya.",
    date: "15 April 2026",
    category: "Psikologi Anak",
    readTime: "5 menit",
    color: "#2D6A4F",
  },
  {
    slug: "pentingnya-konseling-keluarga",
    title: "Pentingnya Konseling Keluarga dalam Mendukung Tumbuh Kembang Anak",
    excerpt: "Keluarga adalah fondasi utama perkembangan anak. Konseling keluarga membantu menciptakan lingkungan yang sehat, komunikatif, dan penuh dukungan untuk anak bertumbuh optimal.",
    date: "10 April 2026",
    category: "Konseling",
    readTime: "7 menit",
    color: "#3A7D58",
  },
  {
    slug: "terapi-sensori-integrasi",
    title: "Terapi Sensori Integrasi: Membantu Anak dengan Gangguan Pemrosesan Sensorik",
    excerpt: "Gangguan pemrosesan sensorik dapat berdampak besar pada kehidupan sehari-hari anak. Terapi sensori integrasi adalah pendekatan berbasis bukti yang membantu anak mengelola sensitivitas mereka.",
    date: "5 April 2026",
    category: "Terapi",
    readTime: "6 menit",
    color: "#52B788",
  },
  {
    slug: "tips-belajar-efektif-anak",
    title: "5 Strategi Belajar Efektif untuk Anak di Rumah",
    excerpt: "Membantu anak belajar di rumah tidak harus membuat stres. Berikut lima strategi berbasis bukti ilmiah yang terbukti meningkatkan efektivitas belajar anak secara mandiri.",
    date: "28 Maret 2026",
    category: "Edukasi",
    readTime: "4 menit",
    color: "#40916C",
  },
  {
    slug: "mengenali-gejala-kecemasan-anak",
    title: "Mengenali Gejala Kecemasan pada Anak: Kapan Harus Mencari Bantuan?",
    excerpt: "Kecemasan adalah respons normal, tetapi kecemasan berlebihan pada anak dapat mengganggu perkembangan. Pelajari tanda-tanda yang perlu diwaspadai dan langkah yang tepat.",
    date: "20 Maret 2026",
    category: "Kesehatan Mental",
    readTime: "8 menit",
    color: "#1B4332",
  },
  {
    slug: "manfaat-pelatihan-profesional-guru",
    title: "Mengapa Pelatihan Berkelanjutan Penting bagi Guru dan Konselor Sekolah",
    excerpt: "Dunia pendidikan terus berkembang. Pelatihan profesional berkelanjutan bukan sekadar kewajiban — ini adalah investasi nyata untuk kualitas layanan kepada siswa dan keluarga.",
    date: "12 Maret 2026",
    category: "Pelatihan",
    readTime: "5 menit",
    color: "#9A6E5E",
  },
];

const promos = [
  { title: "Konsultasi Awal Gratis", desc: "Jadwalkan sesi konsultasi pertama Anda tanpa biaya." },
  { title: "Workshop April 2026", desc: "Pelatihan Manajemen Perilaku Anak — Daftar sekarang!" },
  { title: "Paket Asesmen Lengkap", desc: "Dapatkan laporan komprehensif dengan rekomendasi terapi." },
];

function PromoSidebar() {
  return (
    <div className="space-y-4">
      <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Promo & Info</h3>
      {promos.map((p, i) => (
        <div key={i} className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
          <h4 className="font-semibold text-sm mb-1" style={{ color: "#2D6A4F" }}>{p.title}</h4>
          <p className="text-xs text-gray-500 mb-2">{p.desc}</p>
          <a
            href="https://wa.me/62816669533"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold flex items-center gap-1"
            style={{ color: "#2D6A4F" }}
          >
            Info lebih lanjut <ArrowRight size={10} />
          </a>
        </div>
      ))}
    </div>
  );
}

function ArticleDetail({ article }: { article: typeof articles[0] }) {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <div className="pt-28 pb-12 text-white" style={{ background: `linear-gradient(135deg, ${article.color}cc, ${article.color})` }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 text-sm text-white/70 mb-6">
            <Link href="/" className="hover:text-white transition-colors">Beranda</Link>
            <ChevronRight size={14} />
            <Link href="/artikel" className="hover:text-white transition-colors">Artikel</Link>
            <ChevronRight size={14} />
            <span className="text-white line-clamp-1">{article.title}</span>
          </nav>
          <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-white/20 mb-4">
            {article.category}
          </div>
          <h1 className="text-3xl lg:text-4xl font-extrabold mb-4 max-w-3xl leading-tight">
            {article.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-white/70">
            <span className="flex items-center gap-1.5"><Calendar size={14} />{article.date}</span>
            <span>{article.readTime} baca</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            {/* Article image placeholder */}
            <div
              className="w-full h-64 rounded-2xl mb-8 flex items-center justify-center"
              style={{ background: `${article.color}22` }}
            >
              <span className="text-sm font-medium" style={{ color: article.color }}>Foto Artikel</span>
            </div>

            <div className="prose prose-lg max-w-none text-gray-600 space-y-4">
              <p className="text-lg font-medium text-gray-800 leading-relaxed">{article.excerpt}</p>
              <p>
                Dalam dunia layanan psikologi dan pendidikan, pendekatan yang tepat dapat membuat perbedaan yang signifikan bagi perkembangan individu. Di Pelangi Indonesia Group, kami berkomitmen untuk menghadirkan layanan yang tidak hanya berbasis bukti ilmiah, tetapi juga sensitif terhadap keunikan setiap individu dan konteks budaya lokal.
              </p>
              <p>
                Pendekatan holistik kami mencakup dimensi kognitif, afektif, dan psikomotorik — tiga aspek fundamental dalam perkembangan manusia yang saling berkaitan dan mempengaruhi satu sama lain. Dengan memahami keterkaitan ini, intervensi yang kami berikan menjadi lebih tepat sasaran dan efektif.
              </p>
              <p>
                Tim profesional kami terdiri dari psikolog klinis, konselor pendidikan, terapis tumbuh kembang, dan educator berpengalaman yang terus memperbarui kompetensi mereka melalui pelatihan dan supervisi berkala.
              </p>
              <h2 className="text-xl font-bold mt-8 mb-3" style={{ color: "#1B4332" }}>Langkah Awal yang Tepat</h2>
              <p>
                Jika Anda atau anggota keluarga membutuhkan layanan psikologi atau pendidikan, langkah pertama adalah berkonsultasi dengan tim kami. Konsultasi awal membantu kami memahami kebutuhan spesifik Anda dan merekomendasikan layanan yang paling sesuai.
              </p>
              <p>
                Jangan ragu untuk menghubungi kami melalui WhatsApp atau email. Tim kami siap merespons dengan cepat dan ramah.
              </p>
            </div>
          </div>

          <div>
            <div className="sticky top-24">
              <PromoSidebar />
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default function Artikel() {
  const [matchDetail, paramsDetail] = useRoute("/artikel/:slug");
  const [search, setSearch] = useState("");

  if (matchDetail && paramsDetail?.slug) {
    const article = articles.find((a) => a.slug === paramsDetail.slug);
    if (article) return <ArticleDetail article={article} />;
  }

  const filtered = articles.filter(
    (a) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div
        className="pt-32 pb-16 text-center"
        style={{ background: "linear-gradient(135deg, #1B4332, #2D6A4F)" }}
      >
        <h1 className="text-4xl lg:text-5xl font-extrabold text-white mb-4">Artikel</h1>
        <p className="text-green-100/80 text-lg max-w-2xl mx-auto px-4 mb-8">
          Wawasan, tips, dan panduan dari para profesional Pelangi Indonesia Group.
        </p>
        {/* Search bar */}
        <div className="relative max-w-xl mx-auto px-4">
          <Search size={18} className="absolute left-7 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari artikel..."
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white text-gray-900 text-sm shadow-sm outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
      </div>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2">
              {filtered.length === 0 ? (
                <p className="text-gray-500 py-10 text-center">Tidak ada artikel yang ditemukan.</p>
              ) : (
                <div className="space-y-6">
                  {filtered.map((a) => (
                    <Link
                      key={a.slug}
                      href={`/artikel/${a.slug}`}
                      className="flex gap-5 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group"
                    >
                      <div
                        className="w-28 h-24 shrink-0 rounded-xl flex items-center justify-center text-white text-xs font-medium"
                        style={{ background: `${a.color}cc` }}
                      >
                        Foto
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: `${a.color}20`, color: a.color }}
                          >
                            {a.category}
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Calendar size={11} />{a.date}
                          </span>
                        </div>
                        <h2 className="font-bold text-gray-900 text-base mb-2 leading-tight group-hover:text-green-800 transition-colors line-clamp-2">
                          {a.title}
                        </h2>
                        <p className="text-gray-500 text-sm leading-relaxed line-clamp-2">{a.excerpt}</p>
                        <div className="mt-3 text-xs font-semibold flex items-center gap-1" style={{ color: a.color }}>
                          Lihat selengkapnya... <ArrowRight size={11} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="sticky top-24">
                <PromoSidebar />
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
