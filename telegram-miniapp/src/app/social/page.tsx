'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import Header from '@/components/ui/Header';

type FeedItem = {
  id: string;
  user: string;
  device: string;
  category: string;
  label: string;
  bunz: number;
  reward_percentage: number;
  imageUrl: string | null;
  logo_base64: string | null;
  distance: number | null;
};

export default function SocialPage() {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
    });
  }, []);

  useEffect(() => {
    fetch('/api/feed')
      .then(r => r.json())
      .then(data => {
        if (data.success) setFeedItems(data.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleLike = (id: string) => {
    setLiked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSave = (id: string) => {
    setSaved(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="page-wrap pb-28 bg-white">
      <div style={{ height: 'var(--safe-top)' }} />
      <Header showBack={true} isScrolled={false} />

      <main className="flex-1 w-full max-w-[600px] mx-auto px-4 pt-2">
        <h1 className="text-2xl font-normal text-[#111] mb-6 px-1">Social</h1>

        {loading && <p className="text-center text-[#8A8A8A] py-8">Cargando...</p>}

        {!loading && feedItems.length === 0 && (
          <p className="text-center text-[#8A8A8A] py-8">Aún no hay actividad. ¡Sé el primero en ganar Bunz!</p>
        )}

        <div className="space-y-6">
          {feedItems.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-white border border-[#F0F0F0] rounded-3xl overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.02)]"
            >
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E91E63] to-[#C2185B] flex items-center justify-center text-white text-sm font-bold">
                    {item.logo_base64 ? (
                      <img src={item.logo_base64} alt={item.user} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      item.user?.[0] || '?'
                    )}
                  </div>
                  <div>
                    <p className="font-normal text-[#111] text-[15px]">{item.user || item.device}</p>
                    <p className="text-[12px] text-[#8A8A8A] font-light">{item.category}</p>
                  </div>
                </div>
                <button className="text-[#8A8A8A]">
                  <MoreHorizontal className="w-5 h-5" strokeWidth={1.5} />
                </button>
              </div>

              <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.label} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#8A8A8A] text-sm">Sin imagen</div>
                )}
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md rounded-lg px-3 py-1.5 border border-white/10">
                  <span className="text-[11px] font-semibold text-white tracking-wide">+{item.bunz} bunz</span>
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-5 mb-4">
                  <button onClick={() => toggleLike(item.id)} className="flex items-center gap-1.5 active:scale-90">
                    <Heart className={`w-6 h-6 transition-colors ${liked.has(item.id) ? 'fill-[#E91E63] text-[#E91E63]' : 'text-[#111]'}`} strokeWidth={liked.has(item.id) ? 0 : 1.5} />
                  </button>
                  <button className="flex items-center gap-1.5 text-[#111]">
                    <MessageCircle className="w-6 h-6" strokeWidth={1.5} />
                  </button>
                  <button className="flex items-center gap-1.5 text-[#111]">
                    <Share2 className="w-6 h-6" strokeWidth={1.5} />
                  </button>
                  <button onClick={() => toggleSave(item.id)} className="ml-auto active:scale-90">
                    <Bookmark className={`w-6 h-6 transition-colors ${saved.has(item.id) ? 'fill-[#111] text-[#111]' : 'text-[#111]'}`} strokeWidth={saved.has(item.id) ? 0 : 1.5} />
                  </button>
                </div>

                <p className="text-[14px] text-[#111] leading-relaxed font-light">
                  <span className="font-normal mr-1.5">{item.user || item.device}</span>
                  ofrece <span className="text-[#E91E63] font-medium">+{item.reward_percentage}%</span> en bunz por consumo en <span className="font-normal">{item.label || item.category}</span>.
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
