// Web Bluetooth ESC/POS Direct Print Helper for Rabbitty OS

// Common thermal printer BLE service UUIDs
const BLE_PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb", // Common POS / MTP thermal printer service
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // Xprinter / Goojprt BLE service
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC / Microchip Transparent UART
  "0000e0ff-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
];

export interface BluetoothDeviceState {
  connected: boolean;
  deviceName: string | null;
  deviceId: string | null;
}

let activeCharacteristic: any = null;
let activeDevice: any = null;

export async function connectBluetoothPrinter(): Promise<{ success: boolean; deviceName: string; error?: string }> {
  if (typeof window === "undefined" || !(navigator as any).bluetooth) {
    throw new Error("Tu navegador no soporta Web Bluetooth. Usa Google Chrome, Edge o Bluefy (iOS).");
  }

  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [
        { namePrefix: "POS" },
        { namePrefix: "MTP" },
        { namePrefix: "RPP" },
        { namePrefix: "Printer" },
        { namePrefix: "Rabbitty" },
        { namePrefix: "YICHIP" },
      ],
      optionalServices: BLE_PRINTER_SERVICES,
    });

    const server = await device.gatt.connect();

    // Scan for available thermal write characteristic
    let writeChar: any = null;
    for (const serviceUuid of BLE_PRINTER_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writeChar = char;
            break;
          }
        }
        if (writeChar) break;
      } catch {
        continue;
      }
    }

    if (!writeChar) {
      // Fallback: try discovering any service
      const services = await server.getPrimaryServices();
      for (const s of services) {
        const chars = await s.getCharacteristics();
        for (const c of chars) {
          if (c.properties.write || c.properties.writeWithoutResponse) {
            writeChar = c;
            break;
          }
        }
        if (writeChar) break;
      }
    }

    if (!writeChar) {
      throw new Error("No se encontró canal de escritura ESC/POS en el dispositivo");
    }

    activeDevice = device;
    activeCharacteristic = writeChar;

    device.addEventListener("gattserverdisconnected", () => {
      activeDevice = null;
      activeCharacteristic = null;
    });

    return {
      success: true,
      deviceName: device.name || "Rabbitty POS Printer",
    };
  } catch (err: any) {
    return {
      success: false,
      deviceName: "",
      error: err.message || "Error al conectar por Bluetooth",
    };
  }
}

export function isBluetoothConnected(): boolean {
  return !!(activeDevice && activeDevice.gatt && activeDevice.gatt.connected && activeCharacteristic);
}

export function getConnectedBluetoothDeviceName(): string | null {
  return activeDevice?.name || null;
}

export async function disconnectBluetoothPrinter(): Promise<void> {
  if (activeDevice && activeDevice.gatt) {
    try {
      activeDevice.gatt.disconnect();
    } catch {}
  }
  activeDevice = null;
  activeCharacteristic = null;
}

// Chunks binary buffer into BLE MTU sized packets (~20 to 100 bytes)
export async function sendEscPosToBluetooth(data: Uint8Array): Promise<boolean> {
  if (!activeCharacteristic) {
    throw new Error("Impresora Bluetooth no conectada");
  }

  const CHUNK_SIZE = 64;
  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    const chunk = data.slice(offset, offset + CHUNK_SIZE);
    if (activeCharacteristic.writeValueWithResponse) {
      await activeCharacteristic.writeValueWithResponse(chunk);
    } else {
      await activeCharacteristic.writeValue(chunk);
    }
  }
  return true;
}
