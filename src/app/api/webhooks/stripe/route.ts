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

async function logDebug(args: {
  eventType: string;
  eventId?: string;
  signatureOk: boolean;
  processedOk: boolean;
  errorMsg?: string;
  orgIdSeen?: string;
  bodySnippet?: string;
}) {
  try {
    await prisma.stripeWebhookDebug.create({
      data: {
        eventType: args.eventType,
        eventId: args.eventId ?? null,
        signatureOk: args.signatureOk,
        processedOk: args.processedOk,
        errorMsg: args.errorMsg ?? null,
        orgIdSeen: args.orgIdSeen ?? null,
        bodySnippet: args.bodySnippet?.slice(0, 500) ?? null,
      },
    });
  } catch {
    /* swallow */
  }
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  let event: Stripe.Event;
  try {
    event = stripe.constructWebhookEvent(body, sig);
  } catch (err: any) {
    await logDebug({
      eventType: "signature-failed",
      signatureOk: false,
      processedOk: false,
      errorMsg: err.message,
      bodySnippet: body,
    });
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  let orgIdSeen: string | undefined;
  let processedOk = true;
  let errorMsg: string | undefined;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.orgId;
        orgIdSeen = orgId;
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
        orgIdSeen = orgId;
        const priceId = sub.items.data[0]?.price?.id ?? "";
        const tier = (sub.metadata?.tier as Tier) ?? TIER_BY_PRICE[priceId] ?? "STARTER";
        const periodEnd = new Date((sub.current_period_end ?? Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60) * 1000);

        if (event.type === "customer.subscription.created" && orgId) {
          const customerId =
            typeof sub.customer === "string"
              ? sub.customer
              : (sub.customer as Stripe.Customer | null)?.id ?? `cust_${orgId}`;
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
        // unhandled event type — debug row is still written below
        break;
    }
  } catch (err: any) {
    processedOk = false;
    errorMsg = err.message ?? String(err);
  }

  await logDebug({
    eventType: event.type,
    eventId: event.id,
    signatureOk: true,
    processedOk,
    errorMsg,
    orgIdSeen,
    bodySnippet: body,
  });

  return NextResponse.json({ ok: processedOk });
}
