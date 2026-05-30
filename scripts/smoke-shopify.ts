import { createShopifyConnector } from "@/server/integrations/shopify";

async function main() {
  const c = createShopifyConnector();
  const url = c.getInstallUrl({ shop: "tradeco-dev.myshopify.com", state: "smoke-state-token" });
  console.log("--- Shopify install URL ---");
  console.log(url);
  if (url.includes("stub.local")) {
    console.error("\nFAIL: still using stub. Check SHOPIFY_API_KEY + SHOPIFY_API_SECRET.");
    process.exit(1);
  }
  if (!url.startsWith("https://tradeco-dev.myshopify.com/admin/oauth/authorize")) {
    console.error("\nFAIL: URL doesn't match Shopify OAuth endpoint.");
    process.exit(1);
  }
  console.log("\nPASS: real Shopify OAuth install URL generated.");
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
