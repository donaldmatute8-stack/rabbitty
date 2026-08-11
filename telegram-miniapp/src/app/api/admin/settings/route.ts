import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getVerifiedAdminId, isAdminAllowed } from '@/lib/adminAuth';

const DEFAULT_SETTINGS: Record<string, string> = {
  free_registration: 'true',
  registration_fee: '5000',
  fee_due_days: '30',
};

export async function GET(req: NextRequest) {
  if (!isAdminAllowed(getVerifiedAdminId(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
  try {
    const rows = await db.select().from(systemSettings);
    for (const row of rows) {
      settings[row.key] = row.value;
    }
  } catch (e) {
    console.warn('[Admin Settings] systemSettings table query warning:', e);
  }

  return NextResponse.json({ success: true, settings });
}

export async function POST(req: NextRequest) {
  if (!isAdminAllowed(getVerifiedAdminId(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { key, value } = await req.json();
    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Missing key or value' }, { status: 400 });
    }

    await db.insert(systemSettings)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: String(value) } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings POST Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
