'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Users, Store, HelpCircle } from 'lucide-react';

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
    <div className="page-wrap bg-white flex flex-col justify-between py-6">
      <div style={{ height: 'var(--safe-top)' }} />

      {/* Header Centered */}
      <header className="flex items-center justify-between px-6 py-2 relative">
        <div className="w-10" />
        <div className="flex items-center justify-center">
          <img 
            src="/logo.png" 
            alt="Rabbitty" 
            className="h-10 w-auto object-contain"
          />
        </div>
        <button className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-[#8A8A8A] active:scale-95 transition-transform border border-gray-100">
          <HelpCircle className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[600px] mx-auto px-6 pt-6 flex flex-col justify-center">
        
        {/* Welcome Section */}
        <div className="text-center mb-8">
          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[28px] font-normal text-[#111111] mb-3"
          >
            Bienvenido, {user?.first_name || 'Bruce'}.
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-[#8A8A8A] text-[14px] leading-relaxed font-light px-4"
          >
            Rabbitty te conecta con experiencias y recompensas. Aprovecha tu tiempo y vida social ganando y utilizando bunz en tus comercios favoritos.
          </motion.p>
        </div>

        {/* Subtitle */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-[12px] font-semibold text-[#8A8A8A] uppercase tracking-wider mb-4 px-1 text-center"
        >
          Elige cómo deseas continuar
        </motion.p>

        {/* Role Cards */}
        <div className="space-y-4 mb-8">
          {/* Member Card */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Link 
              href="/" 
              className="group block bg-white rounded-2xl p-5 border border-[#F0F0F0] active:scale-[0.98] transition-all hover:shadow-[0_4px_12px_rgba(233,30,99,0.03)] hover:border-[#E91E63]/10"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#E91E63]/5 border border-[#E91E63]/10 flex items-center justify-center text-[#E91E63] flex-shrink-0">
                  <Users className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-medium text-[#111111] text-[16px] mb-0.5">
                    Ser Miembro
                  </h2>
                  <p className="text-[#8A8A8A] text-[13px] font-light leading-relaxed mb-3">
                    Registra consumos, comparte en el feed social y gana tokens bunz.
                  </p>
                  <div className="flex items-center gap-1.5 text-[#E91E63] font-medium text-[14px] transition-transform duration-300 group-hover:translate-x-1">
                    <span>Acceder como miembro</span>
                    <ArrowRight className="w-4 h-4" strokeWidth={2} />
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Business Card */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <Link 
              href="/business" 
              className="group block bg-white rounded-2xl p-5 border border-[#F0F0F0] active:scale-[0.98] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)]"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-[#111111] flex-shrink-0">
                  <Store className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-medium text-[#111111] text-[16px] mb-0.5">
                    Tengo un Negocio
                  </h2>
                  <p className="text-[#8A8A8A] text-[13px] font-light leading-relaxed mb-3">
                    Afíliate, crea campañas de fidelización y recibe bunz como método de pago.
                  </p>
                  <div className="flex items-center gap-1.5 text-[#E91E63] font-medium text-[14px] transition-transform duration-300 group-hover:translate-x-1">
                    <span>Panel de Negocios</span>
                    <ArrowRight className="w-4 h-4" strokeWidth={2} />
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center pt-4">
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="text-[#8A8A8A] text-[12px] font-light"
        >
          © Rabbitty Mini App
        </motion.p>
      </footer>
    </div>
  );
}
