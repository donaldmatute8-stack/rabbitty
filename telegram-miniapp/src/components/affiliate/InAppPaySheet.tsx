'use client';

/**
 * Fase D v4 — Pago IN-APP en UN SOLO PASO:
 * - Al abrir se crea el intent (propina $0) y se muestra el pago de inmediato.
 * - La propina vive detrás de una pregunta mediana con icono ("¿Dejar propina?").
 *   Al tocarla se abre un overlay con monto gigante + pills; al elegir se aplica
 *   automáticamente (se reemplaza el intent), el overlay se cierra y vuelves al
 *   mismo pago ya con el nuevo total.
 * - Un único gesto: deslizar a la derecha para pagar.
 * Bugs corregidos: el proxy ya no suma la propina dos veces y el cambio de
 * propina reemplaza el intent (antes la idempotencia congelaba el monto).
 */

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { loadStripe, type Stripe, type StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CheckCircle2, CreditCard, Loader2, HandCoins, X } from 'lucide-react';
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

      <div className="mt-auto pt-5">
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
  const [step, setStep] = useState<'pay' | 'done'>('pay');
  const [tipAmount, setTipAmount] = useState(0);
  // ── H15: Pagar con Bunz (cuenta enviada, sin QR) ──
  const [bunzState, setBunzState] = useState<{
    balance: number; owed: number; acceptsBunz: boolean; canPayWithBunz: boolean; total: number;
  } | null>(null);
  const [bunzBusy, setBunzBusy] = useState(false);
  const [bunzConfirm, setBunzConfirm] = useState(false);
  const [tipOverlay, setTipOverlay] = useState(false);
  const [tipDraft, setTipDraft] = useState(0);
  const [tipDraftPct, setTipDraftPct] = useState<number | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeInstance, setStripeInstance] = useState<Stripe | null | 'loading' | 'idle'>('idle');
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);
  const [amountTotal, setAmountTotal] = useState<number>(total);
  const [baseAmount, setBaseAmount] = useState<number>(total);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [amountTotalExtra, setAmountTotalExtra] = useState<number | null>(null);
  // Guard: evita que el effect se dispare 2 veces (StrictMode/re-renders) y
  // cree dos intents para la misma orden con la misma propina.
  const startGuardRef = useRef<string | null>(null);

  const [stripeLoadError, setStripeLoadError] = useState<string | null>(null);
  const loadStripeInstance = (key: string) => {
    setStripeInstance('loading');
    // Single-flight: evitar cargar Stripe.js dos veces (React Strict-mode /
    // double effect puede provocar "múltiples instancias").
    try {
      loadStripe(key.trim())
        .then((s) => {
          if (s) { setStripeLoadError(null); setStripeInstance(s); }
          else { setStripeLoadError('Stripe.js devolvió null (script de js.stripe.com no cargó)'); setStripeInstance(null); }
        })
        .catch((err: unknown) => {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error('[PAY] loadStripe falló:', errMsg);
          setStripeLoadError(errMsg);
          setStripeInstance(null);
        });
    } catch (errSync: unknown) {
      setStripeLoadError(errSync instanceof Error ? errSync.message : String(errSync));
      setStripeInstance(null);
    }
  };

  useEffect(() => {
    if (!isOpen || !publishableKey) return;
    loadStripeInstance(publishableKey);
  }, [isOpen, publishableKey]);

  // Reset al abrir/cerrar
  useEffect(() => {
    if (!isOpen) {
      setStep('pay');
      setTipAmount(0);
      setTipOverlay(false);
      setTipDraft(0);
      setTipDraftPct(null);
      setClientSecret(null);
      setPublishableKey(null);
      setStripeInstance('idle');
      setIntentId(null);
      setSetupError(null);
      setAmountTotal(total);
      setBaseAmount(total);
      setAmountTotalExtra(null);
    }
  }, [isOpen, total]);

  // ── H15: config de pago con Bunz (saldo vs deuda; si el negocio lo permite) ──
  useEffect(() => {
    if (!isOpen || !orderId) return;
    let alive = true;
    (async () => {
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const r = await fetch(`/api/pay/bunz-pay?orderId=${encodeURIComponent(orderId)}`, { cache: 'no-store', headers: headers || {} });
        const d = await r.json().catch(() => null);
        if (alive && d?.ok) {
          setBunzState({
            balance: Number(d.balance ?? 0),
            owed: Number(d.owed ?? 0),
            acceptsBunz: Boolean(d.acceptsBunz),
            canPayWithBunz: Boolean(d.canPayWithBunz),
            total: Number(d.total ?? 0),
          });
        } else if (alive && d && !d.ok && d.status === 409) {
          // cuenta ya liquidada — sin UI de bunz
          setBunzState({ balance: 0, owed: 0, acceptsBunz: false, canPayWithBunz: false, total: 0 });
        }
      } catch { /* silencioso */ }
    })();
    return () => { alive = false; };
  }, [isOpen, orderId]);

  // Total base cuando el caller no lo conoce
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

  const baseTotal = amountTotalExtra ?? baseAmount ?? total;

  /** Crea (o reemplaza) el intent con la propina indicada y monta Elements. */
  const startPayment = async (tipMxn: number, replaceIntent: string | null = null) => {
    if (!orderId) return;
    const guardKey = `${orderId}:${tipMxn}:${replaceIntent}`;
    // Mismo destino en curso → no duplicar creación de intents
    if (startGuardRef.current === guardKey && loadingSetup) return;
    startGuardRef.current = guardKey;
    setLoadingSetup(true);
    setSetupError(null);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/pay/setup', {
        method: 'POST',
        headers: { ...(headers || {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          tipAmount: tipMxn > 0 ? tipMxn : undefined,
          tipPercent: tipMxn > 0 ? undefined : 0,
          replaceIntentId: replaceIntent || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.success) throw new Error(data?.error || 'No se pudo iniciar el pago');
      if (!data.clientSecret || !data.publishableKey || !data.intentId) {
        throw new Error('El módulo de pago no está listo en este momento. Intenta de nuevo en unos segundos.');
      }
      setClientSecret(data.clientSecret);
      setPublishableKey(data.publishableKey);
      setIntentId(data.intentId);
      setTipAmount(Number(data.tipAmount ?? tipMxn));
      setAmountTotal(Number(data.amountTotal ?? (baseTotal + tipMxn)));
      setBaseAmount(Number(data.amountBase ?? baseTotal));
    } catch (err: any) {
      setSetupError(String(err?.message || 'Error al iniciar el pago').slice(0, 160));
    } finally {
      setLoadingSetup(false);
    }
  };

  // Un solo paso: al abrir se prepara el intent (propina $0)
  useEffect(() => {
    if (isOpen && orderId && !clientSecret && !loadingSetup) {
      void startPayment(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, orderId, clientSecret]);

  // Aplica una propina y reemplaza el intent (no cierra el pago)
  const applyTip = async (amount: number) => {
    setTipOverlay(false);
    if (round2(amount) === round2(tipAmount)) return;
    await startPayment(round2(amount), intentId);
  };

  if (!isOpen) return null;

  const grandTotal = amountTotal > 0 ? amountTotal : round2(baseTotal + tipAmount);
  const draftAmount = tipDraftPct === null ? tipDraft : round2((baseTotal * tipDraftPct) / 100);
  const applyLabel = loadingSetup
    ? 'Aplicando…'
    : draftAmount > 0
      ? `Aplicar $${draftAmount.toFixed(2)}`
      : 'Continuar sin propina';

  return (
    <AnimatePresence>
      <PaySheetShell
        title="Paga tu cuenta"
        subtitle={businessName || 'Tu consumo en el local'}
        onClose={onClose}
        overlay={
          <AnimatePresence>
            {tipOverlay && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 bg-black/80 backdrop-blur-md flex items-end"
              >
                <div className="absolute inset-0" onClick={() => setTipOverlay(false)} />
                <motion.div
                  initial={{ y: '8%', opacity: 0.9 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '8%', opacity: 0 }}
                  transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                  className="relative w-full bg-[#0F0F15] border-t border-white/10 rounded-t-3xl px-5 pt-5 pb-[calc(var(--safe-bottom,0px)+18px)]"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-[17px] font-black text-white m-0">¿Dejar propina?</p>
                      <p className="text-[11px] text-white/40 m-0">100% opcional · va directo al equipo</p>
                    </div>
                    <button onClick={() => setTipOverlay(false)} aria-label="Cerrar" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60">
                      <X size={14} />
                    </button>
                  </div>

                  <div className="py-4">
                    <AmountHero
                      value={tipDraftPct === null ? tipDraft : round2((baseTotal * tipDraftPct) / 100)}
                      onChange={(mxn) => { setTipDraftPct(null); setTipDraft(mxn); }}
                      caption="Toca el número para personalizar"
                    />
                  </div>

                  <TipPills
                    baseTotal={baseTotal}
                    selectedPct={tipDraftPct}
                    onPick={(pct) => {
                      setTipDraftPct(pct);
                      void applyTip(round2((baseTotal * pct) / 100)); // auto-aplica y cierra
                    }}
                  />

                  <div className="mt-4 space-y-2">
                    <button
                      onClick={() => void applyTip(draftAmount)}
                      disabled={loadingSetup}
                      className="w-full bg-linear-to-r from-[#FF2E93] to-[#E91E63] text-white font-black text-sm py-3.5 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-50"
                    >
                      {applyLabel}
                    </button>
                    {tipAmount > 0 && (
                      <button
                        onClick={() => void applyTip(0)}
                        className="w-full text-[11px] font-bold text-white/30 hover:text-white/60 py-1"
                      >
                        Quitar propina
                      </button>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        }
      >
        {step === 'pay' && (
          <div className="flex-1 flex flex-col min-h-0">

            {/* Pregunta de propina (mediana, con icono) — el pago va debajo */}
            <button
              type="button"
              onClick={() => { setTipDraft(tipAmount); setTipDraftPct(null); setTipOverlay(true); PlatformBridge.hapticFeedback('light'); }}
              className="w-full flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left active:scale-[0.99] transition-transform"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center shrink-0">
                  <HandCoins size={16} className="text-pink-300" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-black text-white leading-tight">
                    {tipAmount > 0 ? `Propina: $${tipAmount.toFixed(2)}` : '¿Dejar propina?'}
                  </span>
                  <span className="block text-[10px] text-white/40 leading-tight mt-0.5">
                    {tipAmount > 0 ? 'Toca para cambiar o quitarla' : '100% opcional · toca para agregar'}
                  </span>
                </span>
              </span>
              <span className="text-[11px] font-black text-pink-300 shrink-0">{tipAmount > 0 ? 'Cambiar' : 'Agregar'} ›</span>
            </button>

            {/* Resumen del total */}
            <div className="flex items-baseline justify-between px-1 pt-3 pb-1">
              <span className="text-[11px] text-white/40">Total a pagar</span>
              <span className="text-[15px] font-black text-white tabular-nums">${grandTotal.toFixed(2)} MXN</span>
            </div>

            {/* ── H15: Pagar con Bunz (cuenta enviada, sin QR) ── */}
            {bunzState && bunzState.canPayWithBunz && step === 'pay' && (
              <div className="rounded-2xl border border-violet-400/30 bg-violet-500/[0.06] p-3 mt-2">
                {bunzConfirm ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-white/70 m-0">Confirma pagar $${bunzState.owed.toFixed(2)} MXN con Bunz · saldo ${bunzState.balance.toFixed(2)}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setBunzConfirm(false); PlatformBridge.hapticFeedback('light'); }}
                        className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-2 text-[11px] font-black text-white/80 cursor-pointer"
                      >Cancelar</button>
                      <button
                        type="button"
                        disabled={bunzBusy}
                        onClick={() => {
                          setBunzBusy(true);
                          void (async () => {
                            try {
                              const headers = await PlatformBridge.getAuthHeaders();
                              const r = await fetch('/api/pay/bunz-pay', {
                                method: 'POST',
                                headers: { ...(headers || {}), 'Content-Type': 'application/json' },
                                body: JSON.stringify({ orderId, tipAmount }),
                              });
                              const d = await r.json().catch(() => null);
                              if (d?.ok) {
                                toast.success(`Cuenta liquidada con Bunz`);
                                PlatformBridge.hapticFeedback('success');
                                setStep('done');
                              } else {
                                toast.error(String(d?.error || 'No se pudo pagar con Bunz').slice(0, 140));
                              }
                            } catch (e: unknown) {
                              toast.error(String((e as Error)?.message || 'Error al pagar con Bunz').slice(0, 140));
                            } finally {
                              setBunzBusy(false);
                              setBunzConfirm(false);
                            }
                          })();
                        }}
                        className="flex-1 rounded-xl bg-violet-500 hover:bg-violet-400 py-2 text-[11px] font-black text-white cursor-pointer disabled:opacity-40"
                      >{bunzBusy ? 'Procesando…' : 'Confirmar pago Bunz'}</button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setBunzConfirm(true); PlatformBridge.hapticFeedback('light'); }}
                    className="w-full flex items-center justify-between gap-3 rounded-xl border border-violet-400/25 bg-violet-500/[0.04] px-3 py-2.5 text-left active:scale-[0.99] transition-transform cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-400/30 flex items-center justify-center shrink-0">
                        <svg className="h-4 w-4 text-violet-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="12" cy="12" r="10" opacity="0.15"/><path d="M12 3v18M9.5 7.5c0-1 .8-1.8 2.5-1.8s2.5.8 2.5 2c0 1.2-1 1.6-2.5 2s-2.5.8-2.5 2 0.8 2 2.5 2 2.5-.8 2.5-2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-black text-white leading-tight">Pagar con Bunz</span>
                        <span className="block text-[10px] text-white/40 leading-tight mt-0.5">
                          Saldo: ${bunzState.balance.toFixed(2)} Bunz
                        </span>
                      </span>
                    </span>
                    <span className="text-[11px] font-black text-violet-300 shrink-0">Elegir ›</span>
                  </button>
                )}
              </div>
            )}
            {bunzState && !bunzState.canPayWithBunz && bunzState.acceptsBunz && bunzState.balance < bunzState.owed && (
              <p className="text-[10px] text-white/30 px-1 mt-1">Nota: pagar con Bunz requiere saldo suficiente (${bunzState.balance.toFixed(2)} / ${bunzState.owed.toFixed(2)}).</p>
            )}
            {tipAmount > 0 && (
              <p className="text-[10px] text-white/35 px-1 m-0">
                Consumo ${round2(grandTotal - tipAmount).toFixed(2)} + propina ${tipAmount.toFixed(2)}
              </p>
            )}

            {/* Pago */}
            <div className="flex-1 flex flex-col min-h-0 pt-3">
              {setupError && (
                <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium">{setupError}</div>
              )}

              {(loadingSetup || !clientSecret) && !setupError && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-pink-400" />
                  <p className="text-xs text-white/40">Preparando el pago…</p>
                </div>
              )}

              {clientSecret && stripeInstance === 'loading' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-pink-400" />
                  <p className="text-xs text-white/40">Cargando módulo de pago…</p>
                </div>
              )}

              {clientSecret && stripeInstance === null && (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold space-y-3 max-w-sm">
                    <p>No se pudo cargar el módulo de pago (Stripe no respondió — revisa tu conexión).</p>
                    {stripeLoadError && (
                      <p className="text-[10px] font-mono text-red-200/70 break-all">
                        Detalle: {stripeLoadError.slice(0, 160)}
                      </p>
                    )}
                    <button
                      onClick={() => { if (publishableKey) loadStripeInstance(publishableKey); }}
                      className="px-3 py-1.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 font-black text-[11px]"
                    >Reintentar</button>
                  </div>
                </div>
              )}

              {clientSecret && stripeInstance && typeof stripeInstance !== 'string' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <Elements
                    key={clientSecret}
                    stripe={stripeInstance}
                    options={{ clientSecret, appearance: APPEARANCE }}
                  >
                    <InAppPaymentForm
                      intentId={intentId || ''}
                      amountHint={grandTotal}
                      onDone={() => { setStep('done'); onPaid?.(grandTotal); }}
                    />
                  </Elements>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="flex-1 flex flex-col items-center justify-center px-2 py-4">
            {/* Éxito grande — icono custom animado: disco esmeralda con check + conejo Bunz + anillos */}
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: [0.4, 1.09, 1], opacity: 1 }}
              transition={{ type: 'spring', damping: 11, stiffness: 260 }}
              className="relative w-32 h-32 mb-2 flex items-center justify-center shrink-0"
            >
              {/* Anillos expansivos (pulso) */}
              <motion.span
                animate={{ scale: [0.62, 1.85], opacity: [0.8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                className="absolute inset-0 rounded-full border-2 border-emerald-400/40"
              />
              <motion.span
                animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0.06, 0.35] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.28, ease: 'easeInOut' }}
                className="absolute inset-0 rounded-full border border-emerald-400/30"
              />
              {/* Disco principal */}
              <div
                className="relative w-24 h-24 rounded-full flex items-center justify-center"
                style={{
                  background: 'radial-gradient(circle at 32% 26%, rgba(255,255,255,0.18), rgba(16,68,47,0.75) 62%, rgba(4,24,17,0.94))',
                  border: '1px solid rgba(52,211,153,0.5)',
                  boxShadow: '0 0 46px rgba(52,211,153,0.3), inset 0 0 24px rgba(16,185,129,0.18)',
                }}
              >
                {/* Conejo Bunz supervisando su pago */}
                <span className="absolute text-[19px] right-2.5 -top-0.5 select-none" style={{ filter: 'drop-shadow(0 0 6px rgba(52,211,153,0.4))' }}>🐰</span>
                <motion.div
                  initial={{ scale: 0.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.16, type: 'spring', damping: 12, stiffness: 300 }}
                >
                  <CheckCircle2 size={54} strokeWidth={2.6} className="text-emerald-400" />
                </motion.div>
              </div>
            </motion.div>

            <motion.h3
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="m-0 text-2xl font-black text-white leading-tight" style={{ letterSpacing: '-0.5px' }}
            >
              ¡Cuenta liquidada!
            </motion.h3>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-[10.5px] text-white/40 mt-1 mb-2"
            >
              Tu pago y tu cashback Bunz ya están acreditados 🐰
            </motion.p>

            {/* Evaluación — ABAJO y compacta (secundaria, no la estrella del show) */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="w-full max-w-sm mt-1"
            >
              <RatingSheet
                compact
                orderId={orderId || ''}
                businessName={businessName}
                onClose={() => setStep('done')}
                onSubmitted={() => onClose()}
              />
            </motion.div>
          </div>
        )}

      </PaySheetShell>
    </AnimatePresence>
  );
}