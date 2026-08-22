"use client";

import { useState, useMemo } from "react";
import { trpc } from "../../../lib/trpc-client";
import { cn } from "@rabbitty/ui";
import { ShoppingBag, ChevronRight, CheckCircle2, ChevronLeft, Minus, Plus, Scan, X, QrCode } from "lucide-react";

const PLACEHOLDER_IMG = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=1000&auto=format&fit=crop";
const BG_VIDEO_PLACEHOLDER = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=2574&auto=format&fit=crop";

export default function KioskPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [view, setView] = useState<"welcome" | "menu" | "checkout" | "qr_payment" | "success">("welcome");
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const { data: categories } = trpc.pos.getCategories.useQuery(undefined, { retry: false });
  const { data: menuItems } = trpc.pos.getMenuItems.useQuery({}, { retry: false });

  const filteredItems = useMemo(() => {
    if (!menuItems) return [];
    if (!activeCategory && categories && categories.length > 0) {
      return menuItems.filter((i) => i.categoryId === categories[0].id);
    }
    return menuItems.filter((i) => i.categoryId === activeCategory);
  }, [menuItems, activeCategory, categories]);

  const addToCart = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.id);
      if (existing) {
        return prev.map((i) => (i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { id: Math.random().toString(36).substr(2, 9), menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
    setSelectedItem(null);
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // 1. WELCOME SCREEN
  if (view === "welcome") {
    return (
      <div 
        className="flex h-screen w-full flex-col items-center justify-center bg-gray-950 text-white select-none cursor-pointer relative overflow-hidden group"
        onClick={() => {
          if (categories && categories.length > 0) setActiveCategory(categories[0].id);
          setView("menu");
        }}
      >
        <div className="absolute inset-0 bg-cover bg-center opacity-40 transition-transform duration-[10s] group-hover:scale-110" style={{ backgroundImage: `url(${BG_VIDEO_PLACEHOLDER})` }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
        
        <div className="relative z-10 flex flex-col items-center text-center px-12">
          <div className="h-40 w-40 rounded-[2.5rem] bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 flex items-center justify-center mb-10 shadow-[0_0_80px_rgba(236,72,153,0.5)] transform transition-transform duration-500 group-hover:-translate-y-4">
            <span className="font-black text-8xl text-white">R</span>
          </div>
          <h1 className="text-7xl font-black mb-6 tracking-tight text-white drop-shadow-2xl">Diseña tu pedido</h1>
          <p className="text-3xl text-gray-300 font-medium max-w-2xl mb-16 drop-shadow-md">
            Toca en cualquier parte de la pantalla para comenzar y acumula Bunz en tu cuenta.
          </p>
          
          <div className="animate-pulse flex h-24 w-24 items-center justify-center rounded-full bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[0_0_40px_rgba(255,255,255,0.1)]">
            <ChevronRight className="h-12 w-12 text-white rotate-90" />
          </div>
        </div>
      </div>
    );
  }

  // 2. SUCCESS SCREEN
  if (view === "success") {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-950 text-white select-none relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-black to-pink-500/20" />
        
        <div className="relative z-10 flex flex-col items-center text-center px-12 max-w-3xl">
          <div className="h-48 w-48 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center mb-10 shadow-[0_0_100px_rgba(16,185,129,0.3)]">
            <CheckCircle2 className="h-24 w-24 text-emerald-400" />
          </div>
          <h1 className="text-7xl font-black mb-6 tracking-tight">¡Orden Pagada!</h1>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-10 w-full mb-12">
            <p className="text-2xl text-gray-400 font-medium mb-2">Tu número de orden es</p>
            <p className="text-[6rem] font-black text-emerald-400 leading-none">842</p>
          </div>
          
          <button 
            onClick={() => { setCart([]); setView("welcome"); }}
            className="rounded-[2.5rem] bg-white/10 px-16 py-8 text-3xl font-black text-white backdrop-blur-xl border border-white/20 active:scale-95 transition-all hover:bg-white/20"
          >
            Nueva Orden
          </button>
        </div>
      </div>
    );
  }

  // 3. QR PAYMENT SCREEN
  if (view === "qr_payment") {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-950 text-white select-none relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-purple-900/30 to-black" />
        
        {/* Header */}
        <header className="absolute top-0 left-0 w-full p-8 flex justify-between items-center">
          <button 
            onClick={() => setView("checkout")}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20 transition-all border border-white/20"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <div className="text-3xl font-black text-purple-400">${(total * 1.16).toFixed(2)}</div>
        </header>

        <div className="relative z-10 flex flex-col items-center text-center max-w-3xl">
          <h1 className="text-5xl font-black mb-4">Escanea para Pagar</h1>
          <p className="text-2xl text-gray-400 mb-12">Usa tu cámara o la App de Rabbitty para completar el pago y sumar Bunz.</p>
          
          {/* Mock QR */}
          <div className="bg-white p-6 rounded-[3rem] shadow-[0_0_100px_rgba(168,85,247,0.3)] mb-12">
            <div className="w-[400px] h-[400px] bg-black rounded-3xl flex items-center justify-center relative overflow-hidden">
              <QrCode className="h-48 w-48 text-white/20" />
              <div className="absolute top-0 left-0 w-full h-2 bg-purple-500 shadow-[0_0_20px_#a855f7] animate-[scan_2s_ease-in-out_infinite]" />
            </div>
          </div>

          <button 
            onClick={() => setView("success")}
            className="rounded-[2.5rem] bg-purple-500 px-16 py-6 text-2xl font-black text-white shadow-[0_15px_40px_rgba(168,85,247,0.4)] active:scale-95 transition-all hover:bg-purple-400"
          >
            SIMULAR PAGO EXITOSO
          </button>
        </div>
      </div>
    );
  }

  // 4. MAIN MENU & CHECKOUT
  return (
    <div className="flex h-screen w-full flex-col bg-gray-950 text-white font-sans overflow-hidden select-none">
      
      {/* ── Immersive Header ── */}
      <header className="flex h-28 shrink-0 items-center justify-between px-10 bg-black/40 backdrop-blur-3xl border-b border-white/5 z-20 shadow-xl">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setView(view === "checkout" ? "menu" : "welcome")}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-white active:bg-white/10 transition-all border border-white/10 shadow-inner"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <div>
            <h1 className="text-4xl font-black tracking-tight">{view === "checkout" ? "Confirma tu Orden" : "Menú Principal"}</h1>
            <p className="text-lg text-gray-400 font-medium">Sucursal Centro</p>
          </div>
        </div>
        
        {view === "menu" && (
          <button 
            onClick={() => setView("checkout")}
            className="group relative flex items-center gap-4 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-5 text-2xl font-black text-white shadow-[0_15px_40px_rgba(168,85,247,0.4)] active:scale-95 transition-all overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[0%] transition-transform duration-300" />
            <ShoppingBag className="h-8 w-8 relative z-10" />
            <span className="relative z-10">Ver Orden (${total.toFixed(2)})</span>
            
            {cart.length > 0 && (
              <div className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 border-2 border-gray-900 text-sm">
                {cart.length}
              </div>
            )}
          </button>
        )}
      </header>

      {view === "menu" && (
        <div className="flex flex-1 overflow-hidden relative">
          {/* Subtle Background Elements */}
          <div className="absolute top-0 right-0 h-[600px] w-[600px] rounded-full bg-purple-900/10 blur-[150px] pointer-events-none" />

          {/* Categories Sidebar */}
          <aside className="w-[320px] shrink-0 overflow-y-auto border-r border-white/5 bg-black/20 backdrop-blur-md custom-scrollbar py-8 pl-8 pr-6 space-y-4 z-10">
            {categories?.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "w-full rounded-[2rem] px-8 py-6 text-left transition-all border shadow-lg group relative overflow-hidden",
                  activeCategory === cat.id 
                    ? "bg-purple-500 border-purple-400 scale-105" 
                    : "bg-white/5 border-white/5 active:bg-white/10 hover:border-white/20"
                )}
              >
                {activeCategory === cat.id && <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />}
                <span className={cn("relative z-10 text-2xl font-black", activeCategory === cat.id ? "text-white" : "text-gray-300 group-hover:text-white")}>
                  {cat.name}
                </span>
              </button>
            ))}
          </aside>

          {/* Menu Grid */}
          <main className="flex-1 overflow-y-auto p-10 custom-scrollbar z-10">
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-8">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item)} // Opens Item Modal
                  className="group relative flex flex-col overflow-hidden rounded-[2.5rem] border border-white/5 bg-gray-900/80 backdrop-blur-md text-left transition-all active:scale-95 active:border-purple-500/50 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:-translate-y-2"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-800">
                    <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: `url(${PLACEHOLDER_IMG})` }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-90" />
                    
                    {/* Price Tag */}
                    <div className="absolute top-4 right-4 rounded-2xl bg-black/60 backdrop-blur-xl px-5 py-2 border border-white/10 shadow-2xl">
                      <span className="text-xl font-black text-emerald-400">${item.price.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between p-8 pt-6 h-48">
                    <div>
                      <h3 className="text-3xl font-black leading-tight text-white line-clamp-2">{item.name}</h3>
                      <p className="mt-2 text-lg text-gray-400 line-clamp-2">{item.description || "Ingredientes frescos y de la más alta calidad."}</p>
                    </div>
                    
                    <div className="mt-4 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-white/5 border border-white/5 text-lg font-bold text-gray-300 group-hover:bg-purple-500 group-hover:border-purple-400 group-hover:text-white transition-all">
                      <Plus className="h-6 w-6" /> Toca para Agregar
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </main>
        </div>
      )}

      {/* Item Modifiers Modal (Overlays menu) */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-8 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex w-full max-w-5xl h-[80vh] overflow-hidden rounded-[3rem] bg-gray-900 border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)]">
            {/* Left Image */}
            <div className="w-1/2 relative bg-gray-800">
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${PLACEHOLDER_IMG})` }} />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-gray-900" />
            </div>
            {/* Right Content */}
            <div className="w-1/2 flex flex-col p-12 relative">
              <button onClick={() => setSelectedItem(null)} className="absolute top-8 right-8 h-12 w-12 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10">
                <X className="h-6 w-6 text-gray-400" />
              </button>
              
              <h2 className="text-5xl font-black mb-2">{selectedItem.name}</h2>
              <p className="text-2xl text-emerald-400 font-black mb-8">${selectedItem.price.toFixed(2)}</p>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-8">
                <div>
                  <h3 className="text-xl font-bold mb-4">Modificadores</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-purple-500/50 bg-purple-500/20 p-4 font-bold text-purple-400 flex justify-between">
                      <span>Leche de Almendra</span> <span>+$15</span>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 font-bold text-gray-300 flex justify-between opacity-50">
                      <span>Extra Shot</span> <span>+$10</span>
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => addToCart(selectedItem)}
                className="mt-8 w-full rounded-[2rem] bg-purple-500 py-6 text-2xl font-black text-white shadow-[0_15px_40px_rgba(168,85,247,0.4)] hover:bg-purple-400 active:scale-95 transition-all"
              >
                AGREGAR A LA ORDEN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Screen */}
      {view === "checkout" && (
        <main className="flex flex-1 flex-col items-center overflow-y-auto p-12 custom-scrollbar relative">
          <div className="w-full max-w-5xl space-y-10 z-10">
            <h2 className="text-5xl font-black text-center mb-16">Revisa tu Pedido</h2>
            
            <div className="space-y-6 bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-[3rem] shadow-2xl">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between border-b border-white/5 pb-6 last:border-0 last:pb-0">
                  <div className="flex-1 pr-6">
                    <h3 className="text-3xl font-bold mb-2">{item.name}</h3>
                    <p className="text-purple-400 text-2xl font-black">${item.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-6 bg-black/60 rounded-[2rem] p-3 border border-white/5 shadow-inner">
                    <button 
                      onClick={() => {
                        if (item.quantity === 1) setCart(prev => prev.filter(i => i.id !== item.id));
                        else setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i));
                      }}
                      className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 active:bg-white/20 text-white"
                    >
                      <Minus className="h-8 w-8" />
                    </button>
                    <span className="w-12 text-center text-4xl font-black">{item.quantity}</span>
                    <button 
                      onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))}
                      className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 active:bg-white/20 text-white"
                    >
                      <Plus className="h-8 w-8" />
                    </button>
                  </div>
                  <div className="w-40 text-right text-4xl font-black text-white">
                    ${(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="text-center py-20 text-gray-500 text-3xl font-bold flex flex-col items-center">
                  <ShoppingBag className="h-24 w-24 mb-6 opacity-20" />
                  No has agregado nada aún
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-4 bg-gray-900 border border-white/10 p-10 rounded-[3rem] shadow-2xl">
              <div className="flex justify-between w-full max-w-lg text-2xl text-gray-400 font-semibold">
                <span>Subtotal (Base)</span>
                <span>${(total / 1.16).toFixed(2)}</span>
              </div>
              <div className="flex justify-between w-full max-w-lg text-2xl text-purple-400/80 font-semibold">
                <span>IVA (16% Incluido)</span>
                <span>${(total - total / 1.16).toFixed(2)}</span>
              </div>
              <div className="w-full max-w-lg h-px bg-white/10 my-4" />
              <div className="flex justify-between w-full max-w-lg text-5xl font-black text-white items-end">
                <div>
                  <span className="block">Total</span>
                  <span className="text-sm text-gray-500 font-normal">IVA incluido</span>
                </div>
                <span className="text-emerald-400 text-6xl tracking-tighter">${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-8 justify-end pt-8">
              <button 
                onClick={() => setView("menu")}
                className="rounded-full bg-white/5 px-12 py-6 text-2xl font-bold text-white hover:bg-white/10 border border-white/10 transition-all active:scale-95"
              >
                Volver al Menú
              </button>
              <button 
                disabled={cart.length === 0}
                onClick={() => setView("qr_payment")}
                className="flex items-center gap-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-16 py-6 text-3xl font-black text-white shadow-[0_20px_50px_rgba(168,85,247,0.5)] active:scale-95 disabled:opacity-50 transition-all hover:-translate-y-1"
              >
                PAGAR ORDEN <ChevronRight className="h-8 w-8" />
              </button>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
