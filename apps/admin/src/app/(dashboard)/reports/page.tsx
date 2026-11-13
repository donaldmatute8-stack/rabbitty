"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "../../../lib/trpc-client";
import { Card, cn, Button, toast } from "@rabbitty/ui";
import { motion } from "framer-motion";
import { Download, TrendingUp, CreditCard, Activity, UtensilsCrossed, Zap, Printer, Mail, FileText, Banknote, Coffee, Receipt, X, Users, Package, Clock, CalendarDays, Percent } from "lucide-react";
import { useBranch } from "../../../components/DashboardClientWrapper";

/** Teaser del gate: lo que ve el afiliado sin el plan. */
function ProTeaser({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="flex-1 flex flex-col justify-center gap-2">
      <span className="text-2xl">🔒</span>
      <p className="text-[11px] text-(--text-muted) leading-snug m-0">{text}</p>
      {hint && <p className="text-[9px] text-amber-400 font-bold leading-snug m-0">{hint}</p>}
    </div>
  );
}
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const COLORS = ["#ec4899", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b"];

export default function ReportsPage() {
  const [daysRange, setDaysRange] = useState(30);
  const [customRange, setCustomRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [reportTab, setReportTab] = useState<"ventas" | "clientes" | "inventario" | "impuestos" | "mix">("ventas");
  const dateFilter = customRange.from && customRange.to ? { from: customRange.from, to: customRange.to } : { days: daysRange };
  const reportRange = useMemo(() => {
    if (customRange.from && customRange.to) return { from: customRange.from, to: customRange.to };
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - daysRange);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { from: iso(from), to: iso(to) };
  }, [daysRange, customRange.from, customRange.to]);
  const { branchId: activeBranchId } = useBranch();
  // El contexto puede apuntar a una sucursal desactivada o de otro tenant.
  // Validamos contra las sucursales visibles antes de consultar para que los
  // reportes nunca caigan en datos vacíos por un branchId obsoleto.
  const { data: branchOptions } = trpc.admin.getBranches.useQuery(undefined, { retry: false });
  const branchId =
    branchOptions && branchOptions.some((b: any) => b.id === activeBranchId)
      ? activeBranchId
      : branchOptions?.[0]?.id || "default";

  const { data: salesTrends, isLoading: loadingSales } = trpc.analytics.getSalesTrends.useQuery({ branchId, ...dateFilter });
  const { data: topProducts, isLoading: loadingTop } = trpc.analytics.getTopProducts.useQuery({ branchId, limit: 30, ...dateFilter });
  const { data: pandl } = trpc.expenses.getPandL.useQuery({ startDate: reportRange.from, endDate: reportRange.to });
  const { data: expenseList = [] } = trpc.expenses.list.useQuery({ startDate: reportRange.from, endDate: reportRange.to });

  const topDrinks = useMemo(
    () => (topProducts ?? []).filter((p: any) => p.isDrink).slice(0, 6),
    [topProducts]
  );
  const topDishes = useMemo(
    () => (topProducts ?? []).filter((p: any) => !p.isDrink).slice(0, 8),
    [topProducts]
  );

  const { data: hourlySales } = trpc.analytics.getHourlySales.useQuery({ branchId, ...dateFilter });
  const { data: topCustomers } = trpc.analytics.getTopCustomers.useQuery({
    branchId,
    limit: 10,
    ...dateFilter,
  });
  const { data: lowStock } = trpc.inventory.getLowStockItems.useQuery(undefined, { retry: false });

  const totalOrders = useMemo(
    () => (salesTrends ?? []).reduce((sum: number, d: any) => sum + Number(d.orderCount || 0), 0),
    [salesTrends]
  );
  const totalSalesForAvg = useMemo(
    () => (salesTrends ?? []).reduce((sum: number, d: any) => sum + Number(d.totalSales || 0), 0),
    [salesTrends]
  );
  const avgTicket = totalOrders > 0 ? totalSalesForAvg / totalOrders : 0;

  const weekdaySales = useMemo(() => {
    const names = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const buckets = names.map((name) => ({ name, sales: 0, orders: 0 }));
    for (const row of salesTrends ?? []) {
      const date = new Date(`${row.date}T12:00:00`);
      if (Number.isNaN(date.getTime())) continue;
      const b = buckets[date.getDay()];
      if (!b) continue;
      b.sales += Number(row.totalSales) || 0;
      b.orders += Number(row.orderCount) || 0;
    }
    return buckets;
  }, [salesTrends]);

  const categoryMix = useMemo(() => {
    const map = new Map<string, { category: string; revenue: number; quantity: number }>();
    for (const p of topProducts ?? []) {
      const current = map.get(p.category) ?? { category: p.category, revenue: 0, quantity: 0 };
      current.revenue += Number(p.revenue) || 0;
      current.quantity += Number(p.quantity) || 0;
      map.set(p.category, current);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [topProducts]);

  const drinkRevenue = useMemo(
    () => (topProducts ?? []).filter((p: any) => p.isDrink).reduce((s: number, p: any) => s + Number(p.revenue || 0), 0),
    [topProducts]
  );
  const foodRevenue = useMemo(
    () => (topProducts ?? []).filter((p: any) => !p.isDrink).reduce((s: number, p: any) => s + Number(p.revenue || 0), 0),
    [topProducts]
  );
  const peakHour = useMemo(() => {
    const rows = hourlySales ?? [];
    if (!rows.length) return null;
    return rows.reduce((best: any, row: any) => (Number(row.sales) > Number(best?.sales || 0) ? row : best), rows[0]);
  }, [hourlySales]);
  const { data: paymentMethods, isLoading: loadingPayments } = trpc.analytics.getPaymentMethods.useQuery({ branchId, ...dateFilter });
  // Propinas (cuenta vs propina separadas — sin gate de plan)
  const { data: tipsSummary } = trpc.analytics.getTipsSummary.useQuery({ branchId, ...dateFilter });

  // ── Analíticas Pro (plan vendible — gated server-side) ──
  const { data: checkoutPro } = trpc.analytics.getCheckoutConversionPro.useQuery({ branchId, days: daysRange });
  const { data: tipsPro } = trpc.analytics.getTipsAnalyticsPro.useQuery({ branchId, days: daysRange });
  const { data: trendPro } = trpc.analytics.getWeeklyMethodTrendPro.useQuery({ branchId });
  const { data: growthPro } = trpc.analytics.getCustomerGrowthPro.useQuery({ branchId });
  
  const { data: reconciliationData, refetch: refetchReconciliation, isFetching: isReconciling } = trpc.payments.getFinancialReconciliation.useQuery(
    { branchId: branchId !== "default" ? branchId : undefined },
    { enabled: true }
  );

  const utils = trpc.useUtils();
  const [isExporting, setIsExporting] = useState(false);

  const handleExportReconciliationCSV = () => {
    if (!reconciliationData || reconciliationData.records.length === 0) {
      toast.error("No hay transacciones registradas para conciliar.");
      return;
    }

    const headers = ["ID Intento", "ID Orden", "Fecha", "Status", "Proveedor", "Total Bruto (MXN)", "Neto Tarjeta (MXN)", "Comisión Rabbitty (MXN)", "Bunz Canjeados"];
    const rows = reconciliationData.records.map((r: any) => [
      r.id,
      r.orderId || "N/A",
      new Date(r.createdAt).toISOString(),
      r.status,
      r.provider,
      r.grossMxn.toFixed(2),
      r.netFiatMxn.toFixed(2),
      r.platformFeeMxn.toFixed(2),
      r.bunzApplied,
    ]);

    const csvContent = [headers.join(","), ...rows.map((e: any[]) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Conciliacion_RabbittyPay_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const escape = (value: string | number) => {
      const text = String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    };
    const csv = "\uFEFF" + [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintReport = () => window.print();

  const handleExportExpensesCSV = () => {
    if (!expenseList.length) {
      toast.error("No hay gastos en el periodo.");
      return;
    }
    downloadCSV(
      `Gastos_${reportRange.from}_${reportRange.to}.csv`,
      ["Fecha", "Categoría", "Descripción", "Proveedor", "Referencia", "Monto"],
      expenseList.map((e: any) => [
        new Date(e.expenseDate).toLocaleDateString("es-MX"),
        e.category,
        e.description,
        e.paidTo || "",
        e.reference || "",
        Number(e.amount || 0).toFixed(2),
      ])
    );
  };

  const handleExportProductsCSV = () => {
    if (!topProducts?.length) {
      toast.error("No hay productos en el periodo.");
      return;
    }
    downloadCSV(
      `Productos_${reportRange.from}_${reportRange.to}.csv`,
      ["Producto", "Categoría", "Bebida", "Cantidad", "Ingresos"],
      topProducts.map((p: any) => [
        p.name,
        p.category,
        p.isDrink ? "Sí" : "No",
        Number(p.quantity || 0),
        Number(p.revenue || 0).toFixed(2),
      ])
    );
  };

  const handleExportTaxCSV = () => {
    downloadCSV(
      `Impuestos_${reportRange.from}_${reportRange.to}.csv`,
      ["Concepto", "Monto"],
      [
        ["Ventas totales", totalRevenue.toFixed(2)],
        ["Base gravable", displayBase.toFixed(2)],
        ["IVA trasladado 16%", displayIVA.toFixed(2)],
        ["Propinas", Number(tipsSummary?.totalTip || 0).toFixed(2)],
        ["Gastos", Number(pandl?.expenses || 0).toFixed(2)],
        ["Utilidad neta", Number(pandl?.netProfit || 0).toFixed(2)],
      ]
    );
  };

  const handleExportClientsCSV = () => {
    if (!topCustomers?.length) {
      toast.error("No hay clientes identificados en el periodo.");
      return;
    }
    downloadCSV(
      `Clientes_${reportRange.from}_${reportRange.to}.csv`,
      ["Cliente", "Teléfono", "Visitas", "Total", "Última visita"],
      topCustomers.map((c: any) => [
        c.customerName || "Cliente",
        c.customerPhone || "",
        Number(c.orderCount || 0),
        Number(c.total || 0).toFixed(2),
        c.lastVisit ? new Date(c.lastVisit).toLocaleDateString("es-MX") : "",
      ])
    );
  };

  const handleExportInventoryCSV = () => {
    if (!lowStock?.length) {
      toast.error("No hay insumos bajo stock.");
      return;
    }
    downloadCSV(
      `Inventario_bajo_${new Date().toISOString().slice(0, 10)}.csv`,
      ["Insumo", "SKU", "Stock", "Mínimo", "Unidad"],
      lowStock.map((i: any) => [i.name, i.sku || "", i.stock, i.minStock, i.unit]),
    );
  };

  const handleExportMixCSV = () => {
    if (!categoryMix.length) {
      toast.error("No hay productos en el periodo.");
      return;
    }
    downloadCSV(
      `Mix_${reportRange.from}_${reportRange.to}.csv`,
      ["Categoría", "Cantidad", "Ingresos"],
      categoryMix.map((c) => [c.category, c.quantity, c.revenue.toFixed(2)])
    );
  };

  const buildReportEmailHtml = () => {
    const fmt = (v: number | null | undefined) =>
      `$${Number(v || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const productRows = (topProducts ?? [])
      .slice(0, 12)
      .map(
        (p: any) =>
          `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${p.name}</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${p.category}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${p.quantity}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${fmt(p.revenue)}</td></tr>`
      )
      .join("");
    const expenseRows = (pandl?.byCategory ?? [])
      .map(
        (c: any) =>
          `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${c.category}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${fmt(c.total)}</td></tr>`
      )
      .join("");

    return `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0A0314;padding:24px;color:#fff">
        <div style="max-width:640px;margin:0 auto;background:#130725;border:1px solid rgba(244,63,94,0.35);border-radius:20px;overflow:hidden">
          <div style="padding:22px;border-bottom:1px solid rgba(255,255,255,0.08)">
            <p style="margin:0;font-size:10px;font-weight:900;letter-spacing:.22em;color:#F43F5E">RABBITTY</p>
            <h1 style="margin:6px 0 0;font-size:22px;color:#fff">Reporte de operación</h1>
            <p style="margin:4px 0 0;font-size:12px;color:#94A3B8">${reportRange.from} a ${reportRange.to}</p>
          </div>
          <div style="padding:20px">
            <table style="width:100%;border-collapse:collapse;font-size:13px;color:#E2E8F0">
              <tr><td style="padding:6px 0">Ventas totales</td><td style="text-align:right;font-weight:800">${fmt(totalRevenue)}</td></tr>
              <tr><td style="padding:6px 0">Base gravable</td><td style="text-align:right">${fmt(displayBase)}</td></tr>
              <tr><td style="padding:6px 0">IVA trasladado</td><td style="text-align:right">${fmt(displayIVA)}</td></tr>
              <tr><td style="padding:6px 0">Propinas</td><td style="text-align:right">${fmt(tipsSummary?.totalTip)}</td></tr>
              <tr><td style="padding:6px 0">Gastos</td><td style="text-align:right;color:#FCA5A5">${fmt(pandl?.expenses)}</td></tr>
              <tr><td style="padding:8px 0;border-top:1px solid #333;font-weight:900">Utilidad neta</td><td style="padding:8px 0;border-top:1px solid #333;text-align:right;font-weight:900;color:#6EE7B7">${fmt(pandl?.netProfit)}</td></tr>
            </table>

            <h2 style="margin:22px 0 8px;font-size:14px;color:#fff">Productos más vendidos</h2>
            <table style="width:100%;border-collapse:collapse;font-size:12px;color:#CBD5E1">
              <thead><tr><th style="text-align:left;padding:6px 8px">Producto</th><th style="text-align:left;padding:6px 8px">Categoría</th><th style="text-align:right;padding:6px 8px">Cant.</th><th style="text-align:right;padding:6px 8px">Ingresos</th></tr></thead>
              <tbody>${productRows || '<tr><td colspan="4" style="padding:8px;color:#64748B">Sin datos</td></tr>'}</tbody>
            </table>

            <h2 style="margin:22px 0 8px;font-size:14px;color:#fff">Gastos por categoría</h2>
            <table style="width:100%;border-collapse:collapse;font-size:12px;color:#CBD5E1">
              <tbody>${expenseRows || '<tr><td colspan="2" style="padding:8px;color:#64748B">Sin gastos</td></tr>'}</tbody>
            </table>

            <p style="margin:22px 0 0;font-size:11px;color:#64748B">
              Reporte generado desde Rabbitty Admin. Los Bunz son puntos de lealtad, no dinero.
            </p>
          </div>
        </div>
      </div>
    `;
  };

  const handleSendEmail = async () => {
    if (!emailTo.trim()) {
      toast.error("Escribe un correo.");
      return;
    }
    setEmailSending(true);
    try {
      const res = await fetch("/api/reports/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo.trim(),
          subject: `Reporte Rabbitty ${reportRange.from} a ${reportRange.to}`,
          html: buildReportEmailHtml(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudo enviar el correo");
      toast.success("Reporte enviado por correo.");
      setEmailOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar el correo.");
    } finally {
      setEmailSending(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const data = await utils.analytics.getExportData.fetch({ branchId, ...dateFilter });
      if (!data || data.length === 0) {
        toast.error("No hay datos para exportar.");
        return;
      }

    // CSV format with Taxes separated
    const headers = ["ID Orden", "Fecha", "Segmento/Cliente", "Subtotal", "Impuesto (IVA)", "Descuento", "Bunz Pagados", "Total", "Estatus de factura"];
    
    const rows = data.map((order: any) => [
      order.orderId ? String(order.orderId).slice(0, 8) : "N/A",
      order.date ? new Date(order.date).toLocaleString("es-MX") : "N/A",
      order.customerSegment || "General",
      (Number(order.subtotal) || 0).toFixed(2),
      (Number(order.tax) || 0).toFixed(2),
      (Number(order.discount) || 0).toFixed(2),
      (Number(order.bunzPaid) || 0).toString(),
      (Number(order.total) || 0).toFixed(2),
      order.cfdiStatus || "NONE",
    ]);

    downloadCSV(
      `Reporte_Rabbitty_${new Date().toISOString().split("T")[0]}.csv`,
      headers,
      rows
    );
    toast.success("CSV de ventas descargado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo exportar el CSV.");
    } finally {
      setIsExporting(false);
    }
  };

  const totalRevenue = Math.round((salesTrends?.reduce((sum: number, item: any) => sum + (Number(item.totalSales) || 0), 0) || 0) * 100) / 100;
  const rawTotalBase = Math.round((salesTrends?.reduce((sum: number, item: any) => sum + (Number(item.baseTotal) || 0), 0) || 0) * 100) / 100;
  // Canónico: Si totalBase viene en la base de datos se respeta, si no, se deriva con exactitud: base + IVA === total
  const displayBase = rawTotalBase > 0 ? rawTotalBase : Math.round((totalRevenue / 1.16) * 100) / 100;
  const displayIVA = Math.round((totalRevenue - displayBase) * 100) / 100;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl text-white">
          <p className="text-gray-400 text-sm mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="font-bold text-sm" style={{ color: entry.color }}>
              {entry.name === "totalSales" ? `Total: $${(Number(entry.value) || 0).toFixed(2)}` :
               entry.name === "taxTotal" ? `IVA (16%): $${(Number(entry.value) || 0).toFixed(2)}` :
               entry.name === "baseTotal" ? `Base: $${(Number(entry.value) || 0).toFixed(2)}` :
               entry.name === "revenue" || entry.name === "amount" ? `$${(Number(entry.value) || 0).toFixed(2)}` :
               `${(Number(entry.value) || 0).toFixed(2)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div id="reports-printable" className="space-y-8 pb-10">
      <style jsx global>{`
        @media print {
          aside, header, nav, .no-print { display: none !important; }
          body { background: #fff !important; color: #111 !important; }
          #reports-printable { padding: 0 !important; }
          #reports-printable .print-card {
            break-inside: avoid;
            box-shadow: none !important;
          }
          #reports-printable table { font-size: 10px !important; }
          #reports-printable .recharts-wrapper { max-height: 220px !important; }
          @page { margin: 1.2cm; size: A4 portrait; }
        }
      `}</style>

      <div className="hidden print:block">
        <h1 className="text-xl font-black">Rabbitty · Reporte de operación</h1>
        <p className="text-xs text-gray-600">
          Periodo: {reportRange.from} a {reportRange.to}
        </p>
      </div>
      {/* Header Disruptivo */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-gray-900 via-gray-800 to-black p-8 shadow-2xl border border-white/5">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-linear-to-r from-white to-gray-400 flex items-center gap-3">
              <Activity className="h-10 w-10 text-pink-500" />
              Inteligencia Financiera
            </h1>
            <p className="text-gray-400 mt-2 text-lg">Métricas vitales y tendencias de tu restaurante.</p>
          </div>
          
          <div className="no-print flex items-center gap-4">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-1 flex flex-wrap gap-1">
              {[
                { label: "Hoy", days: 1 },
                { label: "7 Días", days: 7 },
                { label: "30 Días", days: 30 },
                { label: "90 Días", days: 90 },
              ].map((item) => (
                <button
                  key={item.days}
                  onClick={() => { setDaysRange(item.days); setCustomRange({ from: null, to: null }); }}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer",
                    daysRange === item.days ? "bg-white text-black shadow-lg" : "text-white/70 hover:text-white"
                  )}
                >
                  {item.label}
                </button>
              ))}
              <div className="flex items-center gap-1.5 pl-2">
                <input
                  type="date"
                  value={customRange.from || ""}
                  onChange={(e) => {
                    const from = e.target.value;
                    setCustomRange((r) => ({ from, to: r.to || new Date().toISOString().slice(0, 10) }));
                  }}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white outline-none focus:border-pink-400 [color-scheme:dark]"
                  aria-label="Fecha inicio"
                />
                <span className="text-white/40 text-[11px]">→</span>
                <input
                  type="date"
                  value={customRange.to || ""}
                  onChange={(e) => {
                    const to = e.target.value;
                    setCustomRange((r) => ({ from: r.from || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10), to }));
                  }}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white outline-none focus:border-pink-400 [color-scheme:dark]"
                  aria-label="Fecha fin"
                />
                {(customRange.from || customRange.to) && (
                  <button
                    onClick={() => setCustomRange({ from: null, to: null })}
                    className="text-white/40 hover:text-white text-[11px] font-bold cursor-pointer px-1"
                    title="Volver a rango por días"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            
            <Button
              onClick={handleExportCSV}
              disabled={isExporting}
              variant="secondary"
              className="rounded-xl border border-white/10 text-white cursor-pointer text-xs"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {isExporting ? "Generando..." : "Exportar Ventas CSV"}
            </Button>

            <Button
              onClick={handlePrintReport}
              className="rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white cursor-pointer text-xs"
            >
              <Printer className="mr-1.5 h-3.5 w-3.5 text-emerald-300" />
              Imprimir / PDF
            </Button>

            <Button
              onClick={() => setEmailOpen(true)}
              className="rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white cursor-pointer text-xs"
            >
              <Mail className="mr-1.5 h-3.5 w-3.5 text-sky-300" />
              Enviar por correo
            </Button>

            <Button
              onClick={handleExportReconciliationCSV}
              disabled={isReconciling}
              className="rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white cursor-pointer text-xs"
            >
              <Download className="mr-1.5 h-3.5 w-3.5 text-pink-400" />
              Conciliación Stripe CSV
            </Button>

            <Link
              href={`/reports/audit${branchId !== "default" ? `?branchId=${branchId}` : ""}`}
              className="inline-flex items-center justify-center px-3.5 py-1.5 bg-linear-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold text-xs rounded-xl shadow-[0_0_20px_rgba(236,72,153,0.3)] transition-all cursor-pointer no-underline"
            >
              <Activity className="mr-1.5 h-3.5 w-3.5" />
              Reporte Auditoría PDF
            </Link>
          </div>
        </div>
      </div>

      {/* ── Conciliación Financiera Rabbitty Pay & Stripe Connect ── */}
      {reconciliationData && (
        <div className="rounded-3xl border border-white/5 bg-linear-to-br from-gray-900/60 to-black/80 p-6 backdrop-blur-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-pink-500 flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" /> Rabbitty Pay · Conciliación de Pasarela
              </p>
              <h3 className="text-lg font-black text-white mt-0.5">Liquidación Neta y Comisiones Stripe Connect</h3>
            </div>
            <span className="text-[11px] font-bold text-gray-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
              {reconciliationData.summary.succeededCount} cobros exitosos · {reconciliationData.summary.cancelledCount} cancelados
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
              <p className="text-[11px] font-bold uppercase text-gray-400">Total Bruto Órdenes</p>
              <p className="text-xl font-black text-white mt-1">
                ${reconciliationData.summary.grossOrderTotalMxn.toFixed(2)}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">Comandas liquidadas en mesa</p>
            </div>

            <div className="rounded-2xl border border-pink-500/20 bg-pink-500/10 p-4">
              <p className="text-[11px] font-bold uppercase text-pink-400">Neto Tarjeta / Apple Pay</p>
              <p className="text-xl font-black text-pink-300 mt-1">
                ${reconciliationData.summary.netFiatMxn.toFixed(2)}
              </p>
              <p className="text-[10px] text-pink-400/60 mt-0.5">Cobrado vía Stripe Connect</p>
            </div>

            <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-4">
              <p className="text-[11px] font-bold uppercase text-purple-400">Comisión Rabbitty (1%)</p>
              <p className="text-xl font-black text-purple-300 mt-1">
                ${reconciliationData.summary.platformFeeMxn.toFixed(2)}
              </p>
              <p className="text-[10px] text-purple-400/60 mt-0.5">Application fee devengada</p>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-[11px] font-bold uppercase text-emerald-400">Depósito Estimado Banco</p>
              <p className="text-xl font-black text-emerald-300 mt-1">
                ${reconciliationData.summary.netSettledToMerchantMxn.toFixed(2)}
              </p>
              <p className="text-[10px] text-emerald-400/60 mt-0.5">Neto a transferir por CLABE</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Tarjetas Fiscales de Resumen ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/5 bg-gray-900/60 p-5 backdrop-blur-xl">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Base Gravable</p>
          <p className="text-2xl font-black text-white">${displayBase.toFixed(2)}</p>
          <p className="text-[11px] text-gray-500 mt-1">Ingresos sin IVA ({daysRange}D)</p>
        </div>
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5 backdrop-blur-xl">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-1">IVA Trasladado 16%</p>
          <p className="text-2xl font-black text-blue-300">${displayIVA.toFixed(2)}</p>
          <p className="text-[11px] text-blue-400/60 mt-1">Para declaración fiscal ({daysRange}D)</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 backdrop-blur-xl">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1">Total Cobrado (c/ IVA)</p>
          <p className="text-2xl font-black text-emerald-300">${totalRevenue.toFixed(2)}</p>
          <p className="text-[11px] text-emerald-400/60 mt-1">Base + IVA = Total ✓ ({daysRange}D)</p>
        </div>
      </div>

      {/* ── Reportes avanzados con pestañas ── */}
      <Card className="print-card p-5 border border-(--border-subtle) bg-(--bg-subtle)">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 no-print">
          <div>
            <h3 className="text-xl font-bold text-(--text-primary) flex items-center gap-2">
              <FileText className="text-pink-500" /> Reportes avanzados
            </h3>
            <p className="text-sm text-(--text-muted)">
              Ventas por hora, clientes, inventario, impuestos y mix de producto.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([
              ["ventas", "Ventas", Clock],
              ["clientes", "Clientes", Users],
              ["inventario", "Inventario", Package],
              ["impuestos", "Impuestos", Percent],
              ["mix", "Mix producto", Coffee],
            ] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setReportTab(id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all cursor-pointer",
                  reportTab === id
                    ? "bg-pink-500/15 border-pink-500/40 text-pink-300"
                    : "bg-(--bg-elevated) border-(--border-subtle) text-(--text-muted) hover:text-(--text-primary)"
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>

        {reportTab === "ventas" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi label="Tickets" value={String(totalOrders)} />
              <Kpi label="Ticket promedio" value={`$${avgTicket.toFixed(2)}`} />
              <Kpi label="Hora pico" value={peakHour ? `${peakHour.hour}:00` : "—"} hint={peakHour ? `$${Number(peakHour.sales).toFixed(0)}` : undefined} />
              <Kpi label="Día más fuerte" value={weekdaySales.reduce((best, d) => (d.sales > best.sales ? d : best), weekdaySales[0])?.name ?? "—"} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-black text-(--text-primary) mb-2">Ventas por hora</h4>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlySales ?? []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.05} vertical={false} />
                      <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} tick={{ fill: "currentColor", fontSize: 9, opacity: 0.6 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "currentColor", fontSize: 9, opacity: 0.6 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="sales" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-black text-(--text-primary) mb-2">Ventas por día de la semana</h4>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weekdaySales} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.05} vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: "currentColor", fontSize: 9, opacity: 0.6 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "currentColor", fontSize: 9, opacity: 0.6 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="sales" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {reportTab === "clientes" && (
          <div className="space-y-3">
            <div className="flex justify-end no-print">
              <Button onClick={handleExportClientsCSV} variant="secondary" className="rounded-xl text-xs">
                <Download className="mr-1.5 h-3.5 w-3.5" /> Clientes CSV
              </Button>
            </div>
            <DataTable
              headers={["Cliente", "Teléfono", "Visitas", "Total", "Última visita"]}
              rows={(topCustomers ?? []).map((c: any) => [
                c.customerName || "Cliente",
                c.customerPhone || "—",
                String(c.orderCount || 0),
                `$${Number(c.total || 0).toFixed(2)}`,
                c.lastVisit ? new Date(c.lastVisit).toLocaleDateString("es-MX") : "—",
              ])}
              empty="Sin clientes identificados en el periodo."
            />
          </div>
        )}

        {reportTab === "inventario" && (
          <div className="space-y-3">
            <div className="flex justify-end no-print">
              <Button onClick={handleExportInventoryCSV} variant="secondary" className="rounded-xl text-xs">
                <Download className="mr-1.5 h-3.5 w-3.5" /> Inventario CSV
              </Button>
            </div>
            <DataTable
              headers={["Insumo", "SKU", "Stock", "Mínimo", "Unidad"]}
              rows={(lowStock ?? []).map((i: any) => [
                i.name,
                i.sku || "—",
                String(i.stock),
                String(i.minStock),
                i.unit,
              ])}
              empty="Sin insumos bajo stock."
            />
          </div>
        )}

        {reportTab === "impuestos" && (
          <div className="space-y-3">
            <div className="flex justify-end no-print">
              <Button onClick={handleExportTaxCSV} variant="secondary" className="rounded-xl text-xs">
                <Download className="mr-1.5 h-3.5 w-3.5" /> Impuestos CSV
              </Button>
            </div>
            <DataTable
              headers={["Concepto", "Monto"]}
              rows={[
                ["Ventas totales", `$${totalRevenue.toFixed(2)}`],
                ["Base gravable", `$${displayBase.toFixed(2)}`],
                ["IVA trasladado 16%", `$${displayIVA.toFixed(2)}`],
                ["Propinas", `$${Number(tipsSummary?.totalTip || 0).toFixed(2)}`],
                ["Gastos", `$${Number(pandl?.expenses || 0).toFixed(2)}`],
                ["Utilidad neta", `$${Number(pandl?.netProfit || 0).toFixed(2)}`],
              ]}
              empty="Sin datos fiscales."
            />
          </div>
        )}

        {reportTab === "mix" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Kpi label="Ingresos bebidas" value={`$${drinkRevenue.toFixed(2)}`} />
              <Kpi label="Ingresos comida" value={`$${foodRevenue.toFixed(2)}`} />
              <Kpi
                label="% bebidas"
                value={`${drinkRevenue + foodRevenue > 0 ? ((drinkRevenue / (drinkRevenue + foodRevenue)) * 100).toFixed(1) : "0"}%`}
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-black text-(--text-primary) mb-2">Ingresos por categoría</h4>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryMix} layout="vertical" margin={{ top: 0, right: 0, left: 40, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="category" type="category" width={90} tick={{ fill: "currentColor", fontSize: 9, opacity: 0.7 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="revenue" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <div className="flex justify-end mb-2 no-print">
                  <Button onClick={handleExportMixCSV} variant="secondary" className="rounded-xl text-xs">
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Mix CSV
                  </Button>
                </div>
                <DataTable
                  headers={["Categoría", "Cantidad", "Ingresos"]}
                  rows={categoryMix.map((c) => [c.category, String(c.quantity), `$${c.revenue.toFixed(2)}`])}
                  empty="Sin productos en el periodo."
                />
              </div>
            </div>
          </div>
        )}
      </Card>

      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Gráfica de Tendencia de Ventas */}
        <motion.div variants={itemVariants} className="md:col-span-2">
          <Card className="p-6 border border-(--border-subtle) bg-(--bg-subtle) overflow-hidden relative">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-(--text-primary) flex items-center gap-2">
                  <TrendingUp className="text-blue-500" /> Tendencia de Ingresos
                </h3>
                <p className="text-(--text-muted) text-sm">Evolución de ventas e impuestos</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-(--text-muted)">Ingresos Totales ({daysRange}D)</p>
                <p className="text-3xl font-black text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-emerald-400">
                  ${totalRevenue.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="h-87.5 w-full">
              {loadingSales ? (
                <div className="w-full h-full animate-pulse bg-(--bg-pressed) rounded-2xl" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.05} vertical={false} />
                    <XAxis dataKey="date" stroke="currentColor" className="text-(--text-muted) text-xs" tickMargin={10} axisLine={false} tickLine={false} />
                    <YAxis stroke="currentColor" className="text-(--text-muted) text-xs" axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="totalSales" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Métodos de Pago */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 h-full border border-(--border-subtle) bg-(--bg-subtle)">
            <h3 className="text-xl font-bold text-(--text-primary) flex items-center gap-2 mb-6">
              <CreditCard className="text-purple-500" /> Flujo de Caja
            </h3>
            <div className="h-62.5 w-full flex items-center justify-center">
              {loadingPayments ? (
                <div className="w-48 h-48 rounded-full border-8 border-(--bg-pressed) animate-pulse" />
              ) : !paymentMethods?.length ? (
                <p className="text-(--text-muted)">Sin datos</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentMethods}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="amount"
                      nameKey="method"
                      stroke="none"
                    >
                      {paymentMethods.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            
            <div className="mt-4 flex flex-wrap justify-center gap-4">
              {paymentMethods?.map((entry: any, index: number) => (
                <div key={entry.method} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-sm font-semibold text-(--text-primary)">{entry.method}</span>
                  <span className="text-sm text-(--text-muted)">${Number(entry.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Propinas del período (cuenta vs propina — visible para admin) */}
        <motion.div variants={itemVariants}>
          <Card className="p-5 border border-(--border-subtle) bg-(--bg-subtle)">
            <h3 className="text-sm font-black text-(--text-primary) uppercase tracking-wider flex items-center gap-2 mb-3">
              💸 Propinas del período
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-lg font-black text-(--text-primary)">${Number(tipsSummary?.totalTip ?? 0).toFixed(2)}</p>
                <p className="text-[10px] text-(--text-muted) uppercase tracking-wider font-bold">Total propinas</p>
              </div>
              <div>
                <p className="text-lg font-black text-cyan-400">${Number(tipsSummary?.cardTip ?? 0).toFixed(2)}</p>
                <p className="text-[10px] text-(--text-muted) uppercase tracking-wider font-bold">En tarjeta</p>
              </div>
              <div>
                <p className="text-lg font-black text-emerald-400">${Number(tipsSummary?.cashTip ?? 0).toFixed(2)}</p>
                <p className="text-[10px] text-(--text-muted) uppercase tracking-wider font-bold">En efectivo</p>
              </div>
              <div>
                <p className="text-lg font-black text-(--text-primary)">{Number(tipsSummary?.tipSharePct ?? 0)}%</p>
                <p className="text-[10px] text-(--text-muted) uppercase tracking-wider font-bold">Sobre ventas</p>
              </div>
            </div>
            <p className="text-[10px] text-(--text-muted) mt-3">
              {tipsSummary?.tippedPayments ?? 0} de {tipsSummary?.totalPayments ?? 0} cobros con propina. Separa cuenta (venta) de propina (equipo).
            </p>
          </Card>
        </motion.div>

        {/* ── ANALÍTICAS PRO (plan vendible — gated server-side) ── */}        <motion.div variants={itemVariants}>
          <Card className="p-6 border border-(--border-subtle) bg-(--bg-subtle)">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-5">
              <h3 className="text-xl font-bold text-(--text-primary) flex items-center gap-2 mb-0">
                <Zap className="text-amber-500" /> Analíticas Pro
              </h3>
              <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wider ${checkoutPro?.gated === false ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
                {checkoutPro?.gated === false ? "PRO ACTIVO" : "PREVIEW — activa el plan en Ajustes → Facturación"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* 1. Conversión checkout */}
              <div className="rounded-2xl p-4 border border-(--border-subtle) bg-(--bg-elevated) h-full flex flex-col">
                <p className="text-[11px] font-black uppercase tracking-wider text-(--text-muted) mb-2">💳 Checkout digital</p>
                {checkoutPro?.gated ? (
                  <ProTeaser text="Cuántas cuentas se pagan y cuántas se abandonan en tu QR/link."
                    hint={checkoutPro.teaser} />
                ) : (
                  <div className="space-y-1.5 text-sm">
                    <p className="text-3xl font-black text-(--text-primary)">{checkoutPro?.conversion}%</p>
                    <p className="text-[11px] text-(--text-muted)">conversión · {checkoutPro?.total} intentos</p>
                    <p className="text-[11px]">
                      <span className="text-emerald-400 font-bold">✔ {checkoutPro?.settled} pagados</span>
                      <span className="text-amber-400 font-bold ml-2">⚠ {checkoutPro?.abandoned} abandonados</span>
                    </p>
                  </div>
                )}
              </div>

              {/* 2. Propinas */}
              <div className="rounded-2xl p-4 border border-(--border-subtle) bg-(--bg-elevated) h-full flex flex-col">
                <p className="text-[11px] font-black uppercase tracking-wider text-(--text-muted) mb-2">🫰 Propinas</p>
                {tipsPro?.gated ? (
                  <ProTeaser text="Cuánto deja tu clientela de propina y en qué mesas." hint={tipsPro.teaser} />
                ) : (
                  <div className="space-y-1.5 text-sm">
                    <p className="text-3xl font-black text-(--text-primary)">${(tipsPro?.totalTip || 0).toFixed(0)}</p>
                    <p className="text-[11px] text-(--text-muted)">{tipsPro?.ordersWithTip} cuentas con propina</p>
                    <p className="text-[11px] text-(--text-muted)">Promedio: <span className="font-black text-(--text-primary)">{tipsPro?.avgTipPct}%</span></p>
                  </div>
                )}
              </div>

              {/* 3. Tendencia semanal por método */}
              <div className="rounded-2xl p-4 border border-(--border-subtle) bg-(--bg-elevated) h-full flex flex-col">
                <p className="text-[11px] font-black uppercase tracking-wider text-(--text-muted) mb-2">📈 Método por semana</p>
                {trendPro?.gated ? (
                  <ProTeaser text="Cómo evoluciona cada método de pago semana a semana." hint={trendPro.teaser} />
                ) : (
                  <div className="flex-1 min-h-40">
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={Object.values((trendPro?.weekly ?? []).reduce<Record<string, { week: string } & Record<string, number>>>((acc, r) => {
                        acc[r.wk] = acc[r.wk] || { week: r.week };
                        acc[r.wk][r.method] = (acc[r.wk][r.method] || 0) + r.total;
                        return acc;
                      }, {}))}>
                        <XAxis dataKey="week" tick={{ fill: "currentColor", fontSize: 9, opacity: 0.6 }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip content={<CustomTooltip />} />
                        {(trendPro?.weekly ?? []).length > 0 &&
                          Array.from(new Set((trendPro?.weekly ?? []).map((r: any) => r.method))).map((m: any, i: number) => (
                            <Bar key={m as string} dataKey={m as string} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
                          ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* 4. Crecimiento de clientela */}
              <div className="rounded-2xl p-4 border border-(--border-subtle) bg-(--bg-elevated) h-full flex flex-col">
                <p className="text-[11px] font-black uppercase tracking-wider text-(--text-muted) mb-2">🐰 Tu clientela</p>
                {growthPro?.gated ? (
                  <ProTeaser text="Nuevos vs recurrentes cada mes: tu base de comensales creciendo." hint={growthPro.teaser} />
                ) : (
                  <div className="space-y-1.5 text-sm">
                    <p className="text-3xl font-black text-(--text-primary)">{growthPro?.base.totalCustomers.toLocaleString()}</p>
                    <p className="text-[11px] text-(--text-muted)">comensales registrados</p>
                    <p className="text-[11px]">
                      <span className="text-emerald-400 font-bold">{growthPro?.base.recurringPct}% recurrentes</span>
                      <span className="text-(--text-muted) ml-2">({growthPro?.base.recurring})</span>
                    </p>
                    <p className="text-[10px] text-(--text-muted)">Nuevos este mes: <span className="font-black text-(--text-primary)">{growthPro?.newByMonth.at(-1)?.new ?? 0}</span></p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Top Productos */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 h-full border border-(--border-subtle) bg-(--bg-subtle)">
            <h3 className="text-xl font-bold text-(--text-primary) flex items-center gap-2 mb-6">
              <UtensilsCrossed className="text-pink-500" /> Platillos Estrella
            </h3>
            <div className="h-62.5 w-full">
              {loadingTop ? (
                <div className="w-full h-full animate-pulse bg-(--bg-pressed) rounded-2xl" />
              ) : !topProducts?.length ? (
                <p className="text-(--text-muted)">Sin datos</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 0, left: 30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="currentColor" strokeOpacity={0.05} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" stroke="currentColor" className="text-(--text-primary) text-xs font-bold" axisLine={false} tickLine={false} width={100} />
                    <Tooltip cursor={{fill: 'currentColor', opacity: 0.05}} content={<CustomTooltip />} />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                      {topProducts.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill="url(#colorBar)" />
                      ))}
                    </Bar>
                    <defs>
                      <linearGradient id="colorBar" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#ec4899" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </motion.div>

        {/* ── Utilidad, gastos y reportes personalizados ── */}
        <motion.div variants={itemVariants} className="md:col-span-2">
          <Card className="print-card p-6 border border-(--border-subtle) bg-(--bg-subtle)">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-xl font-bold text-(--text-primary) flex items-center gap-2">
                  <Banknote className="text-emerald-500" /> Utilidad y gastos
                </h3>
                <p className="text-sm text-(--text-muted)">
                  Ingresos, gastos y margen del periodo seleccionado
                </p>
              </div>
              <div className="flex flex-wrap gap-2 no-print">
                <Button
                  onClick={handleExportExpensesCSV}
                  variant="secondary"
                  className="rounded-xl text-xs"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Gastos CSV
                </Button>
                <Button
                  onClick={handleExportProductsCSV}
                  variant="secondary"
                  className="rounded-xl text-xs"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Productos CSV
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-(--text-muted)">Ventas</p>
                <p className="text-xl font-black text-emerald-400 mt-1">${Number(pandl?.revenue ?? 0).toFixed(2)}</p>
              </div>
              <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-(--text-muted)">Gastos</p>
                <p className="text-xl font-black text-rose-400 mt-1">${Number(pandl?.expenses ?? 0).toFixed(2)}</p>
              </div>
              <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-(--text-muted)">Utilidad neta</p>
                <p className="text-xl font-black text-(--text-primary) mt-1">${Number(pandl?.netProfit ?? 0).toFixed(2)}</p>
              </div>
              <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-(--text-muted)">Margen</p>
                <p className="text-xl font-black text-sky-400 mt-1">{Number(pandl?.margin ?? 0).toFixed(1)}%</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div>
                <h4 className="text-sm font-black text-(--text-primary) mb-3">Gastos por categoría</h4>
                {!pandl?.byCategory?.length ? (
                  <p className="text-sm text-(--text-muted)">Sin gastos registrados en el periodo.</p>
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={pandl.byCategory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.05} vertical={false} />
                        <XAxis dataKey="category" tick={{ fill: "currentColor", fontSize: 9, opacity: 0.6 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "currentColor", fontSize: 9, opacity: 0.6 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="total" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-black text-(--text-primary) mb-3">Detalle de gastos</h4>
                <div className="max-h-56 overflow-y-auto rounded-xl border border-(--border-subtle)">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-(--bg-elevated) text-(--text-muted) uppercase text-[9px]">
                      <tr>
                        <th className="text-left px-2 py-2">Fecha</th>
                        <th className="text-left px-2 py-2">Categoría</th>
                        <th className="text-right px-2 py-2">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseList.map((e: any) => (
                        <tr key={e.id} className="border-t border-(--border-subtle)">
                          <td className="px-2 py-1.5 text-(--text-muted)">{new Date(e.expenseDate).toLocaleDateString("es-MX")}</td>
                          <td className="px-2 py-1.5 text-(--text-primary)">{e.category}</td>
                          <td className="px-2 py-1.5 text-right font-bold text-rose-400">${Number(e.amount || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                      {!expenseList.length && (
                        <tr><td colSpan={3} className="px-2 py-4 text-center text-(--text-muted)">Sin gastos</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* ── Bebidas más vendidas ── */}
        <motion.div variants={itemVariants}>
          <Card className="print-card p-6 h-full border border-(--border-subtle) bg-(--bg-subtle)">
            <h3 className="text-xl font-bold text-(--text-primary) flex items-center gap-2 mb-4">
              <Coffee className="text-amber-500" /> Bebidas más vendidas
            </h3>
            {!topDrinks.length ? (
              <p className="text-sm text-(--text-muted)">Sin bebidas identificadas en el periodo.</p>
            ) : (
              <div className="space-y-3">
                {topDrinks.map((p: any) => (
                  <div key={`${p.name}-${p.category}`} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-(--text-primary) truncate m-0">{p.name}</p>
                      <p className="text-[10px] text-(--text-muted) m-0">{p.category} · {p.quantity} vendidos</p>
                    </div>
                    <span className="text-sm font-black text-amber-400">${Number(p.revenue).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        {/* ── Tabla de productos ── */}
        <motion.div variants={itemVariants}>
          <Card className="print-card p-6 h-full border border-(--border-subtle) bg-(--bg-subtle)">
            <h3 className="text-xl font-bold text-(--text-primary) flex items-center gap-2 mb-4">
              <FileText className="text-pink-500" /> Productos más vendidos
            </h3>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-(--border-subtle)">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-(--bg-elevated) text-(--text-muted) uppercase text-[9px]">
                  <tr>
                    <th className="text-left px-2 py-2">Producto</th>
                    <th className="text-left px-2 py-2">Categoría</th>
                    <th className="text-right px-2 py-2">Cant.</th>
                    <th className="text-right px-2 py-2">Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {(topProducts ?? []).slice(0, 15).map((p: any) => (
                    <tr key={`${p.name}-${p.category}`} className="border-t border-(--border-subtle)">
                      <td className="px-2 py-1.5 text-(--text-primary)">{p.name}</td>
                      <td className="px-2 py-1.5 text-(--text-muted)">{p.category}</td>
                      <td className="px-2 py-1.5 text-right text-(--text-primary)">{p.quantity}</td>
                      <td className="px-2 py-1.5 text-right font-bold text-emerald-400">${Number(p.revenue).toFixed(2)}</td>
                    </tr>
                  ))}
                  {!topProducts?.length && (
                    <tr><td colSpan={4} className="px-2 py-4 text-center text-(--text-muted)">Sin ventas en el periodo</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>

      </motion.div>

      {emailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm no-print">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#130725] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="m-0 text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">
                  Enviar reporte
                </p>
                <h3 className="m-0 mt-1 text-lg font-black text-white">Correo del reporte</h3>
                <p className="m-0 mt-1 text-[11px] text-white/50">
                  Periodo {reportRange.from} a {reportRange.to}
                </p>
              </div>
              <button onClick={() => setEmailOpen(false)} className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-4 block text-[11px] font-bold text-white/60">
              Correo destino
              <input
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="dueno@negocio.com"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400/60"
              />
            </label>
            <div className="mt-4 flex gap-2">
              <Button onClick={handleSendEmail} disabled={emailSending} className="flex-1 rounded-xl bg-sky-600 text-white">
                <Mail className="mr-1.5 h-4 w-4" /> {emailSending ? "Enviando..." : "Enviar"}
              </Button>
              <Button onClick={() => setEmailOpen(false)} variant="secondary" className="rounded-xl">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-(--text-muted)">{label}</p>
      <p className="text-xl font-black text-(--text-primary) mt-1">{value}</p>
      {hint && <p className="text-[10px] text-(--text-muted) mt-0.5">{hint}</p>}
    </div>
  );
}

function DataTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: string[][];
  empty: string;
}) {
  return (
    <div className="max-h-72 overflow-y-auto rounded-xl border border-(--border-subtle)">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-(--bg-elevated) text-(--text-muted) uppercase text-[9px]">
          <tr>
            {headers.map((h) => (
              <th key={h} className="text-left px-2 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-(--border-subtle)">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1.5 text-(--text-primary)">{cell}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={headers.length} className="px-2 py-4 text-center text-(--text-muted)">{empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
