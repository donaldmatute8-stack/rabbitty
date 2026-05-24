'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ChevronLeft, MessageCircle, Maximize, ShoppingBag, MoreHorizontal } from 'lucide-react';

export default function FeedPage() {
  const [WebApp, setWebApp] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("bunz'in");

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
      setWebApp(app);
    });
  }, []);

  const closeApp = () => {
    if (WebApp) {
      WebApp.close();
    }
  };

  const tabs = ["bunz'in", "Stock", "Freehands"];

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col font-sans">
      {/* Safe Area Top */}
      <div className="h-6 w-full bg-[#FAFAFA]"></div>

      {/* Top Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-[#FAFAFA] sticky top-0 z-50">
        <button 
          onClick={closeApp} 
          className="p-2 -ml-2 text-black hover:bg-black/5 rounded-full transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="w-6 h-6" strokeWidth={2} />
        </button>
        
        <div className="flex-1 flex justify-center items-center relative h-12">
          {/* Using the new geometric rabbit logo */}
          <Image 
            src="/logo-main.png" 
            alt="Rabbitty Logo" 
            width={48} 
            height={48}
            className="object-contain"
            priority
          />
        </div>
        
        <div className="w-10"></div> {/* Spacer to balance the header */}
      </header>

      {/* Tabs */}
      <nav className="flex items-center justify-between px-6 pt-4 pb-0 bg-[#FAFAFA] border-b border-gray-100">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 relative text-sm font-medium transition-colors ${
              activeTab === tab ? 'text-black' : 'text-gray-400'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF0066]"
                initial={false}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </nav>

      {/* Feed Area */}
      <main className="flex-1 overflow-y-auto pb-24">
        {activeTab === "bunz'in" && (
          <div className="flex flex-col gap-4 mt-4 px-4">
            
            {/* Card 1 */}
            <div className="bg-white rounded-[24px] shadow-sm overflow-hidden flex flex-col border border-gray-50">
              {/* Image placeholder mimicking the photo from the screenshot */}
              <div className="relative w-full aspect-[4/3] bg-gray-100">
                <Image 
                  src="/logo-main.png" 
                  alt="Post Content"
                  fill
                  className="object-cover opacity-20 scale-150 blur-xl"
                />
                {/* Simulated photo content */}
                <div className="absolute inset-0 flex items-center justify-center p-4">
                   <div className="w-full h-full bg-gradient-to-br from-yellow-100 via-orange-50 to-white rounded-xl flex items-center justify-center shadow-inner relative overflow-hidden">
                      <div className="text-center">
                        <span className="text-6xl mb-2 block">🥗</span>
                        <span className="font-medium text-gray-500">Delicious Toast</span>
                      </div>
                   </div>
                </div>
              </div>
              
              <div className="p-4 flex items-start justify-between">
                <div>
                  <h3 className="text-black font-medium text-base mb-1">Conejito</h3>
                  <p className="text-gray-500 text-sm font-light">iPhone X – 1 minute ago</p>
                </div>
                <button className="p-2 text-gray-800 hover:bg-gray-100 rounded-full transition-colors">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-white rounded-[24px] shadow-sm overflow-hidden flex flex-col border border-gray-50">
              <div className="relative w-full aspect-[4/3] bg-gray-100">
                <Image 
                  src="/logo-main.png" 
                  alt="Post Content"
                  fill
                  className="object-cover opacity-20 scale-150 blur-xl"
                />
                <div className="absolute inset-0 flex items-center justify-center p-4">
                   <div className="w-full h-full bg-gradient-to-br from-pink-50 via-white to-gray-50 rounded-xl flex items-center justify-center shadow-inner">
                      <div className="text-center">
                        <span className="text-6xl mb-2 block">☕</span>
                        <span className="font-medium text-gray-500">Morning Coffee</span>
                      </div>
                   </div>
                </div>
              </div>
              
              <div className="p-4 flex items-start justify-between">
                <div>
                  <h3 className="text-black font-medium text-base mb-1">Conejito</h3>
                  <p className="text-gray-500 text-sm font-light">iPhone X – 5 minutes ago</p>
                </div>
                <button className="p-2 text-gray-800 hover:bg-gray-100 rounded-full transition-colors">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>
            </div>

          </div>
        )}

        {activeTab === "Stock" && (
          <div className="flex items-center justify-center h-48 text-gray-400">
            Stock Content
          </div>
        )}

        {activeTab === "Freehands" && (
          <div className="flex items-center justify-center h-48 text-gray-400">
            Freehands Content
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-100 pb-safe-bottom">
        <div className="flex items-center justify-between px-8 py-3">
          
          <button className="flex flex-col items-center justify-center w-12 h-12">
            <span className="font-['Brush_Script_MT',_cursive] text-3xl text-[#FF0066] leading-none" style={{ fontFamily: 'Brush Script MT, cursive' }}>Ra</span>
          </button>
          
          <button className="flex flex-col items-center justify-center w-12 h-12 text-gray-400 hover:text-black transition-colors">
            <MessageCircle className="w-6 h-6" strokeWidth={1.5} />
          </button>
          
          <button className="flex flex-col items-center justify-center w-12 h-12 text-gray-400 hover:text-black transition-colors">
            <Maximize className="w-6 h-6" strokeWidth={1.5} />
          </button>
          
          <button className="flex flex-col items-center justify-center w-12 h-12 text-[#10B981] hover:text-green-600 transition-colors">
            <ShoppingBag className="w-6 h-6" strokeWidth={1.5} />
          </button>

        </div>
      </nav>
    </div>
  );
}
