import crypto from "node:crypto";
import { and, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  bunzyBroadcasts,
  bunzyDeliveries,
  bunzyPreferences,
  bunzySeries,
  chatEventOutbox,
  conversations,
  messages,
  ownedBusinesses,
  users,
} from "@rabbitty/database-core";
import { getCoreDb } from "../db";
import { ollamaEndpoint, ollamaHeaders, ollamaErrorDetail } from "./ollama";

/**
 * ── Bunzy Connect (C0 + C2) ──
 *
 * Servicio ÚNICO de publicación de mensajes institucionales. Reutiliza el chat:
 *  - un hilo `conversations` con audience='BUNZY' por destinatario;
 *  - `messages` type='BUNZY_UPDATE' con metadata de la tarjeta;
 *  - `chatEventOutbox` en la MISMA transacción (Centrifugo);
 *  - `bunzyDeliveries` UNIQUE(broadcast, recipient) para idempotencia.
 *
 * C2 añade: preferencias por categoría, topes de frecuencia, programación y
 * CTA con tracking de clic.
 */

export const BUNZY_SENDER_ID = "bunzy";
export const BUNZY_AUDIENCE = "BUNZY";
/** Hilo único de Bunzy (agente) donde también viven los comunicados del Rabbiter. */
const BOT_THREAD_ID = "bot";
export const BUNZY_MESSAGE_TYPE = "BUNZY_UPDATE";

export const BUNZY_CATEGORIES = ["PRODUCT", "TIP", "NEWS", "SYSTEM"] as const;
export type BunzyCategory = (typeof BUNZY_CATEGORIES)[number];

export type BunzyRecipientType = "BUSINESS" | "USER";

export interface BunzyAudience {
  scope: "BUSINESS" | "ALL_AFFILIATES" | "ALL_RABBITTERS" | "USER";
  businessId?: string;
  userId?: string;
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
  /** ISO; si es futuro, queda SCHEDULED y el cron lo publica. */
  scheduledAt?: string | null;
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

export interface BunzySkipped {
  recipientType: BunzyRecipientType;
  recipientId: string;
  reason: "PREFERENCE" | "FREQUENCY" | "FAILED";
}

type CoreDb = ReturnType<typeof getCoreDb>;
type Tx = Parameters<Parameters<CoreDb["transaction"]>[0]>[0];

const APPROVED_STATUSES = ["APPROVED", "VERIFIED"] as const;

/** Ventana mínima entre mensajes de la misma categoría (días). */
const FREQUENCY_DAYS: Record<BunzyCategory, number> = {
  PRODUCT: 0,
  TIP: 6,
  NEWS: 15,
  SYSTEM: 0,
};

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
        userId: input.audience.userId ?? null,
        niche: input.audience.niche ?? null,
        package: input.audience.package ?? null,
      }),
    )
    .digest("hex");
}

function assertInput(input: BunzyBroadcastInput): void {
  if (!BUNZY_CATEGORIES.includes(input.category)) throw new Error(`Categoría inválida: ${input.category}`);
  const title = (input.title || "").trim();
  const body = (input.body || "").trim();
  if (title.length < 3 || title.length > 120) throw new Error("El título debe tener entre 3 y 120 caracteres");
  if (body.length < 10 || body.length > 4000) throw new Error("El cuerpo debe tener entre 10 y 4000 caracteres");
  if (input.ctaUrl && !/^https?:\/\//i.test(input.ctaUrl)) throw new Error("El CTA debe ser una URL http(s)");
  if (input.audience.scope === "BUSINESS" && !input.audience.businessId) throw new Error("Falta businessId");
  if (input.audience.scope === "USER" && !input.audience.userId) throw new Error("Falta userId");
  if (input.scheduledAt && Number.isNaN(Date.parse(input.scheduledAt))) throw new Error("scheduledAt inválido");
}

/** Resuelve destinatarios (solo lectura). */
export async function resolveAudience(db: CoreDb, audience: BunzyAudience): Promise<BunzyRecipient[]> {
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

  if (audience.scope === "USER") {
    const [user] = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
      .from(users)
      .where(eq(users.id, audience.userId as string))
      .limit(1);
    if (!user) throw new Error("Usuario no encontrado");
    const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email || user.id;
    return [{ type: "USER", id: user.id, name }];
  }

  if (audience.scope === "ALL_RABBITTERS") {
    const rows = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
      .from(users)
      .where(sql`coalesce(${users.role}, 'USER') NOT IN ('AFFILIATE', 'ADMIN')`)
      .limit(5000);
    return rows.map((u) => ({
      type: "USER" as const,
      id: u.id,
      name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || u.id,
    }));
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

/** Preview estrictamente de solo lectura. */
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
  recipient: { id: string; type: BunzyRecipientType },
): Promise<{ id: string }> {
  // ── Rabbiter: un solo Bunzy ──────────────────────────────────────────
  // Los comunicados entran al MISMO hilo del agente ('bot'), así no hay dos
  // chats de Bunzy. Se archivan igual (delivery → Entendido → /comunicados).
  if (recipient.type === "USER") {
    const [existingBot] = await tx
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.participant1, recipient.id),
          eq(conversations.participant2, BOT_THREAD_ID),
        ),
      )
      .limit(1);
    if (existingBot) return existingBot;

    try {
      const [created] = await tx
        .insert(conversations)
        .values({
          kind: "DIRECT",
          participant1: recipient.id,
          participant2: BOT_THREAD_ID,
        })
        .returning({ id: conversations.id });
      if (created) return created;
    } catch (err) {
      const [raced] = await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.participant1, recipient.id),
            eq(conversations.participant2, BOT_THREAD_ID),
          ),
        )
        .limit(1);
      if (raced) return raced;
      throw err;
    }
  }

  // ── Negocio: hilo oficial propio (oculto en la lista) ───────────────
  const [existing] = await tx
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.audience, BUNZY_AUDIENCE), eq(conversations.participant2, recipient.id)))
    .limit(1);
  if (existing) return existing;

  try {
    const [created] = await tx
      .insert(conversations)
      .values({
        kind: "DIRECT",
        audience: BUNZY_AUDIENCE,
        participant1: BUNZY_SENDER_ID,
        participant2: recipient.id,
      })
      .returning({ id: conversations.id });
    if (created) return created;
  } catch (err) {
    const [raced] = await tx
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.audience, BUNZY_AUDIENCE), eq(conversations.participant2, recipient.id)))
      .limit(1);
    if (raced) return raced;
    throw err;
  }

  throw new Error("No se pudo crear el hilo de Bunzy");
}

/** Preferencias + tope de frecuencia. Devuelve el motivo de skip o null. */
async function skipReason(
  db: CoreDb,
  recipient: BunzyRecipient,
  category: BunzyCategory,
): Promise<BunzySkipped["reason"] | null> {
  if (category !== "SYSTEM") {
    const [pref] = await db
      .select()
      .from(bunzyPreferences)
      .where(
        and(
          eq(bunzyPreferences.recipientType, recipient.type),
          eq(bunzyPreferences.recipientId, recipient.id),
        ),
      )
      .limit(1);
    if (pref) {
      if (category === "PRODUCT" && !pref.product) return "PREFERENCE";
      if (category === "TIP" && !pref.tips) return "PREFERENCE";
      if (category === "NEWS" && !pref.news) return "PREFERENCE";
    }

    const windowDays = FREQUENCY_DAYS[category];
    if (windowDays > 0) {
      const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
      const [recent] = await db
        .select({ id: bunzyDeliveries.id })
        .from(bunzyDeliveries)
        .innerJoin(bunzyBroadcasts, eq(bunzyDeliveries.broadcastId, bunzyBroadcasts.id))
        .where(
          and(
            eq(bunzyDeliveries.recipientType, recipient.type),
            eq(bunzyDeliveries.recipientId, recipient.id),
            eq(bunzyBroadcasts.category, category),
            inArray(bunzyDeliveries.status, ["PUBLISHED", "READ"]),
            gte(bunzyBroadcasts.publishedAt, cutoff),
          ),
        )
        .limit(1);
      if (recent) return "FREQUENCY";
    }
  }
  return null;
}

function trackingBase(): string {
  return (
    process.env.BUNZY_CONNECT_TRACKING_BASE ||
    process.env.RABBITTY_MINIAPP_URL ||
    "https://app.rabbitty.me"
  ).replace(/\/$/, "");
}

/**
 * Push best-effort al dueño/usuario cuando el mensaje ya está persistido.
 * Respeta preferencias (el filtro ocurrió antes) y falla en silencio.
 */
async function pushRecipient(
  db: CoreDb,
  recipient: BunzyRecipient,
  broadcast: typeof bunzyBroadcasts.$inferSelect,
) {
  const base = process.env.RABBITTY_MINIAPP_URL;
  const secret = process.env.PUSH_SEND_SECRET;
  if (!base || !secret) return;

  let userId: string | null = null;
  if (recipient.type === "USER") {
    userId = recipient.id;
  } else {
    const [business] = await db
      .select({ ownerId: ownedBusinesses.ownerId })
      .from(ownedBusinesses)
      .where(eq(ownedBusinesses.id, recipient.id))
      .limit(1);
    userId = business?.ownerId ?? null;
  }
  if (!userId) return;

  try {
    await fetch(`${base.replace(/\/$/, "")}/api/notifications/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-push-secret": secret },
      signal: AbortSignal.timeout(6000),
      body: JSON.stringify({
        userId,
        title: `Bunzy · ${broadcast.title}`.slice(0, 90),
        body: broadcast.body.replace(/\s+/g, " ").slice(0, 140),
        data: { type: "BUNZY_UPDATE", route: "/chat/bunzy" },
      }),
    });
  } catch {
    /* push best-effort */
  }
}

/** Entrega a UN destinatario (idempotente por delivery). */
async function deliverOne(
  db: CoreDb,
  broadcast: typeof bunzyBroadcasts.$inferSelect,
  recipient: BunzyRecipient,
): Promise<BunzyDeliveryResult> {
  const [existingDelivery] = await db
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

  if (existingDelivery && ["PUBLISHED", "READ", "CREATED"].includes(existingDelivery.status)) {
    return {
      recipientType: recipient.type,
      recipientId: recipient.id,
      conversationId: existingDelivery.conversationId,
      messageId: existingDelivery.messageId,
      status: existingDelivery.status,
      replayed: true,
    };
  }

  const reason = await skipReason(db, recipient, broadcast.category as BunzyCategory);
  if (reason) {
    await db
      .insert(bunzyDeliveries)
      .values({
        broadcastId: broadcast.id,
        recipientType: recipient.type,
        recipientId: recipient.id,
        conversationId: existingDelivery?.conversationId ?? "",
        status: "SKIPPED",
        error: reason,
      })
      .onConflictDoUpdate({
        target: [bunzyDeliveries.broadcastId, bunzyDeliveries.recipientType, bunzyDeliveries.recipientId],
        set: { status: "SKIPPED", error: reason, lockedUntil: null, updatedAt: new Date() },
      })
      .catch(() => undefined);
    return {
      recipientType: recipient.type,
      recipientId: recipient.id,
      conversationId: existingDelivery?.conversationId ?? "",
      messageId: null,
      status: "SKIPPED",
      replayed: false,
    };
  }

  try {
    const result = await db.transaction(async (tx): Promise<BunzyDeliveryResult> => {
      const thread = await findOrCreateThread(tx, recipient);
      const deliveryId = existingDelivery?.id ?? crypto.randomUUID();
      const clientMessageId = `bc:${broadcast.id}`;
      const trackedCta = broadcast.ctaUrl
        ? `${trackingBase()}/api/bunzy/connect/click?d=${deliveryId}`
        : null;
      const metadata = {
        official: true,
        broadcastId: broadcast.id,
        deliveryId,
        category: broadcast.category,
        title: broadcast.title,
        ctaLabel: broadcast.ctaLabel ?? null,
        ctaUrl: trackedCta,
        mediaKey: broadcast.mediaKey ?? null,
      };

      const [insertedMessage] = await tx
        .insert(messages)
        .values({
          conversationId: thread.id,
          senderId: BUNZY_SENDER_ID,
          content: broadcast.body,
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
          id: deliveryId,
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
            content: broadcast.body,
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
        .set({ status: "PUBLISHED", deliveredAt: new Date(), lockedUntil: null, updatedAt: new Date() })
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

    void pushRecipient(db, recipient, broadcast);
    return result;
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
          lockedUntil: null,
          updatedAt: new Date(),
        },
      })
      .catch(() => undefined);

    return {
      recipientType: recipient.type,
      recipientId: recipient.id,
      conversationId: "",
      messageId: null,
      status: "FAILED",
      replayed: false,
    };
  }
}

/** Crea deliveries PENDING para un envío masivo (cola). */
async function enqueueBroadcast(
  db: CoreDb,
  broadcast: typeof bunzyBroadcasts.$inferSelect,
  audience: BunzyRecipient[],
) {
  const chunkSize = 500;
  for (let i = 0; i < audience.length; i += chunkSize) {
    const chunk = audience.slice(i, i + chunkSize);
    await db
      .insert(bunzyDeliveries)
      .values(
        chunk.map((r) => ({
          broadcastId: broadcast.id,
          recipientType: r.type,
          recipientId: r.id,
          conversationId: "",
          status: "PENDING",
        })),
      )
      .onConflictDoNothing({
        target: [bunzyDeliveries.broadcastId, bunzyDeliveries.recipientType, bunzyDeliveries.recipientId],
      });
  }

  await db
    .update(bunzyBroadcasts)
    .set({ status: "QUEUED", updatedAt: new Date() })
    .where(eq(bunzyBroadcasts.id, broadcast.id));
}

/** Entrega un broadcast: masa → cola; individual → síncrono. */
async function deliverBroadcast(
  db: CoreDb,
  broadcast: typeof bunzyBroadcasts.$inferSelect,
) {
  const audience = await resolveAudience(db, broadcast.audienceFilter as unknown as BunzyAudience);
  const isMass =
    broadcast.audienceScope === "ALL_AFFILIATES" || broadcast.audienceScope === "ALL_RABBITTERS";

  if (isMass) {
    await enqueueBroadcast(db, broadcast, audience);
    return {
      broadcastId: broadcast.id,
      status: "QUEUED" as const,
      audienceCount: audience.length,
      published: 0,
      queued: true,
      replayed: false,
      deliveries: [] as BunzyDeliveryResult[],
      skipped: [] as BunzySkipped[],
    };
  }

  const deliveries: BunzyDeliveryResult[] = [];
  for (const recipient of audience) {
    deliveries.push(await deliverOne(db, broadcast, recipient));
  }

  const published = deliveries.filter((d) => d.status === "PUBLISHED").length;
  const skipped = deliveries
    .filter((d) => d.status === "SKIPPED" || d.status === "FAILED")
    .map((d) => ({
      recipientType: d.recipientType,
      recipientId: d.recipientId,
      reason: (d.status === "FAILED" ? "FAILED" : "PREFERENCE") as BunzySkipped["reason"],
    }));

  await db
    .update(bunzyBroadcasts)
    .set({
      status: published > 0 ? "PUBLISHED" : "FAILED",
      publishedAt: published > 0 ? new Date() : broadcast.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(bunzyBroadcasts.id, broadcast.id));

  return {
    broadcastId: broadcast.id,
    status: published > 0 ? "PUBLISHED" : "FAILED",
    audienceCount: audience.length,
    published,
    queued: false,
    replayed: false,
    deliveries,
    skipped,
  };
}

/** Worker: procesa deliveries PENDING de envíos masivos. */
export async function processBunzyQueue(db: CoreDb, limit = 100) {
  // Claim atómico: SKIP LOCKED + lock de 60s. Si el worker cae, el lock
  // expira y otra corrida retoma la fila.
  const pending = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(bunzyDeliveries)
      .where(
        and(
          eq(bunzyDeliveries.status, "PENDING"),
          or(isNull(bunzyDeliveries.lockedUntil), lte(bunzyDeliveries.lockedUntil, new Date())),
        ),
      )
      .orderBy(bunzyDeliveries.createdAt)
      .limit(limit)
      .for("update", { skipLocked: true });

    if (rows.length > 0) {
      await tx
        .update(bunzyDeliveries)
        .set({ lockedUntil: new Date(Date.now() + 60_000) })
        .where(inArray(bunzyDeliveries.id, rows.map((r) => r.id)));
    }
    return rows;
  });

  const touched = new Set<string>();
  const results: Array<BunzyDeliveryResult & { broadcastId: string }> = [];

  for (const row of pending) {
    const [broadcast] = await db
      .select()
      .from(bunzyBroadcasts)
      .where(eq(bunzyBroadcasts.id, row.broadcastId))
      .limit(1);
    if (!broadcast) {
      await db
        .update(bunzyDeliveries)
        .set({ status: "FAILED", error: "broadcast no encontrado", updatedAt: new Date() })
        .where(eq(bunzyDeliveries.id, row.id));
      continue;
    }
    const recipient: BunzyRecipient = {
      type: row.recipientType as BunzyRecipientType,
      id: row.recipientId,
      name: row.recipientId,
    };
    const result = await deliverOne(db, broadcast, recipient);
    results.push({ ...result, broadcastId: broadcast.id });
    touched.add(broadcast.id);

    if (result.status === "FAILED") {
      const attempts = Number(row.attempts ?? 0) + 1;
      if (attempts < 3) {
        // Backoff: 30s, 90s. Vuelve a PENDING y otro cron lo retoma.
        await db
          .update(bunzyDeliveries)
          .set({
            status: "PENDING",
            attempts,
            lockedUntil: new Date(Date.now() + attempts * 30_000),
            updatedAt: new Date(),
          })
          .where(eq(bunzyDeliveries.id, row.id))
          .catch(() => undefined);
      } else {
        await db
          .update(bunzyDeliveries)
          .set({ status: "FAILED", attempts, lockedUntil: null, updatedAt: new Date() })
          .where(eq(bunzyDeliveries.id, row.id))
          .catch(() => undefined);
      }
    }
  }

  for (const broadcastId of touched) {
    const [remaining] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(bunzyDeliveries)
      .where(and(eq(bunzyDeliveries.broadcastId, broadcastId), eq(bunzyDeliveries.status, "PENDING")));
    if (Number(remaining?.n ?? 0) > 0) continue;

    const [publishedRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(bunzyDeliveries)
      .where(
        and(
          eq(bunzyDeliveries.broadcastId, broadcastId),
          inArray(bunzyDeliveries.status, ["PUBLISHED", "READ"]),
        ),
      );

    await db
      .update(bunzyBroadcasts)
      .set({
        status: Number(publishedRow?.n ?? 0) > 0 ? "PUBLISHED" : "FAILED",
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bunzyBroadcasts.id, broadcastId));
  }

  return { processed: pending.length, results };
}

/** Publica (o programa) un broadcast. Idempotente por requestKey. */
export async function publishBroadcast(db: CoreDb, input: BunzyBroadcastInput) {
  assertInput(input);
  const title = input.title.trim();
  const body = input.body.trim();
  const contentHash = hashContent(input);
  const requestKey = (input.requestKey || contentHash).trim();
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;

  const audience = await resolveAudience(db, input.audience);
  if (audience.length === 0) throw new Error("La audiencia quedó vacía");

  const [existingBroadcast] = await db
    .select()
    .from(bunzyBroadcasts)
    .where(eq(bunzyBroadcasts.requestKey, requestKey))
    .limit(1);

  let broadcast = existingBroadcast;
  if (!broadcast) {
    const isFuture = Boolean(scheduledAt && scheduledAt.getTime() > Date.now() + 30_000);
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
        status: isFuture ? "SCHEDULED" : "DRAFT",
        scheduledAt,
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

  if (broadcast.status === "SCHEDULED" && broadcast.scheduledAt && broadcast.scheduledAt.getTime() > Date.now()) {
    return {
      broadcastId: broadcast.id,
      status: "SCHEDULED" as const,
      scheduledAt: broadcast.scheduledAt,
      audienceCount: audience.length,
      published: 0,
      replayed: Boolean(existingBroadcast),
      deliveries: [] as BunzyDeliveryResult[],
      skipped: [] as BunzySkipped[],
    };
  }

  return deliverBroadcast(db, broadcast);
}

/** Cron: publica los broadcasts programados cuya hora ya llegó. */
export async function publishScheduledBroadcasts(db: CoreDb, limit = 10) {
  const due = await db
    .select()
    .from(bunzyBroadcasts)
    .where(and(eq(bunzyBroadcasts.status, "SCHEDULED"), sql`${bunzyBroadcasts.scheduledAt} <= now()`))
    .limit(limit);

  const results = [];
  for (const broadcast of due) {
    try {
      results.push({ ok: true, ...(await deliverBroadcast(db, broadcast)) });
    } catch (err) {
      results.push({
        ok: false,
        broadcastId: broadcast.id,
        error: err instanceof Error ? err.message : "error",
      });
    }
  }
  return { due: due.length, results };
}

/**
 * ── Borrador asistido (C3) ──
 * La IA redacta; un humano edita y publica. Nunca publica sola y nunca inventa
 * funcionalidades: el prompt lo prohíbe explícitamente.
 */
export async function draftBroadcast(
  brief: string,
  category: BunzyCategory,
): Promise<{ title: string; body: string; provider: string }> {
  const system = [
    "Eres Bunzy, el asistente oficial de Rabbitty para negocios afiliados.",
    "Redacta un mensaje institucional breve en español de México.",
    "Devuelve SOLO JSON válido: {\"title\": string, \"body\": string}.",
    "title: máximo 80 caracteres. body: máximo 700 caracteres, texto plano con saltos de línea.",
    "Tono cercano, claro y profesional. No prometas ingresos ni funciones que el brief no mencione.",
    "No inventes montos, fechas ni beneficios. No uses HTML ni Markdown.",
    `Categoría: ${category}.`,
  ].join(" ");
  const user = `Brief del equipo: ${brief}`;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}") as { title?: string; body?: string };
    return clampDraft(parsed, "openai");
  }

  const base = process.env.OLLAMA_BASE_URL;
  const endpoint = ollamaEndpoint(base, "/api/chat");
  if (endpoint) {
    const model = process.env.OLLAMA_MODEL || "qwen2.5:7b";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: ollamaHeaders(),
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      // 404 suele ser "modelo no instalado"; 401, falta OLLAMA_API_KEY.
      throw new Error(`Ollama ${res.status} (modelo ${model})${await ollamaErrorDetail(res)}`);
    }
    const data = (await res.json()) as { message?: { content?: string } };
    const parsed = JSON.parse(data.message?.content || "{}") as { title?: string; body?: string };
    return clampDraft(parsed, "ollama");
  }

  throw new Error("Sin proveedor de IA configurado (OPENAI_API_KEY u OLLAMA_BASE_URL)");
}

function clampDraft(parsed: { title?: string; body?: string }, provider: string) {
  const title = (parsed.title || "").trim().slice(0, 80);
  const body = (parsed.body || "").trim().slice(0, 700);
  if (title.length < 3 || body.length < 10) throw new Error("El borrador salió vacío; intenta de nuevo");
  return { title, body, provider };
}

/**
 * Cron de estrategias: publica las series activas cuya fecha llegó.
 * PRODUCT se ignora por diseño (las actualizaciones de producto son manuales).
 */
export async function processBunzySeries(db: CoreDb, limit = 20) {
  const due = await db
    .select()
    .from(bunzySeries)
    .where(and(eq(bunzySeries.active, true), lte(bunzySeries.nextRunAt, new Date())))
    .limit(limit);

  const results = [];
  for (const series of due) {
    if (series.category === "PRODUCT") {
      await db
        .update(bunzySeries)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(bunzySeries.id, series.id));
      results.push({ ok: false, seriesId: series.id, error: "PRODUCT es manual; serie pausada" });
      continue;
    }

    try {
      const runDate = series.nextRunAt.toISOString().slice(0, 10);
      const result = await publishBroadcast(db, {
        category: series.category as BunzyCategory,
        title: series.title,
        body: series.body,
        ctaLabel: series.ctaLabel,
        ctaUrl: series.ctaUrl,
        audience: {
          scope: series.audienceScope as BunzyAudience["scope"],
          businessId: series.businessId ?? undefined,
        },
        requestKey: `series:${series.id}:${runDate}`,
        createdBy: series.createdBy,
      });
      await db
        .update(bunzySeries)
        .set({ nextRunAt: new Date(Date.now() + series.cadenceDays * 24 * 60 * 60 * 1000), updatedAt: new Date() })
        .where(eq(bunzySeries.id, series.id));
      results.push({ ok: true, seriesId: series.id, ...result });
    } catch (err) {
      results.push({
        ok: false,
        seriesId: series.id,
        error: err instanceof Error ? err.message : "error",
      });
    }
  }
  return { due: due.length, results };
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
      sql`SELECT to_regclass('"bunzyBroadcasts"') AS b, to_regclass('"bunzyDeliveries"') AS d, to_regclass('"bunzyPreferences"') AS p`,
    );
    const rows = Array.isArray(res)
      ? (res as Array<{ b: string | null; d: string | null; p: string | null }>)
      : ((res as { rows?: Array<{ b: string | null; d: string | null; p: string | null }> }).rows ?? []);
    tablesReady = Boolean(rows[0]?.b && rows[0]?.d && rows[0]?.p);
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
