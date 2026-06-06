import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, requireRole } from "../init";
import { writeAuditLog } from "@/server/services/audit";
import { notifyOrgMembers } from "@/server/services/notify";

const HS_RE = /^\d{4}\.\d{2}\.\d{4}$/;

export const brokerRouter = router({
  queue: requireRole("BROKER", "ADMIN")
    .input(z.object({ cursor: z.string().nullish() }).default({}))
    .query(async ({ ctx, input }) => {
      const limit = 50;
      const items = await ctx.prisma.brokerReview.findMany({
        where: { decision: null, classification: { orgId: ctx.org.id } },
        take: limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "asc" },
        include: { classification: { include: { sku: true } } },
      });
      const nextCursor = items.length > limit ? items.pop()!.id : null;
      return {
        items: items.map((r) => ({
          reviewId: r.id,
          classificationId: r.classificationId,
          destination: r.classification.destination,
          predictedHsCode: r.classification.hsCode,
          confidence: r.classification.confidence,
          rationale: r.classification.rationale,
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

  get: requireRole("BROKER", "ADMIN")
    .input(z.object({ reviewId: z.string() }))
    .query(async ({ ctx, input }) => {
      const r = await ctx.prisma.brokerReview.findFirst({
        where: { id: input.reviewId, classification: { orgId: ctx.org.id } },
        include: { classification: { include: { sku: true } } },
      });
      if (!r) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        reviewId: r.id,
        classificationId: r.classificationId,
        decision: r.decision,
        notes: r.notes,
        destination: r.classification.destination,
        predictedHsCode: r.classification.hsCode,
        confidence: r.classification.confidence,
        rationale: r.classification.rationale,
        sku: {
          title: r.classification.sku.title,
          description: r.classification.sku.description,
          imageUrls: r.classification.sku.imageUrls,
          materials: r.classification.sku.materials,
        },
        createdAt: r.createdAt.toISOString(),
      };
    }),

  decide: requireRole("BROKER", "ADMIN")
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
      const r = await ctx.prisma.brokerReview.findFirst({
        where: { id: input.reviewId, classification: { orgId: ctx.org.id } },
        include: { classification: true },
      });
      if (!r) throw new TRPCError({ code: "NOT_FOUND" });
      if (r.decision !== null) throw new TRPCError({ code: "CONFLICT", message: "Review already decided" });

      const newStatus = input.decision === "REJECTED" ? "BROKER_REJECTED" : "BROKER_APPROVED";
      const newHs = input.decision === "CORRECTED" ? input.correctedHsCode! : r.classification.hsCode;

      await ctx.prisma.$transaction([
        ctx.prisma.brokerReview.update({
          where: { id: r.id },
          data: {
            decision: input.decision,
            brokerUserId: ctx.user.id,
            correctedHsCode: input.correctedHsCode ?? null,
            notes: input.notes ?? null,
            decidedAt: new Date(),
          },
        }),
        ctx.prisma.classification.update({
          where: { id: r.classificationId },
          data: { status: newStatus, hsCode: newHs },
        }),
      ]);

      await writeAuditLog({
        orgId: ctx.org.id,
        userId: ctx.user.id,
        action: "broker.decide",
        subject: `classification:${r.classificationId}`,
        payload: {
          reviewId: r.id,
          decision: input.decision,
          correctedHsCode: input.correctedHsCode ?? null,
          previousHsCode: r.classification.hsCode,
          newHsCode: newHs,
        },
      });

      await notifyOrgMembers(ctx.org.id, {
        type: "BROKER_DECISION",
        title: `A broker ${input.decision.toLowerCase()} your classification`,
        body: `HS ${newHs} was ${input.decision.toLowerCase()} by a broker.`,
        link: "/classifications",
      });

      return { ok: true as const, classificationStatus: newStatus };
    }),
});
