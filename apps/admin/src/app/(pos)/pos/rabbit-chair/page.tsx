"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Armchair, Clock, RefreshCw, UserPlus } from "lucide-react";
import { trpc } from "../../../../lib/trpc-client";
import { Button, Input, toast } from "@rabbitty/ui";

/**
 * ── POS · Rabbit Chair (La Silla) ───────────────────────────────────────────
 * Operación en piso: apartar lugar, sentar y marcar servido (arranca el
 * cronómetro). Abrir/cerrar la activación se hace desde el panel del negocio.
 */

const STATUS_LABEL: Record<string, string> = {
  FREE: "Libre",
  HELD: "Apartado",
  PAID: "Pagado",
  SEATED: "Sentado",
  SERVED: "Servido",
  DONE: "Terminó",
  EXPIRED: "Expirado",
};

const FORMAT_LABEL: Record<string, string> = {
  SINGLE: "Una silla",
  BLOCK: "Varias a la vez",
  WAVES: "Por oleadas",
  COUPLES: "Parejas",
};

const CHARGE_LABEL: Record<string, string> = {
  PREPAID: "Cobro al tomar el lugar",
  POSTPAID: "Aporte al final",
};

const MENU_LABEL: Record<string, string> = {
  COFFEE: "Solo café",
  ALCOHOL: "Coctelería",
  BOTH: "Café y coctelería",
};

function remaining(endsAt: string | Date | null | undefined): string {
  if (!endsAt) return "—";
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default function RabbitChairPosPage() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.rabbitChair.active.useQuery(undefined, {
    refetchInterval: 5000,
    retry: false,
  });
  const claim = trpc.rabbitChair.claimAtPos.useMutation({
    onSuccess: () => {
      toast.success("Lugar apartado");
      utils.rabbitChair.active.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const seat = trpc.rabbitChair.seat.useMutation({
    onSuccess: () => {
      toast.success("Invitado sentado");
      utils.rabbitChair.active.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const serve = trpc.rabbitChair.serve.useMutation({
    onSuccess: () => {
      toast.success("Servido: arranca el cronómetro");
      utils.rabbitChair.active.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [guest, setGuest] = useState("");
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const activation = data?.activation ?? null;
  const slots = (data?.slots ?? []) as Array<Record<string, any>>;

  return (
    <div className="min-h-screen bg-black px-4 py-5 text-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <Link
          href="/pos"
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-gray-300 hover:bg-white/10"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver al POS
        </Link>
        <button
          type="button"
          onClick={() => utils.rabbitChair.active.invalidate()}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-gray-300 hover:bg-white/10"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Actualizar
        </button>
      </header>

      <main className="mx-auto mt-6 max-w-5xl">
        {isLoading ? (
          <p className="text-sm text-gray-500">Cargando La Silla…</p>
        ) : !activation ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <Armchair className="mx-auto h-8 w-8 text-red-500" />
            <p className="mt-3 text-lg font-black">La Silla no está abierta</p>
            <p className="mt-1 text-sm text-gray-400">
              Abre la activación desde el panel del negocio (Ajustes → Rabbit Chair).
            </p>
            <Link
              href="/marketing/rabbit-chair"
              className="mt-4 inline-block rounded-full bg-red-600 px-5 py-2.5 text-xs font-black text-white hover:bg-red-500"
            >
              Ir al panel
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-3xl border border-red-500/25 bg-red-500/[0.06] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-400">Rabbit Chair · en vivo</p>
              <h1 className="mt-1 text-2xl font-black">{activation.name ?? "La Silla"}</h1>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  {FORMAT_LABEL[activation.format] ?? activation.format}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  {activation.capacity} lugares
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  Mín. ${(Number(activation.minContributionCents) / 100).toFixed(0)}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  {activation.durationMinutes} min
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  {MENU_LABEL[activation.menuMode] ?? activation.menuMode}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  {CHARGE_LABEL[activation.chargeMode] ?? activation.chargeMode}
                </span>
                {activation.requiresAgeCheck && (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-300">
                    +18
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <label className="min-w-[200px] flex-1">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">
                  Nombre del invitado (opcional)
                </span>
                <Input
                  value={guest}
                  onChange={(e) => setGuest(e.target.value)}
                  placeholder="Mesa / nombre"
                  maxLength={120}
                />
              </label>
              <Button
                onClick={() => {
                  claim.mutate({ activationId: activation.id, guestName: guest.trim() || undefined });
                  setGuest("");
                }}
                disabled={claim.isPending}
              >
                <UserPlus className="mr-1.5 h-4 w-4" /> Apartar lugar
              </Button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {slots.map((slot) => {
                const status = String(slot.status);
                const color =
                  status === "SERVED"
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : status === "PAID"
                      ? "border-cyan-500/30 bg-cyan-500/10"
                      : status === "HELD" || status === "SEATED"
                        ? "border-amber-500/30 bg-amber-500/10"
                        : status === "FREE"
                          ? "border-white/10 bg-white/[0.03]"
                          : "border-white/5 bg-white/[0.02] opacity-60";
                return (
                  <div key={slot.id} className={`rounded-2xl border p-4 ${color}`}>
                    <div className="flex items-start justify-between">
                      <p className="m-0 text-sm font-black">Lugar #{slot.index}</p>
                      <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-black">
                        {STATUS_LABEL[status] ?? status}
                      </span>
                    </div>
                    <p className="m-0 mt-1 text-[11px] text-gray-400">
                      {slot.guestName || (slot.userId ? "Rabbitter" : "—")}
                      {slot.paidCents ? ` · $${(Number(slot.paidCents) / 100).toFixed(2)}` : ""}
                    </p>
                    {status === "SERVED" && (
                      <p className="m-0 mt-2 flex items-center gap-1 text-xs font-black text-emerald-300">
                        <Clock className="h-3.5 w-3.5" /> {remaining(slot.endsAt)}
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      {(status === "PAID" || status === "HELD") && (
                        <Button size="sm" variant="secondary" onClick={() => seat.mutate({ slotId: slot.id })}>
                          Sentar
                        </Button>
                      )}
                      {status === "SEATED" && (
                        <Button size="sm" onClick={() => serve.mutate({ slotId: slot.id })}>
                          Servido
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
