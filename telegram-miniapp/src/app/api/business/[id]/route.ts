import { NextResponse } from 'next/server';
import { db } from '@/db';
import { ownedBusinesses } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const business = await db.query.ownedBusinesses.findFirst({
      where: eq(ownedBusinesses.id, resolvedParams.id)
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, business });
  } catch (error) {
    console.error('Fetch Business By ID Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error', stack: error instanceof Error ? error.stack : undefined }, { status: 500 });
  }
}
