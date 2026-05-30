import { prisma } from "@/lib/db";
import { resolveAuth, type AuthUser, type OrgContext } from "@/lib/auth";
import type { OrgRole } from "@prisma/client";

export interface Context {
  prisma: typeof prisma;
  user: AuthUser | null;
  org: OrgContext | null;
}

export async function createContext(opts: { req?: Request } = {}): Promise<Context> {
  const auth = await resolveAuth(opts.req);
  return { prisma, user: auth.user, org: auth.org };
}

/** Bypasses HTTP auth. For tests and Inngest workers. */
export function createTestContext(args: {
  userId?: string;
  orgId?: string;
  role?: OrgRole;
}): Context {
  return {
    prisma,
    user: args.userId ? { id: args.userId } : null,
    org: args.orgId ? { id: args.orgId, role: args.role ?? "OWNER" } : null,
  };
}
