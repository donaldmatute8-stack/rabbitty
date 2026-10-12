import { BleClient, numbersToDataView } from "@capacitor-community/bluetooth-le";
import type { PrintDevice, PrintTransport } from "../types";

const BLE_PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb", // Common POS / MTP thermal printer service
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // Xprinter / Goojprt BLE service
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC / Microchip Transparent UART
  "0000e0ff-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
];

export class NativeBLETransport implements PrintTransport {
  readonly id = "native-ble";
  readonly name = "Capacitor Native BLE";
  readonly type = "BLE" as const;

  private connectedDevice: PrintDevice | null = null;
  private writeServiceUuid: string | null = null;
  private writeCharacteristicUuid: string | null = null;
  private isInitialized = false;

  isSupported(): boolean {
    if (typeof window === "undefined") return false;
    const cap = (window as any).Capacitor;
    return Boolean(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());
  }

  isConnected(): boolean {
    return this.connectedDevice !== null && this.writeCharacteristicUuid !== null;
  }

  getConnectedDevice(): PrintDevice | null {
    return this.connectedDevice;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await BleClient.initialize();
      this.isInitialized = true;
    }
  }

  async connect(): Promise<{ success: boolean; device?: PrintDevice; error?: string }> {
    if (!this.isSupported()) {
      return {
        success: false,
        error: "Capacitor Native BLE solo está disponible cuando se ejecuta dentro de la App Nativa (iOS/Android).",
      };
    }

    try {
      await this.ensureInitialized();

      // Prompt native BLE device selector dialog
      const device = await BleClient.requestDevice({
        services: BLE_PRINTER_SERVICES,
        optionalServices: BLE_PRINTER_SERVICES,
      });

      if (!device || !device.deviceId) {
        return { success: false, error: "No se seleccionó ningún dispositivo." };
      }

      // Connect to GATT server
      await BleClient.connect(device.deviceId, () => {
        this.connectedDevice = null;
        this.writeServiceUuid = null;
        this.writeCharacteristicUuid = null;
      });

      // Discover services and find write characteristic
      const services = await BleClient.getServices(device.deviceId);
      let foundService: string | null = null;
      let foundChar: string | null = null;

      for (const service of services) {
        for (const char of service.characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            foundService = service.uuid;
            foundChar = char.uuid;
            break;
          }
        }
        if (foundChar) break;
      }

      if (!foundService || !foundChar) {
        await BleClient.disconnect(device.deviceId).catch(() => {});
        return {
          success: false,
          error: "No se encontró canal de escritura ESC/POS compatible en este dispositivo BLE.",
        };
      }

      this.writeServiceUuid = foundService;
      this.writeCharacteristicUuid = foundChar;
      this.connectedDevice = {
        id: device.deviceId,
        name: device.name || "Rabbitty POS Printer",
        type: "BLE",
      };

      return {
        success: true,
        device: this.connectedDevice,
      };
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("cancelled")) {
        return { success: false, error: "Selección cancelada." };
      }
      return {
        success: false,
        error: msg || "Error al conectar por BLE nativo",
      };
    }
  }

  async disconnect(): Promise<void> {
    if (this.connectedDevice) {
      try {
        await BleClient.disconnect(this.connectedDevice.id);
      } catch {}
      this.connectedDevice = null;
      this.writeServiceUuid = null;
      this.writeCharacteristicUuid = null;
    }
  }

  async print(data: Uint8Array): Promise<boolean> {
    if (!this.isConnected() || !this.connectedDevice || !this.writeServiceUuid || !this.writeCharacteristicUuid) {
      throw new Error("Impresora nativa no conectada.");
    }

    const deviceId = this.connectedDevice.id;
    const serviceUuid = this.writeServiceUuid;
    const charUuid = this.writeCharacteristicUuid;

    // Chunk size: 40 bytes per MTU packet with delay to prevent thermal buffer overflow
    const CHUNK_SIZE = 40;
    for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
      const chunk = data.slice(offset, offset + CHUNK_SIZE);
      const dataView = numbersToDataView(Array.from(chunk));

      let success = false;
      let attempts = 0;

      while (!success && attempts < 4) {
        try {
          await BleClient.writeWithoutResponse(deviceId, serviceUuid, charUuid, dataView);
          success = true;
        } catch {
          try {
            await BleClient.write(deviceId, serviceUuid, charUuid, dataView);
            success = true;
          } catch {
            attempts++;
            await new Promise((r) => setTimeout(r, 150));
          }
        }
      }

      if (!success) {
        throw new Error("La impresora térmica BLE no pudo recibir el paquete de datos.");
      }

      // Small pause between BLE packets
      await new Promise((r) => setTimeout(r, 25));
    }

    return true;
  }
}
