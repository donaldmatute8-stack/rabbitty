/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import { type PrecacheEntry, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  runtimeCaching: defaultCache,
  skipWaiting: true,
  clientsClaim: true,
});

serwist.addEventListeners();
