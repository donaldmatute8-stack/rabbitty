'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import { ChevronRight, MapPin, ScanLine, Wallet, Bell, Camera, Share2 } from 'lucide-react';

const STEPS = [
  {
    id: 'welcome',
    title: 'Bienvenido a Rabbitty',
    description: 'La app donde ganas recompensas por cada experiencia.',
    icon: '🐰',
  },
  {
    id: 'how-it-works',
    title: '¿Cómo funciona?',
    description: 'Escanea QR en negocios afiliados, gana bunz automáticamente.',
    icon: '📱',
  },
  {
    id: 'spend-bunz',
    title: 'Usa tus bunz',
    description: 'Gasta tus bunz en otros negocios. Mientras más consumas, más ganas.',
    icon: '💰',
  },
  {
    id: 'permissions',
    title: 'Permisos',
    description: 'Necesitamos acceso a tu cámara y ubicación para el escaneo QR.',
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
    <div className="page-wrap bg-white">
      <div style={{ height: 'var(--safe-top)' }} />

      {/* Progress Dots */}
      <div className="flex justify-center gap-2 pt-6 pb-4">
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
      <main className="flex-1 px-8 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            initial={{ opacity: 0, x: direction * 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -50 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center text-center max-w-[320px]"
          >
            {/* Icon / Illustration */}
            <div className="w-32 h-32 rounded-full bg-[#E91E63]/10 flex items-center justify-center mb-8">
              {step.id === 'permissions' ? (
                <div className="flex flex-col gap-3">
                  {/* Camera Permission */}
                  <button
                    onClick={() => togglePermission('camera')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                      permissions.camera
                        ? 'bg-[#E91E63]/10 border-[#E91E63] text-[#E91E63]'
                        : 'bg-gray-50 border-gray-200 text-[#111111]'
                    }`}
                  >
                    <Camera className="w-5 h-5" />
                    <span className="text-sm font-medium">Cámara</span>
                    {permissions.camera && <span className="ml-auto text-xs">✓</span>}
                  </button>

                  {/* Location Permission */}
                  <button
                    onClick={() => togglePermission('location')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                      permissions.location
                        ? 'bg-[#E91E63]/10 border-[#E91E63] text-[#E91E63]'
                        : 'bg-gray-50 border-gray-200 text-[#111111]'
                    }`}
                  >
                    <MapPin className="w-5 h-5" />
                    <span className="text-sm font-medium">Ubicación</span>
                    {permissions.location && <span className="ml-auto text-xs">✓</span>}
                  </button>
                </div>
              ) : (
                <span className="text-6xl">{step.icon}</span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl font-semibold text-[#111111] mb-4">
              {step.title}
            </h1>

            {/* Description */}
            <p className="text-[#8A8A8A] text-[15px] leading-relaxed">
              {step.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Navigation Buttons */}
      <div className="px-8 pb-8 space-y-3">
        {currentStep === STEPS.length - 1 ? (
          <a href="/role-selection">
            <Button variant="primary" fullWidth size="lg">
              Comenzar
              <ChevronRight className="w-5 h-5" />
            </Button>
          </a>
        ) : (
          <>
            <Button variant="primary" fullWidth size="lg" onClick={nextStep}>
              Continuar
              <ChevronRight className="w-5 h-5" />
            </Button>

            {currentStep > 0 && (
              <Button variant="ghost" fullWidth size="md" onClick={prevStep}>
                Atrás
              </Button>
            )}

            <button
              onClick={() => setCurrentStep(STEPS.length - 1)}
              className="w-full text-center text-sm text-[#8A8A8A] py-2"
            >
              Saltar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
