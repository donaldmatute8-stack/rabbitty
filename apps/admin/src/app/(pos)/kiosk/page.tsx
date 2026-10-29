"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { trpc } from "../../../lib/trpc-client";
import { QRCodeSVG } from "qrcode.react";
import QRDiscovery from "@/components/QRDiscovery";
import { cn, useWakeLock } from "@rabbitty/ui";
import { ShoppingBag, ChevronRight, CheckCircle2, ChevronLeft, Minus, Plus, Scan, X, QrCode, Lock, KeyRound, ArrowRight } from "lucide-react";

const PLACEHOLDER_IMG = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=1000&auto=format&fit=crop";
const BG_VIDEO_PLACEHOLDER = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=2574&auto=format&fit=crop";

export default function KioskPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [view, setView] = useState<"welcome" | "menu" | "checkout" | "qr_payment" | "success">("welcome");
  const [intent, setIntent] = useState<{ orderId: string; intentId: string; payUrl: string; total: number; claimToken?: string } | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [adminPinModal, setAdminPinModal] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [showKioskQrModal, setShowKioskQrModal] = useState(false);

  // Keep screen awake (WakeLock API) for iPad / Kiosk stands
  useWakeLock();

  // Query restaurant/branch info for the QR
  const { data: ticketContext } = trpc.printing.getTicketData.useQuery(undefined, { retry: false });

  // Idle Timer (90 seconds auto-reset to welcome screen if abandoned)
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (view !== "welcome") {
      idleTimerRef.current = setTimeout(() => {
        setCart([]);
        setSelectedItem(null);
        setView("welcome");
      }, 90_000); // 90 seconds
    }
  }, [view]);

  useEffect(() => {
    resetIdleTimer();
    const handleUserInteraction = () => resetIdleTimer();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") resetIdleTimer();
    };
    window.addEventListener("pointerdown", handleUserInteraction);
    window.addEventListener("keydown", handleUserInteraction);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      window.removeEventListener("pointerdown", handleUserInteraction);
      window.removeEventListener("keydown", handleUserInteraction);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [resetIdleTimer]);

  const kioskIntentMutation = trpc.pos.createStripeChargeIntent.useMutation();
  const kioskIntentCancel = trpc.payments.cancelPaymentIntent.useMutation();
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
    resetIdleTimer();
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
        className="flex h-dvh w-full flex-col items-center justify-center bg-gray-950 text-white select-none cursor-pointer relative overflow-hidden group"
        onClick={() => {
          if (categories && categories.length > 0) setActiveCategory(categories[0].id);
          setView("menu");
        }}
      >
        <div className="absolute inset-0 bg-cover bg-center opacity-40 transition-transform duration-[10s] group-hover:scale-110" style={{ backgroundImage: `url(${BG_VIDEO_PLACEHOLDER})` }} />
        <div className="absolute inset-0 bg-linear-to-t from-black via-black/60 to-transparent" />
        
        {/* Discreet Staff Exit Button (Protected) */}
        <div className="absolute top-6 left-6 z-30">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setAdminPin("");
              setPinError(false);
              setAdminPinModal(true);
            }}
            className="flex items-center justify-center h-10 w-10 rounded-full bg-black/40 hover:bg-black/80 border border-white/10 text-white/30 hover:text-white/80 transition-all cursor-pointer backdrop-blur-md"
            title="Acceso Personal / Salir"
          >
            <Lock className="h-4 w-4" />
          </button>
        </div>

        {/* Floating QR Neón Check-in Button */}
        <div className="absolute top-6 right-6 z-30">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowKioskQrModal(true);
            }}
            className="flex items-center gap-3 rounded-full bg-black/70 hover:bg-pink-500/20 px-6 py-3 border border-pink-500/40 text-pink-300 text-base font-black transition-all cursor-pointer backdrop-blur-xl shadow-[0_0_30px_rgba(236,72,153,0.3)] active:scale-95 group/qr"
          >
            <QrCode className="h-6 w-6 text-pink-400 group-hover/qr:scale-110 transition-transform animate-pulse" />
            <span>🐰 Escanea para ganar Bunz</span>
          </button>
        </div>

        <div className="relative z-10 flex flex-col items-center text-center px-12">
          <div className="h-40 w-40 rounded-[2.5rem] bg-black/90 border border-white/20 flex items-center justify-center mb-10 shadow-[0_0_80px_rgba(236,72,153,0.35)] backdrop-blur-2xl transform transition-transform duration-500 group-hover:-translate-y-4">
            <img
              src="/Ra.png"
              alt="Rabbitty Ra"
              className="h-28 w-28 object-contain drop-shadow-[0_0_25px_rgba(236,72,153,0.5)] select-none"
            />
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
      <div className="flex h-dvh w-full flex-col items-center justify-center bg-gray-950 text-white select-none relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-purple-500/20 via-black to-pink-500/20" />
        
        <div className="relative z-10 flex flex-col items-center text-center px-12 max-w-3xl">
          <div className="h-48 w-48 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center mb-10 shadow-[0_0_100px_rgba(16,185,129,0.3)]">
            <CheckCircle2 className="h-24 w-24 text-emerald-400" />
          </div>
          <h1 className="text-7xl font-black mb-6 tracking-tight">¡Orden Pagada!</h1>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-4xl p-10 w-full mb-12">
            <p className="text-2xl text-gray-400 font-medium mb-2">Tu número de orden es</p>
            <p className="text-[6rem] font-black text-emerald-400 leading-none">842</p>
          </div>
          
          {intent?.claimToken && (
            <div className="mb-12 flex flex-col items-center gap-4">
              <p className="text-2xl text-pink-300 font-black">🎁 Escanea para llevar tus Bunz</p>
              <div className="bg-white p-5 rounded-[2rem] shadow-[0_0_60px_rgba(236,72,153,0.3)]">
                <QRDiscovery
                  value={`https://app.rabbitty.me/scan?claimToken=${intent.claimToken}`}
                  variant="rabbitter"
                  size={200}
                  revealMode="immediate"
                  surfaceKey="kiosk-claim"
                />
              </div>
              <p className="text-sm text-gray-500 max-w-md">Apunta la cámara de tu teléfono — tus Bunz se acreditan al instante en tu cuenta.</p>
            </div>
          )}
          <button 
            onClick={() => { setCart([]); setIntent(null); setView("welcome"); }}
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
    // ── Polling del intent real (Rabbitty Pay) ──
    useEffect(() => {
      if (!intent) return;
      const poll = setInterval(async () => {
        try {
          const inputStr = encodeURIComponent(JSON.stringify({ "0": { intentId: intent.intentId } }));
          const res = await fetch(`/api/trpc/payments.getPaymentIntent?batch=1&input=${inputStr}`);
          const data = await res.json();
          const st = data?.[0]?.result?.data?.json?.status;
          if (st === "SUCCEEDED") {
            clearInterval(poll);
            setView("success");
          } else if (st === "CANCELED" || st === "FAILED") {
            clearInterval(poll);
            setPayError("El pago fue cancelado. Vuelve a intentar.");
            setView("checkout");
          }
        } catch { /* reintenta */ }
      }, 2500);
      return () => clearInterval(poll);
    }, [intent]);

    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center bg-gray-950 text-white select-none relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-tr from-purple-900/30 to-black" />

        <header className="absolute top-0 left-0 w-full p-8 flex justify-between items-center z-10">
          <button
            onClick={async () => {
              try { await kioskIntentCancel?.mutateAsync({ intentId: intent?.intentId || "", reason: "Kiosko: cliente regresó" }); } catch {}
              setIntent(null);
              setView("checkout");
            }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20 transition-all border border-white/20"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <div className="text-3xl font-black text-purple-400">${(intent?.total ?? total).toFixed(2)}</div>
        </header>

        <div className="relative z-10 flex flex-col items-center text-center max-w-3xl">
          <h1 className="text-5xl font-black mb-4">Escanea para Pagar</h1>
          <p className="text-2xl text-gray-400 mb-10">Con la App Rabbitty o la cámara de tu teléfono — pagas desde tu celular y ganas Bunz.</p>

          {intent ? (
            <div className="bg-white p-6 rounded-[3rem] shadow-[0_0_100px_rgba(168,85,247,0.35)] mb-10">
              <QRDiscovery
                value={`rabbitty://pay?intent=${intent.intentId}`}
                variant="rabbitter"
                size={280}
                revealMode="immediate"
                surfaceKey="kiosk-pay"
              />
            </div>
          ) : (
            <div className="w-70 h-70 flex items-center justify-center mb-10">
              <div className="w-14 h-14 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
            </div>
          )}

          <p className="text-lg text-gray-500 font-mono mb-6 break-all max-w-2xl">{intent?.payUrl}</p>

          <div className="flex items-center gap-3 text-xl text-purple-300 font-bold">
            <span className="w-3 h-3 rounded-full bg-purple-400 animate-pulse" />
            Esperando confirmación de pago…
          </div>

          {payError && <p className="mt-4 text-rose-400 font-bold">{payError}</p>}
        </div>
      </div>
    );
  }

  // 4. MAIN MENU & CHECKOUT
  return (
    <div className="flex h-dvh w-full flex-col bg-gray-950 text-white font-sans overflow-hidden select-none">
      
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
        
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowKioskQrModal(true)}
            className="flex items-center gap-3 rounded-full bg-white/5 hover:bg-pink-500/20 px-6 py-4 border border-pink-500/30 text-pink-300 text-lg font-black transition-all cursor-pointer backdrop-blur-xl shadow-[0_0_25px_rgba(236,72,153,0.2)] active:scale-95"
          >
            <QrCode className="h-6 w-6 text-pink-400 animate-pulse" />
            <span className="hidden sm:inline">🐰 QR Bunz</span>
          </button>

          {view === "menu" && (
            <button 
              onClick={() => setView("checkout")}
              className="group relative flex items-center gap-4 rounded-full bg-linear-to-r from-purple-600 to-pink-600 px-8 py-5 text-2xl font-black text-white shadow-[0_15px_40px_rgba(168,85,247,0.4)] active:scale-95 transition-all overflow-hidden cursor-pointer"
            >
              <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-[0%] transition-transform duration-300" />
              <ShoppingBag className="h-8 w-8 relative z-10" />
              <span className="relative z-10">Ver Orden (${total.toFixed(2)})</span>
              
              {cart.length > 0 && (
                <div className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 border-2 border-gray-900 text-sm">
                  {cart.length}
                </div>
              )}
            </button>
          )}
        </div>
      </header>

      {view === "menu" && (
        <div className="flex flex-1 overflow-hidden relative">
          {/* Subtle Background Elements */}
          <div className="absolute top-0 right-0 h-150 w-150 rounded-full bg-purple-900/10 blur-[150px] pointer-events-none" />

          {/* Categories Sidebar */}
          <aside className="w-[320px] shrink-0 overflow-y-auto border-r border-white/5 bg-black/20 backdrop-blur-md custom-scrollbar py-8 pl-8 pr-6 space-y-4 z-10">
            {categories?.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "w-full rounded-4xl px-8 py-6 text-left transition-all border shadow-lg group relative overflow-hidden",
                  activeCategory === cat.id 
                    ? "bg-purple-500 border-purple-400 scale-105" 
                    : "bg-white/5 border-white/5 active:bg-white/10 hover:border-white/20"
                )}
              >
                {activeCategory === cat.id && <div className="absolute inset-0 bg-linear-to-r from-white/20 to-transparent" />}
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
                  className="group relative flex flex-col overflow-hidden rounded-[2.5rem] border border-white/10 bg-gray-900/90 backdrop-blur-md text-left transition-all active:scale-95 active:border-purple-500/50 hover:shadow-[0_20px_50px_rgba(0,0,0,0.6)] hover:-translate-y-2 hover:border-white/20"
                >
                  <div className="relative aspect-4/3 w-full overflow-hidden bg-black/60 flex items-center justify-center">
                    {item.imageUrl ? (
                      <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: `url(${item.imageUrl})` }} />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-radial from-gray-800 to-black p-6">
                        <img src="/Ra.png" alt="Rabbitty" className="h-20 w-20 object-contain grayscale opacity-30 select-none group-hover:scale-105 transition-transform" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-linear-to-t from-gray-900 via-transparent to-transparent opacity-90" />
                    
                    {/* Price Tag */}
                    <div className="absolute top-4 right-4 rounded-2xl bg-black/80 backdrop-blur-xl px-5 py-2 border border-white/20 shadow-2xl">
                      <span className="text-xl font-black text-emerald-400">${item.price.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between p-7 pt-5 min-h-56">
                    <div>
                      {/* Fixed 2-line height for product title so cards always align */}
                      <h3 className="h-16 text-2xl font-black leading-tight text-white line-clamp-2 drop-shadow-sm group-hover:text-purple-300 transition-colors flex items-start">
                        {item.name}
                      </h3>
                      {/* Fixed 1-line height for description/spec */}
                      <p className="mt-2 text-sm text-gray-400 font-medium leading-relaxed line-clamp-1 h-5">
                        {item.description || "240 ML • Especialidad Rabbitty"}
                      </p>
                    </div>
                    
                    <div className="mt-4 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-white/10 border border-white/10 text-base font-bold text-gray-100 group-hover:bg-purple-600 group-hover:border-purple-400 group-hover:text-white transition-all shadow-md">
                      <Plus className="h-5 w-5" /> Toca para Agregar
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-8 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex w-full max-w-5xl h-[80vh] overflow-hidden rounded-[3rem] bg-gray-900 border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)]">
            {/* Left Image */}
            <div className="w-1/2 relative bg-black/60 flex items-center justify-center overflow-hidden">
              {selectedItem.imageUrl ? (
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${selectedItem.imageUrl})` }} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-radial from-gray-800 to-black p-10">
                  <img src="/Ra.png" alt="Rabbitty" className="h-32 w-32 object-contain grayscale opacity-30 select-none" />
                </div>
              )}
              <div className="absolute inset-0 bg-linear-to-r from-transparent to-gray-900" />
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
                className="mt-8 w-full rounded-4xl bg-purple-500 py-6 text-2xl font-black text-white shadow-[0_15px_40px_rgba(168,85,247,0.4)] hover:bg-purple-400 active:scale-95 transition-all"
              >
                AGREGAR A LA ORDEN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Screen - Immersive 2-Column Full Screen Layout */}
      {view === "checkout" && (
        <main className="flex flex-1 overflow-hidden p-8 lg:p-12 gap-8 relative z-10">
          {/* Left Column: Cart Items List */}
          <div className="flex-1 flex flex-col overflow-hidden rounded-[2.5rem] bg-gray-900/80 backdrop-blur-2xl border border-white/10 p-8 shadow-2xl">
            <div className="flex items-center justify-between pb-6 border-b border-white/10">
              <div>
                <h2 className="text-3xl lg:text-4xl font-black text-white">Revisa tu Pedido</h2>
                <p className="text-gray-400 text-sm mt-1">{cart.length} {cart.length === 1 ? "platillo seleccionado" : "platillos seleccionados"}</p>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-sm font-bold text-rose-400 hover:text-rose-300 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 active:scale-95 transition-all"
                >
                  Vaciar Orden
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar py-6 space-y-4 pr-2">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-5 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                  <div className="flex-1 pr-4">
                    <h3 className="text-xl lg:text-2xl font-bold text-white leading-tight">{item.name}</h3>
                    <p className="text-purple-400 text-lg font-black mt-1">${item.price.toFixed(2)} c/u</p>
                  </div>
                  
                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-4 bg-black/70 rounded-2xl p-2 border border-white/10 shadow-inner">
                    <button 
                      onClick={() => {
                        if (item.quantity === 1) setCart(prev => prev.filter(i => i.id !== item.id));
                        else setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i));
                      }}
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 active:bg-white/20 text-white"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <span className="w-8 text-center text-2xl font-black">{item.quantity}</span>
                    <button 
                      onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))}
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 active:bg-white/20 text-white"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="w-28 text-right text-2xl font-black text-white pl-4">
                    ${(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}

              {cart.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center py-20 text-gray-500">
                  <ShoppingBag className="h-20 w-20 mb-4 opacity-20" />
                  <p className="text-2xl font-bold">No has agregado nada aún</p>
                  <button 
                    onClick={() => setView("menu")}
                    className="mt-6 rounded-2xl bg-white/10 hover:bg-white/15 px-6 py-3 text-base font-bold text-white transition-all"
                  >
                    Explorar Menú
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Summary & Checkout CTA */}
          <div className="w-105 lg:w-120 shrink-0 flex flex-col justify-between rounded-[2.5rem] bg-gray-900/90 backdrop-blur-2xl border border-white/10 p-8 shadow-2xl">
            <div className="space-y-6">
              <h3 className="text-2xl font-black text-white border-b border-white/10 pb-4">Resumen de Cuenta</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between text-lg text-gray-400 font-medium">
                  <span>Subtotal (Base)</span>
                  <span className="text-white font-bold">${(Math.round((total / 1.16) * 100) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg text-purple-400 font-medium">
                  <span>IVA (16% Incluido)</span>
                  <span className="font-bold">${(Math.round((total - Math.round((total / 1.16) * 100) / 100) * 100) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 font-semibold">
                  <span>Puntos Bunz a Acumular</span>
                  <span>+{Math.round(total * 0.2)} Bunz</span>
                </div>
              </div>

              <div className="h-px bg-white/10 my-4" />

              <div className="flex justify-between items-baseline">
                <div>
                  <span className="text-3xl font-black text-white block">Total</span>
                  <span className="text-xs text-gray-400 font-normal">Impuestos incluidos</span>
                </div>
                <span className="text-5xl font-black text-emerald-400 tracking-tight">${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-4 pt-6">
              <button 
                disabled={cart.length === 0}
                onClick={async () => {
                  try {
                    const res = await kioskIntentMutation.mutateAsync({
                      items: cart.map((i) => ({ menuItemId: i.id, quantity: i.quantity })),
                    });
                    setIntent({ orderId: res.orderId, intentId: res.intentId, payUrl: res.payUrl, total: res.total, claimToken: (res as unknown as { claimToken?: string }).claimToken });
                    setView("qr_payment");
                  } catch (err) {
                    console.error("[KIOSK] intent error:", err);
                  }
                }}
                className="w-full flex items-center justify-center gap-3 rounded-2xl bg-linear-to-r from-purple-500 to-pink-500 py-6 text-2xl font-black text-white shadow-[0_15px_40px_rgba(168,85,247,0.4)] active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
              >
                PAGAR ORDEN <ChevronRight className="h-7 w-7" />
              </button>
              
              <button 
                onClick={() => setView("menu")}
                className="w-full rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 py-4 text-base font-bold text-gray-300 hover:text-white transition-all active:scale-95"
              >
                ← Seguir Agregando Platillos
              </button>
            </div>
          </div>
        </main>
      )}

      {/* Admin PIN Unlock Modal */}
      {adminPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-6">
          <div className="w-full max-w-md rounded-3xl bg-gray-900 border border-white/15 p-8 shadow-2xl text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 mb-4">
              <KeyRound className="h-7 w-7" />
            </div>
            <h3 className="text-2xl font-black text-white mb-2">Acceso de Personal</h3>
            <p className="text-sm text-gray-400 mb-6">Ingresa el PIN de seguridad para salir al Panel Administrativo.</p>
            
            <input
              type="password"
              maxLength={6}
              autoFocus
              value={adminPin}
              onChange={(e) => {
                setAdminPin(e.target.value);
                setPinError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (adminPin === "1234" || adminPin === "0000") {
                    window.location.href = "/";
                  } else {
                    setPinError(true);
                  }
                }
              }}
              placeholder="PIN de 4 dígitos"
              className="w-full text-center tracking-[0.5em] text-3xl font-black py-3 px-4 rounded-2xl bg-black border border-white/20 text-white focus:outline-none focus:border-purple-500 mb-2"
            />
            {pinError && <p className="text-rose-400 text-xs font-semibold mb-4">PIN incorrecto. Intenta de nuevo.</p>}

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                type="button"
                onClick={() => setAdminPinModal(false)}
                className="py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (adminPin === "1234" || adminPin === "0000") {
                    window.location.href = "/";
                  } else {
                    setPinError(true);
                  }
                }}
                className="py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm"
              >
                Desbloquear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kiosk Business QR Neon Modal */}
      {showKioskQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-full max-w-lg rounded-[3rem] bg-gray-900 border-2 border-pink-500/50 p-10 shadow-[0_0_80px_rgba(236,72,153,0.35)] text-center relative flex flex-col items-center">
            <button
              onClick={() => setShowKioskQrModal(false)}
              className="absolute top-6 right-6 h-12 w-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-6 w-6" />
            </button>

            <div className="h-20 w-20 rounded-3xl bg-pink-500/20 border border-pink-500/40 text-pink-400 flex items-center justify-center mb-6 shadow-lg shadow-pink-500/20">
              <QrCode className="h-10 w-10 animate-pulse" />
            </div>

            <h3 className="text-3xl font-black text-white mb-2">Escanea y Gana Bunz</h3>
            <p className="text-base text-gray-300 max-w-sm mb-6">
              Apunta con la cámara de tu celular o abre tu App Rabbitty / Telegram para registrar tu visita y acumular hasta <strong>+{ticketContext?.restaurant?.defaultRewardRate ?? 20}% de Cashback</strong>.
            </p>

            <div className="bg-white p-4 rounded-3xl shadow-2xl mb-6">
              <QRDiscovery
                  value={`https://rabbitty.me/scan?branchId=${ticketContext?.branch?.id || "default"}&business=${encodeURIComponent(ticketContext?.restaurant?.name || "Rabbitty")}`}
                  variant="rabbitter"
                  size={280}
                  revealMode="immediate"
                  surfaceKey="kiosk-checkin"
                />
            </div>

            <div className="flex items-center gap-2 mb-6">
              <span className="text-lg font-black text-white">🐰 {ticketContext?.restaurant?.name || "Rabbitty"}</span>
              <span className="text-xs font-bold text-pink-400 bg-pink-500/20 px-3 py-1 rounded-full border border-pink-500/30">
                +{ticketContext?.restaurant?.defaultRewardRate ?? 20}% Bunz
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowKioskQrModal(false)}
              className="w-full py-5 rounded-2xl bg-linear-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-black text-xl shadow-lg shadow-pink-500/30 active:scale-95 transition-all cursor-pointer"
            >
              ¡Ya lo Escaneé! (Continuar)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
