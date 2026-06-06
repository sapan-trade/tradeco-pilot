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
  fetchShopInfo(args: { shop: string; accessToken: string }): Promise<{ email: string | null; name: string | null }>;
  verifyWebhook(rawBody: string, signature: string | null): boolean;
}

const REQUIRED_SCOPES = "read_products";

/**
 * Coerce loose user input into a canonical `<handle>.myshopify.com`, or return
 * null if it can't be. Lets merchants paste almost anything instead of having to
 * remember the exact `store.myshopify.com` form:
 *   "mystore"                              -> mystore.myshopify.com
 *   "MyStore.myshopify.com/"               -> mystore.myshopify.com
 *   "https://mystore.myshopify.com/admin"  -> mystore.myshopify.com
 *   "admin.shopify.com/store/mystore"      -> mystore.myshopify.com
 */
export function normalizeShopDomain(input: string): string | null {
  let s = (input ?? "").trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\//, "");
  // New-style admin URL: admin.shopify.com/store/<handle>
  const adminMatch = s.match(/^admin\.shopify\.com\/store\/([a-z0-9][a-z0-9-]*)/);
  if (adminMatch) return `${adminMatch[1]}.myshopify.com`;
  // Drop any path, query string, or port.
  s = s.split("/")[0].split("?")[0].split(":")[0];
  if (!s) return null;
  // Bare handle with no dot -> assume a myshopify store.
  if (!s.includes(".")) {
    return /^[a-z0-9][a-z0-9-]*$/.test(s) ? `${s}.myshopify.com` : null;
  }
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s) ? s : null;
}

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
    const res = await fetch(`https://${shop}/admin/api/2025-01/products.json?limit=50`, {
      headers: { "X-Shopify-Access-Token": accessToken },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Shopify products fetch failed: ${res.status}${body ? ` — ${body.slice(0, 200)}` : ""}`);
    }
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
  async fetchShopInfo({ shop, accessToken }: { shop: string; accessToken: string }) {
    const res = await fetch(`https://${shop}/admin/api/2025-01/shop.json`, {
      headers: { "X-Shopify-Access-Token": accessToken },
    });
    if (!res.ok) return { email: null, name: null };
    const data = (await res.json()) as { shop?: { email?: string; name?: string } };
    return {
      email: data.shop?.email?.trim().toLowerCase() ?? null,
      name: data.shop?.name ?? null,
    };
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
  async fetchShopInfo({ shop }: { shop: string; accessToken: string }) {
    const handle = shop.replace(".myshopify.com", "");
    return { email: `owner@${handle}.example`, name: "Stub Store" };
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
