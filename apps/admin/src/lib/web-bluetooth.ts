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

    // Scan for available thermal write characteristic safely
    // Cheap printers (YICHIP, POS-58) often crash if we guess a service they don't have via getPrimaryService(uuid).
    // It's much safer to just enumerate all services they DO have.
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

  // Enviar a impresoras térmicas debe ser lento porque su motor físico y buffer de RAM (4KB) son lentos.
  // Si enviamos muy rápido, el buffer se llena, Bluefy lanza error, y perdemos el resto del ticket.
  const CHUNK_SIZE = 40;
  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    const chunk = data.slice(offset, offset + CHUNK_SIZE);
    
    let success = false;
    let attempts = 0;
    
    while (!success && attempts < 4) {
      try {
        if (activeCharacteristic.properties.writeWithoutResponse && activeCharacteristic.writeValueWithoutResponse) {
          await activeCharacteristic.writeValueWithoutResponse(chunk);
        } else if (activeCharacteristic.writeValueWithResponse) {
          await activeCharacteristic.writeValueWithResponse(chunk);
        } else {
          await activeCharacteristic.writeValue(chunk);
        }
        success = true;
      } catch (err) {
        attempts++;
        console.warn(`BLE chunk write error (attempt ${attempts}), printer buffer full? retrying...`, err);
        // Si falló, el buffer de la impresora seguramente está lleno.
        // Le damos 200ms a la impresora para que imprima físicamente el papel y libere RAM.
        await new Promise(r => setTimeout(r, 200));
      }
    }
    
    if (!success) {
      console.error("BLE chunk failed completely after 4 attempts, aborting to prevent garbage.");
      throw new Error("La impresora Bluetooth saturó su memoria y dejó de responder.");
    }

    // Delay normal entre paquetes exitosos
    await new Promise(r => setTimeout(r, 30));
  }
  return true;
}

async function rasterizeImage(url: string, maxWidth: number = 384): Promise<Uint8Array | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let printWidth = img.width;
      let printHeight = img.height;
      if (printWidth > maxWidth) {
        printHeight = Math.round((maxWidth * img.height) / img.width);
        printWidth = maxWidth;
      }
      printWidth = Math.round(printWidth / 8) * 8; // force multiple of 8
      
      canvas.width = printWidth;
      canvas.height = printHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, printWidth, printHeight);
      ctx.drawImage(img, 0, 0, printWidth, printHeight);
      
      const imgData = ctx.getImageData(0, 0, printWidth, printHeight).data;
      const bytesWidth = printWidth / 8;
      const payload = [];
      
      payload.push(0x1d, 0x76, 0x30, 0); 
      payload.push(bytesWidth % 256, Math.floor(bytesWidth / 256));
      payload.push(printHeight % 256, Math.floor(printHeight / 256));
      
      for (let y = 0; y < printHeight; y++) {
        for (let x = 0; x < bytesWidth; x++) {
          let byte = 0;
          for (let bit = 0; bit < 8; bit++) {
            const pixelX = x * 8 + bit;
            const idx = (y * printWidth + pixelX) * 4;
            const a = imgData[idx + 3];
            let luminance = 255;
            if (a > 128) {
              const r = imgData[idx];
              const g = imgData[idx + 1];
              const b = imgData[idx + 2];
              luminance = (r * 0.299 + g * 0.587 + b * 0.114);
            }
            if (luminance < 128) {
              byte |= (1 << (7 - bit));
            }
          }
          payload.push(byte);
        }
      }
      resolve(new Uint8Array(payload));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Genera un payload en texto crudo (ESC/POS) completo a partir de los datos del ticket
export async function generateEscPosTicketPayload(data: any, is58mm: boolean = true): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const width = is58mm ? 32 : 48; // Caracteres por linea max (aprox)

  const alignCenter = new Uint8Array([0x1b, 0x61, 0x01]);
  const alignLeft = new Uint8Array([0x1b, 0x61, 0x00]);
  const alignRight = new Uint8Array([0x1b, 0x61, 0x02]);
  const init = new Uint8Array([0x1b, 0x40]);
  const boldOn = new Uint8Array([0x1b, 0x45, 0x01]);
  const boldOff = new Uint8Array([0x1b, 0x45, 0x00]);
  
  const encodeText = (text: string): Uint8Array => {
    const bytes: number[] = [];
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      switch (char) {
        case 'á': bytes.push(160); break;
        case 'í': bytes.push(161); break;
        case 'ó': bytes.push(162); break;
        case 'ú': bytes.push(163); break;
        case 'ñ': bytes.push(164); break;
        case 'Ñ': bytes.push(165); break;
        case 'é': bytes.push(130); break;
        case '¿': bytes.push(168); break;
        case '¡': bytes.push(173); break;
        default:
          const code = char.charCodeAt(0);
          if (code < 128) bytes.push(code);
          else {
            const normalized = char.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            bytes.push(normalized.charCodeAt(0) || 63); // 63 is '?'
          }
          break;
      }
    }
    return new Uint8Array(bytes);
  };

  // Select PC437 code page (Standard for thermal printers) to ensure accents print correctly
  const setCodePage = new Uint8Array([0x1b, 0x74, 0x00]);
  let chunks: Uint8Array[] = [init, setCodePage, alignCenter];

  const addText = (text: string) => chunks.push(encodeText(text));
  const divider = "-".repeat(width) + "\n";

  // LOGO
  if (data.logoUrl || data.logo) {
    const maxPixelWidth = is58mm ? 160 : 200; // REDUCED LOGO SIZE FOR FASTER PRINTING
    const rasterBytes = await rasterizeImage(data.logoUrl || data.logo, maxPixelWidth);
    if (rasterBytes) {
      chunks.push(rasterBytes);
      addText("\n");
    }
  }

  // HEADER
  chunks.push(boldOn);
  addText(`\n${(data.restaurantName || "RABBITTY POS").toUpperCase()}\n`);
  chunks.push(boldOff);

  if (data.legalName) addText(`${data.legalName}\n`);
  if (data.rfc) addText(`RFC: ${data.rfc}\n`);
  if (data.taxRegime) addText(`${data.taxRegime}\n`);
  if (data.address) addText(`${data.address}\n`);
  if (data.phone) addText(`Tel: ${data.phone}\n`);
  addText(divider);

  // META
  chunks.push(alignLeft);
  addText(`Ticket: #${data.orderNumber || "0001"}\n`);
  addText(`Fecha: ${data.date || new Date().toLocaleString("es-MX")}\n`);
  addText(`Tipo: ${data.orderType || "Consumo en Sitio"}\n`);
  if (data.tableNumber) addText(`Mesa: ${data.tableNumber}\n`);
  addText(divider);

  // ITEMS
  if (data.items && data.items.length > 0) {
    data.items.forEach((item: any) => {
      const qty = `${item.quantity}x `.padEnd(4);
      const name = (item.name || "").substring(0, width - 14);
      const price = `$${item.totalPrice.toFixed(2)}`;
      
      const spaceLen = width - (qty.length + name.length + price.length);
      const space = spaceLen > 0 ? " ".repeat(spaceLen) : " ";
      
      addText(`${qty}${name}${space}${price}\n`);
    });
    addText(divider);
  }

  // TOTALS
  chunks.push(alignRight);
  const sub = `$${(data.subtotal || 0).toFixed(2)}`;
  const tax = `$${(data.tax || 0).toFixed(2)}`;
  const tot = `$${(data.total || 0).toFixed(2)}`;
  
  addText(`SUBTOTAL: ${sub.padStart(10)}\n`);
  addText(`IVA:      ${tax.padStart(10)}\n`);
  chunks.push(boldOn);
  addText(`TOTAL:    ${tot.padStart(10)}\n`);
  chunks.push(boldOff);
  addText(divider);

  // FOOTER & REWARDS
  chunks.push(alignCenter);
  if (data.ticketFooter) addText(`${data.ticketFooter}\n\n`);

  // BUNZ CASHBACK
  if (data.total > 0 && data.bunzCashbackRate) {
    const earnedBunz = data.total * (data.bunzCashbackRate / 100);
    chunks.push(boldOn);
    addText(`¡Ganas +${earnedBunz.toFixed(2)} Bunz Recompensa!\n`);
    chunks.push(boldOff);
    addText(`Escanea tu ticket en la mini app de\nTelegram o Rabbitty para recibir tu cashback.\n\n`);
    
    try {
      // Create QR Code
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`https://t.me/RabbittyBot/app?startapp=claim_${data.orderNumber || "0000"}`)}`;
      const qrBytes = await rasterizeImage(qrUrl, 200);
      if (qrBytes) {
        chunks.push(qrBytes);
      }
    } catch {
      // Ignore if QR generation fails
    }
    
    addText(`\nRBBTY-VERIF-${data.orderNumber || "0001"}\n\n`);
  }

  addText("🐰 POWERED BY RABBITTY OS\nrabbitty.me\n\n\n\n");

  // Flat all chunks into one Uint8Array
  const totalLength = chunks.reduce((acc, curr) => acc + curr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
