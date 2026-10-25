'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, CheckCircle2, Utensils, X } from 'lucide-react';

interface TableSpot {
  id: string;
  number: number;
  capacity?: number;
  location?: string | null;
  qrCode?: string | null;
}

interface TableContextSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tables: TableSpot[];
  currentTableNumber?: number | null;
  onSelectTable: (tableNumber: number, tableId: string) => void;
  businessName: string;
}

export function TableContextSheet({
  isOpen,
  onClose,
  tables,
  currentTableNumber,
  onSelectTable,
  businessName,
}: TableContextSheetProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-999 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4">
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ y: '100%', opacity: 0.8 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-md bg-[#14141E] border border-white/10 rounded-t-4xl sm:rounded-4xl p-6 max-h-[85vh] flex flex-col overflow-hidden shadow-2xl z-10 text-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-pink-500/15 border border-pink-500/20 flex items-center justify-center text-pink-400">
                <QrCode size={20} />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight">Experiencia en Mesa & Barra</h3>
                <p className="text-xs text-white/50">{businessName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Step by step: Cómo funciona */}
          <div className="py-3 space-y-3">
            <div className="grid grid-cols-3 gap-2 bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
              <div className="space-y-1">
                <span className="w-5 h-5 rounded-full bg-[#E91E63]/20 text-[#E91E63] text-[10px] font-black inline-flex items-center justify-center">1</span>
                <p className="text-[10px] font-black text-white">Elige Ubicación</p>
                <p className="text-[9px] text-white/50">Mesa, barra o QR</p>
              </div>
              <div className="space-y-1">
                <span className="w-5 h-5 rounded-full bg-[#E91E63]/20 text-[#E91E63] text-[10px] font-black inline-flex items-center justify-center">2</span>
                <p className="text-[10px] font-black text-white">Arma Pedido</p>
                <p className="text-[9px] text-white/50">Personaliza tus platillos</p>
              </div>
              <div className="space-y-1">
                <span className="w-5 h-5 rounded-full bg-[#E91E63]/20 text-[#E91E63] text-[10px] font-black inline-flex items-center justify-center">3</span>
                <p className="text-[10px] font-black text-white">Directo al Staff</p>
                <p className="text-[9px] text-white/50">Se envía a cocina/barra</p>
              </div>
            </div>

            {currentTableNumber ? (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/25 rounded-2xl flex items-center justify-between text-emerald-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span className="text-xs font-black">
                    Actualmente ubicado en: {tables.find(t => t.number === currentTableNumber)?.location || `Mesa #${currentTableNumber}`}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-white/60 px-1">
                <span className="font-semibold text-[11px] text-white/80">
                  {tables && tables.length > 0 
                    ? 'Selecciona tu lugar o escanea el código QR:' 
                    : 'Servicio directo en mostrador'}
                </span>
              </div>
            )}
          </div>

          {/* Tables Grid */}
          <div className="flex-1 overflow-y-auto py-2">
            {tables && tables.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {tables.map(tbl => {
                  const isSelected = currentTableNumber === tbl.number;
                  const locName = (tbl.location || '').toLowerCase();
                  const isBar = locName.includes('bar') || locName.includes('barra');
                  const isTerrace = locName.includes('terraza') || locName.includes('jardin');

                  return (
                    <motion.button
                      key={tbl.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        onSelectTable(tbl.number, tbl.id);
                        onClose();
                      }}
                      className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all ${
                        isSelected
                          ? 'bg-[#E91E63] border-[#E91E63] text-white shadow-lg shadow-[#E91E63]/40'
                          : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <Utensils size={16} className={isSelected ? 'text-white' : 'text-pink-400'} />
                        <span className="text-xs">{isBar ? '🍸' : isTerrace ? '🌿' : '🍽️'}</span>
                      </div>
                      <span className="text-xs font-black text-center truncate max-w-full">
                        {tbl.location || `Mesa ${tbl.number}`}
                      </span>
                      <span className="text-[9px] opacity-70">
                        {isSelected ? 'Activo' : tbl.capacity ? `${tbl.capacity} pers.` : 'Elegir'}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 px-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                <p className="text-sm font-black text-white">Orden directa en caja</p>
                <p className="text-xs text-white/50 leading-relaxed">
                  Este establecimiento opera con pedidos y cobros directamente en la barra/caja con tu código QR de Rabbitty.
                </p>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="pt-3 border-t border-white/10 text-center">
            <span className="text-[10px] text-white/40">
              Cada orden es confirmada por el personal antes de su preparación.
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
