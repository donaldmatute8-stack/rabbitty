'use client';

/**
 * ── Contactos locales ──
 * Agenda privada del dispositivo, aislada por usuario. No crea cuentas ni
 * duplica usuarios del directorio: si el teléfono/usuario existe en Rabbitty,
 * se guarda el `linkedUserId`; si no, queda como contacto local para invitar.
 */

const KEY = 'rabbitty_local_contacts_v1';

export interface LocalContact {
  id: string;
  name: string;
  phone: string;
  username?: string | null;
  email?: string | null;
  linkedUserId?: string | null;
  createdAt: number;
}

type Store = Record<string, LocalContact[]>;

function readStore(): Store {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Store;
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* modo privado */
  }
}

export function normalizePhone(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

export function listLocalContacts(ownerId: string): LocalContact[] {
  const store = readStore();
  return (store[ownerId] || []).slice().sort((a, b) => b.createdAt - a.createdAt);
}

export function saveLocalContact(
  ownerId: string,
  input: { name: string; phone: string; username?: string | null; email?: string | null; linkedUserId?: string | null },
): LocalContact {
  const store = readStore();
  const list = store[ownerId] || [];
  const phone = normalizePhone(input.phone);
  const existing = list.find(
    (c) =>
      (input.linkedUserId && c.linkedUserId === input.linkedUserId) ||
      (phone && normalizePhone(c.phone) === phone),
  );

  const contact: LocalContact = {
    id: existing?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `c_${Date.now()}`),
    name: input.name.trim(),
    phone: input.phone.trim(),
    username: input.username?.trim() || null,
    email: input.email?.trim() || null,
    linkedUserId: input.linkedUserId ?? existing?.linkedUserId ?? null,
    createdAt: existing?.createdAt || Date.now(),
  };

  const next = existing
    ? list.map((c) => (c.id === existing.id ? contact : c))
    : [contact, ...list];
  store[ownerId] = next;
  writeStore(store);
  return contact;
}

export function removeLocalContact(ownerId: string, id: string) {
  const store = readStore();
  store[ownerId] = (store[ownerId] || []).filter((c) => c.id !== id);
  writeStore(store);
}

export function contactMatches(contact: LocalContact, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = normalizePhone(q);
  return (
    contact.name.toLowerCase().includes(q) ||
    (contact.username || '').toLowerCase().includes(q) ||
    (digits.length >= 2 && normalizePhone(contact.phone).includes(digits)) ||
    (contact.email || '').toLowerCase().includes(q)
  );
}
