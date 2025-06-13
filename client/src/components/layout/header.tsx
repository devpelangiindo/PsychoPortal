import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Menu, X, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/lib/cart";
import ShoppingCartSidebar from "@/components/shopping-cart";

export default function Header() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { items } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const handleSignIn = () => {
    window.location.href = "/api/login";
  };

  const handleSignOut = () => {
    window.location.href = "/api/logout";
  };

  return (
    <>
      <header className="bg-white dark:bg-background shadow-sm border-b border-gray-200 dark:border-border sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/">
                <h1 className="text-2xl font-bold text-primary cursor-pointer">
                  Rumah Psikologi Indonesia
                </h1>
              </Link>
              
              {/* Desktop Navigation */}
              <nav className="hidden md:ml-8 md:flex space-x-8">
                <Link href="/">
                  <a className="text-neutral-900 dark:text-foreground hover:text-primary px-3 py-2 text-sm font-medium transition-colors">
                    Beranda
                  </a>
                </Link>
                <Link href="/assessments">
                  <a className="text-neutral-500 dark:text-muted-foreground hover:text-primary px-3 py-2 text-sm font-medium transition-colors">
                    Asesmen
                  </a>
                </Link>
                {isAuthenticated && (
                  <Link href="/dashboard">
                    <a className="text-neutral-500 dark:text-muted-foreground hover:text-primary px-3 py-2 text-sm font-medium transition-colors">
                      Dashboard
                    </a>
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
                    {user?.profileImageUrl ? (
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
                      {user?.firstName || user?.email?.split('@')[0] || 'User'}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleSignOut}>
                    Keluar
                  </Button>
                </div>
              ) : (
                <Button onClick={handleSignIn} size="sm">
                  Masuk
                </Button>
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
                <Link href="/">
                  <a className="block px-3 py-2 text-neutral-900 dark:text-foreground hover:text-primary font-medium transition-colors">
                    Beranda
                  </a>
                </Link>
                <Link href="/assessments">
                  <a className="block px-3 py-2 text-neutral-500 dark:text-muted-foreground hover:text-primary font-medium transition-colors">
                    Asesmen
                  </a>
                </Link>
                {isAuthenticated && (
                  <Link href="/dashboard">
                    <a className="block px-3 py-2 text-neutral-500 dark:text-muted-foreground hover:text-primary font-medium transition-colors">
                      Dashboard
                    </a>
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
                        {user?.profileImageUrl ? (
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
                          {user?.firstName || user?.email?.split('@')[0] || 'User'}
                        </span>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleSignOut} className="w-full">
                        Keluar
                      </Button>
                    </div>
                  ) : (
                    <div className="px-3 py-2">
                      <Button onClick={handleSignIn} size="sm" className="w-full">
                        Masuk
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
