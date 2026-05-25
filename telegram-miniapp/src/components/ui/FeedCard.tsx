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
}

export default function FeedCard({ 
  user, 
  device, 
  time, 
  label, 
  bunz, 
  imageUrl,
  index 
}: FeedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="bg-white rounded-xl overflow-hidden mb-5 border border-gray-100"
    >
      {/* Image area */}
      <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
        {imageUrl ? (
          <Image 
            src={imageUrl} 
            alt={label}
            fill
            className="object-cover"
            priority={index < 2}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[#F5F5F5]">
            <span className="text-sm text-gray-400 font-medium">{label}</span>
          </div>
        )}
        
        {/* Subtle overlay for the title/bunz to maintain function without breaking aesthetics */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        
        <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
          <span className="text-white font-semibold text-lg drop-shadow-sm">{label}</span>
          <span className="bg-[#E91E63] text-white text-xs font-bold px-2 py-1 rounded">+{bunz} bunz</span>
        </div>
      </div>

      {/* Caption Area - Exact Clone of Showcase */}
      <div className="pt-3 pb-4 px-4 flex items-start justify-between">
        <div>
          <p className="font-medium text-[#111111] text-[15px]">{user}</p>
          <p className="text-[#8A8A8A] text-[13px] font-light mt-0.5">{device} — {time}</p>
        </div>
        <button className="text-[#8A8A8A] active:opacity-60 transition-opacity flex items-center justify-center mt-1 border border-gray-200 rounded px-1.5 py-0.5">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
