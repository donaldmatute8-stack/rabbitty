import { NextResponse } from 'next/server';
import { db } from '@/db';
import { webSessions } from '@/db/schema';
import crypto from 'crypto';

export async function POST() {
  try {
    // Generate a secure random token for the QR code
    const jwtToken = crypto.randomBytes(32).toString('hex');
    
    // Create a new web session valid for 5 minutes
    const [session] = await db.insert(webSessions).values({
      jwtToken,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    }).returning();

    return NextResponse.json({ 
      success: true, 
      sessionId: session.id,
      qrToken: jwtToken,
      expiresAt: session.expiresAt
    });
  } catch (error) {
    console.error('QR Generate Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
