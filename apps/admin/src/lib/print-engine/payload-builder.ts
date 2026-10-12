export async function rasterizeImage(url: string, maxWidth: number = 384): Promise<Uint8Array | null> {
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
      const payload: number[] = [];
      
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

  if (data.isCashDrop) {
    chunks.push(alignLeft);
    addText(`\nRETIRO DE EFECTIVO\n`);
    addText(divider);
    addText(`Monto: $${(data.amount || 0).toFixed(2)}\n`);
    addText(`Fecha: ${new Date().toLocaleString("es-MX")}\n`);
    if (data.staffName) addText(`Cajero: ${data.staffName}\n`);
    if (data.notes) addText(`Notas: ${data.notes}\n`);
    addText(divider);
    addText(`Firma de entrega:\n\n\n___________________\n\n`);
    addText(`Firma de recibido:\n\n\n___________________\n\n\n`);
    
    // Line feed & Cut paper
    chunks.push(new Uint8Array([0x0a, 0x0a, 0x0a, 0x0a, 0x0a]));
    const cut = new Uint8Array([0x1d, 0x56, 0x41, 0x00]);
    chunks.push(cut);
    
    let totalLength = 0;
    for (const c of chunks) totalLength += c.length;
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const c of chunks) {
      result.set(c, offset);
      offset += c.length;
    }
    return result;
  }

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
  if (data.estimatedBunz && data.estimatedBunz > 0) {
    const earnedBunz = data.estimatedBunz;
    chunks.push(boldOn);
    
    if (data.paymentMethod === "QR BUNZ" || data.paymentMethod?.includes("BUNZ")) {
      addText(`¡Cashback de +${earnedBunz.toFixed(2)} Bunz!\n`);
      chunks.push(boldOff);
      addText(`Depositado automaticamente a tu cuenta.\n\n`);
    } else {
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
