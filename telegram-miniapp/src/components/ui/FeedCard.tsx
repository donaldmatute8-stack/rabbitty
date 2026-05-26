'use client';

import { motion } from 'framer-motion';
import { MoreHorizontal } from 'lucide-react';
import Image from 'next/image';

interface FeedCardProps {
  id: string;
  user: string;
  device: string;
  time: string;
  label: string;
  bunz: number;
  imageUrl?: string;
  index: number;
  onReserve?: (businessId: string) => void;
}

export default function FeedCard({
  id,
  user,
  device,
  time,
  label,
  bunz,
  imageUrl,
  index,
  onReserve
}: FeedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="bg-white rounded-xl overflow-hidden mb-5 w-full shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
      style={{ marginBottom: '20px' }}
    >
      {/* Image area */}
      <div className="relative aspect-[3/2] overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={label}
            className="w-full h-full object-cover"
            loading={index < 2 ? "eager" : "lazy"}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[#F5F5F5]">
            <span className="text-sm text-gray-400 font-medium">{label}</span>
          </div>
        )}
      </div>

      {/* Caption Area - Exact Clone of Showcase */}
      <div className="flex items-start justify-between bg-white" style={{ padding: '24px' }}>
        <div>
          <p className="font-normal text-[#111111] text-[17px] mb-2">{user}</p>
          <p className="text-[#8A8A8A] text-[14px] font-light">{device} — {time}</p>
          {bunz > 0 && <p className="text-[#E91E63] text-[14px] font-medium mt-2">+{bunz}% bunz de recompensa</p>}
        </div>
        <div className="flex flex-col items-end gap-3 mt-1">
          <button className="text-[#111111] active:opacity-60 transition-opacity">
            <MoreHorizontal className="w-6 h-6" />
          </button>
          {onReserve && (
            <button 
              onClick={() => onReserve(id)}
              className="bg-black text-white text-xs font-bold px-4 py-2 rounded-full active:scale-95 transition-transform"
            >
              Reservar Visita
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
