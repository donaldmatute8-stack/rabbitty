'use client';

/**
 * Fase D v3 — Hoja de pago IN-APP (rediseño full-screen minimalista):
 * 1) PREGUNTA de propina: monto gigante tappable ($0.00 por default — en México
 *    la propina no se pide, se sugiere), pills de % con fondo transparente,
 *    swipe direccional con shimmer y texto de acción animado (sin flechas ni
 *    manos estáticas). Derecha = Sí · Izquierda = No.
 * 2) SI ACEPTA: panel full-screen con el monto editable por tap y continuar
 *    con swipe simple.
 * 3) PAGO con Stripe Elements + swipe "Pagar".
 * Fix del "div vacío": la instancia de Stripe se resuelve en estado; nunca se
 * monta <Elements stripe={null}>.
 */

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { loadStripe, type Stripe, type StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CheckCircle2, CreditCard, Loader2 } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import { toast } from '@rabbitty/ui';
import PaySheetShell from '@/components/ui/pay/PaySheetShell';
import AmountHero from '@/components/ui/pay/AmountHero';
import TipPills from '@/components/ui/pay/TipPills';
import SwipeAction from '@/components/ui/pay/SwipeAction';
import RatingSheet from '@/components/affiliate/RatingSheet';

interface InAppPaySheetProps {
  isOpen: boolean;
  onClose: () => void;
  orderId?: string | null;
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

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Formulario Stripe in-app con swipe "Pagar". */
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
      setError('Completa la verificación con tu banco (3D Secure).');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="flex-1 flex flex-col">
      <div className="rounded-2xl p-3 border border-white/10 bg-white/[0.02]">
        <PaymentElement
          options={{
            layout: 'tabs',
            fields: { billingDetails: 'auto' },
            wallets: { applePay: 'auto', googlePay: 'auto' },
          }}
        />
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium">
          {error}
        </div>
      )}

      <div className="mt-auto pt-6">
        <SwipeAction
          mode="single"
          rightLabel={`Pagar $${amountHint.toFixed(2)}`}
          idleLabel="Desliza"
          disabled={!stripe || !elements || submitting}
          onRight={() => void submit()}
          accentColor="#E91E63"
        />
        {(!stripe || !elements) && !submitting && (
          <p className="text-[10px] text-amber-300/80 text-center font-semibold mt-3">
            Preparando el módulo de pago… si no aparece en unos segundos, cierra y vuelve a intentarlo.
          </p>
        )}
        <p className="text-[10px] text-white/30 text-center flex items-center justify-center gap-1 mt-3">
          <CreditCard size={10} /> Pagos procesados por Stripe · no guardamos datos de tarjeta
        </p>
      </div>
    </form>
  );
}

export function InAppPaySheet({
  isOpen,
  onClose,
  orderId,
  total = 0,
  businessName,
  onPaid,
}: InAppPaySheetProps) {
  const [step, setStep] = useState<'tip-ask' | 'tip-pick' | 'pay' | 'done'>('tip-ask');
  const [tipPercent, setTipPercent] = useState<number | null>(null); // null = manual
  const [tipManual, setTipManual] = useState<number>(0);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeInstance, setStripeInstance] = useState<Stripe | null | 'loading' | 'idle'>('idle');
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);
  const [amountTotal, setAmountTotal] = useState<number>(total);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [amountTotalExtra, setAmountTotalExtra] = useState<number | null>(null);

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
      setTipPercent(null);
      setTipManual(0);
      setClientSecret(null);
      setPublishableKey(null);
      setStripeInstance('idle');
      setIntentId(null);
      setSetupError(null);
      setAmountTotal(total);
      setAmountTotalExtra(null);
    }
  }, [isOpen, total]);

  // Total base real desde el server cuando el caller no lo conoce
  useEffect(() => {
    if (!isOpen || !orderId || total > 0) return;
    let alive = true;
    (async () => {
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const r = await fetch(`/api/pay/setup?orderId=${encodeURIComponent(orderId)}`, { cache: 'no-store', headers: headers || {} });
        const d = await r.json().catch(() => null);
        if (alive && d?.success) setAmountTotalExtra(Number(d.total ?? 0));
      } catch { /* informativo */ }
    })();
    return () => { alive = false; };
  }, [isOpen, orderId, total]);

  const baseTotal = amountTotalExtra ?? total;
  const tipAmount = tipPercent === null ? round2(tipManual) : round2((baseTotal * tipPercent) / 100);
  const grandTotal = round2(baseTotal + tipAmount);

  const startPayment = async () => {
    if (!orderId) return;
    setLoadingSetup(true);
    setSetupError(null);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/pay/setup', {
        method: 'POST',
        headers: { ...(headers || {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, tipPercent: tipPercent ?? 0, tipAmount: tipPercent === null ? tipAmount : undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.success) throw new Error(data?.error || 'No se pudo iniciar el pago');
      if (!data.clientSecret || !data.publishableKey || !data.intentId) {
        throw new Error('El módulo de pago no está listo en este momento. Intenta de nuevo en unos segundos.');
      }
      setClientSecret(data.clientSecret);
      setPublishableKey(data.publishableKey);
      setIntentId(data.intentId);
      setAmountTotal(Number(data.amountTotal ?? grandTotal));
      setStep('pay');
    } catch (err: any) {
      setSetupError(String(err?.message || 'Error al iniciar el pago').slice(0, 160));
    } finally {
      setLoadingSetup(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <PaySheetShell
        title="Paga tu cuenta"
        subtitle={businessName || 'Tu consumo en el local'}
        onClose={onClose}
      >
        {/* ── PREGUNTA: ¿Dejar propina? (default sin propina) ── */}
        {step === 'tip-ask' && (
          <div className="flex-1 flex flex-col">
            <div className="text-center space-y-2 mt-2">
              <h1 className="text-[26px] font-black tracking-tight m-0">¿Dejar propina?</h1>
              <p className="text-[11px] text-white/40 leading-snug px-3 m-0">
                Tu consumo de <span className="font-black text-white/80">${baseTotal.toFixed(2)} MXN</span> va 100% al local.
                La propina es <span className="font-bold text-white/65">100% opcional y va directo al equipo</span>.
              </p>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center gap-6 py-6">
              <AmountHero
                value={tipPercent === null ? tipManual : round2((baseTotal * tipPercent) / 100)}
                onChange={(mxn) => { setTipPercent(null); setTipManual(mxn); }}
                caption="Toca el número para personalizar"
              />

              <TipPills
                baseTotal={baseTotal}
                selectedPct={tipPercent}
                onPick={(pct) => setTipPercent(pct)}
              />
            </div>

            <div className="mt-auto pt-2">
              <SwipeAction
                mode="dual"
                rightLabel="Sí"
                leftLabel="No"
                onRight={() => setStep('tip-pick')}
                onLeft={() => { setTipPercent(0); void startPayment(); }}
                accentColor="#E91E63"
              />
              <p className="text-[10px] text-white/30 text-center leading-snug mt-3">
                Desliza a la derecha para dejar propina, a la izquierda para continuar
                sin ella. El servicio no se condiciona a la propina.
              </p>
            </div>
          </div>
        )}

        {/* ── PERSONALIZAR: monto gigante editable + continuar ── */}
        {step === 'tip-pick' && (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center gap-6">
              <AmountHero
                value={tipManual}
                onChange={(mxn) => { setTipPercent(null); setTipManual(mxn); }}
                caption="Toca el número para personalizar"
                autoEdit
              />

              <TipPills
                baseTotal={baseTotal}
                selectedPct={tipPercent}
                onPick={(pct) => setTipPercent(pct)}
              />

              <div className="w-full max-w-xs text-center space-y-1 pt-2">
                <p className="text-[11px] text-white/40 m-0">
                  Consumo ${baseTotal.toFixed(2)} + propina ${tipAmount.toFixed(2)}
                </p>
                <p className="text-[17px] font-black text-white m-0 tabular-nums">Total ${grandTotal.toFixed(2)} MXN</p>
              </div>
            </div>

            {setupError && (
              <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium">{setupError}</div>
            )}

            <div className="mt-auto">
              <SwipeAction
                mode="single"
                rightLabel="Pagar"
                idleLabel={loadingSetup ? 'Preparando…' : 'Desliza'}
                disabled={loadingSetup}
                onRight={() => void startPayment()}
                accentColor="#E91E63"
              />
              <button
                onClick={() => { setStep('tip-ask'); setSetupError(null); }}
                className="w-full text-[11px] font-bold text-white/30 hover:text-white/60 py-2 mt-1"
              >
                Volver
              </button>
            </div>
          </div>
        )}

        {/* ── PAGO ── */}
        {step === 'pay' && clientSecret && stripeInstance === 'loading' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-pink-400" />
            <p className="text-xs text-white/40">Cargando módulo de pago…</p>
          </div>
        )}

        {step === 'pay' && clientSecret && stripeInstance === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-pink-400" />
            <p className="text-xs text-white/40">Preparando el pago…</p>
          </div>
        )}

        {step === 'pay' && clientSecret && stripeInstance === null && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold space-y-3 max-w-sm">
              <p>No se pudo cargar el módulo de pago (Stripe no respondió). Revisa tu conexión.</p>
              <button
                onClick={() => { if (publishableKey) loadStripeInstance(publishableKey); }}
                className="px-3 py-1.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 font-black text-[11px]"
              >Reintentar</button>
            </div>
          </div>
        )}

        {step === 'pay' && clientSecret && stripeInstance && typeof stripeInstance !== 'string' && (
          <div className="flex-1 flex flex-col min-h-0">
            <Elements stripe={stripeInstance} options={{ clientSecret, appearance: APPEARANCE }}>
              <InAppPaymentForm
                intentId={intentId || ''}
                amountHint={amountTotal}
                onDone={() => { setStep('done'); onPaid?.(amountTotal); }}
              />
            </Elements>
          </div>
        )}

        {/* ── LISTO ── */}
        {step === 'done' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 12 }}
              className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center"
            >
              <CheckCircle2 className="h-9 w-9 text-emerald-400" />
            </motion.div>
            <p className="text-lg font-black text-white">¡Cuenta liquidada!</p>
            <p className="text-xs text-white/50">Tu pago y tu cashback Bunz ya están acreditados. 🐰</p>
            <div className="w-full max-w-sm pt-2">
              <RatingSheet orderId={orderId || ''} businessName={businessName} onClose={() => setStep('done')} />
            </div>
          </div>
        )}
      </PaySheetShell>
    </AnimatePresence>
  );
}