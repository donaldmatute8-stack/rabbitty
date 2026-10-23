import { db } from '@/db';
import { messages, ownedBusinesses, users, levels } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';

type BusinessRow = typeof ownedBusinesses.$inferSelect;
type MessageRow = typeof messages.$inferSelect;
import { isBusinessOpen } from '@/lib/chat';
import { SUPPORT_KNOWLEDGE, matchFaq } from './support-content';

export interface BusinessCardMetadata {
  businessId: string;
  businessName: string;
  category?: string;
  address?: string;
  rewardPercentage?: number;
  acceptsBunz?: boolean;
  logoUrl?: string | null;
  lat?: number;
  lng?: number;
}

export interface BusinessOption {
  businessId: string;
  businessName: string;
  category?: string;
  address?: string;
  distanceKm?: number | null;
  openNow?: boolean | null;
  rewardPercentage?: number;
  acceptsBunz?: boolean;
  logoUrl?: string | null;
  lat?: number;
  lng?: number;
}

export interface OrderItem {
  name: string;
  qty: number;
  notes?: string;
}

export interface OrderDraft {
  businessId: string;
  businessName: string;
  items: OrderItem[];
  totalBunz?: number;
  notes?: string;
  step: 'SELECT_ITEMS' | 'CONFIRM' | 'SENT';
}

export interface TransferRequest {
  amount: number;
  recipient: string;
  note: string;
}

export interface ReceiveQrRequest {
  handle: string;
}

export interface BunzyReply {
  content: string;
  type: 'TEXT' | 'CARD' | 'OPTIONS';
  metadata: BusinessCardMetadata | null;
  suggestions: string[];
  options?: BusinessOption[];
  orderDraft?: OrderDraft | null;
  transferRequest?: TransferRequest | null;
  receiveQr?: ReceiveQrRequest | null;
}

export interface BunzyInput {
  userId: string;
  conversationId: string;
  content: string;
  lat?: number | null;
  lng?: number | null;
}

const STOPWORDS = new Set([
  'que', 'con', 'para', 'por', 'los', 'las', 'una', 'uno', 'unos', 'unas', 'del', 'esta', 'este',
  'como', 'donde', 'cuando', 'hola', 'quiero', 'podria', 'puedes', 'tienes', 'hay', 'algo', 'muy',
  'mas', 'pero', 'sin', 'sobre', 'cerca', 'aqui', 'alli', 'busco', 'recomienda', 'dame', 'ver',
]);

function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9ñ]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function normalizeText(text: string): string {
  return (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const TRANSFER_RE =
  /\b(?:enviar|envia|mandar|manda|transfiere|transferir|regalar|regalame|pasa(?:me)?|sueltame|soltar)\b(?:\s+(?:al?|la?|los?|l[aá]s?)?)?\s*(\d[\d.,]*)\s*bunz?\b(?:\s+(?:a|al|para|para el|para la)\s+@?[\w.]+)?/i;
const TRANSFER_TO_RE = /\b(?:a|al|para|para el|para la|destino)\s+@?([\w.]{2,32})\b/i;
const TRANSFER_NOTE_RE = /\b(?:nota|mensaje|concepto|por|diciendo|con el mensaje|con la nota|que diga|dice)[:\s]+["“]?([^"”\n]{2,60})["”]?/i;

export function parseTransferIntent(content: string, selfUsername?: string | null): TransferRequest | null {
  const nc = normalizeText(content);
  if (!/bunz/.test(nc)) return null;
  const amountMatch = TRANSFER_RE.exec(content) || TRANSFER_RE.exec(nc);
  if (!amountMatch) return null;

  const rawAmount = amountMatch[1].replace(/[.,]/g, '');
  const amount = parseInt(rawAmount, 10);
  if (!Number.isInteger(amount) || amount <= 0 || amount > 10_000_000) return null;

  const toMatch = TRANSFER_TO_RE.exec(content) || TRANSFER_TO_RE.exec(nc);
  const recipientRaw = toMatch ? toMatch[1].replace(/^@/, '') : '';
  const recipient = recipientRaw && recipientRaw.toLowerCase() !== (selfUsername || '').toLowerCase()
    ? `@${recipientRaw}`
    : '';

  const noteMatch = TRANSFER_NOTE_RE.exec(content) || TRANSFER_NOTE_RE.exec(nc);
  const note = noteMatch ? noteMatch[1].trim() : '';

  return { amount, recipient, note };
}

function rankBusinesses(
  businesses: BusinessRow[],
  content: string,
  lat?: number | null,
  lng?: number | null,
): BusinessRow[] {
  const tokens = tokenize(content);
  const nc = normalizeText(content);
  const wantsNearby = /cerca|nearby|aqui|aqui mismo|mi zona|caminando|ahorita/.test(nc);
  return [...businesses]
    .map((b) => {
      const hay = normalizeText(`${b.name} ${b.category} ${b.description || ''}`);
      let score = 0;
      for (const t of tokens) if (hay.includes(t)) score += 6;
      if (b.acceptsBunz) score += 1;
      if (typeof lat === 'number' && typeof lng === 'number') {
        const d = haversineKm(lat, lng, b.lat, b.lng);
        score += Math.max(0, 24 - d / 0.5);
        if (wantsNearby) score += Math.max(0, 30 - d);
      }
      if (isBusinessOpen(b) && wantsNearby) score += 8;
      return { b, score };
    })
    .sort((x, y) => y.score - x.score)
    .map((r) => r.b);
}

function businessLine(b: BusinessRow, lat?: number | null, lng?: number | null): string {
  let distanceText = '';
  if (typeof lat === 'number' && typeof lng === 'number') {
    const d = haversineKm(lat, lng, b.lat, b.lng);
    distanceText = ` | Distancia: ${d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`}`;
  }
  return `- "${b.name}" | Cat: ${b.category} | Dir: ${b.address} | Recompensa: ${b.rewardPercentage}% bunz | Acepta Bunz: ${
    b.acceptsBunz ? 'Sí' : 'No'
  } | ID: ${b.id}${b.description ? ` | Info: ${b.description}` : ''}${distanceText}`;
}

// function formatDistanceKm(d: number): string {
//   return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
// }

function mapToOptions(businesses: BusinessRow[], lat?: number | null, lng?: number | null): BusinessOption[] {
  return businesses.map((b) => {
    let distanceKm: number | null = null;
    if (typeof lat === 'number' && typeof lng === 'number') {
      distanceKm = Number(haversineKm(lat, lng, b.lat, b.lng).toFixed(2));
    }
    return {
      businessId: b.id,
      businessName: b.name,
      category: b.category,
      address: b.address,
      distanceKm,
      openNow: isBusinessOpen(b),
      rewardPercentage: b.rewardPercentage,
      acceptsBunz: b.acceptsBunz,
      logoUrl: b.logoUrl ?? null,
      lat: b.lat ?? undefined,
      lng: b.lng ?? undefined,
    };
  });
}

function buildDirectory(businesses: BusinessRow[], lat?: number | null, lng?: number | null): string {
  return businesses.map((b) => `- ${businessLine(b, lat, lng)}`).join('\n');
}

function businessCardFromText(text: string, businesses: BusinessRow[]): BusinessCardMetadata | null {
  const match = /\[COMERCIO_ACTION id="([^"]+)" name="([^"]+)"\]/.exec(text);
  if (match) {
    const business = businesses.find((b) => b.id === match[1]);
    return {
      businessId: match[1],
      businessName: match[2],
      category: business?.category,
      address: business?.address,
      rewardPercentage: business?.rewardPercentage,
      acceptsBunz: business?.acceptsBunz,
      logoUrl: business?.logoUrl ?? null,
      lat: business?.lat ?? undefined,
      lng: business?.lng ?? undefined,
    };
  }
  return null;
}

function suggestionsFor(content: string, hasBusiness: boolean, multiple = false): string[] {
  const t = normalizeText(content);
  if (hasBusiness && multiple) return ['Reservar', 'Pedir por Bunzy', 'Darme contacto'];
  if (hasBusiness) return ['Cómo llego 🗺️', 'Reservar mesa', 'Ver otras opciones'];
  if (/bunz|ganar|recompens/.test(t)) return ['¿Cómo gano bunz?', 'Enviar bunz', 'Mi QR de pago'];
  if (/enviar|mandar|transfer|pagar|pago|qr|recibir/.test(t)) return ['Enviar bunz', 'Mi QR de pago', 'Ver mi saldo'];
  if (/comer|cafe|rest|bar|antoj/.test(t)) return ['Cafés cerca ☕', 'Restaurantes 🍽️', 'Postres 🍰'];
  if (/pizza|pizzas|taco|tacos|hamburg|comida/.test(t)) return ['Usar mi ubicación', 'Buscar por dirección', 'Ver todos'];
  return ['Recomiéndame un lugar', 'Enviar bunz', '¿Cómo gano bunz?'];
}

interface BunzyContext {
  user: {
    firstName: string | null;
    balance: number;
    hops: number;
    levelName: string | null;
    multiplier: number;
    username: string | null;
    id: string;
  } | null;
  businesses: BusinessRow[];
  allBusinesses: BusinessRow[];
}

async function loadContext(input: BunzyInput): Promise<BunzyContext> {
  const allBusinesses = await db.query.ownedBusinesses
    .findMany({
      where: inArray(ownedBusinesses.status, ['VERIFIED', 'APPROVED']),
      limit: 60,
    })
    .catch(() => [] as BusinessRow[]);

  const ranked = rankBusinesses(allBusinesses, input.content, input.lat, input.lng).slice(0, 5);

  const userRow = await db.query.users
    .findFirst({
      where: eq(users.id, input.userId),
      columns: { firstName: true, totalBunzEarned: true, totalBunzSpent: true, hops: true, levelId: true, username: true, id: true },
    })
    .catch(() => undefined);

  let levelName: string | null = null;
  let multiplier = 1;
  if (userRow?.levelId) {
    const level = await db.query.levels.findFirst({ where: eq(levels.id, userRow.levelId) }).catch(() => undefined);
    levelName = level?.name ?? null;
    multiplier = level?.bunzMultiplier ?? 1;
  }

  return {
    user: userRow
      ? {
          firstName: userRow.firstName,
          balance: (userRow.totalBunzEarned || 0) - (userRow.totalBunzSpent || 0),
          hops: userRow.hops || 0,
          levelName,
          multiplier,
          username: userRow.username,
          id: userRow.id,
        }
      : null,
    businesses: ranked,
    allBusinesses,
  };
}

function buildSystemPrompt(ctx: BunzyContext, lat?: number | null, lng?: number | null): string {
  const userLine = ctx.user
    ? `DATOS DEL USUARIO: se llama ${ctx.user.firstName || 'Rabbitter'}, tiene ${ctx.user.balance} bunz disponibles, ${ctx.user.hops} hops${ctx.user.levelName ? `, nivel "${ctx.user.levelName}" (x${ctx.user.multiplier} bunz)` : ''}.`
    : 'DATOS DEL USUARIO: no disponibles.';

  const locationLine =
    typeof lat === 'number' && typeof lng === 'number'
      ? 'El usuario compartió su ubicación; prioriza negocios más cercanos.'
      : 'El usuario no compartió ubicación; no inventes distancias.';

  return `Eres Bunzy 🐰, el concierge oficial, hiperconectado y carismático de Rabbitty.
Tu misión es guiar al usuario a los mejores lugares (cafés, restaurantes, bares, fitness), ayudar a reservar, a pedir por ti o dar contacto, y explicar cómo acumular bunz.
Hablas con un tono mexicano moderno, amigable, fresco y directo ("¡Qué onda!", "¡De lujo!"). Siempre escribe "bunz" en minúsculas.
${userLine}
${locationLine}

NEGOCIOS RABBITTY RELEVANTES PARA ESTA CONSULTA:
${buildDirectory(ctx.businesses, lat, lng) || '(No hay comercios afiliados cargados actualmente)'}

REGLAS DE UBICACIÓN:
- Si pregunta por "cerca", "ahorita", "aquí", "mi zona", "caminando" o recomendaciones geolocalizadas Y NO hay ubicación (${typeof lat==='number'&&typeof lng==='number'?'SÍ tiene':'NO tiene'}), NO busques con coordenadas. Pregunta ÚNICAMENTE: "¿Quieres que use tu ubicación actual o buscas para otro lugar (dirección, colonia o referencia)?"
- Si responde "otro lugar", "otra zona", "para otro lado", "en ..." menciona dirección/colonia → pide esa dirección/colonia clara y búscala por texto. No inventes coords.
- Si dice "usa mi ubicación", "mi ubicación", "sí usa mi ubicación" y aún no tiene → responde: "Toca el ícono 📍 para compartir tu ubicación y lo busco al instante."

REGLAS DE PRESENTACIÓN:
- Si hay 2 o más negocios: preséntalos NUMERADOS (máximo 3). Por cada uno: Nombre, Distancia (solo si hay ubicación o se dedujo zona), Estado (Abierto ahora / Cierra en X / Cerrado), % bunz. Sé natural y breve.
- Tras lista numérica: "¿Cuál eliges? Puedo reservar, pedir por mí o darte su contacto."
- Si hay 1 negocio muy claro: muéstralo directo + etiqueta [COMERCIO_ACTION id="{id}" name="{nombre}"] y ofrece esas 3 acciones.
- Prioriza "Abierto ahora" cuando diga "ahorita".

ACCIONES:
- Cuando elija número ("la 1", "2", "primero") + acción ("reservar", "pedir", "quiero pedir", "dame contacto", "contacto") → responde acorde a ese comercio.
- Para "dame el contacto" → nombre, dirección y, si existen, teléfono/WhatsApp. Si no existen, ofrece abrir chat directo con [COMERCIO_ACTION].
- Para "pedir por Bunzy" → inicia pedido breve: "¿Qué quieres pedirle a {nombre}? Dame el platillo/cantidad o una breve descripción y lo preparo."
- Para "reservar" → pregunta: "¿Para cuántas personas y a qué hora quieres reservar en {nombre}?"

REGLAS GENERALES:
1. Recomienda SOLAMENTE negocios del directorio anterior. Nunca inventes negocios, direcciones, tel/WhatsApp ni recompensas.
2. Usa herramienta "buscar_negocios" solo si realmente faltan resultados. Puedes usar "buscar_negocios_cercanos" con soloAbiertosAhora=true cuando diga "ahorita".
3. Si vas a mostrar UNA sola opción directa, agrega EXACTAMENTE esta etiqueta al final: [COMERCIO_ACTION id="{id_del_comercio}" name="{nombre_del_comercio}"]
4. Sé breve (máx ~120 palabras), dinámico y útil. Usa emojis con moderación. Responde SIEMPRE en español.

CONOCIMIENTO INTEGRADO DE LA PLATAFORMA (soporte, afiliados, seguridad y ecosistema):
${SUPPORT_KNOWLEDGE}

CAPACIDADES Y NOVEDADES QUE CONOCES A FONDO:
1. Rabbitty Mood: Sabes cómo los Rabbitters sintonizan su vibe (calm, energy, focus, celebration, connection, surprise) y cómo reciben listas de música legales y sugerencias de comercios en el mapa Freehands.
2. Afiliados y Campañas Mood: Sabes que los comercios pueden crear campañas en franjas horarias con bonos extras de bunz para atraer mesas en horas clave.
3. Proof of Atmosphere (PoA): Entiendes las recetas de iluminación, volumen y ambientación que los afiliados aplican para transformar la experiencia y elevar ticket promedio.
4. Hermes IA: Eres el compañero de Hermes, la inteligencia operativa que asesora a los negocios en horas muertas y crecimiento.
5. Seguridad: Sabes que las cuentas cuentan con biometría real (Face ID / Touch ID), PIN con hash criptográfico PBKDF2 y sal, y 2FA real por correo, SMS SignalWire y App Authenticator TOTP.
6. Operación en Caja: Sabes que en el Portal de Negocios los afiliados pueden registrar consumos para premiar con bunz (Mint), validar cupones (Redeem) y revisar su Ledger transparente.`;
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

async function loadHistory(conversationId: string): Promise<ChatMessage[]> {
  const history = await db.query.messages
    .findMany({
      where: eq(messages.conversationId, conversationId),
      orderBy: (messages, { asc }) => [asc(messages.createdAt)],
      limit: 10,
    })
    .catch(() => [] as MessageRow[]);

  return history.map((m) => ({
    role: (m.senderId === 'bot' ? 'assistant' : 'user') as 'assistant' | 'user',
    content: m.content,
  }));
}

function heuristicReply(content: string, ctx: BunzyContext, lat?: number | null, lng?: number | null): BunzyReply {
  const nc = normalizeText(content);

  // 1. Pregunta sobre ganar bunz / qué son los bunz
  if (/como gano bunz|que son los bunz|como ganar bunz|que es un bunz|para que sirven los bunz|explicame los bunz/.test(nc)) {
    const balanceInfo = ctx.user ? ` Actualmente tienes **${ctx.user.balance} bunz** disponibles.` : '';
    return {
      content:
        `¡Qué onda! 🐰 Ganar bunz en Rabbitty es súper fácil:${balanceInfo}\n\n` +
        `1️⃣ **Consume en Comercios Aliados**: Visita cualquiera de nuestros aliados y escanea tu ticket en caja con el botón **Escanear** para recibir desde el **10% hasta el 30%** de tu consumo de vuelta en bunz.\n` +
        `2️⃣ **Invita Amigos (Share & Win)**: Comparte tu link en la sección Referidos y llévate bunz extra cada vez que tus amigos completen consumos.\n` +
        `3️⃣ **Completa Misiones y Logros**: Revisa tu perfil en Insignias y Misiones para desbloquear recompensas adicionales.\n\n` +
        `¿Te gustaría ver comercios aliados donde puedes ganar bunz ahorita?`,
      type: 'TEXT',
      metadata: null,
      suggestions: ['Recomiéndame un lugar', 'Cafés cerca ☕', 'Ver mapa Freehands'],
      options: [],
      orderDraft: null,
    };
  }

  // 2. Click en sugerencia "Usar mi ubicación"
  if (/usar mi ubicacion|mi ubicacion|compartir ubicacion/.test(nc)) {
    if (typeof lat === 'number' && typeof lng === 'number') {
      // Ya tiene ubicación, buscar los más cercanos
      const near = rankBusinesses(ctx.allBusinesses, 'cerca', lat, lng).slice(0, 3);
      if (near.length > 0) {
        const lines = near
          .map((b, i) => {
            const dist = haversineKm(lat, lng, b.lat, b.lng);
            const d = ` · ${dist < 1 ? Math.round(dist * 1000) + ' m' : dist.toFixed(1) + ' km'}`;
            return `${i + 1}. **${b.name}** (${b.category})${d} · +${b.rewardPercentage}% bunz`;
          })
          .join('\n');
        return {
          content: `¡Listo! 📍 Detecté tu ubicación. Aquí tienes los lugares más cercanos a ti:\n\n${lines}\n\n¿A cuál te gustaría ir? Puedo darte el contacto o mostrarte cómo llegar.`,
          type: 'OPTIONS',
          metadata: null,
          suggestions: ['Cómo llego 🗺️', 'Ver otros lugares', '¿Cómo gano bunz?'],
          options: mapToOptions(near, lat, lng),
          orderDraft: null,
        };
      }
    }
    return {
      content: '¡De acuerdo! 📍 Toca el botón del pin **📍** en la barra inferior para compartir tu ubicación exacta y te muestro los lugares más cercanos al instante.',
      type: 'TEXT',
      metadata: null,
      suggestions: ['Ver todos los comercios', 'Cafés cerca ☕', '¿Cómo gano bunz?'],
      options: [],
      orderDraft: null,
    };
  }

  // 3. Click en "Ver todos" o "Buscar por dirección"
  if (/ver todos|todos los comercios|buscar por direccion/.test(nc)) {
    const top = ctx.allBusinesses.slice(0, 4);
    const lines = top.map((b, i) => `${i + 1}. **${b.name}** (${b.category}) · +${b.rewardPercentage}% bunz`).join('\n');
    return {
      content: `¡Aquí tienes algunos de nuestros mejores comercios aliados! 🐰\n\n${lines}\n\n¿Quieres que te muestre los detalles de alguno o prefieres una categoría específica?`,
      type: 'OPTIONS',
      metadata: null,
      suggestions: ['Cafés ☕', 'Restaurantes 🍽️', 'Bares 🍻'],
      options: mapToOptions(top, lat, lng),
      orderDraft: null,
    };
  }

  // 4. Preguntas geolocalizadas sin coordenadas (solo preguntar si no hay coordenadas)
  const wantsGeolocated = /cerca|ahorita|aqui|mi zona|caminando/.test(nc);
  if (wantsGeolocated && !(typeof lat === 'number' && typeof lng === 'number')) {
    // Si no tiene ubicación pero hay comercios en el directorio, mostrar los mejores y sugerir compartir ubicación
    const featured = ctx.businesses.slice(0, 3);
    if (featured.length > 0) {
      const lines = featured
        .map((b, i) => `${i + 1}. **${b.name}** (${b.category}) · +${b.rewardPercentage}% bunz`)
        .join('\n');
      return {
        content:
          `Para darte las distancias exactas a tu posición, toca el pin **📍** abajo para compartir tu ubicación.\n\n` +
          `Mientras tanto, aquí te dejo opciones top en la ciudad:\n\n${lines}\n\n¿Te interesa alguna o buscas algo en particular?`,
        type: 'OPTIONS',
        metadata: null,
        suggestions: ['Usar mi ubicación', 'Cafés ☕', '¿Cómo gano bunz?'],
        options: mapToOptions(featured, lat, lng),
        orderDraft: null,
      };
    }
  }

  // 5. Búsqueda de coincidencias en negocios
  const matches = rankBusinesses(ctx.allBusinesses, content, lat, lng).slice(0, 3);
  if (matches.length >= 2) {
    const lines = matches
      .map((b, i) => {
        let d = '';
        if (typeof lat === 'number' && typeof lng === 'number') {
          const dist = haversineKm(lat, lng, b.lat, b.lng);
          d = ` · ${dist < 1 ? Math.round(dist * 1000) + ' m' : dist.toFixed(1) + ' km'}`;
        }
        const open = isBusinessOpen(b) ? 'Abierto ahora' : 'Cerrado';
        return `${i + 1}. **${b.name}** (${b.category})${d} · ${open} · +${b.rewardPercentage}% bunz`;
      })
      .join('\n');
    return {
      content: `¡Qué onda! Te encontré estas opciones:\n\n${lines}\n\n¿Cuál te late? Puedo ayudarte a llegar o darte su contacto.`,
      type: 'OPTIONS',
      metadata: null,
      suggestions: suggestionsFor(content, true, true),
      options: mapToOptions(matches, lat, lng),
      orderDraft: null,
    };
  }

  if (matches[0]) {
    const matched = matches[0];
    const balanceLine = ctx.user && ctx.user.balance > 0 ? `\n💰 Tienes **${ctx.user.balance} bunz** disponibles para canjear.` : '';
    let dline = '';
    if (typeof lat === 'number' && typeof lng === 'number') {
      const dist = haversineKm(lat, lng, matched.lat, matched.lng);
      dline = ` | ${dist < 1 ? Math.round(dist * 1000) + ' m' : dist.toFixed(1) + ' km'}`;
    }
    return {
      content:
        `¡Qué onda! 🐰 Te recomiendo **${matched.name}** (${matched.category})${dline}.\n\n` +
        `📍 Dirección: ${matched.address}\n` +
        `🎁 Recompensa: **+${matched.rewardPercentage}% en bunz** con cada consumo.` +
        balanceLine +
        `\n\n¿Quieres ver su perfil completo o saber cómo llegar?👇\n` +
        `[COMERCIO_ACTION id="${matched.id}" name="${matched.name}"]`,
      type: 'TEXT',
      metadata: null,
      suggestions: suggestionsFor(content, true),
      options: mapToOptions([matched], lat, lng),
      orderDraft: null,
    };
  }

  const topFeatured = ctx.allBusinesses.slice(0, 3);
  const featuredLines = topFeatured.length > 0
    ? '\n\nAquí tienes algunos de los favoritos de la comunidad:\n' +
      topFeatured.map((b, i) => `${i + 1}. **${b.name}** (${b.category}) · +${b.rewardPercentage}% bunz`).join('\n')
    : '';

  return {
    content:
      '¡Qué onda! 🐰 Soy Bunzy, tu asistente de Rabbitty. ' +
      'Dime qué se te antoja hoy (café, pizza, mariscos, tacos, cocteles...) o qué necesitas (ver mi saldo, transferir bunz, cómo llegar a un lugar).' +
      featuredLines,
    type: topFeatured.length > 0 ? 'OPTIONS' : 'TEXT',
    metadata: null,
    suggestions: ['Cafés cerca ☕', 'Restaurantes 🍽️', '¿Cómo gano bunz?', 'Mi QR de pago'],
    options: mapToOptions(topFeatured, lat, lng),
    orderDraft: null,
  };
}

async function runOpenAI(
  content: string,
  ctx: BunzyContext,
  history: ChatMessage[],
  lat?: number | null,
  lng?: number | null,
): Promise<string | null> {
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: Number(process.env.OPENAI_TIMEOUT_MS) || 15000,
    maxRetries: 1,
  });

  const tools = [
    {
      type: 'function' as const,
      function: {
        name: 'buscar_negocios',
        description: 'Busca negocios afiliados de Rabbitty por categoría, nombre o tipo de comida.',
        parameters: {
          type: 'object',
          properties: { consulta: { type: 'string', description: 'Qué busca el usuario' } },
          required: ['consulta'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'buscar_negocios_cercanos',
        description: 'Busca negocios cercanos con filtro por categoría. Prioriza abiertos ahora si soloAbiertosAhora=true.',
        parameters: {
          type: 'object',
          properties: {
            consulta: { type: 'string' },
            categoria: { type: 'string' },
            soloAbiertosAhora: { type: 'boolean', default: true },
            max: { type: 'number', default: 3 },
          },
          required: ['consulta'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'obtener_contacto_comercio',
        description: 'Devuelve contacto (teléfono/WhatsApp, dirección) de un comercio.',
        parameters: {
          type: 'object',
          properties: { businessId: { type: 'string' } },
          required: ['businessId'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'consultar_mis_bunz',
        description: 'Devuelve el saldo de bunz, hops y nivel del usuario.',
        parameters: { type: 'object', properties: {} },
      },
    },
  ];

  const conversationMessages: import('openai/resources/chat/completions').ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(ctx, lat, lng) },
    ...history,
  ];

  for (let round = 0; round < 2; round += 1) {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: conversationMessages,
      tools,
      tool_choice: 'auto',
      max_tokens: 350,
      temperature: 0.7,
    });

    const choice = completion.choices[0]?.message;
    if (!choice) return null;

    if (choice.tool_calls && choice.tool_calls.length > 0) {
      conversationMessages.push(choice);
      for (const call of choice.tool_calls) {
        let result = 'Sin resultados';
        if (call.type === 'function' && call.function.name === 'buscar_negocios') {
          try {
            const args = JSON.parse(call.function.arguments || '{}') as { consulta?: string };
            const found = rankBusinesses(ctx.allBusinesses, args.consulta || content, lat, lng).slice(0, 5);
            result = buildDirectory(found, lat, lng) || 'Sin resultados';
          } catch {
            result = 'Sin resultados';
          }
        } else if (call.type === 'function' && call.function.name === 'buscar_negocios_cercanos') {
          try {
            const args = JSON.parse(call.function.arguments || '{}') as {
              consulta?: string;
              soloAbiertosAhora?: boolean;
              max?: number;
            };
            let found = rankBusinesses(ctx.allBusinesses, args.consulta || content, lat, lng);
            if (args.soloAbiertosAhora) found = found.filter((b) => isBusinessOpen(b));
            const max = args.max ?? 3;
            found = found.slice(0, max);
            result = buildDirectory(found, lat, lng) || 'Sin resultados abiertos ahora';
          } catch {
            result = 'Sin resultados';
          }
        } else if (call.type === 'function' && call.function.name === 'obtener_contacto_comercio') {
          try {
            const args = JSON.parse(call.function.arguments || '{}') as { businessId?: string };
            const b = ctx.allBusinesses.find((x) => x.id === args.businessId);
            if (!b) result = 'No encontrado';
            else {
              const extra = b as BusinessRow & { phone?: string | null; whatsapp?: string | null };
              const tel = extra.phone ?? extra.whatsapp ?? 'No registrado';
              const wa = extra.whatsapp ?? 'No registrado';
              result = `Comercio: ${b.name}\nDirección: ${b.address}\nTeléfono: ${tel}\nWhatsApp: ${wa}`;
            }
          } catch {
            result = 'Sin resultados';
          }
        } else if (call.type === 'function' && call.function.name === 'consultar_mis_bunz') {
          result = ctx.user
            ? `Saldo: ${ctx.user.balance} bunz, hops: ${ctx.user.hops}, nivel: ${ctx.user.levelName || 'Base'}`
            : 'Datos no disponibles';
        }
        conversationMessages.push({ role: 'tool', tool_call_id: call.id, content: result });
      }
      continue;
    }

    return choice.content?.trim() || null;
  }

  const last = conversationMessages[conversationMessages.length - 1];
  return last && last.role === 'assistant' && typeof last.content === 'string' ? last.content : null;
}

async function runOllama(
  ctx: BunzyContext,
  history: ChatMessage[],
  lat?: number | null,
  lng?: number | null,
): Promise<string | null> {
  const OLLAMA_URL = process.env.OLLAMA_API_URL;
  if (!OLLAMA_URL) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.OLLAMA_TIMEOUT_MS) || 25000);
    const ollamaKey = process.env.OLLAMA_API_KEY;
    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ollamaKey ? { Authorization: `Bearer ${ollamaKey}` } : {}),
      },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
        messages: [{ role: 'system', content: buildSystemPrompt(ctx, lat, lng) }, ...history],
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as { message?: { content?: string } };
    return data.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

export interface BunzyAssistInput {
  mode: 'draft' | 'summarize';
  intent?: string;
  otherName?: string;
  messages: { fromMe: boolean; content: string }[];
}

/**
 * Bunzy como asistente dentro de un chat interno (Rabbitter ↔ Rabbitter / Negocio).
 * Redacta un mensaje sugerido ('draft') o resume la conversación ('summarize').
 */
export async function generateBunzyAssist(input: BunzyAssistInput): Promise<string> {
  const transcript = input.messages
    .slice(-12)
    .map((m) => `${m.fromMe ? 'Yo' : input.otherName || 'Contacto'}: ${m.content}`)
    .join('\n');

  const system =
    input.mode === 'summarize'
      ? `Eres Bunzy 🐰, asistente oficial de Rabbitty. Resume en 2 o 3 viñetas muy breves de qué se habló en esta conversación y, si aplica, cuál es el siguiente paso pendiente. Tono mexicano fresco y directo. Responde en español, máximo 60 palabras.`
      : `Eres Bunzy 🐰, asistente oficial de Rabbitty. Redacta UN mensaje breve, natural y cordial para que el usuario lo envíe en este chat${input.otherName ? ` con ${input.otherName}` : ''}. ${
          input.intent ? `Lo que el usuario quiere decir: "${input.intent}".` : 'Ayúdalo a responder al último mensaje de forma clara y amable.'
        } Devuelve SOLO el texto del mensaje, sin comillas, sin prefijos ni explicaciones, máximo 40 palabras.`;

  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'dummy_key_for_build') {
    try {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: transcript || '(Aún no hay mensajes previos)' },
        ],
        max_tokens: 140,
        temperature: 0.8,
      });
      const text = completion.choices[0]?.message?.content?.trim();
      if (text) return text;
    } catch (err) {
      console.error('[BunzyAssist OpenAI Error]:', err);
    }
  }

  // Fallback heurístico (sin proveedor de IA)
  if (input.mode === 'summarize') {
    const last = input.messages
      .slice(-3)
      .map((m) => `${m.fromMe ? 'Yo' : input.otherName || 'Contacto'}: ${m.content}`)
      .join(' · ');
    return last ? `Esto es lo más reciente: ${last}` : 'Aún no hay mensajes para resumir.';
  }
  return (input.intent || '').trim() || '¡Hola! ¿Cómo estás? Quedo al pendiente, cualquier cosa me dices. 🙌';
}

export async function generateBunzyReply(input: BunzyInput): Promise<BunzyReply> {
  const ctx = await loadContext(input);
  const history = await loadHistory(input.conversationId);

  // Fallback -2: pide QR de pago / recibir bunz
  const nc0 = normalizeText(input.content);
  if (
    /\b(mi qr|qr de pago|codigo de pago|codigo qr|recibir bunz|recibir pago|pagame|pagame con qr|mostrar qr|escanear qr)\b/.test(nc0) ||
    (/qr/.test(nc0) && /pag|bunz|cobrar|rece/.test(nc0))
  ) {
    const handle = ctx.user?.username ? `@${ctx.user.username}` : ctx.user?.id || '';
    return {
      content:
        `🐰 ¡Claro! Aquí tienes tu QR de pago. Muestra este código para que te transfieran bunz.\n\n` +
        (handle ? `Tu identificador es **${handle}**.` : 'Inicia sesión para generar tu código.'),
      type: 'TEXT',
      metadata: null,
      suggestions: ['Enviar bunz', 'Ver mi saldo'],
      options: [],
      orderDraft: null,
      transferRequest: null,
      receiveQr: handle ? { handle } : null,
    };
  }

  // Fallback -1: intención de transferencia conversacional → tarjeta de confirmación
  const transfer = parseTransferIntent(input.content, ctx.user?.firstName || undefined);
  if (transfer) {
    const who = transfer.recipient || '¿a quién?';
    return {
      content:
        `🐰 ¿Quieres enviar **${transfer.amount} bunz** a **${who}**?` +
        (transfer.note ? `\n📝 Nota: "${transfer.note}"` : '') +
        `\n\nRevisa los datos y confirma abajo.`,
      type: 'TEXT',
      metadata: null,
      suggestions: ['Ver mi saldo', 'Cancelar'],
      options: [],
      orderDraft: null,
      transferRequest: transfer,
    };
  }

  // Fallback 0: pregunta de soporte → responde con FAQ conciso + enlace
  const faqMatch = matchFaq(input.content);
  if (faqMatch) {
    return {
      content: `🐰 ${faqMatch.q}\n\n${faqMatch.a}\n\n¿Necesitas algo más? Escribe "soporte" o ve a Soporte > FAQs/Docs.`,
      type: 'TEXT',
      metadata: null,
      suggestions: ['Ver todas las FAQs', 'Ver documentación'],
      options: [],
      orderDraft: null,
    };
  }

  let text: string | null = null;
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'dummy_key_for_build') {
    try {
      text = await runOpenAI(input.content, ctx, history, input.lat, input.lng);
    } catch (err) {
      console.error('[Bunzy OpenAI Error]:', err);
    }
  }
  if (!text) text = await runOllama(ctx, history, input.lat, input.lng);
  const fallback = heuristicReply(input.content, ctx, input.lat, input.lng);
  if (!text) return fallback;

  const metadata = businessCardFromText(text, ctx.allBusinesses);
  return {
    content: text,
    type: metadata ? 'CARD' : fallback.type,
    metadata,
    suggestions: suggestionsFor(input.content, Boolean(metadata)),
    options: fallback.options,
    orderDraft: fallback.orderDraft,
  };
}
