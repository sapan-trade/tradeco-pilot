import { prisma } from "@/lib/db";

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Record one billable unit to the durable ledger. This is the source of truth for
 * billing; Stripe metered reporting (when configured) is layered on top, but the
 * ledger guarantees nothing is ever lost/unbillable.
 */
export async function recordBillableUsage(
  orgId: string,
  kind: string,
  quantity = 1
): Promise<void> {
  await prisma.usageRecord.create({ data: { orgId, kind, quantity } });
  // Stripe metered reporting is wired once a metered price + subscription item exist;
  // until then the ledger above is authoritative and can be reconciled/invoiced.
}

export interface UsageSummary {
  used: number;
  allowance: number;
  unlimited: boolean;
  remaining: number | null;
  overage: number;
  periodStart: string;
  periodEnd: string;
}

export async function getUsageSummary(orgId: string): Promise<UsageSummary> {
  const sub = await prisma.subscription.findUnique({ where: { orgId } });
  // Count a rolling 30-day window ending now (always includes recent usage). The
  // renewal date is shown for context but doesn't gate the count.
  const now = Date.now();
  const periodStart = new Date(now - PERIOD_MS);
  const periodEnd = sub?.currentPeriodEnd ?? new Date(now + PERIOD_MS);
  const agg = await prisma.usageRecord.aggregate({
    _sum: { quantity: true },
    where: { orgId, createdAt: { gte: periodStart } },
  });
  const used = agg._sum.quantity ?? 0;
  const allowance = sub?.skuAllowance ?? 0;
  const unlimited = allowance < 0;
  return {
    used,
    allowance,
    unlimited,
    remaining: unlimited ? null : Math.max(0, allowance - used),
    overage: unlimited ? 0 : Math.max(0, used - allowance),
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  };
}
