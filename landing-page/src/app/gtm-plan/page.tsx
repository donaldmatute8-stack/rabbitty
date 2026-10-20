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
  actionLink?: string;
  actionLabel?: string;
}

const DAYS_DATA: MilestoneDay[] = [
  // SEMANA 1: PILOTO EN VIVO 626 CAFÉ & MENÚ UNIVERSAL
  { 
    day: 1, 
    title: 'Auditoría de Catálogo y Precios', 
    category: 'piloto', 
    deliverable: 'Cotejo de 52 productos y 10 categorías en Neon DB', 
    details: 'Asegurar coincidencia 100% de precios reales de 626 Café con modificadores de bebida y categorías visuales.', 
    status: 'completado',
    actionLink: '/626cafe',
    actionLabel: 'Ver Catálogo 626 Café'
  },
  { 
    day: 2, 
    title: 'Prueba de Enlace Universal Público (SSR)', 
    category: 'piloto', 
    deliverable: 'Carga < 1s sin barrera de Telegram ni app obligatoria', 
    details: 'Verificación en Safari y Chrome incógnito de app pública con modo de mesa y vista de sucursal.', 
    status: 'completado',
    actionLink: 'https://rabbitty.me/626cafe',
    actionLabel: 'Probar Enlace Universal'
  },
  { 
    day: 3, 
    title: 'Generación de Displays y Carteles de Mesa', 
    category: 'piloto', 
    deliverable: 'Kit de impresos A3/A5/A6 con QR contextual y co-branding', 
    details: 'Herramienta de impresos con soporte A3 cristalera, habladores de mesa con QR por mesa y señalética de caja.', 
    status: 'completado',
    actionLink: '/impresos?name=626%20Caf%C3%A9&ref=promo_626cafe&bunz=25',
    actionLabel: 'Abrir Generador de Impresos'
  },
  { 
    day: 4, 
    title: 'Capacitación Flash de Baristas & Modo Caja', 
    category: 'piloto', 
    deliverable: 'Portal móvil de negocio con escaneo y canjes en 5 segundos', 
    details: 'Capacitación al equipo para acreditar Bunz al cobrar y validar canjes desde el móvil con feedback háptico.', 
    status: 'completado',
    actionLink: 'https://t.me/RabbittyBot?start=portal_626cafe',
    actionLabel: 'Ver Demo Portal Móvil'
  },
  { 
    day: 5, 
    title: 'Primer Fin de Semana con Tráfico Real', 
    category: 'piloto', 
    deliverable: 'Observación y registro de uso presencial en horas pico', 
    details: 'Monitoreo de comportamiento de clientes, escaneo de QR en mesa y primer lote de Bunz emitidos en caja.', 
    status: 'completado' 
  },
  { 
    day: 6, 
    title: 'Análisis de Telemetría y Cero Emisión Fantasma', 
    category: 'piloto', 
    deliverable: 'Dashboard de reconciliación contable y telemetría de QR', 
    details: 'Cruce del ledger de Bunz emitidos vs consumos reales registrados, confirmando 100% de integridad contable.', 
    status: 'completado' 
  },
  { 
    day: 7, 
    title: 'Reunión de Feedback con Gerente & Vibe Tuning', 
    category: 'piloto', 
    deliverable: 'Optimización de experiencia sonora y menú según retroalimentación', 
    details: 'Sesión de 15 min con el gerente de 626 Café: ajuste de platillos más pedidos y calibración de atmósfera.', 
    status: 'completado' 
  },

  // SEMANA 2: CORREDOR LOCAL & CAPTACIÓN INICIAL (5 COMERCIOS)
  { 
    day: 8, 
    title: 'Kit de Demostración Móvil Comercial en 30s', 
    category: 'comercial', 
    deliverable: 'Demo en teléfono propio lista para mostrar a dueños en caliente', 
    details: 'Speech comercial enfocado en: "Tu menú digital en Google + IA sin comisiones abusivas y con recompensas reales".', 
    status: 'completado',
    actionLink: '/impresos',
    actionLabel: 'Ver Kit Demostración'
  },
  { 
    day: 9, 
    title: 'Ronda de Prospección en Corredor Local (Radio 1km)', 
    category: 'comercial', 
    deliverable: '8 comercios vecinos visitados en el cluster gastronómico', 
    details: 'Visita directa a pizzerías, cervecerías artesanales, barberías y cafeterías del mismo radio de influencia.', 
    status: 'en_proceso' 
  },
  { 
    day: 10, 
    title: 'Onboarding Comercios #2 y #3 (Comida & Bebida)', 
    category: 'comercial', 
    deliverable: '2 nuevos catálogos digitalizados y subdominios asignados', 
    details: 'Carga de productos y fotos en el portal administrativo con asignación de cupo inicial de Bunz promocionales.', 
    status: 'en_proceso' 
  },
  { 
    day: 11, 
    title: 'Onboarding Comercios #4 y #5 (Servicios & Retail)', 
    category: 'comercial', 
    deliverable: 'Barbería/Studio y Restaurante de Mar con menú digital', 
    details: 'Configuración de catálogo de servicios profesionales, citas y mesas QR con landing personalizada.', 
    status: 'pendiente' 
  },
  { 
    day: 12, 
    title: 'Entrega de Displays y QR Personalizados', 
    category: 'comercial', 
    deliverable: 'Materiales físicos instalados en los 5 primeros locales', 
    details: 'Entrega de displays acrílicos de mostrador con el branding y logo oficial de cada negocio.', 
    status: 'pendiente',
    actionLink: '/impresos',
    actionLabel: 'Kits para Impresión'
  },
  { 
    day: 13, 
    title: 'Prueba de Tráfico Cruzado Inicial (Efecto Red)', 
    category: 'comercial', 
    deliverable: 'Interconexión en Mapa Neón & Vibe Passport', 
    details: 'Ruta temática urbana conectando los 5 comercios para que los clientes acumulen en café y canjeen en cena.', 
    status: 'pendiente' 
  },
  { 
    day: 14, 
    title: 'Reporte Quincenal Consolidado (Hito 5 Comercios)', 
    category: 'comercial', 
    deliverable: '5 comercios operando en vivo con métricas de recurrencia', 
    details: 'Evaluación de estabilidad técnica, visitas totales, Bunz en circulación y tasa de re-visita de clientes.', 
    status: 'pendiente' 
  },

  // SEMANA 3: SUBDOMINIOS OFICIALES, LLM SEO & CONCIERGE BUNZY
  { 
    day: 15, 
    title: 'Activación de Subdominios Oficiales Wildcard', 
    category: 'subdominios', 
    deliverable: 'Subdominios dedicados tunegocio.rabbitty.me activos con SSL', 
    details: 'Resolución multitenant con middleware Edge, carga instantánea y certificado wildcard automático.', 
    status: 'completado',
    actionLink: 'https://rabbitty.me/626cafe',
    actionLabel: 'Ver Subdominio Oficial'
  },
  { 
    day: 16, 
    title: 'Inyección de Microdatos Schema.org para Motores de IA', 
    category: 'subdominios', 
    deliverable: 'Validación en Google Rich Results & Citaciones LLM', 
    details: 'Estructuración semántica de Restaurant/LocalBusiness con menú, precios, horarios, geo y reseñas auditadas.', 
    status: 'completado' 
  },
  { 
    day: 17, 
    title: 'Campaña "Tu Sitio Web en Google, ChatGPT y Gemini"', 
    category: 'subdominios', 
    deliverable: 'Presentación de valor de alto impacto a dueños de negocio', 
    details: 'Explicación de presencia web independiente con indexación automática para respuestas conversacionales de IA.', 
    status: 'en_proceso' 
  },
  { 
    day: 18, 
    title: 'Vinculación a Google Maps, Instagram Bio y TikTok', 
    category: 'subdominios', 
    deliverable: 'Enlace en bio y ficha de Google Business Profile activada', 
    details: 'Asistencia personalizada a cada comercio para sustituir PDFs ilegibles por su enlace oficial Rabbitty.', 
    status: 'pendiente' 
  },
  { 
    day: 19, 
    title: 'Expansión Acelerada a Comercios #6 al #10', 
    category: 'subdominios', 
    deliverable: '5 nuevos comercios onboardeados con subdominio propio', 
    details: 'Cierre comercial apalancado en la oferta de "Sitio web oficial indexado en Google sin pagar agencia".', 
    status: 'pendiente' 
  },
  { 
    day: 20, 
    title: 'Auditoría de Rastreadores e Indexación Automática', 
    category: 'subdominios', 
    deliverable: 'Monitoreo de robots.txt, sitemaps y cobertura en Perplexity', 
    details: 'Auditoría técnica de respuestas HTTP, tiempo TTFB < 250ms y posicionamiento local orgánico.', 
    status: 'pendiente' 
  },
  { 
    day: 21, 
    title: 'Recomendaciones Hiperlocales con Bunzy IA', 
    category: 'subdominios', 
    deliverable: 'Concierge autónomo que guía comensales a las sucursales', 
    details: 'Bunzy IA recomienda en tiempo real comercios afiliados según el mood, ubicación y saldo de Bunz del usuario.', 
    status: 'completado',
    actionLink: 'https://t.me/RabbittyBot',
    actionLabel: 'Hablar con Bunzy en Telegram'
  },

  // SEMANA 4: ESCALA A 20 SUCURSALES, FIDELIZACIÓN & CASO DE ESTUDIO
  { 
    day: 22, 
    title: 'Prueba de Pedido Digital & Comanda en Mesa', 
    category: 'escala', 
    deliverable: 'Envío de orden a cocina vía carrito web sin descargar app', 
    details: 'Activación de comandas digitales opcionales en mesas con código QR contextual para agilizar horas pico.', 
    status: 'pendiente' 
  },
  { 
    day: 23, 
    title: 'Expansión a Comercios #11 al #15 (Comunidad Multirrubro)', 
    category: 'escala', 
    deliverable: 'Entrada de gimnasios, boutiques de diseño y retail de especialidad', 
    details: 'Configuración de paquetes de membresías y canje cruzado en comercios no gastronómicos.', 
    status: 'pendiente' 
  },
  { 
    day: 24, 
    title: 'Campaña "Happy Hour Bunz" en la Red de la Ciudad', 
    category: 'escala', 
    deliverable: 'Doble Bunz en horarios valle para dinamizar la tarde', 
    details: 'Notificaciones push y Telegram a comensales con saldo acumulado para visitar locales con afluencia baja.', 
    status: 'pendiente' 
  },
  { 
    day: 25, 
    title: 'Auditoría Integral de Ledger & Data Room de Inversión', 
    category: 'escala', 
    deliverable: 'Consistencia contable en base de datos & métricas de unit economics', 
    details: 'Verificación de que cada Bunz acreditado provenga de consumo real verificado. Métricas de retención D30.', 
    status: 'pendiente' 
  },
  { 
    day: 26, 
    title: 'Producción de Testimonios Reales & Casos de Éxito', 
    category: 'escala', 
    deliverable: 'Reels y mini-documentales con dueños de negocio y clientes', 
    details: 'Contenido orgánico mostrando al barista cobrando con Bunz y al comensal acumulando en 3 segundos.', 
    status: 'pendiente' 
  },
  { 
    day: 27, 
    title: 'Onboarding Final Comercios #16 al #20 (Meta 20 Cumplida)', 
    category: 'escala', 
    deliverable: '20 sucursales activas interconectadas en el mapa urbano', 
    details: 'Consolidación de la primera red de lealtad urbana auto-sostenible con más de 20 puntos de cobro.', 
    status: 'pendiente' 
  },
  { 
    day: 28, 
    title: 'Taller de Autonomía B2B para Afiliados', 
    category: 'escala', 
    deliverable: 'Comercios editando su catálogo, fotos y promos de forma autónoma', 
    details: 'Capacitación para activar platillos agotados, crear promociones flash y revisar su balance desde el móvil.', 
    status: 'pendiente' 
  },
  { 
    day: 29, 
    title: 'Medición de Visibilidad Orgánica & Reporte de Retención', 
    category: 'escala', 
    deliverable: 'Reporte de impacto en ticket promedio (+18% estimado)', 
    details: 'Evaluación del impacto en volumen de ventas, número de nuevos clientes descubiertos y fidelidad de clientes.', 
    status: 'pendiente' 
  },
  { 
    day: 30, 
    title: 'Cierre de Mes: 20 Comercios & Lanzamiento al Próximo Hub', 
    category: 'escala', 
    deliverable: 'Playbook operativo empaquetado para réplica en siguiente ciudad', 
    details: 'Presentación de resultados consolidados, playbook de ventas estandarizado y roadmap hacia los 100 locales.', 
    status: 'pendiente' 
  },
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

              <div className="pt-2 space-y-2">
                {selectedDay.actionLink && (
                  <Link
                    href={selectedDay.actionLink}
                    target={selectedDay.actionLink.startsWith('http') ? '_blank' : undefined}
                    className="w-full bg-linear-to-r from-[#E91E63] to-[#FF4081] text-white py-3 px-4 rounded-2xl font-black text-xs text-center block shadow-lg shadow-[#E91E63]/30 hover:scale-[1.02] active:scale-[0.98] transition-all no-underline"
                  >
                    {selectedDay.actionLabel || 'Ver Entregable en Vivo'} →
                  </Link>
                )}

                <Link
                  href="/626cafe"
                  target="_blank"
                  className={`w-full py-2.5 px-4 rounded-2xl font-black text-xs text-center block transition-all no-underline ${
                    selectedDay.actionLink
                      ? 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
                      : 'bg-linear-to-r from-[#E91E63] to-[#FF4081] text-white shadow-lg shadow-[#E91E63]/30 hover:scale-[1.02]'
                  }`}
                >
                  Ver Demo Landing Piloto (626 Café) ↗
                </Link>

                <Link
                  href="/impresos"
                  className="w-full py-2 px-4 rounded-xl text-center block text-[11px] font-bold text-pink-400/80 hover:text-pink-300 transition-colors no-underline"
                >
                  🖨️ Generador de Displays & Carteles Oficiales →
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
