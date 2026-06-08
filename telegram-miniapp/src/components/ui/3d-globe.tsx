'use client';

import React, { useEffect, useRef, useState } from "react";
import createGlobe from "cobe";
import { motion } from "framer-motion";

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
  config?: any;
  onMarkerClick?: (marker: GlobeMarker) => void;
  onMarkerHover?: (marker: GlobeMarker | null) => void;
};



export function Globe3D({ markers, config, onMarkerClick, onMarkerHover }: Globe3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    
    let currentPhi = 0;
    let currentTheta = 0.3;
    
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    if (dimensions.width === 0) return;

    const globeSize = Math.round(Math.min(dimensions.width, dimensions.height)); // Best fit square, rounded

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: globeSize * 2,
      height: globeSize * 2,
      phi: 0,
      theta: 0.3,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.3, 0.3, 0.3], // Aceternity default
      markerColor: [233 / 255, 30 / 255, 99 / 255], // E91E63 Pink
      glowColor: [1, 1, 1], // Aceternity default
      markers: markers.map(m => ({ location: [Number(m.lat), Number(m.lng)], size: 0.05 })),
      // @ts-ignore
      onRender: (state: Record<string, any>) => {
        if (!pointerInteracting.current) {
          currentPhi += 0.005;
        }
        state.phi = currentPhi + pointerInteractionMovement.current;
        state.theta = currentTheta;
      },
    } as any);

    return () => {
      globe.destroy();
      window.removeEventListener('resize', updateDimensions);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions.width, dimensions.height]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative", display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: pointerInteracting.current ? 'grabbing' : 'grab' }}>
      <canvas
        ref={canvasRef}
        style={{ 
          width: Math.min(dimensions.width, dimensions.height), 
          height: Math.min(dimensions.width, dimensions.height), 
          maxWidth: "100%", 
          aspectRatio: "1 / 1",
          contain: "layout paint size", 
          opacity: 1, 
          transition: "opacity 1s ease",
          objectFit: "contain"
        }}
        onPointerDown={(e) => {
          pointerInteracting.current = e.clientX;
          if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
        }}
        onPointerUp={() => {
          pointerInteracting.current = null;
          if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
        }}
        onPointerOut={() => {
          pointerInteracting.current = null;
          if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
        }}
        onPointerMove={(e) => {
          if (pointerInteracting.current !== null) {
            const delta = e.clientX - pointerInteracting.current;
            pointerInteractionMovement.current = delta * 0.01;
          }
        }}
        onTouchMove={(e) => {
          if (pointerInteracting.current !== null && e.touches[0]) {
            const delta = e.touches[0].clientX - pointerInteracting.current;
            pointerInteractionMovement.current = delta * 0.01;
          }
        }}
      />


    </div>
  );
}
