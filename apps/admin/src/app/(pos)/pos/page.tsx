"use client";

import { useState, useMemo, useEffect } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Button, Dialog, Input, toast, cn } from "@rabbitty/ui";
import { Clock, Wifi, Search, User, CreditCard, Banknote, QrCode, SplitSquareHorizontal, Trash2, ChevronLeft, Plus, Minus, Check, ChevronDown, CheckCircle2, AlertTriangle, Shield, Table2, ShoppingBag, Bike, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

// Placeholder for missing images
const PLACEHOLDER_IMG = "https://images.unsplash.com/photo-1544148103-0773bf10d330?q=80&w=1000&auto=format&fit=crop";

export default function PosPage() {
  const [time, setTime] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [voidingItem, setVoidingItem] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [managerPin, setManagerPin] = useState("");
  const [confirmClearCart, setConfirmClearCart] = useState(false);
  const [tableModal, setTableModal] = useState(false);
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY" | "DELIVERY">("DINE_IN");
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  const { data: categories } = trpc.pos.getCategories.useQuery(undefined, { retry: false });
  const { data: menuItems } = trpc.pos.getMenuItems.useQuery({}, { retry: false });
  const { data: tables } = trpc.pos.getTables.useQuery(undefined, { retry: false });

  // Auto-select first table when tables load if DINE_IN
  useEffect(() => {
    if (tables && tables.length > 0 && !selectedTableId && orderType === "DINE_IN") {
      setSelectedTableId(tables[0].id);
    }
  }, [tables, selectedTableId, orderType]);

  const verifyPinMutation = trpc.staff.verifyAdminPin.useMutation({
    onSuccess: () => {
      if (voidingItem) {
        setCart((prev) => prev.filter((i) => i.id !== voidingItem.id));
        toast.success(`"${voidingItem.name}" eliminado de la orden`);
        setVoidingItem(null);
        setManagerPin("");
        setVoidReason("");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const voidItemMutation = trpc.pos.voidItem.useMutation({
    onSuccess: () => {
      setCart((prev) => prev.filter((i) => i.id !== voidingItem.id));
      toast.success(`"${voidingItem.name}" anulado correctamente`);
      setVoidingItem(null);
      setManagerPin("");
      setVoidReason("");
    },
    onError: (err) => toast.error(err.message),
  });

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
        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar z-10 flex flex-col">
          {/* Top Category Pills */}
          {categories && categories.length > 0 && !search && (
            <div className="flex gap-2 overflow-x-auto pb-3 mb-4 custom-scrollbar shrink-0">
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className={cn(
                  "shrink-0 rounded-full px-5 py-2 text-xs font-bold transition-all duration-300 cursor-pointer",
                  !activeCategory
                    ? "bg-cyan-500 text-gray-950 shadow-[0_4px_14px_rgba(6,182,212,0.4)]"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5"
                )}
              >
                Todos los Platillos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "shrink-0 rounded-full px-5 py-2 text-xs font-bold transition-all duration-300 cursor-pointer",
                    activeCategory === cat.id
                      ? "bg-cyan-500 text-gray-950 shadow-[0_4px_14px_rgba(6,182,212,0.4)]"
                      : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className="group relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-[2rem] bg-gray-900 border border-white/5 p-1 text-left transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.6)] hover:border-cyan-500/40 active:scale-95 cursor-pointer"
              >
                {/* Big Image Top */}
                <div className="relative h-[65%] w-full rounded-[1.75rem] overflow-hidden bg-gray-800">
                  <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url(${PLACEHOLDER_IMG})` }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-80" />
                  
                  {/* Subtle centered '+' in fade mode */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/30 group-hover:text-white/90 group-hover:bg-cyan-500/20 group-hover:border-cyan-500/40 group-hover:scale-110 transition-all duration-300 shadow-2xl">
                      <Plus className="h-5 w-5" />
                    </div>
                  </div>

                  {/* Price Tag Badge */}
                  <div className="absolute top-3 right-3 rounded-full bg-black/60 backdrop-blur-md px-3 py-1.5 border border-white/10 shadow-xl">
                    <span className="text-sm font-black text-emerald-400">${item.price.toFixed(2)}</span>
                  </div>
                </div>
                
                {/* Content Bottom (clean without the button bar) */}
                <div className="flex flex-col justify-center h-[35%] p-4 pt-2">
                  <h3 className="text-base font-black leading-tight text-white line-clamp-2 group-hover:text-cyan-400 transition-colors">{item.name}</h3>
                  <p className="mt-1 text-[11px] text-gray-500 font-medium line-clamp-1">{item.description || "Delicioso y preparado al momento."}</p>
                </div>
              </button>
            ))}
          </div>
        </main>

        {/* Right: Massive Cart / Ticket Panel */}
        <aside className="w-[420px] shrink-0 bg-gray-950/80 backdrop-blur-3xl border-l border-white/10 flex flex-col z-20 shadow-[-20px_0_50px_rgba(0,0,0,0.5)]">
          {/* Cart Header with Table Selector & Order Type */}
          <div className="flex flex-col border-b border-white/10 p-4 bg-black/40 gap-3">
            <div className="flex items-center justify-between">
              {/* Table Selector Button */}
              <button
                type="button"
                onClick={() => setTableModal(true)}
                className="flex items-center gap-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 px-3.5 py-2 transition-all cursor-pointer group"
                title="Cambiar mesa o salón"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  {orderType === "DINE_IN" ? (
                    <Table2 className="h-4 w-4" />
                  ) : orderType === "TAKEAWAY" ? (
                    <ShoppingBag className="h-4 w-4" />
                  ) : (
                    <Bike className="h-4 w-4" />
                  )}
                </div>
                <div className="text-left">
                  <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1">
                    {orderType === "DINE_IN" ? "Mesa Asignada" : "Servicio"}
                    <ChevronDown className="h-3 w-3 text-cyan-400 group-hover:translate-y-0.5 transition-transform" />
                  </div>
                  <div className="text-sm font-black text-white">
                    {orderType === "DINE_IN"
                      ? (() => {
                          const curr = tables?.find((t) => t.id === selectedTableId);
                          return curr ? `Mesa ${curr.number} (${curr.location || "Salón"})` : "Seleccionar Mesa";
                        })()
                      : orderType === "TAKEAWAY"
                      ? "Para Llevar"
                      : "A Domicilio"}
                  </div>
                </div>
              </button>

              <button 
                onClick={() => {
                  if (cart.length > 0) setConfirmClearCart(true);
                }} 
                disabled={cart.length === 0}
                title="Vaciar orden actual"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* Order Type Segmented Control */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/60 border border-white/5">
              <button
                type="button"
                onClick={() => {
                  setOrderType("DINE_IN");
                  if (!selectedTableId && tables && tables.length > 0) {
                    setSelectedTableId(tables[0].id);
                  }
                }}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                  orderType === "DINE_IN"
                    ? "bg-cyan-500 text-gray-950 shadow-md"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <UtensilsCrossed className="h-3.5 w-3.5" /> Aquí
              </button>

              <button
                type="button"
                onClick={() => {
                  setOrderType("TAKEAWAY");
                  setSelectedTableId(null);
                }}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                  orderType === "TAKEAWAY"
                    ? "bg-purple-500 text-white shadow-md"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <ShoppingBag className="h-3.5 w-3.5" /> Llevar
              </button>

              <button
                type="button"
                onClick={() => {
                  setOrderType("DELIVERY");
                  setSelectedTableId(null);
                }}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                  orderType === "DELIVERY"
                    ? "bg-emerald-500 text-gray-950 shadow-md"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Bike className="h-3.5 w-3.5" /> Domicilio
              </button>
            </div>
          </div>

          {/* Cart Items Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {cart.map((item) => (
              <div key={item.id} className="group flex items-center justify-between rounded-[1.5rem] bg-gray-900 border border-white/5 p-4 shadow-lg transition-all hover:border-white/20 gap-3">
                <div className="flex-1">
                  <h4 className="text-base font-black text-white leading-tight">{item.name}</h4>
                  <div className="mt-0.5 text-base font-black text-emerald-400">${item.price.toFixed(2)}</div>
                  {item.quantity > 1 && (
                    <div className="text-xs text-gray-500 font-bold mt-0.5">Subtotal: ${(item.price * item.quantity).toFixed(2)}</div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Dedicated Delete Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setVoidingItem(item);
                      setVoidReason("");
                      setManagerPin("");
                    }}
                    title="Eliminar artículo (Requiere PIN)"
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all active:scale-90 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  {/* Stepper */}
                  <div className="flex items-center rounded-xl bg-black border border-white/10 p-1 shrink-0 shadow-inner">
                    <button
                      type="button"
                      onClick={() => {
                        setVoidingItem({ ...item, isDecrease: item.quantity > 1 });
                        setVoidReason("");
                        setManagerPin("");
                      }}
                      title="Disminuir / Eliminar (Requiere PIN)"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-gray-400 hover:bg-red-500 hover:text-white transition-all active:scale-90 cursor-pointer"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="px-3 text-base font-black text-white">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white hover:bg-cyan-500 hover:text-black transition-all active:scale-90 cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
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

          {/* Cart Footer - Massive Pay Area with Tax-Included Breakdown */}
          <div className="border-t border-white/10 bg-gray-950 p-6 pt-4 space-y-5 rounded-t-3xl shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
            <div className="space-y-2">
              <div className="flex justify-between text-base font-bold text-gray-400">
                <span>Subtotal (Base)</span>
                <span>${(total / 1.16).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-cyan-400/80">
                <span>IVA (16% Incluido)</span>
                <span>${(total - total / 1.16).toFixed(2)}</span>
              </div>
              <div className="my-3 h-px w-full bg-white/10" />
              <div className="flex justify-between items-end">
                <div>
                  <span className="text-2xl font-bold text-white block">Total</span>
                  <span className="text-xs text-gray-500 font-semibold">Impuestos incluidos</span>
                </div>
                <span className="text-[2.5rem] font-black text-emerald-400 leading-none tracking-tighter">
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Quick Payment Methods */}
            <div className="grid grid-cols-4 gap-3">
              <button className="group flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/5 py-4 border border-white/10 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all active:scale-95 cursor-pointer">
                <Banknote className="h-6 w-6 text-gray-400 group-hover:text-emerald-400" />
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 group-hover:text-emerald-400">Efectivo</span>
              </button>
              <button className="group flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/5 py-4 border border-white/10 hover:bg-blue-500/20 hover:border-blue-500/50 transition-all active:scale-95 cursor-pointer">
                <CreditCard className="h-6 w-6 text-gray-400 group-hover:text-blue-400" />
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 group-hover:text-blue-400">Tarjeta</span>
              </button>
              <button className="group flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/5 py-4 border border-white/10 hover:bg-purple-500/20 hover:border-purple-500/50 transition-all active:scale-95 cursor-pointer">
                <QrCode className="h-6 w-6 text-gray-400 group-hover:text-purple-400" />
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 group-hover:text-purple-400">QR Bunz</span>
              </button>
              <button className="group flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/5 py-4 border border-white/10 hover:bg-orange-500/20 hover:border-orange-500/50 transition-all active:scale-95 cursor-pointer">
                <SplitSquareHorizontal className="h-6 w-6 text-gray-400 group-hover:text-orange-400" />
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 group-hover:text-orange-400">Dividir</span>
              </button>
            </div>

            {/* Massive Checkout Button */}
            <button 
              disabled={cart.length === 0}
              className="relative w-full overflow-hidden rounded-[2rem] bg-cyan-500 py-6 text-2xl font-black text-gray-950 shadow-[0_15px_40px_rgba(6,182,212,0.4)] transition-all hover:bg-cyan-400 active:scale-95 disabled:opacity-50 disabled:shadow-none group cursor-pointer"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-[100%] group-hover:translate-y-[0%] transition-transform duration-300 ease-out" />
              <span className="relative z-10 flex items-center justify-center gap-3">
                <Check className="h-8 w-8" /> COBRAR ORDEN (${total.toFixed(2)})
              </span>
            </button>
          </div>
        </aside>
      </div>

      {/* Modal de Confirmación para Vaciar Orden */}
      <Dialog open={confirmClearCart} onClose={() => setConfirmClearCart(false)} title="¿Vaciar la orden actual?">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>Esta acción eliminará todos los ({cart.reduce((s, i) => s + i.quantity, 0)}) platillos seleccionados de la cuenta actual.</span>
          </div>
          <p className="text-sm text-gray-300">
            ¿Confirmas que deseas cancelar y vaciar los elementos de esta comanda?
          </p>
          <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
            <Button variant="secondary" onClick={() => setConfirmClearCart(false)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={() => {
                setCart([]);
                setConfirmClearCart(false);
              }}
            >
              Sí, Vaciar Orden
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Modal de Anulación / Eliminación con PIN de Gerente */}
      <Dialog
        open={!!voidingItem}
        onClose={() => { setVoidingItem(null); setManagerPin(""); setVoidReason(""); }}
        title={voidingItem?.isDecrease ? "Autorización para Disminuir Cantidad" : "Autorización para Eliminar Artículo"}
      >
        {voidingItem && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
              <Shield className="h-5 w-5 shrink-0" />
              <span>
                {voidingItem.isDecrease
                  ? "Disminuir la cantidad de un platillo en la comanda requiere autorización de Gerente."
                  : "Eliminar o anular un platillo de la comanda requiere motivo y PIN de Gerente / Administrador."}
              </span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-white">{voidingItem.name}</p>
                <p className="text-xs text-gray-400">Precio unitario: ${voidingItem.price.toFixed(2)}</p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white/10 text-gray-300">
                Cantidad actual: {voidingItem.quantity}
              </span>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-cyan-400 block mb-1">
                Motivo de Eliminación / Anulación *
              </label>
              <Input
                placeholder="Ej. Cliente cambió de opinión / Error de captura / No le gustó"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1">
                PIN de Administrador / Gerente (4 dígitos) *
              </label>
              <input
                type="password"
                maxLength={4}
                placeholder="••••"
                value={managerPin}
                onChange={(e) => setManagerPin(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-xl border border-white/10 bg-black/60 p-3 text-center text-2xl tracking-[0.5em] text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
              <Button variant="secondary" onClick={() => { setVoidingItem(null); setManagerPin(""); setVoidReason(""); }}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (voidingItem && managerPin.length === 4 && voidReason.trim()) {
                    if (voidingItem.isSent) {
                      voidItemMutation.mutate({
                        id: voidingItem.id,
                        reason: voidReason.trim(),
                        managerPin,
                      });
                    } else {
                      verifyPinMutation.mutate({ pin: managerPin });
                    }
                  }
                }}
                disabled={
                  verifyPinMutation.isPending ||
                  voidItemMutation.isPending ||
                  managerPin.length !== 4 ||
                  !voidReason.trim()
                }
              >
                {verifyPinMutation.isPending || voidItemMutation.isPending ? "Validando..." : "Confirmar Eliminación"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Modal para Selección / Cambio de Mesa */}
      <Dialog
        open={tableModal}
        onClose={() => setTableModal(false)}
        title="Seleccionar Mesa o Tipo de Servicio"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setOrderType("TAKEAWAY");
                setSelectedTableId(null);
                setTableModal(false);
                toast.success("Modo: Pedido Para Llevar");
              }}
              className={cn(
                "flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer text-left",
                orderType === "TAKEAWAY"
                  ? "bg-purple-500/20 border-purple-500 text-purple-300"
                  : "bg-white/5 border-white/10 hover:bg-white/10 text-gray-300"
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 font-bold text-lg">
                🛍️
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">Para Llevar</h4>
                <p className="text-[11px] text-gray-400">Sin asignar mesa</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setOrderType("DELIVERY");
                setSelectedTableId(null);
                setTableModal(false);
                toast.success("Modo: Entrega a Domicilio");
              }}
              className={cn(
                "flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer text-left",
                orderType === "DELIVERY"
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                  : "bg-white/5 border-white/10 hover:bg-white/10 text-gray-300"
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-lg">
                🛵
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">A Domicilio</h4>
                <p className="text-[11px] text-gray-400">Entrega externa</p>
              </div>
            </button>
          </div>

          <div className="pt-2 border-t border-white/5">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
              <Table2 className="h-4 w-4 text-cyan-400" /> Mesas del Restaurante
            </h4>

            {tables && tables.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto custom-scrollbar p-1">
                {tables.map((t) => {
                  const isSelected = selectedTableId === t.id && orderType === "DINE_IN";
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTableId(t.id);
                        setOrderType("DINE_IN");
                        setTableModal(false);
                        toast.success(`Mesa ${t.number} asignada`);
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer active:scale-95",
                        isSelected
                          ? "bg-cyan-500 text-gray-950 border-cyan-400 shadow-[0_4px_20px_rgba(6,182,212,0.4)]"
                          : "bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20"
                      )}
                    >
                      <span className="text-lg font-black leading-none mb-1">Mesa {t.number}</span>
                      <span className={cn("text-[10px] font-bold", isSelected ? "text-gray-900" : "text-gray-400")}>
                        {t.location || "Salón"} • 👤 {t.capacity}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500 text-xs">
                No hay mesas registradas en esta sucursal.
              </div>
            )}
          </div>

          <div className="flex justify-end pt-3 border-t border-white/5">
            <Button variant="secondary" onClick={() => setTableModal(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
