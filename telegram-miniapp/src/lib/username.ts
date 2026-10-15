import { db } from '@/db';
import { users } from '@/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import crypto from 'crypto';

export const USERNAME_RE = /^[a-z0-9_]{3,32}$/;

export function sanitizeUsername(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const cleaned = input.trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (cleaned.length < 3) return null;
  return cleaned.slice(0, 32);
}

export async function isUsernameTaken(candidate: string, excludeUserId?: string): Promise<boolean> {
  const found = await db.query.users.findFirst({
    where: excludeUserId
      ? and(eq(users.username, candidate), ne(users.id, excludeUserId))
      : eq(users.username, candidate),
  });
  return Boolean(found);
}

export async function resolveUniqueUsername(base: unknown, excludeUserId?: string): Promise<string> {
  const root = sanitizeUsername(base);
  if (!root) {
    return `user_${crypto.randomBytes(4).toString('hex')}`;
  }
  if (!(await isUsernameTaken(root, excludeUserId))) return root;
  for (let i = 0; i < 6; i++) {
    const candidate = `${root.slice(0, 26)}_${crypto.randomBytes(2).toString('hex')}`;
    if (!(await isUsernameTaken(candidate, excludeUserId))) return candidate;
  }
  return `user_${crypto.randomBytes(6).toString('hex')}`;
}
