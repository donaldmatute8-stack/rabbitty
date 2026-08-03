import { NextResponse } from 'next/server';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || process.env.ADMIN_TELEGRAM_IDS || '798431743';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    console.log('[Landing Apply] New form submission received:', data);

    const msg = `🆕 *Nueva solicitud negocio Rabbitty*\n\n` +
      `🏪 *Negocio:* ${data.negocio || 'N/A'}\n` +
      `📂 *Tipo:* ${data.tipo || 'N/A'}\n` +
      `👤 *Contacto:* ${data.nombre || 'N/A'}\n` +
      `📱 *Tel:* ${data.telefono || 'N/A'}\n` +
      `✉️ *Email:* ${data.email || 'N/A'}\n` +
      `📍 *Ubicación:* ${data.ubicacion || 'N/A'}\n` +
      `🔍 *Cómo supo:* ${data.como_supo || 'N/A'}\n` +
      `💬 *Mensaje:* ${data.mensaje || 'N/A'}`;

    if (!BOT_TOKEN) {
      console.error('[Landing Apply] TELEGRAM_BOT_TOKEN not configured on Vercel');
      return NextResponse.json({ ok: false, error: 'Telegram bot not configured' }, { status: 200 });
    }

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode: 'Markdown' }),
    });

    const result = await res.json();
    console.log('[Landing Apply] Telegram response:', result);

    let newBusinessId = '';
    // Insertar la solicitud directamente en Neon DB (CORE_DATABASE_URL debe estar en Vercel)
    const dbUrl = process.env.CORE_DATABASE_URL;
    if (dbUrl) {
      try {
        const postgres = (await import('postgres')).default;
        const sql = postgres(dbUrl, { ssl: 'require', max: 1 });

        // Check if already exists by name
        const existing = await sql`
          SELECT id FROM "ownedBusinesses" WHERE name = ${data.negocio || 'Nuevo Negocio'} LIMIT 1
        `;

        if (existing.length === 0) {
          const inserted = await sql`
            INSERT INTO "ownedBusinesses" (
              id, "ownerId", name, category, description, address, lat, lng,
              "rewardPercentage", status, "verificationMethod", "verificationData", "createdAt", "updatedAt"
            ) VALUES (
              gen_random_uuid(),
              'f7178385-0010-4000-8000-000000000001',
              ${data.negocio || 'Nuevo Negocio'},
              ${data.tipo || 'Restaurante'},
              ${data.mensaje || 'Solicitud de afiliación desde rabbitty.me'},
              ${data.ubicacion || 'Por confirmar'},
              19.4326,
              -99.1332,
              10,
              'PENDING',
              'web_form',
              ${JSON.stringify(data)},
              NOW(),
              NOW()
            ) RETURNING id
          `;
          
          if (inserted.length > 0) {
            newBusinessId = inserted[0].id;
            console.log('[Landing Apply] Negocio insertado en DB con ID:', newBusinessId);
          }
        } else {
          console.log('[Landing Apply] Negocio ya existe en DB:', data.negocio);
          newBusinessId = existing[0].id;
        }

        await sql.end();
      } catch (dbErr) {
        console.error('[Landing Apply] Error insertando en Neon DB:', dbErr);
      }
    } else {
      console.warn('[Landing Apply] CORE_DATABASE_URL no configurada en Vercel');
    }

    // Disparar correo de confirmación de recepción al usuario si proporcionó email
    if (data.email) {
      const apiKey = process.env.RESEND_API_KEY;
      if (apiKey) {
        try {
          const businessName = data.negocio || 'Tu negocio';
          const applicantName = data.nombre || 'Emprendedor';
          
          // Generar Magic Link
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
                  
                  <!-- HEADER CON LOGO OFICIAL CONEJO NEÓN -->
                  <div style="background: linear-gradient(135deg, rgba(244, 63, 94, 0.15), rgba(168, 85, 247, 0.15)); padding: 32px 24px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
                    <div style="display: inline-block; width: 68px; height: 68px; background: #0A0314; border-radius: 22px; border: 1.5px solid #F43F5E; text-align: center; margin-bottom: 12px; box-shadow: 0 0 25px rgba(244, 63, 94, 0.45); overflow: hidden; padding: 6px;">
                      <img src="https://rabbitty.me/logo_conejo.png" alt="Rabbitty Logo" style="width: 100%; height: 100%; object-fit: contain; display: block;" />
                    </div>
                    <h2 style="margin: 0; font-size: 13px; font-weight: 900; letter-spacing: 0.35em; color: #FFFFFF; text-transform: uppercase;">RABBITTY PROTOCOL</h2>
                    <h1 style="margin: 8px 0 0 0; font-size: 22px; font-weight: 800; color: #F43F5E;">¡Solicitud Recibida!</h1>
                    <p style="margin: 6px 0 0 0; font-size: 13px; color: #C084FC;">\${businessName}</p>
                  </div>

                  <!-- CUERPO PRINCIPAL -->
                  <div style="padding: 32px 28px;">
                    <div style="background: rgba(255,255,255,0.03); border-radius: 18px; padding: 22px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.08);">
                      <p style="font-size: 15px; line-height: 1.6; color: #E2E8F0; margin: 0 0 12px 0;">
                        Hola <strong>\${applicantName}</strong>,
                      </p>
                      <p style="font-size: 14px; line-height: 1.6; color: #CBD5E1; margin: 0 0 12px 0;">
                        Hemos recibido tu registro para incorporar a <strong>\${businessName}</strong> a la red oficial de comercios afiliados de Rabbitty.
                      </p>
                      <p style="font-size: 14px; line-height: 1.6; color: #CBD5E1; margin: 0;">
                        ⏱️ <strong>Tiempo estimado de revisión:</strong> Entre 2 y 24 horas. Nuestro equipo validará los datos de tu ubicación y la tasa de recompensas propuesta.
                      </p>
                    </div>

                    <div style="background: linear-gradient(135deg, rgba(244,63,94,0.12), rgba(168,85,247,0.12)); border-radius: 18px; padding: 20px; text-align: center; margin-bottom: 24px; border: 1px solid rgba(244,63,94,0.25);">
                      <h3 style="margin: 0 0 8px 0; color: #FFF; font-size: 16px; font-weight: 800;">🔗 Vincula tu Negocio Ahora</h3>
                      <p style="margin: 0 0 16px 0; color: #E2E8F0; font-size: 13px; line-height: 1.5;">Haz clic en el siguiente botón para abrir Telegram, acceder a tu Panel de Comercio y completar tu perfil mientras revisamos tu solicitud.</p>
                      <a href="\${magicLink}" style="display: inline-block; background: #F43F5E; color: #FFF; font-weight: 800; font-size: 14px; padding: 14px 28px; border-radius: 12px; text-decoration: none; box-shadow: 0 0 15px rgba(244,63,94,0.4);">Vincular con Telegram 🚀</a>
                    </div>
                  </div>

                  <!-- FOOTER INSTITUCIONAL -->
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

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Rabbitty Team <hola@rabbitty.me>',
              to: [data.email],
              subject: `🐰 Recibimos tu solicitud para ${businessName}`,
              html: emailHtml,
            }),
          });
        } catch (e) {
          console.error('[Landing Apply] Resend email send error:', e);
        }
      }
    }

    return NextResponse.json({ ok: result.ok, telegramResult: result });
  } catch (error) {
    console.error('[Landing Apply] Internal Error:', error);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 200 });
  }
}
