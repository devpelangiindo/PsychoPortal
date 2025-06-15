import { X, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCart } from "@/lib/cart";
import { Link } from "wouter";

interface ShoppingCartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShoppingCartSidebar({ isOpen, onClose }: ShoppingCartSidebarProps) {
  const { items, removeItem, getTotalAmount } = useCart();

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`fixed inset-y-0 right-0 w-96 bg-white dark:bg-background shadow-2xl transform transition-transform z-50 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-border">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-foreground">
              Shopping Cart
            </h2>
            <button 
              onClick={onClose}
              className="text-neutral-500 dark:text-muted-foreground hover:text-neutral-900 dark:hover:text-foreground transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {items.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🛒</div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-foreground mb-2">
                  Your cart is empty
                </h3>
                <p className="text-neutral-500 dark:text-muted-foreground text-sm">
                  Add some assessments to get started
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between py-4 border-b border-gray-100 dark:border-border last:border-b-0">
                    <div className="flex-1 pr-4">
                      <h3 className="font-semibold text-neutral-900 dark:text-foreground text-sm">
                        {item.name}
                      </h3>
                      <p className="text-xs text-neutral-500 dark:text-muted-foreground mt-1 line-clamp-2">
                        {item.description}
                      </p>
                      <div className="flex items-center space-x-3 text-xs text-neutral-400 dark:text-muted-foreground mt-2">
                        <span>⏱️ {item.duration}</span>
                        <span>👥 {item.ageRange}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-neutral-900 dark:text-foreground text-sm">
                        Rp {new Intl.NumberFormat('id-ID').format(parseFloat(item.price))}
                      </div>
                      <button 
                        onClick={() => removeItem(item.id)}
                        className="text-red-500 hover:text-red-700 text-xs mt-2 flex items-center"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Footer */}
          {items.length > 0 && (
            <div className="border-t border-gray-200 dark:border-border p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-neutral-900 dark:text-foreground">
                  Total
                </span>
                <span className="flex items-baseline text-primary">
                  <span className="text-lg font-semibold mr-1">Rp</span>
                  <span className="text-2xl font-bold">{new Intl.NumberFormat('id-ID').format(getTotalAmount())}</span>
                </span>
              </div>
              
              <Link href="/cart">
                <Button 
                  className="w-full bg-primary hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
                  onClick={onClose}
                >
                  View Cart & Checkout
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              
              <p className="text-center text-xs text-neutral-500 dark:text-muted-foreground">
                Secure checkout with Xendit payment gateway
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
