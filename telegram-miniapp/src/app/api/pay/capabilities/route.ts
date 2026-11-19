import { NextResponse } from 'next/server';
import { getPaymentProvider } from '@rabbitty/api/services/paymentProviders';

export const runtime = 'nodejs';

/**
 * ── GET /api/pay/capabilities ── qué puede pagar el cliente en la app ───────
 *
 * La UI no debe asumir rieles: pregunta capacidades y muestra u oculta cada
 * opción con su motivo. Los tres caminos del pedido desde la app:
 *
 * - **Caja (efectivo):** el pedido nace PENDING_PAYMENT y el POS lo muestra en
 *   "Por cobrar" (badge ámbar). La cocina no lo prepara hasta que se cobre.
 * - **Bunz:** se debita en el checkout y nace PAID; entra a cocina de inmediato.
 * - **Rabbitty Pay (tarjeta):** el pedido se crea y se paga con Stripe
 *   (Payment Element). Si el riel no está configurado, se oculta con motivo.
 *
 * No cobra nada: solo lee el registro de rieles.
 */
export async function GET() {
  const stripe = getPaymentProvider('STRIPE');
  const cardAvailable = Boolean(stripe?.available);

  return NextResponse.json(
    {
      success: true,
      methods: {
        cash: {
          id: 'CASH',
          label: 'Pagar en caja',
          hint: 'Te esperamos en caja. La cocina arranca al cobrar.',
          available: true,
        },
        bunz: {
          id: 'BUNZ',
          label: 'Pagar con Bunz',
          hint: 'Se descuenta de tu saldo al confirmar.',
          available: true,
        },
        card: {
          id: 'CARD',
          label: 'Rabbitty Pay · tarjeta',
          hint: 'Pago seguro con tarjeta desde la app.',
          available: cardAvailable,
          reason: cardAvailable ? null : (stripe?.unavailableReason ?? 'El cobro con tarjeta no está habilitado.'),
        },
      },
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
