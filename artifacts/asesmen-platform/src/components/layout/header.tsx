import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Menu, X, User, LogIn, UserPlus, Brain, CalendarCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/lib/cart";
import ShoppingCartSidebar from "@/components/shopping-cart";
import logoPath from "@assets/Logo_Rumah_Psikologi_Pelangi_Indonesia_1752037860440.png";

const mainSiteHref = import.meta.env.VITE_MAIN_SITE_URL ||
  (window.location.hostname === "localhost" ? "http://localhost:8081/" : "/");

export default function Header() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { items } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const dashboardHref = user?.role === "psychologist" ? "/psychologist/dashboard" : "/dashboard";
  const isActive = (href: string) => href === "/" ? location === "/" : location.startsWith(href);
  const navLinkClass = (href: string, withIcon = false) =>
    `${withIcon ? "inline-flex items-center gap-1.5" : ""} ${
      isActive(href)
        ? "bg-green-600 text-white hover:bg-green-700 hover:text-white px-4 rounded-md font-semibold"
        : "text-neutral-500 dark:text-muted-foreground hover:text-primary px-3 font-medium"
    } py-2 text-sm transition-colors`;
  const mobileNavLinkClass = (href: string, withIcon = false) =>
    `${withIcon ? "flex items-center gap-2" : "block"} ${
      isActive(href)
        ? "mx-3 px-3 bg-green-600 hover:bg-green-700 text-white rounded-md font-semibold"
        : "px-3 text-neutral-500 dark:text-muted-foreground hover:text-primary font-medium"
    } py-2 transition-colors`;

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
      <header className="bg-white dark:bg-background shadow-sm border-b border-gray-200 dark:border-border sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <a href={mainSiteHref} className="flex items-center space-x-3">
                <img 
                  src={logoPath} 
                  alt="Rumah Psikologi Pelangi Indonesia" 
                  className="h-10 w-10 object-contain"
                />
                <div className="hidden sm:block">
                  <h1 className="font-bold text-primary cursor-pointer text-lg leading-tight">
                    Rumah Psikologi<br />
                    <span className="text-base">Pelangi Indonesia</span>
                  </h1>
                </div>
              </a>
              
              {/* Desktop Navigation */}
              <nav className="hidden md:ml-8 md:flex space-x-8 items-center">
                <Link href="/" className={navLinkClass("/")}>
                  Beranda
                </Link>
                <Link href="/assessments" className={navLinkClass("/assessments", true)}>
                  <Brain className="w-4 h-4" />
                  Asesmen Online
                </Link>
                <Link href="/booking" className={navLinkClass("/booking", true)}>
                  <CalendarCheck className="w-4 h-4" />
                  Booking Psikolog
                </Link>
                <Link href="/kontak" className={navLinkClass("/kontak")}>
                  Kontak
                </Link>
                {isAuthenticated && (
                  <Link href={dashboardHref} className={navLinkClass(dashboardHref)}>
                    {user?.role === "psychologist" ? "Dashboard Psikolog" : "Dashboard"}
                  </Link>
                )}
              </nav>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center space-x-4">
              {/* Shopping Cart */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative p-2 text-neutral-500 dark:text-muted-foreground hover:text-primary transition-colors"
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
                  <Button onClick={handleSignUp} size="sm" className="bg-green-600 hover:bg-green-700">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Daftar
                  </Button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center space-x-2">
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative p-2 text-neutral-500 dark:text-muted-foreground hover:text-primary transition-colors"
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
                className="p-2 text-neutral-500 dark:text-muted-foreground hover:text-primary transition-colors"
              >
                {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="md:hidden border-t border-gray-200 dark:border-border">
              <nav className="py-4 space-y-2">
                <Link href="/" className={mobileNavLinkClass("/")}>
                  Beranda
                </Link>
                <Link href="/assessments" className={mobileNavLinkClass("/assessments", true)}>
                  <Brain className="w-4 h-4" />
                  Asesmen Online
                </Link>
                <Link href="/booking" className={mobileNavLinkClass("/booking", true)}>
                  <CalendarCheck className="w-4 h-4" />
                  Booking Psikolog
                </Link>
                <Link href="/kontak" className={mobileNavLinkClass("/kontak")}>
                  Kontak
                </Link>
                {isAuthenticated && (
                  <Link href={dashboardHref} className={mobileNavLinkClass(dashboardHref)}>
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
                      <Button onClick={handleSignUp} size="sm" className="w-full bg-green-600 hover:bg-green-700">
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
