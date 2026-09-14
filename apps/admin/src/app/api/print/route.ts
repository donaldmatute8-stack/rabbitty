import { NextResponse } from "next/server";
import { spawn } from "child_process";

// ESC/POS Commands
const ESC = "\x1b";
const GS = "\x1d";
const INIT = `${ESC}@`;
const CENTER = `${ESC}a\x01`;
const LEFT = `${ESC}a\x00`;
const RIGHT = `${ESC}a\x02`;
const BOLD_ON = `${ESC}E\x01`;
const BOLD_OFF = `${ESC}E\x00`;
const DOUBLE_ON = `${GS}!\x11`;
const DOUBLE_OFF = `${GS}!\x00`;
const FEED_3 = "\n\n\n\n";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      isWelcome = false,
      restaurantName = "Rabbitty Bistro",
      legalName,
      rfc,
      taxRegime,
      address,
      phone,
      orderNumber = "0001",
      tableNumber,
      orderType = "Consumo en Sitio",
      items = [],
      subtotal = 0,
      tax = 0,
      total = 0,
      paymentMethod = "EFECTIVO",
      bunzCashbackRate = 20,
    } = body;

    let ticket = "";
    ticket += INIT;

    if (isWelcome) {
      // 🐰 CREATIVE ONBOARDING & WELCOME TICKET FOR NEWLY CONNECTED HARDWARE
      ticket += CENTER;
      ticket += `${BOLD_ON}================================\n${BOLD_OFF}`;
      ticket += `${DOUBLE_ON}${BOLD_ON}RABBITTY POS${DOUBLE_OFF}${BOLD_OFF}\n`;
      ticket += `${BOLD_ON}HARDWARE CONECTADO EXITOSAMENTE!${BOLD_OFF}\n`;
      ticket += "================================\n\n";

      // Bunny ASCII Art (Centered, 32 chars width compatible)
      ticket += "           (\\(\\          \n";
      ticket += "          ( -.-)         \n";
      ticket += "         o_(\")(\")        \n\n";

      ticket += `${BOLD_ON}¡HOLA, ${restaurantName.toUpperCase()}!${BOLD_OFF}\n`;
      ticket += "Bienvenido a la red de negocios\n";
      ticket += "de Rabbitty Intelligence OS.\n";
      ticket += "--------------------------------\n";
      ticket += LEFT;
      ticket += `${BOLD_ON}ESTADO DEL DISPOSITIVO:${BOLD_OFF}\n`;
      ticket += "* Nombre:  Rabbitty POS Printer\n";
      ticket += "* Perfil:  Termica 58mm (ESC/POS)\n";
      ticket += "* Puerto:  USB High-Speed & BLE\n";
      ticket += "* Papel:   Rollo Detectado [OK]\n";
      ticket += `* Fecha:   ${new Date().toLocaleDateString("es-MX")}\n`;
      ticket += `* Hora:    ${new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}\n`;
      ticket += "--------------------------------\n";
      ticket += CENTER;
      ticket += `${BOLD_ON}¿QUE SIGUE AHORA?${BOLD_OFF}\n`;
      ticket += "1. Cobra desde tu POS o iPad.\n";
      ticket += "2. Imprime tickets instantaneos.\n";
      ticket += "3. Otorga cashback Bunz a clientes.\n";
      ticket += "--------------------------------\n";
      ticket += `${BOLD_ON}ESCANEA PARA EXPLORAR${BOLD_OFF}\n`;
      ticket += "[ QR: https://rabbitty.me ]\n\n";
      ticket += `${BOLD_ON}rabbitty.me${BOLD_OFF}\n`;
      ticket += "El futuro del punto de venta.\n";
      ticket += "================================\n";
      ticket += FEED_3;
    } else {
      const bunzEstimated = Math.round(total * (bunzCashbackRate / 100));

      // Construct raw ESC/POS ticket string (58mm width ~ 32 characters per line)
      ticket += CENTER;
      ticket += `${DOUBLE_ON}${BOLD_ON}${restaurantName.toUpperCase()}\n${DOUBLE_OFF}${BOLD_OFF}`;
    if (legalName) ticket += `${legalName}\n`;
    if (rfc) ticket += `RFC: ${rfc}\n`;
    if (taxRegime) ticket += `${taxRegime.substring(0, 32)}\n`;
    if (address) ticket += `${address.substring(0, 32)}\n`;
    if (phone) ticket += `Tel: ${phone}\n`;
    ticket += "--------------------------------\n";
    ticket += LEFT;
    ticket += `Ticket: #${orderNumber}\n`;
    ticket += `Fecha: ${new Date().toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}\n`;
    ticket += `Tipo: ${orderType}${tableNumber ? ` | ${tableNumber}` : ""}\n`;
    ticket += "--------------------------------\n";
    ticket += `${BOLD_ON}Cant  Descripcion        Total${BOLD_OFF}\n`;
    ticket += "--------------------------------\n";

    for (const item of items) {
      const qtyStr = String(item.quantity || 1).padEnd(5);
      const priceStr = `$${Number(item.totalPrice || item.price || 0).toFixed(2)}`.padStart(9);
      const maxNameLen = 32 - 5 - 9;
      const nameStr = (item.name || "Articulo").substring(0, maxNameLen).padEnd(maxNameLen);
      ticket += `${qtyStr}${nameStr}${priceStr}\n`;
      if (item.notes) {
        ticket += `   * ${item.notes.substring(0, 26)}\n`;
      }
    }

    ticket += "--------------------------------\n";
    ticket += `${BOLD_ON}`;
    ticket += `Subtotal (Base):      $${Number(subtotal).toFixed(2).padStart(8)}\n`;
    ticket += `IVA (16%):            $${Number(tax).toFixed(2).padStart(8)}\n`;
    ticket += `${DOUBLE_ON}TOTAL:    $${Number(total).toFixed(2)}${DOUBLE_OFF}\n`;
    ticket += `${BOLD_OFF}`;
    ticket += `Metodo de Pago: ${paymentMethod}\n`;
    ticket += "--------------------------------\n";
    ticket += CENTER;
    ticket += `${BOLD_ON}Ganas +${bunzEstimated} Bunz Cashback!${BOLD_OFF}\n`;
    ticket += "Escanea en Rabbitty App\n";
    ticket += `[ QR: RBBTY-${orderNumber}-VERIF ]\n`;
    ticket += "--------------------------------\n";
    ticket += "Gracias por tu visita!\n";
    ticket += "🐰 POWERED BY RABBITTY OS\n";
    ticket += "rabbitty.me\n";
    ticket += FEED_3;
  }

    // Send directly to USB CUPS Backend on macOS
    const deviceUri = process.env.RABBITTY_PRINTER_URI || "usb://YICHIP3121/POS-58%20Printer?serial=B120300001";
    const env = {
      ...process.env,
      DEVICE_URI: deviceUri,
    };

    const buffer = Buffer.from(ticket, "latin1");

    return new Promise<NextResponse>((resolve) => {
      // If cups backend binary doesn't exist (e.g. Linux container or Windows), graceful fail to let frontend use window.print
      const cupsBinary = "/usr/libexec/cups/backend/usb";
      const proc = spawn(cupsBinary, ["1", "admin", "Ticket Rabbitty", "1", ""], { env });

      proc.stdin.write(buffer);
      proc.stdin.end();

      let errOutput = "";
      proc.stderr.on("data", (data) => {
        errOutput += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0 || errOutput.includes("Wrote") || errOutput.includes("Sent")) {
          resolve(NextResponse.json({ success: true, message: "Ticket impreso correctamente en POS-58" }));
        } else {
          resolve(NextResponse.json({ success: false, error: errOutput || `Proceso termino con codigo ${code}` }, { status: 500 }));
        }
      });

      proc.on("error", (err) => {
        resolve(NextResponse.json({ success: false, error: err.message }, { status: 500 }));
      });
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
