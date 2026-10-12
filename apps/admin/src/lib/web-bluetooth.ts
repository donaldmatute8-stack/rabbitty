/**
 * Backward compatibility bridge for Web Bluetooth -> Rabbitty PrintEngine.
 * Directs all printing and connection requests through the hardware-agnostic PrintEngine.
 */
import {
  printEngine,
  diagnosePrinterConnection,
  generateEscPosTicketPayload,
  rasterizeImage,
} from "./print-engine";
import type { PrinterDiagnostics, PrintDevice } from "./print-engine";

export { diagnosePrinterConnection, generateEscPosTicketPayload, rasterizeImage };
export type { PrinterDiagnostics, PrintDevice };

export interface BluetoothDeviceState {
  connected: boolean;
  deviceName: string | null;
  deviceId: string | null;
}

export async function connectBluetoothPrinter(): Promise<{ success: boolean; deviceName: string; error?: string }> {
  return await printEngine.connect();
}

export function isBluetoothConnected(): boolean {
  return printEngine.isConnected();
}

export function getConnectedBluetoothDeviceName(): string | null {
  return printEngine.getConnectedDevice()?.name || null;
}

export async function disconnectBluetoothPrinter(): Promise<void> {
  await printEngine.disconnect();
}

export async function sendEscPosToBluetooth(data: Uint8Array): Promise<boolean> {
  return await printEngine.print(data);
}

export async function printTestTicket(): Promise<boolean> {
  return await printEngine.printTestTicket();
}
