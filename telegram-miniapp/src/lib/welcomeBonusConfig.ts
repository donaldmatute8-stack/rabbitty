import { db } from '@/db';
import {
  users,
  ownedBusinesses,
  pendingVaults,
  transactions,
  ledgerEntries,
  treasury,
  systemSettings,
  auditEntries,
} from '@/db/schema';
import { and, eq, or, sql, desc } from 'drizzle-orm';
import { sendEcosystemNotification } from '@/lib/push/notify';

export interface NicheWelcomeRule {
  category: string;
  label: string;
  baseBunz: number;
  recommendedFutureRange: string;
  affiliateSplitPct: number; // ej. 60% lo aporta el paquete del afiliado
  treasurySplitPct: number;  // ej. 40% lo adelanta Tesorería Rabbitty en negativo
}

export const DEFAULT_NICHE_WELCOME_RULES: Record<string, NicheWelcomeRule> = {
  Cafetería: {
    category: 'Cafetería',
    label: 'Cafetería / Specialty Coffee',
    baseBunz: 25,
    recommendedFutureRange: '25 - 35 Bunz',
    affiliateSplitPct: 60,
    treasurySplitPct: 40,
  },
  Restaurante: {
    category: 'Restaurante',
    label: 'Restaurante Casual / Bistró',
    baseBunz: 25,
    recommendedFutureRange: '25 - 50 Bunz',
    affiliateSplitPct: 60,
    treasurySplitPct: 40,
  },
  'Restaurante Gourmet': {
    category: 'Restaurante Gourmet',
    label: 'Restaurante Gourmet / Gran Capacidad',
    baseBunz: 25,
    recommendedFutureRange: '50 - 100 Bunz',
    affiliateSplitPct: 60,
    treasurySplitPct: 40,
  },
  Bar: {
    category: 'Bar',
    label: 'Bar / Mixología / Taproom',
    baseBunz: 25,
    recommendedFutureRange: '25 - 50 Bunz',
    affiliateSplitPct: 60,
    treasurySplitPct: 40,
  },
  'Tienda de Ropa': {
    category: 'Tienda de Ropa',
    label: 'Retail / Moda / Boutique',
    baseBunz: 25,
    recommendedFutureRange: '35 - 75 Bunz',
    affiliateSplitPct: 60,
    treasurySplitPct: 40,
  },
  'Servicios de Salud': {
    category: 'Servicios de Salud',
    label: 'Salud / Clínica / Consultorio',
    baseBunz: 25,
    recommendedFutureRange: '50 - 100 Bunz',
    affiliateSplitPct: 60,
    treasurySplitPct: 40,
  },
  'Belleza y Spa': {
    category: 'Belleza y Spa',
    label: 'Belleza / Barbería / Spa',
    baseBunz: 25,
    recommendedFutureRange: '25 - 50 Bunz',
    affiliateSplitPct: 60,
    treasurySplitPct: 40,
  },
  Gimnasio: {
    category: 'Gimnasio',
    label: 'Gimnasio / Fitness Studio',
    baseBunz: 25,
    recommendedFutureRange: '30 - 60 Bunz',
    affiliateSplitPct: 60,
    treasurySplitPct: 40,
  },
  Educación: {
    category: 'Educación',
    label: 'Educación / Academia / Cursos',
    baseBunz: 25,
    recommendedFutureRange: '25 - 50 Bunz',
    affiliateSplitPct: 60,
    treasurySplitPct: 40,
  },
  'Servicios Digitales': {
    category: 'Servicios Digitales',
    label: 'Servicios Digitales / E-Commerce',
    baseBunz: 25,
    recommendedFutureRange: '25 - 40 Bunz',
    affiliateSplitPct: 60,
    treasurySplitPct: 40,
  },
  Otro: {
    category: 'Otro',
    label: 'Comercio General Afiliado',
    baseBunz: 25,
    recommendedFutureRange: '25 - 50 Bunz',
    affiliateSplitPct: 60,
    treasurySplitPct: 40,
  },
};

export function resolveNicheWelcomeRuleSync(
  category?: string | null,
  customRulesMap?: Record<string, NicheWelcomeRule>
): {
  rule: NicheWelcomeRule;
  affiliateBunz: number;
  treasuryBunz: number;
} {
  const map = customRulesMap || DEFAULT_NICHE_WELCOME_RULES;
  const catNorm = (category || '').trim().toLowerCase();

  let matched: NicheWelcomeRule | undefined = map[category || ''];
  if (!matched) {
    if (catNorm.includes('caf')) matched = map['Cafetería'];
    else if (catNorm.includes('gourmet') || catNorm.includes('fine')) matched = map['Restaurante Gourmet'];
    else if (catNorm.includes('rest') || catNorm.includes('comida')) matched = map['Restaurante'];
    else if (catNorm.includes('bar') || catNorm.includes('pub')) matched = map['Bar'];
    else if (catNorm.includes('ropa') || catNorm.includes('boutique') || catNorm.includes('moda')) matched = map['Tienda de Ropa'];
    else if (catNorm.includes('salud') || catNorm.includes('dental')) matched = map['Servicios de Salud'];
    else if (catNorm.includes('belleza') || catNorm.includes('spa') || catNorm.includes('barber')) matched = map['Belleza y Spa'];
    else if (catNorm.includes('gimnasio') || catNorm.includes('fit')) matched = map['Gimnasio'];
    else matched = map['Otro'] || DEFAULT_NICHE_WELCOME_RULES['Otro'];
  }

  const total = Math.max(5, matched.baseBunz || 25);
  const affiliateBunz = Math.round((total * (matched.affiliateSplitPct ?? 60)) / 100);
  const treasuryBunz = Math.max(0, total - affiliateBunz);

  return {
    rule: matched,
    affiliateBunz,
    treasuryBunz,
  };
}

export async function getDynamicNicheRules(): Promise<Record<string, NicheWelcomeRule>> {
  try {
    const setting = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, 'welcome_bonus_niche_config'),
    });
    if (setting?.value) {
      const parsed = JSON.parse(setting.value);
      return { ...DEFAULT_NICHE_WELCOME_RULES, ...parsed };
    }
  } catch {
    // fallback to defaults
  }
  return DEFAULT_NICHE_WELCOME_RULES;
}

// ── Tope mensual de Bunz fondeados por cada afiliado (dinámico desde God Admin) ──
export interface WelcomeBonusCapConfig {
  default: number;
  overrides: Record<string, number>; // businessId -> cap mensual
}

export const DEFAULT_MONTHLY_CAP_PER_AFFILIATE = 200;

export async function getWelcomeBonusCapConfig(): Promise<WelcomeBonusCapConfig> {
  try {
    const setting = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, 'welcome_bonus_monthly_cap'),
    });
    if (setting?.value) {
      const parsed = JSON.parse(setting.value);
      return {
        default: Math.max(0, Math.min(100000, Number(parsed.default) || DEFAULT_MONTHLY_CAP_PER_AFFILIATE)),
        overrides: parsed.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {},
      };
    }
  } catch {
    // fallback to default
  }
  return { default: DEFAULT_MONTHLY_CAP_PER_AFFILIATE, overrides: {} };
}

export async function setWelcomeBonusCapConfig(config: WelcomeBonusCapConfig): Promise<void> {
  const clean: WelcomeBonusCapConfig = {
    default: Math.max(0, Math.min(100000, Math.round(Number(config.default) || DEFAULT_MONTHLY_CAP_PER_AFFILIATE))),
    overrides: {},
  };
  for (const [bizId, cap] of Object.entries(config.overrides || {})) {
    const n = Math.max(0, Math.min(100000, Math.round(Number(cap) || 0)));
    if (bizId && n > 0) clean.overrides[bizId] = n;
  }
  const existing = await db.query.systemSettings.findFirst({
    where: eq(systemSettings.key, 'welcome_bonus_monthly_cap'),
  });
  if (existing) {
    await db
      .update(systemSettings)
      .set({ value: JSON.stringify(clean), updatedAt: new Date() })
      .where(eq(systemSettings.key, 'welcome_bonus_monthly_cap'));
  } else {
    await db.insert(systemSettings).values({ key: 'welcome_bonus_monthly_cap', value: JSON.stringify(clean) });
  }
  await db.insert(auditEntries).values({
    userId: 'god_admin',
    action: 'WELCOME_BONUS_CAP_UPDATED',
    resource: 'systemSettings',
    resourceId: 'welcome_bonus_monthly_cap',
    details: JSON.stringify(clean),
  });
}


/** Bono de bienvenida configurado por tenant (systemSettings welcome_bonus_tenant_config). */
export async function getTenantWelcomeBonus(businessId: string): Promise<number | null> {
  try {
    const setting = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, 'welcome_bonus_tenant_config'),
    });
    if (setting?.value) {
      const config = JSON.parse(setting.value) as Record<string, number>;
      const n = Number(config[businessId]);
      if (Number.isFinite(n) && n >= 5 && n <= 200) return Math.round(n);
    }
  } catch {
    // fallback abajo
  }
  return null;
}

/** Bunz del tramo AFILIADO ya consumidos este mes calendario por un negocio. */
export async function getMonthlyAffiliateUsage(businessId: string): Promise<number> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const rows = await db
    .select({ amount: ledgerEntries.amount })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.payerSubjectId, businessId),
        eq(ledgerEntries.type, 'EARN'),
        sql`${ledgerEntries.idempotencyKey} LIKE 'welcome_aff_%'`,
        sql`${ledgerEntries.createdAt} >= ${monthStart}`
      )
    );
  return rows.reduce((sum, r) => sum + Math.max(0, Number(r.amount) || 0), 0);
}

/**
 * Ejecuta el otorgamiento del Bono de Bienvenida (ej. 25 Bunz) con Split Triangular:
 * 1) Aporte del Paquete del Afiliado (ej. 15 Bunz -> incrementa creditUsed y asienta en ledger)
 * 2) Subsidio de Tesorería Rabbitty en negativo (ej. -10 Bunz en treasury con type = 'welcome_split_debt')
 * 3) Acreditación en users.totalBunzEarned + Notificación In-App + Push Notification nativa (APNs)
 */
export async function claimWelcomeBonusForUser(params: {
  userId: string;
  phoneNumber?: string | null;
  email?: string | null;
  promoRef?: string | null;
  requestedBunz?: number | null;
}): Promise<{
  awarded: boolean;
  totalBunz: number;
  affiliateBunz: number;
  treasuryBunz: number;
  businessName: string;
} | null> {
  const { userId, phoneNumber, email, promoRef, requestedBunz } = params;
  if (!userId) return null;

  try {
    // 0. Flag global: si el bono de bienvenida está desactivado, no emitir
    const [activeFlag] = await db.query.systemSettings.findMany({
      where: eq(systemSettings.key, 'welcome_bonus_active'),
      limit: 1,
    });
    if (activeFlag && String(activeFlag.value).toLowerCase() === 'false') return null;

    // 1. Verificar idempotencia: que este usuario no haya recibido ya un bono de bienvenida
    const existingLedger = await db.query.ledgerEntries.findFirst({
      where: or(
        eq(ledgerEntries.idempotencyKey, `welcome_aff_${userId}`),
        eq(ledgerEntries.idempotencyKey, `welcome_trs_${userId}`)
      ),
    });

    if (existingLedger) {
      return null;
    }

    // 1b. Anti-multi-cuenta: si OTRO usuario ya reclamó el bono con este mismo
    //     teléfono o correo (normalizados), este nuevo registro no cobra otro bono.
    const digits = (phoneNumber || '').replace(/\D/g, '').slice(-10);
    const cleanEmail = (email || '').trim().toLowerCase();
    if (digits.length === 10 || cleanEmail) {
      const phoneCond = digits.length === 10
        ? sql`regexp_replace(COALESCE(${users.phoneNumber}, ''), '\\D', '', 'g') LIKE ${'%' + digits}`
        : sql`FALSE`;
      const emailCond = cleanEmail ? eq(users.email, cleanEmail) : sql`FALSE`;
      const sameContactUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(and(or(phoneCond, emailCond), sql`${users.id} <> ${userId}`))
        .limit(20);

      for (const other of sameContactUsers) {
        const prior = await db.query.ledgerEntries.findFirst({
          where: or(
            eq(ledgerEntries.idempotencyKey, `welcome_aff_${other.id}`),
            eq(ledgerEntries.idempotencyKey, `welcome_trs_${other.id}`)
          ),
        });
        if (prior) {
          console.warn(`[WELCOME_BONUS] Blocked multi-account claim: user ${userId} reuses contact of ${other.id}`);
          return null;
        }
      }
    }

    // 2. Buscar si tiene un pendingVault de WELCOME_QR por teléfono o email (vigente)
    const now = new Date();

    let matchedVault = null;
    if (digits.length === 10 || cleanEmail) {
      const candidateVaults = await db
        .select()
        .from(pendingVaults)
        .where(
          and(
            eq(pendingVaults.status, 'PENDING'),
            sql`${pendingVaults.orderId} LIKE 'WELCOME_QR:%'`
          )
        )
        .orderBy(desc(pendingVaults.createdAt))
        .limit(30);

      matchedVault =
        candidateVaults.find((v) => {
          if (v.expiresAt && new Date(v.expiresAt) < now) return false; // vault expirado no paga
          const vPhoneDigits = (v.phoneNumber || '').replace(/\D/g, '').slice(-10);
          const vClean = (v.phoneNumber || '').trim().toLowerCase();
          if (digits.length === 10 && vPhoneDigits === digits) return true;
          if (cleanEmail && vClean === cleanEmail) return true;
          return false;
        }) || null;
    }

    // Si no hay pendingVault ni vino un promoRef explícito, no aplica bono de mesa
    const effectiveRef =
      promoRef ||
      (matchedVault?.orderId?.startsWith('WELCOME_QR:')
        ? matchedVault.orderId.split(':')[1]
        : null);

    if (!matchedVault && !effectiveRef) {
      return null;
    }

    // 3. Resolver el negocio afiliado origen (estricto: el bono solo puede
    //    colateralizarse con el negocio que emitió el QR/campaña — nunca un fallback aleatorio)
    let targetBusiness = null;
    if (matchedVault?.businessId) {
      targetBusiness = await db.query.ownedBusinesses.findFirst({
        where: eq(ownedBusinesses.id, matchedVault.businessId),
      });
    }

    if (!targetBusiness && effectiveRef) {
      const refLower = effectiveRef.toLowerCase().replace(/[^a-z0-9]/g, "");
      const candidates = await db.select().from(ownedBusinesses);
      targetBusiness =
        candidates.find((b) => (b.slug || "").toLowerCase() === refLower) ||
        candidates.find((b) => b.id.replace(/-/g, "").startsWith(refLower)) ||
        candidates.find(
          (b) => (b.name || "").toLowerCase().replace(/[^a-z0-9]/g, "") === refLower
        ) ||
        null;
    }

    if (!targetBusiness) {
      return null;
    }

    // 4. Calcular el Split Triangular según el nicho del afiliado
    const dynamicRules = await getDynamicNicheRules();
    const { rule } = resolveNicheWelcomeRuleSync(targetBusiness.category, dynamicRules);

    const tenantConfiguredBunz = await getTenantWelcomeBonus(targetBusiness.id);
    const requestedTotal =
      matchedVault?.bunzAmount ||
      (requestedBunz && requestedBunz >= 5 && requestedBunz <= 200 ? requestedBunz : null) ||
      (tenantConfiguredBunz && tenantConfiguredBunz >= 5 ? tenantConfiguredBunz : null) ||
      rule.baseBunz;

    // 4b. Colateral 1:1 — el tramo del afiliado NO puede exceder el crédito real
    //     disponible de su paquete (bunzBalance + crédito vivo del creditLimit)
    const collateralAvailable =
      Math.max(0, targetBusiness.bunzBalance || 0) +
      Math.max(0, (targetBusiness.creditLimit || 0) - (targetBusiness.creditUsed || 0));

    // 4c. Tope mensual por afiliado (dinámico desde God Admin): si el local ya fondeó
    //     su cuota del mes, el resto del bono lo cubre Tesorería Rabbitty (1:1 en deuda).
    const capConfig = await getWelcomeBonusCapConfig();
    const monthlyCap = Math.max(
      0,
      capConfig.overrides[targetBusiness.id] ?? capConfig.default ?? DEFAULT_MONTHLY_CAP_PER_AFFILIATE
    );
    const usedThisMonth = await getMonthlyAffiliateUsage(targetBusiness.id);
    const remainingMonthlyCap = Math.max(0, monthlyCap - usedThisMonth);

    const affiliateShare = Math.min(
      Math.round((requestedTotal * (rule.affiliateSplitPct ?? 60)) / 100),
      Math.floor(collateralAvailable),
      remainingMonthlyCap
    );
    const treasuryShare = Math.max(0, requestedTotal - affiliateShare);
    const totalBunz = affiliateShare + treasuryShare;

    if (totalBunz <= 0) {
      return null; // Sin colateral y sin subsidio configurado: no se mintea nada
    }

    // 5. Asientos contables — UNA transacción con locks pesimistas (sin lost-updates)
    //    Re-verifica claves de idempotencia Y cap mensual DENTRO de la tx (anti-TOCTOU).
    await db.transaction(async (tx) => {
      // Locks determinísticos (orden estable: user → business) para evitar deadlocks
      const [lockedUser] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
      if (!lockedUser) throw new Error('WELCOME_USER_NOT_FOUND');
      const [lockedBiz] = await tx.select().from(ownedBusinesses).where(eq(ownedBusinesses.id, targetBusiness.id)).for('update');

      // Re-verificar idempotencia en-tx (carrera de claims paralelos)
      const priorKeys = await tx.select({ k: ledgerEntries.idempotencyKey }).from(ledgerEntries)
        .where(or(
          eq(ledgerEntries.idempotencyKey, `welcome_aff_${userId}`),
          eq(ledgerEntries.idempotencyKey, `welcome_trs_${userId}`),
        ));
      if (priorKeys.length > 0) throw new Error('WELCOME_ALREADY_MINTED');

      // Re-verificar cap mensual del afiliado en-tx (anti-TOCTOU: claims paralelos del mismo negocio)
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const [usageRow] = await tx
        .select({ total: sql<number>`COALESCE(SUM(${ledgerEntries.amount}), 0)` })
        .from(ledgerEntries)
        .where(and(
          eq(ledgerEntries.payerSubjectId, targetBusiness.id),
          eq(ledgerEntries.type, 'EARN'),
          sql`${ledgerEntries.idempotencyKey} LIKE 'welcome_aff_%'`,
          sql`${ledgerEntries.createdAt} >= ${monthStart}`,
        ));
      const usedInTx = Number(usageRow?.total ?? 0);
      const liveMonthlyCap = Math.max(0, capConfig.overrides[targetBusiness.id] ?? capConfig.default ?? DEFAULT_MONTHLY_CAP_PER_AFFILIATE);
      const liveRemaining = Math.max(0, liveMonthlyCap - usedInTx);
      if (liveRemaining <= 0 && treasuryShare <= 0) throw new Error('WELCOME_CAP_EXHAUSTED');
      // Si el cap se agotó en la carrera, el tramo del afiliado pasa completo a Tesorería
      let finalAffiliateShare = affiliateShare;
      let finalTreasuryShare = treasuryShare;
      if (liveRemaining <= 0) {
        finalAffiliateShare = 0;
        finalTreasuryShare = totalBunz;
      } else if (affiliateShare > liveRemaining) {
        finalTreasuryShare += affiliateShare - liveRemaining;
        finalAffiliateShare = liveRemaining;
      }

      // 5a. Asientos del ledger (la UNIQUE es el candado atómico del claim)
      if (finalAffiliateShare > 0) {
        await tx.insert(ledgerEntries).values({
          payerSubjectId: targetBusiness.id,
          payeeSubjectId: `usr_${userId}`,
          amount: finalAffiliateShare,
          type: 'EARN',
          idempotencyKey: `welcome_aff_${userId}`,
        });
      }
      if (finalTreasuryShare > 0) {
        await tx.insert(ledgerEntries).values({
          payerSubjectId: 'sys_rabbitty_treasury',
          payeeSubjectId: `usr_${userId}`,
          amount: finalTreasuryShare,
          type: 'EARN',
          idempotencyKey: `welcome_trs_${userId}`,
        });
      }

      // 5b. Descontar tramo del paquete del afiliado
      const liveBiz = lockedBiz ?? targetBusiness;
      const bunzDebit = Math.min(finalAffiliateShare, liveBiz.bunzBalance || 0);
      const creditDebit = finalAffiliateShare - bunzDebit;
      await tx
        .update(ownedBusinesses)
        .set({
          creditUsed: (liveBiz.creditUsed || 0) + creditDebit,
          bunzBalance: (liveBiz.bunzBalance || 0) - bunzDebit,
          updatedAt: new Date(),
        })
        .where(eq(ownedBusinesses.id, targetBusiness.id));

      // 5c. Deuda en Tesorería por el tramo de Rabbitty
      if (finalTreasuryShare > 0) {
        await tx.insert(treasury).values({
          concept: `Subsidio Bono Bienvenida QR (${targetBusiness.name})`,
          amount: -finalTreasuryShare,
          type: 'welcome_split_debt',
          referenceId: targetBusiness.id,
          notes: JSON.stringify({
            userId,
            businessName: targetBusiness.name,
            niche: targetBusiness.category,
            totalBunz,
            affiliateShare: finalAffiliateShare,
            treasuryShare: finalTreasuryShare,
            monthlyCap,
            affiliateUsedBeforeThisClaim: usedThisMonth,
            capExhausted: liveRemaining <= 0,
          }),
        });
      }

      // 5d. Balance del usuario (dentro de la misma tx)
      await tx
        .update(users)
        .set({
          totalBunzEarned: (lockedUser.totalBunzEarned || 0) + totalBunz,
          hasEarnedFirstBunz: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    });

    await db.insert(transactions).values({
      userId,
      businessId: targetBusiness.id,
      fiatAmount: 0,
      bunzMinted: totalBunz,
      status: 'COMPLETED',
      txHash: `promo_welcome_split_${Date.now()}_${userId.slice(0, 6)}`,
    });

    if (matchedVault) {
      await db
        .update(pendingVaults)
        .set({ status: 'CLAIMED' })
        .where(eq(pendingVaults.id, matchedVault.id));
    }

    // 6. Enviar Notificación In-App + Push Notification nativa (APNs)
    await sendEcosystemNotification({
      userId,
      title: `🎉 ¡Recibiste +${totalBunz} Bunz de Bienvenida!`,
      message: `Se acreditaron +${totalBunz} Bunz ($${totalBunz} MXN) en tu billetera por unirte en ${targetBusiness.name}. ¡Listos para usar en tu consumo!`,
      type: 'REWARD',
      route: '/profile/wallet',
      pushData: {
        bunzAwarded: totalBunz,
        businessId: targetBusiness.id,
        businessName: targetBusiness.name,
      },
      threadId: 'welcome_bonus',
    });

    return {
      awarded: true,
      totalBunz,
      affiliateBunz: affiliateShare,
      treasuryBunz: treasuryShare,
      businessName: targetBusiness.name,
    };
  } catch (err) {
    console.error('[CLAIM_WELCOME_BONUS_ERROR]', err);
    return null;
  }
}

/**
 * Calcula el estado en vivo de la Tesorería de Rabbitty y el saldo negativo acumulado
 * por el Split de Bonos de Bienvenida, para que el God Admin elija manualmente cuándo ponerse al corriente.
 */
export async function getTreasuryWelcomeDebtSummary() {
  const allTreasuryRows = await db
    .select()
    .from(treasury)
    .orderBy(desc(treasury.createdAt));

  let grossWelcomeDebt = 0; // Suma de subsidios otorgados (valor absoluto)
  let settledWelcomeDebt = 0; // Suma ya liquidada manualmente por el Admin
  let grossTreasurySurplus = 0; // Ingresos reales a tesorería (fees, forfeits, etc.)
  let surplusUsedForSettlements = 0; // Comisiones ya consumidas para saldar deuda de bonos
  let welcomeBonusesCount = 0;

  for (const row of allTreasuryRows) {
    const amt = Number(row.amount || 0);
    if (row.type === 'welcome_split_debt') {
      grossWelcomeDebt += Math.abs(amt);
      welcomeBonusesCount += 1;
    } else if (row.type === 'welcome_debt_settlement') {
      settledWelcomeDebt += Math.max(0, amt);
    } else if (row.type === 'fee_used_for_welcome_settlement') {
      surplusUsedForSettlements += Math.abs(amt);
    } else if (amt > 0) {
      grossTreasurySurplus += amt;
    }
  }

  const netOutstandingDebt = Math.max(0, grossWelcomeDebt - settledWelcomeDebt);
  const netNegativeBalance = -netOutstandingDebt; // ej. -120 Bunz
  const availableSurplusForSettlement = Math.max(0, grossTreasurySurplus - surplusUsedForSettlements);
  const canSettleFromFeesNow = Math.min(netOutstandingDebt, availableSurplusForSettlement);

  const recentSplitEntries = allTreasuryRows
    .filter((r) => r.type === 'welcome_split_debt' || r.type === 'welcome_debt_settlement')
    .slice(0, 15);

  const dynamicRules = await getDynamicNicheRules();

  // Config de tope mensual + consumo del mes por negocio (para el editor del God Admin)
  const capConfig = await getWelcomeBonusCapConfig();
  const perBusinessMonthlyUsage: { businessId: string; businessName: string; used: number; cap: number }[] = [];
  const businessIdsWithUsage = new Set<string>();
  for (const row of allTreasuryRows) {
    if (row.type === 'welcome_split_debt' && row.referenceId) businessIdsWithUsage.add(row.referenceId);
  }
  for (const bizId of businessIdsWithUsage) {
    const used = await getMonthlyAffiliateUsage(bizId);
    const nameRow = await db.query.ownedBusinesses.findFirst({
      where: eq(ownedBusinesses.id, bizId),
    });
    perBusinessMonthlyUsage.push({
      businessId: bizId,
      businessName: nameRow?.name || bizId.slice(0, 8),
      used,
      cap: capConfig.overrides[bizId] ?? capConfig.default ?? DEFAULT_MONTHLY_CAP_PER_AFFILIATE,
    });
  }
  perBusinessMonthlyUsage.sort((a, b) => b.used - a.used);

  return {
    netNegativeBalance,           // ej. -120 (lo que llevamos en negativo)
    netOutstandingDebt,           // ej. 120
    outstandingDebtAbs: netOutstandingDebt,
    grossWelcomeDebt,             // total histórico subsidiado por Rabbitty
    totalSplitDebtGenerated: grossWelcomeDebt,
    settledWelcomeDebt,           // total histórico ya puesto al corriente
    totalSplitDebtSettled: settledWelcomeDebt,
    welcomeBonusesCount,          // cuántos clientes han recibido subsidio
    welcomeClaimsCount: welcomeBonusesCount,
    totalFeeIncome: grossTreasurySurplus,
    availableSurplusForSettlement,// Bunz disponibles en tesorería por comisiones/forfeits
    canSettleFromFeesNow,         // cuánto se puede cubrir hoy mismo con comisiones reales
    recentSplitEntries,
    nicheRules: Object.values(dynamicRules),
    capConfig,                    // tope mensual dinámico por afiliado
    monthlyCapDefault: capConfig.default,
    perBusinessMonthlyUsage,      // consumo del mes por negocio vs su tope
  };
}

/**
 * Trigger Manual del God Admin para "Ponerse al Corriente" con los Bunz en negativo de Tesorería.
 */
export async function settleTreasuryWelcomeDebtManually(params: {
  adminId: string;
  amountToSettle?: number;
  mode: 'FROM_AVAILABLE_FEES' | 'FULL_BALANCE_RESET';
}) {
  const summary = await getTreasuryWelcomeDebtSummary();

  if (summary.netOutstandingDebt <= 0) {
    return {
      success: true,
      settledAmount: 0,
      remainingDebt: 0,
      message: 'La Tesorería ya está 100% al corriente (0 Bunz en negativo).',
    };
  }

  let targetSettle =
    params.amountToSettle && params.amountToSettle > 0
      ? Math.min(params.amountToSettle, summary.netOutstandingDebt)
      : summary.netOutstandingDebt;

  if (params.mode === 'FROM_AVAILABLE_FEES') {
    if (summary.availableSurplusForSettlement <= 0) {
      return {
        success: false,
        settledAmount: 0,
        remainingDebt: summary.netOutstandingDebt,
        error:
          'Aún no hay suficientes Bunz acumulados por comisiones en Tesorería para cubrir este saldo. Puedes esperar a acumular comisiones o elegir Liquidación Total de Reserva.',
      };
    }
    targetSettle = Math.min(targetSettle, summary.availableSurplusForSettlement);
  }

  // 1. Asiento positivo que amortiza la deuda de bonos de bienvenida
  await db.insert(treasury).values({
    concept: `Liquidación Manual de Deuda por Bonos de Bienvenida (${params.mode === 'FROM_AVAILABLE_FEES' ? 'Con Comisiones Acumuladas' : 'Ajuste de Reserva God Admin'})`,
    amount: targetSettle,
    type: 'welcome_debt_settlement',
    referenceId: params.adminId,
    notes: JSON.stringify({
      settledBy: params.adminId,
      mode: params.mode,
      previousDebt: summary.netOutstandingDebt,
      settledAmount: targetSettle,
      remainingDebt: summary.netOutstandingDebt - targetSettle,
      timestamp: new Date().toISOString(),
    }),
  });

  // 2. Si se pagó con las comisiones disponibles en Tesorería, descontar ese superávit usado
  if (params.mode === 'FROM_AVAILABLE_FEES') {
    await db.insert(treasury).values({
      concept: `Aplicación de Comisiones de Tesorería para Amortizar Bonos de Bienvenida`,
      amount: -targetSettle,
      type: 'fee_used_for_welcome_settlement',
      referenceId: params.adminId,
      notes: `Compensación manual autorizada por God Admin (${params.adminId})`,
    });
  }

  // 3. Bitácora de auditoría inmutable
  await db.insert(auditEntries).values({
    userId: params.adminId,
    action: 'TREASURY_WELCOME_DEBT_SETTLEMENT',
    resource: 'treasury',
    resourceId: 'sys_rabbitty_treasury',
    details: JSON.stringify({
      mode: params.mode,
      settledAmount: targetSettle,
      remainingDebt: summary.netOutstandingDebt - targetSettle,
    }),
  });

  return {
    success: true,
    settledAmount: targetSettle,
    remainingDebt: summary.netOutstandingDebt - targetSettle,
    message: `¡Listo! Se pusieron al corriente +${targetSettle.toLocaleString()} Bunz en la Tesorería.`,
  };
}
