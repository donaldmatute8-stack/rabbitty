import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';

const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || '798431743').split(',').map((id) => id.trim());

export async function GET(req: Request) {
  const caller = await getAuthenticatedUser(req);
  if (!caller) {
    return NextResponse.json({ isAdmin: false });
  }
  const telegramId = caller.telegramId ? caller.telegramId.toString() : '';
  return NextResponse.json({ isAdmin: !!telegramId && ADMIN_TELEGRAM_IDS.includes(telegramId) });
}
