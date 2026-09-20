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

export interface PrinterDiagnostics {
  secure: boolean;
  topLevel: boolean;
  userAgent: string;
  browser: "chrome" | "edge" | "safari" | "firefox" | "other";
  isIOS: boolean;
  isIPadOS: boolean;
  isAndroid: boolean;
  os: string;
  protocol: string;
  host: string;
  webBluetooth: boolean;
  status: "OK" | "HTTP" | "BLOCKED_BY_CONTEXT" | "BLOCKED_BY_BROWSER" | "BLE_ONLY";
  recommendation: string;
}

let activeCharacteristic: any = null;
let activeDevice: any = null;

// Web Bluetooth solo puede ver periféricos BLE (GATT). Las impresoras térmicas
// de bajo costo suelen ser Bluetooth Classic (SPP/ESC/POS) y JAMÁS aparecerán
// en el picker del navegador. Esta función arma el diagnóstico exacto.
export function diagnosePrinterConnection(): PrinterDiagnostics {
  const ua = navigator.userAgent;
  const uaData = (navigator as any).userAgentData;
  const platform: string = uaData?.platform || (navigator as any).platform || "";

  const isIPadOS =
    /iPad/.test(ua) ||
    ((platform === "MacIntel" || platform === "macOS") && (navigator as any).maxTouchPoints > 1);
  const isIOS = isIPadOS || /iPhone/.test(ua) || /iPod/.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isMac = platform.includes("Mac") && !isIPadOS;
  const isWindows = platform.includes("Win");

  let browser: PrinterDiagnostics["browser"] = "other";
  if (/Edg\//.test(ua)) browser = "edge";
  else if (/Chrome\//.test(ua) && !/CriOS|FxiOS/.test(ua)) browser = "chrome";
  else if (/Firefox|FxiOS/i.test(ua)) browser = "firefox";
  else if (/Safari\//.test(ua)) browser = "safari";

  const os = isWindows ? "Windows" : isMac ? "macOS" : isIOS ? (isIPadOS ? "iPadOS" : "iOS") : isAndroid ? "Android" : platform || "Unknown";

  const secure = window.isSecureContext ?? false;
  const topLevel = window.top === window;
  const webBluetooth = "bluetooth" in navigator;

  let status: PrinterDiagnostics["status"];
  let recommendation: string;

  if (!secure) {
    status = "HTTP";
    recommendation =
      "Abre el admin en HTTPS (https://admin.rabbitty.me). Web Bluetooth (y la mayoría de APIs del navegador) requieren una conexión segura.";
  } else if (!topLevel) {
    status = "BLOCKED_BY_CONTEXT";
    recommendation =
      "La página corre dentro de un iframe/webview de otra app. Ábrela en una pestaña directa del navegador para conectar por Bluetooth.";
  } else if (isIOS && !webBluetooth) {
    status = "BLOCKED_BY_BROWSER";
    recommendation =
      `En ${os} ningún navegador soporta Web Bluetooth: aunque veas "Chrome"/"Edge", en iPhone/iPad todos usan el motor de Safari (WebKit), no hay excepción. ` +
      "Si tu impresora es BLE usa la app Bluefy. Si es Bluetooth Classic (POS-58/YICHIP), usa el modo USB/Mac Bridge (Rabbitty POS Printer) desde la máquina de caja o una impresora Wi-Fi.";
  } else if (!webBluetooth) {
    status = "BLOCKED_BY_BROWSER";
    recommendation = `Tu navegador (${browser}) no expone Web Bluetooth. Usa Chrome o Edge de escritorio (o Android) en una pestaña HTTPS normal.`;
  } else {
    status = "BLE_ONLY";
    recommendation =
      "Web Bluetooth disponible. Solo verás impresoras BLE (GATT): las Bluetooth Classic/SPP (p.ej. YICHIP POS-58) nunca aparecen en el selector. " +
      "Si no ves tu impresora, usa el modo USB/Mac Bridge o una impresora Wi-Fi/red.";
  }

  return {
    secure,
    topLevel,
    userAgent: ua,
    browser,
    isIOS,
    isIPadOS,
    isAndroid,
    os,
    protocol: window.location.protocol,
    host: window.location.hostname,
    webBluetooth,
    status,
    recommendation,
  };
}

export async function connectBluetoothPrinter(): Promise<{ success: boolean; deviceName: string; error?: string }> {
  if (typeof window === "undefined") {
    throw new Error("Web Bluetooth solo funciona en el navegador.");
  }

  // Distinguish: browser lacks BT support vs context is not secure (HTTP)
  if (!(navigator as any).bluetooth) {
    const isSecure =
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (!isSecure) {
      throw new Error(
        "Web Bluetooth requiere HTTPS. Abre el admin en https:// o en localhost para conectar impresoras Bluetooth."
      );
    }
    throw new Error(
      "Tu navegador no soporta Web Bluetooth. Usa Google Chrome (escritorio/Android) o Edge. En iOS usa Bluefy."
    );
  }

  try {
    // We use acceptAllDevices: true instead of namePrefix filters because 
    // some iOS Bluetooth Web wrappers (like Bluefy) fail or return early 
    // when providing complex filter arrays. The native picker will show all
    // nearby devices, which is more reliable.
    const device = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
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
      throw new Error(
        "No se encontró canal de escritura ESC/POS en este dispositivo. Verifica que sea una impresora térmica Bluetooth."
      );
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
    // User cancelled the picker → soft failure, no scary error
    if (
      err.name === "NotFoundError" ||
      err.name === "AbortError" ||
      err.message?.toLowerCase().includes("cancel") ||
      err.message?.toLowerCase().includes("cancelled")
    ) {
      return { success: false, deviceName: "", error: "Selección cancelada." };
    }
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

  // Reducido a 20 bytes (BLE estandar MTU seguro) y con delay para evitar overflows en impresoras baratas
  const CHUNK_SIZE = 20;
  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    const chunk = data.slice(offset, offset + CHUNK_SIZE);
    if (activeCharacteristic.writeValueWithResponse) {
      await activeCharacteristic.writeValueWithResponse(chunk);
    } else {
      await activeCharacteristic.writeValue(chunk);
    }
    // Delay de 20ms para que Bluefy y la impresora digieran el paquete
    await new Promise(r => setTimeout(r, 20));
  }
  return true;
}
