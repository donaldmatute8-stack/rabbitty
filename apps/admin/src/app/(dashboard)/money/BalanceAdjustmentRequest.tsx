"use client";

import { useState } from "react";
import { Card, Button, toast } from "@rabbitty/ui";
import { trpc } from "../../../lib/trpc-client";

/**
 * ── Solicitud de ajuste de tesorería (owner) ────────────────────────────────
 * No edita saldos. Crea una solicitud; God la aprueba o rechaza. La aplicación
 * se hace después con el flujo God de refill/ledger.
 */
export function BalanceAdjustmentRequest() {
  const utils = trpc.useUtils();
  const list = trpc.balanceAdjustments.listMine.useQuery(undefined, { retry: false });
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");

  const request = trpc.balanceAdjustments.request.useMutation({
    onSuccess: () => {
      toast.success("Solicitud enviada a God");
      setDelta("");
      setReason("");
      void utils.balanceAdjustments.listMine.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const pending = (list.data ?? []).filter((row: any) => row.status === "PENDING");

  return (
    <Card className="border border-white/10 bg-white/[0.03] p-5">
      <p className="m-0 text-sm font-black text-white">Ajuste de tesorería</p>
      <p className="m-0 mt-1 max-w-2xl text-[11px] leading-relaxed text-gray-400">
        Si necesitas un ajuste de Bunz, solicítalo aquí con motivo. God lo aprueba y se aplica
        con su flujo auditado. No se edita el saldo directo.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[140px_1fr]">
        <label className="block">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">
            Bunz (+/−)
          </span>
          <input
            inputMode="numeric"
            value={delta}
            onChange={(e) => setDelta(e.target.value.replace(/[^\d-]/g, ""))}
            className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm font-bold text-white outline-none focus:border-pink-500"
            placeholder="500"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">
            Motivo (mínimo 20 caracteres)
          </span>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white outline-none focus:border-pink-500"
            placeholder="Ej. Reposición por cashback de pruebas no acreditado; autorizado por el fundador."
          />
        </label>
      </div>

      <Button
        className="mt-3"
        disabled={request.isPending || Number(delta) === 0 || reason.trim().length < 20}
        onClick={() => request.mutate({ delta: Number(delta), reason: reason.trim() })}
      >
        {request.isPending ? "Enviando…" : "Solicitar ajuste a God"}
      </Button>

      {pending.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="m-0 text-[10px] font-black uppercase tracking-wider text-gray-500">
            Pendientes de aprobación
          </p>
          {pending.map((row: any) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2 text-[11px]"
            >
              <span className="font-black text-white">
                {Number(row.delta) > 0 ? "+" : ""}
                {Number(row.delta).toLocaleString("es-MX")} Bunz
              </span>
              <span className="text-gray-400">{row.reason}</span>
              <span className="rounded-full border border-amber-500/30 px-2 py-0.5 text-[9px] font-black text-amber-300">
                PENDIENTE
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
