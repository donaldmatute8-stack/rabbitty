'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Store, Users, Settings, ArrowLeft, ScanLine } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const NAV_ITEMS = [
    { id: 'dashboard', label: 'Panel Principal', icon: Store, href: '/business' },
    { id: 'scan', label: 'Escáner (Caja)', icon: ScanLine, href: '/business/scan' },
    { id: 'clients', label: 'Mis Clientes', icon: Users, href: '/business/clients' },
    { id: 'settings', label: 'Configuración', icon: Settings, href: '/business/settings' },
  ];

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-gray-100 p-6 bg-white shrink-0">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-black text-black tracking-tight leading-none">Rabbitty</h2>
            <p className="text-xs text-gray-500 font-bold tracking-wide uppercase mt-0.5">Business</p>
          </div>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          {NAV_ITEMS.map((item) => (
            <NavItem 
              key={item.id}
              active={pathname === item.href} 
              onClick={() => router.push(item.href)} 
              icon={<item.icon size={20} />} 
              label={item.label} 
            />
          ))}
        </nav>

        <div className="mt-auto">
          <button 
            onClick={() => router.push('/')}
            className="flex items-center gap-3 w-full p-3 rounded-xl text-left text-sm font-semibold text-gray-500 hover:bg-gray-50 hover:text-black transition-colors"
          >
            <span className="text-lg">↩️</span>
            Modo Usuario
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative pb-24 md:pb-0">
        {children}
      </main>

      {/* Bottom Nav for Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNav />
      </div>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 w-full p-3 rounded-xl text-left text-sm font-semibold transition-colors ${
        active ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-black'
      }`}
    >
      <span className="flex items-center justify-center w-6 h-6">{icon}</span>
      {label}
    </button>
  );
}
