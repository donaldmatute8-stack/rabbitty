'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles, ArrowRight, X } from 'lucide-react';

export interface PackagePlan {
  id: string;
  name: string;
  tagline: string;
  setupBunz: number;
  initialVaultBunz: number;
  badge?: string;
  isPopular?: boolean;
  features: string[];
  idealFor: string;
}

export interface NicheData {
  id: string;
  name: string;
  icon: string;
  title: string;
  subtitle: string;
  plans: PackagePlan[];
}

export const NICHES_DATA: NicheData[] = [
  {
    id: 'food',
    name: 'Gastronomía & Cafeterías',
    icon: '☕',
    title: 'Food & Beverage OS',
    subtitle: 'Desde barras de café de especialidad hasta restaurantes multizona con KDS y comandas por voz IA.',
    plans: [
      {
        id: 'food-express',
        name: 'Café Express / Quick Bite',
        tagline: 'Ideal para barras, panaderías, food trucks y dark kitchens con 1 punto de cobro.',
        setupBunz: 3500,
        initialVaultBunz: 3000,
        idealFor: '1 Terminal / Mostrador',
        features: [
          'Terminal POS para iPad, Tablet o Celular',
          'Códigos QR dinámicos para mesa y mostrador',
          'Bóveda de emisión inicial: 3,000 BUNZ de bienvenida',
          'Pin verificado en el mapa Freehands con radar',
          'Landing page propia en subdominio (tunegocio.rabbitty.me)',
          'Optimización con Schema.org y microdatos para motores de IA (ChatGPT, Perplexity y Gemini)',
          'Catálogo digital y cobro express offline-first',
          'Integración básica a Bunzy Concierge IA',
        ],
      },
      {
        id: 'food-bistro',
        name: 'Bistró & Restaurante Sala',
        tagline: 'El paquete predilecto para restaurantes con salón, gastrobares y cervecerías.',
        setupBunz: 8500,
        initialVaultBunz: 8000,
        badge: 'MÁS POPULAR',
        isPopular: true,
        idealFor: '8 a 25 Mesas con salón',
        features: [
          'Todo lo de Café Express +',
          'Sucursal digital interactiva con menú online y pedidos QR',
          'Microdatos Schema.org estructurados (menú y horarios para Google/IA)',
          'Mapa interactivo de mesas con estado en tiempo real',
          'KDS de Cocina (Kitchen Display) en pantallas táctiles',
          'Comandas móviles ilimitadas para meseros',
          'Comandas por Voz con IA (Whisper) dictadas en mesa',
          'Bóveda de emisión inicial: 8,000 BUNZ',
          'Recomendación preferente con Bunzy Concierge IA',
          'Reloj checador de turnos y costeo de recetas en vivo',
        ],
      },
      {
        id: 'food-venue',
        name: 'Gran Venue & Multi-Planta',
        tagline: 'Para restaurantes de alto volumen, terrazas, múltiples barras o franquicias.',
        setupBunz: 18000,
        initialVaultBunz: 16000,
        idealFor: '+25 Mesas / Multi-barra',
        features: [
          'Todo lo de Bistró & Restaurante +',
          'Módulo de Kiosko autoservicio para entrada/espera',
          'Soporte multi-impresoras térmicas de cocina y barra',
          'Panel corporativo multi-sucursal y control de mermas',
          'Bóveda de emisión inicial: 16,000 BUNZ',
          'Airdrops y campañas push a Rabbitters de tu zona',
          'Soporte VIP y onboarding asistido presencial',
        ],
      },
    ],
  },
  {
    id: 'fitness',
    name: 'Wellness, Gyms & Spas',
    icon: '🏋️',
    title: 'Wellness & Sport OS',
    subtitle: 'Fideliza a tus socios con check-ins gamificados, venta de retail y control de citas.',
    plans: [
      {
        id: 'fit-studio',
        name: 'Studio & Barbería de Autor',
        tagline: 'Para barberías, cabinas de spa o estudios de tatuaje y estética personal.',
        setupBunz: 3500,
        initialVaultBunz: 3000,
        idealFor: '1 a 3 Estaciones / Citas',
        features: [
          'Terminal de caja ágil para servicios y productos',
          'Cashback automático en bunz por cada corte o sesión',
          'Bóveda de emisión inicial: 3,000 BUNZ',
          'Perfil comercial con portafolio fotográfico en app',
          'Chat 1-a-1 directo para reservaciones de clientes',
        ],
      },
      {
        id: 'fit-club',
        name: 'Club & Gym Alto Rendimiento',
        tagline: 'Para gimnasios, centros de CrossFit, estudios de pilates reformer o academias.',
        setupBunz: 9500,
        initialVaultBunz: 9000,
        badge: 'RECOMENDADO',
        isPopular: true,
        idealFor: 'Gimnasios y Estudios con Membresías',
        features: [
          'Control de acceso con escaneo de Rabbitty Pass QR',
          'Gamificación: premia a tus socios por cada día de entreno',
          'Punto de venta para barra de proteína, suplementos y gear',
          'Bóveda de emisión inicial: 9,000 BUNZ',
          'Recomendación por Bunzy IA a usuarios buscando fitness',
          'Panel de métricas de retención y socios en riesgo de fuga',
        ],
      },
    ],
  },
  {
    id: 'retail',
    name: 'Retail & Boutiques',
    icon: '🏬',
    title: 'Retail & Concept Stores',
    subtitle: 'Crea drops exclusivos, liquidaciones por bunz y digitaliza tus puntos de venta.',
    plans: [
      {
        id: 'retail-boutique',
        name: 'Boutique & Pop-up Store',
        tagline: 'Para marcas independientes, librerías, tiendas de plantas o accesorios.',
        setupBunz: 4000,
        initialVaultBunz: 3500,
        idealFor: 'Tiendas de autor / Mostrador',
        features: [
          'Terminal de mostrador con lector de códigos de barra',
          'Control de inventario por SKU y tallas',
          'Bóveda de emisión inicial: 3,500 BUNZ',
          'Perfil en el directorio con geolocalización en mapa',
          'Landing page propia con subdominio (tunegocio.rabbitty.me)',
          'Datos estructurados Schema.org para descubrimiento en ChatGPT Search, Perplexity y Gemini',
          'Cobro rápido y tickets digitales vía Telegram/SMS',
        ],
      },
      {
        id: 'retail-flagship',
        name: 'Flagship & Concept Store',
        tagline: 'Para tiendas de sneakers, bazares multimarca y tiendas de diseño con alto tráfico.',
        setupBunz: 10000,
        initialVaultBunz: 9500,
        badge: 'ALTA CONVERSIÓN',
        isPopular: true,
        idealFor: 'Espacios Multimarca / Alto Tráfico',
        features: [
          'Múltiples terminales inalámbricas para asesores de piso',
          'Landing page web + sucursal digital interactiva en subdominio',
          'SEO Local con microdatos Schema.org & GEO indexing para IAs',
          'Lanzamiento de Drops exclusivos canjeables con bunz',
          'Bóveda de emisión inicial: 9,500 BUNZ',
          'Campañas push dirigidas a coleccionistas y exploradores',
          'Analítica avanzada de ticket promedio y recompra',
        ],
      },
    ],
  },
  {
    id: 'entertainment',
    name: 'Ocio & Entretenimiento',
    icon: '🎲',
    title: 'Social & Nightlife OS',
    subtitle: 'Velocidad extrema en barra, control de tiempos de juego y fidelidad en eventos.',
    plans: [
      {
        id: 'ent-arcade',
        name: 'Boardgame & Casual Arcade',
        tagline: 'Para cafés de juegos de mesa, salas de billar, boliches o escape rooms.',
        setupBunz: 4500,
        initialVaultBunz: 4000,
        idealFor: 'Cobro por tiempo + barra',
        features: [
          'Cronómetro y cobro unificado por tiempo de mesa y consumo',
          'Multiplicador de bunz configurable para días bajos (ej. martes)',
          'Bóveda de emisión inicial: 4,000 BUNZ',
          'Presencia destacada en planes de fin de semana con Bunzy',
          'Integración completa con terminales táctiles',
        ],
      },
      {
        id: 'ent-nightclub',
        name: 'Mega Venue & Nightclub',
        tagline: 'Para antros, bares de alta afluencia, foros íntimos y clubes nocturnos.',
        setupBunz: 15000,
        initialVaultBunz: 14000,
        badge: 'MÁXIMA VELOCIDAD',
        isPopular: true,
        idealFor: 'Aforo Masivo / Barras Múltiples',
        features: [
          'Modo ráfaga offline-first para barras con 1000+ transacciones/noche',
          'Validación de accesos/cover escaneando el Rabbitty Pass',
          'Bóveda de emisión inicial: 14,000 BUNZ',
          'Dashboard en vivo con telemetría de venta por bartender',
          'Campañas de airdrops geocercadas en zonas de fiesta',
        ],
      },
    ],
  },
];

interface PricingProps {
  onSelectPlan: (plan: PackagePlan, niche: NicheData, billingPeriod: 'monthly' | 'yearly') => void;
}

export default function PricingPackagesSection({ onSelectPlan }: PricingProps) {
  const [selectedNicheId, setSelectedNicheId] = useState('food');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly');
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  // Close modal on Escape key and prevent background scroll
  useEffect(() => {
    if (!showComparisonModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowComparisonModal(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showComparisonModal]);

  const currentNiche = NICHES_DATA.find((n) => n.id === selectedNicheId) || NICHES_DATA[0];

  return (
    <section id="paquetes" className="relative z-10 py-28 px-4 sm:px-6 lg:px-8 bg-linear-to-b from-[#080812] via-[#05050A] to-[#080812] border-t border-white/10">
      <div className="max-w-7xl mx-auto">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-black tracking-widest uppercase mb-4">
            <Sparkles size={14} /> Modelos de Iniciación por Nicho
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-4">
            Cero licencias en dinero. <br />
            <span className="text-gradient">Todo opera en Bunz.</span>
          </h2>
          <p className="text-base sm:text-lg text-white/60 leading-relaxed">
            A diferencia del software tradicional que te desangra con setups de $35,000 MXN sin traerte clientes, en Rabbitty te activas en Bunz con tu propia bóveda de recompensas incluida.
          </p>

          {/* Billing Switch (Monthly vs Yearly) */}
          <div className="mt-8 inline-flex items-center gap-3 p-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-5 py-2 rounded-full text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                billingPeriod === 'monthly' ? 'bg-white text-black shadow-lg shadow-white/20' : 'text-white/60 hover:text-white'
              }`}
            >
              Membresía Mensual (5,000 BUNZ/mes)
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`relative px-5 py-2 rounded-full text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                billingPeriod === 'yearly' ? 'bg-linear-to-r from-pink-600 to-purple-600 text-white shadow-lg shadow-pink-500/30' : 'text-white/60 hover:text-white'
              }`}
            >
              <span>Membresía Anual (48,000 BUNZ)</span>
              <span className="bg-amber-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                -20% Ahorro
              </span>
            </button>
          </div>
          <p className="text-xs text-white/40 mt-2 font-medium">
            {billingPeriod === 'yearly' 
              ? '✨ 2 meses gratis al año. La cuota se descuenta automáticamente de tu balance en la red.'
              : 'Cuota de red flexible debitada el día 1 de cada mes directamente de tu balance de bunz.'}
          </p>
        </div>

        {/* Niche Selector Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-12">
          {NICHES_DATA.map((niche) => {
            const isSelected = niche.id === selectedNicheId;
            return (
              <button
                key={niche.id}
                onClick={() => setSelectedNicheId(niche.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-pink-600 text-white border-pink-500 shadow-[0_0_25px_rgba(233,30,99,0.4)] scale-105'
                    : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="text-base">{niche.icon}</span>
                <span>{niche.name}</span>
              </button>
            );
          })}
        </div>

        {/* Niche Summary Banner */}
        <div className="text-center mb-10">
          <h3 className="text-xl sm:text-2xl font-black text-white">{currentNiche.title}</h3>
          <p className="text-sm text-white/50 max-w-xl mx-auto mt-1">{currentNiche.subtitle}</p>
        </div>

        {/* Plan Cards Grid */}
        <div className={`grid gap-6 ${currentNiche.plans.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 max-w-4xl mx-auto'}`}>
          {currentNiche.plans.map((plan) => (
            <motion.div
              key={plan.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`relative rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 border ${
                plan.isPopular
                  ? 'bg-linear-to-b from-[#181122] via-[#0E0E18] to-[#0A0A12] border-pink-500/60 shadow-[0_0_40px_rgba(233,30,99,0.2)] md:-translate-y-2'
                  : 'bg-white/3 border-white/10 hover:border-white/20 hover:bg-white/5'
              }`}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-linear-to-r from-pink-600 to-purple-600 text-[10px] font-black text-white tracking-widest uppercase shadow-lg shadow-pink-500/30">
                  {plan.badge}
                </div>
              )}

              <div>
                {/* Plan Header */}
                <div className="mb-4">
                  <span className="text-[11px] font-black uppercase tracking-wider text-pink-400 block mb-1">
                    {plan.idealFor}
                  </span>
                  <h4 className="text-xl sm:text-2xl font-black text-white leading-tight">{plan.name}</h4>
                  <p className="text-xs text-white/50 mt-1.5 leading-relaxed">{plan.tagline}</p>
                </div>

                {/* Price Display */}
                <div className="my-6 p-4 rounded-2xl bg-black/40 border border-white/5">
                  <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Iniciación Única</div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                      {plan.setupBunz.toLocaleString()}
                    </span>
                    <span className="text-sm font-black text-pink-500 tracking-wider">BUNZ</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                    <span className="text-white/60">Bóveda de emisión incluida:</span>
                    <span className="font-extrabold text-amber-400">+{plan.initialVaultBunz.toLocaleString()} BUNZ</span>
                  </div>
                </div>

                {/* Recurring Fee Reminder */}
                <div className="mb-6 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-white/70">
                  <Check size={14} className="text-emerald-400 shrink-0" />
                  <span>
                    Cuota de red: <strong>{billingPeriod === 'yearly' ? '48,000 BUNZ/año' : '5,000 BUNZ/mes'}</strong>
                  </span>
                </div>

                {/* Features List */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-white/80">
                      <div className="w-4 h-4 rounded-full bg-pink-500/20 text-pink-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Check size={11} strokeWidth={3} />
                      </div>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              <button
                onClick={() => onSelectPlan(plan, currentNiche, billingPeriod)}
                className={`w-full py-4 rounded-2xl font-black text-sm tracking-wide transition-all cursor-pointer flex items-center justify-center gap-2 border-none active:scale-[0.98] ${
                  plan.isPopular
                    ? 'bg-linear-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-[0_4px_20px_rgba(233,30,99,0.4)]'
                    : 'bg-white hover:bg-slate-100 text-black shadow-md'
                }`}
              >
                <span>Elegir {plan.name}</span>
                <ArrowRight size={16} />
              </button>
            </motion.div>
          ))}
        </div>

        {/* Comparison Trigger Banner vs Dinosaur Systems */}
        <div className="mt-16 max-w-4xl mx-auto rounded-3xl bg-linear-to-r from-blue-950/40 via-purple-950/30 to-pink-950/40 border border-white/10 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 backdrop-blur-md">
          <div className="text-center sm:text-left">
            <span className="text-xs font-black text-blue-400 uppercase tracking-widest block mb-1">
              BENCHMARK DE MERCADO
            </span>
            <h4 className="text-xl sm:text-2xl font-black text-white">
              ¿Por qué Rabbitty aplasta a Soft Restaurant y Toast?
            </h4>
            <p className="text-xs sm:text-sm text-white/60 mt-1 max-w-xl">
              Descubre cómo nuestro modelo en Bunz le ahorra más de $35,000 pesos al comercio y además le llena las mesas con Rabbitters reales.
            </p>
          </div>

          <button
            onClick={() => setShowComparisonModal(true)}
            className="px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer shrink-0"
          >
            Ver Comparativa Detallada 🔍
          </button>
        </div>

      </div>

      {/* MODAL COMPARATIVA VS SOFT RESTAURANT */}
      <AnimatePresence>
        {showComparisonModal && (
          <div
            onClick={() => setShowComparisonModal(false)}
            className="fixed inset-0 z-150 flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 sm:p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0D0D16] border border-white/20 rounded-3xl max-w-4xl w-full p-6 sm:p-10 relative max-h-[88vh] overflow-y-auto shadow-[0_0_60px_rgba(0,0,0,0.9)] my-auto"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowComparisonModal(false);
                }}
                className="absolute top-4 right-4 z-20 text-white/60 hover:text-white p-2.5 rounded-full hover:bg-white/10 transition-all border border-white/10 bg-white/5 cursor-pointer flex items-center justify-center active:scale-90"
                aria-label="Cerrar modal"
              >
                <X size={18} />
              </button>

              <div className="text-center mb-8 pr-8 sm:pr-0">
                <span className="text-[11px] font-black text-pink-500 uppercase tracking-widest px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 inline-block mb-2">
                  Análisis de Retorno de Inversión (ROI)
                </span>
                <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                  Rabbitty vs Software Tradicional
                </h3>
                <p className="text-xs sm:text-sm text-white/50 mt-1 max-w-lg mx-auto">
                  Por qué las marcas líderes gastronómicas y de ocio están migrando a Rabbitty OS.
                </p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-white/15 bg-white/5 text-white/60 uppercase tracking-wider text-[11px] font-bold">
                      <th className="py-3.5 px-4">Característica</th>
                      <th className="py-3.5 px-4 text-red-400">Soft Restaurant / Micros</th>
                      <th className="py-3.5 px-4 text-pink-400 font-black">Rabbitty Ecosystem 🐰</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-white/85">
                    <tr className="hover:bg-white/3 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">Costo de Licencia / Setup Inicial</td>
                      <td className="py-3.5 px-4 text-red-400 font-medium">$25,000 a $45,000 MXN en efectivo</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-bold">$0 MXN (Iniciación en BUNZ)</td>
                    </tr>
                    <tr className="hover:bg-white/3 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">Cuota Mensual / Soporte</td>
                      <td className="py-3.5 px-4 text-red-400 font-medium">$1,200 a $2,500 MXN / mes</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-bold">5,000 BUNZ (Costo absorbido en consumo)</td>
                    </tr>
                    <tr className="hover:bg-white/3 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">Atracción de Clientes Nuevos</td>
                      <td className="py-3.5 px-4 text-white/40">❌ Cero clientes. Solo cobran.</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-bold">✅ Motor activo: Mapa Freehands y Rabbitters</td>
                    </tr>
                    <tr className="hover:bg-white/3 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">Comandas de Voz IA (Whisper)</td>
                      <td className="py-3.5 px-4 text-white/40">❌ No existe</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-bold">✅ Dicta órdenes directo en la mesa</td>
                    </tr>
                    <tr className="hover:bg-white/3 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">Kiosko Autoservicio & QR BYOD</td>
                      <td className="py-3.5 px-4 text-white/40">❌ Módulos extras caros ($15,000+)</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-bold">✅ Incluido nativamente sin hardware propietario</td>
                    </tr>
                    <tr className="hover:bg-white/3 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">Landing Page & SEO para IAs (ChatGPT/Gemini)</td>
                      <td className="py-3.5 px-4 text-white/40">❌ No incluye. Requiere pagar agencia o Wix ($3,000+/mes)</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-bold">✅ Incluida con subdominio, Schema.org y GEO Search</td>
                    </tr>
                    <tr className="hover:bg-white/3 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">Hardware Requerido</td>
                      <td className="py-3.5 px-4 text-white/40">Torres Windows viejas y monitores pesados</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-bold">Cualquier iPad, Tablet Android, Mac o PC</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-8 text-center flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowComparisonModal(false)}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-linear-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-pink-500/25 cursor-pointer border-none active:scale-95"
                >
                  Cerrar y Elegir mi Paquete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
