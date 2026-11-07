/**
 * ── Readiness del afiliado para aparecer en la app ───────────────────────────
 *
 * Checklist mínima y explicable. No es la misma que el ReadinessBar completo:
 * es la que se usa para avisar por push/email qué falta para salir a mercado.
 */

import { and, eq, sql } from "drizzle-orm";
import { ownedBusinesses, users } from "@rabbitty/database-core";
import { restaurants, branches, menuItems } from "@rabbitty/database-restaurant/schema";

export type AffiliateReadiness = {
  businessId: string;
  businessName: string;
  ownerId: string | null;
  ownerEmail: string | null;
  ownerFirstName: string | null;
  sandbox: boolean;
  status: string;
  ready: boolean;
  missing: string[];
};

const realAddress = (v?: string | null) =>
  Boolean(v && v.trim() && !String(v).toLowerCase().startsWith("provisionado por"));

export async function computeAffiliateReadiness(
  coreDb: any,
  restaurantDb: any,
  business: {
    id: string;
    ownerId: string | null;
    name: string;
    category: string | null;
    address: string | null;
    description: string | null;
    logoUrl: string | null;
    activeDays: string | null;
    startTime: string | null;
    endTime: string | null;
    verificationData: string | null;
    sandbox: boolean;
    status: string;
  }
): Promise<AffiliateReadiness> {
  let data: Record<string, any> = {};
  try {
    data = JSON.parse(business.verificationData || "{}");
  } catch {
    data = {};
  }
  const legal = data.legalProfile ?? {};
  const contract = data.contractSignature ?? null;

  const [rest] = await restaurantDb
    .select({ id: restaurants.id, phone: restaurants.phone, logoUrl: restaurants.logoUrl })
    .from(restaurants)
    .where(eq(restaurants.businessId, business.id))
    .limit(1);

  const [branch] = rest
    ? await restaurantDb
        .select({ id: branches.id, address: branches.address })
        .from(branches)
        .where(eq(branches.restaurantId, rest.id))
        .limit(1)
    : [];

  const [menu] = branch
    ? await restaurantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(menuItems)
        .where(and(eq(menuItems.branchId, branch.id), eq(menuItems.isActive, true)))
        .limit(1)
    : [];

  const [owner] = business.ownerId
    ? await coreDb
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
        })
        .from(users)
        .where(eq(users.id, business.ownerId))
        .limit(1)
    : [];

  const missing: string[] = [];
  if (!business.name?.trim()) missing.push("Nombre del negocio");
  if (!business.category?.trim()) missing.push("Categoría o nicho");
  if (!realAddress(business.address) && !realAddress(branch?.address)) missing.push("Dirección física");
  if (!business.logoUrl && !rest?.logoUrl) missing.push("Logo del negocio");
  if (!business.description?.trim()) missing.push("Descripción del negocio");
  if (!business.activeDays || business.activeDays === "[]" || !business.startTime || !business.endTime) {
    missing.push("Horario y días de atención");
  }
  if (Number(menu?.count ?? 0) < 3) missing.push("Menú con al menos 3 productos activos");

  if (!legal.legalName || !legal.rfc || !legal.representative) {
    missing.push("Datos legales: razón social, RFC y representante");
  }
  if (!contract) missing.push("Aceptación del acuerdo MCCE (borrador o definitivo)");

  return {
    businessId: business.id,
    businessName: business.name,
    ownerId: business.ownerId,
    ownerEmail: owner?.email ?? null,
    ownerFirstName: owner?.firstName ?? null,
    sandbox: Boolean(business.sandbox),
    status: business.status,
    ready: missing.length === 0,
    missing,
  };
}
