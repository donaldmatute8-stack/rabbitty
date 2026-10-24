"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  Printer,
  Download,
  Calendar,
  Store,
  Receipt,
  CreditCard,
  Banknote,
  Coins,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

interface AuditSummary {
  totalOrders: number;
  totalGross: number;
  totalSubtotal: number;
  totalTax: number;
  totalBunzPaid: number;
  totalBunzReward: number;
  paymentBreakdown: Record<string, { count: number; total: number }>;
  productBreakdown: Array<{ name: string; quantity: number; revenue: number }>;
}

interface OrderItem {
  item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
}

interface OrderData {
  order_id: string;
  orderType: string;
  order_status: string;
  subtotal: number;
  tax: number;
  discount: number;
  tip: number;
  total: number;
  bunzReward: number;
  bunzPaid: number;
  order_date: string;
  payment_id: string;
  payment_method: string;
  payment_amount: number;
  payment_status: string;
  items: OrderItem[];
}

interface BusinessMeta {
  restaurantId?: string;
  restaurantName?: string;
  businessId?: string;
  businessName?: string;
  businessAddress?: string;
  branchId?: string;
  branchName?: string;
  branchAddress?: string;
  rewardPercentage?: number;
}

export default function AuditReportPage() {
  const searchParams = useSearchParams();
  const branchId = searchParams.get("branchId") || "";
  const shiftId = searchParams.get("shiftId") || "";
  const fromParam = searchParams.get("from") || "";
  const toParam = searchParams.get("to") || "";

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<{
    business: BusinessMeta | null;
    shift?: Record<string, unknown> | null;
    filter?: { branchId: string | null; from: string | null; to: string | null };
    summary: AuditSummary;
    orders: OrderData[];
    generatedAt: string;
    sha256Fingerprint?: string;
  } | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (branchId) q.set("branchId", branchId);
      if (shiftId) q.set("shiftId", shiftId);
      if (fromParam) q.set("from", fromParam);
      if (toParam) q.set("to", toParam);
      const url = `/api/audit/report?${q.toString()}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setReport(data);
      }
    } catch (err) {
      console.error("Error fetching audit report:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [branchId, shiftId, fromParam, toParam]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportJSON = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Reporte_Auditoria_${report.business?.restaurantName || "Rabbitty"}_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
        <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-400 font-medium text-sm tracking-wide">
          Generando Reporte de Auditoría y Cuadre de Caja...
        </p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
        <p className="text-rose-400 font-bold mb-4">No se pudo cargar el reporte de auditoría.</p>
        <button
          onClick={fetchReport}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold flex items-center gap-2"
        >
          <RefreshCw size={16} /> Reintentar
        </button>
      </div>
    );
  }

  const { business, summary, orders, generatedAt } = report;

  return (
    <div id="audit-printable-report" className="min-h-screen bg-[#08080C] text-gray-200 p-4 sm:p-6 lg:p-10 font-sans print:bg-white print:text-black print:p-0">
      <style jsx global>{`
        @media print {
          html, body {
            background: white !important;
            color: black !important;
            overflow: visible !important;
            height: auto !important;
          }
          aside, header, nav, .no-print {
            display: none !important;
            visibility: hidden !important;
          }
          #audit-printable-report,
          #audit-printable-report * {
            visibility: visible !important;
          }
          #audit-printable-report {
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
          }
          .print-border {
            border: 1px solid #e5e7eb !important;
          }
          .print-card {
            box-shadow: none !important;
            background: #f9fafb !important;
            border: 1px solid #e5e7eb !important;
            color: black !important;
          }
          .print-text-dark {
            color: #111827 !important;
          }
          .print-text-muted {
            color: #4b5563 !important;
          }
          @page {
            margin: 1.2cm;
            size: A4 portrait;
          }
        }
      `}</style>

      {/* Action Bar (Hidden on Print) */}
      <div className="max-w-5xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-pink-400 flex items-center gap-1.5 mb-1">
            <ShieldCheck size={14} /> Rabbitty Business Intelligence
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Reporte Oficial de Auditoría y Cuadre de Caja
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportJSON}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center gap-2 border border-white/10 transition-all cursor-pointer"
          >
            <Download size={15} /> Exportar JSON
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl bg-linear-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-pink-500/25 transition-all cursor-pointer"
          >
            <Printer size={15} /> Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      {/* Main Printable Document */}
      <div className="max-w-5xl mx-auto rounded-3xl border border-white/10 bg-[#0F0F16] p-6 sm:p-10 shadow-2xl print:border-none print:shadow-none print:bg-white print:p-0">
        
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-8 border-b border-white/10 print:border-gray-200 gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-linear-to-tr from-pink-500 via-purple-500 to-indigo-500 flex items-center justify-center text-white font-black text-2xl shadow-lg shrink-0 print:border print:border-gray-300">
              🐰
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white print:text-black m-0">
                  {business?.restaurantName || business?.businessName || "626 Café"}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 print:border-emerald-600 print:text-emerald-700">
                  Cuadre Verificado
                </span>
              </div>
              <p className="text-xs text-gray-400 print:text-gray-600 mt-1 flex items-center gap-1.5">
                <Store size={13} className="text-pink-400" />
                {business?.branchName ? `${business.branchName} • ` : ""}
                {business?.businessAddress || business?.branchAddress || "Bucerías, Nayarit, México"}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right text-xs text-gray-400 print:text-gray-600">
            <p className="font-mono text-gray-300 print:text-gray-800 font-semibold mb-0.5">
              Folio: AUD-{new Date(generatedAt).getTime().toString().slice(-8)}
            </p>
            <p className="flex items-center gap-1 sm:justify-end">
              <Calendar size={13} className="text-purple-400" />
              Fecha Emisión: {new Date(generatedAt).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })}
            </p>
            {report.shift && (
              <p className="text-[11px] text-amber-400 font-semibold mt-0.5">
                Turno #{String(report.shift.id).slice(0, 8)} ({String(report.shift.status)})
              </p>
            )}
            {report.filter?.from && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                Ventana: {new Date(report.filter.from).toLocaleDateString("es-MX")} al {report.filter.to ? new Date(report.filter.to).toLocaleDateString("es-MX") : "Presente"}
              </p>
            )}
            <p className="text-[11px] text-pink-400 font-semibold mt-0.5">
              Cashback Configurado: {business?.rewardPercentage || 25}% Bunz
            </p>
          </div>
        </div>

        {/* Financial Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 my-8">
          <div className="rounded-2xl p-4 bg-white/5 border border-white/5 print:bg-gray-50 print:border-gray-200">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 print:text-gray-600 flex items-center gap-1.5 mb-1">
              <Receipt size={14} className="text-pink-400" /> Total Ventas
            </p>
            <p className="text-2xl font-black text-white print:text-black m-0">
              ${summary.totalGross.toFixed(2)} <span className="text-xs font-semibold text-gray-400">MXN</span>
            </p>
            <p className="text-[10px] text-gray-400 print:text-gray-500 mt-1">
              {summary.totalOrders} transacciones completadas
            </p>
          </div>

          <div className="rounded-2xl p-4 bg-emerald-500/10 border border-emerald-500/20 print:bg-emerald-50 print:border-emerald-200">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 print:text-emerald-700 flex items-center gap-1.5 mb-1">
              <Banknote size={14} /> Total Efectivo
            </p>
            <p className="text-2xl font-black text-emerald-300 print:text-emerald-800 m-0">
              ${(summary.paymentBreakdown["CASH"]?.total || 0).toFixed(2)}{" "}
              <span className="text-xs font-semibold text-emerald-400/70">MXN</span>
            </p>
            <p className="text-[10px] text-emerald-400/80 print:text-emerald-600 mt-1">
              {summary.paymentBreakdown["CASH"]?.count || 0} cobros en efectivo
            </p>
          </div>

          <div className="rounded-2xl p-4 bg-cyan-500/10 border border-cyan-500/20 print:bg-cyan-50 print:border-cyan-200">
            <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 print:text-cyan-700 flex items-center gap-1.5 mb-1">
              <CreditCard size={14} /> Total Tarjetas
            </p>
            <p className="text-2xl font-black text-cyan-300 print:text-cyan-800 m-0">
              ${(summary.paymentBreakdown["CREDIT_CARD"]?.total || 0).toFixed(2)}{" "}
              <span className="text-xs font-semibold text-cyan-400/70">MXN</span>
            </p>
            <p className="text-[10px] text-cyan-400/80 print:text-cyan-600 mt-1">
              {summary.paymentBreakdown["CREDIT_CARD"]?.count || 0} cobros con tarjeta
            </p>
          </div>

          <div className="rounded-2xl p-4 bg-purple-500/10 border border-purple-500/20 print:bg-purple-50 print:border-purple-200">
            <p className="text-[11px] font-bold uppercase tracking-wider text-purple-400 print:text-purple-700 flex items-center gap-1.5 mb-1">
              <Coins size={14} /> Bunz Recompensa
            </p>
            <p className="text-2xl font-black text-purple-300 print:text-purple-800 m-0">
              {summary.totalBunzReward}{" "}
              <span className="text-xs font-semibold text-purple-400/70">Bunz</span>
            </p>
            <p className="text-[10px] text-purple-400/80 print:text-purple-600 mt-1">
              Bunz Pagados: {summary.totalBunzPaid} B
            </p>
          </div>
        </div>

        {/* Fiscal Breakdown & Popular Items */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Fiscal Breakdown */}
          <div className="rounded-2xl p-5 bg-white/5 border border-white/5 print:bg-white print:border-gray-200">
            <h3 className="text-sm font-black uppercase tracking-wider text-gray-300 print:text-gray-900 mb-4 flex items-center gap-2">
              <ShieldCheck size={16} className="text-pink-400" /> Desglose Impositivo & Fiscal (SAT)
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-white/5 print:border-gray-200">
                <span className="text-gray-400 print:text-gray-600">Base Imponible (Subtotal Neto)</span>
                <span className="font-bold text-white print:text-gray-900">${summary.totalSubtotal.toFixed(2)} MXN</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5 print:border-gray-200">
                <span className="text-gray-400 print:text-gray-600">IVA Trasladado (16%)</span>
                <span className="font-bold text-blue-400 print:text-blue-700">${summary.totalTax.toFixed(2)} MXN</span>
              </div>
              <div className="flex justify-between py-1.5 font-bold text-sm pt-2">
                <span className="text-white print:text-black">Total Fiscal Facturable</span>
                <span className="text-pink-400 print:text-pink-700">${summary.totalGross.toFixed(2)} MXN</span>
              </div>
            </div>
          </div>

          {/* Top Products */}
          <div className="rounded-2xl p-5 bg-white/5 border border-white/5 print:bg-white print:border-gray-200">
            <h3 className="text-sm font-black uppercase tracking-wider text-gray-300 print:text-gray-900 mb-4 flex items-center gap-2">
              <Sparkles size={16} className="text-purple-400" /> Productos Vendidos en el Período
            </h3>
            <div className="space-y-2 text-xs">
              {summary.productBreakdown.slice(0, 5).map((prod, idx) => (
                <div key={idx} className="flex justify-between items-center py-1 border-b border-white/5 print:border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-white/10 text-pink-400 flex items-center justify-center font-bold text-[10px] shrink-0 print:border print:border-gray-300">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-gray-200 print:text-gray-800">{prod.name}</span>
                    <span className="text-[10px] text-gray-400 print:text-gray-500">({prod.quantity} uds)</span>
                  </div>
                  <span className="font-bold text-white print:text-gray-900">${prod.revenue.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detailed Orders Audit Table */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-gray-300 print:text-gray-900 flex items-center gap-2">
              <Receipt size={16} className="text-pink-400" /> Registro Completo de Transacciones
            </h3>
            <span className="text-xs text-gray-400 print:text-gray-600">{orders.length} tickets registrados</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/5 print:border-gray-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-white/5 text-gray-400 print:bg-gray-100 print:text-gray-700 font-bold uppercase tracking-wider border-b border-white/10 print:border-gray-200">
                  <th className="py-3 px-3">Folio Ticket</th>
                  <th className="py-3 px-3">Fecha / Hora</th>
                  <th className="py-3 px-3">Productos Detalle</th>
                  <th className="py-3 px-3 text-center">Método</th>
                  <th className="py-3 px-3 text-right">Subtotal</th>
                  <th className="py-3 px-3 text-right">IVA (16%)</th>
                  <th className="py-3 px-3 text-right">Total MXN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 print:divide-gray-200">
                {orders.map((ord, idx) => (
                  <tr key={ord.order_id || idx} className="hover:bg-white/2 print:hover:bg-transparent">
                    <td className="py-3 px-3 font-mono font-bold text-pink-400 print:text-pink-700">
                      #{ord.order_id.slice(0, 8)}
                    </td>
                    <td className="py-3 px-3 text-gray-400 print:text-gray-600 whitespace-nowrap">
                      {new Date(ord.order_date).toLocaleString("es-MX", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-3 text-gray-300 print:text-gray-800">
                      {ord.items.map((it, i) => (
                        <div key={i} className="leading-relaxed">
                          <span className="font-semibold text-white print:text-black">{it.quantity}x</span> {it.name}
                        </div>
                      ))}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase ${
                          ord.payment_method === "CASH"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 print:border-emerald-600 print:text-emerald-700"
                            : "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 print:border-cyan-600 print:text-cyan-700"
                        }`}
                      >
                        {ord.payment_method === "CASH" ? "Efectivo" : "Tarjeta"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-gray-400 print:text-gray-600">
                      ${Number(ord.subtotal).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-blue-400 print:text-blue-700">
                      ${Number(ord.tax).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-white print:text-black">
                      ${Number(ord.total).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-white/10 text-white print:bg-gray-100 print:text-black font-black border-t-2 border-white/20 print:border-gray-300">
                  <td colSpan={4} className="py-3 px-3 uppercase tracking-wider text-right">
                    Totales Verificados en Auditoría:
                  </td>
                  <td className="py-3 px-3 text-right">${summary.totalSubtotal.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right text-blue-400 print:text-blue-700">
                    ${summary.totalTax.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-right text-pink-400 print:text-pink-700 text-sm">
                    ${summary.totalGross.toFixed(2)} MXN
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Document Footer & Security Signature */}
        <div className="mt-12 pt-6 border-t border-white/10 print:border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
          <div className="flex items-center gap-2 text-xs text-gray-400 print:text-gray-600">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>
              Certificación de Integridad Inmutable Rabbitty Core Engine • Transacciones cotejadas contra pagos bancarios y arqueo de caja.
            </span>
          </div>

          <div className="text-[10px] font-mono text-gray-400 print:text-gray-700 max-w-md break-all sm:text-right">
            <span className="font-bold text-gray-300 print:text-gray-900 block mb-0.5">SHA-256 DIGITAL FINGERPRINT:</span>
            {report.sha256Fingerprint ? report.sha256Fingerprint : "PENDING_VERIFICATION"}
          </div>
        </div>
      </div>
    </div>
  );
}
