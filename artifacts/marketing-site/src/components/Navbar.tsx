import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, ChevronDown, ShoppingCart } from "lucide-react";

const services = [
  { label: "Asesmen", href: "/produk-layanan/asesmen" },
  { label: "Konseling", href: "/produk-layanan/konseling" },
  { label: "Terapi", href: "/produk-layanan/terapi" },
  { label: "Pelatihan", href: "/produk-layanan/pelatihan" },
  { label: "Produk Digital", href: "/produk-layanan/produk-digital" },
  { label: "Kursus", href: "/produk-layanan/kursus" },
  { label: "Franchise", href: "/produk-layanan/franchise" },
  { label: "Sekolah Pelangi Indonesia", href: "https://www.pi-education.com/", external: true },
  { label: "HORECAL", href: "/produk-layanan/horecal" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setDropdownOpen(false);
  }, [location]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/95 backdrop-blur-md shadow-sm" : "bg-white/90 backdrop-blur-sm"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <img
              src="/logo-pi-group.png"
              alt="Pelangi Indonesia Group"
              className="h-10 w-auto transition-transform group-hover:scale-105"
            />
            <div className="hidden sm:block">
              <div className="text-sm font-bold leading-tight" style={{ color: "#1B4332" }}>
                Pelangi Indonesia
              </div>
              <div className="text-xs leading-tight" style={{ color: "#52B788" }}>
                Group
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            <Link
              href="/tentang-kami"
              className="px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:text-green-800 hover:bg-green-50 transition-colors"
            >
              Tentang Kami
            </Link>
            <Link
              href="/artikel"
              className="px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:text-green-800 hover:bg-green-50 transition-colors"
            >
              Artikel
            </Link>

            {/* Dropdown */}
            <div className="relative">
              <button
                onMouseEnter={() => setDropdownOpen(true)}
                onMouseLeave={() => setDropdownOpen(false)}
                onClick={() => setDropdownOpen((o) => !o)}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:text-green-800 hover:bg-green-50 transition-colors"
              >
                Produk & Layanan
                <ChevronDown
                  size={14}
                  className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {dropdownOpen && (
                <div
                  onMouseEnter={() => setDropdownOpen(true)}
                  onMouseLeave={() => setDropdownOpen(false)}
                  className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50"
                >
                  {services.map((s) =>
                    s.external ? (
                      <a
                        key={s.href}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-4 py-2 text-sm text-gray-700 hover:text-green-800 hover:bg-green-50 transition-colors"
                      >
                        {s.label}
                      </a>
                    ) : (
                      <Link
                        key={s.href}
                        href={s.href}
                        className="block px-4 py-2 text-sm text-gray-700 hover:text-green-800 hover:bg-green-50 transition-colors"
                      >
                        {s.label}
                      </Link>
                    )
                  )}
                </div>
              )}
            </div>

            <Link
              href="/kontak"
              className="px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:text-green-800 hover:bg-green-50 transition-colors"
            >
              Kontak
            </Link>
          </nav>

          {/* CTA buttons */}
          <div className="hidden lg:flex items-center gap-3">
            <a
              href="https://wa.me/62816669533"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm font-semibold rounded-lg text-white transition-all hover:scale-105 hover:shadow-md"
              style={{ background: "#25D366" }}
            >
              WhatsApp
            </a>
            <a
              href="/asesmen"
              className="px-4 py-2 text-sm font-semibold rounded-lg text-white transition-all hover:scale-105 hover:shadow-md"
              style={{ background: "#2D6A4F" }}
            >
              Platform Asesmen
            </a>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="lg:hidden p-2 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100 shadow-lg">
          <nav className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            <Link
              href="/tentang-kami"
              className="block px-4 py-3 text-sm font-medium rounded-lg text-gray-700 hover:text-green-800 hover:bg-green-50 transition-colors"
            >
              Tentang Kami
            </Link>
            <Link
              href="/artikel"
              className="block px-4 py-3 text-sm font-medium rounded-lg text-gray-700 hover:text-green-800 hover:bg-green-50 transition-colors"
            >
              Artikel
            </Link>
            <div>
              <button
                className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium rounded-lg text-gray-700 hover:text-green-800 hover:bg-green-50 transition-colors"
                onClick={() => setDropdownOpen((o) => !o)}
              >
                Produk & Layanan
                <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {dropdownOpen && (
                <div className="ml-4 space-y-1">
                  {services.map((s) =>
                    s.external ? (
                      <a
                        key={s.href}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-4 py-2 text-sm text-gray-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        {s.label}
                      </a>
                    ) : (
                      <Link
                        key={s.href}
                        href={s.href}
                        className="block px-4 py-2 text-sm text-gray-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        {s.label}
                      </Link>
                    )
                  )}
                </div>
              )}
            </div>
            <Link
              href="/kontak"
              className="block px-4 py-3 text-sm font-medium rounded-lg text-gray-700 hover:text-green-800 hover:bg-green-50 transition-colors"
            >
              Kontak
            </Link>
            <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
              <a
                href="https://wa.me/62816669533"
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-3 text-sm font-semibold text-center rounded-lg text-white"
                style={{ background: "#25D366" }}
              >
                Hubungi via WhatsApp
              </a>
              <a
                href="/asesmen"
                className="block px-4 py-3 text-sm font-semibold text-center rounded-lg text-white"
                style={{ background: "#2D6A4F" }}
              >
                Platform Asesmen
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
