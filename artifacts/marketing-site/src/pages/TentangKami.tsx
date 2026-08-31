import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Star, BookOpen, Users, Brain, Award, Leaf } from "lucide-react";

const logoPhilosophy = [
  {
    number: "01",
    title: "Lingkaran — The Circle of Life",
    text: "Bentuk lingkaran yang tidak terputus melambangkan kesatuan, keutuhan, dan perlindungan. Merepresentasikan ekosistem Pelangi Indonesia yang holistik, terintegrasi, dan merangkul semua individu tanpa batas.",
    icon: Users,
  },
  {
    number: "02",
    title: "Lingkaran Hijau — The Green Rings",
    text: "Hijau Tua: melambangkan stabilitas, kedewasaan, dan kredibilitas institusi. Hijau Muda: melambangkan kesegaran, inovasi, vitalitas, dan harapan baru untuk terus bertumbuh.",
    icon: Leaf,
  },
  {
    number: "03",
    title: "Buku Terbuka — The Open Book",
    text: "Buku adalah simbol ilmu pengetahuan, literasi, dan edukasi. Pelangi Indonesia selalu bergerak berdasarkan ilmu pengetahuan, metode ilmiah yang teruji, dan pembelajaran yang berkelanjutan.",
    icon: BookOpen,
  },
  {
    number: "04",
    title: "Pohon Kehidupan & Siluet Manusia",
    text: "Batang pohon membentuk siluet tiga manusia yang saling bertaut — melambangkan sinergi Anak, Orang Tua, dan Terapis/Pendidik. Pertumbuhan dari akar ilmu, meraih potensi tertinggi.",
    icon: Users,
  },
  {
    number: "05",
    title: "Pelangi yang Berjalin — The Interlocking Rainbow",
    text: "Garis pelangi yang saling melengkapi melambangkan neurodiversitas dan keunikan setiap individu — terutama Anak Berkebutuhan Khusus. Biru: ketenangan & logika. Kuning/Jingga: kehangatan & kreativitas.",
    icon: Brain,
  },
  {
    number: "06",
    title: "Tiga Bintang Emas — The Three Gold Stars",
    text: "Melambangkan masa depan yang cerah dan pencapaian dalam tiga aspek: Kognitif (Pikiran), Afektif (Emosi/Jiwa), dan Psikomotorik (Fisik/Tindakan).",
    icon: Star,
  },
  {
    number: "07",
    title: "Tipografi & Tagline: \"Bergerak, Berdampak\"",
    text: "Call-to-action dan janji bahwa Pelangi Indonesia tidak hanya pasif berteori, tetapi terus melakukan pergerakan nyata yang memberikan dampak perubahan positif bagi masyarakat luas.",
    icon: Award,
  },
];

const missions = [
  "Menyediakan layanan psikotes, asesmen, dan konseling berbasis kode etik dan metode ilmiah yang teruji.",
  "Menyediakan layanan pendidikan dengan metode pembelajaran aktif, inovatif, dan inklusif.",
  "Menyelenggarakan program terapi tumbuh kembang dan kursus pengembangan minat bakat yang terstruktur, tepat sasaran, aplikatif, dan adaptif.",
  "Memfasilitasi edukasi masyarakat melalui pelatihan profesional dan penyediaan produk digital berkualitas.",
  "Membangun jaringan kemitraan strategis untuk memperluas jangkauan layanan secara nasional.",
  "Menghadirkan layanan bisnis operasional yang unggul guna menunjang kelancaran fasilitas edukasi dan kegiatan kelembagaan.",
];

export default function TentangKami() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Page header */}
      <div
        className="pt-32 pb-16 text-center"
        style={{ background: "linear-gradient(135deg, #1B4332, #2D6A4F)" }}
      >
        <h1 className="text-4xl lg:text-5xl font-extrabold text-white mb-4">Tentang Kami</h1>
        <p className="text-green-100/80 text-lg max-w-2xl mx-auto px-4">
          Mengenal lebih dekat Pelangi Indonesia Group dan nilai-nilai yang mendasari setiap langkah kami.
        </p>
      </div>

      {/* Sejarah */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid items-start gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
            <div className="space-y-8">
              <figure className="relative">
                <div className="aspect-video overflow-hidden rounded-3xl bg-green-50 shadow-lg ring-1 ring-black/5">
                  <img
                    src="/tentang-kami/gedung-rppi.png"
                    alt="Gedung Pelangi Indonesia"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div
                  className="absolute -bottom-4 -left-4 -z-10 h-24 w-24 rounded-3xl"
                  style={{ background: "#D8F3DC" }}
                />
                <figcaption className="mt-4 text-center text-sm text-gray-500">
                  Gedung Pelangi Indonesia
                </figcaption>
              </figure>

              <figure>
                <div className="aspect-[4/3] overflow-hidden rounded-3xl bg-green-50 shadow-lg ring-1 ring-black/5">
                  <img
                    src="/tentang-kami/sekolah-pelangi-indonesia.png"
                    alt="Sekolah Pelangi Indonesia"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <figcaption className="mt-4 text-center text-sm text-gray-500">
                  Sekolah Pelangi Indonesia
                </figcaption>
              </figure>
            </div>

            <div>
              <div className="section-divider" />
              <h2 className="text-3xl font-extrabold mb-6" style={{ color: "#1B4332" }}>Sejarah Kami</h2>
              <div className="prose prose-lg max-w-none text-gray-600 space-y-4">
                <p>
                  Pelangi Indonesia Group adalah ekosistem layanan terpadu yang mendedikasikan diri pada optimalisasi kualitas sumber daya manusia secara holistik. Perjalanan kami dimulai dari sebuah visi luhur untuk menyediakan fasilitas kesehatan mental dan tumbuh kembang yang aman dan inklusif.
                </p>
                <p>
                  Bermula dari pendirian Rumah Psikologi dan Sekolah Pelangi Indonesia, komitmen kami untuk terus menghadirkan intervensi psikologis dan edukasi yang teruji mendapat respons positif dari masyarakat luas.
                </p>
                <p>
                  Seiring meningkatnya kebutuhan akan tenaga pendidik dan terapis yang kompeten di tingkat nasional, kami memperluas jangkauan melalui program pelatihan profesional dan penyediaan modul digital. Untuk menopang ekosistem yang semakin masif serta memfasilitasi kebutuhan mitra dan klien, kami mendirikan unit usaha pendukung Hospitality Services.
                </p>
                <p>
                  Kini, seluruh layanan tersebut bersatu di bawah naungan Pelangi Indonesia Group, bergerak selaras menciptakan dampak nyata dari hulu ke hilir.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Visi & Misi */}
      <section className="py-20" style={{ background: "#F7FAF8" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <div className="section-divider" />
              <h2 className="text-3xl font-extrabold mb-6" style={{ color: "#1B4332" }}>Visi</h2>
              <div
                className="rounded-2xl p-8 text-white"
                style={{ background: "linear-gradient(135deg, #1B4332, #2D6A4F)" }}
              >
                <Star size={32} className="text-yellow-300 mb-4" />
                <p className="text-lg text-green-100 leading-relaxed italic font-serif">
                  "Menjadi ekosistem layanan psikologi, pendidikan, dan pengembangan sumber daya manusia yang komprehensif dan terpercaya di Indonesia guna mewujudkan <strong className="text-white not-italic">'Jiwa Tumbuh, Indonesia Tangguh.'</strong>"
                </p>
              </div>
            </div>

            <div>
              <div className="section-divider" />
              <h2 className="text-3xl font-extrabold mb-6" style={{ color: "#1B4332" }}>Misi</h2>
              <ol className="space-y-4">
                {missions.map((m, i) => (
                  <li key={i} className="flex gap-3">
                    <span
                      className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5"
                      style={{ background: "#2D6A4F" }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-gray-600 text-sm leading-relaxed">{m}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Filosofi Logo */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="section-divider mx-auto" />
            <h2 className="text-3xl lg:text-4xl font-extrabold" style={{ color: "#1B4332" }}>
              Filosofi Logo
            </h2>
            <p className="text-gray-500 mt-3 max-w-2xl mx-auto">
              Setiap elemen logo Pelangi Indonesia Group menyimpan makna mendalam tentang nilai, visi, dan komitmen kami.
            </p>
          </div>

          <div className="grid items-start gap-10 lg:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.75fr)] lg:gap-12">
            <figure className="lg:sticky lg:top-28">
              <div className="flex min-h-[400px] items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-green-50 via-white to-amber-50 p-6 shadow-sm ring-1 ring-black/5">
                <img
                  src="/tentang-kami/logo-pi-group.png"
                  alt="Logo Pelangi Indonesia Group"
                  className="h-auto w-full max-w-[360px] object-contain"
                  loading="lazy"
                />
              </div>
              <figcaption className="mt-4 text-center text-sm font-medium text-gray-500">
                Logo Pelangi Indonesia Group
              </figcaption>
            </figure>

            <div className="grid gap-6 md:grid-cols-2">
              {logoPhilosophy.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.number} className="flex gap-5 rounded-2xl border border-gray-100 bg-white p-6 transition-shadow hover:shadow-md">
                    <div>
                      <span
                        className="mb-2 inline-block rounded-full px-2 py-0.5 text-xs font-bold"
                        style={{ background: "#D8F3DC", color: "#2D6A4F" }}
                      >
                        {item.number}
                      </span>
                      <h3 className="mb-2 text-sm font-bold" style={{ color: "#1B4332" }}>{item.title}</h3>
                      <p className="text-sm leading-relaxed text-gray-500">{item.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
