"use client";

/**
 * ── useRealtimeEvents (P2) ── SSE por sesión de Telegram (fetch + headers de
 * auth, EventSource no soporta headers). onNotification por cada nueva
 * notificación; auto-reconexión ~1s tras terminar el stream (10 min máx).
 */
import { useEffect, useRef } from "react";
import { PlatformBridge } from "@/lib/platform";

export function useRealtimeEvents(
  onNotification: (
    n: { id: string; title: string; message: string; type: string; route?: string | null }
  ) => void,
  enabled: boolean
) {
  const handlerRef = useRef(onNotification);
  handlerRef.current = onNotification;

  useEffect(() => {
    if (!enabled) return;
    let destroyed = false;
    let backlog: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      while (!destroyed) {
        try {
          const headers = await PlatformBridge.getAuthHeaders();
          const res = (await fetch("/api/realtime/events", {
            method: "GET",
            headers: { ...headers, Accept: "text/event-stream" },
          })) as Response;
          if (!res.ok || !res.body) {
            await new Promise<void>((r) => setTimeout(r, 5000));
            continue;
          }
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let innerClosed = false;
          while (!innerClosed) {
            const { done, value } = await reader.read();
            if (done) { innerClosed = true; break; }
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            buffer = parts.pop() ?? "";
            for (const part of parts) {
              const lines = part.split("\n");
              let eventName = "";
              let data = "";
              for (const ln of lines) {
                if (ln.startsWith("event: ")) eventName = ln.slice(7);
                if (ln.startsWith("data: ")) data += ln.slice(6);
              }
              if (eventName === "notification" && data) {
                try {
                  handlerRef.current(JSON.parse(data));
                } catch { /* noop */ }
              }
            }
          }
        } catch {
          // fallback: reintento en 5s
          await new Promise<void>((r) => setTimeout(r, 5000));
        }
      }
    };
    void run();

    return () => { destroyed = true; };
  }, [enabled]);
}