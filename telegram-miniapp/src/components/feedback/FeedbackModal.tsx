'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, MessageSquarePlus, X, Send, CheckCircle2 } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import { useToast } from '@/contexts/ToastContext';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'BUG' | 'FEEDBACK';
}

export function FeedbackModal({ isOpen, onClose, initialType = 'BUG' }: FeedbackModalProps) {
  const [type, setType] = useState<'BUG' | 'FEEDBACK'>(initialType);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      showToast('Por favor describe tu reporte o sugerencia', 'info');
      return;
    }

    setSending(true);
    PlatformBridge.hapticFeedback('medium');

    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          type,
          title: title.trim() || (type === 'BUG' ? 'Reporte de Bug' : 'Sugerencia de Mejora'),
          message: message.trim(),
          url: typeof window !== 'undefined' ? window.location.href : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        }),
      });

      if (res.ok) {
        setSent(true);
        PlatformBridge.hapticFeedback('success');
        showToast(type === 'BUG' ? 'Reporte enviado con éxito' : '¡Gracias por tu feedback!', 'success');
        setTimeout(() => {
          setSent(false);
          setTitle('');
          setMessage('');
          onClose();
        }, 1600);
      } else {
        showToast('No se pudo enviar. Intenta nuevamente.', 'error');
      }
    } catch {
      showToast('Error de conexión', 'error');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-210 flex items-end sm:items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ y: '100%', opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: '100%', opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-lg rounded-3xl p-6 overflow-hidden border shadow-2xl z-10"
          style={{
            background: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
            style={{ background: 'var(--bg-pressed)', color: 'var(--text-muted)' }}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>

          {/* Type Selector Tabs */}
          <div className="flex items-center gap-2 mb-5 p-1 rounded-2xl bg-[var(--bg-pressed)] border border-[var(--border-subtle)] w-fit">
            <button
              type="button"
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                setType('BUG');
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              style={{
                background: type === 'BUG' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                color: type === 'BUG' ? '#EF4444' : 'var(--text-secondary)',
                border: type === 'BUG' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid transparent',
              }}
            >
              <Bug size={14} />
              <span>Report a bug</span>
            </button>

            <button
              type="button"
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                setType('FEEDBACK');
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              style={{
                background: type === 'FEEDBACK' ? 'rgba(233, 30, 99, 0.15)' : 'transparent',
                color: type === 'FEEDBACK' ? '#E91E63' : 'var(--text-secondary)',
                border: type === 'FEEDBACK' ? '1px solid rgba(233, 30, 99, 0.3)' : '1px solid transparent',
              }}
            >
              <MessageSquarePlus size={14} />
              <span>Leave Feedback</span>
            </button>
          </div>

          <h3 className="text-lg font-black text-[var(--text-primary)] mb-1">
            {type === 'BUG' ? 'Reportar un problema' : 'Compartir sugerencia o idea'}
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mb-4">
            {type === 'BUG'
              ? 'Describe qué falló o qué pantalla no respondió como esperabas. Nuestro equipo lo revisará.'
              : 'Dinos qué te gustaría ver en Rabbitty para hacer tu experiencia más rápida y divertida.'}
          </p>

          {sent ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
                <CheckCircle2 size={30} />
              </div>
              <h4 className="text-base font-bold text-white mb-1">¡Mensaje recibido!</h4>
              <p className="text-xs text-[var(--text-secondary)]">Gracias por ayudarnos a perfeccionar Rabbitty.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <input
                  type="text"
                  placeholder={type === 'BUG' ? 'Ej. El botón de pagar no cargó' : 'Ej. Agregar filtro por mascotas'}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-xs outline-none transition-all"
                  style={{
                    background: 'var(--bg-pressed)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div>
                <textarea
                  rows={4}
                  placeholder={type === 'BUG' ? 'Cuéntanos con detalle qué pasos hiciste cuando ocurrió el fallo...' : 'Escribe tus comentarios o ideas aquí...'}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-xs outline-none transition-all resize-none"
                  style={{
                    background: 'var(--bg-pressed)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="px-5 py-2.5 rounded-xl text-xs font-black text-white flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
                  style={{
                    background: type === 'BUG' ? '#EF4444' : '#E91E63',
                  }}
                >
                  <Send size={13} />
                  <span>{sending ? 'Enviando…' : 'Enviar'}</span>
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
