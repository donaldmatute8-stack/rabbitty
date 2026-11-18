"use client";

import Link from "next/link";
import { trpc } from "../../../lib/trpc-client";
import { Card, Badge } from "@rabbitty/ui";
import {
  TrendingUp,
  ReceiptText,
  Banknote,
  Scale,
  Repeat,
  Receipt,
  CreditCard,
  FileText,
  ArrowUpRight,
  ShoppingBag,
  CircleDollarSign,
} from "lucide-react";
import { useBranch } from "../../../components/DashboardClientWrapper";

/**
 * ── Dinero (hub) ────────────────────────────────────────────────────────────
 *
 * El admin tenía siete entradas sueltas de dinero (reportes, cuadre, turnos,
 * conciliaciones, reembolsos, gastos, CFDI) repartidas entre "Operación" y
 * "Configuración". Cada una hace una cosa distinta —no se fusionan— pero se
 * entiende mejor con una puerta única que explique **qué es cada una y cuándo
 * usarla**, y con el estado del día arriba.
 *
 * Nada de esto reemplaza a las herramientas: es navegación + contexto.
 */

type MoneyTool = {
  href: string;
  label: string;
  desc: string;
  when: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  group: "diario" | "mensual" | "fiscal";
};

const TOOLS: MoneyTool[] = [
  {
    href: "/cash-shifts",
    label: "Turnos de caja",
    desc: "Apertura, cortes X/Y, arqueo y diferencia por cajero.",
    when: "Cada turno, todos los días",
    icon: Banknote,
    group: "diario",
  },
  {
    href: "/reports",
    label: "Reportes & ingresos",
    desc: "Ventas, ticket promedio, medios de pago y horas pico.",
    when: "Al cerrar el día y al revisar la semana",
    icon: TrendingUp,
    group: "diario",
  },
  {
    href: "/reports/audit",
    label: "Cuadre & auditoría",
    desc: "Cruza cobros, propinas y propinas de tarjeta contra los tickets.",
    when: "Cuando algo no cuadra",
    icon: ReceiptText,
    group: "mensual",
  },
  {
    href: "/refunds",
    label: "Reembolsos & ajustes",
    desc: "Devoluciones y correcciones con su rastro en el ledger.",
    when: "Sólo cuando hay una devolución",
    icon: Repeat,
    group: "diario",
  },
  {
    href: "/expenses",
    label: "Gastos operativos",
    desc: "Compras, servicios y nómina; alimenta el P&L.",
    when: "Al recibir un gasto",
    icon: Receipt,
    group: "mensual",
  },
  {
    href: "/conciliaciones",
    label: "Conciliaciones Bunz",
    desc: "Cuadre de Bunz emitidos, canjeados y respaldo del negocio.",
    when: "Al cerrar el mes o si cambia el pozo",
    icon: Scale,
    group: "mensual",
  },
  {
    href: "/payments",
    label: "Rieles de cobro",
    desc: "Qué métodos acepta el local y con qué capacidades.",
    when: "Al configurar o cambiar de terminal",
    icon: CreditCard,
    group: "fiscal",
  },
  {
    href: "/settings/billing",
    label: "Facturación CFDI",
    desc: "Datos fiscales y timbrado del negocio.",
    when: "Al darte de alta y cuando cambie tu RFC",
    icon: FileText,
    group: "fiscal",
  },
];

const GROUP_TITLES: Record<MoneyTool["group"], { title: string; hint: string }> = {
  diario: { title: "Todos los días", hint: "Lo que se toca al abrir y cerrar" },
  mensual: { title: "Revisión periódica", hint: "Cierre de mes, cuadre y respaldo" },
  fiscal: { title: "Configuración", hint: "Se ajusta pocas veces" },
};

function money(value: number): string {
  return value.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
}

export default function MoneyPage() {
  const { branchId: activeBranchId } = useBranch();
  const { data: branchOptions } = trpc.admin.getBranches.useQuery(undefined, { retry: false });
  const branchId = activeBranchId || branchOptions?.[0]?.id || "";

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;

  const { data: todaySales } = trpc.analytics.getSalesTrends.useQuery(
    { branchId, from: today, to: today },
    { enabled: Boolean(branchId), retry: false },
  );
  const { data: monthSales } = trpc.analytics.getSalesTrends.useQuery(
    { branchId, from: monthStart, to: today },
    { enabled: Boolean(branchId), retry: false },
  );
  const { data: storeTotals } = trpc.admin.getStoreProducts.useQuery(undefined, { retry: false });

  // `getSalesTrends` devuelve una fila por día con `totalSales`.
  const sumDays = (rows: Array<{ totalSales?: number | string | null }> | undefined): number =>
    (rows ?? []).reduce((sum, day) => sum + (Number(day.totalSales) || 0), 0);
  const todayTotal = sumDays(todaySales);
  const monthTotal = sumDays(monthSales);

  return (
    <div className="space-y-6 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-linear-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-pink-400">Contabilidad</p>
          <h1 className="mt-1 text-4xl font-black tracking-tight text-transparent bg-clip-text bg-linear-to-r from-white via-gray-200 to-gray-500">
            Dinero
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-medium text-gray-400">
            El estado de hoy y la puerta a cada herramienta. No se mezclan: cada una responde una
            pregunta distinta y aquí se ve cuál toca.
          </p>
        </div>
      </div>

      {/* Estado del día */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-white/5 bg-white/[0.03] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Ventas de hoy</p>
          <p className="mt-1 text-3xl font-black text-white">{money(todayTotal)}</p>
        </Card>
        <Card className="border border-white/5 bg-white/[0.03] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Ventas del mes</p>
          <p className="mt-1 text-3xl font-black text-white">{money(monthTotal)}</p>
        </Card>
        <Card className="border border-white/5 bg-white/[0.03] p-5">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
            <ShoppingBag className="h-3 w-3" /> Tienda (30 d)
          </p>
          <p className="mt-1 text-3xl font-black text-white">{money(storeTotals?.totals.revenue30d ?? 0)}</p>
        </Card>
        <Card className="border border-white/5 bg-white/[0.03] p-5">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
            <CircleDollarSign className="h-3 w-3" /> Margen tienda
          </p>
          <p
            className={`mt-1 text-3xl font-black ${
              (storeTotals?.totals.margin30d ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {money(storeTotals?.totals.margin30d ?? 0)}
          </p>
        </Card>
      </div>

      {/* Herramientas por cadencia */}
      {(["diario", "mensual", "fiscal"] as const).map((group) => (
        <div key={group} className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-gray-300">
              {GROUP_TITLES[group].title}
            </h2>
            <span className="text-[11px] font-semibold text-gray-500">{GROUP_TITLES[group].hint}</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {TOOLS.filter((tool) => tool.group === group).map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="group flex items-start gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-4 transition-colors hover:border-white/10 hover:bg-white/[0.05]"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">{tool.label}</p>
                      <ArrowUpRight className="h-3.5 w-3.5 text-gray-600 transition-colors group-hover:text-pink-400" />
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-400">{tool.desc}</p>
                    <Badge variant="secondary" className="mt-2">
                      {tool.when}
                    </Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      <ChatNote />
    </div>
  );
}

/** Nota fija: qué NO hace este hub, para que no se espere magia. */
function ChatNote() {
  return (
    <Card className="border border-white/5 bg-white/[0.02] p-4">
      <p className="text-[11px] leading-relaxed text-gray-500">
        Este hub no recalcula nada: muestra el resumen y te lleva a la herramienta. Los números
        vienen de reportes, gastos y del catálogo de la tienda, que siguen siendo la única fuente
        de verdad. Si un dato no cuadra, el lugar para investigarlo es{" "}
        <Link href="/reports/audit" className="font-bold text-pink-400 underline underline-offset-2">
          Cuadre & auditoría
        </Link>
        .
      </p>
    </Card>
  );
}
