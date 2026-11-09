import crypto from 'crypto';

/**
 * ── Canal interno de pagos (app → admin) ──
 * El Rabbitter se autentica en la app con un Bearer de `webSessions`, que el
 * admin NO reconoce (allí la sesión es cookie de NextAuth). Los pagos que nacen
 * en la app se firman servidor-a-servidor con este secreto y el admin recibe el
 * `userId` ya verificado aquí.
 *
 * El secreto se resuelve en este orden y NUNCA llega al cliente:
 *   1. PAY_INTERNAL_SECRET (dedicado)
 *   2. RATING_INTERNAL_SECRET (secreto interno ya existente)
 *   3. Derivado de CORE_DATABASE_URL (último recurso, mismo algoritmo en ambos lados)
 */
const PAY_INTERNAL_URL = process.env.PAY_INTERNAL_URL || 'https://admin.rabbitty.me/api/internal/pay';

export function internalPaySecret(): string {
  if (process.env.PAY_INTERNAL_SECRET) return process.env.PAY_INTERNAL_SECRET;
  if (process.env.RATING_INTERNAL_SECRET) return process.env.RATING_INTERNAL_SECRET;
  const url = process.env.CORE_DATABASE_URL || process.env.DATABASE_URL || '';
  return url
    ? crypto.createHash('sha256').update(`rabbitty-internal-pay:${url}`).digest('hex')
    : '';
}

export async function callInternalPay(
  input: Record<string, unknown>
): Promise<Record<string, any>> {
  const secret = internalPaySecret();
  if (!secret) throw new Error('Servidor sin secreto interno de pagos configurado');

  const res = await fetch(PAY_INTERNAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-pay-secret': secret },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(25000),
  });
  const json = (await res.json().catch(() => null)) as Record<string, any> | null;
  if (!json) throw new Error(`Pago interno sin respuesta (${res.status})`);
  return json;
}
