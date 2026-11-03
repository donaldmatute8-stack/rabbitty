'use client';

/**
 * ── liveActivity ── puente JS ↔ ActivityKit (iOS 16.2+).
 *
 * Mantiene UNA tarjeta viva del pedido en curso en la pantalla de bloqueo y la
 * Dynamic Island. Se sincroniza con el estado que ya trae `useOrderTracking`
 * (no duplica fuente de verdad) y registra el token de push de la actividad
 * para que el POS pueda mover la etapa aunque la app esté cerrada.
 *
 * En web/no-iOS es no-op: la app sigue funcionando igual.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { PlatformBridge } from '@/lib/platform';

export interface LiveActivityOrder {
  orderId: string;
  businessName: string;
  orderType?: string | null;
  stage: string;
  stageLabel: string;
  step: number;
  stepCount: number;
  total: number;
  itemsSummary: string;
}

interface RabbittyLiveActivityPlugin {
  isSupported(): Promise<{ supported: boolean; platform?: string }>;
  start(payload: Record<string, unknown>): Promise<{ started?: boolean; updated?: boolean; activityId?: string }>;
  update(payload: Record<string, unknown>): Promise<{ updated: boolean }>;
  end(payload: Record<string, unknown>): Promise<{ ended: boolean }>;
  endAll(): Promise<{ ended: number }>;
  addListener(
    eventName: 'pushToken',
    listener: (data: { orderId: string; token: string }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

const plugin = registerPlugin<RabbittyLiveActivityPlugin>('RabbittyLiveActivity');

/** ¿Podemos usar Live Activities en este runtime? */
export function liveActivitySupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

let listenerAttached = false;
let lastSignature: string | null = null;
let currentOrderId: string | null = null;

function toPayload(order: LiveActivityOrder) {
  return {
    orderId: order.orderId,
    businessName: order.businessName,
    orderType: order.orderType ?? 'TO_GO',
    stage: order.stage,
    stageLabel: order.stageLabel,
    step: order.step,
    stepCount: order.stepCount,
    total: order.total,
    itemsSummary: order.itemsSummary,
  };
}

async function attachTokenListener() {
  if (listenerAttached) return;
  listenerAttached = true;
  try {
    await plugin.addListener('pushToken', async (data) => {
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        await fetch('/api/live-activity/token', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: data.orderId, token: data.token, platform: 'ios' }),
        });
      } catch {
        /* best-effort: sin token, la app sigue actualizando en foreground */
      }
    });
  } catch {
    listenerAttached = false;
  }
}

/**
 * Sincroniza la Live Activity con el pedido activo (o la cierra si no hay).
 * Idempotente: si la etapa/total no cambió, no manda nada.
 */
export async function syncOrderLiveActivity(order: LiveActivityOrder | null): Promise<void> {
  if (!liveActivitySupported()) return;

  try {
    if (!order) {
      if (currentOrderId) {
        const closingId = currentOrderId;
        currentOrderId = null;
        lastSignature = null;
        await plugin.end({ orderId: closingId }).catch(() => undefined);
      }
      return;
    }

    await attachTokenListener();

    const signature = `${order.orderId}|${order.stage}|${order.step}|${order.total.toFixed(2)}`;
    if (signature === lastSignature) return;
    lastSignature = signature;

    if (currentOrderId === order.orderId) {
      await plugin.update(toPayload(order));
    } else {
      const res = await plugin.start(toPayload(order));
      currentOrderId = order.orderId;
      if (!res?.started && !res?.updated) {
        // El sistema rechazó la actividad (permiso apagado): no reintentar en bucle.
        lastSignature = signature;
      }
    }
  } catch {
    /* nunca romper el tracking por la Live Activity */
  }
}

/** Cierra todas las actividades (p. ej. al cerrar sesión). */
export async function endAllLiveActivities(): Promise<void> {
  if (!liveActivitySupported()) return;
  try {
    await plugin.endAll();
    currentOrderId = null;
    lastSignature = null;
  } catch { /* noop */ }
}
