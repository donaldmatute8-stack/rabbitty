import type { MoodType } from '@/types/mood';

/**
 * Heurística de respaldo: qué categorías de comercio encajan naturalmente con cada mood.
 * Se usa solo cuando el afiliado todavía no configuró campañas de mood propias
 * (las campañas explícitas siempre tienen prioridad).
 */
export const MOOD_CATEGORY_PATTERNS: Record<MoodType, RegExp> = {
  calm: /caf[eé]|t[eé]\b|tea|spa|librer|jard[ií]n|panader|repost|bienestar|yoga/i,
  focus: /caf[eé]|cowork|librer|biblio|papeler|estudio/i,
  energy: /gym|gimnas|fit|deport|smoothie|jugo|yoga|bowl|desayun|caf[eé]|saludable/i,
  celebration: /bar\b|cantina|cervec|mezcal|club|restaurante|taquer|pastel|repost|helader|coctel/i,
  connection: /restaurante|caf[eé]|taquer|comida|pizz|cena|brunch|fonda|cocina/i,
  surprise: /tienda|retail|galer[ií]a|arte|concept|boutique|mercado|market|dise[ñn]o|vintage/i,
};

export function matchesMoodCategory(mood: MoodType, category: string | null | undefined): boolean {
  if (!category) return false;
  return MOOD_CATEGORY_PATTERNS[mood].test(category);
}

/** True si `hour` cae dentro de la ventana [start, end]; soporta ventanas que cruzan medianoche. */
export function isHourInWindow(hour: number, start: number, end: number): boolean {
  if (start <= end) return hour >= start && hour <= end;
  return hour >= start || hour <= end;
}
