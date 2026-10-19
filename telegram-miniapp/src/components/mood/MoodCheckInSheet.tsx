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
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
        {/* Backdrop click to dismiss */}
        <div className="absolute inset-0" onClick={handleDismiss} />

        <motion.div
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 280 }}
          className="relative w-full max-w-lg rounded-t-4xl border-t border-white/10 bg-[#0f1117] p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-tr from-amber-500/20 to-orange-500/20 text-amber-400">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                  Rabbitty Mood
                  {businessName && (
                    <span className="text-xs font-medium text-amber-400/90 bg-amber-400/10 px-2 py-0.5 rounded-full">
                      en {businessName}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-white/50">Tu experiencia sensorial y ambiental</p>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body: State 1 - Choose Mood */}
          {!activeExperience ? (
            <div className="mt-5">
              <div className="mb-4 text-center">
                <h4 className="text-lg font-bold text-white tracking-tight">
                  ¿Qué necesitas en este momento?
                </h4>
                <p className="text-xs text-white/60 mt-1 max-w-xs mx-auto">
                  Elige una preferencia para personalizar tu música y acompañar tu estancia.
                </p>
              </div>

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
                      className={`relative flex flex-col items-start p-4 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? 'border-amber-400 bg-amber-400/10 shadow-lg shadow-amber-500/10'
                          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
                      }`}
                      style={{
                        background: isSelected ? undefined : m.gradient,
                      }}
                    >
                      <div className="flex items-center justify-between w-full mb-2">
                        <span className="text-3xl select-none">{m.emoji}</span>
                        {isSelected && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-black">
                            <Check className="h-3 w-3 stroke-3" />
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-bold text-white tracking-tight">{m.label}</span>
                      <span className="text-[11px] text-white/60 mt-0.5 leading-snug line-clamp-1">
                        {m.tagline}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Privacy Notice & Don't ask today */}
              <div className="mt-6 pt-4 border-t border-white/5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-white/60 select-none">
                    <input
                      type="checkbox"
                      checked={dontAskToday}
                      onChange={(e) => setDontAskToday(e.target.checked)}
                      className="rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500/30"
                    />
                    <span>No volver a preguntar hoy</span>
                  </label>

                  <button
                    onClick={handleDismiss}
                    className="text-xs text-white/40 hover:text-white/80 transition-colors"
                  >
                    Saltar por ahora
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-white/40 bg-white/2 p-2 rounded-xl border border-white/5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400/80 shrink-0" />
                  <span>
                    Tus elecciones son voluntarias y se agregan de forma anónima para proteger tu privacidad.
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
                className="p-5 rounded-2xl border border-white/10 text-center relative overflow-hidden"
                style={{ background: activeExperience.gradient }}
              >
                <div className="text-4xl mb-2">{activeExperience.emoji}</div>
                <h4 className="text-xl font-extrabold text-white">
                  Modo {activeExperience.label}
                </h4>
                <p className="text-xs text-white/70 mt-1 max-w-sm mx-auto leading-relaxed">
                  {activeExperience.description}
                </p>
              </div>

              {/* Music Recommendation Card */}
              <div className="p-4 rounded-2xl border border-white/10 bg-white/5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <Headphones className="h-4 w-4" />
                  <span>BANDA SONORA RECOMENDADA</span>
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-white">{activeExperience.music.title}</h5>
                  <p className="text-xs text-white/50">{activeExperience.music.artistOrCurator}</p>
                </div>

                {/* External Links: Universal & Spotify Safe */}
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
              <div className="p-4 rounded-2xl border border-white/10 bg-white/5 flex items-start gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400 shrink-0">
                  <Coffee className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Pairing Sugerido
                    </span>
                  </div>
                  <h5 className="text-sm font-semibold text-white mt-0.5">
                    {activeExperience.pairingSuggestion.itemType}
                  </h5>
                  <p className="text-xs text-white/60 mt-0.5 leading-relaxed">
                    {activeExperience.pairingSuggestion.description}
                  </p>
                </div>
              </div>

              {/* Final Confirm Button */}
              <button
                onClick={handleDismiss}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-linear-to-r from-amber-500 to-orange-500 text-black font-extrabold text-sm shadow-lg shadow-amber-500/20 hover:opacity-95 transition-opacity"
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
