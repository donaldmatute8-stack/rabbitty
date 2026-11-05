import crypto from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  bunzyBroadcasts,
  bunzyDeliveries,
  chatEventOutbox,
  conversations,
  messages,
  ownedBusinesses,
} from "@rabbitty/database-core";
import { getCoreDb } from "../db";

/**
 * ── Bunzy Connect (C0) ──
 *
 * Servicio ÚNICO de publicación de mensajes institucionales. La UI God, el CLI
 * local y cualquier hook futuro deben pasar por aquí; no hay otra ruta que
 * inserte mensajes BUNZY_UPDATE.
 *
 * Reutiliza el chat existente:
 *  - un hilo `conversations` con audience='BUNZY' por destinatario;
 *  - `messages` con type='BUNZY_UPDATE' y metadata de la tarjeta;
 *  - `chatEventOutbox` en la MISMA transacción (el worker publica a Centrifugo);
 *  - `bunzyDeliveries` con UNIQUE(broadcast, recipient) para idempotencia.
 */

export const BUNZY_SENDER_ID = "bunzy";
export const BUNZY_AUDIENCE = "BUNZY";
export const BUNZY_MESSAGE_TYPE = "BUNZY_UPDATE";

export const BUNZY_CATEGORIES = ["PRODUCT", "TIP", "NEWS", "SYSTEM"] as const;
export type BunzyCategory = (typeof BUNZY_CATEGORIES)[number];

export type BunzyRecipientType = "BUSINESS" | "USER";

export interface BunzyAudience {
  scope: "BUSINESS" | "ALL_AFFILIATES";
  businessId?: string;
  niche?: string;
  package?: string;
}

export interface BunzyBroadcastInput {
  category: BunzyCategory;
  title: string;
  body: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  mediaKey?: string | null;
  audience: BunzyAudience;
  requestKey?: string | null;
  createdBy: string;
}

export interface BunzyRecipient {
  type: BunzyRecipientType;
  id: string;
  name: string;
}

export interface BunzyDeliveryResult {
  recipientType: BunzyRecipientType;
  recipientId: string;
  conversationId: string;
  messageId: string | null;
  status: string;
  replayed: boolean;
}

type CoreDb = ReturnType<typeof getCoreDb>;
type Tx = Parameters<Parameters<CoreDb["transaction"]>[0]>[0];

const APPROVED_STATUSES = ["APPROVED", "VERIFIED"] as const;

function hashContent(input: BunzyBroadcastInput): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        category: input.category,
        title: input.title,
        body: input.body,
        ctaLabel: input.ctaLabel ?? null,
        ctaUrl: input.ctaUrl ?? null,
        mediaKey: input.mediaKey ?? null,
        scope: input.audience.scope,
        businessId: input.audience.businessId ?? null,
        niche: input.audience.niche ?? null,
        package: input.audience.package ?? null,
      }),
    )
    .digest("hex");
}

function assertInput(input: BunzyBroadcastInput): void {
  if (!BUNZY_CATEGORIES.includes(input.category)) {
    throw new Error(`Categoría inválida: ${input.category}`);
  }
  const title = (input.title || "").trim();
  const body = (input.body || "").trim();
  if (title.length < 3 || title.length > 120) {
    throw new Error("El título debe tener entre 3 y 120 caracteres");
  }
  if (body.length < 10 || body.length > 4000) {
    throw new Error("El cuerpo debe tener entre 10 y 4000 caracteres");
  }
  if (input.ctaUrl && !/^https?:\/\//i.test(input.ctaUrl)) {
    throw new Error("El CTA debe ser una URL http(s)");
  }
  if (input.audience.scope === "BUSINESS" && !input.audience.businessId) {
    throw new Error("Falta businessId para la audiencia BUSINESS");
  }
}

/** Resuelve destinatarios (solo lectura). */
export async function resolveAudience(
  db: CoreDb,
  audience: BunzyAudience,
): Promise<BunzyRecipient[]> {
  if (audience.scope === "BUSINESS") {
    const [business] = await db
      .select({ id: ownedBusinesses.id, name: ownedBusinesses.name, status: ownedBusinesses.status })
      .from(ownedBusinesses)
      .where(eq(ownedBusinesses.id, audience.businessId as string))
      .limit(1);
    if (!business) throw new Error("Negocio no encontrado");
    if (!APPROVED_STATUSES.includes(business.status as (typeof APPROVED_STATUSES)[number])) {
      throw new Error(`El negocio no está aprobado (status: ${business.status})`);
    }
    return [{ type: "BUSINESS", id: business.id, name: business.name }];
  }

  const filters = [inArray(ownedBusinesses.status, [...APPROVED_STATUSES])];
  if (audience.niche) filters.push(eq(ownedBusinesses.niche, audience.niche));
  if (audience.package) filters.push(eq(ownedBusinesses.package, audience.package));

  const rows = await db
    .select({ id: ownedBusinesses.id, name: ownedBusinesses.name })
    .from(ownedBusinesses)
    .where(and(...filters));

  return rows.map((r) => ({ type: "BUSINESS" as const, id: r.id, name: r.name }));
}

/** Preview estrictamente de solo lectura: no crea hilos ni mensajes. */
export async function previewBroadcast(db: CoreDb, input: BunzyBroadcastInput) {
  assertInput(input);
  const audience = await resolveAudience(db, input.audience);
  return {
    dryRun: true as const,
    audienceCount: audience.length,
    sample: audience.slice(0, 5).map((r) => ({ id: r.id, name: r.name })),
    preview: {
      sender: "Bunzy",
      official: true,
      category: input.category,
      title: input.title.trim(),
      body: input.body.trim(),
      ctaLabel: input.ctaLabel ?? null,
      ctaUrl: input.ctaUrl ?? null,
      mediaKey: input.mediaKey ?? null,
    },
  };
}

async function findOrCreateThread(
  tx: Tx | CoreDb,
  recipientId: string,
): Promise<{ id: string }> {
  const [existing] = await tx
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.audience, BUNZY_AUDIENCE), eq(conversations.participant2, recipientId)))
    .limit(1);
  if (existing) return existing;

  try {
    const [created] = await tx
      .insert(conversations)
      .values({
        kind: "DIRECT",
        audience: BUNZY_AUDIENCE,
        participant1: BUNZY_SENDER_ID,
        participant2: recipientId,
      })
      .returning({ id: conversations.id });
    if (created) return created;
  } catch (err) {
    // Carrera contra el índice único parcial: releer el hilo ganador.
    const [raced] = await tx
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.audience, BUNZY_AUDIENCE), eq(conversations.participant2, recipientId)))
      .limit(1);
    if (raced) return raced;
    throw err;
  }

  throw new Error("No se pudo crear el hilo de Bunzy");
}

/**
 * Publica un broadcast. Idempotente por requestKey (broadcast) y por
 * UNIQUE(broadcastId, recipientType, recipientId) (delivery).
 */
export async function publishBroadcast(db: CoreDb, input: BunzyBroadcastInput) {
  assertInput(input);
  const title = input.title.trim();
  const body = input.body.trim();
  const contentHash = hashContent(input);
  const requestKey = (input.requestKey || contentHash).trim();

  const audience = await resolveAudience(db, input.audience);
  if (audience.length === 0) throw new Error("La audiencia quedó vacía");

  const [existingBroadcast] = await db
    .select()
    .from(bunzyBroadcasts)
    .where(eq(bunzyBroadcasts.requestKey, requestKey))
    .limit(1);

  let broadcast = existingBroadcast;
  if (!broadcast) {
    const [created] = await db
      .insert(bunzyBroadcasts)
      .values({
        requestKey,
        category: input.category,
        title,
        body,
        ctaLabel: input.ctaLabel ?? null,
        ctaUrl: input.ctaUrl ?? null,
        mediaKey: input.mediaKey ?? null,
        audienceScope: input.audience.scope,
        audienceFilter: input.audience,
        status: "DRAFT",
        contentHash,
        createdBy: input.createdBy,
      })
      .onConflictDoNothing({ target: bunzyBroadcasts.requestKey })
      .returning();
    broadcast =
      created ??
      (
        await db
          .select()
          .from(bunzyBroadcasts)
          .where(eq(bunzyBroadcasts.requestKey, requestKey))
          .limit(1)
      )[0];
  }
  if (!broadcast) throw new Error("No se pudo crear el broadcast");

  const deliveries: BunzyDeliveryResult[] = [];

  for (const recipient of audience) {
    try {
      const result = await db.transaction(async (tx): Promise<BunzyDeliveryResult> => {
        const [existingDelivery] = await tx
          .select()
          .from(bunzyDeliveries)
          .where(
            and(
              eq(bunzyDeliveries.broadcastId, broadcast.id),
              eq(bunzyDeliveries.recipientType, recipient.type),
              eq(bunzyDeliveries.recipientId, recipient.id),
            ),
          )
          .limit(1);

        if (existingDelivery && existingDelivery.status !== "FAILED") {
          return {
            recipientType: recipient.type,
            recipientId: recipient.id,
            conversationId: existingDelivery.conversationId,
            messageId: existingDelivery.messageId,
            status: existingDelivery.status,
            replayed: true,
          };
        }

        const thread = await findOrCreateThread(tx, recipient.id);
        const clientMessageId = `bc:${broadcast.id}`;
        const metadata = {
          official: true,
          broadcastId: broadcast.id,
          category: input.category,
          title,
          ctaLabel: input.ctaLabel ?? null,
          ctaUrl: input.ctaUrl ?? null,
          mediaKey: input.mediaKey ?? null,
        };

        const [insertedMessage] = await tx
          .insert(messages)
          .values({
            conversationId: thread.id,
            senderId: BUNZY_SENDER_ID,
            content: body,
            type: BUNZY_MESSAGE_TYPE,
            metadata,
            clientMessageId,
            encrypted: false,
          })
          .onConflictDoNothing({ target: [messages.conversationId, messages.clientMessageId] })
          .returning();

        const message =
          insertedMessage ??
          (
            await tx
              .select()
              .from(messages)
              .where(and(eq(messages.conversationId, thread.id), eq(messages.clientMessageId, clientMessageId)))
              .limit(1)
          )[0];

        if (!message) throw new Error("No se pudo crear el mensaje");

        await tx
          .insert(bunzyDeliveries)
          .values({
            broadcastId: broadcast.id,
            recipientType: recipient.type,
            recipientId: recipient.id,
            conversationId: thread.id,
            messageId: message.id,
            status: "CREATED",
            deliveredAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [bunzyDeliveries.broadcastId, bunzyDeliveries.recipientType, bunzyDeliveries.recipientId],
            set: {
              conversationId: thread.id,
              messageId: message.id,
              status: "CREATED",
              error: null,
              deliveredAt: new Date(),
              updatedAt: new Date(),
            },
          });

        // Outbox en la MISMA transacción: el worker publica a Centrifugo.
        await tx
          .insert(chatEventOutbox)
          .values({
            conversationId: thread.id,
            type: "message.created",
            eventId: `bunzy:${message.id}`,
            payload: {
              messageId: message.id,
              conversationId: thread.id,
              senderId: BUNZY_SENDER_ID,
              type: BUNZY_MESSAGE_TYPE,
              content: body,
              metadata,
              createdAt: message.createdAt,
            },
          })
          .onConflictDoNothing({ target: chatEventOutbox.eventId });

        await tx
          .update(conversations)
          .set({ lastMessageAt: new Date(), updatedAt: new Date() })
          .where(eq(conversations.id, thread.id));

        await tx
          .update(bunzyDeliveries)
          .set({ status: "PUBLISHED", deliveredAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(bunzyDeliveries.broadcastId, broadcast.id),
              eq(bunzyDeliveries.recipientType, recipient.type),
              eq(bunzyDeliveries.recipientId, recipient.id),
            ),
          );

        return {
          recipientType: recipient.type,
          recipientId: recipient.id,
          conversationId: thread.id,
          messageId: message.id,
          status: "PUBLISHED",
          replayed: false,
        };
      });
      deliveries.push(result);
    } catch (err) {
      await db
        .insert(bunzyDeliveries)
        .values({
          broadcastId: broadcast.id,
          recipientType: recipient.type,
          recipientId: recipient.id,
          conversationId: "",
          status: "FAILED",
          error: err instanceof Error ? err.message.slice(0, 300) : "error",
        })
        .onConflictDoUpdate({
          target: [bunzyDeliveries.broadcastId, bunzyDeliveries.recipientType, bunzyDeliveries.recipientId],
          set: {
            status: "FAILED",
            error: err instanceof Error ? err.message.slice(0, 300) : "error",
            updatedAt: new Date(),
          },
        })
        .catch(() => undefined);
    }
  }

  const published = deliveries.filter((d) => d.status === "PUBLISHED").length;
  await db
    .update(bunzyBroadcasts)
    .set({
      status: published > 0 ? "PUBLISHED" : "FAILED",
      publishedAt: published > 0 ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(bunzyBroadcasts.id, broadcast.id));

  return {
    broadcastId: broadcast.id,
    status: published > 0 ? "PUBLISHED" : "FAILED",
    audienceCount: audience.length,
    published,
    replayed: Boolean(existingBroadcast),
    deliveries,
  };
}

/** Metadata de entorno para que el CLI muestre el destino real. */
export async function getConnectMeta(db: CoreDb) {
  const url =
    process.env.CORE_DATABASE_URL ||
    process.env.RESTAURANT_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "";
  let dbHost = "desconocido";
  try {
    dbHost = new URL(url).host;
  } catch {
    /* sin URL */
  }

  let tablesReady = false;
  try {
    const res: unknown = await db.execute(
      sql`SELECT to_regclass('"bunzyBroadcasts"') AS b, to_regclass('"bunzyDeliveries"') AS d`,
    );
    const rows = Array.isArray(res)
      ? (res as Array<{ b: string | null; d: string | null }>)
      : ((res as { rows?: Array<{ b: string | null; d: string | null }> }).rows ?? []);
    tablesReady = Boolean(rows[0]?.b && rows[0]?.d);
  } catch {
    tablesReady = false;
  }

  return {
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    dbHost,
    tablesReady,
    sender: BUNZY_SENDER_ID,
  };
}

/** Evidencia de un broadcast (solo lectura). */
export async function getBroadcastEvidence(db: CoreDb, broadcastId: string) {
  const [broadcast] = await db
    .select()
    .from(bunzyBroadcasts)
    .where(eq(bunzyBroadcasts.id, broadcastId))
    .limit(1);
  if (!broadcast) return null;
  const deliveries = await db
    .select()
    .from(bunzyDeliveries)
    .where(eq(bunzyDeliveries.broadcastId, broadcastId));
  return { broadcast, deliveries };
}
