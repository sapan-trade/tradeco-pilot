import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, approvedBrokerProcedure } from "../init";
import { writeAuditLog } from "@/server/services/audit";

const HS_RE = /^\d{4}\.\d{2}\.\d{4}$/;

/** Flat fee an approved broker earns per completed marketplace review. */
const BROKER_FEE_CENTS = Number(process.env.BROKER_FEE_CENTS ?? 300);

/**
 * Marketplace: the pooled, cross-org review queue for approved independent brokers.
 * Unlike `broker.*` (org-scoped), these procedures span every tenant's review backlog.
 */
export const marketplaceRouter = router({
  queue: approvedBrokerProcedure
    .input(z.object({ cursor: z.string().nullish() }).default({}))
    .query(async ({ ctx, input }) => {
      const limit = 50;
      const items = await ctx.prisma.brokerReview.findMany({
        where: {
          decision: null,
          // Unclaimed, or already claimed by this broker.
          OR: [{ claimedByUserId: null }, { claimedByUserId: ctx.user.id }],
        },
        take: limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "asc" },
        include: { classification: { include: { sku: true, org: { select: { name: true } } } } },
      });
      const nextCursor = items.length > limit ? items.pop()!.id : null;
      return {
        feeCents: BROKER_FEE_CENTS,
        items: items.map((r) => ({
          reviewId: r.id,
          classificationId: r.classificationId,
          orgName: r.classification.org.name,
          destination: r.classification.destination,
          predictedHsCode: r.classification.hsCode,
          confidence: r.classification.confidence,
          rationale: r.classification.rationale,
          claimedByMe: r.claimedByUserId === ctx.user.id,
          sku: {
            title: r.classification.sku.title,
            description: r.classification.sku.description,
            imageUrls: r.classification.sku.imageUrls,
            materials: r.classification.sku.materials,
          },
          createdAt: r.createdAt.toISOString(),
        })),
        nextCursor,
      };
    }),

  get: approvedBrokerProcedure
    .input(z.object({ reviewId: z.string() }))
    .query(async ({ ctx, input }) => {
      const r = await ctx.prisma.brokerReview.findUnique({
        where: { id: input.reviewId },
        include: { classification: { include: { sku: true, org: { select: { name: true } } } } },
      });
      if (!r) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        reviewId: r.id,
        classificationId: r.classificationId,
        orgName: r.classification.org.name,
        destination: r.classification.destination,
        predictedHsCode: r.classification.hsCode,
        confidence: r.classification.confidence,
        rationale: r.classification.rationale,
        decision: r.decision,
        claimedByMe: r.claimedByUserId === ctx.user.id,
        claimedByOther: !!r.claimedByUserId && r.claimedByUserId !== ctx.user.id,
        feeCents: BROKER_FEE_CENTS,
        sku: {
          title: r.classification.sku.title,
          description: r.classification.sku.description,
          imageUrls: r.classification.sku.imageUrls,
          materials: r.classification.sku.materials,
        },
        createdAt: r.createdAt.toISOString(),
      };
    }),

  claim: approvedBrokerProcedure
    .input(z.object({ reviewId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const r = await ctx.prisma.brokerReview.findUnique({ where: { id: input.reviewId } });
      if (!r) throw new TRPCError({ code: "NOT_FOUND" });
      if (r.decision !== null) throw new TRPCError({ code: "CONFLICT", message: "Review already decided" });
      if (r.claimedByUserId && r.claimedByUserId !== ctx.user.id) {
        throw new TRPCError({ code: "CONFLICT", message: "Already claimed by another broker" });
      }
      // Conditional update guards against two brokers claiming the same row concurrently.
      const res = await ctx.prisma.brokerReview.updateMany({
        where: { id: r.id, claimedByUserId: null, decision: null },
        data: { claimedByUserId: ctx.user.id, claimedAt: new Date() },
      });
      if (res.count === 0 && r.claimedByUserId !== ctx.user.id) {
        throw new TRPCError({ code: "CONFLICT", message: "Already claimed by another broker" });
      }
      return { ok: true as const };
    }),

  decide: approvedBrokerProcedure
    .input(
      z.object({
        reviewId: z.string(),
        decision: z.enum(["APPROVED", "CORRECTED", "REJECTED"]),
        correctedHsCode: z.string().regex(HS_RE).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.decision === "CORRECTED" && !input.correctedHsCode) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "correctedHsCode required when decision=CORRECTED" });
      }
      const r = await ctx.prisma.brokerReview.findUnique({
        where: { id: input.reviewId },
        include: { classification: true },
      });
      if (!r) throw new TRPCError({ code: "NOT_FOUND" });
      if (r.decision !== null) throw new TRPCError({ code: "CONFLICT", message: "Review already decided" });
      if (r.claimedByUserId && r.claimedByUserId !== ctx.user.id) {
        throw new TRPCError({ code: "CONFLICT", message: "Claimed by another broker" });
      }

      const newStatus = input.decision === "REJECTED" ? "BROKER_REJECTED" : "BROKER_APPROVED";
      const newHs = input.decision === "CORRECTED" ? input.correctedHsCode! : r.classification.hsCode;

      await ctx.prisma.$transaction([
        ctx.prisma.brokerReview.update({
          where: { id: r.id },
          data: {
            decision: input.decision,
            brokerUserId: ctx.user.id,
            claimedByUserId: ctx.user.id,
            claimedAt: r.claimedAt ?? new Date(),
            correctedHsCode: input.correctedHsCode ?? null,
            notes: input.notes ?? null,
            decidedAt: new Date(),
          },
        }),
        ctx.prisma.classification.update({
          where: { id: r.classificationId },
          data: { status: newStatus, hsCode: newHs },
        }),
        // Accrue the flat fee. Unique reviewId makes this idempotent with the decision guard.
        ctx.prisma.brokerEarning.create({
          data: {
            brokerId: ctx.broker.id,
            brokerUserId: ctx.user.id,
            reviewId: r.id,
            amountCents: BROKER_FEE_CENTS,
          },
        }),
      ]);

      await writeAuditLog({
        orgId: r.classification.orgId,
        userId: ctx.user.id,
        action: "marketplace.decide",
        subject: `classification:${r.classificationId}`,
        payload: {
          reviewId: r.id,
          decision: input.decision,
          correctedHsCode: input.correctedHsCode ?? null,
          previousHsCode: r.classification.hsCode,
          newHsCode: newHs,
          brokerFeeCents: BROKER_FEE_CENTS,
        },
      });

      return { ok: true as const, classificationStatus: newStatus, earnedCents: BROKER_FEE_CENTS };
    }),
});
