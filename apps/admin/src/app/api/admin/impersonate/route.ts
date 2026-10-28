import { NextRequest, NextResponse } from "next/server";
import { auth } from "@rabbitty/auth";
import { getRestaurantDb, getCoreDb } from "@rabbitty/api/db";
import { restaurants, branches } from "@rabbitty/database-restaurant/schema";
import { ownedBusinesses, auditEntries } from "@rabbitty/database-core";
import { eq, and } from "drizzle-orm";
import {
  isGodAdminIdentity,
  verifyGod2faCookieValue,
  verifyImpersonationCookieValue,
  issueImpersonationCookieValue,
  GOD_2FA_COOKIE,
  GOD_IMP_COOKIE,
} from "@rabbitty/api/services/god2fa";

export const runtime = "nodejs";

function readCookie(req: NextRequest, name: string): string | undefined {
  return req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

// GET /api/admin/impersonate → estado actual (¿viendo a qué tenant?)
export async function GET(req: NextRequest) {
  const imp = verifyImpersonationCookieValue(readCookie(req, GOD_IMP_COOKIE));
  if (!imp) return NextResponse.json({ impersonating: null });

  const coreDb = getCoreDb();
  const restaurantDb = getRestaurantDb();
  const [biz] = await coreDb
    .select({ name: ownedBusinesses.name })
    .from(ownedBusinesses)
    .where(eq(ownedBusinesses.id, imp.businessId))
    .limit(1);
  const [branch] = await restaurantDb
    .select({ name: branches.name })
    .from(branches)
    .where(eq(branches.id, imp.branchId))
    .limit(1);

  return NextResponse.json({
    impersonating: { businessId: imp.businessId, branchId: imp.branchId, businessName: biz?.name ?? imp.businessId, branchName: branch?.name ?? "" },
  });
}

// POST /api/admin/impersonate { businessId, branchId } → iniciar Vista Tenant
export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email || "";
  const name = session?.user?.name || "";
  if (!isGodAdminIdentity(email, name)) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }
  if (!verifyGod2faCookieValue(readCookie(req, GOD_2FA_COOKIE))) {
    return NextResponse.json({ success: false, error: "Verifica tu 2FA primero" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const businessId = String(body?.businessId || "");
    const branchId = String(body?.branchId || "");
    if (!businessId || !branchId) {
      return NextResponse.json({ success: false, error: "businessId y branchId requeridos" }, { status: 400 });
    }

    // Validar que la sucursal pertenezca al negocio (activo)
    const restaurantDb = getRestaurantDb();
    const coreDb = getCoreDb();
    const [branchRow] = await restaurantDb
      .select({ id: branches.id, restaurantId: branches.restaurantId, isActive: branches.isActive })
      .from(branches)
      .where(and(eq(branches.id, branchId), eq(branches.isActive, true)))
      .limit(1);
    if (!branchRow) return NextResponse.json({ success: false, error: "Sucursal no encontrada o inactiva" }, { status: 404 });
    const [restRow] = await restaurantDb
      .select({ businessId: restaurants.businessId })
      .from(restaurants)
      .where(eq(restaurants.id, branchRow.restaurantId))
      .limit(1);
    if (!restRow || restRow.businessId !== businessId) {
      return NextResponse.json({ success: false, error: "La sucursal no pertenece a ese negocio" }, { status: 400 });
    }
    const [bizRow] = await coreDb
      .select({ name: ownedBusinesses.name })
      .from(ownedBusinesses)
      .where(eq(ownedBusinesses.id, businessId))
      .limit(1);
    if (!bizRow) return NextResponse.json({ success: false, error: "Negocio no encontrado" }, { status: 404 });

    await coreDb.insert(auditEntries).values({
      userId: String(session?.user?.id || "god_admin"),
      action: "IMPERSONATION_START",
      resource: "ownedBusinesses",
      resourceId: businessId,
      details: JSON.stringify({ branchId, businessName: bizRow.name, godEmail: email }),
    });

    const res = NextResponse.json({ success: true, businessName: bizRow.name, branchId });
    res.cookies.set(GOD_IMP_COOKIE, issueImpersonationCookieValue(businessId, branchId), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 8 * 60 * 60,
      path: "/",
    });
    return res;
  } catch {
    return NextResponse.json({ success: false, error: "Body inválido" }, { status: 400 });
  }
}

// DELETE /api/admin/impersonate → salir de la Vista Tenant
export async function DELETE(req: NextRequest) {
  const imp = verifyImpersonationCookieValue(readCookie(req, GOD_IMP_COOKIE));
  if (imp) {
    const session = await auth();
    const coreDb = getCoreDb();
    await coreDb
      .insert(auditEntries).values({
        userId: String(session?.user?.id || "god_admin"),
        action: "IMPERSONATION_END",
        resource: "ownedBusinesses",
        resourceId: imp.businessId,
        details: JSON.stringify({ branchId: imp.branchId }),
      }).catch(() => {});
  }
  const res = NextResponse.json({ success: true });
  res.cookies.set(GOD_IMP_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
  return res;
}
