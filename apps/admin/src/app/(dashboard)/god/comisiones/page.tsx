"use client";

import { useEffect, useState } from "react";
import { trpc } from "../../../../lib/trpc-client";
import { Card, Badge, Button, Input, Select, toast } from "@rabbitty/ui";
import { Crown, Percent, Save } from "lucide-react";

/**
 * ── God · Comisión de plataforma ────────────────────────────────────────────
 *
 * **Solo God.** Es ingreso de Rabbitty, no una preferencia del inquilino: si
 * viviera en el panel del comercio, el afiliado podría ponerla en 0. El comercio
 * la ve en *Tienda & Envíos* únicamente como lectura.
 *
 * Reglas del modelo (ver `Docs/STORE/COMISION-PLATAFORMA.md`):
 * - Sólo sobre la parte pagada en dinero; **Bunz nunca paga comisión**.
 * - `APP_ORDERS` = sólo pedidos que llegan por la app (la venta de mostrador no paga).
 * - La tarifa se congela en cada orden al vender: cambiarla aquí no reescribe el
 *   historial ni las liquidaciones anteriores.
 *
 * Encenderla exige que la comisión esté en el anexo económico del afiliado.
 */

const DEFAULT_PCT = 3.8; // % — número simbólico de la casa

type Row = {
  restaurantId: string;
  businessId: string;
  businessName: string;
  status: string | null;
  enabled: boolean;
  pct: number;
  appliesTo: "APP_ORDERS" | "ALL" | string;
  minFeeMxn: number;
  notes: string;
};

export default function GodCommissionsPage() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.god.listPlatformCommissions.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const [draft, setDraft] = useState<Record<string, Partial<Row>>>({});

  const save = trpc.god.setPlatformCommission.useMutation({
    onSuccess: () => {
      utils.god.listPlatformCommissions.invalidate();
      toast.success("Comisión actualizada");
    },
    onError: (error: { message?: string }) => toast.error(error.message || "No se pudo guardar"),
  });

  useEffect(() => {
    if (!data) return;
    const next: Record<string, Partial<Row>> = {};
    for (const row of data as Row[]) {
      next[row.restaurantId] = {
        enabled: row.enabled,
        pct: row.pct,
        appliesTo: row.appliesTo === "ALL" ? "ALL" : "APP_ORDERS",
        minFeeMxn: row.minFeeMxn,
      };
    }
    setDraft(next);
  }, [data]);

  const rows = (data ?? []) as Row[];

  return (
    <div className="space-y-6 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-linear-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">
            <Crown className="h-3.5 w-3.5" /> Solo plataforma
          </p>
          <h1 className="mt-1 text-4xl font-black tracking-tight text-transparent bg-clip-text bg-linear-to-r from-white via-gray-200 to-gray-500">
            Comisión de plataforma
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-medium text-gray-400">
            El take rate de Rabbitty por traer al cliente. No es el 1 % del riel (ese cubre el
            costo de cobrar). Bunz nunca paga comisión y la venta de mostrador no se grava con
            “sólo pedidos de la app”.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-gray-500">Cargando negocios…</p>
      ) : rows.length === 0 ? (
        <Card className="border border-white/5 bg-white/[0.03] p-8 text-center">
          <p className="text-sm font-bold text-gray-300">No hay restaurantes configurados</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const d = draft[row.restaurantId] ?? {};
            const enabled = d.enabled ?? row.enabled;
            const pctPct = (d.pct ?? row.pct ?? DEFAULT_PCT / 100) * 100;
            return (
              <Card key={row.restaurantId} className="border border-white/5 bg-white/[0.03] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold text-white">{row.businessName}</p>
                      <Badge variant={enabled ? "success" : "secondary"}>
                        {enabled ? `${pctPct.toFixed(2)} %` : "apagada"}
                      </Badge>
                      {row.status && <Badge variant="secondary">{row.status}</Badge>}
                    </div>
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      {row.restaurantId} · {row.businessId}
                    </p>
                  </div>

                  <label className="flex cursor-pointer items-center gap-2 text-[12px] font-bold text-gray-300">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          [row.restaurantId]: { ...prev[row.restaurantId], enabled: e.target.checked },
                        }))
                      }
                      className="h-4 w-4 accent-pink-500"
                    />
                    Cobrar
                  </label>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-4">
                  <Input
                    label="Comisión (%)"
                    type="number"
                    min={0}
                    max={30}
                    step="0.1"
                    value={pctPct}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [row.restaurantId]: {
                          ...prev[row.restaurantId],
                          pct: Number(e.target.value) / 100,
                        },
                      }))
                    }
                  />
                  <Select
                    label="Alcance"
                    value={(d.appliesTo ?? row.appliesTo) === "ALL" ? "ALL" : "APP_ORDERS"}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [row.restaurantId]: {
                          ...prev[row.restaurantId],
                          appliesTo: e.target.value === "ALL" ? "ALL" : "APP_ORDERS",
                        },
                      }))
                    }
                    options={[
                      { value: "APP_ORDERS", label: "Sólo pedidos de la app" },
                      { value: "ALL", label: "Todos los pagos en dinero" },
                    ]}
                  />
                  <Input
                    label="Mínimo por venta (MXN)"
                    type="number"
                    min={0}
                    step="1"
                    value={d.minFeeMxn ?? row.minFeeMxn}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [row.restaurantId]: {
                          ...prev[row.restaurantId],
                          minFeeMxn: Number(e.target.value),
                        },
                      }))
                    }
                  />
                  <div className="flex items-end">
                    <Button
                      onClick={() =>
                        save.mutate({
                          restaurantId: row.restaurantId,
                          enabled,
                          pct: (d.pct ?? row.pct) || DEFAULT_PCT / 100,
                          appliesTo: ((d.appliesTo ?? row.appliesTo) === "ALL" ? "ALL" : "APP_ORDERS") as
                            | "APP_ORDERS"
                            | "ALL",
                          minFeeMxn: d.minFeeMxn ?? row.minFeeMxn ?? 0,
                          notes: row.notes || "",
                        })
                      }
                      disabled={save.isPending}
                      className="w-full"
                    >
                      <Save className="mr-1.5 h-4 w-4" />
                      {save.isPending ? "Guardando…" : "Guardar"}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="border border-white/5 bg-white/[0.02] p-4">
        <p className="text-[11px] leading-relaxed text-gray-500">
          La comisión se congela en cada orden al vender (<code>orders.commissionPct</code>), así que
          cambiar el % aquí no reescribe lo ya vendido ni las liquidaciones pasadas. Para cobrarla en
          tarjeta falta sumarla al <code>application_fee_amount</code> de Stripe Connect; en efectivo
          queda como cuenta por cobrar del corte mensual.
        </p>
      </Card>
    </div>
  );
}
