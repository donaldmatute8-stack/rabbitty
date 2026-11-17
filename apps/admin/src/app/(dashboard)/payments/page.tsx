"use client";

import { trpc } from "../../../lib/trpc-client";
import { Card, Badge } from "@rabbitty/ui";
import {
  CreditCard,
  Wallet,
  Banknote,
  Coins,
  Check,
  X,
  Smartphone,
  MonitorSmartphone,
  Link2,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";

/**
 * ── Rieles de cobro ─────────────────────────────────────────────────────────
 *
 * Vista de solo lectura. Responde tres preguntas:
 *   1. ¿Qué puede hacer cada riel hoy? (capacidades que declara el servidor)
 *   2. ¿Cuál está apagado y por qué? (p. ej. Rabbitty Pay sin adquirente en MX)
 *   3. ¿Qué lectores y tarifas hay configurados en esta sucursal?
 *
 * No cobra ni configura nada: es el tablero para decidir con datos.
 */

const CAP_ICONS: Record<string, { icon: typeof CreditCard; label: string }> = {
  cardTerminal: { icon: CreditCard, label: "Lector físico" },
  tapToPhone: { icon: Smartphone, label: "Tap to Phone" },
  hostedCheckout: { icon: Link2, label: "Link / QR" },
  mposSdk: { icon: MonitorSmartphone, label: "SDK MPOS" },
  inAppPayment: { icon: Wallet, label: "App" },
  refunds: { icon: ReceiptText, label: "Reembolsos" },
  partialRefunds: { icon: ReceiptText, label: "Parciales" },
  splitPayments: { icon: Coins, label: "División" },
  requiresKyc: { icon: ShieldCheck, label: "KYC" },
};

const RAIL_ICON: Record<string, typeof CreditCard> = {
  CASH: Banknote,
  BUNZ: Coins,
  STRIPE: CreditCard,
  MERCADO_PAGO: Wallet,
  RABBITTY_PAY: CreditCard,
};

export default function PaymentRailsPage() {
  const { data: caps, isLoading } = trpc.payments.getCapabilities.useQuery(undefined, {
    retry: false,
  });
  const { data: stripe } = trpc.payments.getStripeAccountStatus.useQuery(
    { branchId: undefined },
    { retry: false },
  );
  const { data: readers } = trpc.payments.listTerminalReaders.useQuery({}, { retry: false });
  const { data: fees } = trpc.payments.listProviderFees.useQuery(undefined, { retry: false });

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <header className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-pink-500/30 bg-pink-500/15">
          <CreditCard className="h-6 w-6 text-pink-300" />
        </div>
        <div>
          <h1 className="m-0 text-2xl font-bold text-white">Rieles de cobro</h1>
          <p className="m-0 mt-0.5 text-[12px] text-white/45">
            Qué puede hacer cada proveedor hoy y qué falta para Rabbitty Pay.
          </p>
        </div>
      </header>

      {/* Rieles disponibles */}
      <section className="space-y-3">
        <p className="m-0 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
          Disponibles
        </p>
        {isLoading ? (
          <p className="text-[12px] text-white/40">Cargando…</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(caps?.providers ?? []).map((p) => {
              const Icon = RAIL_ICON[p.id] ?? CreditCard;
              return (
                <Card key={p.id} className="border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-pink-300" />
                      <p className="m-0 text-[13px] font-black text-white">{p.name}</p>
                    </div>
                    <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                      activo
                    </Badge>
                  </div>
                  <p className="m-0 mt-1 text-[11.5px] leading-relaxed text-white/50">{p.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {Object.entries(p.capabilities as Record<string, boolean>)
                      .filter(([, on]) => on)
                      .map(([key]) => {
                        const meta = CAP_ICONS[key];
                        if (!meta) return null;
                        const CapIcon = meta.icon;
                        return (
                          <span
                            key={key}
                            className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9.5px] font-bold text-white/60"
                          >
                            <CapIcon className="h-2.5 w-2.5" /> {meta.label}
                          </span>
                        );
                      })}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Rieles apagados */}
      {(caps?.disabled ?? []).length > 0 && (
        <section className="space-y-2">
          <p className="m-0 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
            Apagados (y por qué)
          </p>
          {(caps?.disabled ?? []).map((p) => (
            <Card key={p.id} className="border border-white/8 bg-black/30 p-3">
              <div className="flex items-start gap-2">
                <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                <div>
                  <p className="m-0 text-[12px] font-bold text-white/70">{p.name}</p>
                  <p className="m-0 mt-0.5 text-[11px] leading-relaxed text-white/40">{p.reason}</p>
                </div>
              </div>
            </Card>
          ))}
        </section>
      )}

      {/* Stripe Connect */}
      <section>
        <p className="m-0 mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
          Cuenta de cobro (Stripe)
        </p>
        <Card className="border border-white/10 bg-white/5 p-4">
          {stripe?.stripeAccountId ? (
            <div className="grid gap-2 sm:grid-cols-3 text-[11.5px]">
              <p className="m-0 text-white/60">
                Cuenta: <span className="font-mono text-white/80">{String(stripe.stripeAccountId).slice(0, 12)}…</span>
              </p>
              <p className="m-0 flex items-center gap-1 text-white/60">
                Cobros:{" "}
                {stripe.chargesEnabled ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <X className="h-3.5 w-3.5 text-rose-400" />
                )}
              </p>
              <p className="m-0 flex items-center gap-1 text-white/60">
                Liquidaciones:{" "}
                {stripe.payoutsEnabled ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <X className="h-3.5 w-3.5 text-rose-400" />
                )}
              </p>
            </div>
          ) : (
            <p className="m-0 text-[12px] text-white/45">
              Esta sucursal no tiene cuenta de cobro conectada. El cobro con tarjeta no
              liquidará hasta conectarla (Ajustes → Pagos).
            </p>
          )}
        </Card>
      </section>

      {/* Lectores */}
      <section>
        <p className="m-0 mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
          Lectores de esta sucursal
        </p>
        {(readers ?? []).length === 0 ? (
          <Card className="border border-white/8 bg-black/25 p-4">
            <p className="m-0 text-[12px] text-white/45">
              Aún no hay lectores registrados. Hoy el cobro con tarjeta se hace con la
              terminal del comercio y se anota la referencia (método “Tarjeta (terminal)”).
            </p>
          </Card>
        ) : (
          <Card className="overflow-x-auto border border-white/10 bg-white/5">
            <table className="w-full text-[11.5px]">
              <thead className="bg-white/5 text-[9px] uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-3 py-2 text-left">Lector</th>
                  <th className="px-3 py-2 text-left">Proveedor</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Llaves / TMS</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(readers ?? []).map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="px-3 py-2 text-white/80">{r.label}</td>
                    <td className="px-3 py-2 text-white/50">{r.provider}</td>
                    <td className="px-3 py-2 text-white/50">
                      {r.kind} · {r.connection}
                    </td>
                    <td className="px-3 py-2 text-white/50">
                      {r.keyInjectionProvider ?? "—"} / {r.tmsProvider ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-white/50">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      {/* Tarifas */}
      <section>
        <p className="m-0 mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
          Costo por riel
        </p>
        {(fees ?? []).length === 0 ? (
          <Card className="border border-white/8 bg-black/25 p-4">
            <p className="m-0 text-[12px] text-white/45">
              Sin tarifas capturadas. La comisión de la plataforma es{" "}
              <b className="text-white/70">1 %</b> del cobro; la del procesador la define el
              proveedor. Capturarlas aquí permitirá comparar el costo real de cada riel.
            </p>
          </Card>
        ) : (
          <Card className="overflow-x-auto border border-white/10 bg-white/5">
            <table className="w-full text-[11.5px]">
              <thead className="bg-white/5 text-[9px] uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-3 py-2 text-left">Proveedor</th>
                  <th className="px-3 py-2 text-left">Esquema</th>
                  <th className="px-3 py-2 text-right">Fijo</th>
                  <th className="px-3 py-2 text-right">%</th>
                  <th className="px-3 py-2 text-right">IVA</th>
                </tr>
              </thead>
              <tbody>
                {(fees ?? []).map((f) => (
                  <tr key={f.id} className="border-t border-white/5">
                    <td className="px-3 py-2 text-white/80">{f.provider}</td>
                    <td className="px-3 py-2 text-white/50">{f.scheme}</td>
                    <td className="px-3 py-2 text-right text-white/60">${Number(f.fixedMxn).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-white/60">{(Number(f.percent) * 100).toFixed(2)} %</td>
                    <td className="px-3 py-2 text-right text-white/60">{(Number(f.ivaPercent) * 100).toFixed(0)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <p className="text-[10.5px] leading-relaxed text-white/30">
        Rabbitty Pay (riel propio) se habilitará cuando exista un adquirente en México que
        certifique el hardware. Mientras tanto, la plataforma opera con Stripe y Bunz.
      </p>
    </div>
  );
}
