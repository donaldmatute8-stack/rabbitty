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

  if (data.isCorteDeCaja) {
    chunks.push(alignCenter);
    chunks.push(boldOn);
    addText(`\nCORTE DE CAJA / TURNO\n`);
    chunks.push(boldOff);
    addText(divider);
    chunks.push(alignLeft);
    addText(`Fecha: ${new Date().toLocaleString("es-MX")}\n`);
    if (data.staffName) addText(`Cajero / Supervisor: ${data.staffName}\n`);
    addText(divider);
    addText(`(+) Cobrado Efectivo Hoy:  $${Number(data.totalCashReceived || 0).toFixed(2)}\n`);
    addText(`(-) Retiros de Caja:       $${Number(data.totalDropped || 0).toFixed(2)}\n`);
    addText(divider);
    chunks.push(boldOn);
    addText(`TOTAL EFECTIVO EN GAVETA:  $${Number(data.currentCash || 0).toFixed(2)}\n`);
    chunks.push(boldOff);
    addText(divider);
    addText(`Firma Cajero:\n\n\n___________________\n\n`);
    addText(`Firma Gerencia:\n\n\n___________________\n\n\n`);

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

  if (data.isShiftReport) {
    const titles: Record<string, string> = {
      OPEN: "APERTURA DE CAJA",
      X: "CIERRE PARCIAL - TURNO ABIERTO",
      HANDOVER: "TRASPASO DE TURNO",
      Z: "CIERRE DE TURNO - DEFINITIVO",
    };
    const money = (n: any) => `$${Number(n || 0).toFixed(2)}`;
    const line = (label: string, value: string) =>
      addText(`${label.padEnd(Math.max(1, width - value.length - 1))} ${value}\n`);
    chunks.push(alignCenter, boldOn);
    addText(`\n${titles[data.kind] || "CAJA"}\n`);
    chunks.push(boldOff);
    addText(divider);
    chunks.push(alignLeft);
    addText(`Fecha: ${new Date().toLocaleString("es-MX")}\n`);
    if (data.openedAt) addText(`Apertura: ${new Date(data.openedAt).toLocaleString("es-MX")}\n`);
    if (data.closedAt) addText(`Cierre: ${new Date(data.closedAt).toLocaleString("es-MX")}\n`);
    if (data.cashierName) addText(`Cajero: ${data.cashierName}\n`);
    if (data.incomingName) addText(`Recibe: ${data.incomingName}\n`);
    addText(divider);
    line("Fondo inicial:", money(data.openingFloat));
    if (data.kind !== "OPEN") {
      line("(+) Ventas efectivo:", money(data.cashSales));
      if (Number(data.expenses || 0) > 0) {
        line("(-) Gastos en efectivo:", money(data.expenses));
      }
      if (Number(data.withdrawals || 0) > 0 || Number(data.expenses || 0) === 0) {
        line("(-) Retiros gaveta:", money(data.withdrawals));
      }
      if (Number(data.adjustments || 0) !== 0) line("(+/-) Ajustes traspaso:", money(data.adjustments));
      addText(divider);
      chunks.push(boldOn);
      line("EFECTIVO ESPERADO:", money(data.expectedCash));
      line("EFECTIVO CONTADO:", money(data.countedCash));
      const diff = Number(data.difference || 0);
      line(diff === 0 ? "DIFERENCIA:" : diff > 0 ? "SOBRANTE:" : "FALTANTE:", money(Math.abs(diff)));
      chunks.push(boldOff);
      if (data.kind === "X" && Math.abs(diff) >= 0.01) {
        chunks.push(alignCenter, boldOn);
        addText("** DESCUADRE DETECTADO **\n");
        chunks.push(boldOff, alignLeft);
      }
      addText(divider);
      line("Ventas tarjeta:", money(data.cardSales));
      line("Ventas Bunz:", money(data.bunzSales));
    }
    if (data.notes) addText(`Notas: ${data.notes}\n`);
    if (data.authorizedByName) addText(`Autorizo: ${data.authorizedByName}\n`);
    addText(divider);
    addText(`Firma Cajero:\n\n\n___________________\n\n`);
    if (data.kind === "Z" || data.kind === "HANDOVER") addText(`Firma Gerencia / Recibe:\n\n\n___________________\n\n`);
    chunks.push(new Uint8Array([0x0a, 0x0a, 0x0a, 0x0a, 0x0a]));
    chunks.push(new Uint8Array([0x1d, 0x56, 0x41, 0x00]));

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

  if (data.isRefund) {
    chunks.push(alignCenter);
    chunks.push(boldOn);
    addText(`\nCOMPROBANTE DE REEMBOLSO\n`);
    chunks.push(boldOff);
    addText(divider);
    chunks.push(alignLeft);
    if (data.orderNumber) addText(`Ticket Original: #${data.orderNumber}\n`);
    addText(`Fecha: ${data.date || new Date().toLocaleString("es-MX")}\n`);
    if (data.paymentMethod) addText(`Forma Original: ${data.paymentMethod}\n`);
    if (data.reason) addText(`Motivo: ${data.reason}\n`);
    addText(divider);
    chunks.push(alignRight);
    chunks.push(boldOn);
    addText(`MONTO DEVUELTO: $${Number(data.refundAmount || data.amount || 0).toFixed(2)}\n`);
    chunks.push(boldOff);
    addText(divider);
    chunks.push(alignCenter);
    addText(`Devolución procesada en sistema.\n\n`);
    addText(`Firma del Cliente:\n\n\n___________________\n\n`);
    addText(`Firma de Autorización:\n\n\n___________________\n\n\n`);
    
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
  chunks.push(boldOn);
  addText(`Ticket: #${data.orderNumber || "0001"}\n`);
  addText(`Folio Rabbitty: ${data.claimToken ? data.claimToken.slice(0, 10).toUpperCase() : `RBBTY-${data.orderNumber || "0001"}`}\n`);
  chunks.push(boldOff);
  addText(`Fecha: ${data.date || new Date().toLocaleString("es-MX")}\n`);
  addText(`Tipo:  ${data.orderType || "Consumo en Sitio"}\n`);
  if (data.tableNumber) addText(`Mesa:  ${data.tableNumber}\n`);
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

  // FORMAS DE PAGO
  chunks.push(alignLeft);
  if (Array.isArray(data.payments) && data.payments.length > 0) {
    addText(`FORMA DE PAGO:\n`);
    for (const p of data.payments) {
      const pMethod = String(p.method || "EFECTIVO").toUpperCase();
      const pAmt = `$${Number(p.amount || 0).toFixed(2)}`;
      const pSpace = Math.max(1, width - pMethod.length - pAmt.length - 2);
      addText(`  ${pMethod}${" ".repeat(pSpace)}${pAmt}\n`);
    }
    addText(divider);
  } else if (data.paymentMethod) {
    const methodStr = String(data.paymentMethod).toUpperCase();
    const methodLabel = "FORMA DE PAGO: ";
    if (methodLabel.length + methodStr.length <= width) {
      addText(`${methodLabel}${methodStr}\n`);
    } else {
      addText(`${methodLabel}\n  ${methodStr}\n`);
    }
    if (data.cashGiven != null && data.cashGiven > 0) {
      addText(`  Entregado: $${Number(data.cashGiven).toFixed(2)}\n`);
      const cambio = Number(data.change ?? Math.max(0, data.cashGiven - (data.total || 0)));
      addText(`  Cambio:    $${cambio.toFixed(2)}\n`);
    }
    addText(divider);
  }

  // FOOTER & REWARDS
  chunks.push(alignCenter);
  if (data.ticketFooter) addText(`${data.ticketFooter}\n\n`);

  // BUNZ CASHBACK
  const effectiveCashbackRate = data.bunzCashbackRate ?? 20;
  const earnedBunz = data.estimatedBunz ?? (data.total > 0 ? Math.max(1, Math.round(data.total * (effectiveCashbackRate / 100))) : 0);

  if (earnedBunz > 0) {
    chunks.push(boldOn);
    
    if (data.paymentMethod === "QR BUNZ" || data.paymentMethod?.includes("BUNZ") || (data.awardedBunz && data.awardedBunz > 0)) {
      const credited = data.awardedBunz ?? earnedBunz;
      addText(`¡Cashback de +${Number(credited).toFixed(2)} Bunz!\n`);
      chunks.push(boldOff);
      addText(data.customerName ? `Depositado a ${data.customerName}\n\n` : `Depositado automaticamente a tu cuenta.\n\n`);
    } else {
      addText(`¡Ganas +${earnedBunz.toFixed(2)} Bunz Recompensa!\n`);
      chunks.push(boldOff);
      addText(`Escanea tu ticket en la mini app de\nTelegram o Rabbitty para recibir tu cashback.\n\n`);
      try {
        // Create QR Code (Universal rabbitty.me URL compatible with native app and web)
        const claimParam = (data as any).claimToken ? `claimToken=${(data as any).claimToken}` : `claim=${data.orderNumber || "0000"}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`https://rabbitty.me/scan?${claimParam}`)}`;
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

  addText("[ RABBITTY OS ]\nrabbitty.me\n\n\n\n");

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
