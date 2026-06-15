"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, QrCode, Link as LinkIcon, BrainCircuit, ChevronRight, X, Play } from 'lucide-react';
import { Button } from '@rabbitty/ui';

const FEATURES = [
  {
    id: "migracion",
    title: "Migración Mágica",
    subtitle: "Importa tu menú completo desde UberEats en 1 clic.",
    icon: <Sparkles className="w-8 h-8 text-pink-500" />,
    color: "from-pink-500 to-rose-500",
    description: "Nuestra IA escanea el enlace público de tu restaurante en UberEats o Rappi y extrae cada categoría, producto, precio y descripción de manera automática. Tu menú estará listo en segundos sin tener que teclear nada.",
    action: "Ir a Sincronización",
    actionHref: "/restaurant-sync"
  },
  {
    id: "byod",
    title: "Pedidos en Mesa (BYOD)",
    subtitle: "Tus clientes ordenan y pagan desde su celular.",
    icon: <QrCode className="w-8 h-8 text-violet-500" />,
    color: "from-violet-500 to-purple-600",
    description: "Coloca nuestros códigos QR estéticos en cada mesa. Cuando el cliente escanea, se abre automáticamente la Mini App en Telegram. Pueden ver tu menú interactivo, armar su pedido y pagar directamente con Apple Pay, Google Pay o Telegram Stars. La orden llega directo a tu cocina.",
    action: "Generar Códigos QR",
    actionHref: "/qr-generator"
  },
  {
    id: "webhook",
    title: "Integración Universal",
    subtitle: "Un solo punto de entrada para todas las plataformas.",
    icon: <LinkIcon className="w-8 h-8 text-blue-500" />,
    color: "from-blue-500 to-cyan-500",
    description: "Rabbitty actúa como tu cerebro central. Activa nuestro Webhook y todas las órdenes que entren por Rappi, DidiFood o UberEats caerán automáticamente en nuestro KDS (Kitchen Display System), reduciendo los errores de transcripción a cero.",
    action: "Ver Configuración",
    actionHref: "/settings"
  },
  {
    id: "inventory",
    title: "Inventario Predictivo IA",
    subtitle: "Nunca más te quedes sin ingredientes clave.",
    icon: <BrainCircuit className="w-8 h-8 text-emerald-500" />,
    color: "from-emerald-500 to-teal-500",
    description: "Nuestro algoritmo analiza matemáticamente los últimos 30 días de consumo y cruza esa información con tu inventario actual. Si detecta que te quedarás sin insumos en menos de 3 días, te alertará automáticamente con sugerencias exactas de compra.",
    action: "Ver Predicciones",
    actionHref: "/inventory"
  }
];

export default function AcademyPage() {
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-100 text-pink-700 text-sm font-semibold mb-4"
        >
          <Sparkles className="w-4 h-4" />
          Nuevas Funcionalidades
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl font-black text-gray-900 tracking-tight mb-4"
        >
          Rabbitty <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-600">Academy</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-lg text-gray-500 max-w-2xl"
        >
          Descubre el poder de las herramientas de última generación que hemos diseñado para automatizar tu restaurante, multiplicar tus ventas y optimizar tu tiempo.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {FEATURES.map((feature, idx) => (
          <motion.div
            key={feature.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + (idx * 0.1) }}
            onClick={() => setSelectedFeature(feature.id)}
            className="group relative bg-white rounded-3xl p-8 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)] transition-all cursor-pointer overflow-hidden"
          >
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
            
            <div className="flex items-start justify-between mb-6">
              <div className={`p-4 rounded-2xl bg-gradient-to-br ${feature.color} bg-opacity-10`}>
                <div className="bg-white rounded-xl p-2 shadow-sm">
                  {feature.icon}
                </div>
              </div>
              <Button variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
                Aprender más <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            
            <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-gray-900 group-hover:to-gray-600 transition-all">
              {feature.title}
            </h3>
            <p className="text-gray-500 font-medium">
              {feature.subtitle}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {selectedFeature && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedFeature(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[32px] p-8 max-w-2xl w-full shadow-2xl overflow-hidden"
            >
              {(() => {
                const feature = FEATURES.find(f => f.id === selectedFeature)!;
                return (
                  <>
                    <div className={`absolute top-0 left-0 w-full h-32 bg-gradient-to-br ${feature.color} opacity-10`} />
                    
                    <button 
                      onClick={() => setSelectedFeature(null)}
                      className="absolute top-6 right-6 p-2 bg-white rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors z-10 shadow-sm"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <div className="relative z-10">
                      <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-white shadow-md border border-gray-100 mb-6">
                        {feature.icon}
                      </div>
                      
                      <h2 className="text-3xl font-black text-gray-900 mb-3">{feature.title}</h2>
                      <p className="text-xl text-gray-600 font-medium mb-6">{feature.subtitle}</p>
                      
                      <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100">
                        <p className="text-gray-700 leading-relaxed text-lg">
                          {feature.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <Button 
                          onClick={() => window.location.href = feature.actionHref}
                          className={`bg-gradient-to-r ${feature.color} hover:opacity-90 text-white shadow-lg py-6 px-8 text-lg rounded-xl font-bold`}
                        >
                          {feature.action}
                        </Button>
                        <Button variant="secondary" className="py-6 px-8 text-lg rounded-xl font-bold text-gray-700">
                          <Play className="w-5 h-5 mr-2" />
                          Ver Video Tutorial
                        </Button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
