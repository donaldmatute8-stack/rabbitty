'use client';

/**
 * ── Sonido del loader (pull-to-refresh / menú Ra) ──────────────────────────
 *
 * Sintetizado con Web Audio: no requiere asset ni descarga, así que no suma
 * peso al bundle ni pide red. Se crea dentro del gesto (touch/click) para que
 * iOS/WKWebView permita reproducirlo, y se ignora si la pestaña está oculta.
 *
 * Preferencia: localStorage `rabbitty_loader_sound` = 'off' lo silencia.
 */

const STORAGE_KEY = 'rabbitty_loader_sound';
const MIN_INTERVAL_MS = 900;

let ctx: AudioContext | null = null;
let lastPlayedAt = 0;

type AudioCtor = typeof AudioContext;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  try {
    const Ctor: AudioCtor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

export function isLoaderSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setLoaderSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    /* noop */
  }
}

/**
 * “Pop” ascendente de dos notas, corto y suave (≈0.28 s).
 * Pensado para acompañar la aparición del conejo del loader.
 */
export function playLoaderSound(): void {
  if (typeof window === 'undefined') return;
  if (!isLoaderSoundEnabled()) return;
  if (document.hidden) return;

  const now = Date.now();
  if (now - lastPlayedAt < MIN_INTERVAL_MS) return;
  lastPlayedAt = now;

  const audio = getContext();
  if (!audio) return;

  const run = () => {
    const t0 = audio.currentTime;

    const master = audio.createGain();
    master.gain.value = 0.07;
    master.connect(audio.destination);

    const note = (
      freq: number,
      start: number,
      dur: number,
      type: OscillatorType = 'sine',
      peak = 1,
    ) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0 + start);

      // Ataque rápido + caída exponencial: sin “click” y sin cola larga
      gain.gain.setValueAtTime(0.0001, t0 + start);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);

      osc.connect(gain);
      gain.connect(master);
      osc.start(t0 + start);
      osc.stop(t0 + start + dur + 0.02);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          /* noop */
        }
      };
    };

    // G5 → D6, con un cuerpo grave muy tenue
    note(783.99, 0, 0.16, 'sine', 0.9);
    note(1174.66, 0.055, 0.22, 'sine', 0.75);
    note(392, 0, 0.12, 'triangle', 0.32);
  };

  try {
    if (audio.state === 'suspended') {
      audio.resume().then(run).catch(() => {});
    } else {
      run();
    }
  } catch {
    /* si el navegador bloquea el audio, el loader funciona igual */
  }
}
