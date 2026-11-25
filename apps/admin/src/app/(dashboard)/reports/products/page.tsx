"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Download, Search } from "lucide-react";
import { trpc } from "../../../../lib/trpc-client";

/**
 * ── Reporte por producto y fecha ────────────────────────────────────────────
 * Contabilidad / administración: elige producto(s), rango y canal; obtiene
 * unidades, ingreso, costo, margen e IVA. Scope: sucursal o negocio completo.
 */

const CHANNELS = [
  { value: "ALL", label: "Todos los canales" },
  { value: "POS", label: "POS / mostrador" },
  { value: "APP", label: "App Rabbitty" },
  { value: "RABBIT_CHAIR", label: "Rabbit Chair (La Silla)" },
  { value: "UBER_EATS", label: "Uber Eats" },
  { value: "UBER_DIRECT", label: "Uber Direct" },
  { value: "RAPPI", label: "Rappi" },
];

const KINDS = [
  { value: "", label: "Todo el catálogo" },
  { value: "DISH", label: "Platillos / menú" },
  { value: "PRODUCT", label: "Productos de tienda" },
];

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(d);
}

export default function ProductReportPage() {
  const params = useSearchParams();
  const [scope, setScope] = useState<"branch" | "business">("branch");
  const [from, setFrom] = useState(params.get("from") || todayISO(30));
  const [to, setTo] = useState(params.get("to") || todayISO(0));
  const [channel, setChannel] = useState(params.get("channel") || "ALL");
  const [kind, setKind] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const products = trpc.analytics.listReportProducts.useQuery({}, { retry: false });

  const filteredCatalog = useMemo(() => {
    const list = (products.data ?? []) as Array<Record<string, any>>;
    const q = query.trim().toLowerCase();
    return list
      .filter((p) => (kind ? p.kind === kind : true))
      .filter((p) => (q ? String(p.name).toLowerCase().includes(q) : true))
      .slice(0, 60);
  }, [products.data, kind, query]);

  const report = trpc.analytics.getProductReport.useQuery(
    {
      scope,
      from,
      to,
      channel,
      kind: (kind || undefined) as any,
      productIds: selected.length > 0 ? selected : undefined,
    },
    { retry: false, refetchOnWindowFocus: false },
  );

  const data = report.data;
  const totals = data?.totals;

  const exportCsv = () => {
    if (!data?.products?.length) return;
    const headers = ["Producto", "Tipo", "Categoría", "Unidades", "Ingreso", "Costo", "Margen", "Margen %", "IVA"];
    const rows = data.products.map((p: any) => [
      p.name,
      p.kind === "PRODUCT" ? "Tienda" : "Menú",
      p.category,
      p.qty,
      p.revenue.toFixed(2),
      p.cost.toFixed(2),
      p.margin.toFixed(2),
      `${p.marginPct}%`,
      p.tax.toFixed(2),
    ]);
    const csv = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Productos_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const money = (n: number) =>
    `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-5 p-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/reports" className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Reportes
          </Link>
          <h1 className="mt-1 text-2xl font-black text-white">Reporte por producto</h1>
          <p className="mt-1 text-sm text-gray-400">
            Elige producto(s), fecha y canal. Incluye costo, margen e IVA por renglón.
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={!data?.products?.length}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-gray-200 hover:bg-white/10 disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2 lg:grid-cols-6">
        <label className="block">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">Alcance</span>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as "branch" | "business")}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-xs text-white outline-none"
          >
            <option value="branch">Esta sucursal</option>
            <option value="business">Todo el negocio</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">Desde</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-xs text-white outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">Hasta</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-xs text-white outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">Canal</span>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-xs text-white outline-none"
          >
            {CHANNELS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">Tipo</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-xs text-white outline-none"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">Buscar</span>
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/40 px-2">
            <Search className="h-3.5 w-3.5 text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Producto…"
              className="w-full bg-transparent py-2 text-xs text-white outline-none"
            />
          </div>
        </label>
      </div>

      {/* Selector de productos */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between">
          <p className="m-0 text-xs font-black text-white">
            Productos {selected.length > 0 ? `(${selected.length} seleccionados)` : "(todos)"}
          </p>
          {selected.length > 0 && (
            <button onClick={() => setSelected([])} className="text-[10px] font-bold text-cyan-300 underline">
              Limpiar
            </button>
          )}
        </div>
        <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
          {filteredCatalog.map((p) => {
            const active = selected.includes(String(p.id));
            return (
              <button
                key={p.id}
                onClick={() =>
                  setSelected((prev) =>
                    active ? prev.filter((x) => x !== String(p.id)) : [...prev, String(p.id)],
                  )
                }
                className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                  active ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" : "border-white/10 bg-white/5 text-gray-300"
                }`}
                title={`${p.category ?? ""} · ${p.kind === "PRODUCT" ? "Tienda" : "Menú"}`}
              >
                {p.name}
              </button>
            );
          })}
          {filteredCatalog.length === 0 && <p className="m-0 text-[11px] text-gray-500">Sin resultados.</p>}
        </div>
      </div>

      {/* Totales */}
      {totals && (
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Unidades", totals.qty],
            ["Ingreso", money(totals.revenue)],
            ["Costo", money(totals.cost)],
            ["Margen", `${money(totals.margin)} (${totals.marginPct}%)`],
            ["IVA", money(totals.tax)],
            ["Productos", data?.products.length ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
              <p className="m-0 text-sm font-black text-white">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Categoría</th>
              <th className="px-3 py-2 text-right">Unid.</th>
              <th className="px-3 py-2 text-right">Ingreso</th>
              <th className="px-3 py-2 text-right">Costo</th>
              <th className="px-3 py-2 text-right">Margen</th>
              <th className="px-3 py-2 text-right">IVA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-gray-300">
            {(data?.products ?? []).map((p: any) => (
              <tr key={`${p.name}-${p.category}`}>
                <td className="px-3 py-2 font-bold text-white">{p.name}</td>
                <td className="px-3 py-2">{p.kind === "PRODUCT" ? "Tienda" : "Menú"}</td>
                <td className="px-3 py-2">{p.category}</td>
                <td className="px-3 py-2 text-right">{p.qty}</td>
                <td className="px-3 py-2 text-right">{money(p.revenue)}</td>
                <td className="px-3 py-2 text-right">{money(p.cost)}</td>
                <td className="px-3 py-2 text-right">{money(p.margin)} ({p.marginPct}%)</td>
                <td className="px-3 py-2 text-right">{money(p.tax)}</td>
              </tr>
            ))}
            {!data?.products?.length && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                  Sin ventas para ese filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Canales y métodos */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="m-0 text-xs font-black text-white">Por canal</p>
          <ul className="m-0 mt-2 space-y-1 p-0 text-[11px] text-gray-400">
            {(data?.channels ?? []).map((c: any) => (
              <li key={c.channel} className="flex justify-between">
                <span>{c.channel}</span>
                <span className="font-bold text-gray-200">{money(c.revenue)} · {c.qty} u.</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="m-0 text-xs font-black text-white">Por método de pago</p>
          <ul className="m-0 mt-2 space-y-1 p-0 text-[11px] text-gray-400">
            {(data?.methods ?? []).map((m: any) => (
              <li key={m.method} className="flex justify-between">
                <span>{m.method}</span>
                <span className="font-bold text-gray-200">{money(m.revenue)} · {m.qty} u.</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {report.isLoading && <p className="text-xs text-gray-500">Calculando…</p>}
      {report.error && <p className="text-xs font-bold text-red-400">{report.error.message}</p>}
    </div>
  );
}
