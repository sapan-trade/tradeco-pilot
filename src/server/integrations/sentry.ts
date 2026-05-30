import * as Sentry from "@sentry/nextjs";

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  console.error("[error]", err, context ?? "");
  if (process.env.SENTRY_DSN && process.env.NODE_ENV !== "test") {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  }
}

export function setUserContext(args: { userId?: string | null; orgId?: string | null }): void {
  if (!process.env.SENTRY_DSN || process.env.NODE_ENV === "test") return;
  Sentry.setUser(args.userId ? { id: args.userId } : null);
  if (args.orgId) Sentry.setTag("orgId", args.orgId);
}
