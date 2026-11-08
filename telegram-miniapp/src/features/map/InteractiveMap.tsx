'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Crosshair, Mic, MicOff, Sparkles, Navigation, 
  Flame, Gift, Compass, X 
} from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import { useTheme } from '@/contexts/ThemeContext';
import { RabbittyMap } from './nativeMapBridge';

// High-performance OpenStreetMap raster tiles (Zero API key watermark, styled via dark filter)
const cartoKey = process.env.NEXT_PUBLIC_CARTO_KEY;
const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const DARK_MATTER_URL = cartoKey 
  ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${cartoKey}`
  : OSM_TILE_URL;
const LIGHT_POSITRON_URL = cartoKey
  ? `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${cartoKey}`
  : OSM_TILE_URL;
const MAP_TILE_ATTR = cartoKey
  ? '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export interface MapBusiness {
  id: string;
  name?: string;
  user?: string;
  category?: string;
  device?: string;
  address?: string;
  lat?: string | number | null;
  lng?: string | number | null;
  rewardPercentage?: number;
  reward_percentage?: number;
  acceptsBunz?: boolean;
  accepts_bunz?: boolean;
  givesBunz?: boolean;
  gives_bunz?: boolean;
  hasStockOffer?: boolean;
  bunzBalance?: number;
  distance?: number;
  image?: string;
  imageUrl?: string;
  logoUrl?: string;
  startTime?: string;
  endTime?: string;
}

interface InteractiveMapProps {
  businesses: MapBusiness[];
  userLat?: number | null;
  userLng?: number | null;
  accuracy?: number | null;
  locationTimestamp?: number | null;
  onRequestLocation?: () => void;
  isLocating?: boolean;
}

const RARITY = {
  common:    { color:"#7EC8E3", label:"Común",      ring:"#7EC8E355" },
  rare:      { color:"#B57BEE", label:"Raro",       ring:"#B57BEE55" },
  epic:      { color:"#FF4D8D", label:"Épico",      ring:"#FF4D8D66" },
  legendary: { color:"#FFD166", label:"Legendario", ring:"#FFD16666" },
} as const;

type RarityKey = keyof typeof RARITY;

function getRarity(bunz: number): RarityKey {
  if (bunz >= 15) return "legendary";
  if (bunz >= 10) return "epic";
  if (bunz >= 5)  return "rare";
  return "common";
}

function getIcon(category?: string) {
  const cat = category?.toLowerCase() || '';
  if (cat.includes('caf')) return '☕';
  if (cat.includes('restaurante') || cat.includes('comida') || cat.includes('pizz')) return '🍕';
  if (cat.includes('fit') || cat.includes('gym')) return '💪';
  if (cat.includes('tech') || cat.includes('tecno')) return '💻';
  if (cat.includes('belleza') || cat.includes('spa') || cat.includes('barber')) return '✨';
  if (cat.includes('bar') || cat.includes('copas')) return '🍸';
  return '🛍️';
}

function markerHTML(a: MapBusiness, selected: boolean, isDark: boolean) {
  const rw = a.rewardPercentage || a.reward_percentage || 0;
  const isStockOnly = (a.acceptsBunz || a.accepts_bunz) && !(a.givesBunz || a.gives_bunz);
  const r = isStockOnly ? { color: "#E91E63", label: "Stock" } : RARITY[getRarity(rw)];
  const sz = selected ? 52 : 44;
  const glowSize = selected
    ? `0 0 0 3px ${isDark ? '#0D0914' : '#FFFFFF'}, 0 0 18px ${r.color}, 0 0 32px ${r.color}77`
    : `0 0 0 2px ${isDark ? '#0D0914' : '#FFFFFF'}, 0 0 10px ${r.color}88, 0 0 18px ${r.color}33`;
  const scale = selected ? "scale(1.15)" : "scale(1)";
  const icon = isStockOnly ? '🎁' : getIcon(a.category || a.device);
  
  const badgeHtml = isStockOnly 
    ? `<div style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);background:#E91E63;color:#fff;font-size:9px;font-weight:900;padding:2px 8px;border-radius:100px;white-space:nowrap;letter-spacing:.3px;box-shadow:0 2px 10px rgba(233,30,99,0.5)">STOCK</div>`
    : `<div style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);background:${r.color};color:${getRarity(rw)==='legendary'?'#111':'#0D0D1A'};font-size:9px;font-weight:900;padding:2px 8px;border-radius:100px;white-space:nowrap;letter-spacing:.3px;box-shadow:0 2px 10px ${r.color}88">+${rw}%</div>`;

  return `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:${scale};transition:transform 0.25s cubic-bezier(.34,1.56,.64,1)">
      ${badgeHtml}
      <div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${isDark ? 'linear-gradient(145deg,#1E142B,#0F0A18)' : '#FFFFFF'};display:flex;align-items:center;justify-content:center;font-size:${selected?22:18}px;box-shadow:${glowSize};border:2px solid ${r.color};transition:all .25s">
        ${icon}
      </div>
      <div style="width:2px;height:9px;background:linear-gradient(${r.color},transparent);margin-top:-1px"></div>
      <div style="width:6px;height:6px;border-radius:50%;background:${r.color};box-shadow:0 0 8px ${r.color};margin-top:-2px"></div>
    </div>`;
}

function userMarkerHTML() {
  return `
    <div style="position:relative;width:28px;height:28px">
      <div class="radar-sweep"></div>
      <div style="position:absolute;inset:0;border-radius:50%;background:#E91E63;border:3px solid #fff;box-shadow:0 0 0 2px #E91E63,0 0 24px #E91E63aa;z-index:2"></div>
      <div class="rb-pulse rb-pulse-1"></div>
      <div class="rb-pulse rb-pulse-2"></div>
      <div class="rb-pulse rb-pulse-3"></div>
    </div>`;
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
  const mapInst = useRef<L.Map | null>(null);
  const layerGroup = useRef<L.LayerGroup | null>(null);
  const userMarkerGroup = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const affiliateParam = searchParams?.get('affiliate');

  const [selected, setSelected] = useState<MapBusiness | null>(() => {
    if (!affiliateParam || !businesses || businesses.length === 0) return null;
    return businesses.find(b => b.id === affiliateParam) || null;
  });
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [activeMode, setActiveMode] = useState<string>('Todos');
  
  // Bunzy Copilot Voice & Search State (Gemini-in-car style)
  const [isListening, setIsListening] = useState(false);
  const [copilotQuery, setCopilotQuery] = useState('');
  const [copilotReply, setCopilotReply] = useState<string | null>(null);
  const speechSupported = typeof window !== 'undefined' && (
    PlatformBridge.isNative() ||
    'webkitSpeechRecognition' in window ||
    'SpeechRecognition' in window
  );
  const isNativeIos = typeof window !== 'undefined' && PlatformBridge.isIos();
  const [nativeMapActive, setNativeMapActive] = useState(false);

  const router = useRouter();

  // Centrar el mapa al cargar si viene un afiliado específico en la URL
  useEffect(() => {
    if (!affiliateParam || businesses.length === 0) return;
    const target = businesses.find(b => b.id === affiliateParam);
    if (target && target.lat && target.lng && mapInst.current) {
      mapInst.current.flyTo([Number(target.lat), Number(target.lng)], 16.5, { duration: 1.2 });
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

  // Filter businesses
  const filteredBusinesses = businesses.filter(b => {
    // Mode Filter:
    // En bunz'in: se muestran todos los negocios que dan recompensas (visita y acumulación)
    // En Stock: SOLO se muestran los negocios que realmente tienen stock fondeado y disponible para canjear
    let modeMatch = true;
    if (activeMode === "bunz'in") {
      modeMatch = (b.givesBunz === true || b.gives_bunz === true);
    } else if (activeMode === "Stock") {
      const hasBalance = typeof b.bunzBalance === 'number' ? b.bunzBalance >= 5 : false;
      modeMatch = (b.hasStockOffer === true || ((b.acceptsBunz === true || b.accepts_bunz === true) && hasBalance));
    }

    // Category Filter
    let categoryMatch = true;
    if (activeCategory !== 'Todos') {
      const cat = (b.category || b.device || '').toLowerCase();
      categoryMatch = cat.includes(activeCategory.toLowerCase());
    }

    return modeMatch && categoryMatch;
  });



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
      if (cafe && cafe.lat && cafe.lng && mapInst.current) {
        const reply = `Encontré ${cafe.name || 'Cafetería'} en tu zona con cashback en Bunz ☕`;
        setCopilotReply(reply);
        speakReply(reply);
        mapInst.current.flyTo([Number(cafe.lat), Number(cafe.lng)], 16, { duration: 1.2 });
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
      if (topBiz && topBiz.lat && topBiz.lng && mapInst.current) {
        const reply = `El spot con más cashback es ${topBiz.name || 'afiliado'} con +${topBiz.rewardPercentage ?? 0}% Bunz 🔥`;
        setCopilotReply(reply);
        speakReply(reply);
        mapInst.current.flyTo([Number(topBiz.lat), Number(topBiz.lng)], 16.5, { duration: 1.2 });
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
      if (food && food.lat && food.lng && mapInst.current) {
        const reply = `Filtrando opciones de comida. Te muestro ${food.name || 'restaurante'} 🍕`;
        setCopilotReply(reply);
        speakReply(reply);
        mapInst.current.flyTo([Number(food.lat), Number(food.lng)], 16, { duration: 1.2 });
        setSelected(food);
      } else {
        const reply = 'No encontré restaurantes afiliados activos en esta área 🍕';
        setCopilotReply(reply);
        speakReply(reply);
      }
    }
    // Command 4: Mi ubicación / llévame a donde estoy
    else if (lower.includes('dónde estoy') || lower.includes('mi ubicación') || lower.includes('aqui') || lower.includes('aquí')) {
      if (userLat && userLng && mapInst.current) {
        const reply = 'Centrando el radar en tu ubicación actual 📍';
        setCopilotReply(reply);
        speakReply(reply);
        mapInst.current.flyTo([userLat, userLng], 16.5, { duration: 1 });
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
      if (match && match.lat && match.lng && mapInst.current) {
        const distText = match.distance ? `a ${match.distance} km` : 'en el mapa';
        const reply = `Encontré ${match.name} ${distText} 🐰`;
        setCopilotReply(reply);
        speakReply(reply);
        mapInst.current.flyTo([Number(match.lat), Number(match.lng)], 16.5, { duration: 1.2 });
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
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const text = event.results?.[0]?.[0]?.transcript;
        setIsListening(false);
        if (text) handleVoiceCommand(text);
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
        setIsListening(false);
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

  // Map Initialization — runs ONCE on mount
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    
    const fallbackLat = businesses.length > 0 && businesses[0].lat ? Number(businesses[0].lat) : 25.7275;
    const fallbackLng = businesses.length > 0 && businesses[0].lng ? Number(businesses[0].lng) : -100.312;

    const centerLat = userLat != null ? userLat : fallbackLat;
    const centerLng = userLng != null ? userLng : fallbackLng;

    const map = L.map(mapRef.current, {
      center: [centerLat, centerLng],
      zoom: 15,
      minZoom: 4,
      maxZoom: 21,
      zoomControl: false,
      attributionControl: false,
    });

    layerGroup.current = L.layerGroup().addTo(map);
    userMarkerGroup.current = L.layerGroup().addTo(map);
    mapInst.current = map;
    setMapReady(true);
    
    map.on('click', () => setSelected(null));

    // Observe container resizing (prevents white screen glitch on tab/view switch)
    let ro: ResizeObserver | null = null;
    if (mapRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        if (mapInst.current) {
          mapInst.current.invalidateSize();
        }
      });
      ro.observe(mapRef.current);
    }

    // Leaflet dimension recalculations
    const t1 = setTimeout(() => map.invalidateSize(), 60);
    const t2 = setTimeout(() => map.invalidateSize(), 200);
    const t3 = setTimeout(() => map.invalidateSize(), 500);
    const t4 = setTimeout(() => map.invalidateSize(), 1000);

    return () => { 
      if (ro) ro.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      map.remove(); 
      mapInst.current = null; 
      tileLayerRef.current = null;
      userMarkerGroup.current = null;
      setMapReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Basemap switcher: True Cyber Dark Matter vs Crisp Positron Light with Overzooming support
  useEffect(() => {
    const map = mapInst.current;
    if (!map || !mapReady) return;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    const layer = isDark
      ? L.tileLayer(DARK_MATTER_URL, {
          subdomains: cartoKey ? 'abcd' : 'abc',
          maxZoom: 19,
          className: 'rabbitty-dark-tiles',
          attribution: MAP_TILE_ATTR,
        })
      : L.tileLayer(LIGHT_POSITRON_URL, {
          subdomains: cartoKey ? 'abcd' : 'abc',
          maxZoom: 19,
          className: 'rabbitty-light-tiles',
          attribution: MAP_TILE_ATTR,
        });
    layer.addTo(map);
    layer.bringToBack();
    tileLayerRef.current = layer;
  }, [isDark, mapReady]);

  // Reactive user marker and centering
  useEffect(() => {
    const map = mapInst.current;
    const group = userMarkerGroup.current;
    if (!map || !group) return;

    group.clearLayers();

    if (userLat != null && userLng != null) {
      const uIcon = L.divIcon({ html: userMarkerHTML(), className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
      L.marker([userLat, userLng], { icon: uIcon, zIndexOffset: 2000 }).addTo(group);

      L.circle([userLat, userLng], {
        radius: 90,
        color: '#E91E63',
        fillColor: '#E91E63',
        fillOpacity: isDark ? 0.06 : 0.1,
        weight: 1.5,
        dashArray: '3 5',
      }).addTo(group);

      map.flyTo([userLat, userLng], 15.5, { duration: 1.2 });
    }
  }, [userLat, userLng, isDark]);

  // Render Business Markers with theme awareness
  useEffect(() => {
    const map = mapInst.current;
    const group = layerGroup.current;
    if (!map || !group) return;
    group.clearLayers();

    filteredBusinesses.forEach(b => {
      if (!b.lat || !b.lng) return;
      const lat = Number(b.lat);
      const lng = Number(b.lng);

      const isStockOnly = (b.acceptsBunz || b.accepts_bunz) && !(b.givesBunz || b.gives_bunz);
      const rw = b.rewardPercentage || b.reward_percentage || 0;
      const r = isStockOnly ? { color: "#E91E63", label: "Stock" } : RARITY[getRarity(rw)];
      const isSel = selected?.id === b.id;

      L.circle([lat, lng], {
        radius: isSel ? 100 : 70,
        color: r.color, 
        fillColor: r.color,
        fillOpacity: isSel ? (isDark ? 0.14 : 0.18) : (isDark ? 0.05 : 0.08),
        weight: isSel ? 1.5 : 1,
        dashArray: isSel ? undefined : '4 6',
      }).addTo(group);

      const icon = L.divIcon({ html: markerHTML(b, isSel, isDark), className:'', iconSize:[64,80], iconAnchor:[32,80] });
      L.marker([lat, lng], { icon, zIndexOffset: isSel ? 1500 : 800 })
        .addTo(group)
        .on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e.originalEvent);
          PlatformBridge.hapticFeedback('light');
          setSelected((prev) => prev?.id === b.id ? null : b);
          map.panTo([lat - 0.0018, lng], { animate:true, duration:0.5 });
        });
    });
  }, [filteredBusinesses, selected, isDark]);

  const totalBunzInZone = filteredBusinesses.reduce((sum, b) => sum + (b.rewardPercentage || b.reward_percentage || 0), 0);

  return (
    <div 
      className="w-full h-full relative overflow-hidden select-none" 
      style={{ background: isDark ? '#0D0914' : '#F8FAFC' }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        .leaflet-container {
          background: ${isDark ? '#08050E' : '#F8F9FA'} !important;
          outline: none;
        }
        .rabbitty-dark-tiles {
          filter: brightness(0.72) contrast(1.18) saturate(0.78) hue-rotate(-10deg);
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

      {/* Leaflet Map Canvas (oculto / transparente solo si MapKit nativo está verdaderamente activo) */}
      <div 
        ref={mapRef} 
        className={`absolute inset-0 z-0 transition-opacity duration-300 ${nativeMapActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} 
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
                if (mapInst.current) {
                  mapInst.current.flyTo([userLat, userLng], 16.5, { duration: 1 });
                }
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

      {/* Bunzy Copilot Floating Search Bar (Apple/Google Maps style search input) */}
      <div 
        className="absolute z-20 inset-x-4 pointer-events-none"
        style={{ top: PlatformBridge.isTelegram() ? 56 : 58 }}
      >
        <div 
          className="pointer-events-auto rounded-2xl border shadow-xl backdrop-blur-2xl p-2.5 transition-all"
          style={{
            background: isDark ? 'rgba(18, 12, 28, 0.92)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: isListening ? '#E91E63' : (isDark ? 'rgba(233, 30, 99, 0.3)' : 'rgba(233, 30, 99, 0.2)'),
            boxShadow: isListening 
              ? '0 0 24px rgba(233, 30, 99, 0.35)' 
              : '0 8px 32px rgba(0, 0, 0, 0.12)',
          }}
        >
          <div className="flex items-center gap-2.5">
            {/* Bunzy Avatar with Pulsing Halo */}
            <div 
              className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 shadow-sm relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #E91E63 0%, #8E24AA 100%)',
              }}
            >
              <span>🐰</span>
              {isListening && (
                <div className="absolute inset-0 bg-[#E91E63]/30 animate-ping rounded-xl" />
              )}
            </div>

            {/* Input or Voice Feedback text */}
            <div className="flex-1 min-w-0">
              {copilotReply ? (
                <p className="m-0 text-xs font-bold truncate text-[#E91E63] flex items-center gap-1.5 animate-fadeIn">
                  <Sparkles size={13} className="shrink-0" />
                  <span>{copilotReply}</span>
                </p>
              ) : isListening ? (
                <p className="m-0 text-xs font-bold truncate text-[#E91E63] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#E91E63] animate-ping" />
                  <span>Escuchando... &ldquo;Café cerca&rdquo;, &ldquo;Más Bunz&rdquo;</span>
                </p>
              ) : (
                <div className="flex items-center">
                  <input
                    ref={copilotInputRef}
                    type="text"
                    value={copilotQuery}
                    onChange={(e) => setCopilotQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && copilotQuery.trim()) {
                        handleVoiceCommand(copilotQuery.trim());
                      }
                    }}
                    placeholder='Pregunta a Bunzy: "¿A dónde vamos?"'
                    className="w-full bg-transparent border-none outline-none text-xs font-semibold placeholder:text-(--text-muted)"
                    style={{ color: 'var(--text-primary)' }}
                  />
                </div>
              )}
            </div>

            {/* Mic Button (Voice Assistant Command) */}
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className={`w-8 h-8 rounded-xl flex items-center justify-center border-none cursor-pointer transition-all active:scale-95 ${
                isListening ? 'bg-[#E91E63] text-white animate-pulse' : 'bg-(--bg-subtle) text-(--text-primary)'
              }`}
              title={speechSupported ? 'Hablar con Bunzy Copilot' : 'Escribir comando para Bunzy'}
            >
              {isListening ? <MicOff size={15} /> : <Mic size={15} className="text-[#E91E63]" />}
            </button>
          </div>

          {/* Quick Voice Prompt Shortcuts */}
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-(--border-subtle) overflow-x-auto hide-scrollbar">
            {[
              { label: '☕ Café cerca', query: 'Cafeterías cerca' },
              { label: '🔥 Más Bunz', query: 'Comercios con mayor cashback' },
              { label: '🍕 Dónde comer', query: 'Restaurantes y comida' },
              { label: '📍 Mi ubicación', query: 'Dónde estoy' },
            ].map((chip) => (
              <button
                key={chip.label}
                onClick={() => handleVoiceCommand(chip.query)}
                className="px-2 py-0.5 rounded-lg text-[9.5px] font-bold whitespace-nowrap bg-(--bg-subtle) hover:bg-[#E91E63]/15 text-(--text-secondary) hover:text-[#E91E63] border border-(--border-subtle) cursor-pointer transition-colors shrink-0"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Floating Map Controls (Google Maps / Apple Maps Style) */}
      <div 
        className="absolute right-4 z-20 flex flex-col gap-2.5 pointer-events-auto"
        style={{ top: PlatformBridge.isTelegram() ? 175 : 180 }}
      >
        {/* Locate Me GPS Button */}
        <button 
          type="button"
          onClick={() => {
            PlatformBridge.hapticFeedback('light');
            if (userLat && userLng && mapInst.current) {
              mapInst.current.flyTo([userLat, userLng], 16.5, { duration: 1 });
            } else if (onRequestLocation) {
              onRequestLocation();
            }
          }}
          className="w-10 h-10 rounded-2xl flex items-center justify-center border cursor-pointer shadow-lg backdrop-blur-xl active:scale-90 transition-transform"
          style={{
            background: userLat 
              ? (isDark ? 'rgba(18, 12, 28, 0.92)' : 'rgba(255, 255, 255, 0.95)') 
              : 'rgba(233,30,99,0.18)',
            borderColor: userLat 
              ? (isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)') 
              : '#E91E63',
            color: userLat ? (isDark ? '#FFFFFF' : '#111111') : '#E91E63',
          }}
          title={userLat ? "Centrar en mi ubicación" : "Activar GPS"}
        >
          <Crosshair size={18} className={isLocating ? 'animate-spin' : ''} />
        </button>

        {/* Compass / Recenter Spots Button */}
        <button 
          type="button"
          onClick={() => {
            PlatformBridge.hapticFeedback('light');
            if (filteredBusinesses.length > 0 && mapInst.current) {
              const bounds = L.latLngBounds(
                filteredBusinesses
                  .filter(b => b.lat != null && b.lng != null)
                  .map(b => [Number(b.lat), Number(b.lng)] as [number, number])
              );
              if (bounds.isValid()) {
                mapInst.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
              }
            }
          }}
          className="w-10 h-10 rounded-2xl flex items-center justify-center border cursor-pointer shadow-lg backdrop-blur-xl active:scale-90 transition-transform"
          style={{
            background: isDark ? 'rgba(18, 12, 28, 0.92)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
            color: 'var(--text-primary)',
          }}
          title="Ver todos los spots"
        >
          <Compass size={18} />
        </button>
      </div>

      {/* Selected Business Action Card (Positioned cleanly ABOVE the bottom filter dock) */}
      {selected && (
        <div 
          className="absolute inset-x-3 z-30 max-w-md mx-auto pointer-events-auto animate-fadeIn transition-all duration-300"
          style={{ bottom: PlatformBridge.isTelegram() ? 116 : 108 }}
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
                  const query = encodeURIComponent(`${selected.name || ''} ${selected.address || ''}`);
                  window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                }}
                title="Abrir en Google Maps"
                className="shrink-0 h-10 pl-3 pr-3.5 rounded-full flex items-center gap-1.5 text-white font-black text-[11px] tracking-wide active:scale-95 transition-transform cursor-pointer border-none"
                style={{
                  background: 'linear-gradient(135deg, #E91E63 0%, #FF2E93 100%)',
                  boxShadow: '0 6px 18px rgba(233,30,99,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
                }}
              >
                <Navigation size={14} className="rotate-45" strokeWidth={2.6} />
                <span>Ir</span>
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

      {/* Bottom Floating Filter Dock (Always Stays in Place at the Bottom) */}
      <div 
        className="absolute z-20 inset-x-4 flex flex-col gap-2 pointer-events-none transition-all duration-300"
        style={{ 
          bottom: PlatformBridge.isTelegram() ? 24 : 18,
        }}
      >
        <div 
          className="pointer-events-auto p-2 rounded-2xl border shadow-xl backdrop-blur-2xl flex flex-col gap-1.5"
          style={{
            background: isDark ? 'rgba(13, 9, 20, 0.92)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          {/* Mode Selector Tabs: Todos / Gana Bunz / Gasta Bunz */}
          <div className="flex gap-1 p-0.5 rounded-xl bg-(--bg-subtle) border border-(--border-subtle)">
            {[
              { id: 'Todos', label: 'Todos' },
              { id: "bunz'in", label: 'Gana Bunz' },
              { id: 'Stock', label: 'Gasta Bunz' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  PlatformBridge.hapticFeedback('light');
                  setActiveMode(m.id);
                }}
                className={`flex-1 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border-none cursor-pointer transition-all ${
                  activeMode === m.id
                    ? 'bg-[#E91E63] text-white shadow-xs'
                    : 'bg-transparent text-(--text-muted) hover:text-(--text-primary)'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Horizontal Category Chips */}
          <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar">
            {[
              { id: 'Todos', label: 'Todos', icon: '🌐' },
              { id: 'Cafetería', label: 'Cafés', icon: '☕' },
              { id: 'Restaurante', label: 'Gastro', icon: '🍕' },
              { id: 'Bar', label: 'Copas', icon: '🍸' },
              { id: 'Fitness', label: 'Fitness', icon: '💪' },
              { id: 'Belleza', label: 'Belleza', icon: '✨' },
            ].map((cat) => {
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    setActiveCategory(cat.id);
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold whitespace-nowrap cursor-pointer transition-all border ${
                    active
                      ? 'bg-(--text-primary) text-(--bg-primary) border-transparent shadow-xs'
                      : 'bg-(--bg-subtle) text-(--text-muted) border-(--border-subtle) hover:text-(--text-primary)'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
