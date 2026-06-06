import { router, orgProcedure } from "../init";
import { computeAnalytics } from "@/server/services/analytics";
import { computeAccuracy } from "@/server/services/accuracy";

export const analyticsRouter = router({
  summary: orgProcedure.query(async ({ ctx }) => {
    const orgId = ctx.org.id;
    const [classifications, reviews, declarations, estimates] = await Promise.all([
      ctx.prisma.classification.findMany({
        where: { orgId },
        select: { status: true, confidence: true, hsCode: true, ftaEligible: true },
      }),
      ctx.prisma.brokerReview.findMany({
        where: { classification: { orgId }, decision: { not: null } },
        select: { createdAt: true, decidedAt: true },
      }),
      ctx.prisma.declaration.findMany({ where: { orgId }, select: { status: true } }),
      ctx.prisma.landedCostEstimate.findMany({
        where: { orgId },
        select: { classificationId: true, dutyRateBps: true, unitValueCents: true, totalLandedCents: true },
        orderBy: { computedAt: "desc" },
      }),
    ]);
    return computeAnalytics({ classifications, reviews, declarations, estimates });
  }),

  accuracy: orgProcedure.query(async ({ ctx }) => {
    const reviews = await ctx.prisma.brokerReview.findMany({
      where: { classification: { orgId: ctx.org.id }, decision: { not: null } },
      select: { decision: true, decidedAt: true, originalHsCode: true, correctedHsCode: true },
    });
    const a = computeAccuracy(reviews);
    // Per-org view omits the raw correction pairs; just the metric + trend + count.
    return {
      accuracyPct: a.accuracyPct,
      decided: a.decided,
      approved: a.approved,
      corrected: a.corrected,
      rejected: a.rejected,
      byMonth: a.byMonth,
      correctionCount: a.corrections.length,
    };
  }),
});
