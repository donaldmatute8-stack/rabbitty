'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Calculator, Check, Info, Sparkles } from 'lucide-react';
import { capacityScenarios, formatBunz } from '@/lib/capacity';

export interface CapacitySelection {
  nicheId: string;
  nicheName: string;
  capacity: number;
  months: number;
  monthlySales: number;
  rewardPct: number;
}

interface NicheData {
  id: string;
  name: string;
  icon: string;
  title: string;
  subtitle: string;
  features: {
    base: string[];
    recommended: string[];
    wide: string[];
  };
}

export const NICHES_DATA: NicheData[] = [
  {
    id: 'food',
    name: 'Gastronomía & Cafeterías',
    icon: '☕',
    title: 'Food & Beverage OS',
    subtitle:
      'Desde barras de café de especialidad hasta restaurantes multizona con KDS y comandas por voz IA.',
    features: {
      base: [
        'Terminal POS para iPad, tablet o celular',
        'QR dinámicos para mesa y mostrador',
        'Perfil en el mapa Freehands',
        'Catálogo digital y cobro express',
      ],
      recommended: [
        'Todo lo de Arranque +',
        'Menú online y pedidos QR',
        'Mapa de mesas en tiempo real',
        'KDS de cocina y comandas móviles',
      ],
      wide: [
        'Todo lo de Recomendado +',
        'Kiosko autoservicio',
        'Multi-impresoras y multi-sucursal',
        'Campañas push a Rabbitters de tu zona',
      ],
    },
  },
  {
    id: 'fitness',
    name: 'Wellness, Gyms & Spas',
    icon: '🏋️',
    title: 'Wellness & Sport OS',
    subtitle:
      'Fideliza a tus socios con check-ins gamificados, venta de retail y control de citas.',
    features: {
      base: [
        'Caja ágil para servicios y productos',
        'Recompensas Bunz por visita',
        'Perfil comercial con portafolio',
        'Chat directo para reservaciones',
      ],
      recommended: [
        'Todo lo de Arranque +',
        'Control de acceso con QR',
        'Gamificación por entrenamiento',
        'Punto de venta para retail',
      ],
      wide: [
        'Todo lo de Recomendado +',
        'Membresías recurrentes',
        'Métricas de retención y fuga',
        'Campañas a socios inactivos',
      ],
    },
  },
  {
    id: 'retail',
    name: 'Retail & Boutiques',
    icon: '🏬',
    title: 'Retail & Concept Stores',
    subtitle:
      'Crea drops exclusivos, liquida inventario con Bunz y digitaliza tus puntos de venta.',
    features: {
      base: [
        'Terminal de mostrador con código de barras',
        'Control de inventario por SKU',
        'Perfil con geolocalización',
        'Tickets digitales',
      ],
      recommended: [
        'Todo lo de Arranque +',
        'Landing propia y sucursal digital',
        'Drops exclusivos canjeables con Bunz',
        'Analítica de ticket y recompra',
      ],
      wide: [
        'Todo lo de Recomendado +',
        'Múltiples terminales inalámbricas',
        'Campañas a coleccionistas',
        'Panel multi-sucursal',
      ],
    },
  },
  {
    id: 'entertainment',
    name: 'Ocio & Entretenimiento',
    icon: '🎲',
    title: 'Social & Nightlife OS',
    subtitle:
      'Velocidad extrema en barra, control de tiempos de juego y fidelidad en eventos.',
    features: {
      base: [
        'Cobro por tiempo y consumo',
        'Multiplicador de Bunz configurable',
        'Presencia en el mapa',
        'Terminal táctil',
      ],
      recommended: [
        'Todo lo de Arranque +',
        'Validación de accesos con QR',
        'Dashboard de venta por bartender',
        'Campañas en días bajos',
      ],
      wide: [
        'Todo lo de Recomendado +',
        'Modo ráfaga offline-first',
        'Airdrops geocercados',
        'Soporte para eventos masivos',
      ],
    },
  },
];

interface PricingProps {
  onSelectPlan: (selection: CapacitySelection) => void;
}

export default function PricingPackagesSection({ onSelectPlan }: PricingProps) {
  const [selectedNicheId, setSelectedNicheId] = useState('food');
  const [monthlySales, setMonthlySales] = useState(80_000);
  const [rewardPct, setRewardPct] = useState(30);

  const currentNiche = NICHES_DATA.find((n) => n.id === selectedNicheId) || NICHES_DATA[0];
  const scenarios = useMemo(
    () => capacityScenarios(monthlySales, rewardPct),
    [monthlySales, rewardPct]
  );

  return (
    <section
      id="paquetes"
      className="relative z-10 border-t border-white/10 bg-linear-to-b from-[#080812] via-[#05050A] to-[#080812] px-4 py-28 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-pink-500/20 bg-pink-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-pink-400">
            <Sparkles size={14} /> Capacidad dinámica, no paquetes fijos
          </div>
          <h2 className="mb-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
            Tu capacidad se calcula <br />
            <span className="text-gradient">con tu operación real.</span>
          </h2>
          <p className="text-base leading-relaxed text-white/60 sm:text-lg">
            Nada de montos fijos. Ajusta tus ventas mensuales, tu recompensa y los meses de
            cobertura. Rabbitty te propone una capacidad referencial y tú decides si solicitas la
            autorización.
          </p>
        </div>

        <div className="mb-10 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {NICHES_DATA.map((niche) => {
            const isSelected = niche.id === selectedNicheId;
            return (
              <button
                key={niche.id}
                onClick={() => setSelectedNicheId(niche.id)}
                className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-5 py-3 text-xs font-bold transition-all sm:text-sm ${
                  isSelected
                    ? 'scale-105 border-pink-500 bg-pink-600 text-white shadow-[0_0_25px_rgba(233,30,99,0.4)]'
                    : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="text-base">{niche.icon}</span>
                <span>{niche.name}</span>
              </button>
            );
          })}
        </div>

        <div className="mx-auto mb-10 max-w-4xl rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-pink-500/25 bg-pink-500/10 text-pink-400">
              <Calculator size={17} />
            </div>
            <div>
              <p className="m-0 text-sm font-black text-white">Calculadora de capacidad</p>
              <p className="m-0 text-[11px] text-white/45">
                Mueve los controles y mira cómo cambia tu propuesta.
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-[10.5px] font-black uppercase tracking-wider text-white/45">
                Ventas mensuales elegibles
                <span className="font-mono text-pink-300">${monthlySales.toLocaleString('es-MX')}</span>
              </span>
              <input
                type="range"
                min={10_000}
                max={500_000}
                step={5_000}
                value={monthlySales}
                onChange={(e) => setMonthlySales(Number(e.target.value))}
                className="w-full accent-pink-500"
              />
              <div className="mt-1 flex justify-between text-[10px] text-white/30">
                <span>$10 mil</span>
                <span>$500 mil</span>
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-[10.5px] font-black uppercase tracking-wider text-white/45">
                Recompensa en Bunz
                <span className="font-mono text-pink-300">{rewardPct}%</span>
              </span>
              <input
                type="range"
                min={10}
                max={50}
                step={1}
                value={rewardPct}
                onChange={(e) => setRewardPct(Number(e.target.value))}
                className="w-full accent-pink-500"
              />
              <div className="mt-1 flex justify-between text-[10px] text-white/30">
                <span>10% mínimo</span>
                <span>50%</span>
              </div>
            </label>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-white/10 bg-black/25 p-3">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pink-300" />
            <p className="m-0 text-[11px] leading-relaxed text-white/45">
              Estimación referencial: ventas × recompensa × meses de cobertura. No es una
              autorización ni un cobro. La capacidad real se confirma con una oferta individual
              después de revisar tu negocio.
            </p>
          </div>
        </div>

        <div className="mb-8 text-center">
          <h3 className="text-xl font-black text-white sm:text-2xl">{currentNiche.title}</h3>
          <p className="mx-auto mt-1 max-w-xl text-sm text-white/50">{currentNiche.subtitle}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {scenarios.map((scenario) => {
            const features = currentNiche.features[scenario.id];
            const isRecommended = scenario.id === 'recommended';
            return (
              <motion.div
                key={scenario.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`relative flex flex-col justify-between rounded-3xl border p-6 transition-all duration-300 sm:p-8 ${
                  isRecommended
                    ? 'border-pink-500/60 bg-linear-to-b from-[#181122] via-[#0E0E18] to-[#0A0A12] shadow-[0_0_40px_rgba(233,30,99,0.2)] md:-translate-y-2'
                    : 'border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5'
                }`}
              >
                {scenario.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-linear-to-r from-pink-600 to-purple-600 px-4 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-pink-500/30">
                    {scenario.badge}
                  </div>
                )}

                <div>
                  <div className="mb-4">
                    <span className="mb-1 block text-[11px] font-black uppercase tracking-wider text-pink-400">
                      {scenario.months} {scenario.months === 1 ? 'mes' : 'meses'} de cobertura
                    </span>
                    <h4 className="text-xl font-black leading-tight text-white sm:text-2xl">
                      {scenario.label}
                    </h4>
                    <p className="mt-1.5 text-xs leading-relaxed text-white/50">
                      {scenario.description}
                    </p>
                  </div>

                  <div className="my-6 rounded-2xl border border-white/5 bg-black/40 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                      Capacidad sugerida
                    </div>
                    <div className="mt-0.5 flex items-baseline gap-2">
                      <span className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                        {formatBunz(scenario.capacity)}
                      </span>
                      <span className="text-sm font-black tracking-wider text-pink-500">BUNZ</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-xs">
                      <span className="text-white/60">Recompensa</span>
                      <span className="font-extrabold text-amber-400">{rewardPct}%</span>
                    </div>
                  </div>

                  <ul className="mb-8 space-y-3">
                    {features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5 text-xs text-white/80 sm:text-sm">
                        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-pink-500/20 text-pink-400">
                          <Check size={11} strokeWidth={3} />
                        </div>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() =>
                    onSelectPlan({
                      nicheId: currentNiche.id,
                      nicheName: currentNiche.name,
                      capacity: scenario.capacity,
                      months: scenario.months,
                      monthlySales,
                      rewardPct,
                    })
                  }
                  className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-none py-4 text-sm font-black tracking-wide transition-all active:scale-[0.98] ${
                    isRecommended
                      ? 'bg-linear-to-r from-pink-600 to-purple-600 text-white shadow-[0_4px_20px_rgba(233,30,99,0.4)] hover:from-pink-500 hover:to-purple-500'
                      : 'bg-white text-black shadow-md hover:bg-slate-100'
                  }`}
                >
                  <span>Solicitar esta capacidad</span>
                  <ArrowRight size={16} />
                </button>
              </motion.div>
            );
          })}
        </div>

        <div className="mx-auto mt-12 max-w-3xl rounded-3xl border border-white/10 bg-black/30 p-6 text-center">
          <p className="m-0 text-xs leading-relaxed text-white/45">
            La capacidad se compone de un incentivo de incorporación y capacidad adelantada
            recuperable. La recuperación se propone por ciclo, con el importe exacto, y requiere
            tu aceptación antes de aplicarse. No se toca la capacidad comprometida con los
            Rabbitters.
          </p>
        </div>
      </div>
    </section>
  );
}
