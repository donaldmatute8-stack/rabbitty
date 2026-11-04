'use client';

/**
 * ── BunzyOnboarding ── Bunzy como guía del alta, presente desde el Paso 0.
 *
 * Diseño seguro por construcción:
 *   · El copy es DETERMINISTA (por nicho y por paso). No hay llamada a modelo
 *     durante el onboarding, así que no puede filtrar datos de otro tenant ni
 *     inventar condiciones comerciales.
 *   · Solo recibe `niche` y `step`: cero datos de negocio o de terceros.
 *   · Si el usuario quiere preguntar algo libre, abre el chat de Bunzy que ya
 *     existe y pasa por su RAG + reglas de scoping.
 *
 * UX: avatar + burbuja con efecto de escritura (typewriter), contextual al
 * nicho elegido, descartable y recuperable con la carita.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';

export interface BunzyOnboardingProps {
  /** Nicho elegido (o null antes de elegir). */
  niche?: string | null;
  /** Paso actual del alta (0 = welcome, 1 = datos, 2 = recompensas…). */
  step?: number;
  /** Nombre del negocio cuando ya lo escribió (opcional). */
  businessName?: string | null;
}

const NICHE_LINE: Record<string, string> = {
  restaurant: 'Va un restaurante: te dejo mesas, cocina y cuenta por comensal listos.',
  cafe: 'Cafetería, perfecto. Barra rápida, para llevar y cashback en cada visita.',
  bar: 'Bar: cuentas abiertas y happy hour desde el primer día.',
  bakery: 'Panadería: venta por pieza, sin mesas, cobrando rapidísimo.',
  pizza: 'Pizzería: pedidos para recoger y a domicilio con seguimiento.',
  tacos: 'Taquería: alta rotación, pedidos al momento y mesas si las necesitas.',
  barbershop: 'Barbería: citas por barbero y comisiones automáticas.',
  fitness: 'Gym: membresías, clases y control de accesos.',
  retail: 'Tienda: inventario, código de barras y caja en un solo lugar.',
  services: 'Servicios: agenda, anticipos y recordatorios para tus clientes.',
  other: 'Sin problema: lo configuramos a la medida de tu negocio.',
};

const STEP_LINE: Record<number, string> = {
  0: 'Vamos paso a paso. ¿Listo para abrir tu negocio en Rabbitty?',
  1: 'Con el nombre y la dirección ya puedes empezar a recibir Rabbitters.',
  2: 'Aquí defines cuánto devuelves en Bunz: tú decides el porcentaje.',
  3: 'El paquete es el respaldo de Bunz que puedes emitir. Puedes empezar chico.',
  4: 'Último paso: firma y listo. Yo me quedo pendiente de tu operación.',
};

/** Efecto máquina de escribir con caret. */
function useTypewriter(text: string, speed = 18) {
  const [shown, setShown] = useState('');
  const idx = useRef(0);
  useEffect(() => {
    setShown('');
    idx.current = 0;
    if (!text) return;
    const timer = setInterval(() => {
      idx.current += 1;
      setShown(text.slice(0, idx.current));
      if (idx.current >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  return shown;
}

export function BunzyOnboarding({ niche, step = 0, businessName }: BunzyOnboardingProps) {
  const [hidden, setHidden] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const message = useMemo(() => {
    const base = niche ? NICHE_LINE[niche] : 'Soy Bunzy, tu copiloto. Empecemos por el tipo de negocio.';
    const tail = STEP_LINE[step] ?? '';
    const greet = businessName ? `${businessName}: ` : '';
    return `${greet}${base}${tail ? ` ${tail}` : ''}`;
  }, [niche, step, businessName]);

  const typed = useTypewriter(message);

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        aria-label="Mostrar a Bunzy"
        className="fixed z-40 flex h-10 w-10 items-center justify-center rounded-full shadow-lg"
        style={{
          right: 14,
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 92px)',
          background: 'linear-gradient(135deg,#FF2E93,#E11D74)',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_conejo.png" alt="Bunzy" style={{ width: 18, height: 22, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
      </button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        className="fixed z-40"
        style={{
          left: 12,
          right: 12,
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
        }}
      >
        <div
          className="flex items-start gap-2.5 rounded-2xl px-3 py-2.5"
          style={{
            background: 'linear-gradient(135deg, rgba(233,30,99,0.16), rgba(17,17,19,0.92))',
            border: '1px solid rgba(233,30,99,0.35)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          }}
        >
          {/* Avatar */}
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'rgba(233,30,99,0.2)', border: '1px solid rgba(233,30,99,0.45)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_conejo.png" alt="Bunzy" style={{ width: 15, height: 18, objectFit: 'contain' }} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="m-0 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider" style={{ color: '#FF4D9E' }}>
              <Sparkles size={10} /> Bunzy
            </p>
            <p className="m-0 mt-0.5 text-[12.5px] leading-snug" style={{ color: 'rgba(255,255,255,0.92)' }}>
              {collapsed ? message : typed}
              {!collapsed && typed.length < message.length && (
                <span className="ml-0.5 inline-block animate-pulse" style={{ color: '#FF4D9E' }}>▍</span>
              )}
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-1">
            <button
              type="button"
              onClick={() => setHidden(true)}
              aria-label="Ocultar a Bunzy"
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', padding: 2 }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Acción discreta: si quiere preguntar algo, va al chat real (con RAG y scoping) */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="mt-1 ml-2 text-[10px] font-bold"
          style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
        >
          {collapsed ? 'Ver a Bunzy escribiendo' : 'Mostrar completo'}
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
