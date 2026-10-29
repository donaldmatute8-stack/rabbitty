/**
 * ── Rabbitty Unified Scanner Resolver ──
 * Fuente única de la verdad para interpretar, decodificar y resolver
 * cualquier código escaneado en el ecosistema Rabbitty:
 * - Códigos QR estándar (rabbitty://pay, claimToken, tableId, magic-link)
 * - Identificadores de usuario (@handle, UUID, teléfono, telegramId)
 * - Pósters de afiliados y promociones (download?ref=..., /affiliate/...)
 * - Rabbitty Code neón de 6 dígitos decodificado por cámara o canvas
 */

export interface ScanUser {
  id: string;
  username?: string | null;
  name: string;
  handle: string;
}

export interface ScanBusiness {
  id: string;
  name: string;
  checkIn?: boolean;
}

export interface ScanMagicLink {
  token: string;
  sid: string;
}

export interface ScanTable {
  tableId: string;
  branchId?: string;
}

export interface ScanQrLogin {
  qrToken: string;
  sessionId: string;
}

export type ScanType =
  | 'payment_intent'
  | 'user'
  | 'business'
  | 'magic_link'
  | 'claim'
  | 'table'
  | 'qrlogin'
  | 'url'
  | 'raw'
  | 'unrecognized';

export interface ScanResolution {
  success: boolean;
  type: ScanType;
  raw: string;
  user?: ScanUser;
  business?: ScanBusiness;
  magicLink?: ScanMagicLink;
  claimToken?: string;
  table?: ScanTable;
  qrLogin?: ScanQrLogin;
  intent?: string;
  url?: string;
  error?: string;
}

/**
 * Resuelve cualquier payload escaneado (texto de QR estándar, URL, @usuario o código numérico).
 * Consulta el resolver del servidor de forma transparente cuando se requiere validación DB.
 */
export async function resolveScannedPayload(input: string | number): Promise<ScanResolution> {
  const isNumber = typeof input === 'number' || (typeof input === 'string' && /^\d{5,6}$/.test(input.trim()));
  const rawText = typeof input === 'string' ? input.trim() : String(input);

  if (!rawText && typeof input !== 'number') {
    return { success: false, type: 'unrecognized', raw: '', error: 'Código vacío' };
  }

  // ── 1. Código numérico de 6 dígitos (RabbittyCode barras de neón o teclado) ──
  if (isNumber) {
    const codeNum = Number(input);
    try {
      const res = await fetch('/api/rabbitty-code/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeNum }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.success) {
        if (data.type === 'user' && data.user) {
          return { success: true, type: 'user', raw: rawText, user: data.user };
        }
        if (data.type === 'business' && data.businessId) {
          return {
            success: true,
            type: 'business',
            raw: rawText,
            business: { id: data.businessId, name: data.name || 'Negocio Afiliado', checkIn: data.checkIn },
          };
        }
        if (data.type === 'qrlogin' && data.qrToken) {
          return {
            success: true,
            type: 'qrlogin',
            raw: rawText,
            qrLogin: { qrToken: data.qrToken, sessionId: data.sessionId },
          };
        }
      }
    } catch (err) {
      console.warn('[ScannerResolver] Error resolving numeric code:', err);
    }
  }

  // ── 2. Protocolo nativo: rabbitty://pay ──
  if (/^rabbitty:\/\/pay/i.test(rawText)) {
    try {
      const norm = rawText.replace(/^rabbitty:\/\/pay\??/i, '');
      const params = new URLSearchParams(norm);
      const intent = params.get('intent');
      const to = params.get('to');

      if (intent) {
        return { success: true, type: 'payment_intent', raw: rawText, intent };
      }
      if (to) {
        const cleanedTo = decodeURIComponent(to).trim();
        // Resolución SERVER: el id devuelto es el UUID real (el mint lo exige).
        // Si el servidor no responde, entregamos el handle con flag para que el
        // consumidor no lo use como id sin resolver.
        try {
          const res = await fetch('/api/rabbitty-code/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: rawText }),
          });
          const data = await res.json().catch(() => ({}));
          if (data?.success && data.type === 'user' && data.user) {
            return { success: true, type: 'user', raw: rawText, user: data.user };
          }
          if (data?.success && data.type === 'business' && data.businessId) {
            return { success: true, type: 'business', raw: rawText, business: { id: data.businessId, name: data.name || 'Negocio Afiliado' } };
          }
        } catch (err) {
          console.warn('[ScannerResolver] pay?to resolve failed:', err);
        }
        return {
          success: false,
          type: 'user',
          raw: rawText,
          error: 'No se pudo resolver al usuario (sin conexión o no registrado)',
          user: { id: cleanedTo, handle: cleanedTo.startsWith('@') ? cleanedTo : `@${cleanedTo}`, name: cleanedTo },
        };
      }
    } catch {}
  }

  // ── 3. Magic Link de sincronización de terminal (iPad / Mostrador) ──
  if (rawText.includes('/magic-link') && rawText.includes('token=') && rawText.includes('sid=')) {
    try {
      const url = new URL(rawText, typeof window !== 'undefined' ? window.location.origin : 'https://rabbitty.me');
      const token = url.searchParams.get('token');
      const sid = url.searchParams.get('sid');
      if (token && sid) {
        return { success: true, type: 'magic_link', raw: rawText, magicLink: { token, sid } };
      }
    } catch {}
  }

  // ── 4. Reclamo de ticket / QR de caja (claimToken) ──
  if (rawText.includes('claimToken=') || rawText.includes('claim=')) {
    try {
      const params = new URLSearchParams(rawText.includes('?') ? rawText.split('?')[1] : rawText);
      const token = params.get('claimToken') || params.get('claim');
      if (token) {
        return { success: true, type: 'claim', raw: rawText, claimToken: token };
      }
    } catch {}
  }

  // ── 5. Mesa / Restaurante (tableId) ──
  if (rawText.includes('tableId=') || rawText.includes('/qr/table/')) {
    try {
      let tableId = '';
      let branchId: string | undefined = undefined;

      if (rawText.includes('/qr/table/')) {
        const match = rawText.match(/\/qr\/table\/([0-9a-f-]{10,})/i);
        if (match) tableId = match[1];
      }
      if (!tableId) {
        const params = new URLSearchParams(rawText.includes('?') ? rawText.split('?')[1] : rawText);
        tableId = params.get('tableId') || '';
        branchId = params.get('branchId') || params.get('branch') || undefined;
      }

      if (tableId) {
        return { success: true, type: 'table', raw: rawText, table: { tableId, branchId } };
      }
    } catch {}
  }

  // ── 6. Check-in de sucursal / mostrador directo (branchId sin mesa) ──
  if (rawText.includes('branchId=') || rawText.includes('branch=')) {
    try {
      const params = new URLSearchParams(rawText.includes('?') ? rawText.split('?')[1] : rawText);
      const branchId = params.get('branchId') || params.get('branch');
      if (branchId && !params.get('tableId') && !params.get('claimToken')) {
        const res = await fetch('/api/rabbitty-code/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: rawText }),
        });
        const d = await res.json().catch(() => ({}));
        if (d?.success && d.businessId) {
          return {
            success: true,
            type: 'business',
            raw: rawText,
            business: { id: d.businessId, name: d.name || 'Negocio Afiliado', checkIn: true },
          };
        }
      }
    } catch {}
  }

  // ── 7. Handle de usuario directo (@usuario o UUID) ──
  if (rawText.startsWith('@') || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawText)) {
    try {
      const res = await fetch('/api/rabbitty-code/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText }),
      });
      const d = await res.json().catch(() => ({}));
      if (d?.success && d.type === 'user' && d.user) {
        return { success: true, type: 'user', raw: rawText, user: d.user };
      }
    } catch {}
  }

  // ── 8. Consulta de respaldo en el backend para cualquier texto / URL ──
  try {
    const res = await fetch('/api/rabbitty-code/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: rawText }),
    });
    const d = await res.json().catch(() => ({}));
    if (d?.success) {
      if (d.type === 'user' && d.user) {
        return { success: true, type: 'user', raw: rawText, user: d.user };
      }
      if (d.type === 'business' && d.businessId) {
        return {
          success: true,
          type: 'business',
          raw: rawText,
          business: { id: d.businessId, name: d.name || 'Negocio Afiliado', checkIn: d.checkIn },
        };
      }
      if (d.type === 'url' && d.url) {
        return { success: true, type: 'url', raw: rawText, url: d.url };
      }
    }
  } catch (err) {
    console.warn('[ScannerResolver] Fallback lookup error:', err);
  }

  // ── 9. URL genérica o texto crudo ──
  if (rawText.startsWith('http://') || rawText.startsWith('https://')) {
    return { success: true, type: 'url', raw: rawText, url: rawText };
  }

  return { success: true, type: 'raw', raw: rawText };
}

