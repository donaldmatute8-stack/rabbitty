import { NextResponse } from 'next/server';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || process.env.ADMIN_TELEGRAM_IDS || '798431743';

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const MIN_FILL_TIME_MS = 2500;

const hitsByIp = new Map<string, number[]>();

const CATEGORY_BY_NICHE: Record<string, string> = {
  food: 'Restaurante',
  fitness: 'Gimnasio',
  retail: 'Retail',
  entertainment: 'Entretenimiento',
};

function str(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hitsByIp.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  hitsByIp.set(ip, recent);
  if (hitsByIp.size > 5000) hitsByIp.clear();
  return recent.length > RATE_LIMIT_MAX;
}

async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  if (!query || slug(query) === 'por-confirmar') return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'RabbittyLanding/1.0 (contacto@rabbitty.me)' },
      signal: AbortSignal.timeout(4000),
    });
    const json = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (Array.isArray(json) && json[0]) {
      const lat = parseFloat(json[0].lat);
      const lng = parseFloat(json[0].lon ?? json[0].lat);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  } catch {
    // Geocoding is best-effort; fall through to null.
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const data = (await req.json()) as Record<string, unknown>;

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    if (str(data.website)) {
      return NextResponse.json({ ok: true });
    }

    const submittedAt = Number(data._ts);
    if (Number.isFinite(submittedAt) && Date.now() - submittedAt < MIN_FILL_TIME_MS) {
      return NextResponse.json({ ok: true, spam: true });
    }

    if (isRateLimited(ip)) {
      return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
    }

    const negocio = str(data.negocio);
    const telefono = str(data.telefono);
    const email = str(data.email);
    const nombre = str(data.nombre);
    const ubicacion = str(data.ubicacion);

    const fields: Record<string, string> = {};
    if (negocio.length < 2) fields.negocio = 'required';
    if (!isValidPhone(telefono) && !isValidEmail(email)) {
      fields.contacto = 'requiere un teléfono o correo válido';
    }
    if (email && !isValidEmail(email)) fields.email = 'invalid';
    if (telefono && !isValidPhone(telefono)) fields.telefono = 'invalid';

    if (Object.keys(fields).length > 0) {
      console.warn('[Landing Apply] Validación fallida:', fields);
      return NextResponse.json({ ok: false, error: 'validation_failed', fields }, { status: 400 });
    }

    const nicheId = str(data.nicheId) || slug(str(data.tipo)) || 'other';
    const nicheName = str(data.nicheName) || str(data.tipo) || 'Sin nicho';
    const billingPeriod = str(data.billingPeriod) === 'monthly' ? 'monthly' : 'yearly';
    const packageCode = str(data.packageCode) || slug(str(data.paquete)) || 'custom';
    const packageName = str(data.packageName) || str(data.paquete) || 'Personalizado';
    const setupBunz = Number(data.setupBunz) || null;
    const initialVaultBunz = Number(data.initialVaultBunz) || null;
    const category = CATEGORY_BY_NICHE[nicheId] || str(data.tipo) || 'Otro';

    const msg = `🆕 *Nueva solicitud negocio Rabbitty*\n\n` +
      `🏪 *Negocio:* ${negocio || 'N/A'}\n` +
      `📦 *Paquete:* ${str(data.paquete) || packageCode} (${packageCode})\n` +
      `🔄 *Periodicidad:* ${billingPeriod === 'yearly' ? 'Anual (-20% Ahorro)' : 'Mensual'}\n` +
      `📂 *Nicho:* ${nicheName} (${nicheId})\n` +
      `👤 *Contacto:* ${nombre || 'N/A'}\n` +
      `📱 *Teléfono:* ${telefono || 'N/A'}\n` +
      `✉️ *Email:* ${email || 'N/A'}\n` +
      `📍 *Ubicación:* ${ubicacion || 'N/A'}\n` +
      `🔍 *Cómo supo:* ${str(data.como_supo) || 'N/A'}\n` +
      `📊 *UTM:* ${str(data.utm_source) || 'directo'}\n` +
      `💬 *Mensaje:* ${str(data.mensaje) || 'N/A'}`;

    let telegramSent = false;
    if (BOT_TOKEN) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode: 'Markdown' }),
        });
        const result = await res.json();
        telegramSent = Boolean(result?.ok);
        if (!telegramSent) console.error('[Landing Apply] Telegram respondió sin ok:', result);
      } catch (e) {
        console.error('[Landing Apply] Error enviando a Telegram:', e);
      }
    } else {
      console.error('[Landing Apply] TELEGRAM_BOT_TOKEN no configurado');
    }

    let geoSource: 'browser' | 'geocoded' | 'fallback' = 'fallback';
    let lat = Number(data.lat);
    let lng = Number(data.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
      geoSource = 'browser';
    } else {
      const geo = await geocode(ubicacion);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
        geoSource = 'geocoded';
      } else {
        lat = 19.4326;
        lng = -99.1332;
        geoSource = 'fallback';
      }
    }

    const normalized = {
      source: 'landing',
      submittedAt: new Date().toISOString(),
      nicheId,
      nicheName,
      packageCode,
      packageName,
      billingPeriod,
      setupBunz,
      initialVaultBunz,
      monthlyBunz: 5000,
      annualBunz: 48000,
      geoSource,
      geoNeedsReview: geoSource === 'fallback',
      utm: {
        source: str(data.utm_source) || null,
        medium: str(data.utm_medium) || null,
        campaign: str(data.utm_campaign) || null,
        content: str(data.utm_content) || null,
        term: str(data.utm_term) || null,
      },
      referrer: str(data.referrer) || null,
      comoSupo: str(data.como_supo) || null,
      raw: data,
    };

    let persisted = false;
    let newBusinessId = '';
    const dbUrl = process.env.CORE_DATABASE_URL;
    if (dbUrl) {
      try {
        const postgres = (await import('postgres')).default;
        const sql = postgres(dbUrl, { ssl: 'require', max: 1 });

        const sysUser = await sql`
          INSERT INTO "users" (id, "telegramId", "firstName", "lastName", "role")
          VALUES (gen_random_uuid(), 'WEB_FORM_SYS', 'Aspirante', '(Web)', 'USER')
          ON CONFLICT ("telegramId") DO UPDATE SET "firstName" = 'Aspirante'
          RETURNING id
        `;
        const placeholderOwnerId = sysUser[0].id;

        const existing = await sql`
          SELECT id FROM "ownedBusinesses" WHERE name = ${negocio || 'Nuevo Negocio'} LIMIT 1
        `;

        if (existing.length === 0) {
          const inserted = await sql`
            INSERT INTO "ownedBusinesses" (
              id, "ownerId", name, category, package, description, address, lat, lng,
              "rewardPercentage", status, "verificationMethod", "verificationData", "createdAt", "updatedAt"
            ) VALUES (
              gen_random_uuid(),
              ${placeholderOwnerId},
              ${negocio},
              ${category},
              ${packageCode},
              ${str(data.mensaje) || `Solicitud ${packageName || packageCode} (${billingPeriod}) desde landing`},
              ${ubicacion || 'Por confirmar'},
              ${lat},
              ${lng},
              10,
              'PENDING',
              'web_form',
              ${JSON.stringify(normalized)},
              NOW(),
              NOW()
            ) RETURNING id
          `;

          if (inserted.length > 0) {
            newBusinessId = inserted[0].id;
            persisted = true;
            console.log('[Landing Apply] Negocio insertado en DB:', newBusinessId);
          }
        } else {
          newBusinessId = existing[0].id;
          persisted = true;
          console.log('[Landing Apply] Negocio ya existe en DB:', negocio);
        }

        await sql.end();
      } catch (dbErr) {
        console.error('[Landing Apply] Error insertando en Neon DB:', dbErr);
      }
    } else {
      console.error('[Landing Apply] CORE_DATABASE_URL no configurada');
    }

    let emailed = false;
    if (email && process.env.RESEND_API_KEY) {
      try {
        const businessName = negocio || 'Tu negocio';
        const applicantName = nombre || 'Emprendedor';
        const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'Rabbittyme_bot';
        const magicLink = newBusinessId
          ? `https://t.me/${botUsername}/app?startapp=claim_${newBusinessId.replace(/-/g, '')}`
          : `https://t.me/${botUsername}/app`;

        const emailHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 20px; background-color: #05020A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #FFFFFF;">
              <div style="max-width: 580px; margin: 0 auto; background: linear-gradient(180deg, #130725 0%, #0A0314 100%); border-radius: 28px; border: 1px solid rgba(244, 63, 94, 0.35); overflow: hidden; box-shadow: 0 0 50px rgba(233, 30, 99, 0.25);">
                <div style="background: linear-gradient(135deg, rgba(244, 63, 94, 0.15), rgba(168, 85, 247, 0.15)); padding: 32px 24px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                  <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #F43F5E;">¡Solicitud Recibida!</h1>
                  <p style="margin: 6px 0 0 0; font-size: 13px; color: #C084FC;">${businessName}</p>
                </div>
                <div style="padding: 32px 28px;">
                  <div style="background: rgba(255,255,255,0.03); border-radius: 18px; padding: 22px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.08);">
                    <p style="font-size: 15px; line-height: 1.6; color: #E2E8F0; margin: 0 0 12px 0;">
                      Hola <strong>${applicantName}</strong>,
                    </p>
                    <p style="font-size: 14px; line-height: 1.6; color: #CBD5E1; margin: 0 0 12px 0;">
                      Hemos recibido tu registro para incorporar a <strong>${businessName}</strong> a la red oficial de comercios afiliados de Rabbitty.
                    </p>
                    <p style="font-size: 14px; line-height: 1.6; color: #CBD5E1; margin: 0;">
                      ⏱️ <strong>Tiempo estimado de revisión:</strong> Entre 2 y 24 horas. Nuestro equipo validará los datos de tu ubicación y la tasa de recompensas propuesta.
                    </p>
                  </div>
                  <div style="background: linear-gradient(135deg, rgba(244,63,94,0.12), rgba(168,85,247,0.12)); border-radius: 18px; padding: 20px; text-align: center; margin-bottom: 24px; border: 1px solid rgba(244,63,94,0.25);">
                    <h3 style="margin: 0 0 8px 0; color: #FFF; font-size: 16px; font-weight: 800;">🔗 Vincula tu Negocio Ahora</h3>
                    <p style="margin: 0 0 16px 0; color: #E2E8F0; font-size: 13px; line-height: 1.5;">Haz clic en el siguiente botón para abrir Telegram, acceder a tu Panel de Comercio y completar tu perfil mientras revisamos tu solicitud.</p>
                    <a href="${magicLink}" style="display: inline-block; background: #F43F5E; color: #FFF; font-weight: 800; font-size: 14px; padding: 14px 28px; border-radius: 12px; text-decoration: none; box-shadow: 0 0 15px rgba(244,63,94,0.4);">Vincular con Telegram 🚀</a>
                  </div>
                </div>
                <div style="background: rgba(0, 0, 0, 0.4); padding: 24px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.06); font-size: 11px; color: #94A3B8;">
                  <p style="margin: 0 0 10px 0; font-weight: 700; color: #CBD5E1;">Rabbitty Inc. — Red de Fidelización y Economía Bunz</p>
                  <p style="margin: 0 0 14px 0; color: #64748B;">¿Tienes dudas? Responde directamente a este correo o háblanos por Telegram.</p>
                  <div style="margin-bottom: 12px;">
                    <a href="https://rabbitty.me" style="color: #F43F5E; text-decoration: none; margin: 0 10px; font-weight: 700;">Sitio Web</a> ·
                    <a href="https://t.me/Rabbittyme_bot/app" style="color: #F43F5E; text-decoration: none; margin: 0 10px; font-weight: 700;">MiniApp Telegram</a> ·
                    <a href="${magicLink}" style="color: #F43F5E; text-decoration: none; margin: 0 10px; font-weight: 700;">Portal Comercio</a>
                  </div>
                  <p style="margin: 0; color: #475569; font-size: 10px;">Recibiste este mensaje transaccional como comercio/usuario registrado en Rabbitty.</p>
                </div>
              </div>
            </body>
          </html>
        `;

        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Rabbitty Team <hola@rabbitty.me>',
            to: [email],
            subject: `🐰 Recibimos tu solicitud para ${businessName}`,
            html: emailHtml,
          }),
        });
        emailed = emailRes.ok;
      } catch (e) {
        console.error('[Landing Apply] Resend email send error:', e);
      }
    }

    const ok = telegramSent || persisted;
    if (!ok) {
      console.error('[Landing Apply] Solicitud NO registrada en ningún canal', { negocio, email });
    }

    return NextResponse.json({
      ok,
      persisted,
      telegramSent,
      emailed,
      newBusinessId: newBusinessId || null,
    });
  } catch (error) {
    console.error('[Landing Apply] Internal Error:', error);
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
