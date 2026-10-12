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

export interface PrintTransport {
  readonly id: string;
  readonly name: string;
  readonly type: PrintDevice["type"];

  isSupported(): boolean;
  isConnected(): boolean;
  getConnectedDevice(): PrintDevice | null;

  connect(): Promise<{ success: boolean; device?: PrintDevice; error?: string }>;
  disconnect(): Promise<void>;
  print(data: Uint8Array): Promise<boolean>;
}
