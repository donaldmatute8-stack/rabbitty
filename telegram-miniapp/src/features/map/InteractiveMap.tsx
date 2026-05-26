'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet markers in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Icon for Rabbitty Businesses
const createCustomIcon = (rewardPct: number, color: string = '#E91E63') => {
  const svgTemplate = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
      <circle cx="20" cy="20" r="18" fill="${color}" stroke="#FFF" stroke-width="3" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))" />
      <text x="20" y="24" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#FFF" text-anchor="middle">+${rewardPct}%</text>
    </svg>
  `;
  return L.divIcon({
    className: 'custom-leaflet-icon',
    html: svgTemplate,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  });
};

interface InteractiveMapProps {
  businesses: any[];
  userLat?: number | null;
  userLng?: number | null;
}

// Helper component to center map on user location
const CenterToUser = ({ lat, lng }: { lat: number, lng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 14, { animate: true });
  }, [lat, lng, map]);
  return null;
};

export default function InteractiveMap({ businesses, userLat, userLng }: InteractiveMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-full w-full bg-gray-100 animate-pulse rounded-2xl flex items-center justify-center">Cargando Mapa...</div>;

  const defaultCenter: [number, number] = [19.4326, -99.1332]; // Mexico City default

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden shadow-inner border border-gray-200 relative z-0">
      <MapContainer 
        center={userLat && userLng ? [userLat, userLng] : defaultCenter} 
        zoom={13} 
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {userLat && userLng && (
          <CenterToUser lat={userLat} lng={userLng} />
        )}

        {/* User Location Marker */}
        {userLat && userLng && (
          <Marker 
            position={[userLat, userLng]} 
            icon={L.divIcon({
              className: 'user-location-icon',
              html: `<div style="width: 20px; height: 20px; background-color: #2196F3; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(33, 150, 243, 0.5);"></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            })}
          >
            <Popup>Tu ubicación</Popup>
          </Marker>
        )}

        {/* Business Markers */}
        {businesses.map((b) => {
          if (!b.lat || !b.lng) return null;
          return (
            <Marker 
              key={b.id} 
              position={[parseFloat(b.lat), parseFloat(b.lng)]}
              icon={createCustomIcon(b.bunz)}
            >
              <Popup className="rounded-xl overflow-hidden">
                <div className="p-1 min-w-[150px]">
                  <p className="font-black text-black text-[15px] mb-1">{b.user}</p>
                  <p className="text-gray-500 text-[11px] mb-2">{b.device}</p>
                  <div className="bg-pink-50 text-pink-600 font-bold text-xs py-1 px-2 rounded-lg text-center">
                    Gana +{b.bunz}% en Bunz
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
