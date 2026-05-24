'use client';

import { useEffect, useState } from 'react';

interface Post {
  id: string;
  user: {
    name: string;
    avatar: string;
    level: number;
  };
  business: string;
  businessIcon: string;
  amount: number;
  message: string;
  likes: number;
  comments: number;
  time: string;
  liked: boolean;
}

const MOCK_POSTS: Post[] = [
  {
    id: '1',
    user: { name: 'María G.', avatar: '👩', level: 5 },
    business: 'Café Cultura',
    businessIcon: '☕',
    amount: 50,
    message: '¡Amo este lugar! El mejor café de la ciudad y encima gano bunz ☕✨',
    likes: 24,
    comments: 5,
    time: 'Hace 2 horas',
    liked: false
  },
  {
    id: '2',
    user: { name: 'Carlos R.', avatar: '👨', level: 3 },
    business: 'Pizza Napoli',
    businessIcon: '🍕',
    amount: 100,
    message: 'Cena familiar increíble 🍕 100 bunz de recompensa!',
    likes: 45,
    comments: 12,
    time: 'Hace 4 horas',
    liked: true
  },
  {
    id: '3',
    user: { name: 'Ana L.', avatar: '👩‍🦱', level: 8 },
    business: 'Gimnasio Power',
    businessIcon: '💪',
    amount: 75,
    message: 'Día 30 de gym 💪 La constancia paga bunz también!',
    likes: 89,
    comments: 23,
    time: 'Hace 6 horas',
    liked: false
  },
  {
    id: '4',
    user: { name: 'Pedro M.', avatar: '👨‍🦰', level: 12 },
    business: 'TechZone',
    businessIcon: '💻',
    amount: 150,
    message: 'Nuevos audífonos 🎧 150 bunz de vuelta! #RabbittyLife',
    likes: 156,
    comments: 34,
    time: 'Hace 8 horas',
    liked: true
  },
];

const TRENDING = ['#RabbittyLife', '#BunzEarned', '#CaféCultura', '#PizzaTime'];

export default function SocialPage() {
  const [posts, setPosts] = useState(MOCK_POSTS);
  const [activeTab, setActiveTab] = useState('feed');
  const [WebApp, setWebApp] = useState<any>(null);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
      setWebApp(app);
    });
  }, []);

  const handleLike = (postId: string) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          liked: !post.liked,
          likes: post.liked ? post.likes - 1 : post.likes + 1
        };
      }
      return post;
    }));
  };

  const createPost = () => {
    if (WebApp) {
      WebApp.showPopup({
        title: '📝 Nueva Publicación',
        message: 'Comparte tu experiencia y gana bunz extra por engagement!',
        buttons: [
          { id: 'create', type: 'default', text: 'Crear Post' },
          { type: 'cancel' }
        ]
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white sticky top-0 z-50 shadow-sm">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-800">📱 Social</h1>
            <button 
              onClick={createPost}
              className="bg-gradient-to-r from-[#FF6B35] to-[#FF4081] text-white px-4 py-2 rounded-full font-medium text-sm"
            >
              + Crear
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {['feed', 'trending', 'my'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-full text-sm font-medium transition ${
                  activeTab === tab
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {tab === 'feed' ? 'Feed' : tab === 'trending' ? 'Trending' : 'Mis Posts'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Trending Tags */}
      {activeTab === 'trending' && (
        <div className="p-4">
          <div className="flex flex-wrap gap-2">
            {TRENDING.map((tag) => (
              <button
                key={tag}
                className="bg-gradient-to-r from-orange-100 to-pink-100 text-[#FF6B35] px-4 py-2 rounded-full font-medium text-sm"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Posts Feed */}
      <div className="p-4 space-y-4 pb-24">
        {posts.map((post) => (
          <div key={post.id} className="bg-white rounded-2xl shadow-md overflow-hidden">
            {/* Header */}
            <div className="p-4 flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-200 to-pink-200 rounded-full flex items-center justify-center text-2xl">
                {post.user.avatar}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-gray-800">{post.user.name}</p>
                  <span className="bg-orange-100 text-[#FF6B35] text-xs px-2 py-0.5 rounded-full font-bold">
                    Lvl {post.user.level}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{post.time}</p>
              </div>
            </div>

            {/* Content */}
            <div className="px-4 pb-3">
              <p className="text-gray-700 mb-3">{post.message}</p>
              
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-3 flex items-center gap-3">
                <span className="text-3xl">{post.businessIcon}</span>
                <div className="flex-1">
                  <p className="font-bold text-gray-800">{post.business}</p>
                  <p className="text-green-600 font-bold">+{post.amount} bunz ganados</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 pt-2 flex items-center justify-between border-t border-gray-100">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleLike(post.id)}
                  className={`flex items-center gap-1 ${post.liked ? 'text-red-500' : 'text-gray-500'}`}
                >
                  <span className="text-xl">{post.liked ? '❤️' : '🤍'}</span>
                  <span className="font-medium">{post.likes}</span>
                </button>

                <button className="flex items-center gap-1 text-gray-500">
                  <span className="text-xl">💬</span>
                  <span className="font-medium">{post.comments}</span>
                </button>

                <button className="flex items-center gap-1 text-gray-500">
                  <span className="text-xl">↗️</span>
                </button>
              </div>

              <span className="text-xs text-gray-400">Gana bunz por likes</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
