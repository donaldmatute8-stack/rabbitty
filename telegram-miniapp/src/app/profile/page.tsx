'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
      const tgUser = app.initDataUnsafe.user;
      if (tgUser) setUser(tgUser);
    });
  }, []);

  if (!user) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Cargando...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#FF6B35] to-[#FF4081] px-6 pt-12 pb-8">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center border-4 border-white/30 overflow-hidden">
            {user.photo_url ? (
              <img src={user.photo_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl">{user.first_name?.[0]}</span>
            )}
          </div>
          
          <h1 className="text-white text-2xl font-bold">{user.first_name} {user.last_name}</h1>
          <p className="text-white/70">@{user.username || 'rabbiter'}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 -mt-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-800">12</p>
              <p className="text-xs text-gray-500">Transacciones</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">5</p>
              <p className="text-xs text-gray-500">Negocios</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">600</p>
              <p className="text-xs text-gray-500">Bunz totales</p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <a href="/business" className="flex items-center justify-between p-4 border-b hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <span className="text-xl">🏪</span>
              <span className="font-medium">Panel de Negocio</span>
            </div>
            <span className="text-gray-400">→</span>
          </a>
          
          <a href="/referral" className="flex items-center justify-between p-4 border-b hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <span className="text-xl">🎁</span>
              <span className="font-medium">Invitar amigos</span>
            </div>
            <span className="text-gray-400">→</span>
          </a>
          
          <button className="w-full flex items-center justify-between p-4 border-b hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <span className="text-xl">⚙️</span>
              <span className="font-medium">Configuración</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>
          
          <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <span className="text-xl">❓</span>
              <span className="font-medium">Ayuda & Soporte</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>
        </div>

        {/* App Info */}
        <div className="mt-8 text-center">
          <div className="w-16 h-16 mx-auto mb-3 bg-white rounded-2xl flex items-center justify-center shadow-sm">
            <Image src="/logo.png" alt="Rabbitty" width={50} height={50} />
          </div>
          <p className="text-gray-800 font-bold">Rabbitty v1.0</p>
          <p className="text-sm text-gray-500">Hecho con ❤️ en México</p>
        </div>
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t px-6 py-3">
        <div className="flex justify-around">
          <a href="/" className="flex flex-col items-center gap-1 text-gray-400">
            <span className="text-xl">💰</span>
            <span className="text-xs">Wallet</span>
          </a>
          <a href="/map" className="flex flex-col items-center gap-1 text-gray-400">
            <span className="text-xl">🗺️</span>
            <span className="text-xs">Mapa</span>
          </a>
          <a href="/social" className="flex flex-col items-center gap-1 text-gray-400">
            <span className="text-xl">📱</span>
            <span className="text-xs">Social</span>
          </a>
          <a href="/profile" className="flex flex-col items-center gap-1 text-[#FF6B35]">
            <span className="text-xl">👤</span>
            <span className="text-xs">Perfil</span>
          </a>
        </div>
      </nav>
    </div>
  );
}
