import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || '798431743').split(',');

export async function GET(req: Request) {
  const telegramId = new URL(req.url).searchParams.get('telegramId');
  if (!telegramId) {
    return NextResponse.json({ isAdmin: false });
  }
  return NextResponse.json({ isAdmin: ADMIN_TELEGRAM_IDS.includes(telegramId) });
}
