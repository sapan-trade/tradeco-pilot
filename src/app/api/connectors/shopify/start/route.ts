import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createShopifyConnector, normalizeShopDomain } from "@/server/integrations/shopify";
import { prisma } from "@/lib/db";

const connector = createShopifyConnector();

async function resolveOrgId(req: Request): Promise<string | null> {
  // Production: Clerk-authenticated user has an active orgId.
  if (process.env.CLERK_SECRET_KEY) {
    try {
      const { auth } = await import("@clerk/nextjs/server");
      const session = await auth();
      if (session.orgId) return session.orgId;
    } catch {
      /* fall through */
    }
  }
  // Test/dev fallback used by Playwright + local probes.
  return req.headers.get("x-test-org");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const shop = normalizeShopDomain(url.searchParams.get("shop") ?? "");
  if (!shop) {
    return NextResponse.json({ error: "missing or invalid `shop` parameter" }, { status: 400 });
  }

  const orgId = await resolveOrgId(req);
  if (!orgId) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return NextResponse.redirect(`${appUrl}/sign-in?redirect=/connectors`);
  }

  const state = crypto.randomBytes(16).toString("hex");
  await prisma.connector.upsert({
    where: { orgId_type: { orgId, type: "SHOPIFY" } },
    create: { orgId, type: "SHOPIFY", status: "PENDING", shopDomain: shop, scopes: [state] },
    update: { status: "PENDING", shopDomain: shop, scopes: [state], errorMessage: null },
  });
  const installUrl = connector.getInstallUrl({ shop, state });
  return NextResponse.redirect(installUrl);
}
