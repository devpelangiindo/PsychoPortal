import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Menu, X, User, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/lib/cart";
import ShoppingCartSidebar from "@/components/shopping-cart";
import logoPath from "@assets/Logo_Rumah_Psikologi_Pelangi_Indonesia_1752037860440.png";

export default function Header() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { items } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [, setLocation] = useLocation();

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
              <Link href="/" className="flex items-center space-x-3">
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
              </Link>
              
              {/* Desktop Navigation */}
              <nav className="hidden md:ml-8 md:flex space-x-8">
                <Link href="/" className="text-neutral-900 dark:text-foreground hover:text-primary px-3 py-2 text-sm font-medium transition-colors">
                  Beranda
                </Link>
                <Link href="/assessments" className="text-neutral-500 dark:text-muted-foreground hover:text-primary px-3 py-2 text-sm font-medium transition-colors">
                  Asesmen
                </Link>
                {isAuthenticated && (
                  <Link href="/dashboard" className="text-neutral-500 dark:text-muted-foreground hover:text-primary px-3 py-2 text-sm font-medium transition-colors">
                    Dashboard
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
                <Link href="/" className="block px-3 py-2 text-neutral-900 dark:text-foreground hover:text-primary font-medium transition-colors">
                  Beranda
                </Link>
                <Link href="/assessments" className="block px-3 py-2 text-neutral-500 dark:text-muted-foreground hover:text-primary font-medium transition-colors">
                  Asesmen
                </Link>
                {isAuthenticated && (
                  <Link href="/dashboard" className="block px-3 py-2 text-neutral-500 dark:text-muted-foreground hover:text-primary font-medium transition-colors">
                    Dashboard
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
