'use client';

import { useAuth } from '@/features/auth/AuthProvider';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import Link from 'next/link';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { BusinessCardSkeleton } from '@/components/ui/Skeleton';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function ChatInboxPage() {
  const { user } = useAuth();
  
  const { data, error, isLoading } = useSWR(
    user?.id ? `/api/chat?userId=${user.id}` : null,
    fetcher,
    { refreshInterval: 5000 } // Poll every 5s for new messages/chats
  );

  return (
    <ProfileSubpageLayout title="Mensajes">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* Siempre mostrar Rabbit Bot como destacado si no hay otras interacciones, pero si ya hay conversaciones que vengan de la base de datos, lo mostramos ahí. */}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
             <BusinessCardSkeleton />
             <BusinessCardSkeleton />
          </div>
        )}

        {!isLoading && data?.conversations?.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#AAA' }}>
            No tienes conversaciones activas. <br/>Explora negocios para chatear.
          </div>
        )}

        {!isLoading && data?.conversations?.map((conv: any) => (
          <Link key={conv.id} href={`/chat/${conv.targetId}`} style={{ textDecoration: 'none' }}>
            <motion.div 
              whileHover={{ scale: 0.98 }}
              whileTap={{ scale: 0.95 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: 16, background: '#fff', borderRadius: 24,
                border: '1px solid #F0F0F0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
              }}
            >
              {conv.isBot ? (
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', background: '#E91E63',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, boxShadow: '0 0 16px rgba(233,30,99,0.3)', flexShrink: 0
                }}>🐰</div>
              ) : (
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', background: '#F5F5F5',
                  overflow: 'hidden', flexShrink: 0,
                  border: '1px solid #EBEBEB'
                }}>
                  {conv.targetAvatar ? (
                    <img src={conv.targetAvatar} alt={conv.targetName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>💬</div>
                  )}
                </div>
              )}
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <h3 style={{ margin: 0, fontWeight: 900, fontSize: 16, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {conv.targetName}
                  </h3>
                  {conv.isBot && (
                    <span style={{ fontSize: 10, fontWeight: 900, color: '#E91E63', background: 'rgba(233,30,99,0.1)', padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase' }}>
                      Oficial
                    </span>
                  )}
                  {!conv.isBot && conv.lastMessageTime && (
                    <span style={{ fontSize: 11, color: '#AAA', fontWeight: 600 }}>
                      {new Date(conv.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {conv.lastMessage || 'Sin mensajes aún'}
                </p>
              </div>
            </motion.div>
          </Link>
        ))}

      </div>
    </ProfileSubpageLayout>
  );
}
