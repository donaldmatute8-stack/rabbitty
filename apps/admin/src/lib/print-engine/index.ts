import { WebBluetoothTransport } from "./transports/web-bluetooth";
import { NativeBLETransport } from "./transports/native-ble";
import { NativeSPPTransport } from "./transports/native-spp";
import { generateEscPosTicketPayload } from "./payload-builder";
import type {
  PrintDevice,
  PrinterDiagnostics,
  PrintTransport,
  QueuedTicket,
  PrintEngineState,
} from "./types";

export * from "./types";
export * from "./payload-builder";
export * from "./lifecycle";

const LAST_PRINTER_STORAGE_KEY = "rabbitty_pos_last_printer";
const PRINT_QUEUE_STORAGE_KEY = "rabbitty_pos_print_queue";
const MAX_QUEUE_SIZE = 50;
const MAX_FLUSH_ATTEMPTS = 3;

export class PrintEngine {
  private static instance: PrintEngine;
  private transports: PrintTransport[] = [];
  private activeTransport: PrintTransport | null = null;
  private stateListeners: Array<(state: PrintEngineState) => void> = [];
  private queueListeners: Array<(queue: QueuedTicket[]) => void> = [];
  private isFlushingQueue = false;
  private autoReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private printMutex: Promise<unknown> = Promise.resolve();

  private constructor() {
    const nativeBle = new NativeBLETransport();
    const nativeSpp = new NativeSPPTransport();
    const webTransport = new WebBluetoothTransport();

    this.transports = [nativeBle, nativeSpp, webTransport];

    // Wire disconnect hooks for every transport
    for (const t of this.transports) {
      if (t.onDisconnect) {
        t.onDisconnect(() => {
          this.notifyState();
          this.scheduleAutoReconnect();
        });
      }
    }

    this.selectDefaultTransport();
  }

  static getInstance(): PrintEngine {
    if (!PrintEngine.instance) {
      PrintEngine.instance = new PrintEngine();
    }
    return PrintEngine.instance;
  }

  private isNativePlatform(): boolean {
    if (typeof window === "undefined") return false;
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return Boolean(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());
  }

  private selectDefaultTransport(): void {
    const supported = this.transports.find((t) => t.isSupported());
    this.activeTransport = supported || this.transports[2]; // fallback to web-bluetooth
  }

  getTransports(): PrintTransport[] {
    return this.transports;
  }

  setActiveTransport(transportId: string): boolean {
    const match = this.transports.find((t) => t.id === transportId && t.isSupported());
    if (match) {
      this.activeTransport = match;
      this.notifyState();
      return true;
    }
    return false;
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

  getState(): PrintEngineState {
    return {
      connected: this.isConnected(),
      device: this.getConnectedDevice(),
      queueCount: this.getPendingQueue().length,
      activeTransportId: this.activeTransport?.id || null,
    };
  }

  onStateChange(cb: (state: PrintEngineState) => void): () => void {
    this.stateListeners.push(cb);
    try {
      cb(this.getState());
    } catch {}
    return () => {
      this.stateListeners = this.stateListeners.filter((l) => l !== cb);
    };
  }

  onQueueChange(cb: (queue: QueuedTicket[]) => void): () => void {
    this.queueListeners.push(cb);
    try {
      cb(this.getPendingQueue());
    } catch {}
    return () => {
      this.queueListeners = this.queueListeners.filter((l) => l !== cb);
    };
  }

  private notifyState(): void {
    const state = this.getState();
    for (const l of this.stateListeners) {
      try {
        l(state);
      } catch (e) {
        console.error("PrintEngine state listener error:", e);
      }
    }
  }

  private notifyQueue(): void {
    const q = this.getPendingQueue();
    for (const l of this.queueListeners) {
      try {
        l(q);
      } catch (e) {
        console.error("PrintEngine queue listener error:", e);
      }
    }
    this.notifyState();
  }

  private saveLastDevice(device: PrintDevice, transportId: string): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        LAST_PRINTER_STORAGE_KEY,
        JSON.stringify({
          id: device.id,
          name: device.name,
          type: device.type,
          transportId,
        })
      );
    } catch {}
  }

  private getLastSavedDevice(): { id: string; name: string; type: string; transportId: string } | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(LAST_PRINTER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private scheduleAutoReconnect(): void {
    if (this.autoReconnectTimer) return;
    const isNative = this.isNativePlatform();
    const last = this.getLastSavedDevice();
    // Only attempt auto-reconnect if we are on native platform with a saved device
    if (!last || !last.id || !isNative) return;

    this.autoReconnectTimer = setTimeout(async () => {
      this.autoReconnectTimer = null;
      if (!this.isConnected()) {
        console.log("[PrintEngine] Intentando reconexión automática de impresora...");
        await this.reconnect();
      }
    }, 2500);
  }

  async connect(targetDeviceId?: string): Promise<{ success: boolean; deviceName: string; error?: string }> {
    const transport = this.getActiveTransport();
    if (!transport) {
      return { success: false, deviceName: "", error: "No hay transporte de impresión disponible." };
    }

    const res = await transport.connect(targetDeviceId);
    this.notifyState();

    if (res.success && res.device) {
      this.saveLastDevice(res.device, transport.id);
      this.flushQueue().catch(() => {});
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

  async reconnect(): Promise<{ success: boolean; deviceName?: string }> {
    if (this.isConnected()) {
      return { success: true, deviceName: this.getConnectedDevice()?.name };
    }

    const last = this.getLastSavedDevice();
    if (!last || !last.id) {
      return { success: false };
    }

    // Web Bluetooth strictly requires an explicit user gesture (click).
    // Attempting to reconnect automatically in desktop web without a gesture throws SecurityError.
    if (last.transportId === "web-bluetooth" && !this.isNativePlatform()) {
      return { success: false, deviceName: last.name };
    }

    if (last.transportId) {
      this.setActiveTransport(last.transportId);
    }

    const result = await this.connect(last.id);
    return {
      success: result.success,
      deviceName: result.deviceName,
    };
  }

  async disconnect(): Promise<void> {
    if (this.autoReconnectTimer) {
      clearTimeout(this.autoReconnectTimer);
      this.autoReconnectTimer = null;
    }
    if (this.activeTransport) {
      await this.activeTransport.disconnect();
      this.notifyState();
    }
  }

  // --- Mutex-Guarded Low-Level Print ---

  private async runWithPrintLock<T>(task: () => Promise<T>): Promise<T> {
    const previous = this.printMutex;
    let releaseLock: () => void;
    this.printMutex = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    await previous.catch(() => {});
    try {
      return await task();
    } finally {
      releaseLock!();
    }
  }

  async print(data: Uint8Array): Promise<boolean> {
    return await this.runWithPrintLock(async () => {
      const transport = this.getActiveTransport();
      if (!transport || !transport.isConnected()) {
        throw new Error("Impresora no conectada.");
      }
      return await transport.print(data);
    });
  }

  // --- Offline & Resilient Print Queue ---

  getPendingQueue(): QueuedTicket[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(PRINT_QUEUE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveQueue(queue: QueuedTicket[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(PRINT_QUEUE_STORAGE_KEY, JSON.stringify(queue));
    } catch {}
    this.notifyQueue();
  }

  clearQueue(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(PRINT_QUEUE_STORAGE_KEY);
    } catch {}
    this.notifyQueue();
  }

  removeQueuedTicket(id: string): void {
    const q = this.getPendingQueue().filter((item) => item.id !== id);
    this.saveQueue(q);
  }

  enqueueTicket(data: any, is58mm: boolean = true): QueuedTicket {
    const orderRef = data?.orderNumber || data?.orderId || data?.id || null;
    const q = this.getPendingQueue();

    // Deduplication check: do not enqueue multiple identical tickets for the same order
    if (orderRef) {
      const existing = q.find(
        (item) =>
          item.status === "PENDING" &&
          (item.data?.orderNumber === orderRef ||
            item.data?.orderId === orderRef ||
            item.data?.id === orderRef)
      );
      if (existing) {
        existing.timestamp = Date.now();
        this.saveQueue(q);
        return existing;
      }
    }

    const ticket: QueuedTicket = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      title: data?.orderNumber ? `Orden #${data.orderNumber}` : "Comprobante POS",
      data,
      is58mm,
      timestamp: Date.now(),
      status: "PENDING",
      attempts: 0,
    };

    q.push(ticket);
    // Limit queue size to avoid filling localStorage quota
    const trimmed = q.length > MAX_QUEUE_SIZE ? q.slice(-MAX_QUEUE_SIZE) : q;
    this.saveQueue(trimmed);
    return ticket;
  }

  async printTicket(data: any, is58mm: boolean = true): Promise<{ success: boolean; queued: boolean; error?: string }> {
    if (this.isConnected()) {
      try {
        const payload = await generateEscPosTicketPayload(data, is58mm);
        await this.print(payload);
        return { success: true, queued: false };
      } catch (err: any) {
        console.warn("[PrintEngine] Error de impresión en vivo, encolando ticket...", err);
        this.enqueueTicket(data, is58mm);
        return {
          success: false,
          queued: true,
          error: "Error de impresión. El ticket se guardó en la cola y se imprimirá automáticamente al reconectar.",
        };
      }
    } else {
      this.enqueueTicket(data, is58mm);
      return {
        success: false,
        queued: true,
        error: "Impresora desconectada. Ticket guardado en cola para impresión automática.",
      };
    }
  }

  async flushQueue(): Promise<{ printed: number; failed: number }> {
    if (this.isFlushingQueue || !this.isConnected()) {
      return { printed: 0, failed: 0 };
    }

    this.isFlushingQueue = true;
    let printed = 0;
    let failed = 0;

    try {
      await this.runWithPrintLock(async () => {
        const queue = this.getPendingQueue();
        const remaining: QueuedTicket[] = [];

        for (const item of queue) {
          // Cap maximum automatic retry attempts
          if (item.attempts >= MAX_FLUSH_ATTEMPTS) {
            remaining.push(item);
            continue;
          }

          try {
            const transport = this.getActiveTransport();
            if (!transport || !transport.isConnected()) {
              remaining.push(item);
              continue;
            }
            const payload = await generateEscPosTicketPayload(item.data, item.is58mm);
            await transport.print(payload);
            printed++;
            await new Promise((r) => setTimeout(r, 400));
          } catch (e: any) {
            failed++;
            item.attempts += 1;
            item.status = "FAILED";
            item.error =
              item.attempts >= MAX_FLUSH_ATTEMPTS
                ? `Falló tras ${MAX_FLUSH_ATTEMPTS} intentos: ${e?.message || "Error"}`
                : e?.message || "Error al imprimir";
            remaining.push(item);
          }
        }

        this.saveQueue(remaining);
      });
    } finally {
      this.isFlushingQueue = false;
    }

    return { printed, failed };
  }

  async handleAppResume(): Promise<void> {
    console.log("[PrintEngine] App resume detectado. Comprobando conexión...");
    if (!this.isConnected()) {
      const res = await this.reconnect();
      if (res.success) {
        console.log(`[PrintEngine] Impresora reconectada automáticamente: ${res.deviceName}`);
      }
    } else {
      await this.flushQueue();
    }
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
    const res = await this.printTicket(testData, true);
    return res.success;
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
  const uaData = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData;
  const platform: string = uaData?.platform || (navigator as unknown as { platform?: string }).platform || "";

  const isIPadOS =
    /iPad/.test(ua) ||
    ((platform === "MacIntel" || platform === "macOS") && (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints! > 1);
  const isIOS = isIPadOS || /iPhone/.test(ua) || /iPod/.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isMac = platform.includes("Mac") && !isIPadOS;
  const isWindows = platform.includes("Win");

  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
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
    recommendation = "Ejecutando en App Nativa Rabbitty POS con soporte directo Bluetooth BLE (iOS y Android).";
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
