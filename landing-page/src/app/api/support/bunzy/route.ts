import { NextResponse } from 'next/server';

interface KnowledgeItem {
  keywords: string[];
  answer: string;
  category: string;
}

const KNOWLEDGE_BASE: KnowledgeItem[] = [
  {
    category: 'bunz',
    keywords: ['que son los bunz', 'que es un bunz', 'para que sirven los bunz', 'explicame los bunz', 'bunz', 'puntos', 'moneda'],
    answer: '🪙 **Los Bunz son la moneda de recompensas oficial de Rabbitty.**\n\n• **¿Cómo funcionan?** Cada vez que pagas en una cafetería, bar o restaurante afiliado mostrando tu Rabbitty Code (QR), acumulas un porcentaje directo en Bunz (por ejemplo, el 10% o 15% de tu consumo).\n• **¿Para qué sirven?** Los Bunz acumulados tienen valor real dentro del ecosistema y los puedes usar para pagar cuentas futuras, invitar amigos o canjear productos en comercios de la red.\n• **¿Caducan?** No, en cuentas activas tus Bunz se preservan siempre.',
  },
  {
    category: 'earnings',
    keywords: ['como gano', 'ganar bunz', 'acumular', 'obtener bunz', 'recompensas', 'cashback', 'porcentaje'],
    answer: '🎉 **Ganar Bunz es automático:**\n\n1. Visita cualquier comercio afiliado de la red Rabbitty.\n2. Al momento de pedir tu cuenta o pagar en barra, dile al barista/cajero que tienes Rabbitty.\n3. Abre tu app y presiona **"Ver QR"** para que lo escaneen con su terminal Rabbitty POS, o dile tu número de teléfono registrado.\n4. ¡Listo! Los Bunz se abonan inmediatamente a tu billetera y recibes una notificación en tiempo real.',
  },
  {
    category: 'qr_pay',
    keywords: ['como pago', 'pagar con qr', 'codigo qr', 'rabbitty code', 'escanear', 'caja', 'terminal', 'pos'],
    answer: '📲 **Para pagar o identificarte en caja:**\n\n• En la pantalla de inicio de tu app Rabbitty, presiona tu tarjeta de usuario o el botón **"Ver QR"**.\n• Muestra el código en la pantalla de tu móvil al personal del local para que lo lean con la cámara del iPad/terminal Rabbitty POS.\n• Si vas a liquidar parte de tu cuenta con Bunz, indícale al cajero la cantidad que deseas aplicar.',
  },
  {
    category: 'delete_account',
    keywords: ['eliminar cuenta', 'borrar cuenta', 'dar de baja', 'eliminar mi cuenta', 'cancelar cuenta', 'privacidad cuenta'],
    answer: '🔒 **Eliminación permanente de cuenta:**\n\n• Puedes solicitar la baja irreversible directamente en la app desde **Perfil > Configuración > Eliminar cuenta permanentemente**.\n• Por seguridad y normativas fiscales, los saldos de Bunz no redimidos se traspasan irrevocablemente a la tesorería del protocolo (`sys_rabbitty_treasury`).\n• Todos tus datos personales se expurgan de nuestros servidores activos y se emite un certificado inmutable de liquidación en el nodo IPFS de Pandoras Finance para cumplimiento legal.',
  },
  {
    category: 'affiliates',
    keywords: ['afiliar', 'afiliado', 'afiliados', 'restaurante', 'cafeteria', 'mi negocio', 'sumar mi local', 'pos', 'terminal restaurante', 'vender con rabbitty', 'alta negocio'],
    answer: '🏢 **Afiliar tu comercio a Rabbitty:**\n\n• Premia el consumo de tus clientes y atrae comensales recurrentes.\n• Recibes acceso a **Rabbitty POS** (en iPad o Mac) y tu kit oficial de bienvenida con material QR para mostrador y mesas.\n• Inicia tu registro en https://rabbitty.me/affiliates o contáctanos por Telegram en **@rabbittyhub**.',
  },
  {
    category: 'affiliate_admin',
    keywords: ['panel admin', 'admin afiliados', 'dashboard negocio', 'login admin', 'como entro al admin', 'acceso comercio', 'gestionar negocio', 'ver ventas comercio', 'cambiar porcentaje'],
    answer: '💼 **Panel de Administración para Afiliados:**\n\n• **Acceso web:** Ingresa a https://admin.rabbitty.me con tu correo o número de teléfono registrado.\n• **Funcionalidades:** Desde el panel puedes ajustar el porcentaje de recompensa Bunz (2% a 50%), ver métricas de comensales, historial de tickets emitidos, gestionar personal y descargar el Kit de Impresión oficial en PDF.\n• **Acceso 1-Clic:** También puedes escanear el código QR de la pantalla de login desde tu app Rabbitty en tu celular.',
  },
  {
    category: 'pos_hardware',
    keywords: ['impresora', 'impresora termica', 'bluetooth', 'pos-58', 'pos-80', 'tickets no imprimen', 'conectar impresora', 'hardware pos'],
    answer: '🖨️ **Soporte de Impresoras Térmicas y Hardware POS:**\n\n• **Modelos compatibles:** Impresoras térmicas de 58mm y 80mm con protocolo ESC/POS vía Bluetooth Low Energy (BLE) o red local.\n• **Conexión:** En tu terminal Rabbitty POS, toca el botón de impresora arriba a la derecha para emparejar tu dispositivo.\n• **Recomendación:** Si la impresora no aparece en el escaneo, apágala 5 segundos, enciéndela y verifica que el Bluetooth del iPad esté activo.',
  },
  {
    category: 'pos_cash_drop',
    keywords: ['corte de caja', 'arqueo', 'retiro de efectivo', 'gaveta', 'sangria de caja', 'cierre de turno'],
    answer: '💵 **Caja por turnos en Rabbitty POS:**\\n\\n• Toca el botón de caja en la barra superior (**"Caja cerrada · Abrir"**) e ingresa tu PIN y el fondo inicial. Sin turno abierto no se cobra en efectivo.\\n• **Retiros**: piden tu PIN; si superan el umbral configurado, también el PIN de manager/admin.\\n• **Cierre parcial (Ticket X)**: arqueo ciego sin cerrar turno. **Cambio de cajero**: sale y entra con su PIN.\\n• **Cierre Z**: arqueo ciego + PIN de cajero y de manager/admin; si hay sobrante o faltante, la nota es obligatoria.\\n• La auditoría completa está en el admin, sección **Turnos de Caja**.',
  },
  {
    category: 'rabbitters',
    keywords: ['rabbitters', 'rabbitter', 'comunidad', 'quienes son', 'vibe passport', 'mood'],
    answer: '🐰 **Los Rabbitters son la comunidad viva de Rabbitty:**\n\nClientes que aman descubrir spots gastronómicos y culturales únicos, registrar sus visitas en su Vibe Passport, apoyar comercios locales y disfrutar de dinámicas de atmósfera en cada experiencia.',
  },
  {
    category: 'download',
    keywords: ['descargar', 'app store', 'testflight', 'ios', 'iphone', 'bajar app', 'donde descargo', 'link descarga'],
    answer: '📲 **Acceso y descarga de Rabbitty:**\n\n• **iOS / TestFlight:** Puedes descargar la versión nativa para iPhone mediante el enlace oficial en https://rabbitty.me/download.\n• **Rabbitty POS:** Para iPad y Mac disponible en App Store.\n• **Web App / Telegram Mini App:** También puedes usarla al instante sin instalar nada entrando a https://app.rabbitty.me o desde nuestro bot en Telegram.',
  },
  {
    category: 'transfers',
    keywords: ['transferir', 'enviar bunz', 'pasar bunz', 'amigo', 'mandar saldo'],
    answer: '💸 **Transferencias entre Rabbitters:**\n\n• Puedes enviar Bunz al instante y sin comisiones a tus amigos.\n• Entra a la sección de Billetera > Transferir, busca su @usuario o escanea su Rabbitty Code personal.\n• La operación se autoriza con Face ID o tu PIN de seguridad.',
  },
  {
    category: 'human_support',
    keywords: ['humano', 'contacto', 'telegram', 'soporte humano', 'hablar con alguien', 'agente', 'telefono', 'ayuda'],
    answer: '💬 **Atención y Soporte con el Equipo:**\n\n• Puedes contactar al equipo en tiempo real a través de nuestro bot/canal oficial en Telegram: **@rabbittyhub** (https://t.me/rabbittyhub).\n• También puedes escribirnos a **support@rabbitty.me**.\n• Nuestro horario de atención humana es de Lunes a Domingo de 8:00 AM a 10:00 PM (Hora CDMX).',
  },
];

const ipRateMap = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting por IP (Ventana deslizante de 20 preguntas por minuto)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const now = Date.now();
    const entry = ipRateMap.get(ip);

    if (entry && entry.resetAt > now) {
      if (entry.count >= 20) {
        return NextResponse.json(
          { reply: '⚠️ Has alcanzado el límite de preguntas por minuto. Por favor espera un momento antes de consultar nuevamente a Bunzy.' },
          { status: 429, headers: { 'Retry-After': '60' } }
        );
      }
      entry.count += 1;
    } else {
      ipRateMap.set(ip, { count: 1, resetAt: now + 60_000 });
    }

    const { query } = (await req.json()) as { query?: string };
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Pregunta requerida' }, { status: 400 });
    }

    // 2. Longitud máxima para prevenir desbordamientos o payloads maliciosos
    if (query.trim().length > 500) {
      return NextResponse.json(
        { reply: 'Tu consulta es muy extensa. Por favor escribe una pregunta más concisa o escríbenos a support@rabbitty.me.' },
        { status: 400 }
      );
    }

    const clean = query.toLowerCase().trim();

    // 1. Scoring semántico / ponderado por palabras clave
    let bestMatch: KnowledgeItem | null = null;
    let maxScore = 0;

    for (const item of KNOWLEDGE_BASE) {
      let score = 0;
      for (const kw of item.keywords) {
        if (clean === kw) {
          score += 10;
        } else if (clean.includes(kw)) {
          score += kw.length > 5 ? 4 : 2;
        }
      }
      if (score > maxScore) {
        maxScore = score;
        bestMatch = item;
      }
    }

    if (bestMatch && maxScore >= 2) {
      return NextResponse.json({
        reply: bestMatch.answer,
        source: 'bunzy_knowledge',
        category: bestMatch.category,
      });
    }

    // 2. Respuesta conversacional útil y precisa (evita el "siempre contesta lo mismo")
    return NextResponse.json({
      reply: `¡Hola! Soy Bunzy 🐰. Recibí tu consulta sobre: "${query}".

Para ayudarte con precisión:
• **¿Dudas de saldo o transacciones en caja?** Puedes ver tu historial en tiempo real dentro de tu app en la sección Billetera.
• **¿Soporte directo con un agente?** Escríbenos en Telegram a **@rabbittyhub** (https://t.me/rabbittyhub) o envíanos un correo a **support@rabbitty.me**.
• También puedes hacer clic en una de las preguntas frecuentes aquí abajo para responderte al instante.`,
      source: 'bunzy_fallback',
    });
  } catch {
    return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 });
  }
}

