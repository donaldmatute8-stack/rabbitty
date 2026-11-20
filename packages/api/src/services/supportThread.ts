import { and, eq } from "drizzle-orm";
import { conversations, messages } from "@rabbitty/database-core/schema";

/**
 * ── Hilo de soporte 1:1 por negocio ───────────────────────────────────────
 *
 * Un solo lugar para crearlo y para el mensaje de bienvenida con guías. Lo usan
 * el admin, la app móvil y Bunzy (cuando detecta un bug/feedback), para que no
 * existan tres formas distintas de abrir el mismo hilo.
 *
 * El hilo es `audience='SUPPORT'`, participant1='support', participant2=businessId.
 * No es un grupo: cada afiliado ve solo el suyo.
 */

export const SUPPORT_SENDER_ID = "support";

export const SUPPORT_WELCOME = [
  "¡Hola! Soy el equipo de Rabbitty 🛟",
  "",
  "Cuéntanos qué pasa e incluye, si puedes: negocio, sucursal, pantalla y el mensaje de error (o una captura).",
  "",
  "Antes de escribir, esto suele resolverlo al instante:",
  "· Guías y tutoriales: /support/docs",
  "· Preguntas frecuentes: /support/faq",
  "· Guías del panel (POS, membresías, pagos): /academy",
  "",
  "Te responde una persona. Si es urgente, empieza el mensaje con “URGENTE”.",
].join("\n");

/** Texto que Bunzy usa para saber cómo escalar a una persona. */
export const SUPPORT_PLAYBOOK = [
  "SOPORTE DENTRO DE LA APP (SIN CANALES EXTERNOS):",
  "- El afiliado tiene un chat 1:1 con el equipo en la pestaña 'Soporte' del admin o en /support → 'Hablar con soporte' de la app.",
  "- Si el problema requiere revisión humana (cobros, inventario, accesos, un error que se repite), indícale abrir Soporte y qué incluir: negocio, sucursal, pantalla, mensaje de error y número de orden si aplica.",
  "- Guías: /academy (panel) y /support/docs (app). FAQ: /support/faq.",
  "- NUNCA ofrezcas Telegram, WhatsApp ni grupos externos: soporte vive dentro de Rabbitty.",
  "- Si el usuario reporta un bug o sugiere una mejora, regístralo en su hilo de Soporte y dile que el equipo lo verá ahí.",
].join("\n");

type CoreDb = {
  select: (...args: any[]) => any;
  insert: (...args: any[]) => any;
  update: (...args: any[]) => any;
  transaction?: (fn: (tx: any) => Promise<any>) => Promise<any>;
};

export async function findSupportThread(
  coreDb: CoreDb,
  businessId: string,
): Promise<{ id: string } | null> {
  const [row] = await coreDb
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(
      eq(conversations.audience, "SUPPORT"),
      eq(conversations.participant2, businessId),
    ))
    .limit(1);
  return row ?? null;
}

/**
 * Devuelve el hilo del negocio; si no existe lo crea con la bienvenida.
 * Idempotente ante carreras (dos pestañas o admin + app a la vez).
 */
export async function ensureSupportThread(
  coreDb: CoreDb,
  businessId: string,
): Promise<{ id: string; created: boolean }> {
  const existing = await findSupportThread(coreDb, businessId);
  if (existing) return { id: existing.id, created: false };

  let createdId: string | null = null;
  try {
    const [created] = await coreDb
      .insert(conversations)
      .values({
        participant1: SUPPORT_SENDER_ID,
        participant2: businessId,
        audience: "SUPPORT",
        kind: "DIRECT",
      })
      .returning({ id: conversations.id });
    createdId = created?.id ?? null;
  } catch (err) {
    const raced = await findSupportThread(coreDb, businessId);
    if (raced) return { id: raced.id, created: false };
    throw err;
  }

  if (!createdId) {
    const raced = await findSupportThread(coreDb, businessId);
    if (raced) return { id: raced.id, created: false };
    throw new Error("No se pudo crear el hilo de soporte");
  }

  // Bienvenida con guías: el afiliado sabe qué hacer antes de esperar a una
  // persona, y el equipo no repite lo mismo en cada caso.
  await coreDb
    .insert(messages)
    .values({
      conversationId: createdId,
      senderId: SUPPORT_SENDER_ID,
      content: SUPPORT_WELCOME,
      type: "TEXT",
    })
    .catch(() => undefined);

  return { id: createdId, created: true };
}

/** Agrega un mensaje al hilo (creándolo si hace falta). */
export async function appendSupportMessage(
  coreDb: CoreDb,
  businessId: string,
  content: string,
  senderId: string = SUPPORT_SENDER_ID,
): Promise<{ conversationId: string; messageId: string | null }> {
  const { id } = await ensureSupportThread(coreDb, businessId);
  const [msg] = await coreDb
    .insert(messages)
    .values({
      conversationId: id,
      senderId,
      content: content.slice(0, 4000),
      type: "TEXT",
    })
    .returning({ id: messages.id });

  await coreDb
    .update(conversations)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(conversations.id, id));

  return { conversationId: id, messageId: msg?.id ?? null };
}
