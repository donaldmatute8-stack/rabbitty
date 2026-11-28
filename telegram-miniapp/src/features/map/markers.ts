/**
 * ── Pines del mapa (una sola fuente de verdad) ──────────────────────────────
 *
 * Los usan los dos motores (MapLibre por defecto y Leaflet como respaldo).
 *
 * Seguridad: el HTML de cada pin se construye aquí y el único valor que viene
 * del backend es `logoUrl`. Se acepta solo http(s) y se codifican las comillas,
 * así que un logo malicioso (`javascript:`, `"><script>`) no puede inyectar
 * nada en el DOM.
 */

export const RARITY = {
  common:    { color: '#7EC8E3', label: 'Común',      ring: '#7EC8E355' },
  rare:      { color: '#B57BEE', label: 'Raro',       ring: '#B57BEE55' },
  epic:      { color: '#FF4D8D', label: 'Épico',      ring: '#FF4D8D66' },
  legendary: { color: '#FFD166', label: 'Legendario', ring: '#FFD16666' },
} as const;

export type RarityKey = keyof typeof RARITY;

export function getRarity(bunz: number): RarityKey {
  if (bunz >= 15) return 'legendary';
  if (bunz >= 10) return 'epic';
  if (bunz >= 5) return 'rare';
  return 'common';
}

/**
 * URL de logo segura.
 *
 * El backend manda rutas relativas (`/uploads/...`), URLs http(s) y a veces
 * data URLs base64; las tres deben verse en el pin. Se bloquea cualquier otro
 * esquema (javascript:, data:text/html…) y los caracteres que romperían el
 * atributo.
 */
export function safeLogoUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const url = raw.trim();
  if (!url) return null;
  if (/[\s"'<>]/.test(url)) return null;

  if (url.startsWith('/')) return url;                       // ruta relativa
  if (/^https?:\/\//i.test(url)) return url;                 // absoluta
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(url)) return url;
  return null;
}

export function getIcon(category?: string) {
  const cat = category?.toLowerCase() || '';
  if (cat.includes('caf')) return '☕';
  if (cat.includes('restaurante') || cat.includes('comida') || cat.includes('pizz')) return '🍕';
  if (cat.includes('fit') || cat.includes('gym')) return '💪';
  if (cat.includes('tech') || cat.includes('tecno')) return '💻';
  if (cat.includes('belleza') || cat.includes('spa') || cat.includes('barber')) return '✨';
  if (cat.includes('bar') || cat.includes('copas')) return '🍸';
  return '🛍️';
}

export interface PinBusiness {
  id: string;
  name?: string;
  category?: string;
  device?: string;
  rewardPercentage?: number;
  reward_percentage?: number;
  acceptsBunz?: boolean;
  accepts_bunz?: boolean;
  givesBunz?: boolean;
  gives_bunz?: boolean;
  logoUrl?: string | null;
}

/** Color del pin según la recompensa (lo usan pines y clusters). */
export function pinColor(a: PinBusiness): string {
  const rw = a.rewardPercentage || a.reward_percentage || 0;
  const isStockOnly = (a.acceptsBunz || a.accepts_bunz) && !(a.givesBunz || a.gives_bunz);
  return isStockOnly ? '#E91E63' : RARITY[getRarity(rw)].color;
}

export function markerHTML(a: PinBusiness, selected: boolean, isDark: boolean) {
  // El pin se construye como HTML: el % viene del backend y se fuerza a número
  // para que un valor inesperado no pueda inyectar markup en el mapa.
  const rwRaw = Number(a.rewardPercentage ?? a.reward_percentage ?? 0);
  const rw = Number.isFinite(rwRaw) ? Math.max(0, Math.min(100, rwRaw)) : 0;
  const isStockOnly = (a.acceptsBunz || a.accepts_bunz) && !(a.givesBunz || a.gives_bunz);
  const r = isStockOnly ? { color: '#E91E63', label: 'Stock' } : RARITY[getRarity(rw)];
  const sz = selected ? 52 : 44;
  const glowSize = selected
    ? `0 0 0 3px ${isDark ? '#0D0914' : '#FFFFFF'}, 0 0 18px ${r.color}, 0 0 32px ${r.color}77`
    : `0 0 0 2px ${isDark ? '#0D0914' : '#FFFFFF'}, 0 0 10px ${r.color}88, 0 0 18px ${r.color}33`;
  const scale = selected ? 'scale(1.15)' : 'scale(1)';
  const icon = isStockOnly ? '🎁' : getIcon(a.category || a.device);
  const logo = safeLogoUrl(a.logoUrl);
  const inner = logo
    ? `<img src="${logo}" alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block" />`
    : icon;

  const badgeHtml = isStockOnly
    ? `<div style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);background:#E91E63;color:#fff;font-size:9px;font-weight:900;padding:2px 8px;border-radius:100px;white-space:nowrap;letter-spacing:.3px;box-shadow:0 2px 10px rgba(233,30,99,0.5)">STOCK</div>`
    : `<div style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);background:${r.color};color:${getRarity(rw) === 'legendary' ? '#111' : '#0D0D1A'};font-size:9px;font-weight:900;padding:2px 8px;border-radius:100px;white-space:nowrap;letter-spacing:.3px;box-shadow:0 2px 10px ${r.color}88">+${rw}%</div>`;

  return `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:${scale};transition:transform 0.25s cubic-bezier(.34,1.56,.64,1)">
      ${badgeHtml}
      <div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${isDark ? 'linear-gradient(145deg,#1E142B,#0F0A18)' : '#FFFFFF'};display:flex;align-items:center;justify-content:center;font-size:${selected ? 22 : 18}px;box-shadow:${glowSize};border:2px solid ${r.color};transition:all .25s;overflow:hidden">
        ${inner}
      </div>
      <div style="width:2px;height:9px;background:linear-gradient(${r.color},transparent);margin-top:-1px"></div>
      <div style="width:6px;height:6px;border-radius:50%;background:${r.color};box-shadow:0 0 8px ${r.color};margin-top:-2px"></div>
    </div>`;
}

export function userMarkerHTML() {
  return `
    <div style="position:relative;width:28px;height:28px">
      <div class="radar-sweep"></div>
      <div class="rb-pulse rb-pulse-1"></div>
      <div class="rb-pulse rb-pulse-2"></div>
      <div class="rb-pulse rb-pulse-3"></div>
      <div style="position:absolute;inset:0;border-radius:50%;background:#E91E63;border:3px solid #fff;box-shadow:0 0 0 2px #E91E63,0 0 24px #E91E63aa;z-index:2"></div>
    </div>`;
}
