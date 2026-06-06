import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, authedProcedure, approvedBrokerProcedure } from "../init";
import { createStripeClient } from "@/server/integrations/stripe";
import { track } from "@/server/services/telemetry";

const stripe = createStripeClient();

/**
 * Broker-side portal: apply to the marketplace, check status/earnings, onboard to
 * Stripe Connect, and request a payout of accrued flat-fee earnings.
 *
 * These procedures are platform-level (not org-scoped). A signed-in user becomes a
 * broker by applying; an admin approves; Stripe Connect handles identity + bank KYC.
 */
export const brokerPortalRouter = router({
  // Named `applyAsBroker` (not `apply`) to avoid colliding with Function.prototype.apply
  // in tRPC's caller proxy.
  applyAsBroker: authedProcedure
    .input(
      z.object({
        licenseNumber: z.string().trim().min(3).max(64),
        licenseCountry: z.string().trim().length(2).toUpperCase(),
        licenseDocToken: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.broker.findUnique({ where: { userId: ctx.user.id } });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Already applied (status: ${existing.status})`,
        });
      }
      const broker = await ctx.prisma.broker.create({
        data: {
          userId: ctx.user.id,
          licenseNumber: input.licenseNumber,
          licenseCountry: input.licenseCountry,
          licenseDocToken: input.licenseDocToken ?? null,
        },
      });
      await track("broker_applied", { userId: ctx.user.id });
      return { id: broker.id, status: broker.status };
    }),

  me: authedProcedure.query(async ({ ctx }) => {
    const broker = await ctx.prisma.broker.findUnique({ where: { userId: ctx.user.id } });
    if (!broker) return null;
    const earnings = await ctx.prisma.brokerEarning.groupBy({
      by: ["status"],
      where: { brokerUserId: ctx.user.id },
      _sum: { amountCents: true },
      _count: { _all: true },
    });
    const sum = (s: string) => earnings.find((e) => e.status === s)?._sum.amountCents ?? 0;
    const count = (s: string) => earnings.find((e) => e.status === s)?._count._all ?? 0;
    return {
      id: broker.id,
      status: broker.status,
      licenseNumber: broker.licenseNumber,
      licenseCountry: broker.licenseCountry,
      stripeConnected: !!broker.stripeAccountId,
      payoutsEnabled: broker.payoutsEnabled,
      rejectionReason: broker.rejectionReason,
      earnings: {
        pendingCents: sum("PENDING"),
        pendingCount: count("PENDING"),
        paidCents: sum("PAID"),
        paidCount: count("PAID"),
      },
    };
  }),

  /** Create (if needed) the Stripe connected account and return a hosted onboarding link. */
  onboardingLink: authedProcedure.mutation(async ({ ctx }) => {
    const broker = await ctx.prisma.broker.findUnique({ where: { userId: ctx.user.id } });
    if (!broker) throw new TRPCError({ code: "FORBIDDEN", message: "Not a registered broker" });

    let accountId = broker.stripeAccountId;
    if (!accountId) {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: { email: true },
      });
      const created = await stripe.createConnectedAccount({
        email: user?.email ?? null,
        brokerUserId: ctx.user.id,
      });
      accountId = created.accountId;
      await ctx.prisma.broker.update({
        where: { id: broker.id },
        data: { stripeAccountId: accountId },
      });
    }

    const { url } = await stripe.createAccountLink({
      accountId,
      refreshPath: "/broker/dashboard?onboarding=refresh",
      returnPath: "/broker/dashboard?onboarding=done",
    });
    return { url };
  }),

  /** Pay out all PENDING earnings to the broker's connected account. Idempotent per broker batch. */
  requestPayout: approvedBrokerProcedure.mutation(async ({ ctx }) => {
    const broker = ctx.broker;
    if (!broker.stripeAccountId || !broker.payoutsEnabled) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Finish Stripe onboarding before requesting a payout",
      });
    }
    const pending = await ctx.prisma.brokerEarning.findMany({
      where: { brokerUserId: ctx.user.id, status: "PENDING" },
    });
    if (pending.length === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No pending earnings to pay out" });
    }
    const currency = pending[0].currency;
    const amountCents = pending.reduce((sum, e) => sum + e.amountCents, 0);
    // Stable key so a retried request can't double-pay the same set of earnings.
    const idempotencyKey = `payout_${broker.id}_${pending.map((e) => e.id).sort().join("_")}`;

    let transferId: string;
    try {
      const res = await stripe.payoutBroker({
        accountId: broker.stripeAccountId,
        amountCents,
        currency,
        idempotencyKey,
      });
      transferId = res.transferId;
    } catch (err: any) {
      await ctx.prisma.brokerEarning.updateMany({
        where: { id: { in: pending.map((e) => e.id) } },
        data: { status: "FAILED" },
      });
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message ?? "payout failed" });
    }

    await ctx.prisma.brokerEarning.updateMany({
      where: { id: { in: pending.map((e) => e.id) } },
      data: { status: "PAID", stripeTransferId: transferId, paidAt: new Date() },
    });
    // The BrokerEarning rows (now PAID, carrying the transferId) are the payout ledger;
    // the org-scoped AuditLog doesn't apply to platform-level broker payouts.

    return { amountCents, currency, count: pending.length, transferId };
  }),
});
