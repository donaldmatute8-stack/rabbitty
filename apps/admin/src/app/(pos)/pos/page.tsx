"use client";
import { isCashPaymentRequested, toLegacyPosPaymentMethod } from "@rabbitty/api/services/payments/contracts";

import { useState, useMemo, useEffect, useRef } from "react";
import { trpc } from "../../../lib/trpc-client";
import { clearPosOperator, getPosTerminalToken } from "../../../lib/pos-terminal";
import {
  posPermissionLabel,
  posRoleLabel,
  type PosPermission,
} from "@rabbitty/api/services/posPermissions";
import { PosOrderAlert } from "../../../components/PosOrderAlert";
import { Button, Dialog, Input, toast, cn, useWakeLock } from "@rabbitty/ui";
import { Clock, Search, Users, CreditCard, Banknote, QrCode, Split, Smartphone, Landmark, Table2, Trash2, ChevronLeft, Plus, Minus, Check, ChevronDown, CheckCircle2, AlertTriangle, Shield, ShoppingBag, Bike, UtensilsCrossed, Store, Printer, Bluetooth, BluetoothConnected, Maximize2, MessageCircle, LogOut, FlaskConical, X, ArrowRight, Sparkles, Send, Pause, Play, Lock, ClipboardCheck, Camera, History, RotateCw, ChefHat, Flame, UserRound } from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import QRDiscovery from "@/components/QRDiscovery";
import { startNeonDecoder } from "@/lib/neonDecoder";
import { TicketTemplate, TicketData } from "../../../components/TicketTemplate";
import { CashShiftModal, CashShiftBadge } from "../../../components/CashShiftModal";
import { 
  printEngine
} from "../../../lib/print-engine";

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

function PosQrCountdown({ expiresAt }: { expiresAt: Date }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)));

  useEffect(() => {
    const tick = () => {
      setRemaining(Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const pct = Math.max(0, Math.min(100, (remaining / (5 * 60)) * 100));

  return (
    <div className="text-center w-full max-w-sm">
      <p className="text-sm text-gray-400">
        Tiempo restante: <span className="text-white font-mono font-bold">{remaining}</span>s
      </p>
      <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
        <div 
          className="h-full bg-purple-500 rounded-full transition-all duration-1000 ease-linear" 
          style={{ width: `${pct}%` }} 
        />
      </div>
    </div>
  );
}

// ── Gracia al salir del POS ──
// Antes había que capturar el PIN de administrador CADA VEZ que se iba al
// dashboard (y al regresar había que pedírselo al encargado otra vez). Tras
// autenticarse una vez, se concede una ventana corta para volver a salir sin
// repetirlo. Se guarda por sesión de terminal (sessionStorage, no se comparte).
const POS_EXIT_GRACE_MS = 15 * 60 * 1000;
const POS_EXIT_KEY = "rabbitty_pos_exit_auth_until";
function posExitAuthorized(): boolean {
  try { return Number(sessionStorage.getItem(POS_EXIT_KEY) || 0) > Date.now(); } catch { return false; }
}
function markPosExitAuthorized(): void {
  try { sessionStorage.setItem(POS_EXIT_KEY, String(Date.now() + POS_EXIT_GRACE_MS)); } catch { /* noop */ }
}

export default function PosPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>("ALL");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<any[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const savedCart = localStorage.getItem("rabbitty_active_cart");
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [voidingItem, setVoidingItem] = useState<any | null>(null);
  const [orderZoomModal, setOrderZoomModal] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [managerPin, setManagerPin] = useState("");
  const [confirmClearCart, setConfirmClearCart] = useState(false);
  const [clearCartPin, setClearCartPin] = useState("");
  const [pendingDiscardFolio, setPendingDiscardFolio] = useState<string | null>(null);
  const [tableModal, setTableModal] = useState(false);
  const [orderType, setOrderType] = useState<"COUNTER" | "DINE_IN" | "TAKEAWAY" | "DELIVERY">(() => {
    if (typeof window === "undefined") return "COUNTER";
    try {
      const saved = localStorage.getItem("rabbitty_active_order_type");
      if (saved && ["COUNTER", "DINE_IN", "TAKEAWAY", "DELIVERY"].includes(saved)) {
        return saved as any;
      }
    } catch {}
    return "COUNTER";
  });
  const [selectedTableId, setSelectedTableId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem("rabbitty_active_table_id") || null;
    } catch {}
    return null;
  });
  const [receiptModal, setReceiptModal] = useState(false);
  // Método elegido pendiente de confirmación (el cobro NO se ejecuta hasta confirmar)
  const [pendingMethod, setPendingMethod] = useState<string | null>(null);
  // GAP: el COBRAR grande ya no salta directo a VENTA DIRECTA — primero elige
  // método y confirma ("¿Confirmas pago en Efectivo? Sí / No, cambiar").
  const [methodPicker, setMethodPicker] = useState<null | "select" | "confirm">(null);
  const [chosenMethod, setChosenMethod] = useState<string | null>(null);
  // ── GAP 1: beneficios de membresía seleccionables al cobrar ──
  const posBizCtx = trpc.memberships.myBusinessForContext.useQuery(undefined, { staleTime: 5 * 60_000 });
  const [selectedBenefitIds, setSelectedBenefitIds] = useState<string[]>([]);
  const [cashReceived, setCashReceived] = useState<string>("");
  const [isCharging, setIsCharging] = useState(false);
  const [paidTicketData, setPaidTicketData] = useState<TicketData | null>(null);
  const [btConnected, setBtConnected] = useState(false);
  const [btDeviceName, setBtDeviceName] = useState<string | null>(null);
  const [waPhone, setWaPhone] = useState("");
  const [qrPaymentModal, setQrPaymentModal] = useState<{ intentId: string; amount: number; bunz: number; expiresAt: Date; orderId?: string } | null>(null);
  const stripeStatus = trpc.payments.getStripeAccountStatus.useQuery({});
  const arrivalsQuery = trpc.pos.getRecentArrivals.useQuery(undefined, { refetchInterval: 15000 });
  const [arrivalBanner, setArrivalBanner] = useState<{ name: string; visits: number; vip: boolean } | null>(null);
  const linkPostCheckout = trpc.pos.linkCustomerToOrder.useMutation();
  const stripeChargeMutation = trpc.pos.createStripeChargeIntent.useMutation();
  const cancelStripeIntent = trpc.payments.cancelPaymentIntent.useMutation();
  const verifyStripeIntentMut = trpc.payments.verifyStripePaymentIntent.useMutation();
  const requestCashPaymentMut = trpc.payments.requestCashPayment.useMutation();
  const stripeIntentId = useRef<string | null>(null);
  // RP-2A: clave estable por intento de cobro (reintentos no duplican).
  const checkoutKeyRef = useRef<string | null>(null);

  // ── H7 (race de cierre): el comensal puede liquidar segundos DESPUÉS de que
  // el operador cierra el QR. Cerrar ya no cancela a ciegas: re-lee el intent
  // en el server; si ya vino SUCCEEDED, liquida normal (y SOLO si sigue
  // pendiente cancela el intent + su hold). Evita "cancelada" con pago vivo. ──
  const resolveStripeModalClose = async (opts?: { reason?: "SWITCH_TO_CASH" | "OPERATOR_CLOSED"; switchToCash?: boolean }) => {
    const modal = stripePayModal;
    const intentId = stripeIntentId.current;
    try {
      if (intentId && !stripePaid) {
        // H8: por ORDEN — el pago puede haber entrado a un intent regenerado
        const modalOrderId = modal?.orderId;
        const fresh = modalOrderId
          ? await utils.payments.latestIntentForOrder.fetch({ orderId: modalOrderId })
          : await utils.payments.getPaymentIntent.fetch({ intentId });
        if (fresh?.status === "SUCCEEDED" && modal) {
          setStripePaid(true);
          toast.success("El pago llegó entre líneas — comanda liquidada.");
          setLastPaidOrderId(modal.orderId);
          const realOrderNumber = (modal.orderId || intentId || "").slice(-4).toUpperCase();
          await finalizeCheckout(
            realOrderNumber,
            "STRIPE",
            undefined,
            selectedRabbitterRef.current?.name,
            modal.bunzApplied || undefined,
            modal.orderId,
            modal.orderId
          );
          void refetchActiveTabs();
          void refetchRecentOrders();
          setStripePayModal(null);
          return;
        }
        void cancelStripeIntent.mutateAsync({ intentId, reason: opts?.reason }).catch(() => {});
      }
      if (opts?.switchToCash && modal?.orderId) {
        try {
          await requestCashPaymentMut.mutateAsync({
            orderId: modal.orderId,
            notes: "Cambio de método: cobro digital → efectivo en caja",
          });
          toast.success("Cuenta marcada para pago en efectivo — cobra en caja con tu PIN");
        } catch (e: any) {
          toast.error(String(e?.message || "").slice(0, 140) || "No se pudo marcar el cobro en efectivo");
        }
      }
    } catch (e) {
      // polling/cancel: no-fatal, el flujo del outbox y los crons reconcilian
      console.warn("[POS] resolveStripeModalClose:", e instanceof Error ? e.message : e);
    }
    setStripePayModal(null);
  };

  const [stripePayModal, setStripePayModal] = useState<{ payUrl: string; amount: number; orderId: string; expiresAt: Date; bunzApplied: number } | null>(null);
  const [stripePaid, setStripePaid] = useState(false);
  const [sendBillModal, setSendBillModal] = useState(false);
  const [activeTabsModal, setActiveTabsModal] = useState(false);
  // Alerta gigante + sonido cuando entra un pedido nuevo desde la app
  const [orderAlertOpen, setOrderAlertOpen] = useState(false);
  const alertedOrderIdsRef = useRef<Set<string>>(new Set());
  // B1: una sola superficie "Operación" con dos vistas dentro (comandas / app)
  const [tabsView, setTabsView] = useState<"ALL" | "APP">("ALL");
  /** Pedido al que se le está prometiendo un tiempo de preparación. */
  const [etaPrompt, setEtaPrompt] = useState<{ orderId: string; orderType?: string | null } | null>(null);
  // B3: gratificación colapsada por defecto (se abre al clic)
  const [gratuityOpen, setGratuityOpen] = useState(false);
  // H-PERSIST: comanda persistente del Rabbitter vinculado (sobrevive reloads)
  const [draftOrderId, setDraftOrderId] = useState<string | null>(null);
  // Si la comanda vinculada YA trae productos (pedido real del móvil), el cobro
  // del carrito NO debe reutilizarla: se cobra desde su botón "Cobrar".
  const [draftHasItems, setDraftHasItems] = useState(false);
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
  }[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const savedPaused = localStorage.getItem("rabbitty_paused_carts");
      if (savedPaused) {
        const parsed = JSON.parse(savedPaused);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
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
  const stripeReady = Boolean(stripeStatus?.data?.chargesEnabled);

  // Si Stripe se desconecta o no está listo, no dejar el flujo en "stripe":
  // el cobro directo con tarjeta exige referencia de terminal.
  useEffect(() => {
    if (stripeStatus?.isFetched && !stripeReady && cardFlowChoice === "stripe") {
      setCardFlowChoice("external");
    }
  }, [stripeStatus?.isFetched, stripeReady, cardFlowChoice]);
  // P0-3: referencia/autorización de la terminal externa (obligatoria para tarjeta)
  const [cardReference, setCardReference] = useState("");
  const [rabbitterQuery, setRabbitterQuery] = useState("");
  // ── Propina del cobro directo + split DIVIDIDA (efectivo vs Bunz) ──
  const [posTip, setPosTip] = useState("");
  const [splitBunzAsk, setSplitBunzAsk] = useState<number>(0);
  // Buscador unificado en el modal del QR Neón (check-ins primero, luego lookup)
  const [qrModalQuery, setQrModalQuery] = useState("");
  const [isSearchingRabbitter, setIsSearchingRabbitter] = useState(false);
  const [isScanningRabbitter, setIsScanningRabbitter] = useState(false);
  const [showBusinessQrModal, setShowBusinessQrModal] = useState(false);
  const utils = trpc.useUtils();

  // Subscribe to PrintEngine state (connections, auto-reconnects)
  useEffect(() => {
    const unsubState = printEngine.onStateChange((state) => {
      setBtConnected(state.connected);
      setBtDeviceName(state.device?.name || null);
    });

    // Auto-reconnect to last printer on mount
    printEngine.reconnect().catch(() => {});

    return () => {
      unsubState();
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
  const { data: activeTabsData, refetch: refetchActiveTabs } = trpc.pos.getActiveTabs.useQuery(undefined, { refetchInterval: 5000, retry: false });
  // Ajuste de sonido de la alerta de pedidos (por restaurante)
  const { data: orderAlertCfg } = trpc.pos.getOrderAlertSettings.useQuery(undefined, { retry: false, staleTime: 60_000 });
  const setOrderAlertSound = trpc.pos.setOrderAlertSound.useMutation({
    onSuccess: (r) => toast.success(r.soundEnabled ? "🔔 Sonido activado" : "🔕 Sonido desactivado"),
    onError: () => toast.error("No se pudo guardar el ajuste de sonido"),
  });
  // B1: pedidos nuevos desde la app (sin tomar) — alimenta el badge del header
  const appPendingOrders = useMemo(
    () => (activeTabsData?.activeTabs ?? []).filter((t) => t.fromApp && (t.stage ?? "RECEIVED") === "RECEIVED"),
    [activeTabsData],
  );
  const appPendingCount = appPendingOrders.length;

  // ── Alerta GIGANTE + sonido: por pedido pendiente nuevo, incluso al cargar.
  // Antes se ignoraba el primer render, así que un pedido que ya existía al
  // abrir/recargar el POS no sonaba. Ahora se alerta una vez por orderId.
  useEffect(() => {
    if (appPendingOrders.length === 0) return;
    const nuevos = appPendingOrders.filter((o) => !alertedOrderIdsRef.current.has(o.orderId));
    if (nuevos.length === 0) return;
    for (const o of nuevos) alertedOrderIdsRef.current.add(o.orderId);
    setOrderAlertOpen(true);
  }, [appPendingOrders]);
  const appTabsCount = useMemo(
    () => (activeTabsData?.activeTabs ?? []).filter((t) => t.fromApp).length,
    [activeTabsData],
  );
  // B1: la lista que se pinta según la vista elegida dentro de "Operación"
  const visibleTabs = useMemo(() => {
    const all = activeTabsData?.activeTabs ?? [];
    // "Comandas" = mesas/mostrador del local · "Desde la app" = pedidos del móvil.
    // Antes "Comandas" mostraba TODO, así que al alternar parecía no hacer nada.
    return tabsView === "APP" ? all.filter((t) => t.fromApp) : all.filter((t) => !t.fromApp);
  }, [activeTabsData, tabsView]);
  const tableTabsCount = useMemo(
    () => (activeTabsData?.activeTabs ?? []).filter((t) => !t.fromApp).length,
    [activeTabsData],
  );
  // ── Gratificaciones voluntarias (D-11): config del negocio (Rabbitty catálogo) ──
  const gratuityCfg = trpc.pos.getGratuityConfig.useQuery(undefined, { retry: false, staleTime: 60_000 });
  const { data: recentCompletedOrders, refetch: refetchRecentOrders } = trpc.pos.getOrders.useQuery(
    { status: "COMPLETED" },
    { enabled: recentOrdersModal, retry: false }
  );
  const sendBillMutation = trpc.pos.sendBillToCustomer.useMutation({
    onSuccess: (data) => {
      toast.success(`🧾 Cuenta enviada a ${data.customerName}!`);
      // Con Rabbitter identificado el push in-app es el canal primario: WhatsApp
      // NO se abre solo — queda como botón manual por si el staff quiere usarlo.
      if (data.whatsappUrl && data.pushSent !== true) {
        window.open(data.whatsappUrl, "_blank");
      }
      setSendBillModal(false);
    },
    onError: (err) => {
      toast.error(err.message || "Error al enviar la cuenta");
    },
  });
  const { data: ticketContext } = trpc.printing.getTicketData.useQuery(undefined, { retry: false });
  const { data: cashStatus } = trpc.cashDrops.getStatus.useQuery({}, { refetchInterval: 30000 });
  const { data: sandboxStatus } = trpc.sandbox.getSandboxStatus.useQuery(undefined, { retry: false });

  // ── Fase 2: la terminal opera con su propia sesión y solo ve SU sucursal ──
  // En modo admin se conserva el query de siempre, sin cambios.
  const isTerminalDevice = typeof window !== "undefined" && !!getPosTerminalToken();
  const { data: posSession } = trpc.posTerminals.sessionContext.useQuery(undefined, {
    retry: false,
  });
  const { data: branchesAdmin } = trpc.admin.getBranches.useQuery(undefined, {
    retry: false,
    enabled: !isTerminalDevice,
  });
  const branches = isTerminalDevice ? posSession?.branches ?? [] : branchesAdmin;

  // ── Fase 3: turno del empleado ──
  // Con turno activo, "Salir" cierra el turno (la terminal sigue autorizada).
  const { data: operatorStatus } = trpc.posOperators.status.useQuery(undefined, {
    retry: false,
    enabled: isTerminalDevice,
  });

  // Aviso informativo de re-onboarding (no bloquea el POS). Una sola vez por
  // dispositivo; el dueño puede revisarlo o descartarlo.
  const { data: posOnboardingStatus } = trpc.admin.onboardingStatus.useQuery(undefined, {
    retry: false,
    enabled: !isTerminalDevice,
  });
  const [onboardingBannerSeen, setOnboardingBannerSeen] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOnboardingBannerSeen(
        localStorage.getItem("rabbitty_pos_onboarding_banner_seen") === "1",
      );
    } catch {
      /* modo privado */
    }
  }, []);
  const onboardingPending = isTerminalDevice
    ? posSession?.onboardingPending === true
    : posOnboardingStatus?.pending === true;
  const showOnboardingBanner = onboardingPending && !onboardingBannerSeen;
  const dismissOnboardingBanner = () => {
    setOnboardingBannerSeen(true);
    try {
      localStorage.setItem("rabbitty_pos_onboarding_banner_seen", "1");
    } catch {
      /* noop */
    }
  };

  // ── Permisos por rol (servidor y UI comparten la misma matriz) ──
  const posRole = operatorStatus?.role ?? posSession?.role ?? null;
  const posPermissions = (operatorStatus?.permissions ?? posSession?.permissions ?? []) as PosPermission[];
  // La terminal siempre aplica la matriz; el panel admin solo con
  // POS_ROLE_ENFORCEMENT=1. Así no se ocultan botones a admins actuales.
  const enforcePermissions = operatorStatus?.enforceRole ?? posSession?.enforceRole ?? false;
  const can = (permission: PosPermission) => !enforcePermissions || posPermissions.includes(permission);
  const requirePermission = (permission: PosPermission): boolean => {
    if (can(permission)) return true;
    toast.error(`Tu rol (${posRoleLabel(posRole)}) no permite ${posPermissionLabel(permission)}.`);
    return false;
  };
  // Abrir caja (apertura, corte X/Z, retiros) exige POS_CASH.
  const openCashShift = () => {
    if (!requirePermission("POS_CASH")) return;
    setCorteModalOpen(true);
  };
  const endShiftMutation = trpc.posOperators.endShift.useMutation({
    onSettled: () => {
      clearPosOperator();
      toast.success("Turno cerrado. La terminal sigue autorizada.");
      window.location.assign("/pos");
    },
  });

  // Guardar en tiempo real ante cualquier cambio (si se apaga la tablet o sale, no se pierde)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (cart.length > 0) {
        localStorage.setItem("rabbitty_active_cart", JSON.stringify(cart));
      } else {
        localStorage.removeItem("rabbitty_active_cart");
      }
      localStorage.setItem("rabbitty_paused_carts", JSON.stringify(pausedCarts));
      localStorage.setItem("rabbitty_active_order_type", orderType);
      if (selectedTableId) {
        localStorage.setItem("rabbitty_active_table_id", selectedTableId);
      } else {
        localStorage.removeItem("rabbitty_active_table_id");
      }
      if (selectedRabbitter) {
        localStorage.setItem("rabbitty_active_rabbitter", JSON.stringify(selectedRabbitter));
      } else {
        localStorage.removeItem("rabbitty_active_rabbitter");
      }
    } catch {}
  }, [cart, pausedCarts, orderType, selectedTableId, selectedRabbitter]);

  // ── Controlador reactivo de la cámara para escanear Rabbitter ──
  const scannerInstanceRef = useRef<any>(null);
  const neonDecoderStopRef = useRef<(() => void) | null>(null);

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
        // Ligazón al ticket: si acabamos de liquidar una orden en esta caja,
        // el uso del beneficio queda auditable contra ese orderId.
        orderId: lastPaidOrderId || undefined,
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

          const cleanedRaw = decodedText.trim();
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



  // ── Notificación del sistema (Mac/iPad) cuando concluye un cobro con recompensa ──
  const notifySystem = (title: string, body: string) => {
    try {
      if (typeof Notification === "undefined") return;
      if (Notification.permission === "granted") {
        new Notification(title, { body, icon: "/Ra.png" });
      } else if (Notification.permission === "default") {
        Notification.requestPermission().then((p) => {
          if (p === "granted") new Notification(title, { body, icon: "/Ra.png" });
        }).catch(() => {});
      }
    } catch { /* noop */ }
  };

  // ── Canje de Membresía por escáner (token <subId>.<window>.<hmac>) ──
  const redeemMembership = trpc.memberships.redeemAtPOS.useMutation();
  const { data: activeCheckIns, refetch: refetchCheckIns } = trpc.pos.getActiveCheckIns.useQuery(undefined, {
    refetchInterval: showBusinessQrModal ? 2000 : 12000,
    retry: false,
  });  const { data: plannedVisits } = trpc.pos.getPlannedVisits.useQuery(undefined, {
    refetchInterval: 60000,
    retry: false,
  });
  // ── Dedupe: excluye de "planean venir" a los que YA tienen check-in activo ──
  const plannedVisitsDeduped = useMemo(() => {
    const checkedInIds = new Set((activeCheckIns || []).map((c: any) => c.userId));
    return (plannedVisits || []).filter((c: any) => !checkedInIds.has(c.userId));
  }, [plannedVisits, activeCheckIns]);

  // Toast informativo: cada check-in anunciado solo una vez por ref
  const checkInsShownRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const c of activeCheckIns || []) {
      if (!checkInsShownRef.current.has(c.userId)) {
        checkInsShownRef.current.add(c.userId);
        toast.info(`🐰 ${c.name} llegó al local — check-in activo`);
      }
    }
  }, [activeCheckIns]);

  // ── QR de mostrador: si alguien acaba de escanearlo (ping fresco de presencia) →
  // cerrar automáticamente el QR y vincular al rabbitter para proceder al cobro ──
  const qrOpenedAtRef = useRef<number>(0);
  const qrSnapshotRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    if (showBusinessQrModal) {
      if (!qrOpenedAtRef.current) {
        qrOpenedAtRef.current = Date.now();
        const snap = new Map<string, string>();
        for (const c of activeCheckIns || []) {
          snap.set(c.userId, String(c.at));
        }
        qrSnapshotRef.current = snap;
        refetchCheckIns();
      }
      return;
    }
    qrOpenedAtRef.current = 0;
    qrSnapshotRef.current.clear();
  }, [showBusinessQrModal, activeCheckIns, refetchCheckIns]);

  const selectedRabbitterRef = useRef<typeof selectedRabbitter>(null);
  useEffect(() => { selectedRabbitterRef.current = selectedRabbitter; }, [selectedRabbitter]);

  useEffect(() => {
    if (!showBusinessQrModal || !qrOpenedAtRef.current) return;
    const fresh = (activeCheckIns || []).find((c: any) => {
      const prevAt = qrSnapshotRef.current.get(c.userId);
      const changedSinceOpen = prevAt !== String(c.at);
      const isRecentOnServer = typeof c.ageSeconds === "number" ? c.ageSeconds <= 20 : false;
      // Un check-in solo cuenta como "escaneó el QR" si es NUEVO respecto al
      // snapshot AND recién creado en el server (ageSeconds evita falsos
      // positivos con datos de hasta 12s viejos al abrir el modal).
      return changedSinceOpen && isRecentOnServer;
    });
    if (fresh) {
      qrOpenedAtRef.current = 0;
      qrSnapshotRef.current.clear();
      setShowBusinessQrModal(false);
      toast.info(`📸 ${fresh.name} escaneó tu QR — cliente vinculado`);
      utils.pos.lookupRabbitter.fetch({ query: fresh.userId })
        .then((res) => {
          if (res) setSelectedRabbitter(res); // H-PERSIST lo toma el efecto central
        })
        .catch(() => {});
    }
  }, [showBusinessQrModal, activeCheckIns, utils.pos.lookupRabbitter]);

  // ── Selector manual de clientes con check-in: el comercio ELIGE de la lista
  // de rabbitters presentes — nunca se vincula automáticamente ──
  // H-PERSIST: vincular abre (o reutiliza) una comanda PENDING del cliente en
  // DB. No cobra ni ejecuta nada: la comanda queda en Operación → comandas para
  // agregarle productos o cobrarla aparte aunque se recargue el POS.
  const ensureCustomerTab = trpc.pos.ensureCustomerTab.useMutation();
  const linkRabbitter = async (rabbitter: {
    id: string;
    name: string;
    phoneNumber?: string | null;
    telegramId?: string | null;
    bunzBalance: number;
    hops: number;
    level: string;
    currentRewardRate: number;
  }) => {
    setSelectedRabbitter(rabbitter);
  };

  // H-PERSIST: CUALQUIER vía de vinculación (select, QR, búsqueda, planea venir)
  // desemboca aquí: al quedar un Rabbitter seleccionado se abre/reutiliza su
  // comanda PENDING en DB. Así el vínculo no vive solo en memoria ni se cuelga.
  const draftCustomerRef = useRef<string | null>(null);
  const draftPendingRef = useRef<string | null>(null);
  const releaseCustomerTab = trpc.pos.releaseCustomerTab.useMutation();
  useEffect(() => {
    if (!selectedRabbitter) return;
    if (draftCustomerRef.current === selectedRabbitter.id && draftOrderId) return;
    if (draftPendingRef.current === selectedRabbitter.id) return; // ya va en vuelo
    // Cambió de Rabbitter: el borrador del anterior se suelta SOLO si quedó
    // vacío (sin productos); si tiene productos, se cobra aparte en Operación.
    if (draftOrderId && draftCustomerRef.current && draftCustomerRef.current !== selectedRabbitter.id) {
      releaseCustomerTab.mutate({ orderId: draftOrderId });
      setDraftOrderId(null);
      setDraftHasItems(false);
    }
    draftPendingRef.current = selectedRabbitter.id;
    draftCustomerRef.current = selectedRabbitter.id;
    ensureCustomerTab.mutate(
      {
        customerId: selectedRabbitter.id,
        customerName: selectedRabbitter.name,
        customerPhone: selectedRabbitter.phoneNumber || selectedRabbitter.telegramId || undefined,
        orderType: "TO_GO",
        // Vincular NO crea una comanda vacía. Solo reutiliza un pedido real
        // existente. Si no hay pedido, el cajero agrega productos manualmente.
        createIfMissing: false,
      },
      {
        onSuccess: (r) => {
          const orderId = r.orderId ?? null;
          setDraftOrderId(orderId);
          setDraftHasItems(Boolean((r as { hasItems?: boolean }).hasItems));
          if (orderId && (r as { hasItems?: boolean }).hasItems) {
            // Sí hay pedido real: abrirlo en Operación para cobrarlo/atenderlo.
            setTabsView("ALL");
            setActiveTabsModal(true);
          }
          void refetchActiveTabs();
        },
        onError: () => {
          draftPendingRef.current = null;
          toast.warning("Vinculado, pero no se pudo abrir la comanda persistente");
        },
      },
    );
  }, [selectedRabbitter, draftOrderId]);

  // Al desvincular, si el borrador quedó vacío se suelta (no deja comandas $0
  // colgadas en Operación). Si tiene productos, se conserva para cobro aparte.
  useEffect(() => {
    if (selectedRabbitter || !draftOrderId) return;
    if (!draftCustomerRef.current) return;
    releaseCustomerTab.mutate({ orderId: draftOrderId });
    setDraftOrderId(null);
      setDraftHasItems(false);
    draftCustomerRef.current = null;
    draftPendingRef.current = null;
    void refetchActiveTabs();
  }, [selectedRabbitter, draftOrderId]);

  const handlePickCheckIn = async (userId: string) => {
    try {
      const res = await utils.pos.lookupRabbitter.fetch({ query: userId });
      if (res) {
        await linkRabbitter(res);
        toast.success(`🐰 ${res.name} vinculado — ${res.currentRewardRate}% Cashback`);
      }
    } catch {
      toast.error("No se pudo vincular al cliente");
    }
  };

  // ── Fase B: cobrar un Tab abierto ya existente SIN duplicar la orden ──
  // Reutiliza payments.createPaymentIntent({ orderId }) (motor central) y abre
  // el modal de Rabbitty Pay apuntando a /pay/[orderId] de ESA cuenta abierta.
  // El polling de stripePayModal detecta SUCCEEDED y liquida: la sesión de mesa
  // se cierra sola vía confirmPaymentIntentSettled.
  const tabChargeMutation = trpc.payments.createPaymentIntent.useMutation();
  // ── H-TRACK: botones de etapa (Recibido → Preparando → Listo → Entregado)
  // para pedidos desde la app (fromApp): el tracking bidireccional
  // mobile ↔ POS vive aquí — el Rabbitter ve la etapa en su tarjeta.
  const [deliveryDialog, setDeliveryDialog] = useState<{
    orderId: string;
    name: string;
    phone: string;
    fee: string;
    feePaidBy: 'BUSINESS' | 'CUSTOMER';
  } | null>(null);

  const { data: deliveryProviders } = trpc.pos.deliveryProviders.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });

  const [uberQuoteDialog, setUberQuoteDialog] = useState<{
    orderId: string;
    quoteId: string;
    feeCents: number;
    etaMinutes: number;
    payer: 'BUSINESS' | 'CUSTOMER';
    address?: {
      street1: string;
      city: string;
      state: string;
      zip: string;
      country: string;
      phone?: string;
    };
  } | null>(null);

  // Para llevar: capturar domicilio antes de cotizar con Uber.
  const [uberAddressDialog, setUberAddressDialog] = useState<{
    orderId: string;
    street1: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
    country: string;
  } | null>(null);
  const pendingUberAddressRef = useRef<{
    street1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone?: string;
  } | null>(null);

  const uberQuoteMutation = trpc.pos.quoteUberDelivery.useMutation({
    onSuccess: (q) =>
      setUberQuoteDialog({
        orderId: q.orderId,
        quoteId: q.quoteId,
        feeCents: q.feeCents,
        etaMinutes: q.durationMinutes,
        payer: 'CUSTOMER',
        address: pendingUberAddressRef.current ?? undefined,
      }),
    onError: (e) => toast.error(e.message || "No se pudo cotizar con Uber"),
  });

  const createUberMutation = trpc.pos.createUberDelivery.useMutation({
    onSuccess: (data) => {
      if (data?.feeAbsorbedByBusiness) {
        toast.info("La orden ya estaba pagada: esta entrega la absorbe el negocio");
      }
      toast.success("Uber Direct asignado — el cliente puede seguirlo");
      setUberQuoteDialog(null);
      void refetchActiveTabs();
    },
    onError: (e) => toast.error(e.message || "No se pudo solicitar la entrega"),
  });

  const cancelUberMutation = trpc.pos.cancelUberDelivery.useMutation({
    onSuccess: () => {
      toast.info("Entrega cancelada en Uber");
      void refetchActiveTabs();
    },
    onError: (e) => toast.error(e.message || "No se pudo cancelar en Uber"),
  });

  const assignDeliveryMutation = trpc.pos.assignDelivery.useMutation({
    onSuccess: (data) => {
      if (data?.feeAbsorbedByBusiness) {
        toast.info("La orden ya estaba pagada: esta entrega la absorbe el negocio");
      }
      toast.success("Repartidor asignado — el cliente recibe el aviso");
      setDeliveryDialog(null);
      void refetchActiveTabs();
    },
    onError: (e) => toast.error(e.message || "No se pudo asignar"),
  });

  const advanceDeliveryMutation = trpc.pos.advanceDelivery.useMutation({
    onSuccess: (_d, vars) => {
      if (vars.status === "DELIVERED") toast.success("Entrega completada");
      else if (vars.status === "PICKED_UP") toast.info("Pedido en camino");
      else toast.info("Entrega actualizada");
      void refetchActiveTabs();
    },
    onError: (e) => toast.error(e.message || "No se pudo actualizar la entrega"),
  });

  const buildDispatchText = (tab: {
    orderId: string;
    items?: Array<{ name: string; quantity: number }>;
    customer?: { name?: string | null; phone?: string | null } | null;
    deliveryAddress?: string | null;
    total?: number;
  }) => {
    const items = (tab.items ?? []).map((it) => `${it.quantity}× ${it.name}`).join('\n');
    return [
      `🛵 Pedido ${String(tab.orderId).slice(0, 8)}`,
      tab.customer?.name ? `Cliente: ${tab.customer.name}` : '',
      items,
      tab.deliveryAddress ? `📍 ${tab.deliveryAddress}` : '',
      tab.customer?.phone ? `📞 ${tab.customer.phone}` : '',
      `💵 Cobrar: $${Number(tab.total ?? 0).toFixed(2)} MXN`,
      '',
      'Entrega de Rabbitty. Responde con tu tiempo estimado.',
    ]
      .filter((line) => line !== '')
      .join('\n');
  };

  const openCourierWhatsApp = (tab: {
    orderId: string;
    items?: Array<{ name: string; quantity: number }>;
    customer?: { name?: string | null; phone?: string | null } | null;
    deliveryAddress?: string | null;
    total?: number;
    delivery?: { courierPhone?: string | null } | null;
  }) => {
    const text = encodeURIComponent(buildDispatchText(tab));
    const phone = String(tab.delivery?.courierPhone || '').replace(/[^\d]/g, '');
    const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openDeliveryRoute = (tab: { deliveryAddress?: string | null }) => {
    if (!tab.deliveryAddress) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(tab.deliveryAddress)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const stageMutation = trpc.pos.setOrderStage.useMutation({
    onSuccess: (_d, vars) => {
      if (vars.stage === 'READY') toast.success('Pedido listo — el Rabbitter lo ve en su app');
      else if (vars.stage === 'DONE') toast.success('Pedido entregado y cerrado');
      else toast.info('Etapa actualizada');
      void refetchActiveTabs();
    },
    onError: (e) => toast.error(e.message || 'No se pudo actualizar'),
  });
  const nextStageOf = (stage: string | undefined) : 'PREPARING' | 'READY' | 'DONE' | null => {
    switch (stage) {
      case 'RECEIVED': return 'PREPARING';
      case 'PREPARING': return 'READY';
      case 'READY': return 'DONE';
      default: return null; // DONE / PAYMENT_PENDING: sin botón de avance rápido
    }
  };
  const chargeOpenTab = async (tab: { orderId: string; total: number; status?: string }) => {
    if (!requirePermission("POS_CHARGE")) return;
    if (!tab?.orderId) return;
    try {
      const intent = await tabChargeMutation.mutateAsync({
        orderId: tab.orderId,
        provider: "STRIPE",
      });
      stripeIntentId.current = intent.intentId;
      setStripePaid(false);
      const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const defaultExpires = new Date();
      defaultExpires.setMinutes(defaultExpires.getMinutes() + 15);
      setStripePayModal({
        payUrl: `${base}/pay/${tab.orderId}`,
        amount: Math.round(intent.netFiatCents || 0) / 100 || tab.total,
        orderId: tab.orderId,
        expiresAt: intent.expiresAt ? new Date(intent.expiresAt) : defaultExpires,
        bunzApplied: 0,
      });
      toast.success("💳 Cobro digital creado sobre la cuenta abierta — sin duplicar orden");
    } catch (err: any) {
      toast.error(String(err?.message || "").slice(0, 140) || "No se pudo crear el cobro del tab");
    }
  };

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
          markPosExitAuthorized();
          toast.success("🐰 PIN de Administrador definido. Saliendo al Dashboard...");
          window.location.assign("/");
        } catch {
          setExitPin("");
        }
      } else {
        // Validar PIN existente
        try {
          await verifyPinMutation.mutateAsync({ pin: nextPin });
          markPosExitAuthorized();
          setAdminPinModal(false);
          setExitPin("");
          toast.success("PIN autorizado. Accediendo al Dashboard...");
          window.location.assign("/");
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
      // H-PERSIST: si la comanda del vínculo ya no sirve (la cobraron aparte o
      // tiene productos), se suelta para que el POS no quede atascado.
      if (/comanda/i.test(err.message || "")) {
        setDraftOrderId(null);
      setDraftHasItems(false);
        draftCustomerRef.current = null;
        draftPendingRef.current = null;
        void refetchActiveTabs();
      }
    },
  });

  // Authority: el appRouter del ADMIN (vivo) — los intents de Rabbitty Pay corren aquí
  const API_SERVER_URL = process.env.NEXT_PUBLIC_API_URL || "https://admin.rabbitty.me/api/trpc";

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
    if (!qrPaymentModal) return;
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
    return () => {
      clearInterval(interval);
      setPollData(null);
    };
  }, [qrPaymentModal, API_SERVER_URL]);

  // ── H14-Watch: settlements remotos de la branch (al margen del modal) ──
  // Si el comensal paga (link de cuenta, re-cobro, etc.) mientras el operador
  // no tiene el QR abierto, el POS lo detecta al vuelo (poll 8s, ventana 15 min).
  const settleWatchSeen = useRef<Set<string>>(new Set());
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const recent = await utils.payments.recentSettledForBranch.fetch({ windowSec: 900 });
        let fresh = 0;
        for (const it of recent) {
          if (!settleWatchSeen.current.has(it.intentId)) {
            settleWatchSeen.current.add(it.intentId);
            if (fresh < 3) {
              fresh += 1;
              toast.info(`Venta liquidada de forma remota — $${(it.amount ?? 0).toFixed(2)} MXN. Ya aparece en Historial/Reportes.`);
            }
            void refetchActiveTabs();
            void refetchRecentOrders();
          }
        }
        if (recent.length > 60) settleWatchSeen.current = new Set(recent.slice(0, 60).map((x) => x.intentId));
      } catch { /* silencioso — el watcher es best-effort */ }
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  // Polling del intento de Stripe: cuando el webhook o la reconciliación
  // server-side liquida (SUCCEEDED), finaliza
  const settleStripeModal = async () => {
    const modal = stripePayModal;
    if (!modal) return;
    setStripePaid(true);
    const realOrderNumber = (modal.orderId || "").slice(-4).toUpperCase();
    if (modal.bunzApplied > 0) {
      toast.success(`Pago Stripe verificado — +${modal.bunzApplied} Bunz al Rabbitter.`);
    } else {
      toast.success("Pago recibido — comanda liquidada.");
    }
    setLastPaidOrderId(modal.orderId);
    await finalizeCheckout(
      realOrderNumber,
      "STRIPE",
      undefined,
      selectedRabbitterRef.current?.name,
      modal.bunzApplied || undefined,
      modal.orderId,
      modal.orderId
    );
    // H8: data del feed (tabs, tickets) fresca de inmediato
    void refetchActiveTabs();
    void refetchRecentOrders();
    setStripePayModal(null);
  };

  useEffect(() => {
    if (!stripePayModal || stripePaid) return;
    const orderOfModal = stripePayModal.orderId;
    let cancelled = false;
    let ticks = 0;
    const timer = setInterval(async () => {
      try {
        if (!orderOfModal) return;
        ticks += 1;
        // H8: rastreo por ORDEN (último intent) — el pago puede llegar a un
        // intent regenerado (cancel + re-cobro o link de cuenta /pay/[orderId]).
        const intent = await utils.payments.latestIntentForOrder.fetch({ orderId: orderOfModal });
        if (intent?.status === "SUCCEEDED" && !cancelled) {
          cancelled = true;
          clearInterval(timer);
          void settleStripeModal();
          return;
        }
        // H8-c: cada 10s el POS pregunta DIRECTO a Stripe (no solo al estado
        // local) — cubre webhook perdido / red flappy del negocio. Idempotente
        // (intento SUCCEEDED → early return server) sobre el INTENT actual.
        if (ticks % 5 === 0 && !cancelled && intent?.id) {
          const verify = await verifyStripeIntentMut.mutateAsync({ intentId: intent.id })
            .catch(() => null) as { success?: boolean; orderId?: string; settled?: boolean } | null;
          if (verify?.success && verify?.orderId === orderOfModal && !cancelled) {
            cancelled = true;
            clearInterval(timer);
            void settleStripeModal();
          }
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
      tip: Number(posTip || 0) || undefined,
      gratuityMode: String((rest as any)?.gratuityMode || "OFF"),
      customerAssigned: Boolean(selectedRabbitter?.id) || undefined,
      paymentMethod: method,
      cashGiven: cashGiven && cashGiven > 0 ? cashGiven : undefined,
      change: changeAmount,
      currency: rest?.currency || "MXN",
      // USD SOLO por opt-in (Configuración → Facturación): en pequeño, valuación de referencia
      usdAmount: (rest as any)?.showUsdTicket && Number((rest as any)?.usdRate > 0)
        ? Math.round((total / Number((rest as any).usdRate)) * 100) / 100
        : undefined,
      usdRate: (rest as any)?.showUsdTicket ? Number((rest as any)?.usdRate) || undefined : undefined,
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
    // H-PERSIST: la comanda del cliente quedó cobrada/ejecutada — se suelta el
    // borrador para que la próxima vinculación abra una nueva.
    setDraftOrderId(null);
      setDraftHasItems(false);
    draftCustomerRef.current = null;
    draftPendingRef.current = null;
  };

  const requestCheckout = (method: string) => {
    if (!requirePermission("POS_CHARGE")) return;
    if (cart.length === 0 || isCharging) return;
    // Clave nueva por intento; se conserva si el cajero reintenta el mismo cobro.
    checkoutKeyRef.current = crypto.randomUUID();
    setPendingMethod(method);    // Para pagos en efectivo, inicializar con el total exacto o vacío para facilitar la captura
    if (method === "EFECTIVO" || method === "VENTA DIRECTA" || method === "DIVIDIDA") {
      setCashReceived("");
    }
    // Flujo tarjeta: default según el estado REAL de Stripe (evita mostrar la
    // UI de Rabbitty Pay y terminar cobrando por terminal externa).
    if (method === "TARJETA") {
      setCardFlowChoice(stripeStatus.data?.chargesEnabled ? "stripe" : "external");
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
    // GAP: split DIVIDIDA — el resto (total − efectivo recibido) se cobra con Bunz
    const splitBunz = pendingMethod === "DIVIDIDA"
      ? Math.max(0, Math.round((total - (parseFloat(cashReceived) || 0)) * 100) / 100)
      : 0;
    if (pendingMethod === "DIVIDIDA") {
      const bunzAsk = Math.max(0, Math.round((total - (parseFloat(cashReceived) || 0)) * 100) / 100);
      if (!selectedRabbitter?.id || bunzAsk <= 0 || bunzAsk >= total) {
        toast.error("Para dividir: vincula al Rabbitter y pon el efectivo de su parte");
        return;
      }
    }
    if (method.includes("STRIPE") && !stripeReady) {
      toast.error("Rabbitty Pay no está conectado. Selecciona Mi Terminal y registra la referencia.");
      return;
    }
    if (method === "TARJETA_EXTERNA" && cardReference.trim().length < 3) {
      toast.error("Registra la referencia o autorización de la terminal antes de cobrar con tarjeta.");
      return;
    }
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
    if (!printEngine.isConnected()) {
      toast.info("Impresora térmica no conectada. Abriendo impresión del sistema (AirPrint / PDF).");
      window.print();
      return;
    }
    await runPrint("receipt", async () => {
      const r = await printEngine.printTicket(paidTicketData, true);
      if (r.success) toast.success("¡Ticket impreso correctamente!");
      else {
        toast.warning(r.error || "No se pudo imprimir. Abriendo impresión del sistema.");
        window.print();
      }
    });
  };

  const handleCheckout = async (method: string = "EFECTIVO", cashGiven?: number) => {
    if (cart.length === 0) return;
    // Defensa en profundidad: el servidor también valida POS_CHARGE.
    if (!requirePermission("POS_CHARGE")) return;

    // Map payment method string to schema enum
    const mappedMethod = toLegacyPosPaymentMethod(method);

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
      } else if (method.includes("STRIPE") && stripeReady) {
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
        // Defensa: nunca llamar a directCheckout con tarjeta sin referencia.
        // Si Stripe no está conectado, el POS debe usar "Mi Terminal".
        if (mappedMethod === "CREDIT_CARD" && !(cardFlowChoice === "external" && cardReference.trim().length >= 3)) {
          toast.error("Rabbitty Pay no está conectado. Selecciona Mi Terminal y registra la referencia.");
          return;
        }
        const checkoutResult = await directCheckoutMutation.mutateAsync({
          tableId: selectedTableId || undefined,
          orderType: mappedOrderType,
          paymentMethod: mappedMethod,
          cardReference: cardFlowChoice === "external" ? cardReference.trim() : undefined,
          customerId: selectedRabbitter?.id || undefined,
          customerName: selectedRabbitter?.name || undefined,
          customerPhone: selectedRabbitter?.phoneNumber || undefined,
          items: cart.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            price: i.price,
          })),
          // GAP 1: beneficios de membresía seleccionados en el modal de cobro
          entitlementIds: selectedBenefitIds.length > 0 ? selectedBenefitIds : undefined,
          // ── Propina (opcional) + split DIVIDIDA (efectivo + Bunz) ──
          tip: Number(posTip || 0),
          splitCash: pendingMethod === "DIVIDIDA" ? (parseFloat(cashReceived) || 0) : undefined,
          splitBunz: pendingMethod === "DIVIDIDA" ? Math.max(0, Math.round((total - (parseFloat(cashReceived) || 0)) * 100) / 100) : undefined,
          // H-PERSIST: reutiliza la comanda abierta del cliente vinculado.
          // Solo se reutiliza un BORRADOR vacío. Si la comanda vinculada ya
          // es el pedido real del móvil, se cobra desde su tarjeta en Operación.
          existingOrderId: draftOrderId && !draftHasItems ? draftOrderId : undefined,
          // RP-2A: si la red falla y el cajero reintenta, el server no duplica.
          idempotencyKey: checkoutKeyRef.current ?? undefined,
        });
        checkoutKeyRef.current = null;

        if (checkoutResult.orderNumber) {
          realOrderNumber = checkoutResult.orderNumber;
        }

        if (checkoutResult.awardedBunz && checkoutResult.awardedBunz > 0) {
          const rewardMsg = `+${checkoutResult.awardedBunz} Bunz acreditados a ${selectedRabbitter?.name || "cliente"}`;
          toast.success(`🐰 ¡Orden #${realOrderNumber} pagada! ${rewardMsg}.`);
          notifySystem(`🐰 Cobro concluido — ${rewardMsg}`, `Orden #${realOrderNumber} · ${selectedRabbitter?.name || "cliente"} recibió ${checkoutResult.awardedBunz} Bunz`);
        } else if (selectedRabbitter) {
          notifySystem(`⚠️ Cobro sin recompensa automática`, `Orden #${realOrderNumber} pagada pero el mint no confirmó — el cliente puede reclamar con el QR del ticket.`);
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
        setSelectedBenefitIds([]); // beneficios ya consumidos y ligados al ticket
        return;
      }
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.includes("TURNO_CERRADO")) {
        if (can("POS_CASH")) {
          toast.error("La caja está cerrada. Abre turno para cobrar en efectivo.");
          setCorteModalOpen(true);
        } else {
          toast.error("La caja está cerrada. Pide a un cajero o gerente que abra el turno.");
        }
        return;
      }
      if (mappedMethod === "BUNZ") return; // If createIntent fails, stop
      // Pago digital: si la creación del cobro Stripe falla, JAMÁS emitir un
      // ticket "pagado" — la orden queda intacta y el mesero reintenta.
      if (mappedMethod === "CREDIT_CARD" || method.includes("STRIPE")) {
        toast.error(`💳 No se pudo crear el cobro digital: ${msg.slice(0, 140) || "error desconocido"}. El carrito queda intacto.`);
        return;
      }
      // Allow ticket generation even if backend offline (graceful degradation)
    }

    await finalizeCheckout(realOrderNumber, method, cashGiven, selectedRabbitter?.name || undefined);
  };

  return (
    <div className="flex h-dvh w-full flex-col bg-gray-950 text-white overflow-hidden select-none font-sans">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          #thermal-printable-receipt, #thermal-printable-receipt * { visibility: visible !important; }
          #thermal-printable-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            color: #000 !important;
            box-shadow: none !important;
          }
          @page { margin: 3mm; size: 80mm auto; }
        }
      `}</style>
      
      {cashStatus?.requiresDrop && !corteModalOpen && can("POS_CASH") && (
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
              onClick={openCashShift}
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
              // Turno abierto en terminal → salir cierra el turno, no la terminal.
              if (operatorStatus?.active) {
                endShiftMutation.mutate();
                return;
              }
              // Dentro de la ventana de gracia no se vuelve a pedir el PIN.
              if (posExitAuthorized()) { window.location.assign("/"); return; }
              setExitPin("");
              setAdminPinModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 px-3 py-2 border border-white/10 text-gray-200 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 group"
            title={operatorStatus?.active
              ? "Cerrar el turno del empleado (la terminal sigue autorizada)"
              : "Terminal Protegida: PIN de Administrador para salir al Dashboard (se recuerda 15 min)"}
          >
            <Lock className="h-3.5 w-3.5 text-amber-400 group-hover:text-amber-300" />
            <ChevronLeft className="h-4 w-4 text-cyan-400 -ml-1" />
            <span>{operatorStatus?.active ? "Terminar turno" : "Dashboard"}</span>
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

          {/* Rol del turno: la UI y el servidor comparten la misma matriz */}
          {posRole && (
            <div
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 shrink-0"
              title={`Turno: ${posRoleLabel(posRole)}${operatorStatus?.operator?.name ? ` · ${operatorStatus.operator.name}` : ""}`}
            >
              <UserRound className="h-3.5 w-3.5 text-cyan-300" />
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-200">
                {posRoleLabel(posRole)}
              </span>
              {operatorStatus?.operator?.name && (
                <span className="max-w-[120px] truncate text-[10px] font-bold text-gray-300">
                  {operatorStatus.operator.name}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Center: Operation & Customer Tools in Sleek Clusters */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {/* Shift / Drawer Control */}
          <div className="flex items-center shrink-0">
            <CashShiftBadge onClick={openCashShift} />
            {cashStatus?.shiftOpen && (
              <button
                id="pos-quick-corte-x"
                type="button"
                onClick={() => {
                  setCorteInitialMode("partial");
                  openCashShift();
                }}
                className="ml-1.5 flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-cyan-300 hover:bg-cyan-500/15 text-xs font-bold transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                title="Corte X de supervisión"
              >
                <ClipboardCheck className="h-3.5 w-3.5 text-cyan-400" />
                <span className="hidden xl:inline">Corte X</span>
              </button>
            )}
          </div>

          {/* Orders Cluster: UNA sola superficie "Operación" — dentro viven las
              comandas/mesas y los pedidos que llegan desde la app Rabbitty.
              (B1: menos ruido en el header, todo cableado al mismo modal.) */}
          <div className="flex items-center rounded-xl bg-white/5 border border-white/10 p-0.5">
            <button
              onClick={() => setActiveTabsModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-purple-300 hover:bg-purple-500/15 text-xs font-bold transition-all cursor-pointer active:scale-95"
              title="Operación: comandas abiertas + pedidos desde la app Rabbitty"
            >
              <Users className="h-3.5 w-3.5 text-purple-400" />
              <span>Operación</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-purple-500/30 text-purple-200">
                {activeTabsData?.totalActiveCount ?? 0}
              </span>
              {appPendingCount > 0 && (
                <span
                  className="flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-pink-500/25 text-pink-200 border border-pink-500/40 animate-pulse"
                  title={`${appPendingCount} pedido(s) nuevo(s) desde la app sin tomar`}
                >
                  <Smartphone className="h-2.5 w-2.5" />
                  {appPendingCount}
                </span>
              )}
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

      {showOnboardingBanner && (
        <div className="mx-3 mt-2 flex items-start gap-2.5 rounded-2xl border border-pink-500/30 bg-pink-500/10 px-3 py-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-pink-300" />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[10px] font-black uppercase tracking-wider text-pink-300">
              Configuración de tu negocio
            </p>
            <p className="m-0 text-[11px] leading-snug text-gray-300">
              Tu operación ya está inyectada. Revisa y confirma tu giro para dejar los módulos al día.
            </p>
          </div>
          <Link
            href="/onboarding"
            onClick={dismissOnboardingBanner}
            className="shrink-0 rounded-xl bg-pink-500 px-3 py-1.5 text-[10px] font-black text-white hover:bg-pink-400"
          >
            Revisar
          </Link>
          <button
            type="button"
            onClick={dismissOnboardingBanner}
            aria-label="Cerrar aviso"
            className="shrink-0 rounded-lg p-1 text-gray-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

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
          <div className="flex flex-col border-b border-white/10 p-2.5 lg:p-3 bg-black/40 gap-1.5">
            <div className="flex items-center justify-between">
              {/* Table Selector Button */}
              <button
                type="button"
                onClick={() => setTableModal(true)}
                className="flex items-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 transition-all cursor-pointer group"
                title="Cambiar mesa o servicio"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  {orderType === "COUNTER" ? (
                    <Store className="h-3.5 w-3.5 text-amber-400" />
                  ) : orderType === "DINE_IN" ? (
                    <Table2 className="h-3.5 w-3.5 text-cyan-400" />
                  ) : orderType === "TAKEAWAY" ? (
                    <ShoppingBag className="h-3.5 w-3.5 text-purple-400" />
                  ) : (
                    <Bike className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                </div>
                <div className="text-left">
                  <div className="text-[9px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1 leading-none">
                    {orderType === "DINE_IN" ? "Mesa Asignada" : "Servicio"}
                    <ChevronDown className="h-2.5 w-2.5 text-cyan-400 group-hover:translate-y-0.5 transition-transform" />
                  </div>
                  <div className="text-xs font-black text-white mt-0.5 leading-tight">
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
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-black text-cyan-300">
                    {cart.reduce((s, i) => s + i.quantity, 0)} uds
                  </span>
                )}
                {/* Botón unificado de Pausar / En Espera (consolida el botón que antes se duplicaba en el header) */}
                {(cart.length > 0 || pausedCarts.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (cart.length > 0 && pausedCarts.length === 0) {
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
                        return;
                      }
                      setPausedCartsModal(true);
                    }}
                    title={
                      cart.length > 0 && pausedCarts.length === 0
                        ? "Pausar venta actual y asignar folio de espera"
                        : "Ver ventas pausadas en espera o pausar la orden actual"
                    }
                    className={cn(
                      "flex items-center gap-1.5 h-8 px-2.5 rounded-xl border transition-all active:scale-95 cursor-pointer text-[11px] font-bold",
                      pausedCarts.length > 0
                        ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border-amber-500/40"
                        : "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border-amber-500/30"
                    )}
                  >
                    <Pause className="h-3 w-3 text-amber-400" />
                    <span>{cart.length > 0 && pausedCarts.length === 0 ? "Pausar" : "Espera"}</span>
                    {pausedCarts.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500/40 text-amber-100">
                        {pausedCarts.length}
                      </span>
                    )}
                  </button>
                )}

                {cart.length > 0 && (
                  <button
                    onClick={() => setConfirmClearCart(true)}
                    title="Vaciar orden actual"
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all active:scale-95 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Order Type Segmented Control (4 Options - Compact) */}
            <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-black/60 border border-white/5">
              <button
                type="button"
                onClick={() => {
                  setOrderType("COUNTER");
                  setSelectedTableId(null);
                }}
                className={cn(
                  "flex items-center justify-center gap-1 h-7 rounded-md text-[11px] font-black transition-all cursor-pointer",
                  orderType === "COUNTER"
                    ? "bg-amber-500 text-gray-950 shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Store className="h-3 w-3" /> Mostrador
              </button>

              <button
                type="button"
                onClick={() => {
                  setOrderType("DINE_IN");
                  // Elegir MESA exige elegir CUÁL mesa: abrimos el picker de
                  // mesas (mostrador / mesa N / llevar) en vez de auto-pick.
                  setTableModal(true);
                }}
                className={cn(
                  "flex items-center justify-center gap-1 h-7 rounded-md text-[11px] font-black transition-all cursor-pointer",
                  orderType === "DINE_IN"
                    ? "bg-cyan-500 text-gray-950 shadow-sm"
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
                  "flex items-center justify-center gap-1 h-7 rounded-md text-[11px] font-black transition-all cursor-pointer",
                  orderType === "TAKEAWAY"
                    ? "bg-purple-500 text-white shadow-sm"
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
                  "flex items-center justify-center gap-1 h-7 rounded-md text-[11px] font-black transition-all cursor-pointer",
                  orderType === "DELIVERY"
                    ? "bg-emerald-500 text-gray-950 shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Bike className="h-3 w-3" /> Domicilio
              </button>
            </div>

            {/* ── Rabbitter Vinculado (Identificación Previa al Cobro) ── */}
            <div>
              {selectedRabbitter ? (
                <div className="flex items-center justify-between rounded-xl bg-pink-500/10 border border-pink-500/25 px-2.5 py-1.5 gap-2 shadow-[0_0_15px_rgba(236,72,153,0.1)]">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-lg bg-pink-500/20 text-pink-300 font-bold text-xs border border-pink-500/30">
                      🐰
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-white truncate">{selectedRabbitter.name}</span>
                        <span className="text-[9px] font-black text-pink-400 bg-pink-500/20 px-1 py-0.2 rounded uppercase">
                          {selectedRabbitter.level}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 leading-tight">
                        <span>{selectedRabbitter.phoneNumber || selectedRabbitter.telegramId || "Cuenta Verificada"}</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-bold">{selectedRabbitter.currentRewardRate}% Cashback</span>
                        {draftOrderId && (
                          <>
                            <span>•</span>
                            <span className="text-cyan-300 font-bold" title="Comanda persistente: sobrevive recargas y se puede cobrar aparte desde Operación">
                              Comanda #{draftOrderId.slice(-4).toUpperCase()}
                            </span>
                          </>
                        )}
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
                <div className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl bg-pink-500/10 border border-pink-500/25">
                  <span className="text-[11px] font-black text-pink-200 flex items-center gap-1.5 truncate">
                    <span>🐰</span> ¿Cliente Rabbitter?
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setRabbitterModalOpen(true);
                        setIsScanningRabbitter(true);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pink-500/25 hover:bg-pink-500/35 text-pink-200 border border-pink-500/40 text-[10px] font-black transition-all cursor-pointer active:scale-95"
                      title="Escanear QR del cliente con la cámara"
                    >
                      <Camera className="h-3 w-3" /> Escanear
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBusinessQrModal(true)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white border border-white/15 text-[10px] font-black transition-all cursor-pointer active:scale-95"
                      title="Mostrar QR del negocio en pantalla"
                    >
                      <QrCode className="h-3 w-3 text-pink-400" /> QR Neón
                    </button>
                    {((activeCheckIns?.length ?? 0) > 0 || (plannedVisitsDeduped?.length ?? 0) > 0) && (
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value) {
                            void handlePickCheckIn(value);
                            e.currentTarget.value = "";
                          }
                        }}
                        className="max-w-30 px-1.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 text-[10px] font-black transition-all cursor-pointer truncate"
                        title="Vincular a un Rabbitter: en el local (check-in activo) o que planea venir"
                      >
                        <option value="" className="text-gray-900">
                          🐰 Vincular ({(activeCheckIns?.length ?? 0) + (plannedVisitsDeduped?.length ?? 0)})
                        </option>
                        {(activeCheckIns?.length ?? 0) > 0 && (
                          <optgroup label="🟢 En el local (check-in activo)" className="text-gray-900">
                            {(activeCheckIns || []).map((c: any) => (
                              <option key={c.userId} value={c.userId} className="text-gray-900">
                                {c.name} · hace {Math.max(0, Math.round((c.ageSeconds ?? 9999) / 60))}m
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {(plannedVisitsDeduped?.length ?? 0) > 0 && (
                          <optgroup label="🚶 Planean venir (24h)" className="text-gray-900">
                            {(plannedVisitsDeduped || []).map((c: any) => (
                              <option key={c.userId} value={c.userId} className="text-gray-900">
                                {c.name} · planeó venir
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setRabbitterModalOpen(true);
                        setIsScanningRabbitter(false);
                      }}
                      className="flex items-center justify-center p-1 rounded-lg bg-white/10 hover:bg-white/15 text-pink-200 hover:text-white border border-white/15 transition-all cursor-pointer active:scale-95"
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

            {/* Quick Payment Methods */}
            <div className="grid grid-cols-3 gap-1.5 mb-2">
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
                className="group flex flex-col items-center justify-center gap-0.5 rounded-xl bg-white/5 py-1.5 border border-white/10 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all active:scale-95 cursor-pointer disabled:opacity-40"
              >
                <CreditCard className="h-4 w-4 text-gray-400 group-hover:text-cyan-400" />
                <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 group-hover:text-cyan-400">Tarjeta</span>
              </button>
              <button 
                onClick={() => requestCheckout("DIVIDIDA")}
                disabled={cart.length === 0}
                className="group flex flex-col items-center justify-center gap-0.5 rounded-xl bg-white/5 py-1.5 border border-white/10 hover:bg-amber-500/20 hover:border-amber-500/50 transition-all active:scale-95 cursor-pointer disabled:opacity-40"
              >
                <Split className="h-4 w-4 text-gray-400 group-hover:text-amber-400" />
                <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 group-hover:text-amber-400">Dividir</span>
              </button>
            </div>

            {/* ── Gratificación voluntaria (D-11) — colapsada por defecto:
                una sola fila; se abre al clic para ahorrar espacio. ── */}
            {gratuityCfg?.data?.enabled && (
              <div className="rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setGratuityOpen((o) => !o)}
                  aria-expanded={gratuityOpen}
                  className="w-full px-2 py-1.5 flex items-center justify-between gap-2 bg-transparent border-0 cursor-pointer text-left"
                >
                  <span className="text-[9px] font-black uppercase tracking-wider text-gray-500">
                    Gratificación
                  </span>
                  <span className="flex items-center gap-1.5">
                    {Number(posTip || 0) > 0 ? (
                      <span className="text-[10px] font-black text-emerald-400">+${Number(posTip).toFixed(2)}</span>
                    ) : (
                      <span className="text-[9px] text-gray-500">Opcional</span>
                    )}
                    <ChevronDown className={cn("h-3 w-3 text-gray-400 transition-transform", gratuityOpen && "rotate-180")} />
                  </span>
                </button>

                {gratuityOpen && (
                  <div className="px-2 pb-2 flex items-center gap-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => { setPosTip(""); }}
                      className={cn(
                        "px-1.5 py-0.5 rounded-lg text-[9px] font-black border transition-all cursor-pointer whitespace-nowrap",
                        Number(posTip || 0) === 0
                          ? "bg-white/10 border-white/25 text-white"
                          : "bg-white/[0.03] border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      No dejar
                    </button>
                    {(gratuityCfg.data.options ?? []).map((p) => {
                      const amount = Math.round(total * (p / 100) * 100) / 100;
                      const selected = Math.abs(Number(posTip || 0) - amount) < 0.05;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => { setPosTip(String(amount)); }}
                          className={cn(
                            "px-1.5 py-0.5 rounded-lg text-[9px] font-black border transition-all cursor-pointer whitespace-nowrap",
                            selected
                              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                              : "bg-white/[0.03] border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          {p}%
                        </button>
                      );
                    })}
                    {Number(posTip || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => { setPosTip(""); }}
                        className="shrink-0 text-[9px] font-black text-gray-500 hover:text-white px-1 py-0.5 rounded-md bg-white/5 border border-white/10 cursor-pointer transition-colors"
                        title="Quitar gratificación"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

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
                onClick={() => setMethodPicker("select")}
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

      {/* ── GAP: selector de método + confirmación (el COBRAR ya no salta directo) ── */}
      <Dialog
        open={!!methodPicker}
        onClose={() => setMethodPicker(null)}
        title={methodPicker === "select" ? "Elige el método de pago" : "Confirmar método"}
        kicker="Cobro"
        className="max-w-xl w-full"
      >
        {methodPicker === "select" && (
          <div className="grid grid-cols-3 gap-2.5">
            {([
              ["EFECTIVO", Banknote, "Efectivo", "Cuenta en caja con cambio", "group-hover:border-emerald-400/60 group-hover:bg-emerald-400/10", "text-emerald-400"],
              ["TARJETA", CreditCard, "Tarjeta", "Rabbitty Pay o terminal física", "group-hover:border-cyan-400/60 group-hover:bg-cyan-400/10", "text-cyan-400"],
              ["DIVIDIDA", Split, "Dividida", "Parte efectivo + parte Bunz", "group-hover:border-amber-400/60 group-hover:bg-amber-400/10", "text-amber-400"],
            ] as const).map(([method, Icon, label, desc, hoverCls, iconCls]) => (
              <button
                key={method}
                onClick={() => { setChosenMethod(method); setMethodPicker("confirm"); }}
                className={`group flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition-all cursor-pointer active:scale-[0.97] ${hoverCls}`}
              >
                <div className="h-9 w-9 shrink-0 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
                  <Icon size={17} className={iconCls} />
                </div>
                <div className="min-w-0">
                  <span className="text-[13px] font-black text-white leading-tight block">{label}</span>
                  <span className="text-[10px] text-gray-400 leading-snug">{desc}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {methodPicker === "confirm" && chosenMethod && (
          <div className="space-y-4 text-center">
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
              <p className="text-[10px] uppercase font-black tracking-[0.18em] text-gray-500">Método elegido</p>
              <p className="text-base font-black text-white my-1.5">{chosenMethod === "EFECTIVO" ? "Efectivo" : chosenMethod === "TARJETA" ? "Tarjeta" : chosenMethod === "QR BUNZ" ? "QR Bunz" : "Dividida"}</p>
              <p className="text-3xl font-black tracking-tight">
                <span className="text-gray-500 text-lg align-top">$</span>
                <span className="bg-gradient-to-r from-[#FF2E93] to-[#E91E63] bg-clip-text text-transparent">${total.toFixed(2)}</span>
                <span className="text-xs text-gray-500 font-bold"> MXN</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="secondary" onClick={() => setMethodPicker("select")} className="py-3 text-xs font-bold rounded-2xl border-white/10 bg-white/[0.04] hover:bg-white/10">
                Cambiar
              </Button>
              <Button
                onClick={() => { setMethodPicker(null); setChosenMethod(null); requestCheckout(chosenMethod); }}
                className="py-3 text-xs font-black rounded-2xl bg-gradient-to-r from-[#FF2E93] to-[#E91E63] hover:opacity-90 shadow-[0_8px_24px_-8px_rgba(233,30,99,0.5)] border-none"
              >
                Cobrar
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Confirmación de cobro: efectivo con desglose de recibido y cambio o confirmación directa de tarjeta */}
      <Dialog 
        open={!!pendingMethod} 
        onClose={() => { setPendingMethod(null); setCashReceived(""); }} 
        title="Cobro"
        kicker="Confirmar y liquidar"
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
              {/* Resumen Superior — glass premium */}
              <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 flex items-center justify-between relative overflow-hidden">
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#FF2E93] via-[#E91E63] to-[#8B5CF6] opacity-70"
                />
                <div>
                  <span className="text-[10px] uppercase font-black tracking-[0.18em] text-gray-500">Total a pagar</span>
                  <p className="text-3xl font-black text-white tracking-tight leading-tight">${total.toFixed(2)}</p>
                  {/* Desglose de gratificación voluntaria (H10) — nunca "recargo" */}
                  {Number(posTip || 0) > 0 && (
                    <p className="text-[10px] text-gray-500 leading-snug">
                      Consumo ${total.toFixed(2)} · Gratificación voluntaria +${Number(posTip).toFixed(2)} · Total con gratificación ${(total + Number(posTip)).toFixed(2)}
                    </p>
                  )}
                  {/* USD opt-in (Configuración → Facturación): pequeño, bajo el total */}
                  {(ticketContext?.restaurant as any)?.showUsdTicket && Number((ticketContext?.restaurant as any)?.usdRate > 0) && (
                    <p className="text-[10px] font-semibold text-gray-500">
                      ≈ ${(total / Number((ticketContext?.restaurant as any).usdRate)).toFixed(2)} USD @ TC {Number((ticketContext?.restaurant as any).usdRate).toFixed(2)}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-black tracking-wider text-[#E91E63] bg-[#E91E63]/10 px-2 py-0.5 rounded-full border border-[#E91E63]/20">
                    {pendingMethod === "VENTA DIRECTA" ? "Efectivo" : pendingMethod === "DIVIDIDA" ? "Efectivo + Bunz" : String(pendingMethod).replace("TARJETA", "Tarjeta")}
                  </span>
                  <p className="text-[11px] text-gray-500 mt-1">{cart.reduce((s, i) => s + i.quantity, 0)} artículo(s)</p>
                </div>
              </div>

              {/* Rabbitter Vinculado en Cobro (compacto) */}
              {selectedRabbitter && (
                <div className="rounded-xl bg-[#E91E63]/[0.07] border border-[#E91E63]/25 px-2.5 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-6 w-6 shrink-0 rounded-lg bg-[#E91E63]/15 border border-[#E91E63]/25 flex items-center justify-center">
                      <Sparkles size={12} className="text-[#FF6BB3]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-xs font-black text-white truncate">{selectedRabbitter.name}</span>
                        <span className="text-[8px] font-black text-[#FF6BB3] bg-[#E91E63]/15 px-1 py-0.2 rounded uppercase tracking-wider shrink-0">
                          {selectedRabbitter.level}
                        </span>
                      </div>
                      <p className="text-[9px] text-gray-500 truncate">
                        {selectedRabbitter.phoneNumber || selectedRabbitter.telegramId || "Cuenta verificada"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 pl-2">
                    <span className="text-[8px] font-black text-gray-500 uppercase tracking-wider block">Recompensa</span>
                    <span className="text-[11px] font-black text-emerald-400">
                      +{Math.floor(total * (selectedRabbitter.currentRewardRate / 100))} Bunz · {selectedRabbitter.currentRewardRate}%
                    </span>
                  </div>
                </div>
              )}

              {/* ── GAP 1: Beneficios de membresía aplicables ── */}
              {isCash && selectedRabbitter?.id && posBizCtx.data?.businessId && (
                <BenefitsPanel
                  businessId={posBizCtx.data.businessId}
                  customerId={selectedRabbitter.id}
                  cart={cart}
                  selected={selectedBenefitIds}
                  onToggle={(id) => setSelectedBenefitIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
                />
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
                <div className="py-1 space-y-3">
                  {!stripeReady && (
                    <div className="rounded-2xl bg-amber-400/[0.08] border border-amber-400/25 px-3 py-2.5 text-[11px] leading-snug text-amber-200">
                      Rabbitty Pay no está conectado. Cobra con tu terminal física (Clip, BBVA o Mercado Pago) y registra la referencia.
                    </div>
                  )}
                  {stripeReady && (
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => setCardFlowChoice("stripe")}
                        className={cn(
                          "flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all cursor-pointer",
                          cardFlowChoice === "stripe"
                            ? "bg-cyan-400/10 border-cyan-400/50 shadow-[0_0_28px_-8px_rgba(6,182,212,0.4)]"
                            : "bg-white/[0.04] border-white/10 hover:bg-white/[0.07] hover:border-white/20"
                        )}
                      >
                        <div className={cn(
                          "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center border transition-colors",
                          cardFlowChoice === "stripe" ? "bg-cyan-400/15 border-cyan-400/40" : "bg-white/[0.06] border-white/10"
                        )}>
                          <Smartphone size={18} className={cardFlowChoice === "stripe" ? "text-cyan-300" : "text-gray-400"} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-black text-white leading-tight">Rabbitty Pay</span>
                            {cardFlowChoice === "stripe" && (
                              <span className="text-[9px] font-black text-cyan-300 bg-cyan-400/15 border border-cyan-400/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Seleccionado</span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 leading-snug block mt-0.5">
                            El comensal paga desde su teléfono con Apple Pay o tarjeta · QR en pantalla
                          </span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCardFlowChoice("external")}
                        className={cn(
                          "flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all cursor-pointer",
                          cardFlowChoice === "external"
                            ? "bg-[#8B5CF6]/10 border-[#8B5CF6]/50 shadow-[0_0_28px_-8px_rgba(139,92,246,0.4)]"
                            : "bg-white/[0.04] border-white/10 hover:bg-white/[0.07] hover:border-white/20"
                        )}
                      >
                        <div className={cn(
                          "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center border transition-colors",
                          cardFlowChoice === "external" ? "bg-[#8B5CF6]/15 border-[#8B5CF6]/40" : "bg-white/[0.06] border-white/10"
                        )}>
                          <Landmark size={18} className={cardFlowChoice === "external" ? "text-violet-300" : "text-gray-400"} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-black text-white leading-tight">Mi Terminal</span>
                            {cardFlowChoice === "external" && (
                              <span className="text-[9px] font-black text-violet-300 bg-violet-400/15 border border-violet-400/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Seleccionado</span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 leading-snug block mt-0.5">
                            Cobra con tu terminal física (Clip / BBVA / MP) y confirma aquí
                          </span>
                        </div>
                      </button>
                    </div>
                  )}
                  {cardFlowChoice === "external" ? (
                    <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 space-y-2.5">
                      <h3 className="text-sm font-black text-white">Cobro con terminal externa</h3>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        Pasa la tarjeta física del cliente en tu terminal bancaria (Clip, BBVA o Mercado Pago).
                      </p>
                      <div className="rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between px-3 py-2.5">
                        <span className="text-[11px] text-gray-400">Total a cobrar en terminal</span>
                        <strong className="text-lg font-black text-white tracking-tight">${total.toFixed(2)}</strong>
                      </div>
                      <div className="rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5">
                        <label className="text-[10px] font-bold text-gray-400 block mb-1">
                          Autorización / referencia de la terminal
                        </label>
                        <input
                          value={cardReference}
                          onChange={(e) => setCardReference(e.target.value)}
                          placeholder="Ej. 123456 o APROBADA"
                          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-600"
                        />
                      </div>
                      <p className="text-[10px] text-gray-500 leading-snug">
                        Confirma con <strong className="text-emerald-400">Terminal aprobada</strong> únicamente después de verificar el voucher o el mensaje de éxito en la máquina física.
                      </p>
                      {selectedTableId && orderType === "DINE_IN" && (
                        <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px] font-semibold flex items-center gap-1.5 p-2">
                          <AlertTriangle size={12} className="shrink-0" />
                          <span>La mesa y comanda quedarán protegidas hasta confirmar la aprobación.</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-cyan-400/[0.06] border border-cyan-400/25 p-4 text-center space-y-2.5">
                      <div className="inline-flex h-10 w-10 rounded-xl bg-cyan-400/15 border border-cyan-400/30 items-center justify-center">
                        <QrCode size={18} className="text-cyan-300 animate-pulse" />
                      </div>
                      <h3 className="text-sm font-black text-white">Cobro digital con Rabbitty Pay</h3>
                      <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
                        Se genera un código en pantalla para que el cliente pague con <strong className="text-white">Apple Pay</strong> o tarjeta desde su teléfono.
                      </p>
                      <div className="rounded-xl bg-white/[0.04] border border-white/10 flex justify-between items-center px-3 py-2.5">
                        <span className="text-[11px] text-gray-400">Total a liquidar</span>
                        <strong className="text-lg font-black text-white tracking-tight">${total.toFixed(2)} <span className="text-[10px] text-gray-500 font-bold">MXN</span></strong>
                      </div>
                      <p className="text-[10px] text-gray-500">
                        La comanda se liquida y el ticket se emite automáticamente cuando Stripe confirma el pago.
                      </p>
                    </div>
                  )}
                </div>
              ) : pendingMethod === "DIVIDIDA" ? (
                <div className="py-2 space-y-3">
                  {/* GAP: split real — efectivo + Bunz del Rabbitter vinculado */}
                  <div className="p-3.5 rounded-2xl bg-amber-400/[0.06] border border-amber-400/25 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300 flex items-center gap-1.5">
                      <Split size={12} /> Cuenta dividida · efectivo + Bunz
                    </p>
                    <div>
                      <label className="text-[11px] font-bold text-gray-300 block mb-1">¿Cuánto paga en efectivo?</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        placeholder={total.toFixed(2)}
                        className="w-full pl-3 pr-3 py-2.5 rounded-2xl bg-white/[0.05] border-2 border-white/10 focus:border-amber-400/60 text-lg font-black text-white placeholder-gray-600 outline-none transition-colors"
                      />
                    </div>
                    {selectedRabbitter ? (
                      <div className="flex justify-between items-center text-[11px] text-gray-300 bg-white/[0.04] border border-white/10 rounded-xl px-2.5 py-1.5">
                        <span>Resto: <strong className="text-amber-200 font-black">${(total - numericReceived).toFixed(2)}</strong> se cobra con Bunz</span>
                        <span className="text-gray-400">{selectedRabbitter.name}</span>
                      </div>
                    ) : (
                      <p className="text-[10px] text-amber-300 font-bold flex items-center gap-1">
                        <AlertTriangle size={11} /> Vincula al Rabbitter arriba — la parte Bunz se cobra de su saldo.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-2 text-center text-sm text-gray-300">
                  ¿Confirmas el cobro de esta orden con <strong className="text-white">{pendingMethod}</strong>?
                </div>
              )}

              {/* ── Propina opcional (solo en pagos presenciales: efectivo / venta directa / dividida; Rabbitty Pay lleva propina en su propio flujo web/móvil) ── */}
              {(pendingMethod === "EFECTIVO" || pendingMethod === "VENTA DIRECTA" || (pendingMethod === "TARJETA" && cardFlowChoice === "external") || pendingMethod === "DIVIDIDA") && (
                <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
                      Propina para el equipo · opcional
                    </label>
                    <span className="text-[9px] font-bold text-emerald-400/80">100% al equipo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-gray-500">$</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={posTip}
                        onChange={(e) => setPosTip(e.target.value.replace(/[^0-9.]/g, "").slice(0, 7))}
                        placeholder="0.00"
                        className="w-full pl-7 pr-2 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-sm font-black text-white text-center outline-none focus:border-[#E91E63]/60 focus:bg-white/[0.08] transition-colors"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setPosTip(String(Math.round(total * 0.10 * 100) / 100))}
                      className={cn(
                        "px-2.5 py-2 rounded-xl text-[10px] font-black border transition-all cursor-pointer",
                        Number(posTip) > 0 && Math.abs(Number(posTip) - total * 0.10) < 0.05
                          ? "bg-[#E91E63]/15 border-[#E91E63]/40 text-[#FF6BB3]"
                          : "bg-white/[0.05] border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                      )}
                    >10%</button>
                    <button
                      type="button"
                      onClick={() => setPosTip(String(Math.round(total * 0.15 * 100) / 100))}
                      className={cn(
                        "px-2.5 py-2 rounded-xl text-[10px] font-black border transition-all cursor-pointer",
                        Number(posTip) > 0 && Math.abs(Number(posTip) - total * 0.15) < 0.05
                          ? "bg-[#E91E63]/15 border-[#E91E63]/40 text-[#FF6BB3]"
                          : "bg-white/[0.05] border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                      )}
                    >15%</button>
                  </div>
                </div>
              )}

              {/* Botones de Acción */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Button
                  variant="secondary"
                  id="pos-cancel-charge"
                  onClick={() => {
                    setPendingMethod(null);
                    setCashReceived("");
                  }}
                  className="rounded-2xl py-3.5 font-bold border-white/10 bg-white/[0.04] hover:bg-white/10"
                >
                  Cancelar
                </Button>
                <Button 
                  id="pos-confirm-charge" 
                  disabled={
                    (isCash && cashReceived !== "" && numericReceived < total) ||
                    (pendingMethod === "TARJETA" && cardFlowChoice === "external" && cardReference.trim().length < 3)
                  }
                  onClick={() => {
                    const finalCash = isCash ? (numericReceived > 0 ? numericReceived : total) : undefined;
                    const m = pendingMethod === "TARJETA"
                      ? (cardFlowChoice === "external" ? "TARJETA_EXTERNA" : "TARJETA_STRIPE")
                      : pendingMethod;
                    (window as any).__rabbittyCardFlow = m;
                    confirmCheckout(finalCash);
                  }} 
                  className={`rounded-2xl py-3.5 font-black text-sm border-none cursor-pointer transition-all ${
                    (isCash && cashReceived !== "" && numericReceived < total) ||
                    (pendingMethod === "TARJETA" && cardFlowChoice === "external" && cardReference.trim().length < 3)
                      ? "opacity-40 cursor-not-allowed bg-gray-700 text-gray-400"
                      : "bg-gradient-to-r from-[#FF2E93] to-[#E91E63] text-white shadow-[0_10px_30px_-10px_rgba(233,30,99,0.55)] hover:opacity-90"
                  }`}
                >
                  {isCash
                    ? (change > 0 ? `Cobrar · Cambio $${change.toFixed(2)}` : "Cobrar orden")
                    : pendingMethod === "TARJETA"
                    ? (cardFlowChoice === "external"
                        ? "Terminal aprobada · Cerrar cuenta"
                        : "Generar cobro Rabbitty Pay")
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
        title="Comprobante de Venta"
        className="max-w-lg w-full max-h-[92dvh] flex flex-col p-4 sm:p-5"
      >
        <div className="flex flex-col gap-3 max-h-[82dvh]">
          {/* Banner de Cobro Exitoso con resumen financiero rápido */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-white leading-tight">¡Cobro Exitoso!</h2>
                  {paidTicketData?.orderNumber && (
                    <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-md bg-white/10 text-gray-200 border border-white/10">
                      #{paidTicketData.orderNumber}
                    </span>
                  )}
                </div>
                <p className="text-emerald-300/90 text-xs font-bold mt-0.5">
                  Total pagado: ${paidTicketData?.total.toFixed(2) || "0.00"} {paidTicketData?.currency || "MXN"}
                  {paidTicketData?.paymentMethod ? ` • ${paidTicketData.paymentMethod}` : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setReceiptModal(false);
                setCart([]);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-gray-950 text-xs font-black transition-all cursor-pointer shadow-lg shadow-cyan-500/20 active:scale-95 shrink-0"
            >
              <span>Nueva Orden</span>
              <Check className="h-4 w-4" />
            </button>
          </div>

          {/* Vista previa completa del ticket (sin recortes ni escalado desalineado) */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-3 flex justify-center bg-gray-950/80 rounded-2xl border border-white/10 shadow-inner min-h-65 max-h-[48vh]">
            <div className="w-full flex justify-center items-start">
              {paidTicketData && (
                <TicketTemplate data={paidTicketData} />
              )}
            </div>
          </div>

          {/* Acciones Post-Cobro: Recompensa Rabbitter + Impresión + WhatsApp */}
          <div className="flex flex-col gap-2.5 pt-1 shrink-0">
            {(() => {
              if (!paidTicketData || paidTicketData.awardedBunz) return null;
              // H10: Rabbitter ya asignado → Bunz directo a cuenta, NO claim QR
              if (paidTicketData.customerAssigned) {
                return (
                  <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-black text-emerald-300 truncate">
                        {paidTicketData.awardedBunz && paidTicketData.awardedBunz > 0
                          ? `+${paidTicketData.awardedBunz} Bunz acreditados a ${paidTicketData.customerName || "Rabbitter"}`
                          : `Cashback acreditado a ${(paidTicketData.customerName || "Rabbitter").slice(0, 24)}`}
                      </p>
                      <p className="text-[10px] text-gray-500 leading-snug">
                        Sin QR de reclamo — el Rabbitter ya estaba asignado al cobro.
                      </p>
                    </div>
                  </div>
                );
              }
              return (
                <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-pink-500/10 border border-pink-500/25">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-pink-200">
                        +{paidTicketData.estimatedBunz ?? 0} Bunz disponibles
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-snug">
                      Sin Rabbitter identificado: el cliente abre el enlace del ticket desde su app para reclamar, o lo asignas manualmente aquí.
                    </p>
                    <button
                      type="button"
                      onClick={() => setRabbitterModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-500/25 hover:bg-pink-500/35 text-pink-200 border border-pink-500/40 text-[11px] font-black transition-all cursor-pointer active:scale-95"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-pink-300" />
                      <span>Asignar Rabbitter a esta venta</span>
                    </button>
                  </div>
                  {(paidTicketData.claimToken || paidTicketData.orderId) && (
                    <div className="shrink-0 bg-white p-2 rounded-2xl shadow-lg border border-white/20 flex flex-col items-center">
                      <QRCodeSVG
                        value={paidTicketData.claimToken
                          ? `https://app.rabbitty.me/scan?claimToken=${paidTicketData.claimToken}`
                          : `https://app.rabbitty.me/scan?ticket=${paidTicketData.orderId}`}
                        size={76}
                        level="H"
                        includeMargin={false}
                        imageSettings={{
                          src: "/Ra.png",
                          height: 18,
                          width: 18,
                          excavate: true,
                        }}
                      />
                      <span className="text-[8px] font-mono font-bold text-gray-700 uppercase tracking-wider mt-1">
                        {paidTicketData.claimToken ? "48h • 1 uso" : "Ver ticket"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

                        {/* Fila combinada: Imprimir Ticket + Enviar por WhatsApp */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <Button
                id="pos-print-receipt"
                variant="secondary"
                onClick={handlePrintReceipt}
                disabled={printingKey !== null}
                aria-busy={printingKey === "receipt"}
                className="sm:col-span-5 font-black py-2.5 text-xs bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-xl flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait cursor-pointer"
              >
                {printingKey === "receipt" ? (
                  <>
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-cyan-300/30 border-t-cyan-300 animate-spin" />
                    <span>Imprimiendo...</span>
                  </>
                ) : (
                  <>
                    <Printer className="h-4 w-4" />
                    <span>Imprimir Ticket</span>
                  </>
                )}
              </Button>

              <div className="sm:col-span-7 flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl p-1 pl-3 focus-within:border-emerald-500/50 transition-colors">
                <span className="text-xs font-bold text-gray-500 select-none">+52</span>
                <input
                  placeholder="WhatsApp (10 dígitos)"
                  type="tel"
                  maxLength={10}
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value.replace(/\D/g, ""))}
                  className="flex-1 min-w-0 bg-transparent text-xs font-bold text-white placeholder-gray-500 outline-none py-1.5"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (paidTicketData && ticketContext?.restaurant && waPhone.length >= 10) {
                      const itemsSummary = paidTicketData.items.map(i => `${i.quantity}x ${i.name} - $${i.totalPrice.toFixed(2)}`).join("\n");
                      const message = `¡Hola! Aquí está tu ticket de compra en *${ticketContext.restaurant.name}*\n\n` +
                        `📅 Fecha: ${paidTicketData.date || ""}\n` +
                        `🔖 Folio: #${paidTicketData.orderNumber}\n\n` +
                        `*Artículos:*\n${itemsSummary}\n\n` +
                        `*Total:* $${paidTicketData.total.toFixed(2)} ${paidTicketData.currency}\n\n` +
                        (paidTicketData.claimToken
                          ? `🧾 Ticket digital (ábrelo para verlo, reclamar tus Bunz o compartirlo):\nhttps://app.rabbitty.me/scan?claimToken=${paidTicketData.claimToken}\n\n`
                          : paidTicketData.orderId
                          ? `🧾 Ticket digital (ábrelo para verlo o compartirlo):\nhttps://app.rabbitty.me/scan?ticket=${paidTicketData.orderId}\n\n`
                          : "") +
                        `¡Gracias por tu preferencia! 🐰`;
                      window.open(`https://wa.me/52${waPhone}?text=${encodeURIComponent(message)}`, "_blank");
                    } else {
                      toast.error("Ingresa un número válido a 10 dígitos");
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-black text-xs shrink-0 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>Enviar</span>
                </button>
              </div>
            </div>
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
        kicker="Cobro desde la app del comensal"
        className="max-w-sm w-full"
      >
        {qrPaymentModal && (
          <div className="flex flex-col items-center justify-center space-y-5">
            <div className="text-center">
              <p className="text-gray-400 text-xs leading-relaxed">
                El comensal escanea desde su app — paga <span className="font-bold text-white">${qrPaymentModal.amount.toFixed(2)} MXN</span> con <span className="font-bold text-violet-300">{qrPaymentModal.bunz.toFixed(2)} Bunz</span>
              </p>
            </div>
            <div className="bg-white p-3 rounded-2xl shadow-[0_0_50px_-12px_rgba(139,92,246,0.45)] relative">
              {pollData?.status === "PAYMENT_VERIFIED" || pollData?.status === "SETTLED" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm rounded-xl">
                  <CheckCircle2 className="w-14 h-14 text-emerald-500 mb-2" />
                  <span className="text-emerald-600 font-bold">¡Pago verificado!</span>
                </div>
              ) : null}
              <QRDiscovery
                  value={`rabbitty://pay?intent=${qrPaymentModal.intentId}&fallback=https://rabbitty.me/scan`}
                  variant="rabbitter"
                  size={230}
                  revealMode="immediate"
                  surfaceKey="pos-pay"
                />
            </div>
            <PosQrCountdown expiresAt={qrPaymentModal.expiresAt} />
            <div className="flex w-full">
              <Button
                variant="secondary"
                className="flex-1 rounded-2xl border-white/10 bg-white/[0.04] hover:bg-white/10"
                onClick={() => setQrPaymentModal(null)}
                disabled={pollData?.status === "PAYMENT_VERIFIED" || pollData?.status === "SETTLED"}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Modal Rabbitty Pay (Stripe Connect) — QR/URL hacia /pay/[orderId] ── */}
      <Dialog
        open={!!stripePayModal}
        onClose={() => { void resolveStripeModalClose({ reason: "OPERATOR_CLOSED" }); }}
        title="Cobro Digital · Rabbitty Pay"
        kicker="Esperando pago del comensal"
        className="max-w-sm w-full"
      >
        {stripePayModal && (
          <div className="flex flex-col items-center justify-center space-y-5">
            {stripePaid ? (
              <div className="flex flex-col items-center justify-center py-2">
                <CheckCircle2 className="w-14 h-14 text-emerald-500" />
                <span className="text-emerald-400 font-black mt-2">¡Pago liquidado!</span>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <p className="text-gray-400 text-xs leading-relaxed">
                    Muestra este código al comensal para pagar con <span className="font-bold text-white">Apple Pay</span> o tarjeta desde su teléfono.
                  </p>
                  <div className="mt-2 inline-flex items-baseline gap-1 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 mr-1">Monto</span>
                    <span className="text-lg font-black text-white tracking-tight">${stripePayModal.amount.toFixed(2)}</span>
                    <span className="text-[10px] text-gray-500 font-bold">MXN</span>
                  </div>
                </div>
                <div className="bg-white p-3 rounded-2xl shadow-[0_0_50px_-12px_rgba(6,182,212,0.45)] relative">
                  <QRDiscovery
                    value={stripePayModal.payUrl}
                    logoSrc="/Ra.png"
                    variant="rabbitter"
                    size={230}
                    revealMode="immediate"
                    surfaceKey="pos-stripe"
                  />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
                  </span>
                  Esperando confirmación — la comanda se liquida sola al pagar.
                </div>
                {stripePayModal.bunzApplied > 0 && (
                  <p className="text-[11px] font-black text-[#FF6BB3] bg-[#E91E63]/10 border border-[#E91E63]/25 rounded-full px-2.5 py-1">
                    +{stripePayModal.bunzApplied} Bunz al Rabbitter identificado
                  </p>
                )}
                <div className="flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const latest = stripePayModal?.orderId
                          ? await utils.payments.latestIntentForOrder.fetch({ orderId: stripePayModal.orderId })
                          : null;
                        const target = latest?.id ?? stripeIntentId.current;
                        if (!target) return;
                        const verify = await verifyStripeIntentMut.mutateAsync({ intentId: target });
                        if (verify?.success) {
                          void settleStripeModal();
                        } else {
                          toast.info("Aún no se registra el pago — el comensal quizá está en la pantalla del banco; espera o cambia a efectivo.");
                        }
                      } catch {
                        toast.error("No se pudo consultar el servidor de pagos.");
                      }
                    }}
                    className="text-[11px] font-black text-cyan-400 hover:text-cyan-300 cursor-pointer border border-cyan-400/30 bg-cyan-400/10 rounded-lg px-2.5 py-1.5"
                  >¿Ya pagó? Verificar ahora</button>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <button
                    type="button"
                    onClick={async () => { await resolveStripeModalClose({ reason: "OPERATOR_CLOSED" }); }}
                    className="text-[11px] font-bold text-gray-500 hover:text-red-400 cursor-pointer"
                  >Cancelar cobro</button>
                  <button
                    type="button"
                    onClick={async () => { await resolveStripeModalClose({ reason: "SWITCH_TO_CASH", switchToCash: true }); }}
                    disabled={requestCashPaymentMut.isPending}
                    className="text-[11px] font-bold text-gray-400 hover:text-amber-400 cursor-pointer disabled:opacity-50"
                  >Cambiar a cobro en efectivo</button>
                </div>
              </>
            )}
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

          {/* ── En local: check-in activo (un clic) ── */}
          {(activeCheckIns?.length ?? 0) > 0 && (
            <div className="px-2.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
              <p className="text-[10px] font-black text-emerald-300 flex items-center gap-1 mb-1.5">
                <span>🟢</span> EN EL LOCAL AHORA (check-in)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(activeCheckIns || []).slice(0, 6).map((c) => (
                  <button
                    key={c.userId}
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await utils.pos.lookupRabbitter.fetch({ query: c.userId });
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
                            toast.success(linked.awardedBunz > 0 ? `🐰 ¡${linked.awardedBunz} Bunz a ${res.name}!` : `🐰 Cliente asignado.`);
                          } else {
                            setSelectedRabbitter(res);
                            toast.success(`🐰 ¡Rabbitter vinculado: ${res.name}!`);
                          }
                        } else {
                          toast.error("No se encontró al cliente");
                        }
                      } catch {
                        toast.error("Error al vincular");
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-emerald-500/40 text-[11px] font-bold text-white hover:border-emerald-500/70 hover:bg-emerald-500/10 active:scale-95 transition-all"
                  >
                    {c.name} <span className="text-emerald-300">· {c.name.includes("@") ? "" : "vincular"}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Opción de Escaneo con Cámara en Vivo */}
          {isScanningRabbitter ? (
            <div className="space-y-3 flex flex-col items-center">
              <div id="rabbitter-cam-reader" className="w-full max-w-70 h-70 rounded-2xl overflow-hidden border-2 border-pink-500/60 shadow-[0_0_30px_rgba(236,72,153,0.3)] bg-black" />
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
                value={`https://rabbitty.me/scan?branchId=${ticketContext?.branch?.id || "default"}&businessId=${encodeURIComponent(ticketContext?.restaurant?.businessId || "")}&business=${encodeURIComponent(ticketContext?.restaurant?.name || "Rabbitty")}`}
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

          {/* ── Buscador inteligente: check-ins en local primero, luego lookup general ── */}
          <div className="w-full text-left space-y-2 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
              🔍 Identificar Rabbitter (local / general)
            </p>
            <input
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
              placeholder="Nombre, @handle, teléfono o ID del Rabbitter"
              value={qrModalQuery}
              onChange={(e) => setQrModalQuery(e.target.value)}
            />            {(activeCheckIns || []).filter((c: any) =>
              qrModalQuery.trim().length === 0 ||
              (c.name || "").toLowerCase().includes(qrModalQuery.trim().toLowerCase())
            ).slice(0, 4).map((c: any) => (
              <button
                key={c.userId}
                type="button"
                onClick={async () => {
                  try {
                    const res = await utils.pos.lookupRabbitter.fetch({ query: c.userId });
                    if (res) {
                      setSelectedRabbitter(res);
                      toast.success(`🐰 ${res.name} vinculado al cobro (check-in)`);
                      setShowBusinessQrModal(false);
                    } else {
                      toast.error("No se pudo vincular");
                    }
                  } catch { toast.error("Error al vincular"); }
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/5 border border-emerald-500/40 text-[11px] font-bold text-white hover:bg-emerald-500/10 active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>🟢 {c.name} · hace {Math.max(0, Math.round((c.ageSeconds ?? 9999) / 60))}m</span>
                <span className="text-emerald-300">+ vincular</span>
              </button>
            ))}
            {qrModalQuery.trim().length > 2 && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await utils.pos.lookupRabbitter.fetch({ query: qrModalQuery.trim() });
                    if (res) {
                      setSelectedRabbitter(res);
                      toast.success(`🐰 ${res.name} vinculado al cobro`);
                      setShowBusinessQrModal(false);
                    } else {
                      toast.error("Sin coincidencias en Rabbitty");
                    }
                  } catch { toast.error("Error de búsqueda"); }
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-bold text-white hover:bg-white/10 cursor-pointer active:scale-[0.98] transition-all"
              >
                🔎 Buscar en toda Rabbitty: "{qrModalQuery.trim()}"
              </button>
            )}
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

      {/* ── Para llevar: capturar domicilio y cotizar con Uber ── */}
      <Dialog
        open={!!uberAddressDialog}
        onClose={() => setUberAddressDialog(null)}
        title="Domicilio de entrega"
        className="max-w-sm w-full"
      >
        <div className="space-y-3 p-1">
          <p className="m-0 text-xs text-gray-400">
            Pedido para llevar: captura el domicilio para enviarlo con Uber mientras se cocina.
          </p>
          <input
            value={uberAddressDialog?.street1 ?? ""}
            onChange={(e) =>
              setUberAddressDialog((prev) => (prev ? { ...prev, street1: e.target.value } : prev))
            }
            placeholder="Calle y número *"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/60"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={uberAddressDialog?.city ?? ""}
              onChange={(e) =>
                setUberAddressDialog((prev) => (prev ? { ...prev, city: e.target.value } : prev))
              }
              placeholder="Ciudad *"
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/60"
            />
            <input
              value={uberAddressDialog?.state ?? ""}
              onChange={(e) =>
                setUberAddressDialog((prev) => (prev ? { ...prev, state: e.target.value } : prev))
              }
              placeholder="Estado *"
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/60"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={uberAddressDialog?.zip ?? ""}
              onChange={(e) =>
                setUberAddressDialog((prev) => (prev ? { ...prev, zip: e.target.value } : prev))
              }
              placeholder="CP *"
              inputMode="numeric"
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/60"
            />
            <input
              value={uberAddressDialog?.phone ?? ""}
              onChange={(e) =>
                setUberAddressDialog((prev) => (prev ? { ...prev, phone: e.target.value } : prev))
              }
              placeholder="Teléfono"
              inputMode="tel"
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/60"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setUberAddressDialog(null)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={
                !uberAddressDialog ||
                uberAddressDialog.street1.trim().length < 4 ||
                uberAddressDialog.city.trim().length < 2 ||
                uberAddressDialog.state.trim().length < 2 ||
                uberAddressDialog.zip.trim().length < 3 ||
                uberQuoteMutation.isPending
              }
              onClick={() => {
                if (!uberAddressDialog) return;
                const address = {
                  street1: uberAddressDialog.street1.trim(),
                  city: uberAddressDialog.city.trim(),
                  state: uberAddressDialog.state.trim(),
                  zip: uberAddressDialog.zip.trim(),
                  country: (uberAddressDialog.country || "MX").trim().toUpperCase(),
                  phone: uberAddressDialog.phone.trim() || undefined,
                };
                const orderId = uberAddressDialog.orderId;
                pendingUberAddressRef.current = address;
                setUberAddressDialog(null);
                uberQuoteMutation.mutate({ orderId, address });
              }}
            >
              {uberQuoteMutation.isPending ? "Cotizando…" : "Cotizar con Uber"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── Uber Direct: cotización y solicitud ── */}
      <Dialog
        open={!!uberQuoteDialog}
        onClose={() => setUberQuoteDialog(null)}
        title="Uber Direct"
        className="max-w-sm w-full"
      >
        <div className="space-y-3 p-1">
          <p className="m-0 text-xs text-gray-400">
            Cotización de Uber para este pedido. Al solicitar, Uber asigna al repartidor.
          </p>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-sm font-black text-white">
              <span>Costo de entrega</span>
              <span>${((uberQuoteDialog?.feeCents ?? 0) / 100).toFixed(2)} MXN</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span>Tiempo estimado</span>
              <span>~{uberQuoteDialog?.etaMinutes ?? 0} min</span>
            </div>
          </div>

          <label className="block space-y-1">
            <span className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
              Quién paga la entrega
            </span>
            <select
              value={uberQuoteDialog?.payer ?? "CUSTOMER"}
              onChange={(e) =>
                setUberQuoteDialog((prev) =>
                  prev ? { ...prev, payer: e.target.value as 'BUSINESS' | 'CUSTOMER' } : prev,
                )
              }
              className="h-[42px] w-full rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white outline-none"
            >
              <option value="CUSTOMER" className="bg-[#0b0b12]">El cliente</option>
              <option value="BUSINESS" className="bg-[#0b0b12]">El negocio (lo absorbe)</option>
            </select>
          </label>

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setUberQuoteDialog(null)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={!uberQuoteDialog || createUberMutation.isPending}
              onClick={() => {
                if (!uberQuoteDialog) return;
                createUberMutation.mutate({
                  orderId: uberQuoteDialog.orderId,
                  quoteId: uberQuoteDialog.quoteId,
                  feeCents: uberQuoteDialog.feeCents,
                  feePaidBy: uberQuoteDialog.payer,
                  etaMinutes: uberQuoteDialog.etaMinutes || undefined,
                  address: uberQuoteDialog.address,
                });
              }}
            >
              {createUberMutation.isPending ? "Solicitando…" : "Solicitar entrega"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── Asignar repartidor (Fase 0: manual) ── */}
      <Dialog
        open={!!deliveryDialog}
        onClose={() => setDeliveryDialog(null)}
        title="Asignar repartidor"
        className="max-w-sm w-full"
      >
        <div className="space-y-3 p-1">
          <p className="text-xs text-gray-400">
            Registra quién lleva el pedido. El Rabbitter recibe el aviso con su nombre.
          </p>
          <input
            value={deliveryDialog?.name ?? ""}
            onChange={(e) =>
              setDeliveryDialog((prev) => (prev ? { ...prev, name: e.target.value } : prev))
            }
            placeholder="Nombre del repartidor"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/60"
          />
          <input
            value={deliveryDialog?.phone ?? ""}
            onChange={(e) =>
              setDeliveryDialog((prev) => (prev ? { ...prev, phone: e.target.value } : prev))
            }
            placeholder="Teléfono (opcional)"
            inputMode="tel"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/60"
          />

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                Costo entrega (MXN)
              </span>
              <input
                value={deliveryDialog?.fee ?? ""}
                onChange={(e) =>
                  setDeliveryDialog((prev) => (prev ? { ...prev, fee: e.target.value } : prev))
                }
                placeholder="0.00"
                inputMode="decimal"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/60"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                Lo paga
              </span>
              <select
                value={deliveryDialog?.feePaidBy ?? "BUSINESS"}
                onChange={(e) =>
                  setDeliveryDialog((prev) =>
                    prev ? { ...prev, feePaidBy: e.target.value as 'BUSINESS' | 'CUSTOMER' } : prev,
                  )
                }
                className="h-[42px] w-full rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white outline-none"
              >
                <option value="BUSINESS" className="bg-[#0b0b12]">El negocio</option>
                <option value="CUSTOMER" className="bg-[#0b0b12]">El cliente</option>
              </select>
            </label>
          </div>
          {deliveryDialog?.feePaidBy === 'CUSTOMER' && (
            <p className="m-0 text-[10px] text-amber-300">
              Se sumará al total del pedido (solo si aún no está pagado).
            </p>
          )}

          <div className="space-y-1.5">
            <p className="m-0 text-[10px] font-black uppercase tracking-wider text-gray-400">
              Proveedor
            </p>
            {(deliveryProviders ?? []).map((provider) => (
              <div
                key={provider.id}
                className={cn(
                  "flex items-start gap-2 rounded-xl border px-2.5 py-2",
                  provider.id === "MANUAL"
                    ? "border-cyan-400/40 bg-cyan-400/10"
                    : "border-white/10 bg-white/[0.03] opacity-70",
                )}
              >
                <span
                  className={cn(
                    "mt-1 h-2 w-2 shrink-0 rounded-full",
                    provider.available ? "bg-cyan-400" : "bg-gray-600",
                  )}
                />
                <div className="min-w-0">
                  <p className="m-0 text-[11.5px] font-black text-white">{provider.name}</p>
                  <p className="m-0 text-[10px] leading-snug text-gray-400">
                    {provider.available ? provider.description : provider.unavailableReason}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setDeliveryDialog(null)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={!deliveryDialog?.name.trim() || assignDeliveryMutation.isPending}
              onClick={() => {
                if (!deliveryDialog) return;
                const feeNumber = Number.parseFloat(deliveryDialog.fee.replace(',', '.'));
                assignDeliveryMutation.mutate({
                  orderId: deliveryDialog.orderId,
                  provider: "MANUAL",
                  courierName: deliveryDialog.name.trim(),
                  courierPhone: deliveryDialog.phone.trim() || undefined,
                  feeCents:
                    Number.isFinite(feeNumber) && feeNumber > 0
                      ? Math.round(feeNumber * 100)
                      : undefined,
                  feePaidBy: deliveryDialog.feePaidBy,
                });
              }}
            >
              {assignDeliveryMutation.isPending ? "Asignando…" : "Asignar"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── Tiempo estimado de preparación (se promete al cliente) ── */}
      <Dialog
        open={!!etaPrompt}
        onClose={() => setEtaPrompt(null)}
        title={etaPrompt?.orderType === "DELIVERY" ? "¿Cuánto tarda la entrega?" : "¿Cuánto tarda?"}
        className="max-w-sm w-full"
      >
        <div className="space-y-3 p-1">
          <p className="text-xs text-gray-400">
            {etaPrompt?.orderType === "DELIVERY"
              ? "Incluye preparación + traslado. El Rabbitter lo verá en su notificación y en el seguimiento."
              : "El Rabbitter lo verá en su notificación y en el seguimiento de su pedido."}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[5, 10, 15, 20, 30, 45].map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => {
                  if (!etaPrompt) return;
                  stageMutation.mutate({ orderId: etaPrompt.orderId, stage: "PREPARING", etaMinutes: minutes });
                  setEtaPrompt(null);
                }}
                className="py-3 rounded-xl bg-white/5 border border-white/10 text-white font-black text-sm hover:bg-cyan-400/20 hover:border-cyan-400/40 active:scale-95 transition-all cursor-pointer"
              >
                {minutes} min
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              if (!etaPrompt) return;
              stageMutation.mutate({ orderId: etaPrompt.orderId, stage: "PREPARING" });
              setEtaPrompt(null);
            }}
            className="w-full py-2.5 text-xs font-bold text-gray-400 hover:text-white cursor-pointer"
          >
            Sin estimado
          </button>
        </div>
      </Dialog>

      {/* ── Alerta gigante + sonido: pedido nuevo desde la app ── */}
      <PosOrderAlert
        open={orderAlertOpen}
        count={appPendingCount}
        soundEnabled={orderAlertCfg?.soundEnabled !== false}
        onOpen={() => {
          setOrderAlertOpen(false);
          setTabsView("APP");
          setActiveTabsModal(true);
        }}
        onDismiss={() => setOrderAlertOpen(false)}
      />

      {/* ── Modal de Rabbitty Tabs / Comandas Activas en Tienda ── */}
      <Dialog
        open={activeTabsModal}
        onClose={() => setActiveTabsModal(false)}
        title="Operación · Comandas y Pedidos"
        className="max-w-2xl w-full"
      >
        <div className="space-y-4 p-1">
          {/* ── B1: una superficie, dos vistas (comandas / pedidos de la app) ── */}
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/5 border border-white/10">
            <button
              type="button"
              onClick={() => setTabsView("ALL")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer",
                tabsView === "ALL" ? "bg-purple-500/25 text-purple-100" : "text-gray-400 hover:text-white"
              )}
            >
              <Users className="h-3.5 w-3.5" />
              Comandas
              <span className="px-1.5 rounded-full text-[10px] bg-black/30">{tableTabsCount}</span>
            </button>
            <button
              type="button"
              onClick={() => setTabsView("APP")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer",
                tabsView === "APP" ? "bg-pink-500/25 text-pink-100" : "text-gray-400 hover:text-white"
              )}
            >
              <Smartphone className="h-3.5 w-3.5" />
              Desde la app
              <span className="px-1.5 rounded-full text-[10px] bg-black/30">{appTabsCount}</span>
              {appPendingCount > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
              )}
            </button>
          </div>

          {/* Ajuste de sonido: solo afecta al aviso de pedidos nuevos */}
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="min-w-0">
              <p className="text-[11px] font-black text-gray-200 m-0">Aviso al entrar un pedido</p>
              <p className="text-[10px] text-gray-500 m-0">Alerta a pantalla completa + sonido (dos tonos).</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={orderAlertCfg?.soundEnabled !== false}
              onClick={() => setOrderAlertSound.mutate({ enabled: !(orderAlertCfg?.soundEnabled !== false) })}
              disabled={setOrderAlertSound.isPending}
              className={cn(
                "shrink-0 px-3 py-2 rounded-xl text-[11px] font-black border cursor-pointer transition-all active:scale-95 disabled:opacity-50",
                orderAlertCfg?.soundEnabled !== false
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : "bg-white/5 border-white/10 text-gray-400",
              )}
            >
              {orderAlertCfg?.soundEnabled !== false ? "🔔 Sonido activado" : "🔕 Silencio"}
            </button>
          </div>

          {appPendingCount > 0 && (
            <div
              className="rounded-xl border p-2.5 flex items-center gap-2.5"
              style={{
                background: 'linear-gradient(135deg, rgba(233,30,99,0.16), rgba(10,5,12,0.6))',
                borderColor: 'rgba(233,30,99,0.5)',
              }}
            >
              <Smartphone size={15} className="text-[#E91E63] shrink-0" strokeWidth={2.5} />
              <p className="text-[11px] font-black text-white m-0 leading-tight">
                🔔 {appPendingCount > 1 ? `${appPendingCount} pedidos nuevos` : '1 pedido nuevo'} desde la app — sin asignar a mesa
              </p>
            </div>
          )}

          <div className="max-h-[28rem] overflow-y-auto custom-scrollbar space-y-3 pr-1">
            {visibleTabs.length > 0 ? (
              visibleTabs.map((tab) => (
                <div
                  key={tab.orderId}
                  className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 hover:border-cyan-500/30 hover:bg-white/[0.06] transition-all space-y-3"
                >
                  {/* Top row: Mesa/Origen, ID, y Acciones Principales con Total */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-white text-base tracking-tight">
                          {tab.tableNumber ? `Mesa #${tab.tableNumber}` : tab.orderType === "TO_GO" ? "Para Llevar" : tab.orderType}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg">
                          #{tab.orderId.slice(-4).toUpperCase()}
                        </span>
                        {tab.tableLocation && (
                          <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 border border-purple-500/30 px-2.5 py-0.5 rounded-full">
                            {tab.tableLocation}
                          </span>
                        )}
                      </div>

                      {/* Cliente Rabbitter */}
                      <div className="text-xs text-gray-300 flex items-center gap-2 pt-0.5">
                        {tab.customer ? (
                          <div className="inline-flex items-center gap-2 text-pink-300 font-bold bg-pink-500/10 px-2.5 py-1 rounded-xl border border-pink-500/20 text-xs">
                            <span className="text-sm">🐰</span>
                            <span>{tab.customer.name}</span>
                            {tab.customer.phone && (
                              <span className="text-gray-400 font-medium text-[11px] border-l border-pink-500/20 pl-2">
                                {tab.customer.phone}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500 italic text-[11px]">Sin cliente vinculado</span>
                        )}
                      </div>
                    </div>

                    {/* Total y botones de acción */}
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total</div>
                        <span className="font-mono font-black text-cyan-400 text-lg leading-tight block">
                          ${tab.total.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCashPaymentRequested(tab.status) ? (
                          <span
                            className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/40 text-xs font-bold"
                            title="El comensal solicitó pagar en efectivo: cobra en gaveta con tu PIN"
                          >
                            💵 Solicitó efectivo
                          </span>
                        ) : (
                          <>
                            <Button
                              onClick={() => void chargeOpenTab(tab)}
                              disabled={tabChargeMutation.isPending}
                              className="py-2 px-4 text-xs font-black bg-cyan-400 hover:bg-cyan-300 text-gray-950 shadow-md shadow-cyan-500/20 rounded-xl transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                              title="Cobra digitalmente esta orden"
                            >
                              <QrCode className="h-4 w-4 text-gray-950" />
                              Cobrar
                            </Button>
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
                              className="py-2 px-3.5 text-xs font-bold bg-pink-500/15 hover:bg-pink-500/25 text-pink-300 border border-pink-500/30 rounded-xl transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                            >
                              <Send className="h-3.5 w-3.5 text-pink-400" />
                              Enviar Cuenta
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tipo de pedido: en local / recoger / domicilio */}
                  {tab.fromApp && (
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-gray-200">
                        {tab.orderType === 'DELIVERY'
                          ? '🛵 Domicilio'
                          : tab.orderType === 'DINE_IN'
                            ? '🍽️ En local'
                            : '🥡 Para recoger'}
                      </span>
                      {tab.orderType === 'DELIVERY' && tab.deliveryAddress && (
                        <span className="min-w-0 flex-1 truncate text-[10.5px] font-bold text-cyan-300">
                          📍 {tab.deliveryAddress}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Entrega (domicilio): asignar repartidor y seguir el estado */}
                  {tab.fromApp && (tab.orderType === 'DELIVERY' || tab.orderType === 'TAKEAWAY') && (
                    <div className="mt-2 space-y-2 rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                      <div className="flex items-center justify-between">
                        <p className="m-0 text-[10px] font-black uppercase tracking-wider text-gray-400">
                          Entrega
                        </p>
                        <span className="text-[10px] font-black uppercase tracking-wide text-gray-300">
                          {tab.delivery?.provider === 'UBER_DIRECT'
                            ? 'Uber Direct'
                            : tab.delivery?.provider === 'RABBITTY_RIDE'
                              ? 'Rabbitty Ride'
                              : 'Manual'}
                          {tab.delivery ? ` · ${tab.delivery.status}` : ''}
                        </span>
                      </div>

                      {tab.delivery ? (
                        <>
                          <p className="m-0 text-[12px] font-bold text-white">
                            {tab.delivery.courierName || 'Repartidor sin nombre'}
                            {tab.delivery.courierPhone ? (
                              <span className="ml-2 font-medium text-gray-400">{tab.delivery.courierPhone}</span>
                            ) : null}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {tab.delivery.provider !== 'UBER_DIRECT' && tab.delivery.status === 'ASSIGNED' && (
                              <button
                                type="button"
                                onClick={() => advanceDeliveryMutation.mutate({ orderId: tab.orderId, status: 'PICKED_UP' })}
                                disabled={advanceDeliveryMutation.isPending}
                                className="rounded-lg bg-cyan-400/20 border border-cyan-400/40 px-2.5 py-1.5 text-[10.5px] font-black text-cyan-200 cursor-pointer disabled:opacity-50"
                              >
                                Marcar recogido
                              </button>
                            )}
                            {tab.delivery.provider !== 'UBER_DIRECT' && tab.delivery.status === 'PICKED_UP' && (
                              <button
                                type="button"
                                onClick={() => advanceDeliveryMutation.mutate({ orderId: tab.orderId, status: 'DELIVERED' })}
                                disabled={advanceDeliveryMutation.isPending}
                                className="rounded-lg bg-emerald-400/20 border border-emerald-400/40 px-2.5 py-1.5 text-[10.5px] font-black text-emerald-200 cursor-pointer disabled:opacity-50"
                              >
                                Marcar entregado
                              </button>
                            )}
                            {(tab.delivery.status === 'ASSIGNED' || tab.delivery.status === 'PICKED_UP') && (
                              <button
                                type="button"
                                onClick={() =>
                                  tab.delivery?.provider === 'UBER_DIRECT'
                                    ? cancelUberMutation.mutate({ orderId: tab.orderId })
                                    : advanceDeliveryMutation.mutate({ orderId: tab.orderId, status: 'CANCELLED' })
                                }
                                disabled={advanceDeliveryMutation.isPending || cancelUberMutation.isPending}
                                className="rounded-lg bg-red-500/15 border border-red-500/40 px-2.5 py-1.5 text-[10.5px] font-black text-red-300 cursor-pointer disabled:opacity-50"
                              >
                                Cancelar entrega
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setDeliveryDialog({
                              orderId: tab.orderId,
                              name: '',
                              phone: '',
                              fee: '',
                              feePaidBy: 'CUSTOMER',
                            })
                          }
                          className="w-full rounded-lg border border-white/15 bg-white/5 py-2 text-[11px] font-black text-white hover:bg-white/10 cursor-pointer"
                        >
                          Asignar repartidor
                        </button>
                      )}

                      {!tab.delivery && (deliveryProviders ?? []).some((p) => p.id === 'UBER_DIRECT' && p.available) && (
                        <>
                          {tab.orderType === 'DELIVERY' ? (
                            <button
                              type="button"
                              onClick={() => {
                                pendingUberAddressRef.current = null;
                                uberQuoteMutation.mutate({ orderId: tab.orderId });
                              }}
                              disabled={uberQuoteMutation.isPending}
                              className="w-full rounded-lg border border-cyan-400/40 bg-cyan-400/15 py-2 text-[11px] font-black text-cyan-100 hover:bg-cyan-400/25 cursor-pointer disabled:opacity-50"
                            >
                              {uberQuoteMutation.isPending ? 'Cotizando…' : 'Cotizar con Uber Direct'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setUberAddressDialog({
                                  orderId: tab.orderId,
                                  street1: '',
                                  city: '',
                                  state: '',
                                  zip: '',
                                  phone: '',
                                  country: 'MX',
                                })
                              }
                              className="w-full rounded-lg border border-cyan-400/40 bg-cyan-400/15 py-2 text-[11px] font-black text-cyan-100 hover:bg-cyan-400/25 cursor-pointer"
                            >
                              Enviar con Uber (capturar domicilio)
                            </button>
                          )}
                        </>
                      )}

                      <div className="flex flex-wrap gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => openCourierWhatsApp(tab)}
                          className="rounded-lg bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-1.5 text-[10.5px] font-black text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
                        >
                          Enviar por WhatsApp
                        </button>
                        {tab.deliveryAddress && (
                          <button
                            type="button"
                            onClick={() => openDeliveryRoute(tab)}
                            className="rounded-lg bg-white/5 border border-white/15 px-2.5 py-1.5 text-[10.5px] font-black text-white hover:bg-white/10 cursor-pointer"
                          >
                            Ruta en Maps
                          </button>
                        )}
                        {tab.delivery?.trackingUrl && (
                          <a
                            href={tab.delivery.trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg bg-white/5 border border-white/15 px-2.5 py-1.5 text-[10.5px] font-black text-white hover:bg-white/10 no-underline"
                          >
                            Seguimiento Uber
                          </a>
                        )}
                        {tab.delivery?.courierPhone && (
                          <a
                            href={`tel:${tab.delivery.courierPhone}`}
                            className="rounded-lg bg-white/5 border border-white/15 px-2.5 py-1.5 text-[10.5px] font-black text-white hover:bg-white/10 no-underline"
                          >
                            Llamar
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Comanda: items ordenados desde la app */}
                  {tab.items && tab.items.length > 0 && (
                    <div className="pt-2 border-t border-white/5 flex flex-wrap gap-1.5">
                      {tab.items.map((it, idx) => (
                        <span
                          key={idx}
                          title={it.notes || undefined}
                          className="inline-flex items-center gap-1 text-[11px] text-gray-200 bg-white/5 border border-white/10 px-2 py-1 rounded-lg"
                        >
                          <span className="font-black text-cyan-400">{it.quantity}×</span>
                          <span>{it.name}</span>
                          {it.notes && <span className="text-amber-300 font-medium">({it.notes})</span>}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* ── H-TRACK · flujo grande: Recibido → Procesando → Despachando
                       → Cobrar. Cada paso empuja la etapa al móvil (bidireccional). ── */}
                  {tab.fromApp && (() => {
                    const stage = String(tab.stage ?? 'RECEIVED');
                    const isDelivery = tab.orderType === 'DELIVERY';
                    const steps = [
                      { id: 'RECEIVED', label: 'Recibido', Icon: Smartphone },
                      { id: 'PREPARING', label: isDelivery ? 'Preparando' : 'Procesando', Icon: Flame },
                      { id: 'READY', label: isDelivery ? 'En camino' : 'Despachando', Icon: Bike },
                      { id: 'DONE', label: 'Entregado', Icon: CheckCircle2 },
                    ];
                    const idx = Math.max(0, steps.findIndex((s) => s.id === stage));
                    const next = nextStageOf(stage);
                    const nextCopy = next === 'PREPARING'
                      ? { label: 'Procesando', hint: 'Avisar al cliente que ya lo estamos haciendo', Icon: Flame }
                      : next === 'READY'
                        ? isDelivery
                          ? { label: 'En camino', hint: 'Avisar al cliente que el repartidor ya salió', Icon: Bike }
                          : { label: 'Despachando', hint: 'Listo: el cliente ya puede recogerlo', Icon: Bike }
                        : next === 'DONE'
                          ? { label: 'Entregado', hint: 'Cerrar el pedido', Icon: CheckCircle2 }
                          : null;
                    const isEmpty = Number(tab.total ?? 0) === 0 && (tab.items?.length ?? 0) === 0;

                    return (
                      <div className="pt-3 border-t border-white/10 space-y-3">
                        {/* Progreso 4 pasos */}
                        <div className="grid grid-cols-4 gap-1">
                          {steps.map((s, i) => {
                            const done = i <= idx;
                            const current = i === idx;
                            return (
                              <div key={s.id} className="flex flex-col items-center gap-1">
                                <div
                                  className={cn(
                                    "w-full h-1.5 rounded-full",
                                    done ? "bg-cyan-400" : "bg-white/10",
                                  )}
                                />
                                <span
                                  className={cn(
                                    "text-[9px] font-black uppercase tracking-wide flex items-center gap-1",
                                    current ? "text-cyan-300" : done ? "text-cyan-500/70" : "text-gray-500",
                                  )}
                                >
                                  <s.Icon className="h-3 w-3" />
                                  {s.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {tab.fromApp && tab.prepEtaMinutes ? (
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 border border-amber-400/35 px-2.5 py-1">
                              <span className="text-[10px] font-black uppercase tracking-wide text-amber-200">
                                👨‍🍳 Cocina: ~{tab.prepEtaMinutes} min
                              </span>
                            </div>
                          ) : null}
                          {tab.fromApp && tab.etaMinutes ? (
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400/15 border border-cyan-400/35 px-2.5 py-1">
                              <span className="text-[10px] font-black uppercase tracking-wide text-cyan-300">
                                {tab.delivery ? '🛵 Entrega' : '⏱ Prometido'} al cliente: ~{tab.etaMinutes} min
                              </span>
                            </div>
                          ) : null}
                        </div>

                        {isEmpty ? (
                          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2.5">
                            <p className="text-[11px] font-black text-amber-300 m-0">Comanda sin productos</p>
                            <p className="text-[10px] text-amber-200/70 m-0 mt-0.5">
                              Es el borrador del vínculo. Agrega productos o cobra desde aquí.
                            </p>
                          </div>
                        ) : null}

                        {/* CTA gigante */}
                        {nextCopy ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (next === "PREPARING") {
                                setEtaPrompt({ orderId: tab.orderId, orderType: tab.orderType });
                                return;
                              }
                              stageMutation.mutate({ orderId: tab.orderId, stage: next! });
                            }}
                            disabled={stageMutation.isPending}
                            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-gray-950 text-base font-black cursor-pointer active:scale-[0.99] transition-transform disabled:opacity-60 shadow-lg shadow-cyan-500/20"
                          >
                            <nextCopy.Icon className="h-5 w-5" />
                            {nextCopy.label}
                            <span className="text-[11px] font-bold opacity-70 normal-case">· {nextCopy.hint}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void chargeOpenTab(tab)}
                            disabled={tabChargeMutation.isPending || Number(tab.total ?? 0) <= 0}
                            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-gray-950 text-base font-black cursor-pointer active:scale-[0.99] transition-transform disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                          >
                            <CreditCard className="h-5 w-5" />
                            Cobrar ${Number(tab.total ?? 0).toFixed(2)}
                          </button>
                        )}

                        {/* Acciones secundarias grandes */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await sendBillMutation.mutateAsync({
                                orderId: tab.orderId,
                                customerId: tab.customer?.id || undefined,
                                phone: tab.customer?.phone || undefined,
                                customerName: tab.customer?.name || undefined,
                              });
                            }}
                            disabled={sendBillMutation.isPending || !tab.customer}
                            className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 text-pink-300 border border-pink-500/30 text-xs font-black cursor-pointer active:scale-95 transition-transform disabled:opacity-40"
                          >
                            <Send className="h-4 w-4" />
                            Enviar cuenta
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRabbitter({
                                id: tab.customer?.id || '',
                                name: tab.customer?.name || 'Rabbitter',
                                phoneNumber: tab.customer?.phone || null,
                                telegramId: tab.customer?.username || null,
                                bunzBalance: 0,
                                hops: 0,
                                level: '',
                                currentRewardRate: 0,
                              });
                              setDraftOrderId(tab.orderId);
                              setDraftHasItems(true);
                              setActiveTabsModal(false);
                            }}
                            disabled={!tab.customer}
                            className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 text-xs font-black cursor-pointer active:scale-95 transition-transform disabled:opacity-40"
                          >
                            <Plus className="h-4 w-4" />
                            Agregar más
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500 text-xs">
                {tabsView === "APP"
                  ? "Sin pedidos desde la app por ahora. Cuando un Rabbitter pida desde el local, aparece aquí."
                  : "No hay comandas activas pendientes en esta sucursal."}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-white/5">
            <Button variant="secondary" onClick={() => setActiveTabsModal(false)} className="rounded-xl px-4 text-xs font-bold">
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

          {/* ── Búsqueda dinámica de Rabbitter (mismo patrón del QR Neón) ── */}
          <div className="w-full text-left space-y-2 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
              🔍 Identificar Rabbitter (local / general)
            </p>
            <input
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
              placeholder="Nombre, @handle, teléfono o ID del Rabbitter"
              value={qrModalQuery}
              onChange={(e) => setQrModalQuery(e.target.value)}
            />
            {(activeCheckIns || []).filter((c: any) =>
              qrModalQuery.trim().length === 0 ||
              (c.name || "").toLowerCase().includes(qrModalQuery.trim().toLowerCase())
            ).slice(0, 4).map((c: any) => (
              <button
                key={c.userId}
                type="button"
                onClick={async () => {
                  try {
                    const res = await utils.pos.lookupRabbitter.fetch({ query: c.userId });
                    if (res) {
                      setSelectedRabbitter(res);
                      toast.success(`🐰 ${res.name} vinculado — recibirá el push in-app`);
                      setQrModalQuery("");
                    } else {
                      toast.error("No se pudo vincular");
                    }
                  } catch { toast.error("Error al vincular"); }
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/5 border border-emerald-500/40 text-[11px] font-bold text-white hover:bg-emerald-500/10 active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>🟢 {c.name} · hace {Math.max(0, Math.round((c.ageSeconds ?? 9999) / 60))}m</span>
                <span className="text-emerald-300">+ vincular</span>
              </button>
            ))}
            {qrModalQuery.trim().length > 2 && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await utils.pos.lookupRabbitter.fetch({ query: qrModalQuery.trim() });
                    if (res) {
                      setSelectedRabbitter(res);
                      toast.success(`🐰 ${res.name} vinculado — recibirá el pago in-app`);
                      setQrModalQuery("");
                    } else {
                      toast.error("Sin coincidencias en Rabbitty");
                    }
                  } catch { toast.error("Error de búsqueda"); }
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-bold text-white hover:bg-white/10 cursor-pointer active:scale-[0.98] transition-all"
              >
                🔎 Buscar en toda Rabbitty: "{qrModalQuery.trim()}"
              </button>
            )}
          </div>

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
            {/* ── Selector unificado: check-in en local + teléfono/ID fallback ── */}
            {(activeCheckIns?.length ?? 0) > 0 && (
              <div className="px-2.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                <p className="text-[10px] font-black text-emerald-300 flex items-center gap-1 mb-1.5">
                  <span>🟢</span> CLIENTES EN EL LOCAL (check-in activo) — toca para vincular
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(activeCheckIns || []).slice(0, 6).map((c) => (
                    <button
                      key={c.userId}
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await utils.pos.lookupRabbitter.fetch({ query: c.userId });
                          if (res) {
                            setSelectedRabbitter(res);
                            toast.success(`🐰 ${res.name} vinculado — recibirá el push in-app`);
                          } else {
                            toast.error("No se pudo vincular al cliente");
                          }
                        } catch {
                          toast.error("Error al vincular");
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-emerald-500/40 text-[11px] font-bold text-white hover:border-emerald-500/80 hover:bg-emerald-500/10 active:scale-95 transition-all"
                    >
                      🐰 {c.name} <span className="text-emerald-300">+ vincular</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label className="text-xs font-bold text-gray-300">
              {selectedRabbitter
                ? "📲 El pago irá como PUSH in-app al Rabbitter vinculado (paga desde su app)"
                : "Teléfono del cliente (WhatsApp)"}
            </label>
            {!selectedRabbitter && (
              <Input
                placeholder="10 dígitos (ej. 5512345678)"
                type="tel"
                value={waPhone}
                onChange={(e) => setWaPhone(e.target.value.replace(/\D/g, ''))}
                className="text-center py-2.5 text-sm"
              />
            )}
            {selectedRabbitter && (
              <p className="text-[11px] text-emerald-300 font-semibold">
                ✓ {selectedRabbitter.name} tiene la app — recibe la notificación al instante y paga desde su teléfono. (WhatsApp opcional: pide su teléfono y actívalo abajo.)
              </p>
            )}
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
              {sendBillMutation.isPending ? "Despachando..." : selectedRabbitter ? "📲 Enviar pago in-app" : "Despachar por WhatsApp"}
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
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-400">
              Rescata una comanda previa para continuar cobrándola o modificarla sin haber perdido los platillos.
            </p>
            {cart.length > 0 && (
              <Button
                type="button"
                onClick={() => {
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
                className="shrink-0 py-1.5 px-3 text-xs font-black bg-amber-500 hover:bg-amber-400 text-gray-950 shadow-md active:scale-95 cursor-pointer"
              >
                <Pause className="h-3 w-3 mr-1" />
                Pausar Orden Actual (${total.toFixed(2)})
              </Button>
            )}
          </div>

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
                  // Reimpresión/reenvío: SIN token firmado (el claim real ya
                  // venció o no aplica) — el enlace de WhatsApp/QR usa vista de
                  // ticket (?ticket=orderId). El QR impreso con claim firmado
                  // solo se genera en el cobro original.
                  claimToken: "",
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
                  tip: Number(ord.tip || 0),
                  gratuityMode: String((rest as any)?.gratuityMode || "OFF"),
                  currency: rest?.currency || "MXN",
                  paymentMethod: ord.bunzPaid && ord.bunzPaid > 0 ? "BUNZ" : "EFECTIVO",
                  usdAmount: (rest as any)?.showUsdTicket && Number((rest as any)?.usdRate > 0)
                    ? Math.round((ord.total / Number((rest as any).usdRate)) * 100) / 100
                    : undefined,
                  usdRate: (rest as any)?.showUsdTicket ? Number((rest as any)?.usdRate) || undefined : undefined,
                  bunzCashbackRate: rest?.defaultRewardRate ?? 20,
                  estimatedBunz: ord.bunzReward || Math.max(1, Math.round(ord.total * 0.2)),
                  customerName: ord.customerName || undefined,
                  awardedBunz: ord.bunzReward && ord.bunzReward > 0 ? ord.bunzReward : undefined,
                });

                return (
                  <div
                    key={ord.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-linear-to-r from-white/7 to-white/3 border border-white/10 p-3.5 hover:border-pink-500/30 hover:from-white/9 transition-all"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-xs text-pink-300 bg-pink-500/15 border border-pink-500/30 px-2.5 py-1 rounded-lg tracking-wider shadow-sm">
                          {orderFolio}
                        </span>
                        <span className="text-[10px] font-bold text-gray-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                          {ord.orderType === "TO_GO" ? "Para Llevar" : ord.orderType || "VENTA"}
                        </span>
                        <span className="text-[11px] font-medium text-gray-400">
                          {orderDate.toLocaleTimeString("es-MX", { timeZone: rest?.timezone || "America/Mexico_City", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="text-xs text-gray-300 flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-400">{itemsCount} producto(s)</span>
                        <span>·</span>
                        <span className="font-mono font-black text-emerald-400 text-sm">
                          ${Number(ord.total).toFixed(2)} {rest?.currency || "MXN"}
                        </span>
                        {ord.customerName && (
                          <span className="text-pink-300 font-bold bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1">
                            🐰 {ord.customerName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                      <Button
                        onClick={() => {
                          const ticket = reconstructTicket();
                          setPaidTicketData(ticket);
                          setReceiptModal(true);
                          setRecentOrdersModal(false);
                        }}
                        className="py-1.5 px-3 text-xs font-bold bg-white/10 hover:bg-white/15 text-white border border-white/15 rounded-xl transition-all active:scale-95 cursor-pointer"
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
                        className="py-1.5 px-3.5 text-xs font-black bg-cyan-500 hover:bg-cyan-400 text-gray-950 shadow-md shadow-cyan-500/20 rounded-xl active:scale-95 cursor-pointer flex items-center gap-1.5 disabled:opacity-70 disabled:cursor-wait transition-all"
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
            <p className="text-xs text-gray-400 max-w-60 leading-relaxed">
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
          <div className="grid grid-cols-3 gap-2 w-full max-w-60">
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

/**
 * ── BenefitsPanel (GAP 1) ── Beneficios de membresía del cliente vinculado,
 * aplicables al cobro directo. El server re-verifica propiedad/cuota — aquí
 * solo se muestra lo elegible con el carrito actual.
 */
type BenefitRow = {
  entitlementId: string;
  benefitType: string;
  targetRefId: string | null;
  remaining: number | null;
  discountPct: number | null;
  creditBalance: number | null;
  planName: string;
  membershipOrigin: string | null;
};

function BenefitsPanel({
  businessId,
  customerId,
  cart,
  selected,
  onToggle,
}: {
  businessId: string;
  customerId: string;
  cart: Array<{ menuItemId: string; price: number; quantity: number } & { name?: string }>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const benefits = trpc.memberships.getMembershipBenefits.useQuery(
    { businessId, customerId },
    { enabled: Boolean(businessId && customerId) }
  );

  const rows = (benefits.data ?? []).filter((b) => {
    if (b.benefitType === "INCLUDED_PRODUCT") {
      // Solo es aplicable si el platillo incluido está en el carrito actual
      return b.targetRefId && cart.some((i) => i.menuItemId === b.targetRefId);
    }
    return b.benefitType === "DISCOUNT_PCT" || b.benefitType === "CREDIT_BALANCE";
  });

  if (rows.length === 0) return null;

  const label = (b: BenefitRow): string => {
    if (b.benefitType === "INCLUDED_PRODUCT") {
      const it = cart.find((i) => i.menuItemId === b.targetRefId);
      return `1× ${it?.name || "Producto"} GRATIS`;
    }
    if (b.benefitType === "DISCOUNT_PCT") return `${b.discountPct}% de descuento`;
    if (b.benefitType === "CREDIT_BALANCE") return `Saldo $${(b.creditBalance ?? 0).toFixed(2)} como pago`;
    return b.benefitType;
  };

  return (
    <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3 space-y-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
        🎟️ Beneficios de membresía — toca para aplicar a esta venta
      </p>
      {rows.map((b: BenefitRow) => {
        const isSel = selected.includes(b.entitlementId);
        const exhausted = b.benefitType !== "CREDIT_BALANCE" && (b.remaining ?? 0) <= 0;
        const dup = selected.filter((id) => id === b.entitlementId).length > 1;
        void dup;
        return (
          <button
            key={b.entitlementId}
            type="button"
            onClick={() => { if (!exhausted) onToggle(b.entitlementId); }}
            className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[11px] font-bold border transition-all cursor-pointer ${
              isSel
                ? "bg-amber-500/25 border-amber-400 text-white"
                : exhausted
                ? "bg-white/5 border-white/10 text-gray-500 cursor-not-allowed"
                : "bg-white/5 border-white/10 text-gray-200 hover:bg-white/10"
            }`}
          >
            <span className="text-left">
              <span className="block">{isSel ? "☑" : "☐"} {label(b)}</span>
              <span className="text-[9px] text-gray-400 font-normal">
                {b.planName} · {b.membershipOrigin === "COURTESY" ? "Cortesía" : "Membresía"}
                {b.benefitType !== "CREDIT_BALANCE" && ` · quedan ${b.remaining ?? "?"} este ciclo`}
              </span>
            </span>
          </button>
        );
      })}
      <p className="text-[9px] text-gray-400 leading-snug">El total se ajusta automáticamente al liquidar. Los usos quedan ligados al ticket.</p>
    </div>
  );
}
