import { NextResponse } from 'next/server';
import { db } from '@/db';
import { messages, conversations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export async function POST(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { conversationId, targetId, content } = await req.json();

    if (!conversationId || !content) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });
    }

    if (conversation.participant1 !== caller.id && conversation.participant2 !== caller.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const senderId = caller.id;

    // 1. Guardar el mensaje del usuario
    const [userMessage] = await db.insert(messages).values({
      conversationId,
      senderId,
      content,
    }).returning();

    let botResponse = null;

    // 2. Si el target es el BOT, procesamos con Ollama
    if (targetId === 'bot') {
      // Obtener el historial reciente para dar contexto al LLM
      const history = await db.query.messages.findMany({
        where: eq(messages.conversationId, conversationId),
        orderBy: (messages, { asc }) => [asc(messages.createdAt)],
        limit: 10 // últimos 10 mensajes
      });

      // Formatear para Ollama (formato estándar OpenAI chat completions si es compatible, o nativo de Ollama)
      // Asumimos API compatible con OpenAI para facilidad, o API nativa de Ollama
      const OLLAMA_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434/api/chat';
      const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
      const OLLAMA_KEY = process.env.OLLAMA_API_KEY || '';

      const messagesForOllama = [
        { role: 'system', content: 'Eres Bunzy 🐰, el concierge inteligente, carismático y astuto de Rabbitty. Tienes una personalidad urbana, amigable y conocedora de los mejores spots (restaurantes, cafés, bares, fitness y tiendas). Hablas en español mexicano moderno y relajado ("¡Qué onda!", "¡De lujo!"). Ayudas a los usuarios a descubrir comercios, entender cómo acumular y canjear bunz (siempre escribe "bunz" en minúscula) y subir de nivel en su madriguera con hops. Si te preguntan qué comer o a dónde ir, recomiéndales explorar la sección de comercios afiliados y activar sus recompensas escaneando el Rabbitty QR.' },
        ...history.map((msg) => ({
          role: msg.senderId === 'bot' ? 'assistant' : 'user',
          content: msg.content
        }))
      ];

      const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS) || 25000;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      let botText: string | null = null;

      try {
        const ollamaRes = await fetch(OLLAMA_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(OLLAMA_KEY ? { 'Authorization': `Bearer ${OLLAMA_KEY}` } : {})
          },
          body: JSON.stringify({
            model: OLLAMA_MODEL,
            messages: messagesForOllama,
            stream: false
          }),
          signal: controller.signal
        });

        if (ollamaRes.ok) {
          const data = await ollamaRes.json();
          botText = data.message?.content?.trim() || null;
        } else {
          console.error("Ollama API Error:", await ollamaRes.text());
        }
      } catch (ollamaErr) {
        console.error('Error conectando a Ollama:', ollamaErr);
      } finally {
        clearTimeout(timeout);
      }

      // Fallback: si Ollama falla o expira, Bunzy igual responde para no dejar el hilo mudo
      const [newBotResponse] = await db.insert(messages).values({
        conversationId,
        senderId: 'bot',
        content: botText || '¡Qué onda! Se me cruzaron los cables un momento 🐰⚡. Intenta de nuevo en un ratito.'
      }).returning();
      botResponse = newBotResponse;
    }

    return NextResponse.json({ 
      success: true, 
      message: userMessage,
      botResponse 
    });

  } catch (error) {
    console.error('Chat send error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
