import crypto from "node:crypto";

export interface ShopifyProductRaw {
  id: string;
  title: string;
  description: string | null;
  imageUrls: string[];
  vendor: string | null;
  productType: string | null;
}

export interface ShopifyConnector {
  getInstallUrl(args: { shop: string; state: string }): string;
  exchangeCode(args: { shop: string; code: string }): Promise<{ accessToken: string; scopes: string[] }>;
  fetchProducts(args: { shop: string; accessToken: string }): Promise<ShopifyProductRaw[]>;
  verifyWebhook(rawBody: string, signature: string | null): boolean;
}

const REQUIRED_SCOPES = "read_products";

class RealShopifyConnector implements ShopifyConnector {
  getInstallUrl({ shop, state }: { shop: string; state: string }) {
    const clientId = (process.env.SHOPIFY_API_KEY ?? "").trim();
    const redirectUri = `${(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").trim()}/api/connectors/shopify/callback`;
    return (
      `https://${shop}/admin/oauth/authorize` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&scope=${encodeURIComponent(REQUIRED_SCOPES)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}`
    );
  }
  async exchangeCode({ shop, code }: { shop: string; code: string }) {
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: (process.env.SHOPIFY_API_KEY ?? "").trim(),
        client_secret: (process.env.SHOPIFY_API_SECRET ?? "").trim(),
        code,
      }),
    });
    if (!res.ok) throw new Error(`Shopify token exchange failed: ${res.status}`);
    const data = (await res.json()) as { access_token: string; scope?: string };
    return {
      accessToken: data.access_token,
      scopes: (data.scope ?? "").split(",").filter(Boolean),
    };
  }
  async fetchProducts({ shop, accessToken }: { shop: string; accessToken: string }) {
    const res = await fetch(`https://${shop}/admin/api/2024-10/products.json?limit=50`, {
      headers: { "X-Shopify-Access-Token": accessToken },
    });
    if (!res.ok) throw new Error(`Shopify products fetch failed: ${res.status}`);
    const data = (await res.json()) as { products?: Array<Record<string, any>> };
    return (data.products ?? []).map<ShopifyProductRaw>((p) => ({
      id: String(p.id),
      title: String(p.title ?? ""),
      description: typeof p.body_html === "string" ? p.body_html : null,
      imageUrls: Array.isArray(p.images) ? p.images.map((i: any) => String(i.src)) : [],
      vendor: p.vendor ?? null,
      productType: p.product_type ?? null,
    }));
  }
  verifyWebhook(rawBody: string, signature: string | null) {
    const secret = (process.env.SHOPIFY_API_SECRET ?? "").trim();
    if (!secret || !signature) return false;
    const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
    try {
      return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
    } catch {
      return false;
    }
  }
}

class StubShopifyConnector implements ShopifyConnector {
  getInstallUrl({ shop, state }: { shop: string; state: string }) {
    console.log("[shopify-stub] TODO: replace with real Shopify Admin API OAuth.");
    return `https://stub.local/shopify/install?shop=${encodeURIComponent(shop)}&state=${state}`;
  }
  async exchangeCode({ shop, code }: { shop: string; code: string }) {
    console.log(`[shopify-stub] exchangeCode shop=${shop} code=${code.slice(0, 6)}…`);
    return { accessToken: `stub_token_${shop}`, scopes: REQUIRED_SCOPES.split(",") };
  }
  async fetchProducts({ shop }: { shop: string; accessToken: string }) {
    console.log(`[shopify-stub] fetchProducts shop=${shop}`);
    return [
      {
        id: "stub-1001",
        title: "Men's cotton T-shirt",
        description: "100% cotton knit tee",
        imageUrls: ["https://stub.local/img/tshirt.jpg"],
        vendor: "Stub Apparel",
        productType: "Apparel",
      },
      {
        id: "stub-1002",
        title: "Ceramic mug",
        description: "Porcelain coffee mug, 12oz",
        imageUrls: ["https://stub.local/img/mug.jpg"],
        vendor: "Stub Home",
        productType: "Kitchen",
      },
      {
        id: "stub-1003",
        title: "Smartphone Model X",
        description: "5G mobile phone, 128GB",
        imageUrls: ["https://stub.local/img/phone.jpg"],
        vendor: "Stub Tech",
        productType: "Electronics",
      },
    ];
  }
  verifyWebhook(_rawBody: string, _signature: string | null) {
    return true;
  }
}

export function createShopifyConnector(): ShopifyConnector {
  const haveKeys = !!(process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET);
  const useReal = haveKeys && process.env.NODE_ENV !== "test";
  return useReal ? new RealShopifyConnector() : new StubShopifyConnector();
}

/**
 * Pulls products from a Shopify store and upserts them into the Sku table.
 * Returns counts. Imported externally by the sync route and the Inngest reconcile job.
 */
export async function syncShopifyProductsToSkus(args: {
  orgId: string;
  connector: ShopifyConnector;
  shop: string;
  accessToken: string;
  prisma: import("@prisma/client").PrismaClient;
}): Promise<{ upserted: number }> {
  const products = await args.connector.fetchProducts({ shop: args.shop, accessToken: args.accessToken });
  let upserted = 0;
  for (const p of products) {
    await args.prisma.sku.upsert({
      where: { orgId_externalId: { orgId: args.orgId, externalId: `shopify:${p.id}` } },
      create: {
        orgId: args.orgId,
        externalId: `shopify:${p.id}`,
        source: "shopify",
        title: p.title,
        description: p.description,
        imageUrls: p.imageUrls,
        currency: "USD",
      },
      update: {
        title: p.title,
        description: p.description,
        imageUrls: p.imageUrls,
      },
    });
    upserted++;
  }
  return { upserted };
}
