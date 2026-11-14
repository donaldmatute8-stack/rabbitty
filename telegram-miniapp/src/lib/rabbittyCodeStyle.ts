/**
 * Estilo del Rabbitty Code que se muestra en "Mi Código".
 *
 * - 'simple': QR estándar con identidad (lectura cómoda, cualquier cámara).
 * - 'neon':   RabbittyCode histórico (backup; decodificación propietaria).
 *
 * El neón se conserva completo en `components/ui/RabbittyCode.tsx` y
 * `lib/rabbittyCodeCodec.ts`; cambiar esta constante lo restaura al instante.
 */
/**
 * Diseño del código QR propio:
 *  - 'glass'    → tarjeta de cristal, QR protagonista (opción A)
 *  - 'simple'   → réplica del diseño de Telegram
 *  - 'neon'     → RabbittyCode (holograma neón)
 * Cambiar esta línea revierte el diseño (1 línea).
 */
export const RABBITTY_CODE_STYLE: 'glass' | 'simple' | 'neon' = 'glass';
