/**
 * ── Service Worker del comandero (ADR-025, fase 6) ─────────────────────────
 *
 * Objetivo: que el comandero **abra sin red**. No cachea datos ni respuestas
 * de la API: solo el armazón de la app (HTML de /comandero y assets estáticos).
 * Los pedidos capturados sin conexión viven en IndexedDB (comandero-queue.ts).
 *
 * Reglas:
 * - Navegaciones: red primero; si falla, la última copia guardada del comandero.
 * - Estáticos de Next (/ _next/static, icons, fuentes): caché primero.
 * - Cualquier otra ruta (admin, API, tRPC): red, sin caché.
 */

const VERSION = "comandero-v1";
const STATIC_CACHE = `static-${VERSION}`;
const PAGE_CACHE = `page-${VERSION}`;
const OFFLINE_PAGE = "/comandero";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.status === 200) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function pageNetworkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const fallback = await caches.match(OFFLINE_PAGE);
    if (fallback) return fallback;
    return new Response("Sin conexión", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Nunca cachear API ni tRPC.
  if (url.pathname.startsWith("/api/")) return;

  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/logos/") ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Solo el comandero se guarda como página navegable.
  if (request.mode === "navigate" && url.pathname.startsWith("/comandero")) {
    event.respondWith(pageNetworkFirst(request));
  }
});
