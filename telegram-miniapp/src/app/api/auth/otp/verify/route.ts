import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, webSessions, verificationTokens } from '@/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body?.email?.toLowerCase()?.trim();
    const code = body?.code?.trim();

    if (!email || !code) {
      return NextResponse.json({ error: 'Email y código son obligatorios' }, { status: 400 });
    }

    // Verify token
    const tokenRecord = await db.query.verificationTokens.findFirst({
      where: and(
        eq(verificationTokens.identifier, email),
        eq(verificationTokens.token, code),
        gt(verificationTokens.expires, new Date())
      ),
    });

    if (!tokenRecord) {
      return NextResponse.json({ error: 'Código incorrecto o ha expirado. Por favor solicita uno nuevo.' }, { status: 400 });
    }

    // Delete token so it cannot be reused
    await db.delete(verificationTokens).where(eq(verificationTokens.identifier, email));

    // Find or create canonical user
    let user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    const isNewUser = !user;

    if (!user) {
      const [created] = await db.insert(users).values({
        email,
        username: email.split('@')[0],
        totalBunzEarned: 0,
        totalBunzSpent: 0,
        role: 'USER',
      }).returning();
      user = created;
    }

    // Generate revocable session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.insert(webSessions).values({
      jwtToken: sessionToken,
      userId: user.id,
      expiresAt,
    });

    return NextResponse.json({
      success: true,
      isNewUser,
      sessionToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        telegramId: user.telegramId,
        tonWalletAddress: user.tonWalletAddress,
        totalBunzEarned: user.totalBunzEarned,
        totalBunzSpent: user.totalBunzSpent,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('[OTP VERIFY ERROR]', error);
    return NextResponse.json({ error: 'Error al verificar código' }, { status: 500 });
  }
}
