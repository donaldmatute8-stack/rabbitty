import { db } from '@/db';
import { treasury } from '@/db/schema';

export async function recordTreasuryEntry(params: {
  concept: string;
  amount: number;
  type: string;
  referenceId?: string;
  notes?: string;
}) {
  await db.insert(treasury).values({
    concept: params.concept,
    amount: params.amount,
    type: params.type,
    referenceId: params.referenceId || null,
    notes: params.notes || null,
  });
}
