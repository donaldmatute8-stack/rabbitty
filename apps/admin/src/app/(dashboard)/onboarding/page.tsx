'use client';

/**
 * ── Re-onboarding de un tenant existente ──
 *
 * Mismo onboarding de 5 pasos que el alta web, pero la información ya viene
 * inyectada: el dueño solo revisa y confirma. No crea nada, no cambia el estado
 * del negocio y NO pasa por aprobación.
 *
 * Al confirmar se marca `onboardingCompletedAt` y se entra al panel.
 */

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { trpc } from '../../../lib/trpc-client';
import { Button, Card, toast } from '@rabbitty/ui';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  GitBranch,
  Loader2,
  Mail,
  MapPin,
  Percent,
  Phone,
  ShieldCheck,
  Sparkles,
  Store,
  User,
  Users,
} from 'lucide-react';
import { BunzyVideoStage } from '../../../components/BunzyVideoStage';
import { BunzyTypingBubble } from '../../../components/BunzyTypingBubble';
import { NicheSearch } from '../../../components/NicheSearch';
import { WelcomeRitual } from '../../../components/WelcomeRitual';

/** El ritual de bienvenida se muestra una vez por dispositivo en el re-onboarding. */
const AFFILIATE_RITUAL_KEY = 'rabbitty_affiliate_ritual_admin_seen_v2';

const STEP_META = [
  {
    video: '/videos/bunzy/bunzy-1-hi.mp4',
    poster: '/videos/bunzy/bunzy-1-hi.jpg',
    label: 'Paso 1 · Tu giro',
    title: 'Tu negocio ya está en Rabbitty',
    description:
      'Confirma tu tipo de negocio para dejar tus módulos al día. Todo lo que ya tienes sigue intacto.',
    bubble: 'Tu operación ya está inyectada. Confirma tu giro y te muestro el resto.',
  },
  {
    video: '/videos/bunzy/bunzy-2-show.mp4',
    poster: '/videos/bunzy/bunzy-2-show.jpg',
    label: 'Paso 2 · Tus datos',
    title: 'Así te conocemos',
    description:
      'Estos son los datos con los que ya operas. No tienes que capturarlos de nuevo.',
    bubble: 'Estos son tus datos actuales. Si algo cambió, lo ajustas en Ajustes al entrar.',
  },
  {
    video: '/videos/bunzy/bunzy-3-conexion.mp4',
    poster: '/videos/bunzy/bunzy-3-conexion.jpg',
    label: 'Paso 3 · Recompensas',
    title: 'Tu recompensa actual',
    description:
      'Así devuelves valor a tus clientes hoy. No la tocamos si no quieres.',
    bubble: 'Tu recompensa ya está configurada. Solo la revisamos juntos.',
  },
  {
    video: '/videos/bunzy/bunzy-4-descubrimiento.mp4',
    poster: '/videos/bunzy/bunzy-4-descubrimiento.jpg',
    label: 'Paso 4 · Paquete',
    title: 'Tu paquete y crédito',
    description:
      'Este es el respaldo de Bunz con el que ya cuentas. Puedes cambiarlo después.',
    bubble: 'Tu paquete y crédito ya están inyectados. Solo estás repasando el flujo.',
  },
  {
    video: '/videos/bunzy/bunzy-5-celebra.mp4',
    poster: '/videos/bunzy/bunzy-5-celebra.jpg',
    label: 'Paso 5 · Confirmación',
    title: 'Todo listo',
    description: 'Revisa el resumen y confirma tu información para entrar a tu panel.',
    bubble: 'Último paso: confirma y entras a tu panel. Nada de tu operación se reinicia.',
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [showRitual, setShowRitual] = useState(false);

  useEffect(() => {
    // Ritual de bienvenida para afiliados que ya operan: una vez por dispositivo.
    // Se puede forzar en pruebas con /onboarding?ritual=1
    try {
      const params = new URLSearchParams(window.location.search);
      const forced = params.get('ritual') === '1';
      if (forced || !localStorage.getItem(AFFILIATE_RITUAL_KEY)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowRitual(true);
      }
    } catch {
      // Sin localStorage: no interrumpimos el re-onboarding.
    }
  }, []);

  const status = trpc.admin.onboardingStatus.useQuery(undefined, { retry: false });
  const niches = trpc.admin.onboardingNiches.useQuery(undefined, { retry: false });

  const business = status.data?.business ?? null;
  const owner = status.data?.owner ?? null;
  const counts = status.data?.counts ?? null;

  useEffect(() => {
    if (business?.niche) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(business.niche);
    }
  }, [business?.niche]);

  const selectedNiche = useMemo(
    () => niches.data?.find((n) => n.id === selected) ?? null,
    [niches.data, selected],
  );

  const complete = trpc.admin.completeOnboarding.useMutation({
    onSuccess: async () => {
      await utils.admin.onboardingStatus.refetch();
      try {
        localStorage.removeItem('rabbitty_onboarding_completed');
        window.dispatchEvent(new Event('rabbitty-readiness-sync'));
      } catch {
        /* no crítico */
      }
      toast.success('Todo listo. Bienvenido a tu panel.');
      router.replace('/');
    },
    onError: (err) => toast.error(err.message),
  });

  const stepValid = [Boolean(selected), true, true, true, accepted];
  const next = () => {
    if (!stepValid[step]) return;
    setStep((s) => Math.min(4, s + 1));
  };
  const back = () => {
    if (step === 0) {
      router.replace('/');
      return;
    }
    setStep((s) => Math.max(0, s - 1));
  };

  if (status.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando tu negocio…
      </div>
    );
  }

  if (!business) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Card className="p-6 text-center">
          <p className="m-0 text-sm font-bold">No encontramos un negocio asociado a tu cuenta</p>
          <p className="m-0 mt-1 text-xs text-gray-500">
            Si ya tienes un negocio, entra desde la cuenta que lo registró o contacta a soporte.
          </p>
          <Button className="mt-4" onClick={() => router.replace('/')}>
            Volver al panel
          </Button>
        </Card>
      </div>
    );
  }

  const meta = STEP_META[step];

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      {showRitual && (
        <WelcomeRitual
          storageKey={AFFILIATE_RITUAL_KEY}
          audioSrc="/assets/afiliados-bienvenida.mp3"
          onComplete={() => setShowRitual(false)}
        />
      )}

      {/* Progreso */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="m-0 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-pink-400">
            <Sparkles className="h-3 w-3" /> Bienvenido de nuevo
          </p>
          <span className="text-[11px] font-bold text-gray-400">{step + 1} de 5</span>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= step
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500'
                  : 'bg-white/10'
              }`}
            />
          ))}
        </div>
      </div>

      <BunzyVideoStage
        videoSrc={meta.video}
        poster={meta.poster}
        stepLabel={meta.label}
        title={step === 0 ? `${business.name} está listo` : meta.title}
        description={meta.description}
        videoHeightClass={step === 0 ? 'h-48 sm:h-56' : 'h-36 sm:h-44'}
        layout={step === 0 ? 'horizontal' : 'stacked'}
        loop
      />

      <BunzyTypingBubble message={meta.bubble} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
        >
          {/* 1 · Nicho */}
          {step === 0 && (
            <Card className="p-5">
              <NicheSearch
                niches={niches.data ?? []}
                value={selected ?? ''}
                onChange={(id) => setSelected(id)}
                loading={niches.isLoading}
                supportHref="https://rabbitty.me/support"
              />
            </Card>
          )}

          {/* 2 · Datos actuales */}
          {step === 1 && (
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-cyan-400" />
                  <p className="m-0 text-sm font-black">Tus datos actuales</p>
                </div>
                <Link href="/settings" className="text-[11px] font-bold text-pink-400 hover:text-pink-300">
                  Editar en Ajustes
                </Link>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <Info label="Negocio" value={business.name} icon={<Store className="h-3.5 w-3.5" />} />
                <Info label="Responsable" value={owner?.firstName} icon={<User className="h-3.5 w-3.5" />} />
                <Info label="Correo" value={owner?.email} icon={<Mail className="h-3.5 w-3.5" />} />
                <Info label="WhatsApp" value={owner?.phoneNumber} icon={<Phone className="h-3.5 w-3.5" />} />
                <div className="sm:col-span-2">
                  <Info label="Dirección" value={business.address} icon={<MapPin className="h-3.5 w-3.5" />} />
                </div>
              </div>

              <p className="m-0 mt-3 text-[11px] text-gray-500">
                No tienes que volver a capturarlos. Si algo cambió, actualízalo en Ajustes.
              </p>
            </Card>
          )}

          {/* 3 · Recompensa */}
          {step === 2 && (
            <Card className="p-6 text-center">
              <Percent className="mx-auto h-6 w-6 text-pink-500" />
              <p className="m-0 mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                Recompensa actual
              </p>
              <p className="m-0 mt-1 text-5xl font-black text-pink-500">
                {business.rewardPercentage ?? "—"}
                <span className="text-2xl">%</span>
              </p>
              <p className="m-0 mx-auto mt-3 max-w-md text-xs leading-relaxed text-gray-500">
                {business.rewardPercentage
                  ? `En un ticket de $100, tus clientes reciben $${business.rewardPercentage.toFixed(2)} en Bunz.`
                  : "Aún no tienes una recompensa configurada. Puedes definirla en Ajustes."}
              </p>
            </Card>
          )}

          {/* 4 · Paquete */}
          {step === 3 && (
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
                  <CreditCard className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                    Paquete actual
                  </p>
                  <p className="m-0 text-lg font-black">{business.package || "Sin paquete"}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <Info
                  label="Capacidad estimada para recibir"
                  value={
                    business.creditLimit != null
                      ? `${business.creditLimit.toLocaleString("es-MX")} Bunz`
                      : null
                  }
                />
                <Info
                  label="Sucursales"
                  value={counts?.branches != null ? String(counts.branches) : null}
                  icon={<GitBranch className="h-3.5 w-3.5" />}
                />
              </div>

              <p className="m-0 mt-3 text-[11px] text-gray-500">
                El crédito respalda los Bunz que puedes emitir. Puedes cambiarlo después con tu asesor.
              </p>
            </Card>
          )}

          {/* 5 · Confirmación */}
          {step === 4 && (
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <p className="m-0 text-sm font-black">Resumen de tu operación</p>
              </div>

              <div className="grid gap-2 text-xs sm:grid-cols-2">
                <Info label="Negocio" value={business.name} />
                <Info label="Giro" value={selectedNiche?.name ?? business.niche} />
                <Info label="Correo" value={owner?.email} />
                <Info label="Recompensa" value={business.rewardPercentage != null ? `${business.rewardPercentage}%` : null} />
                <Info label="Paquete" value={business.package} />
                <Info
                  label="Equipo"
                  value={counts ? `${counts.staff} personas · ${counts.menu} platillos` : null}
                  icon={<Users className="h-3.5 w-3.5" />}
                />
              </div>

              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-pink-500"
                />
                <span className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
                  Confirmo que mi información es correcta. Entiendo que no se reinicia nada de mi operación:
                  menú, personal, ventas y configuración siguen igual.
                </span>
              </label>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navegación */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" onClick={back} className="sm:w-32">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Atrás
        </Button>

        {step < 4 ? (
          <Button
            className="flex-1"
            disabled={!stepValid[step]}
            onClick={next}
          >
            Continuar <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : (
          <Button
            className="flex-1"
            disabled={!accepted || complete.isPending}
            onClick={() => complete.mutate({ niche: selected ?? undefined })}
          >
            {complete.isPending ? "Guardando…" : "Confirmar y entrar"}
            {!complete.isPending && <Check className="ml-1.5 h-4 w-4" />}
          </Button>
        )}
      </div>

      <div className="text-center">
        <button
          type="button"
          disabled={complete.isPending}
          onClick={() => complete.mutate({ niche: undefined })}
          className="text-[11px] font-bold text-gray-400 hover:text-white disabled:opacity-40"
        >
          Saltar por ahora y entrar al panel
        </button>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  icon,
}: {
  label: string;
  value?: string | null;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3.5 dark:border-white/10 dark:bg-white/5">
      <p className="m-0 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-gray-400">
        {icon}
        {label}
      </p>
      <p className={`m-0 mt-1 truncate text-[12.5px] font-bold ${value ? "text-gray-900 dark:text-white" : "text-gray-400 italic"}`}>
        {value || "Sin configurar"}
      </p>
    </div>
  );
}
