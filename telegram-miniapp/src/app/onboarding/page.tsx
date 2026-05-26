'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/ui/Button';
import { ChevronRight, MapPin, Camera, Sparkles } from 'lucide-react';

const STEPS = [
  {
    id: 'welcome',
    title: 'Bienvenido a Rabbitty',
    description: 'La app que recompensa tu estilo de vida y tu tiempo con amigos.',
    icon: '🐰',
  },
  {
    id: 'how-it-works',
    title: '¿Cómo funciona?',
    description: 'Escanea códigos QR en comercios afiliados para ganar bunz automáticamente en cada visita.',
    icon: '📱',
  },
  {
    id: 'spend-bunz',
    title: 'Utiliza tus bunz',
    description: 'Canjea tus bunz acumulados en cualquier negocio de la red. ¡Consume más, gana más!',
    icon: '💰',
  },
  {
    id: 'permissions',
    title: 'Configura tus accesos',
    description: 'Solicitamos acceso a tu cámara y ubicación para habilitar el escaneo rápido de QR y mapa de comercios.',
    icon: '🔐',
  },
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [permissions, setPermissions] = useState({ camera: false, location: false });

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
    });
  }, []);

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setDirection(1);
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep(prev => prev - 1);
    }
  };

  const togglePermission = (type: 'camera' | 'location') => {
    setPermissions(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const step = STEPS[currentStep];

  return (
    <div className="page-wrap bg-white flex flex-col justify-between pb-8">
      <div style={{ height: 'var(--safe-top)' }} />

      {/* Progress Dots */}
      <div className="flex justify-center gap-2 pt-8 pb-4">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === currentStep ? 'w-8 bg-[#E91E63]' : 'w-1.5 bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 w-full max-w-[600px] mx-auto px-6 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            initial={{ opacity: 0, x: direction * 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -50 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="flex flex-col items-center text-center max-w-[320px]"
          >
            {/* Icon / Illustration */}
            <div className="w-32 h-32 rounded-full bg-[#E91E63]/5 flex items-center justify-center mb-8 relative border border-[#E91E63]/10">
              <div className="absolute inset-0 bg-[#E91E63]/5 rounded-full blur-md opacity-40 pointer-events-none" />
              {step.id === 'permissions' ? (
                <div className="flex flex-col gap-2 scale-90 relative z-10">
                  {/* Camera Permission */}
                  <button
                    onClick={() => togglePermission('camera')}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all duration-300 ${
                      permissions.camera
                        ? 'bg-[#E91E63]/10 border-[#E91E63] text-[#E91E63]'
                        : 'bg-white border-[#E0E0E0] text-[#111111]'
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    <span className="text-xs font-semibold">Cámara</span>
                    {permissions.camera && <span className="text-xs font-bold ml-1">✓</span>}
                  </button>

                  {/* Location Permission */}
                  <button
                    onClick={() => togglePermission('location')}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all duration-300 ${
                      permissions.location
                        ? 'bg-[#E91E63]/10 border-[#E91E63] text-[#E91E63]'
                        : 'bg-white border-[#E0E0E0] text-[#111111]'
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                    <span className="text-xs font-semibold">Ubicación</span>
                    {permissions.location && <span className="text-xs font-bold ml-1">✓</span>}
                  </button>
                </div>
              ) : (
                <span className="text-5xl relative z-10">{step.icon}</span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl font-normal text-[#111111] mb-3">
              {step.title}
            </h1>

            {/* Description */}
            <p className="text-[#8A8A8A] text-[14px] leading-relaxed font-light">
              {step.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Navigation Buttons */}
      <div className="w-full max-w-[400px] mx-auto px-6 space-y-3">
        {currentStep === STEPS.length - 1 ? (
          <a href="/role-selection" className="block w-full">
            <Button variant="pink" fullWidth size="lg">
              Comenzar
              <Sparkles className="w-4 h-4 ml-1" />
            </Button>
          </a>
        ) : (
          <div className="flex flex-col gap-2">
            <Button variant="primary" fullWidth size="lg" onClick={nextStep}>
              Continuar
              <ChevronRight className="w-4 h-4" />
            </Button>

            <div className="flex justify-between items-center px-2 pt-2">
              {currentStep > 0 ? (
                <button
                  onClick={prevStep}
                  className="text-xs font-medium text-[#8A8A8A] active:opacity-60 transition-opacity"
                >
                  Atrás
                </button>
              ) : (
                <div />
              )}
              
              <button
                onClick={() => setCurrentStep(STEPS.length - 1)}
                className="text-xs font-medium text-[#8A8A8A] active:opacity-60 transition-opacity"
              >
                Saltar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
