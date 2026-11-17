import { sendEmail } from "@/lib/email";
import { LEGAL_DOCS, LEGAL_VERSION } from "@/lib/legal-docs";

/**
 * ── Comprobante de aceptación de documentos ─────────────────────────────────
 *
 * Se envía cuando el usuario acepta Términos, Privacidad y Reglamento de Bunz.
 * No es marketing: es la prueba de quién aceptó qué y cuándo, y sirve al usuario
 * para verificar que nadie aceptó en su nombre.
 *
 * Best-effort: si el correo falla, la aceptación ya quedó registrada en base.
 */
export async function sendConsentReceipt(params: {
  to: string | null | undefined;
  name?: string | null;
  acceptedAt: Date;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const to = params.to?.trim();
  if (!to) return { ok: false, error: "sin correo" };

  const fecha = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(params.acceptedAt);

  const docs = LEGAL_DOCS.map((d) => `· ${d.title} (v${d.version})`).join("<br/>");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0A0314;padding:24px;color:#fff">
      <div style="max-width:560px;margin:0 auto;background:linear-gradient(180deg,#130725,#0A0314);border:1px solid rgba(244,63,94,.3);border-radius:24px;overflow:hidden">
        <div style="padding:24px;text-align:center;border-bottom:1px solid rgba(255,255,255,.08)">
          <p style="margin:0;font-size:11px;font-weight:900;letter-spacing:.25em;color:#F43F5E">RABBITTY</p>
          <h1 style="margin:8px 0 0;font-size:22px;color:#fff">Comprobante de aceptación</h1>
        </div>
        <div style="padding:24px">
          <p style="margin:0 0 12px;font-size:14px;color:#E2E8F0">Hola${params.name ? ` ${params.name}` : ""},</p>
          <p style="margin:0 0 12px;font-size:13.5px;line-height:1.6;color:#CBD5E1">
            Dejamos constancia de que aceptaste los siguientes documentos el <strong>${fecha}</strong>:
          </p>
          <p style="margin:0 0 12px;font-size:13px;line-height:1.9;color:#CBD5E1">${docs}</p>
          <p style="margin:0 0 8px;font-size:12px;color:#94A3B8">
            Versión del conjunto: <strong style="color:#E2E8F0">${LEGAL_VERSION}</strong><br/>
            Medio: aplicación Rabbitty<br/>
            IP registrada: <span style="font-family:monospace">${params.ip || "no disponible"}</span>
          </p>
          <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#94A3B8">
            Puedes consultar la versión vigente en <a href="https://app.rabbitty.me/legal" style="color:#F472B6">app.rabbitty.me/legal</a>.
            Si no reconoces esta aceptación, escríbenos de inmediato a hola@rabbitty.me.
          </p>
          <p style="margin:16px 0 0;font-size:11.5px;line-height:1.6;color:#64748B">
            Recuerda: los Bunz son puntos de lealtad, no son dinero, no se compran con dinero y no se
            convierten a efectivo.
          </p>
        </div>
      </div>
    </div>`;

  try {
    const res = await sendEmail({
      to,
      subject: "Comprobante de aceptación · Rabbitty",
      html,
    });
    return { ok: Boolean(res?.ok), error: res?.ok ? undefined : res?.error };
  } catch (e) {
    console.warn("[consent-email] no se pudo enviar el comprobante:", e);
    return { ok: false, error: "envío falló" };
  }
}
