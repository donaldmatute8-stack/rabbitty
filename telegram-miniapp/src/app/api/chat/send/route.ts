import { NextResponse } from 'next/server';
import { db } from '@/db';
import { messages } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    const { conversationId, senderId, targetId, content } = await req.json();

    if (!conversationId || !senderId || !content) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

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
        { role: 'system', content: 'Eres Rabbit Bot, el asistente amigable y conciso de la app Rabbitty. Hablas español de forma natural, entusiasta y usas emojis de conejos 🐰 o zanahorias 🥕. Ayudas a los usuarios a entender cómo ganar bunz visitando negocios afiliados. Importante: escribe siempre "bunz" en minúscula, ya que es nuestra economía interna (solo usa mayúsculas si te refieres explícitamente a la criptomoneda en la blockchain).' },
        ...history.map((msg: any) => ({
          role: msg.senderId === 'bot' ? 'assistant' : 'user',
          content: msg.content
        }))
      ];

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
          })
        });

        if (ollamaRes.ok) {
          const data = await ollamaRes.json();
          const botText = data.message?.content || 'Hubo un error al pensar 🐰';
          
          const [newBotResponse] = await db.insert(messages).values({
            conversationId,
            senderId: 'bot',
            content: botText
          }).returning();
          botResponse = newBotResponse;
        } else {
          console.error("Ollama API Error:", await ollamaRes.text());
        }
      } catch (ollamaErr) {
        console.error('Error conectando a Ollama:', ollamaErr);
      }
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
