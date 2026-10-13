import { db } from '@/db';
import { treasury } from '@/db/schema';

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function recordTreasuryEntry(params: {
  concept: string;
  amount: number;
  type: string;
  referenceId?: string;
  notes?: string;
}, tx?: Executor) {
  const executor = (tx || db) as typeof db;
  await executor.insert(treasury).values({
    concept: params.concept,
    amount: params.amount,
    type: params.type,
    referenceId: params.referenceId || null,
    notes: params.notes || null,
  });
}
