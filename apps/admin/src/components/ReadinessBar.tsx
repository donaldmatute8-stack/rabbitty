'use client';

/**
 * ── ReadinessBar ── Botón compacto en el navbar con popover de Preparación del Negocio.
 * Unifica el porcentaje global (Perfil Mínimo/TOP + 7 pasos operativos del Wizard)
 * para que el navbar y la tarjeta del Dashboard muestren siempre el mismo % exacto.
 */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, CheckCircle2, Circle, ArrowRight, Trophy, Target, Globe } from "lucide-react";
import { trpc } from "../lib/trpc-client";

export const WIZARD_STEP_IDS = ["menu", "staff", "tv-qr", "loyalty", "cash-cut", "sync", "academy"] as const;

export function computeUnifiedReadiness(
  readiness: any,
  manualCompleted: Record<string, boolean>
): {
  percent: number;
  wizardDoneCount: number;
  wizardTotalCount: number;
  topDoneCount: number;
  topTotalCount: number;
} {
  const wizardTotalCount = WIZARD_STEP_IDS.length;
  const wizardDoneCount = WIZARD_STEP_IDS.filter((id) => {
    if (Boolean(readiness?.wizardSteps?.[id]?.done)) return true;
    return Boolean(manualCompleted[id]);
  }).length;

  const topItems: Array<{ done: boolean }> = readiness?.top?.items ?? [];
  const topTotalCount = topItems.length;
  const topDoneCount = topItems.filter((i) => i.done).length;

  const totalItems = topTotalCount + wizardTotalCount;
  if (totalItems === 0) {
    return {
      percent: 0,
      wizardDoneCount: 0,
      wizardTotalCount,
      topDoneCount: 0,
      topTotalCount: 0,
    };
  }

  const percent = Math.round(((topDoneCount + wizardDoneCount) / totalItems) * 100);
  return {
    percent,
    wizardDoneCount,
    wizardTotalCount,
    topDoneCount,
    topTotalCount,
  };
}

interface ReadinessItem {
  id: string;
  label: string;
  done: boolean;
  href: string;
  level: "min" | "top";
  cta: string;
}

export default function ReadinessBar() {
  const { data, isLoading } = trpc.admin.getReadiness.useQuery(undefined, { retry: false, staleTime: 30_000 });
  const [open, setOpen] = useState(false);
  const [manualCompleted, setManualCompleted] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastLevel = useRef<string>("");

  // Sincronizar pasos manuales del OnboardingWizard en tiempo real
  useEffect(() => {
    const loadManual = () => {
      try {
        const saved = localStorage.getItem("rabbitty_onboarding_completed");
        if (saved) setManualCompleted(JSON.parse(saved));
      } catch {}
    };
    loadManual();
    window.addEventListener("rabbitty-readiness-sync", loadManual);
    window.addEventListener("storage", loadManual);
    return () => {
      window.removeEventListener("rabbitty-readiness-sync", loadManual);
      window.removeEventListener("storage", loadManual);
    };
  }, []);

  // Cerrar popover al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unified = computeUnifiedReadiness(data, manualCompleted);

  // ── Notificaciones in-app por transición (mínimo alcanzado / TOP completado) ──
  useEffect(() => {
    if (!data) return;
    const key = "rabbitty_readiness_last_level";
    const minComplete = data.minComplete;
    const topComplete = unified.percent >= 100;
    try {
      const stored = localStorage.getItem(key) || "";
      if (topComplete && lastLevel.current !== "top" && stored !== "top") {
        import("sonner").then(({ toast }) => toast.success("🏆 ¡Perfil TOP completado! Tu negocio luce al máximo para los Rabbitters."));
        localStorage.setItem(key, "top");
      } else if (minComplete && stored !== "min" && stored !== "top") {
        import("sonner").then(({ toast }) => toast.success("✅ ¡Perfil mínimo listo! Ya puedes recibir Rabbitters. Completa el TOP para brillar."));
        localStorage.setItem(key, "min");
      }
    } catch {}
    lastLevel.current = topComplete ? "top" : minComplete ? "min" : "partial";
  }, [data, unified.percent]);

  if (isLoading || !data) return null;

  const level = unified.percent >= 100 ? "top" : data.minComplete ? "min+" : "partial";
  const color =
    level === "top" ? "text-emerald-400" : level === "min+" ? "text-cyan-400" : "text-amber-400";
  const btnStyle =
    level === "top"
      ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/25"
      : level === "min+"
      ? "bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border-cyan-500/25"
      : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/25";
  const barColor =
    level === "top" ? "bg-emerald-500" : level === "min+" ? "bg-cyan-500" : "bg-amber-500";
  const faltantesMin = data.min.items.filter((i: ReadinessItem) => !i.done);
  const faltantesTop = data.top.items.filter((i: ReadinessItem) => !i.done);

  return (
    <div ref={containerRef} className="relative print:hidden">
      {/* ── Botón compacto en el Navbar ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Preparación y Perfil del Negocio (Readiness)"
        className={`flex items-center gap-1.5 sm:gap-2 rounded-xl px-2.5 sm:px-3 py-2 text-xs font-bold transition-all border cursor-pointer active:scale-95 ${btnStyle}`}
      >
        {level === "top" ? (
          <Trophy className="h-4 w-4 shrink-0 text-emerald-400" />
        ) : (
          <Target className={`h-4 w-4 shrink-0 ${color}`} />
        )}
        <span className="hidden xl:inline whitespace-nowrap">Readiness</span>
        <span className="font-black tracking-tight">{unified.percent}%</span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 opacity-75 shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 opacity-75 shrink-0" />
        )}
      </button>

      {/* ── Popover desplegable con todo el detalle al hacer clic ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="fixed sm:absolute right-3 left-3 sm:left-auto sm:right-0 top-16 sm:top-full sm:mt-2 sm:w-96 max-h-[82vh] overflow-y-auto custom-scrollbar z-50 rounded-2xl border border-white/10 bg-zinc-950/95 backdrop-blur-xl p-4 space-y-4 shadow-2xl"
          >
            {/* Cabecera con barra de progreso unificada */}
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-gray-200">
                  Preparación del Negocio {level === "top" ? "· TOP ✓" : level === "min+" ? "· Mínimo Listo" : "· En Construcción"}
                </span>
                <span className={`text-xs font-black ${color}`}>{unified.percent}%</span>
              </div>
              <div className="h-2 rounded-full bg-black/60 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                  style={{ width: `${unified.percent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-400 font-semibold pt-0.5">
                <span>Perfil comercial: {unified.topDoneCount}/{unified.topTotalCount}</span>
                <span>Pasos operativos: {unified.wizardDoneCount}/{unified.wizardTotalCount}</span>
              </div>
            </div>

            {/* MÍNIMO */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" /> Mínimo para recibir Rabbitters ({data.min.done}/{data.min.total})
              </p>
              <div className="mt-2 space-y-1.5">
                {data.min.items.map((item: ReadinessItem) => (
                  <ReadinessRow key={item.id} item={item} onSelect={() => setOpen(false)} />
                ))}
              </div>
            </div>

            {/* TOP */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5" /> TOP — experiencia completa ({data.top.done}/{data.top.total})
              </p>
              <div className="mt-2 space-y-1.5">
                {data.top.items
                  .filter((i: ReadinessItem) => !i.done || i.id === "website")
                  .map((item: ReadinessItem) => (
                    <ReadinessRow key={item.id} item={item} onSelect={() => setOpen(false)} />
                  ))}
              </div>
            </div>

            {faltantesMin.length === 0 && faltantesTop.length === 0 && (
              <p className="text-[11px] text-emerald-400 font-bold text-center py-1">
                🏆 ¡Todo completo! Tu negocio está al máximo para los Rabbitters.
              </p>
            )}

            {/* Landing Rabbitty (si no hay sitio web) */}
            {!data.top.items.find((i: ReadinessItem) => i.id === "website")?.done && (
              <a
                href="https://www.rabbitty.me"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl bg-sky-500/10 border border-sky-500/25 px-3 py-2 text-[11px] font-bold text-sky-300 hover:bg-sky-500/20 transition-all"
              >
                <Globe className="h-3.5 w-3.5" /> ¿Sin sitio web? Reclama tu Landing Rabbitty gratis
                <ArrowRight className="h-3.5 w-3.5 ml-auto" />
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReadinessRow({
  item,
  onSelect,
}: {
  item: { id: string; label: string; done: boolean; href: string; cta: string };
  onSelect: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onSelect}
      className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 border transition-all group ${
        item.done
          ? "bg-emerald-500/5 border-emerald-500/20 opacity-70 hover:opacity-100"
          : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-pink-500/30"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {item.done ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        ) : (
          <Circle className="h-4 w-4 text-amber-400 shrink-0" />
        )}
        <span className={`text-[11px] truncate ${item.done ? "text-gray-500 line-through" : "text-gray-200 font-bold"}`}>
          {item.label}
        </span>
      </div>
      {!item.done && (
        <span className="text-[10px] font-black text-pink-400 flex items-center gap-1 shrink-0 group-hover:translate-x-0.5 transition-transform">
          {item.cta} <ArrowRight className="h-3 w-3" />
        </span>
      )}
    </Link>
  );
}
