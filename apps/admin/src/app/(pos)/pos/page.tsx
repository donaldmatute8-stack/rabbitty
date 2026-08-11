"use client";

import { useState, useMemo, useEffect } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Button, cn } from "@rabbitty/ui";
import { Clock, Wifi, Search, User, CreditCard, Banknote, QrCode, SplitSquareHorizontal, Trash2, ChevronLeft, Plus, Minus, Check, ChevronDown, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

// Placeholder for missing images
const PLACEHOLDER_IMG = "https://images.unsplash.com/photo-1544148103-0773bf10d330?q=80&w=1000&auto=format&fit=crop";

export default function PosPage() {
  const [time, setTime] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<any[]>([]);

  const { data: categories } = trpc.pos.getCategories.useQuery(undefined, { retry: false });
  const { data: menuItems } = trpc.pos.getMenuItems.useQuery({}, { retry: false });

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (categories && categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].id);
    }
  }, [categories, activeCategory]);

  const filteredItems = useMemo(() => {
    if (!menuItems) return [];
    let items = menuItems;
    if (search) {
      items = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
    } else if (activeCategory) {
      items = items.filter((i) => i.categoryId === activeCategory);
    }
    return items;
  }, [menuItems, activeCategory, search]);

  const addToCart = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.id);
      if (existing) {
        return prev.map((i) => (i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { id: Math.random().toString(36).substr(2, 9), menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) => prev.map((i) => {
      if (i.id === id) {
        const newQ = i.quantity + delta;
        return newQ > 0 ? { ...i, quantity: newQ } : i;
      }
      return i;
    }));
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="flex h-screen w-full flex-col bg-gray-950 text-white overflow-hidden select-none font-sans">
      
      {/* ── Top Header ── */}
      <header className="flex h-[88px] shrink-0 items-center justify-between bg-black/60 backdrop-blur-2xl px-6 border-b border-white/5 relative z-20">
        <div className="flex items-center gap-6">
          <Link href="/table-layout" className="flex items-center gap-3 rounded-2xl bg-white/5 p-2 pr-6 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer shadow-lg active:scale-95">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_20px_rgba(6,182,212,0.5)]">
              <ChevronLeft className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold mb-0.5">Rabbitty OS</div>
              <div className="font-black text-lg leading-none tracking-wide">POS Touch</div>
            </div>
          </Link>

          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2 border border-emerald-500/20 shadow-[inset_0_0_12px_rgba(16,185,129,0.1)]">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </div>
            <span className="text-sm font-bold text-emerald-400 uppercase tracking-widest">Online</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative group">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 opacity-0 group-focus-within:opacity-30 blur transition duration-500"></div>
            <div className="relative flex items-center bg-gray-900 border border-white/10 rounded-full h-14 w-80 px-4 shadow-inner">
              <Search className="h-5 w-5 text-gray-400 mr-3 shrink-0" />
              <input 
                type="text" 
                placeholder="Buscar platillo (Toca para escribir)..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-lg text-white placeholder-gray-500 focus:outline-none"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10">
            <Clock className="h-5 w-5 text-gray-400" />
            <span className="text-xl font-bold tracking-wider">{time}</span>
          </div>
          
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 text-pink-400 shadow-[inset_0_0_20px_rgba(236,72,153,0.2)]">
            <User className="h-6 w-6" />
          </div>
        </div>
      </header>

      {/* ── Main Workspace ── */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Background Gradients */}
        <div className="absolute top-[-20%] right-[30%] h-[800px] w-[800px] rounded-full bg-cyan-900/20 blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] h-[800px] w-[800px] rounded-full bg-blue-900/20 blur-[150px] pointer-events-none" />

        {/* Left: Massive Categories Sidebar */}
        {!search && (
          <aside className="w-[140px] shrink-0 overflow-y-auto bg-black/40 backdrop-blur-md border-r border-white/5 p-3 flex flex-col gap-3 custom-scrollbar z-10">
            {categories?.map((cat, i) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-3 rounded-[24px] p-4 h-32 transition-all duration-300 group",
                  activeCategory === cat.id 
                    ? "bg-cyan-500 shadow-[0_10px_30px_rgba(6,182,212,0.4)] border-none scale-105 z-10" 
                    : "bg-gray-900/80 border border-white/5 hover:bg-gray-800 hover:border-white/20 active:scale-95"
                )}
              >
                {/* Simulated Category Icon (based on index) */}
                <div className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full text-2xl transition-transform duration-300",
                  activeCategory === cat.id ? "bg-white/20 scale-110" : "bg-white/5 group-hover:bg-white/10"
                )}>
                  {["☕", "🍔", "🍕", "🥗", "🍰", "🍺"][i % 6]}
                </div>
                
                <span className={cn(
                  "text-[13px] font-black uppercase tracking-wider text-center leading-tight line-clamp-2",
                  activeCategory === cat.id ? "text-gray-950" : "text-gray-400 group-hover:text-white"
                )}>
                  {cat.name}
                </span>
              </button>
            ))}
          </aside>
        )}

        {/* Center: Hero Bento Grid */}
        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar z-10">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredItems.map((item, i) => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className="group relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-[2rem] bg-gray-900 border border-white/5 p-1 text-left transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)] hover:border-cyan-500/50 active:scale-95"
              >
                {/* Big Image Top */}
                <div className="relative h-[55%] w-full rounded-[1.75rem] overflow-hidden bg-gray-800">
                  <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: `url(${PLACEHOLDER_IMG})` }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-80" />
                  
                  {/* Price Tag Badge */}
                  <div className="absolute top-3 right-3 rounded-full bg-black/60 backdrop-blur-md px-3 py-1.5 border border-white/10 shadow-xl">
                    <span className="text-sm font-black text-emerald-400">${item.price.toFixed(2)}</span>
                  </div>
                </div>
                
                {/* Content Bottom */}
                <div className="flex flex-col justify-between h-[45%] p-4 pt-3">
                  <div>
                    <h3 className="text-lg font-black leading-tight text-white line-clamp-2 group-hover:text-cyan-400 transition-colors">{item.name}</h3>
                    <p className="mt-1 text-[11px] text-gray-500 font-medium line-clamp-2">{item.description || "Delicioso y preparado al momento."}</p>
                  </div>
                  
                  {/* Add Button Indicator */}
                  <div className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/5 text-sm font-bold text-gray-400 group-hover:bg-cyan-500/20 group-hover:border-cyan-500/50 group-hover:text-cyan-400 transition-all">
                    <Plus className="h-4 w-4" /> Agregar
                  </div>
                </div>
              </button>
            ))}
          </div>
        </main>

        {/* Right: Massive Cart / Ticket Panel */}
        <aside className="w-[420px] shrink-0 bg-gray-950/80 backdrop-blur-3xl border-l border-white/10 flex flex-col z-20 shadow-[-20px_0_50px_rgba(0,0,0,0.5)]">
          {/* Cart Header */}
          <div className="flex h-[88px] items-center justify-between border-b border-white/10 px-6 bg-black/40">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">
                <div className="h-2 w-2 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4]"></div>
                Orden Actual
              </div>
              <div className="text-2xl font-black text-white flex items-center gap-3">
                Mesa 4 
                <span className="rounded-md bg-white/10 px-2 py-0.5 text-sm text-gray-300 border border-white/10">Para Llevar</span>
              </div>
            </div>
            <button 
              onClick={() => setCart([])} 
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all active:scale-95"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>

          {/* Cart Items Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {cart.map((item) => (
              <div key={item.id} className="group flex flex-col rounded-[1.5rem] bg-gray-900 border border-white/5 p-4 shadow-lg transition-all hover:border-white/20">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="text-lg font-black text-white leading-tight">{item.name}</h4>
                    <div className="mt-1 text-lg font-black text-emerald-400">${item.price.toFixed(2)}</div>
                    {/* Mock Modifier Tags */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-lg bg-black px-2 py-1 text-[10px] font-bold text-gray-400 border border-white/5 uppercase">Sin Cebolla</span>
                      <span className="rounded-lg bg-purple-500/20 px-2 py-1 text-[10px] font-bold text-purple-400 border border-purple-500/30 uppercase">+ Extra Queso</span>
                    </div>
                  </div>
                  
                  {/* Huge Stepper */}
                  <div className="flex flex-col items-center rounded-[1.25rem] bg-black border border-white/10 p-1 shrink-0 shadow-inner">
                    <button onClick={() => updateQuantity(item.id, 1)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white hover:bg-cyan-500 hover:text-black transition-all active:scale-90">
                      <Plus className="h-5 w-5" />
                    </button>
                    <span className="py-2 text-xl font-black text-white">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, -1)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-gray-400 hover:bg-red-500 hover:text-white transition-all active:scale-90">
                      <Minus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {cart.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center px-8 opacity-50">
                <div className="h-24 w-24 rounded-full border-4 border-dashed border-gray-700 flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-10 w-10 text-gray-600" />
                </div>
                <h3 className="text-2xl font-black text-gray-500 mb-2">Orden Vacía</h3>
                <p className="text-sm font-medium text-gray-600">Toca cualquier platillo para agregarlo a la cuenta.</p>
              </div>
            )}
          </div>

          {/* Cart Footer - Massive Pay Area */}
          <div className="border-t border-white/10 bg-gray-950 p-6 pt-4 space-y-5 rounded-t-3xl shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
            <div className="space-y-2">
              <div className="flex justify-between text-base font-bold text-gray-400">
                <span>Subtotal</span>
                <span>${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-gray-400">
                <span>IVA (16%)</span>
                <span>${(total * 0.16).toFixed(2)}</span>
              </div>
              <div className="my-3 h-px w-full bg-white/10" />
              <div className="flex justify-between items-end">
                <span className="text-2xl font-bold text-white">Total</span>
                <span className="text-[2.5rem] font-black text-emerald-400 leading-none tracking-tighter">
                  ${(total * 1.16).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Quick Payment Methods */}
            <div className="grid grid-cols-4 gap-3">
              <button className="group flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/5 py-4 border border-white/10 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all active:scale-95">
                <Banknote className="h-6 w-6 text-gray-400 group-hover:text-emerald-400" />
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 group-hover:text-emerald-400">Efectivo</span>
              </button>
              <button className="group flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/5 py-4 border border-white/10 hover:bg-blue-500/20 hover:border-blue-500/50 transition-all active:scale-95">
                <CreditCard className="h-6 w-6 text-gray-400 group-hover:text-blue-400" />
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 group-hover:text-blue-400">Tarjeta</span>
              </button>
              <button className="group flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/5 py-4 border border-white/10 hover:bg-purple-500/20 hover:border-purple-500/50 transition-all active:scale-95">
                <QrCode className="h-6 w-6 text-gray-400 group-hover:text-purple-400" />
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 group-hover:text-purple-400">QR Bunz</span>
              </button>
              <button className="group flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/5 py-4 border border-white/10 hover:bg-orange-500/20 hover:border-orange-500/50 transition-all active:scale-95">
                <SplitSquareHorizontal className="h-6 w-6 text-gray-400 group-hover:text-orange-400" />
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 group-hover:text-orange-400">Dividir</span>
              </button>
            </div>

            {/* Massive Checkout Button */}
            <button 
              disabled={cart.length === 0}
              className="relative w-full overflow-hidden rounded-[2rem] bg-cyan-500 py-6 text-2xl font-black text-gray-950 shadow-[0_15px_40px_rgba(6,182,212,0.4)] transition-all hover:bg-cyan-400 active:scale-95 disabled:opacity-50 disabled:shadow-none group"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-[100%] group-hover:translate-y-[0%] transition-transform duration-300 ease-out" />
              <span className="relative z-10 flex items-center justify-center gap-3">
                <Check className="h-8 w-8" /> COBRAR ORDEN
              </span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
