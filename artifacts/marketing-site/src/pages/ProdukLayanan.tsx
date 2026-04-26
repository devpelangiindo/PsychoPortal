import { useRoute } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { SiWhatsapp } from "react-icons/si";

const allServices = [
  {
    slug: "asesmen",
    name: "Asesmen",
    shortDesc: "Layanan psikotes dan asesmen berbasis kode etik dan metode ilmiah yang teruji.",
    longDesc: "Layanan asesmen psikologi komprehensif menggunakan instrumen terstandarisasi dan metode ilmiah. Mencakup asesmen tumbuh kembang anak, asesmen bakat dan minat, asesmen kecerdasan, serta profil kepribadian. Hasil asesmen disajikan dalam laporan tertulis yang lengkap dengan rekomendasi konkret.",
    color: "#2D6A4F",
    bg: "#D8F3DC",
  },
  {
    slug: "konseling",
    name: "Konseling",
    shortDesc: "Konseling profesional untuk individu, keluarga, dan organisasi.",
    longDesc: "Layanan konseling psikologi oleh tenaga profesional bersertifikat. Tersedia untuk anak, remaja, dewasa, pasangan, dan keluarga. Sesi dilakukan secara tatap muka maupun online dengan pendekatan yang disesuaikan kebutuhan klien.",
    color: "#3A7D58",
    bg: "#E5F5EC",
  },
  {
    slug: "terapi",
    name: "Terapi",
    shortDesc: "Program terapi tumbuh kembang yang terstruktur dan tepat sasaran.",
    longDesc: "Program terapi tumbuh kembang untuk anak berkebutuhan khusus (ABK) dan anak dengan tantangan perkembangan. Meliputi terapi wicara, terapi perilaku, terapi sensori integrasi, dan terapi bermain. Dilaksanakan oleh terapis berpengalaman.",
    color: "#52B788",
    bg: "#D8F3DC",
  },
  {
    slug: "pelatihan",
    name: "Pelatihan",
    shortDesc: "Pelatihan profesional untuk tenaga pendidik dan terapis.",
    longDesc: "Workshop dan pelatihan profesional untuk guru, konselor, orang tua, dan tenaga kesehatan. Mencakup pelatihan manajemen perilaku anak, teknik konseling, asesmen psikologi, dan pengembangan diri. Tersedia dalam format tatap muka dan online.",
    color: "#40916C",
    bg: "#D8F3DC",
  },
  {
    slug: "produk-digital",
    name: "Produk Digital",
    shortDesc: "Modul digital dan e-book berkualitas untuk pengembangan diri.",
    longDesc: "Berbagai modul pembelajaran digital, e-book, dan materi pelatihan yang dikembangkan oleh tim ahli Pelangi Indonesia. Dapat digunakan secara mandiri maupun sebagai pendamping sesi konseling/terapi.",
    color: "#1B4332",
    bg: "#D8F3DC",
  },
  {
    slug: "kursus",
    name: "Kursus",
    shortDesc: "Kursus pengembangan minat bakat: musik, tari, olahraga, akademik.",
    longDesc: "Program kursus terstruktur untuk anak dan remaja dalam berbagai bidang: Baca Tulis, Matematika, Bimbingan Belajar Privat, Sempoa, Balet, Taekwondo, Renang, Tari, Musik, Senam, dan Yoga. Kelas kecil (maks. 6 anak) dengan instruktur berpengalaman.",
    color: "#2D6A4F",
    bg: "#E5F5EC",
    highlights: [
      "Baca Tulis — Rp 325.000/bulan (8x pertemuan, maks. 6 anak)",
      "Matematika",
      "Bimbingan Belajar Privat",
      "Sempoa",
      "Balet",
      "Taekwondo",
      "Renang",
      "Tari",
      "Musik",
      "Senam",
      "Yoga",
    ],
  },
  {
    slug: "franchise",
    name: "Franchise",
    shortDesc: "Peluang kemitraan dan franchise untuk memperluas jangkauan layanan.",
    longDesc: "Program franchise Pelangi Indonesia memungkinkan institusi lain untuk mengadopsi sistem layanan psikologi dan pendidikan kami. Termasuk dukungan operasional, pelatihan, dan akses ke materi terstandarisasi.",
    color: "#9A6E5E",
    bg: "#F0E0DA",
  },
  {
    slug: "sekolah",
    name: "Sekolah Pelangi Indonesia",
    shortDesc: "Pendidikan inklusif dengan metode pembelajaran aktif dan inovatif.",
    longDesc: "Sekolah Pelangi Indonesia adalah lembaga pendidikan inklusif yang menerima semua anak termasuk Anak Berkebutuhan Khusus. Kurikulum dirancang dengan metode pembelajaran aktif, inovatif, dan berorientasi pada potensi unik setiap anak.",
    color: "#1B4332",
    bg: "#D8F3DC",
  },
  {
    slug: "horecal",
    name: "HORECAL",
    shortDesc: "Layanan bisnis operasional untuk fasilitas edukasi dan kelembagaan.",
    longDesc: "HORECAL adalah unit usaha pendukung Pelangi Indonesia yang menyediakan layanan bisnis operasional komprehensif untuk mendukung kelancaran fasilitas pendidikan, kesehatan, dan kelembagaan.",
    color: "#9A6E5E",
    bg: "#F0E0DA",
  },
];

function ServiceCard({ service }: { service: typeof allServices[0] }) {
  return (
    <Link
      href={`/produk-layanan/${service.slug}`}
      className="service-card block p-6 bg-white rounded-2xl border border-gray-100 shadow-sm group"
    >
      <div
        className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center text-white text-lg font-bold"
        style={{ background: service.color }}
      >
        {service.name.charAt(0)}
      </div>
      <h3 className="font-bold text-gray-900 mb-2 group-hover:text-green-800 transition-colors text-lg">
        {service.name}
      </h3>
      <p className="text-gray-500 text-sm leading-relaxed mb-4">{service.shortDesc}</p>
      <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: service.color }}>
        Pelajari Selengkapnya <ArrowRight size={12} />
      </div>
    </Link>
  );
}

function ServiceDetail({ service }: { service: typeof allServices[0] }) {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="pt-28 pb-16 text-white" style={{ background: `linear-gradient(135deg, ${service.color}dd, ${service.color})` }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 text-sm text-white/70 mb-8">
            <Link href="/" className="hover:text-white transition-colors">Beranda</Link>
            <ChevronRight size={14} />
            <Link href="/produk-layanan" className="hover:text-white transition-colors">Produk & Layanan</Link>
            <ChevronRight size={14} />
            <span className="text-white">{service.name}</span>
          </nav>
          <h1 className="text-4xl lg:text-5xl font-extrabold mb-4">{service.name}</h1>
          <p className="text-lg text-white/80 max-w-2xl">{service.shortDesc}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-10">
          <div className="md:col-span-2">
            <div className="section-divider" />
            <h2 className="text-2xl font-extrabold mb-5" style={{ color: "#1B4332" }}>Tentang Layanan Ini</h2>
            <p className="text-gray-600 leading-relaxed text-base mb-6">{service.longDesc}</p>

            {service.highlights && (
              <>
                <h3 className="text-lg font-bold mb-3" style={{ color: "#1B4332" }}>Program Tersedia</h3>
                <ul className="space-y-2">
                  {service.highlights.map((h, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: service.color }} />
                      {h}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div>
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm sticky top-24">
              <h3 className="font-bold text-gray-900 mb-4">Tertarik dengan layanan ini?</h3>
              <p className="text-gray-500 text-sm mb-5 leading-relaxed">
                Konsultasikan kebutuhan Anda bersama tim profesional kami.
              </p>
              <a
                href="https://wa.me/62816669533"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md mb-3"
                style={{ background: "#25D366" }}
              >
                <SiWhatsapp size={16} />
                Chat WhatsApp
              </a>
              <a
                href="mailto:info@pi-education.com"
                className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:border-green-300 hover:text-green-800 transition-all"
              >
                Kirim Email
              </a>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default function ProdukLayanan() {
  const [matchDetail, paramsDetail] = useRoute("/produk-layanan/:slug");

  if (matchDetail && paramsDetail?.slug) {
    const service = allServices.find((s) => s.slug === paramsDetail.slug);
    if (service) return <ServiceDetail service={service} />;
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div
        className="pt-32 pb-16 text-center"
        style={{ background: "linear-gradient(135deg, #1B4332, #2D6A4F)" }}
      >
        <h1 className="text-4xl lg:text-5xl font-extrabold text-white mb-4">Produk & Layanan</h1>
        <p className="text-green-100/80 text-lg max-w-2xl mx-auto px-4">
          Beragam layanan psikologi, pendidikan, dan pengembangan kapasitas untuk semua kalangan.
        </p>
      </div>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {allServices.map((s) => (
              <ServiceCard key={s.slug} service={s} />
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
