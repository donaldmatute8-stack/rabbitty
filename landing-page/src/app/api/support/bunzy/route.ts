import { NextResponse } from 'next/server';

const KNOWLEDGE_BASE: { keywords: string[]; answer: string }[] = [
  {
    keywords: ['bunz', 'moneda', 'dinero', 'puntos', 'que son'],
    answer: 'Los Bunz son la moneda digital exclusiva del ecosistema Rabbitty. Sirven para recibir recompensas automáticas al consumir en cafeterías y restaurantes afiliados y usarlos como pago real en tus siguientes visitas.',
  },
  {
    keywords: ['ganar', 'acumular', 'obtener', 'como gano'],
    answer: 'Ganas Bunz de forma inmediata cada vez que pagas en un comercio participante. Solo muestra tu Rabbitty Code (QR) o proporciona tu teléfono en caja al pagar tu cuenta.',
  },
  {
    keywords: ['vencer', 'caducan', 'vencimiento', 'expiran'],
    answer: 'Tus Bunz en una cuenta activa de Rabbitty no tienen fecha de vencimiento. Si un negocio te otorgó Bunz a tu número antes de registrarte, tienes 3 meses para crear tu cuenta y reclamarlos en tu billetera.',
  },
  {
    keywords: ['eliminar', 'cuenta', 'borrar', 'baja'],
    answer: 'Puedes eliminar tu cuenta en cualquier momento desde Perfil > "Eliminar cuenta permanentemente". Toma en cuenta que por términos de servicio, los Bunz que tengas acumulados se cederán a la tesorería de Rabbitty y se expurgarán tus datos personales con un comprobante inmutable de liquidación en IPFS.',
  },
  {
    keywords: ['afiliar', 'negocio', 'restaurante', 'cafeteria', 'comercio', 'pos'],
    answer: 'Si tienes un negocio de comida o bebida, puedes unirte a Rabbitty como Afiliado. Obtendrás la app Rabbitty POS para iPad/Mac, terminal de lealtad, gestión de atmósfera (Proof of Atmosphere) y un kit de cartelería y habladores de mesa con tu QR oficial.',
  },
  {
    keywords: ['transferir', 'enviar', 'amigo'],
    answer: '¡Sí! Puedes enviar Bunz al instante a cualquier usuario mediante su @usuario o escaneando su código desde tu billetera o dentro del chat de la app con autorización de Face ID / PIN.',
  },
  {
    keywords: ['contacto', 'humano', 'whatsapp', 'telefono', 'correo', 'email'],
    answer: 'Puedes escribirnos directamente a nuestro equipo de atención en support@rabbitty.me o por WhatsApp oficial al +52 958 100 0000. Estamos disponibles de lunes a domingo de 8:00 AM a 10:00 PM.',
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
