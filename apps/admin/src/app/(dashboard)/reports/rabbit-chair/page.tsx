"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { trpc } from "../../../../lib/trpc-client";

/**
 * ── Reporte de La Silla (Rabbit Chair) ──────────────────────────────────────
 * Ocupación, ingreso, aporte promedio, tiempo de servicio y fila. La fuente es
 * la misma que el reporte por producto: órdenes con canal RABBIT_CHAIR.
 */

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  LIVE: "En vivo",
  SOLD_OUT: "Agotada",
  DONE: "Cerrada",
  CANCELLED: "Cancelada",
};

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(d);
}

export default function RabbitChairReportPage() {
  const [scope, setScope] = useState<"branch" | "business">("branch");
  const [from, setFrom] = useState(todayISO(30));
  const [to, setTo] = useState(todayISO(0));

  const report = trpc.rabbitChair.metrics.useQuery(
    { scope, from, to },
    { retry: false, refetchOnWindowFocus: false },
  );

  const data = report.data;
  const totals = data?.totals;
  const activations = (data?.activations ?? []) as Array<Record<string, any>>;

  const serviceRows = activations.filter((a) => a.avgServiceMin != null);
  const avgService =
    serviceRows.length > 0
      ? Math.round(
          (serviceRows.reduce((sum, a) => sum + Number(a.avgServiceMin), 0) / serviceRows.length) * 10,
        ) / 10
      : null;

  const money = (n: number) =>
    `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const exportCsv = () => {
    if (!activations.length) return;
    const headers = [
      "Activación",
      "Fecha",
      "Estado",
      "Cupo",
      "Vendidos",
      "Ocupación %",
      "Ingreso",
      "Costo staff",
      "Margen neto",
      "Aporte promedio",
      "Servicio promedio (min)",
      "En fila",
      "Convertidos",
    ];
    const rows = activations.map((a) => [
      a.name,
      a.startsAt ? new Date(a.startsAt).toLocaleString("es-MX") : "",
      STATUS_LABEL[a.status] ?? a.status,
      a.capacity,
      a.sold,
      a.occupancyPct,
      Number(a.revenue).toFixed(2),
      Number(a.staffCost).toFixed(2),
      Number(a.netMargin).toFixed(2),
      Number(a.avgContribution).toFixed(2),
      a.avgServiceMin ?? "",
      a.waiting,
      a.converted,
    ]);
    const csv =
      "\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join(
        "\n",
      );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RabbitChair_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 p-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/reports"
            className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Reportes
          </Link>
          <h1 className="mt-1 text-2xl font-black text-white">Rabbit Chair · La Silla</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Ocupación, ingreso, aporte promedio, tiempo de servicio y lista de espera. Misma
            fuente que el reporte por producto: órdenes con canal Rabbit Chair.
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={!activations.length}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-gray-200 hover:bg-white/10 disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500">
          Desde
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm font-bold text-white outline-none focus:border-cyan-500"
          />
        </label>
        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500">
          Hasta
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm font-bold text-white outline-none focus:border-cyan-500"
          />
        </label>
        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500">
          Alcance
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as "branch" | "business")}
            className="mt-1 block rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm font-bold text-white outline-none focus:border-cyan-500"
          >
            <option value="branch">Esta sucursal</option>
            <option value="business">Todo el negocio</option>
          </select>
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Activaciones", totals?.activations ?? 0],
          ["Ocupación", `${totals?.occupancyPct ?? 0}%`],
          ["Ingreso", money(totals?.revenue ?? 0)],
          ["Costo staff", money(totals?.staffCost ?? 0)],
          ["Margen neto", money(totals?.netMargin ?? 0)],
          ["Aporte promedio", money(totals?.avgContribution ?? 0)],
          ["Servicio promedio", avgService != null ? `${avgService} min` : "—"],
          ["Fila", `${totals?.waiting ?? 0} en espera · ${totals?.converted ?? 0} convertidos`],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
            <p className="m-0 text-sm font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      {report.isLoading ? (
        <p className="text-sm text-gray-500">Cargando el reporte…</p>
      ) : activations.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="m-0 text-sm font-black text-white">Sin activaciones en el rango</p>
          <p className="m-0 mt-1 text-xs text-gray-400">
            Cuando abras La Silla y se venda el primer lugar, aquí aparece el detalle.
          </p>
          <Link
            href="/marketing/rabbit-chair"
            className="mt-4 inline-block rounded-full bg-red-600 px-5 py-2.5 text-xs font-black text-white hover:bg-red-500"
          >
            Ir a Rabbit Chair
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-white/[0.03] text-[9px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-3 py-2">Activación</th>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Cupo</th>
                <th className="px-3 py-2 text-right">Vendidos</th>
                <th className="px-3 py-2 text-right">Ocupación</th>
                <th className="px-3 py-2 text-right">Ingreso</th>
                <th className="px-3 py-2 text-right">Costo staff</th>
                <th className="px-3 py-2 text-right">Margen neto</th>
                <th className="px-3 py-2 text-right">Aporte prom.</th>
                <th className="px-3 py-2 text-right">Servicio</th>
                <th className="px-3 py-2 text-right">Fila</th>
              </tr>
            </thead>
            <tbody>
              {activations.map((a) => (
                <tr key={a.id} className="border-t border-white/5">
                  <td className="px-3 py-2 font-bold text-gray-200">{a.name}</td>
                  <td className="px-3 py-2 text-gray-400">
                    {a.startsAt ? new Date(a.startsAt).toLocaleDateString("es-MX") : "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-300">{STATUS_LABEL[a.status] ?? a.status}</td>
                  <td className="px-3 py-2 text-right text-gray-300">{a.capacity}</td>
                  <td className="px-3 py-2 text-right text-gray-300">{a.sold}</td>
                  <td className="px-3 py-2 text-right text-gray-300">{a.occupancyPct}%</td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-300">
                    {money(a.revenue)}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-300">{money(a.staffCost)}</td>
                  <td className="px-3 py-2 text-right font-bold text-cyan-300">
                    {money(a.netMargin)}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-300">{money(a.avgContribution)}</td>
                  <td className="px-3 py-2 text-right text-gray-400">
                    {a.avgServiceMin != null ? `${a.avgServiceMin} min` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-400">
                    {a.waiting} · {a.converted}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-gray-500">
        El ingreso cuadra con Reportes → Por producto filtrando canal “Rabbit Chair”. El costo de
        staff extra (bartender/barista) se prorratea por lugar vendido. La lista de espera se
        muestra como <strong>en espera · convertidos</strong>.
      </p>
    </div>
  );
}
