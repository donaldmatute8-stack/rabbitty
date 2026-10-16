'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface FeedCardProps {
  id: string;
  user: string;
  device: string;
  label: string;
  bunz: number;
  imageUrl?: string;
  index: number;
}

export default function FeedCard({ id, user, device, label, bunz, imageUrl, index }: FeedCardProps) {
  const router = useRouter();

  return (
    <motion.div
      onClick={() => router.push(`/affiliate/${id}`)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        width: '100%',
        marginBottom: 16,
        overflow: 'hidden',
        borderRadius: 24,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Image */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden', background: 'var(--bg-pressed)' }}>
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
            background: 'linear-gradient(135deg, rgba(233,30,99,0.1) 0%, rgba(233,30,99,0.2) 100%)',
            fontSize: 48,
          }}>
            🏪
          </div>
        )}

        {/* Bunz badge */}
        {bunz > 0 && (
          <div style={{
            position: 'absolute', top: 12, right: 12,
            background: 'var(--rabbitty-pink)', color: '#fff',
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
          background: 'rgba(10, 10, 14, 0.75)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          fontSize: 11, fontWeight: 700, color: '#FFFFFF',
          padding: '4px 10px', borderRadius: 999,
        }}>
          📍 {label}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 900, color: 'var(--text-primary)', fontSize: 17, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>{device}</p>
        </div>
        <button style={{
          flexShrink: 0,
          background: 'var(--rabbitty-pink)', color: '#fff',
          fontSize: 12, fontWeight: 700,
          padding: '10px 18px', borderRadius: 999,
          border: 'none', cursor: 'pointer',
          boxShadow: '0 2px 10px rgba(233,30,99,0.3)',
        }}>
          Ver oferta
        </button>
      </div>
    </motion.div>
  );
}
