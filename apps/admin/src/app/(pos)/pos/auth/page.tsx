"use client";

/**
 * ── Aprobar reautorización de una terminal (Fase 4 del ADR-014) ──
 *
 * El POS muestra un código de 6 dígitos + un QR con esta ruta. El administrador
 * lo abre en su teléfono (con su sesión) y aprueba o rechaza. La terminal hace
 * polling y renueva su sesión sola.
 *
 * Requiere sesión de admin/gerente (`authRequestDetail` y `resolveAuthRequest`
 * son adminOnly). No toca la sesión del admin: solo autoriza al dispositivo.
 */

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "../../../../lib/trpc-client";
import { Button, Input, toast } from "@rabbitty/ui";
import { CheckCircle2, Clock, Loader2, MonitorSmartphone, ShieldCheck, XCircle } from "lucide-react";

function mmss(target: string | Date) {
  const left = Math.max(0, Math.round((new Date(target).getTime() - Date.now()) / 1000));
  return `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
}

function PosAuthInner() {
  const params = useSearchParams();
  const initialCode = params.get("code") ?? "";
  const [code, setCode] = useState(initialCode);
  const [manual, setManual] = useState("");

  const { data: profile, isLoading: profileLoading, error: profileError } = trpc.admin.getProfile.useQuery(
    undefined,
    { retry: false },
  );

  useEffect(() => {
    // Sincroniza con el ?code= del QR (no hay otra fuente de verdad).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCode(initialCode);
  }, [initialCode]);

  const detail = trpc.posTerminals.authRequestDetail.useQuery(
    { code },
    { enabled: code.length === 6, retry: false, refetchInterval: 5000 },
  );

  const pending = trpc.posTerminals.pendingAuthRequests.useQuery(undefined, {
    retry: false,
    enabled: !!profile,
    refetchInterval: 15000,
  });

  const utils = trpc.useUtils();

  const resolve = trpc.posTerminals.resolveAuthRequest.useMutation({
    onSuccess: (data) => {
      toast.success(data.approved ? "Terminal autorizada" : "Solicitud rechazada");
      utils.posTerminals.authRequestDetail.invalidate();
      utils.posTerminals.pendingAuthRequests.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const loginUrl = typeof window !== "undefined"
    ? `/login?next=${encodeURIComponent(`/pos/auth${code ? `?code=${code}` : ""}`)}`
    : "/login";

  if (profileLoading) {
    return (
      <div className="flex h-[100dvh] w-screen items-center justify-center bg-black text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="flex h-[100dvh] w-screen items-center justify-center bg-black p-5 text-white">
        <div className="w-full max-w-sm rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-amber-300" />
          <p className="m-0 text-lg font-black">Necesitas una sesión de administrador</p>
          <p className="m-0 mt-1 text-xs text-gray-300">
            La aprobación de terminales solo la puede hacer un administrador o gerente.
          </p>
          <Button className="mt-4 w-full" onClick={() => window.location.assign(loginUrl)}>
            Iniciar sesión
          </Button>
        </div>
      </div>
    );
  }

  const status = detail.data?.status;
  const resolved = status === "APPROVED" || status === "DENIED" || status === "EXPIRED";

  return (
    <div className="min-h-[100dvh] w-screen overflow-y-auto bg-black p-5 text-white">
      <div className="mx-auto w-full max-w-md space-y-4 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
        <div>
          <p className="m-0 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-400">Rabbitty POS</p>
          <h1 className="m-0 mt-1 text-2xl font-black">Autorizar terminal</h1>
          <p className="m-0 mt-1 text-sm text-gray-400">
            Aprueba solo terminales que reconozcas. La sesión de tu teléfono no se comparte con el POS.
          </p>
        </div>

        {code.length === 6 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            {detail.isLoading ? (
              <p className="m-0 flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando la solicitud…
              </p>
            ) : detail.error ? (
              <div className="space-y-3">
                <p className="m-0 text-sm text-amber-300">{detail.error.message}</p>
                <button
                  type="button"
                  className="text-xs font-bold text-cyan-300"
                  onClick={() => setCode("")}
                >
                  Probar con otro código
                </button>
              </div>
            ) : detail.data ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                    <MonitorSmartphone className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 text-[10px] font-black uppercase tracking-wider text-gray-500">Terminal</p>
                    <p className="m-0 text-lg font-black leading-tight">{detail.data.terminalName}</p>
                    <p className="m-0 text-xs text-gray-400">Código {code}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="m-0 text-[10px] font-bold uppercase text-gray-500">Autorización</p>
                    <p className="m-0 text-sm font-black">{detail.data.requestedHours} h</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="m-0 text-[10px] font-bold uppercase text-gray-500">Vence</p>
                    <p className="m-0 flex items-center gap-1 text-sm font-black">
                      <Clock className="h-3.5 w-3.5 text-amber-300" />
                      {status === "PENDING" ? mmss(detail.data.expiresAt) : status}
                    </p>
                  </div>
                </div>

                {status === "APPROVED" && (
                  <p className="m-0 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> Terminal autorizada. Ya puede abrir el POS.
                  </p>
                )}
                {status === "DENIED" && (
                  <p className="m-0 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                    <XCircle className="h-4 w-4" /> Solicitud rechazada.
                  </p>
                )}
                {status === "EXPIRED" && (
                  <p className="m-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-300">
                    El código venció. La terminal debe generar uno nuevo.
                  </p>
                )}

                {!resolved && (
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      disabled={resolve.isPending}
                      onClick={() => resolve.mutate({ code, approve: false })}
                    >
                      Rechazar
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={resolve.isPending}
                      onClick={() => resolve.mutate({ code, approve: true })}
                    >
                      {resolve.isPending ? "Aprobando…" : "Aprobar"}
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="m-0 text-sm font-bold">Ingresa el código que muestra la terminal</p>
            <div className="mt-3 flex gap-2">
              <Input
                value={manual}
                onChange={(e) => setManual(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="123456"
                className="text-center text-lg font-black tracking-[0.3em]"
              />
              <Button disabled={manual.length !== 6} onClick={() => setCode(manual)}>
                Buscar
              </Button>
            </div>
          </div>
        )}

        {/* Pendientes de la sucursal */}
        {pending.data && pending.data.length > 0 && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="m-0 mb-2 text-[10px] font-black uppercase tracking-wider text-gray-500">
              Solicitudes pendientes
            </p>
            <div className="space-y-2">
              {pending.data.map((r) => (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => setCode(r.code)}
                  className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-left hover:border-cyan-500/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{r.terminalName}</span>
                    <span className="block text-[10px] text-gray-500">
                      {r.requestedHours} h · vence en {mmss(r.expiresAt)}
                    </span>
                  </span>
                  <span className="rounded-lg bg-cyan-500/15 px-2 py-1 text-[11px] font-black tracking-widest text-cyan-300">
                    {r.code}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PosAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] w-screen items-center justify-center bg-black text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      }
    >
      <PosAuthInner />
    </Suspense>
  );
}
