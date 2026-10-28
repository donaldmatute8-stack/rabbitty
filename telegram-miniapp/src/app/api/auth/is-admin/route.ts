import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';

const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || '798431743').split(',').map((id) => id.trim());
const ADMIN_USERNAMES = ['deltoro', 'mardelbull'];
const ADMIN_EMAILS = ['marco.munoz9@gmail.com', 'admin@rabbitty.com'];

export async function GET(req: Request) {
  const caller = await getAuthenticatedUser(req);
  if (!caller) {
    return NextResponse.json({ isAdmin: false });
  }
  const telegramId = caller.telegramId ? caller.telegramId.toString() : '';
  const username = (caller.username || '').toLowerCase();
  const email = (caller.email || '').toLowerCase();
  const isGodAdmin =
    caller.role === 'ADMIN' ||
    (!!telegramId && ADMIN_TELEGRAM_IDS.includes(telegramId)) ||
    ADMIN_USERNAMES.includes(username) ||
    ADMIN_EMAILS.includes(email);

  return NextResponse.json({ isAdmin: isGodAdmin });
}
