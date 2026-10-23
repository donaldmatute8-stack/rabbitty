import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { or, ilike } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';

// Helper to normalize phone numbers (remove spaces, symbols, keep digits)
function cleanPhone(raw: string): string {
  return raw.replace(/[^0-9]/g, '');
}

export async function POST(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { contacts, query } = body as {
      contacts?: Array<{ name?: string; tel?: string }>;
      query?: string;
    };

    // 1. If searching by query (username, phone, or name)
    if (query && typeof query === 'string' && query.trim().length >= 2) {
      const q = query.trim();
      const cleanDigits = cleanPhone(q);

      const searchConditions = [
        ilike(users.username, `%${q.replace('@', '')}%`),
        ilike(users.firstName, `%${q}%`),
        ilike(users.lastName, `%${q}%`),
      ];

      if (cleanDigits.length >= 4) {
        searchConditions.push(ilike(users.phoneNumber, `%${cleanDigits}%`));
      }

      const foundUsers = await db.query.users.findMany({
        where: or(...searchConditions),
        limit: 20,
      });

      const results = foundUsers
        .filter((u) => u.id !== caller.id)
        .map((u) => {
          const fullName = `${u.firstName || 'Rabbitter'} ${u.lastName || ''}`.trim();
          const seed = u.username || u.firstName || u.id;
          const bg = u.role === 'AFFILIATE' ? 'FF8A00' : 'E91E63';
          const avatar = `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(
            seed
          )}&backgroundColor=${bg}`;

          return {
            id: u.id,
            name: fullName,
            username: u.username,
            phoneNumber: u.phoneNumber,
            role: u.role,
            avatar,
            isRegistered: true,
          };
        });

      return NextResponse.json({ success: true, results });
    }

    // 2. If syncing contacts payload (like WhatsApp / Telegram address book check)
    if (Array.isArray(contacts) && contacts.length > 0) {
      // Map of cleaned numbers to contact details passed from device
      const phoneMap = new Map<string, { originalName: string; originalTel: string }>();
      const candidateNumbers: string[] = [];

      for (const item of contacts) {
        if (!item.tel) continue;
        const cleaned = cleanPhone(item.tel);
        if (cleaned.length >= 7) {
          // Keep last 10 digits to match national format or international
          const last10 = cleaned.slice(-10);
          phoneMap.set(last10, {
            originalName: item.name || 'Contacto',
            originalTel: item.tel,
          });
          phoneMap.set(cleaned, {
            originalName: item.name || 'Contacto',
            originalTel: item.tel,
          });
          candidateNumbers.push(cleaned);
        }
      }

      // Query database users
      // Since phone numbers can have +52 or spaces, let's query users that have phone numbers
      const registeredUsers = await db.query.users.findMany({
        where: (users, { isNotNull }) => isNotNull(users.phoneNumber),
        limit: 200,
      });

      const matched: Array<{
        id: string;
        contactName: string;
        rabbittyName: string;
        username?: string | null;
        phoneNumber: string;
        avatar: string;
        role: string;
        isRegistered: true;
      }> = [];

      const registeredPhoneSet = new Set<string>();

      for (const regUser of registeredUsers) {
        if (!regUser.phoneNumber || regUser.id === caller.id) continue;
        const regClean = cleanPhone(regUser.phoneNumber);
        const last10 = regClean.slice(-10);

        const match = phoneMap.get(regClean) || phoneMap.get(last10);
        if (match) {
          registeredPhoneSet.add(match.originalTel);
          const fullName = `${regUser.firstName || 'Rabbitter'} ${regUser.lastName || ''}`.trim();
          const seed = regUser.username || regUser.firstName || regUser.id;
          const bg = regUser.role === 'AFFILIATE' ? 'FF8A00' : 'E91E63';
          const avatar = `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(
            seed
          )}&backgroundColor=${bg}`;

          matched.push({
            id: regUser.id,
            contactName: match.originalName,
            rabbittyName: fullName,
            username: regUser.username,
            phoneNumber: regUser.phoneNumber,
            avatar,
            role: regUser.role,
            isRegistered: true,
          });
        }
      }

      // Unregistered device contacts for invitation
      const uninvited = contacts
        .filter((c) => c.tel && !registeredPhoneSet.has(c.tel))
        .map((c) => ({
          name: c.name || 'Contacto',
          tel: c.tel,
          isRegistered: false as const,
        }));

      return NextResponse.json({
        success: true,
        matched,
        uninvited: uninvited.slice(0, 50),
        totalMatched: matched.length,
      });
    }

    return NextResponse.json({ success: true, matched: [], uninvited: [], results: [] });
  } catch (error) {
    console.error('Contacts sync API error:', error);
    return NextResponse.json({ error: 'Error al sincronizar contactos' }, { status: 500 });
  }
}
