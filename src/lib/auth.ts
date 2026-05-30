import type { OrgRole } from "@prisma/client";
import { prisma } from "./db";

export interface AuthUser {
  id: string;
}

export interface OrgContext {
  id: string;
  role: OrgRole;
}

/**
 * Phase 1: no Clerk session integration yet.
 * For local HTTP probes, accept `x-test-user` / `x-test-org` headers.
 * For unit/integration tests, callers bypass this entirely via createTestContext.
 * Phase 3 replaces this with `@clerk/nextjs` auth().
 */
export async function resolveAuth(
  req?: Request
): Promise<{ user: AuthUser | null; org: OrgContext | null }> {
  // TODO: replace with real Clerk session lookup.
  if (!req) return { user: null, org: null };

  const userId = req.headers.get("x-test-user");
  const orgId = req.headers.get("x-test-org");
  if (!userId) return { user: null, org: null };

  const user: AuthUser = { id: userId };
  if (!orgId) return { user, org: null };

  const m = await prisma.membership.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  if (!m) return { user, org: null };

  return { user, org: { id: orgId, role: m.role } };
}
