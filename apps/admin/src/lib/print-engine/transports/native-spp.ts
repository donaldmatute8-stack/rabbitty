import type { PrintDevice, PrintTransport } from "../types";

export class NativeSPPTransport implements PrintTransport {
  readonly id = "native-spp";
  readonly name = "Bluetooth Clásico (SPP / Serial Android)";
  readonly type = "SPP" as const;

  private connectedDevice: PrintDevice | null = null;
  private disconnectListeners: Array<() => void> = [];

  isSupported(): boolean {
    if (typeof window === "undefined") return false;
    return Boolean((window as any).bluetoothSerial);
  }

  isConnected(): boolean {
    return this.connectedDevice !== null;
  }

  getConnectedDevice(): PrintDevice | null {
    return this.connectedDevice;
  }

  onDisconnect(cb: () => void): () => void {
    this.disconnectListeners.push(cb);
    return () => {
      this.disconnectListeners = this.disconnectListeners.filter((l) => l !== cb);
    };
  }

  private notifyDisconnect(): void {
    for (const l of this.disconnectListeners) {
      try {
        l();
      } catch (e) {
        console.error("Error in NativeSPPTransport disconnect listener:", e);
      }
    }
  }

  async listPairedDevices(): Promise<PrintDevice[]> {
    const serial = (window as any).bluetoothSerial;
    if (!serial || typeof serial.list !== "function") {
      return [];
    }

    return new Promise((resolve) => {
      serial.list(
        (devices: Array<{ id: string; address?: string; name?: string }>) => {
          const mapped: PrintDevice[] = (devices || []).map((d) => ({
            id: d.address || d.id,
            name: d.name || "Impresora Serial POS",
            type: "SPP",
          }));
          resolve(mapped);
        },
        () => resolve([])
      );
    });
  }

  async connect(targetDeviceId?: string): Promise<{ success: boolean; device?: PrintDevice; error?: string }> {
    if (!this.isSupported()) {
      return {
        success: false,
        error: "Bluetooth Clásico (SPP) solo está soportado en dispositivos Android nativos.",
      };
    }

    const serial = (window as any).bluetoothSerial;
    if (!serial) {
      return {
        success: false,
        error:
          "Plugin Serial SPP no detectado. En dispositivos Android, empareja la impresora térmica en Ajustes > Bluetooth (PIN 0000 o 1234) o utiliza el modo BLE.",
      };
    }

    try {
      let macAddress = targetDeviceId;

      if (!macAddress) {
        const paired = await this.listPairedDevices();
        if (paired.length === 0) {
          return {
            success: false,
            error:
              "No hay impresoras Bluetooth Clásicas vinculadas. Ve a Ajustes de Android > Bluetooth y vincula tu impresora antes de continuar.",
          };
        }
        // Auto-select printer if recognizable or take the first paired
        const matched =
          paired.find((p) => /pos|print|mtp|rpp|zj|thermal/i.test(p.name)) || paired[0];
        macAddress = matched.id;
      }

      return new Promise((resolve) => {
        serial.connect(
          macAddress,
          () => {
            this.connectedDevice = {
              id: macAddress!,
              name: "Impresora POS Clásica (SPP)",
              type: "SPP",
            };
            resolve({
              success: true,
              device: this.connectedDevice,
            });
          },
          (err: any) => {
            this.connectedDevice = null;
            this.notifyDisconnect();
            resolve({
              success: false,
              error: (typeof err === "string" ? err : err?.message) || "Error al conectar por Bluetooth SPP",
            });
          }
        );
      });
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Excepción al conectar Bluetooth Serial SPP",
      };
    }
  }

  async disconnect(): Promise<void> {
    const serial = (window as any).bluetoothSerial;
    if (serial && typeof serial.disconnect === "function") {
      await new Promise<void>((resolve) => {
        serial.disconnect(
          () => resolve(),
          () => resolve()
        );
      });
    }
    this.connectedDevice = null;
    this.notifyDisconnect();
  }

  async print(data: Uint8Array): Promise<boolean> {
    if (!this.isConnected()) {
      throw new Error("Impresora SPP no conectada.");
    }

    const serial = (window as any).bluetoothSerial;
    if (!serial || typeof serial.write !== "function") {
      throw new Error("Canal Serial SPP no disponible.");
    }

    return new Promise((resolve, reject) => {
      // Transfer sliced ArrayBuffer / Uint8Array to avoid trailing bytes
      const slice = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      serial.write(
        slice,
        () => resolve(true),
        (err: any) => reject(new Error(err?.message || "Error al escribir en socket SPP"))
      );
    });
  }
}
