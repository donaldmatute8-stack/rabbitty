"use client";

/**
 * ── Cola local del comandero (ADR-025, fase 6) ─────────────────────────────
 *
 * Guarda en **IndexedDB** lo que no se pudo enviar por falta de red, para que
 * sobreviva a recargas, cierres del navegador y al service worker.
 *
 * Reglas:
 * - Solo se encola lo que falló por **red**. Un error de negocio (platillo
 *   agotado, extra inválido) se descarta y se avisa: reintentarlo no lo arregla.
 * - Se envía con `hold: true`: cae en captura y el mesero manda la tanda.
 * - Se respeta el orden de captura.
 * - Si IndexedDB no está disponible (navegador viejo / modo privado), se usa
 *   localStorage como respaldo para no perder la comanda.
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

const DB_NAME = "rabbitty";
const DB_VERSION = 1;
const STORE = "comandero_queue";
const LS_KEY = "rabbitty_comandero_queue";

/* ── IndexedDB mínima (sin dependencias) ─────────────────────────────────── */

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/* ── Respaldo en localStorage ────────────────────────────────────────────── */

function lsRead(): QueuedAdd[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as QueuedAdd[]) : [];
  } catch {
    return [];
  }
}

function lsWrite(items: QueuedAdd[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch {
    /* cuota llena */
  }
}

/* ── API ─────────────────────────────────────────────────────────────────── */

export async function listQueue(): Promise<QueuedAdd[]> {
  const db = await openDb();
  if (!db) return lsRead().sort((a, b) => a.createdAt - b.createdAt);
  try {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    const rows = await new Promise<QueuedAdd[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as QueuedAdd[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    await txDone(tx);
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return lsRead();
  } finally {
    db.close();
  }
}

export async function queueAdd(
  input: Omit<QueuedAdd, "id" | "createdAt">,
): Promise<QueuedAdd> {
  const entry: QueuedAdd = {
    ...input,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };

  const db = await openDb();
  if (!db) {
    lsWrite([...lsRead(), entry]);
    return entry;
  }
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(entry);
    await txDone(tx);
    return entry;
  } catch {
    lsWrite([...lsRead(), entry]);
    return entry;
  } finally {
    db.close();
  }
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await openDb();
  if (!db) {
    lsWrite(lsRead().filter((i) => i.id !== id));
    return;
  }
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function clearQueue(): Promise<void> {
  const db = await openDb();
  if (!db) {
    lsWrite([]);
    return;
  }
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    await txDone(tx);
  } finally {
    db.close();
  }
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
  for (const item of await listQueue()) {
    try {
      await send(item);
      await removeFromQueue(item.id);
      sent += 1;
    } catch (error) {
      if (isBusinessError(error)) {
        await removeFromQueue(item.id);
        onDrop?.(item, error);
        continue;
      }
      break; // sin red: se reintenta después
    }
  }
  return sent;
}
