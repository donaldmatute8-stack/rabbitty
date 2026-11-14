"use client";

/**
 * ── ProximityEngine ── Motor GLOBAL de proximidad (antes vivía solo en el
 * home: si el usuario estaba en otra pantalla, no había pings y no llegaba
 * nada). Montado en el layout raíz — corre en CUALQUIER pantalla:
 * - ping al iniciar +4s, en cada RESUMEN de la app (visibilitychange) y cada 3 min
 * - evalúa proximidad (/api/location/ping) → push de ofertas (server) y
 *   prompt de check-in (modal local, respeta cooldown de "Ahora no" 2h)
 * - no requiere permisos nuevos: usa la misma geolocalización que ya se pidió
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, MapPin, Sparkles, X } from "lucide-react";
import { PlatformBridge } from "@/lib/platform";
import { useAuth } from "@/features/auth/AuthProvider";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/contexts/ToastContext";

export default function ProximityEngine() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { showToast } = useToast();
  const [confirmingPresence, setConfirmingPresence] = useState(false);
  const [presenceConfirm, setPresenceConfirm] = useState<{ businessId: string; businessName: string } | null>(null);

  const presenceDeclined = (bizId: string): boolean => {
    try {
      const t = Number(localStorage.getItem(`presence_declined_${bizId}`) || 0);
      return Date.now() - t < 2 * 60 * 60 * 1000; // cooldown 2h tras "Ahora no"
    } catch { return false; }
  };

  const handlePingPresence = useCallback((res: { confirmPresence?: { businessId?: string; businessName?: string } | null } | null | undefined) => {
    const c = res?.confirmPresence;
    if (c?.businessId && c.businessName && !presenceDeclined(c.businessId)) {
      setPresenceConfirm((prev) => prev ?? { businessId: c.businessId!, businessName: c.businessName! });
    }
  }, []);

  useEffect(() => {
    let stopped = false;
    const ping = async () => {
      try {
        if (PlatformBridge.isNative()) {
          const { Geolocation } = await import("@capacitor/geolocation");
          const status = await Geolocation.checkPermissions();
          if (status.location !== "granted") return;
        } else if (typeof window !== "undefined" && "permissions" in navigator) {
          const res = await navigator.permissions?.query?.({ name: "geolocation" as PermissionName }).catch(() => null);
          if (res && res.state !== "granted") return;
        }
        const loc = await PlatformBridge.getLocation();
        if (!loc.success || loc.lat == null || loc.lng == null || stopped) return;
        const headers = await PlatformBridge.getAuthHeaders();
        if ((!headers?.Authorization && !headers?.["X-Init-Data"]) || stopped) return;
        fetch("/api/location/ping", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, timestamp: Date.now(), stationary: true }),
        })
          .then((r) => r.json())
          .then((pRes) => { if (pRes) handlePingPresence(pRes); })
          .catch(() => {});
      } catch { /* silencioso */ }
    };
    const t0 = setTimeout(ping, 4000);
    const iv = setInterval(ping, 3 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible" && !stopped) void ping();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => { stopped = true; clearTimeout(t0); clearInterval(iv); document.removeEventListener("visibilitychange", onVisible); };
  }, [handlePingPresence]);

  // ── P4: BACKGROUND LOCATION (app cerrada/suspendida) ──
  // El plugin comunitario NO tiene API de geofence — usa addWatcher nativo con
  // UIBackgroundModes=location (ya en Info.plist). Movimiento >30m o >2min
  // → ping source:'background' → push ⚡/check-in llegan con app cerrada.
  // Trade-off batería: moderado (distanceFilter 50m). iOS force-quit sigue sin
  // garantizado (matriz de pruebas del review) — documentado en Docs.
  useEffect(() => {
    if (!user?.id || !PlatformBridge.isNative()) return;
    let alive = true;
    const lastRef = { lat: Number.NaN, lng: Number.NaN, ts: 0 };
    let lastAllowed = 0;
    (async () => {
      try {
        const bg = await import("@capacitor-community/background-geolocation");
        const plugin = (bg as unknown as {
          BackgroundGeolocationPlugin: {
            addWatcher: (o: unknown, cb: (p?: unknown, e?: unknown) => void) => Promise<string>;
            removeWatcher: (o: unknown) => Promise<void>;
          };
        }).BackgroundGeolocationPlugin;
        const watcherId = await plugin.addWatcher(
          {
            background: true, // requiere UIBackgroundModes 'location' (ya en Info.plist)
            localsOnly: false,
            distanceFilter: 50,
          },
          (position?: unknown, error?: unknown) => {
            if (error || !alive) return;
            const pos = position as { coords?: { latitude?: number; longitude?: number } };
            const lat = pos?.coords?.latitude;
            const lng = pos?.coords?.longitude;
            if (typeof lat !== "number" || typeof lng !== "number") return;
            const moved = Number.isNaN(lastRef.lat) || (Math.abs(lat - lastRef.lat) + Math.abs(lng - lastRef.lng)) > 0.0003;
            const elapsed = Date.now() - lastAllowed;
            if (!moved && elapsed < 2 * 60 * 1000) return;
            lastRef.lat = lat; lastRef.lng = lng;
            lastAllowed = Date.now();
            void PlatformBridge.getAuthHeaders().then((h) =>
              fetch("/api/location/ping", {
                method: "POST",
                headers: { ...h, "Content-Type": "application/json" },
                body: JSON.stringify({ lat, lng, accuracy: 100, timestamp: Date.now(), stationary: false, source: "background" }),
              }).catch(() => {})
            );
          }
        );
        console.log("[BACKGROUND_LOC] watcher activo:", watcherId);
      } catch (err) {
        console.warn("[BACKGROUND_LOC] no disponible (requiere rebuild nativo):", err);
      }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  // Solo usuarios logueados (el ping anónimo no aporta presencia)
  if (!user?.id) return null;

  return (
    <AnimatePresence>
      {presenceConfirm && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          className="fixed bottom-4 left-4 right-4 z-9998 max-w-md mx-auto rounded-2xl border p-4 shadow-2xl"
          style={{
            background: isDark ? "rgba(10,10,16,0.97)" : "rgba(255,255,255,0.98)",
            borderColor: isDark ? "rgba(233,30,99,0.35)" : "rgba(0,0,0,0.08)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {/* Botón cerrar rápido */}
          <button
            type="button"
            onClick={() => {
              PlatformBridge.hapticFeedback("light");
              try { localStorage.setItem(`presence_declined_${presenceConfirm.businessId}`, String(Date.now())); } catch {}
              setPresenceConfirm(null);
            }}
            aria-label="Cerrar"
            className="absolute top-3.5 right-3.5 flex h-7 w-7 items-center justify-center rounded-full border-none cursor-pointer transition-colors"
            style={{
              background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
              color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)",
            }}
          >
            <X size={14} />
          </button>

          <div className="flex items-start gap-3.5 pr-6">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E91E63]/15 text-[#E91E63] border border-[#E91E63]/30 shadow-[0_0_20px_rgba(233,30,99,0.25)]">
              <MapPin size={22} strokeWidth={2.4} />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#E91E63] text-[9px] text-white shadow-sm">
                <Sparkles size={9} />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[1.2px] text-[#E91E63]">
                  Radar de Proximidad · Check-in
                </span>
              </div>
              <h3 className="mt-0.5 text-[15px] font-black leading-snug m-0" style={{ color: isDark ? "#FFFFFF" : "#0F172A" }}>
                ¿Estás en {presenceConfirm.businessName}?
              </h3>
              <p className="mt-1 text-[12px] leading-relaxed m-0" style={{ color: isDark ? "rgba(255,255,255,0.68)" : "#475569" }}>
                Confirma tu presencia para activar tu cuenta en caja y acumular <strong className="text-[#E91E63]">Bunz automáticos</strong>.
              </p>
            </div>
          </div>

          <div className="mt-3.5 flex items-center gap-2.5">
            <button
              type="button"
              disabled={confirmingPresence}
              onClick={() => {
                PlatformBridge.hapticFeedback("light");
                try { localStorage.setItem(`presence_declined_${presenceConfirm.businessId}`, String(Date.now())); } catch {}
                setPresenceConfirm(null);
              }}
              className="flex-1 rounded-xl py-2.5 px-3 text-[12px] font-bold border cursor-pointer active:scale-95 transition-all"
              style={{
                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                color: isDark ? "rgba(255,255,255,0.65)" : "#64748B",
              }}
            >
              Ahora no
            </button>

            <button
              type="button"
              disabled={confirmingPresence}
              onClick={async () => {
                if (confirmingPresence) return;
                setConfirmingPresence(true);
                PlatformBridge.hapticFeedback("medium");
                try {
                  const headers = await PlatformBridge.getAuthHeaders();
                  const res = await fetch("/api/location/confirm-presence", {
                    method: "POST",
                    headers: { ...headers, "Content-Type": "application/json" },
                    body: JSON.stringify({ businessId: presenceConfirm.businessId }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (res.ok && data?.success !== false) {
                    // H-PRESYNC: aviso a todas las superficies montadas (p. ej. el botón
                    // "Estoy aquí" de /affiliate/[id]) — el estado server ya está
                    // persistido aquí; quien cargue después lo irá a leer al server.
                    window.dispatchEvent(new CustomEvent('rabbitty:presence-confirmed', { detail: { businessId: presenceConfirm.businessId } }));
                    PlatformBridge.hapticFeedback("success");
                    showToast(`📍 ¡Check-in en ${presenceConfirm.businessName} activado! El comercio ya te ve en caja`, "success");
                    setPresenceConfirm(null);
                  } else {
                    PlatformBridge.hapticFeedback("error");
                    showToast(data?.error || "No se pudo registrar el check-in", "error");
                  }
                } catch {
                  PlatformBridge.hapticFeedback("error");
                  showToast("Error de conexión al registrar check-in", "error");
                } finally {
                  setConfirmingPresence(false);
                }
              }}
              className="flex-[1.5] flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-4 text-[12px] font-black text-white border-none cursor-pointer active:scale-95 transition-all shadow-[0_6px_20px_rgba(233,30,99,0.4)]"
              style={{
                background: "linear-gradient(135deg, #E91E63 0%, #FF2E93 100%)",
                opacity: confirmingPresence ? 0.7 : 1,
              }}
            >
              <Check size={14} strokeWidth={2.8} />
              <span>{confirmingPresence ? "Activando..." : "Sí, estoy aquí"}</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
