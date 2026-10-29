'use client';

/**
 * ── ReadinessBar ── Perfil del negocio afiliado: barra + panel de faltantes accionables.
 * Niveles: MÍNIMO (operable/visible) · TOP (experiencia completa para Rabbitters).
 * In-app: toast al alcanzar el mínimo y al llegar al top (transiciones, no repetitivo).
 */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, CheckCircle2, Circle, ArrowRight, Trophy, Target, Globe } from "lucide-react";
import { trpc } from "../lib/trpc-client";

interface ReadinessItem {
  id: string;
  label: string;
  done: boolean;
  href: string;
  level: "min" | "top";
  cta: string;
}

export default function ReadinessBar() {
  const { data, isLoading } = trpc.admin.getReadiness.useQuery(undefined, { retry: false, staleTime: 60_000 });
  const [open, setOpen] = useState(false);
  const lastLevel = useRef<string>("");

  // ── Notificaciones in-app por transición (mínimo alcanzado / TOP completado) ──
  useEffect(() => {
    if (!data) return;
    const key = "rabbitty_readiness_last_level";
    let minComplete = data.minComplete;
    let topComplete = data.percent >= 100;
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
    void minComplete; void topComplete;
  }, [data]);

  if (isLoading || !data) return null;

  const level = data.percent >= 100 ? "top" : data.minComplete ? "min+" : "partial";
  const color =
    level === "top" ? "text-emerald-400" : level === "min+" ? "text-cyan-400" : "text-amber-400";
  const barColor =
    level === "top" ? "bg-emerald-500" : level === "min+" ? "bg-cyan-500" : "bg-amber-500";
  const faltantesMin = data.min.items.filter((i: ReadinessItem) => !i.done);
  const faltantesTop = data.top.items.filter((i: ReadinessItem) => !i.done);

  return (
    <div className="relative">
      {/* ── Barra compacta ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 transition-all cursor-pointer text-left"
      >
        {level === "top" ? <Trophy className="h-4 w-4 text-emerald-400" /> : <Target className={`h-4 w-4 ${color}`} />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 truncate">
              Perfil del negocio {level === "top" ? "TOP ✓" : level === "min+" ? "· mínimo listo" : "· en construcción"}
            </span>
            <span className={`text-[10px] font-black ${color}`}>{data.percent}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-black/50 overflow-hidden mt-1">
            <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${data.percent}%` }} />
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
      </button>

      {/* ── Panel de faltantes accionables ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-white/10 bg-zinc-950/95 backdrop-blur-xl p-4 space-y-4 shadow-2xl"
          >
            {/* MÍNIMO */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" /> Mínimo para recibir Rabbitters ({data.min.done}/{data.min.total})
              </p>
              <div className="mt-2 space-y-1.5">
                {data.min.items.map((item: ReadinessItem) => (
                  <ReadinessRow key={item.id} item={item} />
                ))}
              </div>
            </div>

            {/* TOP */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5" /> TOP — experiencia completa ({data.top.done}/{data.top.total})
              </p>
              <div className="mt-2 space-y-1.5">
                {data.top.items.filter((i: ReadinessItem) => !i.done || i.id === "website").map((item: ReadinessItem) => (
                  <ReadinessRow key={item.id} item={item} />
                ))}
              </div>
            </div>

            {faltantesMin.length === 0 && faltantesTop.length === 0 && (
              <p className="text-[11px] text-emerald-400 font-bold text-center py-1">
                🏆 ¡Todo completo! Tu negocio está al máximo para los Rabbitters.
              </p>
            )}

            {/* Landing Rabbitty (si no hay sitio web) */}
            {!data.top.items.find((i) => i.id === "website")?.done && (
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
function ReadinessRow({ item }: { item: { id: string; label: string; done: boolean; href: string; cta: string } }) {
  return (
    <Link
      href={item.href}
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
