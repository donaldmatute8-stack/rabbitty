import { NextResponse } from 'next/server';
import { db } from '@/db';
import { systemSettings } from '@/db/schema';

const DEFAULT_SETTINGS: Record<string, string> = {
  free_registration: 'true',
  registration_fee: '5000',
  fee_due_days: '30',
};

export async function GET() {
  const rows = await db.select().from(systemSettings);
  const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    settings[row.key] = row.value;
  }

  return NextResponse.json({
    success: true,
    free_registration: settings.free_registration === 'true',
    registration_fee: parseInt(settings.registration_fee) || 5000,
    fee_due_days: parseInt(settings.fee_due_days) || 30,
  });
}
