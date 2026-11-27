import { and, desc, eq, sql } from "drizzle-orm";
import {
  fundContributions,
  merchantCapacityAccounts,
  platformBudgets,
} from "@rabbitty/database-core/schema";
import { ledgerEntries } from "@rabbitty/database-restaurant/schema";
import type { getCoreDb, getRestaurantDb } from "../db";

/**
 * ── Fondo de crecimiento "La Madriguera" · Fase 1 ───────────────────────────
 * SOLO LECTURA. No mueve Bunz, no escribe ledger_entries, no toca cashback ni
 * bunzBalance. Sirve para:
 *   · calcular el saldo del fondo desde el ledger,
 *   · listar aportes,
 *   · calcular el nivel de un rabbiter por aportes de 12 meses,
 *   · fallar si el fondo está sobregirado o tiene asientos inválidos.
 *
 * Contrato: Docs/ECONOMIA/ADR-CORE-011-FONDO-CRECIMIENTO.md
 */

export const GROWTH_FUND_ACCOUNT = "sys_growth_fund";
export const GROWTH_FUND_PROGRAM = "madriguera";

export const MADRIGUERA_LEVELS = {
  APRENDIZ: { min: 0, label: "Aprendiz" },
  COMPA: { min: 100, label: "Compa" },
  GUARDIAN: { min: 500, label: "Guardián" },
} as const;

export type MadrigueraTier = keyof typeof MADRIGUERA_LEVELS;

export class GrowthFundError extends Error {
  constructor(
    public code: "FUND_NEGATIVE" | "INVALID_ENTRY" | "INVALID_INPUT",
    message: string,
  ) {
    super(message);
    this.name = "GrowthFundError";
  }
}

type CoreDb = ReturnType<typeof getCoreDb>;
type LedgerDb = ReturnType<typeof getRestaurantDb>;

type Rows<T> = T[] | { rows?: T[] } | undefined;

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const maybe = result as { rows?: T[] };
  return Array.isArray(maybe?.rows) ? maybe.rows : [];
}

/* ── Flags (apagados por defecto) ─────────────────────────────────────────── */

export function growthFundFlags(env: NodeJS.ProcessEnv = process.env) {
  return {
    enabled: env.GROWTH_FUND_ENABLED === "1",
    userContributions: env.GROWTH_FUND_USER_CONTRIBUTIONS === "1",
    referralPayouts: env.GROWTH_FUND_REFERRAL_PAYOUTS === "1",
    affiliateCoop: env.GROWTH_FUND_AFFILIATE_COOP === "1",
    match: env.GROWTH_FUND_MATCH === "1",
  };
}

/* ── Saldo del fondo ──────────────────────────────────────────────────────── */

export interface FundBalance {
  account: string;
  incoming: number;
  outgoing: number;
  balance: number;
  invalidEntries: number;
  healthy: boolean;
}

/**
 * El ledger vive en la base de restaurante en local; en producción core y
 * restaurante comparten la misma base Neon. Por eso esta función recibe el
 * cliente que tiene `ledger_entries`, no el de `fund_contributions`.
 */
export async function getFundBalance(
  db: LedgerDb,
  account = GROWTH_FUND_ACCOUNT,
): Promise<FundBalance> {
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(
        CASE WHEN "payeeSubjectId" = ${account} AND type IN ('MINT','TRANSFER')
             THEN amount ELSE 0 END
      ), 0)::float AS incoming,
      COALESCE(SUM(
        CASE WHEN "payerSubjectId" = ${account} AND type = 'EARN'
             THEN amount ELSE 0 END
      ), 0)::float AS outgoing,
      COALESCE(SUM(
        CASE WHEN ("payerSubjectId" = ${account} OR "payeeSubjectId" = ${account})
              AND NOT (
                ("payeeSubjectId" = ${account} AND type = 'MINT'
                 AND (left("payerSubjectId", 4) = 'biz_' OR left("payerSubjectId", 4) = 'sys_'))
                OR ("payeeSubjectId" = ${account} AND type = 'TRANSFER'
                    AND left("payerSubjectId", 4) = 'usr_')
                OR ("payerSubjectId" = ${account} AND type = 'EARN'
                    AND left("payeeSubjectId", 4) = 'usr_')
              )
             THEN 1 ELSE 0 END
      ), 0)::int AS invalid_entries
    FROM "ledger_entries"
    WHERE "payerSubjectId" = ${account} OR "payeeSubjectId" = ${account}
  `);

  const row = rowsOf<{ incoming: number; outgoing: number; invalid_entries: number }>(result)[0];
  const incoming = Number(row?.incoming ?? 0);
  const outgoing = Number(row?.outgoing ?? 0);
  const balance = Math.round((incoming - outgoing) * 100) / 100;
  const invalidEntries = Number(row?.invalid_entries ?? 0);

  return {
    account,
    incoming,
    outgoing,
    balance,
    invalidEntries,
    healthy: balance >= 0 && invalidEntries === 0,
  };
}

export async function assertFundHealthy(db: LedgerDb, account = GROWTH_FUND_ACCOUNT) {
  const balance = await getFundBalance(db, account);
  if (balance.invalidEntries > 0) {
    throw new GrowthFundError(
      "INVALID_ENTRY",
      `El fondo ${account} tiene ${balance.invalidEntries} asiento(s) con forma no permitida.`,
    );
  }
  if (balance.balance < 0) {
    throw new GrowthFundError(
      "FUND_NEGATIVE",
      `El fondo ${account} está sobregirado: saldo ${balance.balance}.`,
    );
  }
  return balance;
}

/* ── Aportes ──────────────────────────────────────────────────────────────── */

export interface FundContribution {
  id: string;
  source: string;
  subjectId: string;
  amount: number;
  ledgerEntryId: string | null;
  program: string;
  periodStart: Date | null;
  idempotencyKey: string;
  createdAt: Date | null;
}

export async function listFundContributions(
  db: CoreDb,
  input: { program?: string; source?: string; limit?: number } = {},
): Promise<FundContribution[]> {
  const program = input.program ?? GROWTH_FUND_PROGRAM;
  const limit = Math.min(200, Math.max(1, Math.round(input.limit ?? 50)));

  const rows = await db
    .select()
    .from(fundContributions)
    .where(
      input.source
        ? and(eq(fundContributions.program, program), eq(fundContributions.source, input.source))
        : eq(fundContributions.program, program),
    )
    .orderBy(desc(fundContributions.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    amount: Number(row.amount),
  })) as FundContribution[];
}

export async function getFundContributionsSummary(db: CoreDb, program = GROWTH_FUND_PROGRAM) {
  const result = await db.execute(sql`
    SELECT "source", COALESCE(SUM("amount"), 0)::int AS amount, COUNT(*)::int AS entries
      FROM "fund_contributions"
     WHERE "program" = ${program}
     GROUP BY "source"
     ORDER BY "source"
  `);

  return rowsOf<{ source: string; amount: number; entries: number }>(result).map((row) => ({
    source: row.source,
    amount: Number(row.amount ?? 0),
    entries: Number(row.entries ?? 0),
  }));
}

/* ── Fondeo co-op + match (preview, sin escribir) ─────────────────────────── */

export function coopAmount(promoAuthorized: number, pct = 0.1): number {
  const base = Math.max(0, Number(promoAuthorized) || 0);
  const rate = Math.min(1, Math.max(0, Number(pct) || 0));
  return Math.floor(base * rate);
}

export function matchAmount(
  budgeted: number,
  spent: number,
  requested?: number | null,
): number {
  const remaining = Math.max(0, Number(budgeted) - Number(spent));
  if (requested == null) return Math.floor(remaining);
  return Math.max(0, Math.min(remaining, Math.floor(Number(requested) || 0)));
}

export async function getCoopPreview(
  db: CoreDb,
  businessId: string,
  pct = 0.1,
) {
  const [account] = await db
    .select({
      affiliateId: merchantCapacityAccounts.affiliateId,
      promoAuthorized: merchantCapacityAccounts.promoAuthorized,
      status: merchantCapacityAccounts.status,
    })
    .from(merchantCapacityAccounts)
    .where(eq(merchantCapacityAccounts.affiliateId, businessId))
    .limit(1);

  if (!account) {
    return { businessId, promoAuthorized: 0, pct, amount: 0, available: false };
  }

  return {
    businessId,
    promoAuthorized: Number(account.promoAuthorized ?? 0),
    pct,
    amount: coopAmount(Number(account.promoAuthorized ?? 0), pct),
    available: account.status === "ACTIVE" && coopAmount(Number(account.promoAuthorized ?? 0), pct) > 0,
  };
}

export async function getMatchPreview(
  db: CoreDb,
  program: string,
  periodStart: Date,
  requested?: number | null,
) {
  const [budget] = await db
    .select()
    .from(platformBudgets)
    .where(and(eq(platformBudgets.program, program), eq(platformBudgets.periodStart, periodStart)))
    .limit(1);

  if (!budget) {
    return { program, budgeted: 0, spent: 0, remaining: 0, amount: 0, available: false };
  }

  const budgeted = Number(budget.budgeted ?? 0);
  const spent = Number(budget.spent ?? 0);
  return {
    program,
    budgeted,
    spent,
    remaining: Math.max(0, budgeted - spent),
    amount: matchAmount(budgeted, spent, requested),
    available: matchAmount(budgeted, spent, requested) > 0,
  };
}

/* ── Fondeo co-op + match (ejecución) ─────────────────────────────────────── */

export function monthPeriod(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

export function periodKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export interface CoopFundingResult {
  ok: boolean;
  businessId: string;
  amount: number;
  idempotencyKey: string;
  ledgerEntryId: string | null;
  alreadyDone: boolean;
  reason?: "NO_ACCOUNT" | "NOT_ACTIVE" | "ZERO_AMOUNT" | "SKIPPED";
}

export interface MatchFundingResult {
  ok: boolean;
  program: string;
  amount: number;
  idempotencyKey: string;
  ledgerEntryId: string | null;
  alreadyDone: boolean;
  reason?: "NO_BUDGET" | "ZERO_AMOUNT" | "SKIPPED";
}

interface Executor {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
  insert: LedgerDb["insert"];
}

function listOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const maybe = result as { rows?: T[] };
  return Array.isArray(maybe?.rows) ? maybe.rows : [];
}

/**
 * Co-op del afiliado: `MINT biz_<id> → sys_growth_fund`.
 *
 * · El afiliado aporta CAPACIDAD promo, no Bunz que ya tenga → es MINT
 *   (ADR-CORE-011 §3). Registrarlo como TRANSFER subcontaría la emisión.
 * · Idempotente por `coop:<businessId>:<periodo>`: repetir no duplica.
 * · No toca `bunzBalance` del negocio ni `merchantCapacityAccounts.available`:
 *   el compromiso vive en `referral_coop_commitments` para no alterar MCCE.
 * · `db` debe ser un executor con acceso a ledger y, en producción, a las
 *   tablas core (misma base Neon).
 */
export async function fundCoop(
  db: Executor,
  input: {
    businessId: string;
    pct?: number;
    periodStart: Date;
    periodEnd: Date;
    program?: string;
  },
): Promise<CoopFundingResult> {
  const program = input.program ?? GROWTH_FUND_PROGRAM;
  const businessId = String(input.businessId).replace(/^(biz|usr)_/i, "");
  const pct = input.pct ?? 0.1;
  const idempotencyKey = `coop:${businessId}:${periodKey(input.periodStart)}`;

  const existing = listOf<{ id: string; amount: number; ledgerEntryId: string | null }>(
    await db.execute(sql`
      SELECT "id", "amount", "ledgerEntryId" FROM "fund_contributions"
       WHERE "idempotencyKey" = ${idempotencyKey} LIMIT 1
    `),
  )[0];
  if (existing) {
    return {
      ok: true,
      businessId,
      amount: Number(existing.amount),
      idempotencyKey,
      ledgerEntryId: existing.ledgerEntryId ?? null,
      alreadyDone: true,
    };
  }

  const account = listOf<{ promoAuthorized: number; status: string; sandbox: boolean }>(
    await db.execute(sql`
      SELECT "promoAuthorized", "status", "sandbox"
        FROM "merchant_capacity_accounts"
       WHERE "affiliateId" = ${businessId} LIMIT 1
    `),
  )[0];

  if (!account) {
    return { ok: false, businessId, amount: 0, idempotencyKey, ledgerEntryId: null, alreadyDone: false, reason: "NO_ACCOUNT" };
  }
  if (String(account.status) !== "ACTIVE" || account.sandbox) {
    return { ok: false, businessId, amount: 0, idempotencyKey, ledgerEntryId: null, alreadyDone: false, reason: "NOT_ACTIVE" };
  }

  const amount = coopAmount(Number(account.promoAuthorized ?? 0), pct);
  if (amount <= 0) {
    return { ok: false, businessId, amount: 0, idempotencyKey, ledgerEntryId: null, alreadyDone: false, reason: "ZERO_AMOUNT" };
  }

  const entry = await db
    .insert(ledgerEntries)
    .values({
      payerSubjectId: `biz_${businessId}`,
      payeeSubjectId: GROWTH_FUND_ACCOUNT,
      amount,
      currency: "BUNZ",
      type: "MINT",
      referenceId: null,
      idempotencyKey,
      metadata: {
        program,
        source: "coop",
        businessId,
        pct,
        periodStart: input.periodStart.toISOString(),
      },
    })
    .onConflictDoNothing({ target: ledgerEntries.idempotencyKey })
    .returning({ id: ledgerEntries.id });

  const entryRow =
    listOf<{ id: string }>(entry)[0] ??
    listOf<{ id: string }>(
      await db.execute(sql`SELECT "id" FROM "ledger_entries" WHERE "idempotencyKey" = ${idempotencyKey} LIMIT 1`),
    )[0] ??
    null;

  const contributionId = crypto.randomUUID();
  const contribution = listOf<{ id: string }>(
    await db.execute(sql`
      INSERT INTO "fund_contributions"
        ("id", "source", "subjectId", "amount", "ledgerEntryId", "program", "periodStart", "idempotencyKey")
      VALUES
        (${contributionId}, 'coop', ${`biz_${businessId}`}, ${amount}, ${entryRow?.id ?? null}, ${program}, ${input.periodStart}, ${idempotencyKey})
      ON CONFLICT ("idempotencyKey") DO NOTHING
      RETURNING "id"
    `),
  )[0];

  if (contribution) {
    const commitment = listOf<{ id: string; committed: number }>(
      await db.execute(sql`
        SELECT "id", "committed" FROM "referral_coop_commitments"
         WHERE "affiliateId" = ${businessId} AND "periodStart" = ${input.periodStart}
           AND "source" = 'coop' LIMIT 1
      `),
    )[0];

    if (commitment) {
      await db.execute(sql`
        UPDATE "referral_coop_commitments"
           SET "committed" = "committed" + ${amount}, "pctBasis" = ${pct}, "updatedAt" = now()
         WHERE "id" = ${commitment.id}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO "referral_coop_commitments"
          ("id", "affiliateId", "source", "periodStart", "periodEnd", "pctBasis", "committed", "spent", "status")
        VALUES
          (${crypto.randomUUID()}, ${businessId}, 'coop', ${input.periodStart}, ${input.periodEnd}, ${pct}, ${amount}, 0, 'ACTIVE')
      `);
    }
  }

  return {
    ok: true,
    businessId,
    amount,
    idempotencyKey,
    ledgerEntryId: entryRow?.id ?? null,
    alreadyDone: false,
  };
}

/**
 * Match de plataforma: `MINT sys_treasury → sys_growth_fund`.
 * Idempotente por `match:<program>:<periodo>` y acotado al presupuesto.
 */
export async function fundMatch(
  db: Executor,
  input: {
    program?: string;
    periodStart: Date;
    requested?: number | null;
  },
): Promise<MatchFundingResult> {
  const program = input.program ?? GROWTH_FUND_PROGRAM;
  const idempotencyKey = `match:${program}:${periodKey(input.periodStart)}`;

  const existing = listOf<{ amount: number; ledgerEntryId: string | null }>(
    await db.execute(sql`
      SELECT "amount", "ledgerEntryId" FROM "fund_contributions"
       WHERE "idempotencyKey" = ${idempotencyKey} LIMIT 1
    `),
  )[0];
  if (existing) {
    return {
      ok: true,
      program,
      amount: Number(existing.amount),
      idempotencyKey,
      ledgerEntryId: existing.ledgerEntryId ?? null,
      alreadyDone: true,
    };
  }

  const budget = listOf<{ id: string; budgeted: number; spent: number }>(
    await db.execute(sql`
      SELECT "id", "budgeted", "spent" FROM "platform_budgets"
       WHERE "program" = ${program} AND "periodStart" = ${input.periodStart} LIMIT 1
    `),
  )[0];

  if (!budget) {
    return { ok: false, program, amount: 0, idempotencyKey, ledgerEntryId: null, alreadyDone: false, reason: "NO_BUDGET" };
  }

  const amount = matchAmount(Number(budget.budgeted ?? 0), Number(budget.spent ?? 0), input.requested);
  if (amount <= 0) {
    return { ok: false, program, amount: 0, idempotencyKey, ledgerEntryId: null, alreadyDone: false, reason: "ZERO_AMOUNT" };
  }

  const entry = await db
    .insert(ledgerEntries)
    .values({
      payerSubjectId: "sys_treasury",
      payeeSubjectId: GROWTH_FUND_ACCOUNT,
      amount,
      currency: "BUNZ",
      type: "MINT",
      referenceId: null,
      idempotencyKey,
      metadata: {
        program,
        source: "match",
        periodStart: input.periodStart.toISOString(),
      },
    })
    .onConflictDoNothing({ target: ledgerEntries.idempotencyKey })
    .returning({ id: ledgerEntries.id });

  const entryRow =
    listOf<{ id: string }>(entry)[0] ??
    listOf<{ id: string }>(
      await db.execute(sql`SELECT "id" FROM "ledger_entries" WHERE "idempotencyKey" = ${idempotencyKey} LIMIT 1`),
    )[0] ??
    null;

  const contribution = listOf<{ id: string }>(
    await db.execute(sql`
      INSERT INTO "fund_contributions"
        ("id", "source", "subjectId", "amount", "ledgerEntryId", "program", "periodStart", "idempotencyKey")
      VALUES
        (${crypto.randomUUID()}, 'match', 'sys_treasury', ${amount}, ${entryRow?.id ?? null}, ${program}, ${input.periodStart}, ${idempotencyKey})
      ON CONFLICT ("idempotencyKey") DO NOTHING
      RETURNING "id"
    `),
  )[0];

  if (contribution) {
    await db.execute(sql`
      UPDATE "platform_budgets"
         SET "spent" = "spent" + ${amount}, "updatedAt" = now()
       WHERE "id" = ${budget.id}
    `);
  }

  return {
    ok: true,
    program,
    amount,
    idempotencyKey,
    ledgerEntryId: entryRow?.id ?? null,
    alreadyDone: false,
  };
}

/* ── Nivel La Madriguera (solo lectura) ───────────────────────────────────── */

export interface MadrigueraLevel {
  tier: MadrigueraTier;
  label: string;
  totalContributed: number;
  consecutiveMonths: number;
  months: Array<{ month: string; amount: number }>;
  nextTier: { tier: MadrigueraTier; at: number } | null;
}

/** Meses consecutivos hacia atrás desde el mes más reciente. */
export function consecutiveMonths(months: string[]): number {
  if (months.length === 0) return 0;
  const unique = Array.from(new Set(months)).sort();
  let streak = 1;
  for (let i = unique.length - 1; i > 0; i -= 1) {
    const current = unique[i];
    const previous = unique[i - 1];
    if (!current || !previous) break;

    const [currentYear, currentMonth] = current.split("-");
    const [previousYear, previousMonth] = previous.split("-");
    const y = Number(currentYear);
    const m = Number(currentMonth);
    const py = Number(previousYear);
    const pm = Number(previousMonth);
    if (!y || !m || !py || !pm) break;

    const expected = new Date(Date.UTC(y, m - 1, 1));
    expected.setUTCMonth(expected.getUTCMonth() - 1);
    if (Date.UTC(py, pm - 1, 1) !== expected.getTime()) break;
    streak += 1;
  }
  return streak;
}

export function levelFromContribution(input: {
  total: number;
  consecutiveMonths: number;
}): MadrigueraLevel["tier"] {
  // Guardián por monto o por 3 meses consecutivos; va antes de Compa para que
  // un usuario con 120 Bunz en 3 meses sea Guardián, no Compa.
  if (input.total >= MADRIGUERA_LEVELS.GUARDIAN.min) return "GUARDIAN";
  if (input.consecutiveMonths >= 3) return "GUARDIAN";
  if (input.total >= MADRIGUERA_LEVELS.COMPA.min) return "COMPA";
  return "APRENDIZ";
}

export async function getMadrigueraLevel(
  db: CoreDb,
  userId: string,
  program = GROWTH_FUND_PROGRAM,
): Promise<MadrigueraLevel> {
  const subjectId = `usr_${userId}`;
  const result = await db.execute(sql`
    SELECT to_char("createdAt", 'YYYY-MM') AS month,
           COALESCE(SUM("amount"), 0)::int AS amount
      FROM "fund_contributions"
     WHERE "program" = ${program}
       AND "source" = 'user'
       AND "subjectId" = ${subjectId}
       AND "createdAt" >= now() - interval '12 months'
     GROUP BY 1
     ORDER BY 1
  `);

  const months = rowsOf<{ month: string; amount: number }>(result).map((row) => ({
    month: row.month,
    amount: Number(row.amount ?? 0),
  }));
  const total = months.reduce((sum, row) => sum + row.amount, 0);
  const streak = consecutiveMonths(months.map((row) => row.month));
  const tier = levelFromContribution({ total, consecutiveMonths: streak });

  const nextTier =
    tier === "APRENDIZ"
      ? { tier: "COMPA" as const, at: MADRIGUERA_LEVELS.COMPA.min }
      : tier === "COMPA"
        ? { tier: "GUARDIAN" as const, at: MADRIGUERA_LEVELS.GUARDIAN.min }
        : null;

  return {
    tier,
    label: MADRIGUERA_LEVELS[tier].label,
    totalContributed: total,
    consecutiveMonths: streak,
    months,
    nextTier,
  };
}
