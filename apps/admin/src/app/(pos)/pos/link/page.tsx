"use client";

/**
 * ── Vincular esta terminal POS (Fase 2 del ADR-014) ──
 *
 * Requiere sesión de administrador (es un acto de configuración). Genera el
 * secreto local del dispositivo, pide al servidor que registre la terminal y
 * guarda la sesión emitida. A partir de ahí el POS funciona sin la sesión de
 * admin de este equipo.
 *
 * Esta pantalla es deliberadamente pequeña: la administración completa de
 * terminales (listar/revocar) llega en la Fase 5.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { trpc } from "../../../../lib/trpc-client";
import { Button, Input, toast } from "@rabbitty/ui";
import { getOrCreateDeviceKey, getPosTerminalInfo, getPosTerminalToken, savePosTerminal, clearPosTerminal } from "../../../../lib/pos-terminal";

const DEFAULT_HOURS = 168; // 7 días de autorización; revocable en cualquier momento

function defaultName(): string {
  if (typeof navigator === "undefined") return "Caja 1";
  const platform = /iPad|iPhone|iPod/.test(navigator.userAgent)
    ? "iPad"
    : /Android/.test(navigator.userAgent)
      ? "Android"
      : /Mac/.test(navigator.platform)
        ? "Mac"
        : "PC";
  return `Caja ${platform}`;
}

export default function PosLinkPage() {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [linked, setLinked] = useState<string | null>(null);

  const { data: feature, isLoading: featureLoading } = trpc.posTerminals.featureEnabled.useQuery(undefined, {
    retry: false,
  });
  const { data: profile, isLoading: profileLoading, error: profileError } = trpc.admin.getProfile.useQuery(undefined, {
    retry: false,
  });

  useEffect(() => {
    if (getPosTerminalToken()) {
      // Lectura de localStorage tras montar (evita mismatch de hidratación).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLinked(getPosTerminalInfo()?.name ?? "Terminal vinculada");
    }
  }, []);

  const deviceKey = useMemo(() => (typeof window === "undefined" ? "" : getOrCreateDeviceKey()), []);

  const activate = trpc.posTerminals.activate.useMutation({
    onSuccess: async (data) => {
      savePosTerminal(data.sessionToken, {
        terminalId: data.terminalId,
        name,
        branchId: null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt).toISOString() : null,
      });

      // Importante: el dispositivo queda como TERMINAL, no como admin. Al
      // cerrar la sesión de NextAuth, salir del POS al dashboard vuelve a pedir
      // las credenciales del administrador (no basta un PIN de gerente).
      try {
        await signOut({ redirect: false });
      } catch {
        /* si no había sesión, seguimos */
      }

      toast.success("Terminal vinculada. El POS ya opera con el PIN del empleado.");
      router.replace("/pos");
    },
    onError: (err) => toast.error(err.message),
  });

  const revoke = trpc.posTerminals.revoke.useMutation({
    onSuccess: () => {
      clearPosTerminal();
      setLinked(null);
      toast.success("Terminal revocada en este dispositivo.");
    },
    onError: (err) => toast.error(err.message),
  });

  // Entrar al POS SIEMPRE deja el dispositivo como terminal (sin sesión admin).
  const openPos = async () => {
    try {
      await signOut({ redirect: false });
    } catch {
      /* sin sesión */
    }
    router.replace("/pos");
  };

  const featureOff = !featureLoading && feature?.enabled !== true;
  const canActivate = !featureOff && !!deviceKey && name.trim().length >= 2 && !activate.isPending;

  return (
    <div className="h-[100dvh] w-screen overflow-y-auto bg-black text-white p-5">
      <div className="mx-auto max-w-lg space-y-4 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
        <div>
          <p className="m-0 text-[11px] font-black uppercase tracking-[0.25em] text-cyan-400">Rabbitty POS</p>
          <h1 className="m-0 mt-1 text-2xl font-black">Vincular esta terminal</h1>
          <p className="m-0 mt-1 text-sm text-gray-400">
            La terminal tendrá su propia sesión, separada de tu cuenta de administrador. Podrás revocarla cuando quieras.
          </p>
        </div>

        {linked ? (
          <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 space-y-3">
            <p className="m-0 text-sm font-black text-green-300">✓ {linked}</p>
            <p className="m-0 text-xs text-gray-300">
              Este dispositivo ya tiene una sesión de terminal guardada. Si el servidor la rechaza (revocada o vencida),
              vuelve a vincularlo aquí después de iniciar sesión como administrador.
            </p>
            <p className="m-0 text-[11px] leading-relaxed text-gray-500">
              Instala esta página en la pantalla de inicio: abrirá directo en <code>/pos</code>. Los empleados solo
              capturan su PIN; para entrar al panel de administración se usa “Entrar como administrador” en la
              pantalla del PIN.
            </p>
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" onClick={() => void openPos()} className="flex-1">
                Abrir POS
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const info = getPosTerminalInfo();
                  if (info) revoke.mutate({ terminalId: info.terminalId });
                  else {
                    clearPosTerminal();
                    setLinked(null);
                  }
                }}
                disabled={revoke.isPending}
                className="flex-1"
              >
                {revoke.isPending ? "Revocando…" : "Revocar y desvincular"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            {featureOff ? (
              <p className="m-0 text-sm text-amber-300">
                El modo terminal está desactivado en este entorno. El POS seguirá usando la sesión de administrador.
              </p>
            ) : profileLoading ? (
              <p className="m-0 text-sm text-gray-400">Verificando tu sesión de administrador…</p>
            ) : profileError || !profile ? (
              <p className="m-0 text-sm text-amber-300">
                Necesitas iniciar sesión como administrador para vincular una terminal.
              </p>
            ) : (
              <>
                <p className="m-0 text-xs text-gray-400">
                  Sesión de admin detectada ({profile.role}). La terminal quedará atada a tu sucursal actual.
                </p>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Nombre de la terminal
                  </span>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 60))}
                    placeholder="Caja 1"
                    maxLength={60}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Autorización por
                  </span>
                  <select
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
                  >
                    <option value={24}>24 horas</option>
                    <option value={72}>3 días</option>
                    <option value={168}>7 días</option>
                    <option value={720}>30 días</option>
                  </select>
                </label>

                <Button
                  onClick={() => activate.mutate({ name: name.trim(), deviceKey, platform: "web", hours })}
                  disabled={!canActivate}
                  className="w-full"
                >
                  {activate.isPending ? "Vinculando…" : "Vincular esta terminal"}
                </Button>

                <p className="m-0 text-[11px] leading-relaxed text-gray-500">
                  El secreto del dispositivo nunca se envía al servidor: solo su hash. Guardamos la sesión en este equipo;
                  si lo revocas, deja de aceptar nuevas operaciones de inmediato.
                </p>
              </>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => void openPos()}
          className="w-full rounded-xl border border-white/10 bg-transparent py-2.5 text-xs font-bold text-gray-400 hover:text-white"
        >
          Volver al POS
        </button>
      </div>
    </div>
  );
}
