import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export type CartItem = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  quantity: number;
  brand?: string; 
  prescription?: boolean;
  maxQuantity?: number;
};

type CartContextType = {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextType | null>(null);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const { firebaseUser } = useAuth(); // getting firebase user for UID

  const cartRef = firebaseUser ? doc(db, 'carts', firebaseUser.uid) : null;

  // Realtime sync with Firestore
  useEffect(() => {
    if (!cartRef) {
      setCart([]);
      return;
    }

    const unsubscribe = onSnapshot(cartRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCart(data.items || []);
      } else {
        setDoc(cartRef, { items: [] }); // init empty cart if not exists
      }
    });

    return () => unsubscribe();
  }, [firebaseUser?.uid]);

  const syncCart = async (updatedCart: CartItem[]) => {
    if (!cartRef) return;
    await updateDoc(cartRef, { items: updatedCart }).catch(async () => {
      await setDoc(cartRef, { items: updatedCart }); // fallback if doc doesn't exist
    });
  };

  const addToCart = (item: CartItem) => {
    const existing = cart.find((p) => p.id === item.id);
    let updatedCart: CartItem[];

    if (existing) {
      updatedCart = cart.map((p) =>
        p.id === item.id ? { ...p, quantity: p.quantity + item.quantity } : p
      );
    } else {
      updatedCart = [...cart, item];
    }

    setCart(updatedCart);
    syncCart(updatedCart);
  };

  const updateQuantity = (id: string, quantity: number) => {
    const updatedCart = cart.map((p) =>
      p.id === id ? { ...p, quantity } : p
    );
    setCart(updatedCart);
    syncCart(updatedCart);
  };

  const removeFromCart = (id: string) => {
    const updatedCart = cart.filter((p) => p.id !== id);
    setCart(updatedCart);
    syncCart(updatedCart);
  };

  const clearCart = () => {
    setCart([]);
    syncCart([]);
  };

  return (
    <CartContext.Provider
      value={{ cart, addToCart, updateQuantity, removeFromCart, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
