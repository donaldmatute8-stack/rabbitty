"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, toast } from "@rabbitty/ui";
import {
  AlertTriangle,
  Download,
  FileCode2,
  FileText,
  Loader2,
  Plus,
  Receipt,
  Search,
  XCircle,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  INVOICED: "bg-green-500/20 text-green-400 border-green-500/30",
  CANCELLED: "bg-red-500/20 text-red-400 border-red-500/30",
  CANCELLATION_PENDING: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  FAILED: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  NONE: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  INVOICED: "Vigente",
  CANCELLED: "Cancelada",
  CANCELLATION_PENDING: "En proceso",
  FAILED: "Fallida",
  NONE: "N/A",
};

const MOTIVES = [
  { value: "01", label: "01 · Comprobante con errores con relación" },
  { value: "02", label: "02 · Comprobante con errores sin relación" },
  { value: "03", label: "03 · No se llevó a cabo la operación" },
  { value: "04", label: "04 · Operación nominativa en factura global" },
];

const CFDI_USES = ["G01", "G03", "I01", "I08", "D01", "P01", "CP01", "S01"];
const TAX_REGIMES = ["601", "603", "605", "606", "612", "614", "616", "620", "621", "626"];
const PAYMENT_FORMS = [
  { value: "01", label: "01 · Efectivo" },
  { value: "03", label: "03 · Transferencia" },
  { value: "04", label: "04 · Tarjeta de crédito" },
  { value: "28", label: "28 · Tarjeta de débito" },
];

const FIELD =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-pink-500 focus:outline-none";

export default function InvoicesPage() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelFor, setCancelFor] = useState<{ id: string; uuid?: string | null } | null>(null);
  const [motive, setMotive] = useState("02");
  const [replacementUuid, setReplacementUuid] = useState("");
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({
    orderId: "",
    rfc: "",
    name: "",
    taxRegime: "601",
    cfdiUse: "G03",
    zipCode: "",
    email: "",
    paymentForm: "01",
  });

  const { data: invoices } = trpc.invoices.list.useQuery({
    search: search || undefined,
    status: statusFilter || undefined,
  });
  const { data: stats } = trpc.invoices.stats.useQuery({});
  const connection = trpc.cfdi.getConnection.useQuery({});
  const noPac = connection.isFetched && !connection.data?.active;

  const cancelInvoice = trpc.invoices.cancel.useMutation({
    onSuccess: (data) => {
      utils.invoices.list.invalidate();
      utils.invoices.stats.invalidate();
      setCancelFor(null);
      setReplacementUuid("");
      toast.success(
        data.status === "pending"
          ? "Cancelación enviada al SAT; queda en proceso"
          : "Factura cancelada",
      );
    },
    onError: (e) => toast.error(e.message),
  });

  const issueInvoice = trpc.cfdi.issueOrder.useMutation({
    onSuccess: (data: any) => {
      const failed = data && typeof data === "object" && "success" in data && !data.success;
      if (failed) {
        toast.error(data.error ?? "El PAC rechazó la factura");
        utils.invoices.list.invalidate();
        return;
      }
      utils.invoices.list.invalidate();
      utils.invoices.stats.invalidate();
      setIssueOpen(false);
      setIssueForm((f) => ({ ...f, orderId: "" }));
      toast.success("Factura timbrada");
    },
    onError: (e) => toast.error(e.message),
  });

  const download = async (invoiceId: string, format: "xml" | "pdf") => {
    setBusy(`${invoiceId}-${format}`);
    try {
      const result = await utils.cfdi.download.fetch({ invoiceId, format });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], {
        type: format === "xml" ? "application/xml" : "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const canIssue =
    issueForm.orderId.trim().length > 0 &&
    issueForm.rfc.trim().length >= 12 &&
    issueForm.name.trim().length > 0 &&
    issueForm.zipCode.trim().length === 5;

  return (
    <div className="space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Facturación CFDI
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium">
              Se timbra con el PAC que conectes. Sin PAC configurado no se emite ningún comprobante.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar por RFC o razón social..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500/30"
              />
            </div>
            <button
              onClick={() => setIssueOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-pink-700"
            >
              <Plus className="h-4 w-4" />
              Emitir factura
            </button>
          </div>
        </div>
      </div>

      {noPac && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="m-0 flex items-center gap-2 text-sm text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            No hay PAC conectado: las facturas no se pueden timbrar todavía.
          </p>
          <a
            href="/settings/billing"
            className="rounded-xl bg-amber-500/20 px-4 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/30"
          >
            Conectar mi PAC
          </a>
        </div>
      )}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-3">
            <FileText className="h-5 w-5 text-blue-400" />
            <span className="text-sm text-gray-400 font-semibold">Total Facturas</span>
          </div>
          <p className="text-2xl font-black text-blue-400">{stats?.total ?? 0}</p>
        </Card>
        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-3">
            <Receipt className="h-5 w-5 text-green-400" />
            <span className="text-sm text-gray-400 font-semibold">Monto Facturado</span>
          </div>
          <p className="text-2xl font-black text-green-400">${(stats?.totalAmount ?? 0).toFixed(2)}</p>
        </Card>
        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-3">
            <FileText className="h-5 w-5 text-amber-400" />
            <span className="text-sm text-gray-400 font-semibold">IVA Total</span>
          </div>
          <p className="text-2xl font-black text-amber-400">${(stats?.totalTax ?? 0).toFixed(2)}</p>
        </Card>
        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-3">
            <XCircle className="h-5 w-5 text-red-400" />
            <span className="text-sm text-gray-400 font-semibold">Canceladas</span>
          </div>
          <p className="text-2xl font-black text-red-400">{stats?.cancelled ?? 0}</p>
        </Card>
      </div>

      <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg text-white">Historial de Facturas</h3>
          <div className="flex gap-2">
            {["", "INVOICED", "FAILED", "CANCELLED"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  statusFilter === s
                    ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                    : "text-gray-400 border border-white/5 hover:border-white/20"
                }`}
              >
                {s === "" ? "Todas" : s === "INVOICED" ? "Vigentes" : s === "FAILED" ? "Fallidas" : "Canceladas"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-400">
                <th className="text-left py-3 px-2 text-xs font-bold uppercase tracking-wider">UUID / Folio</th>
                <th className="text-left py-3 px-2 text-xs font-bold uppercase tracking-wider">RFC</th>
                <th className="text-left py-3 px-2 text-xs font-bold uppercase tracking-wider">Razón Social</th>
                <th className="text-right py-3 px-2 text-xs font-bold uppercase tracking-wider">Monto</th>
                <th className="text-right py-3 px-2 text-xs font-bold uppercase tracking-wider">IVA</th>
                <th className="text-center py-3 px-2 text-xs font-bold uppercase tracking-wider">Status</th>
                <th className="text-right py-3 px-2 text-xs font-bold uppercase tracking-wider">Fecha</th>
                <th className="text-right py-3 px-2 text-xs font-bold uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invoices?.items?.map((inv: any) => (
                <tr key={inv.id} className="border-b border-white/5 hover:bg-white/5 transition-all">
                  <td className="py-3.5 px-2">
                    <p className="m-0 text-white font-mono text-[11px]">
                      {inv.uuid ? `${inv.uuid.slice(0, 8)}…` : inv.id.slice(0, 8)}
                    </p>
                    <p className="m-0 text-[10px] text-gray-500">{inv.provider ?? "sin PAC"} · {inv.environment ?? "—"}</p>
                  </td>
                  <td className="py-3.5 px-2">
                    <span className="text-white font-mono text-xs">{inv.rfc}</span>
                  </td>
                  <td className="py-3.5 px-2">
                    <span className="text-white text-sm">{inv.legalName}</span>
                    {inv.status === "FAILED" && inv.errorMessage && (
                      <p className="m-0 mt-0.5 max-w-xs truncate text-[10px] text-red-400" title={inv.errorMessage}>
                        {inv.errorMessage}
                      </p>
                    )}
                  </td>
                  <td className="py-3.5 px-2 text-right">
                    <span className="text-green-400 font-bold">${Number(inv.total).toFixed(2)}</span>
                  </td>
                  <td className="py-3.5 px-2 text-right">
                    <span className="text-amber-400">${Number(inv.tax).toFixed(2)}</span>
                  </td>
                  <td className="py-3.5 px-2 text-center">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${STATUS_COLORS[inv.status] || STATUS_COLORS.NONE}`}>
                      {STATUS_LABELS[inv.status] ?? "N/A"}
                    </span>
                  </td>
                  <td className="py-3.5 px-2 text-right text-gray-400 text-xs">
                    {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString("es-MX") : ""}
                  </td>
                  <td className="py-3.5 px-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {inv.pacInvoiceId && (
                        <>
                          <button
                            title="Descargar XML"
                            onClick={() => download(inv.id, "xml")}
                            disabled={busy === `${inv.id}-xml`}
                            className="rounded-lg border border-white/5 bg-white/5 p-1.5 text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-40"
                          >
                            {busy === `${inv.id}-xml` ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode2 className="h-4 w-4" />}
                          </button>
                          <button
                            title="Descargar PDF"
                            onClick={() => download(inv.id, "pdf")}
                            disabled={busy === `${inv.id}-pdf`}
                            className="rounded-lg border border-white/5 bg-white/5 p-1.5 text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-40"
                          >
                            {busy === `${inv.id}-pdf` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          </button>
                        </>
                      )}
                      {inv.status === "INVOICED" && (
                        <button
                          title="Cancelar factura"
                          onClick={() => { setCancelFor({ id: inv.id, uuid: inv.uuid }); setMotive("02"); }}
                          className="rounded-lg border border-red-500/10 bg-red-500/5 p-1.5 text-red-400 hover:bg-red-500/20 hover:text-red-300"
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

      {/* ── Modal: emitir factura ── */}
      {issueOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0f0f11] p-6 shadow-2xl">
            <h3 className="m-0 text-lg font-black">Emitir factura</h3>
            <p className="m-0 mt-1 text-xs text-gray-500">
              Se timbra con el PAC de tu negocio. Si no está conectado, la orden no se marca como facturada.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-bold text-gray-500">ID de la orden</label>
                <input className={FIELD} value={issueForm.orderId} onChange={(e) => setIssueForm((f) => ({ ...f, orderId: e.target.value.trim() }))} placeholder="uuid de la orden" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-500">RFC</label>
                <input className={FIELD} value={issueForm.rfc} onChange={(e) => setIssueForm((f) => ({ ...f, rfc: e.target.value.toUpperCase() }))} maxLength={13} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-500">Razón social</label>
                <input className={FIELD} value={issueForm.name} onChange={(e) => setIssueForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-500">Régimen fiscal</label>
                <select className={FIELD} value={issueForm.taxRegime} onChange={(e) => setIssueForm((f) => ({ ...f, taxRegime: e.target.value }))}>
                  {TAX_REGIMES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-500">Uso del CFDI</label>
                <select className={FIELD} value={issueForm.cfdiUse} onChange={(e) => setIssueForm((f) => ({ ...f, cfdiUse: e.target.value }))}>
                  {CFDI_USES.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-500">Código postal fiscal</label>
                <input className={FIELD} value={issueForm.zipCode} onChange={(e) => setIssueForm((f) => ({ ...f, zipCode: e.target.value.replace(/\D/g, "") }))} maxLength={5} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-500">Forma de pago</label>
                <select className={FIELD} value={issueForm.paymentForm} onChange={(e) => setIssueForm((f) => ({ ...f, paymentForm: e.target.value }))}>
                  {PAYMENT_FORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-bold text-gray-500">Correo (opcional)</label>
                <input className={FIELD} value={issueForm.email} onChange={(e) => setIssueForm((f) => ({ ...f, email: e.target.value }))} placeholder="cliente@ejemplo.mx" />
              </div>
            </div>

            {issueInvoice.data && (issueInvoice.data as any).success === false && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <span>{(issueInvoice.data as any).error}</span>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setIssueOpen(false)} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-gray-300 hover:bg-white/5">
                Cerrar
              </button>
              <button
                onClick={() =>
                  issueInvoice.mutate({
                    orderId: issueForm.orderId,
                    paymentForm: issueForm.paymentForm,
                    receiver: {
                      rfc: issueForm.rfc.trim(),
                      name: issueForm.name.trim(),
                      taxRegime: issueForm.taxRegime,
                      cfdiUse: issueForm.cfdiUse,
                      zipCode: issueForm.zipCode.trim(),
                      email: issueForm.email.trim(),
                    },
                  })
                }
                disabled={!canIssue || issueInvoice.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-pink-600 px-4 py-2 text-sm font-bold text-white hover:bg-pink-700 disabled:opacity-50"
              >
                {issueInvoice.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Timbrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: cancelar ── */}
      {cancelFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0f11] p-6 shadow-2xl">
            <h3 className="m-0 text-lg font-black">Cancelar factura</h3>
            <p className="m-0 mt-1 text-xs text-gray-500">
              La cancelación se envía al SAT a través de tu PAC. Necesita un motivo.
            </p>

            <label className="mt-4 mb-1 block text-xs font-bold text-gray-500">Motivo</label>
            <select className={FIELD} value={motive} onChange={(e) => setMotive(e.target.value)}>
              {MOTIVES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>

            {motive === "01" && (
              <>
                <label className="mt-3 mb-1 block text-xs font-bold text-gray-500">UUID que la sustituye</label>
                <input
                  className={FIELD}
                  value={replacementUuid}
                  onChange={(e) => setReplacementUuid(e.target.value.trim())}
                  placeholder="00000000-0000-0000-0000-000000000000"
                />
              </>
            )}

            {cancelInvoice.error && (
              <p className="m-0 mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                {cancelInvoice.error.message}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setCancelFor(null)} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-gray-300 hover:bg-white/5">
                Volver
              </button>
              <button
                onClick={() =>
                  cancelInvoice.mutate({
                    id: cancelFor.id,
                    motive: motive as "01" | "02" | "03" | "04",
                    replacementUuid: motive === "01" && replacementUuid ? replacementUuid : undefined,
                  })
                }
                disabled={cancelInvoice.isPending || (motive === "01" && !replacementUuid)}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {cancelInvoice.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Cancelar factura
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
