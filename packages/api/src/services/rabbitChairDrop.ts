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
  params: { businessId: string; name?: string | null; branchId?: string | null },
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
        // Evento con ventana: no debe quedar enterrado por Focus.
        priority: "high",
        data: {
          type: "SYSTEM",
          route: `/rabbit-chair?business=${params.businessId}${params.branchId ? `&branch=${params.branchId}` : ""}`,
        },
      }),
    });
    if (!res.ok) return 0;
    const data = (await res.json().catch(() => ({}))) as { sent?: number };
    return Number(data.sent ?? 0) || userIds.length;
  } catch {
    return 0;
  }
}

/** Aviso personal: le tocó su lugar en la fila. */
export async function sendRabbitChairInvite(
  userId: string | null | undefined,
  params: { businessId: string; name?: string | null; branchId?: string | null },
): Promise<boolean> {
  if (!userId) return false;
  const base = process.env.RABBITTY_MINIAPP_URL;
  const secret = process.env.PUSH_SEND_SECRET;
  if (!base || !secret) return false;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/notifications/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-push-secret": secret },
      body: JSON.stringify({
        userId,
        title: "Te toca la silla",
        body: `Se liberó un lugar en ${params.name || "La Silla"}. Tienes 10 minutos para tomarlo.`,
        priority: "high",
        data: {
          type: "SYSTEM",
          route: `/rabbit-chair?business=${params.businessId}${params.branchId ? `&branch=${params.branchId}` : ""}`,
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
