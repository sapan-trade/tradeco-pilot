import { NextResponse } from "next/server";
import { createShopifyConnector, syncShopifyProductsToSkus } from "@/server/integrations/shopify";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/server/services/audit";

const connector = createShopifyConnector();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const shop = url.searchParams.get("shop");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!shop || !code || !state) {
    return NextResponse.json({ error: "missing shop, code, or state" }, { status: 400 });
  }
  const pending = await prisma.connector.findFirst({
    where: { type: "SHOPIFY", shopDomain: shop, status: "PENDING" },
  });
  if (!pending || !pending.scopes.includes(state)) {
    return NextResponse.json({ error: "no matching pending install (state mismatch)" }, { status: 400 });
  }
  try {
    const { accessToken, scopes } = await connector.exchangeCode({ shop, code });
    // Pull the store-owner email so the connection self-identifies and can be
    // matched against the TradeCo account that initiated it.
    const shopInfo = await connector.fetchShopInfo({ shop, accessToken }).catch(() => ({
      email: null,
      name: null,
    }));
    await prisma.connector.update({
      where: { id: pending.id },
      data: {
        status: "ACTIVE",
        accessToken,
        scopes,
        shopEmail: shopInfo.email,
        shopName: shopInfo.name,
        errorMessage: null,
      },
    });
    const { upserted } = await syncShopifyProductsToSkus({
      orgId: pending.orgId,
      connector,
      shop,
      accessToken,
      prisma,
    });
    await prisma.connector.update({
      where: { id: pending.id },
      data: { lastSyncAt: new Date() },
    });
    await writeAuditLog({
      orgId: pending.orgId,
      userId: null,
      action: "connector.shopify.connected",
      subject: `connector:${pending.id}`,
      payload: { shop, shopEmail: shopInfo.email, productsSynced: upserted },
    });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return NextResponse.redirect(`${appUrl}/connectors?connected=1&synced=${upserted}`);
  } catch (err: any) {
    await prisma.connector.update({
      where: { id: pending.id },
      data: { status: "ERROR", errorMessage: err.message ?? "exchange failed" },
    });
    return NextResponse.json({ error: err.message ?? "shopify exchange failed" }, { status: 500 });
  }
}
