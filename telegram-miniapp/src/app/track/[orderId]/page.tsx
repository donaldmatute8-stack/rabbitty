'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Phone } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';

interface TrackItem {
  name: string;
  quantity: number;
  status?: string | null;
}

interface TrackOrder {
  id: string;
  businessName: string;
  orderType: string;
  status: string;
  stage: 'RECEIVED' | 'PREPARING' | 'READY' | 'DELIVERED';
  etaMinutes: number | null;
  etaAt: string | null;
  prepEtaMinutes?: number | null;
  prepEtaAt?: string | null;
  total: number;
  createdAt: string;
  customerFirstName: string | null;
  address: string | null;
  canCancel?: boolean;
  cancelled?: boolean;
  items: TrackItem[];
  delivery: {
    provider: string;
    status: string;
    courierName: string | null;
    courierPhone: string | null;
    trackingUrl: string | null;
  } | null;
}

const STEPS = [
  { id: 'RECEIVED', label: 'Recibido' },
  { id: 'PREPARING', label: 'En preparación' },
  { id: 'READY', label: 'En camino' },
  { id: 'DELIVERED', label: 'Entregado' },
] as const;

/**
 * Seguimiento del pedido para el Rabbitter (link del push).
 * Es la misma página para pedido en local, para recoger y a domicilio.
 */
export default function TrackOrderPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const orderId =
    typeof params?.orderId === 'string'
      ? params.orderId
      : Array.isArray(params?.orderId)
        ? params.orderId[0]
        : '';
  const [order, setOrder] = useState<TrackOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      try {
        const res = await fetch(`/api/track/${encodeURIComponent(orderId)}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !data?.success) throw new Error(data?.error || 'Pedido no encontrado');
        if (!alive) return;
        setOrder(data.order as TrackOrder);
        setError(null);
        if (data.order?.stage !== 'DELIVERED') {
          timer = setTimeout(load, 20_000);
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'No se pudo cargar');
      } finally {
        if (alive) setLoading(false);
      }
    };

    void load();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [orderId]);

  const stepIndex = order ? Math.max(0, STEPS.findIndex((s) => s.id === order.stage)) : 0;
  // Para local/recoger el tercer paso no es "en camino" sino "listo".
  const stepLabel = (id: string, fallback: string) =>
    id === 'READY' && order && order.orderType !== 'DELIVERY'
      ? 'Listo para recoger'
      : fallback;
  const courierPhone = order?.delivery?.courierPhone ?? null;

  const cancelOrder = async () => {
    if (!order) return;
    setCancelling(true);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch(`/api/track/${encodeURIComponent(order.id)}/cancel`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'No se pudo cancelar');
      }
      PlatformBridge.hapticFeedback('success');
      setConfirmCancel(false);
      setOrder((prev) => (prev ? { ...prev, status: 'CANCELLED', canCancel: false } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cancelar');
      setConfirmCancel(false);
    } finally {
      setCancelling(false);
    }
  };
  const eta = order?.etaAt
    ? new Date(order.etaAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'radial-gradient(ellipse at top, rgba(233,30,99,0.10) 0%, #09090D 55%, #050507 100%)',
        color: '#fff',
        paddingBottom: 48,
      }}
    >
      <header
        style={{
          maxWidth: 640,
          margin: '0 auto',
          padding: 'calc(var(--safe-top, 0px) + 14px) 16px 6px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={() => {
            PlatformBridge.hapticFeedback('light');
            if (typeof window !== 'undefined' && window.history.length > 2) router.back();
            else router.push('/chat');
          }}
          aria-label="Volver"
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(28,28,34,0.8)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={17} />
        </button>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 900,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: 'rgba(255,143,184,0.9)',
          }}
        >
          Seguimiento del pedido
        </span>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '8px 16px 0' }}>
        {loading && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Cargando pedido…</p>}
        {!loading && error && <p style={{ fontSize: 13, color: '#FB7185' }}>{error}</p>}

        {order && (
          <div
            style={{
              borderRadius: 22,
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              padding: 18,
              boxShadow: '0 18px 44px -22px rgba(0,0,0,0.7)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 9.5,
                    fontWeight: 900,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: 'rgba(255,143,184,0.9)',
                  }}
                >
                  {order.orderType === 'DELIVERY'
                    ? 'A domicilio'
                    : order.orderType === 'TAKEAWAY'
                      ? 'Para recoger'
                      : 'En local'}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 900, letterSpacing: '-0.3px' }}>
                  {order.businessName}
                </p>
                {order.customerFirstName && (
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                    Pedido de {order.customerFirstName}
                  </p>
                )}
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  borderRadius: 999,
                  padding: '4px 10px',
                  background:
                    order.stage === 'DELIVERED'
                      ? 'rgba(16,185,129,0.18)'
                      : 'rgba(233,30,99,0.18)',
                  border:
                    order.stage === 'DELIVERED'
                      ? '1px solid rgba(16,185,129,0.4)'
                      : '1px solid rgba(233,30,99,0.4)',
                  color: order.stage === 'DELIVERED' ? '#6EE7B7' : '#FF8FB8',
                }}
              >
                ${order.total.toFixed(2)}
              </span>
            </div>

            {order.cancelled && (
              <div
                style={{
                  marginTop: 14,
                  borderRadius: 12,
                  border: '1px solid rgba(244,63,94,0.35)',
                  background: 'rgba(244,63,94,0.10)',
                  padding: '10px 12px',
                }}
              >
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 900, color: '#FDA4AF' }}>
                  Este pedido fue cancelado
                </p>
              </div>
            )}

            {/* Pasos */}
            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {STEPS.map((step, i) => {
                  const done = i <= stepIndex;
                  return (
                    <div key={step.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div
                        style={{
                          height: 5,
                          borderRadius: 999,
                          background: done
                            ? 'linear-gradient(90deg,#FF2E93,#8B5CF6)'
                            : 'rgba(255,255,255,0.12)',
                        }}
                      />
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          letterSpacing: 0.4,
                          color: done ? '#fff' : 'rgba(255,255,255,0.4)',
                        }}
                      >
                        {stepLabel(step.id, step.label)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {order.stage !== 'DELIVERED' ? (
              !order.etaMinutes && !order.prepEtaMinutes ? (
                <div
                  style={{
                    marginTop: 16,
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.04)',
                    padding: '10px 12px',
                  }}
                >
                  <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                    El local confirmará el tiempo cuando empiece a preparar tu pedido.
                  </p>
                </div>
              ) : null
            ) : null}

            {order.stage !== 'DELIVERED' && (order.etaMinutes || order.prepEtaMinutes || eta) && (
              <div
                style={{
                  marginTop: 16,
                  borderRadius: 14,
                  border: '1px solid rgba(233,30,99,0.25)',
                  background: 'rgba(233,30,99,0.08)',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {order.prepEtaMinutes ? (
                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700 }}>
                    👨‍🍳 Cocina: ~{order.prepEtaMinutes} min
                  </p>
                ) : null}
                {order.etaMinutes ? (
                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800 }}>
                    {order.orderType === 'DELIVERY' ? '🛵 Entrega' : '⏱ Listo'} en ~{order.etaMinutes} min
                    {eta ? ` · cerca de las ${eta}` : ''}
                  </p>
                ) : null}
              </div>
            )}

            {order.delivery?.courierName && (
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 9.5, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
                    Repartidor
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 13.5, fontWeight: 800 }}>
                    {order.delivery.courierName}
                  </p>
                </div>
                {order.delivery?.trackingUrl && (
                  <a
                    href={order.delivery.trackingUrl}
                    onClick={(e) => {
                      e.preventDefault();
                      void PlatformBridge.openExternalUrl(order.delivery!.trackingUrl!);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      borderRadius: 999,
                      background: 'rgba(233,30,99,0.12)',
                      border: '1px solid rgba(233,30,99,0.35)',
                      color: '#FF8FB8',
                      fontSize: 12,
                      fontWeight: 800,
                      padding: '8px 12px',
                      textDecoration: 'none',
                    }}
                  >
                    Seguimiento en vivo
                  </a>
                )}
                {courierPhone && (
                  <a
                    href={`tel:${courierPhone}`}
                    onClick={(e) => {
                      e.preventDefault();
                      void PlatformBridge.openExternalUrl(`tel:${courierPhone}`);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.14)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 800,
                      padding: '8px 12px',
                      textDecoration: 'none',
                    }}
                  >
                    <Phone size={13} /> Llamar
                  </a>
                )}
              </div>
            )}

            {order.address && (
              <p style={{ margin: '14px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                📍 {order.address}
              </p>
            )}

            {order.items.length > 0 && (
              <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
                {order.items.slice(0, 8).map((item, i) => (
                  <p
                    key={`${item.name}-${i}`}
                    style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.72)' }}
                  >
                    • {item.quantity}× {item.name}
                  </p>
                ))}
                {order.items.length > 8 && (
                  <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                    +{order.items.length - 8} más
                  </p>
                )}
              </div>
            )}

            {order.canCancel && (
              <div style={{ marginTop: 16 }}>
                {!confirmCancel ? (
                  <button
                    type="button"
                    onClick={() => {
                      PlatformBridge.hapticFeedback('light');
                      setConfirmCancel(true);
                    }}
                    style={{
                      width: '100%',
                      borderRadius: 12,
                      border: '1px solid rgba(251,113,133,0.4)',
                      background: 'rgba(251,113,133,0.10)',
                      color: '#FDA4AF',
                      fontSize: 12.5,
                      fontWeight: 800,
                      padding: '10px 12px',
                      cursor: 'pointer',
                    }}
                  >
                    Cancelar pedido
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(false)}
                      disabled={cancelling}
                      style={{
                        flex: 1,
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.14)',
                        background: 'rgba(255,255,255,0.06)',
                        color: '#fff',
                        fontSize: 12.5,
                        fontWeight: 800,
                        padding: '10px 12px',
                        cursor: 'pointer',
                      }}
                    >
                      Mejor no
                    </button>
                    <button
                      type="button"
                      onClick={() => void cancelOrder()}
                      disabled={cancelling}
                      style={{
                        flex: 1,
                        borderRadius: 12,
                        border: 'none',
                        background: '#F43F5E',
                        color: '#fff',
                        fontSize: 12.5,
                        fontWeight: 900,
                        padding: '10px 12px',
                        cursor: cancelling ? 'wait' : 'pointer',
                        opacity: cancelling ? 0.7 : 1,
                      }}
                    >
                      {cancelling ? 'Cancelando…' : 'Sí, cancelar'}
                    </button>
                  </div>
                )}
              </div>
            )}

            <p style={{ margin: '14px 0 0', fontSize: 10.5, color: 'rgba(255,255,255,0.35)' }}>
              Se actualiza solo cada 20 s. También recibirás un aviso en cada cambio.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
