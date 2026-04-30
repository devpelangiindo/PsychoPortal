import { Link } from "wouter";
import { MapPin, Mail, Phone } from "lucide-react";
import { SiInstagram, SiTiktok, SiFacebook, SiYoutube, SiWhatsapp } from "react-icons/si";

const services = [
  { label: "Konseling", href: "/produk-layanan/konseling" },
  { label: "Asesmen", href: "/produk-layanan/asesmen" },
  { label: "Terapi", href: "/produk-layanan/terapi" },
  { label: "Pelatihan", href: "/produk-layanan/pelatihan" },
  { label: "Produk Digital", href: "/produk-layanan/produk-digital" },
  { label: "Kursus", href: "/produk-layanan/kursus" },
  { label: "Franchise", href: "/produk-layanan/franchise" },
];

export default function Footer() {
  return (
    <footer className="text-white" style={{ background: "linear-gradient(135deg, #1B4332 0%, #2D6A4F 100%)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand column */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shrink-0 shadow-md">
                <img
                  src="/logo-pi-group.png"
                  alt="Pelangi Indonesia Group"
                  className="w-10 h-10 object-contain"
                />
              </div>
              <div>
                <div className="font-bold text-white text-base leading-tight">Pelangi Indonesia</div>
                <div className="text-green-300 text-sm">Group</div>
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
                  href="https://maps.google.com/?q=Jl.+Colombo+No.8,+Samirono,+Caturtunggal,+Depok,+Sleman,+DIY"
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
                  <Link
                    href={s.href}
                    className="text-green-100/80 hover:text-white transition-colors text-sm hover:underline underline-offset-2"
                  >
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-white text-sm uppercase tracking-wider mb-4 opacity-60">Kontak</h4>
            <div className="space-y-3">
              <a
                href="https://wa.me/62816669533"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-green-100/80 hover:text-white transition-colors text-sm"
              >
                <SiWhatsapp size={14} className="text-green-400" />
                <span>+62 816-669-533 (Bantul)</span>
              </a>
              <a
                href="https://wa.me/62811256238"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-green-100/80 hover:text-white transition-colors text-sm"
              >
                <SiWhatsapp size={14} className="text-green-400" />
                <span>+62 811-256-238 (Colombo)</span>
              </a>
              <a
                href="mailto:info@pi-education.com"
                className="flex items-center gap-2 text-green-100/80 hover:text-white transition-colors text-sm"
              >
                <Mail size={14} className="text-green-400" />
                <span>info@pi-education.com</span>
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
                href="https://tr.ee/hImCRwfXLQ"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors text-white"
                aria-label="Facebook"
              >
                <SiFacebook size={14} />
              </a>
              <a
                href="https://tr.ee/Ie39KE6hhb"
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
