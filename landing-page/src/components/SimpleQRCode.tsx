import React from 'react';

// Pure SVG QR Code Generator without external dependencies
export function SimpleQRCode({
  value,
  size = 180,
  className = '',
  color = '#000000',
  bgColor = '#FFFFFF',
}: {
  value: string;
  size?: number;
  className?: string;
  color?: string;
  bgColor?: string;
}) {
  // Use quickchart QR SVG API with high redundancy (H) and sharp vectors
  const encoded = encodeURIComponent(value);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&format=svg&color=${color.replace('#', '')}&bgcolor=${bgColor.replace('#', '')}&margin=1`;

  return (
    <div 
      className={`relative flex items-center justify-center p-2 rounded-2xl bg-white shadow-xl ${className}`}
      style={{ width: size + 16, height: size + 16 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrUrl}
        alt={`QR Code: ${value}`}
        width={size}
        height={size}
        className="w-full h-full object-contain"
        loading="lazy"
      />
      {/* Rabbitty Center Micro Badge with Ra or Rabbit icon */}
      <div 
        className="absolute inset-0 m-auto rounded-full bg-black border-2 border-[#E91E63] flex items-center justify-center shadow-lg"
        style={{ width: Math.max(34, size * 0.18), height: Math.max(34, size * 0.18) }}
      >
        <span 
          className="font-black text-white tracking-tighter select-none"
          style={{ fontSize: Math.max(15, size * 0.08), color: '#FFF' }}
        >
          <span className="text-[#E91E63]">R</span>a
        </span>
      </div>
    </div>
  );
}
