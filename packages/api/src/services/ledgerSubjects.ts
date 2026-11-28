import { eq } from "drizzle-orm";
import { users, ownedBusinesses } from "@rabbitty/database-core/schema";

/**
 * Identidad canónica del ledger (ADR-008, opción A).
 *  · usr_<uuid>  → users.id
 *  · biz_<uuid>  → ownedBusinesses.id (NO branches.id)
 *  · sys_<slug>  → cuentas de sistema (sys_treasury, sys_pos_checkout…)
 *
 * Nunca se escribe un sujeto vacío, "unknown", "SYSTEM" ni un UUID desnudo.
 * Si el valor ya trae prefijo, se normaliza para no producir usr_usr_<uuid>.
 */
export function canonicalSubject(
  prefix: "usr" | "biz" | "sys",
  value: string | null | undefined,
): string {
  const rawInput = String(value ?? "")
    .trim()
    .replace(/^(usr|biz|sys)_/i, "");

  if (!rawInput || rawInput.toLowerCase() === "unknown") {
    throw new Error(`INVALID_LEDGER_SUBJECT: ${prefix}_${rawInput || "(empty)"}`);
  }

  if (prefix !== "sys") {
    const lower = rawInput.toLowerCase();
    if (lower === "system" || lower === "pos_checkout") {
      throw new Error(`INVALID_LEDGER_SUBJECT: ${prefix}_${rawInput}`);
    }
    return `${prefix}_${rawInput}`;
  }

  const slug = rawInput.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return `sys_${slug}`;
}

export const usr = (id: string | null | undefined) => canonicalSubject("usr", id);
export const biz = (id: string | null | undefined) => canonicalSubject("biz", id);
export const sys = (slug: string) => canonicalSubject("sys", slug);

/** ¿El asiento pertenece a demo/App Review? Se marca sandbox y no consume seq. */
export async function isSandboxLedgerTx(
  tx: any,
  businessId: string | null | undefined,
  userId: string | null | undefined,
): Promise<boolean> {
  const bizRaw = businessId
    ? String(businessId).replace(/^(usr|biz|sys)_/i, "")
    : null;
  const userRaw = userId
    ? String(userId).replace(/^(usr|biz|sys)_/i, "")
    : null;

  if (bizRaw) {
    const [b] = await tx
      .select({ sandbox: ownedBusinesses.sandbox })
      .from(ownedBusinesses)
      .where(eq(ownedBusinesses.id, bizRaw))
      .limit(1);
    if (b?.sandbox) return true;
  }
  if (userRaw) {
    const [u] = await tx
      .select({ sandbox: users.sandbox })
      .from(users)
      .where(eq(users.id, userRaw))
      .limit(1);
    if (u?.sandbox) return true;
  }
  return false;
}

/**
 * ── Normalización defensiva de sujetos ─────────────────────────────────────
 *
 * `ledger_entries` exige `^(usr|biz|sys)_[A-Za-z0-9_-]+$`. Un UUID pelado o un
 * literal heredado (`SYSTEM`, `POS_CHECKOUT`, `TREASURY`…) hace que el INSERT
 * viole la restricción y la operación completa devuelva 500 — así se rompieron
 * el canje y el cobro con Bunz (2026-11).
 *
 * Regla:
 *  · canónico  → se devuelve tal cual;
 *  · alias de sistema conocido → `sys_*`;
 *  · UUID sin prefijo → error claro (no se adivina si es usr_ o biz_);
 *  · cualquier otra cosa → error claro.
 */
const SYSTEM_ALIASES: Record<string, string> = {
  system: "sys_treasury",
  treasury: "sys_treasury",
  rabbitty_treasury: "sys_treasury",
  pos: "sys_pos",
  pos_checkout: "sys_pos_checkout",
  pos_claim: "sys_pos_claim",
  gamification: "sys_gamification",
  referrals: "sys_referrals",
};

const CANONICAL = /^(usr|biz|sys)_[A-Za-z0-9_-]+$/;
const RAW_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeLedgerSubject(raw: string | null | undefined): string {
  const value = String(raw ?? "").trim();
  if (CANONICAL.test(value)) return value;

  const key = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const alias = SYSTEM_ALIASES[key];
  if (alias) return alias;

  if (RAW_UUID.test(value)) {
    throw new Error(
      `INVALID_LEDGER_SUBJECT: "${value}" es un UUID sin prefijo; usa usr_/biz_/sys_ según corresponda.`,
    );
  }
  throw new Error(`INVALID_LEDGER_SUBJECT: "${value}" no es un sujeto canónico del ledger.`);
}
