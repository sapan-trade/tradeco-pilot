import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProcedure, requireRole } from "../init";
import { scheduleClassification } from "@/server/services/classifier";
import { writeAuditLog } from "@/server/services/audit";
import { getRateLimiter } from "@/server/integrations/ratelimit";

const HS_RE = /^\d{4}\.\d{2}\.\d{4}$/;
const STATUSES = ["PENDING", "AUTO_APPROVED", "NEEDS_REVIEW", "BROKER_APPROVED", "BROKER_REJECTED", "OVERRIDDEN"] as const;

// Classification calls Claude (it costs money), so cap how fast one org can fire it.
const CLASSIFY_LIMIT = 60;
const CLASSIFY_WINDOW_MS = 60_000;

export const classificationRouter = router({
  run: orgProcedure
    .input(z.object({ skuId: z.string(), destination: z.string().length(2) }))
    .mutation(async ({ ctx, input }) => {
      const rl = await getRateLimiter().consume(
        `classify:${ctx.org.id}`,
        CLASSIFY_LIMIT,
        CLASSIFY_WINDOW_MS
      );
      if (!rl.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Classification rate limit reached — try again in a minute.",
        });
      }

      const sku = await ctx.prisma.sku.findFirst({
        where: { id: input.skuId, orgId: ctx.org.id },
      });
      if (!sku) throw new TRPCError({ code: "NOT_FOUND", message: "SKU not found" });

      const classification = await ctx.prisma.classification.create({
        data: {
          orgId: ctx.org.id,
          skuId: sku.id,
          destination: input.destination,
          hsCode: "0000.00.0000",
          confidence: 0,
          rationale: "",
          modelVersion: "pending",
          inputHash: "",
          status: "PENDING",
        },
      });

      await writeAuditLog({
        orgId: ctx.org.id,
        userId: ctx.user.id,
        action: "classification.run",
        subject: `classification:${classification.id}`,
        payload: { skuId: sku.id, destination: input.destination },
      });

      // Phase 1: synchronous. Phase 2 will replace this with an Inngest event dispatch.
      await scheduleClassification(classification.id);

      const updated = await ctx.prisma.classification.findUniqueOrThrow({
        where: { id: classification.id },
        select: { id: true, status: true },
      });
      return { classificationId: updated.id, status: updated.status };
    }),

  get: orgProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const c = await ctx.prisma.classification.findFirst({
      where: { id: input.id, orgId: ctx.org.id },
      include: { review: true },
    });
    if (!c) throw new TRPCError({ code: "NOT_FOUND" });
    const audits = await ctx.prisma.auditLog.findMany({
      where: { subject: `classification:${c.id}` },
      orderBy: { createdAt: "asc" },
      select: { action: true, createdAt: true, userId: true },
    });
    return {
      id: c.id,
      skuId: c.skuId,
      destination: c.destination,
      hsCode: c.hsCode,
      confidence: c.confidence,
      rationale: c.rationale,
      status: c.status,
      ftaEligible: c.ftaEligible,
      ftaProgram: c.ftaProgram,
      modelVersion: c.modelVersion,
      createdAt: c.createdAt.toISOString(),
      review: c.review
        ? {
            brokerUserId: c.review.brokerUserId,
            decision: c.review.decision,
            notes: c.review.notes,
          }
        : null,
      audit: audits.map((a) => ({
        action: a.action,
        createdAt: a.createdAt.toISOString(),
        userId: a.userId,
      })),
    };
  }),

  list: orgProcedure
    .input(
      z
        .object({
          cursor: z.string().nullish(),
          status: z.enum(STATUSES).nullish(),
          skuId: z.string().nullish(),
        })
        .default({})
    )
    .query(async ({ ctx, input }) => {
      const limit = 50;
      const items = await ctx.prisma.classification.findMany({
        where: {
          orgId: ctx.org.id,
          ...(input.status ? { status: input.status } : {}),
          ...(input.skuId ? { skuId: input.skuId } : {}),
        },
        take: limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
      });
      const nextCursor = items.length > limit ? items.pop()!.id : null;
      return {
        items: items.map((c) => ({
          id: c.id,
          skuId: c.skuId,
          destination: c.destination,
          hsCode: c.hsCode,
          confidence: c.confidence,
          rationale: c.rationale,
          status: c.status,
          ftaEligible: c.ftaEligible,
          ftaProgram: c.ftaProgram,
          modelVersion: c.modelVersion,
          createdAt: c.createdAt.toISOString(),
        })),
        nextCursor,
      };
    }),

  override: requireRole("OWNER")
    .input(z.object({ id: z.string(), hsCode: z.string().regex(HS_RE), reason: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.classification.findFirst({
        where: { id: input.id, orgId: ctx.org.id },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      const updated = await ctx.prisma.classification.update({
        where: { id: input.id },
        data: { hsCode: input.hsCode, status: "OVERRIDDEN" },
      });
      await writeAuditLog({
        orgId: ctx.org.id,
        userId: ctx.user.id,
        action: "classification.override",
        subject: `classification:${updated.id}`,
        payload: { previousHs: existing.hsCode, newHs: input.hsCode, reason: input.reason },
      });
      return {
        id: updated.id,
        skuId: updated.skuId,
        destination: updated.destination,
        hsCode: updated.hsCode,
        confidence: updated.confidence,
        rationale: updated.rationale,
        status: updated.status,
        ftaEligible: updated.ftaEligible,
        ftaProgram: updated.ftaProgram,
        modelVersion: updated.modelVersion,
        createdAt: updated.createdAt.toISOString(),
      };
    }),
});
