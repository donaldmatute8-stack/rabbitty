"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Card, Badge, Button, Dialog, Input, toast } from "@rabbitty/ui";
import {
  TerminalSquare,
  TabletSmartphone,
  LayoutDashboard,
  FlaskConical,
  Sparkles,
  QrCode,
  CreditCard,
  Banknote,
  ChefHat,
  Trash2,
  Lock,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  Receipt,
  Bot,
  Send,
  ShoppingBag,
  Plus,
  Minus,
  Compass,
  ShieldCheck,
  TrendingUp,
  HelpCircle,
} from "lucide-react";

type DemoTab = "pos" | "kiosk" | "admin";

interface DemoProduct {
  id: string;
  category: string;
  name: string;
  price: number;
  emoji: string;
  description: string;
}

interface CartItem {
  product: DemoProduct;
  qty: number;
}

interface DemoOrder {
  id: string;
  folio: string;
  title: string;
  customerName: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  status: "PREPARING" | "READY" | "PAID" | "VOIDED";
  method?: "Efectivo" | "Tarjeta Stripe" | "Bunz Cashback";
  bunzEarned: number;
  createdAt: string;
}

const DEMO_PRODUCTS: DemoProduct[] = [
  { id: "p1", category: "Café & Especialidades", name: "Latte Vainilla Artesanal", price: 78, emoji: "☕", description: "Espresso doble con leche cremada y vainilla natural" },
  { id: "p2", category: "Café & Especialidades", name: "Cold Brew Tónico Cítrico", price: 85, emoji: "🧊", description: "Infusión en frío 18h con agua quina y rodaja de naranja" },
  { id: "p3", category: "Café & Especialidades", name: "Matcha Ceremonial Helado", price: 92, emoji: "🍵", description: "Té verde grado ceremonial batido al momento" },
  { id: "p4", category: "Cocina & Brunch", name: "Chilaquiles Rabbitty Especiales", price: 145, emoji: "🥘", description: "Totopos crujientes, salsa verde tatemada, crema, queso y pollo" },
  { id: "p5", category: "Cocina & Brunch", name: "Avocado Toast Masa Madre", price: 135, emoji: "🥑", description: "Pan rústico, aguacate hass, huevo pochado y semillas" },
  { id: "p6", category: "Cocina & Brunch", name: "Croissant de Almendra Caliente", price: 68, emoji: "🥐", description: "Hojaldre francés horneado hoy con crema de almendras" },
  { id: "p7", category: "Postres & Panadería", name: "Cheesecake Vasco Caramelizado", price: 110, emoji: "🍰", description: "Cremoso por dentro y tostado por fuera" },
  { id: "p8", category: "Postres & Panadería", name: "Galleta Choco-Avellana XL", price: 55, emoji: "🍪", description: "Chispas de chocolate semiamargo 70% y sal de mar" },
];

const INITIAL_ORDERS: DemoOrder[] = [
  {
    id: "ord-demo-1",
    folio: "#9A41",
    title: "Mesa 2 · Terraza",
    customerName: "Sofía Ramírez",
    items: [
      { name: "Chilaquiles Rabbitty Especiales", qty: 1, price: 145 },
      { name: "Latte Vainilla Artesanal", qty: 2, price: 78 },
    ],
    total: 301,
    status: "PREPARING",
    bunzEarned: 60,
    createdAt: "Hace 6 min",
  },
  {
    id: "ord-demo-2",
    folio: "#8B12",
    title: "Para Llevar",
    customerName: "Carlos Mendoza",
    items: [
      { name: "Cold Brew Tónico Cítrico", qty: 1, price: 85 },
      { name: "Croissant de Almendra Caliente", qty: 1, price: 68 },
    ],
    total: 153,
    status: "PAID",
    method: "Tarjeta Stripe",
    bunzEarned: 31,
    createdAt: "Hace 18 min",
  },
];

const TOUR_STEPS: Record<DemoTab, { step: string; title: string; detail: string }[]> = {
  pos: [
    { step: "Paso 1", title: "Arma la comanda", detail: "Selecciona platillos del menú táctil y elige Mesa o Para Llevar. El IVA (16%) se desglosa automáticamente." },
    { step: "Paso 2", title: "Escanea QR Rabbitter", detail: "Usa [📷 Simular Escaneo QR] para vincular al cliente y calcular su Cashback del 20% en Bunz." },
    { step: "Paso 3", title: "Cobra e Imprime", detail: "Elige Efectivo, Tarjeta (Stripe Connect) o Canje Bunz. El ticket genera un QR único anti-fraude." },
  ],
  kiosk: [
    { step: "Paso 1", title: "Autoservicio sin filas", detail: "El comensal explora el menú visual en iPad o desde el QR de su mesa." },
    { step: "Paso 2", title: "Recompensa visible", detail: "En todo momento ve cuántos Bunz ganará con su pedido actual." },
    { step: "Paso 3", title: "Envío directo a KDS", detail: "Al confirmar, la orden entra directo al monitor de cocina y caja." },
  ],
  admin: [
    { step: "Paso 1", title: "Métricas e IVA exacto", detail: "Monitorea ventas brutas, base gravable, IVA 16%, turnos de caja y órdenes activas en vivo." },
    { step: "Paso 2", title: "Candado con PIN 1234", detail: "Haz clic en el botón rojo de papelera de una orden activa y prueba el PIN 1234 para autorizar la anulación." },
    { step: "Paso 3", title: "Pregúntale a Bunzy IA", detail: "Usa los botones rápidos del Co-Pilot para recibir recomendaciones financieras y de lealtad." },
  ],
};

export default function InteractiveDemoPage() {
  const [activeTab, setActiveTab] = useState<DemoTab>("pos");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [orderMode, setOrderMode] = useState<"DINE_IN" | "TAKEOUT">("DINE_IN");
  const [selectedTable, setSelectedTable] = useState<number>(4);

  // POS Cart & Customer State
  const [posCart, setPosCart] = useState<CartItem[]>([
    { product: DEMO_PRODUCTS[0]!, qty: 1 },
    { product: DEMO_PRODUCTS[3]!, qty: 1 },
  ]);
  const [scannedCustomer, setScannedCustomer] = useState<{
    name: string;
    username: string;
    bunzBalance: number;
  } | null>(null);
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [receiptModal, setReceiptModal] = useState<DemoOrder | null>(null);

  // Kiosk Cart State
  const [kioskCart, setKioskCart] = useState<CartItem[]>([
    { product: DEMO_PRODUCTS[1]!, qty: 1 },
    { product: DEMO_PRODUCTS[6]!, qty: 1 },
  ]);
  const [kioskCustomerName, setKioskCustomerName] = useState(" Ana Sofía");

  // Shared In-Memory Orders (POS + Kiosk + Admin)
  const [orders, setOrders] = useState<DemoOrder[]>(INITIAL_ORDERS);

  // Admin PIN Void Modal State (Demo PIN: 1234)
  const [voidTarget, setVoidTarget] = useState<DemoOrder | null>(null);
  const [demoPin, setDemoPin] = useState("");

  // Bunzy IA Demo Chat State
  const [bunzyChat, setBunzyChat] = useState<Array<{ role: "assistant" | "user"; text: string }>>([
    {
      role: "assistant",
      text: "¡Hola! 🐰 Soy Bunzy Co-Pilot en modo Recorrido Virtual. Aquí puedes probar cómo analizo tus ventas, costos, horarios pico y campañas de lealtad sin tocar datos reales.",
    },
  ]);
  const [bunzyPrompt, setBunzyPrompt] = useState("");

  const categories = ["Todos", ...Array.from(new Set(DEMO_PRODUCTS.map((p) => p.category)))];
  const filteredProducts =
    selectedCategory === "Todos"
      ? DEMO_PRODUCTS
      : DEMO_PRODUCTS.filter((p) => p.category === selectedCategory);

  // Totals Helper (IVA 16% incluido como en producción)
  const computeTotals = (cart: CartItem[]) => {
    const total = cart.reduce((acc, item) => acc + item.product.price * item.qty, 0);
    const base = Math.round((total / 1.16) * 100) / 100;
    const tax = Math.round((total - base) * 100) / 100;
    const bunzReward = Math.max(1, Math.round(total * 0.2)); // 20% cashback demo
    return { total, base, tax, bunzReward };
  };

  const posTotals = computeTotals(posCart);
  const kioskTotals = computeTotals(kioskCart);

  const updateCart = (
    setter: React.Dispatch<React.SetStateAction<CartItem[]>>,
    product: DemoProduct,
    delta: number
  ) => {
    setter((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (!existing && delta > 0) {
        return [...prev, { product, qty: delta }];
      }
      return prev
        .map((i) => (i.product.id === product.id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0);
    });
  };

  const handleSimulateQrScan = () => {
    setScannedCustomer({
      name: "Valeria Gómez (Rabbitter VIP)",
      username: "@valeria_rabbit",
      bunzBalance: 420,
    });
    setScannerModalOpen(false);
    toast.success("📷 QR Escaneado: Valeria Gómez vinculada (+20% Cashback Bunz)");
  };

  const handlePosCheckout = (method: "Efectivo" | "Tarjeta Stripe" | "Bunz Cashback") => {
    if (posCart.length === 0) {
      toast.error("Agrega al menos un platillo a la comanda");
      return;
    }
    if (method === "Bunz Cashback" && !scannedCustomer) {
      toast.error("Primero escanea el QR del cliente para pagar con Bunz");
      setScannerModalOpen(true);
      return;
    }

    const newOrder: DemoOrder = {
      id: `ord-demo-${Date.now()}`,
      folio: `#${Math.floor(1000 + Math.random() * 9000)}`,
      title: orderMode === "DINE_IN" ? `Mesa ${selectedTable} · Salón` : "Para Llevar",
      customerName: scannedCustomer ? scannedCustomer.name : "Cliente Mostrador",
      items: posCart.map((c) => ({ name: c.product.name, qty: c.qty, price: c.product.price })),
      total: posTotals.total,
      status: "PAID",
      method,
      bunzEarned: posTotals.bunzReward,
      createdAt: "Justo ahora",
    };

    setOrders((prev) => [newOrder, ...prev]);
    setReceiptModal(newOrder);
    setPosCart([]);
    toast.success(`✅ Cobro simulado con ${method} (${newOrder.folio})`);
  };

  const handleKioskSubmit = () => {
    if (kioskCart.length === 0) {
      toast.error("Tu carrito del Kiosko está vacío");
      return;
    }
    const newOrder: DemoOrder = {
      id: `ord-kiosk-${Date.now()}`,
      folio: `#K${Math.floor(100 + Math.random() * 899)}`,
      title: "Kiosko Autoservicio",
      customerName: kioskCustomerName.trim() || "Cliente Kiosko",
      items: kioskCart.map((c) => ({ name: c.product.name, qty: c.qty, price: c.product.price })),
      total: kioskTotals.total,
      status: "PREPARING",
      bunzEarned: kioskTotals.bunzReward,
      createdAt: "Justo ahora",
    };
    setOrders((prev) => [newOrder, ...prev]);
    setKioskCart([]);
    toast.success(`🚀 Pedido ${newOrder.folio} enviado a Cocina y Dashboard (revísalo en la pestaña Admin)`);
  };

  const handleConfirmVoid = () => {
    if (!voidTarget) return;
    if (demoPin !== "1234") {
      toast.error("PIN de demostración incorrecto. Usa 1234 para probar el candado.");
      return;
    }
    setOrders((prev) =>
      prev.map((o) => (o.id === voidTarget.id ? { ...o, status: "VOIDED" } : o))
    );
    toast.success(`🔒 Orden ${voidTarget.folio} anulada con PIN de Administrador`);
    setVoidTarget(null);
    setDemoPin("");
  };

  const handleBunzyAsk = (question: string) => {
    const q = question.trim();
    if (!q) return;
    const paidOrders = orders.filter((o) => o.status === "PAID");
    const revenue = paidOrders.reduce((s, o) => s + o.total, 0);

    let reply =
      `📊 Analizando tu operación simulada: llevas $${revenue.toFixed(2)} MXN en ventas cobradas y ${orders.filter((o) => o.status === "PREPARING").length} comanda(s) activas en cocina. ` +
      `Te sugiero activar una Happy Hour 2x Bunz de 16:00 a 18:00 para elevar el ticket promedio un 28%.`;

    if (q.toLowerCase().includes("iva") || q.toLowerCase().includes("sat")) {
      const base = (revenue / 1.16).toFixed(2);
      const iva = (revenue - Number(base)).toFixed(2);
      reply = `🧾 Desglose Fiscal SAT (16% incluido): De tus $${revenue.toFixed(2)} MXN cobrados hoy, la Base Gravable es $${base} MXN y el IVA trasladado es $${iva} MXN. Listo para exportar a Excel/PDF.`;
    } else if (q.toLowerCase().includes("platillo") || q.toLowerCase().includes("estrella")) {
      reply = `🥐 Tu producto estrella hoy son los Chilaquiles Rabbitty Especiales ($145 MXN, margen del 68%). Si los combinas en el Kiosko con Cold Brew Tónico, puedes subir el ticket $42 MXN por mesa.`;
    }

    setBunzyChat((prev) => [...prev, { role: "user", text: q }, { role: "assistant", text: reply }]);
    setBunzyPrompt("");
  };

  const resetAllDemoState = () => {
    setOrders(INITIAL_ORDERS);
    setPosCart([
      { product: DEMO_PRODUCTS[0]!, qty: 1 },
      { product: DEMO_PRODUCTS[3]!, qty: 1 },
    ]);
    setKioskCart([
      { product: DEMO_PRODUCTS[1]!, qty: 1 },
      { product: DEMO_PRODUCTS[6]!, qty: 1 },
    ]);
    setScannedCustomer(null);
    toast.info("🔄 Recorrido Virtual reiniciado a su estado original");
  };

  const paidOrders = orders.filter((o) => o.status === "PAID");
  const activeOrders = orders.filter((o) => o.status === "PREPARING" || o.status === "READY");
  const totalDemoRevenue = paidOrders.reduce((s, o) => s + o.total, 0);
  const totalDemoBase = Math.round((totalDemoRevenue / 1.16) * 100) / 100;
  const totalDemoTax = Math.round((totalDemoRevenue - totalDemoBase) * 100) / 100;

  return (
    <div className="min-h-screen bg-[#07070b] text-white flex flex-col">
      {/* Top Banner — Explicación Clara: /demo vs /sandbox vs Producción */}
      <div className="border-b border-cyan-500/30 bg-linear-to-r from-cyan-950/90 via-[#0b0b14] to-purple-950/90 px-4 sm:px-6 py-2.5 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 px-3 py-0.5 text-[11px] font-black uppercase tracking-wider text-cyan-300">
              <Compass className="h-3.5 w-3.5" /> Recorrido Virtual Interactivo (/demo)
            </span>
            <p className="text-xs text-gray-300">
              <strong className="text-white">100% En Memoria (Cero Base de Datos):</strong> Todo lo que toques aquí es un tour guiado instantáneo y nunca modifica tus ventas ni tu sucursal.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={resetAllDemoState}
              className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-bold text-gray-200 cursor-pointer transition-all"
            >
              <RotateCcw className="h-3.5 w-3.5 text-cyan-400" /> Reiniciar Tour
            </button>
            <Link
              href="/sandbox"
              className="inline-flex items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-300 transition-all"
              title="Practicar con el menú real de tu negocio"
            >
              <FlaskConical className="h-3.5 w-3.5" /> Ir a Sandbox Real
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-xl bg-pink-600 hover:bg-pink-500 px-3 py-1.5 text-xs font-black text-white transition-all shadow-lg shadow-pink-600/20"
            >
              Ir a mi Panel <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1">
        {/* Header & Mode Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/3 p-5 backdrop-blur-xl">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>🐰 Rabbitty OS · Tour Guiado 360°</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Alterna entre las 3 pantallas del ecosistema: lo que cobras en el <strong>POS</strong> o pides en el <strong>Kiosko</strong> se refleja al instante en <strong>Admin & Bunzy</strong>.
            </p>
          </div>

          {/* 3-Tab Selector */}
          <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl bg-black/60 border border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("pos")}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === "pos"
                  ? "bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <TerminalSquare className="h-4 w-4" />
              <span>1. POS Mostrador</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("kiosk")}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === "kiosk"
                  ? "bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <TabletSmartphone className="h-4 w-4" />
              <span>2. Kiosko Digital</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("admin")}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === "admin"
                  ? "bg-pink-500 text-white shadow-[0_0_20px_rgba(236,72,153,0.4)]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>3. Admin & Bunzy</span>
              {activeOrders.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] text-amber-300">
                  {activeOrders.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Micro-Tour Step Cards for Active Tab */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TOUR_STEPS[activeTab].map((s, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-white/10 bg-linear-to-br from-white/5 to-transparent p-4 flex items-start gap-3"
            >
              <span className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-black text-[11px] shrink-0">
                {s.step}
              </span>
              <div>
                <h3 className="text-xs font-black text-white">{s.title}</h3>
                <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* =========================================================
            TAB 1: POS MOSTRADOR INTERACTIVO
           ========================================================= */}
        {activeTab === "pos" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Menu Catalog */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedCategory === cat
                          ? "bg-cyan-500 text-black font-black"
                          : "bg-white/5 text-gray-400 hover:text-white border border-white/10"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Dine-in vs Takeout selector */}
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setOrderMode("DINE_IN")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      orderMode === "DINE_IN" ? "bg-pink-500 text-white" : "text-gray-400"
                    }`}
                  >
                    🍽️ En Mesa #{selectedTable}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderMode("TAKEOUT")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      orderMode === "TAKEOUT" ? "bg-pink-500 text-white" : "text-gray-400"
                    }`}
                  >
                    🛍️ Para Llevar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredProducts.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => updateCart(setPosCart, prod, 1)}
                    className="flex items-center justify-between p-4 rounded-2xl border border-white/10 bg-white/3 hover:bg-cyan-500/10 hover:border-cyan-500/40 transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl shrink-0">{prod.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white group-hover:text-cyan-300 truncate">
                          {prod.name}
                        </p>
                        <p className="text-[11px] text-gray-400 line-clamp-1">{prod.description}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className="text-sm font-black text-cyan-400">${prod.price}</span>
                      <span className="block text-[10px] text-gray-500">+ Agregar</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Active Ticket & Payment Simulator */}
            <div className="lg:col-span-5">
              <Card className="p-5 rounded-3xl border border-white/10 bg-[#0d0d14] space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                      Comanda POS en Vivo
                    </span>
                    <h3 className="text-lg font-black text-white">
                      {orderMode === "DINE_IN" ? `Mesa ${selectedTable} · Salón Principal` : "Pedido Para Llevar"}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScannerModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-pink-500/15 border border-pink-500/40 px-3 py-2 text-xs font-black text-pink-300 hover:bg-pink-500/25 cursor-pointer transition-all"
                  >
                    <QrCode className="h-4 w-4" />
                    <span>📷 Escanear QR</span>
                  </button>
                </div>

                {/* Linked Customer Pill */}
                {scannedCustomer ? (
                  <div className="flex items-center justify-between rounded-2xl bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2.5 text-xs">
                    <div>
                      <p className="font-black text-emerald-300">🐰 {scannedCustomer.name}</p>
                      <p className="text-[11px] text-emerald-200/80">
                        Saldo disponible: <strong>{scannedCustomer.bunzBalance} Bunz</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setScannedCustomer(null)}
                      className="text-[11px] text-gray-400 hover:text-white underline cursor-pointer"
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-white/5 border border-white/10 px-3.5 py-2 text-[11px] text-gray-400 flex items-center justify-between">
                    <span>Sin cliente vinculado (se generará QR en el ticket impreso)</span>
                    <button
                      type="button"
                      onClick={handleSimulateQrScan}
                      className="text-cyan-400 font-bold hover:underline cursor-pointer ml-2 shrink-0"
                    >
                      Simular cliente
                    </button>
                  </div>
                )}

                {/* Cart Items */}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {posCart.length === 0 ? (
                    <p className="text-center text-xs text-gray-500 py-8">
                      Toca cualquier platillo de la izquierda para armar la cuenta.
                    </p>
                  ) : (
                    posCart.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 border border-white/5"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            {item.product.emoji} {item.product.name}
                          </p>
                          <p className="text-[10px] text-gray-400">${item.product.price} c/u</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateCart(setPosCart, item.product, -1)}
                            className="h-6 w-6 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 cursor-pointer"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-black w-4 text-center">{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => updateCart(setPosCart, item.product, 1)}
                            className="h-6 w-6 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-black text-white w-14 text-right">
                            ${(item.product.price * item.qty).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Fiscal & Bunz Breakdown */}
                <div className="rounded-2xl bg-black/50 border border-white/10 p-3.5 space-y-1.5 text-xs">
                  <div className="flex justify-between text-gray-400">
                    <span>Subtotal Base (Sin IVA)</span>
                    <span>${posTotals.base.toFixed(2)} MXN</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>IVA Trasladado (16% incluido)</span>
                    <span>${posTotals.tax.toFixed(2)} MXN</span>
                  </div>
                  <div className="flex justify-between text-pink-400 font-bold pt-1 border-t border-white/10">
                    <span>🎁 Cashback Rabbitter (20%)</span>
                    <span>+{posTotals.bunzReward} Bunz</span>
                  </div>
                  <div className="flex justify-between text-lg font-black text-white pt-1 border-t border-white/10">
                    <span>Total a Cobrar</span>
                    <span className="text-emerald-400">${posTotals.total.toFixed(2)} MXN</span>
                  </div>
                </div>

                {/* Payment Buttons */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handlePosCheckout("Efectivo")}
                    className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 p-3 text-emerald-300 font-black text-xs cursor-pointer transition-all"
                  >
                    <Banknote className="h-5 w-5" />
                    <span>Efectivo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePosCheckout("Tarjeta Stripe")}
                    className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/40 p-3 text-blue-300 font-black text-xs cursor-pointer transition-all"
                  >
                    <CreditCard className="h-5 w-5" />
                    <span>Tarjeta / Pay</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePosCheckout("Bunz Cashback")}
                    className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/40 p-3 text-pink-300 font-black text-xs cursor-pointer transition-all"
                  >
                    <Sparkles className="h-5 w-5" />
                    <span>Canjear Bunz</span>
                  </button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 2: KIOSKO DE AUTOSERVICIO
           ========================================================= */}
        {activeTab === "kiosk" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-4">
              <div className="rounded-3xl border border-purple-500/30 bg-linear-to-r from-purple-950/50 via-black to-pink-950/40 p-5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-300">
                    Modo Kiosko / Auto-Pedido en Mesa
                  </span>
                  <h2 className="text-xl font-black text-white mt-0.5">
                    ¡Ordena a tu gusto y gana Bunz al instante! 🐰
                  </h2>
                </div>
                <div className="text-right">
                  <span className="text-xs text-purple-300 font-bold block">Cashback Activo</span>
                  <span className="text-2xl font-black text-pink-400">20% BUNZ</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {DEMO_PRODUCTS.map((prod) => (
                  <div
                    key={prod.id}
                    className="rounded-2xl border border-white/10 bg-white/3 p-4 flex flex-col justify-between gap-3 hover:border-purple-500/40 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{prod.emoji}</span>
                        <div>
                          <h4 className="text-sm font-black text-white">{prod.name}</h4>
                          <p className="text-[11px] text-gray-400 mt-0.5">{prod.description}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <div>
                        <span className="text-base font-black text-white">${prod.price} MXN</span>
                        <span className="block text-[10px] text-pink-400 font-bold">
                          +{Math.round(prod.price * 0.2)} Bunz de regalo
                        </span>
                      </div>
                      <Button
                        onClick={() => updateCart(setKioskCart, prod, 1)}
                        className="bg-purple-600 hover:bg-purple-500 text-white font-black text-xs px-3 py-1.5 rounded-xl"
                      >
                        + Agregar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-4">
              <Card className="p-5 rounded-3xl border border-purple-500/30 bg-[#0d0d14] space-y-4">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-purple-400" /> Tu Bandeja de Pedido
                </h3>

                <div>
                  <label className="text-[11px] font-bold text-gray-400 block mb-1">
                    ¿A nombre de quién preparamos tu orden?
                  </label>
                  <Input
                    value={kioskCustomerName}
                    onChange={(e) => setKioskCustomerName(e.target.value)}
                    placeholder="Ej. Ana Sofía"
                  />
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {kioskCart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs"
                    >
                      <span className="font-bold text-white truncate">
                        {item.qty}x {item.product.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-purple-300 font-black">
                          ${(item.product.price * item.qty).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCart(setKioskCart, item.product, -1)}
                          className="text-gray-400 hover:text-red-400 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl bg-purple-500/10 border border-purple-500/20 p-3.5 space-y-1 text-xs">
                  <div className="flex justify-between text-gray-300">
                    <span>Total (IVA 16% incl.):</span>
                    <span className="font-black text-white">${kioskTotals.total.toFixed(2)} MXN</span>
                  </div>
                  <div className="flex justify-between text-pink-300 font-bold">
                    <span>Recompensa al pagar:</span>
                    <span>+{kioskTotals.bunzReward} Bunz 🐰</span>
                  </div>
                </div>

                <Button
                  onClick={handleKioskSubmit}
                  className="w-full py-3 rounded-2xl bg-linear-to-r from-purple-600 to-pink-600 hover:opacity-95 font-black text-xs text-white"
                >
                  Enviar Pedido a Cocina (KDS)
                </Button>
              </Card>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 3: ADMIN DASHBOARD, AUDITORÍA IVA & BUNZY CO-PILOT
           ========================================================= */}
        {activeTab === "admin" && (
          <div className="space-y-6">
            {/* Financial KPIs with SAT IVA Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-5 rounded-2xl border border-white/10 bg-white/3">
                <span className="text-[11px] font-bold uppercase text-gray-400">Ventas Cobradas (Demo)</span>
                <p className="text-2xl font-black text-emerald-400 mt-1">${totalDemoRevenue.toFixed(2)} MXN</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  Base: <strong>${totalDemoBase.toFixed(2)}</strong> · IVA 16%: <strong>${totalDemoTax.toFixed(2)}</strong>
                </p>
              </Card>
              <Card className="p-5 rounded-2xl border border-white/10 bg-white/3">
                <span className="text-[11px] font-bold uppercase text-gray-400">Comandas Activas</span>
                <p className="text-2xl font-black text-amber-400 mt-1">{activeOrders.length}</p>
                <p className="text-[11px] text-gray-400 mt-1">En preparación / listas para cobrar</p>
              </Card>
              <Card className="p-5 rounded-2xl border border-white/10 bg-white/3">
                <span className="text-[11px] font-bold uppercase text-gray-400">Candado de Seguridad PIN</span>
                <p className="text-2xl font-black text-pink-400 mt-1">PIN: 1234</p>
                <p className="text-[11px] text-gray-400 mt-1">Pruébalo en el botón rojo de papelera</p>
              </Card>
              <Card className="p-5 rounded-2xl border border-white/10 bg-white/3">
                <span className="text-[11px] font-bold uppercase text-gray-400">Cashback Emitido</span>
                <p className="text-2xl font-black text-cyan-400 mt-1">
                  {paidOrders.reduce((s, o) => s + o.bunzEarned, 0)} BZ
                </p>
                <p className="text-[11px] text-gray-400 mt-1">Clientes fidelizados hoy</p>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Live Orders & PIN Security Test */}
              <div className="lg:col-span-7 space-y-4">
                <Card className="p-5 rounded-3xl border border-white/10 bg-[#0d0d14] space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-white flex items-center gap-2">
                        <ChefHat className="h-5 w-5 text-amber-400" /> Monitor de Comandas & Control de Anulaciones
                      </h3>
                      <p className="text-xs text-gray-400">
                        Prueba cancelar una orden con el ícono de papelera roja (te pedirá el PIN de Admin <strong>1234</strong>).
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {orders.map((ord) => (
                      <div
                        key={ord.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/3 p-4"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-cyan-400">{ord.folio}</span>
                            <span className="text-sm font-black text-white">{ord.title}</span>
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                ord.status === "PAID"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : ord.status === "VOIDED"
                                  ? "bg-red-500/20 text-red-300 line-through"
                                  : "bg-amber-500/20 text-amber-300"
                              }`}
                            >
                              {ord.status === "PAID"
                                ? `Pagada (${ord.method})`
                                : ord.status === "VOIDED"
                                ? "Anulada con PIN"
                                : "En Cocina / Activa"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            Cliente: <strong className="text-gray-200">{ord.customerName}</strong> ·{" "}
                            {ord.items.map((i) => `${i.qty}x ${i.name}`).join(", ")}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                          <div className="text-right">
                            <span className="text-sm font-black text-white block">
                              ${ord.total.toFixed(2)} MXN
                            </span>
                            <span className="text-[10px] text-pink-400 font-bold">
                              +{ord.bunzEarned} Bunz
                            </span>
                          </div>

                          {ord.status !== "VOIDED" && (
                            <button
                              type="button"
                              onClick={() => {
                                setVoidTarget(ord);
                                setDemoPin("");
                              }}
                              title="Anular orden (requiere PIN 1234)"
                              className="p-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/30 border border-red-500/30 text-red-400 cursor-pointer transition-all"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Right: Bunzy Co-Pilot Interactive Simulator */}
              <div className="lg:col-span-5">
                <Card className="p-5 rounded-3xl border border-pink-500/30 bg-[#0d0d14] flex flex-col justify-between space-y-4 h-full">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
                      <div className="h-9 w-9 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-base">
                        🐰
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white">Bunzy Co-Pilot IA</h3>
                        <p className="text-[11px] text-gray-400">Asesor financiero y de lealtad en tiempo real</p>
                      </div>
                    </div>

                    {/* Quick Prompts */}
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "¿Cuál es mi desglose de IVA SAT hoy?",
                        "¿Cuál es mi platillo estrella?",
                        "Sugiere una campaña para horas valle",
                      ].map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => handleBunzyAsk(q)}
                          className="text-[11px] font-bold bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-pink-300 px-2.5 py-1 rounded-xl cursor-pointer transition-all"
                        >
                          ✨ {q}
                        </button>
                      ))}
                    </div>

                    {/* Chat Messages */}
                    <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                      {bunzyChat.map((m, i) => (
                        <div
                          key={i}
                          className={`rounded-2xl p-3 text-xs leading-relaxed ${
                            m.role === "user"
                              ? "bg-pink-600 text-white ml-8"
                              : "bg-white/5 border border-white/10 text-gray-200 mr-4"
                          }`}
                        >
                          {m.text}
                        </div>
                      ))}
                    </div>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleBunzyAsk(bunzyPrompt);
                    }}
                    className="flex gap-2 pt-2 border-t border-white/10"
                  >
                    <Input
                      value={bunzyPrompt}
                      onChange={(e) => setBunzyPrompt(e.target.value)}
                      placeholder="Pregúntale a Bunzy sobre tus ventas o IVA..."
                      className="text-xs"
                    />
                    <Button type="submit" className="bg-pink-600 hover:bg-pink-500 px-3">
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* Comparison Guide: /demo vs /sandbox */}
        <Card className="p-6 rounded-3xl border border-white/10 bg-white/2">
          <h3 className="text-sm font-black uppercase tracking-wider text-gray-300 mb-4 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-cyan-400" /> ¿Cuál es la diferencia entre Recorrido Virtual (/demo) y Modo Sandbox (/sandbox)?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-4 space-y-1.5">
              <p className="font-black text-cyan-300 text-sm">🧭 1. Recorrido Virtual (/demo — Estás aquí)</p>
              <p className="text-gray-300 leading-relaxed">
                Corre <strong>100% en la memoria de tu navegador</strong> con productos de cafetería de muestra. No requiere iniciar sesión, no escribe nada en la base de datos y sirve para conocer el flujo POS + Kiosko + Admin en 2 minutos.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-1.5">
              <p className="font-black text-amber-300 text-sm">🧪 2. Modo Sandbox (/sandbox — Capacitación de Personal)</p>
              <p className="text-gray-300 leading-relaxed">
                Crea una <strong>sucursal de entrenamiento aislada dentro de tu propia cuenta</strong> clonando tus platillos, precios y mesas reales. Ideal para que tus cajeros y meseros nuevos practiquen con tu carta real sin mezclar sus comandas de prueba con la sucursal principal.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Modal: Simulador de Escáner QR WebRTC */}
      <Dialog
        open={scannerModalOpen}
        onClose={() => setScannerModalOpen(false)}
        title="📷 Escáner WebRTC Rabbitter (Simulación)"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-cyan-500/30 bg-black/80 p-6 text-center space-y-3">
            <div className="mx-auto h-28 w-28 rounded-2xl border-2 border-dashed border-cyan-400 flex items-center justify-center bg-cyan-500/10">
              <QrCode className="h-14 w-14 text-cyan-300 animate-pulse" />
            </div>
            <p className="text-xs text-gray-300">
              En tu iPad o dispositivo físico, aquí se abre la cámara trasera nativa dentro del mismo modal (sin abrir pestañas nuevas) para leer el QR del cliente.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setScannerModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSimulateQrScan} className="bg-cyan-500 text-black font-black">
              Simular Lectura QR Exitosa
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Modal: Ticket Térmico Impreso con QR Anti-Fraude */}
      <Dialog
        open={!!receiptModal}
        onClose={() => setReceiptModal(null)}
        title="🧾 Ticket Térmico 58mm Generado"
      >
        {receiptModal && (
          <div className="space-y-4">
            <div className="mx-auto max-w-xs rounded-2xl bg-white text-black p-5 font-mono text-xs space-y-2 shadow-2xl">
              <div className="text-center border-b border-dashed border-gray-400 pb-2">
                <p className="font-black text-sm">CAFETERÍA DEMO RABBITTY</p>
                <p className="text-[10px] text-gray-600">{receiptModal.title}</p>
                <p className="text-[10px] text-gray-600">Folio: {receiptModal.folio}</p>
              </div>
              <div className="space-y-1 py-1">
                {receiptModal.items.map((it, i) => (
                  <div key={i} className="flex justify-between">
                    <span>
                      {it.qty}x {it.name.slice(0, 18)}
                    </span>
                    <span>${(it.qty * it.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-gray-400 pt-2 space-y-0.5">
                <div className="flex justify-between">
                  <span>SUBTOTAL BASE:</span>
                  <span>${(receiptModal.total / 1.16).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA (16% INCL.):</span>
                  <span>${(receiptModal.total - receiptModal.total / 1.16).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black text-sm pt-1">
                  <span>TOTAL ({receiptModal.method}):</span>
                  <span>${receiptModal.total.toFixed(2)} MXN</span>
                </div>
              </div>
              <div className="border-t border-dashed border-gray-400 pt-3 text-center space-y-1">
                <p className="font-black text-[11px]">🐰 ESCANEA Y GANA +{receiptModal.bunzEarned} BUNZ</p>
                <div className="mx-auto h-20 w-20 rounded-lg border border-black flex items-center justify-center bg-gray-100">
                  <QrCode className="h-14 w-14 text-black" />
                </div>
                <p className="text-[9px] text-gray-600">Token HMAC Anti-Fraude de 1 solo uso</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => {
                  setReceiptModal(null);
                  setActiveTab("admin");
                }}
                className="bg-pink-600 text-white font-black text-xs"
              >
                Ver impacto en Admin & Bunzy →
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Modal: Candado PIN de 4 dígitos para Anular Orden */}
      <Dialog
        open={!!voidTarget}
        onClose={() => {
          setVoidTarget(null);
          setDemoPin("");
        }}
        title="🔒 Autorización de Administrador Requerida"
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-3.5 text-xs text-red-200">
            Estás por anular la comanda <strong>{voidTarget?.folio}</strong> ({voidTarget?.title} · $
            {voidTarget?.total.toFixed(2)} MXN). Para proteger tu caja, se requiere el PIN de 4 dígitos.
          </div>
          <div>
            <label className="text-xs font-bold text-gray-300 block mb-1">
              Ingresa el PIN de Administrador (Demo: <strong className="text-cyan-400">1234</strong>)
            </label>
            <Input
              type="password"
              maxLength={4}
              value={demoPin}
              onChange={(e) => setDemoPin(e.target.value.replace(/\D/g, ""))}
              placeholder="1234"
              className="text-center text-lg tracking-widest font-black"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setVoidTarget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmVoid}
              className="bg-red-600 hover:bg-red-500 text-white font-black"
            >
              Autorizar Anulación
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

