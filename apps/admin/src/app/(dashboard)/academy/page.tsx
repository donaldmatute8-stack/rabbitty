"use client";

import { useState } from "react";
import { Card } from "@rabbitty/ui";
import { BookOpen, ChevronRight, Building2, DollarSign, Monitor, Store, Award, Megaphone, Cake, QrCode, Gift, Store as StoreIcon, Salad, Truck, Receipt as ReceiptIcon, Clock, Users } from "lucide-react";

type GuideRole = "all" | "admin" | "pos" | "marketing";

interface Guide {
  id: string;
  icon: any;
  label: string;
  desc: string;
  role: GuideRole;
  content: string;
}

const guides: Guide[] = [
  {
    id: "catering",
    icon: Building2,
    label: "Eventos & Catering",
    desc: "Gestión de eventos, menús personalizados y contratos de catering",
    role: "admin",
    content: `## Gestión de Eventos y Catering\n\nLa página de Eventos & Catering permite gestionar eventos especiales con menús personalizados.\n\n### Funcionalidades:\n- **Crear evento**: Define nombre, fecha, número de personas y detalles del menú\n- **Menú personalizado**: Campo menuDetails (JSON) para personalizar el menú por evento\n- **Depósitos**: Tracking de depósitos y montos totales\n- **Estados**: PENDING → CONFIRMED → DEPOSIT_PAID → COMPLETED → CANCELLED\n\n### Ubicación:\nMenú lateral → Eventos`,
  },
  {
    id: "dynamic-pricing",
    icon: DollarSign,
    label: "Precios Dinámicos",
    desc: "Configura reglas de precios inteligentes por hora, día y demanda",
    role: "admin",
    content: `## Precios Dinámicos IA\n\nEl sistema de precios dinámicos permite ajustar automáticamente los precios según reglas configurables.\n\n### Tipos de Reglas:\n- **Porcentaje**: Ajusta el precio un X% arriba o abajo\n- **Monto fijo**: Suma o resta un monto específico\n\n### Configuración:\n- Día de la semana (opcional)\n- Rango de horas\n- Prioridad (las reglas con mayor prioridad se aplican primero)\n- Precios mínimos y máximos como caps de seguridad\n\n### Ubicación:\nMenú lateral → Precios Dinámicos`,
  },
  {
    id: "menu-boards",
    icon: Monitor,
    label: "Menú Digital TV",
    desc: "Configura pantallas digitales con el menú actualizado en tiempo real",
    role: "admin",
    content: `## Menú Digital TV\n\nConvierte cualquier pantalla HDMI en un menú digital actualizado en tiempo real.\n\n### Cómo funciona:\n1. El menú se actualiza automáticamente cuando editas platillos\n2. La pantalla TV se conecta a una URL exclusiva por sucursal\n3. Sin caché — los cambios se reflejan al instante\n\n### URLs:\n- Vista TV: \`/menu-board/[branchId]\`\n- API JSON: \`/api/menu-board/[branchId]\`\n\n### Ubicación:\nMenú lateral → Menú Digital`,
  },
  {
    id: "multi-store",
    icon: Store,
    label: "Dashboard Multi-Sucursal",
    desc: "Gestiona todas tus sucursales desde un solo panel",
    role: "admin",
    content: `## Dashboard Multi-Sucursal\n\nEl dashboard unificado muestra KPIs de todas las sucursales en una sola vista.\n\n### Características:\n- Selector de sucursal en el header del admin\n- KPIs agregados: órdenes totales, ingresos totales, clientes únicos\n- Desglose por sucursal con métricas individuales\n- Contexto global (BranchContext) disponible en todas las páginas\n\n### Cómo usar:\n1. Usa el selector en la esquina superior derecha\n2. Selecciona "Todas las sucursales" para ver datos consolidados\n3. Selecciona una sucursal específica para ver sus datos`,
  },
  {
    id: "pos-basics",
    icon: StoreIcon,
    label: "POS Básico",
    desc: "Guía rápida del punto de venta: mesas, órdenes y cobro",
    role: "pos",
    content: `## POS Básico\n\nEl punto de venta es el corazón operativo de Rabbitty.\n\n### Funciones principales:\n- **Seleccionar mesa**: Toca una mesa en el mapa para iniciar orden\n- **Agregar platillos**: Navega por categorías y selecciona productos\n- **Modificadores**: Tamaños, ingredientes extras, instrucciones especiales\n- **Cobrar**: Efectivo, tarjeta o Bunz\n\n### Atajos:\n- Barra espaciadora para buscar platillos\n- Click derecho en mesa para ver detalle\n- Doble click en producto para agregar rápido`,
  },
  {
    id: "inventory",
    icon: Salad,
    label: "Inventario y Recetas",
    desc: "Gestiona ingredientes, recetas y calcula costos reales",
    role: "admin",
    content: `## Inventario y Recetas\n\nControla tu inventario y calcula el costo real de cada platillo.\n\n### Gestión de Inventario:\n- Crea ingredientes con unidad de medida y precio unitario\n- Recibe alertas de stock bajo automáticamente\n- Historial de movimientos (entradas/salidas)\n\n### Recetas:\n- Vincula ingredientes a platillos con cantidad requerida\n- Costeo automático: el sistema calcula el margen de ganancia\n- Actualización de costos al recibir compras`,
  },
  {
    id: "suppliers",
    icon: Truck,
    label: "Proveedores y Compras",
    desc: "Gestiona proveedores y crea órdenes de compra",
    role: "admin",
    content: `## Proveedores y Compras\n\nAdministra tus proveedores y automatiza las órdenes de compra.\n\n### Proveedores:\n- Registra nombre, contacto, teléfono y email\n- Historial de órdenes por proveedor\n\n### Órdenes de Compra:\n- Crea órdenes seleccionando ítems del inventario\n- Al recibir, el inventario se actualiza automáticamente\n- Estados: PENDING → ORDERED → RECEIVED`,
  },
  {
    id: "expenses",
    icon: ReceiptIcon,
    label: "Gastos y P&L",
    desc: "Registra gastos y visualiza el estado de resultados",
    role: "admin",
    content: `## Gastos y Rentabilidad\n\nLleva el control financiero de tu negocio.\n\n### Gestión de Gastos:\n- Categorías: renta, nómina, insumos, servicios, marketing\n- Registro con descripción, monto, fecha y comprobante\n\n### P&L (Estado de Resultados):\n- Ingresos totales del período\n- Gastos por categoría\n- Utilidad neta y margen de ganancia\n- Filtro por rango de fechas`,
  },
  {
    id: "staff-shifts",
    icon: Clock,
    label: "Control de Turnos",
    desc: "Registra entrada/salida del personal",
    role: "pos",
    content: `## Control de Turnos\n\nReloj checador digital integrado al POS.\n\n### Cómo funciona:\n1. El staff hace clock-in al iniciar su turno\n2. Clock-out automático al cerrar\n3. Vista de turnos activos en tiempo real\n\n### Reportes:\n- Horas trabajadas por empleado\n- Historial de turnos con filtro por fecha`,
  },
  {
    id: "qr-payments",
    icon: QrCode,
    label: "Pagos QR",
    desc: "Configura el pago en mesa, split de cuenta y propinas digitales",
    role: "pos",
    content: `## Pagos QR\n\nPermite a los clientes pagar desde su mesa escaneando un código QR.\n\n### Opciones de pago:\n- **Pagar todo**: Pago completo con tarjeta o efectivo\n- **Dividir cuenta**: Divide el total entre N personas\n- **Propina**: Agrega propina (10%, 15%, 20% o monto personalizado)\n- **Recibo digital**: El recibo se envía al Telegram del cliente\n\n### Flujo:\n1. Cliente escanea QR de la mesa\n2. Ve el resumen de su cuenta\n3. Elige pagar, dividir o agregar propina\n4. Recibe confirmación y recibo digital`,
  },
  {
    id: "loyalty",
    icon: Award,
    label: "Programa de Lealtad",
    desc: "Configura el sistema de recompensas y niveles para tus clientes",
    role: "marketing",
    content: `## Programa de Lealtad\n\nEl programa de lealtad recompensa a los clientes con Bunz por cada compra.\n\n### KPIs disponibles:\n- Usuarios registrados\n- Bunz ganados totales\n- Bunz gastados totales\n- Hops acumulados (experiencia)\n\n### Niveles:\n- Cada nivel requiere cierta cantidad de Hops\n- Los niveles tienen multiplicadores de Bunz\n- Top 10 usuarios por Hops visible en la página\n\n### Ubicación:\nMenú lateral → Lealtad`,
  },
  {
    id: "campaigns",
    icon: Megaphone,
    label: "Campañas de Marketing",
    desc: "Crea y envía campañas segmentadas a tus clientes",
    role: "marketing",
    content: `## Campañas de Marketing\n\nCrea campañas de mensajes masivos segmentados por tipo de cliente.\n\n### Segmentos disponibles:\n- **ALL**: Todos los clientes\n- **VIP**: Clientes frecuentes (5+ visitas)\n- **RECURRENT**: Clientes regulares (2-4 visitas)\n- **NEW**: Clientes nuevos (1 visita)\n- **CHURN_RISK**: Clientes en riesgo de abandono\n\n### Cómo crear una campaña:\n1. Haz clic en "Nueva Campaña"\n2. Define nombre, segmento objetivo y mensaje\n3. La campaña se crea como borrador\n4. Haz clic en "Enviar Ahora" para enviarla\n\n### Analytics:\n- Tasas de entrega visibles en cada campaña enviada\n- Seguimiento de entregados vs fallidos`,
  },
  {
    id: "birthdays",
    icon: Cake,
    label: "Cumpleaños",
    desc: "Automatiza recompensas de cumpleaños para tus clientes",
    role: "marketing",
    content: `## Cumpleaños\n\nAutomatiza recompensas para clientes en su cumpleaños.\n\n### Configuración:\n- **Bunz de regalo**: Cantidad de Bunz a regalar (default: 100)\n- **Mensaje personalizado**: Usa variables como {name} y {bonus}\n\n### Vista de próximos cumpleaños:\n- Clientes ordenados por días hasta su cumpleaños\n- Los que cumplen en 7 días o menos se marcan en rosa\n- Los que cumplen en 30 días o menos se marcan en amarillo\n\n### Automatización:\nEl cron \`/api/cron/birthdays\` revisa diariamente quién cumple años y acredita Bunz automáticamente`,
  },
  {
    id: "referrals",
    icon: Gift,
    label: "Programa de Referidos",
    desc: "Gestiona el programa de referidos y analiza su rendimiento",
    role: "marketing",
    content: `## Programa de Referidos\n\nLos clientes pueden invitar a amigos y ganar recompensas.\n\n### KPIs disponibles:\n- Invitadores únicos\n- Invitados registrados\n- Total de referidos\n- Bunz en recompensas\n\n### Historial:\n- Lista completa de referidos\n- Estado: PENDING / COMPLETED / CANCELLED\n- Recompensa en Bunz por cada referido\n\n### Ubicación:\nMenú lateral → Referidos`,
  },
  {
    id: "customers",
    icon: Users,
    label: "Gestión de Clientes",
    desc: "Administra tus clientes, su segmentación e historial",
    role: "marketing",
    content: `## Gestión de Clientes\n\nVisualiza y administra la base de clientes del restaurante.\n\n### Información disponible:\n- Nombre, teléfono, cumpleaños\n- Total de visitas y gasto acumulado\n- Última visita\n- Segmento automático (VIP, RECURRENT, NEW, CHURN_RISK)\n- Consentimiento de marketing`,
  },
];

const ROLES: { key: GuideRole; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "admin", label: "Administración" },
  { key: "pos", label: "POS / Operación" },
  { key: "marketing", label: "Marketing" },
];

const ROLE_BADGES: Record<string, { label: string; color: string }> = {
  admin: { label: "Admin", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  pos: { label: "POS", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  marketing: { label: "Marketing", color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
};

export default function AcademyPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<GuideRole>("all");

  const filtered = roleFilter === "all" ? guides : guides.filter((g) => g.role === roleFilter);
  const guide = filtered.find((g) => g.id === selected);

  if (guide) {
    const Icon = guide.icon;
    const badge = ROLE_BADGES[guide.role];
    return (
      <div className="space-y-6">
        <button onClick={() => setSelected(null)} className="text-sm text-pink-400 hover:text-pink-300 flex items-center gap-1">
          <ChevronRight className="h-4 w-4 rotate-180" /> Volver a guías
        </button>
        <Card className="border border-white/5 bg-white/5 p-8 backdrop-blur-md">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-400">
              <Icon className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white">{guide.label}</h1>
                {badge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>{badge.label}</span>}
              </div>
              <p className="text-sm text-gray-400 mt-1">{guide.desc}</p>
            </div>
          </div>
          <div className="prose prose-invert max-w-none">
            {guide.content.split("\n").map((line, i) => {
              if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-bold text-white mt-6 mb-3">{line.slice(3)}</h2>;
              if (line.startsWith("### ")) return <h3 key={i} className="text-base font-bold text-pink-400 mt-4 mb-2">{line.slice(4)}</h3>;
              if (line.startsWith("- **")) {
                const parts = line.split("**:");
                return <li key={i} className="text-sm text-gray-300 ml-4 mb-1"><strong className="text-white">{parts[0].slice(3)}</strong>{parts[1]}</li>;
              }
              if (line.startsWith("- ")) return <li key={i} className="text-sm text-gray-300 ml-4 mb-1">{line.slice(2)}</li>;
              if (line.trim() === "") return null;
              return <p key={i} className="text-sm text-gray-300 mb-2">{line}</p>;
            })}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl" />
        <div className="relative z-10">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-pink-500">
            <BookOpen className="h-3.5 w-3.5" /> Centro de Aprendizaje
          </span>
          <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 mt-2">
            Academy
          </h1>
          <p className="text-gray-400 mt-2 text-sm font-medium">
            {filtered.length} guías interactivas para todas las funcionalidades de Rabbitty
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <button
            key={r.key}
            onClick={() => { setSelected(null); setRoleFilter(r.key); }}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              roleFilter === r.key
                ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                : "bg-white/5 text-gray-400 border border-white/10 hover:border-white/20"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(({ id, icon: Icon, label, desc, role }) => {
          const badge = ROLE_BADGES[role];
          return (
            <button
              key={id}
              onClick={() => setSelected(id)}
              className="group text-left"
            >
              <Card className="border border-white/5 bg-white/5 p-5 backdrop-blur-md hover:border-pink-500/30 hover:bg-white/10 transition-all h-full w-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-white text-sm flex-1">{label}</h3>
                  <ChevronRight className="h-4 w-4 text-gray-500 group-hover:text-pink-400 transition-all group-hover:translate-x-1" />
                </div>
                <p className="text-xs text-gray-400 mb-2">{desc}</p>
                {badge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>{badge.label}</span>}
              </Card>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Sin guías para este rol.</p>
        </div>
      )}
    </div>
  );
}
