'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import Header from '@/components/ui/Header';
import Badge from '@/components/ui/Badge';

const POSTS = [
  {
    id: '1',
    user: 'Conejito',
    avatar: '🐰',
    time: 'Hace 1 min',
    image: null,
    label: 'Avocado Toast',
    bunz: 50,
    likes: 24,
    comments: 5,
    liked: false,
    saved: false,
  },
  {
    id: '2',
    user: 'María G.',
    avatar: 'M',
    time: 'Hace 12 min',
    image: null,
    label: 'Pizza Night',
    bunz: 100,
    likes: 45,
    comments: 12,
    liked: true,
    saved: true,
  },
  {
    id: '3',
    user: 'Carlos R.',
    avatar: 'C',
    time: 'Hace 4 hrs',
    image: null,
    label: 'Morning Coffee',
    bunz: 25,
    likes: 12,
    comments: 2,
    liked: false,
    saved: false,
  },
];

export default function SocialPage() {
  const [posts, setPosts] = useState(POSTS);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
    });
  }, []);

  const toggleLike = (id: string) => {
    setPosts(posts.map(p =>
      p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p
    ));
  };

  const toggleSave = (id: string) => {
    setPosts(posts.map(p => p.id === id ? { ...p, saved: !p.saved } : p));
  };

  return (
    <div className="page-wrap pb-28 bg-white">
      <div style={{ height: 'var(--safe-top)' }} />

      <Header />

      <main className="flex-1 px-4 pt-2">
        <h1 className="text-2xl font-semibold text-[#111111] mb-4 px-2">Social</h1>

        {/* Stories Row */}
        <div className="flex gap-4 overflow-x-auto pb-4 mb-4 px-2">
          {['Tú', 'María', 'Carlos', 'Ana', 'Luis'].map((name, i) => (
            <motion.div
              key={name}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="flex flex-col items-center"
            >
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold ${
                i === 0 ? 'bg-gradient-to-br from-[#E91E63] to-[#C2185B] text-white' : 'bg-[#F5F5F5] text-[#111111]'
              } border-2 ${i === 0 ? 'border-[#E91E63]' : 'border-transparent'}`}>
                {name[0]}
              </div>
              <span className="text-xs text-[#8A8A8A] mt-1">{name}</span>
            </motion.div>
          ))}
        </div>

        {/* Feed */}
        <div className="space-y-4">
          {posts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-white border border-gray-100 rounded-2xl overflow-hidden"
            >
              {/* User Header */}
              <div className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E91E63] to-[#C2185B] flex items-center justify-center text-white font-bold">
                  {post.avatar}
                </div>
                <div>
                  <p className="font-medium text-[#111111] text-[15px]">{post.user}</p>
                  <p className="text-[13px] text-[#8A8A8A]">{post.time}</p>
                </div>
              </div>

              {/* Image Area */}
              <div className="relative aspect-[4/3] bg-gray-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-50" />
                <span className="text-lg font-medium text-gray-300">{post.label}</span>

                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm rounded-md px-2.5 py-1">
                  <span className="text-xs font-semibold text-white">+{post.bunz} bunz</span>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4">
                <div className="flex items-center gap-4 mb-3">
                  <button
                    onClick={() => toggleLike(post.id)}
                    className="flex items-center gap-1.5 text-[14px] font-medium transition-colors"
                  >
                    <Heart
                      className={`w-6 h-6 ${post.liked ? 'fill-[#E91E63] text-[#E91E63]' : 'text-[#111111]'}`}
                      strokeWidth={post.liked ? 0 : 1.5}
                    />
                    {post.likes}
                  </button>

                  <button className="flex items-center gap-1.5 text-[14px] font-medium text-[#111111]">
                    <MessageCircle className="w-6 h-6" strokeWidth={1.5} />
                    {post.comments}
                  </button>

                  <button className="flex items-center gap-1.5 text-[14px] font-medium text-[#111111] ml-auto">
                    <Share2 className="w-6 h-6" strokeWidth={1.5} />
                  </button>

                  <button
                    onClick={() => toggleSave(post.id)}
                    className="flex items-center gap-1.5 text-[14px] font-medium"
                  >
                    <Bookmark
                      className={`w-6 h-6 ${post.saved ? 'fill-[#111111] text-[#111111]' : 'text-[#111111]'}`}
                      strokeWidth={post.saved ? 0 : 1.5}
                    />
                  </button>
                </div>

                <p className="text-[15px] text-[#111111]">
                  <span className="font-medium">{post.user}</span> ganó <Badge variant="bunz">{post.bunz} bunz</Badge> en {post.label}
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
