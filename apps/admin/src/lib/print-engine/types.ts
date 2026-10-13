export interface PrintDevice {
  id: string;
  name: string;
  type: "BLE" | "SPP" | "USB" | "NETWORK";
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
  isNative: boolean;
  status: "OK" | "HTTP" | "BLOCKED_BY_CONTEXT" | "BLOCKED_BY_BROWSER" | "BLE_ONLY" | "NATIVE_READY";
  recommendation: string;
}

export interface QueuedTicket {
  id: string;
  title: string;
  data: any;
  is58mm: boolean;
  timestamp: number;
  status: "PENDING" | "PRINTING" | "FAILED";
  attempts: number;
  error?: string;
}

export interface PrintEngineState {
  connected: boolean;
  device: PrintDevice | null;
  queueCount: number;
  activeTransportId: string | null;
}

export interface PrintTransport {
  readonly id: string;
  readonly name: string;
  readonly type: PrintDevice["type"];

  isSupported(): boolean;
  isConnected(): boolean;
  getConnectedDevice(): PrintDevice | null;

  connect(deviceId?: string): Promise<{ success: boolean; device?: PrintDevice; error?: string }>;
  disconnect(): Promise<void>;
  print(data: Uint8Array): Promise<boolean>;
  onDisconnect?(cb: () => void): () => void;
  listPairedDevices?(): Promise<PrintDevice[]>;
}
