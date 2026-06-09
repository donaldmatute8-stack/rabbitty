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
    { refreshInterval: 5000 }
  );

  return (
    <ProfileSubpageLayout title="Mensajes">
      <div className="flex flex-col gap-4">
        
        {isLoading && (
          <div className="flex flex-col gap-4">
             <BusinessCardSkeleton />
             <BusinessCardSkeleton />
          </div>
        )}

        {!isLoading && data?.conversations?.length === 0 && (
          <div className="p-10 text-center text-[#AAA]">
            No tienes conversaciones activas. <br/>Explora negocios para chatear.
          </div>
        )}

        {!isLoading && data?.conversations?.map((conv: any) => (
          <Link key={conv.id} href={`/chat/${conv.targetId}`} className="no-underline">
            <motion.div 
              whileHover={{ scale: 0.98 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-4 p-4 bg-white rounded-3xl border border-[#F0F0F0] shadow-[0_4px_12px_rgba(0,0,0,0.03)]"
            >
              {conv.isBot ? (
                <div className="size-14 rounded-full bg-[#E91E63] flex items-center justify-center text-2xl shadow-[0_0_16px_rgba(233,30,99,0.3)] shrink-0">🐰</div>
              ) : (
                <div className="size-14 rounded-full bg-[#F5F5F5] overflow-hidden shrink-0 border border-[#EBEBEB]">
                  {conv.targetAvatar ? (
                    <img src={conv.targetAvatar} alt={conv.targetName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">💬</div>
                  )}
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="m-0 font-black text-base text-[#111] truncate">
                    {conv.targetName}
                  </h3>
                  {conv.isBot && (
                    <span className="text-[10px] font-black text-[#E91E63] bg-[rgba(233,30,99,0.1)] px-2 py-0.5 rounded-full uppercase">
                      Oficial
                    </span>
                  )}
                  {!conv.isBot && conv.lastMessageTime && (
                    <span className="text-[11px] text-[#AAA] font-semibold">
                      {new Date(conv.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <p className="m-0 text-[13px] text-[#888] truncate">
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
