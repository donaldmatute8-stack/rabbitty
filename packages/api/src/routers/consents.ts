import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { router, adminOnlyProcedure, resolveBranchId } from "../trpc";
import { branches, restaurants } from "@rabbitty/database-restaurant/schema";
import {
  BUSINESS_DOCS,
  LEGAL_VERSION,
  REQUIRED_BUSINESS_DOCS,
  type BusinessDoc,
} from "../services/legalVersions";

/**
 * ── Aceptación de documentos por parte del AFILIADO ─────────────────────────
 *
 * El Rabbitter ya acepta con versión + fecha + IP. El negocio no tenía registro,
 * y es justo el que más se necesita: es quien contrata, cobra y responde.
 *
 * Regla: mientras falte aceptar la versión vigente de los documentos publicados,
 * el panel muestra un aviso **bloqueante**. El comodato de equipos queda fuera
 * hasta que exista hardware (`published: false` en legalVersions).
 */

/** Negocio de membresías/pagos al que pertenece la sucursal en contexto. */
async function resolveBusinessId(
  restaurantDb: Parameters<typeof resolveBranchId>[0]["restaurantDb"],
  branchId: string | null,
): Promise<string | null> {
  if (!branchId) return null;
  try {
    const [br] = await restaurantDb
      .select({ restaurantId: branches.restaurantId })
      .from(branches)
      .where(eq(branches.id, branchId))
      .limit(1);
    if (!br?.restaurantId) return null;
    const [rest] = await restaurantDb
      .select({ businessId: restaurants.businessId })
      .from(restaurants)
      .where(eq(restaurants.id, br.restaurantId))
      .limit(1);
    return rest?.businessId ?? null;
  } catch {
    return null;
  }
}

type ConsentRow = { doc: string; version: string };

export const consentsRouter = router({
  /** ¿Falta aceptar algo? Devuelve la versión vigente y qué documentos aplican. */
  getBusinessAcceptance: adminOnlyProcedure.query(async ({ ctx }) => {
    const branchId = await resolveBranchId(ctx, undefined);
    const businessId = await resolveBusinessId(ctx.restaurantDb, branchId);

    const publishedDocs = BUSINESS_DOCS.filter((d) => d.published);

    if (!businessId) {
      return {
        businessId: null,
        required: false,
        currentVersion: LEGAL_VERSION,
        acceptedVersion: null,
        pending: [] as BusinessDoc[],
        docs: publishedDocs,
      };
    }

    const rows = (await ctx.coreDb
      .execute(
        sql`SELECT "doc","version" FROM "business_consents" WHERE "businessId" = ${businessId}`,
      )
      .catch(() => ({ rows: [] as ConsentRow[] }))) as
      | { rows?: ConsentRow[] }
      | ConsentRow[];

    const list: ConsentRow[] = Array.isArray(rows) ? rows : rows.rows ?? [];
    const acceptedNow = new Set(list.filter((r) => r.version === LEGAL_VERSION).map((r) => r.doc));
    const pending = REQUIRED_BUSINESS_DOCS.filter((doc) => !acceptedNow.has(doc));

    return {
      businessId,
      required: pending.length > 0,
      currentVersion: LEGAL_VERSION,
      acceptedVersion: pending.length === 0 ? LEGAL_VERSION : null,
      pending,
      docs: publishedDocs,
    };
  }),

  /** Registra la aceptación de la versión vigente (idempotente). */
  acceptBusinessTerms: adminOnlyProcedure
    .input(
      z.object({
        version: z.string().min(6).max(40),
        accepted: z.literal(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.version !== LEGAL_VERSION) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La versión de los documentos cambió. Recarga la página para leer la vigente.",
        });
      }

      const branchId = await resolveBranchId(ctx, undefined);
      const businessId = await resolveBusinessId(ctx.restaurantDb, branchId);
      if (!businessId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No pude resolver el negocio de esta sucursal.",
        });
      }

      const email = ctx.user?.email ?? null;
      for (const doc of REQUIRED_BUSINESS_DOCS) {
        await ctx.coreDb
          .execute(
            sql`INSERT INTO "business_consents"
                  ("id","businessId","doc","version","acceptedAt","acceptedByUserId","acceptedByEmail")
                VALUES
                  (gen_random_uuid()::text, ${businessId}, ${doc}, ${LEGAL_VERSION}, now(), ${ctx.userId ?? null}, ${email})
                ON CONFLICT ("businessId","doc","version") DO NOTHING`,
          )
          .catch((e: unknown) => {
            console.error("[consents] no se pudo registrar la aceptación:", e);
          });
      }

      // Deja rastro en la auditoría general (quién aceptó y cuándo).
      try {
        await ctx.coreDb.execute(
          sql`INSERT INTO "auditEntries" ("id","userId","action","resource","resourceId","details")
              VALUES (gen_random_uuid()::text, ${ctx.userId ?? null}, 'BUSINESS_TERMS_ACCEPTED', 'business_consents', ${businessId}, ${JSON.stringify({ version: LEGAL_VERSION, docs: REQUIRED_BUSINESS_DOCS })})`,
        );
      } catch {
        /* la auditoría es best-effort: no debe romper la aceptación */
      }

      return { success: true, version: LEGAL_VERSION, docs: REQUIRED_BUSINESS_DOCS };
    }),

  /** Historial de aceptaciones (auditoría y soporte). */
  listBusinessConsents: adminOnlyProcedure.query(async ({ ctx }) => {
    const branchId = await resolveBranchId(ctx, undefined);
    const businessId = await resolveBusinessId(ctx.restaurantDb, branchId);
    if (!businessId) return [];
    const res = (await ctx.coreDb
      .execute(
        sql`SELECT "doc","version","acceptedAt","acceptedByEmail"
            FROM "business_consents"
            WHERE "businessId" = ${businessId}
            ORDER BY "acceptedAt" DESC
            LIMIT 50`,
      )
      .catch(() => ({ rows: [] }))) as { rows?: unknown[] } | unknown[];
    return Array.isArray(res) ? res : res.rows ?? [];
  }),
});
