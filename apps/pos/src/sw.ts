/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import { type PrecacheEntry, Serwist, NetworkOnly } from "serwist";
import { BackgroundSyncPlugin } from "serwist";

declare global {
  interface WorkerGlobalScope {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Plugin para encolar peticiones fallidas (offline) y reintentarlas cuando regrese la conexión
const bgSyncPlugin = new BackgroundSyncPlugin("pos-offline-mutations-queue", {
  maxRetentionTime: 24 * 60, // Reintentar hasta por 24 horas
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  runtimeCaching: [
    ...defaultCache,
    {
      // Interceptar llamadas TRPC/API de mutaciones importantes (ej. crear orden, actualizar mesa)
      matcher: ({ url, request }) => 
        url.pathname.includes('/api/trpc') && request.method === 'POST',
      handler: new NetworkOnly({
        plugins: [bgSyncPlugin],
      }),
    }
  ],
  skipWaiting: true,
  clientsClaim: true,
});

serwist.addEventListeners();
