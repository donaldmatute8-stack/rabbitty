import React, { useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface RabbittyCodeProps {
  data: string;
  size?: number;
  showCardFrame?: boolean;
  className?: string;
}

// Deterministic pseudo-random generator based on input string
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export default function RabbittyCode({ data, size = 260, showCardFrame = true, className = '' }: RabbittyCodeProps) {
  // Generate dynamic wave bar heights derived deterministically from the payload
  const waveBars = useMemo(() => {
    const hash = hashString(data || 'rabbitty');
    const barCount = 11;
    const bars: number[] = [];
    
    for (let i = 0; i < barCount; i++) {
      const centerFactor = 1 - Math.abs(i - Math.floor(barCount / 2)) / (barCount / 2);
      const val = ((hash * (i + 1) * 31) % 70) + 20;
      const height = Math.min(90, Math.max(25, val * (0.5 + centerFactor * 0.5)));
      bars.push(height);
    }
    return bars;
  }, [data]);

  const qrPayload = data || 'https://t.me/Rabbittyme_bot';

  const codeContent = (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: showCardFrame ? size * 1.75 : size }}>
      {showCardFrame && (
        <>
          {/* Top Neon Bunny Outline Geometry */}
          <div className="absolute -top-12 z-20 pointer-events-none drop-shadow-[0_0_12px_rgba(233,30,99,0.8)]">
            <svg width="120" height="120" viewBox="0 0 100 100" fill="none">
              {/* Ears */}
              <polygon points="30,5 45,45 25,35" stroke="#F43F5E" strokeWidth="2.5" strokeLinejoin="round" fill="rgba(244,63,94,0.08)" />
              <polygon points="70,5 75,35 55,45" stroke="#F43F5E" strokeWidth="2.5" strokeLinejoin="round" fill="rgba(244,63,94,0.08)" />
              <line x1="30" y1="5" x2="38" y2="28" stroke="#EC4899" strokeWidth="1.5" />
              <line x1="70" y1="5" x2="62" y2="28" stroke="#EC4899" strokeWidth="1.5" />
              {/* Head Geometry */}
              <polygon points="50,25 70,45 50,85 30,45" stroke="#F43F5E" strokeWidth="2.5" strokeLinejoin="round" fill="rgba(233,30,99,0.12)" />
              <polygon points="50,25 62,45 50,60 38,45" stroke="#C084FC" strokeWidth="1.5" strokeLinejoin="round" />
              <polygon points="50,60 70,45 50,85" stroke="#EC4899" strokeWidth="1.5" />
              <polygon points="50,60 30,45 50,85" stroke="#EC4899" strokeWidth="1.5" />
              <line x1="38" y1="45" x2="62" y2="45" stroke="#F43F5E" strokeWidth="1.5" />
              <line x1="50" y1="60" x2="50" y2="85" stroke="#F43F5E" strokeWidth="2" />
            </svg>
          </div>

          {/* Card Title Logo */}
          <div className="absolute top-[82px] z-20 flex items-center gap-1.5 opacity-90">
            <span className="text-[10px] tracking-[0.25em] font-black text-white uppercase flex items-center gap-1">
              <span className="text-pink-500 text-xs">🐰</span> RABBITTY
            </span>
          </div>
        </>
      )}

      {/* Main Glass Card Frame */}
      <div 
        className={`relative w-full h-full rounded-[36px] overflow-hidden flex items-center justify-center p-6 transition-all duration-300 ${
          showCardFrame 
            ? 'bg-gradient-to-b from-[#180B28]/95 via-[#0F071A]/95 to-[#080311]/98 border-2 border-pink-500/40 shadow-[0_0_50px_rgba(233,30,99,0.25)] backdrop-blur-xl' 
            : 'bg-transparent'
        }`}
      >
        {/* Scannable High-Density QR Background */}
        <div className="absolute inset-0 flex items-center justify-center p-6 opacity-25 mix-blend-screen pointer-events-none scale-105">
          <QRCodeSVG
            value={qrPayload}
            size={size * 0.85}
            level="H"
            includeMargin={false}
            fgColor="#F43F5E"
            bgColor="transparent"
          />
        </div>

        {/* Concentric Neon Rings Background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg width={size * 0.9} height={size * 0.9} viewBox="0 0 200 200" fill="none" className="opacity-40">
            {[20, 35, 50, 65, 80, 95].map((r, idx) => (
              <circle
                key={idx}
                cx="100"
                cy="100"
                r={r}
                stroke={idx % 2 === 0 ? "#F43F5E" : "#8B5CF6"}
                strokeWidth={idx % 2 === 0 ? "1.5" : "1"}
                strokeDasharray={idx % 3 === 0 ? "4 3" : undefined}
                className="animate-pulse"
                style={{ animationDuration: `${3 + idx}s` }}
              />
            ))}
          </svg>
        </div>

        {/* Outer Corner Position Detectors (Finder Patterns) */}
        <div className="absolute inset-8 pointer-events-none flex flex-col justify-between p-2">
          <div className="flex justify-between">
            {/* Top Left */}
            <div className="w-9 h-9 border-2 border-pink-500 rounded-xl p-1.5 flex items-center justify-center bg-[#0F071A]/80 shadow-[0_0_15px_rgba(244,63,94,0.6)]">
              <div className="w-full h-full bg-gradient-to-br from-pink-500 to-purple-600 rounded-md" />
            </div>
            {/* Top Right */}
            <div className="w-9 h-9 border-2 border-pink-500 rounded-xl p-1.5 flex items-center justify-center bg-[#0F071A]/80 shadow-[0_0_15px_rgba(244,63,94,0.6)]">
              <div className="w-full h-full bg-gradient-to-br from-pink-500 to-purple-600 rounded-md" />
            </div>
          </div>
          <div className="flex justify-between items-end">
            {/* Bottom Left */}
            <div className="w-9 h-9 border-2 border-pink-500 rounded-xl p-1.5 flex items-center justify-center bg-[#0F071A]/80 shadow-[0_0_15px_rgba(244,63,94,0.6)]">
              <div className="w-full h-full bg-gradient-to-br from-pink-500 to-purple-600 rounded-md" />
            </div>
            {/* Bottom Right Inner Indicator */}
            <div className="w-5 h-5 border-2 border-purple-400 rounded-lg p-0.5 flex items-center justify-center bg-[#0F071A]/80 shadow-[0_0_10px_rgba(168,85,247,0.5)]">
              <div className="w-full h-full bg-purple-400 rounded-sm" />
            </div>
          </div>
        </div>

        {/* Central Dynamic Soundwave Core */}
        <div className="relative z-10 flex items-center justify-center gap-[4px] px-6 py-4 bg-[#0A0314]/90 backdrop-blur-md border border-pink-500/30 rounded-2xl shadow-[0_0_25px_rgba(233,30,99,0.35)]">
          {/* Central Vertical Divider Line */}
          <div className="absolute top-2 bottom-2 left-1/2 -translate-x-1/2 w-[1.5px] bg-gradient-to-b from-transparent via-pink-400 to-transparent opacity-40" />

          {waveBars.map((h, i) => (
            <div
              key={i}
              className="w-[4px] rounded-full transition-all duration-500 bg-gradient-to-t from-purple-500 via-pink-500 to-cyan-300 drop-shadow-[0_0_6px_rgba(244,63,94,0.8)]"
              style={{
                height: `${h * (size / 260)}px`,
                opacity: 0.85 + (i % 3) * 0.05,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`inline-block ${className}`}>
      {codeContent}
    </div>
  );
}
