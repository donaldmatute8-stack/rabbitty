'use client';

import React, { useEffect, useRef, useState } from "react";
import createGlobe from "cobe";
import { Plus, Minus, RotateCcw } from "lucide-react";
import { PlatformBridge } from "@/lib/platform";

export type GlobeMarker = {
  id?: string;
  lat: number;
  lng: number;
  src?: string;
  label: string;
  bunzCost?: number;
};

export type Globe3DProps = {
  markers: GlobeMarker[];
  config?: Record<string, unknown>;
  onMarkerClick?: (marker: GlobeMarker) => void;
  onMarkerHover?: (marker: GlobeMarker | null) => void;
};

// cobe constants (mirrors dist/index.esm.js): globeRadius + markerElevation
const MARKER_RADIUS = 0.8 + 0.05;
const CLAMP_THETA = (t: number) => Math.max(-1.15, Math.min(1.15, t));
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 2.6;

/**
 * Projects a [lat, lng] into canvas-relative [0..1] coordinates using the exact
 * math cobe uses internally, so tap hit-testing stays in sync with the render.
 */
function projectCoords(lat: number, lng: number, phi: number, theta: number, scale: number) {
  const latR = (lat * Math.PI) / 180;
  const lngR = (lng * Math.PI) / 180 - Math.PI;
  const cosLat = Math.cos(latR);
  const px = -cosLat * Math.cos(lngR) * MARKER_RADIUS;
  const py = Math.sin(latR) * MARKER_RADIUS;
  const pz = cosLat * Math.sin(lngR) * MARKER_RADIUS;

  const cf = Math.cos(phi);
  const sf = Math.sin(phi);
  const ct = Math.cos(theta);
  const st = Math.sin(theta);

  const c = cf * px + sf * pz;
  const s = sf * st * px + ct * py - cf * st * pz;
  const facing = -sf * ct * px + st * py + cf * ct * pz >= 0 || c * c + s * s >= 0.64;

  return {
    x: (c * scale + 1) / 2,
    y: (-s * scale + 1) / 2,
    visible: facing,
  };
}

export function Globe3D({ markers, onMarkerClick, onMarkerHover }: Globe3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Globe orientation state
  const phiRef = useRef(0);
  const thetaRef = useRef(0.25);
  const zoomScaleRef = useRef(1.0);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [selectedMarker, setSelectedMarker] = useState<GlobeMarker | null>(null);
  const [dragging, setDragging] = useState(false);

  // Pointer tracking (unified mouse / touch / pen)
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const velocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const tapRef = useRef<{ x: number; y: number; t: number; id: number } | null>(null);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Resize handling
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Initialize cobe (v2 API: createGlobe().update() drives every frame)
  useEffect(() => {
    if (!canvasRef.current || dimensions.width === 0 || dimensions.height === 0) return;

    const baseSize = Math.round(Math.min(dimensions.width, dimensions.height));
    if (baseSize <= 0) return;

    const cobeMarkers = markers.map((m, i) => ({
      id: m.id || `marker-${i}`,
      location: [Number(m.lat), Number(m.lng)] as [number, number],
      size: 0.05,
    }));

    let globe: ReturnType<typeof createGlobe> | null = null;

    try {
      globe = createGlobe(canvasRef.current, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width: baseSize,
        height: baseSize,
        phi: phiRef.current,
        theta: thetaRef.current,
        scale: zoomScaleRef.current,
        dark: 1,
        diffuse: 1.4,
        mapSamples: 16000,
        mapBrightness: 5.5,
        baseColor: [0.15, 0.15, 0.22],
        markerColor: [233 / 255, 30 / 255, 99 / 255],
        glowColor: [0.9, 0.2, 0.5],
        markers: cobeMarkers,
      });
    } catch (e) {
      console.error("[Globe3D] Cobe init error:", e);
      return;
    }

    const loop = () => {
      if (!isDraggingRef.current) {
        velocityRef.current.x *= 0.94;
        velocityRef.current.y *= 0.94;

        if (Math.abs(velocityRef.current.x) < 0.0005) {
          phiRef.current += 0.003; // gentle ambient spin
        } else {
          phiRef.current += velocityRef.current.x;
        }
        thetaRef.current = CLAMP_THETA(thetaRef.current + velocityRef.current.y);
      }

      try {
        globe?.update({
          phi: phiRef.current,
          theta: thetaRef.current,
          scale: zoomScaleRef.current,
        });
      } catch {}

      animationFrame = requestAnimationFrame(loop);
    };

    let animationFrame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrame);
      if (globe && typeof globe.destroy === "function") globe.destroy();
    };
  }, [dimensions.width, dimensions.height, markers]);

  // Project a tap point against every marker and return the closest hit.
  const findMarkerAt = (clientX: number, clientY: number): GlobeMarker | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const threshold = 34;
    let best: GlobeMarker | null = null;
    let bestDist = threshold;

    for (const m of markers) {
      const p = projectCoords(Number(m.lat), Number(m.lng), phiRef.current, thetaRef.current, zoomScaleRef.current);
      if (!p.visible) continue;
      const sx = rect.left + p.x * rect.width;
      const sy = rect.top + p.y * rect.height;
      const d = Math.hypot(clientX - sx, clientY - sy);
      if (d < bestDist) {
        bestDist = d;
        best = m;
      }
    }
    return best;
  };

  const pinchDistance = () => {
    const pts = Array.from(pointersRef.current.values());
    if (pts.length < 2) return null;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1) {
      isDraggingRef.current = true;
      setDragging(true);
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      velocityRef.current = { x: 0, y: 0 };
      tapRef.current = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId };
    } else if (pointersRef.current.size === 2) {
      isDraggingRef.current = false;
      setDragging(false);
      tapRef.current = null;
      const dist = pinchDistance();
      if (dist) pinchRef.current = { dist, zoom: zoomScaleRef.current };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Pinch zoom
    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const dist = pinchDistance();
      if (dist) {
        const factor = dist / pinchRef.current.dist;
        const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchRef.current.zoom * factor));
        zoomScaleRef.current = nextZoom;
        setZoomLevel(nextZoom);
      }
      return;
    }

    // Single-pointer rotate
    if (!isDraggingRef.current || !lastPointerRef.current) {
      // Hover feedback on desktop
      if (pointersRef.current.size === 1 && onMarkerHover) {
        onMarkerHover(findMarkerAt(e.clientX, e.clientY));
      }
      return;
    }

    const dx = e.clientX - lastPointerRef.current.x;
    const dy = e.clientY - lastPointerRef.current.y;

    const rotSensitivity = 0.005 / zoomScaleRef.current;
    phiRef.current += dx * rotSensitivity;
    thetaRef.current = CLAMP_THETA(thetaRef.current - dy * rotSensitivity);

    velocityRef.current = { x: dx * rotSensitivity * 0.8, y: -dy * rotSensitivity * 0.8 };
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const tap = tapRef.current;
    const wasSinglePointer = pointersRef.current.size === 1;

    pointersRef.current.delete(e.pointerId);
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);

    // Tap detection: single pointer, tiny movement, quick release.
    if (tap && wasSinglePointer && tap.id === e.pointerId) {
      const moved = Math.hypot(e.clientX - tap.x, e.clientY - tap.y);
      const elapsed = Date.now() - tap.t;
      if (moved < 10 && elapsed < 350) {
        const hit = findMarkerAt(e.clientX, e.clientY);
        if (hit) {
          PlatformBridge.hapticFeedback('medium');
          setSelectedMarker(hit);
          onMarkerClick?.(hit);
        }
      }
    }
    tapRef.current = null;

    if (pointersRef.current.size === 0) {
      isDraggingRef.current = false;
      setDragging(false);
      lastPointerRef.current = null;
      pinchRef.current = null;
    } else if (pointersRef.current.size === 1) {
      // Re-baseline drag from the remaining finger.
      const remaining = Array.from(pointersRef.current.values())[0];
      lastPointerRef.current = { x: remaining.x, y: remaining.y };
      isDraggingRef.current = true;
      setDragging(true);
      pinchRef.current = null;
    } else {
      pinchRef.current = null;
    }
  };

  // Wheel zoom for desktop testing
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomScaleRef.current + delta));
    zoomScaleRef.current = nextZoom;
    setZoomLevel(nextZoom);
  };

  const applyZoom = (delta: number) => {
    PlatformBridge.hapticFeedback('light');
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomScaleRef.current + delta));
    zoomScaleRef.current = next;
    setZoomLevel(next);
  };

  const focusOnCoordinates = (lat: number, lng: number) => {
    PlatformBridge.hapticFeedback('medium');
    const targetPhi = -lng * (Math.PI / 180) - Math.PI / 2;
    const targetTheta = lat * (Math.PI / 180);

    phiRef.current = targetPhi;
    thetaRef.current = CLAMP_THETA(targetTheta);
    zoomScaleRef.current = 1.6;
    setZoomLevel(1.6);
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={(e) => { if (!isDraggingRef.current) onMarkerHover?.(null); void e; }}
      className="relative w-full h-full flex items-center justify-center overflow-hidden select-none bg-radial from-[#120D1E] via-[#0A0713] to-black"
      style={{ touchAction: "none", cursor: dragging ? "grabbing" : "grab" }}
    >
      {/* Dynamic star/nebula background aura */}
      <div
        className="absolute w-[460px] h-[460px] rounded-full pointer-events-none opacity-25"
        style={{
          background: 'radial-gradient(circle, rgba(233,30,99,0.3) 0%, rgba(59,130,246,0.15) 50%, transparent 50%)',
        }}
      />

      <canvas
        ref={canvasRef}
        className="pointer-events-none"
        style={{
          width: Math.min(dimensions.width, dimensions.height) || '100%',
          height: Math.min(dimensions.width, dimensions.height) || '100%',
          maxWidth: '100%',
          maxHeight: '100%',
        }}
      />

      {/* Zoom controls */}
      <div className="absolute right-4 top-4 z-30 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => applyZoom(0.25)}
          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-lg border border-pink-500/30 flex items-center justify-center text-white active:scale-90 transition-transform"
          aria-label="Acercar"
        >
          <Plus size={18} />
        </button>
        <button
          type="button"
          onClick={() => applyZoom(-0.25)}
          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-lg border border-pink-500/30 flex items-center justify-center text-white active:scale-90 transition-transform"
          aria-label="Alejar"
        >
          <Minus size={18} />
        </button>
        <button
          type="button"
          onClick={() => {
            PlatformBridge.hapticFeedback('light');
            phiRef.current = 0;
            thetaRef.current = 0.25;
            zoomScaleRef.current = 1;
            setZoomLevel(1);
          }}
          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-lg border border-pink-500/30 flex items-center justify-center text-white active:scale-90 transition-transform"
          aria-label="Reiniciar"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Marker pill carousel */}
      {markers.length > 0 && (
        <div className="absolute bottom-6 left-4 right-4 z-30 flex gap-2 overflow-x-auto no-scrollbar py-2">
          {markers.slice(0, 8).map((m) => (
            <button
              type="button"
              key={m.id || m.label}
              onClick={() => {
                focusOnCoordinates(Number(m.lat), Number(m.lng));
                setSelectedMarker(m);
                if (onMarkerClick) onMarkerClick(m);
              }}
              className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-black/70 backdrop-blur-lg border border-pink-500/30 text-white text-xs font-bold shadow-lg hover:border-pink-500 active:scale-95 transition-all"
            >
              <span className="w-2 h-2 rounded-full bg-[#E91E63] shrink-0" />
              <span className="whitespace-nowrap">{m.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Selected marker card */}
      {selectedMarker && (
        <div className="absolute top-4 left-4 right-20 z-40 bg-black/85 backdrop-blur-lg border border-pink-500/30 rounded-2xl p-4 text-white shadow-2xl">
          <p className="text-[10px] font-black text-[#E91E63] tracking-[1.5px] uppercase mb-1">Negocio</p>
          <h3 className="text-lg font-black m-0 mb-1">{selectedMarker.label}</h3>
          {typeof selectedMarker.bunzCost === 'number' && (
            <p className="text-sm text-white/70 m-0">Desde {selectedMarker.bunzCost} BUNZ</p>
          )}
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => {
                focusOnCoordinates(Number(selectedMarker.lat), Number(selectedMarker.lng));
                onMarkerClick?.(selectedMarker);
              }}
              className="flex-1 py-2 rounded-xl bg-[#E91E63] text-white text-xs font-black border-0 active:scale-95 transition-transform"
            >
              Ver negocio
            </button>
            <button
              type="button"
              onClick={() => setSelectedMarker(null)}
              className="px-4 py-2 rounded-xl bg-white/10 text-white/70 text-xs font-black border-0 active:scale-95 transition-transform"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Zoom level indicator */}
      <div className="absolute left-4 top-4 z-30 px-2 py-1 rounded-lg bg-black/50 border border-white/10 text-[10px] font-mono text-white/60">
        {zoomLevel.toFixed(2)}x
      </div>
    </div>
  );
}

export default Globe3D;
