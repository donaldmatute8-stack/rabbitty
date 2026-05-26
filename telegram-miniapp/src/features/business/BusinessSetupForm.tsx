'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface BusinessSetupFormProps {
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

export default function BusinessSetupForm({ onSubmit, isLoading }: BusinessSetupFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    schedule: '',
    rewardPercentage: 10,
    logoBase64: ''
  });

  const [error, setError] = useState('');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      setError("La imagen no debe pesar más de 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, logoBase64: reader.result as string }));
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category || !formData.description) {
      setError("Por favor completa los campos obligatorios");
      return;
    }
    if (formData.rewardPercentage < 10 || formData.rewardPercentage > 100) {
      setError("El porcentaje debe estar entre 10% y 100%");
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="max-w-md mx-auto py-10 px-6">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-black text-black tracking-tight mb-2">Crea tu Negocio</h1>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          Configura el perfil de tu negocio para unirte a la red Rabbitty y empezar a mintear bunz.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          
          {/* Logo Upload */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
              {formData.logoBase64 ? (
                <img src={formData.logoBase64} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl">📷</span>
              )}
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <p className="text-xs font-semibold text-gray-400">Toca para subir logo (Max 2MB)</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nombre del Negocio *</label>
              <input 
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-black text-sm outline-none focus:border-black transition-colors"
                placeholder="Ej. Café Cultura"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Categoría *</label>
                <input 
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-black text-sm outline-none focus:border-black transition-colors"
                  placeholder="Ej. Restaurante"
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Horario</label>
                <input 
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-black text-sm outline-none focus:border-black transition-colors"
                  placeholder="Ej. 9am - 10pm"
                  value={formData.schedule}
                  onChange={e => setFormData({...formData, schedule: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Descripción *</label>
              <textarea 
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-black text-sm outline-none focus:border-black transition-colors min-h-[80px]"
                placeholder="Breve descripción de tu negocio y lo que ofreces..."
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">Tasa de Recompensa</label>
                <span className="text-xl font-black text-pink-600">{formData.rewardPercentage}%</span>
              </div>
              
              <input
                type="range"
                min="10"
                max="100"
                value={formData.rewardPercentage}
                onChange={(e) => setFormData({...formData, rewardPercentage: Number(e.target.value)})}
                className="w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-black [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-gray-200"
              />
              <p className="text-xs text-gray-400 mt-3 text-center leading-relaxed">
                Compromiso de minteo: Por cada compra, se otorgará el {formData.rewardPercentage}% del valor en bunz al cliente.
              </p>
            </div>
          </div>

          {error && <p className="text-sm font-semibold text-red-500 text-center">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-black text-white rounded-full py-4 text-sm font-bold tracking-wide mt-4 active:scale-95 transition-transform disabled:opacity-50"
          >
            {isLoading ? "Guardando..." : "Crear Negocio"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
