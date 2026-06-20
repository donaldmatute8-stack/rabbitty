"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, toast } from "@rabbitty/ui";
import { FileText, XCircle, Search, Download, DollarSign, Receipt } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  INVOICED: "bg-green-500/20 text-green-400 border-green-500/30",
  CANCELLED: "bg-red-500/20 text-red-400 border-red-500/30",
  NONE: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export default function InvoicesPage() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: invoices } = trpc.invoices.list.useQuery({
    search: search || undefined,
    status: statusFilter || undefined,
  });
  const { data: stats } = trpc.invoices.stats.useQuery({});
  const cancelInvoice = trpc.invoices.cancel.useMutation({
    onSuccess: () => {
      utils.invoices.list.invalidate();
      utils.invoices.stats.invalidate();
      toast.success("Factura cancelada");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Facturación CFDI
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium">Historial de facturas emitidas y estatus CFDI</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por RFC o razón social..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-72 rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500/30"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="flex items-center gap-3 mb-3">
            <FileText className="h-5 w-5 text-blue-400" />
            <span className="text-sm text-gray-400 font-semibold">Total Facturas</span>
          </div>
          <p className="text-2xl font-black text-blue-400">{stats?.total ?? 0}</p>
        </Card>
        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="flex items-center gap-3 mb-3">
            <DollarSign className="h-5 w-5 text-green-400" />
            <span className="text-sm text-gray-400 font-semibold">Monto Facturado</span>
          </div>
          <p className="text-2xl font-black text-green-400">${(stats?.totalAmount ?? 0).toFixed(2)}</p>
        </Card>
        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="flex items-center gap-3 mb-3">
            <Receipt className="h-5 w-5 text-amber-400" />
            <span className="text-sm text-gray-400 font-semibold">IVA Total</span>
          </div>
          <p className="text-2xl font-black text-amber-400">${(stats?.totalTax ?? 0).toFixed(2)}</p>
        </Card>
        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="flex items-center gap-3 mb-3">
            <XCircle className="h-5 w-5 text-red-400" />
            <span className="text-sm text-gray-400 font-semibold">Canceladas</span>
          </div>
          <p className="text-2xl font-black text-red-400">{stats?.cancelled ?? 0}</p>
        </Card>
      </div>

      <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg text-white">Historial de Facturas</h3>
          <div className="flex gap-2">
            {["", "INVOICED", "CANCELLED"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  statusFilter === s
                    ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                    : "text-gray-400 border border-white/5 hover:border-white/20"
                }`}
              >
                {s === "" ? "Todas" : s === "INVOICED" ? "Vigentes" : "Canceladas"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-400">
                <th className="text-left py-3 px-2 text-xs font-bold uppercase tracking-wider">Folio</th>
                <th className="text-left py-3 px-2 text-xs font-bold uppercase tracking-wider">RFC</th>
                <th className="text-left py-3 px-2 text-xs font-bold uppercase tracking-wider">Razón Social</th>
                <th className="text-right py-3 px-2 text-xs font-bold uppercase tracking-wider">Monto</th>
                <th className="text-right py-3 px-2 text-xs font-bold uppercase tracking-wider">IVA</th>
                <th className="text-center py-3 px-2 text-xs font-bold uppercase tracking-wider">Status</th>
                <th className="text-right py-3 px-2 text-xs font-bold uppercase tracking-wider">Fecha</th>
                <th className="text-right py-3 px-2 text-xs font-bold uppercase tracking-wider">Acción</th>
              </tr>
            </thead>
            <tbody>
              {invoices?.items?.map((inv) => (
                <tr key={inv.id} className="border-b border-white/5 hover:bg-white/5 transition-all">
                  <td className="py-3.5 px-2">
                    <span className="text-white font-mono text-xs">{inv.id.slice(0, 8)}</span>
                  </td>
                  <td className="py-3.5 px-2">
                    <span className="text-white font-mono text-xs">{inv.rfc}</span>
                  </td>
                  <td className="py-3.5 px-2">
                    <span className="text-white text-sm">{inv.legalName}</span>
                  </td>
                  <td className="py-3.5 px-2 text-right">
                    <span className="text-green-400 font-bold">${inv.total.toFixed(2)}</span>
                  </td>
                  <td className="py-3.5 px-2 text-right">
                    <span className="text-amber-400">${inv.tax.toFixed(2)}</span>
                  </td>
                  <td className="py-3.5 px-2 text-center">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${STATUS_COLORS[inv.status] || STATUS_COLORS.NONE}`}>
                      {inv.status === "INVOICED" ? "Vigente" : inv.status === "CANCELLED" ? "Cancelada" : "N/A"}
                    </span>
                  </td>
                  <td className="py-3.5 px-2 text-right text-gray-400 text-xs">
                    {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString("es-MX") : ""}
                  </td>
                  <td className="py-3.5 px-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {inv.pdfUrl && (
                        <a href={inv.pdfUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-white/5 bg-white/5 p-1.5 text-gray-400 hover:text-white hover:bg-white/10 transition-all">
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                      {inv.status === "INVOICED" && (
                        <button
                          onClick={() => cancelInvoice.mutate({ id: inv.id })}
                          disabled={cancelInvoice.isPending}
                          className="rounded-xl border border-red-500/10 bg-red-500/5 p-2 text-red-400 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 transition-all duration-300 disabled:opacity-50"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!invoices?.items?.length && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-500 text-sm">
                    No hay facturas registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
