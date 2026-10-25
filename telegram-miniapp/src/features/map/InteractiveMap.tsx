'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Crosshair, Mic, MicOff, Sparkles, Navigation, MessageCircle, 
  ChevronUp, ChevronDown, Flame, Gift, Compass, Volume2, X 
} from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import { useTheme } from '@/contexts/ThemeContext';
import { RabbittyMap } from './nativeMapBridge';

// Free, open, high-performance OSM tiles without API Key restrictions or watermarks:
const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

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
  distance?: number;
  image?: string;
  imageUrl?: string;
  logoUrl?: string;
}

interface InteractiveMapProps {
  businesses: MapBusiness[];
  userLat?: number | null;
  userLng?: number | null;
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

export default function InteractiveMap({ businesses, userLat, userLng, onRequestLocation, isLocating }: InteractiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<L.Map | null>(null);
  const layerGroup = useRef<L.LayerGroup | null>(null);
  const userMarkerGroup = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [selected, setSelected] = useState<MapBusiness | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [activeMode, setActiveMode] = useState<string>('Todos');
  const [showAllFilters, setShowAllFilters] = useState<boolean>(true);
  
  // Bunzy Copilot Voice & Search State (Gemini-in-car style)
  const [isListening, setIsListening] = useState(false);
  const [copilotQuery, setCopilotQuery] = useState('');
  const [copilotReply, setCopilotReply] = useState<string | null>(null);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const isNativeIos = typeof window !== 'undefined' && PlatformBridge.isIos();
  const [nativeMapActive, setNativeMapActive] = useState(false);

  const router = useRouter();

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
  }, [isNativeIos]);

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
    // Mode Filter
    let modeMatch = true;
    if (activeMode === "bunz'in") {
      modeMatch = (b.givesBunz === true || b.gives_bunz === true);
    } else if (activeMode === "Stock") {
      modeMatch = (b.acceptsBunz === true || b.accepts_bunz === true);
    }

    // Category Filter
    let categoryMatch = true;
    if (activeCategory !== 'Todos') {
      const cat = (b.category || b.device || '').toLowerCase();
      categoryMatch = cat.includes(activeCategory.toLowerCase());
    }

    return modeMatch && categoryMatch;
  });

  // Check speech recognition capability
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSpeech = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
      setSpeechSupported(hasSpeech);
    }
  }, []);

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
    setIsProcessingVoice(true);
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

    setTimeout(() => {
      setIsProcessingVoice(false);
    }, 1500);
  }, [businesses, userLat, userLng, onRequestLocation, speakReply]);

  const toggleSpeechRecognition = () => {
    if (typeof window === 'undefined') return;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRec) {
      // Fallback: trigger quick prompt for text
      const manual = prompt('¿Qué spot o recompensa buscas? (ej: "Cafeterías cerca", "Mayor cashback")');
      if (manual) handleVoiceCommand(manual);
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'es-MX';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        PlatformBridge.hapticFeedback('medium');
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setIsListening(false);
        handleVoiceCommand(text);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
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

    // Leaflet dimension recalculations
    const t1 = setTimeout(() => map.invalidateSize(), 60);
    const t2 = setTimeout(() => map.invalidateSize(), 250);
    const t3 = setTimeout(() => map.invalidateSize(), 600);

    return () => { 
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      map.remove(); 
      mapInst.current = null; 
      tileLayerRef.current = null;
      userMarkerGroup.current = null;
      setMapReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Basemap switcher: True Cyber Dark vs Architectural Crisp Light with Overzooming support
  useEffect(() => {
    const map = mapInst.current;
    if (!map || !mapReady) return;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    const layer = isDark
      ? L.tileLayer(OSM_TILE_URL, {
          maxZoom: 20,
          className: 'rabbitty-dark-tiles',
          attribution: OSM_TILE_ATTR,
        })
      : L.tileLayer(OSM_TILE_URL, {
          maxZoom: 20,
          className: 'rabbitty-light-tiles',
          attribution: OSM_TILE_ATTR,
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

      {/* Top HUD: Status Pills & GPS Centering */}
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

        {/* Right Action: Locate Me GPS */}
        <div className="pointer-events-auto flex items-center gap-2">
          {!userLat && onRequestLocation && (
            <button
              type="button"
              onClick={onRequestLocation}
              disabled={isLocating}
              className="px-3 py-1.5 rounded-full text-[11px] font-black text-white flex items-center gap-1.5 border-none cursor-pointer shadow-lg active:scale-95 transition-all"
              style={{
                background: 'linear-gradient(135deg, #E91E63 0%, #D81B60 100%)',
                boxShadow: '0 4px 16px rgba(233,30,99,0.4)',
              }}
            >
              <span>{isLocating ? 'Buscando GPS…' : 'Activar GPS'}</span>
            </button>
          )}

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
            className="w-10 h-10 rounded-full flex items-center justify-center border cursor-pointer shadow-md backdrop-blur-xl active:scale-90 transition-transform"
            style={{
              background: userLat 
                ? (isDark ? 'rgba(13, 9, 20, 0.9)' : 'rgba(255, 255, 255, 0.95)') 
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
        </div>
      </div>

      {/* Bunzy Copilot Bar (Gemini in Car Style Assistant) */}
      <div 
        className="absolute z-20 inset-x-4 pointer-events-none"
        style={{ top: PlatformBridge.isTelegram() ? 64 : 66 }}
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
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-sm relative overflow-hidden"
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
                    type="text"
                    value={copilotQuery}
                    onChange={(e) => setCopilotQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && copilotQuery.trim()) {
                        handleVoiceCommand(copilotQuery.trim());
                      }
                    }}
                    placeholder='Bunzy Copilot: "¿A dónde vamos?"'
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
              className={`w-9 h-9 rounded-xl flex items-center justify-center border-none cursor-pointer transition-all active:scale-95 ${
                isListening ? 'bg-[#E91E63] text-white animate-pulse' : 'bg-(--bg-subtle) text-(--text-primary)'
              }`}
              title={speechSupported ? 'Hablar con Bunzy Copilot' : 'Escribir comando para Bunzy'}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} className="text-[#E91E63]" />}
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
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap bg-(--bg-subtle) hover:bg-[#E91E63]/15 text-(--text-secondary) hover:text-[#E91E63] border border-(--border-subtle) cursor-pointer transition-colors shrink-0"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Floating Filter Dock (Glassmorphism & Collapsible) */}
      <div 
        className="absolute z-20 inset-x-4 flex flex-col gap-2 transition-all duration-300 pointer-events-none"
        style={{ 
          bottom: selected ? 230 : (PlatformBridge.isTelegram() ? 28 : 20),
        }}
      >
        <div className="pointer-events-auto flex items-center justify-between">
          <button 
            type="button"
            onClick={() => {
              PlatformBridge.hapticFeedback('light');
              setShowAllFilters(!showAllFilters);
            }}
            className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-xl border flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-all"
            style={{
              background: isDark ? 'rgba(13, 9, 20, 0.88)' : 'rgba(255, 255, 255, 0.92)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
              color: 'var(--text-secondary)'
            }}
          >
            <span>{showAllFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}</span>
            {showAllFilters ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
        </div>

        {showAllFilters && (
          <div 
            className="pointer-events-auto p-2.5 rounded-3xl border shadow-2xl backdrop-blur-2xl flex flex-col gap-2 transition-all"
            style={{
              background: isDark ? 'rgba(13, 9, 20, 0.92)' : 'rgba(255, 255, 255, 0.95)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            }}
          >
            {/* Mode Selector Tabs: Todos / Bunz'in / Gasta */}
            <div className="flex gap-1.5 p-1 rounded-2xl bg-(--bg-subtle) border border-(--border-subtle)">
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
                  className={`flex-1 py-1.5 rounded-xl text-[10.5px] font-black uppercase tracking-wide border-none cursor-pointer transition-all ${
                    activeMode === m.id
                      ? 'bg-[#E91E63] text-white shadow-md scale-101'
                      : 'bg-transparent text-(--text-muted) hover:text-(--text-primary)'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Horizontal Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pt-0.5">
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
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap cursor-pointer transition-all border ${
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
        )}
      </div>

      {/* Selected Business Action Card (Floating HUD Card) */}
      {selected && (
        <div 
          className="absolute inset-x-4 z-30 max-w-md mx-auto"
          style={{ bottom: PlatformBridge.isTelegram() ? 28 : 20 }}
        >
          <div 
            onClick={() => router.push(`/affiliate/${selected.id}`)}
            className="p-4 rounded-3xl border shadow-2xl backdrop-blur-2xl flex items-center gap-3.5 cursor-pointer relative overflow-hidden transition-all active:scale-98"
            style={{
              background: isDark ? 'rgba(18, 12, 28, 0.95)' : 'rgba(255, 255, 255, 0.98)',
              borderColor: isDark ? 'rgba(233, 30, 99, 0.4)' : 'rgba(233, 30, 99, 0.25)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
            }}
          >
            {/* Business Logo / Emoji Avatar */}
            <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-(--border-subtle) bg-(--bg-subtle) flex items-center justify-center">
              {selected.logoUrl || selected.imageUrl ? (
                <img 
                  src={selected.logoUrl || selected.imageUrl} 
                  alt={selected.name || 'Comercio'} 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <span className="text-3xl">{getIcon(selected.category || selected.device)}</span>
              )}
            </div>

            {/* Info Column */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="m-0 text-base font-black truncate" style={{ color: 'var(--text-primary)' }}>
                  {selected.name || selected.user}
                </h3>
                
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(null);
                  }}
                  className="w-6 h-6 rounded-full bg-(--bg-subtle) hover:bg-[#E91E63]/20 flex items-center justify-center text-(--text-muted) hover:text-[#E91E63] border-none cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>

              <p className="m-0 text-xs font-semibold text-(--text-muted) mt-0.5 truncate">
                {selected.category || selected.device || 'Comercio Afiliado'} • A {selected.distance ? `${selected.distance} km` : 'Cerca de ti'}
              </p>

              {/* Rewards / Bunz Pills */}
              <div className="flex items-center gap-1.5 mt-2">
                {(selected.givesBunz !== false) && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-[#E91E63]/15 text-[#E91E63] border border-[#E91E63]/30 flex items-center gap-1">
                    <Flame size={12} className="fill-[#E91E63]" />
                    +{selected.reward_percentage || selected.rewardPercentage || 10}% Bunz
                  </span>
                )}
                {selected.acceptsBunz === true && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                    <Gift size={12} />
                    Stock
                  </span>
                )}
              </div>
            </div>

            {/* Navigation CTA icon */}
            <div className="w-10 h-10 rounded-2xl bg-[#E91E63] text-white flex items-center justify-center shrink-0 shadow-lg shadow-pink-500/30">
              <Navigation size={18} className="rotate-45" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
