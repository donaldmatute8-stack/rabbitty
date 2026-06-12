import { NextResponse } from 'next/server';
import { db } from '@/db';
import { webSessions } from '@/db/schema';
import crypto from 'crypto';

export async function POST() {
  try {
    // Generate a secure random token for the QR code
    const qrToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(qrToken).digest('hex');
    
    // Create a new web session valid for 5 minutes
    const [session] = await db.insert(webSessions).values({
      jwtToken: tokenHash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    }).returning();

    return NextResponse.json({ 
      success: true, 
      sessionId: session.id,
      qrToken: qrToken,
      expiresAt: session.expiresAt
    });
  } catch (error) {
    console.error('QR Generate Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
