'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Award, Zap, Gift, TrendingUp, Users } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import Header from '@/components/ui/Header';
import Tabs from '@/components/ui/Tabs';
import FeedCard from '@/components/ui/FeedCard';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { api } from '@/services/api';
import { useWallet } from '@/contexts/WalletContext';

interface FeedItem {
  id: string;
  user: string;
  device: string;
  time: string;
  label: string;
  bunz: number;
  imageUrl?: string;
}

const TABS = ["bunz'in", "Stock", "Freehands"];

export default function FeedPage() {
  const [activeTab, setActiveTab] = useState("bunz'in");
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, balance: walletBalance } = useWallet();

  // Cargar datos del backend
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Cargar feed según tab
        const feedData = await api.feed.get(activeTab);
        if (feedData?.items) {
          setPosts(feedData.items.map((item: any) => ({
            id: item.id?.toString() || Math.random().toString(),
            user: item.name || item.user || 'Negocio',
            device: item.type || item.device || 'Afiliado',
            time: item.distance ? `${item.distance}km • ${item.rating}★` : 'Abierto ahora',
            label: item.label || item.description || '',
            bunz: item.reward_rate || item.rewardAmount || 0,
          })));
        }
        
        // Cargar balance
        try {
          const balanceData = await api.users.balance();
          setBalance(balanceData.balance || 0);
        } catch (e) {
          // Fallback a mock si no hay auth
          setBalance(1250);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error loading feed:', err);
        setError('No se pudo cargar el feed. Usando datos locales.');
        // Fallback a mock data
        setPosts(getMockPosts());
        setBalance(1250);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [activeTab]);

  // Inicializar Telegram WebApp
  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
    });
  }, []);

  const getMockPosts = (): FeedItem[] => {
    if (activeTab === "bunz'in") {
      return [
        { id: '1', user: 'Café Cultura', device: 'Café y desayunos', time: 'Abierto ahora', label: 'Avocado Toast', bunz: 50, imageUrl: 'https://images.unsplash.com/photo-1603048297172-c92544798d5e?w=800&q=80' },
        { id: '2', user: 'Pizza Napoli', device: 'Restaurante italiano', time: 'Abierto hasta 11pm', label: 'Pizza Margherita', bunz: 30, imageUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&q=80' },
        { id: '3', user: 'Gimnasio Power', device: 'Fitness y bienestar', time: 'Abierto 24hrs', label: 'Membresía mensual', bunz: 100, imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80' },
      ];
    } else if (activeTab === 'Stock') {
      return [
        { id: '4', user: 'TechZone', device: 'Electrónica', time: 'Acepta bunz', label: 'AirPods Pro', bunz: 500, imageUrl: 'https://images.unsplash.com/photo-1606220588913-b3aecb4b276c?w=800&q=80' },
        { id: '5', user: 'Café Cultura', device: 'Café y desayunos', time: 'Acepta bunz', label: 'Desayuno completo', bunz: 80, imageUrl: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=800&q=80' },
        { id: '6', user: 'Pizza Napoli', device: 'Restaurante italiano', time: 'Acepta bunz', label: 'Cena para 2', bunz: 200, imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800&q=80' },
      ];
    } else {
      return [
        { id: '7', user: 'Café Cultura', device: 'Café • Desayuno • Wifi', time: '1.2km • 4.8★', label: 'Avocado Toast', bunz: 50, imageUrl: 'https://images.unsplash.com/photo-1603048297172-c92544798d5e?w=800&q=80' },
        { id: '8', user: 'Gimnasio Power', device: 'Fitness • Crossfit • Yoga', time: '0.8km • 4.9★', label: 'Clase grupal', bunz: 40, imageUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80' },
        { id: '9', user: 'TechZone', device: 'Electrónica • Accesorios', time: '2.5km • 4.6★', label: 'iPhone 15 Case', bunz: 25, imageUrl: 'https://images.unsplash.com/photo-1603313011101-320f26a4f6f6?w=800&q=80' },
      ];
    }
  };

  return (
    <div className="page-wrap pb-28 bg-white">
      <div style={{ height: 'var(--safe-top)' }} />

      <Header showBack={true} />

      <main className="flex-1 w-full max-w-[600px] mx-auto">
        {/* Tabs */}
        <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

        {/* Error Banner */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
            <p className="text-sm text-yellow-700">{error}</p>
          </div>
        )}

        {/* Feed */}
        <div className="pt-4">
          {loading ? (
            // Loading skeletons
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : posts.length > 0 ? (
            posts.map((post, i) => (
              <FeedCard
                key={post.id}
                id={post.id}
                user={post.user}
                device={post.device}
                time={post.time}
                label={post.label}
                bunz={post.bunz}
                imageUrl={post.imageUrl}
                index={i}
              />
            ))
          ) : (
            <EmptyState
              icon={<Search className="w-8 h-8 text-[#8A8A8A]" />}
              title="Sin resultados"
              description={`No hay negocios disponibles en "${activeTab}" aún.`}
            />
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
