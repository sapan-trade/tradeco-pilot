import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProcedure } from "../init";
import { createDeclaration, submitDeclaration } from "@/server/services/declaration";
import type { Declaration } from "@prisma/client";

const STATUSES = ["DRAFT", "SUBMITTED", "ACCEPTED", "REJECTED"] as const;

function toDto(d: Declaration) {
  return {
    id: d.id,
    classificationId: d.classificationId,
    destination: d.destination,
    shipmentRef: d.shipmentRef,
    status: d.status,
    totalDutyCents: d.totalDutyCents,
    submittedAt: d.submittedAt ? d.submittedAt.toISOString() : null,
    createdAt: d.createdAt.toISOString(),
  };
}

export const declarationRouter = router({
  create: orgProcedure
    .input(z.object({ classificationId: z.string(), shipmentRef: z.string().nullish() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const d = await createDeclaration({
          orgId: ctx.org.id,
          userId: ctx.user.id,
          classificationId: input.classificationId,
          shipmentRef: input.shipmentRef ?? null,
        });
        return toDto(d);
      } catch (e: any) {
        if (e.message === "Classification not found") throw new TRPCError({ code: "NOT_FOUND", message: e.message });
        throw e;
      }
    }),

  submit: orgProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const d = await submitDeclaration({
          orgId: ctx.org.id,
          userId: ctx.user.id,
          declarationId: input.id,
        });
        return toDto(d);
      } catch (e: any) {
        if (e.message === "Declaration not found") throw new TRPCError({ code: "NOT_FOUND", message: e.message });
        if (typeof e.message === "string" && e.message.startsWith("Cannot submit")) {
          throw new TRPCError({ code: "CONFLICT", message: e.message });
        }
        throw e;
      }
    }),

  list: orgProcedure
    .input(z.object({ cursor: z.string().nullish(), status: z.enum(STATUSES).nullish() }).default({}))
    .query(async ({ ctx, input }) => {
      const limit = 50;
      const items = await ctx.prisma.declaration.findMany({
        where: { orgId: ctx.org.id, ...(input.status ? { status: input.status } : {}) },
        take: limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
      });
      const nextCursor = items.length > limit ? items.pop()!.id : null;
      return { items: items.map(toDto), nextCursor };
    }),

  get: orgProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const d = await ctx.prisma.declaration.findFirst({ where: { id: input.id, orgId: ctx.org.id } });
    if (!d) throw new TRPCError({ code: "NOT_FOUND" });
    return { ...toDto(d), packageJson: d.packageJson };
  }),
});
