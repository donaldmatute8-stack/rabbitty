'use client';

import { motion } from 'framer-motion';

interface FeedCardProps {
  id: string;
  user: string;
  device: string;
  time: string;
  label: string;
  bunz: number;
  imageUrl?: string;
  index: number;
}

export default function FeedCard({ id, user, device, time, label, bunz, imageUrl, index }: FeedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="w-full mb-4 overflow-hidden rounded-[24px] bg-white border border-[#F0F0F0] shadow-[0_2px_16px_rgba(0,0,0,0.05)]"
    >
      {/* Image */}
      <div className="relative w-full overflow-hidden bg-[#F5F5F5]" style={{ aspectRatio: '4/3' }}>
        {imageUrl ? (
          <img src={imageUrl} alt={label} className="w-full h-full object-cover" loading={index < 2 ? 'eager' : 'lazy'} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-pink-50 to-pink-100">
            <span className="text-5xl">🏪</span>
          </div>
        )}
        {/* Bunz badge */}
        {bunz > 0 && (
          <div className="absolute top-3 right-3 bg-[#E91E63] text-white text-xs font-black px-3 py-1.5 rounded-full shadow-[0_4px_12px_rgba(233,30,99,0.4)] flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-white/70" />
            +{bunz}% BUNZ
          </div>
        )}
        {/* Distance badge */}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-[11px] font-bold text-gray-600 px-2.5 py-1 rounded-full">
          📍 {label}
        </div>
      </div>

      {/* Body */}
      <div className="p-5 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-black text-[#111] text-[17px] mb-1 truncate">{user}</p>
          <p className="text-[#999] text-[13px] font-medium">{device}</p>
        </div>
        <button className="flex-shrink-0 bg-[#111] text-white text-[12px] font-bold px-4 py-2.5 rounded-full active:scale-95 transition-transform">
          Ver oferta
        </button>
      </div>
    </motion.div>
  );
}
