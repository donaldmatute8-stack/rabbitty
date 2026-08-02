import React, { useMemo } from 'react';

interface RabbittyCodeProps {
  data: string;
  size?: number;
  showCardFrame?: boolean;
  className?: string;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < (str || 'rabbitty').length; i++) {
    hash = (hash << 5) - hash + (str || 'rabbitty').charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export default function RabbittyCode({ data, size = 260, showCardFrame = true, className = '' }: RabbittyCodeProps) {
  const seed = useMemo(() => hashString(data), [data]);

  // Generate 15 dynamic soundwave bars in the center
  const waveBars = useMemo(() => {
    const bars: number[] = [];
    const count = 13;
    for (let i = 0; i < count; i++) {
      const centerFactor = 1 - Math.abs(i - Math.floor(count / 2)) / (count / 2);
      const raw = ((seed * (i + 7) * 31) % 65) + 25;
      const height = Math.min(85, Math.max(20, raw * (0.4 + centerFactor * 0.6)));
      bars.push(height);
    }
    return bars;
  }, [seed]);

  // Generate unique concentric ring dash/dot configurations for this user code
  const ringConfigs = useMemo(() => {
    return [
      { r: 24, dash: '6 4', speed: 8 },
      { r: 36, dash: '12 6', speed: 12 },
      { r: 48, dash: '8 8', speed: 10 },
      { r: 60, dash: '16 4 4 4', speed: 15 },
      { r: 72, dash: '10 5', speed: 9 },
      { r: 84, dash: '20 8', speed: 14 },
    ];
  }, [seed]);

  return (
    <div className={`relative inline-flex flex-col items-center justify-center ${className}`} style={{ width: size, height: showCardFrame ? size * 1.8 : size }}>
      {showCardFrame && (
        <>
          {/* Top Neon Bunny Geometry - Exact Silhouette matching user sample */}
          <div className="absolute -top-14 z-30 pointer-events-none drop-shadow-[0_0_15px_rgba(244,63,94,0.9)]">
            <svg width="110" height="130" viewBox="0 0 100 120" fill="none">
              {/* Left Polygon Ear */}
              <polygon points="35,10 46,60 22,48" stroke="#F43F5E" strokeWidth="2.8" strokeLinejoin="round" fill="rgba(244,63,94,0.12)" />
              <polygon points="35,10 42,42 28,34" stroke="#FB7185" strokeWidth="1.5" strokeLinejoin="round" />
              <line x1="35" y1="10" x2="38" y2="48" stroke="#E91E63" strokeWidth="1.5" />
              
              {/* Right Polygon Ear */}
              <polygon points="65,10 78,48 54,60" stroke="#F43F5E" strokeWidth="2.8" strokeLinejoin="round" fill="rgba(244,63,94,0.12)" />
              <polygon points="65,10 72,34 58,42" stroke="#FB7185" strokeWidth="1.5" strokeLinejoin="round" />
              <line x1="65" y1="10" x2="62" y2="48" stroke="#E91E63" strokeWidth="1.5" />

              {/* Head Crown Diamond & Facets */}
              <polygon points="50,38 78,48 50,110 22,48" stroke="#F43F5E" strokeWidth="3" strokeLinejoin="round" fill="rgba(233,30,99,0.15)" />
              <polygon points="50,38 64,60 50,82 36,60" stroke="#C084FC" strokeWidth="2" strokeLinejoin="round" fill="rgba(192,132,252,0.15)" />
              
              {/* Center Nose & Chin Triangles */}
              <polygon points="50,82 78,48 50,110" stroke="#EC4899" strokeWidth="2" strokeLinejoin="round" />
              <polygon points="50,82 22,48 50,110" stroke="#EC4899" strokeWidth="2" strokeLinejoin="round" />
              <line x1="36" y1="60" x2="64" y2="60" stroke="#F43F5E" strokeWidth="1.8" />
              <line x1="50" y1="82" x2="50" y2="110" stroke="#F43F5E" strokeWidth="2.5" />
            </svg>
          </div>

          {/* Rabbitty Branding Label */}
          <div className="absolute top-[82px] z-20 flex items-center gap-1.5 opacity-90">
            <span className="text-[10px] tracking-[0.28em] font-black text-white uppercase flex items-center gap-1.5 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]">
              <span className="text-pink-500 text-xs">🐰</span> RABBITTY
            </span>
          </div>
        </>
      )}

      {/* Main Glass Card Frame */}
      <div 
        className={`relative w-full h-full rounded-[38px] overflow-hidden flex items-center justify-center p-5 transition-all duration-300 ${
          showCardFrame 
            ? 'bg-gradient-to-b from-[#19092B]/95 via-[#110520]/95 to-[#07020D]/98 border-2 border-pink-500/40 shadow-[0_0_60px_rgba(233,30,99,0.3)] backdrop-blur-2xl' 
            : 'bg-[#0B0416] border border-pink-500/30 rounded-[32px]'
        }`}
      >
        {/* Glowing Background Radial Aura */}
        <div className="absolute inset-0 bg-radial from-pink-500/20 via-purple-600/10 to-transparent pointer-events-none" />

        {/* 1. Concentric Wave Code Matrix (Anillos de Código Propietario) */}
        <svg width={size * 0.95} height={size * 0.95} viewBox="0 0 200 200" fill="none" className="absolute inset-0 m-auto pointer-events-none">
          {ringConfigs.map((cfg, idx) => (
            <circle
              key={idx}
              cx="100"
              cy="100"
              r={cfg.r}
              stroke={idx % 2 === 0 ? "#F43F5E" : "#8B5CF6"}
              strokeWidth={idx % 2 === 0 ? "1.8" : "1.2"}
              strokeDasharray={cfg.dash}
              strokeLinecap="round"
              className="opacity-70"
            />
          ))}
        </svg>

        {/* 2. Four Corner Holographic Position Ring Targets (Reemplaza a los módulos QR genéricos) */}
        <div className="absolute inset-7 pointer-events-none flex flex-col justify-between p-1 z-10">
          <div className="flex justify-between">
            {/* Top Left Target */}
            <div className="w-10 h-10 border-2 border-pink-500 rounded-2xl p-1 flex items-center justify-center bg-[#130624]/90 shadow-[0_0_18px_rgba(244,63,94,0.7)]">
              <div className="w-full h-full border border-purple-400 rounded-xl flex items-center justify-center">
                <div className="w-3.5 h-3.5 bg-gradient-to-br from-pink-500 to-purple-600 rounded-md" />
              </div>
            </div>
            {/* Top Right Target */}
            <div className="w-10 h-10 border-2 border-pink-500 rounded-2xl p-1 flex items-center justify-center bg-[#130624]/90 shadow-[0_0_18px_rgba(244,63,94,0.7)]">
              <div className="w-full h-full border border-purple-400 rounded-xl flex items-center justify-center">
                <div className="w-3.5 h-3.5 bg-gradient-to-br from-pink-500 to-purple-600 rounded-md" />
              </div>
            </div>
          </div>
          <div className="flex justify-between items-end">
            {/* Bottom Left Target */}
            <div className="w-10 h-10 border-2 border-pink-500 rounded-2xl p-1 flex items-center justify-center bg-[#130624]/90 shadow-[0_0_18px_rgba(244,63,94,0.7)]">
              <div className="w-full h-full border border-purple-400 rounded-xl flex items-center justify-center">
                <div className="w-3.5 h-3.5 bg-gradient-to-br from-pink-500 to-purple-600 rounded-md" />
              </div>
            </div>
            {/* Bottom Right Key Indicator Target */}
            <div className="w-6 h-6 border-2 border-purple-400 rounded-xl p-0.5 flex items-center justify-center bg-[#130624]/90 shadow-[0_0_12px_rgba(168,85,247,0.6)]">
              <div className="w-full h-full bg-purple-400 rounded-sm" />
            </div>
          </div>
        </div>

        {/* 3. Center Soundwave Code Box (Núcleo de Onda Propietario) */}
        <div className="relative z-20 flex items-center justify-center gap-[4px] px-6 py-4 bg-[#090214]/95 backdrop-blur-xl border border-pink-500/50 rounded-2xl shadow-[0_0_30px_rgba(233,30,99,0.4)]">
          {/* Vertical Center Division Axis */}
          <div className="absolute top-2 bottom-2 left-1/2 -translate-x-1/2 w-[1.5px] bg-gradient-to-b from-transparent via-pink-400 to-transparent opacity-50" />

          {waveBars.map((h, i) => (
            <div
              key={i}
              className="w-[4px] rounded-full transition-all duration-300 bg-gradient-to-t from-purple-600 via-pink-500 to-cyan-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]"
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
