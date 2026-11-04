"use client";

/**
 * ── Reautorización desde el móvil (Fase 4 del ADR-014) ──
 *
 * La terminal muestra un código corto + QR. El administrador lo aprueba desde
 * su teléfono (sesión de admin) y la terminal renueva su sesión sola.
 *
 * El código NO se puede consultar sin el `deviceKey` del dispositivo, así que
 * un tercero no puede enumerar solicitudes.
 */

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button, toast } from "@rabbitty/ui";
import { Clock, ShieldCheck, Smartphone, Loader2, RefreshCw } from "lucide-react";
import { trpc } from "../lib/trpc-client";
import { getOrCreateDeviceKey, getPosTerminalInfo, savePosTerminal } from "../lib/pos-terminal";

export function PosReauthPanel({ terminalName }: { terminalName?: string | null }) {
  const deviceKey = useMemo(() => (typeof window === "undefined" ? "" : getOrCreateDeviceKey()), []);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState("");

  const utils = trpc.useUtils();

  const createRequest = trpc.posTerminals.createAuthRequest.useMutation({
    onSuccess: (data) => {
      setCode(data.code);
      setExpiresAt(new Date(data.expiresAt).toISOString());
      setError("");
    },
    onError: (err) => {
      setError(err.message || "No se pudo crear la solicitud");
    },
  });

  const statusQuery = trpc.posTerminals.authRequestStatus.useQuery(
    { code: code ?? "", deviceKey },
    { enabled: Boolean(code), refetchInterval: 3000, retry: false },
  );

  const issueSession = trpc.posTerminals.issueSession.useMutation({
    onSuccess: async (data) => {
      // Tras aprobar, `status` ya devuelve la terminal con su id real. Sin esto,
      // una revinculación podía guardar terminalId vacío y romper la revocación.
      let info = getPosTerminalInfo();
      try {
        const current = await utils.posTerminals.status.fetch({ deviceKey });
        if (current.authorized) {
          info = {
            terminalId: current.terminalId,
            name: current.name,
            branchId: current.branchId ?? null,
          };
        }
      } catch {
        /* si falla, conservamos la info local */
      }

      savePosTerminal(data.sessionToken, {
        terminalId: info?.terminalId ?? "",
        name: info?.name ?? terminalName ?? "Terminal",
        branchId: info?.branchId ?? null,
        expiresAt: new Date(data.expiresAt).toISOString(),
      });
      toast.success("Terminal autorizada. Abriendo el POS…");
      window.location.reload();
    },
    onError: (err) => {
      setError(err.message || "No se pudo activar la sesión");
      setCode(null);
    },
  });

  // Cuenta regresiva del código.
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const left = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  // Aprobada → canjear por una sesión de terminal.
  useEffect(() => {
    const status = statusQuery.data?.status;
    if (status === "APPROVED" && !issueSession.isPending) {
      issueSession.mutate({ deviceKey });
    }
    if (status === "DENIED") {
      // Reacción al resultado del polling (no hay render alternativo).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("El administrador rechazó la solicitud.");
      setCode(null);
    }
    if (status === "EXPIRED") {
      setError("El código venció. Genera uno nuevo.");
      setCode(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusQuery.data?.status]);

  const approveUrl = useMemo(() => {
    if (!code || typeof window === "undefined") return "";
    return `${window.location.origin}/pos/auth?code=${code}`;
  }, [code]);

  const mmss = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <div className="flex h-[100dvh] w-screen items-center justify-center bg-black p-5 text-white">
      <div
        className="w-full max-w-sm rounded-3xl p-6"
        style={{
          background: "linear-gradient(180deg,#0B1420 0%,#07040B 100%)",
          border: "1px solid rgba(34,211,238,0.28)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
            <Smartphone className="h-7 w-7" />
          </div>
          <p className="m-0 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-400">Rabbitty POS</p>
          <h1 className="m-0 mt-1 text-xl font-black">Reautorizar terminal</h1>
          <p className="m-0 mt-1 text-xs text-gray-400">
            {terminalName ? `${terminalName} · ` : ""}Pide a un administrador que apruebe desde su teléfono.
          </p>
        </div>

        {error && (
          <p className="m-0 mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
            {error}
          </p>
        )}

        {!code ? (
          <Button
            className="w-full"
            onClick={() => createRequest.mutate({ deviceKey, hours: 168 })}
            disabled={createRequest.isPending || !deviceKey}
          >
            {createRequest.isPending ? (
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Generando…</span>
            ) : (
              "Solicitar autorización"
            )}
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-4 text-center">
              <p className="m-0 text-[10px] font-black uppercase tracking-wider text-cyan-300">Código</p>
              <p className="m-0 mt-1 text-3xl font-black tracking-[0.2em] text-white">{code}</p>
              <p className="m-0 mt-2 flex items-center justify-center gap-1 text-[11px] text-gray-400">
                <Clock className="h-3.5 w-3.5" /> Vence en {mmss}
              </p>
            </div>

            {approveUrl && (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white p-3">
                <QRCodeSVG value={approveUrl} size={148} />
                <p className="m-0 text-center text-[10px] font-bold text-gray-600">
                  Escanéalo con tu teléfono para aprobar
                </p>
              </div>
            )}

            <p className="m-0 flex items-center justify-center gap-1.5 text-center text-[11px] text-gray-400">
              {issueSession.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Activando sesión…</>
              ) : (
                <><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Esperando aprobación…</>
              )}
            </p>

            <button
              type="button"
              onClick={() => {
                setCode(null);
                setError("");
                createRequest.mutate({ deviceKey, hours: 168 });
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2.5 text-[11px] font-bold text-gray-400 hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Generar otro código
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => window.location.assign("/login")}
          className="mt-4 w-full rounded-xl py-2.5 text-[11px] font-bold text-gray-500 hover:text-white"
        >
          Entrar como administrador
        </button>
      </div>
    </div>
  );
}
