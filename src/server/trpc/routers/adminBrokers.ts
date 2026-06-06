import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, requireRole } from "../init";

/**
 * Admin review of broker applications — the "is this a genuine broker?" gate.
 * Org ADMINs approve/reject license submissions. Identity + bank verification is
 * handled separately by Stripe Connect onboarding; this gate is about licensure.
 */
export const adminBrokersRouter = router({
  list: requireRole("ADMIN")
    .input(
      z
        .object({ status: z.enum(["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]).optional() })
        .default({})
    )
    .query(async ({ ctx, input }) => {
      const brokers = await ctx.prisma.broker.findMany({
        where: input.status ? { status: input.status } : undefined,
        orderBy: { appliedAt: "asc" },
        include: { user: { select: { email: true, name: true } } },
      });
      return brokers.map((b) => ({
        id: b.id,
        userId: b.userId,
        email: b.user.email,
        name: b.user.name,
        licenseNumber: b.licenseNumber,
        licenseCountry: b.licenseCountry,
        licenseDocToken: b.licenseDocToken,
        status: b.status,
        payoutsEnabled: b.payoutsEnabled,
        stripeConnected: !!b.stripeAccountId,
        appliedAt: b.appliedAt.toISOString(),
        reviewedAt: b.reviewedAt?.toISOString() ?? null,
        rejectionReason: b.rejectionReason,
      }));
    }),

  approve: requireRole("ADMIN")
    .input(z.object({ brokerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const broker = await ctx.prisma.broker.findUnique({ where: { id: input.brokerId } });
      if (!broker) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.prisma.broker.update({
        where: { id: broker.id },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
          reviewedByUserId: ctx.user.id,
          rejectionReason: null,
        },
      });
      return { ok: true as const, status: "APPROVED" as const };
    }),

  reject: requireRole("ADMIN")
    .input(z.object({ brokerId: z.string(), reason: z.string().trim().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const broker = await ctx.prisma.broker.findUnique({ where: { id: input.brokerId } });
      if (!broker) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.prisma.broker.update({
        where: { id: broker.id },
        data: {
          status: "REJECTED",
          reviewedAt: new Date(),
          reviewedByUserId: ctx.user.id,
          rejectionReason: input.reason,
        },
      });
      return { ok: true as const, status: "REJECTED" as const };
    }),
});
