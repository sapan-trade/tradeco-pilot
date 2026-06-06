import { router, orgProcedure } from "../init";
import { computeAnalytics } from "@/server/services/analytics";

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
});
