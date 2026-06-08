"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, Zap, Target, Award, ShieldCheck, MapPin, Rocket } from 'lucide-react';
import { FeatureCard, NodeTier } from '../components/visuals';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-yellow-500 selection:text-black font-sans overflow-x-hidden">
      
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden px-4">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1a1a1a_0%,#000_100%)]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-yellow-500/10 rounded-full blur-[120px] animate-pulse" />
        </div>

        <div className="relative z-10 text-center max-w-4xl">
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="inline-block px-4 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 text-xs font-bold uppercase tracking-widest mb-6"
          >
            The New Era of Influence
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-7xl md:text-9xl font-black tracking-tighter leading-none mb-8 italic uppercase"
          >
            Rabbitty <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-600">Identity 2.0</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto leading-relaxed mb-12 italic"
          >
            "Toda gran transición redefine quién tiene acceso… y quién captura valor."
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-wrap justify-center gap-4"
          >
            <div className="px-8 py-4 rounded-full bg-white text-black font-black uppercase tracking-widest hover:bg-yellow-400 transition-all cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.3)]">
              Explorar el Ecosistema
            </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-gray-500 text-xs uppercase tracking-widest animate-bounce"
        >
          Scroll para la experiencia ↓
        </motion.div>
      </section>

      {/* Vision Section */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -50 }} 
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <h2 className="text-5xl font-black uppercase italic leading-tight">
              Convertir el <span className="text-yellow-500">Negocio</span> en un <br/>
              <span className="text-white border-b-4 border-yellow-500">Imán de Poder</span>
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed">
              El Efecto Nodo no es marketing, es arquitectura social. Transformamos el flujo físico de los negocios afiliados en una fuente constante de captación de Rabbitters.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FeatureCard icon={Zap} title="Geofencing" description="Saturación digital en radios de 1-3km alrededor del nodo." />
              <FeatureCard icon={Target} title="Bucle Viral" description="Rabbitter $\rightarrow$ Afiliado $\rightarrow$ Rabbitter." />
              <FeatureCard icon={Award} title="Estatus" description="Jerarquía de Nodos que impulsa la ambición y el crecimiento." />
              <FeatureCard icon={ShieldCheck} title="Sincronización" description="Soporte y validación automatizada vía The Hub." />
            </div>
          </motion.div>
          <div className="relative">
            <div className="aspect-square bg-gradient-to-tr from-yellow-600 to-orange-400 rounded-3xl rotate-3 scale-95 opacity-20 absolute inset-0" />
            <div className="aspect-square bg-gray-900 rounded-3xl border border-white/10 p-12 flex items-center justify-center relative z-10 shadow-2xl">
                <div className="text-center">
                    <div className="text-8xl font-black text-white italic opacity-20">NODOS</div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Rocket className="w-24 h-24 text-yellow-500 animate-bounce" />
                    </div>
                </div>
            </div>
          </div>
        </div>
      </section>

      {/* Nodes Hierarchy Section */}
      <section className="py-32 px-6 bg-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-black uppercase italic mb-4">Jerarquía de <span className="text-yellow-500">Soberanía</span></h2>
            <p className="text-gray-400 max-w-2xl mx-auto italic">No todos los Rabbitters son iguales. El poder se escala según la capacidad de expansión.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <NodeTier 
              tier="Bронce" 
              color="border-orange-900/50"
              description="El primer paso hacia la red de influencia."
              perks={["Gestión de 1-3 negocios locales", "Acceso básico al Hub", "Bonos de captación inicial"]}
            />
            <NodeTier 
              tier="Plata" 
              color="border-slate-400/50"
              description="Socio estratégico con influencia comprobada."
              perks={["Gestión de 4-10 negocios", "Acceso prioritario a soporte", "Bono de escala regional"]}
            />
            <NodeTier 
              tier="Oro" 
              color="border-yellow-500"
              description="Líder de territorio. El máximo exponente de la red."
              perks={["Liderazgo de otros Nodos", "Revenue share avanzado", "Acceso total a Analytics de zona"]}
            />
          </div>
        </div>
      </section>

      {/* Physical Kit Section */}
      <section className="py-32 px-6 max-w-7xl mx-auto text-center">
        <div className="mb-20">
          <h2 className="text-5xl font-black uppercase italic mb-4">El Kit de <span className="text-yellow-500">Implementación</span></h2>
          <p className="text-gray-400 max-w-2xl mx-auto italic">Materiales disruptivos diseñados para generar curiosidad inmediata y fricción cero.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          <div className="space-y-6 group">
            <div className="aspect-video bg-gray-800 rounded-2xl border border-white/10 flex items-center justify-center group-hover:border-yellow-500/50 transition-all overflow-hidden">
                <div className="p-8 text-center">
                    <div className="text-3xl font-black italic text-white opacity-40">TENT CARDS</div>
                    <div className="text-xs text-yellow-500 uppercase tracking-widest font-bold mt-2">Seductores de Mesa</div>
                </div>
            </div>
            <h3 className="text-xl font-bold text-white italic">Tent Cards Disruptivas</h3>
            <p className="text-gray-400 text-sm">Triángulos de mesa con copy agresivo que convierte el tiempo de espera en captación de Rabbitters.</p>
          </div>
          <div className="space-y-6 group">
            <div className="aspect-video bg-gray-800 rounded-2xl border border-white/10 flex items-center justify-center group-hover:border-yellow-500/50 transition-all overflow-hidden">
                <div className="p-s-8 text-center">
                    <div className="text-3xl font-black italic text-white opacity-40">STICKERS</div>
                    <div className="text-xs text-yellow-500 uppercase tracking-widest font-bold mt-2">Imanes de Curiosidad</div>
                </div>
            </div>
            <h3 className="text-xl font-bold text-white italic">Stickers de Punto de Contacto</h3>
            <p className="text-gray-400 text-sm">Colocados en espejos, puertas y cajas. El punto de contacto físico que dispara la suscripción.</p>
          </div>
          <div className="space-y-6 group">
            <div className="aspect-video bg-gray-800 rounded-2xl border border-white/10 flex items-center justify-center group-hover:border-yellow-500/50 transition-all overflow-hidden">
                <div className="p-8 text-center text-white opacity-40">
                    <div className="text-3xl font-black italic">VIP PASS</div>
                    <div className="text-xs text-yellow-500 uppercase tracking-widest font-bold mt-2">Llaves del Reino</div>
                </div>
            </div>
            <h3 className="text-xl font-bold text-white la">VIP Pass Cards</h3>
            <p className="text-gray-400 text-sm">Tarjetas físicas de invitación exclusiva para perfiles de alto valor seleccionados por el negocio.</p>
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="py-20 border-t border-white/10 text-center">
        <div className="text-sm text-gray-500 uppercase tracking-widest mb-8">
          Rabbitty Hub 2026 &copy;
        </div>
        <div className="flex justify-center gap-6">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white cursor-pointer hover:bg-white/20 transition-all">
            <Zap className="w-5 h-5" />
          </div>
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white cursor-pointer hover:bg-white/20 transition-all">
            <Target className="w-5 h-5" />
          </div>
        </div>
      </footer>

    </div>
  );
}
