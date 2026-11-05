'use client';

/**
 * ── Onboarding web de negocios (/negocios) ──
 *
 * El canal principal: un negocio llega desde rabbitty.me, elige su giro, deja
 * sus datos, define su recompensa y paquete, firma y envía su alta.
 *
 * No requiere app ni Telegram. La solicitud queda PENDING y se aprueba en el
 * panel (con aprovisionamiento automático de restaurante/sucursal).
 */

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CornerDownLeft,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  PenLine,
  Percent,
  Phone,
  ShieldCheck,
  Sparkles,
  Store,
  User,
} from 'lucide-react';
import { BunzyVideoStage } from '@/components/BunzyVideoStage';
import { BunzyTypingBubble } from '@/components/BunzyTypingBubble';
import { NicheSearch } from '@/components/NicheSearch';
import { WelcomeRitual } from '@/components/WelcomeRitual';

interface Niche {
  id: string;
  name: string;
  description?: string | null;
}

const PACKAGES = [
  { id: 'Starter', label: 'Starter', credit: 10000, price: '$10,000', desc: 'Para cafés y negocios pequeños', icon: '☕' },
  { id: 'Growth', label: 'Growth', credit: 20000, price: '$20,000', desc: 'Para restaurantes medianos', icon: '🍽️' },
  { id: 'Pro', label: 'Pro', credit: 50000, price: '$50,000', desc: 'Para cadenas y gimnasios', icon: '🏪' },
  { id: 'Enterprise', label: 'Enterprise', credit: 100000, price: '$100,000', desc: 'Para grandes retailers', icon: '🏢' },
];

const STEP_META = [
  {
    video: '/videos/bunzy/bunzy-1-hi.mp4',
    poster: '/videos/bunzy/bunzy-1-hi.jpg',
    label: 'Paso 1 · Tu giro',
    title: 'Atrae clientes con Rabbitty',
    description: 'Cuéntanos qué tipo de negocio eres. De ahí salen tus módulos: mesas, cocina, citas o inventario.',
    bubble: 'Elige tu giro y yo te digo qué módulos se activan. Sin compromiso todavía.'
  },
  {
    video: '/videos/bunzy/bunzy-2-show.mp4',
    poster: '/videos/bunzy/bunzy-2-show.jpg',
    label: 'Paso 2 · Tu perfil',
    title: '¿Cómo te conocerán?',
    description: 'Nombre, contacto y ubicación para que los Rabbitters te encuentren y puedan visitarte.',
    bubble: 'Estos datos quedan solo en tu negocio. Nada de spam ni de mezclar con otros tenants.'
  },
  {
    video: '/videos/bunzy/bunzy-3-conexion.mp4',
    poster: '/videos/bunzy/bunzy-3-conexion.jpg',
    label: 'Paso 3 · Recompensas',
    title: 'Tus recompensas en Bunz',
    description: 'Tú decides cuánto devolver a tus clientes. Más Bunz, más recurrencia y clientes felices.',
    bubble: 'Tú decides el porcentaje. El mínimo es 2% y puedes cambiarlo cuando quieras.'
  },
  {
    video: '/videos/bunzy/bunzy-4-descubrimiento.mp4',
    poster: '/videos/bunzy/bunzy-4-descubrimiento.jpg',
    label: 'Paso 4 · Paquete',
    title: 'Respaldo y crédito',
    description: 'Elige el paquete inicial de Bunz que respalda las recompensas de tu negocio.',
    bubble: 'El paquete es el respaldo de los Bunz que puedes emitir. Puedes empezar chico.'
  },
  {
    video: '/videos/bunzy/bunzy-5-celebra.mp4',
    poster: '/videos/bunzy/bunzy-5-celebra.jpg',
    label: 'Paso 5 · Firma',
    title: 'Firma y activa tu negocio',
    description: 'Revisa tu resumen, firma tu adhesión y envía tu solicitud. Te avisamos al aprobarla.',
    bubble: 'Último paso. Firma y te aviso por correo y WhatsApp cuando esté aprobado.'
  },
];

const PACKAGE_BY_NICHE: Record<string, string> = {
  cafe: 'Starter',
  bakery: 'Starter',
  barbershop: 'Starter',
  restaurant: 'Growth',
  tacos: 'Growth',
  pizza: 'Growth',
  bar: 'Growth',
  fitness: 'Growth',
  services: 'Growth',
  retail: 'Pro',
};

function suggestPackage(niche?: string | null): string {
  return PACKAGE_BY_NICHE[niche ?? ''] ?? 'Starter';
}

const CONTRACT_VERSION = '2026-11-04';

/** El ritual se muestra una vez por dispositivo tras enviar el alta. */
const AFFILIATE_RITUAL_KEY = 'rabbitty_affiliate_welcome_ritual_seen_v1';

const CONTRACT_POINTS = [
  {
    title: 'Bunz no es dinero',
    text: 'Son puntos de lealtad. No son moneda, valores ni inversión, y no se convierten a efectivo.',
  },
  {
    title: 'Tus obligaciones',
    text: 'Datos veraces, respetar las recompensas ofrecidas, cumplir tus obligaciones fiscales y laborales y atender a tus clientes.',
  },
  {
    title: 'Nuestras obligaciones',
    text: 'Mantener la plataforma y el soporte, proteger tus datos y avisarte de cambios relevantes.',
  },
  {
    title: 'Límite de responsabilidad',
    text: 'No respondemos por daños indirectos, lucro cesante, caídas de terceros o fuerza mayor.',
  },
  {
    title: 'Terminación',
    text: 'Puedes cancelar cuando quieras. Podemos suspender la cuenta por fraude o incumplimiento.',
  },
  {
    title: 'Firma electrónica',
    text: 'Tu aceptación queda registrada con fecha, versión y firma; tiene validez como consentimiento.',
  },
];

const CONTRACT_PARAGRAPHS = [
  'Contrato de adhesión para negocios afiliados. Al aceptar, celebras un acuerdo con Rabbitty para operar como comercio afiliado, emitir recompensas Bunz y usar el POS.',
  'Los Bunz son puntos promocionales de lealtad: no son dinero, no generan rendimientos y no son canjeables por efectivo. El negocio es responsable de las recompensas que ofrece y de su respaldo.',
  'El negocio se obliga a proporcionar información veraz, cumplir la legislación aplicable (incluidas obligaciones fiscales y de consumo), no realizar fraudes y mantener un canal de atención.',
  'Rabbitty presta la plataforma, el soporte y las herramientas de operación con esfuerzo razonable, sin garantizar disponibilidad ininterrumpida. La responsabilidad total se limita a los montos efectivamente pagados por el paquete en los últimos 3 meses.',
  'Cualquiera de las partes puede terminar el acuerdo. Rabbitty puede suspender el servicio ante fraude, riesgo o incumplimiento. Las obligaciones de confidencialidad, propiedad intelectual e indemnización sobreviven.',
  'La aceptación electrónica, la firma capturada, la fecha, la versión del contrato y los datos de conexión constituyen evidencia del consentimiento. Se rige por las leyes de México.',
];

const DATA_BUBBLES = [
  'Empecemos por el nombre. Es lo primero que verán los Rabbitters.',
  '¿Quién es el responsable? Así sabemos con quién hablar.',
  'Tu correo, para avisarte cuando esté aprobado.',
  'Tu WhatsApp, el canal más rápido para avisarte.',
  '¿Dónde estás? Con esto te ubicamos en el mapa.',
  '¿Cómo nos conociste? Nos ayuda a mejorar.',
  'Activa tu ubicación o continúa sin ella; es opcional.',
];

const BUSINESS_LOGIN_URL =
  process.env.NEXT_PUBLIC_BUSINESS_LOGIN_URL || 'https://admin.rabbitty.me/login';

interface FormData {
  niche: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  lat: number | null;
  lng: number | null;
  reward: number;
  packageId: string;
  signature: string;
  acceptedTerms: boolean;
  referral: string;
}

const EMPTY: FormData = {
  niche: '',
  businessName: '',
  contactName: '',
  email: '',
  phone: '',
  address: '',
  lat: null,
  lng: null,
  reward: 30,
  packageId: 'Starter',
  signature: '',
  acceptedTerms: false,
  referral: '',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(-10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

const inputClass =
  'w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm font-medium text-white placeholder:text-white/25 outline-none transition-colors focus:border-pink-500/60 focus:bg-white/[0.06]';

export default function NegociosPage() {
  const router = useRouter();
  const [niches, setNiches] = useState<Niche[]>([]);
  const [loadingNiches, setLoadingNiches] = useState(true);
  const [step, setStep] = useState(0);
  const [dataStep, setDataStep] = useState(0);
  const [packageTouched, setPackageTouched] = useState(false);
  const [data, setData] = useState<FormData>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [showRitual, setShowRitual] = useState(false);
  const [existing, setExisting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [geo, setGeo] = useState<'idle' | 'asking' | 'ok' | 'denied'>('idle');
  const [startedAt] = useState(() => Date.now());
  const [utm, setUtm] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    fetch('/api/niches')
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.success && Array.isArray(d.niches)) setNiches(d.niches);
      })
      .catch(() => {
        /* el catálogo cae a la lista mínima del API */
      })
      .finally(() => {
        if (alive) setLoadingNiches(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawNiche = params.get('niche') || '';
    const nicheMap: Record<string, string> = {
      food: 'restaurant',
      fitness: 'fitness',
      retail: 'retail',
      entertainment: 'services',
    };
    const rawPackage = params.get('package') || '';
    const validPackage = PACKAGES.some((p) => p.id === rawPackage) ? rawPackage : '';
    const prefilledNiche = nicheMap[rawNiche] || rawNiche;
    // Prefill desde el query string al montar (no hay render alternativo).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData((prev) => ({
      ...prev,
      niche: prefilledNiche,
      packageId: validPackage || suggestPackage(prefilledNiche),
    }));
    setUtm({
      source: params.get('utm_source') || '',
      medium: params.get('utm_medium') || '',
      campaign: params.get('utm_campaign') || '',
      content: params.get('utm_content') || '',
      term: params.get('utm_term') || '',
    });
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const selectedNiche = useMemo(
    () => niches.find((n) => n.id === data.niche) ?? null,
    [niches, data.niche],
  );
  const selectedPackage = useMemo(
    () => PACKAGES.find((p) => p.id === data.packageId) ?? PACKAGES[0],
    [data.packageId],
  );
  const suggestedPackage = useMemo(
    () => PACKAGES.find((p) => p.id === suggestPackage(data.niche)) ?? PACKAGES[0],
    [data.niche],
  );

  const phoneDigits = data.phone.replace(/\D/g, '').slice(-10);
  const emailOk = EMAIL_RE.test(data.email.trim());
  const phoneOk = phoneDigits.length === 10;

  const stepValid = [
    Boolean(data.niche),
    data.businessName.trim().length >= 2 &&
      data.contactName.trim().length >= 2 &&
      emailOk &&
      phoneOk &&
      data.address.trim().length >= 4,
    data.reward >= 10 && data.reward <= 50,
    Boolean(data.packageId),
    data.signature.trim().length >= 3 && data.acceptedTerms,
  ];

  const dataComplete = dataStep === 6 && stepValid[1];

  const dataStepValid = [
    data.businessName.trim().length >= 2,
    data.contactName.trim().length >= 2,
    emailOk,
    phoneOk,
    data.address.trim().length >= 4,
    // Opcionales: cómo nos conoció y ubicación.
    true,
    true,
  ];

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setError('');
  };

  const selectNiche = (id: string) => {
    update('niche', id);
    // Si el usuario no ha tocado el paquete, Bunzy sugiere el del nicho.
    if (!packageTouched) update('packageId', suggestPackage(id));
  };

  const requestGeo = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeo('denied');
      return;
    }
    setGeo('asking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setData((prev) => ({ ...prev, lat: pos.coords.latitude, lng: pos.coords.longitude }));
        setGeo('ok');
      },
      () => setGeo('denied'),
      { timeout: 8000, maximumAge: 60000 },
    );
  };

  const next = () => {
    if (!stepValid[step]) return;
    if (step === 0) setDataStep(0);
    setStep((s) => Math.min(4, s + 1));
  };

  const back = () => {
    if (step === 0) {
      router.push('/');
      return;
    }
    setStep((s) => Math.max(0, s - 1));
  };

  // Paso 2 son 7 sub-pasos internos (6 datos + ubicación), sin cambiar de pantalla.
  const handleContinue = () => {
    if (step === 1) {
      if (!dataStepValid[dataStep]) return;
      if (dataStep < 6) {
        setDataStep((d) => d + 1);
        return;
      }
      if (!stepValid[1]) return;
      setStep(2);
      return;
    }
    next();
  };

  const handleBack = () => {
    if (step === 1) {
      if (dataStep > 0) {
        setDataStep((d) => d - 1);
        return;
      }
      setStep(0);
      return;
    }
    back();
  };

  const submit = async () => {
    if (!stepValid[4] || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          negocio: data.businessName.trim(),
          nombre: data.contactName.trim(),
          email: data.email.trim().toLowerCase(),
          telefono: `+52${phoneDigits}`,
          ubicacion: data.address.trim(),
          lat: data.lat,
          lng: data.lng,
          niche: data.niche,
          nicheId: data.niche,
          nicheName: selectedNiche?.name ?? data.niche,
          rewardPercentage: data.reward,
          package: data.packageId,
          packageCode: data.packageId,
          packageName: data.packageId,
          creditLimit: selectedPackage.credit,
          signature: data.signature.trim(),
          acceptedTerms: data.acceptedTerms,
          contractVersion: CONTRACT_VERSION,
          signatureDate: new Date().toISOString(),
          billingPeriod: 'yearly',
          source: 'web_onboarding',
          como_supo: data.referral.trim(),
          mensaje: '',
          _ts: startedAt,
          website: '',
          utm_source: utm.source,
          utm_medium: utm.medium,
          utm_campaign: utm.campaign,
          utm_content: utm.content,
          utm_term: utm.term,
          referrer: typeof document !== 'undefined' ? document.referrer : '',
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        existing?: boolean;
        error?: string;
      };

      if (!res.ok || !json.ok) {
        setError(
          json.error === 'rate_limited'
            ? 'Demasiados intentos. Espera unos minutos e intenta de nuevo.'
            : 'No pudimos registrar tu solicitud. Revisa tus datos e inténtalo de nuevo.',
        );
        setSubmitting(false);
        return;
      }

      setExisting(Boolean(json.existing));
      setSubmitted(true);
      try {
        if (!localStorage.getItem(AFFILIATE_RITUAL_KEY)) setShowRitual(true);
      } catch {
        // Sin localStorage (modo privado estricto): no interrumpimos el alta.
      }
    } catch {
      setError('Error de conexión. Revisa tu internet e inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const meta = STEP_META[step];

  if (submitted) {
    return (
      <div className="min-h-[100dvh] bg-[#07070F] text-white">
        {showRitual && (
          <WelcomeRitual
            storageKey={AFFILIATE_RITUAL_KEY}
            audioSrc="/assets/lugares-por-descubrir.mp3"
            onComplete={() => setShowRitual(false)}
          />
        )}

        <header className="border-b border-white/10">
          <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/icon_ra.png" alt="Rabbitty" width={28} height={28} className="object-contain" />
              <span className="text-sm font-black tracking-tight">RABBITTY.me</span>
            </Link>
            <Link href="/" className="text-xs font-bold text-white/60 hover:text-white">
              Volver al inicio
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/10 to-transparent p-6 text-center sm:p-10"
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="m-0 text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">
              Solicitud registrada
            </p>
            <h1 className="m-0 mt-2 text-3xl font-black tracking-tight">
              {existing ? 'Ya tenías un negocio con nosotros' : `¡Bienvenido, ${data.businessName}!`}
            </h1>
            <p className="m-0 mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/60">
              {existing
                ? 'Encontramos un negocio asociado a tu contacto. Te escribiremos para ayudarte a terminar la configuración sin duplicar nada.'
                : 'Recibimos tu alta. Revisaremos tus datos y te avisaremos por correo y WhatsApp cuando esté aprobada.'}
            </p>

            <div className="mx-auto mt-6 max-w-md space-y-2 text-left">
              {[
                'Revisamos tu negocio y tu ubicación (2–24 h).',
                'Te avisamos por correo y WhatsApp al aprobarla.',
                'Entras a tu panel, configuras menú y empiezas a operar.',
              ].map((line, i) => (
                <div key={line} className="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pink-500/20 text-[10px] font-black text-pink-300">
                    {i + 1}
                  </span>
                  <p className="m-0 text-xs leading-relaxed text-white/70">{line}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link
                href="/"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-pink-500 px-5 py-3.5 text-sm font-black text-white transition-colors hover:bg-pink-400"
              >
                Volver al inicio
              </Link>
              <a
                href={BUSINESS_LOGIN_URL}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-bold text-white/80 transition-colors hover:bg-white/10"
              >
                Ya me aprobaron · Entrar <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            <p className="m-0 mt-3 text-[11px] text-white/40">
              Cuando te aprobemos, puedes operar también desde la app.{' '}
              <Link href="/download" className="text-pink-400 underline underline-offset-2">
                Descargarla
              </Link>
              .
            </p>

            <p className="m-0 mt-5 text-[11px] text-white/40">
              ¿Dudas? Escríbenos a{' '}
              <a href="mailto:hola@rabbitty.me" className="text-pink-400 underline underline-offset-2">
                hola@rabbitty.me
              </a>
            </p>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#07070F] text-white">
      <header className="border-b border-white/10 bg-[#07070F]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/icon_ra.png" alt="Rabbitty" width={28} height={28} className="object-contain" />
            <span className="text-sm font-black tracking-tight">
              RABBITTY<span className="text-pink-500">.me</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="hidden text-xs font-bold text-white/50 hover:text-white sm:block">
              Inicio
            </Link>
            <a
              href={BUSINESS_LOGIN_URL}
              className="text-xs font-bold text-white/70 hover:text-white"
            >
              Ya tengo cuenta
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-36 pt-6 sm:px-6">
        {/* Progreso */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="m-0 text-[10px] font-black uppercase tracking-[0.25em] text-pink-400">
              Alta de negocio
            </p>
            <span className="text-[11px] font-bold text-white/40">{step + 1} de 5</span>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-gradient-to-r from-pink-500 to-rose-500' : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>

        <BunzyVideoStage
          videoSrc={meta.video}
          poster={meta.poster}
          stepLabel={meta.label}
          title={meta.title}
          description={meta.description}
          videoHeightClass={
            step === 0
              ? 'h-48 sm:h-56'
              : step === 1
                ? 'h-32 sm:h-40'
                : step === 3
                  ? 'h-28 sm:h-36'
                  : 'h-36 sm:h-44'
          }
          layout={step === 0 || step === 1 || step === 3 ? 'horizontal' : 'stacked'}
          loop
        />

        <BunzyTypingBubble
          message={
            step === 1
              ? DATA_BUBBLES[dataStep]
              : step === 3
                ? `Para un ${selectedNiche?.name ?? 'negocio'}, te sugiero el paquete ${suggestedPackage.label}. Puedes cambiarlo.`
                : meta.bubble
          }
          className="mt-4"
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22 }}
            className="mt-6"
          >
            {/* Paso 1: nicho */}
            {step === 0 && (
              <div className="rounded-3xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03] sm:p-5">
                <NicheSearch
                  niches={niches}
                  value={data.niche}
                  onChange={selectNiche}
                  loading={loadingNiches}
                  supportHref="/support"
                />
              </div>
            )}

            {/* Paso 2: datos · wizard interno de 7 sub-pasos */}
            {step === 1 && (
              <div className="rounded-3xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03] sm:p-5">
                <div className="mb-2 flex items-center justify-between">
                  <p className="m-0 text-[10px] font-black uppercase tracking-[0.2em] text-pink-500">
                    Paso 2 · Tus datos
                  </p>
                  <span className="text-[10px] font-bold text-gray-400 dark:text-white/40">
                    {dataStep + 1} de 7
                  </span>
                </div>

                <div className="mb-4 flex gap-1">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i <= dataStep ? 'bg-pink-500' : 'bg-gray-200 dark:bg-white/10'
                      }`}
                    />
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={dataStep}
                    initial={{ opacity: 0, x: 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -14 }}
                    transition={{ duration: 0.18 }}
                    className="flex min-h-[136px] flex-col justify-center"
                  >
                    {dataStep === 0 && (
                      <Field
                        label="Nombre del negocio"
                        icon={<Store className="h-3.5 w-3.5" />}
                        hint={
                          data.businessName && data.businessName.trim().length < 2
                            ? 'Mínimo 2 caracteres'
                            : undefined
                        }
                      >
                        <InputWithEnter
                          autoFocus
                          value={data.businessName}
                          onChange={(v) => update('businessName', v.slice(0, 80))}
                          onAction={handleContinue}
                          disabled={!dataStepValid[0]}
                          placeholder="Ej. Taquería El Compa"
                          autoComplete="organization"
                        />
                      </Field>
                    )}

                    {dataStep === 1 && (
                      <Field
                        label="Tu nombre"
                        icon={<User className="h-3.5 w-3.5" />}
                        hint={
                          data.contactName && data.contactName.trim().length < 2
                            ? 'Mínimo 2 caracteres'
                            : undefined
                        }
                      >
                        <InputWithEnter
                          autoFocus
                          value={data.contactName}
                          onChange={(v) => update('contactName', v.slice(0, 60))}
                          onAction={handleContinue}
                          disabled={!dataStepValid[1]}
                          placeholder="Nombre del responsable"
                          autoComplete="name"
                        />
                      </Field>
                    )}

                    {dataStep === 2 && (
                      <Field
                        label="Correo"
                        icon={<Mail className="h-3.5 w-3.5" />}
                        hint={data.email && !emailOk ? 'Revisa el correo' : undefined}
                      >
                        <InputWithEnter
                          autoFocus
                          value={data.email}
                          onChange={(v) => update('email', v.slice(0, 160))}
                          onAction={handleContinue}
                          disabled={!dataStepValid[2]}
                          placeholder="tu@correo.com"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                        />
                      </Field>
                    )}

                    {dataStep === 3 && (
                      <Field
                        label="WhatsApp"
                        icon={<Phone className="h-3.5 w-3.5" />}
                        hint={data.phone && !phoneOk ? '10 dígitos' : undefined}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-500 dark:text-white/50">+52</span>
                          <InputWithEnter
                            autoFocus
                            className="flex-1"
                            value={data.phone}
                            onChange={(v) => update('phone', formatPhone(v))}
                            onAction={handleContinue}
                            disabled={!dataStepValid[3]}
                            placeholder="322 123 4567"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel-national"
                          />
                        </div>
                      </Field>
                    )}

                    {dataStep === 4 && (
                      <Field
                        label="Ciudad y dirección"
                        icon={<MapPin className="h-3.5 w-3.5" />}
                        hint={
                          data.address && data.address.trim().length < 4
                            ? 'Escribe calle y ciudad'
                            : undefined
                        }
                      >
                        <InputWithEnter
                          autoFocus
                          value={data.address}
                          onChange={(v) => update('address', v.slice(0, 160))}
                          onAction={handleContinue}
                          disabled={!dataStepValid[4]}
                          placeholder="Ej. Av. Insurgentes 123, Guadalajara, Jalisco"
                          autoComplete="street-address"
                        />
                      </Field>
                    )}

                    {dataStep === 5 && (
                      <Field label="¿Cómo nos conociste?" hint="Opcional">
                        <InputWithEnter
                          autoFocus
                          value={data.referral}
                          onChange={(v) => update('referral', v.slice(0, 120))}
                          onAction={handleContinue}
                          disabled={false}
                          placeholder="Instagram, un amigo, Google…"
                        />
                      </Field>
                    )}

                    {dataStep === 6 && (
                      <div className="text-center">
                        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-500">
                          <MapPin className="h-5 w-5" />
                        </div>
                        <p className="m-0 mt-2 text-sm font-black text-gray-900 dark:text-white">
                          Activa tu ubicación
                        </p>
                        <p className="m-0 mx-auto mt-1 max-w-xs text-[11px] leading-relaxed text-gray-500 dark:text-white/45">
                          Nos ayuda a ponerte en el mapa y a que los Rabbitters te encuentren. Es opcional.
                        </p>
                        <button
                          type="button"
                          onClick={requestGeo}
                          disabled={geo === 'asking'}
                          className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/60 dark:hover:bg-white/[0.06]"
                        >
                          {geo === 'ok'
                            ? '✅ Ubicación capturada'
                            : geo === 'asking'
                              ? 'Obteniendo ubicación…'
                              : geo === 'denied'
                                ? '📍 No se pudo obtener (puedes continuar)'
                                : '📍 Usar mi ubicación exacta'}
                        </button>
                        <button
                          type="button"
                          onClick={handleContinue}
                          className="mt-2 text-[11px] font-bold text-gray-400 hover:text-pink-500 dark:text-white/35 dark:hover:text-pink-400"
                        >
                          Ahora no, continuar
                        </button>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {dataStep === 6 && (
                  <p className="m-0 mt-3 text-center text-[10px] text-gray-400 dark:text-white/30">
                    La ubicación es opcional
                  </p>
                )}
              </div>
            )}

            {/* Paso 3: recompensa */}
            {step === 2 && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-center">
                  <p className="m-0 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                    Recompensa para tus clientes
                  </p>
                  <div className="mt-2 flex items-center justify-center gap-1">
                    <input
                      type="number"
                      min={10}
                      max={50}
                      value={data.reward}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        update(
                          'reward',
                          Number.isFinite(value) ? Math.min(50, Math.max(10, value)) : 30,
                        );
                      }}
                      className="w-24 border-0 bg-transparent text-center text-5xl font-black text-pink-400 outline-none"
                    />
                    <Percent className="h-7 w-7 text-pink-400" />
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={50}
                    step={1}
                    value={data.reward}
                    onChange={(e) => update('reward', Number(e.target.value))}
                    className="mt-3 w-full accent-pink-500"
                  />
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {[10, 15, 20, 30, 40].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => update('reward', v)}
                        className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${
                          data.reward === v
                            ? 'border-pink-500/60 bg-pink-500/15 text-pink-300'
                            : 'border-white/10 text-white/50 hover:text-white'
                        }`}
                      >
                        {v}%
                      </button>
                    ))}
                  </div>
                  <p className="m-0 mt-3 text-[10px] font-bold uppercase tracking-wider text-white/35">
                    Mínimo 10%
                  </p>
                </div>

                <div className="flex flex-col justify-center rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5">
                  <p className="m-0 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                    Ejemplo
                  </p>
                  <p className="m-0 mt-2 text-sm leading-relaxed text-white/70">
                    En un ticket de <strong className="text-white">$100</strong>, tu cliente recibe{' '}
                    <strong className="text-emerald-400">${data.reward.toFixed(2)} en Bunz</strong>.
                  </p>
                  <p className="m-0 mt-2 text-[11px] leading-relaxed text-white/45">
                    Tú decides; el mínimo es 10% y puedes cambiarlo después.
                  </p>
                </div>
              </div>
            )}

            {/* Paso 4: paquete */}
            {step === 3 && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-2xl border border-pink-500/20 bg-pink-500/[0.06] p-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-pink-400" />
                  <p className="m-0 text-[11px] leading-relaxed text-white/70">
                    Para un <strong className="text-white">{selectedNiche?.name ?? 'negocio'}</strong>,
                    te sugiero el paquete{' '}
                    <strong className="text-pink-300">{suggestedPackage.label}</strong>. Puedes
                    cambiarlo.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {PACKAGES.map((pkg) => {
                    const active = data.packageId === pkg.id;
                    const suggested = suggestedPackage.id === pkg.id;
                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => {
                          update('packageId', pkg.id);
                          setPackageTouched(true);
                        }}
                        aria-pressed={active}
                        className={`relative rounded-2xl border p-3.5 text-left transition-all ${
                          active
                            ? 'border-pink-500/60 bg-pink-500/10'
                            : 'border-white/10 bg-white/[0.03] hover:border-pink-500/30'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xl">{pkg.icon}</span>
                          <span className="flex items-center gap-1.5">
                            {suggested && (
                              <span className="rounded-full bg-pink-500/15 px-2 py-0.5 text-[8.5px] font-black uppercase tracking-wide text-pink-300">
                                Sugerido
                              </span>
                            )}
                            {active && <Check className="h-4 w-4 text-pink-400" />}
                          </span>
                        </div>
                        <p className="m-0 mt-2 text-sm font-black text-white">{pkg.label}</p>
                        <p className="m-0 text-[10px] font-bold text-white/45">
                          {pkg.credit.toLocaleString('es-MX')} Bunz · {pkg.price}
                        </p>
                        <p className="m-0 mt-1 text-[10.5px] leading-snug text-white/40">
                          {pkg.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <p className="m-0 text-center text-[11px] text-white/35">
                  El crédito respalda los Bunz que puedes emitir. Puedes empezar chico y subir después.
                </p>
              </div>
            )}

            {/* Paso 5: firma */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <p className="m-0 mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                    Resumen de tu alta
                  </p>
                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    <Summary label="Negocio" value={data.businessName} />
                    <Summary label="Giro" value={selectedNiche?.name ?? data.niche} />
                    <Summary label="Contacto" value={`${data.contactName} · +52 ${data.phone}`} />
                    <Summary label="Correo" value={data.email} />
                    <Summary label="Recompensa" value={`${data.reward}% en Bunz`} />
                    <Summary label="Paquete" value={`${selectedPackage.label} · ${selectedPackage.credit.toLocaleString('es-MX')} Bunz`} />
                  </div>
                  <p className="m-0 mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-white/40">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {data.address}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                    <p className="m-0 mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-pink-400">
                      Antes de firmar
                    </p>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {CONTRACT_POINTS.map((point) => (
                        <div
                          key={point.title}
                          className="rounded-2xl border border-white/10 bg-black/20 p-3"
                        >
                          <p className="m-0 text-[11px] font-black text-white">{point.title}</p>
                          <p className="m-0 mt-1 text-[10.5px] leading-relaxed text-white/55">
                            {point.text}
                          </p>
                        </div>
                      ))}
                    </div>

                    <details className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                      <summary className="cursor-pointer text-[11px] font-bold text-pink-300">
                        Leer resumen del contrato
                      </summary>
                      <div className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1 text-[10.5px] leading-relaxed text-white/55">
                        {CONTRACT_PARAGRAPHS.map((paragraph) => (
                          <p key={paragraph.slice(0, 24)} className="m-0">
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </details>

                    <p className="m-0 mt-3 text-[10px] leading-relaxed text-white/35">
                      Versión {CONTRACT_VERSION} ·{' '}
                      <Link
                        href="/contrato"
                        target="_blank"
                        className="text-pink-400 underline underline-offset-2"
                      >
                        Ver contrato completo
                      </Link>{' '}
                      ·{' '}
                      <Link
                        href="/privacy"
                        target="_blank"
                        className="text-pink-400 underline underline-offset-2"
                      >
                        Aviso de privacidad
                      </Link>
                    </p>
                  </div>

                  <div id="firma" className="scroll-mt-24 space-y-4">
                  <Field
                    label="Firma electrónica (nombre completo)"
                    icon={<ShieldCheck className="h-3.5 w-3.5" />}
                  >
                    <input
                      value={data.signature}
                      onChange={(e) => update('signature', e.target.value.slice(0, 80))}
                      placeholder="Ej. María Fernanda López"
                      className={`${inputClass} italic`}
                    />
                  </Field>

                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <input
                      type="checkbox"
                      checked={data.acceptedTerms}
                      onChange={(e) => update('acceptedTerms', e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-pink-500"
                    />
                    <span className="text-[11px] leading-relaxed text-white/55">
                      He leído y acepto el{' '}
                      <Link
                        href="/contrato"
                        target="_blank"
                        className="text-pink-400 underline underline-offset-2"
                      >
                        Contrato de Adhesión
                      </Link>{' '}
                      (v. {CONTRACT_VERSION}), el{' '}
                      <Link
                        href="/privacy"
                        target="_blank"
                        className="text-pink-400 underline underline-offset-2"
                      >
                        Aviso de Privacidad
                      </Link>{' '}
                      y la Política de Bunz. Declaro ser el representante legal del negocio y que la
                      información es correcta.
                    </span>
                  </label>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold text-red-300">
            {error}
          </div>
        )}
      </main>

      {step === 4 && (
        <button
          type="button"
          onClick={() =>
            document.getElementById('firma')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
          className="fixed bottom-24 right-4 z-30 flex items-center gap-2 rounded-full bg-pink-500 px-4 py-2.5 text-xs font-black text-white shadow-[0_10px_30px_rgba(233,30,99,0.45)] transition-transform active:scale-95"
        >
          <PenLine className="h-4 w-4" /> Firmar
        </button>
      )}

      {/* CTA fijo */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#07070F]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] sm:px-6">
          <button
            type="button"
            onClick={handleBack}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-xs font-bold text-white/70 transition-colors hover:bg-white/10"
          >
            <ArrowLeft className="mr-1 inline h-4 w-4" /> Atrás
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={handleContinue}
              disabled={step === 1 ? !dataComplete : !stepValid[step]}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 px-5 py-3.5 text-sm font-black text-white shadow-[0_0_24px_rgba(255,46,147,0.25)] transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {step === 1 && !dataComplete ? 'Completa tus datos' : 'Continuar'}{' '}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!stepValid[4] || submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 px-5 py-3.5 text-sm font-black text-white shadow-[0_0_24px_rgba(255,46,147,0.25)] transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Enviar solicitud
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function InputWithEnter({
  value,
  onChange,
  onAction,
  disabled,
  placeholder,
  type = 'text',
  inputMode,
  autoComplete,
  autoFocus,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  onAction: () => void;
  disabled?: boolean;
  placeholder?: string;
  type?: 'text' | 'email' | 'tel';
  inputMode?: 'text' | 'email' | 'tel';
  autoComplete?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onAction();
          }
        }}
        placeholder={placeholder}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        style={{ paddingRight: 96 }}
        className={inputClass}
      />
      <button
        type="button"
        onClick={onAction}
        disabled={disabled}
        aria-label="Continuar (Enter)"
        className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-xl bg-pink-500 px-2 py-1.5 text-[9px] font-black tracking-wider text-white shadow-sm transition-colors hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-35"
      >
        <CornerDownLeft className="h-3 w-3" /> ENTER
      </button>
    </div>
  );
}

function Field({
  label,
  icon,
  hint,
  children,
}: {
  label: string;
  icon?: ReactNode;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-wider text-white/45">
        {icon}
        {label}
        {hint && <span className="normal-case tracking-normal text-red-300">· {hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
      <p className="m-0 text-[9px] font-black uppercase tracking-wider text-white/35">{label}</p>
      <p className="m-0 mt-0.5 truncate text-[12px] font-bold text-white/85">{value}</p>
    </div>
  );
}
