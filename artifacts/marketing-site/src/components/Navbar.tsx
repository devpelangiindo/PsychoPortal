import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, ChevronDown, ShoppingCart } from "lucide-react";
import { getAsesmenPlatformHref, getBookingHref } from "@/lib/platform-links";

const services: Array<{
  label: string;
  href: string;
  external?: boolean;
}> = [
  { label: "Asesmen", href: "__ASESMEN_PLATFORM__" },
  { label: "Konseling", href: "__BOOKING__" },
  { label: "Terapi", href: "/produk-layanan/terapi" },
  { label: "Pelatihan", href: "/produk-layanan/pelatihan" },
  { label: "Produk Edukasi", href: "/produk-layanan/produk-edukasi" },
  { label: "Kursus", href: "/produk-layanan/kursus" },
  { label: "Sekolah Pelangi Indonesia", href: "https://www.pi-education.com/", external: true },
  { label: "Hospitality Services", href: "/produk-layanan/horecal" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownCloseTimer = useRef<number | null>(null);
  const [location] = useLocation();

  const cancelDropdownClose = () => {
    if (dropdownCloseTimer.current !== null) {
      window.clearTimeout(dropdownCloseTimer.current);
      dropdownCloseTimer.current = null;
    }
  };

  const openDropdown = () => {
    cancelDropdownClose();
    setDropdownOpen(true);
  };

  const scheduleDropdownClose = () => {
    cancelDropdownClose();
    dropdownCloseTimer.current = window.setTimeout(() => {
      setDropdownOpen(false);
      dropdownCloseTimer.current = null;
    }, 400);
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    cancelDropdownClose();
    setMenuOpen(false);
    setDropdownOpen(false);
  }, [location]);

  useEffect(() => () => cancelDropdownClose(), []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/95 backdrop-blur-md shadow-sm" : "bg-white/90 backdrop-blur-sm"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <img
              src="/logo-pi-group.png"
              alt="Pelangi Indonesia Group"
              className="h-16 w-16 object-contain shrink-0 transition-transform group-hover:scale-105"
            />
            <div className="hidden sm:block">
              <div className="text-base font-bold leading-tight" style={{ color: "#1B4332" }}>
                Pelangi Indonesia
              </div>
              <div className="text-sm leading-tight font-medium" style={{ color: "#52B788" }}>
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
              Berita
            </Link>

            {/* Dropdown */}
            <div
              className="relative"
              onMouseEnter={openDropdown}
              onMouseLeave={scheduleDropdownClose}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) scheduleDropdownClose();
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  cancelDropdownClose();
                  setDropdownOpen(false);
                }
              }}
            >
              <div
                className="flex items-center rounded-md text-gray-700 hover:text-green-800 transition-colors"
              >
                <Link
                  href="/produk-layanan"
                  className="px-3 py-2 text-sm font-medium hover:bg-green-50 rounded-l-md transition-colors"
                >
                  Produk & Layanan
                </Link>
                <button
                  onClick={() => {
                    cancelDropdownClose();
                    setDropdownOpen((open) => !open);
                  }}
                  className="px-1 py-2 hover:bg-green-50 rounded-r-md transition-colors"
                  aria-label="Buka menu layanan"
                  aria-expanded={dropdownOpen}
                  aria-controls="desktop-services-menu"
                >
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </div>

              {dropdownOpen && (
                <div className="absolute left-0 top-full z-50 w-56 pt-1">
                  <div id="desktop-services-menu" className="rounded-xl border border-gray-100 bg-white py-2 shadow-lg">
                    {services.map((s) => {
                      const href = s.href === "__BOOKING__"
                        ? getBookingHref()
                        : s.href === "__ASESMEN_PLATFORM__"
                          ? getAsesmenPlatformHref()
                          : s.href;
                      const cls = "block px-4 py-2 text-sm text-gray-700 hover:text-green-800 hover:bg-green-50 transition-colors";
                      const wrapper = (child: React.ReactNode) => (
                        <div key={s.href}>
                          {child}
                        </div>
                      );
                      if (s.external || s.href === "__BOOKING__" || s.href === "__ASESMEN_PLATFORM__") {
                        return wrapper(
                          <a href={href} target={s.external ? "_blank" : undefined} rel={s.external ? "noopener noreferrer" : undefined} className={cls}>
                            {s.label}
                          </a>
                        );
                      }
                      return wrapper(
                        <Link href={href} className={cls}>{s.label}</Link>
                      );
                    })}
                  </div>
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
              Berita
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
                  {services.map((s) => {
                    const href = s.href === "__BOOKING__"
                      ? getBookingHref()
                      : s.href === "__ASESMEN_PLATFORM__"
                        ? getAsesmenPlatformHref()
                        : s.href;
                    const cls = "block px-4 py-2 text-sm text-gray-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors";
                    const inner = s.external || s.href === "__BOOKING__" || s.href === "__ASESMEN_PLATFORM__"
                      ? <a key={s.href} href={href} target={s.external ? "_blank" : undefined} rel={s.external ? "noopener noreferrer" : undefined} className={cls}>{s.label}</a>
                      : <Link key={s.href} href={href} className={cls}>{s.label}</Link>;
                    return (
                      <div key={s.href}>
                        {inner}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <Link
              href="/kontak"
              className="block px-4 py-3 text-sm font-medium rounded-lg text-gray-700 hover:text-green-800 hover:bg-green-50 transition-colors"
            >
              Kontak
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
