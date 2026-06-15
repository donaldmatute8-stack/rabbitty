import { NextResponse } from "next/server";
import OpenAI from "openai";
import { restaurantDb } from "../../../../db/restaurant";
import { tables, menuItems } from "@rabbitty/database-restaurant/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "dummy_key_for_build",
  });
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as Blob;
    const tableId = formData.get("tableId") as string;

    if (!audioFile || !tableId) {
      return NextResponse.json({ error: "Missing audio or tableId" }, { status: 400 });
    }

    // 1. Transcribe Audio via Whisper
    const fileForWhisper = new File([audioFile], "audio.webm", { type: audioFile.type });
    const transcription = await openai.audio.transcriptions.create({
      file: fileForWhisper,
      model: "whisper-1",
      language: "es", // Optimize for Spanish as requested
    });

    const transcriptText = transcription.text;
    console.log(`[Voice AI] Transcribed text: ${transcriptText}`);

    // 2. Fetch Menu Items for Context
    const db = restaurantDb;
    
    const tableResult = await db.select().from(tables).where(eq(tables.id, tableId));
    if (tableResult.length === 0) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }
    const branchId = tableResult[0].branchId;

    const availableItems = await db.select({
      id: menuItems.id,
      name: menuItems.name,
      description: menuItems.description,
      price: menuItems.price
    }).from(menuItems).where(eq(menuItems.branchId, branchId));

    if (availableItems.length === 0) {
      return NextResponse.json({ error: "Menu empty for this branch" }, { status: 400 });
    }

    // 3. Map intent to Menu using GPT-4o
    const systemPrompt = `
Eres un Mesero IA experto de un restaurante. Recibes la transcripción de voz de un cliente y debes emparejar lo que pide con los platillos EXACTOS del menú.
Si el cliente menciona un ingrediente a remover o nota especial, colócalo en "notes".
Solo puedes seleccionar items del menú proveído. Si pide algo que no existe, ignóralo o asimílalo al más parecido.

Menú Disponible (JSON):
${JSON.stringify(availableItems.map((i: any) => ({ id: i.id, name: i.name, price: i.price })))}

Devuelve estrictamente un JSON puro (sin formato markdown ni backticks) con esta estructura:
{
  "items": [
    { "itemId": "uuid-del-item", "quantity": 2, "notes": "sin cebolla" }
  ]
}
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Transcripción del cliente: "${transcriptText}"` }
      ],
      response_format: { type: "json_object" }
    });

    const jsonString = completion.choices[0].message.content || '{"items":[]}';
    const parsedData = JSON.parse(jsonString);

    // Filter out invalid itemIds just in case
    const validItems = availableItems.map((i: any) => i.id);
    const finalItems = (parsedData.items || []).filter((i: any) => validItems.includes(i.itemId));

    // Return the matched items + transcription so frontend can show what was heard
    return NextResponse.json({ 
      success: true, 
      transcription: transcriptText,
      items: finalItems 
    });

  } catch (error: any) {
    console.error("Voice Order Error:", error);
    return NextResponse.json({ error: "Failed to process voice order" }, { status: 500 });
  }
}
