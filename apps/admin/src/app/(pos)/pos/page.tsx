"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Button, Dialog, Input, toast, cn, useWakeLock } from "@rabbitty/ui";
import { Clock, Wifi, Search, User, Users, CreditCard, Banknote, QrCode, SplitSquareHorizontal, Trash2, ChevronLeft, Plus, Minus, Check, ChevronDown, CheckCircle2, AlertTriangle, Shield, Table2, ShoppingBag, Bike, UtensilsCrossed, Store, Printer, Bluetooth, BluetoothConnected, Maximize2, MessageCircle, LogOut, FlaskConical, FileText, X, ArrowRight, Sparkles, Send, Pause, Play, Lock, Unlock, ClipboardCheck, Camera, History, RotateCcw } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import QRDiscovery from "@/components/QRDiscovery";
import { startNeonDecoder } from "@/lib/neonDecoder";
import { TicketTemplate, TicketData } from "../../../components/TicketTemplate";
import { CashShiftModal, CashShiftBadge } from "../../../components/CashShiftModal";
import { 
  printEngine,
  generateEscPosTicketPayload
} from "../../../lib/print-engine";

// Placeholder for missing images
const PLACEHOLDER_IMG = "https://images.unsplash.com/photo-1544148103-0773bf10d330?q=80&w=1000&auto=format&fit=crop";

function PosClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit" }));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-200 shrink-0">
      <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
      <span className="text-xs font-mono font-bold tracking-wider">{time}</span>
    </div>
  );
}

export default function PosPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>("ALL");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [voidingItem, setVoidingItem] = useState<any | null>(null);
  const [orderZoomModal, setOrderZoomModal] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [managerPin, setManagerPin] = useState("");
  const [confirmClearCart, setConfirmClearCart] = useState(false);
  const [clearCartPin, setClearCartPin] = useState("");
  const [pendingDiscardFolio, setPendingDiscardFolio] = useState<string | null>(null);
  const [tableModal, setTableModal] = useState(false);
  const [orderType, setOrderType] = useState<"COUNTER" | "DINE_IN" | "TAKEAWAY" | "DELIVERY">("COUNTER");
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [receiptModal, setReceiptModal] = useState(false);
  // Método elegido pendiente de confirmación (el cobro NO se ejecuta hasta confirmar)
  const [pendingMethod, setPendingMethod] = useState<string | null>(null);
  const [cashReceived, setCashReceived] = useState<string>("");
  const [isCharging, setIsCharging] = useState(false);
  const [paidTicketData, setPaidTicketData] = useState<TicketData | null>(null);
  const [btConnected, setBtConnected] = useState(false);
  const [btDeviceName, setBtDeviceName] = useState<string | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [waPhone, setWaPhone] = useState("");
  const [qrPaymentModal, setQrPaymentModal] = useState<{ intentId: string; amount: number; bunz: number; expiresAt: Date; orderId?: string } | null>(null);
  const stripeStatus = trpc.payments.getStripeAccountStatus.useQuery({});
  const arrivalsQuery = trpc.pos.getRecentArrivals.useQuery(undefined, { refetchInterval: 15000 });
  const [arrivalBanner, setArrivalBanner] = useState<{ name: string; visits: number; vip: boolean } | null>(null);
  const linkPostCheckout = trpc.pos.linkCustomerToOrder.useMutation();
  const stripeChargeMutation = trpc.pos.createStripeChargeIntent.useMutation();
  const cancelStripeIntent = trpc.payments.cancelPaymentIntent.useMutation();
  const stripeIntentId = useRef<string | null>(null);
  const [stripePayModal, setStripePayModal] = useState<{ payUrl: string; amount: number; orderId: string; expiresAt: Date; bunzApplied: number } | null>(null);
  const [stripePaid, setStripePaid] = useState(false);
  const [sendBillModal, setSendBillModal] = useState(false);
  const [activeTabsModal, setActiveTabsModal] = useState(false);
  const [pausedCartsModal, setPausedCartsModal] = useState(false);
  const [recentOrdersModal, setRecentOrdersModal] = useState(false);
  // Anti doble-impresión: el ref bloquea de forma síncrona; el estado pinta el loader
  const printLockRef = useRef(false);
  const [printingKey, setPrintingKey] = useState<string | null>(null);
  const runPrint = async (key: string, job: () => Promise<void>) => {
    if (printLockRef.current) return;
    printLockRef.current = true;
    setPrintingKey(key);
    try {
      await job();
    } finally {
      printLockRef.current = false;
      setPrintingKey(null);
    }
  };
  const [pausedCarts, setPausedCarts] = useState<{
    id: string;
    folio: string;
    createdAt: string;
    cart: any[];
    orderType: "COUNTER" | "DINE_IN" | "TAKEAWAY" | "DELIVERY";
    selectedTableId: string | null;
    selectedRabbitter: any | null;
    total: number;
    itemsCount: number;
  }[]>([]);
  const [adminPinModal, setAdminPinModal] = useState(false);
  const [exitPin, setExitPin] = useState("");

  // Rabbitter Vinculado antes de cobrar
  const [selectedRabbitter, setSelectedRabbitter] = useState<{
    id: string;
    name: string;
    phoneNumber?: string | null;
    telegramId?: string | null;
    bunzBalance: number;
    hops: number;
    level: string;
    currentRewardRate: number;
  } | null>(null);
  const [rabbitterModalOpen, setRabbitterModalOpen] = useState(false);
  const [lastPaidOrderId, setLastPaidOrderId] = useState<string | null>(null);
  const [cardFlowChoice, setCardFlowChoice] = useState<"stripe" | "external" | null>(null);
  const [rabbitterQuery, setRabbitterQuery] = useState("");
  const [isSearchingRabbitter, setIsSearchingRabbitter] = useState(false);
  const [isScanningRabbitter, setIsScanningRabbitter] = useState(false);
  const [showBusinessQrModal, setShowBusinessQrModal] = useState(false);
  const utils = trpc.useUtils();

  // Subscribe to PrintEngine state (connections, auto-reconnects, queue changes)
  useEffect(() => {
    const unsubState = printEngine.onStateChange((state) => {
      setBtConnected(state.connected);
      setBtDeviceName(state.device?.name || null);
      setQueueCount(state.queueCount);
    });

    const unsubQueue = printEngine.onQueueChange((q) => {
      setQueueCount(q.length);
    });

    // Auto-reconnect to last printer on mount
    printEngine.reconnect().catch(() => {});

    return () => {
      unsubState();
      unsubQueue();
    };
  }, []);

  // Keep Screen Awake (WakeLock API) to prevent Bluetooth drop and keep POS active
  useWakeLock();

  const handleConnectBluetooth = async () => {
    try {
      toast.info("Buscando impresora Bluetooth POS-58 / MTP...");
      const result = await printEngine.connect();
      if (result.success) {
        toast.success(`🐰 ¡Impresora ${result.deviceName} vinculada con éxito!`);
      } else {
        toast.error(result.error || "No se pudo emparejar");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al conectar Bluetooth");
    }
  };

  const handleDisconnectBluetooth = async () => {
    await printEngine.disconnect();
    toast.info("Impresora Bluetooth desconectada");
  };

  const handleFlushQueue = async () => {
    if (!printEngine.isConnected()) {
      toast.error("Conecta una impresora para imprimir la cola pendiente.");
      return;
    }
    toast.info("Imprimiendo tickets pendientes en cola...");
    const { printed, failed } = await printEngine.flushQueue();
    if (printed > 0) {
      toast.success(`🐰 Se imprimieron ${printed} tickets exitosamente.`);
    }
    if (failed > 0) {
      toast.warning(`${failed} tickets fallaron y continúan en cola.`);
    }
  };

  const { data: categories } = trpc.pos.getCategories.useQuery(undefined, { retry: false });
  const { data: menuItems } = trpc.pos.getMenuItems.useQuery({}, { retry: false });
  const { data: tables } = trpc.pos.getTables.useQuery(undefined, { retry: false });
  const { data: activeTabsData, refetch: refetchActiveTabs } = trpc.pos.getActiveTabs.useQuery(undefined, { refetchInterval: 10000, retry: false });
  const { data: recentCompletedOrders, refetch: refetchRecentOrders } = trpc.pos.getOrders.useQuery(
    { status: "COMPLETED" },
    { enabled: recentOrdersModal, retry: false }
  );
  const sendBillMutation = trpc.pos.sendBillToCustomer.useMutation({
    onSuccess: (data) => {
      toast.success(`🧾 Cuenta enviada a ${data.customerName}!`);
      if (data.whatsappUrl) {
        window.open(data.whatsappUrl, "_blank");
      }
      setSendBillModal(false);
    },
    onError: (err) => {
      toast.error(err.message || "Error al enviar la cuenta");
    },
  });
  const { data: ticketContext } = trpc.printing.getTicketData.useQuery(undefined, { retry: false });
  const { data: cashStatus, refetch: refetchCashStatus } = trpc.cashDrops.getStatus.useQuery({}, { refetchInterval: 30000 });
  const { data: sandboxStatus } = trpc.sandbox.getSandboxStatus.useQuery(undefined, { retry: false });
  const { data: branches } = trpc.admin.getBranches.useQuery(undefined, { retry: false });
  const { data: userProfile } = trpc.admin.getProfile.useQuery(undefined, { retry: false });
  const isEmployeeRole = userProfile?.role === "CASHIER" || userProfile?.role === "WAITER";

  // Cargar carrito activo y carritos pausados desde almacenamiento local (persistencia tipo Óptima POS)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedCart = localStorage.getItem("rabbitty_active_cart");
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCart(parsed);
        }
      }
      const savedPaused = localStorage.getItem("rabbitty_paused_carts");
      if (savedPaused) {
        const parsed = JSON.parse(savedPaused);
        if (Array.isArray(parsed)) {
          setPausedCarts(parsed);
        }
      }
      const savedOrderType = localStorage.getItem("rabbitty_active_order_type");
      if (savedOrderType && ["COUNTER", "DINE_IN", "TAKEAWAY", "DELIVERY"].includes(savedOrderType)) {
        setOrderType(savedOrderType as any);
      }
      const savedTable = localStorage.getItem("rabbitty_active_table_id");
      if (savedTable) {
        setSelectedTableId(savedTable);
      }
      const savedRabbitter = localStorage.getItem("rabbitty_active_rabbitter");
      if (savedRabbitter) {
        setSelectedRabbitter(JSON.parse(savedRabbitter));
      }
    } catch (e) {
      console.warn("[POS_RESTORE_ERROR]", e);
    }
  }, []);

  // Guardar en tiempo real ante cualquier cambio (si se apaga la tablet o sale, no se pierde)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (cart.length > 0) {
        localStorage.setItem("rabbitty_active_cart", JSON.stringify(cart));
      } else {
        localStorage.removeItem("rabbitty_active_cart");
      }
    } catch {}
  }, [cart]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("rabbitty_paused_carts", JSON.stringify(pausedCarts));
    } catch {}
  }, [pausedCarts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("rabbitty_active_order_type", orderType);
    } catch {}
  }, [orderType]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (selectedTableId) {
        localStorage.setItem("rabbitty_active_table_id", selectedTableId);
      } else {
        localStorage.removeItem("rabbitty_active_table_id");
      }
    } catch {}
  }, [selectedTableId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (selectedRabbitter) {
        localStorage.setItem("rabbitty_active_rabbitter", JSON.stringify(selectedRabbitter));
      } else {
        localStorage.removeItem("rabbitty_active_rabbitter");
      }
    } catch {}
  }, [selectedRabbitter]);

  // ── Controlador reactivo de la cámara para escanear Rabbitter ──
  const scannerInstanceRef = useRef<any>(null);
  const neonDecoderStopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let active = true;
    if (!rabbitterModalOpen || !isScanningRabbitter) {
      if (scannerInstanceRef.current) {
        scannerInstanceRef.current.stop().catch(() => {});
        scannerInstanceRef.current = null;
      }
      return;
    }

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!active) return;
        const readerElement = document.getElementById("rabbitter-cam-reader");
        if (!readerElement) return;

        const scanner = new Html5Qrcode("rabbitter-cam-reader");
        scannerInstanceRef.current = scanner;

        const cameras = await Html5Qrcode.getCameras().catch(() => []);
        const config = { fps: 10, qrbox: { width: 220, height: 220 } };

        const onScanSuccess = async (decodedText: string) => {
          if (!active) return;

          let cleanedRaw = decodedText.trim();
          // ── QR de Membresía: <subscriptionId>.<window>.<hmac24> → canje directo ──
          const memToken = cleanedRaw.match(/^([0-9a-fA-F-]{36})\.(\d+)\.([0-9a-f]{24})$/);
          if (memToken) {
            try { await scanner.stop().catch(() => {}); } catch {}
            scannerInstanceRef.current = null;
            neonDecoderStopRef.current?.();
            neonDecoderStopRef.current = null;
            setIsScanningRabbitter(false);
            await handleMembershipRedeem(cleanedRaw);
            return;
          }

          try {
            await scanner.stop().catch(() => {});
          } catch {}
          scannerInstanceRef.current = null;
          setIsScanningRabbitter(false);

          let cleaned = decodedText.trim();
          if (cleaned.includes("to=")) {
            const m = cleaned.match(/[?&]to=([^&]+)/);
            if (m) cleaned = decodeURIComponent(m[1]);
          } else if (cleaned.includes("user=")) {
            const m = cleaned.match(/[?&]user=([^&]+)/);
            if (m) cleaned = decodeURIComponent(m[1]);
          } else if (cleaned.includes("phone=")) {
            const m = cleaned.match(/[?&]phone=([^&]+)/);
            if (m) cleaned = decodeURIComponent(m[1]);
          }
          cleaned = cleaned.replace(/^@/, "").trim();

          setIsSearchingRabbitter(true);
          try {
            const res = await utils.pos.lookupRabbitter.fetch({ query: cleaned });
            if (res) {
              setRabbitterQuery("");
              if (receiptModal && lastPaidOrderId) {
                const linked = await linkPostCheckout.mutateAsync({
                  orderId: lastPaidOrderId,
                  customerId: res.id,
                  customerPhone: res.phoneNumber || res.telegramId || "sin-telefono",
                  customerName: res.name,
                  awardBunz: true,
                });
                setRabbitterModalOpen(false);
                setLastPaidOrderId(null);
                setPaidTicketData((prev: any) => prev ? { ...prev, awardedBunz: linked.awardedBunz || prev.awardedBunz } : prev);
                toast.success(linked.awardedBunz > 0
                  ? `🐰 ¡Asignado y recompensado: ${linked.awardedBunz} Bunz a ${res.name}!`
                  : `🐰 Cliente asignado a la venta.`);
                return;
              }
              setSelectedRabbitter(res);
              setRabbitterModalOpen(false);
              toast.success(`🐰 ¡Rabbitter vinculado: ${res.name}!`);
            } else {
              toast.error("Código no encontrado. Verifica con el cliente.");
            }
          } catch (err: any) {
            toast.error(err?.message || "Error al buscar Rabbitter");
          } finally {
            setIsSearchingRabbitter(false);
          }
        };

        if (cameras && cameras.length > 0) {
          const backCam = cameras.find((c) => /back|rear|environment|trasera/i.test(c.label)) || cameras[0];
          await scanner.start(backCam.id, config, onScanSuccess, () => {});
        } else {
          await scanner.start({ facingMode: "environment" }, config, onScanSuccess, () => {});
        }
        // Decoder de barras neón en paralelo — el cliente puede mostrar su RabbittyCode
        if (active) {
          neonDecoderStopRef.current = startNeonDecoder("rabbitter-cam-reader", (code) => {
            if (!active) return;
            try { scanner.stop().catch(() => {}); } catch {}
            scannerInstanceRef.current = null;
            neonDecoderStopRef.current?.();
            neonDecoderStopRef.current = null;
            onScanSuccess(String(code));
          });
        }
      } catch (camErr: any) {
        console.warn("[POS] Camera error:", camErr);
        toast.error("Cámara no disponible o permiso denegado.");
        setIsScanningRabbitter(false);
      }
    };

    const timer = setTimeout(startScanner, 200);
    return () => {
      active = false;
      clearTimeout(timer);
      if (scannerInstanceRef.current) {
        scannerInstanceRef.current.stop().catch(() => {});
        scannerInstanceRef.current = null;
      }
    };
  }, [rabbitterModalOpen, isScanningRabbitter]);


  // ── Canje de Membresía por escáner (token <subId>.<window>.<hmac>) ──
  const redeemMembership = trpc.memberships.redeemAtPOS.useMutation();
  const handleMembershipRedeem = async (qrToken: string) => {
    try {
      const subId = qrToken.split(".")[0];
      const ctxBiz = await utils.memberships.myBusinessForContext.fetch();
      if (!ctxBiz?.businessId) {
        toast.error("Este POS no tiene un negocio de membresías vinculado");
        return;
      }
      const res = await redeemMembership.mutateAsync({
        businessId: ctxBiz.businessId,
        qrToken,
        branchId: ticketContext?.branch?.id || "pos",
        quantity: 1,
        idempotencyKey: `pos_scan_${subId}_${Math.floor(Date.now() / 1000 / 30)}`,
      });
      if (res?.duplicate) {
        const dupMember = res.memberName ? ` de ${res.memberName}` : "";
        toast.info(`🐰 Membresía ya canjeada hace un momento${dupMember} (duplicado ignorado)`);
        return;
      }
      if (res?.success) {
        const member = res.memberName ? ` de ${res.memberName}` : "";
        toast.success(`🎟️ Canje OK${member} — quedan ${res.remaining} usos este ciclo`);
      } else {
        toast.error("No se pudo canjear la membresía");
      }
    } catch (err: any) {
      toast.error(err?.message || "Membresía inválida o no vigente");
    }
  };

  const [cashDropAmount, setCashDropAmount] = useState("");
  const [cashDropNotes, setCashDropNotes] = useState("");
  const [corteModalOpen, setCorteModalOpen] = useState(false);
  const [corteInitialMode, setCorteInitialMode] = useState<"open" | "partial" | undefined>(undefined);

  const activeBranchId = ticketContext?.branch?.id;
  const isSandboxActive =
    !!sandboxStatus?.hasSandbox &&
    !!sandboxStatus.sandboxBranch &&
    activeBranchId === sandboxStatus.sandboxBranch.id;

  const handleExitSandbox = () => {
    const mainBranch = branches?.find(
      (b) =>
        !b.name.toLowerCase().includes("sandbox") &&
        !b.name.toLowerCase().includes("entrenamiento")
    ) || branches?.[0];

    if (mainBranch && typeof window !== "undefined") {
      localStorage.setItem("activeBranchId", mainBranch.id);
      toast.success("Cambiando a sucursal de producción real...");
      window.location.reload();
    }
  };

  // El generador ESC/POS espera campos planos; ticketContext viene anidado (restaurant/branch)
  const buildTicketHeader = () => {
    const rest: any = ticketContext?.restaurant;
    const branch: any = ticketContext?.branch;
    return {
      restaurantName: rest?.name || "Rabbitty POS",
      legalName: rest?.legalName || undefined,
      rfc: rest?.rfc || undefined,
      taxRegime: rest?.taxRegime || undefined,
      logoUrl: rest?.logoUrl || undefined,
      address: branch?.address || undefined,
      phone: rest?.phone || branch?.phone || undefined,
      staffName: "Caja Principal",
    };
  };

  // Auto-select first table when tables load if DINE_IN
  useEffect(() => {
    if (tables && tables.length > 0 && !selectedTableId && orderType === "DINE_IN") {
      setSelectedTableId(tables[0].id);
    }
  }, [tables, selectedTableId, orderType]);

  const { data: adminPinStatus, refetch: refetchAdminPinStatus } = trpc.staff.getAdminPinStatus.useQuery(undefined, { retry: false });
  const setAdminPinMutation = trpc.staff.setAdminPin.useMutation({
    onSuccess: (data) => {
      refetchAdminPinStatus();
      toast.success(data.message || "PIN configurado correctamente");
    },
    onError: (err: any) => toast.error(err?.message || "Error al configurar PIN"),
  });

  const handleKeypadPress = async (digit: string) => {
    if (exitPin.length >= 4 || verifyPinMutation.isPending || setAdminPinMutation.isPending) return;
    const nextPin = exitPin + digit;
    setExitPin(nextPin);

    if (nextPin.length === 4) {
      if (!adminPinStatus?.hasAdminPin) {
        // Inicializar PIN de administrador si la sucursal no tiene uno
        try {
          await setAdminPinMutation.mutateAsync({ pin: nextPin });
          setAdminPinModal(false);
          setExitPin("");
          toast.success("🐰 PIN de Administrador definido. Saliendo al Dashboard...");
          window.location.href = "/";
        } catch {
          setExitPin("");
        }
      } else {
        // Validar PIN existente
        try {
          await verifyPinMutation.mutateAsync({ pin: nextPin });
          setAdminPinModal(false);
          setExitPin("");
          toast.success("PIN autorizado. Accediendo al Dashboard...");
          window.location.href = "/";
        } catch {
          setExitPin("");
        }
      }
    }
  };

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

    // Aviso de llegada: el motor de proximidad marca eventos CUSTOMER_ARRIVAL
  useEffect(() => {
    const arr = arrivalsQuery.data?.newArrivals;
    if (arr && arr.length > 0) {
      const latest = arr[0];
      setArrivalBanner({ name: latest.username || "Rabbitter", visits: latest.visitCount, vip: latest.isVip });
      toast.success(latest.isVip
        ? `👑 ¡Cliente VIP en puerta: ${latest.username}! (${latest.visitCount} visitas previas)`
        : `👋 ¡Llegó ${latest.username}! Cliente #${latest.visitCount + 1} — dale la bienvenida.`);
    }
  }, [arrivalsQuery.data?.newArrivals]);

  // Anti-abandono: advertir si el cajero cierra/sale con una operación sin concluir.
  // (El carrito persiste en localStorage, pero esta guardia evita cierres accidentales)
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (cart.length > 0) {
        e.preventDefault();
        e.returnValue = "Tienes una operación sin concluir. Pausa la venta o cóbrala antes de salir.";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [cart]);

  const directCheckoutMutation = trpc.pos.directCheckout.useMutation({
    onError: (err) => {
      toast.error(err.message || "Error al procesar el cobro en el backend");
    },
  });

  const API_SERVER_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const getPosAuthToken = () => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("rabbitty_pos_token") || localStorage.getItem("rabbitty_auth_token");
      if (stored) return stored;
    }
    if (process.env.NODE_ENV !== "production") return "DEV_TOKEN";
    throw new Error("No POS auth token available. Inicia sesión nuevamente.");
  };

  const createPaymentIntentMutation = {
    mutateAsync: async (data: any) => {
      // Authority: API Server Domain creates payment intent
      const branchId = ticketContext?.branch?.id || "default_branch";
      const token = getPosAuthToken();
      const response = await fetch(`${API_SERVER_URL}/payments.createIntent?batch=1`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-tenant-id": branchId
        },
        body: JSON.stringify({ 
          "0": {
            amountMxn: data.totalAmount,
            tenantId: branchId,
            orderId: data.orderId,
            idempotencyKey: data.orderId ? `pos_${data.orderId}` : `pos_${crypto.randomUUID()}`
          } 
        })
      });
      if (!response.ok) throw new Error("Error al generar código QR de pago");
      const resData = await response.json();
      return resData[0].result.data;
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al generar código QR de pago");
    }
  };

  const [pollData, setPollData] = useState<any>(null);

  // Poll the API server for payment resolution
  useEffect(() => {
    if (!qrPaymentModal) {
      setPollData(null);
      return;
    }
    const interval = setInterval(async () => {
      try {
        const inputStr = encodeURIComponent(JSON.stringify({ "0": { intentId: qrPaymentModal.intentId } }));
        const token = getPosAuthToken();
        const res = await fetch(`${API_SERVER_URL}/payments.getIntent?batch=1&input=${inputStr}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const intent = data[0].result.data;
          setPollData(intent);
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [qrPaymentModal, API_SERVER_URL]);

  // Polling del intento de Stripe: cuando el webhook liquida (SUCCEEDED), finaliza
  useEffect(() => {
    if (!stripePayModal || stripePaid) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const token = getPosAuthToken();
        const url = `${API_SERVER_URL}/payments.getPaymentIntent?input=${encodeURIComponent(JSON.stringify({ intentId: stripeIntentId.current }))}`;
        const res = await fetch(url, { headers: { "Authorization": token ? `Bearer ${token}` : "" } });
        if (!res.ok) return;
        const data = await res.json();
        const intent = data?.result?.data;
        if (intent?.status === "SUCCEEDED" && !cancelled) {
          cancelled = true;
          clearInterval(timer);
          setStripePaid(true);
          const ord = await fetch(`${API_SERVER_URL}/pos.getOrders?input=${encodeURIComponent(JSON.stringify({}))}`, { headers: { "Authorization": `Bearer ${token}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
          void ord;
          const realOrderNumber = (stripePayModal.orderId || stripeIntentId.current || "").slice(-4).toUpperCase();
          if (stripePayModal.bunzApplied > 0) {
            toast.success(`🐰 ¡Pago Stripe verificado! +${stripePayModal.bunzApplied} Bunz al Rabbitter.`);
          } else {
            toast.success("💳 ¡Pago Stripe recibido! Comanda liquidada.");
          }
          setLastPaidOrderId(stripePayModal.orderId);
          finalizeCheckout(
            realOrderNumber,
            "STRIPE",
            undefined,
            selectedRabbitter?.name,
            stripePayModal.bunzApplied || undefined,
            stripePayModal.orderId,
            stripePayModal.orderId
          );
          setStripePayModal(null);
        }
      } catch { /* siguiente ciclo intenta de nuevo */ }
    }, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [stripePayModal, stripePaid]);

  useEffect(() => {
    if (pollData?.status === "SETTLED" && qrPaymentModal) {
      // Financial Integrity: Cross-verify that settled intent matches active order total
      if (
        (pollData.amountMxn && Math.abs(pollData.amountMxn - qrPaymentModal.amount) > 0.01) ||
        (pollData.orderId && qrPaymentModal.orderId && pollData.orderId !== qrPaymentModal.orderId)
      ) {
        toast.error("El pago recibido no corresponde a la orden actual.");
        setQrPaymentModal(null);
        return;
      }

      toast.success("¡Pago con Bunz verificado exitosamente!");
      const realOrderNumber = qrPaymentModal.intentId.slice(-4).toUpperCase();
      finalizeCheckout(realOrderNumber, "QR BUNZ");
      setQrPaymentModal(null);
    } else if (pollData?.expiresAt && new Date(pollData.expiresAt).getTime() < Date.now() && qrPaymentModal) {
      toast.error("El tiempo para pagar con Bunz ha expirado.");
      setQrPaymentModal(null);
    }
  }, [pollData, qrPaymentModal]);

  // Removed the useEffect that overrides activeCategory to the first category so "ALL" works.

  const filteredItems = useMemo(() => {
    if (!menuItems) return [];
    let items = menuItems;
    if (activeCategory && activeCategory !== "ALL") {
      items = items.filter((i) => i.categoryId === activeCategory);
    }
    if (search.trim()) {
      items = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
    }
    return items;
  }, [menuItems, activeCategory, search]);

  const addToCart = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.id);
      if (existing) {
        return prev.map((i) => (i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { 
        id: Math.random().toString(36).substr(2, 9), 
        menuItemId: item.id, 
        name: item.name, 
        price: item.price, 
        quantity: 1,
        imageUrl: item.imageUrl || null,
        categoryId: item.categoryId || null
      }];
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
  const taxRate = ticketContext?.restaurant?.taxRate ?? 0.16;
  const subtotal = Math.round((total / (1 + taxRate)) * 100) / 100;
  const tax = Math.round((total - subtotal) * 100) / 100;

  const finalizeCheckout = async (
    realOrderNumber: string,
    method: string,
    cashGiven?: number,
    customerName?: string,
    awardedBunz?: number,
    claimToken?: string,
    orderId?: string
  ) => {
    const rest = ticketContext?.restaurant;
    const branch = ticketContext?.branch;
    const selectedTable = tables?.find((t) => t.id === selectedTableId);
    const tableLabel = orderType === "DINE_IN" ? (selectedTable ? `Mesa ${selectedTable.number}` : "Salón") : orderType === "TAKEAWAY" ? "Para Llevar" : orderType === "DELIVERY" ? "Domicilio" : "Mostrador";

    const changeAmount = cashGiven && cashGiven >= total ? Math.round((cashGiven - total) * 100) / 100 : undefined;

    const ticket: TicketData = {
      restaurantName: rest?.name || "Rabbitty Bistro",
      legalName: (rest as any)?.legalName || undefined,
      rfc: (rest as any)?.rfc || undefined,
      taxRegime: (rest as any)?.taxRegime || undefined,
      logoUrl: (rest as any)?.logoUrl || undefined,
      address: branch?.address || undefined,
      phone: (rest as any)?.phone || branch?.phone || undefined,
      email: (rest as any)?.email || undefined,
      ticketFooter: (rest as any)?.ticketFooter || "¡Gracias por su compra en Rabbitty! Vuelva pronto.",
      orderNumber: realOrderNumber,
      orderId: orderId,
      claimToken: claimToken,
      tableNumber: tableLabel,
      orderType: orderType === "DINE_IN" ? "Consumo en Sitio" : orderType === "TAKEAWAY" ? "Para Llevar" : orderType === "DELIVERY" ? "A Domicilio" : "Caja Rápida",
      cashierName: "Caja Principal",
      date: new Date().toLocaleString("es-MX", {
        timeZone: rest?.timezone || "America/Mexico_City",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      items: cart.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.price,
        totalPrice: i.price * i.quantity,
      })),
      subtotal,
      taxRate,
      tax,
      discount: 0,
      total,
      paymentMethod: method,
      cashGiven: cashGiven && cashGiven > 0 ? cashGiven : undefined,
      change: changeAmount,
      currency: rest?.currency || "MXN",
      bunzCashbackRate: selectedRabbitter?.currentRewardRate ?? rest?.defaultRewardRate ?? 20,
      estimatedBunz: Math.max(1, Math.round(total * ((selectedRabbitter?.currentRewardRate ?? rest?.defaultRewardRate ?? 20) / 100))),
      customerName: customerName || selectedRabbitter?.name || undefined,
      awardedBunz: awardedBunz !== undefined && awardedBunz > 0 ? awardedBunz : undefined,
    };

    setPaidTicketData(ticket);
    setReceiptModal(true);

    // Resilient ticket printing (prints live if connected, or enqueues if disconnected / failed)
    await runPrint("receipt", async () => {
      const printResult = await printEngine.printTicket(ticket, true);
      if (printResult.success) {
        toast.success("¡Ticket impreso correctamente!");
      } else if (printResult.queued) {
        toast.warning((printResult.error || "Ticket guardado en cola.") + " Puedes reintentar con el botón Imprimir.");
      }
    });

    setCart([]);
    setSelectedTableId(null);
    setSelectedRabbitter(null);
  };

  const requestCheckout = (method: string) => {
    if (cart.length === 0 || isCharging) return;
    setPendingMethod(method);
    // Para pagos en efectivo, inicializar con el total exacto o vacío para facilitar la captura
    if (method === "EFECTIVO" || method === "VENTA DIRECTA" || method === "DIVIDIDA") {
      setCashReceived("");
    }
  };

  const confirmCheckout = async (customCashGiven?: number) => {
    if (!pendingMethod || isCharging) return;
    const chosen = (window as any).__rabbittyCardFlow;
    (window as any).__rabbittyCardFlow = null;
    const method = pendingMethod === "TARJETA" && chosen && String(chosen).includes("STRIPE")
      ? "TARJETA_STRIPE"
      : pendingMethod === "TARJETA" && chosen && String(chosen).includes("EXTERNA")
        ? "TARJETA_EXTERNA"
        : pendingMethod;
    setPendingMethod(null);
    setIsCharging(true);
    try {
      await handleCheckout(method, customCashGiven);
    } finally {
      setIsCharging(false);
    }
  };

  const handlePrintReceipt = async () => {
    if (!paidTicketData) return;
    await runPrint("receipt", async () => {
      const r = await printEngine.printTicket(paidTicketData, true);
      if (r.success) toast.success("¡Ticket impreso correctamente!");
      else toast.warning(r.error || "No se pudo imprimir. Revisa la impresora.");
    });
  };

  const handleCheckout = async (method: string = "EFECTIVO", cashGiven?: number) => {
    if (cart.length === 0) return;

    // Map payment method string to schema enum
    let mappedMethod: "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "BUNZ" = "CASH";
    if (method.includes("TARJETA") || method.includes("CREDIT")) mappedMethod = "CREDIT_CARD";
    else if (method.includes("DEBIT")) mappedMethod = "DEBIT_CARD";
    else if (method.includes("BUNZ") || method.includes("QR")) mappedMethod = "BUNZ";

    // Map orderType
    const mappedOrderType: "DINE_IN" | "TO_GO" | "DELIVERY" = 
      orderType === "TAKEAWAY" || orderType === "COUNTER" ? "TO_GO" :
      orderType === "DELIVERY" ? "DELIVERY" : "DINE_IN";

    let realOrderNumber = Math.floor(1000 + Math.random() * 9000).toString();

    // 1. Dispatch real order to backend DB (inventories, Bunz cashback, CRM)
    try {
      if (mappedMethod === "BUNZ") {
        const result = await createPaymentIntentMutation.mutateAsync({
          tableId: selectedTableId || undefined,
          orderType: mappedOrderType,
          totalAmount: total,
          items: cart.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            price: i.price,
          })),
        });
        setQrPaymentModal({
          intentId: result.id || result.paymentIntentId,
          amount: total,
          bunz: result.bunzAmount,
          expiresAt: new Date(result.expiresAt)
        });
        return; // Don't finalize yet, wait for polling!
      } else if (
        method.includes("STRIPE") &&
        stripeStatus.data?.chargesEnabled
      ) {
        // ── Rabbitty Pay (Stripe Connect): el comensal paga desde su teléfono
        //    con Apple Pay / tarjeta vía /pay/[orderId]; liquidación por webhook ──
        const charge = await stripeChargeMutation.mutateAsync({
          items: cart.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity, notes: i.notes || undefined })),
          orderType: mappedOrderType,
          tableId: selectedTableId || undefined,
          customerId: selectedRabbitter?.id,
          customerName: selectedRabbitter?.name,
          customerPhone: selectedRabbitter?.phoneNumber || selectedRabbitter?.telegramId || undefined,
          bunzToApply: 0,
        });
        stripeIntentId.current = charge.intentId;
        setStripePaid(false);
        setStripePayModal({
          payUrl: charge.payUrl,
          amount: charge.total,
          orderId: charge.orderId,
          expiresAt: new Date(charge.expiresAt),
          bunzApplied: charge.bunzApplied || 0,
        });
        return; // Waiting for webhook; POS polling below flips to finalize.
      } else {
        const checkoutResult = await directCheckoutMutation.mutateAsync({
          tableId: selectedTableId || undefined,
          orderType: mappedOrderType,
          paymentMethod: mappedMethod,
          customerId: selectedRabbitter?.id || undefined,
          customerName: selectedRabbitter?.name || undefined,
          customerPhone: selectedRabbitter?.phoneNumber || undefined,
          items: cart.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            price: i.price,
          })),
        });

        if (checkoutResult.orderNumber) {
          realOrderNumber = checkoutResult.orderNumber;
        }

        if (checkoutResult.awardedBunz && checkoutResult.awardedBunz > 0) {
          toast.success(`🐰 ¡Orden #${realOrderNumber} pagada! +${checkoutResult.awardedBunz} Bunz acreditados a ${selectedRabbitter?.name || "cliente"}.`);
        } else {
          toast.success(`Orden #${realOrderNumber} registrada y pagada en el sistema`);
        }

        await finalizeCheckout(
          realOrderNumber,
          method,
          cashGiven,
          checkoutResult.customerName || selectedRabbitter?.name || undefined,
          checkoutResult.awardedBunz || undefined,
          checkoutResult.claimToken || undefined,
          checkoutResult.orderId || undefined
        );
        setLastPaidOrderId(checkoutResult.orderId ?? null);
        return;
      }
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.includes("TURNO_CERRADO")) {
        toast.error("La caja está cerrada. Abre turno para cobrar en efectivo.");
        setCorteModalOpen(true);
        return;
      }
      if (mappedMethod === "BUNZ") return; // If createIntent fails, stop
      // Allow ticket generation even if backend offline (graceful degradation)
    }

    await finalizeCheckout(realOrderNumber, method, cashGiven, selectedRabbitter?.name || undefined);
  };

  return (
    <div className="flex h-dvh w-full flex-col bg-gray-950 text-white overflow-hidden select-none font-sans">
      
      {cashStatus?.requiresDrop && !corteModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-gray-900/95 p-4 backdrop-blur-md">
          <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.3)] border border-red-500/50 p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-500/20 mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-3xl font-black text-red-400 mb-2">Retiro Requerido</h2>
            <p className="text-gray-300 mb-6 text-lg">
              Has alcanzado el límite de efectivo en caja (${cashStatus.threshold.toFixed(2)}).
            </p>
            <button
              id="cash-forced-withdraw"
              onClick={() => setCorteModalOpen(true)}
              className="w-full bg-linear-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold py-4 rounded-xl text-xl shadow-lg shadow-red-500/20 transition-all active:scale-95"
            >
              Hacer retiro con PIN
            </button>
          </div>
        </div>
      )}

      {/* ── Sandbox Alert Banner in POS ── */}
      {isSandboxActive && (
        <div className="relative z-30 flex items-center justify-between border-b border-amber-500/30 bg-linear-to-r from-amber-950 via-black to-amber-950 px-6 py-2.5 backdrop-blur-xl shadow-[0_4px_25px_rgba(245,158,11,0.25)]">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">
              <FlaskConical className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                🧪 MODO ENTRENAMIENTO ACTIVO (SANDBOX)
              </span>
              <span className="text-[11px] text-amber-200/80 ml-2 font-medium hidden sm:inline">
                Las ventas cobradas aquí son de práctica y no se reflejan en tu reporte real de ingresos.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExitSandbox}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black px-3.5 py-1 text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Salir a Ventas Reales
          </button>
        </div>
      )}

      {/* ── Top Header ── */}
      {/* ── Modern Streamlined POS Header ── */}
      <header className="flex h-16 shrink-0 items-center justify-between bg-black/80 backdrop-blur-2xl px-4 lg:px-6 border-b border-white/10 relative z-20 gap-3">
        {/* Left: Brand & Compact Exit */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setExitPin("");
              setAdminPinModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 px-3 py-2 border border-white/10 text-gray-200 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 group"
            title="Terminal Protegida: Requiere PIN de Administrador para salir al Dashboard"
          >
            <Lock className="h-3.5 w-3.5 text-amber-400 group-hover:text-amber-300" />
            <ChevronLeft className="h-4 w-4 text-cyan-400 -ml-1" />
            <span>Dashboard</span>
          </button>

          {/* Business & Status Pill */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 shrink-0">
            <span className="text-xs font-black text-white">{ticketContext?.restaurant?.name || "Rabbitty POS"}</span>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Online</span>
            </div>
          </div>
        </div>

        {/* Center: Operation & Customer Tools in Sleek Clusters */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {/* Shift / Drawer Control */}
          <div className="flex items-center shrink-0">
            <CashShiftBadge onClick={() => setCorteModalOpen(true)} />
            {cashStatus?.shiftOpen && (
              <button
                id="pos-quick-corte-x"
                type="button"
                onClick={() => {
                  setCorteInitialMode("partial");
                  setCorteModalOpen(true);
                }}
                className="ml-1.5 flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-cyan-300 hover:bg-cyan-500/15 text-xs font-bold transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                title="Corte X de supervisión"
              >
                <ClipboardCheck className="h-3.5 w-3.5 text-cyan-400" />
                <span className="hidden xl:inline">Corte X</span>
              </button>
            )}
          </div>

          {/* Orders Cluster: Tabs + En Espera */}
          <div className="flex items-center rounded-xl bg-white/5 border border-white/10 p-0.5">
            <button
              onClick={() => setActiveTabsModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-purple-300 hover:bg-purple-500/15 text-xs font-bold transition-all cursor-pointer active:scale-95"
              title="Comandas activas en mesas / tienda"
            >
              <Users className="h-3.5 w-3.5 text-purple-400" />
              <span>Tabs</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-purple-500/30 text-purple-200">
                {activeTabsData?.totalActiveCount ?? 0}
              </span>
            </button>
            <button
              onClick={() => setPausedCartsModal(true)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95",
                pausedCarts.length > 0 ? "text-amber-300 bg-amber-500/20 animate-pulse" : "text-gray-400 hover:bg-white/10"
              )}
              title="Ventas pausadas en espera"
            >
              <Pause className="h-3.5 w-3.5 text-amber-400" />
              <span>Espera</span>
              {pausedCarts.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500/40 text-amber-100">
                  {pausedCarts.length}
                </span>
              )}
            </button>
          </div>

          {/* Loyalty & Scan Tools (Direct Access) */}
          <div className="flex items-center rounded-xl bg-white/5 border border-white/10 p-0.5">
            <button
              onClick={() => setShowBusinessQrModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-500/15 hover:bg-pink-500/25 text-pink-300 text-xs font-black transition-all cursor-pointer active:scale-95 shadow-sm"
              title="Mostrar QR Neón del negocio en pantalla para que el cliente lo escanee"
            >
              <QrCode className="h-3.5 w-3.5 text-pink-400 animate-pulse" />
              <span>QR Neón</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setRabbitterModalOpen(true);
                setIsScanningRabbitter(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white text-xs font-bold transition-all cursor-pointer active:scale-95"
              title="Escanear Rabbitter con la cámara"
            >
              <Camera className="h-3.5 w-3.5 text-cyan-400" />
              <span className="hidden lg:inline">Escanear</span>
            </button>
          </div>

          {/* Hardware & History */}
          <div className="flex items-center gap-1">
            {btConnected ? (
              <button
                onClick={handleDisconnectBluetooth}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold hover:bg-blue-500/30 transition-all cursor-pointer"
                title={`Impresora conectada: ${btDeviceName}`}
              >
                <BluetoothConnected className="h-3.5 w-3.5 text-blue-400" />
                <span className="hidden xl:inline">{btDeviceName || "Printer"}</span>
              </button>
            ) : (
              <button
                onClick={handleConnectBluetooth}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-blue-400 border border-white/10 transition-all cursor-pointer"
                title="Vincular impresora térmica Bluetooth"
              >
                <Bluetooth className="h-4 w-4" />
              </button>
            )}

            <button
              onClick={() => {
                setRecentOrdersModal(true);
                refetchRecentOrders();
              }}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-cyan-300 border border-white/10 transition-all cursor-pointer"
              title="Reimprimir tickets recientes"
            >
              <History className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Right: Search & Clock */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative flex items-center bg-gray-900 border border-white/10 rounded-xl h-9 w-28 sm:w-36 md:w-44 lg:w-56 px-2.5 shadow-inner">
            <Search className="h-3.5 w-3.5 text-gray-400 mr-2 shrink-0" />
            <input 
              type="text" 
              placeholder="Buscar..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
            />
          </div>
          <PosClock />
        </div>
      </header>

      {/* ── Banner: Llegada de Rabbitter (CUSTOMER_ARRIVAL del motor de proximidad) ── */}
      {arrivalBanner && (
        <div className="flex items-center gap-2 px-6 py-1.5 bg-emerald-500/10 border-b border-emerald-500/25 text-[11px] font-bold text-emerald-300">
          <Users className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span>
            {arrivalBanner.vip ? '👑 Cliente VIP' : 'Cliente Rabbitter'} en el local: <span className="text-white">{arrivalBanner.name}</span>
            {arrivalBanner.visits > 0 && ` · ${arrivalBanner.visits} visita${arrivalBanner.visits===1?'':'s'} previas`}
            {" · "}
            <button onClick={() => setArrivalBanner(null)} className="text-emerald-400/70 hover:text-white cursor-pointer underline">descartar</button>
          </span>
        </div>
      )}
      {/* ── Banner: Operación en curso (anti-abandono visual) ── */}
      {cart.length > 0 && (
        <div className="flex items-center gap-2 px-6 py-1.5 bg-amber-500/10 border-b border-amber-500/25 text-[11px] font-bold text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span>Operación en curso: {cart.reduce((s, i) => s + i.quantity, 0)} artículos · ${cart.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2)}. Pausa la venta si el comensal no se decide, o cóbrala antes de salir de esta pantalla.</span>
        </div>
      )}

      {/* ── Main Workspace ── */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Background Gradients */}
        <div className="absolute top-[-20%] right-[30%] h-200 w-200 rounded-full bg-cyan-900/20 blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] h-200 w-200 rounded-full bg-blue-900/20 blur-[150px] pointer-events-none" />

        {/* Left: Categories Sidebar */}
        {!search && (
          <aside className="w-25 md:w-30 lg:w-35 shrink-0 overflow-y-auto bg-black/40 backdrop-blur-md border-r border-white/5 p-2 lg:p-3 flex flex-col gap-2 lg:gap-3 custom-scrollbar z-10">
            {categories?.map((cat, i) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-2 lg:gap-3 rounded-[18px] lg:rounded-3xl p-2 lg:p-4 h-24 lg:h-32 transition-all duration-300 group",
                  activeCategory === cat.id 
                    ? "bg-cyan-500 shadow-[0_10px_30px_rgba(6,182,212,0.4)] border-none scale-105 z-10" 
                    : "bg-gray-900/80 border border-white/5 hover:bg-gray-800 hover:border-white/20 active:scale-95"
                )}
              >
                {/* Simulated Category Icon (based on index) */}
                <div className={cn(
                  "flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-full text-xl lg:text-2xl transition-transform duration-300",
                  activeCategory === cat.id ? "bg-white/20 scale-110" : "bg-white/5 group-hover:bg-white/10"
                )}>
                  {["☕", "🍔", "🍕", "🥗", "🍰", "🍺"][i % 6]}
                </div>
                
                <span className={cn(
                  "text-[10px] lg:text-[13px] font-black uppercase tracking-wider text-center leading-tight line-clamp-2",
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
                onClick={() => setActiveCategory("ALL")}
                className={cn(
                  "shrink-0 rounded-full px-5 py-2 text-xs font-bold transition-all duration-300 cursor-pointer",
                  activeCategory === "ALL"
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

          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 lg:gap-4">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className="group relative flex aspect-square md:aspect-4/5 flex-col justify-between overflow-hidden rounded-3xl lg:rounded-4xl bg-gray-900 border border-white/10 p-1 text-left transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.6)] hover:border-cyan-500/40 active:scale-95 cursor-pointer"
              >
                {/* Big Image Top */}
                <div className="relative h-[55%] lg:h-[65%] w-full rounded-[1.25rem] lg:rounded-[1.75rem] overflow-hidden bg-black/60 flex items-center justify-center">
                  {item.imageUrl ? (
                    <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url(${item.imageUrl})` }} />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-radial from-gray-850 via-gray-900 to-black p-4">
                      <img src="/Ra.png" alt="Rabbitty" className="h-16 w-16 lg:h-20 lg:w-20 object-contain grayscale opacity-60 select-none group-hover:opacity-85 group-hover:scale-105 transition-all" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-linear-to-t from-gray-950 via-transparent to-transparent opacity-85" />
                  
                  {/* Price Tag Badge */}
                  <div className="absolute top-2 right-2 lg:top-3 lg:right-3 rounded-full bg-black/75 backdrop-blur-md px-2 lg:px-3 py-1 lg:py-1.5 border border-white/15 shadow-xl">
                    <span className="text-xs lg:text-sm font-black text-emerald-400">${item.price.toFixed(2)}</span>
                  </div>

                  {/* Add action indicator: bottom right corner */}
                  <div className="absolute bottom-2 right-2 lg:bottom-2.5 lg:right-2.5 flex items-center justify-center">
                    <div className="flex h-7 w-7 lg:h-8 lg:w-8 items-center justify-center rounded-xl bg-black/70 backdrop-blur-md border border-white/20 text-gray-400 group-hover:text-black group-hover:bg-cyan-400 group-hover:border-cyan-300 group-hover:translate-x-0.5 transition-all duration-200 shadow-lg">
                      <ArrowRight className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                    </div>
                  </div>
                </div>
                
                {/* Content Bottom */}
                <div className="flex flex-col justify-center h-[45%] lg:h-[35%] px-3 py-2 lg:p-4 lg:pt-2">
                  <h3 className="text-sm lg:text-base font-black leading-tight text-white line-clamp-2 group-hover:text-cyan-300 transition-colors drop-shadow-sm">{item.name}</h3>
                  <p className="mt-1 text-[11px] lg:text-xs text-gray-400 font-medium line-clamp-1 lg:line-clamp-2 leading-relaxed">{item.description || "Delicioso y preparado al momento."}</p>
                </div>
              </button>
            ))}
          </div>
        </main>

        {/* Right: Cart / Ticket Panel */}
        {/* Right: Cart / Ticket Panel (Optimized 2-Column Visual Blocks) */}
        <aside className="w-80 md:w-96 lg:w-115 2xl:w-125 shrink-0 bg-gray-950/90 backdrop-blur-3xl border-l border-white/10 flex flex-col z-20 shadow-[-20px_0_50px_rgba(0,0,0,0.5)]">
          {/* Cart Header with Table Selector & Order Type */}
          <div className="flex flex-col border-b border-white/10 p-3.5 lg:p-4 bg-black/40 gap-2.5 lg:gap-3">
            <div className="flex items-center justify-between">
              {/* Table Selector Button */}
              <button
                type="button"
                onClick={() => setTableModal(true)}
                className="flex items-center gap-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 px-3.5 py-2 transition-all cursor-pointer group"
                title="Cambiar mesa o servicio"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  {orderType === "COUNTER" ? (
                    <Store className="h-4 w-4 text-amber-400" />
                  ) : orderType === "DINE_IN" ? (
                    <Table2 className="h-4 w-4 text-cyan-400" />
                  ) : orderType === "TAKEAWAY" ? (
                    <ShoppingBag className="h-4 w-4 text-purple-400" />
                  ) : (
                    <Bike className="h-4 w-4 text-emerald-400" />
                  )}
                </div>
                <div className="text-left">
                  <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1">
                    {orderType === "DINE_IN" ? "Mesa Asignada" : "Servicio"}
                    <ChevronDown className="h-3 w-3 text-cyan-400 group-hover:translate-y-0.5 transition-transform" />
                  </div>
                  <div className="text-sm font-black text-white">
                    {orderType === "COUNTER"
                      ? "Venta Mostrador"
                      : orderType === "DINE_IN"
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

              <div className="flex items-center gap-1.5">
                {cart.length > 0 && (
                  <span className="hidden sm:inline-flex px-2 py-1 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-[11px] font-black text-cyan-300">
                    {cart.reduce((s, i) => s + i.quantity, 0)} uds
                  </span>
                )}
                {/* Botón Pausar Transacción (Poner en Espera con Folio X tipo Óptima) */}
                <button
                  type="button"
                  onClick={() => {
                    if (cart.length === 0) return;
                    const nextNum = pausedCarts.length + 1;
                    const folio = `ESP-${nextNum}`;
                    const parkedEntry = {
                      id: crypto.randomUUID(),
                      folio,
                      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                      cart: [...cart],
                      orderType,
                      selectedTableId,
                      selectedRabbitter,
                      total: total,
                      itemsCount: cart.reduce((s, i) => s + i.quantity, 0),
                    };
                    setPausedCarts((prev) => [parkedEntry, ...prev]);
                    setCart([]);
                    setSelectedRabbitter(null);
                    toast.success(`⏸️ Transacción pausada como ${folio}. Pantalla libre para el siguiente cliente.`);
                  }}
                  disabled={cart.length === 0}
                  title="Pausar venta actual y asignar folio de espera (para atender a otro cliente)"
                  className="flex items-center gap-1 h-9 px-2.5 rounded-xl bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer text-xs font-bold"
                >
                  <Pause className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">Pausar</span>
                </button>

                <button 
                  onClick={() => {
                    if (cart.length > 0) setConfirmClearCart(true);
                  }} 
                  disabled={cart.length === 0}
                  title="Vaciar orden actual"
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Order Type Segmented Control (4 Options) */}
            <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-black/60 border border-white/5">
              <button
                type="button"
                onClick={() => {
                  setOrderType("COUNTER");
                  setSelectedTableId(null);
                }}
                className={cn(
                  "flex items-center justify-center gap-1 min-h-9 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                  orderType === "COUNTER"
                    ? "bg-amber-500 text-gray-950 shadow-md"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Store className="h-3 w-3" /> Mostrador
              </button>

              <button
                type="button"
                onClick={() => {
                  setOrderType("DINE_IN");
                  if (!selectedTableId && tables && tables.length > 0) {
                    setSelectedTableId(tables[0].id);
                  }
                }}
                className={cn(
                  "flex items-center justify-center gap-1 min-h-9 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                  orderType === "DINE_IN"
                    ? "bg-cyan-500 text-gray-950 shadow-md"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <UtensilsCrossed className="h-3 w-3" /> Mesa
              </button>

              <button
                type="button"
                onClick={() => {
                  setOrderType("TAKEAWAY");
                  setSelectedTableId(null);
                }}
                className={cn(
                  "flex items-center justify-center gap-1 min-h-9 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                  orderType === "TAKEAWAY"
                    ? "bg-purple-500 text-white shadow-md"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <ShoppingBag className="h-3 w-3" /> Llevar
              </button>

              <button
                type="button"
                onClick={() => {
                  setOrderType("DELIVERY");
                  setSelectedTableId(null);
                }}
                className={cn(
                  "flex items-center justify-center gap-1 min-h-9 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                  orderType === "DELIVERY"
                    ? "bg-emerald-500 text-gray-950 shadow-md"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Bike className="h-3 w-3" /> Domicilio
              </button>
            </div>

            {/* ── Rabbitter Vinculado (Identificación Previa al Cobro) ── */}
            <div className="mt-2 pt-2 border-t border-white/5">
              {selectedRabbitter ? (
                <div className="flex items-center justify-between rounded-xl bg-pink-500/10 border border-pink-500/25 p-2 gap-2 shadow-[0_0_15px_rgba(236,72,153,0.1)]">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-pink-500/20 text-pink-300 font-bold text-xs border border-pink-500/30">
                      🐰
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-white truncate">{selectedRabbitter.name}</span>
                        <span className="text-[9px] font-black text-pink-400 bg-pink-500/20 px-1 py-0.2 rounded uppercase">
                          {selectedRabbitter.level}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400">
                        <span>{selectedRabbitter.phoneNumber || selectedRabbitter.telegramId || "Cuenta Verificada"}</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-bold">{selectedRabbitter.currentRewardRate}% Cashback</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedRabbitter(null)}
                    title="Desvincular cliente"
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-300 transition-all cursor-pointer shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="w-full flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-1.5 gap-2">
                  <div className="flex items-center gap-1.5 pl-1 min-w-0">
                    <span className="text-sm shrink-0">🐰</span>
                    <div className="text-left truncate">
                      <div className="text-[11px] font-black text-gray-200 truncate">Recompensa Rabbitter</div>
                      <div className="text-[9px] text-gray-400">Cashback Bunz</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setRabbitterModalOpen(true);
                        setIsScanningRabbitter(true);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/30 text-[10px] font-black transition-all cursor-pointer active:scale-95 shadow-sm"
                      title="Escanear QR de cliente Rabbitter con cámara"
                    >
                      <Camera className="h-3 w-3" />
                      <span>Escanear</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBusinessQrModal(true)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white border border-white/15 text-[10px] font-black transition-all cursor-pointer active:scale-95 shadow-sm"
                      title="Mostrar QR Neón del negocio en pantalla"
                    >
                      <QrCode className="h-3 w-3 text-pink-400 animate-pulse" />
                      <span>QR Neón</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRabbitterModalOpen(true)}
                      className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 transition-all cursor-pointer"
                      title="Buscar cliente por teléfono o usuario"
                    >
                      <Search className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cart Items Area: Adaptive 1-Column List (<= 5 items) or 2-Column Compact Grid (>= 6 items) */}
          <div className="flex-1 overflow-y-auto p-2 lg:p-2.5 custom-scrollbar min-h-0">
            {cart.length > 0 ? (
              cart.length <= 5 ? (
                /* ── Modo Listado Elegante Ultra-Optimizado (caben los 5 sin forzar scroll) ── */
                <div className="space-y-1.5">
                  {cart.map((item) => (
                    <div 
                      key={item.id} 
                      className="group flex items-center justify-between rounded-xl bg-gray-900/90 border border-white/10 px-2.5 py-1.5 shadow-sm hover:border-cyan-500/40 hover:bg-gray-850 transition-all gap-2"
                    >
                      {/* Left: Thumbnail & Name & Unit Price */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="h-8.5 w-8.5 shrink-0 rounded-lg overflow-hidden bg-black/60 border border-white/10 flex items-center justify-center">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                          ) : (
                            <img src="/Ra.png" alt="Ra" className="h-5 w-5 object-contain grayscale opacity-40" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 pr-1">
                          <h4 className="text-xs font-black text-white leading-tight truncate" title={item.name}>
                            {item.name}
                          </h4>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-gray-400">
                              ${item.price.toFixed(2)} c/u
                            </span>
                            {item.quantity > 1 && (
                              <span className="text-[9px] font-black text-cyan-400 bg-cyan-500/10 px-1 py-0.2 rounded border border-cyan-500/20">
                                x{item.quantity}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Subtotal + Stepper + Trash */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-black text-emerald-400 w-14 text-right">
                          ${(item.price * item.quantity).toFixed(2)}
                        </span>

                        <div className="flex items-center rounded-lg bg-black/80 border border-white/10 p-0.5 shadow-inner">
                          <button
                            type="button"
                            onClick={() => {
                              setVoidingItem({ ...item, isDecrease: item.quantity > 1 });
                              setVoidReason("");
                              setManagerPin("");
                            }}
                            title="Disminuir (Requiere PIN)"
                            className="flex h-6 w-6 items-center justify-center rounded-md bg-white/5 text-gray-400 hover:bg-red-500/30 hover:text-red-300 transition-all active:scale-90 cursor-pointer"
                          >
                            <Minus className="h-2.5 w-2.5" />
                          </button>
                          <span className="w-5 text-center text-xs font-black text-white">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, 1)}
                            className="flex h-6 w-6 items-center justify-center rounded-md bg-white/5 text-white hover:bg-cyan-500 hover:text-black transition-all active:scale-90 cursor-pointer"
                          >
                            <Plus className="h-2.5 w-2.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setVoidingItem(item);
                            setVoidReason("");
                            setManagerPin("");
                          }}
                          title="Eliminar artículo (Requiere PIN)"
                          className="text-gray-500 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* ── Modo Cuadrícula Compacta 2 Columnas (6 a 10+ productos adaptados) ── */
                <div className="grid grid-cols-2 gap-1.5">
                  {cart.map((item) => (
                    <div 
                      key={item.id} 
                      className="group relative flex flex-col justify-between rounded-xl bg-gray-900/90 border border-white/10 p-2 shadow-sm hover:border-cyan-500/40 hover:bg-gray-850 transition-all"
                    >
                      {/* Header: Photo Thumbnail + Name + Trash */}
                      <div className="flex items-start gap-1.5">
                        <div className="h-7 w-7 shrink-0 rounded-lg overflow-hidden bg-black/60 border border-white/10 flex items-center justify-center">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                          ) : (
                            <img src="/Ra.png" alt="Ra" className="h-4.5 w-4.5 object-contain grayscale opacity-40" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pr-0.5">
                          <h4 className="text-[11px] font-black text-white leading-tight line-clamp-1" title={item.name}>
                            {item.name}
                          </h4>
                          <div className="text-[10px] font-black text-emerald-400 mt-0.5">
                            ${(item.price * item.quantity).toFixed(2)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setVoidingItem(item);
                            setVoidReason("");
                            setManagerPin("");
                          }}
                          title="Eliminar artículo (Requiere PIN)"
                          className="text-gray-500 hover:text-red-400 p-0.5 rounded hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Bottom: Stepper Controls */}
                      <div className="mt-1.5 pt-1 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[9px] text-gray-500 font-bold truncate max-w-16">
                          ${item.price.toFixed(2)}
                        </span>
                        <div className="flex items-center rounded-md bg-black/80 border border-white/10 p-0.5 shadow-inner">
                          <button
                            type="button"
                            onClick={() => {
                              setVoidingItem({ ...item, isDecrease: item.quantity > 1 });
                              setVoidReason("");
                              setManagerPin("");
                            }}
                            title="Disminuir (Requiere PIN)"
                            className="flex h-5 w-5 items-center justify-center rounded bg-white/5 text-gray-400 hover:bg-red-500/30 hover:text-red-300 transition-all active:scale-90 cursor-pointer"
                          >
                            <Minus className="h-2 w-2" />
                          </button>
                          <span className="w-4.5 text-center text-[11px] font-black text-white">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, 1)}
                            className="flex h-5 w-5 items-center justify-center rounded bg-white/5 text-white hover:bg-cyan-500 hover:text-black transition-all active:scale-90 cursor-pointer"
                          >
                            <Plus className="h-2 w-2" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center px-8 opacity-50 py-12">
                <div className="h-16 w-16 rounded-full border-4 border-dashed border-gray-700 flex items-center justify-center mb-3">
                  <CheckCircle2 className="h-7 w-7 text-gray-600" />
                </div>
                <h3 className="text-lg font-black text-gray-400 mb-0.5">Orden Vacía</h3>
                <p className="text-xs font-medium text-gray-500">Toca cualquier platillo del menú para agregarlo.</p>
              </div>
            )}
          </div>

          {/* Cart Footer (Totals & Actions) - Ultracompacto y Adaptado a la altura óptima */}
          <div className="p-2.5 lg:p-3 bg-black/85 border-t border-white/10 shrink-0 flex flex-col justify-end shadow-2xl">
            {/* Quick action to zoom order */}
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-gray-400 uppercase tracking-widest font-black">Resumen de Orden</span>
              <button 
                onClick={() => setOrderZoomModal(true)}
                disabled={cart.length === 0}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <Maximize2 className="h-3 w-3" /> Ampliar
              </button>
            </div>
            
            <div className="space-y-0.5 mb-2 bg-white/2 px-2.5 py-1.5 rounded-xl border border-white/5">
              <div className="flex justify-between text-[11px] text-gray-400 font-bold">
                <span>Subtotal (Base)</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-cyan-400 font-bold">
                <span>IVA (16% Incluido)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base lg:text-lg font-black text-white pt-1 border-t border-white/10 mt-0.5">
                <div className="flex flex-col">
                  <span className="leading-none">Total</span>
                  <span className="text-[9px] text-gray-500 font-bold tracking-wider uppercase">Impuestos incl.</span>
                </div>
                <span className="text-emerald-400 font-black">${total.toFixed(2)}</span>
              </div>
              {selectedRabbitter && total > 0 && (
                <div className="flex items-center justify-between text-[11px] font-bold text-pink-400 pt-1 mt-0.5 border-t border-pink-500/20 bg-pink-500/10 -mx-2.5 px-2.5 py-1 rounded-b-lg">
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Recompensa ({selectedRabbitter.currentRewardRate}%)
                  </span>
                  <span className="font-black text-white">
                    +{Math.floor(total * (selectedRabbitter.currentRewardRate / 100))} Bunz
                  </span>
                </div>
              )}
            </div>

            {/* Loyalty Quick Actions right before payment */}
            {!selectedRabbitter && total > 0 && (
              <div className="flex items-center justify-between px-2.5 py-1 rounded-xl bg-pink-500/10 border border-pink-500/20 mb-2">
                <span className="text-[10px] font-black text-pink-300 flex items-center gap-1">
                  <span>🐰</span> ¿Cliente Rabbitter?
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setRabbitterModalOpen(true);
                      setIsScanningRabbitter(true);
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 text-[10px] font-bold transition-all cursor-pointer active:scale-95"
                  >
                    <Camera className="h-3 w-3" />
                    <span>Escanear</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBusinessQrModal(true)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[10px] font-bold transition-all cursor-pointer active:scale-95"
                  >
                    <QrCode className="h-3 w-3 text-pink-400" />
                    <span>QR Neón</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Payment Methods */}
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              <button 
                onClick={() => requestCheckout("EFECTIVO")}
                disabled={cart.length === 0}
                className="group flex flex-col items-center justify-center gap-0.5 rounded-xl bg-white/5 py-1.5 border border-white/10 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all active:scale-95 cursor-pointer disabled:opacity-40"
              >
                <Banknote className="h-4 w-4 text-gray-400 group-hover:text-emerald-400" />
                <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 group-hover:text-emerald-400">Efectivo</span>
              </button>
              <button 
                onClick={() => requestCheckout("TARJETA")}
                disabled={cart.length === 0}
                className="group flex flex-col items-center justify-center gap-0.5 rounded-xl bg-white/5 py-1.5 border border-white/10 hover:bg-blue-500/20 hover:border-blue-500/50 transition-all active:scale-95 cursor-pointer disabled:opacity-40"
              >
                <CreditCard className="h-4 w-4 text-gray-400 group-hover:text-blue-400" />
                <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 group-hover:text-blue-400">Tarjeta</span>
              </button>
              <button 
                onClick={() => requestCheckout("QR BUNZ")}
                disabled={cart.length === 0}
                className="group flex flex-col items-center justify-center gap-0.5 rounded-xl bg-white/5 py-1.5 border border-white/10 hover:bg-purple-500/20 hover:border-purple-500/50 transition-all active:scale-95 cursor-pointer disabled:opacity-40"
              >
                <QrCode className="h-4 w-4 text-gray-400 group-hover:text-purple-400" />
                <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 group-hover:text-purple-400">QR Bunz</span>
              </button>
              <button 
                onClick={() => requestCheckout("DIVIDIDA")}
                disabled={cart.length === 0}
                className="group flex flex-col items-center justify-center gap-0.5 rounded-xl bg-white/5 py-1.5 border border-white/10 hover:bg-orange-500/20 hover:border-orange-500/50 transition-all active:scale-95 cursor-pointer disabled:opacity-40"
              >
                <SplitSquareHorizontal className="h-4 w-4 text-gray-400 group-hover:text-orange-400" />
                <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 group-hover:text-orange-400">Dividir</span>
              </button>
            </div>

            {/* Massive Checkout & Digital Dispatch Buttons */}
            <div className="flex gap-2">
              <button 
                onClick={() => setSendBillModal(true)}
                disabled={cart.length === 0}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/40 text-xs font-black transition-all active:scale-95 disabled:opacity-40 cursor-pointer shadow-md"
                title="Enviar cuenta digital al móvil del Rabbitter"
              >
                <Send className="h-4 w-4 text-pink-400" />
                <span className="hidden sm:inline">Enviar al Móvil</span>
              </button>
              <button 
                onClick={() => requestCheckout("VENTA DIRECTA")}
                disabled={cart.length === 0}
                className="relative flex-1 overflow-hidden rounded-xl bg-cyan-500 py-2.5 text-base font-black text-gray-950 shadow-[0_8px_25px_rgba(6,182,212,0.35)] transition-all hover:bg-cyan-400 active:scale-95 disabled:opacity-50 disabled:shadow-none group cursor-pointer"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-[0%] transition-transform duration-300 ease-out" />
                <span className="relative z-10 flex items-center justify-center gap-1.5">
                  <Check className="h-5 w-5" /> COBRAR (${total.toFixed(2)})
                </span>
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Modal de Confirmación para Vaciar Orden */}
      {/* ── Modal: Vaciar orden / Descartar pausada — requiere PIN de Gerente (anti-robo Óptima) ── */}
      <Dialog
        open={confirmClearCart || pendingDiscardFolio !== null}
        onClose={() => { setConfirmClearCart(false); setPendingDiscardFolio(null); setClearCartPin(""); }}
        title={pendingDiscardFolio ? `¿Descartar la comanda ${pendingDiscardFolio}?` : "¿Vaciar la orden actual?"}
        className="max-w-sm w-full"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>
              {pendingDiscardFolio
                ? "Eliminarás la comanda en espera. Ninguna venta quedará registrada en el sistema."
                : `Esta acción eliminará todos los platillos (${cart.reduce((s, i) => s + i.quantity, 0)}) de la cuenta actual sin registrar la venta.`}
            </span>
          </div>
          <label className="text-xs font-bold text-gray-300 block">PIN de Gerente / Administrador para autorizar el descarte</label>
          <Input
            type="password"
            maxLength={4}
            value={clearCartPin}
            onChange={(e) => setClearCartPin(e.target.value.replace(/\D/g, ""))}
            placeholder="••••"
            className="text-center text-lg tracking-widest font-black py-2.5"
            autoFocus
          />
          <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
            <Button variant="secondary" onClick={() => { setConfirmClearCart(false); setPendingDiscardFolio(null); setClearCartPin(""); }}>Cancelar</Button>
            <Button
              variant="danger"
              disabled={clearCartPin.length !== 4}
              onClick={async () => {
                if (clearCartPin.length !== 4) return;
                try {
                  await verifyPinMutation.mutateAsync({ pin: clearCartPin });
                  if (pendingDiscardFolio !== null) {
                    setPausedCarts((prev) => prev.filter((p) => p.folio !== pendingDiscardFolio));
                    setPendingDiscardFolio(null);
                    toast.success("Comanda pausada descartada con autorización registrada.");
                  } else {
                    setCart([]);
                    setConfirmClearCart(false);
                    toast.success("Orden vaciada con autorización registrada.");
                  }
                  setClearCartPin("");
                } catch {
                  toast.error("PIN de Gerente incorrecto. Intenta de nuevo.");
                  setClearCartPin("");
                }
              }}
            >
              {verifyPinMutation.isPending ? "Validando..." : "Autorizar y Descartar"}
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
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setOrderType("COUNTER");
                setSelectedTableId(null);
                setTableModal(false);
                toast.success("Modo: Venta de Mostrador / Caja Rápida");
              }}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer text-center gap-1.5",
                orderType === "COUNTER"
                  ? "bg-amber-500/20 border-amber-500 text-amber-300"
                  : "bg-white/5 border-white/10 hover:bg-white/10 text-gray-300"
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-bold text-lg">
                🏪
              </div>
              <div>
                <h4 className="font-bold text-xs text-white">Mostrador</h4>
                <p className="text-[10px] text-gray-400">Caja rápida</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setOrderType("TAKEAWAY");
                setSelectedTableId(null);
                setTableModal(false);
                toast.success("Modo: Pedido Para Llevar");
              }}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer text-center gap-1.5",
                orderType === "TAKEAWAY"
                  ? "bg-purple-500/20 border-purple-500 text-purple-300"
                  : "bg-white/5 border-white/10 hover:bg-white/10 text-gray-300"
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 font-bold text-lg">
                🛍️
              </div>
              <div>
                <h4 className="font-bold text-xs text-white">Para Llevar</h4>
                <p className="text-[10px] text-gray-400">Sin mesa</p>
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
                "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer text-center gap-1.5",
                orderType === "DELIVERY"
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                  : "bg-white/5 border-white/10 hover:bg-white/10 text-gray-300"
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-lg">
                🛵
              </div>
              <div>
                <h4 className="font-bold text-xs text-white">A Domicilio</h4>
                <p className="text-[10px] text-gray-400">Reparto</p>
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
                  const activeTab = activeTabsData?.activeTabs.find((tab) => tab.tableId === t.id);
                  const hasCustomer = !!activeTab?.customer;
                  const isCashRequested = activeTab?.cashRequested;

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTableId(t.id);
                        setOrderType("DINE_IN");
                        if (activeTab?.customer && !selectedRabbitter) {
                          setSelectedRabbitter({
                            id: activeTab.customer.id || "",
                            name: activeTab.customer.name,
                            phoneNumber: activeTab.customer.phone || "",
                            telegramId: activeTab.customer.username || "",
                            level: "Rabbitter",
                            currentRewardRate: 20,
                            bunzBalance: 0,
                            hops: 0,
                          });
                        }
                        setTableModal(false);
                        if (isCashRequested) {
                          toast.warning(`⚠️ Mesa ${t.number} solicitó pagar $${activeTab.total.toFixed(2)} en efectivo`);
                        } else {
                          toast.success(`Mesa ${t.number} asignada`);
                        }
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer active:scale-95 relative",
                        isSelected
                          ? "bg-cyan-500 text-gray-950 border-cyan-400 shadow-[0_4px_20px_rgba(6,182,212,0.4)]"
                          : isCashRequested
                          ? "bg-amber-500/20 border-amber-500/80 text-amber-200 animate-pulse shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                          : hasCustomer
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                          : "bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20"
                      )}
                    >
                      {isCashRequested ? (
                        <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-gray-950 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow">
                          💵 Cobra Efectivo
                        </span>
                      ) : hasCustomer ? (
                        <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-gray-950 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow">
                          🐰 {activeTab.customer?.name.split(" ")[0]}
                        </span>
                      ) : null}
                      <span className="text-lg font-black leading-none mb-1">Mesa {t.number}</span>
                      <span className={cn("text-[10px] font-bold", isSelected ? "text-gray-900" : isCashRequested ? "text-amber-300" : hasCustomer ? "text-emerald-300" : "text-gray-400")}>
                        {isCashRequested ? `Paga $${activeTab?.total.toFixed(2)}` : `${t.location || "Salón"} • 👤 ${t.capacity}`}
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

      {/* Modal para Ampliar Lista de Orden (Zoom) */}
      <Dialog
        open={orderZoomModal}
        onClose={() => setOrderZoomModal(false)}
        title="Resumen Ampliado de Orden"
      >
        <div className="space-y-4">
          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar space-y-2 p-1">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl bg-gray-900 border border-white/10 p-3">
                <div>
                  <h4 className="text-sm font-bold text-white">{item.name}</h4>
                  <p className="text-xs text-gray-400">${item.price.toFixed(2)} c/u</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-cyan-400">x{item.quantity}</span>
                  <span className="text-sm font-black text-emerald-400">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-white/10 flex justify-between items-center">
            <span className="text-sm font-bold text-gray-400">Total en Orden:</span>
            <span className="text-xl font-black text-emerald-400">${total.toFixed(2)}</span>
          </div>

          <div className="flex justify-end pt-3 border-t border-white/5">
            <Button onClick={() => setOrderZoomModal(false)}>Cerrar Resumen</Button>
          </div>
        </div>
      </Dialog>

      {/* Confirmación de cobro: efectivo con desglose de recibido y cambio o confirmación directa de tarjeta */}
      <Dialog 
        open={!!pendingMethod} 
        onClose={() => setPendingMethod(null)} 
        title={pendingMethod === "EFECTIVO" || pendingMethod === "VENTA DIRECTA" || pendingMethod === "DIVIDIDA" ? "Cobro en Efectivo" : "Confirmar cobro"}
        className="max-w-md w-full"
      >
        {(() => {
          const isCash = pendingMethod === "EFECTIVO" || pendingMethod === "VENTA DIRECTA" || pendingMethod === "DIVIDIDA";
          const numericReceived = parseFloat(cashReceived) || 0;
          const change = numericReceived >= total ? numericReceived - total : 0;
          const isExact = cashReceived !== "" && numericReceived === total;
          const isShort = cashReceived !== "" && numericReceived > 0 && numericReceived < total;
          const shortage = total - numericReceived;

          // Billetes comunes en México superiores o iguales al total (y denominaciones clave)
          const billSuggestions = [50, 100, 200, 500, 1000].filter(b => b >= total || (total > 200 && b >= 200));
          if (billSuggestions.length === 0) billSuggestions.push(Math.ceil(total / 100) * 100);

          return (
            <div className="flex flex-col gap-4 p-2">
              {/* Resumen Superior */}
              <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase font-bold tracking-wider text-gray-400">Total a Pagar</span>
                  <p className="text-3xl font-black text-white tracking-tight">${total.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                    {pendingMethod === "VENTA DIRECTA" ? "EFECTIVO" : pendingMethod === "DIVIDIDA" ? "EFECTIVO (DIVIDIDA)" : pendingMethod}
                  </span>
                  <p className="text-[11px] text-gray-400 mt-1">{cart.reduce((s, i) => s + i.quantity, 0)} artículo(s)</p>
                </div>
              </div>

              {/* Rabbitter Vinculado en Cobro */}
              {selectedRabbitter && (
                <div className="rounded-2xl bg-pink-500/10 border border-pink-500/25 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🐰</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-white">{selectedRabbitter.name}</span>
                        <span className="text-[9px] font-black text-pink-400 bg-pink-500/20 px-1 py-0.2 rounded uppercase">
                          {selectedRabbitter.level}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400">
                        {selectedRabbitter.phoneNumber || selectedRabbitter.telegramId || "Cuenta Verificada"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Recompensa</span>
                    <span className="text-xs font-black text-emerald-400">
                      +{Math.floor(total * (selectedRabbitter.currentRewardRate / 100))} Bunz ({selectedRabbitter.currentRewardRate}%)
                    </span>
                  </div>
                </div>
              )}

              {isCash ? (
                <>
                  {/* Entrada Dinero Recibido */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-gray-300">¿Cuánto efectivo entrega el cliente?</label>
                      <button
                        type="button"
                        onClick={() => setCashReceived(total.toFixed(2))}
                        className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                      >
                        Monto exacto (${total.toFixed(2)})
                      </button>
                    </div>

                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-400">$</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        autoFocus
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        placeholder={total.toFixed(2)}
                        className="w-full pl-8 pr-12 py-3 rounded-2xl bg-gray-900 border-2 border-white/15 focus:border-cyan-500 text-2xl font-black text-white placeholder-gray-600 outline-none transition-all tracking-tight"
                      />
                      {cashReceived && (
                        <button
                          type="button"
                          onClick={() => setCashReceived("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 flex items-center justify-center text-xs font-black cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Botones de billetes rápidos */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Billetes sugeridos</span>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setCashReceived(total.toFixed(2))}
                        className={`py-2 px-1 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                          isExact
                            ? "bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-500/10"
                            : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20"
                        }`}
                      >
                        Exacto
                      </button>
                      {billSuggestions.slice(0, 3).map((bill) => (
                        <button
                          key={bill}
                          type="button"
                          onClick={() => setCashReceived(bill.toString())}
                          className={`py-2 px-1 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                            numericReceived === bill
                              ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/10"
                              : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20"
                          }`}
                        >
                          ${bill}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Panel de Cambio a Devolver */}
                  <div
                    className={`rounded-2xl p-4 border transition-all ${
                      isShort
                        ? "bg-red-500/10 border-red-500/30 text-red-300"
                        : numericReceived >= total
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-lg shadow-emerald-500/10"
                        : "bg-white/5 border-white/10 text-gray-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Banknote className="h-5 w-5" />
                        <span className="text-xs font-bold uppercase tracking-wider">
                          {isShort ? "Falta por cobrar:" : "Cambio a devolver:"}
                        </span>
                      </div>
                      <span className={`text-2xl font-black tracking-tight ${isShort ? "text-red-400" : "text-emerald-400"}`}>
                        ${isShort ? shortage.toFixed(2) : change.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </>
              ) : pendingMethod === "TARJETA" ? (
                <div className="py-2 space-y-3">
                  {stripeStatus.data?.chargesEnabled && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCardFlowChoice("stripe")}
                        className={cn(
                          "flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all cursor-pointer",
                          cardFlowChoice === "stripe"
                            ? "bg-cyan-500/15 border-cyan-500/50"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        )}
                      >
                        <span className="text-xl">📱</span>
                        <span className="text-[11px] font-black text-cyan-300">Rabbitty Pay</span>
                        <span className="text-[9px] text-gray-400 leading-snug">Paga desde su teléfono con Apple Pay / tarjeta (QR en pantalla)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCardFlowChoice("external")}
                        className={cn(
                          "flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all cursor-pointer",
                          cardFlowChoice === "external"
                            ? "bg-blue-500/15 border-blue-500/50"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        )}
                      >
                        <span className="text-xl">🏦</span>
                        <span className="text-[11px] font-black text-blue-300">Mi Terminal</span>
                        <span className="text-[9px] text-gray-400 leading-snug">Cobra con tu terminal física (Clip / BBVA / MP) y confirma aquí</span>
                      </button>
                    </div>
                  )}
                  {cardFlowChoice === "external" ? (
                    <>
                      <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 mb-1">
                        <CreditCard className="h-7 w-7 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-white">💳 Cobro con Terminal Externa</h3>
                        <p className="text-xs text-gray-300 mt-1 max-w-xs mx-auto leading-relaxed">
                          Pasa la tarjeta física del cliente en tu terminal bancaria (Clip, BBVA o Mercado Pago).
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/30 text-left text-xs space-y-1.5">
                        <div className="flex justify-between items-center text-gray-300">
                          <span>Total a cobrar en terminal:</span>
                          <strong className="text-base font-black text-cyan-400">${total.toFixed(2)}</strong>
                        </div>
                        <p className="text-[11px] text-gray-400 leading-snug">
                          Presiona <strong className="text-emerald-400">✅ Terminal Aprobada</strong> únicamente tras verificar el voucher o mensaje de éxito en la máquina física.
                        </p>
                      </div>
                      {selectedTableId && orderType === "DINE_IN" && (
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px] font-semibold flex items-center gap-1.5 text-left">
                          <span>⏳</span>
                          <span>La mesa y comanda se mantendrán protegidas hasta confirmar la aprobación.</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 text-center space-y-3">
                      <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-1">
                        <QrCode className="h-7 w-7 animate-pulse" />
                      </div>
                      <h3 className="text-base font-black text-white">📱 Cobro Digital con Rabbitty Pay</h3>
                      <p className="text-xs text-gray-300 max-w-xs mx-auto leading-relaxed">
                        Se generará un código QR en pantalla para que el cliente pague con <strong className="text-white">Apple Pay</strong> o tarjeta desde su teléfono.
                      </p>
                      <div className="p-2.5 rounded-xl bg-cyan-900/30 border border-cyan-500/20 text-xs flex justify-between items-center">
                        <span className="text-gray-300">Total a liquidar:</span>
                        <strong className="text-base font-black text-cyan-400">${total.toFixed(2)} MXN</strong>
                      </div>
                      <p className="text-[10px] text-gray-400">
                        La comanda se liquida y el ticket se emite automáticamente cuando Stripe confirma el pago.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-2 text-center text-sm text-gray-300">
                  ¿Confirmas el cobro de esta orden con <strong className="text-white">{pendingMethod}</strong>?
                </div>
              )}

              {/* Botones de Acción */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button 
                  variant="secondary" 
                  id="pos-cancel-charge" 
                  onClick={() => {
                    setPendingMethod(null);
                    setCashReceived("");
                  }}
                  className="rounded-xl py-3 font-bold"
                >
                  Cancelar
                </Button>
                <Button 
                  id="pos-confirm-charge" 
                  disabled={isCash && cashReceived !== "" && numericReceived < total}
                  onClick={() => {
                    const finalCash = isCash ? (numericReceived > 0 ? numericReceived : total) : undefined;
                    const m = pendingMethod === "TARJETA"
                      ? (cardFlowChoice === "external" ? "TARJETA_EXTERNA" : "TARJETA_STRIPE")
                      : pendingMethod;
                    (window as any).__rabbittyCardFlow = m;
                    confirmCheckout(finalCash);
                  }} 
                  className={`rounded-xl py-3 font-black text-sm shadow-lg cursor-pointer ${
                    isCash && cashReceived !== "" && numericReceived < total
                      ? "opacity-40 cursor-not-allowed bg-gray-700 text-gray-400"
                      : "bg-emerald-500 hover:bg-emerald-400 text-gray-950 shadow-emerald-500/20"
                  }`}
                >
                  {isCash
                    ? (change > 0 ? `Cobrar (Cambio $${change.toFixed(2)})` : "Cobrar Orden")
                    : pendingMethod === "TARJETA"
                    ? (cardFlowChoice === "external"
                        ? "✅ Terminal Aprobada (Cerrar Cuenta)"
                        : "💳 Generar cobro Rabbitty Pay")
                    : "Confirmar y cobrar"}
                </Button>
              </div>
            </div>
          );
        })()}
      </Dialog>

      {/* Modal de Ticket de Venta / Comprobante de Cobro */}
      <Dialog
        open={receiptModal}
        onClose={() => {
          setReceiptModal(false);
          setCart([]);
        }}
        title="Ticket de Venta Generado"
        className="max-h-[92dvh] flex flex-col p-4 sm:p-6"
      >
        <div className="flex flex-col max-h-[82dvh]">
          {/* Header del Modal con botón directo de Nueva Orden */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white leading-tight">¡Cobro Exitoso!</h2>
                <p className="text-gray-400 text-xs">El ticket ha sido emitido.</p>
              </div>
            </div>
            <button
              onClick={() => {
                setReceiptModal(false);
                setCart([]);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-gray-950 text-xs font-black transition-all cursor-pointer shadow-md active:scale-95"
            >
              <span>Nueva Orden</span>
              <Check className="h-4 w-4" />
            </button>
          </div>

          {/* Scaled ticket preview con scroll acotado */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-3 my-2 flex justify-center max-h-[42vh] sm:max-h-[46vh] bg-black/40 rounded-xl border border-white/5">
            <div className="transform scale-[0.8] sm:scale-[0.85] origin-top flex justify-center w-full">
              {paidTicketData && (
                <TicketTemplate data={paidTicketData} />
              )}
            </div>
          </div>

          {/* Acciones Post-Cobro: Asignar Rabbitter / QR de reclamo / Imprimir / WhatsApp */}
          <div className="flex flex-col gap-2 pt-2 border-t border-white/5 shrink-0">
            {paidTicketData && !paidTicketData.awardedBunz && (
              <Button
                onClick={() => setRabbitterModalOpen(true)}
                className="w-full py-2 text-xs font-black bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/40 cursor-pointer"
                title="Asigna al Rabbitter que consumió para acreditarle su cashback Bunz (idempotente)"
              >
                🐰 Asignar Rabbitter & Recompensar esta venta
              </Button>
            )}
            {paidTicketData?.claimToken && (
              <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-gray-400 leading-snug pr-2">El comensal también puede reclamar escaneando el QR impreso de su ticket (48 h, un solo uso).</span>
                <QRDiscovery
                    value={`https://app.rabbitty.me/scan?claimToken=${paidTicketData.claimToken}`}
                    variant="rabbitter"
                    size={96}
                    revealMode="immediate"
                    surfaceKey="pos-ticket"
                  />
              </div>
            )}
            <Button
              id="pos-print-receipt"
              variant="secondary"
              onClick={handlePrintReceipt}
              disabled={printingKey !== null}
              aria-busy={printingKey === "receipt"}
              className="w-full font-bold py-2 text-sm bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 disabled:opacity-70 disabled:cursor-wait"
            >
              {printingKey === "receipt" ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-cyan-300/30 border-t-cyan-300 animate-spin" />
                  Imprimiendo...
                </span>
              ) : (
                "Imprimir ticket"
              )}
            </Button>
            <div className="flex items-center gap-2">
              <Input
                placeholder="WhatsApp (10 dígitos)"
                type="tel"
                value={waPhone}
                onChange={(e) => setWaPhone(e.target.value.replace(/\D/g, ''))}
                className="flex-1 text-center py-2 text-sm"
              />
              <Button
                onClick={() => {
                  if (paidTicketData && ticketContext?.restaurant && waPhone.length >= 10) {
                    const itemsSummary = paidTicketData.items.map(i => `${i.quantity}x ${i.name} - $${i.totalPrice.toFixed(2)}`).join('\n');
                    const message = `¡Hola! Aquí está tu ticket de compra en *${ticketContext.restaurant.name}*\n\n` +
                      `📅 Fecha: ${paidTicketData.date || ""}\n` +
                      `🔖 Folio: #${paidTicketData.orderNumber}\n\n` +
                      `*Artículos:*\n${itemsSummary}\n\n` +
                      `*Total:* $${paidTicketData.total.toFixed(2)} ${paidTicketData.currency}\n\n` +
                      `¡Gracias por tu preferencia! 🐰`;
                    // encodeURIComponent codifica #, $, emojis y saltos de línea (un # sin codificar truncaba el mensaje)
                    window.open(`https://wa.me/52${waPhone}?text=${encodeURIComponent(message)}`, "_blank");
                  } else {
                    toast.error("Ingresa un número válido a 10 dígitos");
                  }
                }}
                className="bg-green-500 hover:bg-green-400 text-white font-bold text-xs px-4 py-2 shrink-0 flex items-center gap-1.5"
              >
                <MessageCircle className="h-4 w-4" /> Enviar
              </Button>
            </div>
            
            <Button
              variant="secondary"
              className="w-full font-bold py-2.5 text-sm bg-white/10 hover:bg-white/15 text-white border border-white/10"
              onClick={() => {
                setReceiptModal(false);
                setCart([]);
              }}
            >
              Nueva Orden (Cerrar Pantalla)
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Caja / Turnos: apertura, retiro, arqueo X, traspaso y cierre Z (todo con PIN) */}
      <CashShiftModal
        open={corteModalOpen}
        onClose={() => {
          setCorteModalOpen(false);
          setCorteInitialMode(undefined);
        }}
        buildTicketHeader={buildTicketHeader}
        initialMode={corteInitialMode}
      />
      <Dialog
        open={!!qrPaymentModal}
        onClose={() => setQrPaymentModal(null)}
        title="Pago con Bunz"
      >
        {qrPaymentModal && (
          <div className="flex flex-col items-center justify-center p-6 space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-black text-white">Escanea para Pagar</h2>
              <p className="text-gray-400 mt-2">
                Paga <span className="font-bold text-white">${qrPaymentModal.amount.toFixed(2)} MXN</span> con <span className="font-bold text-purple-400">{qrPaymentModal.bunz.toFixed(2)} Bunz</span>
              </p>
            </div>
            
            <div className="bg-white p-4 rounded-2xl shadow-[0_0_40px_rgba(168,85,247,0.3)] border-4 border-purple-500 relative">
              {pollData?.status === "PAYMENT_VERIFIED" || pollData?.status === "SETTLED" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm rounded-xl">
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-2" />
                  <span className="text-emerald-600 font-bold">¡Pago Verificado!</span>
                </div>
              ) : null}
              <QRDiscovery
                  value={`rabbitty://pay?intent=${qrPaymentModal.intentId}&fallback=https://rabbitty.me/scan`}
                  variant="rabbitter"
                  size={250}
                  revealMode="immediate"
                  surfaceKey="pos-pay"
                />
            </div>

            <div className="text-center w-full max-w-sm">
              <p className="text-sm text-gray-400">
                Tiempo restante: <span className="text-white">{Math.max(0, Math.floor((qrPaymentModal.expiresAt.getTime() - Date.now()) / 1000))}</span>s
              </p>
              <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full transition-all duration-1000 ease-linear" 
                  style={{ width: `${Math.max(0, (qrPaymentModal.expiresAt.getTime() - Date.now()) / (5 * 60 * 1000) * 100)}%` }} 
                />
              </div>
            </div>

            {/* ── Modal Rabbitty Pay (Stripe Connect) — QR para el teléfono del comensal ── */}
            {stripePayModal && (
              <div className="flex flex-col items-center justify-center p-6 space-y-6">
                {stripePaid ? (
                  <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                ) : (
                  <>
                    <div className="text-center">
                      <h2 className="text-2xl font-black text-white">💳 Cobro Rabbitty Pay</h2>
                      <p className="text-gray-400 mt-1 text-sm">
                        Muestra este código al comensal: paga <span className="font-bold text-white">${stripePayModal.amount.toFixed(2)} MXN</span> con Apple Pay o tarjeta desde su teléfono.
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.35)] border-4 border-cyan-500 relative">
                      <QRDiscovery
                  value={stripePayModal.payUrl}
                  variant="rabbitter"
                  size={250}
                  revealMode="immediate"
                  surfaceKey="pos-stripe"
                />
                    </div>
                    <div className="flex flex-col items-center gap-1 text-center">
                      <p className="text-xs text-gray-400">La comanda se liquida automáticamente en el POS al confirmar el pago.</p>
                      {stripePayModal.bunzApplied > 0 && <p className="text-[11px] font-bold text-pink-300">🎁 +{stripePayModal.bunzApplied} Bunz al Rabbitter identificado</p>}
                      <button
                        type="button"
                        onClick={async () => {
                          if (stripeIntentId.current) {
                            await cancelStripeIntent.mutateAsync({ intentId: stripeIntentId.current }).catch(() => {});
                          }
                          setStripePayModal(null);
                          toast.info("Cobro Stripe cancelado; cualquier hold de Bunz fue liberado.");
                        }}
                        className="text-[11px] font-bold text-gray-500 hover:text-red-400 mt-1 cursor-pointer"
                      >Cancelar cobro</button>
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="flex gap-4 w-full">
              <Button 
                variant="secondary" 
                className="flex-1" 
                onClick={() => setQrPaymentModal(null)}
                disabled={pollData?.status === "PAYMENT_VERIFIED" || pollData?.status === "SETTLED"}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Modal de Identificación y Vinculación de Rabbitter ── */}
      <Dialog
        open={rabbitterModalOpen}
        onClose={() => {
          setRabbitterModalOpen(false);
          setIsScanningRabbitter(false);
          setRabbitterQuery("");
        }}
        title="Identificar Rabbitter (Recompensa Directa)"
        className="max-w-md w-full"
      >
        <div className="space-y-4 p-1">
          <p className="text-xs text-gray-400">
            Escanea el <strong className="text-pink-400">Rabbitty Code</strong> del cliente o ingresa su teléfono / usuario para vincularlo a la cuenta y acreditar su recompensa automáticamente al cobrar.
          </p>

          {/* Opción de Escaneo con Cámara en Vivo */}
          {isScanningRabbitter ? (
            <div className="space-y-3 flex flex-col items-center">
              <div id="rabbitter-cam-reader" className="w-full max-w-[280px] h-[280px] rounded-2xl overflow-hidden border-2 border-pink-500/60 shadow-[0_0_30px_rgba(236,72,153,0.3)] bg-black" />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsScanningRabbitter(false)}
                className="text-xs font-bold"
              >
                Cerrar Cámara
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsScanningRabbitter(true)}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/30 text-pink-300 text-xs font-black transition-all cursor-pointer shadow-[0_0_20px_rgba(236,72,153,0.15)] active:scale-95"
            >
              <Camera className="h-4 w-4 text-pink-400 animate-pulse" />
              <span>Activar Cámara para Escanear Rabbitter</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <div className="h-px bg-white/10 flex-1" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">O busca por teléfono/ID</span>
            <div className="h-px bg-white/10 flex-1" />
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!rabbitterQuery.trim()) return;
              setIsSearchingRabbitter(true);
              try {
                const res = await utils.pos.lookupRabbitter.fetch({ query: rabbitterQuery.trim() });
                if (res) {
                  setRabbitterQuery("");
                  if (receiptModal && lastPaidOrderId) {
                    // ── Asignación POST-cobro manual (por teléfono / ID) ──
                    const linked = await linkPostCheckout.mutateAsync({
                      orderId: lastPaidOrderId,
                      customerId: res.id,
                      customerPhone: res.phoneNumber || res.telegramId || "sin-telefono",
                      customerName: res.name,
                      awardBunz: true,
                    });
                    setRabbitterModalOpen(false);
                    setLastPaidOrderId(null);
                    setPaidTicketData((prev: any) => prev ? { ...prev, awardedBunz: linked.awardedBunz || prev.awardedBunz } : prev);
                    toast.success(linked.awardedBunz > 0
                      ? `🐰 ¡Asignado y recompensado: ${linked.awardedBunz} Bunz a ${res.name}!`
                      : `🐰 Cliente asignado a la venta.`);
                    return;
                  }
                  setSelectedRabbitter(res);
                  setRabbitterModalOpen(false);
                  toast.success(`🐰 ¡Rabbitter vinculado: ${res.name}!`);
                } else {
                  toast.error("No se encontró ningún Rabbitter con ese código o teléfono.");
                }
              } catch (err: any) {
                toast.error(err?.message || "Error al buscar Rabbitter");
              } finally {
                setIsSearchingRabbitter(false);
              }
            }}
            className="space-y-3"
          >
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                autoFocus
                value={rabbitterQuery}
                onChange={(e) => setRabbitterQuery(e.target.value)}
                placeholder="Teléfono (10 dígitos), ID o código..."
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-gray-900 border border-white/15 focus:border-pink-500 text-sm font-bold text-white placeholder-gray-500 outline-none transition-all"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setRabbitterModalOpen(false);
                  setIsScanningRabbitter(false);
                  setRabbitterQuery("");
                }}
                className="flex-1 py-2.5 font-bold text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!rabbitterQuery.trim() || isSearchingRabbitter}
                className="flex-1 py-2.5 font-black text-xs bg-pink-500 hover:bg-pink-400 text-white shadow-lg shadow-pink-500/20 disabled:opacity-40 cursor-pointer"
              >
                {isSearchingRabbitter ? "Buscando..." : "Vincular a la Orden"}
              </Button>
            </div>
          </form>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-500">
            <span>✨ Tasa actual: <strong>{ticketContext?.restaurant?.defaultRewardRate ?? 20}% Bunz</strong></span>
            <span>Un solo uso por compra</span>
          </div>
        </div>
      </Dialog>

      {/* ── Modal de QR Neón del Negocio (Para mostrar al cliente en mostrador) ── */}
      <Dialog
        open={showBusinessQrModal}
        onClose={() => setShowBusinessQrModal(false)}
        title="QR Neón de Mostrador (Rabbitter Check-in)"
        className="max-w-md w-full"
      >
        <div className="space-y-4 p-2 text-center flex flex-col items-center">
          <p className="text-xs text-gray-400 max-w-sm">
            Muestra esta pantalla al cliente para que apunte con la cámara de su celular o abra su app de Rabbitty / Telegram y reciba sus Bunz.
          </p>

          <div className="relative p-6 rounded-[2.5rem] bg-gray-950 border-2 border-pink-500/60 shadow-[0_0_60px_rgba(236,72,153,0.4)] flex flex-col items-center">
            <div className="p-4 bg-white rounded-3xl shadow-2xl flex items-center justify-center">
              <QRCodeSVG
                value={`https://rabbitty.me/scan?branchId=${ticketContext?.branch?.id || "default"}&business=${encodeURIComponent(ticketContext?.restaurant?.name || "Rabbitty")}`}
                size={220}
                level="H"
                includeMargin={false}
                imageSettings={{
                  src: "/Ra.png",
                  x: undefined,
                  y: undefined,
                  height: 44,
                  width: 44,
                  excavate: true,
                }}
              />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm font-black text-white">🐰 {ticketContext?.restaurant?.name || "Rabbitty"}</span>
              <span className="text-xs font-bold text-pink-400 bg-pink-500/20 px-2 py-0.5 rounded-full border border-pink-500/30">
                +{ticketContext?.restaurant?.defaultRewardRate ?? 20}% Bunz
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1 font-mono">
              rabbitty.me/scan
            </p>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowBusinessQrModal(false)}
            className="w-full py-2.5 font-bold text-xs bg-white/10 hover:bg-white/15 text-white"
          >
            Cerrar Pantalla
          </Button>
        </div>
      </Dialog>

      {/* ── Modal de Rabbitty Tabs / Comandas Activas en Tienda ── */}
      <Dialog
        open={activeTabsModal}
        onClose={() => setActiveTabsModal(false)}
        title="Rabbitty Tabs & Comandas Activas"
        className="max-w-xl w-full"
      >
        <div className="space-y-4 p-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Mesas y comandas abiertas en tiempo real con identificación de clientes.
            </p>
            <Button
              variant="secondary"
              onClick={() => refetchActiveTabs()}
              className="py-1 px-2.5 text-xs font-bold"
            >
              Refrescar
            </Button>
          </div>

          <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-2">
            {activeTabsData && activeTabsData.activeTabs.length > 0 ? (
              activeTabsData.activeTabs.map((tab) => (
                <div
                  key={tab.orderId}
                  className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-3 hover:bg-white/10 transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-white text-sm">
                        {tab.tableNumber ? `Mesa ${tab.tableNumber}` : tab.orderType}
                      </span>
                      {tab.tableLocation && (
                        <span className="text-[10px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">
                          {tab.tableLocation}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-2">
                      {tab.customer ? (
                        <span className="text-pink-300 font-bold flex items-center gap-1">
                          🐰 {tab.customer.name} {tab.customer.phone ? `(${tab.customer.phone})` : ""}
                        </span>
                      ) : (
                        <span className="text-gray-500 italic">Sin vincular</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-black text-cyan-400 text-sm">
                      ${tab.total.toFixed(2)}
                    </span>
                    {tab.status === "CASH_PAYMENT_REQUESTED" ? (
                      <span
                        className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/40 text-xs font-bold"
                        title="El comensal solicitó pagar en efectivo: cobra en gaveta con tu PIN, no envíes link de pago digital."
                      >
                        💵 Solicitó efectivo
                      </span>
                    ) : (
                      <Button
                        onClick={async () => {
                          await sendBillMutation.mutateAsync({
                            orderId: tab.orderId,
                            customerId: tab.customer?.id || undefined,
                            phone: tab.customer?.phone || undefined,
                            customerName: tab.customer?.name || undefined,
                          });
                        }}
                        disabled={sendBillMutation.isPending}
                        className="py-1.5 px-3 text-xs font-bold bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/40"
                      >
                        <Send className="h-3 w-3 mr-1 text-pink-400" />
                        Enviar Cuenta
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 text-xs">
                No hay comandas activas pendientes en esta sucursal.
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-white/5">
            <Button variant="secondary" onClick={() => setActiveTabsModal(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── Modal para Enviar Cuenta Digital al Móvil ── */}
      <Dialog
        open={sendBillModal}
        onClose={() => setSendBillModal(false)}
        title="Enviar Cuenta Digital al Móvil"
        className="max-w-md w-full"
      >
        <div className="space-y-4 p-1">
          <p className="text-xs text-gray-400">
            Despacha la comanda actual directamente al móvil del Rabbitter vía Push nativo o WhatsApp para que revise su cuenta digital y previsualice sus Bunz antes de pagar en caja o mesa.
          </p>

          <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Total de la orden:</span>
              <span className="font-black text-cyan-400 text-sm">${total.toFixed(2)}</span>
            </div>
            {selectedRabbitter && (
              <div className="flex justify-between text-xs pt-1 border-t border-white/5">
                <span className="text-gray-400">Rabbitter:</span>
                <span className="font-bold text-pink-300">🐰 {selectedRabbitter.name}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-300">
              Teléfono del cliente (WhatsApp / Push)
            </label>
            <Input
              placeholder="10 dígitos (ej. 5512345678)"
              type="tel"
              value={waPhone}
              onChange={(e) => setWaPhone(e.target.value.replace(/\D/g, ''))}
              className="text-center py-2.5 text-sm"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setSendBillModal(false)}
              className="flex-1 py-2 font-bold text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (cart.length === 0) {
                  toast.error("La orden está vacía");
                  return;
                }
                try {
                  // Registrar orden preliminar PENDING en backend para generar la URL digital
                  const mappedOrderType: "DINE_IN" | "TO_GO" | "DELIVERY" = 
                    orderType === "TAKEAWAY" || orderType === "COUNTER" ? "TO_GO" :
                    orderType === "DELIVERY" ? "DELIVERY" : "DINE_IN";

                  const newOrder = await utils.client.pos.createOrder.mutate({
                    tableId: selectedTableId || undefined,
                    orderType: mappedOrderType,
                    customerName: selectedRabbitter?.name || undefined,
                    customerPhone: waPhone || selectedRabbitter?.phoneNumber || undefined,
                  });

                  for (const it of cart) {
                    await utils.client.pos.addToCart.mutate({
                      orderId: newOrder.id,
                      menuItemId: it.menuItemId,
                      quantity: it.quantity,
                    });
                  }

                  await sendBillMutation.mutateAsync({
                    orderId: newOrder.id,
                    customerId: selectedRabbitter?.id || undefined,
                    phone: waPhone || selectedRabbitter?.phoneNumber || undefined,
                    customerName: selectedRabbitter?.name || undefined,
                  });
                  refetchActiveTabs();
                } catch (err: any) {
                  toast.error(err?.message || "Error al despachar la cuenta");
                }
              }}
              disabled={sendBillMutation.isPending || (!selectedRabbitter && waPhone.length < 10)}
              className="flex-1 py-2 font-black text-xs bg-pink-500 hover:bg-pink-400 text-white shadow-lg shadow-pink-500/20 disabled:opacity-40"
            >
              {sendBillMutation.isPending ? "Despachando..." : "Despachar Cuenta"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── Modal de Comandas Pausadas / En Espera (Tipo Óptima POS) ── */}
      <Dialog
        open={pausedCartsModal}
        onClose={() => setPausedCartsModal(false)}
        title="Transacciones Pausadas / En Espera"
        className="max-w-xl w-full"
      >
        <div className="space-y-4 p-1">
          <p className="text-xs text-gray-400">
            Rescata una comanda previa para continuar cobrándola o modificarla sin haber perdido los platillos.
          </p>

          <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-2">
            {pausedCarts.length > 0 ? (
              pausedCarts.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-3 hover:bg-white/10 transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-amber-400 text-sm">
                        {entry.folio}
                      </span>
                      <span className="text-[10px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">
                        {entry.orderType}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {entry.createdAt}
                      </span>
                    </div>
                    <div className="text-xs text-gray-300">
                      {entry.itemsCount} productos · <strong className="text-emerald-400">${entry.total.toFixed(2)}</strong>
                    </div>
                    {entry.selectedRabbitter && (
                      <div className="text-[11px] text-pink-300 font-bold">
                        🐰 {entry.selectedRabbitter.name}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => {
                        if (cart.length > 0) {
                          toast.error("Hay una orden en curso. Termínala o paúsala antes de rescatar otra.");
                          return;
                        }
                        setCart(entry.cart);
                        setOrderType(entry.orderType);
                        setSelectedTableId(entry.selectedTableId);
                        setSelectedRabbitter(entry.selectedRabbitter);
                        setPausedCarts((prev) => prev.filter((p) => p.id !== entry.id));
                        setPausedCartsModal(false);
                        toast.success(`▶️ Comanda ${entry.folio} cargada al carrito`);
                      }}
                      className="py-1.5 px-3 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-gray-950 shadow-md active:scale-95 cursor-pointer"
                    >
                      <Play className="h-3 w-3 mr-1 fill-current" />
                      Rescatar
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingDiscardFolio(entry.folio);
                        setClearCartPin("");
                      }}
                      title="Eliminar de espera (requiere PIN de Gerente)"
                      className="h-8 w-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 text-xs">
                No hay transacciones pausadas en este momento.
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-white/5">
            <Button variant="secondary" onClick={() => setPausedCartsModal(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── Modal de Reimpresión de Tickets Recientes ── */}
      <Dialog
        open={recentOrdersModal}
        onClose={() => setRecentOrdersModal(false)}
        title="Historial de Tickets / Reimpresión"
        className="max-w-2xl w-full"
      >
        <div className="space-y-4 p-1">
          <p className="text-xs text-gray-400">
            Selecciona cualquier ticket cobrado recientemente para visualizarlo o imprimir una copia en la ticketera térmica.
          </p>

          <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-2">
            {recentCompletedOrders && recentCompletedOrders.length > 0 ? (
              [...recentCompletedOrders].reverse().map((ord) => {
                const rest = ticketContext?.restaurant;
                const br = ticketContext?.branch;
                const orderDate = ord.createdAt ? new Date(ord.createdAt) : new Date();
                const orderFolio = `#${ord.id.slice(-4).toUpperCase()}`;
                const itemsCount = ord.items?.reduce((s, it) => s + it.quantity, 0) || 0;

                const reconstructTicket = (): TicketData => ({
                  restaurantName: rest?.name || "RABBITTY RESTAURANT",
                  legalName: rest?.legalName || undefined,
                  rfc: rest?.rfc || undefined,
                  taxRegime: rest?.taxRegime || undefined,
                  logoUrl: rest?.logoUrl || undefined,
                  address: br?.address || undefined,
                  phone: br?.phone || undefined,
                  email: rest?.email || undefined,
                  ticketFooter: rest?.ticketFooter || "¡Gracias por tu visita!",
                  orderNumber: orderFolio,
                  orderId: ord.id,
                  claimToken: ord.id,
                  date: orderDate.toLocaleString("es-MX", {
                    timeZone: rest?.timezone || "America/Mexico_City",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  tableNumber: ord.tableId ? `Mesa` : undefined,
                  orderType: ord.orderType || "DIRECTA",
                  items: (ord.items || []).map((it) => ({
                    id: it.id,
                    name: it.name,
                    quantity: it.quantity,
                    unitPrice: it.unitPrice,
                    totalPrice: it.totalPrice,
                    notes: it.notes || undefined,
                  })),
                  subtotal: ord.subtotal || ord.total,
                  tax: ord.tax || 0,
                  total: ord.total,
                  paymentMethod: ord.bunzPaid && ord.bunzPaid > 0 ? "BUNZ" : "EFECTIVO",
                  currency: rest?.currency || "MXN",
                  bunzCashbackRate: rest?.defaultRewardRate ?? 20,
                  estimatedBunz: ord.bunzReward || Math.max(1, Math.round(ord.total * 0.2)),
                  customerName: ord.customerName || undefined,
                  awardedBunz: ord.bunzReward && ord.bunzReward > 0 ? ord.bunzReward : undefined,
                });

                return (
                  <div
                    key={ord.id}
                    className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-3.5 hover:bg-white/10 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-pink-400 font-mono text-sm">
                          {orderFolio}
                        </span>
                        <span className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                          {ord.orderType || "VENTA"}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {orderDate.toLocaleTimeString("es-MX", { timeZone: rest?.timezone || "America/Mexico_City", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="text-xs text-gray-300">
                        {itemsCount} artículo(s) · <strong className="text-emerald-400 font-black">${Number(ord.total).toFixed(2)} MXN</strong>
                        {ord.customerName && (
                          <span className="text-pink-300 ml-2 font-bold">· 🐰 {ord.customerName}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => {
                          const ticket = reconstructTicket();
                          setPaidTicketData(ticket);
                          setReceiptModal(true);
                          setRecentOrdersModal(false);
                        }}
                        className="py-1.5 px-3 text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15"
                      >
                        Ver Detalle
                      </Button>
                      <Button
                        onClick={() =>
                          runPrint(`reprint-${ord.id}`, async () => {
                            const ticket = reconstructTicket();
                            const r = await printEngine.printTicket(ticket, true);
                            if (r.success) {
                              toast.success(`🖨️ Ticket ${orderFolio} reimpreso correctamente`);
                            } else {
                              toast.warning(r.error || "No se pudo imprimir. Revisa la impresora.");
                            }
                          })
                        }
                        disabled={printingKey !== null}
                        className="py-1.5 px-3 text-xs font-black bg-cyan-500 hover:bg-cyan-400 text-gray-950 shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5 disabled:opacity-70 disabled:cursor-wait"
                      >
                        {printingKey === `reprint-${ord.id}` ? (
                          <>
                            <span className="h-3.5 w-3.5 rounded-full border-2 border-gray-950/30 border-t-gray-950 animate-spin" />
                            Imprimiendo...
                          </>
                        ) : (
                          <>
                            <Printer className="h-3.5 w-3.5" />
                            Reimprimir
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 text-gray-400 text-xs">
                No hay órdenes cobradas recientemente para esta sucursal.
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-white/5">
            <Link
              href="/reports/audit"
              className="text-xs text-pink-400 hover:text-pink-300 underline font-medium"
              onClick={() => setRecentOrdersModal(false)}
            >
              Ir a Auditoría y Registro Completo →
            </Link>
            <Button variant="secondary" onClick={() => setRecentOrdersModal(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── Modal de Seguridad: Teclado Numérico Táctil para Salir al Dashboard ── */}
      <Dialog
        open={adminPinModal}
        onClose={() => {
          setAdminPinModal(false);
          setExitPin("");
        }}
        title={!adminPinStatus?.hasAdminPin ? "Definir PIN de Administrador" : "Seguridad: Acceso al Dashboard"}
        className="max-w-xs w-full"
      >
        <div className="space-y-4 p-1 flex flex-col items-center">
          <div className="text-center space-y-1">
            <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-1">
              <Lock className="h-5 w-5" />
            </div>
            <p className="text-xs text-gray-400 max-w-[240px] leading-relaxed">
              {!adminPinStatus?.hasAdminPin
                ? "Esta sucursal aún no tiene PIN maestro. Teclea 4 dígitos para definir tu PIN de Administrador y salir."
                : "Ingresa el PIN de 4 dígitos de Administrador o Gerente para acceder al Dashboard."}
            </p>
          </div>

          {/* 4 Indicadores Visuales de Dígitos */}
          <div className="flex items-center gap-3.5 py-1">
            {[0, 1, 2, 3].map((index) => {
              const isFilled = exitPin.length > index;
              return (
                <div
                  key={index}
                  className={cn(
                    "w-3.5 h-3.5 rounded-full border-2 transition-all duration-150",
                    isFilled
                      ? "bg-amber-400 border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.6)] scale-110"
                      : "bg-white/5 border-white/20"
                  )}
                />
              );
            })}
          </div>

          {/* Teclado Táctil 3x4 Especial para iPad */}
          <div className="grid grid-cols-3 gap-2 w-full max-w-[240px]">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeypadPress(num)}
                disabled={verifyPinMutation.isPending || setAdminPinMutation.isPending}
                className="h-12 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-amber-500/20 border border-white/10 active:border-amber-500/40 text-lg font-black text-white transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center select-none"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setExitPin("")}
              disabled={verifyPinMutation.isPending || setAdminPinMutation.isPending}
              className="h-12 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 text-xs font-black text-gray-400 hover:text-white transition-all cursor-pointer active:scale-95 flex items-center justify-center select-none"
            >
              C
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress("0")}
              disabled={verifyPinMutation.isPending || setAdminPinMutation.isPending}
              className="h-12 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-amber-500/20 border border-white/10 active:border-amber-500/40 text-lg font-black text-white transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center select-none"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => setExitPin((prev) => prev.slice(0, -1))}
              disabled={verifyPinMutation.isPending || setAdminPinMutation.isPending}
              className="h-12 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 text-xs font-black text-gray-400 hover:text-white transition-all cursor-pointer active:scale-95 flex items-center justify-center select-none"
            >
              ⌫
            </button>
          </div>

          <div className="w-full pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdminPinModal(false);
                setExitPin("");
              }}
              className="text-xs text-gray-400 hover:text-white font-bold w-full"
            >
              Permanecer en la Caja
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
