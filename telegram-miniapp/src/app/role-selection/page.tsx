'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, ArrowRight } from 'lucide-react';
import Header from '@/components/ui/Header';

export default function RoleSelectionPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
      const tgUser = app.initDataUnsafe.user;
      if (tgUser) setUser(tgUser);
      else setUser({ first_name: 'Bruce' });
    });
  }, []);

  return (
    <div className="page-wrap bg-white">
      <div style={{ height: 'var(--safe-top)' }} />

      {/* Header con hamburger y logo */}
      <header className="flex items-center justify-between px-4 py-3">
        <button className="p-2 -ml-2 text-[#111111]">
          <Menu className="w-7 h-7" strokeWidth={1.5} />
        </button>
        
        <div className="absolute left-1/2 -translate-x-1/2">
          <Image 
            src="/logo-main.png" 
            alt="Rabbitty" 
            width={36} 
            height={36} 
            className="object-contain"
            priority 
          />
        </div>
        
        <div className="w-10" />
      </header>

      <main className="flex-1 px-6 pt-8 flex flex-col items-center">
        {/* Welcome Text */}
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[32px] font-normal text-[#111111] mb-6 text-center"
        >
          Welcome, {user?.first_name || 'Bruce'}.
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center text-[#111111] leading-relaxed text-[15px] mb-12 px-4"
        >
          Rabbitty is about Sharing Experiences,
          <br />
          simply and efficiently use your time and
          <br />
          social life. Benefit yourself with bunz.
        </motion.p>

        {/* No accounts text */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="font-semibold text-[#111111] text-[15px] mb-6"
        >
          You don't have any accounts
        </motion.p>

        {/* Action Cards */}
        <div className="w-full space-y-4 mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Link 
              href="/" 
              className="block bg-white rounded-xl p-6 border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.98] transition-transform"
            >
              <h2 className="font-semibold text-[#111111] text-[15px] text-center mb-1">
                Become a member.
              </h2>
              <p className="text-[#111111] text-[13px] text-center font-medium mb-3">
                Enter de Rabbitty Experience
              </p>
              <div className="flex items-center justify-center gap-2 text-[#E91E63] font-medium text-[15px]">
                <ArrowRight className="w-4 h-4" strokeWidth={2} />
                <span>Open an account</span>
              </div>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Link 
              href="/business" 
              className="block bg-white rounded-xl p-6 border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.98] transition-transform"
            >
              <h2 className="font-semibold text-[#111111] text-[15px] text-center mb-3">
                Own a Business? Affiliate now.
              </h2>
              <div className="flex items-center justify-center gap-2 text-[#E91E63] font-medium text-[15px]">
                <ArrowRight className="w-4 h-4" strokeWidth={2} />
                <span>Open an account</span>
              </div>
            </Link>
          </motion.div>
        </div>

        {/* No activity */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="font-semibold text-[#111111] text-[15px] mb-auto"
        >
          No activity
        </motion.p>

        {/* Footer */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-[#8A8A8A] text-sm font-light mt-12"
        >
          © Rabbitty
        </motion.p>
      </main>
    </div>
  );
}
