'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LocateFixed, Navigation, ExternalLink } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';

/**
 * Rabbitty Move (P0, sin APIs).
 *
 * Rabbitty es el punto de entrada: abre el proveedor con origen y destino
 * precargados cuando el proveedor lo permite. El precio, la asignación del
 * conductor y el viaje los opera el proveedor; aquí no se promete nada más.
 */

const DIDI_WEB = 'https://web.didiglobal.com/mx/';
/** Client ID público de Uber (opcional). Con él se usa el universal link. */
const UBER_CLIENT_ID = process.env.NEXT_PUBLIC_UBER_CLIENT_ID || '';

export default function MovePage() {
  const router = useRouter();
  const [pickupLabel, setPickupLabel] = useState('Mi ubicación');
  const [dropoff, setDropoff] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [destName, setDestName] = useState<string | null>(null);

  // Si venimos de una página de afiliado, el destino ya está precargado.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const to = params.get('to');
    const name = params.get('name');
    if (to) setDropoff(to);
    if (name) setDestName(name);
  }, []);

  const useMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Este dispositivo no permite obtener la ubicación.');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPickupLabel('Mi ubicación');
        setLocating(false);
        PlatformBridge.hapticFeedback('success');
      },
      () => {
        setLocating(false);
        setError('No pudimos obtener tu ubicación. Escribe el punto de partida.');
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  };

  /**
   * Deep link estándar (`uber://riderequest`) — el recomendado por Uber cuando
   * se enlaza desde una app nativa. No requiere client_id.
   * Doc: developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction
   */
  const buildUberAppLink = () => {
    const parts: string[] = [];
    if (coords) {
      parts.push(`pickup[latitude]=${coords.lat}`);
      parts.push(`pickup[longitude]=${coords.lng}`);
      parts.push(`pickup[nickname]=${encodeURIComponent(pickupLabel || 'Mi ubicación')}`);
    } else {
      parts.push(`pickup[formatted_address]=${encodeURIComponent(pickupLabel || 'Mi ubicación')}`);
    }
    parts.push(`dropoff[formatted_address]=${encodeURIComponent(dropoff.trim())}`);
    parts.push(`dropoff[nickname]=${encodeURIComponent(dropoff.trim())}`);
    return `uber://riderequest?${parts.join('&')}`;
  };

  /**
   * Universal link (m.uber.com/looking): requiere client_id público. Sirve
   * también desde web y cae a App Store si no hay app instalada.
   */
  const buildUberUniversalLink = () => {
    const pickup = coords
      ? { latitude: coords.lat, longitude: coords.lng, addressLine1: pickupLabel || 'Mi ubicación' }
      : { addressLine1: pickupLabel || 'Mi ubicación' };
    const drop = { addressLine1: dropoff.trim() };
    return (
      `https://m.uber.com/looking?client_id=${encodeURIComponent(UBER_CLIENT_ID)}` +
      `&pickup=${encodeURIComponent(JSON.stringify(pickup))}` +
      `&drop[0]=${encodeURIComponent(JSON.stringify(drop))}`
    );
  };

  const openUber = () => {
    if (!dropoff.trim()) {
      setError('Escribe a dónde quieres ir.');
      return;
    }
    setError(null);
    PlatformBridge.hapticFeedback('medium');

    if (!PlatformBridge.isNative()) {
      // Web: universal link (o el sitio de Uber si aún no hay client_id).
      void PlatformBridge.openExternalUrl(
        UBER_CLIENT_ID ? buildUberUniversalLink() : 'https://m.uber.com/',
      );
      return;
    }

    if (UBER_CLIENT_ID) {
      // Con client_id, el universal link abre la app si está instalada.
      void PlatformBridge.openExternalUrl(buildUberUniversalLink());
      return;
    }

    // Sin client_id: esquema estándar. Si la app no está instalada, el WebView
    // no cambia de pantalla y caemos a la web de Uber.
    let left = false;
    const markLeft = () => {
      left = true;
    };
    window.addEventListener('blur', markLeft, { once: true });
    document.addEventListener('visibilitychange', markLeft, { once: true });
    window.location.href = buildUberAppLink();
    window.setTimeout(() => {
      window.removeEventListener('blur', markLeft);
      if (left || document.visibilityState === 'hidden') return;
      void PlatformBridge.openExternalUrl('https://m.uber.com/');
    }, 1400);
  };

  const openDidi = () => {
    PlatformBridge.hapticFeedback('medium');
    void PlatformBridge.openExternalUrl(DIDI_WEB);
  };

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
          Rabbitty Move
        </span>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '8px 16px 0' }}>
        <div
          style={{
            borderRadius: 22,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
            backdropFilter: 'blur(22px)',
            WebkitBackdropFilter: 'blur(22px)',
            padding: 16,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 18px 44px -22px rgba(0,0,0,0.7), 0 0 60px -24px rgba(233,30,99,0.5)',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              insetInline: 0,
              top: 0,
              height: 3,
              background: 'linear-gradient(90deg,#FF2E93,#E91E63,#8B5CF6)',
              opacity: 0.9,
            }}
          />
          <p style={{ margin: 0, fontSize: 17, fontWeight: 900, letterSpacing: '-0.3px' }}>
            Muévete con los servicios disponibles
          </p>
          {destName && (
            <p
              style={{
                margin: '6px 0 0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: 999,
                border: '1px solid rgba(255,143,184,0.35)',
                background: 'rgba(233,30,99,0.12)',
                color: '#FF8FB8',
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 9px',
              }}
            >
              Destino: {destName}
            </p>
          )}
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
            Rabbitty abre la app del proveedor con tu origen y destino. El precio y el viaje los opera el proveedor.
          </p>

          <label style={{ display: 'block', marginTop: 16 }}>
            <span style={{ display: 'block', fontSize: 10, fontWeight: 900, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
              Desde
            </span>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <input
                value={pickupLabel}
                onChange={(e) => setPickupLabel(e.target.value)}
                placeholder="Punto de partida"
                style={{
                  flex: 1,
                  minWidth: 0,
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontSize: 13.5,
                  padding: '11px 12px',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={useMyLocation}
                disabled={locating}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 12,
                  border: '1px solid rgba(233,30,99,0.35)',
                  background: 'rgba(233,30,99,0.12)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '0 12px',
                  cursor: locating ? 'wait' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <LocateFixed size={14} />
                {locating ? 'Ubicando…' : coords ? 'Actualizada' : 'Mi ubicación'}
              </button>
            </div>
          </label>

          <label style={{ display: 'block', marginTop: 14 }}>
            <span style={{ display: 'block', fontSize: 10, fontWeight: 900, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
              A dónde vas
            </span>
            <input
              value={dropoff}
              onChange={(e) => setDropoff(e.target.value)}
              placeholder="Calle, número, colonia o lugar"
              style={{
                marginTop: 6,
                width: '100%',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)',
                color: '#fff',
                fontSize: 13.5,
                padding: '11px 12px',
                outline: 'none',
              }}
            />
          </label>

          {error && (
            <p style={{ margin: '10px 0 0', fontSize: 12, color: '#FB7185' }}>{error}</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
            <button
              type="button"
              onClick={openUber}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                borderRadius: 14,
                border: '1px solid rgba(255,46,147,0.45)',
                background: 'linear-gradient(135deg, rgba(233,30,99,0.85), rgba(139,92,246,0.85))',
                color: '#fff',
                padding: '13px 14px',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: '0 10px 26px -14px rgba(233,30,99,0.8)',
              }}
            >
              <span style={{ fontSize: 18 }}>🚗</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 900 }}>Abrir Uber</span>
                <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                  Origen y destino precargados · Uber calcula el precio
                </span>
              </span>
              <ExternalLink size={15} style={{ opacity: 0.6 }} />
            </button>

            <button
              type="button"
              onClick={openDidi}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(255,255,255,0.06)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                color: '#fff',
                padding: '13px 14px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 18 }}>🟠</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 900 }}>Abrir DiDi</span>
                <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                  Se abre DiDi; el destino se elige ahí
                </span>
              </span>
              <ExternalLink size={15} style={{ opacity: 0.6 }} />
            </button>
          </div>

          <div
            style={{
              marginTop: 16,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.03)',
              padding: '10px 12px',
            }}
          >
            <Navigation size={14} style={{ marginTop: 2, opacity: 0.6 }} />
            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: 'rgba(255,255,255,0.55)' }}>
              Rabbitty no opera el viaje ni cobra la tarifa: solo te lleva más rápido al proveedor. Pronto podrás
              pedir un Rabbitty Ride desde aquí.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
