'use client';

import { useState } from 'react';
import { ShieldCheck, X, Lock, Scale, Sparkles } from 'lucide-react';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  affiliateName?: string;
}

export function PrivacyModal({
  isOpen,
  onClose,
  affiliateName = 'este comercio',
}: PrivacyModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl bg-[#0c0c12] text-zinc-200 p-6 sm:p-8 shadow-2xl border border-zinc-800 text-left space-y-5 animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          aria-label="Cerrar modal"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="space-y-2 pr-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-400 text-[10px] font-mono font-bold uppercase tracking-wider">
            <ShieldCheck size={13} /> Apego a LFPDPPP y PROFECO (México 2026)
          </div>
          <h3 className="text-2xl font-black tracking-tight text-white">
            Aviso de Privacidad y Términos de Servicio
          </h3>
          <p className="text-xs text-zinc-400">
            Última actualización: 19 de Octubre de 2026. Aplicable para {affiliateName} y la Red Rabbitty.
          </p>
        </div>

        {/* Pilares */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800">
            <div className="flex items-center gap-2 text-white font-bold text-xs mb-1">
              <Lock size={14} className="text-pink-400" />
              <span>Privacidad Total</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              No comercializamos ni compartimos tus datos personales con terceros no autorizados.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800">
            <div className="flex items-center gap-2 text-white font-bold text-xs mb-1">
              <Sparkles size={14} className="text-pink-400" />
              <span>bunz de Lealtad</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Los bunz son puntos promocionales para canje directo en consumos oficiales.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800">
            <div className="flex items-center gap-2 text-white font-bold text-xs mb-1">
              <Scale size={14} className="text-pink-400" />
              <span>Derechos ARCO</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Acceso, Rectificación, Cancelación y Oposición garantizados en soporte@rabbitty.me.
            </p>
          </div>
        </div>

        {/* Cláusulas en resumen legal */}
        <div className="space-y-4 text-xs text-zinc-300 leading-relaxed border-t border-zinc-900 pt-4">
          <div>
            <h4 className="font-bold text-white text-sm mb-1">1. Responsable del Tratamiento</h4>
            <p className="text-zinc-400 text-[11px]">
              Rabbitty Technologies opera en territorio mexicano proveyendo el software de fidelización para {affiliateName}. Todos los registros y acreditaciones de saldo se procesan con cifrado de grado bancario.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white text-sm mb-1">2. Datos Recabados y Finalidad</h4>
            <p className="text-zinc-400 text-[11px]">
              Únicamente recabamos datos de identificación (teléfono móvil o correo electrónico) para asignar de forma segura tu saldo de <strong>bunz</strong> acumulado en cada compra. No solicitamos contraseñas bancarias ni números de tarjeta de crédito para recibir recompensas.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white text-sm mb-1">3. Marco Normativo 2026</h4>
            <p className="text-zinc-400 text-[11px]">
              Cumplimiento estricto de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) y los lineamientos de promociones comerciales de PROFECO.
            </p>
          </div>
        </div>

        {/* Botón Cerrar */}
        <div className="pt-3 border-t border-zinc-900 flex items-center justify-between text-xs">
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-pink-400 hover:text-pink-300 underline font-semibold"
          >
            Ver documento completo legal →
          </a>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Aceptar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export function PrivacyTrigger({
  affiliateName = 'este comercio',
  label = 'Aviso de Privacidad (LFPDPPP)',
  className = '',
}: {
  affiliateName?: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`hover:text-stone-950 transition-colors cursor-pointer text-left ${className}`}
      >
        {label}
      </button>

      <PrivacyModal
        isOpen={open}
        onClose={() => setOpen(false)}
        affiliateName={affiliateName}
      />
    </>
  );
}
