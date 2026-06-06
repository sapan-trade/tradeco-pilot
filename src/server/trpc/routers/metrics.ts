import { TRPCError } from "@trpc/server";
import { router, authedProcedure } from "../init";
import { isPlatformAdmin } from "@/server/services/telemetry";
import { computeAccuracy } from "@/server/services/accuracy";

/** Platform-wide business metrics. Gated to PLATFORM_ADMIN_EMAILS, not org admins. */
export const metricsRouter = router({
  overview: authedProcedure.query(async ({ ctx }) => {
    if (!(await isPlatformAdmin(ctx.user.id))) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin only" });
    }
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [orgs, users, classifications, declarationsSubmitted, payingOrgs, approvedBrokers, activeOrgRows, events] =
      await Promise.all([
        ctx.prisma.organization.count(),
        ctx.prisma.user.count(),
        ctx.prisma.classification.count(),
        ctx.prisma.declaration.count({ where: { status: "SUBMITTED" } }),
        ctx.prisma.subscription.count({ where: { status: { in: ["ACTIVE", "TRIALING"] } } }),
        ctx.prisma.broker.count({ where: { status: "APPROVED" } }),
        ctx.prisma.classification.findMany({ distinct: ["orgId"], select: { orgId: true } }),
        ctx.prisma.analyticsEvent.groupBy({
          by: ["name"],
          where: { createdAt: { gte: since } },
          _count: { _all: true },
        }),
      ]);
    const activeOrgs = activeOrgRows.length;
    return {
      orgs,
      users,
      classifications,
      declarationsSubmitted,
      payingOrgs,
      approvedBrokers,
      activeOrgs,
      activationRate: orgs > 0 ? Math.round((activeOrgs / orgs) * 100) : 0,
      conversionRate: orgs > 0 ? Math.round((payingOrgs / orgs) * 100) : 0,
      events: events
        .map((e) => ({ name: e.name, count: e._count._all }))
        .sort((a, b) => b.count - a.count),
    };
  }),

  /** Platform-wide AI accuracy + the labeled correction dataset (the eval/moat data). */
  accuracyDataset: authedProcedure.query(async ({ ctx }) => {
    if (!(await isPlatformAdmin(ctx.user.id))) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin only" });
    }
    const reviews = await ctx.prisma.brokerReview.findMany({
      where: { decision: { not: null } },
      select: { decision: true, decidedAt: true, originalHsCode: true, correctedHsCode: true },
    });
    const a = computeAccuracy(reviews);
    return {
      accuracyPct: a.accuracyPct,
      decided: a.decided,
      approved: a.approved,
      corrected: a.corrected,
      rejected: a.rejected,
      byMonth: a.byMonth,
      corrections: a.corrections.slice(0, 200),
      correctionCount: a.corrections.length,
    };
  }),
});
