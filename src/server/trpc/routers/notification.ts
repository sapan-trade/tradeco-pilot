import { z } from "zod";
import { router, authedProcedure } from "../init";

/** User-scoped (not org-scoped) so both tenant users and platform brokers get notifications. */
export const notificationRouter = router({
  list: authedProcedure
    .input(z.object({ cursor: z.string().nullish() }).default({}))
    .query(async ({ ctx, input }) => {
      const limit = 30;
      const items = await ctx.prisma.notification.findMany({
        where: { userId: ctx.user.id },
        take: limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
      });
      const nextCursor = items.length > limit ? items.pop()!.id : null;
      return {
        items: items.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          link: n.link,
          read: n.read,
          createdAt: n.createdAt.toISOString(),
        })),
        nextCursor,
      };
    }),

  unreadCount: authedProcedure.query(({ ctx }) =>
    ctx.prisma.notification.count({ where: { userId: ctx.user.id, read: false } })
  ),

  markRead: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.notification.updateMany({
        where: { id: input.id, userId: ctx.user.id },
        data: { read: true },
      });
      return { ok: true as const };
    }),

  markAllRead: authedProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.notification.updateMany({
      where: { userId: ctx.user.id, read: false },
      data: { read: true },
    });
    return { ok: true as const };
  }),
});
