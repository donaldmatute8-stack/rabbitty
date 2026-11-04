/**
 * ── Solicitudes de nicho ── contexto, validación y correo de bienvenida.
 *
 * Se usa cuando un negocio llega con un giro que Rabbitty todavía NO cubre.
 * El email es inmediato, personalizado por nicho y NO promete fechas: la
 * solicitud queda en `niche_requests` como cola real de producto.
 *
 * Seguridad: todo lo que escribe el usuario se escapa antes de entrar al HTML
 * del correo. Aquí no se lee ni se envía información de otros tenants.
 */

import { wrapInRabbittyEmailLayout } from './email';
import { nicheContext } from './niche-catalog';

export { nicheContext };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function isValidEmail(value: string): boolean {
  return value.length <= 160 && EMAIL_RE.test(value);
}

/**
 * Normaliza un celular mexicano a E.164 sin '+' (52 + 10 dígitos).
 * Acepta: 3221234567 · 523221234567 · +52 322 123 4567 · 5213221234567.
 * Devuelve null si no es un celular MX válido.
 */
export function normalizeMxPhone(raw: string): string | null {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  // Lada internacional legacy "+52 1 ..." → se descarta el 1.
  if (d.length === 13 && d.startsWith('521')) d = `52${d.slice(3)}`;
  if (d.length === 12 && d.startsWith('52')) return d;
  if (d.length === 10) return `52${d}`;
  return null;
}

/** +52 322 123 4567 */
export function formatMxPhone(e164: string): string {
  const d = e164.replace(/\D/g, '');
  if (d.length !== 12) return `+${d}`;
  return `+${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
}

/** Recorta y quita caracteres de control. No escapa: eso se hace al renderizar. */
export function sanitizeText(value: unknown, max = 120): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface NicheWelcomeEmailInput {
  contactName?: string | null;
  nicheLabel: string;
  nicheId?: string | null;
  email: string;
  phone: string;
  requestId?: string | null;
}

/**
 * Correo de bienvenida + solicitud registrada, personalizado por nicho.
 * Es transaccional: sale inmediatamente después del alta de la solicitud.
 */
export function getNicheWelcomeEmailTemplate({
  contactName,
  nicheLabel,
  nicheId,
  phone,
  requestId,
}: NicheWelcomeEmailInput) {
  const context = nicheContext(nicheId);
  const label = escapeHtml(nicheLabel);
  const promise = context
    ? escapeHtml(context.promise)
    : 'los módulos exactos que tu operación necesita (caja, inventario, citas o pedidos)';
  const greeting = contactName ? `Hola <strong>${escapeHtml(contactName)}</strong>,` : 'Hola 👋,';
  const folio = requestId ? requestId.replace(/-/g, '').slice(0, 8).toUpperCase() : '';

  const content = `
    <div style="background: rgba(244,63,94,0.08); border-radius: 18px; padding: 22px; margin-bottom: 22px; border: 1px solid rgba(244,63,94,0.3);">
      <p style="font-size: 15px; line-height: 1.6; color: #E2E8F0; margin: 0 0 12px 0;">${greeting}</p>
      <p style="font-size: 14px; line-height: 1.65; color: #CBD5E1; margin: 0 0 12px 0;">
        Gracias por contarnos que tu negocio es <strong style="color:#FFF;">${label}</strong>.
        Ese giro <strong>todavía no está abierto</strong> en Rabbitty, así que acabo de registrar tu solicitud
        para que lo construyamos lo antes posible.
      </p>
      <p style="font-size: 14px; line-height: 1.65; color: #CBD5E1; margin: 0;">
        No vas a recibir fechas inventadas: te escribo <strong>a este correo</strong> y te mando un
        <strong>WhatsApp al ${escapeHtml(formatMxPhone(phone))}</strong> en cuanto tu giro esté listo.
      </p>
    </div>

    <div style="background: linear-gradient(135deg, rgba(233,30,99,0.12), rgba(168,85,247,0.12)); border-radius: 18px; padding: 20px; margin-bottom: 22px; border: 1px solid rgba(233,30,99,0.3);">
      <p style="margin: 0 0 4px 0; font-size: 10px; font-weight: 800; color: #F472B6; text-transform: uppercase; letter-spacing: 0.12em;">Tu solicitud</p>
      <h3 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 900; color: #FFF;">${label}</h3>
      ${folio ? `<p style="margin: 0 0 10px 0; font-size: 12px; color: #A5B4FC;">Folio <strong>#${folio}</strong></p>` : ''}
      <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #CBD5E1;">
        Estamos preparando <strong>${promise}</strong>.
      </p>
    </div>

    <div style="background: rgba(255,255,255,0.03); border-radius: 18px; padding: 20px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.08);">
      <h4 style="margin: 0 0 10px 0; color: #FFF; font-size: 13px; font-weight: 800;">Mientras tanto</h4>
      <p style="margin: 0 0 8px 0; font-size: 13px; line-height: 1.6; color: #CBD5E1;">
        Puedes usar Rabbitty como cliente: acumula Bunz en los negocios afiliados y conoce cómo funciona la economía.
      </p>
      <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #94A3B8;">
        Si tu operación ya cabe en restaurante, cafetería, bar, panadería, pizzería, taquería, barbería,
        gym, tienda o servicios con cita, responde este correo y te ayudamos a arrancar hoy.
      </p>
    </div>

    <div style="text-align: center; margin-bottom: 8px;">
      <a href="https://t.me/Rabbittyme_bot/app" style="display: inline-block; background: linear-gradient(135deg,#E91E63,#D81B60); color:#FFF; font-weight:900; font-size:14px; padding:14px 30px; border-radius:14px; text-decoration:none;">
        Abrir Rabbitty 🐰
      </a>
    </div>
    <p style="text-align:center; margin: 12px 0 0 0; font-size: 12px; color:#94A3B8;">— Bunzy, tu copiloto en Rabbitty</p>
  `;

  return wrapInRabbittyEmailLayout('Tu nicho ya está en la lista 🐰', label, content);
}
