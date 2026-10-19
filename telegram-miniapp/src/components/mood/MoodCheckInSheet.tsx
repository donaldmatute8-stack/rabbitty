'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ExternalLink, Headphones, Coffee, Check, ArrowRight, ShieldCheck } from 'lucide-react';
import { MOOD_DEFINITIONS, MoodType, MoodDefinition } from '@/types/mood';
import { PlatformBridge } from '@/lib/platform';

interface MoodCheckInProps {
  isOpen: boolean;
  onClose: () => void;
  businessId?: string;
  businessName?: string;
  onMoodSelected?: (mood: MoodDefinition) => void;
}

export function MoodCheckInSheet({
  isOpen,
  onClose,
  businessId,
  businessName,
  onMoodSelected,
}: MoodCheckInProps) {
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [activeExperience, setActiveExperience] = useState<MoodDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [dontAskToday, setDontAskToday] = useState(false);

  const handleSelectMood = async (moodKey: MoodType) => {
    setSelectedMood(moodKey);
    const def = MOOD_DEFINITIONS[moodKey];
    PlatformBridge.hapticFeedback('medium');

    try {
      setLoading(true);
      const headers = await PlatformBridge.getAuthHeaders();
      await fetch('/api/mood/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          mood: moodKey,
          businessId: businessId || null,
          source: businessId ? 'venue' : 'checkin',
        }),
      });

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
      <div className="fixed inset-0 z-200 flex items-end justify-center bg-black/80 backdrop-blur-md">
        {/* Backdrop click to dismiss */}
        <div className="absolute inset-0" onClick={handleDismiss} />

        <motion.div
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 290 }}
          className="relative w-full max-w-lg rounded-t-[36px] border-t border-pink-500/20 bg-linear-to-b from-[#121118] via-[#0D0C12] to-black px-6 pt-5 pb-8 shadow-[0_-10px_40px_rgba(233,30,99,0.15)] z-10 max-h-[88vh] overflow-y-auto"
        >
          {/* Subtle Top Indicator / Drag Handle */}
          <div className="w-12 h-1 bg-white/15 rounded-full mx-auto mb-4" />

          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/8">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-tr from-pink-500/20 to-rose-500/20 border border-pink-500/30 text-pink-400">
                <Sparkles className="h-5 w-5 animate-pulse text-pink-400" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2 tracking-tight">
                  Rabbitty Mood
                  {businessName && (
                    <span className="text-[11px] font-mono font-bold text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2.5 py-0.5 rounded-full">
                      {businessName}
                    </span>
                  )}
                </h3>
                <p className="text-[11px] font-mono text-zinc-400 tracking-wide">
                  Tu experiencia sensorial & ambiental
                </p>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body: State 1 - Choose Mood */}
          {!activeExperience ? (
            <div className="mt-5">
              <div className="mb-5 text-center">
                <h4 className="text-xl font-black text-white tracking-tight">
                  ¿Qué vibra buscas ahora?
                </h4>
                <p className="text-xs text-zinc-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
                  Personaliza la atmósfera, curaduría musical y recomendaciones para tu visita.
                </p>
              </div>

              {/* 6 Grid Cards - Modern Rabbitty Cyber/Minimalist Cards */}
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
                      className={`relative flex flex-col items-start p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer overflow-hidden ${
                        isSelected
                          ? 'border-pink-500 bg-pink-500/15 shadow-[0_0_20px_rgba(233,30,99,0.3)] ring-1 ring-pink-500/40'
                          : 'border-zinc-800/80 bg-zinc-900/60 hover:border-pink-500/40 hover:bg-zinc-900/90'
                      }`}
                    >
                      {/* Ambient card accent gradient on hover */}
                      <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-xl pointer-events-none" />

                      <div className="flex items-center justify-between w-full mb-2 z-10">
                        <span className="text-2xl select-none filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                          {m.emoji}
                        </span>
                        {isSelected && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white shadow-[0_0_10px_rgba(233,30,99,0.8)]">
                            <Check className="h-3 w-3 stroke-3" />
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-black text-white tracking-tight z-10">{m.label}</span>
                      <span className="text-[11px] font-mono text-zinc-400 mt-0.5 leading-snug line-clamp-1 z-10">
                        {m.tagline}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Privacy Notice & Don't ask today */}
              <div className="mt-6 pt-4 border-t border-white/5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-400 select-none hover:text-zinc-200 transition-colors">
                    <input
                      type="checkbox"
                      checked={dontAskToday}
                      onChange={(e) => setDontAskToday(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 text-pink-500 focus:ring-pink-500/30 cursor-pointer"
                    />
                    <span>No volver a preguntar hoy</span>
                  </label>

                  <button
                    onClick={handleDismiss}
                    className="text-xs font-mono text-zinc-400 hover:text-pink-400 transition-colors cursor-pointer"
                  >
                    Saltar por ahora
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-zinc-400 bg-zinc-900/50 p-2.5 rounded-xl border border-white/5 font-mono">
                  <ShieldCheck className="h-3.5 w-3.5 text-pink-400 shrink-0" />
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
                className="p-5 rounded-2xl border border-pink-500/30 text-center relative overflow-hidden bg-linear-to-b from-pink-500/15 to-zinc-950/80 shadow-[0_0_25px_rgba(233,30,99,0.15)]"
              >
                <div className="text-4xl mb-2 select-none filter drop-shadow-[0_0_15px_rgba(233,30,99,0.6)]">
                  {activeExperience.emoji}
                </div>
                <h4 className="text-xl font-black text-white tracking-tight">
                  Modo {activeExperience.label}
                </h4>
                <p className="text-xs text-zinc-300 mt-1 max-w-sm mx-auto leading-relaxed">
                  {activeExperience.description}
                </p>
              </div>

              {/* Music Recommendation Card */}
              <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 space-y-3">
                <div className="flex items-center gap-2 text-[11px] font-mono font-bold text-pink-400 uppercase tracking-widest">
                  <Headphones className="h-4 w-4" />
                  <span>Banda Sonora Recomendada</span>
                </div>
                <div>
                  <h5 className="text-sm font-bold text-white">{activeExperience.music.title}</h5>
                  <p className="text-xs font-mono text-zinc-400">{activeExperience.music.artistOrCurator}</p>
                </div>

                {/* External Links */}
                <div className="flex gap-2 pt-1">
                  <a
                    href={activeExperience.music.spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#1DB954]/15 hover:bg-[#1DB954]/25 text-[#1DB954] text-xs font-bold border border-[#1DB954]/30 transition-all"
                  >
                    <span>Spotify</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href={activeExperience.music.appleMusicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 text-pink-400 text-xs font-bold border border-pink-500/30 transition-all"
                  >
                    <span>Apple Music</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href={activeExperience.music.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-bold border border-red-500/30 transition-all"
                  >
                    <span>YouTube</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {/* Menu Pairing Card */}
              <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 flex items-start gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500/15 text-pink-400 shrink-0 border border-pink-500/20">
                  <Coffee className="h-5 w-5" />
                </span>
                <div>
                  <span className="text-[10px] font-mono font-bold text-pink-400 uppercase tracking-widest block">
                    Pairing Sugerido
                  </span>
                  <h5 className="text-sm font-bold text-white mt-0.5">
                    {activeExperience.pairingSuggestion.itemType}
                  </h5>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    {activeExperience.pairingSuggestion.description}
                  </p>
                </div>
              </div>

              {/* Final Confirm Button */}
              <button
                onClick={handleDismiss}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-linear-to-r from-pink-500 via-rose-500 to-pink-600 text-white font-black text-sm shadow-xl shadow-pink-500/25 hover:from-pink-600 hover:to-rose-700 transition-all cursor-pointer"
              >
                <span>Disfrutar mi estancia</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
