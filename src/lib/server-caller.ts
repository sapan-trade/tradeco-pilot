import { headers as nextHeaders } from "next/headers";
import { appRouter } from "@/server/trpc/routers/_app";
import { prisma } from "@/lib/db";
import type { Context } from "@/server/trpc/context";
import type { OrgRole } from "@prisma/client";

/**
 * Build a tRPC server-side caller from the incoming request.
 *
 * Two auth paths, tried in order:
 *  1. Clerk session (real users). Lazy-upserts User / Organization / Membership rows
 *     so local dev works without a webhook reaching the machine.
 *  2. `x-test-user` / `x-test-org` headers (Playwright, local probes).
 */
export async function getServerCaller() {
  if (process.env.CLERK_SECRET_KEY) {
    const ctx = await tryClerkAuth();
    if (ctx) return { caller: appRouter.createCaller(ctx), ctx };
  }

  const h = await nextHeaders();
  const userId = h.get("x-test-user");
  const orgId = h.get("x-test-org");
  let user: { id: string } | null = null;
  let org: { id: string; role: OrgRole } | null = null;
  if (userId) {
    user = { id: userId };
    if (orgId) {
      const m = await prisma.membership.findUnique({
        where: { userId_orgId: { userId, orgId } },
      });
      if (m) org = { id: orgId, role: m.role };
    }
  }
  const ctx: Context = { prisma, user, org };
  return { caller: appRouter.createCaller(ctx), ctx };
}

async function tryClerkAuth(): Promise<Context | null> {
  // Dynamic import so test environments (NODE_ENV=test, no middleware) skip Clerk entirely.
  const { auth, currentUser } = await import("@clerk/nextjs/server");
  let session: Awaited<ReturnType<typeof auth>>;
  try {
    session = await auth();
  } catch {
    return null;
  }
  if (!session.userId) return null;

  const cu = await currentUser().catch(() => null);
  const email = cu?.primaryEmailAddress?.emailAddress ?? `${session.userId}@unknown.local`;
  const name = [cu?.firstName, cu?.lastName].filter(Boolean).join(" ") || null;

  await safeUpsert(() =>
    prisma.user.upsert({
      where: { id: session.userId! },
      create: { id: session.userId!, email, name },
      update: { email, name: name ?? undefined },
    })
  );

  if (!session.orgId) {
    return { prisma, user: { id: session.userId }, org: null };
  }

  const role = mapClerkRole(session.orgRole ?? null);
  await safeUpsert(() =>
    prisma.organization.upsert({
      where: { id: session.orgId! },
      create: {
        id: session.orgId!,
        name: session.orgSlug ?? session.orgId!,
        country: "US",
      },
      update: {},
    })
  );
  await safeUpsert(() =>
    prisma.membership.upsert({
      where: { userId_orgId: { userId: session.userId!, orgId: session.orgId! } },
      create: { userId: session.userId!, orgId: session.orgId!, role },
      update: { role },
    })
  );

  return {
    prisma,
    user: { id: session.userId },
    org: { id: session.orgId, role },
  };
}

function mapClerkRole(role: string | null): OrgRole {
  if (role === "org:admin") return "OWNER";
  if (role === "org:broker") return "BROKER";
  return "MEMBER";
}

/**
 * Lazy upserts above run on every dashboard request. When the user lands on
 * /dashboard for the first time, Next.js renders multiple server components
 * in parallel and Prisma's upsert isn't fully atomic — a concurrent insert
 * race shows up as P2002 (unique constraint). The row exists either way,
 * so swallow that specific code; surface everything else.
 */
async function safeUpsert<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e: any) {
    if (e?.code === "P2002") return null;
    throw e;
  }
}
