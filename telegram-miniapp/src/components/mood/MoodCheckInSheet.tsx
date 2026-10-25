'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Sparkles, ExternalLink, Headphones, Coffee, Check, 
  ArrowRight, ShieldCheck, MapPin, Gift, Play, Disc3, 
  ChevronRight, RefreshCw, Volume2, Flame
} from 'lucide-react';
import { MOOD_DEFINITIONS, MoodType, MoodDefinition } from '@/types/mood';
import { PlatformBridge } from '@/lib/platform';
import { useTheme } from '@/contexts/ThemeContext';

interface MoodVenue {
  id: string;
  name: string;
  category: string;
  logoUrl: string | null;
  rewardPercentage?: number;
  reason: 'campaign' | 'category';
  campaign: { title: string; description: string | null; rewardBunz: number; activeNow: boolean } | null;
}

interface MoodCampaignInfo {
  title: string;
  description: string | null;
  rewardBunz: number;
}

interface MoodCheckInProps {
  isOpen: boolean;
  onClose: () => void;
  businessId?: string;
  businessName?: string;
  onMoodSelected?: (mood: MoodDefinition) => void;
  /** Llamado por el CTA cuando no hay comercio; por defecto navega a /?tab=Freehands */
  onExploreMap?: () => void;
}

export function MoodCheckInSheet({
  isOpen,
  onClose,
  businessId,
  businessName,
  onMoodSelected,
  onExploreMap,
}: MoodCheckInProps) {
  const { isDark } = useTheme();
  const router = useRouter();
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [activeExperience, setActiveExperience] = useState<MoodDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [dontAskToday, setDontAskToday] = useState(false);
  const [venues, setVenues] = useState<MoodVenue[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(false);
  const [campaign, setCampaign] = useState<MoodCampaignInfo | null>(null);
  const [freeText, setFreeText] = useState('');
  const [interpreting, setInterpreting] = useState(false);
  const [bunzyReply, setBunzyReply] = useState<string | null>(null);
  const [activeMusicTab, setActiveMusicTab] = useState<'spotify' | 'apple' | 'youtube'>('spotify');

  // Cada vez que se abre el panel arranca limpio (evita mostrar el resultado de la vez anterior)
  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setSelectedMood(null);
      setActiveExperience(null);
      setVenues([]);
      setCampaign(null);
      setFreeText('');
      setBunzyReply(null);
      setActiveMusicTab('spotify');
    }
  }

  const loadVenues = async (moodKey: MoodType) => {
    setVenuesLoading(true);
    try {
      const res = await fetch(`/api/mood/venues?mood=${moodKey}&hour=${new Date().getHours()}`);
      const data = await res.json();
      setVenues(data.success ? data.venues : []);
    } catch {
      setVenues([]);
    } finally {
      setVenuesLoading(false);
    }
  };

  const handleSelectMood = async (moodKey: MoodType, via: 'grid' | 'bunzy' = 'grid') => {
    setSelectedMood(moodKey);
    const def = MOOD_DEFINITIONS[moodKey];
    PlatformBridge.hapticFeedback('medium');

    try {
      setLoading(true);
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/mood/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          mood: moodKey,
          businessId: businessId || null,
          source: via === 'bunzy' ? 'bunzy' : businessId ? 'venue' : 'checkin',
        }),
      });
      const payload = await res.json().catch(() => null);
      setCampaign(payload?.campaign ?? null);
      if (!businessId) loadVenues(moodKey);

      if (dontAskToday) {
        try {
          const today = new Date().toISOString().slice(0, 10);
          localStorage.setItem('rabbitty_mood_dismissed_date', today);
        } catch {}
      }

      setActiveExperience(def);
      if (onMoodSelected) onMoodSelected(def);
    } catch (e) {
      console.warn('[MoodCheckIn] Failed to submit:', e);
      setActiveExperience(def);
    } finally {
      setLoading(false);
    }
  };

  // Bunzy interpreta texto libre y elige el mood (el texto no se guarda)
  const handleBunzySubmit = async () => {
    const text = freeText.trim();
    if (text.length < 2 || interpreting) return;
    setInterpreting(true);
    setBunzyReply(null);
    PlatformBridge.hapticFeedback('light');
    try {
      const res = await fetch('/api/mood/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data?.success && data.mood in MOOD_DEFINITIONS) {
        setBunzyReply(data.reply || null);
        await handleSelectMood(data.mood as MoodType, 'bunzy');
      } else {
        setBunzyReply('No logré entenderte, elige una opción de abajo 🐰');
      }
    } catch {
      setBunzyReply('No logré conectarme, elige una opción de abajo 🐰');
    } finally {
      setInterpreting(false);
    }
  };

  const handleDismiss = () => {
    PlatformBridge.hapticFeedback('light');
    if (dontAskToday) {
      try {
        const today = new Date().toISOString().slice(0, 10);
        localStorage.setItem('rabbitty_mood_dismissed_date', today);
      } catch {}
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-200 flex items-end justify-center backdrop-blur-md"
        style={{
          background: isDark ? 'rgba(0, 0, 0, 0.78)' : 'rgba(0, 0, 0, 0.45)',
        }}
      >
        {/* Backdrop click to dismiss */}
        <div className="absolute inset-0" onClick={handleDismiss} />

        <motion.div
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 290 }}
          className="relative w-full max-w-lg rounded-t-[34px] overflow-hidden flex flex-col max-h-[92vh] shadow-2xl z-10"
          style={{
            background: isDark ? '#0D0914' : '#FFFFFF',
            borderTop: isDark ? '1px solid rgba(233, 30, 99, 0.25)' : '1px solid rgba(0, 0, 0, 0.08)',
            borderLeft: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.04)',
            borderRight: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.04)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Subtle Dynamic Ambient Aura */}
          {activeExperience && (
            <div 
              className="absolute -top-32 inset-x-0 h-72 opacity-35 blur-3xl pointer-events-none transition-all duration-700"
              style={{
                background: `radial-gradient(circle at 50% 30%, ${activeExperience.accentHex} 0%, transparent 70%)`
              }}
            />
          )}

          {/* Sticky Header */}
          <div className="relative z-10 px-6 pt-3 pb-3">
            {/* Top Indicator / Drag Handle */}
            <div 
              className="w-10 h-1 rounded-full mx-auto mb-3" 
              style={{ background: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.2)' }} 
            />

            <div 
              className="flex items-center justify-between pb-2" 
              style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.05)' }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="relative flex h-10 w-10 items-center justify-center rounded-2xl shadow-sm"
                  style={{
                    background: activeExperience 
                      ? `${activeExperience.accentHex}20` 
                      : (isDark ? 'rgba(233, 30, 99, 0.15)' : 'rgba(233, 30, 99, 0.12)'),
                    border: `1px solid ${activeExperience ? `${activeExperience.accentHex}40` : 'rgba(233, 30, 99, 0.3)'}`,
                  }}
                >
                  <Sparkles className="h-5 w-5 text-[#E91E63]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-extrabold flex items-center gap-2 tracking-tight m-0" style={{ color: 'var(--text-primary)' }}>
                    Rabbitty Mood
                    {businessName && (
                      <span 
                        className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full"
                        style={{
                          color: '#E91E63',
                          background: 'rgba(233, 30, 99, 0.12)',
                          border: '1px solid rgba(233, 30, 99, 0.25)',
                        }}
                      >
                        {businessName}
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] font-mono tracking-wide m-0" style={{ color: 'var(--text-muted)' }}>
                    Tu experiencia sensorial & ambiental
                  </p>
                </div>
              </div>

              <button
                onClick={handleDismiss}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-all cursor-pointer border-none active:scale-90"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                  color: 'var(--text-secondary)',
                }}
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Content Container */}
          <div className="relative z-10 overflow-y-auto px-6 pb-8 space-y-5 hide-scrollbar">
            {/* Body: State 1 - Choose Mood */}
            {!activeExperience ? (
              <div className="mt-2">
                <div className="mb-5 text-center">
                  <h4 className="text-xl font-black tracking-tight m-0" style={{ color: 'var(--text-primary)' }}>
                    ¿Qué vibra buscas ahora?
                  </h4>
                  <p className="text-xs mt-1.5 max-w-xs mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Personaliza la atmósfera, curaduría musical y recomendaciones para tu visita.
                  </p>
                </div>

                {/* Bunzy: expresión libre */}
                <div
                  className="mb-4 p-3 rounded-2xl border"
                  style={{
                    background: isDark ? 'rgba(233, 30, 99, 0.08)' : 'rgba(233, 30, 99, 0.05)',
                    borderColor: 'rgba(233, 30, 99, 0.25)',
                  }}
                >
                  <label htmlFor="mood-free-text" className="text-[11px] font-mono font-bold text-[#E91E63] uppercase tracking-widest block mb-2">
                    🐰 Cuéntale a Bunzy
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="mood-free-text"
                      type="text"
                      value={freeText}
                      maxLength={300}
                      onChange={(e) => setFreeText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleBunzySubmit(); }}
                      placeholder="¿Cómo te sientes hoy?"
                      disabled={interpreting || loading}
                      className="flex-1 min-w-0 rounded-xl px-3 py-2.5 text-sm outline-none border"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleBunzySubmit}
                      disabled={interpreting || loading || freeText.trim().length < 2}
                      className="flex items-center justify-center rounded-xl px-3.5 text-white font-bold text-sm border-none cursor-pointer disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #E91E63 0%, #D81B60 100%)' }}
                      aria-label="Enviar a Bunzy"
                    >
                      {interpreting ? '…' : <ArrowRight className="h-4 w-4" />}
                    </button>
                  </div>
                  {bunzyReply && (
                    <p className="text-xs mt-2 m-0 leading-relaxed font-semibold text-[#E91E63]">{bunzyReply}</p>
                  )}
                  <p className="text-[10px] font-mono mt-2 m-0" style={{ color: 'var(--text-muted)' }}>
                    Ej: &ldquo;algo tranquilo para leer&rdquo;, &ldquo;con ganas de celebrar un cierre&rdquo;
                  </p>
                </div>

                {/* Mood Selection Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(MOOD_DEFINITIONS) as MoodType[]).map((key) => {
                    const m = MOOD_DEFINITIONS[key];
                    const isSelected = selectedMood === key;
                    return (
                      <motion.button
                        key={key}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleSelectMood(key, 'grid')}
                        disabled={loading}
                        className="relative flex flex-col items-start p-3.5 rounded-2xl border text-left cursor-pointer transition-all overflow-hidden"
                        style={{
                          background: isDark
                            ? (isSelected ? 'rgba(233, 30, 99, 0.16)' : 'rgba(255, 255, 255, 0.03)')
                            : (isSelected ? 'rgba(233, 30, 99, 0.09)' : 'rgba(0, 0, 0, 0.02)'),
                          borderColor: isSelected 
                            ? '#E91E63' 
                            : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'),
                          boxShadow: isSelected ? '0 0 20px rgba(233, 30, 99, 0.25)' : 'none',
                        }}
                      >
                        <div className="flex items-center justify-between w-full mb-2">
                          <span className="text-2xl select-none filter drop-shadow-sm">
                            {m.emoji}
                          </span>
                          {isSelected && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E91E63] text-white shadow-[0_0_10px_rgba(233,30,99,0.6)]">
                              <Check className="h-3 w-3 stroke-3" />
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-black tracking-tight z-10" style={{ color: 'var(--text-primary)' }}>
                          {m.label}
                        </span>
                        <span className="text-[11px] font-mono mt-0.5 leading-snug line-clamp-1 z-10" style={{ color: 'var(--text-muted)' }}>
                          {m.tagline}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Privacy Notice & Don't ask today */}
                <div 
                  className="mt-6 pt-4 flex flex-col gap-3"
                  style={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)' }}
                >
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer text-xs select-none" style={{ color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={dontAskToday}
                        onChange={(e) => setDontAskToday(e.target.checked)}
                        className="rounded accent-[#E91E63] cursor-pointer"
                      />
                      <span>No volver a preguntar hoy</span>
                    </label>

                    <button
                      onClick={handleDismiss}
                      className="text-xs font-mono transition-colors cursor-pointer border-none bg-transparent"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Saltar por ahora
                    </button>
                  </div>

                  <div 
                    className="flex items-center gap-2 text-[10px] p-2.5 rounded-xl border font-mono"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-[#E91E63] shrink-0" />
                    <span>
                      Tus elecciones se agregan de forma anónima para calibrar la atmósfera colectiva.
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Body: State 2 - Recommended Experience (Rediseño Inmersivo) */
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-4 pt-1"
              >
                {/* 1. Fast Mood Switcher Bar */}
                <div className="flex items-center gap-1.5 p-1 rounded-2xl overflow-x-auto hide-scrollbar bg-(--bg-subtle) border border-(--border-subtle)">
                  {(Object.keys(MOOD_DEFINITIONS) as MoodType[]).map((key) => {
                    const m = MOOD_DEFINITIONS[key];
                    const isCur = activeExperience.id === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handleSelectMood(key, 'grid')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border-none cursor-pointer ${
                          isCur
                            ? 'bg-[#E91E63] text-white shadow-sm scale-102'
                            : 'bg-transparent text-(--text-muted) hover:text-(--text-primary)'
                        }`}
                      >
                        <span className="text-sm">{m.emoji}</span>
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* 2. Hero Glassmorphic Experience Card with Audio Waves */}
                <div
                  className="p-5 rounded-3xl border relative overflow-hidden text-center"
                  style={{
                    background: isDark 
                      ? `linear-gradient(180deg, ${activeExperience.accentHex}25 0%, rgba(13,9,20,0.92) 100%)` 
                      : `linear-gradient(180deg, ${activeExperience.accentHex}18 0%, #FFFFFF 100%)`,
                    borderColor: `${activeExperience.accentHex}40`,
                    boxShadow: `0 12px 36px ${activeExperience.accentHex}20`,
                  }}
                >
                  {/* Decorative glowing ambient orb */}
                  <div 
                    className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-2xl pointer-events-none opacity-40"
                    style={{ background: activeExperience.accentHex }}
                  />

                  {/* Header Tag with Dynamic Soundwaves */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span 
                      className="text-[10px] font-mono font-black uppercase tracking-widest px-2.5 py-1 rounded-full border flex items-center gap-1.5"
                      style={{
                        background: `${activeExperience.accentHex}15`,
                        borderColor: `${activeExperience.accentHex}30`,
                        color: activeExperience.accentHex,
                      }}
                    >
                      <Volume2 className="h-3 w-3 animate-pulse" />
                      ATMÓSFERA ACTIVA
                    </span>

                    {/* Animated Audio Equalizer Bars */}
                    <div className="flex items-end gap-0.8 h-4">
                      {[0.4, 0.9, 0.6, 1, 0.7, 0.5, 0.85].map((scale, i) => (
                        <motion.div
                          key={i}
                          animate={{ height: ['20%', `${scale * 100}%`, '20%'] }}
                          transition={{
                            duration: 0.8 + (i % 3) * 0.2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: i * 0.1,
                          }}
                          className="w-1 rounded-full"
                          style={{ background: activeExperience.accentHex }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="text-5xl my-2 select-none filter drop-shadow-md">
                    {activeExperience.emoji}
                  </div>
                  <h4 className="text-2xl font-black tracking-tight m-0" style={{ color: 'var(--text-primary)' }}>
                    Modo {activeExperience.label}
                  </h4>
                  <p className="text-xs mt-2 max-w-sm mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {activeExperience.description}
                  </p>
                  {bunzyReply && (
                    <div 
                      className="mt-3 py-1.5 px-3 rounded-xl max-w-sm mx-auto text-xs font-bold flex items-center justify-center gap-1.5 border"
                      style={{
                        background: 'rgba(233, 30, 99, 0.1)',
                        borderColor: 'rgba(233, 30, 99, 0.25)',
                        color: '#E91E63',
                      }}
                    >
                      <span>🐰 {bunzyReply}</span>
                    </div>
                  )}
                </div>

                {/* 3. Interactive Soundtrack Hub (Spotify / Apple Music / YouTube) */}
                <div 
                  className="p-4 rounded-3xl border space-y-3.5"
                  style={{
                    background: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] font-mono font-bold text-[#E91E63] uppercase tracking-widest">
                      <Headphones className="h-4 w-4" />
                      <span>Banda Sonora Recomendada</span>
                    </div>

                    {/* Platform Selector Buttons */}
                    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-(--bg-subtle) border border-(--border-subtle)">
                      <button
                        onClick={() => setActiveMusicTab('spotify')}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer border-none transition-all ${
                          activeMusicTab === 'spotify' ? 'bg-[#1DB954] text-black shadow-xs' : 'bg-transparent text-(--text-muted)'
                        }`}
                      >
                        Spotify
                      </button>
                      <button
                        onClick={() => setActiveMusicTab('apple')}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer border-none transition-all ${
                          activeMusicTab === 'apple' ? 'bg-[#FC3C44] text-white shadow-xs' : 'bg-transparent text-(--text-muted)'
                        }`}
                      >
                        Apple
                      </button>
                      <button
                        onClick={() => setActiveMusicTab('youtube')}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer border-none transition-all ${
                          activeMusicTab === 'youtube' ? 'bg-[#FF0000] text-white shadow-xs' : 'bg-transparent text-(--text-muted)'
                        }`}
                      >
                        YouTube
                      </button>
                    </div>
                  </div>

                  {/* Album Cover & Track Preview */}
                  <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-(--bg-subtle) border border-(--border-subtle)">
                    <div 
                      className="w-13 h-13 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md relative overflow-hidden"
                      style={{
                        background: activeMusicTab === 'spotify' 
                          ? 'linear-gradient(135deg, #1DB954 0%, #15883e 100%)' 
                          : activeMusicTab === 'apple' 
                          ? 'linear-gradient(135deg, #FC3C44 0%, #D6222A 100%)' 
                          : 'linear-gradient(135deg, #FF0000 0%, #B30000 100%)'
                      }}
                    >
                      <Disc3 className="h-7 w-7 animate-spin [animation-duration:6s] opacity-90" />
                      <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                        <Play className="h-4 w-4 fill-white text-white ml-0.5" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h5 className="text-[14px] font-bold m-0 truncate" style={{ color: 'var(--text-primary)' }}>
                        {activeExperience.music.title}
                      </h5>
                      <p className="text-[12px] font-mono m-0 mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                        {activeExperience.music.artistOrCurator}
                      </p>
                    </div>

                    <a
                      href={
                        activeMusicTab === 'spotify' 
                          ? activeExperience.music.spotifyUrl 
                          : activeMusicTab === 'apple' 
                          ? activeExperience.music.appleMusicUrl 
                          : activeExperience.music.youtubeUrl
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 no-underline active:scale-95 transition-transform"
                      style={{
                        background: activeMusicTab === 'spotify' 
                          ? '#1DB954' 
                          : activeMusicTab === 'apple' 
                          ? '#FC3C44' 
                          : '#FF0000',
                        color: activeMusicTab === 'spotify' ? '#000000' : '#FFFFFF',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      }}
                    >
                      <span>Reproducir</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                {/* 4. Menu & Sensory Pairing Card */}
                <div 
                  className="p-4 rounded-3xl border flex items-start gap-3.5"
                  style={{
                    background: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <span 
                    className="flex h-11 w-11 items-center justify-center rounded-2xl text-[#E91E63] shrink-0 border shadow-xs"
                    style={{
                      background: 'rgba(233, 30, 99, 0.12)',
                      borderColor: 'rgba(233, 30, 99, 0.25)',
                    }}
                  >
                    <Coffee className="h-5 w-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold text-[#E91E63] uppercase tracking-widest block">
                        Pairing Sugerido
                      </span>
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-500">
                        F&B
                      </span>
                    </div>
                    <h5 className="text-[15px] font-bold mt-0.5 m-0" style={{ color: 'var(--text-primary)' }}>
                      {activeExperience.pairingSuggestion.itemType}
                    </h5>
                    <p className="text-xs mt-1 leading-relaxed m-0" style={{ color: 'var(--text-secondary)' }}>
                      {activeExperience.pairingSuggestion.description}
                    </p>
                  </div>
                </div>

                {/* 5. Campaña activa del comercio actual */}
                {businessId && campaign && (
                  <div
                    className="p-4 rounded-3xl border flex items-start gap-3.5"
                    style={{ background: 'rgba(233, 30, 99, 0.10)', borderColor: 'rgba(233, 30, 99, 0.35)' }}
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-[#E91E63] shrink-0 border" style={{ background: 'rgba(233, 30, 99, 0.12)', borderColor: 'rgba(233, 30, 99, 0.25)' }}>
                      <Gift className="h-5 w-5" />
                    </span>
                    <div>
                      <span className="text-[10px] font-mono font-bold text-[#E91E63] uppercase tracking-widest block">
                        Campaña de {businessName}
                      </span>
                      <h5 className="text-[15px] font-bold mt-0.5 m-0" style={{ color: 'var(--text-primary)' }}>{campaign.title}</h5>
                      {campaign.description && (
                        <p className="text-xs mt-0.5 leading-relaxed m-0" style={{ color: 'var(--text-secondary)' }}>{campaign.description}</p>
                      )}
                      {campaign.rewardBunz > 0 && (
                        <p className="text-[12px] font-black mt-1.5 m-0 text-[#E91E63] flex items-center gap-1">
                          <Flame className="h-3.5 w-3.5 fill-[#E91E63]" />
                          +{campaign.rewardBunz} BUNZ de recompensa inmediata
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* 6. Heatmap de Spots Cercanos con Cashback & Mood Match */}
                {!businessId && (
                  <div className="p-4 rounded-3xl border space-y-3" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[11px] font-mono font-bold text-[#E91E63] uppercase tracking-widest">
                        <MapPin className="h-4 w-4" />
                        <span>Lugares ideales para este mood</span>
                      </div>
                      <span className="text-[10px] font-mono text-(--text-muted)">
                        {venues.length} disponibles
                      </span>
                    </div>

                    {venuesLoading ? (
                      <div className="py-6 flex items-center justify-center gap-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        <RefreshCw className="h-4 w-4 animate-spin text-[#E91E63]" />
                        <span>Analizando lugares con vibra {activeExperience.label}...</span>
                      </div>
                    ) : venues.length === 0 ? (
                      <p className="text-xs m-0 py-3 text-center" style={{ color: 'var(--text-muted)' }}>
                        Aún no hay comercios afiliados para este mood. Explora el mapa para ver los más cercanos.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {venues.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => {
                              PlatformBridge.hapticFeedback('light');
                              onClose();
                              router.push(`/affiliate/${v.id}`);
                            }}
                            className="w-full flex items-center gap-3 p-3 rounded-2xl border text-left cursor-pointer hover:border-[#E91E63]/40 transition-all active:scale-98"
                            style={{ 
                              background: 'var(--bg-subtle)', 
                              borderColor: 'var(--border-subtle)', 
                              color: 'var(--text-primary)' 
                            }}
                          >
                            {v.logoUrl ? (
                              <img src={v.logoUrl} alt={v.name} className="h-10 w-10 rounded-xl object-cover shrink-0 border border-(--border-subtle)" />
                            ) : (
                              <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0 bg-[#E91E63]/15 text-[#E91E63] border border-[#E91E63]/25 font-bold">
                                {v.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="block text-[14px] font-bold truncate">{v.name}</span>
                                {v.rewardPercentage && (
                                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-[#E91E63]/15 text-[#E91E63] shrink-0">
                                    {v.rewardPercentage}% Bunz
                                  </span>
                                )}
                              </div>
                              <span className="block text-[11px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {v.campaign ? `${v.campaign.title}${v.campaign.activeNow ? ' · ¡Activo ahora!' : ''}` : v.category}
                              </span>
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-(--text-muted)" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 7. Action CTA Button */}
                <button
                  onClick={() => {
                    if (businessId) {
                      handleDismiss();
                      return;
                    }
                    PlatformBridge.hapticFeedback('medium');
                    onClose();
                    if (onExploreMap) onExploreMap();
                    else router.push('/?tab=Freehands');
                  }}
                  className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-2xl text-white font-black text-sm shadow-xl shadow-pink-500/25 active:scale-98 transition-all cursor-pointer border-none"
                  style={{
                    background: 'linear-gradient(135deg, #E91E63 0%, #D81B60 100%)',
                  }}
                >
                  <span>{businessId ? 'Confirmar & Disfrutar' : `Explorar spots en Modo ${activeExperience.label}`}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
