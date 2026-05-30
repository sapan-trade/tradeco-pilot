import { z } from "zod";
import { router, requireRole } from "../init";

export const auditRouter = router({
  list: requireRole("OWNER", "ADMIN")
    .input(z.object({ cursor: z.string().nullish(), subject: z.string().nullish() }).default({}))
    .query(async ({ ctx, input }) => {
      const limit = 100;
      const items = await ctx.prisma.auditLog.findMany({
        where: {
          orgId: ctx.org.id,
          ...(input.subject ? { subject: input.subject } : {}),
        },
        take: limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
      });
      const nextCursor = items.length > limit ? items.pop()!.id : null;
      return {
        items: items.map((a) => ({
          id: a.id,
          action: a.action,
          subject: a.subject,
          userId: a.userId,
          createdAt: a.createdAt.toISOString(),
          hash: a.hash,
          payload: a.payload,
        })),
        nextCursor,
      };
    }),
});
