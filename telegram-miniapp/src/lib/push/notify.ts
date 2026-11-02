import { db } from "@/db";
import { enqueueOutbox, kickWorker } from "@/lib/push/outbox";

export interface SendEcosystemNotificationParams {
  userId: string;
  title: string;
  message: string;
  type?: "REWARD" | "TRANSFER" | "REFERRAL" | "AFFILIATE" | "HOPS" | "MADRIGUERA" | "CHAT" | "SYSTEM" | "LOYALTY_OFFER" | "CHECKIN_PROMPT" | string;
  route?: string;
  link?: string;
  pushData?: Record<string, string | number | boolean>;
  threadId?: string;
  /** Idempotencia (P0): dedupeKey — webhooks/retries no duplican */
  dedupeKey?: string;
  priority?: "high" | "normal" | "low";
}

/**
 * Canal universal de notificación para Rabbitty (P1: outbox transaccional).
 * 1. ENCOLA en `notifications_outbox` (durable — la tx de negocio jamás llama a APNs).
 * 2. Piggyback worker: drena la cola sin bloquear la respuesta (best-effort).
 * El worker hace: insert in-app (campana) + APNs por device con estados
 * (SENT → PROVIDER_ACCEPTED / RETRYING / FAILED) en notificationDeliveries.
 */
export async function sendEcosystemNotification(params: SendEcosystemNotificationParams): Promise<void> {
  const { userId, title, message, type = "SYSTEM", route, link, pushData, threadId, dedupeKey, priority } = params;
  if (!userId) return;

  const rawRoute = route || link || (pushData?.route as string) || (pushData?.link as string);
  const resolvedRoute = rawRoute && rawRoute.trim() ? rawRoute.trim() : undefined;

  try {
    await enqueueOutbox({
      userId,
      type,
      title,
      message,
      route: resolvedRoute ?? null,
      data: {
        ...(pushData || {}),
        ...(threadId ? { threadId } : {}),
        channel: "apns", // marcador del canal previsto (worker respeta tipo/dispositivo)
      } as Record<string, string | number | boolean | null>,
      dedupeKey: dedupeKey ?? null,
      priority,
    });
    kickWorker();
  } catch (err) {
    console.warn("[ECOSYSTEM_NOTIFICATION] enqueue falló (no fatal):", err);
  }
}
