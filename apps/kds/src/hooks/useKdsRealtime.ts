"use client";

/**
 * ── Suscripción en vivo del KDS (Fase 0C-5) ────────────────────────────────
 *
 * El servidor escribe cada evento del POS en `realtime_outbox` dentro de la
 * misma transacción que la orden y un worker lo publica en Centrifugo. Aquí
 * solo escuchamos el canal de la estación de esta pantalla e invalidamos la
 * cola cuando llega algo.
 *
 * Reglas:
 * - Sin estación elegida no hay canal: se mantiene el polling (modo "todas").
 * - El polling sigue activo como red de seguridad (30 días). Un push solo
 *   adelanta el refresco; nunca es la única fuente.
 * - El canal y los tokens los emite el servidor (`/api/realtime/token`), que
 *   valida que la estación sea de esta sucursal. El cliente nunca elige canal.
 * - `getToken` deja que la librería renueve los JWT al caducar (1 h).
 */

import { useEffect, useRef, useState } from "react";
import { Centrifuge } from "centrifuge";

export type RealtimeState = "off" | "connecting" | "live" | "error";

type Options = {
  /** Estación de esta pantalla. Vacío = sin push (se queda el polling). */
  stationId?: string | null;
  /** Se llama cuando llega un evento (para invalidar la cola). */
  onEvent: () => void;
  /** Permite pausar todo mientras la pantalla está en reposo. */
  paused?: boolean;
};

type TokenResponse = { channel: string; token: string; subscriptionToken: string; expiresIn: number };

/** Pide el par de tokens. Se cachea 5 s para no duplicar la llamada al arrancar. */
function tokenFetcher(stationId: string) {
  let inFlight: Promise<TokenResponse> | null = null;
  let cachedAt = 0;
  let cached: TokenResponse | null = null;

  return async (): Promise<TokenResponse> => {
    if (cached && Date.now() - cachedAt < 5_000) return cached;
    if (inFlight) return inFlight;

    inFlight = (async () => {
      try {
        const res = await fetch(`/api/realtime/token?stationId=${encodeURIComponent(stationId)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`token ${res.status}`);
        const data = (await res.json()) as TokenResponse;
        cached = data;
        cachedAt = Date.now();
        return data;
      } finally {
        inFlight = null;
      }
    })();

    return inFlight;
  };
}

export function useKdsRealtime({ stationId, onEvent, paused = false }: Options): RealtimeState {
  const [state, setState] = useState<RealtimeState>("off");
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!stationId || paused) {
      setState("off");
      return;
    }

    const url = process.env.NEXT_PUBLIC_CENTRIFUGO_URL;
    if (!url) {
      setState("error");
      return;
    }

    let cancelled = false;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const getTokens = tokenFetcher(stationId);

    /** Agrupa ráfagas de eventos en un solo refresco de la cola. */
    const scheduleInvalidate = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        debounce = null;
        onEventRef.current();
      }, 250);
    };

    // El canal se conoce al recibir los tokens; hasta entonces no se conecta.
    let client: Centrifuge | null = null;
    let stopped = false;

    const start = async () => {
      let first: TokenResponse;
      try {
        first = await getTokens();
      } catch {
        if (!cancelled) setState("error");
        return;
      }
      if (cancelled || stopped) return;

      client = new Centrifuge(url, {
        token: first.token,
        getToken: async () => (await getTokens()).token,
      });

      client.on("connecting", () => !cancelled && setState("connecting"));
      client.on("connected", () => !cancelled && setState("live"));
      client.on("disconnected", () => !cancelled && setState("connecting"));
      client.on("error", () => !cancelled && setState("error"));

      const sub = client.newSubscription(first.channel, {
        token: first.subscriptionToken,
        getToken: async () => (await getTokens()).subscriptionToken,
      });
      sub.on("publication", scheduleInvalidate);
      sub.on("subscribed", () => !cancelled && setState("live"));
      sub.on("unsubscribed", () => !cancelled && setState("connecting"));
      sub.on("error", () => !cancelled && setState("error"));

      client.connect();
    };

    setState("connecting");
    void start();

    // Al volver del segundo plano: refresca ya y reconecta si hace falta.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      onEventRef.current();
      if (client && client.state === "disconnected") client.connect();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      stopped = true;
      if (debounce) clearTimeout(debounce);
      document.removeEventListener("visibilitychange", onVisible);
      try {
        client?.disconnect();
        client?.removeAllListeners();
      } catch {
        /* el cliente ya estaba cerrado */
      }
      setState("off");
    };
  }, [stationId, paused]);

  return state;
}
