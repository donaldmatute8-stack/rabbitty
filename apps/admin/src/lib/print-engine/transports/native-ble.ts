import type { PrintDevice, PrintTransport } from "../types";

export class NativeBLETransport implements PrintTransport {
  readonly id = "native-ble";
  readonly name = "Capacitor Native BLE";
  readonly type = "BLE" as const;

  private connectedDevice: PrintDevice | null = null;

  isSupported(): boolean {
    if (typeof window === "undefined") return false;
    const cap = (window as any).Capacitor;
    return !!(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());
  }

  isConnected(): boolean {
    return this.connectedDevice !== null;
  }

  getConnectedDevice(): PrintDevice | null {
    return this.connectedDevice;
  }

  async connect(): Promise<{ success: boolean; device?: PrintDevice; error?: string }> {
    if (!this.isSupported()) {
      return {
        success: false,
        error: "Capacitor Native BLE solo está disponible cuando se ejecuta dentro de la App Nativa (iOS/Android).",
      };
    }

    // Placeholder bridge for @capacitor-community/bluetooth-le plugin
    try {
      // In Phase 2/3: BleClient.initialize() -> BleClient.requestDevice() -> BleClient.connect()
      return {
        success: false,
        error: "Plugin nativo BLE en proceso de inicialización de Capacitor shell.",
      };
    } catch (e: any) {
      return { success: false, error: e?.message || "Error al conectar por BLE nativo" };
    }
  }

  async disconnect(): Promise<void> {
    this.connectedDevice = null;
  }

  async print(data: Uint8Array): Promise<boolean> {
    if (!this.isConnected()) {
      throw new Error("Impresora nativa no conectada.");
    }
    // In Phase 2/3: BleClient.writeWithoutResponse(deviceId, service, characteristic, data)
    return true;
  }
}
