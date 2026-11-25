/**
 * ── Drop de Rabbit Chair ────────────────────────────────────────────────────
 * Avisa a los Rabbitters que hay una silla. Usa el mismo canal de push de la
 * app (in-app + APNs/WebPush) con el secreto compartido.
 *
 * El destino es la ficha del negocio (`/affiliate/<businessId>`), donde el
 * cliente ve la activación cuando esté en vivo.
 */
export async function sendRabbitChairDrop(
  userIds: string[],
  params: { businessId: string; name?: string | null },
): Promise<number> {
  const base = process.env.RABBITTY_MINIAPP_URL;
  const secret = process.env.PUSH_SEND_SECRET;
  if (!base || !secret || userIds.length === 0) return 0;

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/notifications/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-push-secret": secret },
      body: JSON.stringify({
        userIds: userIds.slice(0, 500),
        title: "Hay una silla",
        body: `${params.name || "La Silla"} está abierta. Entra a Rabbitty y toma tu lugar.`,
        data: { type: "SYSTEM", route: `/affiliate/${params.businessId}` },
      }),
    });
    if (!res.ok) return 0;
    const data = (await res.json().catch(() => ({}))) as { sent?: number };
    return Number(data.sent ?? 0) || userIds.length;
  } catch {
    return 0;
  }
}
