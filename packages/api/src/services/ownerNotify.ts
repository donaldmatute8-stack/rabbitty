/**
 * ── Notificaciones al afiliado (push + email) ────────────────────────────────
 *
 * Marca RABBITTY. Sin nombres personales. El email sale de hola@rabbitty.me.
 * Si faltan las variables de entorno, devuelve false y no rompe el cron.
 */

export async function sendOwnerPush(
  userId: string,
  title: string,
  message: string,
  route = "/business"
): Promise<boolean> {
  const base = process.env.RABBITTY_MINIAPP_URL;
  const secret = process.env.PUSH_SEND_SECRET;
  if (!base || !secret || !userId) return false;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/notifications/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-push-secret": secret },
      body: JSON.stringify({ userId, title, body: message, data: { type: "AFFILIATE", route } }),
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => ({}))) as { sent?: number };
    return Number(data.sent ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function sendOwnerEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY || process.env.AUTH_RESEND_KEY || process.env.RESEND_KEY;
  if (!key || !to) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Rabbitty <hola@rabbitty.me>",
        to: [to],
        subject,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function readinessEmailHtml({
  businessName,
  missing,
  ready,
  adminUrl,
}: {
  businessName: string;
  missing: string[];
  ready: boolean;
  adminUrl: string;
}): string {
  const title = ready
    ? "Tu negocio está listo para aparecer en Rabbitty"
    : "Completa estos pasos para aparecer en Rabbitty";
  const intro = ready
    ? "Tu negocio ya cumple los pasos mínimos para aparecer en la app y recibir Rabbitters."
    : "Tu negocio ya está en Rabbitty, pero aún le faltan pasos para aparecer en la app y recibir Rabbitters.";
  const list = missing
    .map(
      (m) =>
        `<li style="margin:0 0 6px;color:#CBD5E1;font-size:13px;line-height:1.5">${m}</li>`
    )
    .join("");

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0A0314;padding:24px;color:#fff">
    <div style="max-width:580px;margin:0 auto;background:linear-gradient(180deg,#130725,#0A0314);border:1px solid rgba(244,63,94,0.35);border-radius:24px;overflow:hidden">
      <div style="padding:28px 24px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08)">
        <p style="margin:0;font-size:11px;font-weight:900;letter-spacing:.25em;color:#F43F5E">RABBITTY</p>
        <h1 style="margin:8px 0 0;font-size:22px;color:#fff">${title}</h1>
      </div>
      <div style="padding:26px 24px">
        <p style="margin:0 0 12px;font-size:14px;color:#E2E8F0">Hola, equipo de ${businessName}:</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#CBD5E1">${intro}</p>
        ${
          missing.length
            ? `<div style="background:rgba(244,63,94,0.08);border:1px solid rgba(244,63,94,0.22);border-radius:14px;padding:14px 16px;margin:0 0 18px">
                 <p style="margin:0 0 8px;font-size:11px;font-weight:900;letter-spacing:.12em;color:#F43F5E;text-transform:uppercase">Te falta</p>
                 <ul style="margin:0;padding-left:18px">${list}</ul>
               </div>`
            : ""
        }
        <div style="text-align:center;margin:22px 0 8px">
          <a href="${adminUrl}/settings" style="display:inline-block;background:#E91E63;color:#fff;font-weight:900;font-size:14px;padding:14px 30px;border-radius:14px;text-decoration:none">
            Completar mi negocio
          </a>
        </div>
        <p style="margin:12px 0 0;font-size:12px;color:#94A3B8;text-align:center">
          Si necesitas ayuda, escribe a hola@rabbitty.me.
        </p>
        <p style="margin:16px 0 0;font-size:10px;color:#64748B;text-align:center">
          RABBITTY · MXHUB ECOSISTEMA BLOCKCHAIN, S.A. DE C.V. · RFC MEB2402087Z3
        </p>
      </div>
    </div>
  </div>`;
}
