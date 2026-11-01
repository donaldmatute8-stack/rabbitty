'use client';

/**
 * Fase D v2 — Hoja de pago IN-APP (identidad premium deslizable):
 * 1. PREGUNTA "¿Dejar propina?" — default 0% (en México la propina no se pide,
 *    se sugiere). Swipe dual: derecha=Sí, izquierda=No.
 * 2. Si Sí → panel grande de propina manual (número grande MXN) + chips de % en
 *    chiquito. Si No → tip $0 y directo al pago.
 * 3. PAGO con swipe-to-confirm premium.
 * Fix del "div vacío + botón bloqueado": la promesa de loadStripe se RESUELVE
 * en estado — si Stripe falla al cargar se muestra error con reintentar, nunca
 * se monta <Elements> con null (que dejaba PaymentElement vacío y useStripe null).
 */

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { loadStripe, type Stripe, type StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CheckCircle2, CreditCard, Loader2, X } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import { toast } from '@rabbitty/ui';
import SwipeConfirm from '@/components/ui/SwipeConfirm';

interface InAppPaySheetProps {
  isOpen: boolean;
  onClose: () => void;
  orderId?: string | null;
  /** Total base de la cuenta (informativo) */
  total?: number;
  businessName?: string;
  onPaid?: (amountTotal: number) => void;
}

const APPEARANCE: StripeElementsOptions['appearance'] = {
  theme: 'night',
  variables: {
    colorPrimary: '#E91E63',
    colorBackground: '#181825',
    colorText: '#FFFFFF',
    colorTextSecondary: '#A0A0B8',
    colorDanger: '#FF5370',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    borderRadius: '14px',
  },
};

const TIPS = [10, 15, 20] as const;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Formulario Stripe in-app (dentro de <Elements>): propina ya decidida. */
function InAppPaymentForm({
  intentId,
  amountHint,
  onDone,
}: {
  intentId: string;
  amountHint: number;
  onDone: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    setError(null);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/profile/wallet` },
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message || 'No se pudo procesar el pago');
      setSubmitting(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === 'succeeded') {
      try {
        PlatformBridge.hapticFeedback('success');
        const res = await fetch('/api/pay/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intentId }),
        });
        const data = await res.json().catch(() => null);
        if (data?.success && data?.settled) {
          toast.success('💳 ¡Cuenta liquidada! Tu cashback Bunz ya fue acreditado');
        } else {
          toast.info('Pago confirmado en Stripe — la liquidación llega en unos segundos');
        }
      } catch {
        toast.info('Pago confirmado en Stripe — la liquidación llega en unos segundos');
      }
      onDone();
    } else {
      // 3DS / redirect parcial
      setError('Completa la verificación con tu banco (3D Secure).');
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
      className="space-y-3"
    >
      <div className="rounded-2xl p-3 border border-white/10">
        <PaymentElement
          options={{
            layout: 'tabs',
            fields: { billingDetails: 'auto' },
            // Dominio admin.rabbitty.me VERIFICADO en Stripe (Payment method
            // domains, test mode) → Apple/Google Pay reactivados in-app.
            wallets: { applePay: 'auto', googlePay: 'auto' },
          }}
        />
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium">
          {error}
        </div>
      )}

      {/* Confirmación premium: deslizar a la derecha para pagar */}
      <SwipeConfirm
        label={submitting ? 'Procesando…' : `Desliza para pagar $${amountHint.toFixed(2)}`}
        knob="💳"
        yesLabel="Pagar"
        disabled={!stripe || !elements || submitting}
        threshold={110}
        onSuccess={() => void submit()}
      />

      {(!stripe || !elements) && !submitting && (
        <p className="text-[10px] text-amber-300/80 text-center font-semibold">
          Preparando el módulo de pago… si no aparece en unos segundos, cierra y vuelve a intentarlo.
        </p>
      )}

      <p className="text-[10px] text-white/35 text-center flex items-center justify-center gap-1">
        <CreditCard size={10} /> Pagos procesados por Stripe · sin guardar datos de tarjeta en Rabbitty
      </p>
    </form>
  );
}

/**
 * Hoja de pago in-app:
 * PREGUNTA propina (default sin propina, sugerencia con swipe dual)
 * → panel manual grande (si acepta) → pago con swipe premium.
 */
export function InAppPaySheet({
  isOpen,
  onClose,
  orderId,
  total = 0,
  businessName,
  onPaid,
}: InAppPaySheetProps) {
  const [step, setStep] = useState<'tip-ask' | 'tip-pick' | 'pay' | 'done'>('tip-ask');
  const [tipPercent, setTipPercent] = useState<number>(0);
  const [tipManual, setTipManual] = useState<string>('');
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeInstance, setStripeInstance] = useState<Stripe | null | 'loading' | 'idle'>('idle');
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);
  const [amountTotal, setAmountTotal] = useState<number>(total);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [amountTotalExtra, setAmountTotalExtra] = useState<number | null>(null);

  // Instancia de Stripe RESUELTA (nunca promesa cruda: un <Elements stripe={null}>
  // monta vacío y deja el botón bloqueado — el bug del "div sin nada").
  const loadStripeInstance = (key: string) => {
    setStripeInstance('loading');
    loadStripe(key)
      .then((s) => setStripeInstance(s ?? null))
      .catch(() => setStripeInstance(null));
  };

  useEffect(() => {
    if (!isOpen || !publishableKey) return;
    loadStripeInstance(publishableKey);
  }, [isOpen, publishableKey]);

  useEffect(() => {
    if (!isOpen) {
      setStep('tip-ask');
      setTipPercent(0);
      setTipManual('');
      setClientSecret(null);
      setPublishableKey(null);
      setStripeInstance('idle');
      setIntentId(null);
      setSetupError(null);
      setAmountTotal(total);
      setAmountTotalExtra(null);
    }
  }, [isOpen, total]);

  // Total base desde el server cuando el caller no conoce el total
  useEffect(() => {
    if (!isOpen || !orderId || total > 0) return;
    let alive = true;
    (async () => {
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const r = await fetch(`/api/pay/setup?orderId=${encodeURIComponent(orderId)}`, {
          cache: 'no-store',
          headers: headers || {},
        });
        const d = await r.json().catch(() => null);
        if (alive && d?.success) setAmountTotalExtra(Number(d.total ?? 0));
      } catch { /* total informativo; el server manda el real */ }
    })();
    return () => { alive = false; };
  }, [isOpen, orderId, total]);

  const startPayment = async () => {
    if (!orderId) return;
    setLoadingSetup(true);
    setSetupError(null);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/pay/setup', {
        method: 'POST',
        headers: { ...(headers || {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, tipPercent, tipAmount: tipManual ? Number(tipManual) : undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.success) throw new Error(data?.error || 'No se pudo iniciar el pago');
      // Guard del div vacío: todo lo necesario PRESENTE antes de mostrar el pago
      if (!data.clientSecret || !data.publishableKey || !data.intentId) {
        throw new Error('El módulo de pago no está listo en este momento. Intenta de nuevo en unos segundos.');
      }
      setClientSecret(data.clientSecret);
      setPublishableKey(data.publishableKey);
      setIntentId(data.intentId);
      setAmountTotal(Number(data.amountTotal ?? round2(baseTotal + tipAmount)));
      setStep('pay');
    } catch (err: any) {
      setSetupError(String(err?.message || 'Error al iniciar el pago').slice(0, 160));
    } finally {
      setLoadingSetup(false);
    }
  };

  const baseTotal = amountTotalExtra ?? total;
  const manualTipNum = Number(tipManual);
  const tipAmount = Number.isFinite(manualTipNum) && manualTipNum > 0
    ? round2(manualTipNum)
    : round2((baseTotal * tipPercent) / 100);

  if (!isOpen) return null;

  const proceed = () => {
    PlatformBridge.hapticFeedback('light');
    void startPayment();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-999 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md">
        <div className="absolute inset-0" onClick={onClose} />
        <motion.div
          initial={{ y: '100%', opacity: 0.8 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-md bg-[#14141E] border border-white/10 rounded-t-4xl sm:rounded-4xl p-6 max-h-[88vh] flex flex-col overflow-hidden shadow-2xl z-10 text-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <h3 className="text-base font-black tracking-tight">💸 Paga tu cuenta</h3>
              <p className="text-xs text-white/50">{businessName || 'Tu consumo en el local'}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 min-h-0">
            {/* ── PASO 1: ¿Dejar propina? (pregunta, default NO) ── */}
            {step === 'tip-ask' && (
              <div className="space-y-5">
                <div className="text-center space-y-2">
                  <p className="text-2xl font-black tracking-tight">¿Dejar propina?</p>
                  <p className="text-[11px] text-white/45 leading-snug px-2">
                    Tu consumo de <span className="font-black text-white">${baseTotal.toFixed(2)} MXN</span> va 100% al local.
                    La propina es <span className="font-bold text-white/70">100% opcional y va directo al equipo</span>.
                  </p>
                </div>

                <SwipeConfirm
                  dual
                  label="Desliza para responder"
                  knob="🫰"
                  yesLabel="Sí"
                  noLabel="No"
                  threshold={110}
                  accentColor="#E91E63"
                  onSuccess={() => {
                    PlatformBridge.hapticFeedback('medium');
                    setStep('tip-pick');
                  }}
                  onNo={() => {
                    PlatformBridge.hapticFeedback('light');
                    setTipPercent(0);
                    setTipManual('');
                    proceed();
                  }}
                />

                <p className="text-[10px] text-white/30 text-center leading-snug">
                  Desliza a la derecha para dejar propina, a la izquierda para continuar sin ella.
                  El servicio no se condiciona a la propina.
                </p>
              </div>
            )}

            {/* ── PASO 2: Panel de propina — manual grande + chips chiquitos ── */}
            {step === 'tip-pick' && (
              <div className="space-y-4">
                <p className="text-sm font-black text-center">¿Cuánto quieres dejar?</p>

                {/* Entrada manual GRANDE */}
                <div className="rounded-3xl bg-linear-to-b from-[#E91E63]/15 to-transparent border border-[#E91E63]/30 p-5 text-center">
                  <span className="text-xs font-black uppercase tracking-wider text-pink-300">Propina</span>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <span className={`font-black leading-none ${tipManual ? 'text-5xl text-white' : 'text-4xl text-white/25'}`}>
                      ${tipManual || '0'}
                    </span>
                    <span className="text-sm font-bold text-white/50 self-end mb-1.5">MXN</span>
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={5000}
                    placeholder="Cantidad en pesos"
                    value={tipManual}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || (/^\d*\.?\d{0,2}$/.test(v) && Number(v) <= 5000)) setTipManual(v);
                    }}
                    className="mt-3 w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-center text-sm font-bold text-white placeholder-white/30 outline-none focus:border-[#E91E63]/60 transition-colors cursor-text"
                  />
                </div>

                {/* Sugerencias rápidas — chiquitas */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-1.5 text-center">O toca un porcentaje de ${baseTotal.toFixed(2)}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {TIPS.map((t) => (
                      <button
                        key={t}
                        onClick={() => { setTipPercent(t); setTipManual(''); PlatformBridge.hapticFeedback('light'); }}
                        className={`py-2 rounded-xl text-[11px] font-black border transition-all ${
                          tipManual === '' && tipPercent === t
                            ? 'bg-[#E91E63] border-[#E91E63] text-white shadow-lg shadow-[#E91E63]/30'
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        {t}% · ${round2((baseTotal * t) / 100)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resumen */}
                <div className="space-y-1 bg-white/5 rounded-2xl p-4 border border-white/10">
                  <div className="flex justify-between text-sm text-gray-300">
                    <span>Consumo</span>
                    <span className="font-bold text-white">${baseTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-300">
                    <span>Propina</span>
                    <span className={`font-bold ${tipAmount > 0 ? 'text-pink-300' : 'text-gray-500'}`}>
                      ${tipAmount.toFixed(2)}
                      {!tipAmount && <span className="text-[10px] italic font-normal text-gray-500 ml-1">(sin propina)</span>}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/10 text-base">
                    <span className="font-black">Total</span>
                    <span className="font-black text-emerald-400">${round2(baseTotal + tipAmount).toFixed(2)} MXN</span>
                  </div>
                </div>

                {setupError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium">
                    {setupError}
                  </div>
                )}

                {/* Continuar con swipe premium */}
                <SwipeConfirm
                  label={`${loadingSetup ? 'Preparando…' : 'Desliza para pagar'} $${round2(baseTotal + tipAmount).toFixed(2)}`}
                  knob="→"
                  yesLabel="Pagar"
                  disabled={loadingSetup}
                  threshold={110}
                  onSuccess={proceed}
                />

                <button
                  onClick={() => { setStep('tip-ask'); setSetupError(null); }}
                  className="w-full text-[11px] font-bold text-gray-500 hover:text-gray-300 py-1"
                >
                  ← Volver
                </button>
              </div>
            )}

            {/* ── PASO 3: PAGO ── */}
            {step === 'pay' && clientSecret && stripeInstance === 'loading' && (
              <div className="flex flex-col items-center gap-3 py-10">
                <Loader2 className="h-6 w-6 animate-spin text-pink-400" />
                <p className="text-xs text-gray-400">Cargando módulo de pago…</p>
              </div>
            )}

            {step === 'pay' && clientSecret && stripeInstance === 'idle' && (
              <div className="flex flex-col items-center gap-3 py-10">
                <Loader2 className="h-6 w-6 animate-spin text-pink-400" />
                <p className="text-xs text-gray-400">Preparando el pago…</p>
              </div>
            )}

            {step === 'pay' && clientSecret && stripeInstance === null && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold space-y-3">
                <p>No se pudo cargar el módulo de pago (Stripe no respondió). Revisa tu conexión.</p>
                <button
                  onClick={() => { if (publishableKey) loadStripeInstance(publishableKey); }}
                  className="px-3 py-1.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 font-black text-[11px] cursor-pointer"
                >Reintentar</button>
              </div>
            )}

            {step === 'pay' && clientSecret && stripeInstance && typeof stripeInstance !== 'string' && (
              <Elements
                stripe={stripeInstance}
                options={{ clientSecret, appearance: APPEARANCE }}
              >
                <InAppPaymentForm
                  intentId={intentId || ''}
                  amountHint={amountTotal}
                  onDone={() => { setStep('done'); onPaid?.(amountTotal); }}
                />
              </Elements>
            )}

            {step === 'done' && (
              <div className="py-10 text-center space-y-3">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 12 }}
                  className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto"
                >
                  <CheckCircle2 className="h-9 w-9 text-emerald-400" />
                </motion.div>
                <p className="text-lg font-black text-white">¡Cuenta liquidada!</p>
                <p className="text-xs text-white/50">Tu pago y tu cashback Bunz ya están acreditados. 🐰</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}