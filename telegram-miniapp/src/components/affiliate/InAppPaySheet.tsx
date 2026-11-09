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
import { CheckCircle2, CreditCard, Loader2, HandCoins, X, Wallet, Banknote, ChevronRight } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import { toast } from '@rabbitty/ui';
import PaySheetShell from '@/components/ui/pay/PaySheetShell';
import AmountHero from '@/components/ui/pay/AmountHero';
import TipPills from '@/components/ui/pay/TipPills';
import SwipeAction from '@/components/ui/pay/SwipeAction';
import RatingSheet from '@/components/affiliate/RatingSheet';

interface PayReceiptPayment {
  id: string;
  method: string;
  verificationMethod?: string | null;
  amount: number;
  tipAmount?: number;
  createdAt?: string | null;
}

interface PayReceipt {
  settled: boolean;
  paid?: number;
  businessName?: string | null;
  branchName?: string | null;
  order?: {
    id: string;
    status: string;
    total: number;
    tip?: number;
    bunzPaid?: number;
    createdAt?: string | null;
  };
  payments: PayReceiptPayment[];
  items: { id: string; name: string; quantity: number; totalPrice: number }[];
}

/** Etiqueta legible por método de pago (incluye Mercado Pago vía verificación). */
function paymentMethodLabel(method: string, verification?: string | null) {
  const m = String(method || '').toUpperCase();
  if (m === 'BUNZ') return { label: 'Bunz', icon: '🐰' };
  if (String(verification || '').includes('MERCADO_PAGO')) return { label: 'Mercado Pago', icon: '💙' };
  if (m === 'CASH') return { label: 'Efectivo', icon: '💵' };
  if (m.includes('CARD')) return { label: 'Tarjeta / Apple Pay', icon: '💳' };
  return { label: method || 'Pago', icon: '💳' };
}

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

/** Tarjeta de método de pago (glass): selección clara, área grande. */
function PayMethodCard({
  tone,
  icon,
  title,
  subtitle,
  trailing,
  selected,
  onClick,
}: {
  tone: 'violet' | 'pink' | 'sky' | 'slate';
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  trailing?: string;
  selected: boolean;
  onClick: () => void;
}) {
  const tones = {
    violet: { box: 'bg-violet-500/20 border-violet-400/30', text: 'text-violet-200', glow: 'shadow-[0_18px_50px_-32px_rgba(139,92,246,0.95)]' },
    pink: { box: 'bg-pink-500/20 border-pink-400/30', text: 'text-pink-200', glow: 'shadow-[0_18px_50px_-32px_rgba(233,30,99,0.95)]' },
    sky: { box: 'bg-sky-500/20 border-sky-400/30', text: 'text-sky-200', glow: 'shadow-[0_18px_50px_-32px_rgba(14,165,233,0.95)]' },
    slate: { box: 'bg-white/10 border-white/15', text: 'text-white/70', glow: '' },
  } as const;
  const t = tones[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border px-3.5 py-3 backdrop-blur-xl transition-all text-left flex items-center gap-3 ${
        selected
          ? `border-white/30 bg-white/[0.11] ${t.glow}`
          : 'border-white/[0.08] bg-white/[0.04] active:scale-[0.99]'
      }`}
    >
      <span className={`h-11 w-11 rounded-2xl border flex items-center justify-center shrink-0 ${t.box} ${t.text}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-black text-white leading-tight">{title}</span>
        <span className="block text-[11px] text-white/45 leading-tight mt-0.5 truncate">{subtitle}</span>
      </span>
      {trailing && (
        <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[8.5px] font-black uppercase tracking-wider text-white/70">
          {trailing}
        </span>
      )}
      <ChevronRight size={16} className={selected ? 'text-white' : 'text-white/25'} />
    </button>
  );
}

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
  const [step, setStep] = useState<'pay' | 'done' | 'settled'>('pay');
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
  // El tenant no tiene Stripe Connect listo: ocultamos tarjeta y dejamos Bunz/caja.
  const [cardUnavailable, setCardUnavailable] = useState(false);
  // ── Selección de método (glass) ──
  type PayMethod = 'bunz' | 'card' | 'mp' | 'cash';
  const [method, setMethod] = useState<PayMethod>('card');
  const methodTouchedRef = useRef(false);
  // ── Mercado Pago (Checkout Pro) ──
  const [mpAvailable, setMpAvailable] = useState(false);
  const [mpMode, setMpMode] = useState<'test' | 'live'>('live');
  const [mpBusy, setMpBusy] = useState(false);
  const [mpLink, setMpLink] = useState<string | null>(null);
  const [mpMessage, setMpMessage] = useState<string | null>(null);
  // ── Comprobante/estado de la cuenta: si ya está liquidada no se vuelve a cobrar ──
  const [receipt, setReceipt] = useState<PayReceipt | null>(null);
  const [receiptChecked, setReceiptChecked] = useState(false);
  const [resolvedBusiness, setResolvedBusiness] = useState<string | null>(null);
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
      setMethod('card');
      methodTouchedRef.current = false;
      setMpLink(null);
      setMpMessage(null);
      setMpBusy(false);
      setReceipt(null);
      setReceiptChecked(false);
      setResolvedBusiness(null);
    }
  }, [isOpen, total]);

  // ── Estado real de la cuenta: si YA está liquidada mostramos el detalle ──
  useEffect(() => {
    if (!isOpen || !orderId) return;
    let alive = true;
    setReceiptChecked(false);
    setReceipt(null); // evita reusar el comprobante de otra orden
    (async () => {
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const r = await fetch(`/api/pay/receipt?orderId=${encodeURIComponent(orderId)}`, {
          cache: 'no-store',
          headers: headers || {},
        });
        const d = await r.json().catch(() => null);
        if (!alive) return;
        if (d?.ok) {
          setReceipt(d as PayReceipt);
          if (d.businessName) setResolvedBusiness(String(d.businessName));
          if (d.settled) setStep('settled');
        }
      } catch { /* si falla, el flujo normal de pago sigue disponible */ }
      finally {
        if (alive) setReceiptChecked(true);
      }
    })();
    return () => { alive = false; };
  }, [isOpen, orderId]);

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
          if (Number(d.total) > 0) setAmountTotalExtra(Number(d.total));
          if (d.businessName) setResolvedBusiness(String(d.businessName));
          // Preferencia natural: si puede pagar todo con Bunz, ese es el método.
          if (d.canPayWithBunz && !methodTouchedRef.current) setMethod('bunz');
        } else if (alive && d && !d.ok && d.status === 409) {
          // cuenta ya liquidada — sin UI de bunz
          setBunzState({ balance: 0, owed: 0, acceptsBunz: false, canPayWithBunz: false, total: 0 });
        }
      } catch { /* silencioso */ }
    })();
    return () => { alive = false; };
  }, [isOpen, orderId]);

  // ── Mercado Pago: disponibilidad por sucursal (sin credenciales) ──
  useEffect(() => {
    if (!isOpen || !orderId) return;
    let alive = true;
    (async () => {
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const r = await fetch(`/api/pay/mercadopago?orderId=${encodeURIComponent(orderId)}`, {
          cache: 'no-store',
          headers: headers || {},
        });
        const d = await r.json().catch(() => null);
        if (alive && d?.ok) {
          setMpAvailable(Boolean(d.available));
          setMpMode(d.mode === 'test' ? 'test' : 'live');
        }
      } catch { /* silencioso: MP es opcional */ }
    })();
    return () => { alive = false; };
  }, [isOpen, orderId]);

  // Si Stripe no está listo y el método elegido era tarjeta, movemos al usuario
  // a Bunz o caja para que nunca quede en una pantalla muerta.
  useEffect(() => {
    if (!cardUnavailable) return;
    if (method !== 'card') return;
    setMethod(bunzState?.canPayWithBunz ? 'bunz' : 'cash');
  }, [cardUnavailable, method, bunzState?.canPayWithBunz]);

  // Si Bunz deja de cubrir la cuenta (pago parcial), no dejamos un panel vacío.
  useEffect(() => {
    if (method !== 'bunz') return;
    if (!bunzState || bunzState.canPayWithBunz) return;
    setMethod(mpAvailable ? 'mp' : cardUnavailable ? 'cash' : 'card');
  }, [method, bunzState, mpAvailable, cardUnavailable]);

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
    setCardUnavailable(false);
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
      if (data?.code === 'TENANT_STRIPE_NOT_READY') {
        setCardUnavailable(true);
        setSetupError(null);
        setClientSecret(null);
        return;
      }
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
    // Espera al comprobante: si la cuenta ya está liquidada no se crea intent.
    if (!receiptChecked || receipt?.settled) return;
    if (isOpen && orderId && !clientSecret && !loadingSetup) {
      void startPayment(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, orderId, clientSecret, receiptChecked, receipt?.settled]);

  // Aplica una propina y reemplaza el intent (no cierra el pago)
  const applyTip = async (amount: number) => {
    setTipOverlay(false);
    if (round2(amount) === round2(tipAmount)) return;
    await startPayment(round2(amount), intentId);
  };

  /** Crea el checkout de Mercado Pago y lo abre en el navegador seguro. */
  const startMercadoPago = async () => {
    if (!orderId || mpBusy) return;
    setMpBusy(true);
    setMpMessage(null);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const r = await fetch('/api/pay/mercadopago', {
        method: 'POST',
        headers: { ...(headers || {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, tipAmount }),
      });
      const d = await r.json().catch(() => null);
      if (!d?.ok || !d?.initPoint) {
        setMpMessage(String(d?.error || 'No se pudo abrir Mercado Pago'));
        return;
      }
      setMpLink(String(d.initPoint));
      PlatformBridge.hapticFeedback('light');
      await PlatformBridge.openExternalUrl(String(d.initPoint));
    } catch (e: unknown) {
      setMpMessage(String((e as Error)?.message || 'No se pudo abrir Mercado Pago'));
    } finally {
      setMpBusy(false);
    }
  };

  /** "Ya pagué": consulta Mercado Pago y liquida si el cobro fue aprobado. */
  const verifyMercadoPago = async () => {
    if (!orderId || mpBusy) return;
    setMpBusy(true);
    setMpMessage(null);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const r = await fetch('/api/pay/mercadopago', {
        method: 'PATCH',
        headers: { ...(headers || {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const d = await r.json().catch(() => null);
      if (d?.settled) {
        toast.success('✅ Pago confirmado con Mercado Pago');
        PlatformBridge.hapticFeedback('success');
        setStep('done');
        onPaid?.(grandTotal);
        return;
      }
      setMpMessage(
        d?.status === 'pending'
          ? 'Mercado Pago todavía está procesando el pago. Espera unos segundos y vuelve a verificar.'
          : 'Aún no vemos el pago aprobado. Si ya pagaste, espera unos segundos y vuelve a verificar.'
      );
    } catch (e: unknown) {
      setMpMessage(String((e as Error)?.message || 'No se pudo verificar el pago'));
    } finally {
      setMpBusy(false);
    }
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
        subtitle={resolvedBusiness || businessName || 'Tu consumo en el local'}
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
          <div className="flex-1 flex flex-col min-h-0 gap-3">

            {/* ── HERO: monto gigante en tarjeta glass ── */}
            <div className="relative overflow-hidden rounded-[28px] border border-white/12 bg-white/[0.07] backdrop-blur-2xl px-5 py-4 shadow-[0_24px_70px_-30px_rgba(233,30,99,0.65)]">
              <div className="pointer-events-none absolute -top-20 -right-14 h-44 w-44 rounded-full bg-pink-500/25 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-12 h-44 w-44 rounded-full bg-violet-500/25 blur-3xl" />
              <div className="relative">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Total a pagar</p>
                <div className="flex items-end gap-2 mt-0.5">
                  <span className="text-[50px] leading-none font-black text-white tabular-nums tracking-[-2px]">
                    ${grandTotal.toFixed(2)}
                  </span>
                  <span className="text-[12px] font-bold text-white/35 mb-1.5">MXN</span>
                </div>
                {tipAmount > 0 ? (
                  <p className="text-[11px] text-white/45 mt-1">
                    Consumo ${round2(grandTotal - tipAmount).toFixed(2)} + propina ${tipAmount.toFixed(2)}
                  </p>
                ) : (
                  <p className="text-[11px] text-white/45 mt-1">Liquidación segura · confirmación al instante</p>
                )}
              </div>
            </div>

            {/* ── Propina (glass) ── */}
            <button
              type="button"
              onClick={() => { setTipDraft(tipAmount); setTipDraftPct(null); setTipOverlay(true); PlatformBridge.hapticFeedback('light'); }}
              className="w-full flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-xl px-4 py-3 text-left active:scale-[0.99] transition-transform"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span className="w-10 h-10 rounded-2xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center shrink-0">
                  <HandCoins size={17} className="text-pink-300" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-black text-white leading-tight">
                    {tipAmount > 0 ? `Propina: $${tipAmount.toFixed(2)}` : '¿Dejar propina?'}
                  </span>
                  <span className="block text-[10px] text-white/40 leading-tight mt-0.5">
                    {tipAmount > 0 ? 'Toca para cambiar o quitarla' : '100% opcional · va directo al equipo'}
                  </span>
                </span>
              </span>
              <span className="text-[11px] font-black text-pink-300 shrink-0">{tipAmount > 0 ? 'Cambiar' : 'Agregar'} ›</span>
            </button>

            {/* ── Métodos de pago ── */}
            <div className="space-y-2">
              <p className="px-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/30">Cómo quieres pagar</p>

              {bunzState?.canPayWithBunz && (
                <PayMethodCard
                  tone="violet"
                  selected={method === 'bunz'}
                  icon={<Wallet size={18} />}
                  title="Bunz"
                  subtitle={`Saldo ${bunzState.balance.toFixed(2)} · cubre la cuenta`}
                  trailing="Recomendado"
                  onClick={() => { methodTouchedRef.current = true; setMethod('bunz'); PlatformBridge.hapticFeedback('light'); }}
                />
              )}

              {!cardUnavailable && (
                <PayMethodCard
                  tone="pink"
                  selected={method === 'card'}
                  icon={<CreditCard size={18} />}
                  title="Tarjeta · Apple Pay"
                  subtitle="Crédito, débito o wallet"
                  onClick={() => { methodTouchedRef.current = true; setMethod('card'); PlatformBridge.hapticFeedback('light'); }}
                />
              )}

              {mpAvailable && (
                <PayMethodCard
                  tone="sky"
                  selected={method === 'mp'}
                  icon={<span className="text-[11px] font-black tracking-tight">MP</span>}
                  title="Mercado Pago"
                  subtitle={mpMode === 'test' ? 'Modo de prueba del negocio' : 'Saldo, tarjeta o meses sin intereses'}
                  trailing={mpMode === 'test' ? 'TEST' : undefined}
                  onClick={() => { methodTouchedRef.current = true; setMethod('mp'); PlatformBridge.hapticFeedback('light'); }}
                />
              )}

              <PayMethodCard
                tone="slate"
                selected={method === 'cash'}
                icon={<Banknote size={18} />}
                title="Pagar en caja"
                subtitle="El personal registra el cobro en el POS"
                onClick={() => { methodTouchedRef.current = true; setMethod('cash'); PlatformBridge.hapticFeedback('light'); }}
              />
            </div>

            {cardUnavailable && (
              <p className="px-1 text-[10px] text-amber-200/70">
                Los pagos con tarjeta aún no están activos en este negocio.
              </p>
            )}

            {/* ── Panel del método elegido ── */}
            <div className="flex-1 min-h-0 pt-1">

              {method === 'bunz' && bunzState?.canPayWithBunz && (
                <div className="rounded-3xl border border-violet-400/25 bg-violet-500/[0.08] backdrop-blur-xl p-4 shadow-[0_18px_60px_-34px_rgba(139,92,246,0.95)]">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-white/40 font-black">Saldo Bunz</p>
                      <p className="text-[30px] leading-none font-black text-white tabular-nums mt-1">
                        {bunzState.balance.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-widest text-white/40 font-black">A pagar</p>
                      <p className="text-[30px] leading-none font-black text-violet-200 tabular-nums mt-1">
                        ${bunzState.owed.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {bunzConfirm ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-[12px] text-white/60 m-0 leading-relaxed">
                        Se descontarán <span className="font-black text-white">{bunzState.owed.toFixed(2)} Bunz</span> de tu saldo
                        y tu cuenta quedará liquidada al instante.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setBunzConfirm(false); PlatformBridge.hapticFeedback('light'); }}
                          className="flex-1 rounded-2xl border border-white/15 bg-white/[0.05] py-3 text-[12px] font-black text-white/75 active:scale-[0.99]"
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
                                  const remaining = Number(d?.remaining ?? 0);
                                  if (remaining > 0) {
                                    // Pago parcial (política del negocio): no cerramos la cuenta.
                                    toast.info(`Pagaste $${Number(d?.paid ?? 0).toFixed(2)} con Bunz · quedan $${remaining.toFixed(2)}`);
                                    PlatformBridge.hapticFeedback('success');
                                    setBunzState((prev) => (prev ? { ...prev, canPayWithBunz: false } : prev));
                                  } else {
                                    toast.success('Cuenta liquidada con Bunz');
                                    PlatformBridge.hapticFeedback('success');
                                    setStep('done');
                                    onPaid?.(Number(d?.paid ?? grandTotal));
                                  }
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
                          className="flex-1 rounded-2xl bg-violet-500 hover:bg-violet-400 py-3 text-[12px] font-black text-white active:scale-[0.99] disabled:opacity-50"
                        >{bunzBusy ? 'Procesando…' : 'Confirmar pago'}</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setBunzConfirm(true); PlatformBridge.hapticFeedback('light'); }}
                      className="mt-4 w-full rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 py-3.5 text-[14px] font-black text-white shadow-[0_16px_40px_-22px_rgba(139,92,246,0.9)] active:scale-[0.99] transition-transform"
                    >
                      Pagar ${bunzState.owed.toFixed(2)} con Bunz
                    </button>
                  )}

                  {tipAmount > 0 && (
                    <p className="mt-2 text-[10px] text-white/35">
                      La propina de ${tipAmount.toFixed(2)} se cobra aparte (tarjeta o caja).
                    </p>
                  )}
                </div>
              )}

              {method === 'card' && !cardUnavailable && (
                <div className="rounded-3xl border border-white/10 bg-white/[0.05] backdrop-blur-xl p-3.5">
                  {setupError && (
                    <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-[11px] text-red-300 font-semibold">
                      {setupError}
                    </div>
                  )}

                  {(loadingSetup || !clientSecret) && !setupError && (
                    <div className="py-10 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="h-6 w-6 animate-spin text-pink-400" />
                      <p className="text-xs text-white/40">Preparando el pago…</p>
                    </div>
                  )}

                  {clientSecret && stripeInstance === 'loading' && (
                    <div className="py-10 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="h-6 w-6 animate-spin text-pink-400" />
                      <p className="text-xs text-white/40">Cargando módulo de pago…</p>
                    </div>
                  )}

                  {clientSecret && stripeInstance === null && (
                    <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold space-y-3">
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
                  )}

                  {clientSecret && stripeInstance && typeof stripeInstance !== 'string' && (
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
                  )}
                </div>
              )}

              {method === 'mp' && mpAvailable && (
                <div className="rounded-3xl border border-sky-400/25 bg-sky-500/[0.08] backdrop-blur-xl p-4 shadow-[0_18px_60px_-34px_rgba(14,165,233,0.95)]">
                  <div className="flex items-center gap-3">
                    <span className="h-11 w-11 rounded-2xl bg-sky-400/20 border border-sky-300/30 flex items-center justify-center text-sky-100 text-[12px] font-black">MP</span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-black text-white leading-tight m-0">Mercado Pago</p>
                      <p className="text-[11px] text-white/45 leading-tight m-0">
                        {mpMode === 'test' ? 'El negocio está en modo de prueba' : 'Saldo, tarjeta o meses sin intereses'}
                      </p>
                    </div>
                  </div>

                  <p className="text-[12px] text-white/55 mt-3 leading-relaxed m-0">
                    Se abrirá la ventana segura de Mercado Pago. Al terminar, vuelve aquí y toca
                    <span className="font-black text-white"> “Ya pagué”</span> para confirmar tu cuenta.
                  </p>

                  <div className="mt-3 space-y-2">
                    <button
                      type="button"
                      disabled={mpBusy}
                      onClick={() => void startMercadoPago()}
                      className="w-full rounded-2xl bg-linear-to-r from-sky-500 to-cyan-400 py-3.5 text-[14px] font-black text-white shadow-[0_16px_40px_-22px_rgba(14,165,233,0.9)] active:scale-[0.99] transition-transform disabled:opacity-50"
                    >
                      {mpBusy && !mpLink ? 'Abriendo…' : mpLink ? 'Abrir Mercado Pago de nuevo' : 'Continuar con Mercado Pago'}
                    </button>
                    {mpLink && (
                      <button
                        type="button"
                        disabled={mpBusy}
                        onClick={() => void verifyMercadoPago()}
                        className="w-full rounded-2xl border border-sky-300/40 bg-sky-400/10 py-3 text-[12px] font-black text-sky-100 active:scale-[0.99] disabled:opacity-50"
                      >
                        {mpBusy ? 'Verificando…' : 'Ya pagué, verificar'}
                      </button>
                    )}
                  </div>

                  {mpMessage && (
                    <p className="mt-2 text-[11px] text-amber-200/80 leading-relaxed">{mpMessage}</p>
                  )}
                </div>
              )}

              {method === 'cash' && (
                <div className="rounded-3xl border border-white/10 bg-white/[0.05] backdrop-blur-xl p-4">
                  <p className="text-[14px] font-black text-white m-0">Paga en caja</p>
                  <p className="text-[12px] text-white/50 mt-1 leading-relaxed m-0">
                    Tu cuenta queda abierta en el POS. El personal registra el cobro y tu pedido se marca como pagado.
                  </p>
                  <p className="text-[10px] text-white/30 mt-3 m-0">No cierres esta pantalla hasta que te confirmen el cobro.</p>
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
              Tu pago quedó registrado — califica tu experiencia 🐰
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

        {step === 'settled' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pb-4">
            <div className="flex flex-col items-center text-center pt-1">
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 14, stiffness: 260 }}
                className="relative w-20 h-20 rounded-full flex items-center justify-center"
                style={{
                  background: 'radial-gradient(circle at 32% 26%, rgba(255,255,255,0.16), rgba(16,68,47,0.7) 62%, rgba(4,24,17,0.92))',
                  border: '1px solid rgba(52,211,153,0.45)',
                  boxShadow: '0 0 38px rgba(52,211,153,0.25)',
                }}
              >
                <CheckCircle2 size={40} strokeWidth={2.6} className="text-emerald-400" />
              </motion.div>
              <h3 className="m-0 mt-3 text-[24px] font-black text-white leading-tight">Cuenta liquidada</h3>
              <p className="m-0 mt-1 text-[11px] text-white/45 px-6">
                Este pedido ya fue pagado. No necesitas volver a pagar.
              </p>
            </div>

            <div className="mt-4 rounded-3xl border border-white/12 bg-white/[0.06] backdrop-blur-2xl p-4 shadow-[0_24px_70px_-34px_rgba(16,185,129,0.55)]">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="m-0 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Total pagado</p>
                  {receipt?.businessName && (
                    <p className="m-0 mt-0.5 text-[11px] text-white/45">{receipt.businessName}</p>
                  )}
                </div>
                <span className="text-[28px] leading-none font-black text-white tabular-nums">
                  ${Number(receipt?.paid ?? receipt?.order?.total ?? 0).toFixed(2)}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {(receipt?.payments ?? []).map((pay) => {
                  const meta = paymentMethodLabel(pay.method, pay.verificationMethod);
                  return (
                    <div
                      key={pay.id}
                      className="flex items-center justify-between gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5"
                    >
                      <span className="flex items-center gap-2 text-[12px] font-bold text-white/85 min-w-0">
                        <span className="text-[15px]">{meta.icon}</span>
                        <span className="truncate">{meta.label}</span>
                        {Number(pay.tipAmount || 0) > 0 && (
                          <span className="text-[9px] text-white/35 font-semibold">
                            incl. propina ${Number(pay.tipAmount).toFixed(2)}
                          </span>
                        )}
                      </span>
                      <span className="text-[13px] font-black text-white tabular-nums shrink-0">
                        ${Number(pay.amount || 0).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
                {(receipt?.payments?.length ?? 0) === 0 && (
                  <p className="m-0 text-[11px] text-white/45">Pago registrado en caja por el negocio.</p>
                )}
              </div>

              {(receipt?.items?.length ?? 0) > 0 && (
                <>
                  <p className="m-0 mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Detalle</p>
                  <div className="mt-1.5 space-y-1.5">
                    {(receipt?.items ?? []).map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 text-[12px] text-white/60">
                        <span className="truncate">
                          <span className="text-white/40">{item.quantity}×</span> {item.name}
                        </span>
                        <span className="tabular-nums shrink-0">${Number(item.totalPrice || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {Number(receipt?.order?.bunzPaid || 0) > 0 && (
                <p className="m-0 mt-3 text-[10px] font-semibold text-violet-200/75">
                  🐰 Incluye {Number(receipt?.order?.bunzPaid || 0).toFixed(0)} Bunz aplicados a esta cuenta.
                </p>
              )}

              {receipt?.order?.createdAt && (
                <p className="m-0 mt-2 text-[10px] text-white/25">
                  {new Date(receipt.order.createdAt).toLocaleString('es-MX')}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-2xl border border-white/15 bg-white/[0.08] py-3.5 text-[13px] font-black text-white active:scale-[0.99] transition-transform"
            >
              Cerrar
            </button>
          </div>
        )}

      </PaySheetShell>
    </AnimatePresence>
  );
}