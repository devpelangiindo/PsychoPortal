import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ShoppingCart, Menu, X, User, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/lib/cart";
import ShoppingCartSidebar from "@/components/shopping-cart";

const mainSiteHref = import.meta.env.VITE_MAIN_SITE_URL ||
  (window.location.hostname === "localhost" ? "http://localhost:8081/" : "/");

const withMainSitePath = (path: string) => `${mainSiteHref.replace(/\/$/, "")}${path}`;

const services: Array<{
  label: string;
  href: string;
  external?: boolean;
}> = [
  { label: "Asesmen", href: "/assessments" },
  { label: "Konseling", href: "/booking" },
  { label: "Terapi", href: withMainSitePath("/produk-layanan/terapi") },
  { label: "Pelatihan", href: withMainSitePath("/produk-layanan/pelatihan") },
  { label: "Produk Digital", href: withMainSitePath("/produk-layanan/produk-digital") },
  { label: "Kursus", href: withMainSitePath("/produk-layanan/kursus") },
  { label: "Sekolah Pelangi Indonesia", href: "https://www.pi-education.com/", external: true },
  { label: "HORECAL", href: withMainSitePath("/produk-layanan/horecal") },
];

const marketingNavLinkClass = "px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:text-green-800 hover:bg-green-50 transition-colors";
const marketingMobileLinkClass = "block px-4 py-3 text-sm font-medium rounded-lg text-gray-700 hover:text-green-800 hover:bg-green-50 transition-colors";
const marketingDropdownLinkClass = "block px-4 py-2 text-sm text-gray-700 hover:text-green-800 hover:bg-green-50 transition-colors";
const marketingMobileDropdownLinkClass = "block px-4 py-2 text-sm text-gray-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors";

export default function Header() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { items } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownCloseTimer = useRef<number | null>(null);
  const [location, setLocation] = useLocation();
  const dashboardHref = user?.role === "admin"
    ? "/admin/dashboard"
    : user?.role === "cso" || user?.role === "internal"
      ? "/cso/dashboard"
    : user?.role === "psychologist"
      ? "/psychologist/dashboard"
      : "/dashboard";

  const cancelDropdownClose = () => {
    if (dropdownCloseTimer.current !== null) {
      window.clearTimeout(dropdownCloseTimer.current);
      dropdownCloseTimer.current = null;
    }
  };

  const scheduleDropdownClose = () => {
    cancelDropdownClose();
    dropdownCloseTimer.current = window.setTimeout(() => {
      setDropdownOpen(false);
      dropdownCloseTimer.current = null;
    }, 400);
  };

  useEffect(() => {
    cancelDropdownClose();
    setIsMenuOpen(false);
    setDropdownOpen(false);

    return cancelDropdownClose;
  }, [location]);

  const handleSignIn = () => {
    setLocation("/login");
  };

  const handleSignUp = () => {
    setLocation("/register");
  };

  const handleSignOut = () => {
    // Clear local storage for custom auth
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    // Redirect to home page after logout
    window.location.href = "/";
  };

  return (
    <>
      <header className="bg-white/95 dark:bg-background/95 shadow-sm border-b border-gray-100 dark:border-border sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div className="flex items-center">
              <a href={mainSiteHref} className="flex items-center gap-3 group">
                <img 
                  src="/logo-pi-group.png" 
                  alt="Pelangi Indonesia Group" 
                  className="h-16 w-16 object-contain shrink-0 transition-transform group-hover:scale-105"
                />
                <div className="hidden sm:block">
                  <div className="text-base font-bold leading-tight text-[#1B4332] dark:text-foreground">
                    Pelangi Indonesia
                  </div>
                  <div className="text-sm leading-tight font-medium text-[#52B788]">
                    Group
                  </div>
                </div>
              </a>
              
              {/* Desktop Navigation */}
              <nav className="hidden lg:ml-8 lg:flex items-center gap-1">
                <a href={withMainSitePath("/tentang-kami")} className={marketingNavLinkClass}>
                  Tentang Kami
                </a>
                <a href={withMainSitePath("/artikel")} className={marketingNavLinkClass}>
                  Berita
                </a>

                <div
                  className="relative"
                  onMouseEnter={() => {
                    cancelDropdownClose();
                    setDropdownOpen(true);
                  }}
                  onMouseLeave={scheduleDropdownClose}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      cancelDropdownClose();
                      setDropdownOpen(false);
                    }
                  }}
                >
                  <div className="flex items-center rounded-md text-gray-700 hover:text-green-800 transition-colors">
                    <a
                      href={withMainSitePath("/produk-layanan")}
                      className="px-3 py-2 text-sm font-medium hover:bg-green-50 rounded-l-md transition-colors"
                    >
                      Produk & Layanan
                    </a>
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
                    <div
                      id="desktop-services-menu"
                      className="absolute top-full left-0 w-56 pt-1 z-50"
                    >
                      <div className="bg-white rounded-xl shadow-lg border border-gray-100 py-2">
                        {services.map((service) => (
                          service.href.startsWith("/") && !service.external ? (
                            <Link key={service.label} href={service.href} className={marketingDropdownLinkClass}>
                              {service.label}
                            </Link>
                          ) : (
                            <a
                              key={service.label}
                              href={service.href}
                              target={service.external ? "_blank" : undefined}
                              rel={service.external ? "noopener noreferrer" : undefined}
                              className={marketingDropdownLinkClass}
                            >
                              {service.label}
                            </a>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Link href="/kontak" className={marketingNavLinkClass}>
                  Kontak
                </Link>
                {isAuthenticated && (
                  <Link href={dashboardHref} className={marketingNavLinkClass}>
                    {user?.role === "psychologist" ? "Dashboard Psikolog" : "Dashboard"}
                  </Link>
                )}
              </nav>
            </div>

            {/* Desktop Actions */}
            <div className="hidden lg:flex items-center space-x-4">
              {/* Shopping Cart */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative p-2 rounded-md text-gray-700 dark:text-muted-foreground hover:text-green-800 hover:bg-green-50 transition-colors"
                aria-label="Buka keranjang"
              >
                <ShoppingCart className="w-5 h-5" />
                {items.length > 0 && (
                  <Badge className="cart-badge">
                    {items.length}
                  </Badge>
                )}
              </button>

              {/* User Actions */}
              {isLoading ? (
                <div className="w-20 h-9 bg-muted animate-pulse rounded" />
              ) : isAuthenticated ? (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    {user && user.profileImageUrl ? (
                      <img 
                        src={user.profileImageUrl} 
                        alt="Profile" 
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <span className="text-sm font-medium text-neutral-900 dark:text-foreground">
                      {user && (user.firstName || user.email?.split('@')[0]) || 'User'}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleSignOut}>
                    Keluar
                  </Button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Button variant="outline" onClick={handleSignIn} size="sm">
                    <LogIn className="w-4 h-4 mr-2" />
                    Masuk
                  </Button>
                  <Button onClick={handleSignUp} size="sm" className="bg-[#2D6A4F] hover:bg-[#1B4332]">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Daftar
                  </Button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="lg:hidden flex items-center space-x-2">
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative p-2 rounded-md text-gray-700 dark:text-muted-foreground hover:text-green-800 hover:bg-green-50 transition-colors"
                aria-label="Buka keranjang"
              >
                <ShoppingCart className="w-5 h-5" />
                {items.length > 0 && (
                  <Badge className="cart-badge">
                    {items.length}
                  </Badge>
                )}
              </button>
              
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-md text-gray-700 dark:text-muted-foreground hover:text-green-800 hover:bg-green-50 transition-colors"
                aria-label="Toggle menu"
              >
                {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="lg:hidden border-t border-gray-100 dark:border-border bg-white dark:bg-background">
              <nav className="py-4 space-y-2">
                <a href={withMainSitePath("/tentang-kami")} className={marketingMobileLinkClass}>
                  Tentang Kami
                </a>
                <a href={withMainSitePath("/artikel")} className={marketingMobileLinkClass}>
                  Berita
                </a>
                <div>
                  <button
                    className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium rounded-lg text-gray-700 hover:text-green-800 hover:bg-green-50 transition-colors"
                    onClick={() => setDropdownOpen((open) => !open)}
                  >
                    Produk & Layanan
                    <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                  {dropdownOpen && (
                    <div className="ml-4 space-y-1">
                      {services.map((service) => (
                        service.href.startsWith("/") && !service.external ? (
                          <Link key={service.label} href={service.href} className={marketingMobileDropdownLinkClass}>
                            {service.label}
                          </Link>
                        ) : (
                          <a
                            key={service.label}
                            href={service.href}
                            target={service.external ? "_blank" : undefined}
                            rel={service.external ? "noopener noreferrer" : undefined}
                            className={marketingMobileDropdownLinkClass}
                          >
                            {service.label}
                          </a>
                        )
                      ))}
                    </div>
                  )}
                </div>
                <Link href="/kontak" className={marketingMobileLinkClass}>
                  Kontak
                </Link>
                {isAuthenticated && (
                  <Link href={dashboardHref} className={marketingMobileLinkClass}>
                    {user?.role === "psychologist" ? "Dashboard Psikolog" : "Dashboard"}
                  </Link>
                )}
                
                <div className="border-t border-gray-200 dark:border-border pt-4 mt-4">
                  {isLoading ? (
                    <div className="px-3 py-2">
                      <div className="w-20 h-9 bg-muted animate-pulse rounded" />
                    </div>
                  ) : isAuthenticated ? (
                    <div className="px-3 py-2 space-y-3">
                      <div className="flex items-center space-x-2">
                        {user && user.profileImageUrl ? (
                          <img 
                            src={user.profileImageUrl} 
                            alt="Profile" 
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <span className="text-sm font-medium text-neutral-900 dark:text-foreground">
                          {user && (user.firstName || user.email?.split('@')[0]) || 'User'}
                        </span>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleSignOut} className="w-full">
                        Keluar
                      </Button>
                    </div>
                  ) : (
                    <div className="px-3 py-2 space-y-2">
                      <Button onClick={handleSignIn} size="sm" className="w-full" variant="outline">
                        <LogIn className="w-4 h-4 mr-2" />
                        Masuk
                      </Button>
                      <Button onClick={handleSignUp} size="sm" className="w-full bg-[#2D6A4F] hover:bg-[#1B4332]">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Daftar
                      </Button>
                    </div>
                  )}
                </div>
              </nav>
            </div>
          )}
        </div>
      </header>
      {/* Shopping Cart Sidebar */}
      <ShoppingCartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}
