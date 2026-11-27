"use client";

import { toast } from "@rabbitty/ui";
import { trpc } from "../../../../lib/trpc-client";

/**
 * ── God · solicitudes de ajuste de tesorería ────────────────────────────────
 * Owner solicita; God aprueba/rechaza. Quien solicita no puede aprobar.
 * La aplicación del ajuste se hace después con el flujo God de refill/ledger.
 */
export function BalanceAdjustmentsPanel() {
  const utils = trpc.useUtils();
  const list = trpc.balanceAdjustments.godList.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const decide = trpc.balanceAdjustments.decide.useMutation({
    onSuccess: (_res, vars) => {
      toast.success(vars.decision === "APPROVED" ? "Solicitud aprobada" : "Solicitud rechazada");
      void utils.balanceAdjustments.godList.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const rows = list.data ?? [];
  const pending = rows.filter((row: any) => row.status === "PENDING");

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <p className="m-0 text-sm font-black text-white">Solicitudes de ajuste de tesorería</p>
        <p className="m-0 mt-1 max-w-3xl text-[11px] leading-relaxed text-gray-400">
          El owner solicita con motivo; God aprueba o rechaza. No hay edición directa de saldos.
          La aplicación se hace con el flujo God de refill (ledger + auditoría) una vez aprobada.
        </p>

        {pending.length > 0 && (
          <p className="mt-3 inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black text-amber-300">
            {pending.length} pendiente{pending.length === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-xs text-gray-500">
          No hay solicitudes.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-white/[0.03] text-[9px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-3 py-2">Negocio</th>
                <th className="px-3 py-2 text-right">Ajuste</th>
                <th className="px-3 py-2">Motivo</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Solicitó</th>
                <th className="px-3 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {rows.map((row: any) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 font-bold text-white">
                    {row.businessName || row.businessId.slice(0, 8)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-black ${
                      Number(row.delta) > 0 ? "text-emerald-300" : "text-red-300"
                    }`}
                  >
                    {Number(row.delta) > 0 ? "+" : ""}
                    {Number(row.delta).toLocaleString("es-MX")} Bunz
                  </td>
                  <td className="max-w-[280px] px-3 py-2 text-gray-400">{row.reason}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${
                        row.status === "APPROVED"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : row.status === "REJECTED"
                            ? "border-red-500/30 bg-red-500/10 text-red-300"
                            : row.status === "APPLIED"
                              ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[9px] text-gray-500">
                    {String(row.requestedBy).slice(0, 8)}…
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.status === "PENDING" ? (
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={decide.isPending}
                          onClick={() => {
                            if (!window.confirm("¿Aprobar esta solicitud? Queda auditada.")) return;
                            decide.mutate({ id: row.id, decision: "APPROVED" });
                          }}
                          className="rounded-lg bg-emerald-500 px-2.5 py-1 text-[10px] font-black text-black hover:bg-emerald-400 disabled:opacity-50"
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          disabled={decide.isPending}
                          onClick={() => {
                            if (!window.confirm("¿Rechazar esta solicitud?")) return;
                            decide.mutate({ id: row.id, decision: "REJECTED" });
                          }}
                          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black text-gray-300 hover:bg-white/10 disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
