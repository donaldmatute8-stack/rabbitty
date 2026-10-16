'use client';

import { useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import Link from 'next/link';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { BusinessCardSkeleton } from '@/components/ui/Skeleton';
import { PlatformBridge } from '@/lib/platform';

type Conversation = {
  id: string;
  targetId: string;
  targetName: string;
  targetAvatar: string | null;
  isBot?: boolean;
  isBusinessInbox?: boolean;
  businessName?: string | null;
  lastMessage?: string;
  lastMessageTime?: string;
  lastMessageType?: string;
  unreadCount?: number;
};

const fetcher = async (url: string) => {
  const headers = await PlatformBridge.getAuthHeaders();
  return fetch(url, { headers }).then(res => res.json());
};

const cleanPreview = (text?: string, type?: string) => {
  if (type === 'AUTO_REPLY') return '🤖 Respuesta automática';
  return (text || '').replace(/\[[A-Z_]+[^\]]*\]/g, '').trim();
};

export default function ChatInboxPage() {
  const { user } = useAuth();

  const { data, isLoading } = useSWR<{ conversations: Conversation[] }>(
    user?.id ? `/api/chat` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const [category, setCategory] = useState<'all' | 'business'>('all');

  const conversations = data?.conversations ?? [];
  const hasBusinessConvs = conversations.some((c) => c.isBusinessInbox);
  const filteredConversations = conversations.filter((c) =>
    category === 'business' ? !!c.isBusinessInbox : !c.isBusinessInbox
  );

  return (
    <ProfileSubpageLayout title="Mensajes">
      <div className="flex flex-col gap-4">

        {/* Category Tabs for Affiliates / Business Owners */}
        {hasBusinessConvs && (
          <div className="flex gap-2 p-1 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
            <button
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                setCategory('all');
              }}
              className={`flex-1 py-2 text-xs font-black rounded-xl border-none cursor-pointer transition-all ${category === 'all' ? 'bg-[#E91E63] text-white shadow-md' : 'bg-transparent text-[var(--text-muted)]'}`}
            >
              Mis Chats (Rabbitter)
            </button>
            <button
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                setCategory('business');
              }}
              className={`flex-1 py-2 text-xs font-black rounded-xl border-none cursor-pointer transition-all flex items-center justify-center gap-1.5 ${category === 'business' ? 'bg-[#E91E63] text-white shadow-md' : 'bg-transparent text-[var(--text-muted)]'}`}
            >
              <span>🏪 Clientes de mi Negocio</span>
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col gap-4">
             <BusinessCardSkeleton />
             <BusinessCardSkeleton />
          </div>
        )}

        {!isLoading && filteredConversations.length === 0 && (
          <div className="p-10 text-center text-[#AAA]">
            {category === 'business'
              ? 'No tienes solicitudes de clientes pendientes en tu negocio.'
              : 'No tienes conversaciones activas. Explora negocios o pregúntale a Bunzy.'}
          </div>
        )}

        {!isLoading && filteredConversations.map((conv) => (
          <Link
            key={conv.id}
            href={`/chat/${conv.targetId}${conv.id && conv.id !== 'bunzy-initial' ? `?c=${conv.id}` : ''}`}
            className="no-underline"
          >
            <motion.div
              whileHover={{ scale: 0.98 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-4 p-4 rounded-3xl"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
            >
              {conv.isBot ? (
                <div className="size-14 rounded-full bg-[#E91E63] flex items-center justify-center text-2xl shadow-[0_0_16px_rgba(233,30,99,0.3)] shrink-0">🐰</div>
              ) : (
                <div className="size-14 rounded-full bg-[#F5F5F5] overflow-hidden shrink-0 border border-[#EBEBEB]">
                  {conv.targetAvatar ? (
                    <img src={conv.targetAvatar} alt={conv.targetName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">
                      {conv.isBusinessInbox ? '👤' : '💬'}
                    </div>
                  )}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2 truncate">
                    <h3 className="m-0 font-black text-base truncate" style={{ color: 'var(--text-primary)' }}>
                      {conv.targetName}
                    </h3>
                    {conv.isBusinessInbox && (
                      <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full shrink-0">
                        {conv.businessName || 'Cliente'}
                      </span>
                    )}
                  </div>
                  {conv.isBot && (
                    <span className="text-[10px] font-black text-[#E91E63] bg-[rgba(233,30,99,0.1)] px-2 py-0.5 rounded-full uppercase shrink-0">
                      Oficial
                    </span>
                  )}
                  {!conv.isBot && conv.lastMessageTime && (
                    <span className="text-[11px] font-semibold shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {new Date(conv.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <p
                  className="m-0 text-[13px] truncate"
                  style={{
                    color: (conv.unreadCount || 0) > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: (conv.unreadCount || 0) > 0 ? 700 : 400,
                  }}
                >
                  {cleanPreview(conv.lastMessage, conv.lastMessageType) || 'Sin mensajes aún'}
                </p>
              </div>

              {!!conv.unreadCount && conv.unreadCount > 0 && (
                <span className="min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center text-[11px] font-black text-white shrink-0" style={{ background: '#E91E63' }}>
                  {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                </span>
              )}
            </motion.div>
          </Link>
        ))}

      </div>
    </ProfileSubpageLayout>
  );
}
