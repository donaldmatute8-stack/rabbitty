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
  size = 220
}: RabbittyAnimatedBadgeProps) {
  // Dimensiones del espacio interno del SVG (viewBox fijo 240x320 para escalar de forma responsiva)
  const width = 240;
  const height = 320;
  
  const cx = 120;
  const cy = 185;

  // Facetas del conejo low-poly (coordenadas de triángulos del modelo 4A)
  const facets = [
    "78,10 66,50 90,68",      // Oreja Izquierda Exterior
    "78,10 90,68 102,55",     // Oreja Izquierda Interior
    "162,10 174,50 150,68",   // Oreja Derecha Exterior
    "162,10 150,68 138,55",   // Oreja Derecha Interior
    "102,55 120,55 120,75",   // Frente Central Izquierda
    "138,55 120,55 120,75",   // Frente Central Derecha
    "102,55 90,68 120,75",    // Frente Lateral Izquierda
    "138,55 150,68 120,75",   // Frente Lateral Derecha
    "90,68 72,90 120,95",     // Mejilla Izquierda
    "150,68 168,90 120,95",    // Mejilla Derecha
    "90,68 120,75 120,95",    // Centro Izquierda
    "150,68 120,75 120,95",   // Centro Derecha
    "72,90 120,115 120,95",   // Hocico Izquierda
    "168,90 120,115 120,95"    // Hocico Derecha
  ];

  // Espectro de barras de sonido del ecualizador
  const barHeights = [12, 22, 38, 48, 32, 20, 24, 42, 52, 36, 18, 10];
  const barWidth = 6;
  const gap = 5;
  const xStart = cx - ((barHeights.length * barWidth + (barHeights.length - 1) * gap) / 2);

  return (
    <div className="relative flex flex-col items-center justify-center p-2">
      {/* Resplandor neón difuminado de fondo detrás de la tarjeta */}
      <motion.div
        animate={{ opacity: [0.15, 0.35, 0.15] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 rounded-[40px] bg-gradient-to-tr from-pink-500/10 to-purple-500/10 opacity-30 blur-3xl pointer-events-none"
      />

      {/* SVG con viewBox fijo para escalado automático responsivo */}
      <svg 
        width={size} 
        height={size * (height / width)} 
        viewBox={`0 0 ${width} ${height}`} 
        className="overflow-visible"
      >
        <defs>
          {/* Degradado Neón Rabbitty */}
          <linearGradient id="badge-neon-glow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E91E63" /> {/* Pink */}
            <stop offset="100%" stopColor="#8B5CF6" /> {/* Purple */}
          </linearGradient>

          {/* Degradado de fondo para la tarjeta de cristal */}
          <linearGradient id="card-bg-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#121217" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#08080b" stopOpacity="0.95" />
          </linearGradient>

          {/* Filtro de Resplandor Neón */}
          <filter id="neon-glow-effect" x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 1. TARJETA RECTANGULAR DE CRISTAL (CUERPO DEL BADGE) */}
        <rect
          x="20"
          y="80"
          width="200"
          height="220"
          rx="24"
          ry="24"
          fill="url(#card-bg-gradient)"
          stroke="url(#badge-neon-glow)"
          strokeWidth="2"
          strokeOpacity="0.8"
          className="shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]"
        />

        {/* Líneas decorativas internas de alta tecnología (cuadrícula cyberpunk sutil) */}
        <path
          d="M 35 110 L 205 110 M 35 250 L 205 250"
          stroke="rgba(255, 255, 255, 0.03)"
          strokeWidth="1.5"
        />

        {/* 2. RIPPLES DE ONDAS CONCÉNTRICAS (ANIMACIÓN RADAR DE FUEGO) */}
        {/* Ripples fijos transparentes */}
        <circle cx={cx} cy={cy} r={44} fill="none" stroke="rgba(233,30,99,0.06)" strokeWidth={1} />
        <circle cx={cx} cy={cy} r={64} fill="none" stroke="rgba(139,92,246,0.04)" strokeWidth={1} />
        <circle cx={cx} cy={cy} r={84} fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth={1} />

        {/* Ripples animados expansivos */}
        {[0, 1, 2].map((i) => (
          <motion.circle
            key={i}
            cx={cx}
            cy={cy}
            r={24}
            fill="none"
            stroke="url(#badge-neon-glow)"
            strokeWidth={1.5}
            animate={{
              r: [24, 94],
              opacity: [0.5, 0]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: i * 1.0,
              ease: "easeOut"
            }}
          />
        ))}

        {/* 3. CORCHETES DE ENCUADRE DE ALTA TECNOLOGÍA (FINDER BRACKETS) */}
        <g stroke="url(#badge-neon-glow)" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6">
          {/* Top Left */}
          <path d="M 88 153 L 80 153 L 80 161" />
          {/* Top Right */}
          <path d="M 152 153 L 160 153 L 160 161" />
          {/* Bottom Left */}
          <path d="M 88 217 L 80 217 L 80 209" />
          {/* Bottom Right */}
          <path d="M 152 217 L 160 217 L 160 209" />
        </g>

        {/* Texto de Identidad de Marca dentro de la tarjeta */}
        <text 
          x={cx} 
          y={134} 
          textAnchor="middle" 
          fill="rgba(255,255,255,0.4)" 
          fontSize="7" 
          fontWeight="900" 
          letterSpacing="4"
          className="font-sans select-none"
        >
          RABBITTY CODE
        </text>

        {/* 4. ECUALIZADOR DE ONDAS DE SONIDO (SOUNDWAVE EQ) */}
        <g fill="url(#badge-neon-glow)">
          {barHeights.map((maxH, idx) => {
            const x = xStart + idx * (barWidth + gap);
            const baselineY = 270;
            return (
              <motion.rect
                key={idx}
                x={x}
                y={baselineY - maxH}
                width={barWidth}
                height={maxH}
                rx={2.5}
                animate={{
                  height: [maxH * 0.2, maxH, maxH * 0.2],
                  y: [baselineY - maxH * 0.2, baselineY - maxH, baselineY - maxH * 0.2]
                }}
                transition={{
                  duration: 1.1 + (idx % 3) * 0.25,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: idx * 0.08
                }}
              />
            );
          })}
        </g>

        {/* 5. CROWN: CABEZA DE CONEJO GEOMÉTRICA EN LA PARTE SUPERIOR (OVERLAP) */}
        <g>
          {/* Facetas de cristal semitransparentes */}
          <g>
            {facets.map((f, i) => (
              <polygon
                key={i}
                points={f}
                fill={i % 2 === 0 ? "rgba(233,30,99,0.08)" : "rgba(139,92,246,0.08)"}
                stroke="rgba(255, 255, 255, 0.06)"
                strokeWidth={0.8}
              />
            ))}
          </g>

          {/* Bordes/Silueta de Neón de la corona */}
          <motion.path
            d="M 78 10 L 66 50 L 72 90 L 120 115 L 168 90 L 174 50 L 162 10 L 138 55 L 120 55 L 102 55 Z"
            fill="none"
            stroke="url(#badge-neon-glow)"
            strokeWidth={2}
            strokeLinejoin="round"
            filter="url(#neon-glow-effect)"
            animate={{ strokeWidth: [2.0, 3.2, 2.0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Facetas decorativas que conectan la frente para lucir cristal */}
          <path
            d="M 120 55 L 120 75 M 102 55 L 120 75 M 138 55 L 120 75 M 90 68 L 120 75 M 150 68 L 120 75 M 120 75 L 120 95 M 90 68 L 120 95 M 150 68 L 120 95"
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth={1}
            fill="none"
          />
        </g>

        {/* 6. ESCUDO CENTRAL CON MICRO-QR LEÍBLE POR CÁMARAS */}
        <g transform={`translate(${cx}, ${cy})`}>
          {/* Círculo central negro con borde neón */}
          <circle r={22} fill="#0b0b0d" stroke="url(#badge-neon-glow)" strokeWidth={1.5} />
          
          {/* Micro-QR estático centrado */}
          <g transform="translate(-13, -13)">
            <QRCodeSVG
              value={value}
              size={26}
              level="M"
              bgColor="transparent"
              fgColor="#FFFFFF"
            />
          </g>
        </g>
      </svg>
      
      {/* 7. TEXTO DE RESPALDO ALFANUMÉRICO */}
      <div className="mt-4 bg-white/[0.03] border border-white/5 rounded-full px-4 py-1.5 text-center shadow-[0_0_20px_rgba(0,0,0,0.4)]">
        <span className="text-[10px] text-white/50 uppercase tracking-[3px] font-mono select-all">
          {value.substring(0, 12).toUpperCase()}
        </span>
      </div>
    </div>
  );
}
