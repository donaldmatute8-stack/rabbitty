'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CheckCircle2, CreditCard, Loader2, ShieldCheck, X } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import { toast } from '@rabbitty/ui';

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

const TIPS = [0, 10, 15, 20] as const;

/** Formulario Stripe in-app (dentro de <Elements>) */
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
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
    <form onSubmit={handleSubmit} className="space-y-3">

      <div className="rounded-2xl p-3 border border-white/10">
        <PaymentElement
          options={{
            layout: 'tabs',
            fields: { billingDetails: 'auto' },
            // Apple/Google Pay requieren verificar el dominio en Stripe —
            // sin verificación el botón aparece pero CONGELA al tocarlo.
            wallets: { applePay: 'never', googlePay: 'never' },
          }}
        />
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium">
          {error}
        </div>
      )}

      <motion.button
        type="submit"
        disabled={!stripe || submitting}
        whileTap={{ scale: 0.97 }}
        className="w-full bg-linear-to-r from-[#FF2E93] to-[#E91E63] text-white font-black text-sm py-3.5 rounded-2xl shadow-[0_8px_25px_rgba(233,30,99,0.4)] flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Confirmando con tu banco…
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4" />
            Pagar ${amountHint.toFixed(2)} MXN
          </>
        )}
      </motion.button>
      <p className="text-[10px] text-white/35 text-center flex items-center justify-center gap-1">
        <CreditCard size={10} /> Pagos procesados por Stripe · sin guardar datos de tarjeta en Rabbitty
      </p>
    </form>
  );
}

/**
 * Fase D — Hoja de pago IN-APP (sin salir de la miniapp):
 * propina (0/10/15/20%) → PaymentElement de Stripe (tarjeta / wallets) →
 * reconciliación server-side → cuenta liquidada + cashback Bunz.
 */
export function InAppPaySheet({
  isOpen,
  onClose,
  orderId,
  total = 0,
  businessName,
  onPaid,
}: InAppPaySheetProps) {
  const [step, setStep] = useState<'tip' | 'pay' | 'done'>('tip');
  const [tipPercent, setTipPercent] = useState<number>(10);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  // Id REAL del payment intent (payment_intents.id) — NO es el orderId.
  // verifyStripePaymentIntent busca por este id en la tabla.
  const [intentId, setIntentId] = useState<string | null>(null);
  const [amountTotal, setAmountTotal] = useState<number>(total);
  const [setupError, setSetupError] = useState<string | null>(null);
  // Total base leído del server cuando el caller no lo conoce (total = 0)
  const [amountTotalExtra, setAmountTotalExtra] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStep('tip');
      setClientSecret(null);
      setPublishableKey(null);
      setIntentId(null);
      setSetupError(null);
      setAmountTotal(total);
      setAmountTotalExtra(null);
    }
  }, [isOpen, total]);

  // Si no llega el total por props (p. ej. escaneo del QR digital), lo leemos
  // del proxy GET /api/pay/setup?orderId=… — la pantalla de propina necesita
  // el total base real ANTES de continuar. Con headers de auth: sin ellos la
  // API responde 401 y baseTotal queda 0 (propina y total falsos en 0).
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
      } catch { /* total informativo: si falla, seguimos con 0 y el server manda el real */ }
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
        body: JSON.stringify({ orderId, tipPercent }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.success) throw new Error(data?.error || 'No se pudo iniciar el pago');
      setClientSecret(data.clientSecret);
      setPublishableKey(data.publishableKey || null);
      setIntentId(data.intentId || null);
      setAmountTotal(Number(data.amountTotal ?? total + (total * tipPercent) / 100));
      setStep('pay');
    } catch (err: any) {
      setSetupError(String(err?.message || 'Error al iniciar el pago').slice(0, 160));
    } finally {
      setLoadingSetup(false);
    }
  };

  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey]
  );

  const baseTotal = amountTotalExtra ?? total;
  const tipAmount = Math.round(baseTotal * tipPercent) / 100;

  if (!isOpen) return null;

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
            {step === 'tip' && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-black mb-2">Elige tu propina</p>
                  <p className="text-[11px] text-white/40 mb-3">100% del consumo se refleja en tu cuenta del local.</p>
                  <div className="grid grid-cols-4 gap-2">
                    {TIPS.map((t) => (
                      <button
                        key={t}
                        onClick={() => { setTipPercent(t); PlatformBridge.hapticFeedback('light'); }}
                        className={`py-3 rounded-2xl text-sm font-black border transition-all ${
                          tipPercent === t
                            ? 'bg-[#E91E63] border-[#E91E63] text-white shadow-lg shadow-[#E91E63]/30'
                            : 'bg-white/5 border-white/10 text-white/70'
                        }`}
                      >
                        {t}%
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1 bg-white/5 rounded-2xl p-4 border border-white/10">
                  <div className="flex justify-between text-sm text-gray-300">
                    <span>Consumo</span>
                    <span className="font-bold text-white">${baseTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-300">
                    <span>Propina ({tipPercent}%)</span>
                    <span className="font-bold text-white">${tipAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/10 text-base">
                    <span className="font-black">Total</span>
                    <span className="font-black text-emerald-400">${(baseTotal + tipAmount).toFixed(2)} MXN</span>
                  </div>
                </div>
                {setupError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium">{setupError}</div>
                )}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={startPayment}
                  disabled={loadingSetup || !orderId}
                  className="w-full bg-linear-to-r from-[#FF2E93] to-[#E91E63] text-white font-black text-sm py-3.5 rounded-2xl shadow-[0_8px_25px_rgba(233,30,99,0.4)] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loadingSetup ? <Loader2 className="h-4 w-4 animate-spin" /> : '💳'} Continuar al pago
                </motion.button>
              </div>
            )}

            {step === 'pay' && clientSecret && (
              stripePromise ? (
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: APPEARANCE }}>
                  <InAppPaymentForm
                    intentId={intentId || ''}
                    amountHint={amountTotal}
                    onDone={() => { setStep('done'); onPaid?.(amountTotal); }}
                  />
                </Elements>
              ) : (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                  No hay publishable key de Stripe configurada para pagar in-app. Pide el link de pago al cajero (botón "Mi Cuenta" → pagar en web) — o espera el deploy con la env configurada.
                </div>
              )
            )}

            {step === 'done' && (
              <div className="py-10 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-9 w-9 text-emerald-400" />
                </div>
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