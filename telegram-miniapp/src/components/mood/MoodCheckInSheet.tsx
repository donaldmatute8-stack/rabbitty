'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ExternalLink, Headphones, Coffee, Check, ArrowRight, ShieldCheck, MapPin, Gift } from 'lucide-react';
import { MOOD_DEFINITIONS, MoodType, MoodDefinition } from '@/types/mood';
import { PlatformBridge } from '@/lib/platform';
import { useTheme } from '@/contexts/ThemeContext';

interface MoodVenue {
  id: string;
  name: string;
  category: string;
  logoUrl: string | null;
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
          background: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.45)',
        }}
      >
        {/* Backdrop click to dismiss */}
        <div className="absolute inset-0" onClick={handleDismiss} />

        <motion.div
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 290 }}
          className="relative w-full max-w-lg rounded-t-[36px] px-6 pt-5 pb-8 shadow-[0_-10px_40px_rgba(233,30,99,0.15)] z-10 max-h-[88vh] overflow-y-auto"
          style={{
            background: isDark 
              ? 'linear-gradient(180deg, #14121A 0%, #0D0C12 50%, #050508 100%)' 
              : 'linear-gradient(180deg, #FFFFFF 0%, #FFF5F8 60%, #FFFFFF 100%)',
            borderTop: isDark ? '1px solid rgba(233, 30, 99, 0.25)' : '1px solid rgba(233, 30, 99, 0.2)',
            color: 'var(--text-primary)',
          }}
        >
          {/* Subtle Top Indicator / Drag Handle */}
          <div 
            className="w-12 h-1 rounded-full mx-auto mb-4" 
            style={{ background: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)' }} 
          />

          {/* Header */}
          <div 
            className="flex items-center justify-between pb-4" 
            style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)' }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="relative flex h-10 w-10 items-center justify-center rounded-2xl"
                style={{
                  background: isDark ? 'rgba(233, 30, 99, 0.15)' : 'rgba(233, 30, 99, 0.12)',
                  border: '1px solid rgba(233, 30, 99, 0.3)',
                }}
              >
                <Sparkles className="h-5 w-5 animate-pulse text-[#E91E63]" />
              </div>
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2 tracking-tight m-0" style={{ color: 'var(--text-primary)' }}>
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
              className="flex h-8 w-8 items-center justify-center rounded-full transition-colors cursor-pointer border-none"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                color: 'var(--text-secondary)',
              }}
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body: State 1 - Choose Mood */}
          {!activeExperience ? (
            <div className="mt-5">
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
                  <p className="text-xs mt-2 m-0 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{bunzyReply}</p>
                )}
                <p className="text-[10px] font-mono mt-2 m-0" style={{ color: 'var(--text-muted)' }}>
                  Tu texto no se guarda; solo se usa para elegir tu mood.
                </p>
              </div>

              <p className="text-[11px] font-mono text-center mb-3 m-0" style={{ color: 'var(--text-muted)' }}>
                — o elige directamente —
              </p>

              {/* 6 Grid Cards */}
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(MOOD_DEFINITIONS) as MoodType[]).map((key) => {
                  const m = MOOD_DEFINITIONS[key];
                  const isSelected = selectedMood === key;

                  return (
                    <motion.button
                      key={key}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleSelectMood(key)}
                      disabled={loading}
                      className="relative flex flex-col items-start p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer overflow-hidden"
                      style={{
                        background: isSelected 
                          ? (isDark ? 'rgba(233, 30, 99, 0.18)' : 'rgba(233, 30, 99, 0.10)')
                          : (isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF'),
                        borderColor: isSelected 
                          ? '#E91E63' 
                          : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'),
                        boxShadow: isSelected 
                          ? '0 0 20px rgba(233, 30, 99, 0.25)' 
                          : (isDark ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.03)'),
                      }}
                    >
                      {/* Ambient card accent gradient on hover */}
                      <div className="absolute top-0 right-0 w-24 h-24 bg-[#E91E63]/5 rounded-full blur-xl pointer-events-none" />

                      <div className="flex items-center justify-between w-full mb-2 z-10">
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
            /* Body: State 2 - Recommended Experience */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-5 space-y-4"
            >
              <div
                className="p-5 rounded-2xl border text-center relative overflow-hidden"
                style={{
                  background: isDark 
                    ? 'linear-gradient(180deg, rgba(233,30,99,0.18) 0%, rgba(10,10,15,0.85) 100%)' 
                    : 'linear-gradient(180deg, rgba(233,30,99,0.12) 0%, #FFFFFF 100%)',
                  borderColor: isDark ? 'rgba(233, 30, 99, 0.35)' : 'rgba(233, 30, 99, 0.25)',
                  boxShadow: '0 8px 30px rgba(233, 30, 99, 0.12)',
                }}
              >
                <div className="text-4xl mb-2 select-none filter drop-shadow-sm">
                  {activeExperience.emoji}
                </div>
                <h4 className="text-xl font-black tracking-tight m-0" style={{ color: 'var(--text-primary)' }}>
                  Modo {activeExperience.label}
                </h4>
                <p className="text-xs mt-1.5 max-w-sm mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {activeExperience.description}
                </p>
                {bunzyReply && (
                  <p className="text-xs mt-2 max-w-sm mx-auto leading-relaxed font-bold m-0" style={{ color: '#E91E63' }}>🐰 {bunzyReply}</p>
                )}
              </div>

              {/* Music Recommendation Card */}
              <div 
                className="p-4 rounded-2xl border space-y-3"
                style={{
                  background: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="flex items-center gap-2 text-[11px] font-mono font-bold text-[#E91E63] uppercase tracking-widest">
                  <Headphones className="h-4 w-4" />
                  <span>Banda Sonora Recomendada</span>
                </div>
                <div>
                  <h5 className="text-sm font-bold m-0" style={{ color: 'var(--text-primary)' }}>{activeExperience.music.title}</h5>
                  <p className="text-xs font-mono m-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>{activeExperience.music.artistOrCurator}</p>
                </div>

                {/* External Links */}
                <div className="flex gap-2 pt-1">
                  <a
                    href={activeExperience.music.spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all no-underline"
                    style={{
                      background: 'rgba(29, 185, 84, 0.12)',
                      color: '#1DB954',
                      borderColor: 'rgba(29, 185, 84, 0.25)',
                    }}
                  >
                    <span>Escuchar en Spotify</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {/* Apple Music / YouTube ocultos por ahora (pendiente: preferencia de usuario en config) */}
                </div>
              </div>

              {/* Menu Pairing Card */}
              <div 
                className="p-4 rounded-2xl border flex items-start gap-3"
                style={{
                  background: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <span 
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-[#E91E63] shrink-0 border"
                  style={{
                    background: 'rgba(233, 30, 99, 0.12)',
                    borderColor: 'rgba(233, 30, 99, 0.25)',
                  }}
                >
                  <Coffee className="h-5 w-5" />
                </span>
                <div>
                  <span className="text-[10px] font-mono font-bold text-[#E91E63] uppercase tracking-widest block">
                    Pairing Sugerido
                  </span>
                  <h5 className="text-sm font-bold mt-0.5 m-0" style={{ color: 'var(--text-primary)' }}>
                    {activeExperience.pairingSuggestion.itemType}
                  </h5>
                  <p className="text-xs mt-0.5 leading-relaxed m-0" style={{ color: 'var(--text-secondary)' }}>
                    {activeExperience.pairingSuggestion.description}
                  </p>
                </div>
              </div>

              {/* Campaña activa del comercio actual */}
              {businessId && campaign && (
                <div
                  className="p-4 rounded-2xl border flex items-start gap-3"
                  style={{ background: 'rgba(233, 30, 99, 0.10)', borderColor: 'rgba(233, 30, 99, 0.35)' }}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl text-[#E91E63] shrink-0 border" style={{ background: 'rgba(233, 30, 99, 0.12)', borderColor: 'rgba(233, 30, 99, 0.25)' }}>
                    <Gift className="h-5 w-5" />
                  </span>
                  <div>
                    <span className="text-[10px] font-mono font-bold text-[#E91E63] uppercase tracking-widest block">
                      Campaña de {businessName}
                    </span>
                    <h5 className="text-sm font-bold mt-0.5 m-0" style={{ color: 'var(--text-primary)' }}>{campaign.title}</h5>
                    {campaign.description && (
                      <p className="text-xs mt-0.5 leading-relaxed m-0" style={{ color: 'var(--text-secondary)' }}>{campaign.description}</p>
                    )}
                    {campaign.rewardBunz > 0 && (
                      <p className="text-[11px] font-bold mt-1 m-0 text-[#E91E63]">+{campaign.rewardBunz} BUNZ por esta visita</p>
                    )}
                  </div>
                </div>
              )}

              {/* Lugares recomendados para este mood (cuando no estás en un comercio) */}
              {!businessId && (
                <div className="p-4 rounded-2xl border space-y-3" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center gap-2 text-[11px] font-mono font-bold text-[#E91E63] uppercase tracking-widest">
                    <MapPin className="h-4 w-4" />
                    <span>Lugares para este mood</span>
                  </div>
                  {venuesLoading ? (
                    <p className="text-xs m-0" style={{ color: 'var(--text-muted)' }}>Buscando lugares…</p>
                  ) : venues.length === 0 ? (
                    <p className="text-xs m-0" style={{ color: 'var(--text-muted)' }}>
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
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl border text-left cursor-pointer"
                          style={{ background: 'transparent', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                        >
                          {v.logoUrl ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={v.logoUrl} alt={v.name} className="h-9 w-9 rounded-lg object-cover shrink-0" />
                            </>
                          ) : (
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0 bg-[#E91E63]/15 text-[#E91E63]"><Coffee className="h-4 w-4" /></span>
                          )}
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-bold truncate">{v.name}</span>
                            <span className="block text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                              {v.campaign ? `${v.campaign.title}${v.campaign.activeNow ? ' · ahora' : ''}` : v.category}
                            </span>
                          </span>
                          <ArrowRight className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Final Confirm Button */}
              <button
                onClick={() => {
                  if (businessId) {
                    handleDismiss();
                    return;
                  }
                  PlatformBridge.hapticFeedback('light');
                  onClose();
                  if (onExploreMap) onExploreMap();
                  else router.push('/?tab=Freehands');
                }}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl text-white font-black text-sm shadow-xl shadow-pink-500/25 transition-all cursor-pointer border-none"
                style={{
                  background: 'linear-gradient(135deg, #E91E63 0%, #D81B60 100%)',
                }}
              >
                <span>{businessId ? 'Disfrutar mi estancia' : 'Ver en el mapa'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
