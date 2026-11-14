import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getAuthenticatedUser } from "@/lib/serverAuth";

/**
 * ── Editar perfil inline (B6) ──────────────────────────────────────────────
 *
 * Permite cambiar nombre y usuario desde Configuración → Tu cuenta, como en
 * Twitter/Instagram. Reglas:
 * - el usuario se normaliza a minúsculas y debe ser único (case-insensitive);
 * - formato 3–20, letras/números/punto/guion bajo;
 * - el ID de Telegram no se toca (es interno y ya no se muestra en la app).
 */

const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;
const RESERVED = new Set(["rabbitty", "admin", "soporte", "support", "bunzy", "ra"]);

export async function POST(req: NextRequest) {
  const caller = await getAuthenticatedUser(req);
  if (!caller) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    firstName?: unknown;
    lastName?: unknown;
    username?: unknown;
  };

  const update: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof body.firstName === "string") {
    const value = body.firstName.trim().slice(0, 40);
    update.firstName = value || null;
  }
  if (typeof body.lastName === "string") {
    const value = body.lastName.trim().slice(0, 40);
    update.lastName = value || null;
  }

  if (typeof body.username === "string") {
    const username = body.username.trim().toLowerCase().replace(/^@+/, "");
    if (!USERNAME_RE.test(username)) {
      return NextResponse.json(
        { error: "El usuario debe tener 3–20 caracteres: letras, números, punto o guion bajo." },
        { status: 400 },
      );
    }
    if (RESERVED.has(username)) {
      return NextResponse.json({ error: "Ese usuario está reservado." }, { status: 409 });
    }
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(sql`lower(${users.username}) = ${username}`, ne(users.id, caller.id)))
      .limit(1);
    if (taken) {
      return NextResponse.json({ error: "Ese usuario ya está en uso. Prueba otro." }, { status: 409 });
    }
    update.username = username;
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  await db.update(users).set(update).where(eq(users.id, caller.id));

  return NextResponse.json({
    success: true,
    firstName: (update.firstName as string | null) ?? undefined,
    lastName: (update.lastName as string | null) ?? undefined,
    username: (update.username as string | undefined) ?? undefined,
  });
}
