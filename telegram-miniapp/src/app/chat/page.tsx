'use client';

import { useAuth } from '@/features/auth/AuthProvider';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function ChatInboxPage() {
  const { user } = useAuth();

  return (
    <ProfileSubpageLayout title="Mensajes">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Fila Fija: Rabbit Bot */}
        <Link href="/chat/bot" style={{ textDecoration: 'none' }}>
          <motion.div 
            whileHover={{ scale: 0.98 }}
            whileTap={{ scale: 0.95 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: 16, background: '#fff', borderRadius: 24,
              border: '1px solid #F0F0F0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: '#E91E63',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, boxShadow: '0 0 16px rgba(233,30,99,0.3)', flexShrink: 0
            }}>
              🐰
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <h3 style={{ margin: 0, fontWeight: 900, fontSize: 16, color: '#111' }}>Rabbit Bot</h3>
                <span style={{ fontSize: 10, fontWeight: 900, color: '#E91E63', background: 'rgba(233,30,99,0.1)', padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase' }}>
                  Oficial
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                ¡Hola! Soy tu asistente IA. ¿En qué te ayudo?
              </p>
            </div>
          </motion.div>
        </Link>

        {/* Placeholder para chats P2P */}
        <div style={{
          marginTop: 24, display: 'flex', alignItems: 'center', gap: 16,
          padding: 16, background: 'rgba(240,240,240,0.5)', borderRadius: 24,
          border: '1px dashed #E0E0E0'
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: '#F5F5F5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, flexShrink: 0, opacity: 0.5
          }}>
            ☕
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16, color: '#999' }}>Próximamente</h3>
            <p style={{ margin: 0, fontSize: 13, color: '#AAA' }}>
              Tus chats con negocios aparecerán aquí.
            </p>
          </div>
        </div>
      </div>
    </ProfileSubpageLayout>
  );
}
