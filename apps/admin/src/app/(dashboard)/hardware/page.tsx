"use client";

import { useState, useEffect, useRef } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Badge, Button, Input, Dialog, toast } from "@rabbitty/ui";
import { 
  Printer, Monitor, Layers, Cpu, Download, BookOpen, Terminal, 
  CheckCircle, FileText, Sparkles, Building2, Phone, Mail, 
  MapPin, ShieldCheck, Save, RefreshCw, Eye, Share2, MessageCircle, 
  FileDown, Image as ImageIcon, ExternalLink, Maximize2, Upload, X
} from "lucide-react";
import { TicketTemplate, TicketData } from "../../../components/TicketTemplate";

export default function HardwarePage() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"ticket" | "devices" | "agent">("ticket");
  const [fullscreenModal, setFullscreenModal] = useState(false);
  const [thermalPaperMode, setThermalPaperMode] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch restaurant & branch data
  const { data: restaurants, isLoading: loadingRest } = trpc.admin.getRestaurants.useQuery();
  const { data: ticketContext, isLoading: loadingTicket } = trpc.printing.getTicketData.useQuery(undefined);
  
  const currentRestaurant = restaurants?.[0] || ticketContext?.restaurant;
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
    printerType: "ESC/POS 80mm",
  });

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
        printerType: currentRestaurant.printerType || "ESC/POS 80mm",
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
      ticketFooter: ticketForm.ticketFooter,
      printerType: ticketForm.printerType,
    });
  };

  const handleDownload = (os: string) => {
    toast.success(`Descarga iniciada para ${os}`);
  };

  const handlePrintTest = () => {
    window.print();
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
      `🐰 _Emitido con Rabbitty OS POS • rabbitty.app_`;

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
      description: "Apertura automática mediante pulsos del puerto RJ11 de la impresora de tickets.",
      icon: Layers,
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
      status: "Soportado",
      badgeVariant: "success" as const,
      details: [
        "Conexión física al puerto RJ11 de la ticketera.",
        "Apertura automática configurable al registrar ventas en efectivo.",
        "Apertura manual por PIN de seguridad del cajero.",
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
      description: "Lectura directa del peso en el POS para productos vendidos a granel (fase beta).",
      icon: Cpu,
      color: "text-purple-400",
      bg: "bg-purple-500/10 border-purple-500/20",
      status: "Beta",
      badgeVariant: "warning" as const,
      details: [
        "Protocolo de transmisión serie emulado vía USB.",
        "Sincronización de peso en tiempo real en la pantalla de cobro.",
        "Compatibilidad con marcas populares (Torrey, CAS).",
      ],
    },
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-pink-400 mb-1">
              <Printer className="h-4 w-4" /> Hardware & Impresión
            </div>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Impresoras y Tickets
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium">
              Diseño en tiempo real con datos fiscales, desglose de IVA, exportación PDF/Imagen y envío por WhatsApp.
            </p>
          </div>

          {/* Segmented Tab Controls */}
          <div className="flex rounded-2xl bg-white/5 p-1 border border-white/10 shrink-0">
            <button
              onClick={() => setActiveTab("ticket")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "ticket"
                  ? "bg-pink-500 text-white shadow-lg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <FileText className="h-4 w-4" /> Configuración & Preview en Vivo
            </button>
            <button
              onClick={() => setActiveTab("devices")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "devices"
                  ? "bg-pink-500 text-white shadow-lg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Printer className="h-4 w-4" /> Periféricos & Driver
            </button>
          </div>
        </div>
      </div>

      {/* ── TAB 1: TICKET CONFIGURATION & LIVE PREVIEW ── */}
      {activeTab === "ticket" && (
        <div className="grid gap-8 lg:grid-cols-12 items-start">
          {/* Left Form: Fiscal, Contact & Header Data */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="p-6 md:p-8 border border-white/5 bg-white/5 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Datos Comerciales y Fiscales del Ticket</h2>
                    <p className="text-xs text-gray-400">Escribe y observa cómo se refleja cada campo al instante en el ticket.</p>
                  </div>
                </div>
                <Badge variant="success">En Vivo</Badge>
              </div>

              <form onSubmit={handleSaveTicket} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Nombre Comercial del Negocio *"
                    placeholder="Ej. Rabbitty Bistro"
                    value={ticketForm.name}
                    onChange={(e) => setTicketForm({ ...ticketForm, name: e.target.value })}
                    required
                  />

                  {/* Logo Upload / URL component */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1">
                      Logo del Negocio (Reemplaza el logo Rabbitty)
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
                            title="Quitar logo y restaurar Rabbitty"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="h-12 w-12 rounded-xl border border-dashed border-white/20 bg-white/5 flex items-center justify-center shrink-0 text-cyan-400 font-bold text-lg">
                          🐰
                        </div>
                      )}

                      <div className="flex-1 space-y-1.5">
                        <div className="flex gap-2">
                          <label className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-bold text-white cursor-pointer transition-all">
                            <Upload className="h-3.5 w-3.5 text-pink-400" />
                            <span>Subir Logo</span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/svg+xml"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  if (file.size > 2 * 1024 * 1024) {
                                    toast.error("La imagen no debe superar los 2MB");
                                    return;
                                  }
                                  const reader = new FileReader();
                                  reader.onload = (ev) => {
                                    const base64 = ev.target?.result as string;
                                    setTicketForm((prev) => ({ ...prev, logoUrl: base64 }));
                                    toast.success("Logo cargado y previsualizado en el ticket");
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>

                          <input
                            type="text"
                            placeholder="O pega URL (https://...)"
                            value={ticketForm.logoUrl.startsWith("data:") ? "Logo cargado localmente" : ticketForm.logoUrl}
                            onChange={(e) => setTicketForm({ ...ticketForm, logoUrl: e.target.value })}
                            className="flex-1 rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-pink-500 outline-none"
                          />
                        </div>
                        <p className="text-[10px] text-gray-500">
                          {ticketForm.logoUrl ? "Logo activo. Reemplaza el ícono de Rabbitty en el encabezado." : "Sube tu PNG, JPG o SVG. Al agregarlo, sustituirá el ícono de Rabbitty."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
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

                <Input
                  label="Régimen Fiscal (SAT / Hacienda)"
                  placeholder="Ej. 601 - General de Ley Personas Morales / 626 - RESICO"
                  value={ticketForm.taxRegime}
                  onChange={(e) => setTicketForm({ ...ticketForm, taxRegime: e.target.value })}
                />

                <Input
                  label="Dirección Física de la Sucursal"
                  placeholder="Calle, Número, Colonia, Ciudad, C.P."
                  value={ticketForm.address}
                  onChange={(e) => setTicketForm({ ...ticketForm, address: e.target.value })}
                />

                <div className="grid gap-4 sm:grid-cols-2">
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
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">
                      Ancho / Tipo de Impresora
                    </label>
                    <select
                      value={ticketForm.printerType}
                      onChange={(e) => setTicketForm({ ...ticketForm, printerType: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-black/60 p-3 text-sm text-white focus:border-pink-500 outline-none"
                    >
                      <option value="ESC/POS 80mm">ESC/POS Térmica 80mm (Recomendado)</option>
                      <option value="ESC/POS 58mm">ESC/POS Térmica 58mm</option>
                      <option value="NETWORK_RAW">Impresora de Red / Ethernet (Socket RAW 9100)</option>
                      <option value="GENERIC_TEXT">Genérico / Solo Texto</option>
                    </select>
                  </div>

                  <Input
                    label="Pie de Ticket / Agradecimiento"
                    placeholder="Ej. ¡Gracias por su preferencia!"
                    value={ticketForm.ticketFooter}
                    onChange={(e) => setTicketForm({ ...ticketForm, ticketFooter: e.target.value })}
                  />
                </div>

                {/* Submit button bar */}
                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    <span>Conectado con Rabbitty OS Core & SAT</span>
                  </div>

                  <Button
                    type="submit"
                    disabled={updateRestaurant.isPending}
                    className="bg-pink-500 hover:bg-pink-600 text-white font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    {updateRestaurant.isPending ? "Guardando..." : "Guardar Cambios"}
                  </Button>
                </div>
              </form>
            </Card>

            {/* Quick Actions Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-cyan-500/10 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-pink-400" /> Opciones de Compartir y Descargar
                </h4>
                <Badge variant="success">Listo para Producción</Badge>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Puedes descargar este ticket como ejemplo visual para tu negocio, enviárselo a tus clientes por WhatsApp o descargarlo en PDF e imagen de alta resolución.
              </p>
              <div className="flex flex-wrap gap-2.5 pt-1">
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 border-white/10 hover:border-white/30"
                >
                  <FileDown className="h-4 w-4 text-pink-400" /> Descargar PDF
                </Button>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={handleExportImage}
                  disabled={isExporting}
                  className="flex items-center gap-1.5 border-white/10 hover:border-white/30"
                >
                  <ImageIcon className="h-4 w-4 text-cyan-400" /> {isExporting ? "Generando..." : "Descargar Imagen"}
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleShareWhatsApp}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
                </Button>
              </div>
            </div>
          </div>

          {/* Right: Live Interactive Ticket Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
                <h3 className="font-bold text-white text-base">Previsualización en Vivo</h3>
              </div>

              {/* View Switchers & Fullscreen */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setThermalPaperMode(!thermalPaperMode)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    thermalPaperMode 
                      ? "bg-white text-black border-white" 
                      : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                  }`}
                  title="Cambiar entre modo oscuro Rabbitty y papel térmico blanco"
                >
                  {thermalPaperMode ? "Papel Térmico" : "Modo Oscuro"}
                </button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setFullscreenModal(true)}
                  className="flex items-center gap-1 border-white/20 hover:border-white/40"
                  title="Abrir vista completa"
                >
                  <Maximize2 className="h-3.5 w-3.5 text-cyan-400" />
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handlePrintTest}
                  className="flex items-center gap-1.5 border-white/20 hover:border-white/40"
                >
                  <Printer className="h-4 w-4 text-pink-400" /> Imprimir
                </Button>
              </div>
            </div>

            <p className="text-xs text-gray-400">
              Conforme vas llenando el formulario, este ticket se actualiza en tiempo real:
            </p>

            {/* Ticket Canvas Wrapper with shadow and glass aesthetic */}
            <div className="flex justify-center p-6 rounded-3xl bg-gradient-to-b from-gray-900/60 to-black/90 border border-white/10 shadow-2xl backdrop-blur-2xl relative group">
              <div className="transition-all duration-300 transform group-hover:scale-[1.01]">
                <TicketTemplate data={previewTicketData} isThermalPaper={thermalPaperMode} />
              </div>
            </div>

            {/* Footer Action Bar */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleExportPDF}
                className="flex items-center justify-center gap-1 text-xs"
              >
                <FileDown className="h-3.5 w-3.5 text-pink-400" /> PDF
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleExportImage}
                disabled={isExporting}
                className="flex items-center justify-center gap-1 text-xs"
              >
                <ImageIcon className="h-3.5 w-3.5 text-cyan-400" /> Imagen
              </Button>
              <Button
                size="sm"
                onClick={handleShareWhatsApp}
                className="flex items-center justify-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: PERIPHERALS & HARDWARE GUIDES ── */}
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
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Esta pequeña aplicación se instala en la máquina local de caja para comunicarse directamente con las impresoras USB/Red sin abrir el cuadro de diálogo del navegador web.
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
                      <h3 className="font-bold text-white">Guía de Conexión</h3>
                      <p className="text-xs text-gray-400">Puesta en marcha en 3 pasos</p>
                    </div>
                  </div>
                  <div className="space-y-3 pt-2 text-sm text-gray-400">
                    <div className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 font-bold text-xs text-white">1</span>
                      <p>Conecta la impresora térmica por USB o Red y enciéndela.</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 font-bold text-xs text-white">2</span>
                      <p>Configura los datos fiscales en la pestaña <strong>Configuración de Ticket</strong>.</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 font-bold text-xs text-white">3</span>
                      <p>Haz clic en <strong>Imprimir Ticket de Prueba</strong> para verificar márgenes y corte automático.</p>
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
            <TicketTemplate data={previewTicketData} isThermalPaper={thermalPaperMode} />
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
