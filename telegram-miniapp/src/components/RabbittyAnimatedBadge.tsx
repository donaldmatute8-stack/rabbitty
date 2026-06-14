'use client';

import React from "react";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";

interface RabbittyAnimatedBadgeProps {
  value: string;
  size?: number;
}

export function RabbittyAnimatedBadge({
  value,
  size = 280
}: RabbittyAnimatedBadgeProps) {
  const center = size / 2;

  // Alturas de barras para el espectro de audio (consistentes pero variadas)
  const barHeights = [25, 45, 20, 60, 35, 50, 30, 22];

  return (
    <div className="relative flex flex-col items-center justify-center p-2">
      {/* Resplandor neón difuminado de fondo */}
      <motion.div
        animate={{ opacity: [0.15, 0.35, 0.15] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 rounded-[40px] bg-gradient-to-tr from-pink-500/10 to-purple-500/10 opacity-30 blur-3xl pointer-events-none"
      />

      <svg width={size} height={size + 40} viewBox={`0 0 ${size} ${size + 40}`} className="overflow-visible">
        <defs>
          {/* Degradado Neón Rabbitty */}
          <linearGradient id="badge-neon-glow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E91E63" /> {/* Pink */}
            <stop offset="100%" stopColor="#8B5CF6" /> {/* Purple */}
          </linearGradient>

          {/* Filtro de Resplandor Neón */}
          <filter id="neon-glow-effect" x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 1. SILUETA GEOMÉTRICA DE CONEJO CON EFECTO BREATH (PULSO) */}
        <motion.path
          d={`
            M ${size * 0.5} ${size * 0.32} 
            L ${size * 0.22} ${size * 0.02} 
            L ${size * 0.35} ${size * 0.30} 
            L ${size * 0.15} ${size * 0.50} 
            L ${size * 0.25} ${size * 0.85} 
            L ${size * 0.5} ${size * 0.94} 
            L ${size * 0.75} ${size * 0.85} 
            L ${size * 0.85} ${size * 0.50} 
            L ${size * 0.65} ${size * 0.30} 
            L ${size * 0.78} ${size * 0.02} 
            Z
          `}
          fill="#09090b"
          fillOpacity={0.75}
          stroke="url(#badge-neon-glow)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          filter="url(#neon-glow-effect)"
          animate={{ strokeWidth: [2.5, 3.8, 2.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Facetas internas para el look de cristal */}
        <path
          d={`
            M ${size * 0.5} ${size * 0.32} L ${size * 0.35} ${size * 0.30} 
            M ${size * 0.5} ${size * 0.32} L ${size * 0.65} ${size * 0.30}
            M ${size * 0.5} ${size * 0.32} L ${size * 0.5} ${size * 0.94}
          `}
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth={1.5}
        />

        {/* 2. RIPPLES CON DASH-ARRAY GIRATORIO */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: `${center}px ${center + 20}px` }}
        >
          <circle cx={center} cy={center + 20} r={55} fill="none" stroke="url(#badge-neon-glow)" strokeWidth={1.2} strokeDasharray="5,10" opacity={0.35} />
          <circle cx={center} cy={center + 20} r={80} fill="none" stroke="url(#badge-neon-glow)" strokeWidth={1.2} strokeDasharray="8,15" opacity={0.2} />
        </motion.g>

        {/* 3. ESPECTRO DE AUDIOWAVE ANIMADO (EQUALIZER) */}
        <g fill="url(#badge-neon-glow)">
          {barHeights.map((maxH, idx) => {
            const x = center - 48 + idx * 14;
            return (
              <motion.rect
                key={idx}
                x={x - 2}
                y={center + 20 - maxH / 2}
                width={4}
                height={maxH}
                rx={2}
                animate={{
                  height: [maxH * 0.3, maxH, maxH * 0.3],
                  y: [center + 20 - (maxH * 0.3) / 2, center + 20 - maxH / 2, center + 20 - (maxH * 0.3) / 2]
                }}
                transition={{
                  duration: 1.2 + idx * 0.15,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            );
          })}
        </g>

        {/* 4. ESCUDO CENTRAL CON MICRO-QR ESTÁTICO OCULTO */}
        <g transform={`translate(${center}, ${center + 20})`}>
          {/* Vidrio esmerilado de fondo */}
          <circle r={22} fill="#09090b" stroke="url(#badge-neon-glow)" strokeWidth={1.5} />
          
          {/* Renderizado de Micro-QR SVG estático para lectura */}
          <g transform="translate(-11, -11)">
            <QRCodeSVG
              value={value}
              size={22}
              level="M"
              bgColor="transparent"
              fgColor="#FFFFFF"
            />
          </g>
        </g>
      </svg>
      
      {/* 5. CÓDIGO ALFANUMÉRICO DE RESPALDO (MANUAL) */}
      <div className="mt-4 bg-white/[0.04] border border-white/5 rounded-full px-4 py-1.5 text-center shadow-[0_0_20px_rgba(255,255,255,0.02)]">
        <span className="text-[10px] text-white/50 uppercase tracking-[3px] font-mono">
          {value.substring(0, 12).toUpperCase()}
        </span>
      </div>
    </div>
  );
}
