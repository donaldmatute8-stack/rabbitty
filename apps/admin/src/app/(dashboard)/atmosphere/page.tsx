"use client";

import { useState, useEffect } from "react";
import { Card } from "@rabbitty/ui";
import { 
  Sparkles, 
  Activity, 
  TrendingUp, 
  Compass, 
  Headphones, 
  Store, 
  CheckCircle2, 
  Clock, 
  Award,
  Zap,
  Info
} from "lucide-react";

export default function AtmosphereStrategyPage() {
  const [activeTab, setActiveTab] = useState<"poa" | "passport" | "sonic" | "graph">("poa");
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // In demo or live dashboard mode, fetch metrics for current branch
    setLoading(true);
    fetch('/api/mood/poa-metrics?businessId=default-branch')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setMetrics(data.metrics);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8 pb-10">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-linear-to-br from-amber-950/40 via-purple-950/20 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="h-3.5 w-3.5" /> Nueva Dimensión Phygital V2.0
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              Atmósfera & Conexión
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium max-w-2xl">
              Prueba empírica de retorno ambiental (PoA), pasaporte urbano colaborativo, curaduría acústica legal y grafo de experiencia de red.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/5 pb-4">
        {[
          { key: "poa", label: "Proof of Atmosphere (PoA)", icon: Activity, color: "text-emerald-400" },
          { key: "passport", label: "Vibe Passport", icon: Compass, color: "text-cyan-400" },
          { key: "sonic", label: "Sonic Room", icon: Headphones, color: "text-violet-400" },
          { key: "graph", label: "Vibe Graph", icon: Store, color: "text-blue-400" },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? "bg-white/10 text-white border border-white/15 shadow-sm shadow-white/5"
                  : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              <Icon className={`h-4 w-4 ${tab.color}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Proof of Atmosphere */}
      {activeTab === "poa" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className="bg-gray-950 border-white/10 p-6 rounded-3xl space-y-2">
              <div className="flex items-center justify-between text-gray-400 text-xs font-semibold">
                <span>Intervenciones Registradas</span>
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-3xl font-black text-white">
                {metrics?.totalInterventionsLogged || 4}
              </div>
              <p className="text-[11px] text-gray-500">Recetas de iluminación, sonido y sala ejecutadas este mes.</p>
            </Card>

            <Card className="bg-gray-950 border-white/10 p-6 rounded-3xl space-y-2">
              <div className="flex items-center justify-between text-gray-400 text-xs font-semibold">
                <span>Incremento en Satisfacción</span>
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-3xl font-black text-emerald-400">
                +{metrics?.satisfactionLiftPercent || 18}%
              </div>
              <p className="text-[11px] text-gray-500">Valoración promedio con receta vs horario baseline.</p>
            </Card>

            <Card className="bg-gray-950 border-white/10 p-6 rounded-3xl space-y-2">
              <div className="flex items-center justify-between text-gray-400 text-xs font-semibold">
                <span>Receta Estrella</span>
                <Award className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="text-xl font-black text-white">
                Tardes de Enfoque (4.9★)
              </div>
              <p className="text-[11px] text-gray-500">Mayor permanencia y ticket promedio en café de filtro.</p>
            </Card>
          </div>

          <div className="p-6 rounded-3xl bg-linear-to-r from-emerald-500/10 via-black to-gray-950 border border-emerald-500/20 space-y-3">
            <h3 className="font-extrabold text-base text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-400" />
              ¿Cómo funciona el cálculo de Proof of Atmosphere?
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed max-w-3xl">
              Cada vez que el barista o encargado presiona <strong className="text-white">"Registrar Ejecución PoA"</strong> en el portal, se abre una ventana temporal de 3 horas. El sistema cruza anónimamente las calificaciones y consumos en sala durante esa ventana con períodos similares sin intervención, aislando el impacto del ambiente en tus ventas y fidelidad.
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Vibe Passport */}
      {activeTab === "passport" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-950 border-white/10 p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                    ☕
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Ruta Creativa & Deep Work</h3>
                    <p className="text-xs text-gray-400">Enfoque & Calma urbana</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  Activa en tu zona
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Tus clientes matutinos obtienen un sello al consumir y son guiados por la app a comercios complementarios de tu colonia sin gasto en publicidad.
              </p>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between text-xs text-gray-300">
                <span>Clientes nuevos canalizados</span>
                <span className="font-bold text-emerald-400">+34 comensales / semana</span>
              </div>
            </Card>

            <Card className="bg-gray-950 border-white/10 p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                    🥂
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Ruta Social & Golden Hour</h3>
                    <p className="text-xs text-gray-400">Conexión & Celebración</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  Fines de semana
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Ideal para terrazas, coctelería y cenas compartidas. Atrae grupos y alarga el tiempo de estancia con maridajes coordinados.
              </p>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between text-xs text-gray-300">
                <span>Ticket promedio en ruta</span>
                <span className="font-bold text-purple-400">$380 MXN / persona</span>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 3: The Collective Sonic Room */}
      {activeTab === "sonic" && (
        <div className="p-6 rounded-3xl bg-gray-950 border border-white/10 space-y-4">
          <div className="flex items-center gap-2 text-violet-400 font-bold text-sm">
            <Headphones className="h-5 w-5" />
            <span>Guía de Identidad Sonora y Normativa Comercial</span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            Rabbitty proporciona curadurías de BPM y listas de reproducción universales a los comensales para escucha en sus propios audífonos. Para la música ambiental del establecimiento, se recomienda contratar una licencia de ejecución pública autorizada (Soundtrack Your Brand, Mood Media) para garantizar una operación 100% en regla y profesional.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs">
              <span className="font-bold text-white block mb-1">Calma & Lo-Fi</span>
              <p className="text-gray-400 text-[11px]">70-85 BPM · Frecuencias suaves para lectura y pausas.</p>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs">
              <span className="font-bold text-white block mb-1">Enfoque & Neo-Soul</span>
              <p className="text-gray-400 text-[11px]">90-105 BPM · Ritmos sincopados sin voces estridentes.</p>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs">
              <span className="font-bold text-white block mb-1">Celebración & Nu-Disco</span>
              <p className="text-gray-400 text-[11px]">115-124 BPM · Energía ascendente para horas doradas.</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Rabbitty Vibe Graph */}
      {activeTab === "graph" && (
        <div className="p-6 rounded-3xl bg-gray-950 border border-white/10 space-y-4">
          <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
            <Store className="h-5 w-5" />
            <span>Inteligencia de Red y Sinergias Locales</span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            El Vibe Graph identifica correlaciones de visitas entre afiliados de tu misma zona sin compartir datos individuales. Esto te permite conocer si los clientes que visitan tu cafetería en las mañanas también asisten a gimnasios o librerías vecinas, facilitando promociones conjuntas con emisión de Bunz garantizada por ambos comercios.
          </p>
          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-center justify-between">
            <span>Sinergia detectada en tu radio de 1.5 km:</span>
            <strong className="text-white">62% de correlación con estudios de Yoga y Coworkings</strong>
          </div>
        </div>
      )}
    </div>
  );
}
