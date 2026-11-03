'use client';

/**
 * ── RatingSheet ── Fase 1 Rabbitty Score: prompt post-pago OPCIONAL.
 * - Solo se monta tras confirmación de pago (lo decide el caller).
 * - 1 evaluación por orden (server-side UNIQUE + autorización).
 * - Chips NEUTRALES idénticos para 1-5★ (sin reordenar por estrellas).
 * - No bloquea: se puede cerrar sin calificar.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, X, Loader2, CheckCircle2 } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import { toast } from '@rabbitty/ui';

const ATTRS = [
  { id: 'atencion', label: 'Atención' },
  { id: 'comida', label: 'Comida' },
  { id: 'tiempo', label: 'Tiempo' },
  { id: 'ambiente', label: 'Ambiente' },
] as const;

type Attr = typeof ATTRS[number]['id'];

export default function RatingSheet({
  orderId,
  businessName,
  onClose,
  onSubmitted,
  compact = false,
}: {
  orderId: string;
  businessName?: string;
  onClose: () => void;
  /** H10: cuando el rating fue enviado con éxito — el caller decide a dónde llevar al usuario (ej. salir al feed). */
  onSubmitted?: () => void;
  /** H-RATE-UX: presentación compacta secundaria (post-liquidación) — la experiencia va ABAJO, atrás del éxito grande. */
  compact?: boolean;
}) {
  const [stars, setStars] = useState<number>(0);
  const [attrs, setAttrs] = useState<Attr[]>([]);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const toggleAttr = (id: Attr) => {
    PlatformBridge.hapticFeedback('light');
    setAttrs((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]);
  };

  const submit = async () => {
    if (stars < 1 || sending) return;
    setSending(true);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/pay/rate', {
        method: 'POST',
        headers: { ...(headers || {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, stars, attributes: attrs, comment: comment.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.success) throw new Error(data?.error || 'No se pudo enviar');
      PlatformBridge.hapticFeedback('success');
      setDone(true);
      if (onSubmitted) {
        // H10: post-submit → el caller sale del cobro a feed (auto)
        setTimeout(() => onSubmitted(), 1200);
      } else {
        setTimeout(onClose, 1400);
      }
    } catch (e: any) {
      toast.error(String(e?.message || 'No se pudo enviar tu evaluación').slice(0, 140));
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl bg-white/5 border border-white/10 space-y-3 ${compact ? 'p-3' : 'p-4'}`}
    >
      <div className={compact ? 'flex items-start justify-between gap-2' : 'flex items-start justify-between'}>
        <div className="min-w-0">
          <p className={`${compact ? 'text-[11px]' : 'text-sm'} font-black text-white`}>
            ¿Cómo estuvo tu experiencia{businessName ? ` en ${businessName}` : ''}?
          </p>
          <p className={`${compact ? 'text-[9px]' : 'text-[10px]'} text-white/40`}>Opcional — nos ayuda a mejorar el servicio del comercio.</p>
        </div>
        {!compact && (
          <button onClick={onClose} aria-label="Cerrar" className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/50">
            <X size={14} />
          </button>
        )}
      </div>

      {done ? (
        <div className={compact ? 'py-2 text-center' : 'py-3 text-center'}>
          <CheckCircle2 className={`${compact ? 'h-6 w-6' : 'h-8 w-8'} text-emerald-400 mx-auto`} />
          <p className={`${compact ? 'text-[10px]' : 'text-xs'} font-bold text-white/80 mt-2`}>¡Gracias por tu evaluación!</p>
        </div>
      ) : (
        <>
          {/* Estrellas */}
          <div className={`flex items-center justify-center ${compact ? 'gap-1' : 'gap-2'}`}>
            {[1, 2, 3, 4, 5].map((i) => (
              <motion.button
                key={i}
                whileTap={{ scale: 0.85 }}
                onClick={() => { setStars(i); PlatformBridge.hapticFeedback('light'); }}
                aria-label={`${i} estrellas`}
                className="p-0.5"
              >
                <Star size={compact ? 21 : 30} className={i <= stars ? 'text-amber-400 fill-amber-400' : 'text-white/20'} />
              </motion.button>
            ))}
          </div>

          {/* Chips neutrales (mismos para todas las calificaciones) */}
          <div className={`flex flex-wrap justify-center ${compact ? 'gap-1' : 'gap-1.5'}`}>
            {ATTRS.map((a) => (
              <button
                key={a.id}
                onClick={() => toggleAttr(a.id)}
                className={`${compact ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'} rounded-full font-bold border transition-all ${
                  attrs.includes(a.id) ? 'bg-white/15 border-white/40 text-white' : 'bg-white/5 border-white/10 text-white/50'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            rows={compact ? 1 : 2}
            placeholder={compact ? 'Comentario (opcional)' : 'Comentario (opcional)'}
            className={`w-full rounded-2xl bg-white/5 border border-white/10 px-3 py-2 text-white placeholder-white/30 outline-none focus:border-[#E91E63]/50 resize-none ${compact ? 'text-[10px]' : 'text-xs'}`}
          />

          <button
            onClick={() => void submit()}
            disabled={stars < 1 || sending}
            className={`w-full bg-linear-to-r from-[#FF2E93] to-[#E91E63] text-white font-black rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-transform ${compact ? 'text-[11px] py-2.5' : 'text-xs py-3'}`}
          >
            {sending ? <><Loader2 size={14} className="animate-spin" /> Enviando…</> : 'Enviar evaluación'}
          </button>
        </>
      )}
    </motion.div>
  );
}