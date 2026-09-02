import { Link } from "wouter";
import { MapPin, Mail } from "lucide-react";
import { SiInstagram, SiTiktok, SiFacebook, SiYoutube, SiWhatsapp } from "react-icons/si";
import { getAsesmenPlatformHref, getBookingHref } from "@/lib/platform-links";

const services = [
  { label: "Asesmen", href: "__ASESMEN_PLATFORM__" },
  { label: "Konseling", href: "__BOOKING__" },
  { label: "Terapi", href: "/produk-layanan/terapi" },
  { label: "Pelatihan", href: "/produk-layanan/pelatihan" },
  { label: "Produk Edukasi", href: "/produk-layanan/produk-edukasi" },
  { label: "Kursus", href: "/produk-layanan/kursus" },
  { label: "Hospitality Services", href: "/produk-layanan/horecal" },
];

export default function Footer() {
  return (
    <footer className="text-white" style={{ background: "linear-gradient(135deg, #1B4332 0%, #2D6A4F 100%)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand column */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-4 mb-4">
              <img
                src="/logo-pi-group.png"
                alt="Pelangi Indonesia Group"
                className="w-36 h-36 object-contain shrink-0"
              />
              <div>
                <div className="font-bold text-white text-lg leading-tight">Pelangi Indonesia</div>
                <div className="text-green-300 text-base font-medium">Group</div>
              </div>
            </div>
            <p className="text-green-100/80 text-sm leading-relaxed mb-4">
              Rumah Psikologi dan Pengembangan Diri Pelangi Indonesia — melayani, mendidik, dan bertumbuh bersama.
            </p>
            <p className="text-green-300 text-xs italic font-medium">"Bergerak, Berdampak"</p>
          </div>

          {/* Addresses */}
          <div>
            <h4 className="font-semibold text-white text-sm uppercase tracking-wider mb-4 opacity-60">Lokasi</h4>
            <div className="space-y-4">
              <div>
                <p className="text-green-300 text-xs font-semibold uppercase tracking-wider mb-1">Kantor Pusat</p>
                <a
                  href="https://maps.app.goo.gl/USTLE9obhyvUK1NAA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 text-green-100/80 hover:text-white transition-colors text-sm"
                >
                  <MapPin size={14} className="mt-0.5 shrink-0 text-green-400" />
                  <span>Jl. Colombo No.8, Samirono, Caturtunggal, Kec. Depok, Sleman, DIY 55281</span>
                </a>
              </div>
              <div>
                <p className="text-green-300 text-xs font-semibold uppercase tracking-wider mb-1">Kantor Cabang</p>
                <a
                  href="https://maps.google.com/?q=Jl.+Mgr+Sugiyo+Pranoto+No.14,+Melikan+Kidul,+Bantul"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 text-green-100/80 hover:text-white transition-colors text-sm"
                >
                  <MapPin size={14} className="mt-0.5 shrink-0 text-green-400" />
                  <span>Jl. Mgr. Sugiyo Pranoto No.14, Melikan Kidul, Bantul, DIY 55711</span>
                </a>
              </div>
            </div>
          </div>

          {/* Layanan links */}
          <div>
            <h4 className="font-semibold text-white text-sm uppercase tracking-wider mb-4 opacity-60">Layanan</h4>
            <ul className="space-y-2">
              {services.map((s) => (
                <li key={s.href}>
                  {s.href === "__BOOKING__" || s.href === "__ASESMEN_PLATFORM__" ? (
                    <a
                      href={s.href === "__BOOKING__" ? getBookingHref() : getAsesmenPlatformHref()}
                      className="text-green-100/80 hover:text-white transition-colors text-sm hover:underline underline-offset-2"
                    >
                      {s.label}
                    </a>
                  ) : (
                    <Link
                      href={s.href}
                      className="text-green-100/80 hover:text-white transition-colors text-sm hover:underline underline-offset-2"
                    >
                      {s.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-white text-sm uppercase tracking-wider mb-4 opacity-60">Kontak</h4>
            <div className="space-y-3">
              <a
                href="https://wa.me/6285117658242"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-green-100/80 hover:text-white transition-colors text-sm"
              >
                <SiWhatsapp size={14} className="text-green-400" />
                <span>Hotline: 085117658242</span>
              </a>
              <a
                href="mailto:psikologi.pelangiindonesia@gmail.com"
                className="flex items-center gap-2 text-green-100/80 hover:text-white transition-colors text-sm"
              >
                <Mail size={14} className="text-green-400" />
                <span>psikologi.pelangiindonesia@gmail.com</span>
              </a>
            </div>

            {/* Social icons */}
            <div className="flex gap-3 mt-5">
              <a
                href="https://www.instagram.com/rumahpsikologi_pi/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors text-white"
                aria-label="Instagram"
              >
                <SiInstagram size={14} />
              </a>
              <a
                href="https://www.tiktok.com/@pelangi_indonesia"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors text-white"
                aria-label="TikTok"
              >
                <SiTiktok size={14} />
              </a>
              <a
                href="https://www.facebook.com/people/Rumah-Psikologi-PI/pfbid0yy9cryYrKvjhKvgAHff4KJQbbFx6GZwkXBRZLmKWvHW3nTLNmVfaEws6BEG7RXPTl/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors text-white"
                aria-label="Facebook"
              >
                <SiFacebook size={14} />
              </a>
              <a
                href="https://www.youtube.com/@rumahpsikologipi9364"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors text-white"
                aria-label="YouTube"
              >
                <SiYoutube size={14} />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-green-200/50 text-xs">
            &copy; {new Date().getFullYear()} Pelangi Indonesia Group. Seluruh hak dilindungi.
          </p>
          <div className="flex gap-4">
            <Link href="/tentang-kami" className="text-green-200/50 text-xs hover:text-white transition-colors">
              Tentang Kami
            </Link>
            <Link href="/kontak" className="text-green-200/50 text-xs hover:text-white transition-colors">
              Kontak
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
