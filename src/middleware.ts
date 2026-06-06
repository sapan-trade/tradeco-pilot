import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublic = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/lookup(.*)", // free public HS-code lookup (lead gen)
  "/hs-code(.*)", // public SEO directory
  "/terms",
  "/privacy",
  "/sitemap.xml",
  "/robots.txt",
  "/api/webhooks/(.*)",
  "/api/inngest(.*)",
  "/api/connectors/upload/put(.*)", // S3 stub PUT endpoint
  "/api/cron/(.*)", // Vercel Cron (route enforces CRON_SECRET itself)
]);

export default clerkMiddleware(async (auth, req) => {
  // Dev/test escape hatch: requests carrying `x-test-user` bypass Clerk so the
  // Phase 1-2 vitest specs and Phase 3 Playwright e2e keep working unchanged.
  if (process.env.NODE_ENV !== "production" && req.headers.get("x-test-user")) {
    return;
  }
  if (!isPublic(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
