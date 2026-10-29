import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, ownedBusinesses } from "@/db/schema";
import { eq, or, sql } from "drizzle-orm";
import { code6FromData } from "@/lib/rabbittyCodeCodec";

/**
 * POST /api/rabbitty-code/lookup — { code: number }
 * Resuelve un código de 6 dígitos (barras del RabbittyCode) al usuario dueño.
 * Prueba las variantes canónicas de payload que la app muestra por usuario.
 * Rate limit básico en memoria.
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
  return entry.count <= 20; // 20 lookups/min por IP
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

    // ── Modo texto: resolver cualquier QR estándar del ecosistema ──
    if (!hasCode && rawText) {
      try {
        const urlObj = rawText.startsWith("http") ? new URL(rawText) : null;
        const params = urlObj ? urlObj.searchParams : new URLSearchParams(rawText.split("?")[1] || "");

        // 1. branchId (QR de mostrador / check-in sin mesa) → negocio dueño
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

        // 2. download?ref= (pósters impresos) → negocio por slug/id8/nombre
        const ref = params.get("ref") || (rawText.includes("download?ref=") ? rawText.split("download?ref=")[1]?.split("&")[0] : "");
        if (ref) {
          const refNorm = ref.toLowerCase().replace(/[^a-z0-9]/g, "");
          const bizRows = await db
            .select({ id: ownedBusinesses.id, name: ownedBusinesses.name, slug: ownedBusinesses.slug })
            .from(ownedBusinesses)
            .limit(5000);
          const match = bizRows.find(
            (b) =>
              (b.slug || "").toLowerCase() === ref ||
              (b.slug || "").toLowerCase().replace(/[^a-z0-9]/g, "") === refNorm ||
              b.id.replace(/-/g, "").startsWith(refNorm) ||
              (b.name || "").toLowerCase().replace(/[^a-z0-9]/g, "") === refNorm
          );
          if (match) {
            return NextResponse.json({ success: true, type: "business", businessId: match.id, name: match.name });
          }
          // ref de campaña sin negocio conocido → landing externa
          return NextResponse.json({ success: true, type: "url", url: rawText });
        }

        // 3. Cualquier URL de Rabbitty no manejada → abrir externa (landing, perfiles)
        if (urlObj && (urlObj.host.includes("rabbitty.me") || urlObj.host.includes("rabbitty"))) {
          const path = urlObj.pathname;
          const affMatch = path.match(/\/affiliate\/([0-9a-f-]{10,})/i);
          if (affMatch) {
            return NextResponse.json({ success: true, type: "business", businessId: affMatch[1] });
          }
          return NextResponse.json({ success: true, type: "url", url: rawText });
        }

        // 3.5 pay?to= (QR de "Mi Código" escaneado por un afiliado) → usuario
        const toParam = params.get("to") || (rawText.includes("to=") ? rawText.match(/[?&]to=([^&]+)/)?.[1] : "");
        if (toParam && !params.get("intent")) {
          const handleRaw = decodeURIComponent(toParam).replace(/^@/, "").trim();
          if (handleRaw) {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(handleRaw);
            const isDigits = /^\d{5,}$/.test(handleRaw);
            const [u] = await db
              .select({ id: users.id, username: users.username, firstName: users.firstName })
              .from(users)
              .where(
                isUuid
                  ? eq(users.id, handleRaw)
                  : or(
                      eq(users.username, handleRaw),
                      isDigits ? eq(users.telegramId, handleRaw) : sql`FALSE`
                    )
              )
              .limit(1);
            if (u) {
              const handle = u.username ? `@${u.username}` : u.id;
              return NextResponse.json({ success: true, type: "user", user: { id: u.id, username: u.username, name: u.firstName || u.username, handle } });
            }
            return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });
          }
        }

        // 4. Handle de usuario directo (@usuario) → transferencia
        if (rawText.startsWith("@")) {
          const handle = rawText.slice(1);
          const [u] = await db.select({ id: users.id, username: users.username, firstName: users.firstName }).from(users).where(eq(users.username, handle)).limit(1);
          if (u) {
            return NextResponse.json({ success: true, type: "user", user: { id: u.id, username: u.username, name: u.firstName || u.username, handle: `@${u.username}` } });
          }
        }
      } catch (resolveErr) {
        console.warn("[RABBITTY_CODE_LOOKUP] text resolve:", resolveErr);
      }
      return NextResponse.json({ success: false, error: "Código no reconocido" }, { status: 404 });
    }

    // ── 0. Gate de /impresos: código de sesión pendiente (RabbittyCode del candado) ──
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
    } catch { /* sin gate pendiente — sigue */ }

    // ── 1. Negocios afiliados (portal de negocio muestra business_<id>) ──
    const bizRows = await db
      .select({ id: ownedBusinesses.id, name: ownedBusinesses.name, slug: ownedBusinesses.slug })
      .from(ownedBusinesses)
      .limit(5000);
    for (const b of bizRows) {
      const variants = [`business_${b.id}`, b.slug || "", b.name || ""].filter(Boolean);
      if (variants.some((v) => code6FromData(v) === code)) {
        return NextResponse.json({
          success: true,
          type: "business",
          businessId: b.id,
          name: b.name,
        });
      }
    }

    // ── 2. Usuarios (Rabbitters) ──
    const candidates = await db.query.users.findMany({
      columns: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        telegramId: true,
        phoneNumber: true,
        tonWalletAddress: true,
      },
      limit: 5000,
    });

    for (const u of candidates) {
      const handle = u.username ? `@${u.username}` : u.id;
      const variants = [
        `rabbitty://pay?to=${encodeURIComponent(handle)}`,
        `rabbitty://pay?to=${encodeURIComponent(u.id)}`,
        u.id,
        u.telegramId || "",
      ].filter(Boolean);
      if (variants.some((v) => code6FromData(v) === code)) {
        return NextResponse.json({
          success: true,
          type: "user",
          user: {
            id: u.id,
            username: u.username,
            name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Rabbitter",
            handle,
          },
        });
      }
    }

    return NextResponse.json({ success: false, error: "Código no reconocido" }, { status: 404 });
  } catch (err) {
    console.error("[RABBITTY_CODE_LOOKUP]", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
