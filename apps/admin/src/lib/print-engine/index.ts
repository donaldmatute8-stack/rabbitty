import { WebBluetoothTransport } from "./transports/web-bluetooth";
import { NativeBLETransport } from "./transports/native-ble";
import { generateEscPosTicketPayload } from "./payload-builder";
import type { PrintDevice, PrinterDiagnostics, PrintTransport } from "./types";

export * from "./types";
export * from "./payload-builder";

export class PrintEngine {
  private static instance: PrintEngine;
  private transports: PrintTransport[] = [];
  private activeTransport: PrintTransport | null = null;
  private listeners: Array<(state: { connected: boolean; device: PrintDevice | null }) => void> = [];

  private constructor() {
    // Register available transports in order of priority:
    // Native BLE has priority if running inside Capacitor
    const nativeTransport = new NativeBLETransport();
    const webTransport = new WebBluetoothTransport();

    this.transports = [nativeTransport, webTransport];
    this.selectDefaultTransport();
  }

  static getInstance(): PrintEngine {
    if (!PrintEngine.instance) {
      PrintEngine.instance = new PrintEngine();
    }
    return PrintEngine.instance;
  }

  private selectDefaultTransport(): void {
    const supported = this.transports.find((t) => t.isSupported());
    this.activeTransport = supported || this.transports[1]; // fallback to web-bluetooth
  }

  getActiveTransport(): PrintTransport | null {
    if (!this.activeTransport || !this.activeTransport.isSupported()) {
      this.selectDefaultTransport();
    }
    return this.activeTransport;
  }

  isConnected(): boolean {
    return !!this.activeTransport?.isConnected();
  }

  getConnectedDevice(): PrintDevice | null {
    return this.activeTransport?.getConnectedDevice() || null;
  }

  onStateChange(cb: (state: { connected: boolean; device: PrintDevice | null }) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notifyListeners(): void {
    const state = {
      connected: this.isConnected(),
      device: this.getConnectedDevice(),
    };
    for (const l of this.listeners) {
      try {
        l(state);
      } catch (e) {
        console.error("PrintEngine state listener error:", e);
      }
    }
  }

  async connect(): Promise<{ success: boolean; deviceName: string; error?: string }> {
    const transport = this.getActiveTransport();
    if (!transport) {
      return { success: false, deviceName: "", error: "No hay transporte de impresión disponible." };
    }

    const res = await transport.connect();
    this.notifyListeners();

    if (res.success && res.device) {
      return {
        success: true,
        deviceName: res.device.name,
      };
    }

    return {
      success: false,
      deviceName: "",
      error: res.error || "No se pudo conectar a la impresora.",
    };
  }

  async disconnect(): Promise<void> {
    if (this.activeTransport) {
      await this.activeTransport.disconnect();
      this.notifyListeners();
    }
  }

  async print(data: Uint8Array): Promise<boolean> {
    const transport = this.getActiveTransport();
    if (!transport || !transport.isConnected()) {
      throw new Error("Impresora no conectada.");
    }
    return await transport.print(data);
  }

  async printTicket(data: any, is58mm: boolean = true): Promise<boolean> {
    const payload = await generateEscPosTicketPayload(data, is58mm);
    return await this.print(payload);
  }

  async printTestTicket(): Promise<boolean> {
    const testData = {
      restaurantName: "Rabbitty Demo POS",
      orderNumber: "TEST-01",
      date: new Date().toLocaleString("es-MX"),
      orderType: "Prueba de Hardware",
      items: [
        { name: "Prueba de Impresión ESC/POS", quantity: 1, totalPrice: 0 },
        { name: "Conexión Bluetooth BLE", quantity: 1, totalPrice: 0 },
      ],
      subtotal: 0,
      tax: 0,
      total: 0,
      ticketFooter: "Hardware verificado exitosamente.",
    };
    return await this.printTicket(testData, true);
  }
}

export const printEngine = PrintEngine.getInstance();

export function diagnosePrinterConnection(): PrinterDiagnostics {
  if (typeof window === "undefined") {
    return {
      secure: false,
      topLevel: false,
      userAgent: "",
      browser: "other",
      isIOS: false,
      isIPadOS: false,
      isAndroid: false,
      os: "Server",
      protocol: "",
      host: "",
      webBluetooth: false,
      isNative: false,
      status: "HTTP",
      recommendation: "Ejecutando en servidor.",
    };
  }

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

  const cap = (window as any).Capacitor;
  const isNative = !!(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());

  let browser: PrinterDiagnostics["browser"] = "other";
  if (/Edg\//.test(ua)) browser = "edge";
  else if (/Chrome\//.test(ua) && !/CriOS|FxiOS/.test(ua)) browser = "chrome";
  else if (/Firefox|FxiOS/i.test(ua)) browser = "firefox";
  else if (/Safari\//.test(ua)) browser = "safari";

  const os = isWindows
    ? "Windows"
    : isMac
    ? "macOS"
    : isIOS
    ? isIPadOS
      ? "iPadOS"
      : "iOS"
    : isAndroid
    ? "Android"
    : platform || "Unknown";

  const secure = window.isSecureContext ?? false;
  const topLevel = window.top === window;
  const webBluetooth = "bluetooth" in navigator;

  let status: PrinterDiagnostics["status"];
  let recommendation: string;

  if (isNative) {
    status = "NATIVE_READY";
    recommendation = "Ejecutando en App Nativa Rabbitty POS con soporte directo Bluetooth BLE.";
  } else if (!secure) {
    status = "HTTP";
    recommendation =
      "Abre el admin en HTTPS (https://admin.rabbitty.me). Web Bluetooth requiere una conexión segura.";
  } else if (!topLevel) {
    status = "BLOCKED_BY_CONTEXT";
    recommendation =
      "La página corre dentro de un iframe/webview de otra app. Ábrela en una pestaña directa del navegador para conectar por Bluetooth.";
  } else if (isIOS && !webBluetooth) {
    status = "BLOCKED_BY_BROWSER";
    recommendation =
      `En ${os} ningún navegador web soporta Web Bluetooth directamente. ` +
      "Usa la app nativa de Rabbitty POS en iPad/iPhone para imprimir directamente.";
  } else if (!webBluetooth) {
    status = "BLOCKED_BY_BROWSER";
    recommendation = `Tu navegador (${browser}) no expone Web Bluetooth. Usa Chrome o Edge en escritorio/Android o la app nativa.`;
  } else {
    status = "BLE_ONLY";
    recommendation =
      "Web Bluetooth disponible. Solo verás impresoras BLE (GATT). Para impresoras Bluetooth Classic usa la app nativa o el modo USB.";
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
    isNative,
    status,
    recommendation,
  };
}
