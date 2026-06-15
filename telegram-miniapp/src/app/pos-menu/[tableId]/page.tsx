"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "@rabbitty/ui";
// Usamos fetch local o TRPC para cargar el menú.
// Aquí iría un dummy o implementación inicial para Telegram Stars.
import { useWallet } from "../../../contexts/WalletContext"; // Asumiendo que existe
import { Button } from "@rabbitty/ui";
import { ShoppingCart, Star, Coins } from "lucide-react";

declare global {
  interface Window {
    Telegram?: any;
  }
}

export default function PosMenuPage() {
  const { tableId } = useParams();
  const router = useRouter();
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [cart, setCart] = useState<{item: any, quantity: number}[]>([]);
  const [loading, setLoading] = useState(true);

  // Load menu items
  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const res = await fetch(`/api/pos/menu?tableId=${tableId}`);
        const data = await res.json();
        if (data.success) {
          setMenuItems(data.items || []);
        } else {
          toast.error(data.error || "Error al cargar el menú");
        }
      } catch (err) {
        toast.error("Error de conexión");
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, [tableId]);

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        return prev.map(i => i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { item, quantity: 1 }];
    });
    toast.success(`${item.name} agregado`);
  };

  const total = cart.reduce((sum, i) => sum + (i.item.price * i.quantity), 0);

  const handlePayStars = async () => {
    toast.success("Generando pago con Telegram Stars...");
    try {
      const res = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, items: cart.map(i => ({...i.item, quantity: i.quantity})), paymentMethod: 'STARS' })
      });
      const data = await res.json();
      if (data.success && data.invoiceLink) {
        // Use TWA SDK to open the invoice
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.openInvoice(data.invoiceLink, (status: string) => {
            if (status === 'paid') {
              toast.success("¡Pago exitoso!");
              setCart([]);
            } else if (status === 'cancelled') {
              toast.error("Pago cancelado");
            } else {
              toast.error("Error en el pago: " + status);
            }
          });
        } else {
          toast.error("Telegram WebApp no disponible");
        }
      } else {
        toast.error(data.error || "Error al crear invoice");
      }
    } catch (err) {
      toast.error("Error de conexión");
    }
  };

  const handlePayBunz = async () => {
    toast.success("Procesando pago con Bunz...");
    try {
      const res = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, items: cart.map(i => ({...i.item, quantity: i.quantity})), paymentMethod: 'BUNZ' })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("¡Pago con Bunz exitoso!");
        setCart([]);
      } else {
        toast.error(data.error || "Fondos insuficientes o error");
      }
    } catch (err) {
      toast.error("Error de conexión");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 pb-[100px] pt-[calc(max(var(--safe-top,0px),50px))]">
      <div className="p-4 bg-white shadow-sm sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Orden en Mesa</h1>
          <p className="text-sm text-gray-500">Mesa ID: {tableId}</p>
        </div>
        <div className="relative cursor-pointer" onClick={() => {/* Open cart modal */}}>
          <ShoppingCart className="w-6 h-6 text-gray-700" />
          {cart.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-pink-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {cart.reduce((sum, i) => sum + i.quantity, 0)}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <p className="text-center text-gray-500 mt-10">Cargando menú...</p>
        ) : (
          menuItems.map(item => (
            <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-gray-900">{item.name}</h3>
                <p className="text-sm text-gray-500">{item.description}</p>
                <p className="font-bold text-pink-600 mt-1">${item.price}</p>
              </div>
              <Button onClick={() => addToCart(item)} size="sm" variant="secondary">
                Agregar
              </Button>
            </div>
          ))
        )}
      </div>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
          <div className="flex justify-between items-center mb-4">
            <span className="font-semibold text-gray-700">Total a Pagar</span>
            <span className="text-xl font-bold">${total}</span>
          </div>
          <div className="flex gap-2">
            <Button onClick={handlePayStars} className="flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600">
              <Star className="w-4 h-4 fill-white" />
              Pagar con Stars
            </Button>
            <Button onClick={handlePayBunz} className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700">
              <Coins className="w-4 h-4 fill-white" />
              Usar Bunz
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
