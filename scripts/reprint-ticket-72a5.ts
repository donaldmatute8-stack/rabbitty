import { spawn } from "child_process";
import crypto from "crypto";
import pg from "pg";

const { Pool } = pg;

// 1. Conexión a la base de datos de producción Neon
const connectionString = "postgresql://neondb_owner:${NEON_PASSWORD_REMOVED}@ep-delicate-violet-ap6izh0k-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require";
const pool = new Pool({ connectionString });

const RABBITTY_API_SECRET = process.env.RABBITTY_API_SECRET || "496dd7b8259523c1759a203f9234371758b1969288720e6ac74c65d06b2be648";

function generateTicketClaimToken(orderId: string, amount: number, branchId: string): string {
  const exp = Math.floor(Date.now() / 1000) + 48 * 3600; // 48 horas
  const payload = `${orderId}:${amount}:${branchId}:${exp}`;
  const sig = crypto.createHmac("sha256", RABBITTY_API_SECRET).update(payload).digest("hex").slice(0, 16);
  return `${orderId}.${exp}.${sig}`;
}

// 2. Comandos ESC/POS nativos para formato y QR de alta definición (58mm)
const INIT = Buffer.from([0x1b, 0x40]);
const CENTER = Buffer.from([0x1b, 0x61, 0x01]);
const LEFT = Buffer.from([0x1b, 0x61, 0x00]);
const RIGHT = Buffer.from([0x1b, 0x61, 0x02]);
const BOLD_ON = Buffer.from([0x1b, 0x45, 0x01]);
const BOLD_OFF = Buffer.from([0x1b, 0x45, 0x00]);
const DOUBLE_ON = Buffer.from([0x1d, 0x21, 0x11]);
const DOUBLE_OFF = Buffer.from([0x1d, 0x21, 0x00]);
const FEED_3 = Buffer.from([0x1b, 0x64, 0x03]);
const CUT = Buffer.from([0x1d, 0x56, 0x41, 0x10]);

function generateNativeEscPosQr(text: string): Buffer {
  const bytes = Buffer.from(text, "utf8");
  const len = bytes.length + 3;
  const pL = len % 256;
  const pH = Math.floor(len / 256);

  return Buffer.concat([
    // Function 165: Select model (model 2)
    Buffer.from([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),
    // Function 167: Set module size (size 5 for 58mm roll width)
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x05]),
    // Function 169: Set error correction level (level M: 49)
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]),
    // Function 180: Store data in symbol storage area
    Buffer.from([0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]),
    bytes,
    // Function 181: Print symbol data in symbol storage area
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),
  ]);
}

async function main() {
  console.log("🔍 Buscando orden #72A5 en la base de datos de 626 Café...");
  
  const orderRes = await pool.query(
    `SELECT * FROM orders WHERE id ILIKE $1`,
    ["%72a5%"]
  );

  if (orderRes.rows.length === 0) {
    console.error("❌ No se encontró la orden 72A5 en la base de datos.");
    process.exit(1);
  }

  const order = orderRes.rows[0];
  console.log(`✅ Orden encontrada: ${order.id}`);

  const branchRes = await pool.query(`SELECT * FROM branches WHERE id = $1`, [order.branchId]);
  const branch = branchRes.rows[0] || {};
  
  const restRes = await pool.query(`SELECT * FROM restaurants WHERE id = $1`, [branch.restaurantId]);
  const restaurant = restRes.rows[0] || {};

  const itemsRes = await pool.query(
    `SELECT oi.*, mi.name as item_name FROM order_items oi LEFT JOIN menu_items mi ON oi."menuItemId" = mi.id WHERE oi."orderId" = $1`,
    [order.id]
  );
  const items = itemsRes.rows;

  const orderNumber = order.id.slice(-4).toUpperCase();
  const claimToken = generateTicketClaimToken(order.id, Number(order.total), order.branchId);
  const estimatedBunz = Math.max(1, Math.round(Number(order.total) * ((restaurant.defaultRewardRate || 20) / 100)));
  const claimUrl = `https://rabbitty.me/scan?claimToken=${claimToken}`;

  console.log("\n--- DETALLES DEL TICKET ---");
  console.log(`Restaurante: ${restaurant.name}`);
  console.log(`Ticket: #${orderNumber}`);
  console.log(`Folio Rabbitty: ${claimToken.slice(0, 18)}...`);
  console.log(`Total: $${Number(order.total).toFixed(2)} MXN`);
  console.log(`Bunz Cashback: +${estimatedBunz} Bunz`);
  console.log(`URL de Reclamo en QR: ${claimUrl}`);

  // 3. Ensamblar los bytes ESC/POS
  const chunks: Buffer[] = [];
  const add = (buf: Buffer) => chunks.push(buf);
  const text = (str: string) => chunks.push(Buffer.from(str.normalize("NFD").replace(/[\u0300-\u036f]/g, ""), "latin1"));

  add(INIT);
  add(CENTER);
  add(DOUBLE_ON);
  add(BOLD_ON);
  text(`${(restaurant.name || "626 CAFE").toUpperCase()}\n`);
  add(DOUBLE_OFF);
  add(BOLD_OFF);

  if (restaurant.legalName) text(`${restaurant.legalName}\n`);
  if (restaurant.rfc) text(`RFC: ${restaurant.rfc}\n`);
  if (restaurant.taxRegime) text(`${restaurant.taxRegime.substring(0, 32)}\n`);
  if (branch.address) text(`${branch.address.substring(0, 32)}\n`);
  if (restaurant.phone) text(`Tel: ${restaurant.phone}\n`);

  text("--------------------------------\n");
  add(LEFT);
  add(BOLD_ON);
  text(`Ticket: #${orderNumber}\n`);
  text(`Folio Rabbitty: ${claimToken.slice(0, 14).toUpperCase()}\n`);
  add(BOLD_OFF);
  text(`Fecha:  ${new Date(order.createdAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}\n`);
  text(`Tipo:   ${order.orderType === "TO_GO" ? "Para Llevar" : "Consumo en Sitio"}\n`);
  text("--------------------------------\n");
  add(BOLD_ON);
  text("Cant  Descripcion        Total  \n");
  add(BOLD_OFF);
  text("--------------------------------\n");

  for (const item of items) {
    const qtyStr = `${item.quantity}x `.padEnd(4);
    const priceStr = `$${Number(item.totalPrice).toFixed(2)}`.padStart(9);
    const maxName = 32 - 4 - 9;
    const nameStr = (item.item_name || "Cafe Americano").substring(0, maxName).padEnd(maxName);
    text(`${qtyStr}${nameStr}${priceStr}\n`);
  }

  text("--------------------------------\n");
  add(RIGHT);
  text(`Subtotal:  $${Number(order.subtotal).toFixed(2)}\n`);
  text(`IVA (16%): $${Number(order.tax).toFixed(2)}\n`);
  add(BOLD_ON);
  add(DOUBLE_ON);
  text(`TOTAL: $${Number(order.total).toFixed(2)}\n`);
  add(DOUBLE_OFF);
  add(BOLD_OFF);
  text(`Metodo de Pago: EFECTIVO\n`);
  text("--------------------------------\n");

  // Bloque Bunz Cashback con QR
  add(CENTER);
  add(BOLD_ON);
  text(`¡Ganas +${estimatedBunz} Bunz Cashback!\n`);
  add(BOLD_OFF);
  text("Escanea con tu celular o app\n");
  text("para reclamar tus recompensas:\n\n");

  // Inyección del QR ESC/POS nativo
  add(generateNativeEscPosQr(claimUrl));

  text("\n\n");
  add(BOLD_ON);
  text(`RBBTY-VERIF-${orderNumber}\n`);
  add(BOLD_OFF);
  text("--------------------------------\n");
  text("Gracias por tu visita a 626 Cafe!\n");
  text("🐰 POWERED BY RABBITTY OS\n");
  text("rabbitty.me\n");
  add(FEED_3);

  const fullPayload = Buffer.concat(chunks);

  // 4. Enviar a la impresora POS-58
  console.log("\n🖨️  Enviando datos binarios a la impresora POS-58...");
  
  // Guardamos el binario para envío directo por lp (CUPS Spooler)
  import("fs").then(async (fs) => {
    const tmpBinPath = "/tmp/ticket_72a5.bin";
    fs.writeFileSync(tmpBinPath, fullPayload);

    // Intentamos por lp directo al spooler de macOS
    const lpProc = spawn("lp", ["-d", "Rabbitty_POS_Printer", "-o", "raw", tmpBinPath]);
    
    let lpErr = "";
    lpProc.stderr.on("data", (d) => { lpErr += d.toString(); });
    
    lpProc.on("close", (code) => {
      if (code === 0) {
        console.log("\n🎉 ¡TICKET #72A5 ENVIADO CON ÉXITO A Rabbitty_POS_Printer (CUPS RAW)!");
      } else {
        console.log(`[lp fallback stderr]: ${lpErr.trim()}`);
        // Si lp falla, probamos con el backend directo
        const cupsBinary = "/usr/libexec/cups/backend/usb";
        const deviceUri = process.env.RABBITTY_PRINTER_URI || "usb://YICHIP3121/POS-58%20Printer?serial=B120300001";
        const proc = spawn(cupsBinary, ["1", "admin", "Ticket 72A5 Rabbitty", "1", ""], {
          env: { ...process.env, DEVICE_URI: deviceUri }
        });
        proc.stdin.write(fullPayload);
        proc.stdin.end();
        proc.stderr.on("data", (d) => { console.log(`[CUPS Backend]: ${d.toString().trim()}`); });
        proc.on("close", (c) => {
          console.log(`Backend terminó con código ${c}`);
        });
      }
      pool.end();
    });
  });
}

main().catch((err) => {
  console.error("Error al ejecutar:", err);
  pool.end();
});
