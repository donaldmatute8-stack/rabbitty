import { NextResponse } from 'next/server';
import { and, eq, gte, ilike } from 'drizzle-orm';
import { db } from '@/db';
import { nicheRequests, niches } from '@/db/schema';
import { sendEmail } from '@/lib/email';
import {
  getNicheWelcomeEmailTemplate,
  isValidEmail,
  nicheContext,
  normalizeMxPhone,
  sanitizeText,
} from '@/lib/niche-requests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * ── POST /api/niches/request ── captura de un giro que todavía NO cubrimos.
 *
 * Reglas:
 *  · Email y WhatsApp (celular MX) son OBLIGATORIOS. Sin ambos no se registra.
 *  · Si el giro está en el catálogo se usa el nombre oficial; si no, se guarda
 *    el texto que escribió la persona (recortado y sin caracteres de control).
 *  · Se envía un correo de bienvenida inmediato, personalizado por nicho.
 *  · Dedupe de 24 h por email+giro: no se spamea al usuario ni a Resend.
 *  · Anti-abuso: honeypot + límite por IP (mejor esfuerzo en serverless).
 *
 * Este endpoint NO lee datos de ningún tenant: solo escribe la solicitud.
 */

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [key, value] of hits) {
      if (!value.some((t) => now - t < WINDOW_MS)) hits.delete(key);
    }
  }
  return recent.length > MAX_PER_WINDOW;
}

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function bad(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    if (rateLimited(ip)) {
      return bad('Demasiadas solicitudes seguidas. Intenta de nuevo en unos minutos.', 429);
    }

    const length = Number(request.headers.get('content-length') ?? 0);
    if (length > 8_000) return bad('Solicitud demasiado grande.');

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return bad('No pudimos leer la solicitud.');
    }

    // Honeypot: un humano nunca lo llena. Respondemos ok para no dar señales.
    if (typeof body.website === 'string' && body.website.trim()) {
      return NextResponse.json({ success: true, emailSent: false });
    }

    const email = sanitizeText(body.email, 160).toLowerCase();
    if (!isValidEmail(email)) {
      return bad('Necesitamos un correo válido para avisarte.');
    }

    const phone = normalizeMxPhone(sanitizeText(body.phone, 25));
    if (!phone) {
      return bad('Necesitamos un WhatsApp válido a 10 dígitos (México).');
    }

    const providedLabel = sanitizeText(body.nicheLabel, 80);
    const providedId = sanitizeText(body.nicheId, 40).toLowerCase();

    // El nombre oficial del catálogo manda si el giro está registrado (activo o no).
    let nicheId: string | null = providedId || null;
    let nicheLabel = providedLabel;
    if (providedId) {
      const [row] = await db
        .select({ id: niches.id, name: niches.name, isActive: niches.isActive })
        .from(niches)
        .where(eq(niches.id, providedId))
        .limit(1);
      if (row) {
        // Si el giro ya está disponible no es una solicitud: es un error de UI.
        if (row.isActive) {
          return bad('Ese giro ya está disponible. Selecciónalo en la lista.');
        }
        nicheLabel = row.name;
      } else {
        nicheId = null;
      }
    }
    if (!nicheLabel) nicheLabel = nicheContext(nicheId)?.label ?? '';
    if (nicheLabel.length < 2) {
      return bad('Cuéntanos cuál es tu giro (por ejemplo: veterinaria, lavandería…).');
    }

    const businessName = sanitizeText(body.businessName, 80) || null;
    const contactName = sanitizeText(body.contactName, 60) || null;
    const message = sanitizeText(body.message, 500) || null;
    const source = sanitizeText(body.source, 30) || 'onboarding';

    // Dedupe 24 h: misma persona + mismo giro → no se reenvía el correo.
    const since = new Date(Date.now() - 24 * 60 * 60_000);
    const [recent] = await db
      .select({ id: nicheRequests.id })
      .from(nicheRequests)
      .where(
        and(
          eq(nicheRequests.email, email),
          ilike(nicheRequests.nicheLabel, nicheLabel),
          gte(nicheRequests.createdAt, since),
        ),
      )
      .limit(1);

    if (recent) {
      return NextResponse.json({
        success: true,
        alreadyRegistered: true,
        emailSent: false,
        requestId: recent.id,
      });
    }

    const [created] = await db
      .insert(nicheRequests)
      .values({
        niche: nicheId,
        nicheLabel,
        businessName,
        contactName,
        email,
        phone,
        message,
        source,
      })
      .returning({ id: nicheRequests.id });

    if (!created) {
      console.error('[NICHE REQUEST] insert sin fila devuelta');
      return bad('No pudimos registrar tu solicitud. Intenta de nuevo.', 500);
    }

    // Correo inmediato y personalizado por nicho (Resend).
    const html = getNicheWelcomeEmailTemplate({
      contactName,
      nicheLabel,
      nicheId,
      email,
      phone,
      requestId: created.id,
    });
    const sent = await sendEmail({
      to: email,
      subject: `Tu giro ya está en la lista: ${nicheLabel} 🐰`,
      html,
    });

    if (sent.ok) {
      const emailId =
        sent.data && typeof sent.data === 'object' && 'id' in sent.data
          ? String((sent.data as { id?: unknown }).id ?? '')
          : '';
      await db
        .update(nicheRequests)
        .set({ notifiedAt: new Date(), emailId: emailId || null })
        .where(eq(nicheRequests.id, created.id));
    } else {
      console.warn('[NICHE REQUEST] correo no enviado:', nicheLabel, email);
    }

    // Aviso interno al equipo (best-effort). Configura NICHE_TEAM_EMAIL o
    // SUPPORT_EMAIL; si no hay, se omite sin afectar la solicitud.
    const teamEmail = (process.env.NICHE_TEAM_EMAIL || process.env.SUPPORT_EMAIL || '').trim();
    if (teamEmail) {
      try {
        const rows = [
          ['Giro', nicheLabel],
          ['Negocio', businessName || '—'],
          ['Contacto', contactName || '—'],
          ['Correo', email],
          ['WhatsApp', `+${phone}`],
          ['Mensaje', message || '—'],
          ['Fuente', source],
        ]
          .map(([k, v]) => `<tr><td style="padding:4px 8px;color:#6b7280">${k}</td><td style="padding:4px 8px;font-weight:600">${String(v).replace(/</g, '&lt;')}</td></tr>`)
          .join('');
        await sendEmail({
          to: teamEmail,
          subject: `Nueva solicitud de nicho: ${nicheLabel}`,
          html: `<div style="font-family:system-ui,sans-serif;line-height:1.5">
            <h2 style="margin:0 0 8px">Nueva solicitud de nicho</h2>
            <p style="margin:0 0 12px;color:#444">Alguien pidió un giro que aún no cubrimos.</p>
            <table style="border-collapse:collapse">${rows}</table>
            <p style="margin:16px 0 0;font-size:12px;color:#888">Revísala en Admin → Expansión a nichos.</p>
          </div>`,
        });
      } catch (teamErr) {
        console.warn('[NICHE REQUEST] aviso interno falló:', teamErr);
      }
    }

    return NextResponse.json({
      success: true,
      requestId: created.id,
      emailSent: sent.ok,
      nicheLabel,
    });
  } catch (error) {
    console.error('[NICHE REQUEST]', error);
    return bad('No pudimos registrar tu solicitud. Intenta de nuevo.', 500);
  }
}
