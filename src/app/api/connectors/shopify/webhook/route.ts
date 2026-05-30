import { NextResponse } from "next/server";
import { createShopifyConnector } from "@/server/integrations/shopify";
import { prisma } from "@/lib/db";

const connector = createShopifyConnector();

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("x-shopify-hmac-sha256");
  const shop = req.headers.get("x-shopify-shop-domain");
  const topic = req.headers.get("x-shopify-topic") ?? "";
  if (!connector.verifyWebhook(body, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  if (!shop) return NextResponse.json({ error: "missing shop domain" }, { status: 400 });

  const c = await prisma.connector.findFirst({
    where: { type: "SHOPIFY", shopDomain: shop, status: "ACTIVE" },
  });
  if (!c) return NextResponse.json({ ok: true, ignored: "unknown shop" });

  if (topic === "products/create" || topic === "products/update") {
    const p = JSON.parse(body) as Record<string, any>;
    await prisma.sku.upsert({
      where: { orgId_externalId: { orgId: c.orgId, externalId: `shopify:${p.id}` } },
      create: {
        orgId: c.orgId,
        externalId: `shopify:${p.id}`,
        source: "shopify",
        title: String(p.title ?? ""),
        description: typeof p.body_html === "string" ? p.body_html : null,
        imageUrls: Array.isArray(p.images) ? p.images.map((i: any) => String(i.src)) : [],
        currency: "USD",
      },
      update: {
        title: String(p.title ?? ""),
        description: typeof p.body_html === "string" ? p.body_html : null,
        imageUrls: Array.isArray(p.images) ? p.images.map((i: any) => String(i.src)) : [],
      },
    });
  } else if (topic === "products/delete") {
    const p = JSON.parse(body) as Record<string, any>;
    await prisma.sku.deleteMany({
      where: { orgId: c.orgId, externalId: `shopify:${p.id}` },
    });
  }

  return NextResponse.json({ ok: true });
}
