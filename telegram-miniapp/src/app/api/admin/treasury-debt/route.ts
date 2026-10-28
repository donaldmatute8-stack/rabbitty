import { NextRequest, NextResponse } from 'next/server';
import { verifyGodAdminRequest } from '@/lib/adminAuth';
import {
  getTreasuryWelcomeDebtSummary,
  settleTreasuryWelcomeDebtManually,
  getDynamicNicheRules,
  NicheWelcomeRule,
} from '@/lib/welcomeBonusConfig';
import { db } from '@/db';
import { systemSettings, auditEntries } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyGodAdminRequest(req);
    if (!auth.allowed) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const [summary, nicheRules] = await Promise.all([
      getTreasuryWelcomeDebtSummary(),
      getDynamicNicheRules(),
    ]);

    return NextResponse.json({
      success: true,
      summary,
      nicheRules,
    });
  } catch (error) {
    console.error('Error fetching treasury welcome debt summary:', error);
    return NextResponse.json({ error: 'Error interno al consultar tesorería' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyGodAdminRequest(req);
    if (!auth.allowed || !auth.adminId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const { action, amountToSettle, mode, updatedNicheRules } = body;

    if (action === 'update_niche_rules' && updatedNicheRules) {
      const currentRules = await getDynamicNicheRules();
      const merged: Record<string, NicheWelcomeRule> = {
        ...currentRules,
        ...updatedNicheRules,
      };

      const existing = await db.query.systemSettings.findFirst({
        where: eq(systemSettings.key, 'welcome_bonus_niche_config'),
      });

      if (existing) {
        await db
          .update(systemSettings)
          .set({ value: JSON.stringify(merged), updatedAt: new Date() })
          .where(eq(systemSettings.key, 'welcome_bonus_niche_config'));
      } else {
        await db.insert(systemSettings).values({
          key: 'welcome_bonus_niche_config',
          value: JSON.stringify(merged),
        });
      }

      await db.insert(auditEntries).values({
        userId: auth.adminId,
        action: 'WELCOME_NICHE_RULES_UPDATED',
        resource: 'systemSettings',
        resourceId: 'welcome_bonus_niche_config',
        details: JSON.stringify({ updatedNicheRules }),
      });

      return NextResponse.json({
        success: true,
        nicheRules: merged,
      });
    }

    // ── Tope mensual de Bunz fondeados por afiliado (dinámico, God Admin) ──
    if (action === 'update_cap_config' && body.capConfig) {
      const incoming = body.capConfig as { default?: unknown; overrides?: Record<string, unknown> };
      const { setWelcomeBonusCapConfig, getWelcomeBonusCapConfig } = await import('@/lib/welcomeBonusConfig');
      const current = await getWelcomeBonusCapConfig();
      const overrides: Record<string, number> = { ...current.overrides };
      for (const [bizId, cap] of Object.entries(incoming.overrides || {})) {
        const n = Math.max(0, Math.min(100000, Math.round(Number(cap) || 0)));
        if (bizId && n > 0) overrides[bizId] = n;
        else if (bizId) delete overrides[bizId];
      }
      const nextConfig = {
        default: Math.max(0, Math.min(100000, Math.round(Number(incoming.default) || 200))),
        overrides,
      };
      await setWelcomeBonusCapConfig(nextConfig);
      const updated = await getWelcomeBonusCapConfig();
      const summary = await getTreasuryWelcomeDebtSummary();
      return NextResponse.json({ success: true, capConfig: updated, summary });
    }

    const result = await settleTreasuryWelcomeDebtManually({
      adminId: auth.adminId,
      amountToSettle: amountToSettle ? Number(amountToSettle) : undefined,
      mode: mode === 'direct_injection' || mode === 'FULL_BALANCE_RESET' ? 'FULL_BALANCE_RESET' : 'FROM_AVAILABLE_FEES',
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'No se pudo liquidar el saldo' }, { status: 400 });
    }

    const updatedSummary = await getTreasuryWelcomeDebtSummary();
    return NextResponse.json({
      success: true,
      settledAmount: result.settledAmount,
      remainingNegativeBalance: -result.remainingDebt,
      summary: updatedSummary,
    });
  } catch (error) {
    console.error('Error settling treasury welcome debt:', error);
    return NextResponse.json({ error: 'Error interno al liquidar tesorería' }, { status: 500 });
  }
}
