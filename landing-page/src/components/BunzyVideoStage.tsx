'use client';

/**
 * Escenario de Bunzy en video para el onboarding.
 *
 * Nota: el admin y la miniapp son apps separadas; este componente vive en ambas
 * (mantener sincronizado). Si se mueve a `@rabbitty/ui` habría que añadir
 * framer-motion como dependencia del paquete compartido.
 *
 * Rendimiento y accesibilidad:
 *  · Los videos ya vienen comprimidos y en 1:1; el poster cubre la carga.
 *  · Respeta `prefers-reduced-motion`: no autoplay, solo botón de play.
 *  · El control es un <button> real (teclado + aria-label), no un div.
 *  · Si el video falla, cae al poster sin dejar un hueco negro.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RotateCcw } from 'lucide-react';

export interface BunzyVideoStageProps {
  /** Ruta al video mp4 (ej: /videos/bunzy/bunzy-1-hi.mp4). */
  videoSrc: string;
  /** Imagen que cubre la carga y sirve de fallback. */
  poster?: string;
  /** Título principal del paso. */
  title: string;
  /** Subtítulo o descripción. */
  description?: string;
  /** Etiqueta superior (ej: "PASO 1 · BIENVENIDA"). */
  stepLabel?: string;
  /** Autoplay silenciado (default: true; se desactiva con reduced motion). */
  autoPlay?: boolean;
  /** Loop (default: false; al terminar se queda en el último cuadro). */
  loop?: boolean;
  /** Clase para el contenedor exterior. */
  className?: string;
  /** stacked = video arriba/texto abajo; horizontal = video izquierda/texto derecha. */
  layout?: 'stacked' | 'horizontal';
  /** Alto del marco del video (default: 'h-48 sm:h-56'). */
  videoHeightClass?: string;
  /** Callback cuando el video termina. */
  onEnded?: () => void;
}

export function BunzyVideoStage({
  videoSrc,
  poster,
  title,
  description,
  stepLabel,
  autoPlay = true,
  loop = false,
  className = '',
  layout = 'stacked',
  videoHeightClass = 'h-48 sm:h-56',
  onEnded,
}: BunzyVideoStageProps) {
  const horizontal = layout === 'horizontal';
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Accesibilidad: no autoplay si el usuario pidió menos movimiento.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    // Sincroniza con el elemento <video>; no hay render alternativo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasEnded(false);
    setFailed(false);
    const video = videoRef.current;
    if (!video) return;

    try {
      video.currentTime = 0;
    } catch {
      /* metadata aún no lista: el navegador arranca desde 0 igual */
    }

    if (autoPlay && !reducedMotion) {
      const playPromise = video.play();
      if (playPromise) playPromise.catch(() => setIsPlaying(false));
    } else {
      setIsPlaying(false);
    }
  }, [videoSrc, autoPlay, reducedMotion]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || failed) return;

    if (video.paused || video.ended) {
      if (video.ended) {
        try {
          video.currentTime = 0;
        } catch {
          /* noop */
        }
      }
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setHasEnded(true);
    onEnded?.();
  };

  const handleError = () => {
    setFailed(true);
    setIsPlaying(false);
    setHasEnded(true);
  };

  const playLabel = failed
    ? 'Video de Bunzy no disponible'
    : hasEnded
      ? 'Repetir video de Bunzy'
      : isPlaying
        ? 'Pausar video de Bunzy'
        : 'Reproducir video de Bunzy';

  return (
    <div
      className={`relative mx-auto w-full ${
        horizontal
          ? 'flex max-w-3xl flex-col items-center gap-6 text-center sm:flex-row sm:gap-8 sm:text-left'
          : 'flex max-w-xl flex-col items-center text-center'
      } ${className}`}
    >
      {/* Halo rosa Rabbitty */}
      <div className="pointer-events-none absolute -top-12 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-pink-500/15 blur-[90px]" />

      <motion.button
        type="button"
        onClick={togglePlay}
        aria-label={playLabel}
        disabled={failed}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className={`group relative block cursor-pointer disabled:cursor-default ${
          horizontal ? 'w-[220px] shrink-0 sm:w-[260px]' : 'mb-5'
        }`}
      >
        <div
          className={`relative ${videoHeightClass} aspect-square w-full ${
            horizontal ? '' : 'max-w-[280px]'
          } overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/90 to-black/90 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl`}
        >
          <div className="pointer-events-none absolute inset-0 z-10 rounded-3xl border border-pink-500/30 transition-colors group-hover:border-pink-500/60" />

          {!failed ? (
            <video
              ref={videoRef}
              src={videoSrc}
              poster={poster}
              playsInline
              muted
              loop={loop}
              preload="metadata"
              disablePictureInPicture
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={handleEnded}
              onError={handleError}
              aria-hidden="true"
              className="h-full w-full bg-black object-cover"
            />
          ) : poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="Bunzy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-black/60 text-2xl">🐰</div>
          )}

          {/* Play / replay */}
          <AnimatePresence>
            {(!isPlaying || hasEnded) && !failed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 backdrop-blur-[2px]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-500/90 text-white shadow-lg shadow-pink-500/40">
                  {hasEnded ? <RotateCcw className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </motion.button>

      <div className={`${horizontal ? 'w-full flex-1 space-y-2' : 'w-full space-y-2 px-2'}`}>
        {stepLabel && (
          <p className="m-0 text-[11px] font-black uppercase tracking-[0.22em] text-pink-400">{stepLabel}</p>
        )}

        <h1 className={`m-0 text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl md:text-4xl ${horizontal ? 'sm:text-left' : ''}`}>
          {title}
        </h1>

        {description && (
          <p className={`m-0 mx-auto max-w-md text-sm leading-relaxed text-zinc-400 sm:text-base ${horizontal ? 'sm:mx-0 sm:text-left' : ''}`}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
