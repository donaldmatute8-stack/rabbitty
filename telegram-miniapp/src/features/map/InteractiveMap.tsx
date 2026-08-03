'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair } from 'lucide-react';

interface InteractiveMapProps {
  businesses: any[];
  userLat?: number | null;
  userLng?: number | null;
}

const RARITY: any = {
  common:    { color:"#7EC8E3", label:"Común",      ring:"#7EC8E355" },
  rare:      { color:"#B57BEE", label:"Raro",       ring:"#B57BEE55" },
  epic:      { color:"#FF4D8D", label:"Épico",      ring:"#FF4D8D66" },
  legendary: { color:"#FFD166", label:"Legendario", ring:"#FFD16666" },
};

function getRarity(bunz: number) {
  if (bunz >= 15) return "legendary"; // Adjusted for realistic percentages (15%+)
  if (bunz >= 10) return "epic";
  if (bunz >= 5)  return "rare";
  return "common";
}

function getIcon(category: string) {
  const cat = category?.toLowerCase() || '';
  if (cat.includes('caf')) return '☕';
  if (cat.includes('restaurante') || cat.includes('comida') || cat.includes('pizz')) return '🍕';
  if (cat.includes('fit') || cat.includes('gym')) return '💪';
  if (cat.includes('tech') || cat.includes('tecno')) return '💻';
  if (cat.includes('belleza') || cat.includes('spa')) return '✨';
  return '🛍️';
}

function markerHTML(a: any, selected: boolean) {
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

export default function InteractiveMap({ businesses, userLat, userLng }: InteractiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const layerGroup = useRef<any>(null);
  const [selected, setSelected] = useState<any>(null);
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
    const fallbackLat = businesses.length > 0 && businesses[0].lat ? parseFloat(businesses[0].lat) : 25.7275;
    const fallbackLng = businesses.length > 0 && businesses[0].lng ? parseFloat(businesses[0].lng) : -100.312;

    const centerLat = userLat != null ? userLat : fallbackLat;
    const centerLng = userLng != null ? userLng : fallbackLng;

    const map = L.map(mapRef.current, {
      center: [centerLat, centerLng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
    });

    // Dark CartoDB Layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, opacity: 0.92,
    }).addTo(map);

    // Add destination marker (from affiliate 'Llegar')
    if (userLat != null && userLng != null) {
      const uIcon = L.divIcon({ html: userMarkerHTML(), className:'', iconSize:[26,26], iconAnchor:[13,13] });
      L.marker([userLat, userLng], { icon: uIcon, zIndexOffset: 2000 }).addTo(map);

      L.circle([userLat, userLng], {
        radius:90, color:'#E91E63', fillColor:'#E91E63', fillOpacity:0.04, weight:1, dashArray:'3 5',
      }).addTo(map);
    }

    layerGroup.current = L.layerGroup().addTo(map);
    mapInst.current = map;
    
    map.on('click', () => setSelected(null));
    
    return () => { 
      map.remove(); 
      mapInst.current = null; 
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Initialize only once — don't re-init on coord change

  // Pan to target location if coordinates come in after mount
  useEffect(() => {
    if (!mapInst.current || userLat == null || userLng == null) return;
    mapInst.current.setView([userLat, userLng], 16, { animate: true });
  }, [userLat, userLng]);

  // Render Business Markers
  useEffect(() => {
    if (!mapInst.current || !layerGroup.current) return;
    layerGroup.current.clearLayers();

    filteredBusinesses.forEach(b => {
      if (!b.lat || !b.lng) return;
      const lat = parseFloat(b.lat);
      const lng = parseFloat(b.lng);

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
      }).addTo(layerGroup.current);

      const icon = L.divIcon({ html: markerHTML(b, isSel), className:'', iconSize:[64,80], iconAnchor:[32,80] });
      L.marker([lat, lng], { icon, zIndexOffset: isSel ? 1500 : 800 })
        .addTo(layerGroup.current)
        .on('click', (e: any) => {
          L.DomEvent.stopPropagation(e);
          setSelected((prev: any) => prev?.id === b.id ? null : b);
          mapInst.current?.panTo([lat - 0.0018, lng], { animate:true, duration:0.5 });
        });
    });
  }, [filteredBusinesses, selected]); // FIx: Add filteredBusinesses instead of just businesses

  return (
    <div className="w-full h-full relative bg-[#0D0D1A]">
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
        .leaflet-container { background: #000000 !important; }
        .leaflet-tile-pane { filter: saturate(0.5) brightness(0.9); }
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
        <div style={{ position: 'absolute', bottom: selected ? 260 : 120, left: 16, right: 16, zIndex: 2000, display: 'flex', flexDirection: 'column', gap: 10, transition: 'bottom 0.3s' }}>
          
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
      <div style={{ position: 'absolute', top: 70, left: 16, zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', color: '#fff', padding: '4px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800, border: '1px solid rgba(255,255,255,0.1)' }}>
          🔴 {filteredBusinesses.length} afiliados
        </div>

        {activeMode !== 'Stock' && filteredBusinesses.length > 0 && (
          <div style={{ background: 'rgba(233,30,99,0.85)', backdropFilter: 'blur(10px)', color: '#fff', padding: '4px 10px', borderRadius: 999, fontWeight: 900, fontSize: 10, border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 4px 20px rgba(233,30,99,0.4)', letterSpacing: 0.5 }}>
            🎯 {filteredBusinesses.reduce((sum, b) => sum + (b.rewardPercentage || b.reward_percentage || 0), 0)} bunz en esta zona
          </div>
        )}
      </div>

      {/* Locate Me Button - Moved Up and Aligned */}
      <button 
        onClick={() => {
          if (userLat && userLng && mapInst.current) {
            mapInst.current.panTo([userLat, userLng], { animate: true, duration: 1 });
          }
        }}
        style={{ position: 'absolute', top: 70, right: 16, zIndex: 2000, width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', cursor: 'pointer' }}
      >
        <Crosshair size={18} />
      </button>

      {/* Selected Business Floating Card */}
      {selected && (
        <div style={{ position: 'absolute', bottom: 180, left: 16, right: 16, zIndex: 2000 }}>
          <div 
            onClick={() => router.push(`/affiliate/${selected.id}`)}
            style={{ 
              background: 'rgba(17, 17, 17, 0.95)', 
              backdropFilter: 'blur(20px)', 
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)', 
              borderRadius: 24, 
              padding: 20, 
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 16, 
              color: '#fff',
              animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
              cursor: 'pointer'
            }}
          >
            <div style={{ width: 64, height: 64, borderRadius: 16, background: '#1A1A2E', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.05)' }}>
              {selected.imageUrl ? (
                <img src={selected.imageUrl} alt={selected.user} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>{getIcon(selected.device)}</div>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: '#fff', margin: '0 0 4px 0', lineHeight: 1.2 }}>{selected.name || selected.user}</h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '0 0 8px 0' }}>{selected.category || selected.device} • A {selected.distance || '1.2'}km de ti</p>
              
              {(selected.givesBunz !== false) && (
                <div style={{ background: 'rgba(233,30,99,0.15)', color: '#E91E63', fontWeight: 800, fontSize: 12, padding: '6px 12px', borderRadius: 8, display: 'inline-block', border: '1px solid rgba(233,30,99,0.3)', marginRight: 8 }}>
                  Gana +{selected.reward_percentage || selected.rewardPercentage}% en Bunz
                </div>
              )}
              {selected.acceptsBunz === true && (
                <div style={{ background: 'rgba(76, 175, 80, 0.15)', color: '#4CAF50', fontWeight: 800, fontSize: 12, padding: '6px 12px', borderRadius: 8, display: 'inline-block', border: '1px solid rgba(76, 175, 80, 0.3)' }}>
                  🎁 Stock Disponible
                </div>
              )}
            </div>
          </div>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            .leaflet-tile-pane { filter: grayscale(100%) contrast(1.2) brightness(0.7) !important; }
          `}} />
        </div>
      )}
    </div>
  );
}
