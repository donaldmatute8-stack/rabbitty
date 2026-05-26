'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import Header from '@/components/ui/Header';
import Badge from '@/components/ui/Badge';

const STORIES = [
  { name: 'Tú', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80', active: true },
  { name: 'María', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80', active: true },
  { name: 'Carlos', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80', active: true },
  { name: 'Ana', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&q=80', active: false },
  { name: 'Luis', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&q=80', active: false },
];

const INITIAL_POSTS = [
  {
    id: '1',
    user: 'Conejito',
    avatar: '🐰',
    userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80',
    time: 'Hace 1 min',
    image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80',
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
    userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80',
    time: 'Hace 12 min',
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&q=80',
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
    userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80',
    time: 'Hace 4 hrs',
    image: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=800&q=80',
    label: 'Morning Coffee',
    bunz: 25,
    likes: 12,
    comments: 2,
    liked: false,
    saved: false,
  },
];

export default function SocialPage() {
  const [posts, setPosts] = useState(INITIAL_POSTS);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
    });
  }, []);

  // Detectar scroll para comprimir header
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
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
      <div className={`sticky top-0 z-[60] bg-white transition-shadow duration-300 ${isScrolled ? 'shadow-[0_2px_8px_rgba(0,0,0,0.04)]' : ''}`}>
        <div style={{ height: 'var(--safe-top)' }} />
        <Header showBack={true} isScrolled={isScrolled} />
      </div>

      <main className="flex-1 w-full max-w-[600px] mx-auto px-4 pt-2" style={{ backgroundColor: '#FFFFFF' }}>
        <h1 className="text-2xl font-normal text-[#111111] mb-6 px-1">Social</h1>

        {/* Stories Row */}
        <div className="flex gap-5 overflow-x-auto pb-4 mb-6 scrollbar-hide px-1">
          {STORIES.map((story, i) => (
            <motion.div
              key={story.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="flex flex-col items-center flex-shrink-0 cursor-pointer"
            >
              <div className="relative">
                {/* Outer Ring gradient for active stories */}
                {story.active ? (
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#E91E63] via-[#FF4081] to-[#C2185B] rounded-full p-[2px] animate-pulse-subtle">
                    <div className="w-full h-full bg-white rounded-full p-[2px]">
                      <img src={story.avatar} alt={story.name} className="w-full h-full object-cover rounded-full" />
                    </div>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full p-[2px] border border-[#E0E0E0] bg-white">
                    <img src={story.avatar} alt={story.name} className="w-full h-full object-cover rounded-full grayscale opacity-70" />
                  </div>
                )}
                {/* Size spacer to maintain layout */}
                <div className="w-16 h-16 pointer-events-none opacity-0" />
              </div>
              <span className="text-[12px] text-[#8A8A8A] font-light mt-2">{story.name}</span>
            </motion.div>
          ))}
        </div>

        {/* Feed */}
        <div className="space-y-6">
          {posts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="bg-white border border-[#F0F0F0] rounded-3xl overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.02)]"
            >
              {/* User Header */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full border border-gray-100 overflow-hidden bg-gray-50 flex items-center justify-center font-bold">
                    <img src={post.userAvatar} alt={post.user} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="font-normal text-[#111111] text-[15px]">{post.user}</p>
                    <p className="text-[12px] text-[#8A8A8A] font-light">{post.time}</p>
                  </div>
                </div>
                <button className="text-[#8A8A8A] active:opacity-60 transition-opacity">
                  <MoreHorizontal className="w-5 h-5" strokeWidth={1.5} />
                </button>
              </div>

              {/* Image Area */}
              <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
                <img src={post.image} alt={post.label} className="w-full h-full object-cover" />
                
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md rounded-lg px-3 py-1.5 border border-white/10 shadow-sm">
                  <span className="text-[11px] font-semibold text-white tracking-wide">+{post.bunz} bunz</span>
                </div>
              </div>

              {/* Actions & Caption */}
              <div className="p-5">
                <div className="flex items-center gap-5 mb-4">
                  <button
                    onClick={() => toggleLike(post.id)}
                    className="flex items-center gap-1.5 text-[14px] font-normal transition-all duration-200 active:scale-90"
                  >
                    <Heart
                      className={`w-6 h-6 transition-colors duration-200 ${post.liked ? 'fill-[#E91E63] text-[#E91E63]' : 'text-[#111111]'}`}
                      strokeWidth={post.liked ? 0 : 1.5}
                    />
                    <span className="text-[#111111] font-medium text-[13px]">{post.likes}</span>
                  </button>

                  <button className="flex items-center gap-1.5 text-[14px] font-normal text-[#111111] active:scale-95 transition-transform">
                    <MessageCircle className="w-6 h-6" strokeWidth={1.5} />
                    <span className="text-[#111111] font-medium text-[13px]">{post.comments}</span>
                  </button>

                  <button className="flex items-center gap-1.5 text-[14px] font-normal text-[#111111] active:scale-95 transition-transform">
                    <Share2 className="w-6 h-6" strokeWidth={1.5} />
                  </button>

                  <button
                    onClick={() => toggleSave(post.id)}
                    className="flex items-center gap-1.5 text-[14px] font-normal ml-auto active:scale-90 transition-transform"
                  >
                    <Bookmark
                      className={`w-6 h-6 transition-colors duration-200 ${post.saved ? 'fill-[#111111] text-[#111111]' : 'text-[#111111]'}`}
                      strokeWidth={post.saved ? 0 : 1.5}
                    />
                  </button>
                </div>

                <p className="text-[14px] text-[#111111] leading-relaxed font-light">
                  <span className="font-normal mr-1.5">{post.user}</span>
                  ganó <span className="text-[#E91E63] font-medium">+{post.bunz} bunz</span> al registrar su consumo en <span className="font-normal">{post.label}</span>.
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
