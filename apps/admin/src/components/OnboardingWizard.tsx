"use client";

import { useState, useEffect } from "react";
import { CheckCircle, Circle, ChevronDown, ChevronUp, Sparkles, ArrowRight, Utensils, Users, Monitor, Gift, RefreshCw, Trophy } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface Step {
  id: string;
  title: string;
  description: string;
  link: string;
  linkText: string;
  icon: any;
  priority: "Alta" | "Media" | "Estratégica";
  color: string;
}

const STEPS: Step[] = [
  {
    id: "menu",
    title: "1. Carga tu Menú y Platillos",
    description: "Agrega categorías, platillos, fotos y precios. Es la base de tu punto de venta y menú digital.",
    link: "/menu",
    linkText: "Ir a Menú",
    icon: Utensils,
    priority: "Alta",
    color: "from-pink-500 to-rose-500",
  },
  {
    id: "staff",
    title: "2. Registra a tu Personal y Roles",
    description: "Da de alta a meseros, cajeros y cocineros para asignación de turnos y control de asistencia.",
    link: "/staff",
    linkText: "Ir a Personal",
    icon: Users,
    priority: "Alta",
    color: "from-purple-500 to-indigo-500",
  },
  {
    id: "tv-qr",
    title: "3. Activa tu Menú TV y Códigos QR",
    description: "Proyecta tu menú en cualquier TV HDMI y descarga códigos QR para auto-pedido por mesa.",
    link: "/menu-boards",
    linkText: "Ver Menú Digital",
    icon: Monitor,
    priority: "Media",
    color: "from-blue-500 to-cyan-500",
  },
  {
    id: "loyalty",
    title: "4. Activa Cashback Bunz y Lealtad",
    description: "Configura el porcentaje de recompensa para tus clientes frecuentes y premia su visita.",
    link: "/loyalty",
    linkText: "Configurar Lealtad",
    icon: Gift,
    priority: "Estratégica",
    color: "from-amber-500 to-emerald-500",
  },
  {
    id: "cash-cut",
    title: "5. Corte de Caja y Fondo Inicial",
    description: "Configura el fondo de gaveta, arqueo ciego diario y formato de Ticket Z térmico.",
    link: "/pos",
    linkText: "Probar en POS",
    icon: RefreshCw,
    priority: "Alta",
    color: "from-emerald-500 to-teal-500",
  },
  {
    id: "sync",
    title: "6. Pantalla KDS e Impresoras Térmicas",
    description: "Conecta tu pantalla de cocina KDS, terminales físicas y sincroniza comandas en tiempo real.",
    link: "/kitchen",
    linkText: "Abrir KDS",
    icon: Monitor,
    priority: "Estratégica",
    color: "from-orange-500 to-amber-500",
  },
  {
    id: "academy",
    title: "7. Capacitación y Guías Academy",
    description: "Consulta las guías interactivas del sistema para capacitar a cajeros, cocineros y gerentes.",
    link: "/academy",
    linkText: "Ver Guías",
    icon: Sparkles,
    priority: "Estratégica",
    color: "from-pink-500 to-purple-500",
  },
];

export function OnboardingWizard() {
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("rabbitty_onboarding_completed");
      if (saved) setCompleted(JSON.parse(saved));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const toggleStep = (id: string) => {
    const next = { ...completed, [id]: !completed[id] };
    setCompleted(next);
    try {
      localStorage.setItem("rabbitty_onboarding_completed", JSON.stringify(next));
    } catch (e) {
      console.error(e);
    }
  };

  const completedCount = Object.values(completed).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / STEPS.length) * 100);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-gray-900/80 via-black to-gray-900/90 p-6 shadow-2xl backdrop-blur-xl">
      <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-pink-500/10 blur-[100px] pointer-events-none" />

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-tr from-pink-500 to-purple-600 shadow-[0_0_20px_rgba(236,72,153,0.3)]">
            <Trophy className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">Preparación del Negocio (Business Readiness)</h2>
              <span className="rounded-full bg-pink-500/10 border border-pink-500/20 px-2.5 py-0.5 text-xs font-bold text-pink-400">
                {progressPercent}% Listo
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">
              Indicador inteligente de 7 pasos para asegurar que tu local esté 100% listo para operar y auditar ventas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-2">
            <span className="text-xs font-bold text-gray-300">{progressPercent}% completado</span>
            <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-pink-500 to-purple-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-gray-300 hover:text-white hover:bg-white/10 transition-all"
          >
            {isExpanded ? (
              <>
                <span>Minimizar</span>
                <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                <span>Ver Pasos</span>
                <ChevronDown className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expandable Steps */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="pt-6 space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {STEPS.map((step) => {
                const isDone = !!completed[step.id];
                const Icon = step.icon;

                return (
                  <div
                    key={step.id}
                    className={`relative rounded-2xl border p-5 transition-all duration-300 flex flex-col justify-between ${
                      isDone
                        ? "border-emerald-500/30 bg-emerald-500/5 backdrop-blur-md"
                        : "border-white/10 bg-white/5 hover:border-white/20 backdrop-blur-md"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <button
                          onClick={() => toggleStep(step.id)}
                          className="flex items-center gap-2 text-left group"
                        >
                          {isDone ? (
                            <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
                          ) : (
                            <Circle className="h-5 w-5 text-gray-500 group-hover:text-pink-400 shrink-0 transition-colors" />
                          )}
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            step.priority === "Alta"
                              ? "bg-pink-500/10 text-pink-400 border border-pink-500/20"
                              : step.priority === "Media"
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          }`}>
                            Prioridad {step.priority}
                          </span>
                        </button>

                        <div className={`p-2 rounded-xl bg-linear-to-tr ${step.color} text-white shadow-md`}>
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>

                      <h3 className={`font-bold text-sm mb-1 ${isDone ? "line-through text-gray-400" : "text-white"}`}>
                        {step.title}
                      </h3>
                      <p className="text-xs text-gray-400 leading-relaxed mb-4">
                        {step.description}
                      </p>
                    </div>

                    <Link
                      href={step.link}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2 px-3 text-xs font-bold text-gray-200 hover:text-white hover:bg-white/10 hover:border-pink-500/40 transition-all group w-full text-center"
                    >
                      <span>{step.linkText}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-pink-400 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
