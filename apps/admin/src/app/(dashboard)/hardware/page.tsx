"use client";

import { useState, useEffect } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Badge, Button, Input, toast } from "@rabbitty/ui";
import { 
  Printer, Monitor, Layers, Cpu, Download, BookOpen, Terminal, 
  CheckCircle, FileText, Sparkles, Building2, Phone, Mail, 
  MapPin, ShieldCheck, Save, RefreshCw, Eye
} from "lucide-react";
import { TicketTemplate, TicketData } from "../../../components/TicketTemplate";

export default function HardwarePage() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"ticket" | "devices" | "agent">("ticket");

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

  // Preview Mock Data
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
              Diseño de ticket de venta con datos fiscales, desglose de IVA y controladores térmicos.
            </p>
          </div>

          {/* Segmented Tab Controls */}
          <div className="flex rounded-2xl bg-white/5 p-1 border border-white/10 shrink-0">
            <button
              onClick={() => setActiveTab("ticket")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "ticket"
                  ? "bg-pink-500 text-white shadow-lg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <FileText className="h-4 w-4" /> Configuración de Ticket
            </button>
            <button
              onClick={() => setActiveTab("devices")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
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
                    <p className="text-xs text-gray-400">Esta información se imprimirá en el encabezado de cada comprobante.</p>
                  </div>
                </div>
                <Badge variant="success">En Línea</Badge>
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

                  <Input
                    label="Logo URL (opcional)"
                    placeholder="https://tudominio.com/logo.png"
                    value={ticketForm.logoUrl}
                    onChange={(e) => setTicketForm({ ...ticketForm, logoUrl: e.target.value })}
                  />
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
                    className="bg-pink-500 hover:bg-pink-600 text-white font-bold flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {updateRestaurant.isPending ? "Guardando..." : "Guardar Cambios"}
                  </Button>
                </div>
              </form>
            </Card>

            {/* Print Help Box */}
            <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs flex items-center gap-3">
              <Sparkles className="h-5 w-5 shrink-0 text-cyan-400" />
              <span>
                <strong>Tip de Producción:</strong> Una vez conectado el cable USB o Ethernet de tu impresora térmica, la configuración de arriba se sincroniza automáticamente con el POS y la impresión directa.
              </span>
            </div>
          </div>

          {/* Right: Live Ticket Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
                <h3 className="font-bold text-white text-base">Previsualización en Vivo</h3>
              </div>

              <Button
                size="sm"
                variant="secondary"
                onClick={handlePrintTest}
                className="flex items-center gap-1.5 border-white/20 hover:border-white/40"
              >
                <Printer className="h-4 w-4 text-pink-400" /> Imprimir Ticket de Prueba
              </Button>
            </div>

            <p className="text-xs text-gray-400">
              Así es como aparecerá el comprobante al salir de la impresora térmica conectada al negocio:
            </p>

            {/* Ticket Canvas Wrapper */}
            <div className="flex justify-center p-4 rounded-3xl bg-black/40 border border-white/5 shadow-2xl backdrop-blur-md">
              <TicketTemplate data={previewTicketData} />
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
    </div>
  );
}
