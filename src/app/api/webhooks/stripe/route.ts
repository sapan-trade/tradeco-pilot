import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createStripeClient } from "@/server/integrations/stripe";
import type Stripe from "stripe";

const stripe = createStripeClient();

type Tier = "STARTER" | "GROWTH" | "PRO";

const TIER_BY_PRICE: Record<string, Tier> = {
  [process.env.STRIPE_PRICE_STARTER ?? ""]: "STARTER",
  [process.env.STRIPE_PRICE_GROWTH ?? ""]: "GROWTH",
  [process.env.STRIPE_PRICE_PRO ?? ""]: "PRO",
};

const ALLOWANCE: Record<Tier, number> = {
  STARTER: 500,
  GROWTH: 5000,
  PRO: -1,
};

function mapStatus(s: string) {
  if (s === "active") return "ACTIVE";
  if (s === "trialing") return "TRIALING";
  if (s === "past_due") return "PAST_DUE";
  return "CANCELED";
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  let event: Stripe.Event;
  try {
    event = stripe.constructWebhookEvent(body, sig);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.orgId;
      if (!orgId) break;
      const tier = (session.metadata?.tier ?? "STARTER") as Tier;
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id ?? `cust_${orgId}`;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id ?? null;
      await prisma.subscription.upsert({
        where: { orgId },
        create: {
          orgId,
          tier,
          status: "ACTIVE",
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          skuAllowance: ALLOWANCE[tier],
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        update: {
          tier,
          status: "ACTIVE",
          stripeSubscriptionId: subscriptionId,
          skuAllowance: ALLOWANCE[tier],
        },
      });
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.orgId;
      const priceId = sub.items.data[0]?.price?.id ?? "";
      const tier = (sub.metadata?.tier as Tier) ?? TIER_BY_PRICE[priceId] ?? "STARTER";
      const periodEnd = new Date((sub.current_period_end ?? Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60) * 1000);

      if (event.type === "customer.subscription.created" && orgId) {
        const customerId =
          typeof sub.customer === "string" ? sub.customer : (sub.customer as Stripe.Customer | null)?.id ?? `cust_${orgId}`;
        await prisma.subscription.upsert({
          where: { orgId },
          create: {
            orgId,
            tier,
            status: mapStatus(sub.status),
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            skuAllowance: ALLOWANCE[tier],
            currentPeriodEnd: periodEnd,
          },
          update: {
            tier,
            status: mapStatus(sub.status),
            stripeSubscriptionId: sub.id,
            skuAllowance: ALLOWANCE[tier],
            currentPeriodEnd: periodEnd,
          },
        });
        console.log(`[stripe-webhook] subscription.created upserted for org=${orgId}`);
      } else {
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            tier,
            status: mapStatus(sub.status),
            skuAllowance: ALLOWANCE[tier],
            currentPeriodEnd: periodEnd,
          },
        });
      }
      break;
    }
    default:
      console.log(`[stripe-webhook] unhandled event ${event.type}`);
  }

  return NextResponse.json({ ok: true });
}
