'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
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
  Sparkles,
} from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';

interface AuditSummary {
  totalOrders: number;
  totalGross: number;
  totalSubtotal: number;
  totalTax: number;
  totalBunzPaid: number;
  totalBunzReward: number;
  paymentBreakdown: Record<string, { count: number; total: number }>;
  totalExpenses?: number;
  totalSafeWithdrawals?: number;
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
  businessId?: string;
  businessName?: string;
  businessAddress?: string;
  rewardPercentage?: number;
  branchId?: string;
  branchName?: string;
}

export default function MobileAuditReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const businessId = searchParams.get('businessId') || '';
  const shiftId = searchParams.get('shiftId') || '';
  const fromParam = searchParams.get('from') || '';
  const toParam = searchParams.get('to') || '';

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<{
    business: BusinessMeta | null;
    shift?: Record<string, unknown> | null;
    filter?: { from: string | null; to: string | null };
    summary: AuditSummary;
    orders: OrderData[];
    generatedAt: string;
    sha256Fingerprint?: string;
  } | null>(null);

  useEffect(() => {
    PlatformBridge.getAuthHeaders()
      .then((headers) => {
        const q = new URLSearchParams();
        if (businessId) q.set('businessId', businessId);
        if (shiftId) q.set('shiftId', shiftId);
        if (fromParam) q.set('from', fromParam);
        if (toParam) q.set('to', toParam);
        const url = `/api/business/audit-report?${q.toString()}`;
        return fetch(url, { headers });
      })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setReport(data);
        }
      })
      .catch((err) => console.error('Error loading mobile audit report:', err))
      .finally(() => setLoading(false));
  }, [businessId, shiftId, fromParam, toParam]);

  const handlePrint = () => {
    PlatformBridge.hapticFeedback('medium');
    window.print();
  };

  const handleExportJSON = () => {
    if (!report) return;
    PlatformBridge.hapticFeedback('light');
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_Auditoria_${report.business?.businessName || 'Comercio'}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
        style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      >
        <div className="w-12 h-12 border-4 border-[#E91E63] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-(--text-secondary)">Generando Reporte de Auditoría...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
        style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      >
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 w-9 h-9 rounded-full flex items-center justify-center border border-(--border-subtle) bg-(--bg-elevated) text-(--text-primary)"
        >
          <ArrowLeft size={18} />
        </button>
        <p className="text-rose-400 font-bold mb-2">No se encontraron datos para este comercio.</p>
        <p className="text-xs text-(--text-muted)">Verifica que el comercio tenga tickets registrados.</p>
      </div>
    );
  }

  const { business, summary, orders, generatedAt } = report;

  return (
    <div
      className="min-h-screen font-sans pb-20 print:bg-white print:text-black print:pb-0"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            margin: 1cm;
            size: A4 portrait;
          }
        }
      `}</style>

      {/* Top Header */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b no-print backdrop-blur-md"
        style={{
          background: 'rgba(12, 10, 16, 0.85)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <button
          onClick={() => {
            PlatformBridge.hapticFeedback('light');
            router.back();
          }}
          className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        >
          <ArrowLeft size={18} />
        </button>

        <span className="text-xs font-black tracking-wider uppercase text-(--text-primary)">
          Cuadre & Reporte Oficial
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJSON}
            title="Descargar JSON"
            className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            <Download size={16} />
          </button>
          <button
            onClick={handlePrint}
            title="Imprimir / PDF"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-[#E91E63] text-white cursor-pointer active:scale-90 transition-transform border-none shadow-sm"
          >
            <Printer size={16} />
          </button>
        </div>
      </div>

      {/* Document Body */}
      <div className="px-4 pt-5 max-w-xl mx-auto print:max-w-none print:p-0">
        {/* Brand Card */}
        <div
          className="rounded-3xl p-5 mb-5 border shadow-xl print:border-gray-300 print:bg-white"
          style={{
            background: 'linear-gradient(135deg, rgba(233,30,99,0.12) 0%, rgba(138,43,226,0.12) 100%)',
            borderColor: 'rgba(233,30,99,0.25)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#E91E63] flex items-center gap-1 mb-1">
                <ShieldCheck size={13} /> Rabbitty Business Certification
              </span>
              <h2 className="text-2xl font-black m-0 text-white print:text-black">
                {business?.businessName || business?.branchName || '626 Café'}
              </h2>
              <p className="text-xs text-(--text-secondary) print:text-gray-600 mt-1 flex items-center gap-1">
                <Store size={12} className="text-[#E91E63]" />
                {business?.businessAddress || 'Av. Lázaro Cárdenas #74, Bucerías, Nayarit'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-[#E91E63] to-purple-600 flex items-center justify-center text-2xl shadow-md shrink-0">
              ☕
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 print:border-gray-200 flex justify-between items-center text-[11px] text-(--text-muted) print:text-gray-600">
            <span>Folio: AUD-{new Date(generatedAt).getTime().toString().slice(-8)}</span>
            <span className="flex items-center gap-1">
              <Calendar size={11} /> {new Date(generatedAt).toLocaleDateString('es-MX')}
            </span>
          </div>
        </div>

        {/* Highlights Grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <div
            className="rounded-2xl p-3.5 border print:border-gray-300"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
          >
            <p className="text-[10px] font-black uppercase tracking-wider text-(--text-muted) flex items-center gap-1 m-0 mb-1">
              <Receipt size={12} className="text-[#E91E63]" /> Venta Total
            </p>
            <p className="text-xl font-black text-(--text-primary) m-0">
              ${summary.totalGross.toFixed(2)}{' '}
              <span className="text-[11px] font-semibold text-(--text-muted)">MXN</span>
            </p>
            <p className="text-[9px] text-(--text-muted) mt-0.5 m-0">{summary.totalOrders} órdenes validadas</p>
          </div>

          <div
            className="rounded-2xl p-3.5 border border-emerald-500/25 bg-emerald-500/10 print:bg-emerald-50 print:border-emerald-200"
          >
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400 print:text-emerald-800 flex items-center gap-1 m-0 mb-1">
              <Banknote size={12} /> En Efectivo
            </p>
            <p className="text-xl font-black text-emerald-300 print:text-emerald-900 m-0">
              ${(summary.paymentBreakdown['CASH']?.total || 0).toFixed(2)}{' '}
              <span className="text-[11px] font-semibold text-emerald-400/70">MXN</span>
            </p>
            <p className="text-[9px] text-emerald-400/80 print:text-emerald-700 mt-0.5 m-0">
              {summary.paymentBreakdown['CASH']?.count || 0} cobros arqueados
            </p>
          </div>

          <div
            className="rounded-2xl p-3.5 border border-cyan-500/25 bg-cyan-500/10 print:bg-cyan-50 print:border-cyan-200"
          >
            <p className="text-[10px] font-black uppercase tracking-wider text-cyan-400 print:text-cyan-800 flex items-center gap-1 m-0 mb-1">
              <CreditCard size={12} /> Con Tarjeta
            </p>
            <p className="text-xl font-black text-cyan-300 print:text-cyan-900 m-0">
              ${(summary.paymentBreakdown['CREDIT_CARD']?.total || 0).toFixed(2)}{' '}
              <span className="text-[11px] font-semibold text-cyan-400/70">MXN</span>
            </p>
            <p className="text-[9px] text-cyan-400/80 print:text-cyan-700 mt-0.5 m-0">
              {summary.paymentBreakdown['CREDIT_CARD']?.count || 0} terminal bancaria
            </p>
          </div>

          <div
            className="rounded-2xl p-3.5 border border-purple-500/25 bg-purple-500/10 print:bg-purple-50 print:border-purple-200"
          >
            <p className="text-[10px] font-black uppercase tracking-wider text-purple-400 print:text-purple-800 flex items-center gap-1 m-0 mb-1">
              <Coins size={12} /> Bunz Emitidos
            </p>
            <p className="text-xl font-black text-purple-300 print:text-purple-900 m-0">
              {summary.totalBunzReward}{' '}
              <span className="text-[11px] font-semibold text-purple-400/70">Bunz</span>
            </p>
            <p className="text-[9px] text-purple-400/80 print:text-purple-700 mt-0.5 m-0">
              Tasa Cashback: {business?.rewardPercentage || 25}%
            </p>
          </div>
        </div>

        {/* Fiscal Card */}
        <div
          className="rounded-2xl p-4 mb-5 border print:border-gray-300"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <p className="text-xs font-black uppercase tracking-wider text-(--text-primary) flex items-center gap-1.5 mb-3">
            <ShieldCheck size={14} className="text-[#E91E63]" /> Resumen Impositivo
          </p>
          <div className="space-y-2 text-xs">
            {(summary.totalExpenses != null || summary.totalSafeWithdrawals != null) && (
              <>
                <div className="flex justify-between py-1 border-b border-white/5 print:border-gray-200">
                  <span className="text-(--text-muted)">Gastos de operación (insumos)</span>
                  <span className="font-bold text-orange-300 print:text-orange-700">-${(summary.totalExpenses ?? 0).toFixed(2)} MXN</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5 print:border-gray-200">
                  <span className="text-(--text-muted)">Retiros / sangría a caja fuerte</span>
                  <span className="font-bold text-amber-300 print:text-amber-700">-${(summary.totalSafeWithdrawals ?? 0).toFixed(2)} MXN</span>
                </div>
              </>
            )}
            <div className="flex justify-between py-1 border-b border-white/5 print:border-gray-200">
              <span className="text-(--text-muted)">Subtotal Neto (Base 0% / 16%)</span>
              <span className="font-bold text-(--text-primary)">${summary.totalSubtotal.toFixed(2)} MXN</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5 print:border-gray-200">
              <span className="text-(--text-muted)">IVA Trasladado (16%)</span>
              <span className="font-bold text-blue-400">${summary.totalTax.toFixed(2)} MXN</span>
            </div>
            <div className="flex justify-between py-1 font-bold text-sm pt-1">
              <span className="text-(--text-primary)">Total Cuadrado</span>
              <span className="text-[#E91E63]">${summary.totalGross.toFixed(2)} MXN</span>
            </div>
          </div>
        </div>

        {/* Top Sold Products */}
        <div
          className="rounded-2xl p-4 mb-5 border print:border-gray-300"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <p className="text-xs font-black uppercase tracking-wider text-(--text-primary) flex items-center gap-1.5 mb-3">
            <Sparkles size={14} className="text-purple-400" /> Ítems Vendidos
          </p>
          <div className="space-y-2 text-xs">
            {summary.productBreakdown.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-1 border-b border-white/5 print:border-gray-200"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-[#E91E63]">{item.quantity}x</span>
                  <span className="font-semibold text-(--text-primary)">{item.name}</span>
                </div>
                <span className="font-bold text-(--text-secondary)">${item.revenue.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Transactions List */}
        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-wider text-(--text-primary) mb-3 flex items-center justify-between">
            <span>Tickets de Venta ({orders.length})</span>
            <span className="text-[10px] text-(--text-muted)">Cuadre al 100%</span>
          </p>

          <div className="space-y-2.5">
            {orders.map((ord, idx) => (
              <div
                key={ord.order_id || idx}
                className="rounded-2xl p-3.5 border print:border-gray-300"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-xs font-mono font-bold text-[#E91E63]">
                      #{ord.order_id.slice(0, 8)}
                    </span>
                    <p className="text-[10px] text-(--text-muted) m-0 mt-0.5">
                      {new Date(ord.order_date).toLocaleString('es-MX', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        ord.payment_method === 'CASH'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                      }`}
                    >
                      {ord.payment_method === 'CASH' ? 'Efectivo' : 'Tarjeta'}
                    </span>
                    <p className="text-sm font-black text-(--text-primary) m-0 mt-1">
                      ${Number(ord.total).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 print:border-gray-200 text-xs text-(--text-secondary) space-y-0.5">
                  {ord.items.map((it, i) => (
                    <div key={i} className="flex justify-between">
                      <span>
                        {it.quantity}x {it.name}
                      </span>
                      <span className="font-medium">${Number(it.total_price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security Stamp Footer */}
        <div className="pt-4 border-t border-white/10 print:border-gray-200 text-center pb-8">
          <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 mb-1">
            <CheckCircle2 size={15} />
            <span className="font-bold">Cuadre Validado & Inmutable</span>
          </div>
          <p className="text-[10px] text-(--text-muted) m-0 mb-2">
            Generado por Rabbitty Core POS • Bucerías, Nayarit
          </p>
          <div className="text-[9px] font-mono text-(--text-muted) max-w-sm mx-auto break-all bg-white/5 p-2 rounded-xl border border-white/5 print:border-gray-300 print:text-black">
            <span className="font-bold text-(--text-secondary) block mb-0.5">SHA-256 CERTIFIED DIGEST:</span>
            {report.sha256Fingerprint || 'PENDING'}
          </div>
        </div>
      </div>
    </div>
  );
}
