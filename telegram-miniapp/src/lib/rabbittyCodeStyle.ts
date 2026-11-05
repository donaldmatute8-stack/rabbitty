/**
 * Estilo del Rabbitty Code que se muestra en "Mi Código".
 *
 * - 'simple': QR estándar con identidad (lectura cómoda, cualquier cámara).
 * - 'neon':   RabbittyCode histórico (backup; decodificación propietaria).
 *
 * El neón se conserva completo en `components/ui/RabbittyCode.tsx` y
 * `lib/rabbittyCodeCodec.ts`; cambiar esta constante lo restaura al instante.
 */
export const RABBITTY_CODE_STYLE: 'simple' | 'neon' = 'simple';
