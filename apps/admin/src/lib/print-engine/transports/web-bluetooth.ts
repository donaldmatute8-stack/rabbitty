import type { PrintDevice, PrintTransport } from "../types";

const BLE_PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb", // Common POS / MTP thermal printer service
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // Xprinter / Goojprt BLE service
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC / Microchip Transparent UART
  "0000e0ff-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
];

export class WebBluetoothTransport implements PrintTransport {
  readonly id = "web-bluetooth";
  readonly name = "Web Bluetooth (BLE)";
  readonly type = "BLE" as const;

  private activeDevice: any = null;
  private activeCharacteristic: any = null;

  isSupported(): boolean {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;
    return "bluetooth" in navigator;
  }

  isConnected(): boolean {
    return !!(
      this.activeDevice &&
      this.activeDevice.gatt &&
      this.activeDevice.gatt.connected &&
      this.activeCharacteristic
    );
  }

  getConnectedDevice(): PrintDevice | null {
    if (!this.isConnected()) return null;
    return {
      id: this.activeDevice.id || "ble-device",
      name: this.activeDevice.name || "Rabbitty POS Printer",
      type: "BLE",
    };
  }

  async connect(): Promise<{ success: boolean; device?: PrintDevice; error?: string }> {
    if (!this.isSupported()) {
      const isSecure =
        typeof window !== "undefined" &&
        (window.location.protocol === "https:" ||
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1");

      if (!isSecure) {
        return {
          success: false,
          error: "Web Bluetooth requiere HTTPS o localhost.",
        };
      }
      return {
        success: false,
        error: "Tu navegador no soporta Web Bluetooth. Usa Chrome o Edge.",
      };
    }

    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLE_PRINTER_SERVICES,
      });

      const server = await device.gatt.connect();

      // Scan for thermal write characteristic
      let writeChar: any = null;
      const services = await server.getPrimaryServices();

      for (const s of services) {
        try {
          const chars = await s.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              writeChar = c;
              break;
            }
          }
          if (writeChar) break;
        } catch {
          continue;
        }
      }

      if (!writeChar) {
        throw new Error(
          "No se encontró canal de escritura ESC/POS en este dispositivo."
        );
      }

      this.activeDevice = device;
      this.activeCharacteristic = writeChar;

      device.addEventListener("gattserverdisconnected", () => {
        this.activeDevice = null;
        this.activeCharacteristic = null;
      });

      const printDevice: PrintDevice = {
        id: device.id || "ble-printer",
        name: device.name || "Rabbitty POS Printer",
        type: "BLE",
      };

      return {
        success: true,
        device: printDevice,
      };
    } catch (err: any) {
      if (
        err.name === "NotFoundError" ||
        err.name === "AbortError" ||
        err.message?.toLowerCase().includes("cancel") ||
        err.message?.toLowerCase().includes("cancelled")
      ) {
        return { success: false, error: "Selección cancelada." };
      }
      return {
        success: false,
        error: err.message || "Error al conectar por Bluetooth",
      };
    }
  }

  async disconnect(): Promise<void> {
    if (this.activeDevice && this.activeDevice.gatt) {
      try {
        this.activeDevice.gatt.disconnect();
      } catch {}
    }
    this.activeDevice = null;
    this.activeCharacteristic = null;
  }

  async print(data: Uint8Array): Promise<boolean> {
    if (!this.activeCharacteristic) {
      throw new Error("Impresora Bluetooth no conectada");
    }

    // Chunk into BLE MTU sized packets (~40 bytes) with backpressure pauses
    const CHUNK_SIZE = 40;
    for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
      const chunk = data.slice(offset, offset + CHUNK_SIZE);
      let success = false;
      let attempts = 0;

      while (!success && attempts < 4) {
        try {
          if (
            this.activeCharacteristic.properties.writeWithoutResponse &&
            this.activeCharacteristic.writeValueWithoutResponse
          ) {
            await this.activeCharacteristic.writeValueWithoutResponse(chunk);
          } else if (this.activeCharacteristic.writeValueWithResponse) {
            await this.activeCharacteristic.writeValueWithResponse(chunk);
          } else {
            await this.activeCharacteristic.writeValue(chunk);
          }
          success = true;
        } catch (err) {
          attempts++;
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      if (!success) {
        throw new Error("La impresora Bluetooth saturó su memoria y dejó de responder.");
      }

      await new Promise((r) => setTimeout(r, 30));
    }

    return true;
  }
}
