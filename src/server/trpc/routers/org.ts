import { z } from "zod";
import { router, orgProcedure, requireRole } from "../init";
import { seedSampleData } from "@/server/services/sample-data";

const DEFAULT_THRESHOLD = 0.85;

function readThreshold(settings: unknown): number {
  const v = (settings as { confidenceThreshold?: number } | null)?.confidenceThreshold;
  return typeof v === "number" ? v : DEFAULT_THRESHOLD;
}

export const orgRouter = router({
  current: orgProcedure.query(async ({ ctx }) => {
    const org = await ctx.prisma.organization.findUniqueOrThrow({
      where: { id: ctx.org.id },
    });
    return {
      id: org.id,
      name: org.name,
      country: org.country,
      role: ctx.org.role,
      settings: { confidenceThreshold: readThreshold(org.settings) },
    };
  }),

  updateSettings: requireRole("OWNER")
    .input(z.object({ confidenceThreshold: z.number().min(0).max(1).optional() }))
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.prisma.organization.findUniqueOrThrow({
        where: { id: ctx.org.id },
      });
      const merged = { ...((org.settings as object) ?? {}), ...input };
      await ctx.prisma.organization.update({
        where: { id: ctx.org.id },
        data: { settings: merged },
      });
      return { ok: true as const };
    }),

  loadSampleData: orgProcedure.mutation(async ({ ctx }) => {
    return seedSampleData(ctx.org.id);
  }),
});
