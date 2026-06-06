import { prisma } from "@/lib/db";

/**
 * Fire-and-forget product-analytics event. Never throws — telemetry must not break
 * the action that emits it. Self-hosted (writes to AnalyticsEvent); swap for PostHog
 * etc. behind this function later without touching call sites.
 */
export async function track(
  name: string,
  opts: { userId?: string | null; orgId?: string | null; props?: Record<string, unknown> } = {}
): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        name,
        userId: opts.userId ?? null,
        orgId: opts.orgId ?? null,
        props: (opts.props ?? {}) as object,
      },
    });
  } catch (e: any) {
    console.error("[telemetry] track failed:", e?.message ?? e);
  }
}

/**
 * Platform-admin gate for business metrics. Global numbers must NOT be visible to
 * every org admin — only to emails listed in PLATFORM_ADMIN_EMAILS.
 */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const allow = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length === 0) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return !!user?.email && allow.includes(user.email.toLowerCase());
}
