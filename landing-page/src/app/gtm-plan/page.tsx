'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  Cpu,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface MilestoneDay {
  day: number;
  title: string;
  category: 'piloto' | 'comercial' | 'subdominios' | 'escala';
  deliverable: string;
  details: string;
  status: 'completado' | 'en_proceso' | 'pendiente';
}

const DAYS_DATA: MilestoneDay[] = [
  // SEMANA 1
  { day: 1, title: 'Auditoría de Catálogo y Precios', category: 'piloto', deliverable: 'Cotejo de 52 productos y 10 categorías', details: 'Asegurar coincidencia 100% de precios reales de 626 Café en base de datos Neon.', status: 'completado' },
  { day: 2, title: 'Prueba de Enlace Universal Público', category: 'piloto', deliverable: 'Carga < 1s sin sesión de Telegram', details: 'Verificación en Safari y Chrome incógnito de app.rabbitty.me/affiliate/[id].', status: 'completado' },
  { day: 3, title: 'Instalación de Displays QR en Mesas', category: 'piloto', deliverable: '6 mesas con QR contextual (?table=N)', details: 'Instalación de soportes acrílicos y sticker de caja para acumulación de Bunz.', status: 'en_proceso' },
  { day: 4, title: 'Capacitación Flash del Personal (60s)', category: 'piloto', deliverable: 'Baristas y meseros capacitados', details: 'Entrenamiento para invitar a escanear la mesa en modo Solo Menú Digital.', status: 'en_proceso' },
  { day: 5, title: 'Primer Fin de Semana con Tráfico Real', category: 'piloto', deliverable: 'Observación y registro de uso presencial', details: 'Comportamiento de clientes durante horas pico y registro de impresiones.', status: 'pendiente' },
  { day: 6, title: 'Análisis de Métricas de Fin de Semana', category: 'piloto', deliverable: 'Reporte de aperturas de menú y clics', details: 'Revisión de platillos más vistos y tiempo de permanencia en el catálogo.', status: 'pendiente' },
  { day: 7, title: 'Reunión de Feedback con Gerente', category: 'piloto', deliverable: 'Ajustes finos post-fin de semana', details: 'Retroalimentación de 15 minutos con el dueño de 626 Café.', status: 'pendiente' },

  // SEMANA 2
  { day: 8, title: 'Kit de Demostración Móvil Comercial', category: 'comercial', deliverable: 'Demo en teléfono propio lista en 30s', details: 'Preparación de speech comercial enfocado en resolver el menú digital sin apps pesadas.', status: 'pendiente' },
  { day: 9, title: 'Ronda de Prospección en Corredor Local', category: 'comercial', deliverable: '8 comercios vecinos visitados', details: 'Visita directa a pizzerías, barberías y cafeterías del mismo radio.', status: 'pendiente' },
  { day: 10, title: 'Onboarding Comercios #2 y #3', category: 'comercial', deliverable: '2 nuevos menús digitalizados', details: 'Carga de productos y fotos en el portal administrativo /menu.', status: 'pendiente' },
  { day: 11, title: 'Onboarding Comercios #4 y #5', category: 'comercial', deliverable: 'Barbería/Spa y Restaurante formal', details: 'Configuración de catálogo de servicios profesionales y mesas QR.', status: 'pendiente' },
  { day: 12, title: 'Entrega de Displays y QR Personalizados', category: 'comercial', deliverable: 'Materiales físicos instalados en 4 locales', details: 'Entrega de displays acrílicos de mostrador con el branding de cada negocio.', status: 'pendiente' },
  { day: 13, title: 'Prueba de Tráfico Cruzado Inicial', category: 'comercial', deliverable: 'Interconexión en Mapa Neón', details: 'Aparición destacada de los 5 locales en el mapa y feed de descubrimientos.', status: 'pendiente' },
  { day: 14, title: 'Reporte Quincenal Consolidado', category: 'comercial', deliverable: '5 comercios operando en vivo', details: 'Evaluación de estabilidad técnica, visitas totales e índice de satisfacción.', status: 'pendiente' },

  // SEMANA 3
  { day: 15, title: 'Activación de Subdominios Oficiales', category: 'subdominios', deliverable: '626cafe.rabbitty.me activo en SSR', details: 'Resolución de subdominios con middleware y certificados SSL wildcard.', status: 'completado' },
  { day: 16, title: 'Inyección de Microdatos JSON-LD Schema.org', category: 'subdominios', deliverable: 'Validación en Google Rich Results', details: 'Estructuración semántica de menú, precios, horarios y coordenadas geográficas.', status: 'completado' },
  { day: 17, title: 'Campaña "Tu Sitio Web en Google y ChatGPT"', category: 'subdominios', deliverable: 'Presentación de valor a comercios', details: 'Explicación de presencia web independiente con indexación automática para IA.', status: 'pendiente' },
  { day: 18, title: 'Vinculación a Redes y Google Maps', category: 'subdominios', deliverable: 'Enlace en bio de Instagram y GBP', details: 'Asistencia para colocar tunegocio.rabbitty.me en los perfiles públicos del comercio.', status: 'pendiente' },
  { day: 19, title: 'Expansión a Comercios #6 al #10', category: 'subdominios', deliverable: '5 nuevos comercios con subdominio', details: 'Cierre comercial apalancado en la oferta de sitio web propio incluido.', status: 'pendiente' },
  { day: 20, title: 'Auditoría de Rastreadores e Indexación', category: 'subdominios', deliverable: 'Inspección de bots de IA y Googlebot', details: 'Monitoreo de tiempos de respuesta del SSR y cobertura de sitemaps.', status: 'pendiente' },
  { day: 21, title: 'Pruebas de Recomendación en Bunzy IA', category: 'subdominios', deliverable: 'Recomendaciones con botón Ver Sucursal', details: 'Consultas conversacionales en el concierge oficial con enlace a los comercios.', status: 'completado' },

  // SEMANA 4
  { day: 22, title: 'Prueba de Pedido Digital en Mesa Piloto', category: 'escala', deliverable: 'Envío de orden a cocina vía carrito', details: 'Activación controlada de comandas digitales en mesas selectas de 626 Café.', status: 'pendiente' },
  { day: 23, title: 'Expansión a Comercios #11 al #15', category: 'escala', deliverable: 'Gimnasios y tiendas de retail', details: 'Configuración de paquetes de membresías y catálogo de productos físicos.', status: 'pendiente' },
  { day: 24, title: 'Campaña Happy Hour Bunz en la Red', category: 'escala', deliverable: 'Doble Bunz en horarios valle', details: 'Activación de bonificación aumentada para dinamizar horas de baja afluencia.', status: 'pendiente' },
  { day: 25, title: 'Auditoría de Ledger y Cero Emisión Fantasma', category: 'escala', deliverable: 'Consistencia contable en base de datos', details: 'Verificación de que cada Bunz acreditado provenga de transacciones auditadas.', status: 'pendiente' },
  { day: 26, title: 'Grabación de Testimonios y Reels', category: 'escala', deliverable: '3 piezas de video con dueños y comensales', details: 'Producción de contenido orgánico mostrando la experiencia real en el local.', status: 'pendiente' },
  { day: 27, title: 'Publicación de Caso de Estudio en Landing', category: 'escala', deliverable: 'Métricas de retención en rabbitty.me', details: 'Actualización de la landing principal con datos de incremento en ticket promedio.', status: 'pendiente' },
  { day: 28, title: 'Taller de Autonomía B2B para Afiliados', category: 'escala', deliverable: 'Comercios editando su catálogo sin ayuda', details: 'Capacitación para activar platillos agotados y promociones de temporada.', status: 'pendiente' },
  { day: 29, title: 'Medición de Búsquedas Orgánicas y Citas IA', category: 'escala', deliverable: 'Reporte de visibilidad SEO / LLM', details: 'Evaluación de consultas en buscadores y apariciones en resúmenes generativos.', status: 'pendiente' },
  { day: 30, title: 'Cierre de Mes: 20 Comercios y Escalamiento', category: 'escala', deliverable: 'Plan de expansión a siguiente ciudad', details: 'Presentación de resultados consolidados a inversionistas y aliados estratégicos.', status: 'pendiente' },
];

export default function GTMPlanPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<MilestoneDay>(DAYS_DATA[0]);

  const filteredDays = DAYS_DATA.filter(
    d => selectedCategory === 'all' || d.category === selectedCategory
  );

  const completedCount = DAYS_DATA.filter(d => d.status === 'completado').length;
  const inProgressCount = DAYS_DATA.filter(d => d.status === 'en_proceso').length;

  return (
    <div className="min-h-screen bg-[#07070C] text-white selection:bg-[#E91E63] selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-[#07070C]/85 backdrop-blur-xl border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 no-underline text-white">
            <Image src="/icon_ra.png" alt="Rabbitty" width={32} height={32} className="object-contain" />
            <div>
              <span className="font-black text-base tracking-tight block leading-none">
                Rabbitty GTM
              </span>
              <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">
                Plan Operativo de 30 Días
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-full text-xs font-bold">
              <span className="text-emerald-400">● {completedCount} completados</span>
              <span className="text-white/30">•</span>
              <span className="text-amber-400">● {inProgressCount} en proceso</span>
            </div>
            <Link
              href="/"
              className="text-xs font-black text-pink-400 hover:text-pink-300 no-underline px-3 py-1.5 rounded-xl hover:bg-white/5 transition-colors"
            >
              Volver a Rabbitty →
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="relative px-6 pt-12 pb-8 border-b border-white/5 bg-linear-to-b from-pink-950/20 via-transparent to-transparent">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#E91E63]/15 border border-[#E91E63]/30 text-pink-400 text-xs font-black uppercase tracking-wider">
            <Calendar size={14} /> Calendario de Ejecución & Expansión Comercial
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            De 1 Piloto a <span className="text-gradient">20 Sucursales Digitales</span> en 30 Días.
          </h1>
          <p className="text-sm sm:text-base text-white/60 max-w-3xl leading-relaxed">
            Estrategia paso a paso para activar físicamente Rabbitty Digital Branch, lanzar landing pages automáticas con subdominio propio y posicionar a cada comercio en los motores de búsqueda de IA.
          </p>

          {/* Progress Bar */}
          <div className="pt-4 max-w-2xl">
            <div className="flex justify-between text-xs font-bold mb-2">
              <span className="text-white/60">Progreso General del Plan</span>
              <span className="text-pink-400">{Math.round((completedCount / DAYS_DATA.length) * 100)}%</span>
            </div>
            <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-[#E91E63] to-[#8B5CF6] transition-all duration-500 rounded-full"
                style={{ width: `${(completedCount / DAYS_DATA.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Main Interactive Grid */}
      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        {/* Category Filter Pills */}
        <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { id: 'all', label: 'Todos los Días (1-30)' },
            { id: 'piloto', label: 'Semana 1: Piloto 626 Café' },
            { id: 'comercial', label: 'Semana 2: Captación (5 Comercios)' },
            { id: 'subdominios', label: 'Semana 3: Subdominios & LLM SEO' },
            { id: 'escala', label: 'Semana 4: Escala a 20 Locales' },
          ].map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-black transition-all border ${
                selectedCategory === c.id
                  ? 'bg-[#E91E63] text-white border-[#E91E63] shadow-lg shadow-[#E91E63]/30'
                  : 'bg-[#14141E] text-white/70 border-white/10 hover:bg-white/10'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* 2-Column Layout: Calendar Grid on left, Day Detail on right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar List (2 columns on LG) */}
          <div className="lg:col-span-2 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredDays.map(d => {
                const isSelected = selectedDay.day === d.day;
                const statusColor =
                  d.status === 'completado'
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : d.status === 'en_proceso'
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-white/5 bg-[#12121A]';

                const badgeText =
                  d.status === 'completado'
                    ? 'Completado'
                    : d.status === 'en_proceso'
                    ? 'En Ejecución'
                    : 'Programado';

                const badgeClass =
                  d.status === 'completado'
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : d.status === 'en_proceso'
                    ? 'text-amber-400 bg-amber-500/10'
                    : 'text-white/40 bg-white/5';

                return (
                  <motion.div
                    key={d.day}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedDay(d)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${statusColor} ${
                      isSelected ? 'ring-2 ring-[#E91E63] shadow-xl' : 'hover:border-white/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-pink-400">DÍA {d.day}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClass}`}>
                          {badgeText}
                        </span>
                      </div>
                      <h3 className="font-black text-sm text-white line-clamp-1">{d.title}</h3>
                      <p className="text-xs text-white/50 line-clamp-2 mt-1 leading-relaxed">
                        {d.deliverable}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40">
                      <span className="capitalize">{d.category}</span>
                      <span className="text-pink-400 font-bold flex items-center gap-0.5">
                        Ver plan <ChevronRight size={12} />
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Sticky Detail Inspector on Right */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-[#14141E] border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <span className="text-2xl font-black text-pink-400">DÍA {selectedDay.day}</span>
                <span
                  className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                    selectedDay.status === 'completado'
                      ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/20'
                      : selectedDay.status === 'en_proceso'
                      ? 'text-amber-400 bg-amber-500/15 border border-amber-500/20'
                      : 'text-white/40 bg-white/10'
                  }`}
                >
                  {selectedDay.status.replace('_', ' ')}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-white/40 block mb-1">
                  Hito Operativo
                </span>
                <h3 className="text-xl font-black text-white leading-tight">{selectedDay.title}</h3>
              </div>

              <div className="space-y-1.5 p-3.5 rounded-2xl bg-white/5 border border-white/5">
                <span className="text-xs font-bold text-pink-300 block">Entregable Concreto:</span>
                <p className="text-xs text-white/80 font-medium leading-relaxed">
                  {selectedDay.deliverable}
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-white/50 block">Detalle de Ejecución:</span>
                <p className="text-xs text-white/70 leading-relaxed">{selectedDay.details}</p>
              </div>

              {/* Special Technical Highlights for Week 3/4 */}
              {selectedDay.category === 'subdominios' && (
                <div className="p-3.5 rounded-2xl bg-linear-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                    <Cpu size={14} /> Capa Técnica de LLM SEO
                  </div>
                  <p className="text-[11px] text-white/60 leading-relaxed">
                    Inyección de Schema.org JSON-LD con coordenadas GEO y menú estructurado para indexación en ChatGPT Search y Google Gemini.
                  </p>
                </div>
              )}

              <div className="pt-2">
                <Link
                  href="/626cafe"
                  target="_blank"
                  className="w-full bg-linear-to-r from-[#E91E63] to-[#FF4081] text-white py-3 px-4 rounded-2xl font-black text-xs text-center block shadow-lg shadow-[#E91E63]/30 hover:scale-102 transition-transform no-underline"
                >
                  Ver Demo Landing en Vivo (626 Café) →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6 text-center text-xs text-white/40 space-y-2">
        <p>© 2026 Rabbitty Network · Plan Estratégico y Hoja de Ruta Operativa.</p>
      </footer>
    </div>
  );
}
