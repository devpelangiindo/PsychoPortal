import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { MapPin, Mail, Clock } from "lucide-react";
import { SiWhatsapp, SiInstagram, SiTiktok, SiFacebook, SiYoutube } from "react-icons/si";

const offices = [
  {
    type: "Kantor Pusat",
    address: "Jl. Colombo No.8, Samirono, Caturtunggal, Kec. Depok, Kabupaten Sleman, Daerah Istimewa Yogyakarta 55281",
    mapsUrl: "https://maps.google.com/?q=Jl.+Colombo+No.8,+Samirono,+Caturtunggal,+Depok,+Sleman,+DIY",
    wa: "+62 811-256-238",
    waUrl: "https://wa.me/62811256238",
    label: "CSO Colombo",
  },
  {
    type: "Kantor Cabang",
    address: "Jl. Mgr. Sugiyo Pranoto No.14, Melikan Kidul, Bantul, Kec. Bantul, Kabupaten Bantul, Daerah Istimewa Yogyakarta 55711",
    mapsUrl: "https://maps.google.com/?q=Jl+Mgr+Sugiyo+Pranoto+No.14,+Melikan+Kidul,+Bantul",
    wa: "+62 816-669-533",
    waUrl: "https://wa.me/62816669533",
    label: "CSO Bantul",
  },
];

const social = [
  { label: "Instagram", icon: SiInstagram, url: "https://www.instagram.com/rumahpsikologi_pi/", color: "#E1306C" },
  { label: "TikTok", icon: SiTiktok, url: "https://www.tiktok.com/@pelangi_indonesia", color: "#000000" },
  { label: "Facebook", icon: SiFacebook, url: "https://www.facebook.com/people/Rumah-Psikologi-PI/pfbid0yy9cryYrKvjhKvgAHff4KJQbbFx6GZwkXBRZLmKWvHW3nTLNmVfaEws6BEG7RXPTl/", color: "#1877F2" },
  { label: "YouTube", icon: SiYoutube, url: "https://www.youtube.com/@rumahpsikologipi9364", color: "#FF0000" },
];

export default function Kontak() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div
        className="pt-32 pb-16 text-center"
        style={{ background: "linear-gradient(135deg, #1B4332, #2D6A4F)" }}
      >
        <h1 className="text-4xl lg:text-5xl font-extrabold text-white mb-4">Kontak</h1>
        <p className="text-green-100/80 text-lg max-w-2xl mx-auto px-4">
          Hubungi kami untuk informasi layanan, konsultasi, atau kemitraan. Tim kami siap membantu Anda.
        </p>
      </div>

      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Email & social */}
          <div className="text-center mb-14">
            <div className="section-divider mx-auto" />
            <h2 className="text-2xl font-extrabold mb-8" style={{ color: "#1B4332" }}>Hubungi Kami</h2>
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <a
                href="mailto:info@pi-education.com"
                className="flex items-center gap-3 px-6 py-3 rounded-xl border border-gray-200 bg-white hover:border-green-300 hover:shadow-md transition-all text-sm font-medium text-gray-700"
              >
                <Mail size={18} style={{ color: "#2D6A4F" }} />
                info@pi-education.com
              </a>
            </div>

            {/* Social media */}
            <div className="flex flex-wrap justify-center gap-3">
              {social.map((s) => {
                const Icon = s.icon;
                return (
                  <a
                    key={s.label}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:shadow-md transition-all text-sm font-medium text-gray-700 hover:border-gray-300"
                  >
                    <Icon size={16} color={s.color} />
                    {s.label}
                  </a>
                );
              })}
            </div>
          </div>

          {/* Office cards */}
          <div className="grid md:grid-cols-2 gap-8 mb-14">
            {offices.map((office) => (
              <div key={office.type} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 hover:shadow-md transition-shadow">
                <span
                  className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-5"
                  style={{ background: "#D8F3DC", color: "#2D6A4F" }}
                >
                  {office.type}
                </span>

                <div className="flex items-start gap-3 mb-5">
                  <MapPin size={20} className="shrink-0 mt-0.5" style={{ color: "#2D6A4F" }} />
                  <div>
                    <a
                      href={office.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-700 text-sm leading-relaxed hover:text-green-800 transition-colors hover:underline underline-offset-2"
                    >
                      {office.address}
                    </a>
                    <p className="text-xs text-gray-400 mt-1">(Klik untuk buka Google Maps)</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-6">
                  <SiWhatsapp size={20} style={{ color: "#25D366" }} />
                  <div>
                    <p className="text-xs text-gray-500">{office.label}</p>
                    <a
                      href={office.waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-gray-800 hover:text-green-800 transition-colors"
                    >
                      {office.wa}
                    </a>
                  </div>
                </div>

                <a
                  href={office.waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md"
                  style={{ background: "#25D366" }}
                >
                  <SiWhatsapp size={16} />
                  Chat via WhatsApp
                </a>
              </div>
            ))}
          </div>

          {/* Hours */}
          <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <div className="flex items-center gap-3 mb-6">
              <Clock size={20} style={{ color: "#2D6A4F" }} />
              <h3 className="font-bold text-gray-900">Jam Operasional</h3>
            </div>
            <div className="space-y-3">
              {[
                { day: "Senin – Sabtu", time: "08.00 – 17.00 WIB" },
                { day: "Minggu & Hari Libur", time: "Tutup" },
              ].map((h) => (
                <div key={h.day} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-600">{h.day}</span>
                  <span className="text-sm font-semibold" style={{ color: h.time === "Tutup" ? "#9A6E5E" : "#2D6A4F" }}>
                    {h.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
