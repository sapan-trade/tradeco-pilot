import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProcedure, requireRole } from "../init";
import { createStripeClient } from "@/server/integrations/stripe";
import { track } from "@/server/services/telemetry";

const stripe = createStripeClient();

export const billingRouter = router({
  subscription: orgProcedure.query(async ({ ctx }) => {
    const sub = await ctx.prisma.subscription.findUnique({ where: { orgId: ctx.org.id } });
    const skuUsed = await ctx.prisma.sku.count({ where: { orgId: ctx.org.id } });
    if (!sub) {
      return {
        tier: null as null,
        status: "INACTIVE" as const,
        skuAllowance: 0,
        skuUsed,
        currentPeriodEnd: null as null,
      };
    }
    return {
      tier: sub.tier,
      status: sub.status,
      skuAllowance: sub.skuAllowance,
      skuUsed,
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
    };
  }),

  checkout: requireRole("OWNER")
    .input(z.object({ tier: z.enum(["STARTER", "GROWTH", "PRO"]) }))
    .mutation(async ({ ctx, input }) => {
      const { url } = await stripe.createCheckoutSession({ orgId: ctx.org.id, tier: input.tier });
      await track("checkout_started", { userId: ctx.user.id, orgId: ctx.org.id, props: { tier: input.tier } });
      return { url };
    }),

  portal: requireRole("OWNER").mutation(async ({ ctx }) => {
    const sub = await ctx.prisma.subscription.findUnique({ where: { orgId: ctx.org.id } });
    if (!sub) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No active subscription" });
    }
    const { url } = await stripe.createPortalSession({ customerId: sub.stripeCustomerId });
    return { url };
  }),
});
