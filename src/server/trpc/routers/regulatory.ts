import { z } from "zod";
import { router, orgProcedure } from "../init";
import { matchUpdatesToClassifications } from "@/server/services/regulatory-match";

const SEVERITIES = ["INFO", "WARN", "CRITICAL"] as const;

export const regulatoryRouter = router({
  /** Regulatory updates that touch HS codes in THIS org's catalog. */
  alertsForOrg: orgProcedure.query(async ({ ctx }) => {
    const [classifications, updates] = await Promise.all([
      ctx.prisma.classification.findMany({
        where: { orgId: ctx.org.id },
        select: { id: true, skuId: true, hsCode: true, destination: true, sku: { select: { title: true } } },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      ctx.prisma.regulatoryUpdate.findMany({ orderBy: { publishedAt: "desc" }, take: 200 }),
    ]);

    const matches = matchUpdatesToClassifications(
      updates,
      classifications.map((c) => ({
        id: c.id,
        skuId: c.skuId,
        hsCode: c.hsCode,
        destination: c.destination,
        skuTitle: c.sku.title,
      }))
    );

    const affectedSkuIds = new Set<string>();
    matches.forEach((m) => m.affected.forEach((c) => affectedSkuIds.add(c.skuId)));

    return {
      alertCount: matches.length,
      affectedSkuCount: affectedSkuIds.size,
      alerts: matches.map((m) => ({
        id: m.update.id,
        title: m.update.title,
        url: m.update.url,
        severity: m.update.severity,
        source: m.update.source,
        affectedHs: m.update.affectedHs,
        publishedAt: m.update.publishedAt.toISOString(),
        products: m.affected.slice(0, 10).map((c) => ({
          skuId: c.skuId,
          title: c.skuTitle,
          hsCode: c.hsCode,
          destination: c.destination,
        })),
        moreProducts: Math.max(0, m.affected.length - 10),
      })),
    };
  }),

  list: orgProcedure
    .input(z.object({ cursor: z.string().nullish(), severity: z.enum(SEVERITIES).nullish() }).default({}))
    .query(async ({ ctx, input }) => {
      const limit = 50;
      const items = await ctx.prisma.regulatoryUpdate.findMany({
        where: input.severity ? { severity: input.severity } : undefined,
        take: limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { publishedAt: "desc" },
      });
      const nextCursor = items.length > limit ? items.pop()!.id : null;
      return {
        items: items.map((r) => ({
          id: r.id,
          source: r.source,
          title: r.title,
          url: r.url,
          severity: r.severity,
          affectedHs: r.affectedHs,
          affectedDest: r.affectedDest,
          publishedAt: r.publishedAt.toISOString(),
        })),
        nextCursor,
      };
    }),
});
