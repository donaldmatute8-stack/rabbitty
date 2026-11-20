import { inArray } from "drizzle-orm";
import { users } from "@rabbitty/database-core/schema";
import { GOD_ADMIN_EMAILS } from "./god2fa";

/**
 * ── Avisos al equipo de soporte ─────────────────────────────────────────────
 *
 * El hilo vive en la app, pero si nadie mira la bandeja el caso se enfría.
 * Se manda push a los usuarios del equipo (God + allowlist opcional) con una
 * ruta que el admin sabe abrir: `/god/soporte`.
 *
 * No usa Telegram ni canales externos: es el mismo canal de notificaciones de
 * Rabbitty (in-app + APNs/WebPush).
 */

function staffEmails(): string[] {
  const extra = (process.env.SUPPORT_STAFF_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([
    ...GOD_ADMIN_EMAILS.map((e) => e.trim().toLowerCase()),
    ...extra,
  ]));
}

type CoreDb = {
  select: (...args: any[]) => any;
};

export async function getSupportStaffUserIds(coreDb: CoreDb): Promise<string[]> {
  const emails = staffEmails();
  if (emails.length === 0) return [];
  try {
    const rows = await coreDb
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.email, emails));
    return (rows as Array<{ id: string }>).map((r) => r.id);
  } catch {
    return [];
  }
}

export async function notifySupportStaff(
  coreDb: CoreDb,
  params: { title: string; message: string; route?: string },
): Promise<number> {
  const userIds = await getSupportStaffUserIds(coreDb);
  if (userIds.length === 0) return 0;

  const base = process.env.RABBITTY_MINIAPP_URL;
  const secret = process.env.PUSH_SEND_SECRET;
  if (!base || !secret) return 0;

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/notifications/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-push-secret": secret },
      body: JSON.stringify({
        userIds,
        title: params.title.slice(0, 120),
        body: params.message.slice(0, 500),
        data: { type: "SYSTEM", route: params.route ?? "/god/soporte" },
      }),
    });
    if (!res.ok) return 0;
    return userIds.length;
  } catch {
    return 0;
  }
}
