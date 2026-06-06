import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";
import type { OrgRole } from "@prisma/client";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const orgProcedure = authedProcedure.use(({ ctx, next }) => {
  if (!ctx.org) throw new TRPCError({ code: "FORBIDDEN", message: "Org context required" });
  return next({ ctx: { ...ctx, org: ctx.org } });
});

export function requireRole(...allowed: OrgRole[]) {
  return orgProcedure.use(({ ctx, next }) => {
    if (!allowed.includes(ctx.org.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Required role: ${allowed.join(",")}` });
    }
    return next();
  });
}

/**
 * Platform-level (cross-org) broker gate. Unlike `requireRole`, this is NOT org-scoped:
 * it resolves the marketplace `Broker` profile by user id and requires it be APPROVED.
 * Injects `ctx.broker` for downstream procedures.
 */
export const approvedBrokerProcedure = authedProcedure.use(async ({ ctx, next }) => {
  const broker = await ctx.prisma.broker.findUnique({ where: { userId: ctx.user.id } });
  if (!broker) throw new TRPCError({ code: "FORBIDDEN", message: "Not a registered broker" });
  if (broker.status !== "APPROVED") {
    throw new TRPCError({ code: "FORBIDDEN", message: `Broker not approved (status: ${broker.status})` });
  }
  return next({ ctx: { ...ctx, broker } });
});
