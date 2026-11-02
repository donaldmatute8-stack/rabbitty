import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";


/**
 * Internal endpoint to trigger an iOS push notification.
 *
 * Protected by a shared secret header (`x-push-secret` === PUSH_SEND_SECRET),
 * intended for cron jobs / other backend services — not for the mobile client.
 *
 * Example:
 *   curl -X POST https://.../api/notifications/send \
 *     -H "x-push-secret: $PUSH_SEND_SECRET" \
 *     -H "content-type: application/json" \
 *     -d '{"userId":"<uuid>","title":"¡Recibiste Bunz!","body":"+50 BUNZ"}'
 */

const bodySchema = z
  .object({
    userId: z.string().min(1).optional(),
    userIds: z.array(z.string().min(1)).max(500).optional(),
    title: z.string().min(1).max(120),
    body: z.string().min(1).max(500),
    data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    badge: z.number().int().nonnegative().optional(),
  })
  .refine((v) => Boolean(v.userId) || (v.userIds && v.userIds.length > 0), {
    message: "Debes indicar userId o userIds",
  });

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export async function POST(req: NextRequest) {
  const secret = process.env.PUSH_SEND_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Push sending is not configured" }, { status: 503 });
  }

  const provided = req.headers.get("x-push-secret") || "";
  if (!provided || !safeEqual(provided, secret)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload inválido", details: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const userIds = parsed.userIds?.length ? parsed.userIds : [parsed.userId as string];

  // P1: entra al OUTBOX (durable) — el worker hace in-app + APNs con estados.
  try {
    const { enqueueOutbox, processOutboxBatch } = await import("@/lib/push/outbox");
    for (const uid of userIds) {
      await enqueueOutbox({
        userId: uid,
        type: (parsed.data?.type as string) || "SYSTEM",
        title: parsed.title,
        message: parsed.body,
        route: (parsed.data?.route as string) || null,
        data: parsed.data ?? undefined,
        dedupeKey: null,
        priority: parsed.badge ? "high" : "normal",
      });
    }
    const summary = await processOutboxBatch(userIds.length);
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error("[PUSH_SEND]", error);
    return NextResponse.json({ error: "Error enviando push" }, { status: 500 });
  }
}
