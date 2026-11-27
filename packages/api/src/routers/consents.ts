import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { router, adminOnlyProcedure, resolveBranchId } from "../trpc";
import { branches, restaurants } from "@rabbitty/database-restaurant/schema";
import {
  BUSINESS_DOCS,
  LEGAL_VERSION,
  docsFor,
  requiredDocsFor,
  type BusinessDoc,
  type ParticipationModel,
} from "../services/legalVersions";
import { ownedBusinesses } from "@rabbitty/database-core/schema";

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

/** Modelo de participación del negocio (ADR-CORE-012). Sin fila = POS. */
async function resolveParticipationModel(
  coreDb: { select: (...args: any[]) => any },
  businessId: string,
): Promise<ParticipationModel> {
  try {
    const [row] = await coreDb
      .select({ model: ownedBusinesses.participationModel })
      .from(ownedBusinesses)
      .where(eq(ownedBusinesses.id, businessId))
      .limit(1);
    return row?.model === "LITE" ? "LITE" : "POS";
  } catch {
    return "POS";
  }
}

export const consentsRouter = router({
  /** ¿Falta aceptar algo? Devuelve la versión vigente y qué documentos aplican. */
  getBusinessAcceptance: adminOnlyProcedure.query(async ({ ctx }) => {
    const branchId = await resolveBranchId(ctx, undefined);
    const businessId = await resolveBusinessId(ctx.restaurantDb, branchId);
    const model: ParticipationModel = businessId
      ? await resolveParticipationModel(ctx.coreDb, businessId)
      : "POS";

    // Un negocio LITE solo acepta los documentos que rigen su relación.
    const publishedDocs = docsFor(model);
    const required = requiredDocsFor(model);

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
    const pending = required.filter((doc) => !acceptedNow.has(doc));

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

      const model = await resolveParticipationModel(ctx.coreDb, businessId);
      const required = requiredDocsFor(model);
      const email = ctx.user?.email ?? null;
      for (const doc of required) {
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
              VALUES (gen_random_uuid()::text, ${ctx.userId ?? null}, 'BUSINESS_TERMS_ACCEPTED', 'business_consents', ${businessId}, ${JSON.stringify({ version: LEGAL_VERSION, docs: required, model })})`,
        );
      } catch {
        /* la auditoría es best-effort: no debe romper la aceptación */
      }

      // Comprobante por correo: prueba de quién aceptó qué, y aviso al negocio.
      // Best-effort: si el correo falla, la aceptación ya quedó registrada.
      if (email) {
        const docsHtml = docsFor(model)
          .map((d) => `· ${d.label}`)
          .join("<br/>");
        const fecha = new Intl.DateTimeFormat("es-MX", {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: "America/Mexico_City",
        }).format(new Date());
        void import("../services/ownerNotify")
          .then(({ sendOwnerEmail }) =>
            sendOwnerEmail(
              email,
              "Comprobante de aceptación · Rabbitty",
              `<div style="font-family:system-ui,sans-serif;background:#0A0314;padding:24px;color:#fff">
                 <div style="max-width:560px;margin:0 auto;background:linear-gradient(180deg,#130725,#0A0314);border:1px solid rgba(244,63,94,.3);border-radius:24px;padding:24px">
                   <p style="margin:0;font-size:11px;font-weight:900;letter-spacing:.25em;color:#F43F5E">RABBITTY</p>
                   <h1 style="margin:8px 0 0;font-size:21px;color:#fff">Comprobante de aceptación</h1>
                   <p style="margin:14px 0 10px;font-size:14px;color:#E2E8F0">Hola${ctx.user?.name ? ` ${ctx.user.name}` : ""},</p>
                   <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#CBD5E1">
                     Dejamos constancia de que el <strong>${fecha}</strong> aceptaste los documentos
                     del servicio en su versión <strong>${LEGAL_VERSION}</strong>:
                   </p>
                   <p style="margin:0 0 12px;font-size:12.5px;line-height:1.9;color:#CBD5E1">${docsHtml}</p>
                   <p style="margin:0;font-size:11.5px;line-height:1.6;color:#94A3B8">
                     Puedes consultarlos en <a href="https://app.rabbitty.me/legal" style="color:#F472B6">app.rabbitty.me/legal</a>.
                     Si no reconoces esta aceptación, escríbenos a hola@rabbitty.me.
                   </p>
                 </div>
               </div>`,
            ),
          )
          .catch(() => {});
      }

      return { success: true, version: LEGAL_VERSION, docs: required, model };
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
