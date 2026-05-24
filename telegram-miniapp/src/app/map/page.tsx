'use client';

import { useEffect, useState } from 'react';

interface Business {
  id: string;
  name: string;
  type: string;
  rewardRate: number;
  distance: string;
  rating: number;
  image: string;
  lat: number;
  lng: number;
}

const MOCK_BUSINESSES: Business[] = [
  { id: '1', name: 'Café Cultura', type: 'Café', rewardRate: 25, distance: '120m', rating: 4.8, image: '☕', lat: 19.4326, lng: -99.1332 },
  { id: '2', name: 'Pizza Napoli', type: 'Restaurante', rewardRate: 30, distance: '350m', rating: 4.6, image: '🍕', lat: 19.4330, lng: -99.1328 },
  { id: '3', name: 'Gimnasio Power', type: 'Gym', rewardRate: 20, distance: '500m', rating: 4.9, image: '💪', lat: 19.4320, lng: -99.1340 },
  { id: '4', name: 'TechZone', type: 'Electrónica', rewardRate: 15, distance: '800m', rating: 4.5, image: '💻', lat: 19.4335, lng: -99.1315 },
  { id: '5', name: 'Libros Universo', type: 'Librería', rewardRate: 18, distance: '1.2km', rating: 4.7, image: '📚', lat: 19.4310, lng: -99.1350 },
];

export default function MapPage() {
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [WebApp, setWebApp] = useState<any>(null);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
      setWebApp(app);
      setUserLocation({ lat: 19.4326, lng: -99.1332 });
    });
  }, []);

  const filteredBusinesses = MOCK_BUSINESSES.filter(b => {
    if (selectedCategory !== 'all' && b.type.toLowerCase() !== selectedCategory) return false;
    if (searchQuery && !b.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const categories = [
    { id: 'all', icon: '🏪', label: 'Todos' },
    { id: 'café', icon: '☕', label: 'Cafés' },
    { id: 'restaurante', icon: '🍽️', label: 'Restaurantes' },
    { id: 'gym', icon: '💪', label: 'Gyms' },
    { id: 'tienda', icon: '🛍️', label: 'Tiendas' },
  ];

  const goToBusiness = (business: Business) => {
    if (WebApp) {
      WebApp.showPopup({
        title: business.name,
        message: `${business.type} • ${business.rewardRate}% de recompensa\n⭐ ${business.rating} • 📍 ${business.distance}`,
        buttons: [
          { id: 'navigate', type: 'default', text: 'Navegar' },
          { id: 'pay', type: 'default', text: 'Pagar' },
          { type: 'cancel' }
        ]
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF6B35] to-[#FF4081] text-white p-4 pt-8">
        <h1 className="text-2xl font-bold mb-4">🗺️ Cerca de ti</h1>
        
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar negocios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/20 backdrop-blur text-white placeholder-white/70 px-4 py-3 pl-12 rounded-2xl border-none focus:outline-none focus:ring-2 focus:ring-white/50"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">🔍</span>
        </div>
      </div>

      {/* Categories */}
      <div className="sticky top-0 bg-white shadow-sm z-10">
        <div className="flex gap-2 p-4 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap font-medium transition ${
                selectedCategory === cat.id
                  ? 'bg-[#FF6B35] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>{cat.icon}</span>
              <span className="text-sm">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Map Placeholder */}
      <div className="relative h-64 bg-gradient-to-br from-blue-100 to-green-100">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <span className="text-6xl">🗺️</span>
            <p className="text-gray-500 mt-2">Mapa interactivo</p>
            <p className="text-xs text-gray-400">{filteredBusinesses.length} negocios encontrados</p>
          </div>
        </div>
        
        {/* User location marker */}
        {userLocation && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse" />
            <div className="absolute -inset-2 bg-blue-500/20 rounded-full animate-ping" />
          </div>
        )}

        {/* Business markers */}
        {filteredBusinesses.map((business, index) => (
          <button
            key={business.id}
            onClick={() => goToBusiness(business)}
            className="absolute bg-white rounded-full p-2 shadow-lg hover:scale-110 transition"
            style={{
              top: `${20 + (index * 15)}%`,
              left: `${10 + (index * 20)}%`,
            }}
          >
            <span className="text-2xl">{business.image}</span>
            <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
              {business.rewardRate}%
            </div>
          </button>
        ))}
      </div>

      {/* Business List */}
      <div className="p-4 space-y-4 pb-24">
        <h2 className="text-lg font-bold text-gray-800">Negocios cercanos</h2>
        
        {filteredBusinesses.map((business) => (
          <button
            key={business.id}
            onClick={() => goToBusiness(business)}
            className="w-full bg-white rounded-2xl p-4 shadow-md flex items-center gap-4 hover:shadow-lg transition text-left"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-pink-100 rounded-xl flex items-center justify-center text-3xl">
              {business.image}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-gray-800">{business.name}</h3>
                <span className="text-sm text-gray-500">{business.distance}</span>
              </div>
              
              <p className="text-sm text-gray-500 mb-2">{business.type}</p>
              
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-sm">
                  <span className="text-yellow-500">⭐</span>
                  <span className="font-bold">{business.rating}</span>
                </span>
                
                <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold">
                  +{business.rewardRate}% bunz
                </span>
              </div>
            </div>
            
            <span className="text-2xl text-gray-400">→</span>
          </button>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <button
          onClick={() => { if (WebApp) WebApp.showScanQrPopup({ text: 'Escanea para pagar' }); }}
          className="w-full bg-gradient-to-r from-[#FF6B35] to-[#FF4081] text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition flex items-center justify-center gap-3"
        >
          <span className="text-2xl">📷</span>
          <span>Escanear QR para Pagar</span>
        </button>
      </div>
    </div>
  );
}
