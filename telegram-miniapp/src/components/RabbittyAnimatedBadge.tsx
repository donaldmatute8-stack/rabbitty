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
  const cy = 220; // Centro de la zona del QR y ondas concéntricas

  // Facetas detalladas del conejo low-poly (coordenadas de triángulos 4A-3)
  const detailedFacets = [
    // --- OREJA IZQUIERDA ---
    { points: "75,5 55,45 85,45", fill: "rgba(233,30,99,0.06)", stroke: "rgba(233,30,99,0.25)" },
    { points: "75,5 85,45 95,70", fill: "rgba(139,92,246,0.12)", stroke: "rgba(139,92,246,0.3)" },
    { points: "55,45 75,75 85,45", fill: "rgba(233,30,99,0.08)", stroke: "rgba(233,30,99,0.25)" },
    { points: "85,45 75,75 95,70", fill: "rgba(139,92,246,0.15)", stroke: "rgba(139,92,246,0.3)" },

    // --- OREJA DERECHA ---
    { points: "165,5 185,45 155,45", fill: "rgba(233,30,99,0.06)", stroke: "rgba(233,30,99,0.25)" },
    { points: "165,5 155,45 145,70", fill: "rgba(139,92,246,0.12)", stroke: "rgba(139,92,246,0.3)" },
    { points: "185,45 165,75 155,45", fill: "rgba(233,30,99,0.08)", stroke: "rgba(233,30,99,0.25)" },
    { points: "155,45 165,75 145,70", fill: "rgba(139,92,246,0.15)", stroke: "rgba(139,92,246,0.3)" },

    // --- FRENTE ---
    { points: "95,70 145,70 120,75", fill: "rgba(56,189,248,0.08)", stroke: "rgba(56,189,248,0.25)" },
    { points: "95,70 120,60 145,70", fill: "rgba(139,92,246,0.15)", stroke: "rgba(139,92,246,0.25)" },
    { points: "75,75 95,70 120,75", fill: "rgba(233,30,99,0.05)", stroke: "rgba(233,30,99,0.2)" },
    { points: "165,75 145,70 120,75", fill: "rgba(233,30,99,0.05)", stroke: "rgba(233,30,99,0.2)" },

    // --- ÁREA DE OJOS ---
    { points: "75,75 120,75 95,90", fill: "rgba(139,92,246,0.08)", stroke: "rgba(139,92,246,0.2)" },
    { points: "165,75 120,75 145,90", fill: "rgba(139,92,246,0.08)", stroke: "rgba(139,92,246,0.2)" },
    { points: "95,90 145,90 120,75", fill: "rgba(56,189,248,0.12)", stroke: "rgba(56,189,248,0.3)" },

    // --- MEJILLAS SUPERIORES ---
    { points: "75,75 65,95 95,90", fill: "rgba(233,30,99,0.06)", stroke: "rgba(233,30,99,0.2)" },
    { points: "165,75 175,95 145,90", fill: "rgba(233,30,99,0.06)", stroke: "rgba(233,30,99,0.2)" },

    // --- NARIZ SUPERIOR ---
    { points: "95,90 120,75 120,100", fill: "rgba(139,92,246,0.1)", stroke: "rgba(139,92,246,0.2)" },
    { points: "145,90 120,75 120,100", fill: "rgba(139,92,246,0.1)", stroke: "rgba(139,92,246,0.2)" },

    // --- MEJILLAS INFERIORES Y MANDÍBULA ---
    { points: "65,95 80,115 100,105", fill: "rgba(233,30,99,0.08)", stroke: "rgba(233,30,99,0.2)" },
    { points: "175,95 160,115 140,105", fill: "rgba(233,30,99,0.08)", stroke: "rgba(233,30,99,0.2)" },
    { points: "95,90 100,105 120,100", fill: "rgba(56,189,248,0.06)", stroke: "rgba(56,189,248,0.2)" },
    { points: "145,90 140,105 120,100", fill: "rgba(56,189,248,0.06)", stroke: "rgba(56,189,248,0.2)" },
    { points: "65,95 100,105 95,90", fill: "rgba(139,92,246,0.05)", stroke: "rgba(139,92,246,0.15)" },
    { points: "175,95 140,105 145,90", fill: "rgba(139,92,246,0.05)", stroke: "rgba(139,92,246,0.15)" },

    // --- HOCICO Y MENTÓN ---
    { points: "100,105 120,120 120,100", fill: "rgba(233,30,99,0.1)", stroke: "rgba(233,30,99,0.25)" },
    { points: "140,105 120,120 120,100", fill: "rgba(233,30,99,0.1)", stroke: "rgba(233,30,99,0.25)" },
    { points: "80,115 120,120 100,105", fill: "rgba(139,92,246,0.12)", stroke: "rgba(139,92,246,0.25)" },
    { points: "160,115 120,120 140,105", fill: "rgba(139,92,246,0.12)", stroke: "rgba(139,92,246,0.25)" }
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
            <stop offset="0%" stopColor="#E91E63" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>

          {/* Degradado de Ripples Concéntricos (Soundwave) */}
          <linearGradient id="ripple-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" /> {/* Cyan/Light Blue */}
            <stop offset="50%" stopColor="#8B5CF6" /> {/* Purple */}
            <stop offset="100%" stopColor="#E91E63" /> {/* Pink */}
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

        {/* 2. CROWN: CABEZA DE CONEJO GEOMÉTRICA EN LA PARTE SUPERIOR (OVERLAP) */}
        <g>
          {/* Facetas de cristal semitransparentes */}
          <g>
            {detailedFacets.map((facet, i) => (
              <polygon
                key={i}
                points={facet.points}
                fill={facet.fill}
                stroke={facet.stroke}
                strokeWidth={0.8}
              />
            ))}
          </g>

          {/* Bordes/Silueta de Neón de la corona */}
          <motion.path
            d="M 120 120 L 80 115 L 65 95 L 75 75 L 55 45 L 75 5 L 85 45 L 95 70 L 120 60 L 145 70 L 155 45 L 165 5 L 185 45 L 165 75 L 175 95 L 160 115 Z"
            fill="none"
            stroke="url(#badge-neon-glow)"
            strokeWidth={2}
            strokeLinejoin="round"
            filter="url(#neon-glow-effect)"
            animate={{ strokeWidth: [2.0, 3.2, 2.0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Líneas de conexión internas adicionales para efecto 3D */}
          <path
            d="M 95 70 L 145 70 M 120 75 L 120 100 M 95 90 L 145 90 M 100 105 L 140 105"
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth={1}
            fill="none"
          />
        </g>

        {/* 3. LOGO Y TEXTO DE BRANDING SUPERIOR DE LA TARJETA */}
        <g transform="translate(120, 142)">
          {/* Conejo miniatura */}
          <path 
            d="M -30,-5 L -33,-1 L -32,2 L -28,3 L -24,2 L -23,-1 L -26,-5 L -27,-2 L -29,-2 Z" 
            fill="#E91E63" 
          />
          <text 
            textAnchor="middle" 
            fill="rgba(255,255,255,0.9)" 
            fontSize="9" 
            fontWeight="900" 
            letterSpacing="5"
            className="font-sans select-none"
          >
            RABBITTY
          </text>
        </g>

        {/* 4. CONTENEDOR DEL DETALLE DEL CÓDIGO (Línea de corte decorativa) */}
        <rect
          x="32"
          y="155"
          width="176"
          height="130"
          rx="16"
          fill="#07070b"
          stroke="rgba(255,255,255,0.03)"
          strokeWidth="1.5"
        />

        {/* 5. RIPPLES DE ONDAS CONCÉNTRICAS ANIMADAS (SOUNDWAVE RIPPLE 4A-3) */}
        {/* Ripples concéntricos estáticos */}
        <circle cx={cx} cy={cy} r={28} fill="none" stroke="rgba(56, 189, 248, 0.08)" strokeWidth={1} />
        <circle cx={cx} cy={cy} r={46} fill="none" stroke="rgba(139, 92, 246, 0.06)" strokeWidth={1.5} />
        <circle cx={cx} cy={cy} r={64} fill="none" stroke="rgba(233, 30, 99, 0.04)" strokeWidth={1.5} />
        <circle cx={cx} cy={cy} r={80} fill="none" stroke="rgba(255, 255, 255, 0.02)" strokeWidth={1} />

        {/* Ripples concéntricos animados de onda dual (cyan/pink) */}
        {[0, 1, 2].map((i) => (
          <motion.circle
            key={i}
            cx={cx}
            cy={cy}
            r={18}
            fill="none"
            stroke="url(#ripple-gradient)"
            strokeWidth={1.5}
            animate={{
              r: [18, 75],
              opacity: [0.65, 0]
            }}
            transition={{
              duration: 3.5,
              repeat: Infinity,
              delay: i * 1.15,
              ease: "easeOut"
            }}
          />
        ))}

        {/* 6. PATRONES DE ESCANEO DE ESQUINA DE ALTA TECNOLOGÍA (QR FINDER PATTERNS) */}
        {/* Superior Izquierda */}
        <g transform="translate(46, 169)">
          <rect x="-8" y="-8" width="16" height="16" rx="4" fill="none" stroke="#E91E63" strokeWidth="1.8" />
          <rect x="-4" y="-4" width="8" height="8" rx="2" fill="#E91E63" />
        </g>
        {/* Superior Derecha */}
        <g transform="translate(194, 169)">
          <rect x="-8" y="-8" width="16" height="16" rx="4" fill="none" stroke="#E91E63" strokeWidth="1.8" />
          <rect x="-4" y="-4" width="8" height="8" rx="2" fill="#E91E63" />
        </g>
        {/* Inferior Izquierda */}
        <g transform="translate(46, 271)">
          <rect x="-8" y="-8" width="16" height="16" rx="4" fill="none" stroke="#E91E63" strokeWidth="1.8" />
          <rect x="-4" y="-4" width="8" height="8" rx="2" fill="#E91E63" />
        </g>

        {/* 7. ECUALIZADOR DE ONDAS DE SONIDO EN LA BASE DE LA SECCIÓN */}
        <g fill="url(#ripple-gradient)">
          {barHeights.map((maxH, idx) => {
            const x = xStart + idx * (barWidth + gap);
            const baselineY = 285;
            return (
              <motion.rect
                key={idx}
                x={x}
                y={baselineY - maxH}
                width={barWidth}
                height={maxH}
                rx={2.5}
                animate={{
                  height: [maxH * 0.15, maxH, maxH * 0.15],
                  y: [baselineY - maxH * 0.15, baselineY - maxH, baselineY - maxH * 0.15]
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

        {/* 8. ESCUDO CENTRAL Y MICRO-QR REAL FUNCIONAL */}
        <g transform={`translate(${cx}, ${cy})`}>
          {/* Escudo redondo negro con borde neón */}
          <circle r={22} fill="#050508" stroke="url(#badge-neon-glow)" strokeWidth={1.8} />
          
          {/* Micro-QR estático centrado leíble */}
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
      
      {/* 9. TEXTO DE RESPALDO ALFANUMÉRICO */}
      <div className="mt-4 bg-white/[0.03] border border-white/5 rounded-full px-4 py-1.5 text-center shadow-[0_0_20px_rgba(0,0,0,0.4)]">
        <span className="text-[10px] text-white/50 uppercase tracking-[3px] font-mono select-all">
          {value.substring(0, 12).toUpperCase()}
        </span>
      </div>
    </div>
  );
}
