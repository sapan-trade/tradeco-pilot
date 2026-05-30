import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createShopifyConnector } from "@/server/integrations/shopify";
import { prisma } from "@/lib/db";

const connector = createShopifyConnector();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const shop = url.searchParams.get("shop");
  const orgId = req.headers.get("x-test-org");
  if (!shop || !/^[a-z0-9-]+\.myshopify\.com$/i.test(shop)) {
    return NextResponse.json({ error: "missing or invalid `shop` parameter" }, { status: 400 });
  }
  if (!orgId) {
    return NextResponse.json({ error: "no org context" }, { status: 401 });
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
