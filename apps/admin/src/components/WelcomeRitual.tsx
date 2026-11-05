'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

export interface WelcomeRitualPhrase {
  id: number;
  start: number;
  end: number;
  subtitle: string;
  words: string[];
}

interface WelcomeRitualProps {
  onComplete?: () => void;
  storageKey?: string;
  forceOpen?: boolean;
  /** Frases a mostrar. Por defecto usa el guion de afiliados. */
  phrases?: WelcomeRitualPhrase[];
  audioSrc?: string;
  logoSrc?: string;
  signalLabel?: string;
  skipLabel?: string;
}

/** Cuándo el logo toma el escenario y las frases se desvanecen. */
const OUTRO_AT = 18.2;
/** Duración real del track de afiliados (~19.99 s). */
const TOTAL_SECONDS = 19.9;

/**
 * Guion de afiliados (activo).
 *
 * Track: /assets/afiliados-bienvenida.mp3 (~20 s)
 * Voz:
 *  4–6 s   «Tu negocio tiene un nuevo lugar.»
 *  8–11 s  «Cada visita deja ganas de volver.»
 *  13–14 s «Tú haces la magia.»
 *  16–17 s «Nosotros la cuenta.»
 */
const DEFAULT_PHRASES: WelcomeRitualPhrase[] = [
  {
    id: 1,
    start: 3.4,
    end: 7.4,
    subtitle: 'Tu negocio entra a la red',
    words: ['«Tu', 'negocio', 'tiene', 'un', 'nuevo', 'lugar.»'],
  },
  {
    id: 2,
    start: 7.4,
    end: 12.3,
    subtitle: 'Cada visita se convierte en regreso',
    words: ['«Cada', 'visita', 'deja', 'ganas', 'de', 'volver.»'],
  },
  {
    id: 3,
    start: 12.3,
    end: 15.3,
    subtitle: 'Tú operas',
    words: ['«Tú', 'haces', 'la', 'magia.»'],
  },
  {
    id: 4,
    start: 15.3,
    end: OUTRO_AT,
    subtitle: 'Nosotros medimos',
    words: ['«Nosotros', 'la', 'cuenta.»'],
  },
];

/** Alias histórico: el guion de afiliados ya es el mensaje activo. */
export const AFFILIATE_RITUAL_PHRASES = DEFAULT_PHRASES;

export function WelcomeRitual({
  onComplete,
  storageKey = 'rabbitty_affiliate_welcome_ritual_seen_v1',
  forceOpen = false,
  phrases = DEFAULT_PHRASES,
  audioSrc = '/assets/afiliados-bienvenida.mp3',
  logoSrc = '/Ra.png',
  signalLabel = 'The Rabbitty Signal',
  skipLabel = 'Omitir',
}: WelcomeRitualProps) {
  const [isOpen, setIsOpen] = useState(() => {
    if (forceOpen) return true;
    if (typeof window === 'undefined') return false;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('ritual') === '1' || params.get('welcome') === '1') {
        return true;
      }
      return !localStorage.getItem(storageKey);
    } catch {
      return false;
    }
  });

  const [currentTime, setCurrentTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFinalClosing, setIsFinalClosing] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasFinishedRef = useRef(false);

  const handleFinish = useCallback(() => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;

    // Iniciar fade out conjunto hacia la página
    setIsFinalClosing(true);

    if (audioRef.current) {
      const aud = audioRef.current;
      const fadeInterval = setInterval(() => {
        if (aud.volume > 0.1) {
          aud.volume = Math.max(0, aud.volume - 0.2);
        } else {
          clearInterval(fadeInterval);
          aud.pause();
        }
      }, 50);
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, 'true');
        window.dispatchEvent(new CustomEvent('rabbitty:welcome-ritual-completed'));
      } catch {}
    }

    setTimeout(() => {
      setIsOpen(false);
      onComplete?.();
    }, 900);
  }, [storageKey, onComplete]);

  // Escape cierra el ritual: nadie queda atrapado si su sesión caducó o ya
  // tiene cuenta y solo quiere entrar a su panel.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleFinish();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleFinish]);

  // Red de seguridad: nunca dejar el overlay abierto más de lo que dura el track.
  useEffect(() => {
    if (!isOpen) return;
    const safetyTimer = setTimeout(() => {
      if (!hasFinishedRef.current) {
        handleFinish();
      }
    }, (TOTAL_SECONDS + 2.5) * 1000);
    return () => clearTimeout(safetyTimer);
  }, [isOpen, handleFinish]);

  // Manejo de reproducción de audio y sincronización continua
  useEffect(() => {
    if (!isOpen) return;

    const audio = new Audio(audioSrc);
    audioRef.current = audio;
    audio.preload = 'auto';

    const handleTimeUpdate = () => {
      if (audio.duration) {
        const t = audio.currentTime;
        setCurrentTime(t);
        const pct = (t / audio.duration) * 100;
        setProgress(pct);
        if (t >= TOTAL_SECONDS - 0.6 && !hasFinishedRef.current) {
          handleFinish();
        }
      }
    };

    const handleEnded = () => {
      setProgress(100);
      handleFinish();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    // Intentar reproducción automática sin mutear
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        audio.muted = true;
        setIsMuted(true);
        audio.play().catch(() => {});
      });
    }

    // Fallback: si el navegador bloquea el audio o no dispara timeupdate,
    // un reloj interno avanza los subtítulos y cierra al final del track.
    const fallbackTicker = setInterval(() => {
      const aud = audioRef.current;
      if (!aud || aud.paused || aud.ended) {
        setCurrentTime((prev: number) => {
          if (prev >= TOTAL_SECONDS) {
            clearInterval(fallbackTicker);
            handleFinish();
            return TOTAL_SECONDS;
          }
          const next = prev + 0.25;
          setProgress(Math.min(100, (next / TOTAL_SECONDS) * 100));
          if (next >= TOTAL_SECONDS) {
            clearInterval(fallbackTicker);
            handleFinish();
          }
          return next;
        });
      }
    }, 250);

    const unlockOnFirstTouch = () => {
      if (audioRef.current && audioRef.current.muted) {
        audioRef.current.muted = false;
        audioRef.current.play().catch(() => {});
        setIsMuted(false);
      }
      window.removeEventListener('pointerdown', unlockOnFirstTouch);
    };
    window.addEventListener('pointerdown', unlockOnFirstTouch);

    return () => {
      clearInterval(fallbackTicker);
      window.removeEventListener('pointerdown', unlockOnFirstTouch);
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [isOpen, audioSrc, handleFinish]);

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.muted = false;
      audioRef.current.play().catch(() => {});
      setIsMuted(false);
    } else {
      audioRef.current.muted = true;
      setIsMuted(true);
    }
  };

  if (!isOpen) return null;

  const introAt = phrases[0]?.start ?? 3.4;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ritual de bienvenida Rabbitty"
      className={`fixed inset-0 z-[300] flex flex-col justify-between bg-black text-white select-none font-sans overflow-hidden transition-all ease-in-out duration-700 ${
        isFinalClosing ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Atmósfera cinematográfica con luz de pulso */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(233,30,99,0.18)_0%,rgba(0,0,0,0.96)_75%)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-600/12 blur-[160px]" />

      {/* Header flotante: audio y omitir */}
      <header className="relative z-20 flex w-full items-center justify-between px-6 pb-4 pt-8">
        <button
          type="button"
          onClick={toggleMute}
          className="flex cursor-pointer items-center gap-2 px-1 py-2 text-xs font-mono tracking-widest text-zinc-400 transition-colors hover:text-white"
        >
          {isMuted ? (
            <>
              <VolumeX size={15} className="text-zinc-500" />
              <span className="text-[10px] uppercase">Toca para activar audio</span>
            </>
          ) : (
            <>
              <Volume2 size={15} className="animate-pulse text-pink-400" />
              <span className="text-[10px] font-bold uppercase text-pink-400">{signalLabel}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleFinish}
          aria-label="Omitir el ritual y continuar"
          className="cursor-pointer rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-mono uppercase tracking-widest text-zinc-200 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
        >
          {skipLabel}
        </button>
      </header>

      {/* Escenario central: logo + frases con fade progresivo */}
      <main className="relative z-10 mx-auto my-auto flex w-full max-w-2xl flex-col items-center justify-center space-y-10 px-6 text-center">
        <div
          className={`relative inline-block transform transition-all duration-1000 ease-out ${
            currentTime >= OUTRO_AT ? 'z-30 scale-150 sm:scale-[1.75]' : 'scale-100'
          }`}
        >
          <div
            className={`pointer-events-none absolute inset-0 animate-pulse rounded-full bg-pink-500/25 blur-3xl transition-all duration-1000 ${
              currentTime >= OUTRO_AT ? 'scale-150 opacity-80' : 'scale-150'
            }`}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt="Rabbitty"
            className="mx-auto h-24 w-24 object-contain drop-shadow-[0_0_30px_rgba(233,30,99,0.9)] transition-all duration-700 sm:h-32 sm:w-32"
          />
        </div>

        <div className="flex min-h-36 w-full flex-col items-center justify-center">
          {phrases.map((phrase) => {
            const isVisible = currentTime >= phrase.start && currentTime < phrase.end;
            if (!isVisible) return null;

            const phraseDuration = phrase.end - phrase.start;
            const elapsedInPhrase = currentTime - phrase.start;
            const wordDelayStep = Math.min(0.25, phraseDuration / (phrase.words.length + 1));

            return (
              <div key={phrase.id} className="w-full space-y-4 opacity-100 transition-opacity duration-700 ease-in-out">
                <span className="block text-[11px] font-mono font-bold uppercase tracking-[0.35em] text-pink-400 opacity-85">
                  {phrase.subtitle}
                </span>

                <h1 className="flex flex-wrap justify-center gap-x-3 gap-y-2 text-3xl font-extrabold leading-snug tracking-tight text-white sm:text-5xl">
                  {phrase.words.map((word, wIdx) => {
                    const wordStartTime = wIdx * wordDelayStep;
                    const isWordVisible = elapsedInPhrase >= wordStartTime;

                    return (
                      <span
                        key={wIdx}
                        className={`inline-block transform transition-all duration-700 ease-out ${
                          isWordVisible
                            ? 'translate-y-0 opacity-100 blur-0'
                            : 'translate-y-3 opacity-0 blur-sm'
                        }`}
                      >
                        {word}
                      </span>
                    );
                  })}
                </h1>
              </div>
            );
          })}

          {/* Estado inicial mientras arranca el audio */}
          {currentTime < introAt && (
            <div className="animate-pulse space-y-2 opacity-50 transition-opacity duration-1000 ease-out">
              <span className="block text-[11px] font-mono uppercase tracking-[0.4em] text-zinc-400">
                Sintonizando frecuencia
              </span>
            </div>
          )}
        </div>
      </main>

      {/* Línea de progreso pegada al borde inferior */}
      <footer className="relative z-20 w-full">
        <div className="h-1 w-full overflow-hidden bg-zinc-950">
          <div
            className="h-full bg-gradient-to-r from-pink-500 via-rose-500 to-pink-400 shadow-[0_0_15px_rgba(233,30,99,1)] transition-all duration-150 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </footer>
    </div>
  );
}
