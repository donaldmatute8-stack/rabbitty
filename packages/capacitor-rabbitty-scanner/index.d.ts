export interface RabbittyScanResult {
  rawValue: string;
  format?: string;
  /** Cuatro esquinas [x, y] en puntos de la vista, listas para el overlay. */
  cornerPoints?: Array<[number, number]>;
}

export interface BarcodesScannedEvent {
  barcodes: RabbittyScanResult[];
}

export interface RabbittyScannerPlugin {
  /** Inicia la cámara nativa detrás del WebView. */
  start(options?: { formats?: string[] }): Promise<void>;
  /** Detiene la cámara y retira la capa de preview. */
  stop(): Promise<void>;
  enableTorch(): Promise<void>;
  disableTorch(): Promise<void>;
  isTorchAvailable(): Promise<{ available: boolean }>;
  setZoomRatio(options: { zoomRatio: number }): Promise<void>;
  getMaxZoomRatio(): Promise<{ zoomRatio: number }>;
  /** Decodifica un QR desde una imagen local (galería). */
  scanImage(options: { path: string }): Promise<{ barcodes: RabbittyScanResult[] }>;
  addListener(
    eventName: 'barcodesScanned',
    listenerFunc: (event: BarcodesScannedEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  removeAllListeners(): Promise<void>;
}

export declare const RabbittyScanner: RabbittyScannerPlugin;
