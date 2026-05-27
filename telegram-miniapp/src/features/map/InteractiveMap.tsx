'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
  const r = RARITY[getRarity(a.reward_percentage)];
  const sz = selected ? 54 : 46;
  const glowSize = selected
    ? `0 0 0 3px #0D0D1A, 0 0 18px ${r.color}, 0 0 36px ${r.color}77`
    : `0 0 0 2px #0D0D1A, 0 0 10px ${r.color}99, 0 0 22px ${r.color}44`;
  const scale = selected ? "scale(1.18)" : "scale(1)";
  const icon = getIcon(a.device);
  
  return `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:${scale};transition:transform 0.25s cubic-bezier(.34,1.56,.64,1)">
      <div style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);background:${r.color};color:${getRarity(a.reward_percentage)==='legendary'?'#111':'#0D0D1A'};font-size:9px;font-weight:900;padding:2px 8px;border-radius:100px;white-space:nowrap;font-family:var(--font-family-base, sans-serif);letter-spacing:.3px;box-shadow:0 2px 10px ${r.color}88">
        +${a.reward_percentage}%
      </div>
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
  const [radarAngle, setRadarAngle] = useState(0);

  // Radar sweep RAF
  useEffect(() => {
    let raf: number;
    let angle = 0;
    const tick = () => {
      angle = (angle + 0.9) % 360;
      setRadarAngle(angle);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Map Initialization
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    
    // Default to Mexico City if no user location
    const centerLat = userLat || 19.4326;
    const centerLng = userLng || -99.1332;

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

    // Add User Location Marker
    if (userLat && userLng) {
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
  }, [userLat, userLng]);

  // Render Business Markers
  useEffect(() => {
    if (!mapInst.current || !layerGroup.current) return;
    layerGroup.current.clearLayers();

    businesses.forEach(b => {
      if (!b.lat || !b.lng) return;
      const lat = parseFloat(b.lat);
      const lng = parseFloat(b.lng);

      const r = RARITY[getRarity(b.reward_percentage)];
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
  }, [businesses, selected]);

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
        .leaflet-container { background: #0D0D1A !important; }
        .leaflet-tile-pane { filter: saturate(0.5) brightness(0.9); }
      `}} />

      {/* Hex grid overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none" style={{
        backgroundImage: `repeating-linear-gradient(60deg,rgba(233,30,99,0.04) 0px,rgba(233,30,99,0.04) 1px,transparent 1px,transparent 30px),
                          repeating-linear-gradient(120deg,rgba(233,30,99,0.04) 0px,rgba(233,30,99,0.04) 1px,transparent 1px,transparent 30px),
                          repeating-linear-gradient(0deg,rgba(233,30,99,0.04) 0px,rgba(233,30,99,0.04) 1px,transparent 1px,transparent 30px)`
      }} />

      {/* Radar Sweep */}
      <div className="absolute inset-0 z-[15] pointer-events-none overflow-hidden mix-blend-screen flex items-center justify-center">
        <div style={{
          position: "absolute",
          width: "400px", height: "400px",
          background: "conic-gradient(from 0deg, transparent 70%, rgba(233,30,99,0.1) 95%, rgba(233,30,99,0.8) 100%)",
          borderRadius: "50%",
          transform: `rotate(${radarAngle}deg)`,
          filter: "blur(2px)"
        }} />
      </div>

      <div ref={mapRef} className="absolute inset-0 z-0" />

      {/* Selected Business Floating Card */}
      {selected && (
        <div className="absolute bottom-6 left-4 right-4 z-[2000]">
          <div className="bg-[#111111]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-2xl flex items-center gap-4 text-white" style={{ animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
            <div className="w-16 h-16 rounded-2xl bg-gray-800 overflow-hidden flex-shrink-0">
              {selected.imageUrl ? (
                <img src={selected.imageUrl} alt={selected.user} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#1A1A2E] flex items-center justify-center text-3xl border border-[#2A2A3E]">{getIcon(selected.device)}</div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-black text-lg text-white mb-1 leading-tight">{selected.user}</h3>
              <p className="text-xs text-white/50 mb-2">{selected.device} • A {selected.distance}km de ti</p>
              <div className="bg-pink-500/20 text-pink-400 font-bold text-xs py-1.5 px-3 rounded-lg inline-block border border-pink-500/20">
                Gana +{selected.reward_percentage}% en Bunz
              </div>
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
