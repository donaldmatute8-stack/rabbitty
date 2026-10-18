export interface FaqItem {
  q: string;
  a: string;
}

export const FAQS: FaqItem[] = [
  {
    q: '¿Qué son los Bunz?',
    a: 'Los Bunz son la moneda digital exclusiva del ecosistema Rabbitty. Sirven para recibir recompensas cuando consumes en negocios afiliados y luego gastarlos como dinero real en otros negocios participantes.',
  },
  {
    q: '¿Cómo gano Bunz?',
    a: '¡Es automático! Cada vez que pagas en un restaurante o negocio con el sistema Rabbitty POS, muestras el código QR de tu billetera o das tu número de teléfono. El cajero lo escanea y un porcentaje de tu cuenta se regresa inmediatamente en Bunz.',
  },
  {
    q: '¿Tienen fecha de vencimiento?',
    a: 'Los Bunz en tu cuenta registrada no vencen. Sin embargo, si un negocio te emite Bunz a tu número telefónico y aún no has creado tu cuenta (Bóveda Temporal), tienes 3 meses para registrarte antes de que expiren.',
  },
  {
    q: '¿Puedo transferir mis Bunz a otra persona?',
    a: 'Puedes usarlos para invitar la cuenta en un restaurante participante. La transferencia directa peer-to-peer está planeada para futuras actualizaciones, ¡mantente atento a la comunidad!',
  },
  {
    q: '¿Cómo funciona el programa de referidos?',
    a: 'En tu perfil encontrarás un enlace único. Compártelo con tus amigos y, cuando ellos creen su cuenta y realicen su primera transacción, tú recibirás Bunz automáticamente en tu billetera.',
  },
  {
    q: '¿Dónde veo qué negocios aceptan Bunz?',
    a: "En la pantalla principal (Stock o Feed) y en la pestaña Freehands (nuestro mapa inteligente), verás en tiempo real todos los negocios afiliados cercanos a tu ubicación.",
  },
];

export const DOC_SECTIONS: { title: string; body: string }[] = [
  {
    title: 'El Ecosistema Rabbitty',
    body: 'Rabbitty es una red de recompensas que conecta negocios locales y consumidores con un modelo Give-to-Get. Al visitar los comercios de la red Stock y escanear tu billetera, recibes un porcentaje de tus compras en Bunz.',
  },
  {
    title: 'La Billetera Bunz',
    body: 'Tu billetera funciona con tecnología blockchain invisible: tus Bunz te pertenecen. Para cobrar, muestra tu código QR en el establecimiento. Bóvedas Temporales: si recibiste Bunz por teléfono antes de registrarte, tienes 3 meses para crear tu cuenta o se devuelven a la Tesorería.',
  },
  {
    title: 'Stock y Freehands (Mapas)',
    body: 'En el menú inferior encuentras dos formas de descubrir recompensas: Stock (Feed) lista negocios activos y sus cashbacks en Bunz; Freehands (Mapa) es un mapa interactivo y geolocalizado para encontrar los locales más cercanos en tiempo real.',
  },
  {
    title: 'Niveles y Referidos',
    body: 'Acumulas Hops (puntos de experiencia por tus visitas) y tu nivel de Madriguera sube, cambiando el borde de tu avatar a colores únicos (Legendario, Épico, Raro). Con el Programa de Referidos invitas a tus amigos y ambos ganan Bunz en la primera transacción del invitado.',
  },
];

export const SUPPORT_QUICK_QUESTIONS: string[] = [
  '¿Qué son los Bunz?',
  '¿Cómo gano Bunz?',
  '¿Puedo transferir mis Bunz?',
  '¿Cómo funciona el programa de referidos?',
  '¿Dónde veo los negocios que aceptan Bunz?',
];

export const SUPPORT_KNOWLEDGE =
  'CENTRO DE AYUDA RABBITTY (FAQ):\n' +
  FAQS.map((f) => `· ${f.q}\n  → ${f.a}`).join('\n') +
  '\n\nGUÍA / DOCUMENTACIÓN:\n' +
  DOC_SECTIONS.map((d) => `· ${d.title}: ${d.body}`).join('\n');

const SUPPORT_STOPWORDS = new Set([
  'que', 'con', 'para', 'por', 'los', 'las', 'una', 'uno', 'unos', 'unas', 'del', 'esta', 'este',
  'como', 'donde', 'cuando', 'hola', 'quiero', 'puedo', 'podria', 'puedes', 'tienes', 'hay',
  'mas', 'pero', 'sin', 'sobre', 'mis', 'tus', 'the', 'and',
]);

function supportTokens(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !SUPPORT_STOPWORDS.has(t));
}

/**
 * Devuelve la mejor FAQ para una consulta de soporte, o null si no hay match claro.
 * Se usa como fallback sin IA para el asistente Bunzy.
 */
export function matchFaq(content: string): FaqItem | null {
  const tokens = new Set(supportTokens(content));
  if (tokens.size === 0) return null;

  let best: FaqItem | null = null;
  let bestScore = 0;

  for (const faq of FAQS) {
    const hay = new Set(supportTokens(`${faq.q} ${faq.a}`));
    let score = 0;
    for (const t of tokens) if (hay.has(t)) score += t.length >= 6 ? 2 : 1;
    if (score > bestScore) {
      bestScore = score;
      best = faq;
    }
  }

  return bestScore >= 2 ? best : null;
}
