'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, CheckCircle2, Utensils, X } from 'lucide-react';

interface TableContextSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tables: Array<{ id: string; number: number; qrCode?: string | null }>;
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
                <h3 className="text-base font-black tracking-tight">Experiencia en Mesa</h3>
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

          {/* Description */}
          <div className="py-4 space-y-2">
            <p className="text-xs text-white/70 leading-relaxed">
              Al sentarte en una mesa, puedes consultar el menú estructurado, personalizar tus platillos y ordenar directamente desde tu celular.
            </p>
            {currentTableNumber ? (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-2.5 text-emerald-400">
                <CheckCircle2 size={16} className="shrink-0" />
                <span className="text-xs font-bold">
                  Actualmente estás ubicado en la Mesa #{currentTableNumber}
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-pink-400/90 font-semibold">
                Selecciona tu mesa o escanea el código QR que se encuentra en ella:
              </p>
            )}
          </div>

          {/* Tables Grid */}
          <div className="flex-1 overflow-y-auto py-2">
            {tables && tables.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {tables.map(tbl => {
                  const isSelected = currentTableNumber === tbl.number;
                  return (
                    <motion.button
                      key={tbl.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        onSelectTable(tbl.number, tbl.id);
                        onClose();
                      }}
                      className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                        isSelected
                          ? 'bg-[#E91E63] border-[#E91E63] text-white shadow-lg shadow-[#E91E63]/40'
                          : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                      }`}
                    >
                      <Utensils size={18} className={isSelected ? 'text-white' : 'text-pink-400'} />
                      <span className="text-sm font-black">Mesa {tbl.number}</span>
                      <span className="text-[10px] opacity-70">
                        {isSelected ? 'Activa' : 'Elegir'}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-white/40 text-xs">
                No hay mesas registradas en el sistema para esta sucursal.
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="pt-4 border-t border-white/10 text-center">
            <span className="text-[11px] text-white/40">
              El restaurante verifica cada orden antes de prepararla.
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
