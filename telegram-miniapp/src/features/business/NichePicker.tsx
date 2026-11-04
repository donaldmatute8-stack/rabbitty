'use client';

/**
 * ── NichePicker (Paso 0 del onboarding) ──
 *
 * El afiliado elige QUÉ tipo de negocio es antes de cualquier otra cosa. De ahí
 * se derivan los módulos que verá (mesas, cocina, citas, inventario…), así que
 * un barbero o un gym no requieren un refactor: solo otro nicho en el catálogo.
 *
 * Catálogo desde /api/niches (tabla `niches`) → añadir un nicho no toca código.
 *
 * Si el giro NO está cubierto, Bunzy lo dice y abre una captura real:
 * email + WhatsApp obligatorios → POST /api/niches/request → Resend manda un
 * correo de bienvenida personalizado al instante. No se fuerza al negocio a
 * elegir un nicho ajeno.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Utensils, Coffee, Wine, Croissant, Pizza, Flame, Scissors, Dumbbell,
  ShoppingBag, Calendar, Store, Check, ChevronRight, ArrowLeft, Sparkles,
  Mail, MessageCircle, Loader2, CheckCircle2, X, Send,
} from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import { BunzyOnboarding } from './BunzyOnboarding';

export interface NicheOption {
  id: string;
  name: string;
  icon?: string | null;
  isActive?: boolean;
  description?: string | null;
  capabilities?: Record<string, boolean>;
}

const ICONS: Record<string, typeof Store> = {
  utensils: Utensils,
  coffee: Coffee,
  wine: Wine,
  croissant: Croissant,
  pizza: Pizza,
  flame: Flame,
  scissors: Scissors,
  dumbbell: Dumbbell,
  'shopping-bag': ShoppingBag,
  calendar: Calendar,
  store: Store,
};

const BLURB: Record<string, string> = {
  restaurant: 'Mesas, cocina y cuentas por comensal',
  cafe: 'Barra rápida, pedidos para llevar y lealtad',
  bar: 'Cuentas abiertas, happy hour y control de barra',
  bakery: 'Venta por pieza o charola, sin mesas',
  pizza: 'Pedidos a domicilio y para recoger',
  tacos: 'Alta rotación, mesas y pedidos al momento',
  barbershop: 'Citas por barbero y comisiones',
  fitness: 'Membresías, clases y accesos',
  retail: 'Inventario, código de barras y caja',
  services: 'Agenda de servicios y anticipos',
};

function iconFor(name?: string | null) {
  return (name && ICONS[name]) || Store;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** Solo dígitos; máscara ligera para México (10 dígitos). */
function formatPhoneInput(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('521') && d.length > 12) d = `52${d.slice(3)}`;
  if (d.startsWith('52') && d.length > 10) d = d.slice(2);
  d = d.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

const phoneDigits = (value: string) => value.replace(/\D/g, '');

/** Copy determinista de Bunzy para este flujo (sin LLM, sin datos de terceros). */
const BUNZY_ASK =
  'No hemos llegado a tu nicho de mercado, pero acabo de abrir la solicitud para construirlo. ' +
  'Déjame tu correo y WhatsApp y te aviso en cuanto esté listo 🐰.';

export function NichePicker({
  value,
  onSelect,
  onContinue,
  onBack,
  submitLabel = 'Continuar',
}: {
  value?: string | null;
  onSelect: (niche: string) => void;
  onContinue: () => void;
  onBack?: () => void;
  submitLabel?: string;
}) {
  const [options, setOptions] = useState<NicheOption[]>([]);
  const [unsupported, setUnsupported] = useState<NicheOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [touched, setTouched] = useState(false);

  // ── Captura de un giro no cubierto ──
  const [requestOpen, setRequestOpen] = useState(false);
  const [giro, setGiro] = useState('');
  const [nicheId, setNicheId] = useState<string | null>(null);
  const [contactName, setContactName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ emailSent: boolean; label: string; already?: boolean } | null>(null);
  const giroRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/niches', { cache: 'force-cache' })
      .then((r) => r.json())
      .then((d) => { if (alive && d?.success && Array.isArray(d.niches)) setOptions(d.niches.filter((n: NicheOption) => n.id !== 'other')); })
      .catch(() => { /* sin catálogo: se ve el estado vacío */ })
      .finally(() => { if (alive) setLoading(false); });

    // Nichos conocidos pero aún no soportados: solo para sugerir en el formulario.
    fetch('/api/niches?all=1', { cache: 'force-cache' })
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.success && Array.isArray(d.niches)) {
          setUnsupported(d.niches.filter((n: NicheOption) => n.isActive === false && n.id !== 'other'));
        }
      })
      .catch(() => { /* opcional */ });

    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (requestOpen && !result) {
      const t = setTimeout(() => giroRef.current?.focus(), 240);
      return () => clearTimeout(t);
    }
  }, [requestOpen, result]);

  const selected = useMemo(() => options.find((o) => o.id === value) ?? null, [options, value]);

  const pick = (id: string) => {
    PlatformBridge.hapticFeedback('light');
    setTouched(true);
    onSelect(id);
  };

  const openRequest = () => {
    PlatformBridge.hapticFeedback('medium');
    setError('');
    setResult(null);
    setRequestOpen(true);
  };

  const closeRequest = () => {
    if (sending) return;
    setRequestOpen(false);
    setError('');
    if (result) {
      setResult(null);
      setGiro('');
      setNicheId(null);
      setContactName('');
      setBusinessName('');
      setEmail('');
      setPhone('');
    }
  };

  const emailOk = EMAIL_RE.test(email.trim());
  const phoneOk = phoneDigits(phone).length === 10;
  const giroOk = giro.trim().length >= 2;
  const canSubmit = emailOk && phoneOk && giroOk && !sending;

  const submitRequest = async () => {
    if (!canSubmit) {
      setError('Necesitamos tu giro, un correo válido y tu WhatsApp a 10 dígitos.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/niches/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nicheId,
          nicheLabel: giro.trim(),
          contactName: contactName.trim() || undefined,
          businessName: businessName.trim() || undefined,
          email: email.trim(),
          phone: phoneDigits(phone),
          source: 'onboarding_paso_0',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(typeof data?.error === 'string' ? data.error : 'No pudimos registrar tu solicitud. Intenta de nuevo.');
        return;
      }
      PlatformBridge.hapticFeedback('light');
      setResult({
        emailSent: Boolean(data.emailSent),
        label: typeof data.nicheLabel === 'string' ? data.nicheLabel : giro.trim(),
        already: Boolean(data.alreadyRegistered),
      });
    } catch {
      setError('No pudimos conectar. Revisa tu red e intenta de nuevo.');
    } finally {
      setSending(false);
    }
  };

  const bunzyMessage = result
    ? `Listo${contactName.trim() ? `, ${contactName.trim().split(' ')[0]}` : ''}. Tu solicitud para ${result.label} quedó registrada. ` +
      (result.emailSent
        ? `Te mandé un correo a ${email.trim()}`
        : `Guardé tu correo ${email.trim()}`) +
      ` y te aviso por WhatsApp al ${phone ? `+52 ${phone}` : 'tu número'} en cuanto abramos tu nicho 🐰.`
    : requestOpen
      ? BUNZY_ASK
      : undefined;

  return (
    <div className="flex min-h-[100dvh] flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="px-5 pt-[calc(env(safe-area-inset-top,0px)+18px)] pb-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-3 inline-flex items-center gap-1 text-[13px] font-bold"
            style={{ color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <ArrowLeft size={15} /> Atrás
          </button>
        )}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="m-0 text-[26px] font-black leading-tight tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          ¿Qué tipo de negocio es?
        </motion.h1>
        <p className="m-0 mt-1.5 text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Con esto preparamos tu caja, tu menú y tus reportes. Puedes cambiarlo después.
        </p>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-2.5 pt-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[86px] animate-pulse rounded-2xl" style={{ background: 'var(--bg-pressed)' }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 pt-3">
            {options.map((opt, i) => {
              const Icon = iconFor(opt.icon);
              const active = value === opt.id;
              return (
                <motion.button
                  key={opt.id}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => pick(opt.id)}
                  aria-pressed={active}
                  className="relative flex flex-col items-start gap-1.5 rounded-2xl p-3 text-left"
                  style={{
                    minHeight: 86,
                    background: active ? 'rgba(233,30,99,0.12)' : 'var(--bg-elevated)',
                    border: `1px solid ${active ? 'rgba(233,30,99,0.55)' : 'var(--border-subtle)'}`,
                    boxShadow: active ? '0 6px 20px rgba(233,30,99,0.18)' : 'none',
                    cursor: 'pointer',
                    transition: 'background 140ms ease, border-color 140ms ease',
                  }}
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-xl"
                    style={{
                      background: active ? 'rgba(233,30,99,0.2)' : 'var(--bg-pressed)',
                      color: active ? '#E91E63' : 'var(--text-secondary)',
                    }}
                  >
                    <Icon size={16} strokeWidth={2.4} />
                  </span>
                  <span className="text-[13px] font-black leading-tight" style={{ color: 'var(--text-primary)' }}>
                    {opt.name}
                  </span>
                  <span className="text-[10.5px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                    {BLURB[opt.id] ?? opt.description ?? 'Configúralo a tu manera'}
                  </span>

                  <AnimatePresence>
                    {active && (
                      <motion.span
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.6, opacity: 0 }}
                        className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full"
                        style={{ background: '#E91E63', color: '#fff' }}
                      >
                        <Check size={12} strokeWidth={3.5} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}

            {/* Giro no cubierto → captura real (email + WhatsApp) */}
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: options.length * 0.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={openRequest}
              className="col-span-2 flex items-center gap-3 rounded-2xl p-3.5 text-left"
              style={{
                background: 'linear-gradient(135deg, rgba(233,30,99,0.10), rgba(168,85,247,0.10))',
                border: '1px dashed rgba(233,30,99,0.45)',
                cursor: 'pointer',
              }}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: 'rgba(233,30,99,0.18)', color: '#FF4D9E' }}
              >
                <Sparkles size={17} strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-black" style={{ color: 'var(--text-primary)' }}>
                  No veo mi tipo de negocio
                </span>
                <span className="block text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                  Dinos tu giro y te avisamos en cuanto lo abramos
                </span>
              </span>
              <ChevronRight size={17} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </motion.button>
          </div>
        )}
      </div>

      {/* CTA fijo */}
      <div
        className="px-5 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-3"
        style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-primary)' }}
      >
        <button
          type="button"
          disabled={!value}
          onClick={() => { PlatformBridge.hapticFeedback('medium'); onContinue(); }}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl py-3.5 text-[15px] font-black text-white active:scale-[0.99] transition-transform disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#FF2E93,#E11D74)', border: 'none', cursor: value ? 'pointer' : 'not-allowed' }}
        >
          {value ? `${submitLabel}` : 'Elige tu tipo de negocio'}
          {value && <ChevronRight size={17} />}
        </button>
        {touched && selected && (
          <p className="m-0 mt-2 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Elegiste <strong style={{ color: 'var(--text-secondary)' }}>{selected.name}</strong>
          </p>
        )}
      </div>

      {/* Bunzy guía desde el primer segundo (y cambia de copy en la captura) */}
      <BunzyOnboarding niche={value} step={0} customMessage={bunzyMessage} />

      {/* ── Hoja de solicitud de nicho ── */}
      <AnimatePresence>
        {requestOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: 'rgba(3,1,8,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
            onClick={closeRequest}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="niche-request-title"
              initial={{ y: 40, opacity: 0.9 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0.9 }}
              transition={{ type: 'spring', damping: 26, stiffness: 260 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[520px] overflow-y-auto rounded-t-3xl px-5 pt-4"
              style={{
                maxHeight: '92dvh',
                background: 'linear-gradient(180deg,#1A0A16 0%,#0C0510 100%)',
                borderTop: '1px solid rgba(233,30,99,0.4)',
                paddingBottom: 'calc(env(safe-area-inset-bottom,0px)+20px)',
              }}
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />

              {result ? (
                /* ── Confirmación ── */
                <div className="pb-1">
                  <div className="mb-3 flex items-center gap-3">
                    <span
                      className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl"
                      style={{ background: 'rgba(74,222,128,0.14)', border: '1px solid rgba(74,222,128,0.45)' }}
                    >
                      <CheckCircle2 size={22} style={{ color: '#4ADE80' }} />
                    </span>
                    <div className="min-w-0">
                      <p className="m-0 text-[10px] font-black uppercase tracking-wider" style={{ color: '#4ADE80' }}>
                        Solicitud registrada
                      </p>
                      <h2 id="niche-request-title" className="m-0 text-[18px] font-black leading-tight" style={{ color: '#fff' }}>
                        {result.label}
                      </h2>
                    </div>
                  </div>

                  <p className="m-0 text-[13.5px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.82)' }}>
                    {result.already
                      ? 'Ya teníamos tu solicitud para este giro. No te mandamos otro correo para no llenarte la bandeja.'
                      : result.emailSent
                        ? `Te mandé un correo de bienvenida a ${email.trim()}.`
                        : `Guardé tu correo ${email.trim()}; te escribiremos en cuanto abramos tu nicho.`}
                    {' '}Te aviso por WhatsApp al <strong style={{ color: '#fff' }}>{phone ? `+52 ${phone}` : 'tu número'}</strong> en cuanto esté listo.
                  </p>

                  <div
                    className="mt-4 rounded-2xl p-3.5"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <p className="m-0 text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      Mientras tanto, ¿tu operación cabe en restaurante, cafetería, bar, panadería, pizzería,
                      taquería, barbería, gym, tienda o servicios con cita? Puedes empezar hoy.
                    </p>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={closeRequest}
                      className="flex-1 rounded-2xl py-3 text-[14px] font-black text-white"
                      style={{ background: 'linear-gradient(135deg,#FF2E93,#E11D74)', border: 'none', cursor: 'pointer' }}
                    >
                      Elegir un giro cubierto
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Formulario ── */
                <div>
                  <div className="mb-4 flex items-start gap-3">
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl"
                      style={{ background: 'rgba(233,30,99,0.16)', border: '1px solid rgba(233,30,99,0.45)' }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/bunzy-avatar.png" alt="Bunzy" style={{ width: 44, height: 44, objectFit: 'contain' }} />
                    </span>
                    <div className="min-w-0">
                      <p className="m-0 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider" style={{ color: '#FF4D9E' }}>
                        <Sparkles size={10} /> Bunzy
                      </p>
                      <h2 id="niche-request-title" className="m-0 mt-0.5 text-[17px] font-black leading-tight" style={{ color: '#fff' }}>
                        Todavía no llegamos a tu giro
                      </h2>
                      <p className="m-0 mt-1 text-[12px] leading-snug" style={{ color: 'rgba(255,255,255,0.62)' }}>
                        Déjame tu correo y WhatsApp y te aviso cuando lo abramos. Sin fechas inventadas.
                      </p>
                    </div>
                  </div>

                  {unsupported.length > 0 && (
                    <div className="mb-4">
                      <p className="m-0 mb-1.5 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.42)' }}>
                        ¿Cuál se parece más?
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {unsupported.slice(0, 8).map((u) => {
                          const active = nicheId === u.id;
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                PlatformBridge.hapticFeedback('light');
                                setNicheId(active ? null : u.id);
                                setGiro(active ? '' : u.name);
                              }}
                              className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                              style={{
                                background: active ? 'rgba(233,30,99,0.22)' : 'rgba(255,255,255,0.06)',
                                border: `1px solid ${active ? 'rgba(233,30,99,0.6)' : 'rgba(255,255,255,0.12)'}`,
                                color: active ? '#FF7AB8' : 'rgba(255,255,255,0.72)',
                                cursor: 'pointer',
                              }}
                            >
                              {u.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <Field label="Tu giro *" icon={<Store size={14} />}>
                    <input
                      ref={giroRef}
                      value={giro}
                      onChange={(e) => { setGiro(e.target.value.slice(0, 80)); if (nicheId) setNicheId(null); }}
                      placeholder="Ej. veterinaria, lavandería, hotel…"
                      maxLength={80}
                      autoComplete="off"
                      style={inputStyle}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="Tu nombre">
                      <input
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value.slice(0, 60))}
                        placeholder="Opcional"
                        maxLength={60}
                        autoComplete="name"
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Negocio">
                      <input
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value.slice(0, 80))}
                        placeholder="Opcional"
                        maxLength={80}
                        autoComplete="organization"
                        style={inputStyle}
                      />
                    </Field>
                  </div>

                  <Field label="Correo *" icon={<Mail size={14} />} hint={email && !emailOk ? 'Revisa el correo' : undefined}>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value.slice(0, 160))}
                      placeholder="tu@correo.com"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      maxLength={160}
                      style={inputStyle}
                    />
                  </Field>

                  <Field
                    label="WhatsApp *"
                    icon={<MessageCircle size={14} />}
                    hint={phone && !phoneOk ? '10 dígitos (México)' : undefined}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold" style={{ color: 'rgba(255,255,255,0.55)' }}>+52</span>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                        placeholder="322 123 4567"
                        inputMode="tel"
                        autoComplete="tel-national"
                        style={{ ...inputStyle, flex: 1 }}
                      />
                    </div>
                  </Field>

                  {error && (
                    <p className="m-0 mt-3 rounded-xl px-3 py-2 text-[12px]" style={{ background: 'rgba(239,68,68,0.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)' }}>
                      {error}
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={submitRequest}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-black text-white active:scale-[0.99] transition-transform disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg,#FF2E93,#E11D74)', border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed' }}
                  >
                    {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={16} />}
                    {sending ? 'Registrando…' : 'Registrar solicitud'}
                  </button>

                  <p className="m-0 mt-2 text-center text-[10.5px] leading-snug" style={{ color: 'rgba(255,255,255,0.38)' }}>
                    Usamos tus datos solo para avisarte de este giro. Nada de spam.
                  </p>
                </div>
              )}

              {!result && (
                <button
                  type="button"
                  onClick={closeRequest}
                  aria-label="Cerrar"
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
                >
                  <X size={15} />
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  padding: '11px 12px',
  color: '#fff',
  // 16px evita el auto-zoom de iOS al enfocar.
  fontSize: 16,
  outline: 'none',
};

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
    <label className="mb-2.5 block">
      <span className="mb-1 flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>
        {icon}
        {label}
        {hint && <span style={{ color: '#FCA5A5', textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}> · {hint}</span>}
      </span>
      {children}
    </label>
  );
}
