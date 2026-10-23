import { db } from "@/db";
import { notifications } from "@/db/schema";
import { isApnsConfigured, sendPushToUsers, type PushPayload } from "@/lib/push/apns";

export interface SendEcosystemNotificationParams {
  userId: string;
  title: string;
  message: string;
  type?: "REWARD" | "TRANSFER" | "REFERRAL" | "AFFILIATE" | "HOPS" | "MADRIGUERA" | "CHAT" | "SYSTEM";
  route?: string;
  link?: string;
  pushData?: Record<string, string | number | boolean>;
  threadId?: string;
}

/**
 * Canal universal de notificación para Rabbitty:
 * 1. Inserta la notificación in-app en la tabla `notifications` (para la campana / centro de alertas).
 * 2. Si APNs está configurado, despacha la notificación Push nativa con soporte completo de Deeplinks (route/link).
 */
export async function sendEcosystemNotification(params: SendEcosystemNotificationParams): Promise<void> {
  const { userId, title, message, type = "SYSTEM", route, link, pushData, threadId } = params;
  if (!userId) return;

  const rawRoute = route || link || (pushData?.route as string) || (pushData?.link as string);
  const resolvedRoute = rawRoute && rawRoute.trim() ? rawRoute.trim() : undefined;

  // 1. In-App Notification (Campana / feed)
  try {
    await db.insert(notifications).values({
      userId,
      title,
      message,
      type,
    });
  } catch (err) {
    console.warn("[ECOSYSTEM_NOTIFICATION] Error persisting in-app notification:", err);
  }

  // 2. Native Push Notification (APNs / iOS)
  if (isApnsConfigured()) {
    try {
      const dataPayload: Record<string, string | number | boolean> = {
        type,
        ...(pushData || {}),
      };
      if (resolvedRoute) {
        dataPayload.route = resolvedRoute;
        dataPayload.link = resolvedRoute;
      }

      const payload: PushPayload = {
        title,
        body: message,
        data: dataPayload,
        threadId: threadId || type.toLowerCase(),
      };
      await sendPushToUsers([userId], payload);
    } catch (pushErr) {
      console.warn("[ECOSYSTEM_NOTIFICATION] Error dispatching push to user:", userId, pushErr);
    }
  }
}
