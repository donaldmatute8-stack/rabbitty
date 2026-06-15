import { NextResponse } from 'next/server';
import { db } from '@/db';
import { pendingVaults } from '@/db/schema';
import { eq, and, lte } from 'drizzle-orm';

// Este endpoint debería ser invocado periódicamente por un Cron Job (ej. Vercel Cron, GitHub Actions, o Railway Cron)
export async function GET(request: Request) {
  try {
    // Seguridad básica para evitar que cualquiera ejecute el Cron
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized cron access' }, { status: 401 });
    }

    const now = new Date();

    // Buscar todos los vaults pendientes cuya fecha de expiración ya pasó
    const expiredVaults = await db.select()
      .from(pendingVaults)
      .where(
        and(
          eq(pendingVaults.status, 'PENDING'),
          lte(pendingVaults.expiresAt, now)
        )
      );

    if (expiredVaults.length === 0) {
      return NextResponse.json({ message: 'No expired vaults found', processed: 0 });
    }

    // Calcular la cantidad de Bunz recuperados
    const totalBunzRecovered = expiredVaults.reduce((acc, vault) => acc + vault.bunzAmount, 0);

    // Actualizar el estado a EXPIRED_TO_TREASURY
    // En el futuro, aquí se puede insertar un registro en la tabla de "Tesorería" para la contabilidad general.
    const expiredIds = expiredVaults.map(v => v.id);
    
    // Por limitaciones de SQLite/Postgres en updates masivos por array, usamos un loop si son pocos, o una query unificada.
    // Drizzle no soporta un simple `inArray` tan directo para updates masivos genéricos si los drivers varían, pero sí en Postgres.
    for (const id of expiredIds) {
        await db.update(pendingVaults)
          .set({ status: 'EXPIRED_TO_TREASURY' })
          .where(eq(pendingVaults.id, id));
    }

    console.log(`[Cron] Bóvedas vencidas procesadas: ${expiredVaults.length}. Bunz recuperados a tesorería: ${totalBunzRecovered}`);

    return NextResponse.json({
      success: true,
      processedVaults: expiredVaults.length,
      totalBunzRecovered,
      message: 'Expired vaults moved to treasury successfully'
    });

  } catch (error: any) {
    console.error('[Cron] Error processing vault expiration:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
