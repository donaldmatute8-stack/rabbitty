"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Badge, Button, Input, Select, Dialog, toast } from "@rabbitty/ui";
import { 
  Printer, Monitor, Layers, Cpu, Download, BookOpen, Terminal, 
  CheckCircle, FileText, Sparkles, Building2, Phone, Mail, 
  MapPin, ShieldCheck, Save, RefreshCw, Eye, Share2, MessageCircle, 
  FileDown, Image as ImageIcon, ExternalLink, Maximize2, Upload, X,
  Bluetooth, BluetoothConnected, Wifi, WifiOff, AlertTriangle, Activity,
  Usb, Signal, ZapOff, Zap
} from "lucide-react";
import { TicketTemplate, TicketData } from "../../../components/TicketTemplate";
import { HardwareConnectionGuide } from "../../../components/HardwareConnectionGuide";
import { 
  connectBluetoothPrinter, 
  isBluetoothConnected, 
  disconnectBluetoothPrinter,
  sendEscPosToBluetooth,
  diagnosePrinterConnection,
  generateEscPosTicketPayload,
  type PrinterDiagnostics,
} from "../../../lib/web-bluetooth";

export default function HardwarePage() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"ticket" | "manual" | "devices">("ticket");
  const [fullscreenModal, setFullscreenModal] = useState(false);
  const [thermalPaperMode, setThermalPaperMode] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch restaurant & branch data
  const { data: restaurants, isLoading: loadingRest } = trpc.admin.getRestaurants.useQuery();
  const { data: ticketContext, isLoading: loadingTicket } = trpc.printing.getTicketData.useQuery(undefined);
  
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>("");
  
  const currentRestaurant = 
    restaurants?.find((r) => r.id === selectedRestaurantId) || 
    restaurants?.[0] || 
    ticketContext?.restaurant;
  const currentBranch = ticketContext?.branch;

  // Form State for Ticket Fiscal & Business Information
  const [ticketForm, setTicketForm] = useState({
    name: "",
    legalName: "",
    rfc: "",
    taxRegime: "",
    logoUrl: "",
    phone: "",
    email: "",
    address: "",
    ticketFooter: "",
    printerType: "ESC/POS 58mm",
  });

  useEffect(() => {
    if (restaurants && restaurants.length > 0 && !selectedRestaurantId) {
      // Default cleanly to the first available restaurant without forced tenant pre-selection
      setSelectedRestaurantId(restaurants[0].id);
    }
  }, [restaurants, selectedRestaurantId]);

  useEffect(() => {
    if (currentRestaurant) {
      setTicketForm({
        name: currentRestaurant.name || "",
        legalName: (currentRestaurant as any).legalName || "",
        rfc: (currentRestaurant as any).rfc || "",
        taxRegime: (currentRestaurant as any).taxRegime || "",
        logoUrl: (currentRestaurant as any).logoUrl || "",
        phone: (currentRestaurant as any).phone || currentBranch?.phone || "",
        email: (currentRestaurant as any).email || "",
        address: currentBranch?.address || "",
        ticketFooter: (currentRestaurant as any).ticketFooter || "¡Gracias por su compra en Rabbitty! Vuelva pronto.",
        printerType: currentRestaurant.printerType || "ESC/POS 58mm",
      });
    }
  }, [currentRestaurant, currentBranch]);

  // Mutation to persist ticket configuration
  const updateRestaurant = trpc.admin.updateRestaurant.useMutation({
    onSuccess: () => {
      utils.admin.getRestaurants.invalidate();
      utils.printing.getTicketData.invalidate();
      toast.success("Configuración de ticket guardada correctamente");
    },
    onError: (err) => {
      toast.error(err.message || "Error al actualizar la configuración");
    },
  });

  const handleSaveTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRestaurant?.id) {
      toast.error("No se encontró el identificador del restaurante");
      return;
    }

    updateRestaurant.mutate({
      id: currentRestaurant.id,
      name: ticketForm.name,
      legalName: ticketForm.legalName,
      rfc: ticketForm.rfc,
      taxRegime: ticketForm.taxRegime,
      logoUrl: ticketForm.logoUrl,
      phone: ticketForm.phone,
      email: ticketForm.email,
      address: ticketForm.address,
      ticketFooter: ticketForm.ticketFooter,
      printerType: ticketForm.printerType,
    });
  };

  const handleDownload = (os: string) => {
    toast.info(`El Rabbitty Print Agent para ${os} estará disponible próximamente. Por ahora usa el bridge USB/Mac o impresión del navegador.`);
  };

  const [btConnected, setBtConnected] = useState(false);
  const [btDeviceName, setBtDeviceName] = useState<string | null>(null);
  const [previewModal, setPreviewModal] = useState(false);
  const [diag, setDiag] = useState<PrinterDiagnostics | null>(null);

  // ── PRINTER STATUS (polling /api/print GET) ──
  type PrinterStatus = {
    status: "online" | "offline" | "degraded" | "checking" | "unknown";
    message: string;
    name?: string;
    model?: string;
    bridge?: string;
    usbVisible?: boolean;
    cupsAccepting?: boolean;
    bridgeReady?: boolean;
    checkedAt?: string;
  };
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus>({
    status: "unknown",
    message: "Estado no verificado aún",
  });
  const [isCheckingPrinter, setIsCheckingPrinter] = useState(false);

  const checkPrinterStatus = useCallback(async () => {
    setIsCheckingPrinter(true);
    setPrinterStatus((prev) => ({ ...prev, status: "checking", message: "Verificando impresora..." }));
    try {
      const res = await fetch("/api/print", { method: "GET", cache: "no-store" });
      const data = await res.json();
      setPrinterStatus({
        status: data.status ?? "unknown",
        message: data.message ?? (data.status === "online" ? "Impresora lista" : "Estado desconocido"),
        name: data.name,
        model: data.model,
        bridge: data.bridge,
        usbVisible: data.usbVisible,
        cupsAccepting: data.cupsAccepting,
        bridgeReady: data.bridgeReady,
        checkedAt: data.checkedAt,
      });
    } catch {
      setPrinterStatus({ status: "offline", message: "No se pudo contactar al servidor de impresión" });
    } finally {
      setIsCheckingPrinter(false);
    }
  }, []);

  // Auto-check on mount and every 30s
  useEffect(() => {
    checkPrinterStatus();
    const interval = setInterval(checkPrinterStatus, 30_000);
    return () => clearInterval(interval);
  }, [checkPrinterStatus]);

  // One-time browser/connection diagnosis (also refreshed by handleConnectBluetooth)
  useEffect(() => {
    setDiag(diagnosePrinterConnection());
  }, []);

  // Keep Screen Awake (WakeLock API) to prevent Bluetooth drop
  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await (navigator as any).wakeLock.request("screen");
        }
      } catch (err) {
        // WakeLock might be denied if battery is low or not supported
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLock !== null) {
        wakeLock.release().catch(() => {});
      }
    };
  }, []);

  // Bluetooth connections should persist even if the screen dims or modal opens.
  // Aggressive cleanup on visibilitychange causes instant disconnects on Bluefy.
  useEffect(() => {
    return () => {
      disconnectBluetoothPrinter();
    };
  }, []);

  const handleConnectBluetooth = async () => {
    // Diagnostics — help debug why BT might not work
    const d = diagnosePrinterConnection();
    console.info("[BT Debug]", d);

    if (d.status === "HTTP" || d.status === "BLOCKED_BY_CONTEXT" || d.status === "BLOCKED_BY_BROWSER") {
      toast.error("❌ " + d.recommendation);
      return;
    }

    try {
      toast.info(
        d.status === "BLE_ONLY"
          ? "Buscando impresora BLE... (si no aparece la tuya, es Bluetooth Classic → usa el bridge USB/Mac)"
          : "Buscando impresora Bluetooth POS-58 / MTP..."
      );
      const result = await connectBluetoothPrinter();
      if (result.success) {
        setBtConnected(true);
        setBtDeviceName(result.deviceName);
        toast.success(`🐰 ¡Conectado directamente a ${result.deviceName}!`);
      } else if (result.error !== "Selección cancelada.") {
        toast.error(result.error || "No se pudo emparejar con la impresora Bluetooth");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al conectar por Bluetooth");
    }
  };

  const handleDisconnectBluetooth = async () => {
    await disconnectBluetoothPrinter();
    setBtConnected(false);
    setBtDeviceName(null);
    toast.info("Impresora Bluetooth desconectada");
  };

  const handlePrintTest = async () => {
    // 1. Web Bluetooth direct path
    if (btConnected && isBluetoothConnected()) {
      try {
        toast.info(`Imprimiendo inalámbricamente vía Bluetooth en ${btDeviceName}...`);
        const is58mm = ticketForm.printerType.includes("58mm");
        const payload = generateEscPosTicketPayload(previewTicketData, is58mm);
        
        await sendEscPosToBluetooth(payload);
        toast.success("¡Ticket emitido directamente por Bluetooth!");
        return;
      } catch (err: any) {
        toast.error("Error Bluetooth: " + (err.message || "Intenta reconectar"));
        return;
      }
    }

    // 2. USB/CUPS bridge via /api/print
    try {
      toast.info("Enviando ticket a Rabbitty POS Printer (USB)...");
      const res = await fetch("/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(previewTicketData),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("¡Ticket impreso en Rabbitty POS Printer!");
        return;
      }
      toast.error(`Impresora USB: ${data.error || "Error al imprimir"}. Usando impresión web...`);
      setTimeout(() => window.print(), 1500);
    } catch {
      toast.error("No se pudo contactar al bridge USB. Usando impresión web...");
      setTimeout(() => window.print(), 1000);
    }
  };

  const handlePrintWelcome = async () => {
    try {
      toast.info("Enviando Ticket de Bienvenida Rabbitty a la impresora...");
      const res = await fetch("/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...previewTicketData,
          isWelcome: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("🐰 ¡Bienvenida Rabbitty emitida físicamente con éxito!");
        return;
      } else {
        toast.error(`${data.error || "No se pudo emitir el ticket"}. Usando impresión web...`);
        setTimeout(() => window.print(), 1500);
      }
    } catch (err: any) {
      toast.error(`${err.message || "Error al conectar con la impresora"}. Usando impresión web...`);
      setTimeout(() => window.print(), 1000);
    }
  };

  // Preview Mock Data synced in real time with the form
  const previewTicketData: TicketData = {
    restaurantName: ticketForm.name || "Rabbitty Bistro & Coffee",
    legalName: ticketForm.legalName || "OPERADORA GASTRONOMICA RABBITTY S.A. DE C.V.",
    rfc: ticketForm.rfc || "OGR210815XYZ",
    taxRegime: ticketForm.taxRegime || "601 - General de Ley Personas Morales",
    logoUrl: ticketForm.logoUrl || undefined,
    address: ticketForm.address || currentBranch?.address || "Av. Insurgentes Sur 1602, Crédito Constructor, CDMX",
    phone: ticketForm.phone || "55 8432 9901",
    email: ticketForm.email || "contacto@rabbitty.mx",
    ticketFooter: ticketForm.ticketFooter || "¡Gracias por su compra en Rabbitty! Vuelva pronto.",
    orderNumber: "8492",
    tableNumber: "04 (Terraza)",
    orderType: "Consumo en Sitio",
    cashierName: "Marco A. (Cajero)",
    date: new Date().toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }),
    items: [
      { id: "1", name: "Hamburguesa Trufa Doble", quantity: 2, unitPrice: 245, totalPrice: 490, notes: "Sin cebolla" },
      { id: "2", name: "Papas Rústicas Parmesano", quantity: 1, unitPrice: 120, totalPrice: 120 },
      { id: "3", name: "Cerveza Artesanal IPA 355ml", quantity: 2, unitPrice: 95, totalPrice: 190 },
      { id: "4", name: "Café Cold Brew Rabbitty", quantity: 1, unitPrice: 85, totalPrice: 85 },
    ],
    subtotal: 762.93,
    taxRate: 0.16,
    tax: 122.07,
    discount: 0,
    tip: 88.50,
    total: 885.00,
    paymentMethod: "TARJETA (DEBIT)",
    currency: currentRestaurant?.currency || "MXN",
    bunzCashbackRate: (currentRestaurant as any)?.defaultRewardRate ?? 20,
  };

  // ── EXPORT AS IMAGE (PNG) VIA SVG FOREIGN OBJECT ──
  const handleExportImage = async () => {
    try {
      setIsExporting(true);
      const element = document.getElementById("thermal-printable-receipt");
      if (!element) {
        toast.error("No se encontró el contenedor del ticket");
        return;
      }

      // Clone styles to make a clean standalone SVG
      const width = element.offsetWidth || 340;
      const height = element.offsetHeight || 650;

      // Extract outerHTML and sanitize
      const cloned = element.cloneNode(true) as HTMLElement;
      // Force background if needed
      cloned.style.margin = "0";

      const html = new XMLSerializer().serializeToString(cloned);
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="background:#0a0a0c; color:#ffffff; font-family:sans-serif; height:100%; border-radius:24px;">
              ${html}
            </div>
          </foreignObject>
        </svg>
      `;

      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = width * 2;
        canvas.height = height * 2;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.scale(2, 2);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((pngBlob) => {
            if (pngBlob) {
              const pngUrl = URL.createObjectURL(pngBlob);
              const downloadLink = document.createElement("a");
              downloadLink.href = pngUrl;
              downloadLink.download = `ticket-${ticketForm.name || "rabbitty"}-${Date.now()}.png`;
              document.body.appendChild(downloadLink);
              downloadLink.click();
              document.body.removeChild(downloadLink);
              URL.revokeObjectURL(pngUrl);
              toast.success("Imagen del ticket descargada exitosamente (PNG)");
            }
          }, "image/png");
        }
        URL.revokeObjectURL(url);
        setIsExporting(false);
      };

      img.onerror = () => {
        // Fallback: direct SVG download
        const downloadLink = document.createElement("a");
        downloadLink.href = url;
        downloadLink.download = `ticket-${ticketForm.name || "rabbitty"}.svg`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        toast.success("Ticket descargado como archivo vectorial SVG");
        setIsExporting(false);
      };

      img.src = url;
    } catch (err: any) {
      toast.error("Error al exportar la imagen: " + err.message);
      setIsExporting(false);
    }
  };

  // ── EXPORT AS PDF ──
  const handleExportPDF = () => {
    toast.info("En el cuadro de diálogo de impresión, selecciona 'Guardar como PDF'");
    window.print();
  };

  // ── SHARE VIA WHATSAPP ──
  const handleShareWhatsApp = () => {
    const business = ticketForm.name || "Rabbitty Bistro";
    const totalFormatted = `$${previewTicketData.total.toFixed(2)} ${previewTicketData.currency}`;
    const rfcText = ticketForm.rfc ? ` (RFC: ${ticketForm.rfc})` : "";
    const itemsSummary = previewTicketData.items
      .map((i) => `• ${i.quantity}x ${i.name} - $${i.totalPrice.toFixed(2)}`)
      .join("%0A");

    const message = 
      `🧾 *TICKET DE VENTA - ${encodeURIComponent(business)}*${rfcText}%0A` +
      `📅 Fecha: ${encodeURIComponent(previewTicketData.date || "")}%0A` +
      `🔖 Folio: #${previewTicketData.orderNumber}%0A%0A` +
      `*Detalle del Consumo:*%0A${itemsSummary}%0A%0A` +
      `*Subtotal:* $${previewTicketData.subtotal?.toFixed(2)}%0A` +
      `*IVA (16%):* $${previewTicketData.tax?.toFixed(2)}%0A` +
      `*TOTAL:* ${encodeURIComponent(totalFormatted)}%0A%0A` +
      `🐰 _Emitido con Rabbitty OS POS • rabbitty.me_`;

    const phoneClean = ticketForm.phone.replace(/\D/g, "");
    const waUrl = phoneClean 
      ? `https://wa.me/${phoneClean}?text=${message}`
      : `https://wa.me/?text=${message}`;

    window.open(waUrl, "_blank");
    toast.success("Abriendo WhatsApp con el resumen del ticket...");
  };

  const devices = [
    {
      title: "Impresoras Térmicas (comandas/tickets)",
      description: "Soporte para protocolo estándar ESC/POS a través de USB, Ethernet o Bluetooth.",
      icon: Printer,
      color: "text-pink-400",
      bg: "bg-pink-500/10 border-pink-500/20",
      status: "Soportado",
      badgeVariant: "success" as const,
      details: [
        "Ancho de papel compatible: 80mm (recomendado) y 58mm.",
        "Conexión directa vía Driver Genérico / Texto o USB.",
        "Soporte de corte automático de papel y apertura de gaveta.",
      ],
    },
    {
      title: "Cajón de Dinero (RJ11)",
      description: "Apertura automática mediante pulsos del puerto RJ11 de la impresora de tickets al cobrar en efectivo.",
      icon: Layers,
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
      status: "Soportado",
      badgeVariant: "success" as const,
      details: [
        "Conexión física al puerto DK/RJ11 de la ticketera.",
        "Apertura automática al imprimir ventas en efectivo por el bridge USB/Mac (pulso ESC p 0 25 250).",
        "Requiere que el ticket salga por el bridge o una térmica USB local.",
      ],
    },
    {
      title: "Monitores y Pantallas KDS",
      description: "Visualización interactiva para el sistema de pantallas en cocina (Kitchen Display System).",
      icon: Monitor,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
      status: "Soportado",
      badgeVariant: "success" as const,
      details: [
        "Resolución mínima recomendada: Full HD 1080p.",
        "Pantallas táctiles capacitivas recomendadas para mejor flujo.",
        "Actualización en tiempo real vía WebSockets.",
      ],
    },
    {
      title: "Básculas y Balanzas USB",
      description: "Lectura directa del peso en el POS para productos vendidos a granel (en desarrollo).",
      icon: Cpu,
      color: "text-purple-400",
      bg: "bg-purple-500/10 border-purple-500/20",
      status: "Próximamente",
      badgeVariant: "warning" as const,
      details: [
        "Protocolo de transmisión serie emulado vía USB (Web Serial).",
        "Sincronización de peso en tiempo real en la pantalla de cobro.",
        "Compatibilidad con marcas populares (Torrey, CAS) — planificada.",
      ],
    },
  ];

  // Status helpers
  const statusConfig = {
    online: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", dot: "bg-emerald-400", pulse: true, Icon: Zap, label: "En Línea" },
    degraded: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30", dot: "bg-amber-400", pulse: false, Icon: AlertTriangle, label: "Degradado" },
    offline: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", dot: "bg-red-500", pulse: false, Icon: ZapOff, label: "Sin Conexión" },
    checking: { color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/30", dot: "bg-cyan-400", pulse: true, Icon: Activity, label: "Verificando" },
    unknown: { color: "text-gray-400", bg: "bg-white/5 border-white/10", dot: "bg-gray-600", pulse: false, Icon: Signal, label: "No verificado" },
  };
  let effectiveStatus = printerStatus.status;
  let effectiveMessage = printerStatus.message;
  let effectiveName = printerStatus.name;

  if (btConnected && isBluetoothConnected()) {
    effectiveStatus = "online";
    effectiveMessage = "Conectado inalámbricamente a impresora Bluetooth";
    effectiveName = btDeviceName || "Impresora Térmica Bluetooth";
  }

  const sc = statusConfig[effectiveStatus as keyof typeof statusConfig] ?? statusConfig.unknown;
  const StatusIcon = sc.Icon;

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8 pb-10 w-full min-w-0">
      {/* Header Banner — compact on mobile */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-4 sm:p-6 lg:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-pink-400 mb-1">
              <Printer className="h-3.5 w-3.5" /> Hardware & Impresión
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Impresoras y Tickets
            </h1>
            <p className="text-gray-400 mt-1 text-xs sm:text-sm font-medium">
              Diseño en tiempo real con datos fiscales, IVA, exportación PDF/Imagen y WhatsApp.
            </p>
          </div>

          {/* Segmented Tab Controls — wraps on mobile */}
          <div className="flex flex-wrap rounded-2xl bg-white/5 p-1 border border-white/10 gap-1">
            <button
              onClick={() => setActiveTab("ticket")}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex-1 sm:flex-none justify-center ${
                activeTab === "ticket"
                  ? "bg-pink-500 text-white shadow-lg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden xs:inline sm:inline">Configuración &</span> Preview
            </button>
            <button
              onClick={() => setActiveTab("manual")}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex-1 sm:flex-none justify-center ${
                activeTab === "manual"
                  ? "bg-cyan-500 text-gray-950 shadow-lg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5 shrink-0" />
              <span>Manual</span>
            </button>
            <button
              onClick={() => setActiveTab("devices")}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex-1 sm:flex-none justify-center ${
                activeTab === "devices"
                  ? "bg-pink-500 text-white shadow-lg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Printer className="h-3.5 w-3.5 shrink-0" />
              <span>Periféricos</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── PRINTER STATUS PANEL — fully responsive ── */}
      <div className={`rounded-2xl border p-4 sm:p-5 ${sc.bg} transition-all duration-500 w-full min-w-0`}>
        <div className="flex flex-col gap-3">
          {/* Row 1: icon + status text */}
          <div className="flex items-start sm:items-center gap-3">
            <div className={`relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl border ${sc.bg} shrink-0`}>
              <StatusIcon className={`h-4 w-4 sm:h-5 sm:w-5 ${sc.color}`} />
              {sc.pulse && (
                <span className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full ${sc.dot} animate-ping opacity-60`} />
              )}
              <span className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-black ${sc.dot}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className={`text-sm font-black uppercase tracking-wider ${sc.color}`}>{sc.label}</span>
                <span className="text-[10px] text-gray-500 font-mono">
                  {printerStatus.checkedAt
                    ? new Date(printerStatus.checkedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                    : ""}
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-0.5 leading-snug">{effectiveMessage}</p>
              {effectiveName && (
                <p className="text-[10px] text-gray-500 mt-0.5">{effectiveName} {printerStatus.model ? `· ${printerStatus.model}` : ""}</p>
              )}
            </div>
          </div>

          {/* Row 2: capability chips + action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Chips */}
            <div className="flex flex-wrap gap-1.5">
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                printerStatus.usbVisible ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-white/5 border-white/10 text-gray-500"
              }`}>
                <Usb className="h-2.5 w-2.5" /> USB
              </div>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                printerStatus.cupsAccepting ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-white/5 border-white/10 text-gray-500"
              }`}>
                <Printer className="h-2.5 w-2.5" /> CUPS
              </div>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                btConnected ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-white/5 border-white/10 text-gray-500"
              }`}>
                <Bluetooth className="h-2.5 w-2.5" /> BT{btConnected && btDeviceName ? ` ${btDeviceName.substring(0, 8)}` : ""}
              </div>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                printerStatus.bridgeReady ? "bg-purple-500/10 border-purple-500/30 text-purple-400" : "bg-white/5 border-white/10 text-gray-500"
              }`}>
                <Wifi className="h-2.5 w-2.5" /> Bridge
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {btConnected ? (
                <button
                  onClick={handleDisconnectBluetooth}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-300 text-xs font-bold hover:bg-blue-500/30 transition-all cursor-pointer"
                >
                  <BluetoothConnected className="h-3 w-3" /> Desconectar BT
                </button>
              ) : (
                <button
                  onClick={handleConnectBluetooth}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-all cursor-pointer"
                >
                  <Bluetooth className="h-3 w-3" /> Conectar BT
                </button>
              )}
              <button
                onClick={checkPrinterStatus}
                disabled={isCheckingPrinter}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/20 text-gray-300 text-xs font-bold hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isCheckingPrinter ? "animate-spin" : ""}`} />
                {isCheckingPrinter ? "Verificando..." : "Verificar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── PRINTER CONNECTION DIAGNOSTIC REPORT ── */}
      {diag && (
        <div className="rounded-2xl border border-white/5 bg-white/5 backdrop-blur-md p-4 sm:p-5 w-full min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <Terminal className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-black text-white">Reporte de Conexión de Impresora</h2>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-3">
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${diag.secure ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              HTTPS: {diag.secure ? "Sí" : "No"}
            </div>
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${diag.webBluetooth ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-amber-500/10 border-amber-500/30 text-amber-400"}`}>
              <Bluetooth className="h-3.5 w-3.5 shrink-0" />
              Web Bluetooth: {diag.webBluetooth ? "Disponible" : "No disponible"}
            </div>
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${diag.topLevel ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
              <Monitor className="h-3.5 w-3.5 shrink-0" />
              Pestaña principal: {diag.topLevel ? "Sí" : "No (iframe)"}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-gray-300">
              <Cpu className="h-3.5 w-3.5 shrink-0 text-pink-400" />
              {diag.browser} · {diag.os}
            </div>
          </div>

          <div className={`rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${
            diag.status === "OK" || diag.status === "BLE_ONLY"
              ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-100"
              : "bg-amber-500/10 border-amber-500/30 text-amber-100"
          }`}>
            <span className="font-black uppercase tracking-wider text-[10px] opacity-70">Recomendación: </span>
            {diag.recommendation}
          </div>
          <p className="mt-2 text-[10px] text-gray-500 font-mono truncate">{diag.userAgent}</p>
        </div>
      )}

      {/* ── TAB 1: TICKET CONFIGURATION & LIVE PREVIEW ── */}
      {activeTab === "ticket" && (
        <div className="w-full min-w-0 space-y-4 sm:space-y-6">
          {/* Single-column full-width form */}
          <Card className="p-4 sm:p-6 lg:p-8 border border-white/5 bg-white/5 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-white">Datos Comerciales y Fiscales del Ticket</h2>
                  <p className="text-xs text-gray-400">Configura aquí y abre la previsualización para ver el resultado en tiempo real.</p>
                </div>
              </div>
              {/* Preview trigger button — prominent */}
              <button
                type="button"
                onClick={() => setPreviewModal(true)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 hover:border-cyan-400/60 text-cyan-300 font-bold text-xs transition-all hover:scale-105 cursor-pointer shrink-0 group"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <Eye className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Previsualizar</span>
              </button>
            </div>

            <form onSubmit={handleSaveTicket} className="space-y-5">
              {/* Tenant / Business Selector */}
              {restaurants && restaurants.length > 1 && (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-pink-400 block">
                      Negocio / Tenant Activo
                    </label>
                    <p className="text-xs text-gray-400">Selecciona el negocio para configurar su ticketera e identidad</p>
                  </div>
                  <select
                    value={selectedRestaurantId}
                    onChange={(e) => setSelectedRestaurantId(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-black/60 border border-white/20 text-white text-xs font-bold focus:outline-none focus:border-pink-500"
                  >
                    {restaurants.map((r) => (
                      <option key={r.id} value={r.id} className="bg-gray-900 text-white">
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Input
                  label="Nombre Comercial del Negocio *"
                  placeholder="Ej. Rabbitty Bistro"
                  value={ticketForm.name}
                  onChange={(e) => setTicketForm({ ...ticketForm, name: e.target.value })}
                  required
                />
                <Input
                  label="Razón Social del Negocio *"
                  placeholder="Ej. OPERADORA GASTRONOMICA SA DE CV"
                  value={ticketForm.legalName}
                  onChange={(e) => setTicketForm({ ...ticketForm, legalName: e.target.value })}
                />
                <Input
                  label="RFC del Negocio *"
                  placeholder="Ej. OGR210815XYZ"
                  value={ticketForm.rfc}
                  onChange={(e) => setTicketForm({ ...ticketForm, rfc: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Régimen Fiscal (SAT / Hacienda)"
                  placeholder="Selecciona un régimen"
                  value={ticketForm.taxRegime}
                  onChange={(e) => setTicketForm({ ...ticketForm, taxRegime: e.target.value })}
                  options={[
                    { value: "601 - General de Ley Personas Morales", label: "601 - General de Ley Personas Morales" },
                    { value: "603 - Personas Morales con Fines no Lucrativos", label: "603 - Personas Morales con Fines no Lucrativos" },
                    { value: "605 - Sueldos y Salarios", label: "605 - Sueldos y Salarios" },
                    { value: "606 - Arrendamiento", label: "606 - Arrendamiento" },
                    { value: "608 - Demás ingresos", label: "608 - Demás ingresos" },
                    { value: "611 - Ingresos por Dividendos", label: "611 - Ingresos por Dividendos" },
                    { value: "612 - Personas Físicas con Actividades Empresariales y Profesionales", label: "612 - PF Actividades Empresariales y Profesionales" },
                    { value: "614 - Ingresos por intereses", label: "614 - Ingresos por intereses" },
                    { value: "615 - Ingresos por obtención de premios", label: "615 - Obtención de premios" },
                    { value: "616 - Sin obligaciones fiscales", label: "616 - Sin obligaciones fiscales" },
                    { value: "620 - Sociedades Cooperativas de Producción", label: "620 - Sociedades Cooperativas de Producción" },
                    { value: "621 - Incorporación Fiscal", label: "621 - Incorporación Fiscal" },
                    { value: "622 - Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras", label: "622 - Agrícolas, Ganaderas, Silvícolas y Pesqueras" },
                    { value: "623 - Opcional para Grupos de Sociedades", label: "623 - Opcional para Grupos de Sociedades" },
                    { value: "624 - Coordinados", label: "624 - Coordinados" },
                    { value: "625 - Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas", label: "625 - Plataformas Tecnológicas" },
                    { value: "626 - Régimen Simplificado de Confianza (RESICO)", label: "626 - Régimen Simplificado de Confianza (RESICO)" },
                  ]}
                />
                <Input
                  label="Dirección Física de la Sucursal"
                  placeholder="Calle, Número, Colonia, Ciudad, C.P."
                  value={ticketForm.address}
                  onChange={(e) => setTicketForm({ ...ticketForm, address: e.target.value })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Input
                  label="Teléfono de Contacto"
                  placeholder="Ej. 55 1234 5678"
                  value={ticketForm.phone}
                  onChange={(e) => setTicketForm({ ...ticketForm, phone: e.target.value })}
                />
                <Input
                  label="Email de Contacto"
                  type="email"
                  placeholder="contacto@turestaurante.com"
                  value={ticketForm.email}
                  onChange={(e) => setTicketForm({ ...ticketForm, email: e.target.value })}
                />
                <Input
                  label="Pie de Ticket / Agradecimiento"
                  placeholder="Ej. ¡Gracias por su preferencia!"
                  value={ticketForm.ticketFooter}
                  onChange={(e) => setTicketForm({ ...ticketForm, ticketFooter: e.target.value })}
                />
              </div>

              {/* Logo + Printer type row */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Logo Upload */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">
                    Logo del Negocio
                  </label>
                  <div className="flex items-center gap-3">
                    {ticketForm.logoUrl ? (
                      <div className="relative h-12 w-12 rounded-xl overflow-hidden border border-white/20 bg-white/5 p-1 shrink-0 flex items-center justify-center group">
                        <img
                          src={ticketForm.logoUrl}
                          alt="Logo preview"
                          className="max-h-full max-w-full object-contain rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => setTicketForm({ ...ticketForm, logoUrl: "" })}
                          className="absolute inset-0 bg-black/70 flex items-center justify-center text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="h-12 w-12 rounded-xl border border-dashed border-white/20 bg-white/5 flex items-center justify-center shrink-0 text-cyan-400 font-bold text-lg">
                        🐰
                      </div>
                    )}
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex gap-2">
                        <label className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-bold text-white cursor-pointer transition-all shrink-0">
                          <Upload className="h-3.5 w-3.5 text-pink-400" />
                          <span>Subir</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 2 * 1024 * 1024) { toast.error("La imagen no debe superar los 2MB"); return; }
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  setTicketForm((prev) => ({ ...prev, logoUrl: ev.target?.result as string }));
                                  toast.success("Logo cargado");
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                        <input
                          type="text"
                          placeholder="O pega URL (https://...)"
                          value={ticketForm.logoUrl.startsWith("data:") ? "Logo local" : ticketForm.logoUrl}
                          onChange={(e) => setTicketForm({ ...ticketForm, logoUrl: e.target.value })}
                          className="flex-1 min-w-0 rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-pink-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Printer type */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">
                    Conexión & Ancho de Papel
                  </label>
                  <select
                    value={ticketForm.printerType}
                    onChange={(e) => setTicketForm({ ...ticketForm, printerType: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-black/60 p-3 text-sm text-white focus:border-pink-500 outline-none"
                  >
                    <option value="RABBITTY_POS_PRINTER">🐰 Rabbitty POS Printer (USB / Mac Bridge)</option>
                    <option value="BLUETOOTH_58mm">🔵 Bluetooth BLE 58mm (Web Bluetooth)</option>
                    <option value="BLUETOOTH_80mm">🔵 Bluetooth BLE 80mm (Web Bluetooth)</option>
                    <option value="ESC/POS 58mm">🔌 USB ESC/POS 58mm (bridge / navegador)</option>
                    <option value="ESC/POS 80mm">🔌 USB ESC/POS 80mm (bridge / navegador)</option>
                  </select>
                </div>
              </div>

              {/* Submit + share bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/5">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={handleExportPDF} className="flex items-center gap-1.5 border-white/10 hover:border-white/30">
                    <FileDown className="h-3.5 w-3.5 text-pink-400" /> PDF
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handleExportImage} disabled={isExporting} className="flex items-center gap-1.5 border-white/10 hover:border-white/30">
                    <ImageIcon className="h-3.5 w-3.5 text-cyan-400" /> {isExporting ? "..." : "Imagen"}
                  </Button>
                  <Button size="sm" onClick={handleShareWhatsApp} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="hidden sm:inline">Conectado con Rabbitty OS & SAT</span>
                  </div>
                  <Button
                    type="submit"
                    disabled={updateRestaurant.isPending}
                    className="bg-pink-500 hover:bg-pink-600 text-white font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    {updateRestaurant.isPending ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ══ PREVIEW MODAL ══ */}
      {previewModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewModal(false); }}
        >
          <div
            className="relative w-full max-w-sm sm:max-w-md flex flex-col rounded-2xl sm:rounded-3xl border border-white/10 bg-gray-950/98 backdrop-blur-2xl shadow-2xl overflow-hidden"
            style={{ maxHeight: "calc(100dvh - 1.5rem)" }}
          >
            {/* ── Header: título + toggle dark/paper + cerrar ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee] shrink-0" />
                <span className="font-bold text-white text-sm shrink-0">Preview</span>
                <span className="text-[10px] text-gray-500 font-mono truncate">{ticketForm.name || "Tu Negocio"}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <button
                  type="button"
                  onClick={() => setThermalPaperMode(!thermalPaperMode)}
                  className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                    thermalPaperMode ? "bg-white text-black border-white" : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                  }`}
                >
                  {thermalPaperMode ? "☀️ Papel" : "🌑 Dark"}
                </button>
                <button
                  onClick={() => setPreviewModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer shrink-0"
                  aria-label="Cerrar previsualización"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* ── Solo acciones de impresión — exportar está en la tarjeta de datos ── */}
            <div className="flex gap-2 px-4 py-2.5 border-b border-white/5 shrink-0">
              <button
                onClick={handlePrintWelcome}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-pink-500/10 border border-pink-500/30 text-pink-400 text-[11px] font-bold hover:bg-pink-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Sparkles className="h-3 w-3 shrink-0" />
                <span>Ticket Bienvenida</span>
              </button>
              <button
                onClick={handlePrintTest}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold hover:bg-cyan-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Printer className="h-3 w-3 shrink-0" />
                <span>Imprimir Prueba</span>
              </button>
            </div>

            {/* ── Ticket preview — scrollable ── */}
            <div className="flex-1 overflow-y-auto overscroll-contain flex justify-center px-3 py-4 bg-gradient-to-b from-gray-900/40 to-black/60 min-h-0">
              <div className="w-full max-w-full flex justify-center transform scale-90 sm:scale-75 md:scale-100 origin-top transition-transform">
                <TicketTemplate
                  data={previewTicketData}
                  isThermalPaper={thermalPaperMode}
                  paperWidth={ticketForm.printerType.includes("58mm") ? "58mm" : "80mm"}
                />
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ── TAB 2: MANUAL DE CONEXIÓN INTERACTIVO (MINI-LANDING / PDF) ── */}
      {activeTab === "manual" && (
        <HardwareConnectionGuide />
      )}

      {/* ── TAB 3: PERIPHERALS & HARDWARE GUIDES ── */}
      {activeTab === "devices" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Device Cards */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-pink-500" />
              Dispositivos Compatibles
            </h2>
            <div className="grid gap-4">
              {devices.map((dev) => {
                const Icon = dev.icon;
                return (
                  <Card key={dev.title} className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
                    <div className="flex items-start gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border shrink-0 ${dev.bg} ${dev.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-bold text-white text-base">{dev.title}</h3>
                          <Badge variant={dev.badgeVariant}>{dev.status}</Badge>
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed">{dev.description}</p>
                        <ul className="space-y-1.5 text-xs text-gray-500">
                          {dev.details.map((detail, index) => (
                            <li key={index} className="flex items-center gap-2">
                              <CheckCircle className="h-3 w-3 text-pink-500/50 shrink-0" />
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Integration Client & Manual Section */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-pink-500" />
              Controladores y Utilidades
            </h2>

            <div className="grid gap-6">
              {/* Print Client Card */}
              <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md relative overflow-hidden">
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-pink-500/10 blur-2xl pointer-events-none" />
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
                      <Terminal className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">Rabbitty Print Agent</h3>
                      <p className="text-xs text-gray-400">Servicio local para impresión silenciosa</p>
                      <Badge variant="warning" className="mt-1.5 text-[10px]">Próximamente</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    En desarrollo. Conectará la Mac/Windows de caja con impresoras USB y de Red (RAW 9100) para imprimir sin el diálogo del navegador. Mientras tanto, el <strong>bridge USB/Mac</strong> ya imprime directo por USB y Web Bluetooth cubre impresoras BLE.
                  </p>
                  <div className="pt-2 flex flex-wrap gap-2.5">
                    <Button variant="secondary" size="sm" onClick={() => handleDownload("macOS")}>
                      <Download className="h-4 w-4" />
                      macOS (Apple Silicon)
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => handleDownload("Windows")}>
                      <Download className="h-4 w-4" />
                      Windows (x64)
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Quick Guide Card */}
              <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">Guía de Conexión Térmica & Bluetooth</h3>
                      <p className="text-xs text-gray-400">Puesta en marcha en 3 pasos</p>
                    </div>
                  </div>
                  <div className="space-y-3 pt-2 text-sm text-gray-400">
                    <div className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 font-bold text-xs text-cyan-400">1</span>
                      <p><strong>Son dos Bluetooth distintas:</strong> Web Bluetooth (botón <em>Conectar BT</em>) solo ve impresoras <strong>BLE</strong>. Las Classic/SPP (POS-58, MTP-II, YICHIP) jamás aparecen — para esas usa USB/Wi-Fi o el bridge.</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 font-bold text-xs text-cyan-400">2</span>
                      <p><strong>Configura el papel en Rabbitty:</strong> Selecciona en la pestaña <em>Configuración &amp; Preview</em> si es de <strong>80mm</strong> o <strong>58mm (portátil)</strong>.</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 font-bold text-xs text-cyan-400">3</span>
                      <p><strong>Prueba física:</strong> Si es BLE, presiona <strong>Conectar BT</strong> y elige la impresora. Si no aparece, es Classic → conecta por USB a la Mac de caja y usa <strong>Rabbitty POS Printer (USB / Mac Bridge)</strong>; en el diálogo elige márgenes "Ninguno" y sin encabezados.</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE VISTA COMPLETA (FULLSCREEN PREVIEW) ── */}
      <Dialog
        open={fullscreenModal}
        onClose={() => setFullscreenModal(false)}
        title="Vista Completa del Ticket de Venta"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-300 font-medium">Estilo de render:</span>
              <button
                type="button"
                onClick={() => setThermalPaperMode(!thermalPaperMode)}
                className={`text-xs font-bold px-3 py-1 rounded-xl border transition-all cursor-pointer ${
                  thermalPaperMode ? "bg-white text-black" : "bg-white/10 text-white"
                }`}
              >
                {thermalPaperMode ? "Papel Térmico Blanco (80mm)" : "Identidad Rabbitty (Dark Glass)"}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={handleExportPDF}>
                <FileDown className="h-3.5 w-3.5" /> PDF
              </Button>
              <Button size="sm" variant="secondary" onClick={handleExportImage} disabled={isExporting}>
                <ImageIcon className="h-3.5 w-3.5" /> Imagen
              </Button>
              <Button size="sm" onClick={handleShareWhatsApp} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </Button>
            </div>
          </div>

          <div className="flex justify-center max-h-[65vh] overflow-y-auto custom-scrollbar p-6 bg-black/60 rounded-3xl border border-white/5">
            <TicketTemplate 
              data={previewTicketData} 
              isThermalPaper={thermalPaperMode} 
              paperWidth={ticketForm.printerType.includes("58mm") ? "58mm" : "80mm"}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <Button variant="secondary" onClick={() => setFullscreenModal(false)}>
              Cerrar
            </Button>
            <Button onClick={handlePrintTest} className="bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-bold flex items-center gap-1.5">
              <Printer className="h-4 w-4" /> Imprimir Físico
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
