import { Resend } from 'resend';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailPayload) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn('[Email Service] RESEND_API_KEY no encontrada. Omitiendo envío de correo a:', to);
    return { ok: false, error: 'RESEND_API_KEY missing' };
  }

  try {
    const resend = new Resend(apiKey);
    
    // Remitente verificado en Resend con dominio de producción rabbitty.me
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'Rabbitty Team <hola@rabbitty.me>';

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error('[Email Service] Error al enviar con Resend:', error);
      return { ok: false, error };
    }

    console.log('[Email Service] Correo enviado exitosamente a:', to, 'ID:', data?.id);
    return { ok: true, data };
  } catch (error) {
    console.error('[Email Service] Excepción al enviar correo:', error);
    return { ok: false, error };
  }
}

// Layout Base de Correo Institucional Rabbitty
export function wrapInRabbittyEmailLayout(title: string, subtitle: string, bodyContent: string) {
  return `
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
              <img src="https://rabbitty.me/logo_conejo.png" alt="Rabbitty Conejo Logo" style="width: 100%; height: 100%; object-fit: contain; display: block;" />
            </div>
            <h2 style="margin: 0; font-size: 13px; font-weight: 900; letter-spacing: 0.35em; color: #FFFFFF; text-transform: uppercase;">RABBITTY PROTOCOL</h2>
            <h1 style="margin: 8px 0 0 0; font-size: 22px; font-weight: 800; color: #F43F5E;">${title}</h1>
            ${subtitle ? `<p style="margin: 6px 0 0 0; font-size: 13px; color: #C084FC;">${subtitle}</p>` : ''}
          </div>

          <!-- CUERPO PRINCIPAL DEL MENSAJE -->
          <div style="padding: 32px 28px;">
            ${bodyContent}
          </div>

          <!-- FOOTER INSTITUCIONAL Y REDES -->
          <div style="background: rgba(0, 0, 0, 0.4); padding: 24px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.06); font-size: 11px; color: #94A3B8;">
            <p style="margin: 0 0 10px 0; font-weight: 700; color: #CBD5E1;">Rabbitty Inc. — Red de Fidelización y Economía Bunz</p>
            <p style="margin: 0 0 14px 0; color: #64748B;">¿Tienes dudas? Responde directamente a este correo o háblanos por Telegram.</p>
            <div style="margin-bottom: 12px;">
              <a href="https://rabbitty.me" style="color: #F43F5E; text-decoration: none; margin: 0 10px; font-weight: 700;">Sitio Web</a> ·
              <a href="https://t.me/Rabbittyme_bot/app" style="color: #F43F5E; text-decoration: none; margin: 0 10px; font-weight: 700;">MiniApp Telegram</a> ·
              <a href="https://admin.rabbitty.me/login" style="color: #F43F5E; text-decoration: none; margin: 0 10px; font-weight: 700;">Portal Comercio</a>
            </div>
            <p style="margin: 0; color: #475569; font-size: 10px;">Recibiste este mensaje transaccional como comercio/usuario registrado en Rabbitty.</p>
          </div>

        </div>
      </body>
    </html>
  `;
}

export function getApplicationReceivedEmailTemplate(businessName: string, applicantName: string) {
  const content = `
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
      <h3 style="margin: 0 0 8px 0; color: #FFF; font-size: 15px; font-weight: 800;">📲 Prepárate con la MiniApp en Telegram</h3>
      <p style="margin: 0 0 16px 0; color: #E2E8F0; font-size: 13px; line-height: 1.5;">Mientras revisamos tu solicitud, conoce cómo funciona la economía Bunz y cómo tus clientes acumularán recompensas.</p>
      <a href="https://t.me/Rabbittyme_bot/app" style="display: inline-block; background: #F43F5E; color: #FFF; font-weight: 800; font-size: 13px; padding: 12px 26px; border-radius: 12px; text-decoration: none; box-shadow: 0 0 15px rgba(244,63,94,0.4);">Abrir Rabbitty en Telegram 🚀</a>
    </div>
  `;
  return wrapInRabbittyEmailLayout(`¡Solicitud Recibida!`, businessName, content);
}

export function getApplicationApprovedEmailTemplate(businessName: string, magicUrl: string) {
  const content = `
    <div style="background: rgba(34,197,94,0.06); border-radius: 18px; padding: 22px; margin-bottom: 24px; border: 1px solid rgba(34,197,94,0.3);">
      <p style="font-size: 15px; line-height: 1.6; color: #E2E8F0; margin: 0 0 12px 0;">
        ¡Tu comercio ha sido verificado con éxito! Ya estás listo para emitir Bunz, activar reservaciones y fidelizar clientes.
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #CBD5E1; margin: 0;">
        Accede a tu panel web mediante tu <strong>Enlace Mágico Único</strong> sin necesidad de recordar contraseñas:
      </p>
    </div>

    <div style="text-align: center; margin-bottom: 28px;">
      <a href="${magicUrl}" style="display: inline-block; background: linear-gradient(135deg, #22C55E, #16A34A); color: #FFF; font-weight: 900; font-size: 15px; padding: 16px 32px; border-radius: 14px; text-decoration: none; box-shadow: 0 0 25px rgba(34,197,94,0.4);">
        🔑 Entrar a Mi Portal de Negocios
      </a>
    </div>

    <div style="background: rgba(255,255,255,0.03); border-radius: 18px; padding: 20px; border: 1px solid rgba(255,255,255,0.08);">
      <h4 style="margin: 0 0 10px 0; color: #FFF; font-size: 14px; font-weight: 800;">💡 Siguientes pasos clave:</h4>
      <ul style="margin: 0; padding-left: 20px; color: #CBD5E1; font-size: 13px; line-height: 1.8;">
        <li>Ajusta tu tasa de recompensa en Bunz por consumo.</li>
        <li>Descarga e imprime tu <strong>Rabbitty Code Neón</strong> para exhibir en tu caja.</li>
        <li>Utiliza nuestro sistema bidireccional desde la PC o tu móvil.</li>
      </ul>
    </div>
  `;
  return wrapInRabbittyEmailLayout(`¡Comercio Aprobado! 🎉`, businessName, content);
}

export function getApplicationRejectedEmailTemplate(businessName: string, reason?: string) {
  const content = `
    <div style="background: rgba(239,68,68,0.06); border-radius: 18px; padding: 22px; margin-bottom: 24px; border: 1px solid rgba(239,68,68,0.3);">
      <p style="font-size: 14px; line-height: 1.6; color: #CBD5E1; margin: 0 0 12px 0;">
        Gracias por tu interés en afiliar <strong>${businessName}</strong> a la red Rabbitty.
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #CBD5E1; margin: 0 0 12px 0;">
        En este momento tu solicitud fue pausada debido a datos incompletos o falta de verificación de ubicación comercial.
      </p>
      ${reason ? `<p style="font-size: 13px; color: #FCA5A5; background: rgba(239,68,68,0.15); padding: 12px; border-radius: 10px; margin: 0;">Detalle: ${reason}</p>` : ''}
    </div>

    <div style="text-align: center;">
      <p style="font-size: 13px; color: #94A3B8; margin-bottom: 16px;">Si deseas corregir tus datos o solicitar una revisión directa:</p>
      <a href="https://t.me/Rabbittyme_bot" style="display: inline-block; background: rgba(255,255,255,0.1); color: #FFF; font-weight: 700; font-size: 13px; padding: 10px 24px; border-radius: 10px; text-decoration: none;">Contactar Soporte Rabbitty</a>
    </div>
  `;
  return wrapInRabbittyEmailLayout(`Actualización de Solicitud`, businessName, content);
}

// Plantilla Drip para Rabbitters (Usuarios Finales) - Día 3: Multiplicadores y Trucos
export function getRabbitterLevelUpEmailTemplate(userName: string, levelName: string, multiplier: number) {
  const content = `
    <div style="background: rgba(168,85,247,0.08); border-radius: 18px; padding: 22px; margin-bottom: 24px; border: 1px solid rgba(168,85,247,0.3);">
      <p style="font-size: 15px; line-height: 1.6; color: #E2E8F0; margin: 0 0 12px 0;">
        Hola <strong>${userName || 'Rabbitter'}</strong>,
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #CBD5E1; margin: 0 0 12px 0;">
        ¿Sabías que cada vez que visitas un negocio afiliado y escaneas tu <strong>Rabbitty Code Neón</strong> acumulas Hops (XP) para subir de nivel?
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #CBD5E1; margin: 0;">
        Tu nivel actual es <strong>${levelName}</strong> y ganas un multiplicador de <strong>x${multiplier} en Bunz</strong> en cada consumo.
      </p>
    </div>

    <div style="text-align: center; margin-bottom: 28px;">
      <a href="https://t.me/Rabbittyme_bot/app" style="display: inline-block; background: linear-gradient(135deg, #EC4899, #8B5CF6); color: #FFF; font-weight: 900; font-size: 15px; padding: 16px 32px; border-radius: 14px; text-decoration: none; box-shadow: 0 0 25px rgba(236,72,153,0.4);">
        🎩 Ver Mis Trucos y Misiones
      </a>
    </div>
  `;
  return wrapInRabbittyEmailLayout(`Multiplica tus Bunz x${multiplier} ⚡`, userName, content);
}

