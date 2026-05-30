import Stripe from "stripe";

export type TierName = "STARTER" | "GROWTH" | "PRO";

export interface StripeClient {
  createCheckoutSession(args: { orgId: string; tier: TierName }): Promise<{ url: string }>;
  createPortalSession(args: { customerId: string }): Promise<{ url: string }>;
  recordUsage(args: { orgId: string; quantity: number }): Promise<void>;
  constructWebhookEvent(payload: string, signature: string | null): Stripe.Event;
}

const PRICE_ENV: Record<TierName, string> = {
  STARTER: "STRIPE_PRICE_STARTER",
  GROWTH: "STRIPE_PRICE_GROWTH",
  PRO: "STRIPE_PRICE_PRO",
};

class RealStripeClient implements StripeClient {
  constructor(private stripe: Stripe) {}

  async createCheckoutSession({ orgId, tier }: { orgId: string; tier: TierName }) {
    const priceId = process.env[PRICE_ENV[tier]];
    if (!priceId) throw new Error(`Missing env ${PRICE_ENV[tier]}`);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/settings/billing?success=1`,
      cancel_url: `${appUrl}/settings/billing?canceled=1`,
      metadata: { orgId, tier },
    });
    return { url: session.url ?? "" };
  }

  async createPortalSession({ customerId }: { customerId: string }) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/settings/billing`,
    });
    return { url: session.url };
  }

  async recordUsage(args: { orgId: string; quantity: number }) {
    // TODO: real metered billing requires storing subscriptionItemId on Subscription;
    // wire up once Stripe metered prices exist in the live account.
    console.log(`[stripe] recordUsage not yet wired for real Stripe (org=${args.orgId}, qty=${args.quantity})`);
  }

  constructWebhookEvent(payload: string, signature: string | null): Stripe.Event {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !signature) throw new Error("Stripe webhook secret/signature missing");
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }
}

function createStubStripeClient(): StripeClient {
  return {
    async createCheckoutSession(args) {
      console.log(`[stripe-stub] TODO: replace with real Stripe SDK (org=${args.orgId}, tier=${args.tier}).`);
      return { url: `https://stub.local/checkout?org=${args.orgId}&tier=${args.tier}` };
    },
    async createPortalSession(args) {
      console.log(`[stripe-stub] TODO: replace with real Stripe portal session (customer=${args.customerId}).`);
      return { url: `https://stub.local/portal?customer=${args.customerId}` };
    },
    async recordUsage(args) {
      console.log(`[stripe-stub] TODO: replace with real Stripe usage records (org=${args.orgId}, qty=${args.quantity}).`);
    },
    constructWebhookEvent(payload, _signature) {
      return JSON.parse(payload) as Stripe.Event;
    },
  };
}

let cached: StripeClient | null = null;

export function createStripeClient(): StripeClient {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  const useReal = key && process.env.NODE_ENV !== "test";
  cached = useReal
    ? new RealStripeClient(new Stripe(key!, { apiVersion: "2025-02-24.acacia" }))
    : createStubStripeClient();
  return cached;
}
