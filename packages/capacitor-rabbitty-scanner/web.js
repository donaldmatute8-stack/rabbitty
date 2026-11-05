import { WebPlugin } from '@capacitor/core';

/** Stub web: la app usa html5-qrcode fuera de iOS. */
export class RabbittyScannerWeb extends WebPlugin {
  async start() {
    throw this.unavailable('Rabbitty Scanner no está disponible en web.');
  }
  async stop() {
    /* noop */
  }
  async enableTorch() {
    throw this.unavailable('Linterna no disponible en web.');
  }
  async disableTorch() {
    /* noop */
  }
  async isTorchAvailable() {
    return { available: false };
  }
  async setZoomRatio() {
    /* noop */
  }
  async getMaxZoomRatio() {
    return { zoomRatio: 1 };
  }
  async scanImage() {
    return { barcodes: [] };
  }
}
