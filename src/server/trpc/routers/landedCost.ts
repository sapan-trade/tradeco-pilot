import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProcedure } from "../init";
import { estimateLandedCost } from "@/server/services/landed-cost";

export const landedCostRouter = router({
  estimate: orgProcedure
    .input(z.object({ classificationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const e = await estimateLandedCost({
          orgId: ctx.org.id,
          classificationId: input.classificationId,
        });
        return {
          dutyRateBps: e.dutyRateBps,
          vatRateBps: e.vatRateBps,
          freightCents: e.freightCents,
          feesCents: e.feesCents,
          unitValueCents: e.unitValueCents,
          totalLandedCents: e.totalLandedCents,
          computedAt: e.computedAt.toISOString(),
        };
      } catch (err: any) {
        if (err.message === "Classification not found") {
          throw new TRPCError({ code: "NOT_FOUND", message: err.message });
        }
        throw err;
      }
    }),
});
