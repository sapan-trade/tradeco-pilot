import Stripe from "stripe";

export type TierName = "STARTER" | "GROWTH" | "PRO";

export interface StripeClient {
  createCheckoutSession(args: { orgId: string; tier: TierName }): Promise<{ url: string }>;
  createPortalSession(args: { customerId: string }): Promise<{ url: string }>;
  recordUsage(args: { orgId: string; quantity: number }): Promise<void>;
  constructWebhookEvent(payload: string, signature: string | null): Stripe.Event;

  // --- Connect: paying independent brokers ---
  /** Create a connected account for a broker (Stripe-hosted onboarding + payouts). */
  createConnectedAccount(args: { email: string | null; brokerUserId: string }): Promise<{ accountId: string }>;
  /** Hosted onboarding / requirement-collection link for a connected account. */
  createAccountLink(args: { accountId: string; refreshPath: string; returnPath: string }): Promise<{ url: string }>;
  /** Whether the connected account is cleared to receive payouts. */
  getAccountStatus(args: { accountId: string }): Promise<{ payoutsEnabled: boolean }>;
  /** Transfer a fixed fee from the platform balance to a broker's connected account. */
  payoutBroker(args: {
    accountId: string;
    amountCents: number;
    currency: string;
    idempotencyKey: string;
  }): Promise<{ transferId: string }>;
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
      // Propagate orgId to the Subscription itself so customer.subscription.* events carry it.
      subscription_data: { metadata: { orgId, tier } },
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

  async createConnectedAccount({ email, brokerUserId }: { email: string | null; brokerUserId: string }) {
    // Controller-based account (no legacy `type`): Stripe-hosted Express dashboard,
    // Stripe collects requirements (KYC), platform pays fees and is liable for losses.
    const account = await this.stripe.accounts.create({
      email: email ?? undefined,
      controller: {
        stripe_dashboard: { type: "express" },
        requirement_collection: "stripe",
        fees: { payer: "application" },
        losses: { payments: "application" },
      },
      capabilities: { transfers: { requested: true } },
      metadata: { brokerUserId },
    });
    return { accountId: account.id };
  }

  async createAccountLink({
    accountId,
    refreshPath,
    returnPath,
  }: {
    accountId: string;
    refreshPath: string;
    returnPath: string;
  }) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const link = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}${refreshPath}`,
      return_url: `${appUrl}${returnPath}`,
      type: "account_onboarding",
    });
    return { url: link.url };
  }

  async getAccountStatus({ accountId }: { accountId: string }) {
    const acct = await this.stripe.accounts.retrieve(accountId);
    return { payoutsEnabled: acct.payouts_enabled === true };
  }

  async payoutBroker({
    accountId,
    amountCents,
    currency,
    idempotencyKey,
  }: {
    accountId: string;
    amountCents: number;
    currency: string;
    idempotencyKey: string;
  }) {
    // Pay the broker: move funds from the platform balance to their connected account.
    const transfer = await this.stripe.transfers.create(
      { amount: amountCents, currency, destination: accountId },
      { idempotencyKey }
    );
    return { transferId: transfer.id };
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
    async createConnectedAccount(args) {
      console.log(`[stripe-stub] createConnectedAccount broker=${args.brokerUserId}`);
      return { accountId: `acct_stub_${args.brokerUserId}` };
    },
    async createAccountLink(args) {
      return { url: `https://stub.local/connect/onboard?acct=${args.accountId}` };
    },
    async getAccountStatus(_args) {
      // Stub treats every connected account as fully onboarded.
      return { payoutsEnabled: true };
    },
    async payoutBroker(args) {
      console.log(`[stripe-stub] payoutBroker acct=${args.accountId} amount=${args.amountCents}`);
      return { transferId: `tr_stub_${args.idempotencyKey}` };
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
