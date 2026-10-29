import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, ownedBusinesses } from "@/db/schema";
import { eq, or, sql, ilike } from "drizzle-orm";
import { code6FromData } from "@/lib/rabbittyCodeCodec";

/**
 * POST /api/rabbitty-code/lookup
 * Resuelve identificadores Rabbitty (QR estándar, URLs, @usuario, UUIDs y RabbittyCode numérico).
 * Optimizado con consultas indexadas a base de datos.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= 60; // 60 lookups/min por IP
}

interface CodeIndexEntry {
  type: 'business' | 'user';
  id: string;
  name: string;
  handle?: string;
  username?: string | null;
}

// ── Reverse index en memoria (O(1)) con TTL de 60s y detección de colisiones ──
let reverseIndexCache: Map<number, CodeIndexEntry[]> | null = null;
let indexExpiresAt = 0;

async function getOrBuildReverseIndex(): Promise<Map<number, CodeIndexEntry[]>> {
  const now = Date.now();
  if (reverseIndexCache && now < indexExpiresAt) {
    return reverseIndexCache;
  }

  const map = new Map<number, CodeIndexEntry[]>();

  const addEntry = (code: number, entry: CodeIndexEntry) => {
    const list = map.get(code) || [];
    if (!list.some(e => e.id === entry.id)) {
      list.push(entry);
    }
    map.set(code, list);
  };

  // 1. Negocios aprobados
  const bizRows = await db
    .select({ id: ownedBusinesses.id, name: ownedBusinesses.name, slug: ownedBusinesses.slug })
    .from(ownedBusinesses)
    .where(eq(ownedBusinesses.status, "APPROVED"))
    .orderBy(ownedBusinesses.createdAt)
    .limit(5000);

  for (const b of bizRows) {
    const variants = [`business_${b.id}`, b.slug || "", b.name || ""].filter(Boolean);
    for (const v of variants) {
      addEntry(code6FromData(v), { type: 'business', id: b.id, name: b.name });
    }
  }

  // 2. Usuarios
  const candidates = await db
    .select({
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      telegramId: users.telegramId,
    })
    .from(users)
    .orderBy(users.createdAt)
    .limit(5000);

  for (const u of candidates) {
    const handle = u.username ? `@${u.username}` : u.id;
    const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Rabbitter";
    const variants = [
      `rabbitty://pay?to=${encodeURIComponent(handle)}`,
      `rabbitty://pay?to=${encodeURIComponent(u.id)}`,
      u.id,
      u.telegramId || "",
    ].filter(Boolean);

    for (const v of variants) {
      addEntry(code6FromData(v), {
        type: 'user',
        id: u.id,
        username: u.username,
        name: fullName,
        handle,
      });
    }
  }

  reverseIndexCache = map;
  indexExpiresAt = now + 60_000;
  return map;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!rateLimit(ip)) {
      return NextResponse.json({ success: false, error: "Demasiadas consultas" }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const rawText = typeof body?.text === "string" ? body.text.trim() : "";
    const code = Math.round(Number(body?.code));
    const hasCode = Number.isFinite(code) && code >= 0 && code <= 999_999;

    if (!hasCode && !rawText) {
      return NextResponse.json({ success: false, error: "Código inválido" }, { status: 400 });
    }

    // ─────────────────────────────────────────────────────────────
    // 1. MODO TEXTO: QR estándar, URLs, @handles, UUIDs
    // ─────────────────────────────────────────────────────────────
    if (rawText) {
      try {
        const urlObj = rawText.startsWith("http") ? new URL(rawText) : null;
        const params = urlObj ? urlObj.searchParams : new URLSearchParams(rawText.split("?")[1] || "");

        // 1.1 branchId (QR de mostrador / check-in sin mesa) → negocio dueño
        const branchId = params.get("branchId") || params.get("branch");
        if (branchId && !params.get("tableId") && !params.get("claimToken")) {
          const [branchRow] = await db.execute(
            sql`SELECT b."restaurantId", r."businessId" FROM branches b JOIN restaurants r ON r.id = b."restaurantId" WHERE b.id = ${branchId} LIMIT 1`
          ).then((r: unknown) => ((r as { rows?: Array<{ businessId: string }> }).rows || (r as unknown as Array<{ businessId: string }>)) as Array<{ businessId: string }>);
          const businessId = branchRow?.businessId;
          if (businessId) {
            const [biz] = await db.select({ id: ownedBusinesses.id, name: ownedBusinesses.name }).from(ownedBusinesses).where(eq(ownedBusinesses.id, businessId)).limit(1);
            if (biz) {
              return NextResponse.json({ success: true, type: "business", businessId: biz.id, name: biz.name, checkIn: true });
            }
          }
        }

        // 1.2 download?ref= (pósters impresos) → consulta directa por slug, id o nombre
        const ref = params.get("ref") || (rawText.includes("download?ref=") ? rawText.split("download?ref=")[1]?.split("&")[0] : "");
        if (ref) {
          const cleanRef = ref.trim();
          const [matchedBiz] = await db
            .select({ id: ownedBusinesses.id, name: ownedBusinesses.name })
            .from(ownedBusinesses)
            .where(
              or(
                eq(ownedBusinesses.slug, cleanRef),
                eq(ownedBusinesses.id, cleanRef),
                ilike(ownedBusinesses.name, cleanRef)
              )
            )
            .limit(1);

          if (matchedBiz) {
            return NextResponse.json({ success: true, type: "business", businessId: matchedBiz.id, name: matchedBiz.name });
          }
          return NextResponse.json({ success: true, type: "url", url: rawText });
        }

        // 1.3 URLs de afiliados o landing
        if (urlObj && (urlObj.host.includes("rabbitty.me") || urlObj.host.includes("rabbitty"))) {
          const path = urlObj.pathname;
          const affMatch = path.match(/\/affiliate\/([0-9a-f-]{10,})/i);
          if (affMatch) {
            return NextResponse.json({ success: true, type: "business", businessId: affMatch[1] });
          }
          return NextResponse.json({ success: true, type: "url", url: rawText });
        }

        // 1.4 rabbitty://pay?to= o parámetro to=
        const toParam = params.get("to") || (rawText.includes("to=") ? rawText.match(/[?&]to=([^&]+)/)?.[1] : "");
        const targetSearch = toParam ? decodeURIComponent(toParam).replace(/^@/, "").trim() : rawText.replace(/^@/, "").trim();

        if (targetSearch) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetSearch);
          const isDigits = /^\d{5,}$/.test(targetSearch);

          const [u] = await db
            .select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName })
            .from(users)
            .where(
              isUuid
                ? eq(users.id, targetSearch)
                : or(
                    ilike(users.username, targetSearch),
                    isDigits ? eq(users.telegramId, targetSearch) : sql`FALSE`,
                    isDigits ? eq(users.phoneNumber, targetSearch) : sql`FALSE`
                  )
            )
            .limit(1);

          if (u) {
            const handle = u.username ? `@${u.username}` : u.id;
            const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Rabbitter";
            return NextResponse.json({
              success: true,
              type: "user",
              user: { id: u.id, username: u.username, name: fullName, handle },
            });
          }

          // Si no fue usuario, comprobar si es un negocio por ID o slug
          const [biz] = await db
            .select({ id: ownedBusinesses.id, name: ownedBusinesses.name })
            .from(ownedBusinesses)
            .where(
              or(
                isUuid ? eq(ownedBusinesses.id, targetSearch) : sql`FALSE`,
                eq(ownedBusinesses.slug, targetSearch)
              )
            )
            .limit(1);

          if (biz) {
            return NextResponse.json({ success: true, type: "business", businessId: biz.id, name: biz.name });
          }
        }
      } catch (resolveErr) {
        console.warn("[RABBITTY_CODE_LOOKUP] text resolve error:", resolveErr);
      }
      return NextResponse.json({ success: false, error: "Código no reconocido" }, { status: 404 });
    }

    // ─────────────────────────────────────────────────────────────
    // 2. MODO CÓDIGO NUMÉRICO DE 6 DÍGITOS (RabbittyCode Neón)
    // ─────────────────────────────────────────────────────────────
    if (hasCode) {
      // 2.1 Gate de /impresos: código de sesión pendiente (candado POS)
      try {
        const pendingRows = await db.execute(
          sql`SELECT value FROM "systemSettings" WHERE key = 'impresos_pending_codes' LIMIT 1`
        );
        const pendingRaw = (pendingRows as unknown as { rows?: Array<{ value: string }> }).rows?.[0]?.value
          ?? (pendingRows as unknown as Array<{ value: string }>)?.[0]?.value;
        if (pendingRaw) {
          const pending = JSON.parse(pendingRaw) as Record<string, { sessionId: string; token: string; expiresAt: string }>;
          const entry = pending[String(code)];
          if (entry && new Date(entry.expiresAt).getTime() > Date.now()) {
            return NextResponse.json({ success: true, type: 'qrlogin', qrToken: entry.token, sessionId: entry.sessionId });
          }
        }
      } catch {}

      // 2.2 Resolución O(1): código asignado por el servidor (sin colisiones, sin iteración)
      const [bizMatch] = await db
        .select({ id: ownedBusinesses.id, name: ownedBusinesses.name })
        .from(ownedBusinesses)
        .where(eq(ownedBusinesses.scanCode, code))
        .limit(1);
      if (bizMatch) {
        return NextResponse.json({ success: true, type: "business", businessId: bizMatch.id, name: bizMatch.name });
      }

      const [userMatch] = await db
        .select({
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.scanCode, code))
        .limit(1);
      if (userMatch) {
        const handle = userMatch.username ? `@${userMatch.username}` : userMatch.id;
        const fullName = [userMatch.firstName, userMatch.lastName].filter(Boolean).join(" ") || userMatch.username || "Rabbitter";
        return NextResponse.json({
          success: true,
          type: "user",
          user: { id: userMatch.id, username: userMatch.username, name: fullName, handle },
        });
      }

      return NextResponse.json({ success: false, error: "Código no reconocido" }, { status: 404 });
    }
  } catch (err) {
    console.error("[RABBITTY_CODE_LOOKUP]", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
