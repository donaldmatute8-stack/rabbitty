'use client';

import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
        <Settings size={24} className="text-gray-400" />
      </motion.div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">Configuración</h2>
      <p className="text-sm text-gray-500">Próximamente podrás configurar tu negocio aquí.</p>
    </div>
  );
}
