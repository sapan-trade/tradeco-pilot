import { createStripeClient } from "@/server/integrations/stripe";

async function main() {
  const stripe = createStripeClient();
  console.log("--- creating Starter checkout session ---");
  const a = await stripe.createCheckoutSession({ orgId: "smoke-org-1", tier: "STARTER" });
  console.log("Starter URL:", a.url);

  console.log("\n--- creating Growth checkout session ---");
  const b = await stripe.createCheckoutSession({ orgId: "smoke-org-1", tier: "GROWTH" });
  console.log("Growth URL:", b.url);
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
