import { Capacitor } from '@capacitor/core';

export interface NativeScanResult {
  rawValue: string;
  cornerPoints?: Array<[number, number]>;
}

export interface NativeScannerApi {
  platform: 'ios' | 'android' | 'none';
  start(): Promise<void>;
  stop(): Promise<void>;
  enableTorch(): Promise<void>;
  disableTorch(): Promise<void>;
  isTorchAvailable(): Promise<boolean>;
  setZoom(ratio: number): Promise<void>;
  getMaxZoom(): Promise<number>;
  scanImage(path: string): Promise<string | null>;
  onBarcodes(handler: (results: NativeScanResult[]) => void): Promise<{ remove: () => Promise<void> } | null>;
}

/**
 * Adaptador del escáner nativo.
 *
 * - Android: ML Kit (`@capacitor-mlkit/barcode-scanning`).
 * - iOS: plugin SPM propio (`@rabbitty/capacitor-scanner`) con AVFoundation + Vision.
 *
 * Ambos emiten el mismo contrato (`rawValue` + `cornerPoints`) para que el
 * overlay del WebView no sepa qué plataforma está detrás.
 */
export function createNativeScanner(): NativeScannerApi | null {
  const platform = Capacitor.getPlatform();
  if (platform !== 'ios' && platform !== 'android') return null;

  if (platform === 'ios') {
    return {
      platform: 'ios',
      async start() {
        const { RabbittyScanner } = await import('@rabbitty/capacitor-scanner');
        await RabbittyScanner.start({ formats: ['QR_CODE'] });
      },
      async stop() {
        const { RabbittyScanner } = await import('@rabbitty/capacitor-scanner');
        await RabbittyScanner.stop().catch(() => undefined);
      },
      async enableTorch() {
        const { RabbittyScanner } = await import('@rabbitty/capacitor-scanner');
        await RabbittyScanner.enableTorch();
      },
      async disableTorch() {
        const { RabbittyScanner } = await import('@rabbitty/capacitor-scanner');
        await RabbittyScanner.disableTorch().catch(() => undefined);
      },
      async isTorchAvailable() {
        const { RabbittyScanner } = await import('@rabbitty/capacitor-scanner');
        const res = await RabbittyScanner.isTorchAvailable().catch(() => ({ available: false }));
        return Boolean(res.available);
      },
      async setZoom(ratio: number) {
        const { RabbittyScanner } = await import('@rabbitty/capacitor-scanner');
        await RabbittyScanner.setZoomRatio({ zoomRatio: ratio });
      },
      async getMaxZoom() {
        const { RabbittyScanner } = await import('@rabbitty/capacitor-scanner');
        const res = await RabbittyScanner.getMaxZoomRatio().catch(() => ({ zoomRatio: 1 }));
        return Math.max(1, Number(res.zoomRatio) || 1);
      },
      async scanImage(path: string) {
        const { RabbittyScanner } = await import('@rabbitty/capacitor-scanner');
        const res = await RabbittyScanner.scanImage({ path });
        return res.barcodes?.[0]?.rawValue ?? null;
      },
      async onBarcodes(handler: (results: NativeScanResult[]) => void) {
        const { RabbittyScanner } = await import('@rabbitty/capacitor-scanner');
        return RabbittyScanner.addListener('barcodesScanned', (event) => {
          handler((event.barcodes ?? []) as NativeScanResult[]);
        });
      },
    };
  }

  return {
    platform: 'android',
    async start() {
      const { BarcodeScanner, BarcodeFormat, LensFacing, Resolution } = await import(
        '@capacitor-mlkit/barcode-scanning'
      );
      await BarcodeScanner.startScan({
        formats: [BarcodeFormat.QrCode],
        lensFacing: LensFacing.Back,
        resolution: Resolution['1920x1080'],
      });
    },
    async stop() {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      await BarcodeScanner.stopScan().catch(() => undefined);
    },
    async enableTorch() {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      await BarcodeScanner.enableTorch();
    },
    async disableTorch() {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      await BarcodeScanner.disableTorch().catch(() => undefined);
    },
    async isTorchAvailable() {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      const res = await BarcodeScanner.isTorchAvailable().catch(() => ({ available: false }));
      return Boolean(res.available);
    },
    async setZoom(ratio: number) {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      await BarcodeScanner.setZoomRatio({ zoomRatio: ratio });
    },
    async getMaxZoom() {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      const res = await BarcodeScanner.getMaxZoomRatio().catch(() => ({ zoomRatio: 1 }));
      return Math.max(1, Number(res.zoomRatio) || 1);
    },
    async scanImage(path: string) {
      const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning');
      const res = await BarcodeScanner.readBarcodesFromImage({ path, formats: [BarcodeFormat.QrCode] });
      return res.barcodes?.[0]?.rawValue ?? null;
    },
    async onBarcodes(handler: (results: NativeScanResult[]) => void) {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      return BarcodeScanner.addListener('barcodesScanned', (event) => {
        handler((event.barcodes ?? []) as NativeScanResult[]);
      });
    },
  };
}
