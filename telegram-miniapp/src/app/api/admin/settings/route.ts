import { NextResponse } from 'next/server';
import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || '798431743').split(',');

const DEFAULT_SETTINGS: Record<string, string> = {
  free_registration: 'true',
  registration_fee: '5000',
  fee_due_days: '30',
};

export async function GET(req: Request) {
  const telegramId = req.headers.get('X-Telegram-Id');
  if (!telegramId || !ADMIN_TELEGRAM_IDS.includes(telegramId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const rows = await db.select().from(systemSettings);
  const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    settings[row.key] = row.value;
  }

  return NextResponse.json({ success: true, settings });
}

export async function POST(req: Request) {
  const telegramId = req.headers.get('X-Telegram-Id');
  if (!telegramId || !ADMIN_TELEGRAM_IDS.includes(telegramId)) {
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
