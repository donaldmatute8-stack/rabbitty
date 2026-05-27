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
      style={{
        width: '100%',
        marginBottom: 16,
        overflow: 'hidden',
        borderRadius: 24,
        background: '#fff',
        border: '1px solid #F0F0F0',
        boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
      }}
    >
      {/* Image */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden', background: '#F5F5F5' }}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={label}
            loading={index < 2 ? 'eager' : 'lazy'}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #FFF0F5 0%, #FCE4EC 100%)',
            fontSize: 48,
          }}>
            🏪
          </div>
        )}

        {/* Bunz badge */}
        {bunz > 0 && (
          <div style={{
            position: 'absolute', top: 12, right: 12,
            background: '#E91E63', color: '#fff',
            fontSize: 11, fontWeight: 900,
            padding: '6px 12px', borderRadius: 999,
            boxShadow: '0 4px 12px rgba(233,30,99,0.4)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.7)' }} />
            +{bunz}% BUNZ
          </div>
        )}

        {/* Label badge */}
        <div style={{
          position: 'absolute', top: 12, left: 12,
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(8px)',
          fontSize: 11, fontWeight: 700, color: '#555',
          padding: '4px 10px', borderRadius: 999,
        }}>
          📍 {label}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 900, color: '#111', fontSize: 17, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user}
          </p>
          <p style={{ color: '#999', fontSize: 13, fontWeight: 500 }}>{device}</p>
        </div>
        <button style={{
          flexShrink: 0,
          background: '#111', color: '#fff',
          fontSize: 12, fontWeight: 700,
          padding: '10px 16px', borderRadius: 999,
          border: 'none', cursor: 'pointer',
        }}>
          Ver oferta
        </button>
      </div>
    </motion.div>
  );
}
