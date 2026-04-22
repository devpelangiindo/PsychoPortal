import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: number;
  name: string;
  price: string;
  description: string;
  duration: string;
  ageRange: string;
  type: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: number) => void;
  clearCart: () => void;
  getTotalAmount: () => number;
  getItemCount: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      
      addItem: (item: CartItem) => {
        const currentItems = get().items;
        const existingItem = currentItems.find(i => i.id === item.id);
        
        if (!existingItem) {
          set({
            items: [...currentItems, item]
          });
        }
      },
      
      removeItem: (id: number) => {
        set({
          items: get().items.filter(item => item.id !== id)
        });
      },
      
      clearCart: () => {
        set({ items: [] });
      },
      
      getTotalAmount: () => {
        return get().items.reduce((total, item) => {
          return total + parseFloat(item.price);
        }, 0);
      },
      
      getItemCount: () => {
        return get().items.length;
      },
    }),
    {
      name: 'psyassess-cart-storage',
      getStorage: () => localStorage,
    }
  )
);
