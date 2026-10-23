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
    keywords: ['afiliar', 'afiliado', 'afiliados', 'restaurante', 'cafeteria', 'mi negocio', 'sumar mi local', 'pos', 'terminal restaurante', 'vender con rabbitty'],
    answer: '🏢 **Afiliar tu comercio a Rabbitty:**\n\n• Únete a los negocios de especialidad que premian la lealtad de sus clientes.\n• Te entregamos la terminal Rabbitty POS en iPad lista para operar y tu kit de bienvenida con habladores de mesa QR para tus clientes.\n• Puedes iniciar tu registro en https://rabbitty.me/affiliates o escribir directamente a nuestro canal de soporte en Telegram **@rabbittyhub**.',
  },
  {
    category: 'rabbitters',
    keywords: ['rabbitters', 'rabbitter', 'comunidad', 'quienes son', 'vibe passport', 'mood'],
    answer: '🐰 **Los Rabbitters son la comunidad viva de Rabbitty:**\n\nClientes que aman descubrir spots gastronómicos y culturales únicos, registrar sus visitas en su Vibe Passport, apoyar comercios locales y disfrutar de dinámicas de atmósfera en cada experiencia.',
  },
  {
    category: 'download',
    keywords: ['descargar', 'app store', 'testflight', 'ios', 'iphone', 'bajar app', 'donde descargo', 'link descarga'],
    answer: '📲 **Acceso y descarga de Rabbitty:**\n\n• **iOS / TestFlight:** Puedes descargar la versión nativa para iPhone mediante el enlace oficial en https://rabbitty.me/download.\n• **Web App / Telegram Mini App:** También puedes usarla al instante sin instalar nada entrando a https://app.rabbitty.me o desde nuestro bot en Telegram.',
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

export async function POST(req: Request) {
  try {
    const { query } = (await req.json()) as { query?: string };
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Pregunta requerida' }, { status: 400 });
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

