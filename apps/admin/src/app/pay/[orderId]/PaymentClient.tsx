"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Button, toast } from "@rabbitty/ui";
import { 
  Sparkles, CheckCircle2, Store, CreditCard, 
  MessageSquareQuote, ShieldCheck, Loader2 
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

// Inicializador del Stripe Promise con la Publishable Key pública
const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

function StripeCheckoutForm({
  clientSecret,
  orderId,
  onSuccess,
}: {
  clientSecret: string;
  orderId: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setErrorMsg(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/pay/${orderId}`,
      },
      redirect: "if_required",
    });

    if (error) {
      setErrorMsg(error.message || "Error al procesar el pago");
      setSubmitting(false);
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      toast.success("¡Pago recibido con éxito!");
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <PaymentElement
          options={{
            layout: "tabs",
            wallets: {
              applePay: "auto",
              googlePay: "auto",
            },
          }}
        />
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium">
          {errorMsg}
        </div>
      )}

      <Button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-black text-sm py-3.5 rounded-xl shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 cursor-pointer"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Confirmando con tu banco...</span>
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4" />
            <span>Pagar con Apple Pay o Tarjeta</span>
          </>
        )}
      </Button>
    </form>
  );
}

export function PaymentClient({ order }: { order: any }) {
  const [notified, setNotified] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<"CARD" | "CASH">("CARD");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);
  const [loadingSecret, setLoadingSecret] = useState(false);

  // tRPC mutations para crear el Payment Intent y obtener el clientSecret de Stripe
  const createIntentMutation = trpc.payments.createPaymentIntent.useMutation();
  const getSecretMutation = trpc.payments.createStripePaymentSecret.useMutation();
  const requestCashMutation = trpc.payments.requestCashPayment.useMutation();

  const handleStartDigitalPayment = async () => {
    try {
      setLoadingSecret(true);
      // 1. Crear o recuperar el intento con el motor de Rabbitty
      const intent = await createIntentMutation.mutateAsync({
        orderId: order.id,
        tipAmount: 0,
        provider: "STRIPE",
      });

      setIntentId(intent.intentId);

      // 2. Obtener el clientSecret de Stripe Connect
      const stripeRes = await getSecretMutation.mutateAsync({
        intentId: intent.intentId,
      });

      setClientSecret(stripeRes.clientSecret);
    } catch (err: any) {
      toast.error(err.message || "Error al inicializar la pasarela de pagos.");
    } finally {
      setLoadingSecret(false);
    }
  };

  if (paymentSuccess) {
    return (
      <Card className="border border-emerald-500/30 bg-emerald-500/10 p-6 text-center backdrop-blur-md rounded-2xl">
        <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
        <h2 className="text-xl font-black text-white">¡Cuenta Liquidada!</h2>
        <p className="text-sm text-gray-300 mt-1">
          Tu pago fue acreditado y la comanda ha sido cerrada en caja. ¡Gracias por tu visita!
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selector de Método de Pago */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 border border-white/10 rounded-2xl">
        <button
          onClick={() => setSelectedMethod("CARD")}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            selectedMethod === "CARD"
              ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md shadow-pink-500/20"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <CreditCard className="h-4 w-4" />
          <span>Tarjeta / Apple Pay</span>
        </button>

        <button
          onClick={() => setSelectedMethod("CASH")}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            selectedMethod === "CASH"
              ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md shadow-pink-500/20"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Store className="h-4 w-4" />
          <span>Efectivo en Caja</span>
        </button>
      </div>

      {/* Opción 1: Tarjeta / Apple Pay con Stripe Elements */}
      {selectedMethod === "CARD" && (
        <Card className="border border-white/10 bg-white/5 p-5 backdrop-blur-md rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-pink-400" />
              <h2 className="font-bold text-white text-base">Pago Seguro en Línea</h2>
            </div>
            <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
              Stripe 256-bit
            </span>
          </div>

          <p className="text-xs text-gray-300 leading-relaxed mb-4">
            Paga directamente sin esperar al mesero. Tu pago liberará la mesa automáticamente en el sistema.
          </p>

          <div className="rounded-xl bg-pink-500/10 border border-pink-500/20 p-3.5 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-pink-400" />
              <span className="text-xs font-bold text-white">Recompensa estimada:</span>
            </div>
            <span className="text-xs font-black text-pink-400">
              +{Math.floor(order.total * 0.20)} Bunz
            </span>
          </div>

          {clientSecret && stripePromise ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: "night",
                  variables: {
                    colorPrimary: "#ec4899",
                    colorBackground: "#09090b",
                    colorText: "#f4f4f5",
                    colorDanger: "#ef4444",
                    borderRadius: "14px",
                  },
                },
              }}
            >
              <StripeCheckoutForm
                clientSecret={clientSecret}
                orderId={order.id}
                onSuccess={() => setPaymentSuccess(true)}
              />
            </Elements>
          ) : (
            <Button
              onClick={handleStartDigitalPayment}
              disabled={loadingSecret}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-black text-xs py-3.5 rounded-xl shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loadingSecret ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Conectando con pasarela segura...</span>
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  <span>Continuar a Cobro Digital</span>
                </>
              )}
            </Button>
          )}
        </Card>
      )}

      {/* Opción 2: Efectivo / Pago Físico */}
      {selectedMethod === "CASH" && (
        <Card className="border border-white/10 bg-white/5 p-5 backdrop-blur-md rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Store className="h-5 w-5 text-pink-400" />
            <h2 className="font-bold text-white text-base">Pago en Establecimiento</h2>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed mb-4">
            Este negocio cobra directamente en su caja o con terminal bancaria física. Muestra esta pantalla o tu número de orden al mesero / cajero para liquidar tu cuenta.
          </p>

          <div className="rounded-xl bg-pink-500/10 border border-pink-500/20 p-3.5 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-pink-400" />
              <span className="text-xs font-bold text-white">Recompensa estimada:</span>
            </div>
            <span className="text-xs font-black text-pink-400">
              +{Math.floor(order.total * 0.20)} Bunz
            </span>
          </div>

          {notified || order.status === "CASH_PAYMENT_REQUESTED" ? (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-400 text-xs font-bold">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Solicitud de efectivo recibida en caja. El mesero se acerca a tu mesa con tu cuenta.</span>
            </div>
          ) : (
            <Button
              onClick={async () => {
                try {
                  await requestCashMutation.mutateAsync({ orderId: order.id });
                  setNotified(true);
                  toast.success("Solicitud de cobro en efectivo enviada al POS");
                } catch (e: any) {
                  toast.error(e.message || "Error al solicitar cuenta");
                }
              }}
              disabled={requestCashMutation.isPending}
              className="w-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs py-3.5 border border-white/10 rounded-xl cursor-pointer flex items-center justify-center gap-2"
            >
              {requestCashMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Notificando a caja...</span>
                </>
              ) : (
                <>
                  <MessageSquareQuote className="h-4 w-4 text-pink-400" />
                  <span>Solicitar cobro en efectivo al mesero</span>
                </>
              )}
            </Button>
          )}
        </Card>
      )}

      <div className="text-center text-[11px] text-gray-500">
        Rabbitty ID: #{order.id.slice(-6).toUpperCase()} · Creado el {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}
