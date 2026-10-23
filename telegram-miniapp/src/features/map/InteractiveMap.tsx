'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import { useTheme } from '@/contexts/ThemeContext';

// Keyless, no-watermark basemaps. Dark = Esri World Dark Gray Base (calles
// mínimas, sin POIs ni etiquetas). Light = OSM estándar (blanco).
const DARK_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const DARK_TILE_ATTR = 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>';
const LIGHT_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const LIGHT_TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

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
  if (bunz >= 15) return "legendary"; // Adjusted for realistic percentages (15%+)
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
  if (cat.includes('belleza') || cat.includes('spa')) return '✨';
  return '🛍️';
}

function markerHTML(a: MapBusiness, selected: boolean) {
  const rw = a.rewardPercentage || a.reward_percentage || 0;
  const isStockOnly = (a.acceptsBunz || a.accepts_bunz) && !(a.givesBunz || a.gives_bunz);
  const r = isStockOnly ? { color: "#E91E63", label: "Stock" } : RARITY[getRarity(rw)];
  const sz = selected ? 54 : 46;
  const glowSize = selected
    ? `0 0 0 3px #0D0D1A, 0 0 18px ${r.color}, 0 0 36px ${r.color}77`
    : `0 0 0 2px #0D0D1A, 0 0 10px ${r.color}99, 0 0 22px ${r.color}44`;
  const scale = selected ? "scale(1.18)" : "scale(1)";
  const icon = isStockOnly ? '🎁' : getIcon(a.category || a.device);
  
  const badgeHtml = isStockOnly 
    ? `<div style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);background:#E91E63;color:#fff;font-size:9px;font-weight:900;padding:2px 8px;border-radius:100px;white-space:nowrap;letter-spacing:.3px;box-shadow:0 2px 10px rgba(233,30,99,0.5)">STOCK</div>`
    : `<div style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);background:${r.color};color:${getRarity(rw)==='legendary'?'#111':'#0D0D1A'};font-size:9px;font-weight:900;padding:2px 8px;border-radius:100px;white-space:nowrap;font-family:var(--font-family-base, sans-serif);letter-spacing:.3px;box-shadow:0 2px 10px ${r.color}88">+${rw}%</div>`;

  return `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:${scale};transition:transform 0.25s cubic-bezier(.34,1.56,.64,1)">
      ${badgeHtml}
      <div style="width:${sz}px;height:${sz}px;border-radius:50%;background:linear-gradient(145deg,#1A1A2E,#0D0D1A);display:flex;align-items:center;justify-content:center;font-size:${selected?22:18}px;box-shadow:${glowSize};border:2px solid ${r.color};transition:all .25s">
        ${icon}
      </div>
      <div style="width:2px;height:9px;background:linear-gradient(${r.color},transparent);margin-top:-1px"></div>
      <div style="width:6px;height:6px;border-radius:50%;background:${r.color};box-shadow:0 0 8px ${r.color};margin-top:-2px"></div>
    </div>`;
}

function userMarkerHTML() {
  return `
    <div style="position:relative;width:26px;height:26px">
      <!-- Radar Sweep tied to the marker -->
      <div class="radar-sweep"></div>
      
      <div style="position:absolute;inset:0;border-radius:50%;background:#E91E63;border:3px solid #fff;box-shadow:0 0 0 2px #E91E63,0 0 20px #E91E6388;z-index:2"></div>
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
  const [activeRarity, setActiveRarity] = useState<string>('ALL');
  const [activeMode, setActiveMode] = useState<string>('Todos');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [showAllFilters, setShowAllFilters] = useState<boolean>(true);
  const router = useRouter();

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

    // Rarity Filter
    let rarityMatch = true;
    if (activeRarity !== 'ALL') {
      const rw = b.rewardPercentage || b.reward_percentage || 0;
      const r = getRarity(rw);
      rarityMatch = (r === activeRarity);
    }

    return modeMatch && categoryMatch && rarityMatch;
  });

  // Radar sweep RAF removed since we use CSS animation now

  // Map Initialization — runs ONCE on mount
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    
    // Default to first business location if no user location, else fallback to Monterrey
    const fallbackLat = businesses.length > 0 && businesses[0].lat ? Number(businesses[0].lat) : 25.7275;
    const fallbackLng = businesses.length > 0 && businesses[0].lng ? Number(businesses[0].lng) : -100.312;

    const centerLat = userLat != null ? userLat : fallbackLat;
    const centerLng = userLng != null ? userLng : fallbackLng;

    const map = L.map(mapRef.current, {
      center: [centerLat, centerLng],
      zoom: 15,
      zoomControl: false,
      attributionControl: true,
    });

    // Basemap se agrega/actualiza en el efecto dependiente del tema (dark/light).

    layerGroup.current = L.layerGroup().addTo(map);
    userMarkerGroup.current = L.layerGroup().addTo(map);
    mapInst.current = map;
    setMapReady(true);
    
    map.on('click', () => setSelected(null));
    
    return () => { 
      map.remove(); 
      mapInst.current = null; 
      tileLayerRef.current = null;
      userMarkerGroup.current = null;
      setMapReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Initialize only once — don't re-init on coord change

  // Basemap — se recrea cuando cambia el tema (dark = Esri gris oscuro, light = OSM)
  useEffect(() => {
    const map = mapInst.current;
    if (!map || !mapReady) return;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    const layer = isDark
      ? L.tileLayer(DARK_TILE_URL, { maxZoom: 19, attribution: DARK_TILE_ATTR })
      : L.tileLayer(LIGHT_TILE_URL, { maxZoom: 19, subdomains: ['a', 'b', 'c'], attribution: LIGHT_TILE_ATTR });
    layer.addTo(map);
    layer.bringToBack();
    tileLayerRef.current = layer;
  }, [isDark, mapReady]);

  // Actualiza reactivamente el pin del usuario y centra el mapa
  useEffect(() => {
    const map = mapInst.current;
    const group = userMarkerGroup.current;
    if (!map || !group) return;

    group.clearLayers();

    if (userLat != null && userLng != null) {
      const uIcon = L.divIcon({ html: userMarkerHTML(), className: '', iconSize: [26, 26], iconAnchor: [13, 13] });
      L.marker([userLat, userLng], { icon: uIcon, zIndexOffset: 2000 }).addTo(group);

      L.circle([userLat, userLng], {
        radius: 90,
        color: '#E91E63',
        fillColor: '#E91E63',
        fillOpacity: 0.05,
        weight: 1,
        dashArray: '3 5',
      }).addTo(group);

      map.flyTo([userLat, userLng], 15.5, { duration: 1.2 });
    }
  }, [userLat, userLng]);

  // Render Business Markers
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

      // Radius of influence
      L.circle([lat, lng], {
        radius: isSel ? 100 : 70,
        color: r.color, fillColor: r.color,
        fillOpacity: isSel ? 0.12 : 0.06,
        weight: isSel ? 1.5 : 1,
        dashArray: isSel ? undefined : '4 6',
      }).addTo(group);

      const icon = L.divIcon({ html: markerHTML(b, isSel), className:'', iconSize:[64,80], iconAnchor:[32,80] });
      L.marker([lat, lng], { icon, zIndexOffset: isSel ? 1500 : 800 })
        .addTo(group)
        .on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e.originalEvent);
          setSelected((prev) => prev?.id === b.id ? null : b);
          map.panTo([lat - 0.0018, lng], { animate:true, duration:0.5 });
        });
    });
  }, [filteredBusinesses, selected]);

  return (
    <div className="w-full h-full relative" style={{ background: 'var(--bg-subtle)' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .rb-pulse {
          position: absolute;
          border-radius: 50%;
          background: rgba(233, 30, 99, 0.35);
          animation: rb-beacon 2.4s ease-out infinite;
        }
        .rb-pulse-1 { width:52px; height:52px; top:-13px; left:-13px; }
        .rb-pulse-2 { width:52px; height:52px; top:-13px; left:-13px; animation-delay: 0.8s; }
        .rb-pulse-3 { width:52px; height:52px; top:-13px; left:-13px; animation-delay: 1.6s; }
        @keyframes rb-beacon {
          0%   { transform: scale(0.4); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0;   }
        }
        @keyframes radar-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        .radar-sweep {
          position: absolute;
          top: 13px; left: 13px;
          width: 800px; height: 800px;
          background: conic-gradient(from 0deg, transparent 70%, rgba(233,30,99,0.05) 95%, rgba(233,30,99,0.4) 100%);
          border-radius: 50%;
          animation: radar-spin 3s linear infinite;
          pointer-events: none;
          z-index: 0;
          mix-blend-mode: screen;
        }
      `}} />

      {/* Hex grid overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none" style={{
        backgroundImage: `repeating-linear-gradient(60deg,rgba(233,30,99,0.04) 0px,rgba(233,30,99,0.04) 1px,transparent 1px,transparent 30px),
                          repeating-linear-gradient(120deg,rgba(233,30,99,0.04) 0px,rgba(233,30,99,0.04) 1px,transparent 1px,transparent 30px),
                          repeating-linear-gradient(0deg,rgba(233,30,99,0.04) 0px,rgba(233,30,99,0.04) 1px,transparent 1px,transparent 30px)`
      }} />

      {/* Radar Sweep is now inside the marker HTML */}

      <div ref={mapRef} className="absolute inset-0 z-0" />

      {/* Mode Filters (Todos / bunz'in / Stock) - Collapsible Div */}
      {showAllFilters ? (
        <div style={{ position: 'absolute', bottom: selected ? 230 : (PlatformBridge.isTelegram() ? 40 : 24), left: 16, right: 16, zIndex: 2000, display: 'flex', flexDirection: 'column', gap: 10, transition: 'bottom 0.3s' }}>
          
          {/* Toggle Filters Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button 
              onClick={() => setShowAllFilters(false)}
              style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, cursor: 'pointer', transition: 'all 0.2s' }}
              title="Ocultar Filtros"
            >
              ▼
            </button>
            
            <button 
              onClick={() => setShowFilters(!showFilters)}
              style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 999, padding: '4px 10px', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {showFilters ? 'Ocultar Filtros 🔽' : 'Filtros Avanzados ⚙️'}
            </button>
          </div>

          {/* Collapsible Filters: Rarity & Category */}
          {showFilters && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(0,0,0,0.4)', borderRadius: 16, padding: 12, backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }} className="no-scrollbar">
                {[
                  { id: 'ALL', label: 'TODOS', icon: '' },
                  { id: 'common', label: 'COMÚN', icon: '🔵' },
                  { id: 'rare', label: 'RARO', icon: '🟣' },
                  { id: 'epic', label: 'ÉPICO', icon: '🔴' },
                  { id: 'legendary', label: 'LEGENDARIO', icon: '🟡' },
                ].map(r => (
                  <button
                    key={r.id}
                    onClick={() => setActiveRarity(r.id)}
                    style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: 800, border: '1px solid rgba(255,255,255,0.1)', background: activeRarity === r.id ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.6)', color: activeRarity === r.id ? '#fff' : 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    {r.icon && <span>{r.icon}</span>} {r.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }} className="no-scrollbar">
                {['Todos', 'Cafetería', 'Restaurante', 'Bar', 'Fitness', 'Tecnología'].map(c => (
                  <button
                    key={c}
                    onClick={() => setActiveCategory(c)}
                    style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: activeCategory === c ? '#fff' : 'rgba(0,0,0,0.6)', color: activeCategory === c ? '#111' : '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }} className="no-scrollbar">
            {['Todos', "bunz'in", 'Stock'].map(mode => (
              <button
                key={mode}
                onClick={() => setActiveMode(mode)}
                style={{ 
                  flex: 1, padding: '8px 10px', borderRadius: 14, fontSize: 11, fontWeight: 800, textAlign: 'center',
                  background: activeMode === mode ? 'linear-gradient(135deg, #E91E63 0%, #FF4D8D 100%)' : 'rgba(13, 13, 26, 0.85)',
                  color: activeMode === mode ? '#fff' : '#aaa',
                  border: `1px solid ${activeMode === mode ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: activeMode === mode ? '0 4px 16px rgba(233,30,99,0.4), inset 0 1px 1px rgba(255,255,255,0.3)' : 'none',
                  backdropFilter: 'blur(12px)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5
                }}
              >
                {mode === 'Stock' ? '🎁 ' : (mode === "bunz'in" ? '💸 ' : '')}{mode}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Sleek floating arrow button to show filters when collapsed */
        <button 
          onClick={() => setShowAllFilters(true)}
          style={{ 
            position: 'absolute', 
            bottom: selected ? 260 : 86, 
            right: 16, 
            zIndex: 2000, 
            background: 'rgba(0,0,0,0.85)', 
            backdropFilter: 'blur(10px)', 
            color: '#fff', 
            border: '1px solid rgba(255,255,255,0.2)', 
            borderRadius: '50%', 
            width: 40, 
            height: 40, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: 14, 
            fontWeight: 900, 
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)', 
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          title="Mostrar Filtros"
        >
          ▲
        </button>
      )}

      {/* Top Left Stack: Afiliados and Bunz */}
      <div style={{ position: 'absolute', top: PlatformBridge.isTelegram() ? 70 : 14, left: 16, zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', color: '#fff', padding: '4px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800, border: '1px solid rgba(255,255,255,0.1)' }}>
          🔴 {filteredBusinesses.length} afiliados
        </div>

        {activeMode !== 'Stock' && filteredBusinesses.length > 0 && (
          <div style={{ background: 'rgba(233,30,99,0.85)', backdropFilter: 'blur(10px)', color: '#fff', padding: '4px 10px', borderRadius: 999, fontWeight: 900, fontSize: 10, border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 4px 20px rgba(233,30,99,0.4)', letterSpacing: 0.5 }}>
            🎯 {filteredBusinesses.reduce((sum, b) => sum + (b.rewardPercentage || b.reward_percentage || 0), 0)} bunz en esta zona
          </div>
        )}
      </div>

      {/* Locate Me Button & Activate Location Prompt */}
      <div style={{ position: 'absolute', top: PlatformBridge.isTelegram() ? 70 : 14, right: 16, zIndex: 2000, display: 'flex', alignItems: 'center', gap: 8 }}>
        {!userLat && onRequestLocation && (
          <button
            type="button"
            onClick={onRequestLocation}
            disabled={isLocating}
            style={{
              background: 'linear-gradient(135deg, #E91E63 0%, #D81B60 100%)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 999,
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: '0 4px 16px rgba(233,30,99,0.5)',
              cursor: 'pointer',
            }}
          >
            <span>📍 {isLocating ? 'Buscando GPS…' : 'Activar Ubicación'}</span>
          </button>
        )}

        <button 
          onClick={() => {
            if (userLat && userLng && mapInst.current) {
              mapInst.current.flyTo([userLat, userLng], 16, { duration: 1 });
            } else if (onRequestLocation) {
              onRequestLocation();
            }
          }}
          style={{ width: 36, height: 36, borderRadius: '50%', background: userLat ? 'rgba(0,0,0,0.6)' : 'rgba(233,30,99,0.2)', backdropFilter: 'blur(10px)', border: `1px solid ${userLat ? 'rgba(255,255,255,0.2)' : '#E91E63'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: userLat ? '#fff' : '#E91E63', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', cursor: 'pointer' }}
          title={userLat ? "Centrar en mi ubicación" : "Activar GPS"}
        >
          <Crosshair size={18} className={isLocating ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Selected Business Floating Card */}
      {selected && (
        <div style={{ position: 'absolute', bottom: 170, left: 14, right: 14, zIndex: 2000, maxWidth: 440, margin: '0 auto' }}>
          <div 
            onClick={() => router.push(`/affiliate/${selected.id}`)}
            style={{ 
              background: 'rgba(20, 20, 30, 0.94)', 
              backdropFilter: 'blur(24px)', 
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255, 255, 255, 0.14)', 
              borderRadius: 24, 
              padding: '16px 18px', 
              boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(233, 30, 99, 0.15)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 16, 
              color: '#fff',
              animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            <div style={{ width: 68, height: 68, borderRadius: 18, background: '#12121E', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
              {selected.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={selected.imageUrl} alt={selected.user} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>{getIcon(selected.device)}</div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <h3 style={{ fontSize: 17, fontWeight: 900, color: '#fff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selected.name || selected.user}
                </h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(null);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: 'rgba(255,255,255,0.7)',
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  ✕
                </button>
              </div>

              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '3px 0 8px 0', fontWeight: 600 }}>
                {selected.category || selected.device} • A {selected.distance || '1.2'}km de ti
              </p>
              
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(selected.givesBunz !== false) && (
                  <span style={{ background: 'rgba(233,30,99,0.18)', color: '#FF4081', fontWeight: 900, fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(233,30,99,0.35)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span>🎁</span> +{selected.reward_percentage || selected.rewardPercentage}% Bunz
                  </span>
                )}
                {selected.acceptsBunz === true && (
                  <span style={{ background: 'rgba(16, 185, 129, 0.18)', color: '#34D399', fontWeight: 900, fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(16, 185, 129, 0.35)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span>⚡</span> Stock Canjeable
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
}
