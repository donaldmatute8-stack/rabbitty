'use client';

import { useSyncExternalStore } from 'react';

export interface ConvPref {
  muted?: boolean;
  archived?: boolean;
  pinned?: boolean;
  deleted?: boolean;
}

interface Store {
  prefs: Record<string, ConvPref>;
  order: string[];
}

const KEY = 'rabbitty:convPrefs:v1';
const EMPTY: Store = { prefs: {}, order: [] };

let cache: Store | null = null;
const listeners = new Set<() => void>();

function load(): Store {
  if (typeof window === 'undefined') return EMPTY;
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { prefs: {}, order: [], ...(JSON.parse(raw) as Partial<Store>) } : { prefs: {}, order: [] };
  } catch {
    cache = { prefs: {}, order: [] };
  }
  return cache;
}

function commit(next: Store) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* almacenamiento no disponible */
  }
  listeners.forEach((l) => l());
}

export function setPref(id: string, patch: ConvPref) {
  const s = load();
  commit({ prefs: { ...s.prefs, [id]: { ...s.prefs[id], ...patch } }, order: s.order });
}

export function setOrder(order: string[]) {
  const s = load();
  commit({ prefs: s.prefs, order });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): Store {
  return load();
}

function getServerSnapshot(): Store {
  return EMPTY;
}

export function useConvPrefs(): Store {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
