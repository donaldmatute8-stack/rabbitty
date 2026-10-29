import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { code6FromData } from '@/lib/rabbittyCodeCodec';

function getDbUrl(): string | undefined {
  return process.env.CORE_DATABASE_URL || process.env.POSTGRES_URL;
}

export async function POST(req: Request) {
  const dbUrl = getDbUrl();
  if (!dbUrl) {
    return NextResponse.json(
      { success: false, error: 'Base de datos no configurada en landing-page' },
      { status: 500 }
    );
  }

  // ── SET_WELCOME_BUNZ: persiste el Bono de Bienvenida del tenant (Bunz) ──
  // Requiere sesión qr-impresos autenticada (God admin o dueño del negocio).
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action === 'SET_WELCOME_BUNZ') {
      const sessionId = String(body.sessionId || '');
      const businessId = String(body.businessId || '');
      const bunz = Math.round(Number(body.bunz));
      if (!sessionId || !businessId || !Number.isFinite(bunz) || bunz < 5 || bunz > 200) {
        return NextResponse.json({ success: false, error: 'Parámetros inválidos (bunz 5–200)' }, { status: 400 });
      }

      const postgres = (await import('postgres')).default;
      const sql = postgres(dbUrl, { ssl: 'require', max: 1 });
      const sessions = await sql`SELECT id, "userId" FROM "webSessions" WHERE id = ${sessionId} LIMIT 1`;
      const session = sessions[0];
      if (!session?.userId) {
        await sql.end();
        return NextResponse.json({ success: false, error: 'Sesión no autenticada' }, { status: 401 });
      }

      const userRows = await sql`
        SELECT id, username, email, role FROM users WHERE id = ${session.userId} LIMIT 1`;
      const user = userRows[0];
      if (!user) { await sql.end(); return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 }); }

      const isGod = ['admin@rabbitty.com', 'marco.munoz9@gmail.com'].includes(String(user.email || '').toLowerCase()) ||
        ['deltoro', 'mardelbull'].includes(String(user.username || '').toLowerCase()) ||
        String(user.role || '').toUpperCase() === 'ADMIN';
      let isOwner = false;
      if (!isGod) {
        const owned = await sql`
          SELECT id FROM "ownedBusinesses" WHERE id = ${businessId} AND "ownerId" = ${session.userId} LIMIT 1`;
        isOwner = owned.length > 0;
      }
      if (!isGod && !isOwner) {
        await sql.end();
        return NextResponse.json({ success: false, error: 'Solo el dueño del negocio o God Admin puede definir el bono' }, { status: 403 });
      }

      // Persistir en systemSettings: welcome_bonus_tenant_config = { [businessId]: bunz }
      const cfgRows = await sql`SELECT value FROM "systemSettings" WHERE key = 'welcome_bonus_tenant_config' LIMIT 1`;
      let config: Record<string, number> = {};
      try { if (cfgRows[0]?.value) config = JSON.parse(cfgRows[0].value); } catch { config = {}; }
      config[businessId] = bunz;
      if (cfgRows.length > 0) {
        await sql`UPDATE "systemSettings" SET value = ${JSON.stringify(config)} WHERE key = 'welcome_bonus_tenant_config'`;
      } else {
        await sql`INSERT INTO "systemSettings" (key, value) VALUES ('welcome_bonus_tenant_config', ${JSON.stringify(config)})`;
      }
      await sql.end();

      return NextResponse.json({ success: true, businessId, welcomeBunz: bunz });
    }

    // ── Códigos de acceso temporal a /impresos (24h) para impresor/marketing ──
    if (body?.action === 'GENERATE_TEMP_CODE') {
      try {
        const sessionId = String(body.sessionId || '');
        const label = String(body.label || 'Invitado').slice(0, 40);
        if (!sessionId) {
          return NextResponse.json({ success: false, error: 'Sesión requerida' }, { status: 401 });
        }
        const postgres = (await import('postgres')).default;
        const sql = postgres(dbUrl, { ssl: 'require', max: 1 });
        const sessions = await sql`SELECT id, "userId" FROM "webSessions" WHERE id = ${sessionId} LIMIT 1`;
        const session = sessions[0];
        if (!session?.userId) { await sql.end(); return NextResponse.json({ success: false, error: 'Sesión no autenticada' }, { status: 401 }); }
        const userRows = await sql`SELECT username, email, role FROM users WHERE id = ${session.userId} LIMIT 1`;
        const user = userRows[0];
        const isGod = ['admin@rabbitty.com', 'marco.munoz9@gmail.com'].includes(String(user?.email || '').toLowerCase()) ||
          ['deltoro', 'mardelbull'].includes(String(user?.username || '').toLowerCase()) ||
          String(user?.role || '').toUpperCase() === 'ADMIN';
        await sql.end();

        // God → elige el tenant del scope (o todos). Dueño de negocio → scope a SU negocio.
        let scopeBusinessId: string | null = null;
        let scopeName = 'todos los tenants (God)';
        if (isGod && body.businessId) {
          const postgres4 = (await import('postgres')).default;
          const sql4 = postgres4(dbUrl, { ssl: 'require', max: 1 });
          const bizRows = await sql4`SELECT id, name FROM "ownedBusinesses" WHERE id = ${String(body.businessId)} LIMIT 1`;
          await sql4.end();
          if (bizRows[0]) {
            scopeBusinessId = bizRows[0].id;
            scopeName = bizRows[0].name;
          }
        }
        if (!isGod) {
          const postgres3 = (await import('postgres')).default;
          const sql3 = postgres3(dbUrl, { ssl: 'require', max: 1 });
          const ownedRows = await sql3`
            SELECT b.id, b.name FROM "ownedBusinesses" b WHERE b."ownerId" = ${session.userId}
            AND (b.status = 'APPROVED' OR b.status = 'ACTIVE') LIMIT 1`;
          await sql3.end();
          if (!ownedRows[0]) {
            return NextResponse.json({ success: false, error: 'Sin negocio afiliado asociado a tu cuenta' }, { status: 403 });
          }
          scopeBusinessId = ownedRows[0].id;
          scopeName = ownedRows[0].name;
        }

        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        const bytes = crypto.randomBytes(8);
        for (let i = 0; i < 8; i++) code += alphabet[bytes[i] % alphabet.length];
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const postgres2 = (await import('postgres')).default;
        const sql2 = postgres2(dbUrl, { ssl: 'require', max: 1 });
        const cfgRows = await sql2`SELECT value FROM "systemSettings" WHERE key = 'impresos_temp_access' LIMIT 1`;
        let config: Record<string, { label: string; createdAt: string; expiresAt: string; scopeBusinessId?: string | null }> = {};
        try { if (cfgRows[0]?.value) config = JSON.parse(cfgRows[0].value); } catch { config = {}; }
        const now = Date.now();
        for (const [k, v] of Object.entries(config)) {
          if (new Date(v.expiresAt).getTime() < now) delete config[k];
        }
        config[code] = { label, createdAt: new Date().toISOString(), expiresAt, scopeBusinessId };
        if (cfgRows.length > 0) {
          await sql2`UPDATE "systemSettings" SET value = ${JSON.stringify(config)} WHERE key = 'impresos_temp_access'`;
        } else {
          await sql2`INSERT INTO "systemSettings" (key, value) VALUES ('impresos_temp_access', ${JSON.stringify(config)})`;
        }
        await sql2.end();
        return NextResponse.json({ success: true, code, label, expiresAt, scopeBusinessId, scopeName, url: `https://www.rabbitty.me/impresos?access=${code}` });
      } catch (err) {
        console.error('[QR_IMPRESOS GENERATE_TEMP]', err);
        return NextResponse.json({ success: false, error: 'Error generando acceso' }, { status: 500 });
      }
    }

    if (body?.action === 'REDEEM_TEMP_CODE') {
      try {
        const code = String(body.code || '').trim().toUpperCase();
        if (!/^[A-Z0-9]{8}$/.test(code)) {
          return NextResponse.json({ success: false, error: 'Formato de código inválido' }, { status: 400 });
        }
        const postgres = (await import('postgres')).default;
        const sql = postgres(dbUrl, { ssl: 'require', max: 1 });
        const cfgRows = await sql`SELECT value FROM "systemSettings" WHERE key = 'impresos_temp_access' LIMIT 1`;
        await sql.end();
        let config: Record<string, { label: string; createdAt: string; expiresAt: string; scopeBusinessId?: string | null }> = {};
        try { if (cfgRows[0]?.value) config = JSON.parse(cfgRows[0].value); } catch { config = {}; }
        const entry = config[code];
        if (!entry || new Date(entry.expiresAt).getTime() < Date.now()) {
          return NextResponse.json({ success: false, error: 'Código inválido o expirado' }, { status: 401 });
        }
        return NextResponse.json({ success: true, label: entry.label, expiresAt: entry.expiresAt, scopeBusinessId: entry.scopeBusinessId ?? null });
      } catch (err) {
        console.error('[QR_IMPRESOS REDEEM_TEMP]', err);
        return NextResponse.json({ success: false, error: 'Error validando acceso' }, { status: 500 });
      }
    }
  } catch (err) {
    console.error('[QR_IMPRESOS SET_WELCOME_BUNZ]', err);
    return NextResponse.json({ success: false, error: 'Error al guardar el bono' }, { status: 500 });
  }

  try {
    const postgres = (await import('postgres')).default;
    const sql = postgres(dbUrl, { ssl: 'require', max: 1 });

    const sessionId = crypto.randomUUID();
    const qrToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(qrToken).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await sql`
      INSERT INTO "webSessions" (id, "jwtToken", "expiresAt")
      VALUES (${sessionId}, ${tokenHash}, ${expiresAt})
    `;

    // ── Gate scaneable por NEÓN: mapear el código de 6 dígitos del RabbittyCode
    //    de esta sesión → {sessionId, token}, para que el decoder de la App
    //    vincule la sesión sin QR cuadrado. ──
    const gateUrl = `https://app.rabbitty.me/scan?qrlogin_${qrToken}`;
    const gateCode = code6FromData(gateUrl);
    const cfgRows = await sql`SELECT value FROM "systemSettings" WHERE key = 'impresos_pending_codes' LIMIT 1`;
    let pending: Record<string, { sessionId: string; token: string; expiresAt: string }> = {};
    try { if (cfgRows[0]?.value) pending = JSON.parse(cfgRows[0].value); } catch { pending = {}; }
    const nowMs = Date.now();
    for (const [k, v] of Object.entries(pending)) {
      if (new Date(v.expiresAt).getTime() < nowMs) delete pending[k];
    }
    pending[String(gateCode)] = { sessionId, token: qrToken, expiresAt: expiresAt.toISOString() };
    if (cfgRows.length > 0) {
      await sql`UPDATE "systemSettings" SET value = ${JSON.stringify(pending)} WHERE key = 'impresos_pending_codes'`;
    } else {
      await sql`INSERT INTO "systemSettings" (key, value) VALUES ('impresos_pending_codes', ${JSON.stringify(pending)})`;
    }

    await sql.end();

    return NextResponse.json({
      success: true,
      sessionId,
      qrToken,
      qrData: gateUrl,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('[QR_IMPRESOS_GENERATE]', error);
    return NextResponse.json(
      { success: false, error: 'Error al generar sesión QR Neón' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const dbUrl = getDbUrl();
  if (!dbUrl) {
    return NextResponse.json(
      { success: false, error: 'Base de datos no configurada' },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'Falta sessionId' }, { status: 400 });
    }

    const postgres = (await import('postgres')).default;
    const sql = postgres(dbUrl, { ssl: 'require', max: 1 });

    const sessions = await sql`
      SELECT id, "userId", "expiresAt"
      FROM "webSessions"
      WHERE id = ${sessionId}
      LIMIT 1
    `;

    if (sessions.length === 0) {
      await sql.end();
      return NextResponse.json({ success: false, error: 'Sesión no encontrada' }, { status: 404 });
    }

    const session = sessions[0];

    if (!session.userId) {
      const isExpired = session.expiresAt && new Date(session.expiresAt) < new Date();
      await sql.end();
      return NextResponse.json({
        success: true,
        authenticated: false,
        expired: Boolean(isExpired),
      });
    }

    // Usuario ya escaneó el QR con la App de Rabbitty
    const userRows = await sql`
      SELECT id, "telegramId", username, "phoneNumber", "firstName", "lastName", email, role
      FROM users
      WHERE id = ${session.userId}
      LIMIT 1
    `;

    if (userRows.length === 0) {
      await sql.end();
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 });
    }

    const user = userRows[0];

    // Buscar si tiene negocios afiliados registrados
    const bizRows = await sql`
      SELECT 
        id,
        name,
        category,
        "rewardPercentage",
        address,
        "logoUrl",
        gallery,
        COALESCE(slug, SUBSTRING(id::text, 1, 8)) as "refCode",
        status
      FROM "ownedBusinesses"
      WHERE "ownerId" = ${user.id}
      ORDER BY "createdAt" DESC
    `;

    await sql.end();

    // Bono de bienvenida configurado por tenant (fallback 25)
    let welcomeConfig: Record<string, number> = {};
    try {
      const cfgRows = await sql`SELECT value FROM "systemSettings" WHERE key = 'welcome_bonus_tenant_config' LIMIT 1`;
      if (cfgRows[0]?.value) welcomeConfig = JSON.parse(cfgRows[0].value);
    } catch { welcomeConfig = {}; }

    const usernameNorm = String(user.username || '').toLowerCase().trim();
    const emailNorm = String(user.email || '').toLowerCase().trim();
    const phoneDigits = String(user.phoneNumber || '').replace(/\D/g, '');
    const tgId = String(user.telegramId || '').trim();

    const isAdmin =
      user.role === 'ADMIN' ||
      user.role === 'SUPERADMIN' ||
      tgId === '798431743' ||
      emailNorm === 'marco.munoz9@gmail.com' ||
      ['deltoro', 'mardelbull', 'marco'].includes(usernameNorm) ||
      phoneDigits.endsWith('3222741987');

    const isAffiliate = bizRows.length > 0 || user.role === 'AFFILIATE';

    if (isAdmin) {
      return NextResponse.json({
        success: true,
        authenticated: true,
        authorized: true,
        mode: 'admin',
        user: {
          id: user.id,
          name: user.firstName || user.username || 'Marco (Admin)',
          username: user.username,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: 'ADMIN',
        },
      });
    }

    if (isAffiliate) {
      const primaryBiz = bizRows[0] || null;
      let resolvedLogo = primaryBiz?.logoUrl || null;
      if (!resolvedLogo && primaryBiz?.gallery) {
        try {
          const parsed = JSON.parse(primaryBiz.gallery);
          if (Array.isArray(parsed) && parsed.length > 0) resolvedLogo = parsed[0];
        } catch {
          // ignore
        }
      }

      return NextResponse.json({
        success: true,
        authenticated: true,
        authorized: true,
        mode: 'affiliate',
        user: {
          id: user.id,
          name: user.firstName || user.username || 'Afiliado Rabbitty',
          username: user.username,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: 'AFFILIATE',
        },
        business: primaryBiz
          ? {
              id: primaryBiz.id,
              name: primaryBiz.name,
              category: primaryBiz.category || 'Local Afiliado',
              rewardPercentage: primaryBiz.rewardPercentage || 25,
              address: primaryBiz.address || '',
              logoUrl: resolvedLogo,
              welcomeBunz: welcomeConfig[primaryBiz.id] ?? 25,
              refCode:
                primaryBiz.refCode ||
                String(primaryBiz.name || '')
                  .toLowerCase()
                  .replace(/[^a-z0-9]/g, ''),
            }
          : null,
      });
    }

    // Es un Rabbitter (cliente regular sin negocio ni rol Admin) -> Rechazar acceso a /impresos
    return NextResponse.json({
      success: true,
      authenticated: true,
      authorized: false,
      mode: 'rabbitter',
      user: {
        id: user.id,
        name: user.firstName || user.username || 'Rabbitter',
        role: user.role,
      },
      message:
        'Acceso exclusivo para Negocios Afiliados y Administradores de Rabbitty. Tu cuenta actual es de cliente (Rabbitter).',
    });
  } catch (error) {
    console.error('[QR_IMPRESOS_POLL]', error);
    return NextResponse.json(
      { success: false, error: 'Error al verificar sesión QR Neón' },
      { status: 500 }
    );
  }
}

