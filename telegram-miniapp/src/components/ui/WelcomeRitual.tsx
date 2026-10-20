'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface WelcomeRitualProps {
  onComplete?: () => void;
  storageKey?: string;
  forceOpen?: boolean;
}

const PHRASES = [
  {
    id: 1,
    start: 5.0,
    end: 9.0, // Permanece hasta que entra la frase 2 en el segundo 9
    subtitle: 'Bienvenido al universo Rabbitty',
    words: ['«El', 'mundo', 'está', 'lleno', 'de', 'lugares', 'por', 'descubrir.»'],
  },
  {
    id: 2,
    start: 9.0,
    end: 13.0, // Permanece hasta que entra la frase 3 en el segundo 13
    subtitle: 'Explora con identidad propia',
    words: ['«Encuentra', 'tu', 'próximo', 'favorito.»'],
  },
  {
    id: 3,
    start: 13.0,
    end: 14.8, // Finaliza la frase
    subtitle: 'Recompensas reales en cada visita',
    words: ['«Disfruta', 'más', 'cada', 'visita.»'],
  },
];

export function WelcomeRitual({
  onComplete,
  storageKey = 'rabbitty_welcome_ritual_seen_v3',
  forceOpen = false,
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

    // Iniciar fade out conjunto hacia la app
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
      }, 40);
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, 'true');
      } catch {}
    }

    setTimeout(() => {
      setIsOpen(false);
      onComplete?.();
    }, 450); // Fade medio más rápido hacia la app
  }, [storageKey, onComplete]);

  // Hard safety timeout: jamás permitir que el overlay permanezca abierto más de 17s bajo ninguna circunstancia
  useEffect(() => {
    if (!isOpen) return;
    const safetyTimer = setTimeout(() => {
      if (!hasFinishedRef.current) {
        console.warn('[WelcomeRitual] Triggered 17s safety auto-close.');
        handleFinish();
      }
    }, 17000);
    return () => clearTimeout(safetyTimer);
  }, [isOpen, handleFinish]);

  // Manejo de reproducción de audio y sincronización continua
  useEffect(() => {
    if (!isOpen) return;

    const audio = new Audio('/assets/lugares-por-descubrir.mp3');
    audioRef.current = audio;
    audio.preload = 'auto';

    const handleTimeUpdate = () => {
      if (audio.duration) {
        const t = audio.currentTime;
        setCurrentTime(t);
        const pct = (t / audio.duration) * 100;
        setProgress(pct);

        // Si pasa de 16.2 segundos y aún no disparó finish, disparar cierre en fade
        if (t >= 16.2 && !hasFinishedRef.current) {
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

    // Fallback: Si el navegador bloquea el audio o no dispara timeupdate (ej. Safari / Telegram Webview),
    // mantener un reloj interno para avanzar los subtítulos y cerrar automáticamente a los 16s.
    const fallbackTicker = setInterval(() => {
      const aud = audioRef.current;
      if (!aud) return;
      if (aud.paused || aud.ended) {
        setCurrentTime((prev) => {
          if (prev >= 16.5) {
            clearInterval(fallbackTicker);
            handleFinish();
            return 16.5;
          }
          const next = prev + 0.25;
          setProgress(Math.min(100, (next / 16.5) * 100));
          if (next >= 16.5) {
            clearInterval(fallbackTicker);
            handleFinish();
          }
          return next;
        });
      }
    }, 250);

    // Intentar reproducción automática sin mutear
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        audio.muted = true;
        setIsMuted(true);
        audio.play().catch(() => {});
      });
    }

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
  }, [isOpen, handleFinish]);

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 z-300 flex flex-col justify-between bg-black text-white select-none font-sans overflow-hidden transition-all ease-in-out duration-900 ${
        isFinalClosing ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Atmósfera Cinematográfica con luz de pulso */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(233,30,99,0.18)_0%,rgba(0,0,0,0.96)_75%)] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-140 h-140 bg-pink-600/12 rounded-full blur-[160px] pointer-events-none" />

      {/* Header flotante: Audio & Skip (discreto, respeta safe-area de Apple / status bar) */}
      <header 
        className="relative z-20 w-full px-6 pb-4 flex items-center justify-between"
        style={{
          paddingTop: 'calc(max(env(safe-area-inset-top, 0px), var(--tg-safe-top-adjusted, 0px)) + 16px)',
        }}
      >
        <button
          type="button"
          onClick={toggleMute}
          className="flex items-center gap-2 text-xs font-mono tracking-widest text-zinc-400 hover:text-white transition-colors cursor-pointer py-2 px-1"
        >
          {isMuted ? (
            <>
              <VolumeX size={15} className="text-zinc-500" />
              <span className="uppercase text-[10px]">Toca para activar audio</span>
            </>
          ) : (
            <>
              <Volume2 size={15} className="text-pink-400 animate-pulse" />
              <span className="uppercase text-[10px] text-pink-400 font-bold">The Rabbitty Signal</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleFinish}
          className="text-xs uppercase font-mono tracking-widest text-zinc-400 hover:text-white transition-colors cursor-pointer py-2 px-3 rounded-full hover:bg-white/5 active:scale-95"
        >
          Omitir
        </button>
      </header>

      {/* Escenario Central: Logo protagonista + Tipografía con fade progresivo */}
      <main className="relative z-10 max-w-2xl mx-auto px-6 text-center my-auto flex flex-col items-center justify-center space-y-10 w-full">
        
        {/* Logo Rabbitty al centro: Zoom lento heroico al finalizar la última frase */}
        <div 
          className={`relative inline-block transition-all duration-1200 ease-out transform ${
            currentTime >= 14.8 ? 'scale-175 sm:scale-200 z-30' : 'scale-100'
          }`}
        >
          <div className={`absolute inset-0 rounded-full bg-pink-500/30 blur-3xl animate-pulse pointer-events-none transition-all duration-1000 ${
            currentTime >= 14.8 ? 'scale-250 opacity-80' : 'scale-150'
          }`} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_conejo.png"
            alt="Rabbitty"
            className="w-24 h-24 sm:w-32 sm:h-32 object-contain mx-auto filter drop-shadow-[0_0_30px_rgba(233,30,99,0.9)] transition-all duration-700"
          />
        </div>

        {/* Contenedor de Frases: Se desvanece suavemente a partir de 14.8s para dejar solo el logo protagonista */}
        <div className={`min-h-36 flex flex-col items-center justify-center w-full transition-opacity duration-700 ease-in-out ${
          currentTime >= 14.8 ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}>
          {PHRASES.map((phrase) => {
            const isVisible = currentTime >= phrase.start && currentTime < phrase.end;
            if (!isVisible) return null;

            const phraseDuration = phrase.end - phrase.start;
            const elapsedInPhrase = currentTime - phrase.start;
            const wordDelayStep = Math.min(0.25, phraseDuration / (phrase.words.length + 1));

            return (
              <div
                key={phrase.id}
                className="space-y-4 w-full transition-opacity duration-700 ease-in-out opacity-100"
              >
                <span className="text-[11px] font-mono uppercase tracking-[0.35em] text-pink-400 font-bold block opacity-85 transition-opacity duration-500">
                  {phrase.subtitle}
                </span>

                <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-snug flex flex-wrap justify-center gap-x-3 gap-y-2">
                  {phrase.words.map((word, wIdx) => {
                    const wordStartTime = wIdx * wordDelayStep;
                    const isWordVisible = elapsedInPhrase >= wordStartTime;

                    return (
                      <span
                        key={wIdx}
                        className={`inline-block transition-all duration-700 ease-out transform ${
                          isWordVisible
                            ? 'opacity-100 translate-y-0 filter-none'
                            : 'opacity-0 translate-y-3 blur-xs'
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

          {/* Estado inicial mientras comienza el audio (segundos 0 a 5) */}
          {currentTime < 5.0 && (
            <div className="space-y-2 opacity-50 transition-opacity duration-1000 ease-out animate-pulse">
              <span className="text-[11px] font-mono uppercase tracking-[0.4em] text-zinc-400 block">
                Sintonizando frecuencia
              </span>
            </div>
          )}
        </div>
      </main>

      {/* Línea de progreso pegada estrictamente al borde inferior */}
      <footer className="relative z-20 w-full">
        <div className="w-full bg-zinc-950 h-1 overflow-hidden">
          <div
            className="h-full bg-linear-to-r from-pink-500 via-rose-500 to-pink-400 transition-all duration-150 ease-out shadow-[0_0_15px_rgba(233,30,99,1)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </footer>
    </div>
  );
}
