'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, CheckCircle2, X, Users, Sparkles } from 'lucide-react';

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
  const [activeArea, setActiveArea] = useState<string>('ALL');

  if (!isOpen) return null;

  // Extract unique areas / zones
  const areas = Array.from(new Set(tables.map(t => t.location?.trim() || 'Salón Principal')));
  const filteredTables = activeArea === 'ALL' 
    ? tables 
    : tables.filter(t => (t.location?.trim() || 'Salón Principal') === activeArea);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-999 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xl p-0 sm:p-4">
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ y: '100%', opacity: 0.8 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-lg bg-gradient-to-b from-[#181824] via-[#12121A] to-[#0A0A0F] border border-white/15 rounded-t-[36px] sm:rounded-[36px] p-6 max-h-[90vh] flex flex-col overflow-hidden shadow-[0_-10px_40px_rgba(0,0,0,0.8)] z-10 text-white"
        >
          {/* Grab Handle bar */}
          <div className="sm:hidden absolute top-2.5 inset-x-0 flex justify-center pointer-events-none">
            <span className="w-10 h-1.5 rounded-full bg-white/20" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between pb-4 pt-1 border-b border-white/10">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-pink-500/20 to-purple-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 shadow-[0_0_20px_rgba(236,72,153,0.2)]">
                <QrCode size={22} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-base font-black tracking-tight text-white m-0">Experiencia en Mesa & Barra</h3>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-pink-500/15 text-pink-300 border border-pink-500/30">Digital</span>
                </div>
                <p className="text-xs text-white/50 m-0 mt-0.5">{businessName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 active:scale-90 transition-all flex items-center justify-center text-white/60 hover:text-white border border-white/10"
            >
              <X size={18} />
            </button>
          </div>

          {/* Cómo Funciona */}
          <div className="py-3.5 space-y-3">
            <div className="grid grid-cols-3 gap-2 bg-white/[0.03] p-3 rounded-2xl border border-white/8 text-center backdrop-blur-md">
              <div className="space-y-1">
                <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#E91E63] to-pink-400 text-white text-[10px] font-black inline-flex items-center justify-center shadow-md shadow-pink-500/20">1</span>
                <p className="text-[11px] font-black text-white m-0">Elige Lugar</p>
                <p className="text-[10px] text-white/50 m-0">Mesa o Barra</p>
              </div>
              <div className="space-y-1">
                <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#E91E63] to-pink-400 text-white text-[10px] font-black inline-flex items-center justify-center shadow-md shadow-pink-500/20">2</span>
                <p className="text-[11px] font-black text-white m-0">Arma Pedido</p>
                <p className="text-[10px] text-white/50 m-0">Personaliza platillos</p>
              </div>
              <div className="space-y-1">
                <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#E91E63] to-pink-400 text-white text-[10px] font-black inline-flex items-center justify-center shadow-md shadow-pink-500/20">3</span>
                <p className="text-[11px] font-black text-white m-0">Directo a Cocina</p>
                <p className="text-[10px] text-white/50 m-0">El staff lo recibe al instante</p>
              </div>
            </div>

            {currentTableNumber ? (
              <div className="p-3.5 bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-transparent border border-emerald-500/30 rounded-2xl flex items-center justify-between text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Ubicación asignada</span>
                    <p className="text-xs font-black text-white m-0">
                      {tables.find(t => t.number === currentTableNumber)?.location || `Mesa #${currentTableNumber}`}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                  Activo
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between px-1">
                <span className="font-bold text-xs text-white/80 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-pink-400" />
                  <span>Selecciona tu mesa o ubicación para ordenar:</span>
                </span>
              </div>
            )}

            {/* Filter by Area pills if multiple areas exist */}
            {areas.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-1">
                <button
                  onClick={() => setActiveArea('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    activeArea === 'ALL'
                      ? 'bg-pink-500 text-white shadow-md shadow-pink-500/30 font-black'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  Todas ({tables.length})
                </button>
                {areas.map(area => (
                  <button
                    key={area}
                    onClick={() => setActiveArea(area)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      activeArea === area
                        ? 'bg-pink-500 text-white shadow-md shadow-pink-500/30 font-black'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tables Grid */}
          <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
            {filteredTables && filteredTables.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredTables.map(tbl => {
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
                      className={`relative p-4 rounded-2xl border flex flex-col justify-between gap-2.5 transition-all cursor-pointer text-left ${
                        isSelected
                          ? 'bg-gradient-to-br from-[#E91E63] to-[#AD1457] border-white/30 text-white shadow-[0_8px_25px_rgba(233,30,99,0.45)]'
                          : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-white hover:border-pink-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${
                          isSelected ? 'bg-white/20' : 'bg-white/5 border border-white/10'
                        }`}>
                          {isBar ? '🍸' : isTerrace ? '🌿' : '🍽️'}
                        </div>
                        <span className={`font-mono text-xs font-black px-2 py-0.5 rounded-lg ${
                          isSelected ? 'bg-white text-gray-950 shadow-sm' : 'bg-white/10 text-white/80'
                        }`}>
                          #{tbl.number}
                        </span>
                      </div>

                      <div className="space-y-0.5 min-w-0">
                        <span className="text-xs font-black block truncate">
                          {tbl.location || `Mesa ${tbl.number}`}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] opacity-75">
                          <Users size={12} />
                          <span>{tbl.capacity ? `${tbl.capacity} personas` : 'Mesa'}</span>
                        </div>
                      </div>

                      <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[10px]">
                        <span className={`font-bold ${isSelected ? 'text-white' : 'text-pink-400'}`}>
                          {isSelected ? '✓ Ubicado aquí' : 'Seleccionar'}
                        </span>
                        {!isSelected && <span className="opacity-40">→</span>}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 px-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                <p className="text-sm font-black text-white">Orden directa en caja</p>
                <p className="text-xs text-white/50 leading-relaxed max-w-sm mx-auto">
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
