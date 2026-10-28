import { NextResponse } from 'next/server';
import crypto from 'crypto';

function getDbUrl(): string | undefined {
  return process.env.CORE_DATABASE_URL || process.env.POSTGRES_URL;
}

export async function POST(req: Request) {
  const dbUrl = getDbUrl();
  if (!dbUrl) {
    return NextResponse.json(
      { success: false, error: 'Base de datos no configurada' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const rawContact = String(body?.contact || '').trim();
    const ref = String(body?.ref || '626cafe').trim();
    const requestedBunz = Math.max(5, Math.min(200, parseInt(String(body?.bunz || '25'), 10) || 25));

    if (!rawContact) {
      return NextResponse.json(
        { success: false, error: 'Ingresa tu número de celular (10 dígitos) o correo electrónico.' },
        { status: 400 }
      );
    }

    const isEmail = rawContact.includes('@');
    const digitsOnly = rawContact.replace(/\D/g, '');

    if (!isEmail && digitsOnly.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Ingresa un número celular válido de 10 dígitos o tu correo.' },
        { status: 400 }
      );
    }

    const normalizedIdentifier = isEmail
      ? rawContact.toLowerCase()
      : `+52${digitsOnly.slice(-10)}`;

    const postgres = (await import('postgres')).default;
    const sql = postgres(dbUrl, { ssl: 'require', max: 1 });

    // 1. Resolver el negocio afiliado por ref — ESTRICTO: sin fallbacks aleatorios.
    //    Si el ref no corresponde a un afiliado real, el bono queda etiquetado como
    //    network (sin colateral de un tercero) y el motor de claim decide el split.
    const refNorm = ref.toLowerCase().replace(/[^a-z0-9]/g, '');
    const bizRows = await sql`
      SELECT id, name, category, "rewardPercentage"
      FROM "ownedBusinesses"
      WHERE status IN ('APPROVED', 'ACTIVE') AND (
        LOWER(COALESCE(slug, '')) = LOWER(${ref})
        OR LOWER(REPLACE(id::text, '-', '')) = LOWER(${refNorm})
        OR LOWER(REPLACE(name, ' ', '')) = LOWER(${refNorm})
      )
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;

    const resolvedBiz = bizRows[0] || null;

    // 2. Verificar si ya existe un vault pendiente de bienvenida para este contacto
    const existingVaults = await sql`
      SELECT id, status
      FROM "pendingVaults"
      WHERE (
        "phoneNumber" = ${normalizedIdentifier}
        OR (${!isEmail} AND regexp_replace("phoneNumber", '\\D', '', 'g') LIKE '%' || ${digitsOnly.slice(-10)})
      )
      AND "orderId" LIKE 'WELCOME_QR:%'
      LIMIT 1
    `;

    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 días para descargar y activar
    const orderTag = `WELCOME_QR:${ref}:${resolvedBiz?.id || 'network'}`;

    if (existingVaults.length > 0) {
      if (existingVaults[0].status === 'CLAIMED') {
        await sql.end();
        return NextResponse.json({
          success: true,
          alreadyClaimed: true,
          message: 'Este número/correo ya reclamó su Bono de Bienvenida. Abre tu App Rabbitty para ver tu saldo.',
          bunzReserved: requestedBunz,
          businessName: resolvedBiz?.name || 'Rabbitty',
        });
      }

      await sql`
        UPDATE "pendingVaults"
        SET "bunzAmount" = ${requestedBunz},
            "businessId" = ${resolvedBiz?.id || null},
            "orderId" = ${orderTag},
            "expiresAt" = ${expiresAt}
        WHERE id = ${existingVaults[0].id}
      `;
    } else {
      await sql`
        INSERT INTO "pendingVaults" (id, "phoneNumber", "bunzAmount", "businessId", "orderId", status, "expiresAt")
        VALUES (
          ${crypto.randomUUID()},
          ${normalizedIdentifier},
          ${requestedBunz},
          ${resolvedBiz?.id || null},
          ${orderTag},
          'PENDING',
          ${expiresAt}
        )
      `;
    }

    await sql.end();

    return NextResponse.json({
      success: true,
      alreadyClaimed: false,
      bunzReserved: requestedBunz,
      businessName: resolvedBiz?.name || 'Rabbitty Network',
      identifier: normalizedIdentifier,
      message: `¡Tus +${requestedBunz} Bunz quedaron reservados! Descarga la App e inicia sesión con ${rawContact} para recibir tu notificación y saldo al instante.`,
    });
  } catch (error) {
    console.error('[WELCOME_CLAIM_POST]', error);
    return NextResponse.json(
      { success: false, error: 'No se pudo reservar el bono en este momento.' },
      { status: 500 }
    );
  }
}

