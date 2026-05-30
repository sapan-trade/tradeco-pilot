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
