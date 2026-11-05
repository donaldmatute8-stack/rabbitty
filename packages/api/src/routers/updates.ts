import { desc } from "drizzle-orm";
import { updatePosts } from "@rabbitty/database-core";
import { router, godAdminProcedure } from "../trpc";

/** URL pública estable de una novedad (la misma que se envía por broadcast). */
export function updateLogUrl(slug: string): string {
  const base = (process.env.UPDATE_LOG_BASE_URL || "https://app.rabbitty.me").replace(/\/+$/, "");
  return `${base}/updates/${slug}`;
}

export const updatesRouter = router({
  /**
   * Lista para el panel: lo último publicado y borradores, con su enlace
   * canónico para pegarlo como CTA de un comunicado.
   */
  list: godAdminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.coreDb
      .select({
        slug: updatePosts.slug,
        version: updatePosts.version,
        title: updatePosts.title,
        summary: updatePosts.summary,
        category: updatePosts.category,
        status: updatePosts.status,
        publishedAt: updatePosts.publishedAt,
      })
      .from(updatePosts)
      .orderBy(desc(updatePosts.publishedAt))
      .limit(50);

    return rows.map((r) => ({ ...r, url: updateLogUrl(r.slug) }));
  }),
});
