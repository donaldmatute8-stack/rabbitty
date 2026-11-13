"use client";

/**
 * ── Cola local del comandero (ADR-025, fase 6) ─────────────────────────────
 *
 * Si se cae el Wi-Fi a media comanda, el ítem no se pierde: se guarda en el
 * dispositivo y se reenvía solo al volver la conexión.
 *
 * Reglas:
 * - Solo se encola lo que falló por **red**. Un error de negocio (platillo
 *   agotado, extra inválido) se descarta y se avisa: reintentarlo no lo arregla.
 * - Se envía siempre con `hold: true`: cae en captura y el mesero manda la
 *   tanda cuando quiera, igual que si hubiera estado en línea.
 * - El orden se respeta (una comanda no se adelanta a otra).
 */

export type QueuedAdd = {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  modifiers: { id: string; name: string }[];
  notes?: string;
  allergies?: string;
  guestName?: string;
  createdAt: number;
};

const KEY = "rabbitty_comandero_queue";

function read(): QueuedAdd[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as QueuedAdd[]) : [];
  } catch {
    return [];
  }
}

function write(items: QueuedAdd[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* cuota llena: se pierde la cola, pero no se rompe la pantalla */
  }
}

export function listQueue(): QueuedAdd[] {
  return read();
}

export function queueAdd(input: Omit<QueuedAdd, "id" | "createdAt">): QueuedAdd {
  const entry: QueuedAdd = {
    ...input,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  write([...read(), entry]);
  return entry;
}

export function removeFromQueue(id: string): void {
  write(read().filter((i) => i.id !== id));
}

export function clearQueue(): void {
  write([]);
}

/** Error de negocio (tiene código tRPC) vs. error de red. */
export function isBusinessError(error: unknown): boolean {
  const code = (error as { data?: { code?: string } } | null)?.data?.code;
  return Boolean(code);
}

/**
 * Reenvía la cola. Devuelve cuántos se enviaron.
 * Se detiene en el primer fallo de red; los de negocio se descartan.
 */
export async function flushQueue(
  send: (item: QueuedAdd) => Promise<unknown>,
  onDrop?: (item: QueuedAdd, error: unknown) => void,
): Promise<number> {
  let sent = 0;
  for (const item of read()) {
    try {
      await send(item);
      removeFromQueue(item.id);
      sent += 1;
    } catch (error) {
      if (isBusinessError(error)) {
        removeFromQueue(item.id);
        onDrop?.(item, error);
        continue;
      }
      break; // sin red: se reintenta después
    }
  }
  return sent;
}
