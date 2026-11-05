import { registerPlugin } from '@capacitor/core';

/**
 * Rabbitty Scanner (iOS) — plugin SPM propio.
 *
 * Cámara nativa detrás del WebView + Vision para QR. Sustituye a ML Kit en iOS
 * sin migrar a CocoaPods, conservando overlay, tracking, torch y zoom.
 */
const RabbittyScanner = registerPlugin('RabbittyScanner', {
  web: () => import('./web.js').then((m) => new m.RabbittyScannerWeb()),
});

export { RabbittyScanner };
