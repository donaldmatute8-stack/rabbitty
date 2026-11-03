'use client';

/**
 * ── useOrderTracking ── H-TRACK: fuente de los pedidos ACTIVOS del Rabbitter
 * (tarjeta de seguimiento estilo paquetería, bidireccional mobile ↔ POS).
 *
 * Fetch GET /api/orders/active + polling 15s (y refresh inmediato al volver a
 * foreground — el retro-feed gap-fill {} pattern) con dedupe simple.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { PlatformBridge } from '@/lib/platform';
import { syncOrderLiveActivity, type LiveActivityOrder } from '@/lib/liveActivity';

export interface TrackedOrder {
  orderId: string;
  status: string;
  orderType: string | null;
  branchId: string | null;
  businessId: string | null;
  businessName: string;
  logoUrl: string | null;
  total: number;
  createdAt: string;
  stage: string;
  stageLabel: string;
  stageStep: number;
  stageCount: number;
  itemsSummary: string[];
}

export function useOrderTracking(enabled = true, onOrderRemoved?: (orderId: string) => void) {
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const knownIds = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      if (!headers?.Authorization && !headers?.['X-Init-Data']) return;
      const res = await fetch('/api/orders/active', { headers, cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (data?.success && Array.isArray(data.orders)) {
        const next = data.orders as TrackedOrder[];
        // Los que salieron (pasaron a DONE / expirados) → callback para reacción UI
        if (onOrderRemoved) {
          const nextIds = new Set(next.map((o) => o.orderId));
          for (const id of knownIds.current) {
            if (!nextIds.has(id)) onOrderRemoved(id);
          }
        }
        knownIds.current = new Set(next.map((o) => o.orderId));
        setOrders(next);
        // Live Activity (iOS): mantiene la tarjeta de bloqueo al día. No-op en web.
        const top = next[0];
        const liveOrder: LiveActivityOrder | null = top
          ? {
              orderId: top.orderId,
              businessName: top.businessName,
              orderType: top.orderType,
              stage: top.stage,
              stageLabel: top.stageLabel,
              step: top.stageStep,
              stepCount: top.stageCount,
              total: top.total,
              itemsSummary: (top.itemsSummary || []).join(' · '),
            }
          : null;
        void syncOrderLiveActivity(liveOrder);
      }
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  }, [onOrderRemoved]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const iv = setInterval(() => void refresh(), 15_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, refresh]);

  return { orders, loaded, refresh };
}
