import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ref = 'general', device = 'unknown', userAgent = '' } = body;

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const referer = req.headers.get('referer') || '';

    const dbUrl = process.env.CORE_DATABASE_URL || process.env.DATABASE_URL;

    if (dbUrl) {
      try {
        const postgres = (await import('postgres')).default;
        const sql = postgres(dbUrl, { ssl: 'require', max: 1 });

        // Ensure table exists on first run
        await sql`
          CREATE TABLE IF NOT EXISTS qr_telemetry_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            campaign_ref TEXT NOT NULL,
            device_type TEXT NOT NULL,
            user_agent TEXT,
            ip_address TEXT,
            referrer TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `;

        await sql`
          INSERT INTO qr_telemetry_events (
            campaign_ref, device_type, user_agent, ip_address, referrer
          ) VALUES (
            ${ref}, ${device}, ${userAgent}, ${ip}, ${referer}
          );
        `;

        await sql.end();
      } catch (dbErr) {
        console.error('[Telemetry DB Error]:', dbErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error recording telemetry';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
