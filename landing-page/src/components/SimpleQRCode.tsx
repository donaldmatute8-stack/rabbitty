'use client';

import React, { useMemo } from 'react';
import { barsFromCode, code6FromData } from '@/lib/rabbittyCodeCodec';

/**
 * Standard scannable QR Code for printed marketing pieces (Table Tents, Flyers, Stickers)
 * meant for customers who do NOT have the Rabbitty App yet.
 * Uses ECC=H (30% error recovery) + radial CSS mask cutout + official /icon_ra.png emblem.
 */
export function SimpleQRCode({
  value,
  size = 180,
  className = '',
  color = '000000',
  bgColor = '#FFFFFF',
}: {
  value: string;
  size?: number;
  className?: string;
  color?: string;
  bgColor?: string;
}) {
  const encoded = encodeURIComponent(value);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&format=svg&ecc=H&qzone=1&color=${color.replace('#', '')}&bgcolor=${bgColor.replace('#', '')}&margin=1`;

  // Masked quiet-zone radius (~21% of QR width => ~3.4% of total area, well within 30% ecc=H budget)
  const cutoutDiameter = Math.round(Math.max(28, size * 0.21));
  const cutoutRadius = Math.round(cutoutDiameter / 2);
  const logoSize = Math.round(cutoutDiameter * 0.82);
  const radialMask = `radial-gradient(circle at center, transparent ${cutoutRadius}px, black ${cutoutRadius + 0.75}px)`;

  return (
    <div
      className={`relative flex items-center justify-center p-2 rounded-2xl shadow-xl ${className}`}
      style={{ width: size + 16, height: size + 16, backgroundColor: bgColor }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrUrl}
        alt="QR Code"
        width={size}
        height={size}
        className="w-full h-full object-contain"
        style={{
          maskImage: radialMask,
          WebkitMaskImage: radialMask,
        }}
        loading="lazy"
      />
      {/* Center Masked Quiet-Zone + Official /icon_ra.png Emblem */}
      <div
        className="absolute inset-0 m-auto rounded-full flex items-center justify-center pointer-events-none select-none"
        style={{
          width: cutoutDiameter,
          height: cutoutDiameter,
          backgroundColor: bgColor,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon_ra.png"
          alt="Ra"
          width={logoSize}
          height={logoSize}
          className="object-contain"
          style={{ width: logoSize, height: logoSize }}
        />
      </div>
    </div>
  );
}

/**
 * Proprietary Rabbitty Neon Code (RabbittyCode)
 * Used for internal ecosystem authentication (Affiliates & God Admin who scan with the Rabbitty App).
 * Renders the concentric wave rings, 4 corner holographic targets, and 13 dynamic soundwave bars.
 */
export function NeonQRCode({
  value,
  size = 200,
  showCardFrame = false,
  className = '',
}: {
  value: string;
  size?: number;
  showCardFrame?: boolean;
  className?: string;
}) {
  // ── Barras machine-readable: el escáner de la App decodifica este patrón ──
  const waveBars = useMemo(() => barsFromCode(code6FromData(String(value ?? ''))), [value]);

  const ringConfigs = useMemo(() => {
    return [
      { r: 24, dash: '6 4', speed: 8 },
      { r: 36, dash: '12 6', speed: 12 },
      { r: 48, dash: '8 8', speed: 10 },
      { r: 60, dash: '16 4 4 4', speed: 15 },
      { r: 72, dash: '10 5', speed: 9 },
      { r: 84, dash: '20 8', speed: 14 },
    ];
  }, []);

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center ${className}`}
      style={{ width: size, height: showCardFrame ? size * 1.45 : size }}
    >
      {showCardFrame && (
        <div className="absolute -top-9 z-30 pointer-events-none drop-shadow-[0_0_16px_rgba(244,63,94,0.9)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_conejo.png"
            alt="Rabbitty Neon Crown"
            className="w-16 h-16 object-contain drop-shadow-[0_0_10px_#F43F5E]"
          />
        </div>
      )}

      {/* Main Glass Card Frame */}
      <div
        className={`relative w-full h-full overflow-hidden flex items-center justify-center p-5 transition-all duration-300 ${
          showCardFrame
            ? 'rounded-4xl bg-linear-to-b from-[#19092B]/95 via-[#110520]/95 to-[#07020D]/98 border-2 border-pink-500/40 shadow-[0_0_60px_rgba(233,30,99,0.3)] backdrop-blur-2xl'
            : 'bg-[#0B0416] border border-pink-500/30 rounded-4xl shadow-[0_0_40px_rgba(233,30,99,0.22)]'
        }`}
      >
        {/* Glowing Background Radial Aura */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.2)_0%,rgba(147,51,234,0.1)_50%,transparent_75%)] pointer-events-none" />

        {/* 1. Concentric Wave Code Matrix (Anillos de Código Propietario) */}
        <svg
          width={size * 0.95}
          height={size * 0.95}
          viewBox="0 0 200 200"
          fill="none"
          className="absolute inset-0 m-auto pointer-events-none"
        >
          {ringConfigs.map((cfg, idx) => (
            <circle
              key={idx}
              cx="100"
              cy="100"
              r={cfg.r}
              stroke={idx % 2 === 0 ? '#F43F5E' : '#8B5CF6'}
              strokeWidth={idx % 2 === 0 ? '1.8' : '1.2'}
              strokeDasharray={cfg.dash}
              strokeLinecap="round"
              className="opacity-70"
            />
          ))}
        </svg>

        {/* 2. Four Corner Holographic Position Ring Targets */}
        <div className="absolute inset-5 pointer-events-none flex flex-col justify-between p-1 z-10">
          <div className="flex justify-between">
            {/* Top Left Target */}
            <div className="w-9 h-9 border-2 border-pink-500 rounded-2xl p-1 flex items-center justify-center bg-[#130624]/90 shadow-[0_0_18px_rgba(244,63,94,0.7)]">
              <div className="w-full h-full border border-purple-400 rounded-xl flex items-center justify-center">
                <div className="w-3 h-3 bg-linear-to-br from-pink-500 to-purple-600 rounded-md" />
              </div>
            </div>
            {/* Top Right Target */}
            <div className="w-9 h-9 border-2 border-pink-500 rounded-2xl p-1 flex items-center justify-center bg-[#130624]/90 shadow-[0_0_18px_rgba(244,63,94,0.7)]">
              <div className="w-full h-full border border-purple-400 rounded-xl flex items-center justify-center">
                <div className="w-3 h-3 bg-linear-to-br from-pink-500 to-purple-600 rounded-md" />
              </div>
            </div>
          </div>
          <div className="flex justify-between items-end">
            {/* Bottom Left Target */}
            <div className="w-9 h-9 border-2 border-pink-500 rounded-2xl p-1 flex items-center justify-center bg-[#130624]/90 shadow-[0_0_18px_rgba(244,63,94,0.7)]">
              <div className="w-full h-full border border-purple-400 rounded-xl flex items-center justify-center">
                <div className="w-3 h-3 bg-linear-to-br from-pink-500 to-purple-600 rounded-md" />
              </div>
            </div>
            {/* Bottom Right Key Indicator Target */}
            <div className="w-6 h-6 border-2 border-purple-400 rounded-xl p-0.5 flex items-center justify-center bg-[#130624]/90 shadow-[0_0_12px_rgba(168,85,247,0.6)]">
              <div className="w-full h-full bg-purple-400 rounded-xs" />
            </div>
          </div>
        </div>

        {/* 3. Center Soundwave Code Box (Núcleo de Onda Propietario) */}
        <div className="relative z-20 flex items-center justify-center gap-1 px-5 py-3.5 bg-[#090214]/95 backdrop-blur-xl border border-pink-500/50 rounded-2xl shadow-[0_0_30px_rgba(233,30,99,0.4)]">
          {/* Vertical Center Division Axis */}
          <div className="absolute top-2 bottom-2 left-1/2 -translate-x-1/2 w-[1.5px] bg-linear-to-b from-transparent via-pink-400 to-transparent opacity-50" />

          {waveBars.map((h, i) => (
            <div
              key={i}
              className="w-1 rounded-full transition-all duration-300 bg-linear-to-t from-purple-600 via-pink-500 to-cyan-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]"
              style={{
                height: `${h * (size / 260)}px`,
                opacity: 0.9,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
