'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, X, ShieldAlert } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import { useToast } from '@/contexts/ToastContext';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  userBunzBalance: number;
  onDeleted: () => void;
}

export function DeleteAccountModal({
  isOpen,
  onClose,
  userBunzBalance,
  onDeleted,
}: DeleteAccountModalProps) {
  const { showToast } = useToast();
  const [confirmationText, setConfirmationText] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptedRisk, setAcceptedRisk] = useState(false);

  if (!isOpen) return null;

  const handleDelete = async () => {
    if (!acceptedRisk) {
      showToast('Debes aceptar que tus Bunz acumulados serán cedidos a la tesorería.', 'error');
      return;
    }
    if (confirmationText.trim() !== 'ELIMINAR') {
      showToast('Escribe "ELIMINAR" exactamente para confirmar.', 'error');
      return;
    }

    setLoading(true);
    PlatformBridge.hapticFeedback('heavy');

    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirmation: 'ELIMINAR' }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Error al eliminar la cuenta', 'error');
        setLoading(false);
        return;
      }

      showToast('Cuenta eliminada. Gracias por usar Rabbitty.', 'info');
      PlatformBridge.hapticFeedback('success');
      onDeleted();
    } catch {
      showToast('Error de conexión al procesar la baja.', 'error');
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-[#16161a] border border-rose-500/30 rounded-2xl p-6 shadow-2xl text-left overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white m-0">Eliminar Cuenta</h3>
                <p className="text-xs text-rose-400 m-0 font-semibold">Acción definitiva e irreversible</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-1 rounded-lg text-white/40 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Advertencia de Bunz y Tesorería */}
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 mb-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-white/90 leading-relaxed">
                <span className="font-bold text-rose-300 block mb-1">
                  ⚠️ Pérdida Irreversible de Recompensas
                </span>
                Tienes <strong className="text-rose-400 text-sm">{userBunzBalance.toLocaleString()} BUNZ</strong> acumulados.
                Al eliminar tu cuenta, todos tus Bunz se cancelarán y <strong className="text-rose-300">se transferirán al fondo de tesorería del protocolo Rabbitty</strong> para amortizar la reserva contable, conforme a los términos de servicio. No podrás recuperarlos ni transferirlos después.
              </div>
            </div>
          </div>

          {/* Resguardo Legal IPFS */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/60 mb-4">
            <ShieldAlert size={14} className="text-white/40 shrink-0" />
            <span>Tus datos personales se expurgan de inmediato. Un comprobante de liquidación contable se ancla de forma inmutable en el Nodo IPFS de Pandoras por requerimiento legal de auditoría comercial.</span>
          </div>

          {/* Checkbox de riesgo */}
          <label className="flex items-start gap-2.5 mb-4 cursor-pointer text-xs text-white/80 select-none">
            <input
              type="checkbox"
              checked={acceptedRisk}
              onChange={(e) => setAcceptedRisk(e.target.checked)}
              className="mt-0.5 rounded border-white/20 accent-[#E91E63]"
            />
            <span>Entiendo el riesgo: mis {userBunzBalance} Bunz se perderán y pasarán a la tesorería de Rabbitty sin derecho a reclamo posterior.</span>
          </label>

          {/* Input de confirmación */}
          <div className="mb-5">
            <label className="block text-xs font-bold text-white/70 mb-1.5">
              Escribe <span className="text-rose-400 font-mono">ELIMINAR</span> para confirmar:
            </label>
            <input
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="ELIMINAR"
              className="w-full bg-black/40 border border-white/15 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-colors"
            />
          </div>

          {/* Acciones */}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/15 active:scale-95 transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading || !acceptedRisk || confirmationText.trim() !== 'ELIMINAR'}
              className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs active:scale-95 transition-all shadow-lg shadow-rose-600/30"
            >
              {loading ? 'Eliminando...' : 'Eliminar Cuenta'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
