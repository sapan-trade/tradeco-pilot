import { z } from "zod";
import { router, orgProcedure } from "../init";

const SEVERITIES = ["INFO", "WARN", "CRITICAL"] as const;

export const regulatoryRouter = router({
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
