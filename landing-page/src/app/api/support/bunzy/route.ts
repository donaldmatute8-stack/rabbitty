import { NextResponse } from 'next/server';

const KNOWLEDGE_BASE: { keywords: string[]; answer: string }[] = [
  {
    keywords: ['que son los bunz', 'que es un bunz', 'para que sirven los bunz', 'explicame los bunz'],
    answer: 'Los Bunz son la moneda digital exclusiva del ecosistema Rabbitty. Sirven para recibir recompensas automáticas al consumir en cafeterías y restaurantes afiliados y usarlos como pago real en tus siguientes visitas.',
  },
  {
    keywords: ['ganar', 'acumular', 'obtener', 'como gano'],
    answer: 'Ganas Bunz de forma inmediata cada vez que pagas en un comercio participante. Solo muestra tu Rabbitty Code (QR) o proporciona tu teléfono en caja al pagar tu cuenta en locales afiliados.',
  },
  {
    keywords: ['afiliar', 'afiliado', 'afiliados', 'restaurante', 'cafeteria', 'mi negocio', 'sumar mi local', 'pos', 'terminal'],
    answer: '¡Excelente! Para unir tu cafetería o restaurante a la red de Afiliados Rabbitty:\n• Puedes postularte directamente en nuestro portal: https://rabbitty.me/affiliates\n• O escribirnos por WhatsApp para darte de alta y enviarte tu terminal Rabbitty POS en iPad junto con tu Kit de Cartelería y habladores de mesa con tu QR oficial.',
  },
  {
    keywords: ['descargar', 'bajar', 'app', 'iphone', 'ios', 'app store', 'android'],
    answer: 'Puedes descargar Rabbitty directamente en tu dispositivo:\n• Enlace de descarga oficial: https://rabbitty.me/download\n• También puedes usarla al instante en la web o Telegram sin necesidad de instalar nada desde https://app.rabbitty.me.',
  },
  {
    keywords: ['rabbitters', 'comunidad', 'usuarios', 'quienes son', 'rabbitter'],
    answer: 'Los «Rabbitters» son los miembros de nuestra comunidad que exploran su ciudad, visitan cafeterías de especialidad y restaurantes locales, ganan Bunz en cada parada y coleccionan sellos en su Vibe Passport.',
  },
  {
    keywords: ['vencer', 'caducan', 'vencimiento', 'expiran'],
    answer: 'Tus Bunz en una cuenta activa de Rabbitty no tienen fecha de vencimiento. Si un negocio te otorgó Bunz a tu número antes de registrarte, tienes 3 meses para crear tu cuenta y reclamarlos en tu billetera.',
  },
  {
    keywords: ['eliminar', 'cuenta', 'borrar', 'baja'],
    answer: 'Puedes solicitar la baja permanente de tu cuenta desde Perfil > "Eliminar cuenta permanentemente". Toma en cuenta que por términos de servicio, los Bunz que tengas acumulados se ceden a la tesorería de Rabbitty y se expurgan tus datos personales con un comprobante inmutable de liquidación contable en IPFS.',
  },
  {
    keywords: ['transferir', 'enviar', 'amigo', 'mandar'],
    answer: '¡Sí! Puedes enviar Bunz al instante a cualquier usuario mediante su @usuario o escaneando su código desde tu billetera o dentro del chat de la app con autorización de Face ID / PIN.',
  },
  {
    keywords: ['privacidad', 'terminos', 'seguridad', 'legal', 'datos'],
    answer: 'Puedes consultar nuestro Aviso de Privacidad integral y Términos de Servicio bajo las leyes mexicanas (LFPDPPP) en https://rabbitty.me/privacy.',
  },
  {
    keywords: ['contacto', 'humano', 'whatsapp', 'telefono', 'correo', 'email', 'hablar'],
    answer: 'Puedes escribirnos directamente a nuestro equipo de atención en support@rabbitty.me o por WhatsApp oficial al https://wa.me/529581000000. Estamos disponibles de lunes a domingo de 8:00 AM a 10:00 PM.',
  },
];

export async function POST(req: Request) {
  try {
    const { query } = (await req.json()) as { query?: string };
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Pregunta requerida' }, { status: 400 });
    }

    const clean = query.toLowerCase().trim();

    // Buscar coincidencia en base de conocimiento
    for (const item of KNOWLEDGE_BASE) {
      if (item.keywords.some((kw) => clean.includes(kw))) {
        return NextResponse.json({
          reply: item.answer,
          source: 'bunzy_knowledge',
        });
      }
    }

    // Respuesta conversacional inteligente por defecto
    return NextResponse.json({
      reply: `¡Hola! Soy Bunzy 🐰. Veo que preguntas: "${query}". Para asistirte de forma personalizada:
• Si es sobre tu cuenta o saldo de Bunz, puedes revisarlo en la app móvil.
• Para consultas sobre un comercio específico o reportar un ticket, puedes escribir a nuestro equipo directo en support@rabbitty.me o pulsar el botón de WhatsApp abajo.`,
      source: 'bunzy_fallback',
    });
  } catch {
    return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 });
  }
}
