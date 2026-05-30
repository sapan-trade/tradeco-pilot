import { describe, it, expect } from "vitest";
import { createShopifyConnector, syncShopifyProductsToSkus } from "@/server/integrations/shopify";
import { prisma } from "@/lib/db";
import { appRouter } from "@/server/trpc/routers/_app";
import { createTestContext } from "@/server/trpc/context";

let seq = 0;
async function seed() {
  seq++;
  const userId = `u_shop_${Date.now()}_${seq}`;
  const orgId = `org_shop_${Date.now()}_${seq}`;
  await prisma.user.create({ data: { id: userId, email: `${userId}@x.local` } });
  await prisma.organization.create({ data: { id: orgId, name: "Shop Org", country: "US" } });
  await prisma.membership.create({ data: { userId, orgId, role: "OWNER" } });
  return { userId, orgId };
}

describe("shopify stub connector", () => {
  it("getInstallUrl points to the stub host without real keys", () => {
    const c = createShopifyConnector();
    const url = c.getInstallUrl({ shop: "demo.myshopify.com", state: "abc" });
    expect(url).toContain("stub.local");
    expect(url).toContain("shop=demo.myshopify.com");
    expect(url).toContain("state=abc");
  });

  it("exchangeCode returns a deterministic stub token", async () => {
    const c = createShopifyConnector();
    const out = await c.exchangeCode({ shop: "demo.myshopify.com", code: "auth-code-123" });
    expect(out.accessToken).toBe("stub_token_demo.myshopify.com");
    expect(out.scopes).toContain("read_products");
  });

  it("fetchProducts returns synthetic products and sync upserts into Sku", async () => {
    const { orgId } = await seed();
    const c = createShopifyConnector();
    const { upserted } = await syncShopifyProductsToSkus({
      orgId,
      connector: c,
      shop: "demo.myshopify.com",
      accessToken: "stub_token",
      prisma,
    });
    expect(upserted).toBe(3);

    const skus = await prisma.sku.findMany({ where: { orgId } });
    expect(skus.length).toBe(3);
    expect(skus.every((s) => s.source === "shopify")).toBe(true);
    expect(skus.every((s) => (s.externalId ?? "").startsWith("shopify:"))).toBe(true);
    expect(skus.flatMap((s) => s.imageUrls).length).toBeGreaterThan(0);
  });

  it("re-running sync is idempotent (upserts, no duplicates)", async () => {
    const { orgId } = await seed();
    const c = createShopifyConnector();
    await syncShopifyProductsToSkus({ orgId, connector: c, shop: "demo.myshopify.com", accessToken: "t", prisma });
    await syncShopifyProductsToSkus({ orgId, connector: c, shop: "demo.myshopify.com", accessToken: "t", prisma });
    const skus = await prisma.sku.findMany({ where: { orgId } });
    expect(skus.length).toBe(3);
  });

  it("imported SKU images flow into the classifier and produce a deterministic prediction", async () => {
    const { userId, orgId } = await seed();
    const c = createShopifyConnector();
    await syncShopifyProductsToSkus({ orgId, connector: c, shop: "demo.myshopify.com", accessToken: "t", prisma });

    const caller = appRouter.createCaller(createTestContext({ userId, orgId, role: "OWNER" }));
    const skus = await caller.sku.list({});
    const phone = skus.items.find((s) => s.title.toLowerCase().includes("smartphone"))!;
    expect(phone.imageUrls.length).toBeGreaterThan(0);

    const run = await caller.classification.run({ skuId: phone.id, destination: "US" });
    const detail = await caller.classification.get({ id: run.classificationId });
    expect(detail.hsCode).toBe("8517.13.0000");
    expect(detail.rationale).toMatch(/image inputs contributed/);
  });
});
