import { z } from "zod";
import { router, protectedProcedure, resolveBranchId } from "../trpc";
import { aiStrategies } from "@rabbitty/database-restaurant/schema";
import { eq, desc, and } from "drizzle-orm";

export const aiRouter = router({
  getStrategy: protectedProcedure
    .input(z.object({ branchId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const branchId = resolveBranchId(ctx, input.branchId);
      const [strategy] = await ctx.restaurantDb
        .select()
        .from(aiStrategies)
        .where(and(
          eq(aiStrategies.branchId, branchId),
          eq(aiStrategies.isActive, true)
        ))
        .orderBy(desc(aiStrategies.createdAt))
        .limit(1);
      return strategy || null;
    }),

  saveStrategy: protectedProcedure
    .input(z.object({
      branchId: z.string().optional(),
      goal: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const branchId = resolveBranchId(ctx, input.branchId);
      
      // Deactivate old strategies
      await ctx.restaurantDb.update(aiStrategies)
        .set({ isActive: false })
        .where(eq(aiStrategies.branchId, branchId));

      // Create new strategy
      const [newStrategy] = await ctx.restaurantDb.insert(aiStrategies).values({
        branchId,
        goal: input.goal,
      }).returning();

      return newStrategy;
    }),

  askHermes: protectedProcedure
    .input(z.object({
      prompt: z.string(),
      context: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Usaremos OLLAMA para procesar el prompt localmente o en un servidor privado
      const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
      const ollamaModel = process.env.OLLAMA_MODEL || "llama3"; // Default model

      const systemPrompt = `
      Eres Hermes, un AI experto en rentabilidad y estrategias para restaurantes.
      Estás analizando la base de datos y métricas de ventas.
      Tu objetivo es leer los datos de contexto (ventas, horas pico, productos más vendidos) y dar recomendaciones accionables y concisas al dueño del restaurante.
      Contexto de ventas: ${JSON.stringify(input.context || {})}
      `;

      try {
        const response = await fetch(`${ollamaUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: ollamaModel,
            prompt: `Sistema: ${systemPrompt}\nUsuario: ${input.prompt}\nHermes:`,
            stream: false,
          }),
        });

        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const data = await response.json();
        return { response: data.response };
      } catch (error: any) {
        throw new Error(`No se pudo contactar a Hermes (Ollama). Verifica que OLLAMA_BASE_URL (${ollamaUrl}) esté funcionando. Detalles: ${error.message}`);
      }
    }),
});
