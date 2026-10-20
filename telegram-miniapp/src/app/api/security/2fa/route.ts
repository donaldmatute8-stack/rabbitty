import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import {
  buildOtpAuthUrl,
  enabledMethods,
  encryptSecret,
  generateTotpSecret,
  maskEmail,
  maskPhone,
  otpMethods,
  phoneChannel,
  sendChallenge,
  verifySecondFactor,
  type TwoFactorMethod,
} from '@/lib/twoFactor';

const isMethod = (m: unknown): m is TwoFactorMethod => m === 'email' || m === 'phone' || m === 'totp';

async function loadUser(id: string) {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}

export async function GET(req: NextRequest) {
  const caller = await getAuthenticatedUser(req);
  if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const user = await loadUser(caller.id);
  if (!user) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });

  const hasRealEmail = Boolean(user.email && !user.email.endsWith('@phone.rabbitty.me'));
  const channel = phoneChannel(user);
  return NextResponse.json({
    enabled: enabledMethods(user),
    available: {
      email: hasRealEmail ? maskEmail(user.email!) : null,
      phone: channel ? (channel === 'sms' ? maskPhone(user.phoneNumber!) : 'Telegram') : null,
      phoneChannel: channel,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const user = await loadUser(caller.id);
    if (!user) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const { action, method, code } = body as { action?: string; method?: unknown; code?: string };

    /* Enviar código (email / teléfono) */
    if (action === 'challenge') {
      if (method !== 'email' && method !== 'phone') return NextResponse.json({ error: 'Método inválido' }, { status: 400 });
      const purpose = body.purpose === 'enroll' ? 'enroll' : 'action';
      const res = await sendChallenge(user, method, purpose);
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
      return NextResponse.json({ success: true, channel: res.channel, hint: res.hint });
    }

    /* Iniciar alta de app autenticadora (secreto aún no activo) */
    if (action === 'totp_setup') {
      if (user.totpEnabled) return NextResponse.json({ error: 'La app autenticadora ya está activa.' }, { status: 400 });
      const secret = generateTotpSecret();
      await db.update(users).set({ totpSecret: encryptSecret(secret), updatedAt: new Date() }).where(eq(users.id, user.id));
      const account = user.email || (user.username ? `@${user.username}` : user.id);
      return NextResponse.json({ success: true, secret, otpauthUrl: buildOtpAuthUrl(secret, account) });
    }

    /* Activar un método tras verificar un código real */
    if (action === 'enable') {
      if (!isMethod(method) || !code) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
      if (method === 'totp' && !user.totpSecret) return NextResponse.json({ error: 'Primero genera el código QR.' }, { status: 400 });
      if (!(await verifySecondFactor(user, method, code))) {
        return NextResponse.json({ error: 'Código incorrecto o expirado.' }, { status: 400 });
      }
      if (method === 'totp') {
        await db.update(users).set({ totpEnabled: true, updatedAt: new Date() }).where(eq(users.id, user.id));
      } else {
        const next = Array.from(new Set([...otpMethods(user), method]));
        await db.update(users).set({ twoFactorMethods: JSON.stringify(next), updatedAt: new Date() }).where(eq(users.id, user.id));
      }
      return NextResponse.json({ success: true });
    }

    /* Desactivar: requiere un código válido de cualquier método activo */
    if (action === 'disable') {
      const proof = body.proof as { method?: unknown; code?: string } | undefined;
      const active = enabledMethods(user);
      if (!isMethod(method) || !active.includes(method)) return NextResponse.json({ error: 'Método no activo' }, { status: 400 });
      if (!proof || !isMethod(proof.method) || !active.includes(proof.method) || !proof.code) {
        return NextResponse.json({ error: 'Confirma con un código de un método activo.', code: '2FA_REQUIRED', methods: active }, { status: 403 });
      }
      if (!(await verifySecondFactor(user, proof.method, proof.code))) {
        return NextResponse.json({ error: 'Código incorrecto o expirado.' }, { status: 403 });
      }
      if (method === 'totp') {
        await db.update(users).set({ totpEnabled: false, totpSecret: null, updatedAt: new Date() }).where(eq(users.id, user.id));
      } else {
        const next = otpMethods(user).filter((m) => m !== method);
        await db.update(users).set({ twoFactorMethods: JSON.stringify(next), updatedAt: new Date() }).where(eq(users.id, user.id));
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
  } catch (error) {
    console.error('[SECURITY_2FA]', error);
    return NextResponse.json({ error: 'Error en verificación en dos pasos' }, { status: 500 });
  }
}
