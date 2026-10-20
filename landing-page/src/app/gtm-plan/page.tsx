'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Cpu,
  ChevronRight,
  CheckCircle2,
  Clock,
  RotateCcw,
  MessageSquare,
  Lock,
  QrCode,
  Sparkles,
  ShieldCheck,
  Send,
  X,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { SimpleQRCode } from '@/components/SimpleQRCode';

interface MilestoneDay {
  day: number;
  title: string;
  category: 'piloto' | 'comercial' | 'subdominios' | 'escala';
  deliverable: string;
  details: string;
  status: 'completado' | 'en_proceso' | 'pendiente';
  actionLink?: string;
  actionLabel?: string;
  notes?: string[];
  previousStatus?: 'completado' | 'en_proceso' | 'pendiente';
}

const STORAGE_KEY = 'rabbitty_gtm_plan_overrides_v1';
const AUTH_KEY = 'rabbitty_gtm_admin_token_v1';
const ADMIN_SECRET = 'rabbitty_admin_authorized_gtm_2026';

const DEFAULT_DAYS_DATA: MilestoneDay[] = [
  // SEMANA 1: PILOTO EN VIVO 626 CAFÉ & MENÚ UNIVERSAL
  { 
    day: 1, 
    title: 'Auditoría de Catálogo y Precios', 
    category: 'piloto', 
    deliverable: 'Cotejo de 52 productos y 10 categorías en Neon DB', 
    details: 'Asegurar coincidencia 100% de precios reales de 626 Café con modificadores de bebida y categorías visuales.', 
    status: 'completado',
    actionLink: '/626cafe',
    actionLabel: 'Ver Catálogo 626 Café',
    notes: ['Precios validados directamente en POS físico de 626 Café. Coincidencia al 100%.']
  },
  { 
    day: 2, 
    title: 'Prueba de Enlace Universal Público (SSR)', 
    category: 'piloto', 
    deliverable: 'Carga < 1s sin barrera de Telegram ni app obligatoria', 
    details: 'Verificación en Safari y Chrome incógnito de app pública con modo de mesa y vista de sucursal.', 
    status: 'completado',
    actionLink: 'https://rabbitty.me/626cafe',
    actionLabel: 'Probar Enlace Universal',
    notes: ['Probado en iOS Safari con conexión 4G. Tiempo de respuesta inicial < 280ms.']
  },
  { 
    day: 3, 
    title: 'Generación de Displays y Carteles de Mesa', 
    category: 'piloto', 
    deliverable: 'Kit de impresos A3/A5/A6 con QR contextual y co-branding', 
    details: 'Herramienta de impresos con soporte A3 cristalera, habladores de mesa con QR por mesa y señalética de caja.', 
    status: 'completado',
    actionLink: '/impresos?name=626%20Caf%C3%A9&ref=promo_626cafe&bunz=25',
    actionLabel: 'Abrir Generador de Impresos',
    notes: ['Insignia co-branded ampliada y renderizada con logo oficial de 626 Café sin recortes.']
  },
  { 
    day: 4, 
    title: 'Capacitación Flash de Baristas & Modo Caja', 
    category: 'piloto', 
    deliverable: 'Portal móvil de negocio con escaneo y canjes en 5 segundos', 
    details: 'Capacitación al equipo para acreditar Bunz al cobrar y validar canjes desde el móvil con feedback háptico.', 
    status: 'completado',
    actionLink: 'https://t.me/RabbittyBot?start=portal_626cafe',
    actionLabel: 'Ver Demo Portal Móvil',
    notes: ['Equipo capacitado en 1 turno; el proceso de canje demora menos de 6 segundos.']
  },
  { 
    day: 5, 
    title: 'Primer Fin de Semana con Tráfico Real', 
    category: 'piloto', 
    deliverable: 'Observación y registro de uso presencial en horas pico', 
    details: 'Monitoreo de comportamiento de clientes, escaneo de QR en mesa y primer lote de Bunz emitidos en caja.', 
    status: 'completado',
    notes: ['Apertura fluida con clientes escaneando directamente desde la cámara nativa de iPhone.']
  },
  { 
    day: 6, 
    title: 'Análisis de Telemetría y Cero Emisión Fantasma', 
    category: 'piloto', 
    deliverable: 'Dashboard de reconciliación contable y telemetría de QR', 
    details: 'Cruce del ledger de Bunz emitidos vs consumos reales registrados, confirmando 100% de integridad contable.', 
    status: 'completado',
    notes: ['Conciliación 0 descuadres: suma en ledger coincide exactamente con los saldos de los usuarios.']
  },
  { 
    day: 7, 
    title: 'Reunión de Feedback con Gerente & Vibe Tuning', 
    category: 'piloto', 
    deliverable: 'Optimización de experiencia sonora y menú según retroalimentación', 
    details: 'Sesión de 15 min con el gerente de 626 Café: ajuste de platillos más pedidos y calibración de atmósfera.', 
    status: 'completado',
    notes: ['Ajuste solicitado: destacar combinaciones de café de especialidad + panadería matutina.']
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
    actionLabel: 'Ver Kit Demostración',
    notes: ['Deck comercial físico y digital listo con muestras de cartelería y simulación de escaneo.']
  },
  { 
    day: 9, 
    title: 'Ronda de Prospección en Corredor Local (Radio 1km)', 
    category: 'comercial', 
    deliverable: '8 comercios vecinos visitados en el cluster gastronómico', 
    details: 'Visita directa a pizzerías, cervecerías artesanales, barberías y cafeterías del mismo radio de influencia.', 
    status: 'en_proceso',
    notes: ['3 visitas realizadas con alto interés; 2 agendaron revisión de catálogo.']
  },
  { 
    day: 10, 
    title: 'Onboarding Comercios #2 y #3 (Comida & Bebida)', 
    category: 'comercial', 
    deliverable: '2 nuevos catálogos digitalizados y subdominios asignados', 
    details: 'Carga de productos y fotos en el portal administrativo con asignación de cupo inicial de Bunz promocionales.', 
    status: 'en_proceso',
    notes: ['Estructurando menú para pizzería artesanal vecina.']
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
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    const urlAuth = urlParams.get('admin_key');
    if (urlAuth === ADMIN_SECRET) {
      try {
        localStorage.setItem(AUTH_KEY, ADMIN_SECRET);
        window.history.replaceState({}, '', window.location.pathname);
      } catch {}
      return true;
    }
    try {
      return localStorage.getItem(AUTH_KEY) === ADMIN_SECRET;
    } catch {
      return false;
    }
  });

  const [days, setDays] = useState<MilestoneDay[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_DAYS_DATA;
    try {
      const savedRaw = localStorage.getItem(STORAGE_KEY);
      if (savedRaw) {
        const overrides: Record<number, { status: MilestoneDay['status']; notes?: string[]; previousStatus?: MilestoneDay['status'] }> = JSON.parse(savedRaw);
        return DEFAULT_DAYS_DATA.map(d => {
          const o = overrides[d.day];
          if (!o) return d;
          return {
            ...d,
            status: o.status ?? d.status,
            notes: o.notes ?? d.notes,
            previousStatus: o.previousStatus ?? d.previousStatus,
          };
        });
      }
    } catch {}
    return DEFAULT_DAYS_DATA;
  });

  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(1);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [newComment, setNewComment] = useState<string>('');
  const [authUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/gtm-plan?admin_key=${ADMIN_SECRET}`;
    }
    return `https://rabbitty.me/gtm-plan?admin_key=${ADMIN_SECRET}`;
  });
  const newCommentInputRef = useRef<HTMLInputElement>(null);

  // 2. Guardar en localStorage
  const saveOverrides = (updatedDays: MilestoneDay[]) => {
    try {
      const overrides: Record<number, { status: MilestoneDay['status']; notes?: string[]; previousStatus?: MilestoneDay['status'] }> = {};
      updatedDays.forEach(d => {
        overrides[d.day] = {
          status: d.status,
          notes: d.notes,
          previousStatus: d.previousStatus,
        };
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    } catch (e) {
      console.error('Error guardando en localStorage:', e);
    }
  };

  const selectedDay = days.find(d => d.day === selectedDayNumber) || days[0];

  const filteredDays = days.filter(
    d => selectedCategory === 'all' || d.category === selectedCategory
  );

  const completedCount = days.filter(d => d.status === 'completado').length;
  const inProgressCount = days.filter(d => d.status === 'en_proceso').length;

  // Cambiar estado a Completado
  const handleMarkCompleted = (dayNum: number) => {
    if (!isAdmin) {
      setShowAuthModal(true);
      return;
    }
    setDays(prev => {
      const next = prev.map(d => {
        if (d.day === dayNum) {
          const prevStatus = d.status === 'completado' ? (d.previousStatus || 'pendiente') : d.status;
          return {
            ...d,
            previousStatus: prevStatus,
            status: 'completado' as const,
          };
        }
        return d;
      });
      saveOverrides(next);
      return next;
    });
  };

  // Revertir estado previo
  const handleRevertStatus = (dayNum: number) => {
    if (!isAdmin) {
      setShowAuthModal(true);
      return;
    }
    setDays(prev => {
      const next = prev.map(d => {
        if (d.day === dayNum) {
          const targetStatus = d.previousStatus || (d.status === 'completado' ? 'en_proceso' : 'pendiente');
          return {
            ...d,
            status: targetStatus,
            previousStatus: d.status,
          };
        }
        return d;
      });
      saveOverrides(next);
      return next;
    });
  };

  // Cambiar a En Proceso
  const handleSetInProgress = (dayNum: number) => {
    if (!isAdmin) {
      setShowAuthModal(true);
      return;
    }
    setDays(prev => {
      const next = prev.map(d => {
        if (d.day === dayNum) {
          return {
            ...d,
            previousStatus: d.status,
            status: 'en_proceso' as const,
          };
        }
        return d;
      });
      saveOverrides(next);
      return next;
    });
  };

  // Agregar comentario / nota operativa
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setShowAuthModal(true);
      return;
    }
    const trimmed = newComment.trim();
    if (!trimmed) return;

    setDays(prev => {
      const next = prev.map(d => {
        if (d.day === selectedDayNumber) {
          const updatedNotes = [...(d.notes || []), trimmed];
          return {
            ...d,
            notes: updatedNotes,
          };
        }
        return d;
      });
      saveOverrides(next);
      return next;
    });

    setNewComment('');
  };

  const handleLogoutAdmin = () => {
    localStorage.removeItem(AUTH_KEY);
    setIsAdmin(false);
  };

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

            {/* Admin Badge / Unlock trigger */}
            {isAdmin ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                  <ShieldCheck size={14} /> Modo Admin Activo
                </span>
                <button
                  type="button"
                  onClick={handleLogoutAdmin}
                  title="Cerrar modo admin"
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors border-none cursor-pointer"
                >
                  <Lock size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="text-xs font-bold text-pink-400 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/25 px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <QrCode size={14} /> Desbloquear Admin
              </button>
            )}

            <Link
              href="/"
              className="text-xs font-black text-white/70 hover:text-white no-underline px-3 py-1.5 rounded-xl hover:bg-white/5 transition-colors"
            >
              Volver →
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="relative px-6 pt-12 pb-8 border-b border-white/5 bg-linear-to-b from-pink-950/20 via-transparent to-transparent">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#E91E63]/15 border border-[#E91E63]/30 text-pink-400 text-xs font-black uppercase tracking-wider">
              <Calendar size={14} /> Plan Operativo Dinámico (Local Persistente)
            </div>
            {isAdmin && (
              <span className="text-[11px] text-pink-300 font-mono flex items-center gap-1">
                <Sparkles size={12} /> Puedes marcar tareas y anotar comentarios en tiempo real
              </span>
            )}
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            De 1 Piloto a <span className="text-transparent bg-clip-text bg-linear-to-r from-pink-400 via-rose-500 to-purple-400">20 Sucursales Digitales</span> en 30 Días.
          </h1>
          <p className="text-sm sm:text-base text-white/60 max-w-3xl leading-relaxed">
            Estrategia paso a paso para activar físicamente Rabbitty Digital Branch, lanzar landing pages automáticas con subdominio propio y posicionar a cada comercio en los motores de búsqueda de IA.
          </p>

          {/* Progress Bar */}
          <div className="pt-4 max-w-2xl">
            <div className="flex justify-between text-xs font-bold mb-2">
              <span className="text-white/60">Progreso General del Plan</span>
              <span className="text-pink-400 font-mono font-black">{Math.round((completedCount / days.length) * 100)}%</span>
            </div>
            <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-[#E91E63] to-[#8B5CF6] transition-all duration-500 rounded-full"
                style={{ width: `${(completedCount / days.length) * 100}%` }}
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
                    onClick={() => setSelectedDayNumber(d.day)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${statusColor} ${
                      isSelected ? 'ring-2 ring-[#E91E63] shadow-xl' : 'hover:border-white/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-pink-400">DÍA {d.day}</span>
                        <div className="flex items-center gap-1.5">
                          {d.notes && d.notes.length > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] text-zinc-400 bg-white/5 px-1.5 py-0.5 rounded-md">
                              <MessageSquare size={10} /> {d.notes.length}
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClass}`}>
                            {badgeText}
                          </span>
                        </div>
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
              {/* Header Día & Status Badge */}
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

              {/* Botones de Control Dinámico de Estado */}
              <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-white/70">
                  <span>Gestión del Hito:</span>
                  {!isAdmin && <span className="text-[10px] text-pink-400 font-mono">(Requiere Admin)</span>}
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {selectedDay.status !== 'completado' ? (
                    <button
                      type="button"
                      onClick={() => handleMarkCompleted(selectedDay.day)}
                      className="py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-none shadow-md shadow-emerald-500/20 col-span-2"
                    >
                      <CheckCircle2 size={14} /> Marcar como Completado
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRevertStatus(selectedDay.day)}
                      className="py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer col-span-2"
                    >
                      <RotateCcw size={14} /> Revertir a Estado Anterior
                    </button>
                  )}

                  {selectedDay.status !== 'en_proceso' && selectedDay.status !== 'completado' && (
                    <button
                      type="button"
                      onClick={() => handleSetInProgress(selectedDay.day)}
                      className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-none col-span-2"
                    >
                      <Clock size={13} /> Poner en Ejecución
                    </button>
                  )}
                </div>
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

              {/* SECCIÓN DE COMENTARIOS / NOTAS OPERATIVAS */}
              <div className="pt-2 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-white/70 flex items-center gap-1.5">
                    <MessageSquare size={13} className="text-pink-400" /> Notas y Comentarios
                  </span>
                  <span className="text-[10px] text-white/40 font-mono">
                    {selectedDay.notes ? selectedDay.notes.length : 0} guardados
                  </span>
                </div>

                {/* Lista de notas */}
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {selectedDay.notes && selectedDay.notes.length > 0 ? (
                    selectedDay.notes.map((note, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs text-white/80 leading-relaxed">
                        <span className="text-[10px] text-pink-400 font-bold block mb-0.5">Nota #{idx + 1}:</span>
                        {note}
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-white/40 italic">No hay notas registradas para este hito aún.</p>
                  )}
                </div>

                {/* Formulario para agregar comentario */}
                <form onSubmit={handleAddComment} className="flex gap-2 pt-1">
                  <input
                    ref={newCommentInputRef}
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={isAdmin ? 'Agregar nota u observación...' : 'Desbloquea admin para anotar'}
                    disabled={!isAdmin}
                    className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-pink-500 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!isAdmin || !newComment.trim()}
                    className="p-2 rounded-xl bg-[#E91E63] hover:bg-[#FF4081] text-white disabled:opacity-40 cursor-pointer border-none flex items-center justify-center transition-all shadow-md shadow-pink-500/20"
                  >
                    <Send size={14} />
                  </button>
                </form>
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

      {/* MODAL DE AUTENTICACIÓN CON CÓDIGO QR / ADMIN SCAN */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuthModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-4 shadow-2xl z-10"
            >
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 text-white/60 hover:text-white border-none cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-500 border border-pink-500/25 flex items-center justify-center mx-auto">
                <QrCode size={26} />
              </div>

              <div>
                <h3 className="text-xl font-black text-white">Desbloqueo de Administrador</h3>
                <p className="text-xs text-white/60 mt-1 leading-relaxed">
                  Escanea este código con la cámara de tu celular (donde tengas sesión como Rabbitty Admin) para autorizar cambios y comentarios.
                </p>
              </div>

              {/* QR Container */}
              <div className="flex justify-center py-2">
                <SimpleQRCode value={authUrl || 'https://rabbitty.me/gtm-plan'} size={180} />
              </div>

              <div className="pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-400 font-mono">
                Al escanear el QR, este dispositivo quedará autenticado automáticamente.
              </div>

              {/* Atajo directo para sesión local de desarrollo / admin */}
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(AUTH_KEY, ADMIN_SECRET);
                  setIsAdmin(true);
                  setShowAuthModal(false);
                }}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 font-bold text-xs border border-white/10 cursor-pointer transition-colors"
              >
                Autorizar en este Navegador Directamente
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6 text-center text-xs text-white/40 space-y-2">
        <p>© 2026 Rabbitty Network · Plan Estratégico y Hoja de Ruta Operativa.</p>
      </footer>
    </div>
  );
}

