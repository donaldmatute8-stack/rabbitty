'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Crosshair, Mic, MicOff, Sparkles, Navigation, Search,
  Flame, Gift, X, ChevronRight
} from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import { useTheme } from '@/contexts/ThemeContext';
import { RabbittyMap } from './nativeMapBridge';
import BunnyInlineLoader from '@/components/ui/BunnyInlineLoader';
import { createMapEngine, type MapEngine } from './engines';
import { getIcon } from './markers';
import type { MapBusiness } from './engines/types';

export type { MapBusiness } from './engines/types';

interface InteractiveMapProps {
  businesses: MapBusiness[];
  userLat?: number | null;
  userLng?: number | null;
  accuracy?: number | null;
  locationTimestamp?: number | null;
  onRequestLocation?: () => void;
  isLocating?: boolean;
}

export default function InteractiveMap({
  businesses,
  userLat,
  userLng,
  accuracy,
  locationTimestamp,
  onRequestLocation,
  isLocating,
}: InteractiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MapEngine | null>(null);
  const [mapReady, setMapReady] = useState(false);
  // Movimiento programático (fly/fit): evita que el mapa parezca vacío.
  const [mapBusy, setMapBusy] = useState(false);
  const busyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [engineKind, setEngineKind] = useState<'maplibre' | 'leaflet'>('leaflet');
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  // Se leen después de montar: leer `window` durante el render provoca
  // desajuste de hidratación (React regenera el árbol y el mapa carga dos veces).
  const [affiliateParam, setAffiliateParam] = useState<string | null>(null);

  const [selected, setSelected] = useState<MapBusiness | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [bunzyOpen, setBunzyOpen] = useState(false);
  
  // Bunzy Copilot Voice & Search State (Gemini-in-car style)
  const [isListening, setIsListening] = useState(false);
  const [copilotQuery, setCopilotQuery] = useState('');
  const [copilotReply, setCopilotReply] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isNativeIos, setIsNativeIos] = useState(false);

  useEffect(() => {
    setAffiliateParam(new URLSearchParams(window.location.search).get('affiliate'));
    setSpeechSupported(
      PlatformBridge.isNative() ||
        'webkitSpeechRecognition' in window ||
        'SpeechRecognition' in window,
    );
    setIsNativeIos(PlatformBridge.isIos());
  }, []);
  const [nativeMapActive, setNativeMapActive] = useState(false);
  // Voz: referencias para poder cortar al detectar silencio y no perder lo dicho.
  const recognitionRef = useRef<{ stop: () => void; abort?: () => void } | null>(null);
  const voiceTranscriptRef = useRef('');
  const voiceSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nativeSpeechRef = useRef<{ stop?: () => Promise<unknown> } | null>(null);

  const router = useRouter();

  // Centrar el mapa al cargar si viene un afiliado específico en la URL
  useEffect(() => {
    if (!affiliateParam || businesses.length === 0) return;
    const target = businesses.find(b => b.id === affiliateParam);
    if (target) setSelected(target);
    if (target && target.lat && target.lng && engineRef.current) {
      engineRef.current?.flyTo(Number(target.lat), Number(target.lng), 16.5, 1200);
    }
  }, [affiliateParam, businesses]);

  // 1. Lifecycle para montaje/desmontaje de MapKit nativo en iOS
  useEffect(() => {
    if (!isNativeIos) return;

    let listenerHandle: { remove: () => void } | null = null;
    let isMounted = true;

    RabbittyMap.showMap()
      .then(() => {
        if (!isMounted) return;
        setNativeMapActive(true);
      })
      .catch((err) => {
        console.warn('[MapKit] Native map init failed, using Leaflet fallback:', err);
        if (isMounted) setNativeMapActive(false);
      });

    RabbittyMap.addListener('onBusinessSelected', (data) => {
      const match = businesses.find((b) => b.id === data.businessId);
      if (match) setSelected(match);
    }).then((handle) => {
      listenerHandle = handle;
    }).catch(() => {});

    return () => {
      isMounted = false;
      if (listenerHandle) listenerHandle.remove();
      RabbittyMap.hideMap().catch(() => {});
      setNativeMapActive(false);
    };
  }, [isNativeIos, businesses]);

  // 2. Sincronización de spots en mapa nativo sin recrear la vista (anti-thrash)
  useEffect(() => {
    if (!nativeMapActive) return;
    RabbittyMap.setBusinesses({ businesses }).catch(() => {});
  }, [nativeMapActive, businesses]);

  // 3. Centrado GPS dinámico cuando la ubicación llega o cambia
  useEffect(() => {
    if (!nativeMapActive || userLat == null || userLng == null) return;
    RabbittyMap.centerOn({ lat: userLat, lng: userLng, radiusKm: 2.0 }).catch(() => {});
  }, [nativeMapActive, userLat, userLng]);

  // Filter businesses (memoizado: estable para el motor de mapa)
  const filteredBusinesses = useMemo(() => businesses.filter(b => {
    // Categoría: la fija Bunzy (café, restaurante…) o "Todos".
    let categoryMatch = true;
    if (activeCategory !== 'Todos') {
      const cat = (b.category || b.device || '').toLowerCase();
      categoryMatch = cat.includes(activeCategory.toLowerCase());
    }

    // Buscador: nombre, categoría o nicho.
    const q = searchQuery.trim().toLowerCase();
    const textMatch = !q || `${b.name || b.user || ''} ${b.category || b.device || ''}`
      .toLowerCase()
      .includes(q);

    return categoryMatch && textMatch;
  }), [businesses, activeCategory, searchQuery]);



  // Speech Synthesis TTS Engine
  const speakReply = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel(); // Stop any pending utterance
      // Clean emojis and icons for clean vocalization
      const cleanText = text.replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/gu, '').trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'es-MX';
      utterance.rate = 1.05;
      utterance.pitch = 1.08;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech synthesis is best effort
    }
  }, []);

  // Bunzy voice command processor
  const handleVoiceCommand = useCallback((transcript: string) => {
    setCopilotQuery(transcript);
    PlatformBridge.hapticFeedback('medium');

    const lower = transcript.toLowerCase();
    
    // Command 1: Cafés / concentración / trabajar
    if (lower.includes('café') || lower.includes('cafe') || lower.includes('trabaj') || lower.includes('concentr')) {
      setActiveCategory('Cafetería');
      const cafe = businesses.find(b => (b.category || '').toLowerCase().includes('caf'));
      if (cafe && cafe.lat && cafe.lng && engineRef.current) {
        const reply = `Encontré ${cafe.name || 'Cafetería'} en tu zona con cashback en Bunz ☕`;
        setCopilotReply(reply);
        speakReply(reply);
        engineRef.current?.flyTo(Number(cafe.lat), Number(cafe.lng), 16, 1200);
        setSelected(cafe);
      } else {
        const reply = 'No encontré cafeterías afiliadas activas en esta área ☕';
        setCopilotReply(reply);
        speakReply(reply);
      }
    } 
    // Command 2: Mayor recompensa / más bunz / cashback alto
    else if (lower.includes('más bunz') || lower.includes('mas bunz') || lower.includes('recompensa') || lower.includes('cashback')) {
      const topBiz = [...businesses].sort((a, b) => (b.rewardPercentage || 0) - (a.rewardPercentage || 0))[0];
      if (topBiz && topBiz.lat && topBiz.lng && engineRef.current) {
        const reply = `El spot con más cashback es ${topBiz.name || 'afiliado'} con +${topBiz.rewardPercentage ?? 0}% Bunz 🔥`;
        setCopilotReply(reply);
        speakReply(reply);
        engineRef.current?.flyTo(Number(topBiz.lat), Number(topBiz.lng), 16.5, 1200);
        setSelected(topBiz);
      } else {
        const reply = 'No hay comercios con recompensas registradas en esta zona.';
        setCopilotReply(reply);
        speakReply(reply);
      }
    }
    // Command 3: Comida / restaurante / hambre
    else if (lower.includes('comer') || lower.includes('hambre') || lower.includes('restaurante') || lower.includes('pizza')) {
      setActiveCategory('Restaurante');
      const food = businesses.find(b => (b.category || '').toLowerCase().includes('restaurante') || (b.category || '').toLowerCase().includes('comida'));
      if (food && food.lat && food.lng && engineRef.current) {
        const reply = `Filtrando opciones de comida. Te muestro ${food.name || 'restaurante'} 🍕`;
        setCopilotReply(reply);
        speakReply(reply);
        engineRef.current?.flyTo(Number(food.lat), Number(food.lng), 16, 1200);
        setSelected(food);
      } else {
        const reply = 'No encontré restaurantes afiliados activos en esta área 🍕';
        setCopilotReply(reply);
        speakReply(reply);
      }
    }
    // Command 4: Mi ubicación / llévame a donde estoy
    else if (lower.includes('dónde estoy') || lower.includes('mi ubicación') || lower.includes('aqui') || lower.includes('aquí')) {
      if (userLat && userLng && engineRef.current) {
        const reply = 'Centrando el radar en tu ubicación actual 📍';
        setCopilotReply(reply);
        speakReply(reply);
        engineRef.current?.flyTo(userLat, userLng, 16.5, 1000);
      } else if (onRequestLocation) {
        onRequestLocation();
        const reply = 'Activando señal GPS de tu dispositivo 📍';
        setCopilotReply(reply);
        speakReply(reply);
      }
    }
    // Default fallback: search query
    else {
      const match = businesses.find(b => (b.name || '').toLowerCase().includes(lower) || (b.category || '').toLowerCase().includes(lower));
      if (match && match.lat && match.lng && engineRef.current) {
        const distText = match.distance ? `a ${match.distance} km` : 'en el mapa';
        const reply = `Encontré ${match.name} ${distText} 🐰`;
        setCopilotReply(reply);
        speakReply(reply);
        engineRef.current?.flyTo(Number(match.lat), Number(match.lng), 16.5, 1200);
        setSelected(match);
      } else {
        const reply = `Buscando "${transcript}" en comercios afiliados cercanos 🐰`;
        setCopilotReply(reply);
        speakReply(reply);
      }
    }
  }, [businesses, userLat, userLng, onRequestLocation, speakReply]);

  const copilotInputRef = useRef<HTMLInputElement>(null);

  const toggleSpeechRecognition = async () => {
    if (typeof window === 'undefined') return;
    PlatformBridge.hapticFeedback('medium');

    if (isListening) {
      // Antes solo se apagaba el estado: se perdía lo dictado y el motor seguía
      // escuchando. Ahora se cierra el micrófono y se procesa lo reconocido.
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
      try { void nativeSpeechRef.current?.stop?.(); } catch { /* noop */ }
      if (voiceSilenceTimerRef.current) {
        clearTimeout(voiceSilenceTimerRef.current);
        voiceSilenceTimerRef.current = null;
      }
      setIsListening(false);
      return;
    }

    const isIosDevice = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);

    // ── 1. NATIVO: plugin de reconocimiento de voz (iOS/Android en Capacitor) ──
    // H-MAP-VOICE: antes cualquier fallo del import caía silenciosamente a Web
    // Speech (que NO existe en WKWebView) → el usuario solo veía "escribe tu
    // búsqueda". Ahora el diagnóstico es por niveles: plugin ausente en este
    // BUILD → mensaje de actualización; permiso negado → mensaje de Ajustes.
    if (PlatformBridge.isNative()) {
      // 1a. Plugin local iOS (SFSpeechRecognizer). La app usa SPM y el plugin
      // de la comunidad es CocoaPods-only, por eso no entraba al build.
      try {
        const { registerPlugin } = await import('@capacitor/core');
        const localSpeech = registerPlugin('RabbittySpeech') as unknown as {
          available?: () => Promise<{ available: boolean }>;
          start: (opts: { language: string; maxResults: number; prompt?: string }) => Promise<{ matches?: string[] }>;
        };
        const available = await localSpeech.available?.();
        if (!available || available.available !== false) {
          setIsListening(true);
          try {
            const { matches } = await localSpeech.start({ language: 'es-MX', maxResults: 1, prompt: '¿A dónde vamos?' });
            setIsListening(false);
            const text = matches?.[0];
            if (text) handleVoiceCommand(text);
            return;
          } catch (speechErr) {
            setIsListening(false);
            const msg = speechErr instanceof Error ? speechErr.message : String(speechErr ?? '');
            if (msg.includes('PERMISSION_DENIED') || msg.includes('MIC_PERMISSION_DENIED')) {
              copilotInputRef.current?.focus();
              setCopilotReply('Activa el micrófono y el dictado en Ajustes de iOS, o escribe aquí ✍️');
              setTimeout(() => setCopilotReply(null), 4000);
              return;
            }
            throw speechErr;
          }
        }
      } catch (localSpeechErr) {
        console.warn('[SpeechRec] plugin local no disponible, probando comunidad:', localSpeechErr);
      }

      // 1b. Fallback: plugin de la comunidad (Android / builds viejos)
      try {
        const sr = await import('@capacitor-community/speech-recognition');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const plugin = ((sr as Record<string, unknown>).SpeechRecognition ?? sr) as any;
        if (!plugin?.checkPermissions || !plugin?.start) {
          throw new Error('SPEECH_PLUGIN_NOT_IN_BUILD');
        }
        const perm = await plugin.checkPermissions();
        if (perm?.speechRecognition !== 'granted') {
          const req = await plugin.requestPermissions();
          if (req?.speechRecognition !== 'granted') {
            copilotInputRef.current?.focus();
            setCopilotReply('Activa el micrófono en Ajustes de iOS o escribe aquí ✍️');
            setTimeout(() => setCopilotReply(null), 3500);
            return;
          }
        }
        setIsListening(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { matches } = (await plugin.start({ language: 'es-MX', maxResults: 1, prompt: '¿A dónde vamos?' })) as any;
        setIsListening(false);
        const text = matches?.[0];
        if (text) handleVoiceCommand(text);
        return;
      } catch (speechErr) {
        setIsListening(false);
        const msg = speechErr instanceof Error ? speechErr.message : String(speechErr ?? '');
        if (msg.includes('SPEECH_PLUGIN_NOT_IN_BUILD')) {
          console.warn('[SpeechRec] plugin no está en este build nativo (requiere cap sync + rebuild)');
        } else {
          console.warn('[SpeechRec] plugin nativo falló, cae a Web Speech:', speechErr);
        }
        // Diagnóstico visible: sin esto el usuario veía "escribe aquí" y no sabía
        // si era permiso, idioma o que el micrófono no estaba en el binario.
        if (msg && !msg.includes('SPEECH_PLUGIN_NOT_IN_BUILD')) {
          setCopilotReply(
            msg.includes('PERMISSION') || msg.includes('MIC_PERMISSION')
              ? 'Activa micrófono y dictado en Ajustes de iOS, o escribe aquí ✍️'
              : msg.includes('SPEECH_NOT_AVAILABLE')
              ? 'El dictado no está disponible ahora; escribe aquí ✍️'
              : 'No pude escucharte; escribe aquí ✍️'
          );
          setTimeout(() => setCopilotReply(null), 4500);
        }
        // continúa al fallback Web Speech / escritura
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

    // En WKWebView de iOS NUNCA existe Web Speech: si el plugin nativo tampoco
    // está en este build, el mensaje honesto es de actualización — no culpar
    // al usuario pidiendo escribir cuando igual no tiene voz.
    if (!SpeechRec || (isIosDevice && (PlatformBridge.isNative() || PlatformBridge.isTelegram()))) {
      copilotInputRef.current?.focus();
      setCopilotReply(
        isIosDevice && PlatformBridge.isNative()
          ? 'El micrófono llega con la próxima actualización de la app · escribe aquí ✍️'
          : 'Escribe tu búsqueda a Bunzy aquí ✍️'
      );
      setTimeout(() => setCopilotReply(null), 4000);
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let recognition: any = null;
      try {
        recognition = new SpeechRec();
      } catch (instErr) {
        console.warn('[SpeechRec] Could not instantiate speech engine:', instErr);
        copilotInputRef.current?.focus();
        setCopilotReply('Escribe tu consulta a Bunzy aquí ✍️');
        setTimeout(() => setCopilotReply(null), 3500);
        return;
      }

      recognition.lang = 'es-MX';
      recognition.continuous = false;
      // Resultados parciales: permiten saber que la persona sigue hablando y
      // cerrar solos al detectar silencio (Safari no siempre emite el final).
      recognition.interimResults = true;
      recognitionRef.current = recognition as unknown as { stop: () => void };
      voiceTranscriptRef.current = '';

      const armSilence = () => {
        if (voiceSilenceTimerRef.current) clearTimeout(voiceSilenceTimerRef.current);
        voiceSilenceTimerRef.current = setTimeout(() => {
          voiceSilenceTimerRef.current = null;
          try { recognition.stop(); } catch { /* noop */ }
        }, 1400);
      };

      recognition.onstart = () => {
        setIsListening(true);
        armSilence();
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let text = '';
        for (let i = event.resultIndex ?? 0; i < (event.results?.length ?? 0); i += 1) {
          const part = event.results?.[i]?.[0]?.transcript;
          if (part) text += part;
        }
        const clean = text.trim();
        if (!clean) return;
        voiceTranscriptRef.current = clean;
        armSilence();
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (err: any) => {
        setIsListening(false);
        copilotInputRef.current?.focus();
        if (err?.error === 'not-allowed' || err?.error === 'service-not-allowed') {
          setCopilotReply('Activa Dictado en Ajustes de iOS o escribe aquí ✍️');
        } else {
          setCopilotReply('Escribe a Bunzy aquí ✍️');
        }
        setTimeout(() => setCopilotReply(null), 3500);
      };

      recognition.onend = () => {
        if (voiceSilenceTimerRef.current) {
          clearTimeout(voiceSilenceTimerRef.current);
          voiceSilenceTimerRef.current = null;
        }
        setIsListening(false);
        recognitionRef.current = null;
        const said = voiceTranscriptRef.current.trim();
        voiceTranscriptRef.current = '';
        if (said) handleVoiceCommand(said);
      };

      try {
        recognition.start();
      } catch (startErr) {
        console.warn('[SpeechRec] Failed to start recognition:', startErr);
        setIsListening(false);
        copilotInputRef.current?.focus();
        setCopilotReply('Escribe a Bunzy aquí ✍️');
        setTimeout(() => setCopilotReply(null), 3500);
      }
    } catch (outerErr) {
      console.warn('[SpeechRec] General exception caught:', outerErr);
      setIsListening(false);
      copilotInputRef.current?.focus();
      setCopilotReply('Escribe a Bunzy aquí ✍️');
      setTimeout(() => setCopilotReply(null), 3500);
    }
  };

  // Voz: no dejar timers ni micrófono abiertos al salir del mapa.
  useEffect(() => () => {
    if (voiceSilenceTimerRef.current) clearTimeout(voiceSilenceTimerRef.current);
    try { recognitionRef.current?.abort?.(); } catch { /* noop */ }
  }, []);

  // ── Inicialización del motor (una sola vez) ──
  // maplibre (OpenFreeMap, vectorial) con respaldo automático a leaflet.
  useEffect(() => {
    if (!mapRef.current || engineRef.current) return;
    let cancelled = false;
    let ro: ResizeObserver | null = null;

    void createMapEngine({
      container: mapRef.current,
      isDark,
      onSelect: (b) => setSelected(b),
      onDeselect: () => setSelected(null),
      onBusy: (durationMs: number) => {
        setMapBusy(true);
        if (busyTimerRef.current) clearTimeout(busyTimerRef.current);
        busyTimerRef.current = setTimeout(() => setMapBusy(false), Math.max(400, durationMs + 250));
      },
      onReady: () => {
        if (cancelled) return;
        setMapReady(true);
        engineRef.current?.invalidateSize();
      },
    })
      .then((engine) => {
        if (cancelled) {
          engine.destroy();
          return;
        }
        engineRef.current = engine;
        setEngineKind(engine.kind);
        if (engine.kind === 'leaflet') setMapReady(true);
      })
      .catch((err) => {
        console.warn('[map] no se pudo crear el motor de mapa:', err);
      });

    // El contenedor cambia de tamaño al abrir paneles o cambiar de pestaña.
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => engineRef.current?.invalidateSize());
      ro.observe(mapRef.current);
    }

    const t1 = setTimeout(() => engineRef.current?.invalidateSize(), 60);
    const t2 = setTimeout(() => engineRef.current?.invalidateSize(), 240);
    const t3 = setTimeout(() => engineRef.current?.invalidateSize(), 600);

    return () => {
      cancelled = true;
      if (ro) ro.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      engineRef.current?.destroy();
      engineRef.current = null;
      setMapReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambio de tema: el motor repinta el estilo (o los tiles en Leaflet).
  useEffect(() => {
    engineRef.current?.setTheme(isDark);
  }, [isDark]);

  // Ubicación del usuario: punto + halo, y centrado cuando llega el GPS.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setUser(userLat ?? null, userLng ?? null);
    if (userLat != null && userLng != null) {
      engine.flyTo(userLat, userLng, 15.5, 1200);
    }
  }, [userLat, userLng, mapReady]);

  // Spots: el motor decide (clusters + pines visibles).
  useEffect(() => {
    engineRef.current?.setBusinesses(filteredBusinesses, selected?.id ?? null);
  }, [filteredBusinesses, selected, mapReady, isDark]);

  const totalBunzInZone = filteredBusinesses.reduce((sum, b) => sum + (b.rewardPercentage || b.reward_percentage || 0), 0);

  return (
    <div 
      className="w-full h-full relative overflow-hidden select-none" 
      style={{ background: isDark ? '#0D0914' : '#F8FAFC' }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        .maplibregl-canvas { outline: none; }
        .rabbitty-map-credit {
          position: absolute;
          bottom: 6px;
          left: 8px;
          z-index: 3;
          font-size: 9px;
          letter-spacing: 0.02em;
          padding: 2px 6px;
          border-radius: 6px;
          pointer-events: none;
          color: ${isDark ? 'rgba(255,255,255,0.42)' : 'rgba(15,10,20,0.42)'};
          background: ${isDark ? 'rgba(8,5,14,0.45)' : 'rgba(255,255,255,0.6)'};
        }
        @keyframes radar-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        .radar-sweep {
          position: absolute;
          top: 14px; left: 14px;
          width: 800px; height: 800px;
          background: conic-gradient(from 0deg, transparent 70%, rgba(233,30,99,0.04) 95%, rgba(233,30,99,0.35) 100%);
          border-radius: 50%;
          animation: radar-spin 3.2s linear infinite;
          pointer-events: none;
          z-index: 0;
          mix-blend-mode: ${isDark ? 'screen' : 'multiply'};
        }
        .rb-pulse {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 1.5px solid #E91E63;
          animation: rb-pulse-anim 2.5s cubic-bezier(0.24, 0, 0.38, 1) infinite;
          pointer-events: none;
        }
        .rb-pulse-2 { animation-delay: 0.8s; }
        .rb-pulse-3 { animation-delay: 1.6s; }
        @keyframes rb-pulse-anim {
          0% { transform: scale(0.9); opacity: 0.8; }
          100% { transform: scale(3.2); opacity: 0; }
        }
      `}} />

      {/* Hex Grid Overlay (Cyber Aesthetic) */}
      <div 
        className="absolute inset-0 z-1 pointer-events-none opacity-40" 
        style={{
          backgroundImage: isDark
            ? `repeating-linear-gradient(60deg,rgba(233,30,99,0.03) 0px,rgba(233,30,99,0.03) 1px,transparent 1px,transparent 30px),
               repeating-linear-gradient(120deg,rgba(233,30,99,0.03) 0px,rgba(233,30,99,0.03) 1px,transparent 1px,transparent 30px)`
            : `repeating-linear-gradient(60deg,rgba(0,136,204,0.02) 0px,rgba(0,136,204,0.02) 1px,transparent 1px,transparent 30px)`
        }} 
      />

      {/* Mientras el motor no reporta listo: mismo loader que el inicio */}
      {mapBusy && !nativeMapActive && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 rounded-full bg-black/75 px-4 py-2 text-[11px] font-black text-white shadow-lg">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/25 border-t-white" />
            Buscando spots…
          </div>
        </div>
      )}

      {!mapReady && !nativeMapActive && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center"
          style={{ background: isDark ? '#08050E' : '#F8FAFC' }}
          aria-live="polite"
        >
          <BunnyInlineLoader size={26} label="Cargando mapa" />
        </div>
      )}

      {/* Atribución mínima de los tiles (OpenFreeMap sirve datos de OSM) */}
      <span className="rabbitty-map-credit">
        {engineKind === 'maplibre' ? '© OpenStreetMap · OpenFreeMap' : '© OpenStreetMap'}
      </span>

      {/* Lienzo del motor de mapa (oculto solo si MapKit nativo está activo).
          El tamaño va en línea porque maplibre-gl.css define `.maplibregl-map`
          como `position: relative` y anula el `absolute` de Tailwind: el
          contenedor quedaba en 0 px de alto y el canvas no pintaba. */}
      <div
        ref={mapRef}
        className={`z-0 transition-opacity duration-300 ${nativeMapActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* Top HUD: Spots Counter & Quick Stats */}
      <div 
        className="absolute inset-x-4 z-20 flex items-center justify-between pointer-events-none"
        style={{ top: PlatformBridge.isTelegram() ? 12 : 14 }}
      >
        {/* Left Stats Pill (Glassmorphic) */}
        <div 
          className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-md backdrop-blur-xl"
          style={{
            background: isDark ? 'rgba(13, 9, 20, 0.88)' : 'rgba(255, 255, 255, 0.92)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#E91E63] animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
              {filteredBusinesses.length} {filteredBusinesses.length === 1 ? 'Spot' : 'Spots'}
            </span>
          </div>
          
          {totalBunzInZone > 0 && (
            <>
              <span className="w-1 h-1 rounded-full bg-(--text-muted) opacity-40" />
              <span className="text-[11px] font-extrabold text-[#E91E63] flex items-center gap-1">
                <Flame className="w-3 h-3 fill-[#E91E63]" />
                {totalBunzInZone}% Bunz
              </span>
            </>
          )}
        </div>

        {/* Compact GPS status indicator (No space disruption) */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          {isLocating ? (
            <span 
              className="px-2.5 py-1 rounded-full text-[10px] font-black text-white flex items-center gap-1 shadow-md animate-pulse"
              style={{ background: 'linear-gradient(135deg, #E91E63 0%, #D81B60 100%)' }}
            >
              <Crosshair size={11} className="animate-spin" />
              <span>GPS...</span>
            </span>
          ) : userLat && userLng ? (
            <button
              type="button"
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                engineRef.current?.flyTo(userLat, userLng, 16.5, 1000);
                if (onRequestLocation && locationTimestamp && Date.now() - locationTimestamp > 60_000) {
                  onRequestLocation();
                }
              }}
              className="px-2.5 py-1 rounded-full text-[10px] font-black text-emerald-300 border border-emerald-500/30 bg-emerald-950/70 backdrop-blur-md flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
              title={`Centrar en mi ubicación GPS${accuracy ? ` (Precisión: ±${Math.round(accuracy)}m)` : ''}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{accuracy ? `GPS Activo (±${Math.round(accuracy)}m)` : 'GPS Activo'}</span>
            </button>
          ) : (
            onRequestLocation && (
              <button
                type="button"
                onClick={() => {
                  PlatformBridge.hapticFeedback('light');
                  onRequestLocation();
                }}
                className="px-2.5 py-1 rounded-full text-[10px] font-bold text-gray-300 border border-white/10 bg-black/60 backdrop-blur-md flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer hover:text-white"
                title="Activar GPS"
              >
                <Crosshair size={10} className="text-pink-400" />
                <span>Activar GPS</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Buscador minimalista: una sola barra */}
      <div
        className="absolute z-20 inset-x-4"
        style={{ top: PlatformBridge.isTelegram() ? 56 : 58 }}
      >
        <div
          className="rounded-2xl border shadow-xl backdrop-blur-2xl px-3 py-2.5"
          style={{
            background: isDark ? 'rgba(18, 12, 28, 0.92)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: isListening
              ? '#E91E63'
              : isDark
                ? 'rgba(255, 255, 255, 0.10)'
                : 'rgba(0, 0, 0, 0.08)',
            boxShadow: isListening ? '0 0 24px rgba(233,30,99,0.35)' : '0 8px 32px rgba(0,0,0,0.12)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <Search size={16} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
            <input
              ref={copilotInputRef}
              type="text"
              value={copilotQuery}
              onChange={(e) => {
                setCopilotQuery(e.target.value);
                setSearchQuery(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && copilotQuery.trim()) {
                  handleVoiceCommand(copilotQuery.trim());
                }
              }}
              placeholder={copilotReply || 'Buscar en el mapa'}
              className="w-full bg-transparent border-none outline-none text-[13px] font-semibold placeholder:text-(--text-muted)"
              style={{ color: 'var(--text-primary)' }}
            />
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-none transition-all active:scale-95 ${
                isListening ? 'bg-[#E91E63] text-white animate-pulse' : 'bg-(--bg-subtle) text-(--text-primary)'
              }`}
              title={speechSupported ? 'Hablar con Bunzy' : 'Buscar con Bunzy'}
              aria-label="Buscar con la voz"
            >
              {isListening ? (
                <Mic size={15} className="animate-pulse" />
              ) : speechSupported ? (
                <Mic size={15} className="text-[#E91E63]" />
              ) : (
                <MicOff size={15} className="opacity-60" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Bunzy: un botón flotante, no una barra de sugerencias */}
      <button
        type="button"
        onClick={() => {
          PlatformBridge.hapticFeedback('light');
          setBunzyOpen(true);
        }}
        className="absolute right-4 z-20 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 shadow-xl active:scale-90 transition-transform"
        style={{
          top: PlatformBridge.isTelegram() ? 175 : 180,
          background: 'linear-gradient(135deg, #E91E63 0%, #8E24AA 100%)',
        }}
        aria-label="Abrir Bunzy"
        title="Bunzy"
      >
        <Sparkles size={20} className="text-white" />
      </button>

      {/* Selected Business Action Card (Positioned cleanly ABOVE the bottom filter dock) */}
      {selected && (
        <div 
          className="absolute inset-x-4 z-30 max-w-lg mx-auto pointer-events-auto animate-fadeIn transition-all duration-300"
          style={{ bottom: PlatformBridge.isTelegram() ? 28 : 22 }}
        >
          <div
            onClick={() => router.push(`/affiliate/${selected.id}`)}
            className="p-4 rounded-3xl border shadow-2xl backdrop-blur-2xl flex flex-col gap-2.5 cursor-pointer relative overflow-hidden transition-all active:scale-98"
            style={{
              // H-MAP-CARD: glassmorphism real (alpha bajo + blur+saturate) —
              // antes era casi opaco (0.98) y el blur no se apreciaba.
              background: isDark
                ? 'linear-gradient(160deg, rgba(20,12,30,0.78) 0%, rgba(10,7,18,0.68) 100%)'
                : 'linear-gradient(160deg, rgba(255,255,255,0.82) 0%, rgba(255,244,248,0.74) 100%)',
              backdropFilter: 'blur(26px) saturate(165%)',
              WebkitBackdropFilter: 'blur(26px) saturate(165%)',
              borderColor: isDark ? 'rgba(233, 30, 99, 0.35)' : 'rgba(233, 30, 99, 0.25)',
              boxShadow: isDark
                ? '0 20px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)'
                : '0 20px 50px rgba(15,8,20,0.18), inset 0 1px 0 rgba(255,255,255,0.65)',
            }}
          >
            {/* Glow decorativo del borde superior (tinte del brand) */}
            <div
              className="absolute inset-x-0 top-0 h-px pointer-events-none"
              style={{ background: 'linear-gradient(90deg, transparent 12%, rgba(233,30,99,0.55) 50%, transparent 88%)' }}
            />

            {/* Cerrar — burbuja glass esquinada fuera del flujo (antes
                convivía apiñada junto al título) */}            <button
              type="button"
              aria-label="Cerrar"
              onClick={(e) => {
                e.stopPropagation();
                setSelected(null);
              }}
              className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer border active:scale-90 transition-transform"
              style={{
                background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(13,9,20,0.08)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)',
                color: 'var(--text-muted)',
              }}
            >
              <X size={13} strokeWidth={2.6} />
            </button>

            <div className="flex items-center gap-3.5 mt-1">
              {/* Business Logo / Emoji Avatar */}
              <div
                className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border flex items-center justify-center"
                style={{
                  borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
                }}
              >
                {selected.logoUrl || selected.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={selected.logoUrl || selected.imageUrl}
                    alt={selected.name || 'Comercio'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl">{getIcon(selected.category || selected.device)}</span>
                )}
              </div>

              {/* Info Column */}
              <div className="flex-1 min-w-0">
                <h3 className="m-0 text-base font-black truncate pr-8" style={{ color: 'var(--text-primary)' }}>
                  {selected.name || selected.user}
                </h3>

                <p className="m-0 text-xs font-semibold text-(--text-muted) mt-0.5 truncate">
                  {selected.category || selected.device || 'Comercio Afiliado'} • {selected.distance ? `${selected.distance} km` : 'Cerca de ti'}
                </p>

                {/* Rewards / Bunz Pills */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {(selected.givesBunz !== false) && (
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-[#E91E63]/15 text-[#E91E63] border border-[#E91E63]/30 flex items-center gap-1">
                      <Flame size={11} className="fill-[#E91E63]" />
                      +{selected.reward_percentage || selected.rewardPercentage || 10}% Bunz
                    </span>
                  )}
                  {selected.acceptsBunz === true && (
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                      <Gift size={11} />
                      Stock Disponible
                    </span>
                  )}
                </div>
              </div>

              {/* Navigation CTA — píldora integrada con icono + etiqueta (antes
                  era una caja cuadrada desconectada del diseño de la tarjeta) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  PlatformBridge.hapticFeedback('medium');
                  // In-app: la ficha del afiliado, no un mapa externo con una
                  // dirección que puede no existir.
                  router.push(`/affiliate/${selected.id}`);
                }}
                title="Ver el negocio"
                className="shrink-0 h-10 pl-3 pr-3.5 rounded-full flex items-center gap-1.5 text-white font-black text-[11px] tracking-wide active:scale-95 transition-transform cursor-pointer border-none"
                style={{
                  background: 'linear-gradient(135deg, #E91E63 0%, #FF2E93 100%)',
                  boxShadow: '0 6px 18px rgba(233,30,99,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
                }}
              >
                <ChevronRight size={15} strokeWidth={3} />
                <span>Ver</span>
              </button>
            </div>

            {/* Micro Details Row: Horario / Dirección */}
            {(selected.address || selected.startTime) && (
              <div className="pt-2 border-t border-(--border-subtle) flex items-center justify-between text-[11px] text-(--text-muted) font-medium">
                <span className="truncate max-w-[70%]">
                  📍 {selected.address || 'Ubicación física'}
                </span>
                {selected.startTime && selected.endTime && (
                  <span className="shrink-0 text-emerald-400 font-bold">
                    Abierto • {selected.startTime} - {selected.endTime}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hoja de Bunzy: las sugerencias viven aquí, no en el mapa */}
      {bunzyOpen && (
        <div
          className="absolute inset-0 z-50 flex items-end justify-center bg-black/50 p-4"
          onClick={() => setBunzyOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border p-4 shadow-2xl"
            style={{
              background: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl text-xl" style={{ background: 'linear-gradient(135deg, #E91E63 0%, #8E24AA 100%)' }}>
                🐰
              </div>
              <div>
                <p className="m-0 text-[15px] font-black" style={{ color: 'var(--text-primary)' }}>Bunzy</p>
                <p className="m-0 text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                  ¿Qué buscas hoy?
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '☕ Café cerca', query: 'Cafeterías cerca' },
                { label: '🔥 Más Bunz', query: 'Comercios con mayor cashback' },
                { label: '🍕 Dónde comer', query: 'Restaurantes y comida' },
                { label: '📍 Mi ubicación', query: 'Dónde estoy' },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    setBunzyOpen(false);
                    handleVoiceCommand(chip.query);
                  }}
                  className="rounded-2xl border px-3 py-3 text-left text-[12px] font-black active:scale-95 transition-transform"
                  style={{
                    background: 'var(--bg-subtle)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
