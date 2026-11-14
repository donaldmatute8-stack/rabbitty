'use client';

/**
 * ── GlassPassQR · código QR “glass” (opción A) ─────────────────────────────
 *
 * Un solo panel: el QR, el avatar integrado en una esquina (no centrado como
 * Telegram) y el usuario dentro del mismo panel, con márgenes iguales.
 *
 * Funciones: volver, cerrar, el sol cambia de tema, compartir y escanear.
 * Se enciende con `RABBITTY_CODE_STYLE = 'glass'`; cambiar esa constante
 * devuelve al diseño anterior en una línea.
 */

import { useRef, useState } from 'react';
import { X, Sun, ArrowLeft, Share2, ScanLine, Check, Sparkles, Flame, Leaf, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import BrandQR from './BrandQR';

type ThemeId = 'classic' | 'fire' | 'mint' | 'neon';

interface Palette {
  label: string;
  icon: LucideIcon;
  from: string;
  to: string;
  glow: string;
}

const THEMES: Record<ThemeId, Palette> = {
  classic: { label: 'Clásico', icon: Sparkles, from: '#E91E63', to: '#8B5CF6', glow: 'rgba(233,30,99,0.32)' },
  fire: { label: 'Fuego', icon: Flame, from: '#F97316', to: '#EF4444', glow: 'rgba(249,115,22,0.30)' },
  mint: { label: 'Menta', icon: Leaf, from: '#10B981', to: '#22D3EE', glow: 'rgba(16,185,129,0.28)' },
  neon: { label: 'Neón', icon: Zap, from: '#A855F7', to: '#EC4899', glow: 'rgba(168,85,247,0.30)' },
};

const THEME_IDS = Object.keys(THEMES) as ThemeId[];

interface Props {
  value: string;
  handle?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  theme?: ThemeId;
  onShare?: () => void;
  onClose?: () => void;
  onScan?: () => void;
}

export default function GlassPassQR({ value, handle, name, avatarUrl, theme, onShare, onClose, onScan }: Props) {
  const [activeTheme, setActiveTheme] = useState<ThemeId>(theme ?? 'classic');
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const palette = THEMES[activeTheme];

  const cycleTheme = () => {
    PlatformBridge.hapticFeedback('light');
    const i = THEME_IDS.indexOf(activeTheme);
    setActiveTheme(THEME_IDS[(i + 1) % THEME_IDS.length]!);
  };

  const share = async () => {
    PlatformBridge.hapticFeedback('medium');
    if (onShare) return onShare();
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'Mi Rabbitty Code', url: value });
        return;
      }
      await navigator.clipboard?.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* cancelado */
    }
  };

  return (
    <div
      className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden px-5"
      style={{
        background: `radial-gradient(120% 90% at 50% -10%, ${palette.glow} 0%, rgba(10,7,16,0) 55%), radial-gradient(90% 70% at 90% 110%, ${palette.glow} 0%, rgba(10,7,16,0) 60%), #07060b`,
      }}
    >
      {/* Barra superior */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Volver"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/8 text-white active:scale-90 transition-transform"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        >
          <ArrowLeft size={19} />
        </button>

        <span className="text-[11px] font-black uppercase tracking-[0.22em] text-white/50">
          Mi código · {palette.label}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cycleTheme}
            aria-label={`Cambiar tema (${palette.label})`}
            title="Cambiar tema"
            className="flex h-10 w-10 items-center justify-center rounded-full active:scale-90 transition-transform"
            style={{ background: `${palette.from}26`, color: palette.from, border: `1px solid ${palette.from}55` }}
          >
            <Sun size={18} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-10 w-10 items-center justify-center rounded-full text-white active:scale-90 transition-transform"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Panel único: QR + avatar + usuario, con márgenes iguales */}
      <div className="relative z-10 w-full max-w-[300px]">
        <div
          className="absolute -inset-6 rounded-[44px] opacity-70"
          style={{ background: `radial-gradient(circle at 50% 42%, ${palette.glow}, transparent 72%)` }}
        />

        <div
          ref={panelRef}
          className="relative overflow-hidden rounded-[30px] p-4"
          style={{
            background: `linear-gradient(160deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.93) 52%, ${palette.from}26 100%)`,
            border: `1px solid ${palette.from}40`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.95), 0 24px 60px -24px ${palette.from}bb`,
          }}
        >
          {/* QR con avatar en la esquina inferior derecha (no centrado) */}
          <div className="relative">
            <BrandQR value={value} from={palette.from} to={palette.to} />

            {/* Avatar integrado: esquina inferior derecha, con marco del panel */}
            <div
              className="absolute bottom-0 right-0 flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl"
              style={{
                background: '#ffffff',
                border: `2px solid ${palette.from}55`,
                boxShadow: `0 6px 18px -6px ${palette.from}aa`,
              }}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg">🐰</span>
              )}
            </div>
          </div>

          {/* Usuario dentro del panel, mismo margen que el QR */}
          <div className="mt-3 flex flex-col items-center">
            <p className="m-0 max-w-full truncate text-[13px] font-black text-[#140d1c]">
              {name || 'Tu cuenta Rabbitty'}
            </p>
            {handle && <p className="m-0 mt-0.5 max-w-full truncate text-[11px] font-semibold text-[#140d1c]/60">@{handle}</p>}
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="relative z-10 mt-5 flex w-full max-w-[300px] items-center gap-2">
        <button
          type="button"
          onClick={share}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white active:scale-[0.98] transition-transform"
          style={{
            background: `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)`,
            boxShadow: `0 14px 30px -12px ${palette.from}aa`,
          }}
        >
          {copied ? <Check size={16} /> : <Share2 size={16} />}
          {copied ? 'Enlace copiado' : 'Compartir'}
        </button>
        {onScan && (
          <button
            type="button"
            onClick={() => { PlatformBridge.hapticFeedback('light'); onScan(); }}
            className="flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black text-white active:scale-[0.98] transition-transform"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <ScanLine size={16} /> Escanear
          </button>
        )}
      </div>

      <p className="relative z-10 mt-3 max-w-[300px] text-center text-[11px] text-white/40">
        Muéstralo en caja para identificarte y ganar Bunz.
      </p>
    </div>
  );
}
